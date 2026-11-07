#!/usr/bin/env node
// Renders pages of a paper's PDF into public/figures/<slug>/ as WebP.
//
//   First page, for the overview popup:
//     node scripts/import-paper-page.mjs <slug> first-page <file.pdf> --page=1
//
//   A figure cropped out of a page, with the box as fractions of the page (x0,y0,x1,y1):
//     node scripts/import-paper-page.mjs <slug> scenario <file.pdf> --page=3 --crop=0.03,0.07,0.49,0.37
//
// Pages are cut 3.2% short at the bottom by default. Use --footer=0.045 on PDFs downloaded
// from IEEE Xplore, which removes the "Authorized licensed use limited to..." stamp.
//
// Student-number e-mail addresses are covered on every page, located through the PDF's
// text layer. Add more with --redact=<regex>; check the output by eye afterwards.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [slug, name, pdf] = args.filter((a) => !a.startsWith('--'));
const page = flags.page ?? '1';
const crop = flags.crop?.split(',').map(Number);
const dpi = Number(flags.dpi ?? (crop ? 300 : 110));
const width = Number(flags.width ?? (crop ? 1400 : 800));
const footer = Number(flags.footer ?? 0.032);

const dir = resolve('public/figures', slug);
mkdirSync(dir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'page-'));
execFileSync('pdftoppm', ['-png', '-r', String(dpi), '-f', page, '-l', page, pdf, join(tmp, 'p')], { stdio: ['ignore', 'ignore', 'ignore'] });
const rendered = join(tmp, readdirSync(tmp)[0]);
const meta = await sharp(rendered).metadata();

// Paint over matching words before anything is cropped.
const patterns = [/\d{7,}@/, ...(flags.redact ? [new RegExp(flags.redact)] : [])];
const bboxFile = join(tmp, 'words.html');
execFileSync('pdftotext', ['-bbox', '-f', page, '-l', page, pdf, bboxFile]);
const words = [...readFileSync(bboxFile, 'utf8').matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)];
const k = dpi / 72;
const covers = words
  .filter((w) => patterns.some((re) => re.test(w[5])))
  .map((w) => {
    const [x0, y0, x1, y1] = w.slice(1, 5).map(Number);
    const pad = Math.ceil(k); // about a point on each side, so no descenders are left behind
    const box = { left: Math.max(0, Math.floor(x0 * k) - pad), top: Math.max(0, Math.floor(y0 * k) - pad), width: Math.ceil((x1 - x0) * k) + 2 * pad, height: Math.ceil((y1 - y0) * k) + 2 * pad };
    return { input: { create: { width: box.width, height: box.height, channels: 3, background: '#ffffff' } }, left: box.left, top: box.top };
  });
const input = covers.length ? await sharp(rendered).composite(covers).png().toBuffer() : rendered;
if (covers.length) console.log(`  covered ${covers.length} word(s)`);
const box = crop
  ? { left: Math.round(crop[0] * meta.width), top: Math.round(crop[1] * meta.height), width: Math.round((crop[2] - crop[0]) * meta.width), height: Math.round((crop[3] - crop[1]) * meta.height) }
  : { left: 0, top: 0, width: meta.width, height: Math.round(meta.height * (1 - footer)) };
const out = join(dir, `${name}.webp`);
// Separate passes: within one sharp pipeline trim runs before extract, which breaks the box.
let buf = await sharp(input).extract(box).flatten({ background: '#ffffff' }).png().toBuffer();
if (crop) buf = await sharp(buf).trim({ threshold: 6 }).png().toBuffer();
const info = await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: crop ? 88 : 72, effort: 5 }).toFile(out);
rmSync(tmp, { recursive: true, force: true });
console.log(`${slug}/${name}.webp  ${info.width}x${info.height}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
