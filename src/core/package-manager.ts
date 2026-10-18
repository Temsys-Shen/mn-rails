import { existsSync } from "node:fs";
import { join } from "node:path";

import { fail } from "./errors.js";
import { capture } from "./process.js";

export const SUPPORTED_PACKAGE_MANAGERS = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
] as const;

export type PackageManager = (typeof SUPPORTED_PACKAGE_MANAGERS)[number];

const LOCKFILES: ReadonlyArray<[string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
];

export function packageManagerFromArg(
  value: string | undefined,
): PackageManager | undefined {
  if (value === undefined) return undefined;
  if ((SUPPORTED_PACKAGE_MANAGERS as readonly string[]).includes(value)) {
    return value as PackageManager;
  }
  fail(`不支持的包管理器：${value}`, "可选 npm、pnpm、yarn、bun。");
}

export function detectPackageManager(): PackageManager | undefined {
  for (const [file, manager] of LOCKFILES) {
    if (existsSync(join(process.cwd(), file))) {
      return manager;
    }
  }
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("yarn/")) return "yarn";
  if (userAgent.startsWith("bun/")) return "bun";
  if (userAgent.startsWith("npm/")) return "npm";
  return undefined;
}

export async function resolvePackageManager(
  explicit: string | undefined,
): Promise<PackageManager> {
  const manager = packageManagerFromArg(explicit) ?? detectPackageManager();
  if (!manager) {
    fail(
      "无法判断当前项目使用哪个包管理器",
      "请加 --package-manager npm|pnpm|yarn|bun，或先安装依赖。",
    );
  }
  await assertAvailable(manager);
  return manager;
}

export function installArgs(manager: PackageManager): string[] {
  switch (manager) {
    case "npm":
      return ["install"];
    case "pnpm":
      return ["install"];
    case "yarn":
      return ["install"];
    case "bun":
      return ["install"];
  }
}

export function runScriptArgs(
  manager: PackageManager,
  script: string,
  extra: string[] = [],
): string[] {
  switch (manager) {
    case "npm":
      return ["run", script, "--", ...extra];
    case "pnpm":
      return ["run", script, ...(extra.length ? ["--", ...extra] : [])];
    case "yarn":
      return ["run", script, ...extra];
    case "bun":
      return ["run", script, ...extra];
  }
}

export function execArgs(
  manager: PackageManager,
  binary: string,
  args: string[],
): string[] {
  switch (manager) {
    case "npm":
      return ["exec", "--", binary, ...args];
    case "pnpm":
      return ["exec", binary, ...args];
    case "yarn":
      return ["exec", binary, ...args];
    case "bun":
      return ["x", binary, ...args];
  }
}

export async function assertAvailable(manager: PackageManager): Promise<void> {
  try {
    await capture(manager, ["--version"], { cwd: process.cwd() });
  } catch {
    fail(`未找到 ${manager} 命令`, `请先安装 ${manager}，或改用其他包管理器。`);
  }
}

