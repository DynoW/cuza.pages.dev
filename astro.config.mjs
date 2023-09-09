import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://cuza.pages.dev',
    trailingSlash: 'never',
    build: {
        format: 'file'
    },
    integrations: [sitemap()],
});
