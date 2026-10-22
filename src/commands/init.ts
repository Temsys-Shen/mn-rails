import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { input, select } from "@inquirer/prompts";

import { fail, MnRailsError } from "../core/errors.js";
import {
  copyDirectory,
  isDirectoryEmpty,
  writeJson,
} from "../core/files.js";
import {
  type PackageManager,
  installArgs,
  packageManagerFromArg,
  runScriptArgs,
} from "../core/package-manager.js";
import { run } from "../core/process.js";
import {
  FRAMEWORKS,
  isFramework,
  isProjectKind,
  type Framework,
  type ProjectKind,
} from "../core/template-catalog.js";
import { MN_RAILS_VERSION } from "../core/version.js";

export interface InitOptions {
  directory?: string;
  framework?: string;
  kind?: string;
  addonid?: string;
  author?: string;
  title?: string;
  packageManager?: string;
  install?: boolean;
  git?: boolean;
}

interface InitTargetOptions {
  directory?: string | undefined;
  invocationDir?: string | undefined;
  defaultProjectDirectory?: string | undefined;
}

export interface InitTarget {
  targetDir: string;
  createsSubdirectory: boolean;
}

export async function initProject(options: InitOptions): Promise<void> {
  const framework = await resolveFramework(options.framework);
  const kind = await resolveKind(options.kind);
  const title = options.title?.trim() || (await askTitle());
  const addonid = options.addonid?.trim() || (await askAddonId());
  const author = options.author?.trim() || (await askAuthor());
  const packageManager = await resolveManager(options.packageManager);

  validateAddonId(addonid);
  const { targetDir } = await resolveInitTarget(
    {
      directory: options.directory,
      defaultProjectDirectory: defaultProjectDirectoryName(addonid),
    },
    askProjectDirectory,
  );
  const projectName = toPackageName(basename(targetDir));
  const templateId = toTemplateId(addonid);

  await mkdir(targetDir, { recursive: true });
  await copyDirectory(templateRoot("shared"), targetDir);
  await copyDirectory(templateRoot(framework), targetDir);
  await installGitignore(targetDir);

  if (kind === "hybrid") {
    await copyDirectory(templateRoot("native"), join(targetDir, "native"));
  } else {
    await removeIfExists(join(targetDir, "native"));
  }

  await replaceInTree(targetDir, {
    __PROJECT_TITLE__: title,
    __ADDON_ID__: addonid,
    __AUTHOR__: author,
    __TEMPLATE_ID__: templateId,
    __INSTALL_COMMAND__: installCommand(packageManager),
    __PROJECT_KIND__: kind,
  });

  const spec = FRAMEWORKS[framework];
  const packageJson = {
    name: projectName,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      build: "mn-rails build",
      package: "mn-rails package",
      deploy: "mn-rails deploy",
      doctor: "mn-rails doctor",
      check: spec.checkCommand,
    },
    dependencies: spec.dependencies,
    devDependencies: {
      ...spec.devDependencies,
      "mn-rails": `^${MN_RAILS_VERSION}`,
    },
  };
  await writeJson(join(targetDir, "package.json"), packageJson);

  if (options.install !== false) {
    try {
      await run(packageManager, installArgs(packageManager), { cwd: targetDir });
    } catch (error) {
      if (error instanceof MnRailsError) {
        throw new MnRailsError(
          error.message,
          `${error.hint}\n工程已经写入 ${targetDir}。依赖安装完成后，可以重新运行 ${packageManager} install。`,
        );
      }
      throw error;
    }
    await run(packageManager, runScriptArgs(packageManager, "doctor"), {
      cwd: targetDir,
    });
  }

  if (options.git !== false) {
    await run("git", ["init"], { cwd: targetDir, stdio: "pipe" });
  }

  printCreated(targetDir, framework, kind, packageManager, options.install !== false);
}

export async function resolveInitTarget(
  options: InitTargetOptions,
  chooseProjectDirectory: (defaultName: string) => Promise<string>,
): Promise<InitTarget> {
  const invocationDir = resolve(
    options.invocationDir ?? process.env.INIT_CWD ?? process.cwd(),
  );
  const targetDir =
    options.directory === undefined || options.directory === "."
      ? invocationDir
      : resolve(invocationDir, options.directory);

  if (await isDirectoryEmpty(targetDir)) {
    return { targetDir, createsSubdirectory: false };
  }

  if (targetDir !== invocationDir) {
    fail(
      `目标目录不是空目录：${targetDir}`,
      "请换一个目录，或省略目录参数后在当前目录的子目录中创建工程。",
    );
  }

  const projectDirectory = validateProjectDirectoryName(
    await chooseProjectDirectory(options.defaultProjectDirectory ?? "mn-addon"),
  );
  const subdirectory = resolve(invocationDir, projectDirectory);
  if (!(await isDirectoryEmpty(subdirectory))) {
    fail(
      `项目目录不是空目录：${subdirectory}`,
      "请输入当前目录下其他可用的目录名称。",
    );
  }

  return { targetDir: subdirectory, createsSubdirectory: true };
}

