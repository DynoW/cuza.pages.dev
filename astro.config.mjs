import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import sitemap from '@astrojs/sitemap';
import react from "@astrojs/react";
import compress from "astro-compress";

const COUNTDOWN_DATE = new Date('2024-12-31T23:59:59').getTime();

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
    define: {
      'import.meta.env.COUNTDOWN_DATE': JSON.stringify(COUNTDOWN_DATE)
    },
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