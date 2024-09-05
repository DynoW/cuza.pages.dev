import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import prefetch from "@astrojs/prefetch";
import compress from "astro-compress";

export default defineConfig({
  site: 'https://cuza.pages.dev',
  trailingSlash: 'never',
  redirects: {
    '/fizica': '/',
  },
  build: {
    format: 'file',
    inlineStylesheets: 'always'
  },
  integrations: [sitemap(), tailwind(), react(), prefetch(), compress()]
});