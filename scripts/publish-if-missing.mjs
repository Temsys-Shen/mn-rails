import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readDist } from "./registry.mjs";
import { repositoryRoot } from "./release-metadata.mjs";

export async function publishIfMissing(
  packageName,
  manifest,
  root = repositoryRoot,
  registry = process.env.RELEASE_REGISTRY ?? "https://registry.npmjs.org",
) {
  const expected = manifest.packages[packageName];
  if (!expected) {
    throw new Error(`release/manifest.json 中没有 ${packageName}`);
  }

  const dist = readDist(registry, packageName, manifest.version);
  if (dist) {
    if (dist.integrity !== expected.integrity) {
      throw new Error(
        `${packageName}@${manifest.version} 的完整性不一致：本地为 ${expected.integrity}，注册表为 ${dist.integrity}`,
      );
    }
    console.log(`${packageName}@${manifest.version} 已存在，完整性校验通过，跳过发布`);
    return "skipped";
  }

  execFileSync(
    "npm",
    [
      "publish",
      join(root, "release", expected.file),
      "--access",
      "public",
      "--provenance",
      "--registry",
      registry,
    ],
    { stdio: "inherit" },
  );
  return "published";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageName = process.argv[2];
  if (!packageName) {
    throw new Error("用法：node scripts/publish-if-missing.mjs <包名>");
  }
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "release", "manifest.json"), "utf8"),
  );
  await publishIfMissing(packageName, manifest);
}
