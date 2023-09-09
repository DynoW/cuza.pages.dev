import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    site: 'https://cuza.pages.dev',
    pages: {
        'page.astro': 'page.html'
    },
    integrations: [sitemap()],
});
