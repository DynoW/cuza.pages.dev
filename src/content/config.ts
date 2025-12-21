import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders'; // Not available with legacy API
import { z } from 'astro/zod';

const infoCollection = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/info" }),
    schema: z.object({
        title: z.string(),
        description: z.string()
    }),
});

export const collections = {
    'info': infoCollection,
};
