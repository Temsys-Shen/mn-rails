import { readFile } from "node:fs/promises";

import { fail } from "./errors.js";

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      fail(`找不到文件：${filePath}`);
    }
    throw error;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`${filePath} 不是合法 JSON：${detail}`);
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireString(
  value: unknown,
  field: string,
  file: string,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${file} 的 ${field} 必须是非空字符串`);
  }
  return value;
}

export function requireObject(
  value: unknown,
  field: string,
  file: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    fail(`${file} 的 ${field} 必须是对象`);
  }
  return value;
}

export function requireStringArray(
  value: unknown,
  field: string,
  file: string,
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`${file} 的 ${field} 必须是字符串数组`);
  }
  return value as string[];
}
