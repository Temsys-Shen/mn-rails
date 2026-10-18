import { readFile } from "node:fs/promises";
import { extname, join, posix } from "node:path";

import * as parse5 from "parse5";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

import { fail } from "./errors.js";
import { listFiles } from "./files.js";
import type { PluginMode } from "./manifest.js";

export interface ArtifactReport {
  files: Array<{ path: string; bytes: number }>;
  externalReferences: string[];
}

export interface ArtifactManifestEntry {
  file: string;
  src?: string;
  isEntry?: boolean;
  css?: string[];
  assets?: string[];
  imports?: string[];
}

export interface ArtifactInspectionOptions {
  mode: PluginMode;
  moduleReferences?: string[];
  manifestEntries?: ArtifactManifestEntry[];
}

interface HtmlAttribute {
  name: string;
  value: string;
}

export async function inspectArtifact(
  distDir: string,
  options: ArtifactInspectionOptions,
): Promise<ArtifactReport> {
  const files = await listFiles(distDir);
  const fileSet = new Set(files);
  const problems: string[] = [];
  const externalReferences = new Set<string>();

  if (!fileSet.has("index.html")) {
    problems.push("dist 根目录缺少 index.html");
  }
  if (!fileSet.has("mnaddon.json")) {
    problems.push("dist 根目录缺少 mnaddon.json");
  }
  if (options.mode === "panel" && fileSet.has("main.js")) {
    problems.push("纯面板产物不得包含根目录 main.js");
  }
  if (options.mode === "hybrid") {
    for (const required of ["main.js", "PanelBridge.js"]) {
      if (!fileSet.has(required)) {
        problems.push(`混合形态产物缺少根目录 ${required}`);
      }
    }
  }

  for (const reference of options.moduleReferences ?? []) {
    inspectReference(
      reference,
      "Vite 产物清单",
      problems,
      externalReferences,
      fileSet,
    );
  }

  const entryFiles = options.manifestEntries ? new Set<string>() : null;
  for (const entry of options.manifestEntries ?? []) {
    if (!entry.isEntry) continue;
    const relative = normalizePackagePath(entry.file);
    if (!relative) {
      problems.push(`Vite 产物清单中的入口路径不合法：${entry.file}`);
      continue;
    }
    entryFiles?.add(relative);
  }

  for (const file of files) {
    const absolute = join(distDir, file);
    const ext = extname(file).toLowerCase();
    if (ext === ".html") {
      const html = await readFile(absolute, "utf8");
      inspectHtml(html, file, problems, externalReferences, fileSet, entryFiles);
      continue;
    }
    if (ext === ".css") {
      const css = await readFile(absolute, "utf8");
      inspectCss(css, file, problems, externalReferences, fileSet);
      continue;
    }
    if (ext === ".js" || ext === ".mjs") {
      const js = await readFile(absolute, "utf8");
      inspectJavaScript(js, file, problems);
    }
  }

  if (problems.length > 0) {
    fail(
      `构建产物不符合面板插件契约：\n${problems.map((item) => `- ${item}`).join("\n")}`,
      "修正构建配置后重新运行 mn-rails build。",
    );
  }

  return {
    files: await Promise.all(
      files.map(async (path) => ({
        path,
        bytes: (await readFile(join(distDir, path))).byteLength,
      })),
    ),
    externalReferences: [...externalReferences].sort(),
  };
}

function inspectHtml(
  html: string,
  file: string,
  problems: string[],
  externalReferences: Set<string>,
  fileSet: Set<string>,
  entryFiles: Set<string> | null,
): void {
  const document = parse5.parse(html);
  const elements = collectElements(document);
  const moduleSources = new Set<string>();
  const flushedEntries = new Set<string>();

  for (const element of elements) {
    const tag = element.tagName;
    const attributes = attributeMap(element);

    if (tag === "script") {
      const src = attributes.get("src");
      if (!src) {
        const text = textContent(element).trim();
        if (text !== "") {
          problems.push(`${file}: <script> 含内联代码，请构建为 /pkg/ 外链文件`);
        }
      } else {
        inspectReference(src, `${file}: <script src>`, problems, externalReferences, fileSet);
        if (attributes.get("type")?.toLowerCase() === "module") {
          const relative = packageReference(src);
          if (relative) {
            moduleSources.add(relative);
            flushedEntries.add(relative);
          }
        }
      }
    }

    if (tag === "style") {
      problems.push(`${file}: 含内联 <style>，请构建为 /pkg/ 外链样式表`);
    }

    if (tag === "link") {
      const href = attributes.get("href");
      const rel = attributes.get("rel")?.toLowerCase();
      if (href && (rel === "stylesheet" || rel === "icon" || rel === "modulepreload")) {
        inspectReference(href, `${file}: <link href>`, problems, externalReferences, fileSet);
      }
      if (href && rel === "modulepreload") {
        const relative = packageReference(href);
        if (relative && entryFiles?.has(relative)) {
          flushedEntries.add(relative);
        }
      }
    }

    if (tag === "img" || tag === "source" || tag === "video" || tag === "audio") {
      const source = attributes.get("src");
      if (source) {
        inspectReference(source, `${file}: <${tag} src>`, problems, externalReferences, fileSet);
      }
      const srcset = attributes.get("srcset");
      if (srcset) {
        for (const candidate of splitSrcset(srcset)) {
          inspectReference(candidate, `${file}: <${tag} srcset>`, problems, externalReferences, fileSet);
        }
      }
    }

    for (const [name, value] of attributes) {
      if (/^on[a-z]+$/i.test(name)) {
        problems.push(`${file}: 出现内联事件处理器 ${name}`);
      }
      if (name === "style") {
        problems.push(`${file}: 出现 style 属性，请改用外链样式表`);
      }
      inspectDataUrl(value, `${file}: ${name}`, problems);
    }
  }

  if (entryFiles) {
    for (const entry of entryFiles) {
      if (!flushedEntries.has(entry)) {
        problems.push(
          `${file}: 构建入口 ${entry} 没有作为 modulepreload 或 module script 写入页面`,
        );
      }
    }
    for (const source of moduleSources) {
      if (!entryFiles.has(source)) {
        problems.push(`${file}: 模块脚本 ${source} 不属于 Vite 入口`);
      }
    }
  }
}

