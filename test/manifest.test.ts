import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { readAddonManifest } from "../src/core/manifest.js";

async function project(files: Record<string, string>): Promise<string> {
  const dir = join(tmpdir(), `mn-rails-manifest-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  return dir;
}

const manifest = {
  addonid: "com.example.panel",
  author: "Example",
  title: "Example",
  version: "0.1.0",
  marginnote_version_min: "4.5.0",
  immersiveOnly: true,
  panel: "index.html",
};

describe("readAddonManifest", () => {
  it("识别纯面板", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify(manifest),
      "index.html": "<html></html>",
    });
    const result = await readAddonManifest(dir);
    expect(result.mode).toBe("panel");
  });

  it("识别混合形态", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify(manifest),
      "index.html": "<html></html>",
      "native/main.js": "JSB.newAddon = function () {};",
    });
    const result = await readAddonManifest(dir);
    expect(result.mode).toBe("hybrid");
  });

  it("拒绝非根目录页面", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify({ ...manifest, panel: "web/index.html" }),
      "web/index.html": "<html></html>",
    });
    await expect(readAddonManifest(dir)).rejects.toThrow("panel");
  });

  it("拒绝未声明 immersiveOnly 的清单", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify({ ...manifest, immersiveOnly: false }),
      "index.html": "<html></html>",
    });
    await expect(readAddonManifest(dir)).rejects.toThrow("immersiveOnly");
  });

  it("拒绝越出包目录的图标", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify({ ...manifest, icon: "../icon.png" }),
      "index.html": "<html></html>",
    });
    await expect(readAddonManifest(dir)).rejects.toThrow("icon");
  });

  it("可以从 public 目录解析图标", async () => {
    const dir = await project({
      "mnaddon.json": JSON.stringify({ ...manifest, icon: "icon.png" }),
      "index.html": "<html></html>",
      "public/icon.png": "png",
    });
    const result = await readAddonManifest(dir, { assetRoots: ["public"] });
    expect(result.manifest.icon).toBe("icon.png");
  });
});
