import { join } from "node:path";

import { inspectArtifact } from "../core/artifact.js";
import { fail } from "../core/errors.js";
import { fileExists } from "../core/files.js";
import { findHost, readHostVersion } from "../core/host.js";
import { readAddonManifest } from "../core/manifest.js";
import { inspectNative } from "../core/native.js";
import { resolvePackageManager } from "../core/package-manager.js";
import {
  ADDON_ENTRY,
  ADDON_MANIFEST,
  findProjectRoot,
  OUTPUT_DIR,
} from "../core/paths.js";
import { readTemplateConfig } from "../core/template.js";

export interface DoctorOptions {
  packageManager?: string;
}

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const projectRoot = findProjectRoot();
  const project = await readAddonManifest(projectRoot, {
    assetRoots: ["public"],
  });
  const manager = await resolvePackageManager(options.packageManager);
  const native = await inspectNative(projectRoot);
  const template = await readTemplateConfig(projectRoot, project.manifest);

  const host = await findHost();
  const hostVersion = await readHostVersion(host);

  console.log(`Node：${process.version}`);
  console.log(`包管理器：${manager}`);
  console.log(`项目：${projectRoot}`);
  console.log(`插件：${project.manifest.addonid}@${project.manifest.version}`);
  console.log(`形态：${project.mode === "hybrid" ? "混合形态" : "纯面板"}`);
  console.log(`MarginNote：${host.appPath}（${hostVersion}，${host.processName}）`);
  console.log(`模板：${template ? template.file : "未配置"}`);

  for (const required of [ADDON_MANIFEST, ADDON_ENTRY, "package.json", "vite.config.ts"]) {
    if (!(await fileExists(join(projectRoot, required)))) {
      fail(`项目缺少 ${required}`);
    }
  }

  if (project.mode === "hybrid" && native?.modules.length === 0) {
    fail("混合形态的原生目录没有可用模块");
  }

  if (await fileExists(join(projectRoot, OUTPUT_DIR))) {
    await inspectArtifact(join(projectRoot, OUTPUT_DIR), {
      mode: project.mode,
    });
    console.log(`产物：${join(projectRoot, OUTPUT_DIR)}`);
  } else {
    console.log("产物：尚未构建");
  }
}
