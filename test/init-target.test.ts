import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  projectDirectoryFromTitle,
  resolveInitTarget,
} from "../src/commands/init.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mn-rails-init-target-"));
  temporaryDirectories.push(dir);
  return dir;
}

describe("resolveInitTarget", () => {
  it("当前目录只有隐藏项时直接使用当前目录", async () => {
    const dir = await temporaryDirectory();
    await mkdir(join(dir, ".git"));
    const chooseProjectDirectory = vi.fn(async () => "unused");

    const result = await resolveInitTarget(
      { invocationDir: dir },
      chooseProjectDirectory,
    );

    expect(result).toEqual({ targetDir: dir, createsSubdirectory: false });
    expect(chooseProjectDirectory).not.toHaveBeenCalled();
  });

  it("当前目录非空时在当前目录下创建子目录", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");
    const chooseProjectDirectory = vi.fn(async () => "new-addon");

    const result = await resolveInitTarget(
      {
        invocationDir: dir,
        projectDirectory: "default-addon",
      },
      chooseProjectDirectory,
    );

    expect(result).toEqual({
      targetDir: join(dir, "new-addon"),
      createsSubdirectory: true,
    });
    expect(chooseProjectDirectory).toHaveBeenCalledWith("default-addon");
  });

  it("显式指定的其他非空目录仍然拒绝", async () => {
    const dir = await temporaryDirectory();
    const existing = join(dir, "existing");
    await mkdir(existing);
    await writeFile(join(existing, "README.md"), "existing\n");
    const chooseProjectDirectory = vi.fn(async () => "unused");

    await expect(
      resolveInitTarget(
        { invocationDir: dir, directory: "existing" },
        chooseProjectDirectory,
      ),
    ).rejects.toThrow("目标目录不是空目录");
    expect(chooseProjectDirectory).not.toHaveBeenCalled();
  });

  it("子目录非空时拒绝创建", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");
    const occupied = join(dir, "new-addon");
    await mkdir(occupied);
    await writeFile(join(occupied, "package.json"), "{}\n");

    await expect(
      resolveInitTarget(
        {
          invocationDir: dir,
          projectDirectory: "new-addon",
        },
        async () => "new-addon",
      ),
    ).rejects.toThrow("项目目录不是空目录");
  });

  it("拒绝越出当前目录的目录名称", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");

    await expect(
      resolveInitTarget(
        {
          invocationDir: dir,
          projectDirectory: "../outside",
        },
        async () => "../outside",
      ),
    ).rejects.toThrow("项目目录名称不合法");
  });

  it("拒绝下划线目录名称", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");

    await expect(
      resolveInitTarget(
        {
          invocationDir: dir,
          projectDirectory: "my_plugin",
        },
        async () => "my_plugin",
      ),
    ).rejects.toThrow("项目目录名称不合法");
  });
});

describe("projectDirectoryFromTitle", () => {
  it("把中文、俄语、大写与空格转换为 kebab-case", () => {
    expect(projectDirectoryFromTitle("我的 插件 Test")).toBe(
      "wo-de-cha-jian-test",
    );
    expect(projectDirectoryFromTitle("My Plugin V2")).toBe("my-plugin-v2");
    expect(projectDirectoryFromTitle("Привет мир")).toBe("privet-mir");
  });

  it("使用短横线替代下划线和其他符号", () => {
    expect(projectDirectoryFromTitle("插件_测试")).toBe("cha-jian-ce-shi");
    expect(projectDirectoryFromTitle("__My__Plugin__")).toBe("my-plugin");
  });

  it("无法转写时使用默认目录名称", () => {
    expect(projectDirectoryFromTitle("😀")).toBe("mn-addon");
  });
});
