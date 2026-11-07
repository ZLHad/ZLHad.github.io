#!/usr/bin/env node
// Turns a photo into weighted-Voronoi stipple dots for the portrait on the home page
// (public/media/portrait.json and portrait.webp, the still for when JS is off). The page
// is dark, so light areas of the photo get more dots, and the white studio background
// is cut away first: it is whatever near-white region touches the edge of the frame.
//   node scripts/make-portrait.mjs <photo> [dots]
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const source = process.argv[2];
const N = Number(process.argv[3] ?? 7000);
const WIDTH = 300;

const { data: grey, info } = await sharp(source)
  .resize({ width: WIDTH })
  .flatten({ background: '#ffffff' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height;

// Flood in from the edges through near-white pixels: that is the background.
const bg = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) stack.push(x, x + (h - 1) * w);
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || grey[i] < 232) continue;
  bg[i] = 1;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) stack.push(i - 1);
  if (x < w - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - w);
  if (y < h - 1) stack.push(i + w);
}

const { data } = await sharp(source)
  .resize({ width: WIDTH })
  .flatten({ background: '#ffffff' })
  .greyscale()
  .clahe({ width: 42, height: 42, maxSlope: 4 })
  .normalise()
  .raw()
  .toBuffer({ resolveWithObject: true });
const density = new Float32Array(w * h);
// Distance to the background, in pixels up to RIM: the rim light that holds the outline.
const RIM = 5;
const near = (x, y) => {
  for (let r = 1; r <= RIM; r++) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) return r;
    }
  }
  return 0;
};
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) continue;
    const v = data[i] / 255;
    const rim = near(x, y);
    density[i] = Math.min(1, 0.05 + Math.pow(Math.max(0, v - 0.1), 1.3) + (rim ? 0.42 * (1 - (rim - 1) / RIM) : 0));
  }
}
let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Rejection sampling for the first guess.
const xs = new Float32Array(N), ys = new Float32Array(N);
for (let k = 0; k < N; ) {
  const x = rnd() * w, y = rnd() * h;
  if (rnd() < density[(y | 0) * w + (x | 0)]) { xs[k] = x; ys[k] = y; k++; }
}

// A few rounds of Lloyd relaxation, weighted by brightness, with a bucket grid for nearest-dot search.
const CELL = 6, GW = Math.ceil(w / CELL), GH = Math.ceil(h / CELL);
for (let iter = 0; iter < 26; iter++) {
  const buckets = Array.from({ length: GW * GH }, () => []);
  for (let k = 0; k < N; k++) buckets[Math.min(GH - 1, (ys[k] / CELL) | 0) * GW + Math.min(GW - 1, (xs[k] / CELL) | 0)].push(k);
  const sx = new Float32Array(N), sy = new Float32Array(N), sw = new Float32Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = density[y * w + x];
      if (d <= 0.002) continue;
      const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
      let best = -1, bestD = 1e9;
      for (let r = 0; r < 8; r++) {
        for (let gy = Math.max(0, cy - r); gy <= Math.min(GH - 1, cy + r); gy++) {
          for (let gx = Math.max(0, cx - r); gx <= Math.min(GW - 1, cx + r); gx++) {
            if (r > 0 && Math.abs(gx - cx) < r && Math.abs(gy - cy) < r) continue;
            for (const k of buckets[gy * GW + gx]) {
              const dd = (xs[k] - x) ** 2 + (ys[k] - y) ** 2;
              if (dd < bestD) { bestD = dd; best = k; }
            }
          }
        }
        if (best >= 0 && bestD < (r * CELL) ** 2) break;
      }
      if (best >= 0) { sx[best] += x * d; sy[best] += y * d; sw[best] += d; }
    }
  }
  for (let k = 0; k < N; k++) if (sw[k] > 0) { xs[k] = sx[k] / sw[k]; ys[k] = sy[k] / sw[k]; }
}

const out = [];
let circles = '';
for (let k = 0; k < N; k++) {
  const d = density[Math.min(h - 1, ys[k] | 0) * w + Math.min(w - 1, xs[k] | 0)];
  const r = 0.3 + d * 0.5;
  out.push(Math.round(xs[k] * 10), Math.round(ys[k] * 10), Math.round(r * 100));
  circles += `<circle cx="${xs[k].toFixed(1)}" cy="${ys[k].toFixed(1)}" r="${r.toFixed(2)}"/>`;
}
writeFileSync('public/media/portrait.json', JSON.stringify({ w, h, p: out }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}" fill="#eef1f5">${circles}</svg>`;
await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile('public/media/portrait.webp');
console.log(`portrait.json ${w}x${h}, ${N} dots, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
