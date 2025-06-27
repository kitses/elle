import {Glob} from 'bun';
import {transform as esbuildTransform} from 'esbuild';
import fs from 'fs/promises';
import {minify as minifyHtml} from 'html-minifier-terser';
import markdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import path from 'path';
import * as sass from 'sass';

const SITE_DIR = '_site';
const ASSET_DIRS = [
  'src/assets/img',
];

// removes ignored directories from _site because i'm messy
const removeIgnoredDirectories = async (cwd) => {
  const ignoredDirectories = await Array.fromAsync(new Glob('**/_unused').scan({
    cwd,
    onlyFiles : false,
    absolute : true,
  }));

  await Promise.all(
    ignoredDirectories.map(async (dir) => {
      console.log(`Removing ignored directory: ${dir}`);
      await fs.rm(dir, {recursive : true, force : true});
    }),
  );
};

// minifies files based on their extensions, excluding JS and SCSS
const minifyFile = async (filePath) => {
  const sourceContent = await fs.readFile(filePath, 'utf8');
  const fileExtension = path.extname(filePath);

  if (fileExtension === '.html') {
    return minifyHtml(sourceContent, {
      collapseWhitespace : true,
      removeComments : true,
      removeOptionalTags : false, // lists are broken if else
      removeRedundantAttributes : true,
      removeScriptTypeAttributes : true,
      removeTagWhitespace : true,
      useShortDoctype : true,
      minifyCSS : true,
      minifyJS : true,
    });
  }

  if (fileExtension === '.css' || fileExtension === '.js') {
    const loader = fileExtension.slice(1);
    const {code} = await esbuildTransform(sourceContent, {
      loader,
      minify : true,
    });
    console.log(`Minified ${loader.toUpperCase()}: ${filePath}`);
    return code;
  }
  return sourceContent;
};

// does the deed
const optimizeOutput = async (outputDirectory) => {
  try {
    await removeIgnoredDirectories(outputDirectory);

    const targetFiles = await Array.fromAsync(new Glob('**/*.{html,css,js}').scan({
      cwd : outputDirectory,
      absolute : true,
    }));

    await Promise.all(
      targetFiles.map(async (file) => {
        const minifiedContent = await minifyFile(file);
        await fs.writeFile(file, minifiedContent);
      }),
    );
  } catch (error) {
    console.error('Post-build optimization failed:', error);
  }
};

export default (eleventyConfig) => {
  // redundant but needed /shrug.
  eleventyConfig.ignores.add('src/**/_unused/**');

  eleventyConfig.addShortcode(
    'currentYear',
    () => new Date().getFullYear().toString(),
  );

  eleventyConfig.addShortcode(
    'unixTime',
    () => Math.floor(Date.now() / 1000),
  );

  ASSET_DIRS.forEach(
    (directory) => eleventyConfig.addPassthroughCopy(directory),
  );

  // watch SCSS and JS files for changes
  const cssFiles = Array.from(new Glob('src/**/*.css').scanSync('.'));
  const scssFiles = Array.from(new Glob('src/**/*.scss').scanSync('.'));
  const jsFiles = Array.from(new Glob('src/**/*.js').scanSync('.'));

  [...cssFiles, ...scssFiles, ...jsFiles].forEach(
    (file) => eleventyConfig.addWatchTarget(file),
  );

  // configure markdownIt
  const md = markdownIt({html : true, linkify : true, typographer : false}).use(markdownItAttrs);

  // cache the original link_open renderer rule
  const defaultLinkOpenRenderer = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // override link_open rule to add rel="noopener" to external links
  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const href = token.attrGet('href');

    if (href && /^https?:\/\//i.test(href)) {
      token.attrJoin('rel', 'noopener');
    }

    // call the original renderer to ensure default behavior (e.g., adds
    // target="_blank" if specified via markdown-it-attrs)
    return defaultLinkOpenRenderer(tokens, idx, options, env, self);
  };

  eleventyConfig.setLibrary('md', md);

  eleventyConfig.addExtension('css', {
    outputFileExtension : 'css',
    compile(inputContent) {
      return async () => {
        const {code} = await esbuildTransform(inputContent, {
          loader : 'css',
          minify : true,
        });
        return code;
      };
    },
  });

  // SCSS support
  eleventyConfig.addExtension('scss', {
    outputFileExtension : 'css',
    compile(inputContent) {
      const {css} = sass.compileString(inputContent, {
        style : 'compressed',
      });
      return async () => css;
    }
  });

  // date filters yayaya
  eleventyConfig.addFilter(
    'date_to_datetime',
    (value) => value ? new Date(value).toISOString() : '',
  );

  eleventyConfig.addFilter('date_formatted', (value) => {
    if (!value) {
      return '';
    }

    const dateObject = new Date(value);

    // eleventy interprets date-only strings from front matter as midnight UTC
    // for some fucking reason. this is a hack, tread lightly
    const isDateOnly = dateObject.getUTCHours() === 0 && dateObject.getUTCMinutes() === 0 &&
                       dateObject.getUTCSeconds() === 0 && dateObject.getUTCMilliseconds() === 0;

    if (isDateOnly) {
      const options = {
        year : 'numeric',
        month : 'short',
        day : 'numeric',
        timeZone : 'UTC',
      };
      return new Intl.DateTimeFormat('en-US', options).format(dateObject);
    } else {
      const options = {
        year : 'numeric',
        month : 'short',
        day : 'numeric',
        hour : 'numeric',
        minute : '2-digit',
        timeZone : 'America/Chicago',
        timeZoneName : 'short',
      };
      return new Intl.DateTimeFormat('en-US', options).format(dateObject);
    }
  });

  // add posts collection
  eleventyConfig.addCollection(
    'posts',
    (collection) => collection.getFilteredByGlob('src/posts/*.md').reverse(),
  );

  // post-build optimization
  eleventyConfig.on('afterBuild', () => optimizeOutput(SITE_DIR));

  return {
    templateFormats : [ 'njk', 'md', 'scss' ],
    dir : {
      input : 'src',
      output : SITE_DIR,
      includes : '_includes',
      data : '_data',
    },
  };
};
