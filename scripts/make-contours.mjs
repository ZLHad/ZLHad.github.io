#!/usr/bin/env node
// Generates the topographic contour field on the ground zone (public/media/contours.svg).
// Marching squares over a seeded fractal noise field. Run once; the result is committed.
import { writeFileSync } from 'node:fs';

const W = 1600, H = 900, NX = 200, NY = 112, LEVELS = 13;
let seed = 20261106;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const table = Array.from({ length: 4096 }, rnd);
const h2 = (x, y) => table[(x * 73 + y * 179) & 4095];
const smooth = (t) => t * t * (3 - 2 * t);
const noise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const fbm = (x, y) => {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { v += a * noise(x * f, y * f); a *= 0.5; f *= 2.03; }
  return v;
};
const field = [];
for (let j = 0; j <= NY; j++) {
  const row = [];
  for (let i = 0; i <= NX; i++) row.push(fbm(i * 0.022 + 3.1, j * 0.03 + 7.7));
  field.push(row);
}
const px = (i) => (i / NX) * W;
const py = (j) => (j / NY) * H;
const lerp = (a, b, l) => (l - a) / (b - a);
const paths = [];
for (let l = 0; l < LEVELS; l++) {
  const level = 0.2 + (l / (LEVELS - 1)) * 0.6;
  let d = '';
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = field[j][i], b = field[j][i + 1], c = field[j + 1][i + 1], e = field[j + 1][i];
      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (e > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = [px(i + lerp(a, b, level)), py(j)];
      const R = [px(i + 1), py(j + lerp(b, c, level))];
      const B = [px(i + lerp(e, c, level)), py(j + 1)];
      const L = [px(i), py(j + lerp(a, e, level))];
      const segs = {
        1: [L, B], 2: [B, R], 3: [L, R], 4: [T, R], 5: [L, T, B, R], 6: [T, B], 7: [L, T],
        8: [L, T], 9: [T, B], 10: [L, B, T, R], 11: [T, R], 12: [L, R], 13: [B, R], 14: [L, B],
      }[code];
      for (let s = 0; s < segs.length; s += 2) {
        d += `M${segs[s][0].toFixed(0)} ${segs[s][1].toFixed(0)}L${segs[s + 1][0].toFixed(0)} ${segs[s + 1][1].toFixed(0)}`;
      }
    }
  }
  const index = l % 4 === 0;
  paths.push(`<path d="${d}" stroke-width="${index ? 1 : 0.55}" stroke-opacity="${index ? 0.5 : 0.28}"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#1a1814" stroke-linecap="round">${paths.join('')}</g></svg>`;
writeFileSync('public/media/contours.svg', svg);
console.log('contours.svg', (svg.length / 1024).toFixed(0), 'KB');
