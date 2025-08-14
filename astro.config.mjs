import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import sitemap from '@astrojs/sitemap';
import react from "@astrojs/react";
import compress from "astro-compress";

export default defineConfig({
  site: 'https://cuza.pages.dev',
  trailingSlash: 'never',
  redirects: {
    '/fizica': '/',
  },
  build: {
    format: 'file',
    inlineStylesheets: 'always',
    assets: 'file'
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: `file/[name][extname]`,
        },
      },
    },
    plugins: [
      tailwindcss()
    ]
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark'
    }
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/install') && !page.includes('/upload')
    }),
    react(),
    compress()
  ]
});