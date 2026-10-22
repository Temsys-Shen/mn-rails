import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveInitTarget } from "../src/commands/init.js";

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
    let promptCount = 0;

    const result = await resolveInitTarget(
      { invocationDir: dir, defaultProjectDirectory: "my-addon" },
      async () => {
        promptCount += 1;
        return "unused";
      },
    );

    expect(result).toEqual({ targetDir: dir, createsSubdirectory: false });
    expect(promptCount).toBe(0);
  });

  it("当前目录非空时在当前目录下创建子目录", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");

    const result = await resolveInitTarget(
      { invocationDir: dir, defaultProjectDirectory: "my-addon" },
      async (defaultName) => {
        expect(defaultName).toBe("my-addon");
        return "new-addon";
      },
    );

    expect(result).toEqual({
      targetDir: join(dir, "new-addon"),
      createsSubdirectory: true,
    });
  });

  it("显式指定的其他非空目录仍然拒绝", async () => {
    const dir = await temporaryDirectory();
    const existing = join(dir, "existing");
    await mkdir(existing);
    await writeFile(join(existing, "README.md"), "existing\n");

    await expect(
      resolveInitTarget(
        { invocationDir: dir, directory: "existing" },
        async () => "unused",
      ),
    ).rejects.toThrow("目标目录不是空目录");
  });

  it("子目录非空时拒绝创建", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");
    const occupied = join(dir, "new-addon");
    await mkdir(occupied);
    await writeFile(join(occupied, "package.json"), "{}\n");

    await expect(
      resolveInitTarget(
        { invocationDir: dir },
        async () => "new-addon",
      ),
    ).rejects.toThrow("项目目录不是空目录");
  });

  it("拒绝越出当前目录的目录名称", async () => {
    const dir = await temporaryDirectory();
    await writeFile(join(dir, "README.md"), "existing\n");

    await expect(
      resolveInitTarget(
        { invocationDir: dir },
        async () => "../outside",
      ),
    ).rejects.toThrow("项目目录名称不合法");
  });
});
