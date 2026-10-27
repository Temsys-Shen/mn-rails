import { execFileSync } from "node:child_process";

export function readDist(registry, name, version) {
  try {
    const output = execFileSync(
      "npm",
      [
        "view",
        `${name}@${version}`,
        "dist",
        "--json",
        "--registry",
        registry,
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
