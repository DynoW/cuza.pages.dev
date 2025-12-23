import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import compress from 'astro-compress';
import { buildPublicDefines, validateSiteConfig } from './src/utils/site-config';

const siteConfig = {
  bucket_mode: 'off', // "off", "local", "remote"
  public_countdown: 'on', // "on", "off"
  files_dir: 'files' // directory in the bucket for files
};

validateSiteConfig(siteConfig);

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
    define: buildPublicDefines(siteConfig),
    build: {
      rollupOptions: {
        output: {
          assetFileNames: `file/[name][extname]`,
        },
      },
    },

    plugins: [
      tailwindcss() // as any
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