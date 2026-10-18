import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { repositoryRoot } from "./release-metadata.mjs";

const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "release", "manifest.json"), "utf8"),
);

console.log(`待发布版本：${manifest.tag}`);
for (const [name, entry] of Object.entries(manifest.packages)) {
  console.log(
    `${name}：release/${entry.file}，${entry.entryCount} 个条目，${formatSize(entry.size)}，${entry.integrity}`,
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
