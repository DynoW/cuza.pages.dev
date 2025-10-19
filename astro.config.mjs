import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import sitemap from '@astrojs/sitemap';
import react from "@astrojs/react";
import compress from "astro-compress";

const siteConfig = {
  bucket_mode: "off", // "remote", "local", "off"
  countdown: "on" // "on", "off"
};

const publicDefines = Object.entries(siteConfig).reduce((acc, [key, value]) => {
  if (value !== undefined) {
    acc[`import.meta.env.PUBLIC_${key.toUpperCase()}`] = JSON.stringify(value);
  }
  return acc;
}, {});

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
    define: publicDefines,
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