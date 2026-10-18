import { join } from "node:path";

import { inspectArtifact } from "../core/artifact.js";
import { readAddonManifest } from "../core/manifest.js";
import { packageProject } from "../core/package.js";
import { findProjectRoot, OUTPUT_DIR } from "../core/paths.js";
import { MN_RAILS_VERSION } from "../core/version.js";

export async function packageCurrentProject(): Promise<void> {
  const projectRoot = findProjectRoot();
  const project = await readAddonManifest(projectRoot, {
    assetRoots: ["public"],
  });
  await inspectArtifact(join(projectRoot, OUTPUT_DIR), {
    mode: project.mode,
  });

  const result = await packageProject(projectRoot, project);
  console.log(`插件包：${result.addonFile}`);
  if (result.templateFile) {
    console.log(`模板包：${result.templateFile}`);
  }
  console.log(`产品线版本：${project.manifest.version}`);
  console.log(`脚手架版本：${MN_RAILS_VERSION}`);
}
