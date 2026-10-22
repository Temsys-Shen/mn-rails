export type Framework = "react" | "vue" | "svelte";
export type ProjectKind = "panel" | "hybrid";

export interface FrameworkSpec {
  name: Framework;
  label: string;
  description: string;
  typecheckCommand: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

const VERSIONS = {
  react: "^19.3.1",
  reactDom: "^19.3.1",
  typesReact: "^19.3.0",
  typesReactDom: "^19.3.0",
  vue: "^3.5.44",
  vueTsc: "^3.3.13",
  svelte: "^5.57.2",
  svelteCheck: "^4.7.7",
  vite: "^8.3.4",
  viteReact: "^6.1.2",
  viteVue: "^6.0.10",
  viteSvelte: "^7.3.1",
  typescript: "5.9.3",
  eslint: "^10.13.0",
  eslintJs: "^10.0.1",
  htmlEslint: "^0.67.0",
  noUnsanitized: "^4.1.5",
  globals: "^17.13.0",
  typescriptEslint: "^8.72.0",
  reactHooks: "^7.1.1",
  vueEslint: "^10.11.1",
  vueParser: "^10.4.1",
  svelteEslint: "^3.23.1",
  svelteParser: "^1.9.0",
} as const;

const ESLINT_DEPENDENCIES = {
  "@eslint/js": VERSIONS.eslintJs,
  "@html-eslint/eslint-plugin": VERSIONS.htmlEslint,
  "@html-eslint/parser": VERSIONS.htmlEslint,
  eslint: VERSIONS.eslint,
  "eslint-plugin-no-unsanitized": VERSIONS.noUnsanitized,
  globals: VERSIONS.globals,
  "typescript-eslint": VERSIONS.typescriptEslint,
};

export const FRAMEWORKS: Record<Framework, FrameworkSpec> = {
  react: {
    name: "react",
    label: "React",
    description: "React 19 + TypeScript + Vite",
    typecheckCommand: "tsc --noEmit",
    dependencies: {
      react: VERSIONS.react,
      "react-dom": VERSIONS.reactDom,
    },
    devDependencies: {
      "@types/react": VERSIONS.typesReact,
      "@types/react-dom": VERSIONS.typesReactDom,
      "@vitejs/plugin-react": VERSIONS.viteReact,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
      ...ESLINT_DEPENDENCIES,
      "eslint-plugin-react-hooks": VERSIONS.reactHooks,
    },
  },
  vue: {
    name: "vue",
    label: "Vue",
    description: "Vue 3 + TypeScript + Vite",
    typecheckCommand: "vue-tsc --noEmit",
    dependencies: {
      vue: VERSIONS.vue,
    },
    devDependencies: {
      "@vitejs/plugin-vue": VERSIONS.viteVue,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
      "vue-tsc": VERSIONS.vueTsc,
      ...ESLINT_DEPENDENCIES,
      "eslint-plugin-vue": VERSIONS.vueEslint,
      "vue-eslint-parser": VERSIONS.vueParser,
    },
  },
  svelte: {
    name: "svelte",
    label: "Svelte",
    description: "Svelte 5 + TypeScript + Vite",
    typecheckCommand: "svelte-check --tsconfig ./tsconfig.json",
    dependencies: {
      svelte: VERSIONS.svelte,
    },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": VERSIONS.viteSvelte,
      "svelte-check": VERSIONS.svelteCheck,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
      ...ESLINT_DEPENDENCIES,
      "eslint-plugin-svelte": VERSIONS.svelteEslint,
      "svelte-eslint-parser": VERSIONS.svelteParser,
    },
  },
};

export function isFramework(value: string): value is Framework {
  return value === "react" || value === "vue" || value === "svelte";
}

export function isProjectKind(value: string): value is ProjectKind {
  return value === "panel" || value === "hybrid";
}
