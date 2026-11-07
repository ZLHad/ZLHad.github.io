#!/usr/bin/env node
// Moves the old Hexo blog into this site as a frozen archive. Run once from the project
// root, on a checkout of the old site's master branch:
//   node scripts/import-legacy.mjs <checkout>
//
// The blog goes to public/blog/, with its links rewritten to stay inside /blog/. LoveU goes
// to public/LoveU/, the address it always had. Neither is linked from the new site, and every
// page is marked noindex. The only content change: broken mail links (href="/name@host", which
// have always led to a 404) are removed. src/pages/404.astro sends the old URLs to the new ones.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/import-legacy.mjs <checkout>');

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    if (f === '.git') return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const write = (to, data) => {
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, data);
};
const noindex = (html) => html.replace(/<head[^>]*>/i, (m) => `${m}<meta name="robots" content="noindex">`);

// Paths that moved. A project page such as /2020WinterProjects_SAST/ belongs to its own
// repository and stays where it is, hence the slash after the year.
const MOVED = /^\/(?:20\d\d\/|archives|categories|index\.html|link|page|smallTalk|tags)/;
const ownUrl = (html) =>
  html.replace(/https?:\/\/(?:www\.)?zlhad\.top(\/[^"'<>\s)]*)?/g, (whole, path) => {
    if (!path || path === '/') return 'https://zlhad.top/blog/';
    return MOVED.test(path) ? `https://zlhad.top/blog${path}` : whole;
  });
const blogPage = (html) =>
  noindex(
    ownUrl(
      html
        .replace(/<a\b[^>]*\shref="\/[^"]*@[^"]*"[^>]*>.*?<\/a>/gs, '')
        .replace(/\b(href|src|action)="\/(?!\/)/g, '$1="/blog/')
        .replace(/\broot: '\/'/g, "root: '/blog/'")
        .replace(/'\/(img|css|js)\//g, "'/blog/$1/"),
    ),
  );

const blogOut = 'public/blog';
const loveOut = 'public/LoveU';
rmSync(blogOut, { recursive: true, force: true });
rmSync(loveOut, { recursive: true, force: true });

let pages = 0;
let files = 0;
for (const file of walk(src)) {
  const rel = relative(src, file);
  if (['404.html', 'CNAME', 'README.md', 'LoveU/README.md'].includes(rel)) continue;
  const love = rel.startsWith('LoveU/');
  const to = love ? join(loveOut, rel.slice('LoveU/'.length)) : join(blogOut, rel);
  if (extname(file) === '.html') {
    const html = readFileSync(file, 'utf8');
    write(to, love ? noindex(html) : blogPage(html));
    pages++;
  } else {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(file, to);
  }
  files++;
}
console.log(`${files} files, ${pages} pages`);
