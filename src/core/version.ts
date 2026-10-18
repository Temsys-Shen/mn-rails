import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 脚手架自身的版本。唯一来源是包的 package.json，避免多处硬编码产生漂移。
 */
export const MN_RAILS_VERSION: string = readOwnVersion();

function readOwnVersion(): string {
  let current = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      const metadata = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (metadata.name === "mn-rails" && typeof metadata.version === "string") {
        return metadata.version;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error("无法定位 mn-rails 的 package.json");
    }
    current = parent;
  }
}
