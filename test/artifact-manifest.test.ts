import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectArtifact } from "../src/core/artifact.js";

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = join(tmpdir(), `mn-rails-manifest-artifact-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  return dir;
}

const html = (head: string, body = "") =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("inspectArtifact 与 Vite 入口清单", () => {
  it("接受 modulepreload 对应入口的页面", async () => {
    const dir = await fixture({
      "index.html": html(
        '<link rel="modulepreload" href="/pkg/assets/main.js">',
        '<div id="root"></div>',
      ),
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/main.js": "export const main = true;",
    });

    await expect(
      inspectArtifact(dir, {
        mode: "panel",
        manifestEntries: [{ file: "assets/main.js", src: "src/main.ts", isEntry: true }],
      }),
    ).resolves.toBeDefined();
  });

  it("拒绝没有写入页面的构建入口", async () => {
    const dir = await fixture({
      "index.html": html("<title>面板</title>", '<div id="root"></div>'),
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/main.js": "export const main = true;",
    });

    await expect(
      inspectArtifact(dir, {
        mode: "panel",
        manifestEntries: [{ file: "assets/main.js", src: "src/main.ts", isEntry: true }],
      }),
    ).rejects.toThrow("构建入口");
  });

  it("拒绝不属于构建入口的模块脚本", async () => {
    const dir = await fixture({
      "index.html": html(
        '<link rel="modulepreload" href="/pkg/assets/main.js">',
        '<script type="module" src="/pkg/assets/legacy.js"></script>',
      ),
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/main.js": "export const main = true;",
      "assets/legacy.js": "export const legacy = true;",
    });

    await expect(
      inspectArtifact(dir, {
        mode: "panel",
        manifestEntries: [{ file: "assets/main.js", src: "src/main.ts", isEntry: true }],
      }),
    ).rejects.toThrow("不属于 Vite 入口");
  });
});