function inspectCss(
  css: string,
  file: string,
  problems: string[],
  externalReferences: Set<string>,
  fileSet: Set<string>,
): void {
  const root = postcss.parse(css, { from: file });
  root.walkDecls((declaration) => {
    inspectCssValue(
      declaration.value,
      `${file}: ${declaration.prop}`,
      problems,
      externalReferences,
      fileSet,
    );
  });
  root.walkAtRules("import", (atRule) => {
    inspectCssValue(
      atRule.params,
      `${file}: @import`,
      problems,
      externalReferences,
      fileSet,
    );
  });
}

function inspectJavaScript(
  js: string,
  file: string,
  problems: string[],
): void {
  if (/\beval\s*\(/.test(js)) {
    problems.push(`${file}: 出现 eval(`);
  }
  if (/\bnew\s+Function\s*\(/.test(js)) {
    problems.push(`${file}: 出现 new Function(`);
  }
  if (/\bset(?:Timeout|Interval)\s*\(\s*["'`]/.test(js)) {
    problems.push(`${file}: 出现字符串形式定时器`);
  }
}

function inspectCssValue(
  value: string,
  location: string,
  problems: string[],
  externalReferences: Set<string>,
  fileSet: Set<string>,
): void {
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "url") {
      return;
    }
    const first = node.nodes[0];
    if (!first || (first.type !== "string" && first.type !== "word")) {
      return;
    }
    inspectReference(
      first.value,
      location,
      problems,
      externalReferences,
      fileSet,
    );
  });
}

function inspectReference(
  reference: string,
  location: string,
  problems: string[],
  externalReferences: Set<string>,
  fileSet: Set<string>,
): void {
  const value = reference.trim();
  if (value === "" || value.startsWith("#") || value.startsWith("mailto:") ||
      value.startsWith("tel:") || value.startsWith("javascript:")) {
    return;
  }
  if (inspectDataUrl(value, location, problems)) return;
  if (/^(?:https?:)?\/\//i.test(value)) {
    externalReferences.add(value);
    problems.push(`${location}: 引用包外地址 ${value}`);
    return;
  }
  const relative = packageReference(value);
  if (!relative) {
    problems.push(`${location}: ${value} 不是 /pkg/ 开头的绝对路径`);
    return;
  }

  if (!fileSet.has(relative)) {
    problems.push(`${location}: 包内不存在 ${relative}`);
  }
}

function packageReference(value: string): string | null {
  if (!value.startsWith("/pkg/")) return null;
  const rawRelative = value.slice("/pkg/".length).split(/[?#]/, 1)[0] ?? "";
  let relative: string;
  try {
    relative = decodeURIComponent(rawRelative);
  } catch {
    return null;
  }
  if (relative === "") {
    return null;
  }
  if (
    relative.startsWith("/") ||
    relative.split("/").includes("..") ||
    relative.includes("\\")
  ) {
    return null;
  }
  const normalized = posix.normalize(relative);
  if (normalized === "." || normalized.endsWith("/")) {
    return null;
  }
  return normalized;
}

function normalizePackagePath(value: string): string | null {
  if (value.includes("\\")) return null;
  const normalized = posix.normalize(value);
  if (
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/")
  ) {
    return null;
  }
  return normalized;
}

function inspectDataUrl(
  value: string,
  location: string,
  problems: string[],
): boolean {
  if (value.trim().toLowerCase().startsWith("data:")) {
    problems.push(`${location}: 使用 data: 地址`);
    return true;
  }
  return false;
}

function collectElements(node: parse5.DefaultTreeAdapterMap["node"]): parse5.DefaultTreeAdapterMap["element"][] {
  const result: parse5.DefaultTreeAdapterMap["element"][] = [];
  const visit = (current: unknown) => {
    if (!current || typeof current !== "object") return;
    const element = current as { tagName?: string; childNodes?: unknown[] };
    if (element.tagName) {
      result.push(element as parse5.DefaultTreeAdapterMap["element"]);
    }
    for (const child of element.childNodes ?? []) {
      visit(child);
    }
  };
  visit(node);
  return result;
}

function attributeMap(element: parse5.DefaultTreeAdapterMap["element"]): Map<string, string> {
  return new Map(
    (element.attrs as HtmlAttribute[]).map((attribute) => [
      attribute.name.toLowerCase(),
      attribute.value,
    ]),
  );
}

function textContent(element: parse5.DefaultTreeAdapterMap["element"]): string {
  return (element.childNodes as Array<{ value?: string; childNodes?: unknown[] }>)
    .map((child) => {
      if (typeof child.value === "string") return child.value;
      return child.childNodes
        ? textContent(child as parse5.DefaultTreeAdapterMap["element"])
        : "";
    })
    .join("");
}

function splitSrcset(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().split(/\s+/, 1)[0] ?? "")
    .filter(Boolean);
}
