import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export async function readReleaseVersion() {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  if (typeof manifest.version !== "string" || manifest.version === "") {
    throw new Error("package.json 缺少 version");
  }
  return manifest.version;
}

export function releaseTag() {
  return process.env.GITHUB_REF_NAME ?? "";
}

export function expectedTag(version) {
  return `v${version}`;
}

export function assertReleaseTag(version) {
  const tag = releaseTag();
  if (tag === "") {
    return false;
  }
  if (tag !== expectedTag(version)) {
    throw new Error(`发布标签 ${tag} 与包版本 ${version} 不一致，应为 ${expectedTag(version)}`);
  }
  return true;
}
