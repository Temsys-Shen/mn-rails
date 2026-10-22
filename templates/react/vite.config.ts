import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { mnRails } from "mn-rails/vite";

export default defineConfig({
  // 面板里的资源只能走 MarginNote 提供的 /pkg/ 路径。
  base: "/pkg/",
  define: {
    __MN_NATIVE_BRIDGE__: JSON.stringify("__PROJECT_KIND__" === "hybrid"),
  },
  plugins: [react(), mnRails({ mode: "__PROJECT_KIND__" })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "safari17",
    minify: false,
    sourcemap: false,
    manifest: true,
    modulePreload: false,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
