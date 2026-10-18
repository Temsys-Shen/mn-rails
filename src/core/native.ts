import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { fail } from "./errors.js";
import { NATIVE_DIR } from "./paths.js";

export interface NativeReport {
  entry: string;
  modules: string[];
}

export async function inspectNative(projectRoot: string): Promise<NativeReport | null> {
  const nativeDir = join(projectRoot, NATIVE_DIR);
  let entries;
  try {
    entries = await readdir(nativeDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const modules = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort();

  if (!modules.includes("main.js")) {
    fail(`${nativeDir} 缺少 main.js`, "混合形态的原生入口必须是 native/main.js。");
  }

  const problems: string[] = [];
  for (const module of modules) {
    const text = await readFile(join(nativeDir, module), "utf8");
    if (module === "main.js") {
      if (!/\bJSB\.newAddon\s*=/.test(text)) {
        problems.push("native/main.js 没有给 JSB.newAddon 赋值");
      }
      continue;
    }
    if (/\bJSB\.require\s*\(/.test(text)) {
      problems.push(`${module} 调用了 JSB.require；只有 main.js 可以调用`);
    }
  }

  if (problems.length > 0) {
    fail(
      `原生模块不符合运行时契约：\n${problems.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  const required = ["main.js", "PanelBridge.js"];
  const missing = required.filter((file) => !modules.includes(file));
  if (missing.length > 0) {
    fail(
      `混合形态缺少原生模块：${missing.join("、")}`,
      "混合形态必须保留 main.js 与 PanelBridge.js。",
    );
  }

  return { entry: "main.js", modules };
}
