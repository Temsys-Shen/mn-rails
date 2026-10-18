import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { inspectArtifact } from "../src/core/artifact.js";
import { MnRailsError } from "../src/core/errors.js";

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = join(tmpdir(), `mn-rails-artifact-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), text);
  }
  return dir;
}

describe("inspectArtifact", () => {
  it("接受 /pkg/ 外链的完整产物", async () => {
    const dir = await fixture({
      "index.html":
        '<!doctype html><html><head><link rel="stylesheet" href="/pkg/assets/app.css"></head><body><div id="root"></div><script type="module" src="/pkg/assets/app.js"></script></body></html>',
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/app.js": "export const ok = true;",
      "assets/app.css": "html{background:#fff}",
    });

    const report = await inspectArtifact(dir, { mode: "panel" });
    expect(report.files.map((file) => file.path)).toContain("assets/app.js");
  });

  it("拒绝内联脚本", async () => {
    const dir = await fixture({
      "index.html": "<html><body><script>alert(1)</script></body></html>",
      "mnaddon.json": "{}",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("拒绝相对路径", async () => {
    const dir = await fixture({
      "index.html":
        '<html><body><script src="assets/app.js"></script></body></html>',
      "mnaddon.json": "{}",
      "assets/app.js": "",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("拒绝缺失的包内文件", async () => {
    const dir = await fixture({
      "index.html":
        '<html><body><script src="/pkg/assets/app.js"></script></body></html>',
      "mnaddon.json": "{}",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("拒绝 data: 样式", async () => {
    const dir = await fixture({
      "index.html": "<html><body></body></html>",
      "mnaddon.json": "{}",
      "assets/app.css":
        ".x{background-image:url(data:image/png;base64,AAAA)}",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("检查 CSS 的字体与图片引用", async () => {
    const dir = await fixture({
      "index.html": "<html><body></body></html>",
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/app.css":
        '@font-face{font-family:Demo;src:url("demo.woff2")} .logo{background:url("/pkg/assets/logo.png")}',
      "assets/logo.png": "",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("检查构建清单中的模块路径", async () => {
    const dir = await fixture({
      "index.html":
        '<html><body><script src="/pkg/assets/app.js"></script></body></html>',
      "mnaddon.json": '{"addonid":"test","panel":"index.html"}',
      "assets/app.js": "export const ok = true;",
      "assets/chunk.js": "export const chunk = true;",
    });
    await expect(
      inspectArtifact(dir, {
        mode: "panel",
        moduleReferences: ["assets/chunk.js"],
      }),
    ).rejects.toBeInstanceOf(MnRailsError);
  });

  it("拒绝 eval", async () => {
    const dir = await fixture({
      "index.html":
        '<html><body><script src="/pkg/app.js"></script></body></html>',
      "mnaddon.json": "{}",
      "app.js": "eval('1 + 1')",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toBeInstanceOf(
      MnRailsError,
    );
  });

  it("拒绝纯面板产物中的 main.js", async () => {
    const dir = await fixture({
      "index.html":
        '<!doctype html><html><body><script src="/pkg/app.js"></script></body></html>',
      "mnaddon.json": "{}",
      "app.js": "",
      "main.js": "JSB.newAddon = function () {};",
    });
    await expect(inspectArtifact(dir, { mode: "panel" })).rejects.toThrow(
      "main.js",
    );
  });

  it("拒绝缺少原生模块的混合形态产物", async () => {
    const dir = await fixture({
      "index.html":
        '<!doctype html><html><body><script src="/pkg/app.js"></script></body></html>',
      "mnaddon.json": "{}",
      "app.js": "",
      "main.js": "JSB.newAddon = function () {};",
    });
    await expect(inspectArtifact(dir, { mode: "hybrid" })).rejects.toThrow(
      "PanelBridge.js",
    );
  });

  it("接受带原生入口的混合形态产物", async () => {
    const dir = await fixture({
      "index.html":
        '<!doctype html><html><body><script src="/pkg/app.js"></script></body></html>',
      "mnaddon.json": "{}",
      "app.js": "",
      "main.js": "JSB.newAddon = function () {};",
      "PanelBridge.js": "",
    });
    await expect(inspectArtifact(dir, { mode: "hybrid" })).resolves.toBeDefined();
  });
});
