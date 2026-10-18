import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { fail } from "./errors.js";
import { readJsonFile, requireObject, requireString } from "./json.js";
import { assertTemplateLinks, type AddonManifest } from "./manifest.js";
import { TEMPLATE_DIR } from "./paths.js";

export interface TemplateConfig {
  file: string;
  value: Record<string, unknown>;
  id: string;
  name: string;
}

export async function readTemplateConfig(
  projectRoot: string,
  manifest: AddonManifest,
): Promise<TemplateConfig | null> {
  const file = join(projectRoot, TEMPLATE_DIR, "template.json");
  try {
    await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }

  const raw = await readJsonFile<unknown>(file);
  const value = requireObject(raw, "根节点", file);
  const id = requireString(value.id, "id", file);
  const name = requireString(value.name, "name", file);

  assertTemplateLinks(value, manifest, file);
  return { file, value, id, name };
}

export async function readLocalizations(
  projectRoot: string,
): Promise<Record<string, unknown>> {
  const file = join(projectRoot, TEMPLATE_DIR, "localizations.json");
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      fail(`缺少 ${file}`, "模板包必须包含 template/localizations.json。");
    }
    if (error instanceof SyntaxError) {
      fail(`${file} 不是合法 JSON：${error.message}`);
    }
    throw error;
  }
}
