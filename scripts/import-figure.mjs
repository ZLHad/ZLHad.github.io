#!/usr/bin/env node
// Import a figure into public/figures/<slug>/ as a WebP.
//
//   npm run figure -- <slug> <name> <source.pdf|.png|.jpg> [--dpi=220] [--width=1800]
//
// PDFs are rasterised with pdftoppm (poppler). SVG export from these PDFs comes
// out at 2–6 MB, so a 220 dpi WebP is the better trade for the web.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')),
);
const [slug, name, source] = args.filter((a) => !a.startsWith('--'));
if (!slug || !name || !source) {
  console.error('usage: npm run figure -- <slug> <name> <source> [--dpi=220] [--width=1800]');
  process.exit(1);
}

const dpi = Number(flags.dpi ?? 220);
const width = Number(flags.width ?? 1800);
const outDir = resolve('public/figures', slug);
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${name}.webp`);

let input = source;
let tmp = null;
if (extname(source).toLowerCase() === '.pdf') {
  tmp = mkdtempSync(join(tmpdir(), 'figure-'));
  execFileSync('pdftoppm', ['-png', '-r', String(dpi), '-f', '1', '-l', '1', source, join(tmp, 'page')]);
  input = join(tmp, readdirSync(tmp)[0]);
}

const info = await sharp(input)
  .flatten({ background: '#ffffff' })
  .resize({ width, withoutEnlargement: true })
  .webp({ quality: 86, effort: 5 })
  .toFile(out);

if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log(`${out}  ${info.width}x${info.height}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
