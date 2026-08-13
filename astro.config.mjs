import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import playformCompress from '@playform/compress';

export default defineConfig({
  site: 'https://cuza.pages.dev',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/install') &&
        !page.includes('/upload') &&
        !page.includes('/contribute'),
      lastmod: new Date(),
    }),
    react(),
    playformCompress(),
  ],
});
