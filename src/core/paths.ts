import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

import { fail } from "./errors.js";

export const ADDON_MANIFEST = "mnaddon.json";
export const ADDON_ENTRY = "index.html";
export const NATIVE_DIR = "native";
export const OUTPUT_DIR = "dist";
export const RELEASE_DIR = "release";
export const TEMPLATE_DIR = "template";

export function findProjectRoot(start = process.cwd()): string {
  let current = resolve(start);
  const root = parse(current).root;

  while (true) {
    if (existsSync(join(current, ADDON_MANIFEST))) {
      return current;
    }
    if (current === root) {
      fail(
        "当前目录不在 mn-rails 项目内",
        `未找到 ${ADDON_MANIFEST}。请在项目根目录运行，或先执行 mn-rails init。`,
      );
    }
    current = dirname(current);
  }
}

export function projectPath(projectRoot: string, ...parts: string[]): string {
  return join(projectRoot, ...parts);
}
