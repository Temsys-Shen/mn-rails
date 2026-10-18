export type Framework = "react" | "vue" | "svelte";
export type ProjectKind = "panel" | "hybrid";

export interface FrameworkSpec {
  name: Framework;
  label: string;
  description: string;
  checkCommand: string;
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
} as const;

export const FRAMEWORKS: Record<Framework, FrameworkSpec> = {
  react: {
    name: "react",
    label: "React",
    description: "React 19 + TypeScript + Vite",
    checkCommand: "tsc --noEmit",
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
    },
  },
  vue: {
    name: "vue",
    label: "Vue",
    description: "Vue 3 + TypeScript + Vite",
    checkCommand: "vue-tsc --noEmit",
    dependencies: {
      vue: VERSIONS.vue,
    },
    devDependencies: {
      "@vitejs/plugin-vue": VERSIONS.viteVue,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
      "vue-tsc": VERSIONS.vueTsc,
    },
  },
  svelte: {
    name: "svelte",
    label: "Svelte",
    description: "Svelte 5 + TypeScript + Vite",
    checkCommand: "svelte-check --tsconfig ./tsconfig.json",
    dependencies: {
      svelte: VERSIONS.svelte,
    },
    devDependencies: {
      "@sveltejs/vite-plugin-svelte": VERSIONS.viteSvelte,
      "svelte-check": VERSIONS.svelteCheck,
      typescript: VERSIONS.typescript,
      vite: VERSIONS.vite,
    },
  },
};

export function isFramework(value: string): value is Framework {
  return value === "react" || value === "vue" || value === "svelte";
}

export function isProjectKind(value: string): value is ProjectKind {
  return value === "panel" || value === "hybrid";
}
