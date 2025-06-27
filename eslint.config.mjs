import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}',],
    plugins: {js,}, extends: ['js/recommended',],
    rules: {
      // ERRORS, ERRORS EVERYWHERE! FUN FOR THE WHOLE FAMILY!
      'no-unused-vars': 'error',
      'no-useless-assignment': 'error',
      'require-atomic-updates': 'error',
      'no-use-before-define': 'error',
      'curly': 'error',
      'eqeqeq': 'error',
    },
  },
  {files: ['**/*.{js,mjs,cjs}'], languageOptions: {globals: globals.browser}},
]);