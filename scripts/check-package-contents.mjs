import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const temporary = await mkdtemp(join(tmpdir(), "mn-rails-pack-"));
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
try {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  await run("npm", ["pack", "--pack-destination", temporary], {
    cwd: repositoryRoot,
  });

  const tarball = (await import("node:fs/promises")).readdir(temporary);
  const files = await tarball;
  const packed = files.find((file) => file.endsWith(".tgz"));
  if (!packed) throw new Error("npm pack 没有生成 .tgz");

  const { execFileSync } = await import("node:child_process");
  const contents = execFileSync("tar", ["-tzf", join(temporary, packed)], {
    encoding: "utf8",
  });
  const entries = contents.trim().split("\n");
  const unwanted = entries.filter((entry) => {
    const path = entry.replace(/^package\//, "");
    return (
      path === ".DS_Store" ||
      path.endsWith("/.DS_Store") ||
      path === "gitignore.tmp" ||
      path.endsWith("/gitignore.tmp") ||
      path.includes("/.git/")
    );
  });
  if (unwanted.length > 0) {
    throw new Error(`发布包含有无关文件：\n${unwanted.join("\n")}`);
  }
  const required = [
    "package/bin/mn-rails.js",
    "package/package.json",
    "package/README.md",
    "package/templates/react/src/App.tsx",
    "package/templates/react/eslint/framework.mjs",
    "package/templates/vue/src/App.vue",
    "package/templates/vue/eslint/framework.mjs",
    "package/templates/svelte/src/App.svelte",
    "package/templates/svelte/eslint/framework.mjs",
    "package/templates/native/main.js",
    "package/templates/native/PanelBridge.js",
    "package/templates/shared/AGENTS.md",
    "package/templates/shared/eslint.config.mjs",
    "package/templates/shared/gitignore",
    "package/dist/index.js",
    "package/dist/vite.js",
  ];
  const missing = required.filter((entry) => !entries.includes(entry));
  if (missing.length > 0) {
    throw new Error(`发布包缺少文件：\n${missing.join("\n")}`);
  }

  const packageJsonText = execFileSync(
    "tar",
    ["-xOzf", join(temporary, packed), "package/package.json"],
    { encoding: "utf8" },
  );
  const packageJson = JSON.parse(packageJsonText);
  const expectedVersion = await readSourceVersion();
  if (packageJson.version !== expectedVersion) {
    throw new Error(
      `发布包版本与源码不一致：源码为 ${expectedVersion}，包内为 ${packageJson.version}`,
    );
  }
  assertMatchesReleaseTag(packageJson.version);
  if (packageJson.bin?.["mn-rails"] !== "bin/mn-rails.js") {
    throw new Error("发布包的 bin 映射不正确");
  }
  console.log(`发布包检查通过：${packed}，${entries.length} 个条目`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function readSourceVersion() {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  if (typeof manifest.version !== "string" || manifest.version === "") {
    throw new Error("package.json 缺少 version");
  }
  return manifest.version;
}

function assertMatchesReleaseTag(version) {
  const tag = process.env.GITHUB_REF_NAME;
  if (!tag || !tag.startsWith("v")) return;
  if (tag.slice(1) !== version) {
    throw new Error(`发布标签 ${tag} 与包版本 ${version} 不一致`);
  }
}
