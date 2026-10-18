import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { readTemplateConfig } from "../src/core/template.js";
import type { AddonManifest } from "../src/core/manifest.js";

const manifest: AddonManifest = {
  addonid: "com.example.panel",
  author: "Example",
  title: "Example",
  version: "0.1.0",
  marginnote_version_min: "4.5.0",
  immersiveOnly: true,
  panel: "index.html",
};

async function project(template: unknown): Promise<string> {
  const dir = join(tmpdir(), `mn-rails-template-${crypto.randomUUID()}`);
  await mkdir(join(dir, "template"), { recursive: true });
  await writeFile(join(dir, "template", "template.json"), JSON.stringify(template));
  return dir;
}

describe("readTemplateConfig", () => {
  it("接受完整关联", async () => {
    const dir = await project({
      id: "u-example",
      name: "Example",
      plugins: ["com.example.panel"],
      pluginConfigs: { "com.example.panel": {} },
      bottom: {
        modes: [{ id: "collect", behavior: "write", tools: ["addon.com.example.panel.primary"] }],
      },
    });

    const result = await readTemplateConfig(dir, manifest);
    expect(result?.id).toBe("u-example");
  });

  it("拒绝缺少白名单", async () => {
    const dir = await project({
      id: "u-example",
      name: "Example",
      plugins: [],
      pluginConfigs: { "com.example.panel": {} },
      bottom: {
        modes: [{ id: "collect", behavior: "write", tools: ["addon.com.example.panel.primary"] }],
      },
    });
    await expect(readTemplateConfig(dir, manifest)).rejects.toThrow("plugins");
  });

  it("拒绝没有界面入口", async () => {
    const dir = await project({
      id: "u-example",
      name: "Example",
      plugins: ["com.example.panel"],
      pluginConfigs: { "com.example.panel": {} },
      bottom: { modes: [{ id: "collect", behavior: "write", tools: [] }] },
    });
    await expect(readTemplateConfig(dir, manifest)).rejects.toThrow("addon.");
  });
});
