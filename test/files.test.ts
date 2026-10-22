import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { isDirectoryEmpty } from "../src/core/files.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) =>
      rm(dir, { recursive: true, force: true }),
    ),
  );
});

async function temporaryDirectory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "mn-rails-files-"));
  temporaryDirectories.push(dir);
  return dir;
}

describe("isDirectoryEmpty", () => {
  it("将只有隐藏文件和隐藏目录的目录视为空目录", async () => {
    const dir = await temporaryDirectory();
    await mkdir(join(dir, ".git"));
    await mkdir(join(dir, ".cache"));
    await writeFile(join(dir, ".gitignore"), "custom-rule\n");
    await writeFile(join(dir, ".DS_Store"), "");

    await expect(isDirectoryEmpty(dir)).resolves.toBe(true);
  });

  it("存在可见文件时返回非空", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");

    await expect(isDirectoryEmpty(dir)).resolves.toBe(false);
  });

  it("存在可见目录时返回非空", async () => {
    const dir = await temporaryDirectory();
    await mkdir(join(dir, "src"));

    await expect(isDirectoryEmpty(dir)).resolves.toBe(false);
  });
});
