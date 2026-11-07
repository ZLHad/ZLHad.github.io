// The site's single source of truth. Add a paper, project or patent by adding a
// YAML entry here; the lists, the popup, the timeline, BibTeX and the CV all follow.
// A typo in a field fails the build, so nothing wrong reaches the live site.
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
import { mechanismKeys } from './data/mechanisms';

const text = z.object({ en: z.string(), zh: z.string() });
const tier = z.enum(['space', 'air', 'ground']);

const papers = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/papers' }),
  schema: z.object({
    title: z.string(),
    titleZh: z.string().optional(),
    authors: z.array(z.string()),
    authorsZh: z.array(z.string()).optional(),
    venue: z.string(),
    venueZh: z.string().optional(),
    venueShort: z.string(),
    kind: z.enum(['journal', 'magazine', 'letter', 'correspondence', 'conference', 'preprint']),
    status: z.enum(['published', 'early-access', 'online-first', 'preprint']), // only what is already public
    date: z.coerce.date(), // first public date
    year: z.number(),
    volume: z.string().optional(),
    number: z.string().optional(),
    pages: z.string().optional(),
    doi: z.string().optional(),
    url: z.url().optional(),
    arxiv: z.string().optional(),
    tiers: z.array(tier), // tiers in the paper's system model
    stratum: z.enum(['space', 'control', 'air', 'ground']), // the altitude it acts at; sets the band on its page
    mechanism: z.enum(mechanismKeys),
    altitudes: z.string().optional(), // only values the paper itself states
    summary: text,
    links: z
      .object({
        code: z.url().optional(),
        data: z.url().optional(),
        pdf: z.url().optional(),
        site: z.url().optional(),
      })
      .optional(),
    abstract: z.object({ en: z.string().optional(), zh: z.string().optional() }).optional(),
    firstPage: z.boolean().default(false), // public/figures/<id>/first-page.webp exists
    figures: z
      .array(z.object({ file: z.string(), width: z.number(), height: z.number(), caption: text }))
      .default([]), // the first one is the thumbnail in lists
    homeFigure: z.string().optional(), // a different figure for the dark card on the home page
    highlights: z.array(z.object({ value: z.string(), label: text })).default([]), // only numbers traceable to run data
    selected: z.number().optional(), // shown on the home page, in this order
    dossier: z.boolean().default(false),
    hidden: z.boolean().default(false),
  }),
});

const dossiers = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/dossiers' }),
  schema: z.object({
    paper: z.string(),
    lang: z.enum(['en', 'zh']),
    headline: z.string(),
    dek: z.string(),
    look: z.enum(['space', 'control', 'air', 'ground']).optional(), // defaults to the paper's stratum
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: z.object({
    order: z.number(),
    name: z.string(),
    nameZh: z.string().optional(),
    tagline: text,
    body: text,
    repo: z.string().optional(), // owner/name, used to fetch stars at build time
    url: z.url().optional(),
    homepage: z.url().optional(),
    license: z.string().optional(),
    facts: z.array(z.object({ value: z.string(), label: text })).default([]),
    cover: z.string().optional(), // an image in public/, shown on project cards
  }),
});

const patents = defineCollection({
  loader: file('src/data/patents.yaml'),
  schema: z.object({
    id: z.string(),
    title: text,
    number: z.string(),
    kind: z.enum(['invention', 'utility']),
    status: z.enum(['granted', 'published']),
    date: z.coerce.date(),
    position: z.string(),
    hidden: z.boolean().default(false),
  }),
});

const awards = defineCollection({
  loader: file('src/data/awards.yaml'),
  schema: z.object({
    id: z.string(),
    title: text,
    event: text,
    work: text.optional(),
    year: z.number(),
  }),
});

export const collections = { papers, dossiers, projects, patents, awards };
