import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const postSchema = z.object({
	title: z.string(),
	description: z.string(),
	date: z.coerce.date(),
	feature_image: z.string().optional(),
	feature_alt: z.string().optional(),
	feature_caption: z.string().optional(),
});

const posts = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
	schema: postSchema,
});

const lucaPosts = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/luca/posts" }),
	schema: postSchema,
});

export const collections = { posts, lucaPosts };
