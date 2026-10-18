import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  assertReleaseTag,
  expectedTag,
  repositoryRoot,
  readReleaseVersion,
} from "./release-metadata.mjs";

const releaseDir = join(repositoryRoot, "release");
const version = await readReleaseVersion();

assertReleaseTagIfTagged(version);
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

const mnRails = await pack({
  cwd: repositoryRoot,
  expectedName: `mn-rails-${version}.tgz`,
  outputName: "mn-rails.tgz",
});
const create = await pack({
  cwd: join(repositoryRoot, "create"),
  expectedName: `create-mn-rails-${version}.tgz`,
  outputName: "create-mn-rails.tgz",
});

assertRootPackage(mnRails.manifest, version);
assertCreatePackage(create.manifest, version);
assertNoUnexpectedEntries(mnRails.entries, "mn-rails");
assertNoUnexpectedEntries(create.entries, "create-mn-rails");

const manifest = {
  version,
  tag: expectedTag(version),
  generatedAt: new Date().toISOString(),
  packages: {
    "mn-rails": summarize(mnRails),
    "create-mn-rails": summarize(create),
  },
};
await writeFile(join(releaseDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`发布包已生成：${releaseDir}`);
for (const [name, entry] of Object.entries(manifest.packages)) {
  console.log(`${name} ${version}：${entry.entryCount} 个条目，${entry.integrity}`);
}

async function pack({ cwd, expectedName, outputName }) {
  execFileSync("pnpm", ["pack", "--pack-destination", releaseDir], {
    cwd,
    stdio: "inherit",
  });
  const files = await readdir(releaseDir);
  if (!files.includes(expectedName)) {
    throw new Error(`pnpm pack 没有生成 ${expectedName}`);
  }
  const file = join(releaseDir, outputName);
  await rename(join(releaseDir, expectedName), file);
  const entries = execFileSync("tar", ["-tzf", file], { encoding: "utf8" })
    .trim()
    .split("\n");
  const manifest = JSON.parse(
    execFileSync("tar", ["-xOzf", file, "package/package.json"], { encoding: "utf8" }),
  );
  const bytes = await readFile(file);
  const info = await stat(file);
  return {
    file: outputName,
    size: info.size,
    integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
    entryCount: entries.length,
    entries,
    manifest,
  };
}

function assertRootPackage(packageJson, expectedVersion) {
  if (packageJson.name !== "mn-rails" || packageJson.version !== expectedVersion) {
    throw new Error("mn-rails 发布包的名称或版本不正确");
  }
  if (packageJson.bin?.["mn-rails"] !== "bin/mn-rails.js") {
    throw new Error("mn-rails 发布包的 bin 映射不正确");
  }
}

function assertCreatePackage(packageJson, expectedVersion) {
  if (packageJson.name !== "create-mn-rails" || packageJson.version !== expectedVersion) {
    throw new Error("create-mn-rails 发布包的名称或版本不正确");
  }
  if (packageJson.dependencies?.["mn-rails"] !== expectedVersion) {
    throw new Error("create-mn-rails 发布包中的 mn-rails 依赖没有被改写为固定版本");
  }
}

function assertNoUnexpectedEntries(entries, packageName) {
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
    throw new Error(`${packageName} 发布包含有无关文件：\n${unwanted.join("\n")}`);
  }
}

function summarize(entry) {
  return {
    file: entry.file,
    size: entry.size,
    integrity: entry.integrity,
    entryCount: entry.entryCount,
  };
}

function assertReleaseTagIfTagged(currentVersion) {
  const refName = process.env.GITHUB_REF_NAME ?? "";
  if (process.env.GITHUB_REF_TYPE === "tag" || refName.startsWith("v")) {
    assertReleaseTag(currentVersion);
  }
}
