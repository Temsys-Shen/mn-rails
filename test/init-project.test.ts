import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { input } from "@inquirer/prompts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initProject } from "../src/commands/init.js";

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  select: vi.fn(),
}));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mn-rails-init-project-"));
  temporaryDirectories.push(dir);
  return dir;
}

describe("initProject", () => {
  it("在只有隐藏项的当前目录中创建工程并保留隐藏内容", async () => {
    const dir = await temporaryDirectory();
    await mkdir(join(dir, ".git"));
    await mkdir(join(dir, ".cache"));
    await writeFile(join(dir, ".gitignore"), "custom-rule\n");
    vi.stubEnv("INIT_CWD", dir);

    await initProject({
      framework: "react",
      kind: "panel",
      addonid: "com.example.hidden-project",
      author: "Example",
      title: "Hidden Project",
      packageManager: "pnpm",
      install: false,
      git: false,
    });

    const packageJson = JSON.parse(
      await readFile(join(dir, "package.json"), "utf8"),
    ) as {
      name?: string;
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const gitignore = await readFile(join(dir, ".gitignore"), "utf8");
    const viteConfig = await readFile(join(dir, "vite.config.ts"), "utf8");
    const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
    const eslintConfig = await readFile(
      join(dir, "eslint.config.mjs"),
      "utf8",
    );
    const frameworkConfig = await readFile(
      join(dir, "eslint", "framework.mjs"),
      "utf8",
    );

    expect(packageJson.name).toBeTruthy();
    expect(packageJson.scripts).toMatchObject({
      lint: "eslint . --max-warnings=0",
      "lint:fix": "eslint . --fix",
      typecheck: "tsc --noEmit",
      check: "eslint . --max-warnings=0 && tsc --noEmit",
    });
    expect(packageJson.devDependencies).toMatchObject({
      eslint: "^10.13.0",
      "eslint-plugin-react-hooks": "^7.1.1",
      "typescript-eslint": "^8.72.0",
    });
    expect(gitignore).toContain("custom-rule");
    expect(gitignore).toContain("node_modules/");
    expect(viteConfig).toContain("__MN_NATIVE_BRIDGE__: false");
    expect(viteConfig).not.toContain("__PROJECT_HAS_NATIVE_BRIDGE__");
    expect(agents).toContain("# MarginNote 插件开发工程");
    expect(agents).toContain("https://dev.marginnote.com.cn/llms.txt");
    expect(agents).not.toContain("完成一轮代码编辑后使用 eslint 进行检查");
    expect(eslintConfig).toContain("frameworkConfig");
    expect(frameworkConfig).toContain("eslint-plugin-react-hooks");
    await expect(readFile(join(dir, "gitignore"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(input).not.toHaveBeenCalled();
  });

  it("当前目录非空时询问项目目录并使用插件名称转写值", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");
    vi.stubEnv("INIT_CWD", dir);
    vi.mocked(input).mockResolvedValueOnce("wo-de-cha-jian-test");

    await initProject({
      framework: "vue",
      kind: "panel",
      addonid: "top.museday.mn-test",
      author: "ssc",
      title: "我的 插件 Test",
      packageManager: "pnpm",
      install: false,
      git: false,
    });

    const packageJson = JSON.parse(
      await readFile(
        join(dir, "wo-de-cha-jian-test", "package.json"),
        "utf8",
      ),
    ) as { name?: string; scripts?: Record<string, string> };

    expect(packageJson.name).toBe("wo-de-cha-jian-test");
    expect(packageJson.scripts?.sync).toBe("mn-rails deploy");
    expect(packageJson.scripts?.check).toBe(
      "eslint . --max-warnings=0 && vue-tsc --noEmit",
    );
    expect(packageJson.scripts).not.toHaveProperty("deploy");
    expect(input).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "项目目录",
        default: "wo-de-cha-jian-test",
      }),
    );
    await expect(readFile(join(dir, "README.md"), "utf8")).resolves.toBe(
      "existing\n",
    );
  });

  it("混合形态生成原生桥接常量", async () => {
    const dir = await temporaryDirectory();
    vi.stubEnv("INIT_CWD", dir);

    await initProject({
      framework: "svelte",
      kind: "hybrid",
      addonid: "com.example.hybrid-project",
      author: "Example",
      title: "Hybrid Project",
      packageManager: "pnpm",
      install: false,
      git: false,
    });

    const viteConfig = await readFile(join(dir, "vite.config.ts"), "utf8");
    const packageJson = JSON.parse(
      await readFile(join(dir, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const frameworkConfig = await readFile(
      join(dir, "eslint", "framework.mjs"),
      "utf8",
    );
    expect(viteConfig).toContain("__MN_NATIVE_BRIDGE__: true");
    expect(viteConfig).not.toContain("__PROJECT_HAS_NATIVE_BRIDGE__");
    expect(packageJson.scripts?.check).toBe(
      "eslint . --max-warnings=0 && svelte-check --tsconfig ./tsconfig.json",
    );
    expect(frameworkConfig).toContain("eslint-plugin-svelte");
    expect(frameworkConfig).toContain("svelte.configs.recommended[3]");
  });
});
