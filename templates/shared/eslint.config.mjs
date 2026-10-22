import js from "@eslint/js";
import html from "@html-eslint/eslint-plugin";
import htmlParser from "@html-eslint/parser";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";
import tseslint from "typescript-eslint";

import frameworkConfig from "./eslint/framework.mjs";

const BROWSER_ONLY_GLOBALS = [
  "window",
  "document",
  "fetch",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "location",
  "navigator",
  "history",
  "Element",
  "HTMLElement",
  "Node",
  "Document",
];

const NATIVE_GLOBALS = [
  "JSB",
  "self",
  "Application",
  "AddonWebPanel",
  "createPanelAddon",
  "console",
];

const PAGE_NATIVE_GLOBALS = ["JSB", "Application", "Database"];

const DOM_MUTATION_RESTRICTIONS = [
  {
    selector:
      "CallExpression[callee.property.name=/^(append|appendChild|insertBefore|removeChild|replaceChild|replaceChildren|insertAdjacentElement|insertAdjacentHTML|insertAdjacentText|before|after|prepend|remove|replaceWith|setAttribute|setAttributeNS|setAttributeNode|setAttributeNodeNS|removeAttribute|removeAttributeNS|removeAttributeNode|toggleAttribute|normalize)$/]",
    message: "页面使用框架声明式渲染，不要直接修改 DOM。",
  },
  {
    selector:
      "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML|innerText|outerText|textContent|className|style)$/]",
    message: "页面使用框架声明式渲染，不要直接修改 DOM 或内联样式。",
  },
  {
    selector: "AssignmentExpression[left.object.property.name='style']",
    message: "页面使用 CSS 类管理样式，不要直接修改元素样式。",
  },
  {
    selector: "CallExpression[callee.object.property.name='classList']",
    message: "页面使用框架状态与 CSS 类管理外观，不要直接修改 classList。",
  },
  {
    selector:
      "CallExpression[callee.object.property.name='style'][callee.property.name=/^(setProperty|removeProperty)$/]",
    message: "页面使用 CSS 文件管理样式，不要直接修改元素样式。",
  },
];

const DOM_QUERY_RESTRICTIONS = [
  {
    selector: "MemberExpression[object.name='document']",
    message: "仅页面入口可以查询挂载点，其他代码使用框架渲染与组件引用。",
  },
  {
    selector: "MemberExpression[object.property.name='document']",
    message: "页面代码使用框架渲染，不要直接查询或创建 DOM。",
  },
];

const ENTRY_DOM_RESTRICTIONS = [
  {
    selector:
      "MemberExpression[object.name='document']:not([property.name='getElementById'])",
    message: "页面入口只允许查询挂载点。",
  },
  {
    selector: "MemberExpression[object.property.name='document']",
    message: "页面入口只允许查询挂载点。",
  },
];

const REACT_JSX_RESTRICTIONS = [
  {
    selector: "JSXAttribute[name.name='style']",
    message: "页面使用 CSS 文件管理样式，不要使用 style 属性。",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "React 组件不得注入原始 HTML。",
  },
];

const sourceFiles = ["src/**/*.{ts,tsx,vue,svelte}"];
const sourceFilesWithoutEntry = ["src/**/*.{ts,tsx,vue,svelte}"];
const entryGlobs = ["src/main.ts", "src/main.tsx"];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "release/**",
      "eslint.config.*",
      "eslint/**",
      "vite.config.*",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.html"],
    plugins: { "@html-eslint": html },
    languageOptions: { parser: htmlParser },
    rules: {
      "@html-eslint/no-inline-styles": "error",
      "@html-eslint/no-restricted-attrs": [
        "error",
        {
          tagPatterns: [".*"],
          attrPatterns: ["^on[a-z]+$"],
          message: "页面不得使用 HTML 事件属性。",
        },
      ],
      "@html-eslint/no-restricted-tags": [
        "error",
        { tagPatterns: ["style"], message: "样式必须写入独立 CSS 文件。" },
      ],
    },
  },

  {
    files: sourceFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        mn: "readonly",
        __MN_NATIVE_BRIDGE__: "readonly",
      },
    },
    plugins: { "no-unsanitized": noUnsanitized },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "no-restricted-globals": [
        "error",
        ...PAGE_NATIVE_GLOBALS.map((name) => ({
          name,
          message: "页面通过 mn 与 bridge.ts 访问 MarginNote，不要直接使用原生对象。",
        })),
      ],
      "no-restricted-syntax": ["error", ...DOM_MUTATION_RESTRICTIONS],
    },
  },

  {
    files: sourceFilesWithoutEntry,
    ignores: entryGlobs,
    rules: {
      "no-restricted-globals": [
        "error",
        ...PAGE_NATIVE_GLOBALS.map((name) => ({
          name,
          message: "页面通过 mn 与 bridge.ts 访问 MarginNote，不要直接使用原生对象。",
        })),
        {
          name: "document",
          message: "页面使用框架渲染，不要直接访问 document。",
        },
        {
          name: "window",
          message: "页面使用框架渲染，不要直接访问 window。",
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...DOM_MUTATION_RESTRICTIONS,
        ...DOM_QUERY_RESTRICTIONS,
      ],
    },
  },

  {
    files: entryGlobs,
    rules: {
      "no-restricted-syntax": [
        "error",
        ...DOM_MUTATION_RESTRICTIONS,
        ...ENTRY_DOM_RESTRICTIONS,
      ],
    },
  },

  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...DOM_MUTATION_RESTRICTIONS,
        ...DOM_QUERY_RESTRICTIONS,
        ...REACT_JSX_RESTRICTIONS,
      ],
    },
  },

  {
    files: ["src/main.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...DOM_MUTATION_RESTRICTIONS,
        ...ENTRY_DOM_RESTRICTIONS,
        ...REACT_JSX_RESTRICTIONS,
      ],
    },
  },

  {
    files: ["native/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: Object.fromEntries(
        NATIVE_GLOBALS.map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-undef": "error",
      "no-redeclare": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
      "no-restricted-globals": [
        "error",
        ...BROWSER_ONLY_GLOBALS.map((name) => ({
          name,
          message: "原生模块运行在 JavaScriptCore 中，没有浏览器 API。",
        })),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration",
          message: "原生模块不得使用 ESM import。",
        },
        {
          selector: "ExportNamedDeclaration, ExportDefaultDeclaration",
          message: "原生模块不得使用 ESM export。",
        },
      ],
    },
  },

  ...frameworkConfig,

  {
    files: ["src/**/*.ts", "native/**/*.js"],
    rules: {
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["src/**/*.tsx", "src/**/*.vue", "src/**/*.svelte"],
    rules: {
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: { "max-lines": "off" },
  },
);
