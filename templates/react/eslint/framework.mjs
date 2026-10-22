import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ...reactHooks.configs.flat.recommended,
    files: ["src/**/*.{ts,tsx}"],
  },
];
