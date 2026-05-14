import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    hero: z.string().optional(),
    draft: z.boolean().default(false),
    mediumId: z.string().optional(),
    mediumUrl: z.string().url().optional(),
    republishedFrom: z.literal("medium").optional(),
  }),
});

export const collections = { blog };
