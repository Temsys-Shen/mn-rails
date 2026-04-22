const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function getLocalBin(rootDir, name) {
  const ext = process.platform === "win32" ? ".cmd" : "";
  return path.join(rootDir, "node_modules", ".bin", `${name}${ext}`);
}

function main() {
  const rootDir = path.join(__dirname, "..");
  const viteConfigPath = path.join(rootDir, "web", "vite.config.js");
  const distIndexPath = path.join(rootDir, "src", "web-dist", "index.html");
  const viteBin = getLocalBin(rootDir, "vite");

  execFileSync(viteBin, ["build", "--config", viteConfigPath], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (!fs.existsSync(distIndexPath)) {
    throw new Error(`Expected web build output missing: ${distIndexPath}`);
  }

  console.log(`Web build successful: ${distIndexPath}`);
}

main();