async function resolveFramework(value: string | undefined): Promise<Framework> {
  if (value) {
    if (!isFramework(value)) {
      fail(`不支持的框架：${value}`, "可选 react、vue、svelte。");
    }
    return value;
  }

  return select({
    message: "选择框架",
    choices: Object.values(FRAMEWORKS).map((framework) => ({
      name: `${framework.label}（${framework.description}）`,
      value: framework.name,
    })),
  });
}

async function resolveKind(value: string | undefined): Promise<ProjectKind> {
  if (value) {
    if (!isProjectKind(value)) {
      fail(`不支持的插件形态：${value}`, "可选 panel、hybrid。");
    }
    return value;
  }

  return select({
    message: "选择插件形态",
    choices: [
      {
        name: "纯面板（只有 index.html 与页面代码）",
        value: "panel",
      },
      {
        name: "混合形态（面板 + main.js 原生模块）",
        value: "hybrid",
      },
    ],
  });
}

async function resolveManager(value: string | undefined): Promise<PackageManager> {
  const explicit = packageManagerFromArg(value);
  if (explicit) return explicit;

  return select({
    message: "选择包管理器",
    choices: [
      { name: "pnpm", value: "pnpm" },
      { name: "npm", value: "npm" },
      { name: "yarn", value: "yarn" },
      { name: "bun", value: "bun" },
    ],
  });
}

async function askTitle(): Promise<string> {
  const title = (await input({ message: "插件名称" })).trim();
  if (!title) fail("插件名称不能为空");
  return title;
}

async function askAddonId(): Promise<string> {
  const value = (await input({ message: "插件标识（例如 com.example.mn-panel）" })).trim();
  if (!value) fail("插件标识不能为空");
  return value;
}

async function askAuthor(): Promise<string> {
  const value = (await input({ message: "作者" })).trim();
  if (!value) fail("作者不能为空");
  return value;
}

async function askProjectDirectory(defaultName: string): Promise<string> {
  console.log("当前目录不是空目录，工程将创建在当前目录的子目录中。");
  return input({
    message: "项目目录",
    default: defaultName,
  });
}

function validateProjectDirectoryName(value: string): string {
  const name = value.trim();
  if (
    name === "" ||
    name === "." ||
    name === ".." ||
    basename(name) !== name ||
    /[\\/]/.test(name)
  ) {
    fail(
      `项目目录名称不合法：${value}`,
      "项目目录必须是当前目录下的单层目录名称。",
    );
  }
  return name;
}

function defaultProjectDirectoryName(addonid: string): string {
  const name = addonid.split(".").at(-1) ?? "";
  const slug = toPackageName(name);
  return slug === "mn-panel-addon" ? "mn-addon" : slug;
}

function validateAddonId(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    fail(
      `插件标识不合法：${value}`,
      "插件标识只能包含字母、数字、下划线、点和短横线，并且不能以符号开头。",
    );
  }
}

function toPackageName(value: string): string {
  const result = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
  return result || "mn-panel-addon";
}

function toTemplateId(addonid: string): string {
  return `u-${addonid.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function templateRoot(name: string): string {
  return join(packageRoot(), "templates", name);
}

function packageRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      const packageJson = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
      };
      if (packageJson.name === "mn-rails") return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      fail("无法定位 mn-rails 模板目录");
    }
    current = parent;
  }
}

function installCommand(manager: PackageManager): string {
  switch (manager) {
    case "npm":
      return "npm install";
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn";
    case "bun":
      return "bun install";
  }
}

async function replaceInTree(
  dir: string,
  replacements: Record<string, string>,
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await replaceInTree(path, replacements);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isTextFile(entry.name)) continue;
    let content = await readFile(path, "utf8");
    for (const [token, value] of Object.entries(replacements)) {
      content = content.split(token).join(value);
    }
    await writeFile(path, content);
  }
}

function isTextFile(name: string): boolean {
  return (
    /^\.gitignore$/.test(name) ||
    /\.(?:json|js|ts|tsx|vue|svelte|css|html|md|txt|yml|yaml)$/.test(name)
  );
}

async function installGitignore(targetDir: string): Promise<void> {
  const templatePath = join(targetDir, "gitignore");
  const destinationPath = join(targetDir, ".gitignore");
  if (!existsSync(destinationPath)) {
    await rename(templatePath, destinationPath);
    return;
  }

  const [template, existing] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(destinationPath, "utf8"),
  ]);
  const existingRules = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const additions = template
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !existingRules.has(line));

  if (additions.length > 0) {
    const prefix =
      existing === "" || existing.endsWith("\n") ? existing : `${existing}\n`;
    const separator =
      prefix === "" || prefix.endsWith("\n\n") ? "" : "\n";
    await writeFile(
      destinationPath,
      `${prefix}${separator}${additions.join("\n")}\n`,
    );
  }
  await rm(templatePath, { force: true });
}

async function removeIfExists(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

function printCreated(
  target: string,
  framework: Framework,
  kind: ProjectKind,
  manager: PackageManager,
  installed: boolean,
): void {
  const relativePath = relative(process.cwd(), target) || ".";
  console.log(`已创建：${relativePath}`);
  console.log(`框架：${FRAMEWORKS[framework].label}`);
  console.log(`形态：${kind === "panel" ? "纯面板" : "混合形态"}`);
  console.log(`包管理器：${manager}`);
  if (!installed) {
    console.log(`下一步：cd ${relativePath} && ${installCommand(manager)}`);
  }
}

