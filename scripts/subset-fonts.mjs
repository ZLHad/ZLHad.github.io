#!/usr/bin/env node
// Builds small Chinese web fonts holding only the characters this site uses.
//   npm run fonts
// Scans src/ for CJK characters, downloads Noto Sans SC (OFL) once into .font-cache/,
// and writes public/fonts/NotoSansSC-{300,400,500}.woff2. Run it after adding Chinese
// copy. A character missing from the subset still renders, in the system sans.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const CACHE = '.font-cache';
const OUT = 'public/fonts';
const BASE = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC';
const WEIGHTS = { 300: 'Light', 400: 'Regular', 500: 'Medium' };

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// The few Chinese characters on the English pages get their own tiny file, so an
// English reader never downloads the whole subset. See the unicode-range in fonts.css.
const MINI = '张凌豪理论地基';
const chars = new Set('，。、；：！？（）《》“”‘’');
for (const file of walk('src')) {
  if (!/\.(astro|ts|yaml|mdx|md)$/.test(file)) continue;
  for (const ch of readFileSync(file, 'utf8')) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3000 && c <= 0x303f) || (c >= 0x3400 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)) chars.add(ch);
  }
}
const text = [...chars].join('');
console.log(`${chars.size} characters`);

for (const [weight, name] of Object.entries(WEIGHTS)) {
  const cached = join(CACHE, `NotoSansSC-${name}.otf`);
  if (!existsSync(cached)) {
    console.log(`downloading ${name}…`);
    const res = await fetch(`${BASE}/NotoSansSC-${name}.otf`);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  const out = await subsetFont(readFileSync(cached), text, { targetFormat: 'woff2' });
  const file = join(OUT, `NotoSansSC-${weight}.woff2`);
  writeFileSync(file, out);
  console.log(`${file}  ${(out.length / 1024).toFixed(0)} KB`);
  if (weight !== '500') {
    const mini = await subsetFont(readFileSync(cached), MINI, { targetFormat: 'woff2' });
    writeFileSync(join(OUT, `NotoSansSC-mini-${weight}.woff2`), mini);
    console.log(`  mini-${weight}  ${(mini.length / 1024).toFixed(1)} KB`);
  }
}
