import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

import svelteConfig from "../svelte.config.js";

export default [
  {
    ...svelte.configs.recommended[0],
    files: ["src/**/*.svelte"],
  },
  {
    ...svelte.configs.recommended[1],
    files: ["src/**/*.svelte"],
  },
  {
    ...svelte.configs.recommended[3],
    files: ["src/**/*.svelte"],
  },
  {
    files: ["src/**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte"],
        svelteConfig,
      },
    },
    rules: {
      "svelte/no-inline-styles": "error",
    },
  },
];
