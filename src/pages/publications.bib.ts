// Every paper on the site, as one BibTeX file.
import type { APIRoute } from 'astro';
import { allPapers, bibtex } from '~/lib/papers';

export const GET: APIRoute = async () => {
  const papers = await allPapers();
  return new Response(papers.map(bibtex).join('\n\n') + '\n', {
    headers: { 'Content-Type': 'application/x-bibtex; charset=utf-8' },
  });
};
