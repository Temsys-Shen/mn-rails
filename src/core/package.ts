import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";

import { fail } from "./errors.js";
import { listFiles } from "./files.js";
import type { ProjectManifest } from "./manifest.js";
import { RELEASE_DIR } from "./paths.js";
import { readLocalizations, readTemplateConfig } from "./template.js";

export interface PackageResult {
  addonFile: string;
  templateFile?: string;
}

export async function buildZip(
  sourceDir: string,
  destination: string,
  prefix = "",
): Promise<void> {
  const files = await listFiles(sourceDir);
  const entries: Record<string, Uint8Array> = {};

  for (const file of files) {
    const content = await readFile(join(sourceDir, file));
    entries[`${prefix}${file}`] = new Uint8Array(content);
  }

  await writeFileWithParents(destination, zipSync(entries, { level: 9 }));
}

export async function packageProject(
  projectRoot: string,
  project: ProjectManifest,
): Promise<PackageResult> {
  const manifest = project.manifest;
  const releaseDir = join(projectRoot, RELEASE_DIR);
  const packageName = `${safeFileName(manifest.title)}-${manifest.version}`;
  const addonFile = join(releaseDir, `${packageName}.mnaddon`);
  const distDir = join(projectRoot, "dist");

  const template = await readTemplateConfig(projectRoot, manifest);
  if (!template) {
    fail("缺少 template/template.json", "v2 工程项目固定生成 .mnaddon 与 .mntemplate。");
  }

  await buildZip(distDir, addonFile);

  const templateFile = join(releaseDir, `${safeFileName(template.name)}-${manifest.version}.mntemplate`);
  await writeTemplatePackage(projectRoot, project, templateFile);
  return { addonFile, templateFile };
}

async function writeTemplatePackage(
  projectRoot: string,
  project: ProjectManifest,
  destination: string,
): Promise<void> {
  const manifest = project.manifest;
  const template = await readTemplateConfig(projectRoot, manifest);
  if (!template) {
    fail("模板配置不存在");
  }
  const localizations = await readLocalizations(projectRoot);
  const distDir = join(projectRoot, "dist");

  const templateManifest = {
    format: 1,
    app: "MarginNote",
    appVersion:
      typeof template.value.minAppVersion === "string"
        ? template.value.minAppVersion
        : manifest.marginnote_version_min,
    exportedAt: Math.floor(Date.now() / 1000),
    template: {
      id: template.id,
      name: template.name,
    },
    plugins: [
      {
        pluginID: manifest.addonid,
        folder: manifest.addonid,
        version: manifest.version,
        title: manifest.title,
      },
    ],
  };

  const pluginFiles = await listFiles(distDir);
  const entries: Record<string, Uint8Array> = {};
  entries["template.json"] = new Uint8Array(
    strToU8(`${JSON.stringify(template.value, null, 2)}\n`),
  );
  entries["manifest.json"] = new Uint8Array(
    strToU8(`${JSON.stringify(templateManifest, null, 2)}\n`),
  );
  entries["localizations.json"] = new Uint8Array(
    strToU8(`${JSON.stringify(localizations, null, 2)}\n`),
  );

  for (const file of pluginFiles) {
    const content = await readFile(join(distDir, file));
    entries[`plugins/${manifest.addonid}/${file}`] = new Uint8Array(content);
  }

  await writeFileWithParents(destination, zipSync(entries, { level: 9 }));
}

async function writeFileWithParents(path: string, content: Uint8Array): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function safeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

