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
    ) as { name?: string; scripts?: Record<string, string> };
    const gitignore = await readFile(join(dir, ".gitignore"), "utf8");

    expect(packageJson.name).toBeTruthy();
    expect(gitignore).toContain("custom-rule");
    expect(gitignore).toContain("node_modules/");
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
});
