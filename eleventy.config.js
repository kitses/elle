import fs from "node:fs/promises";
import path from "node:path";
import { transformSync } from "esbuild";
import fg from "fast-glob";
import { minify as minifyHtml } from "html-minifier-terser";
import markdownIt from "markdown-it";
import markdownItAttrs from "markdown-it-attrs";
import * as sass from "sass";

const SITE_DIR = "_site";

export default (eleventyConfig) => {
  // redundant but needed /shrug.
  eleventyConfig.ignores.add("src/**/_unused/**");

  eleventyConfig.addShortcode(
    "currentYear",
    () => new Date().getFullYear().toString(),
  );

  eleventyConfig.addShortcode(
    "unixTime",
    () => Math.floor(Date.now() / 1000).toString(),
  );

  eleventyConfig.addPassthroughCopy("src/assets/img");
  eleventyConfig.addWatchTarget("src/**/*.{css,scss,js}");

  const md = markdownIt({ html: true, linkify: true, typographer: false }).use(
    markdownItAttrs,
  );

  const defaultLinkRenderer = md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href");
    if (href && /^https?:\/\//i.test(href)) {
      tokens[idx].attrJoin("rel", "noopener");
    }
    return defaultLinkRenderer(tokens, idx, options, env, self);
  };
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: (content) => () => {
      return transformSync(content, { loader: "css", minify: true }).code;
    },
  });

  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",
    compile: (content) => () => {
      const { css } = sass.compileString(content, { style: "expanded" });
      return transformSync(css, { loader: "css", minify: true }).code;
    },
  });

  eleventyConfig.addFilter(
    "date_to_datetime",
    (value) => value ? new Date(value).toISOString() : "",
  );

  eleventyConfig.addFilter("date_formatted", (value) => {
    if (!value) return "";
    const date = new Date(value);

    // HACK: eleventy interprets date-only strings from front matter as midnight UTC
    // for some fucking reason. do not remove
    const isDateOnly = date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0;

    if (isDateOnly) {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
    }
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
      timeZoneName: "short",
    }).format(date);
  });

  const postGlobs = {
    posts: "src/posts/*.md",
    postsLuca: "src/luca/posts/*.md",
  };

  Object.entries(postGlobs).forEach(([name, glob]) => {
    eleventyConfig.addCollection(
      name,
      (collection) => collection.getFilteredByGlob(glob).reverse(),
    );
  });

  eleventyConfig.on("afterBuild", async () => {
    const ignoredDirs = await fg("**/_unused", {
      cwd: SITE_DIR,
      onlyDirectories: true,
      absolute: true,
    });

    await Promise.all(
      ignoredDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );

    const files = await fg("**/*.{html,css,js}", {
      cwd: SITE_DIR,
      absolute: true,
    });

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      const ext = path.extname(file);
      let output = content;

      if (ext === ".html") {
        output = await minifyHtml(content, {
          collapseWhitespace: true,
          removeComments: true,
          removeOptionalTags: false, // lists are broken if else
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeTagWhitespace: true,
          useShortDoctype: true,
          minifyCSS: true,
          minifyJS: true,
        });
      } else if (ext === ".css") {
        output = transformSync(content, { loader: "css", minify: true }).code;
      } else if (ext === ".js") {
        output = transformSync(content, { loader: "js", minify: true }).code;
      }

      if (output !== content) {
        await fs.writeFile(file, output);
      }
    }
  });

  return {
    templateFormats: ["njk", "md", "scss", "css"],
    dir: {
      input: "src",
      output: SITE_DIR,
      includes: "_includes",
      data: "_data",
    },
  };
};
