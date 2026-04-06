// @ts-check
import { defineConfig } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import compress from "astro-compress";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
	markdown: {
		rehypePlugins: [[rehypeExternalLinks, { rel: ["noopener"] }]],
	},
	integrations: [
		compress({
			Image: false,
			SVG: false,
			HTML: {
				collapseWhitespace: true,
			},
		}),
	],
});
