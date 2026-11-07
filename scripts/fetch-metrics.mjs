#!/usr/bin/env node
// Refreshes live numbers at build time: GitHub stars for each project and citation
// counts for each DOI (OpenAlex). The result is a plain JSON file the pages import,
// so a static site can still show current numbers. Any failure keeps the previous
// value, and a network problem never fails the build.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const OUT = 'src/data/generated/metrics.json';
let previous = { stars: {}, citations: {}, fetchedAt: null };
try { previous = JSON.parse(readFileSync(OUT, 'utf8')); } catch {}

const field = (text, name) => text.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1].trim();
const ghHeaders = { 'User-Agent': 'homepage-metrics', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };

const stars = { ...previous.stars };
for (const f of readdirSync('src/content/projects')) {
  const repo = field(readFileSync(`src/content/projects/${f}`, 'utf8'), 'repo');
  if (!repo) continue;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: ghHeaders, signal: AbortSignal.timeout(15000) });
    if (res.ok) stars[repo] = (await res.json()).stargazers_count;
    else console.warn(`stars ${repo}: HTTP ${res.status}, keeping previous`);
  } catch (err) { console.warn(`stars ${repo}: ${err.message}, keeping previous`); }
}

const citations = { ...previous.citations };
for (const f of readdirSync('src/content/papers')) {
  const doi = field(readFileSync(`src/content/papers/${f}`, 'utf8'), 'doi');
  if (!doi) continue;
  try {
    const res = await fetch(`https://api.openalex.org/works/doi:${doi}`, { headers: { 'User-Agent': 'homepage-metrics' }, signal: AbortSignal.timeout(15000) });
    if (res.ok) citations[doi] = (await res.json()).cited_by_count;
    else if (res.status !== 404) console.warn(`citations ${doi}: HTTP ${res.status}`);
  } catch (err) { console.warn(`citations ${doi}: ${err.message}, keeping previous`); }
}

writeFileSync(OUT, JSON.stringify({ stars, citations, fetchedAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`metrics: ${Object.keys(stars).length} repos, ${Object.keys(citations).length} DOIs`);
