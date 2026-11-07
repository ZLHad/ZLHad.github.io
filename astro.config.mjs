import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://zlhad.top',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  devToolbar: { enabled: false },
});
