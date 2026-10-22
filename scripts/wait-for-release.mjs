import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { repositoryRoot } from "./release-metadata.mjs";

const packageName = process.argv[2];
if (!packageName) {
  throw new Error("用法：node scripts/wait-for-release.mjs <包名>");
}

const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "release", "manifest.json"), "utf8"),
);
const expected = manifest.packages[packageName];
if (!expected) {
  throw new Error(`release/manifest.json 中没有 ${packageName}`);
}

const registry = process.env.RELEASE_REGISTRY ?? "https://registry.npmjs.org";
const attempts = Number(process.env.RELEASE_WAIT_ATTEMPTS ?? 30);
const interval = Number(process.env.RELEASE_WAIT_INTERVAL_MS ?? 10000);

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const dist = readDist(registry, packageName, manifest.version);
  if (dist) {
    if (dist.integrity !== expected.integrity) {
      throw new Error(
        `${packageName}@${manifest.version} 的完整性不一致：本地为 ${expected.integrity}，注册表为 ${dist.integrity}`,
      );
    }
    console.log(`${packageName}@${manifest.version} 已发布，完整性校验通过`);
    process.exit(0);
  }
  if (attempt < attempts) {
    console.log(`等待 ${packageName}@${manifest.version} 出现在注册表（${attempt}/${attempts}）`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

throw new Error(`${packageName}@${manifest.version} 在等待期限内没有出现在注册表`);

function readDist(currentRegistry, name, version) {
  try {
    const output = execFileSync(
      "npm",
      [
        "view",
        `${name}@${version}`,
        "dist",
        "--json",
        "--registry",
        currentRegistry,
        "--prefer-online",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const value = JSON.parse(output);
    return typeof value?.integrity === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
