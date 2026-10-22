import { copyFile, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import type { Plugin } from "vite";

import {
  inspectArtifact,
  type ArtifactManifestEntry,
} from "./core/artifact.js";
import { fail } from "./core/errors.js";
import { copyDirectory, fileExists } from "./core/files.js";
import { readAddonManifest } from "./core/manifest.js";
import { ADDON_MANIFEST, NATIVE_DIR } from "./core/paths.js";

export interface MnRailsOptions {
  /**
   * 项目根目录。插件会把 mnaddon.json 与 native/ 一并放进产物。
   */
  root?: string;
  /**
   * 纯面板工程必须显式禁止 native/main.js，防止误切换 MarginNote 的加载方式。
   */
  mode?: "panel" | "hybrid";
}

/**
 * Vite 插件：把面板工程整理成 MarginNote 可以直接加载的包目录。
 *
 * 这个插件只处理构建期的产物整理与契约检查，不接管 Vite 的打包行为。
 */
export function mnRails(options: MnRailsOptions = {}): Plugin {
  const root = resolve(options.root ?? process.cwd());
  const outDir = join(root, "dist");

  return {
    name: "mn-rails",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const project = await readAddonManifest(root, {
        allowHybrid: options.mode !== "panel",
        assetRoots: ["public"],
      });
      const manifest = project.manifest;
      if (options.mode === "hybrid" && project.mode !== "hybrid") {
        fail("混合形态缺少 native/main.js");
      }

      const outputManifest = join(outDir, ADDON_MANIFEST);
      await copyFile(join(root, ADDON_MANIFEST), outputManifest);

      if (manifest.icon) {
        const iconTarget = resolve(outDir, manifest.icon);
        if (!iconTarget.startsWith(`${outDir}${sep}`)) {
          fail(`mnaddon.json 的 icon 越出产物目录：${manifest.icon}`);
        }
        if (!(await fileExists(iconTarget))) {
          const iconSource = resolve(root, manifest.icon);
          if (!(await fileExists(iconSource))) {
            fail(`mnaddon.json 引用的图标不存在：${manifest.icon}`);
          }
          await copyFile(iconSource, iconTarget);
        }
      }

      if (project.mode === "hybrid") {
        const nativeDir = join(root, NATIVE_DIR);
        await copyDirectory(nativeDir, outDir, {
          filter: (relativePath) =>
            relativePath !== "tsconfig.json" &&
            !relativePath.startsWith(".") &&
            !relativePath.includes("/."),
        });
      }

      const manifestPath = join(outDir, ".vite", "manifest.json");
      let bundle: string;
      try {
        bundle = await readFile(manifestPath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          fail(
            "Vite 没有生成构建清单",
            "请保留 mnRails() 插件，并启用 build.manifest。",
          );
        }
        throw error;
      }
      const viteManifest = JSON.parse(bundle) as Record<string, ArtifactManifestEntry>;
      const moduleReferences = new Set<string>();
      const manifestEntries = Object.values(viteManifest);
      for (const chunk of manifestEntries) {
        moduleReferences.add(`/pkg/${chunk.file}`);
        for (const file of chunk.css ?? []) moduleReferences.add(`/pkg/${file}`);
        for (const file of chunk.assets ?? []) moduleReferences.add(`/pkg/${file}`);
        for (const file of chunk.imports ?? []) {
          const imported = viteManifest[file];
          if (imported) moduleReferences.add(`/pkg/${imported.file}`);
        }
      }

      await rm(manifestPath, { force: true });
      await inspectArtifact(outDir, {
        mode: project.mode,
        moduleReferences: [...moduleReferences],
        manifestEntries,
      });

      for (const file of ["index.html", ADDON_MANIFEST]) {
        const text = await readFile(join(outDir, file), "utf8");
        if (text.length === 0) {
          fail(`产物 ${file} 为空`);
        }
      }
    },
  };
}
