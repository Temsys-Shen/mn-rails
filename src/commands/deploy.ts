import { join } from "node:path";

import { inspectArtifact } from "../core/artifact.js";
import { deployAddon } from "../core/host.js";
import { readAddonManifest } from "../core/manifest.js";
import { findProjectRoot, OUTPUT_DIR } from "../core/paths.js";

export async function deployCurrentProject(): Promise<void> {
  const projectRoot = findProjectRoot();
  const project = await readAddonManifest(projectRoot, {
    assetRoots: ["public"],
  });
  await inspectArtifact(join(projectRoot, OUTPUT_DIR), {
    mode: project.mode,
  });

  const result = await deployAddon(
    join(projectRoot, OUTPUT_DIR),
    project.manifest.addonid,
  );
  console.log(`已部署：${result.destination}`);
  if (result.restarted) {
    console.log("MarginNote 已重新启动。");
  }
}
