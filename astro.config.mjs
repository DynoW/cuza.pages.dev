import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";

import prefetch from "@astrojs/prefetch";

// https://astro.build/config
export default defineConfig({
  site: 'https://cuza.pages.dev',
  trailingSlash: 'never',
  build: {
    format: 'file'
  },
  integrations: [sitemap(), tailwind(), react(), prefetch()]
});