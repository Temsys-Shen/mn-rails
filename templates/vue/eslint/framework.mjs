import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";

export default [
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/no-static-inline-styles": ["error", { allowBinding: false }],
      "vue/no-v-html": "error",
    },
  },
];
