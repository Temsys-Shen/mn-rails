import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { initProject } from "../src/commands/init.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
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
    ) as { name?: string };
    const gitignore = await readFile(join(dir, ".gitignore"), "utf8");

    expect(packageJson.name).toBeTruthy();
    expect(gitignore).toContain("custom-rule");
    expect(gitignore).toContain("node_modules/");
    await expect(readFile(join(dir, "gitignore"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("当前目录非空时使用插件名称创建子目录", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");
    vi.stubEnv("INIT_CWD", dir);

    await initProject({
      framework: "vue",
      kind: "panel",
      addonid: "top.museday.mn-test",
      author: "ssc",
      title: "test-mn-new",
      packageManager: "pnpm",
      install: false,
      git: false,
    });

    const packageJson = JSON.parse(
      await readFile(join(dir, "test-mn-new", "package.json"), "utf8"),
    ) as { name?: string };

    expect(packageJson.name).toBe("test-mn-new");
    await expect(readFile(join(dir, "README.md"), "utf8")).resolves.toBe(
      "existing\n",
    );
  });
});
