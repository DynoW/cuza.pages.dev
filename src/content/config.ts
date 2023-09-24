import { z, defineCollection } from 'astro:content';

const infoCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string()
    }),
});

export const collections = {
    'info': infoCollection,
};