import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';

export type Paper = CollectionEntry<'papers'>;

export const ME = 'Linghao Zhang';

export const isFirstAuthor = (p: Paper) => p.data.authors[0] === ME;
export const isPublished = (p: Paper) => p.data.status !== 'preprint';

const newestFirst = (a: Paper, b: Paper) => b.data.date.getTime() - a.data.date.getTime();

export async function allPapers(): Promise<Paper[]> {
  return (await getCollection('papers', (p) => !p.data.hidden)).sort(newestFirst);
}

/** The CV's rule: first-author papers first, then co-authored, newest first within each. */
export function publishedOrder(papers: Paper[]): Paper[] {
  const pub = papers.filter(isPublished);
  return [...pub.filter(isFirstAuthor), ...pub.filter((p) => !isFirstAuthor(p))];
}

export const titleOf = (p: Paper, lang: Lang) => (lang === 'zh' && p.data.titleZh) || p.data.title;
export const venueOf = (p: Paper, lang: Lang) => (lang === 'zh' && p.data.venueZh) || p.data.venue;
export const authorsOf = (p: Paper, lang: Lang) =>
  (lang === 'zh' && p.data.authorsZh) || p.data.authors;
export const isMe = (name: string) => name === ME || name === '张凌豪';

export const abstractOf = (p: Paper, lang: Lang) => p.data.abstract?.[lang] ?? p.data.abstract?.en ?? p.data.abstract?.zh;

/** The main figure of a paper, used as its thumbnail in lists. A home-page card can name another. */
export const thumbOf = (p: Paper, onHome = false) => {
  const f = (onHome && p.data.figures.find((x) => x.file === p.data.homeFigure)) || p.data.figures[0];
  return f ? { src: `/figures/${p.id}/${f.file}`, width: f.width, height: f.height, caption: f.caption } : null;
};

/** What to call the paper's main web link. */
export const linkLabel = (p: Paper, lang: Lang) => {
  if (p.data.arxiv) return 'arXiv';
  if (p.data.doi?.startsWith('10.1109')) return 'IEEE Xplore';
  if (p.data.url?.includes('cnki')) return lang === 'zh' ? '知网' : 'CNKI';
  return lang === 'zh' ? '期刊页面' : 'Journal page';
};

/** The lowest and highest altitude the papers state for one tier, or null if none does. */
export const altitudeRange = (papers: Paper[], pattern: RegExp) => {
  const found = papers.flatMap((p) => {
    const m = p.data.altitudes?.match(pattern);
    return m ? [Number(m[1])] : [];
  });
  return found.length ? [Math.min(...found), Math.max(...found)] : null;
};

export const selectedPapers = (papers: Paper[]) =>
  papers.filter((p) => p.data.selected).sort((a, b) => a.data.selected! - b.data.selected!);

export const paperLink = (p: Paper): string | undefined => {
  if (p.data.doi) return `https://doi.org/${p.data.doi}`;
  return p.data.url;
};

/** Full names, per the CV's convention. */
export function citation(p: Paper, lang: Lang): string {
  const d = p.data;
  const bits = [authorsOf(p, lang).join(', '), `“${titleOf(p, lang)}”`, venueOf(p, lang)];
  if (d.volume) bits.push(`vol. ${d.volume}`);
  if (d.number) bits.push(`no. ${d.number}`);
  if (d.pages) bits.push(`pp. ${d.pages.replace('-', '–')}`);
  bits.push(String(d.year));
  if (d.doi) bits.push(`doi: ${d.doi}`);
  return bits.join(', ') + '.';
}

const bibKey = (p: Paper) => {
  const family = p.data.authors[0].split(' ').slice(-1)[0].toLowerCase();
  const word = p.data.title.replace(/[^A-Za-z ]/g, '').split(' ').find((w) => w.length > 3) ?? 'paper';
  return `${family}${p.data.year}${word.toLowerCase()}`;
};

export function bibtex(p: Paper): string {
  const d = p.data;
  const type = d.kind === 'conference' ? 'inproceedings' : d.kind === 'preprint' ? 'misc' : 'article';
  const venueField = d.kind === 'conference' ? 'booktitle' : d.kind === 'preprint' ? 'howpublished' : 'journal';
  const author = d.authors
    .map((n) => {
      const parts = n.split(' ');
      const family = parts.pop();
      return `${family}, ${parts.join(' ')}`;
    })
    .join(' and ');
  const fields: [string, string | undefined][] = [
    ['author', author],
    ['title', d.title],
    [venueField, d.kind === 'preprint' ? `arXiv:${d.arxiv}` : d.venue.replace(/&/g, '\\&')],
    ['year', String(d.year)],
    ['volume', d.volume],
    ['number', d.number],
    ['pages', d.pages?.replace('-', '--')],
    ['doi', d.doi],
    ['url', d.doi ? undefined : d.url],
    [
      'note',
      d.status === 'early-access' ? 'Early Access' : d.status === 'online-first' ? 'Online First' : undefined,
    ],
  ];
  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = {${v}},`)
    .join('\n');
  return `@${type}{${bibKey(p)},\n${body}\n}`;
}

/** schema.org record for search engines and Google Scholar-style crawlers. */
export const scholarlyArticle = (p: Paper) => ({
  '@type': 'ScholarlyArticle',
  headline: p.data.title,
  author: p.data.authors.map((name) => ({ '@type': 'Person', name })),
  datePublished: p.data.date.toISOString().slice(0, 10),
  isPartOf: p.data.venue,
  ...(p.data.doi ? { identifier: `https://doi.org/${p.data.doi}` } : {}),
});
