import { access, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import { fail } from "./errors.js";
import {
  isPlainObject,
  readJsonFile,
  requireObject,
  requireString,
  requireStringArray,
} from "./json.js";
import { ADDON_ENTRY, ADDON_MANIFEST, NATIVE_DIR } from "./paths.js";

export type PluginMode = "panel" | "hybrid";

export interface AddonManifest {
  addonid: string;
  author: string;
  title: string;
  version: string;
  marginnote_version_min: string;
  panel: string;
  icon?: string;
  immersiveOnly: true;
  events?: string[];
  cardCommands?: unknown[];
  [key: string]: unknown;
}

export interface ProjectManifest {
  manifest: AddonManifest;
  mode: PluginMode;
}

export interface ManifestOptions {
  requireNative?: boolean;
  allowHybrid?: boolean;
  assetRoots?: string[];
}

export async function readAddonManifest(
  projectRoot: string,
  options: ManifestOptions = {},
): Promise<ProjectManifest> {
  const file = join(projectRoot, ADDON_MANIFEST);
  const raw = await readJsonFile<unknown>(file);
  const object = requireObject(raw, "根节点", file);

  const manifest: AddonManifest = {
    ...object,
    addonid: requireString(object.addonid, "addonid", file),
    author: requireString(object.author, "author", file),
    title: requireString(object.title, "title", file),
    version: requireString(object.version, "version", file),
    marginnote_version_min: requireString(
      object.marginnote_version_min,
      "marginnote_version_min",
      file,
    ),
    panel: requireString(object.panel, "panel", file),
    immersiveOnly: true,
  };

  if (object.immersiveOnly !== true) {
    fail(
      `${file} 的 immersiveOnly 必须为 true`,
      "网页面板只在沉浸模式下运行，清单必须显式声明 immersiveOnly。",
    );
  }

  if (manifest.panel !== ADDON_ENTRY) {
    fail(
      `${file} 的 panel 必须是根目录下的 ${ADDON_ENTRY}`,
      "脚手架要求页面入口固定为 index.html，其他文件不进入构建链。",
    );
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    fail(`${file} 的 version 必须使用语义化版本号，当前值：${manifest.version}`);
  }

  if (object.events !== undefined) {
    manifest.events = requireStringArray(object.events, "events", file);
  }

  if (object.cardCommands !== undefined && !Array.isArray(object.cardCommands)) {
    fail(`${file} 的 cardCommands 必须是数组`);
  }

  const nativeEntry = join(projectRoot, NATIVE_DIR, "main.js");
  const hasNativeEntry = await exists(nativeEntry);
  const hasNativeDirectory = await exists(join(projectRoot, NATIVE_DIR));
  if (hasNativeDirectory && !hasNativeEntry) {
    fail(
      `原生目录缺少入口：${relative(projectRoot, nativeEntry)}`,
      "混合形态必须有 native/main.js。删除 native/ 才会按纯面板处理。",
    );
  }
  if (hasNativeEntry && options.allowHybrid === false) {
    fail(
      `纯面板工程出现了 ${relative(projectRoot, nativeEntry)}`,
      "MarginNote 看到 main.js 就会切换到旧加载方式，清单中的 icon、cardCommands 与 excerptClaim 会失效。",
    );
  }
  const mode: PluginMode = hasNativeEntry ? "hybrid" : "panel";

  if (options.requireNative && mode !== "hybrid") {
    fail(
      `混合形态需要 ${relative(projectRoot, nativeEntry)}`,
      "请创建 native/main.js，或改用纯面板模板。",
    );
  }

  await validateAddonFilePaths(projectRoot, manifest, options.assetRoots ?? []);
  return { manifest, mode };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateAddonFilePaths(
  projectRoot: string,
  manifest: AddonManifest,
  assetRoots: string[],
): Promise<void> {
  const files = new Set(
    await listRelativeFiles(projectRoot, { skipNodeModules: true }),
  );
  for (const root of assetRoots) {
    let nested: string[];
    try {
      nested = await listRelativeFiles(join(projectRoot, root));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const file of nested) files.add(file);
  }

  if (!files.has(manifest.panel)) {
    fail(`mnaddon.json 的 panel 指向不存在的文件：${manifest.panel}`);
  }

  if (manifest.icon !== undefined && typeof manifest.icon !== "string") {
    fail("mnaddon.json 的 icon 必须是字符串");
  }
  if (manifest.icon !== undefined && typeof manifest.icon === "string") {
    if (
      manifest.icon.trim() === "" ||
      manifest.icon.startsWith("/") ||
      manifest.icon.split(/[\\/]/).includes("..")
    ) {
      fail(
        "mnaddon.json 的 icon 必须是包根目录内的相对路径",
        "不要使用绝对路径或 .. 路径段。",
      );
    }
  }
  if (manifest.icon && !files.has(manifest.icon)) {
    fail(`mnaddon.json 的 icon 指向不存在的文件：${manifest.icon}`);
  }
}

export async function listRelativeFiles(
  dir: string,
  options: { skipNodeModules?: boolean } = {},
): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (options.skipNodeModules && entry.name === "node_modules") {
      continue;
    }
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listRelativeFiles(absolute, options);
      for (const item of nested) {
        result.push(join(entry.name, item));
      }
      continue;
    }
    result.push(entry.name);
  }

  return result.sort();
}

export function assertTemplateLinks(
  template: Record<string, unknown>,
  manifest: AddonManifest,
  file: string,
): void {
  const plugins = requireStringArray(template.plugins, "plugins", file);
  if (!plugins.includes(manifest.addonid)) {
    fail(
      `${file} 的 plugins 缺少插件 ${manifest.addonid}`,
      "模板不会显示未加入白名单的插件。",
    );
  }

  const configs = requireObject(template.pluginConfigs, "pluginConfigs", file);
  if (!isPlainObject(configs[manifest.addonid])) {
    fail(
      `${file} 的 pluginConfigs 缺少 ${manifest.addonid}`,
      "模板需要为插件提供一份配置对象，空对象也可以。",
    );
  }

  const token = `addon.${manifest.addonid}.`;
  if (!JSON.stringify(template).includes(token)) {
    fail(
      `${file} 没有使用 ${token} 开头的界面条目`,
      "插件即使安装成功，也不会出现在工具栏或菜单中。",
    );
  }
}
