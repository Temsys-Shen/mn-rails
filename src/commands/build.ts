import { join } from "node:path";

import { inspectArtifact } from "../core/artifact.js";
import { fail } from "../core/errors.js";
import { readAddonManifest } from "../core/manifest.js";
import { inspectNative } from "../core/native.js";
import { execArgs, resolvePackageManager } from "../core/package-manager.js";
import { findProjectRoot, OUTPUT_DIR } from "../core/paths.js";
import { run } from "../core/process.js";

export interface BuildOptions {
  packageManager?: string;
}

export async function buildProject(options: BuildOptions = {}): Promise<void> {
  const projectRoot = findProjectRoot();
  const project = await readAddonManifest(projectRoot, {
    assetRoots: ["public"],
  });
  const native = await inspectNative(projectRoot);
  const packageManager = await resolvePackageManager(options.packageManager);

  if (project.mode === "hybrid" && !native) {
    fail("混合形态缺少 native/ 目录");
  }

  await run(packageManager, execArgs(packageManager, "vite", ["build"]), {
    cwd: projectRoot,
    stdio: "inherit",
  });

  const report = await inspectArtifact(join(projectRoot, OUTPUT_DIR), {
    mode: project.mode,
  });
  console.log(`构建完成：${project.mode === "hybrid" ? "混合形态" : "纯面板"}`);
  for (const file of report.files) {
    console.log(`  ${file.path}  ${(file.bytes / 1024).toFixed(1)} KB`);
  }
}
