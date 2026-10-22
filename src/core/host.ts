import { access, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

import { fail } from "./errors.js";
import { copyDirectory, ensureEmptyDir } from "./files.js";
import { capture } from "./process.js";

const BUNDLE_ID = "QReader.MarginStudy.easy";
const EXTENSIONS_PATH = [
  "Library",
  "Containers",
  BUNDLE_ID,
  "Data",
  "Library",
  "MarginNote Extensions",
];

export interface HostInstallation {
  appPath: string;
  extensionsDir: string;
  processName: string;
}

export interface DeployResult {
  destination: string;
  restarted: boolean;
}

export async function findHost(): Promise<HostInstallation> {
  if (process.platform !== "darwin") {
    fail("deploy 只支持 macOS", "其他平台请使用 mn-rails package 生成安装包。");
  }

  const appPath = await resolveAppPath();
  const processName = await readProcessName(appPath);
  const extensionsDir = join(homedir(), ...EXTENSIONS_PATH);
  try {
    await access(extensionsDir);
  } catch {
    fail(
      `找不到插件目录：${extensionsDir}`,
      "先启动 MarginNote，并在设置中允许加载未经认证的插件。",
    );
  }

  return { appPath, extensionsDir, processName };
}

async function resolveAppPath(): Promise<string> {
  const application = await capture(
    "osascript",
    ["-e", `POSIX path of (path to application id "${BUNDLE_ID}")`],
    { cwd: process.cwd() },
  );
  const path = application.trim().replace(/\/$/, "");
  if (!path) {
    fail("无法定位 MarginNote 应用");
  }
  return path;
}

export async function readHostVersion(host: HostInstallation): Promise<string> {
  const plist = join(host.appPath, "Contents", "Info.plist");
  const version = await capture(
    "defaults",
    ["read", plist, "CFBundleShortVersionString"],
    { cwd: process.cwd() },
  );
  return version.trim();
}

async function readProcessName(appPath: string): Promise<string> {
  const plist = join(appPath, "Contents", "Info.plist");
  try {
    const executable = await capture(
      "plutil",
      ["-extract", "CFBundleExecutable", "raw", plist],
      { cwd: process.cwd() },
    );
    if (executable) return executable;
  } catch {
    // 部分应用没有声明 CFBundleExecutable，回退到 .app 文件名。
  }
  return basename(appPath, ".app");
}

export async function deployAddon(
  distDir: string,
  addonid: string,
): Promise<DeployResult> {
  const host = await findHost();
  const destination = join(host.extensionsDir, addonid);
  const staging = join(host.extensionsDir, `.${addonid}.mn-rails-staging`);
  const backup = join(host.extensionsDir, `.${addonid}.mn-rails-backup`);

  await ensureEmptyDir(staging);
  try {
    await copyDirectory(distDir, staging);
    await ensureEmptyDir(backup);
    if (await pathExists(destination)) {
      await rename(destination, backup);
    }
    await rename(staging, destination);
  } catch (error) {
    if (!(await pathExists(destination)) && (await pathExists(backup))) {
      await rename(backup, destination);
    }
    throw error;
  } finally {
    await removeDirectory(staging);
    await removeDirectory(backup);
  }

  await restartHost(host);
  return { destination, restarted: true };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

async function restartHost(host: HostInstallation): Promise<void> {
  if (await isHostRunning(host.processName)) {
    const quitScript = `tell application id "${BUNDLE_ID}"
quit
end tell`;
    await capture(
      "osascript",
      ["-e", quitScript],
      { cwd: process.cwd() },
    );
    const quitDeadline = Date.now() + 20_000;
    while (Date.now() < quitDeadline) {
      if (!(await isHostRunning(host.processName))) break;
      await delay(250);
    }
    if (await isHostRunning(host.processName)) {
      fail(
        `MarginNote 未在 20 秒内退出：${host.appPath}`,
        "请保存正在编辑的内容，手动退出 MarginNote 后重新运行 mn-rails deploy。",
      );
    }
  }

  await capture("open", ["-b", BUNDLE_ID], { cwd: process.cwd() });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isHostRunning(host.processName)) return;
    await delay(250);
  }

  fail(
    `MarginNote 未能重新启动：${host.appPath}`,
    "请手动打开 MarginNote，并检查应用是否被系统拦截。",
  );
}

async function isHostRunning(processName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn("pgrep", ["-x", processName], {
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code === 0));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readInstalledManifest(
  host: HostInstallation,
  addonid: string,
): Promise<Record<string, unknown> | null> {
  const file = join(host.extensionsDir, addonid, "mnaddon.json");
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
