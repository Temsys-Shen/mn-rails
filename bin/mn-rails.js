#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl, text) {
  return new Promise((resolve) => rl.question(text, resolve));
}

function toPascalCase(input) {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toKebabCase(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isDirEmpty(dir) {
  return fs.readdirSync(dir).length === 0;
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  entries.forEach((entry) => {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".git" ||
      entry.name === ".DS_Store" ||
      entry.name.endsWith(".mnaddon")
    ) {
      return;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
      return;
    }

    fs.copyFileSync(srcPath, destPath);
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  replacements.forEach(([from, to]) => {
    content = content.replace(from, to);
  });
  fs.writeFileSync(filePath, content);
}

function ensureDirRemoved(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function generateCiContent(packageManager) {
  const install = packageManager === "pnpm" ? "pnpm install" : "npm install";
  const runBuild = packageManager === "pnpm" ? "pnpm run build" : "npm run build";

  const setupStep =
    packageManager === "pnpm"
      ? "- uses: pnpm/action-setup@v4\n        with:\n          version: 9"
      : "";

  return `name: CI\n\non:\n  push:\n  pull_request:\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n${setupStep ? "      " + setupStep + "\n" : ""}      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: ${packageManager}\n      - run: ${install}\n      - run: ${runBuild}\n`;
}

async function main() {
  const rl = createInterface();
  const cwd = process.cwd();
  const defaultName = "marginnote-addon";

  try {
    const nameInput = (await question(rl, `Project name (${defaultName}): `)).trim();
    const projectName = nameInput || defaultName;
    const targetDir = projectName === "." ? cwd : path.join(cwd, projectName);

    if (fs.existsSync(targetDir) && !isDirEmpty(targetDir)) {
      console.log("Target directory is not empty. Please choose another name.");
      process.exit(1);
    }

    const addonId = (await question(rl, "addonid: ")).trim();
    if (!addonId) {
      console.log("addonid is required.");
      process.exit(1);
    }

    const author = (await question(rl, "author: ")).trim();
    if (!author) {
      console.log("author is required.");
      process.exit(1);
    }

    const title = (await question(rl, "title: ")).trim();
    if (!title) {
      console.log("title is required.");
      process.exit(1);
    }

    const defaultClassName = `MN${toPascalCase(title)}Addon`;
    const classNameInput = (
      await question(rl, `class name (${defaultClassName}): `)
    ).trim();
    const className = classNameInput || defaultClassName;

    const pmInput = (
      await question(rl, "package manager (npm/pnpm) [pnpm]: ")
    )
      .trim()
      .toLowerCase();
    const packageManager = pmInput === "npm" ? "npm" : "pnpm";

    const ciInput = (
      await question(rl, "generate CI? (y/n) [y]: ")
    )
      .trim()
      .toLowerCase();
    const generateCi = ciInput === "" || ciInput === "y" || ciInput === "yes";

    const templateDir = path.join(__dirname, "..", "templates", "base");
    copyDirectory(templateDir, targetDir);

    const addonName = toKebabCase(title) || "addon";

    const addonJsonPath = path.join(targetDir, "src", "mnaddon.json");
    const addonJson = readJson(addonJsonPath);
    addonJson.addonid = addonId;
    addonJson.author = author;
    addonJson.title = title;
    writeJson(addonJsonPath, addonJson);

    const packageJsonPath = path.join(targetDir, "package.json");
    const packageJson = readJson(packageJsonPath);
    packageJson.name = addonName;
    if (packageJson.scripts && packageJson.scripts.dev) {
      packageJson.scripts.dev = packageJson.scripts.dev.replace(
        /helloworld/g,
        addonName,
      );
    }
    writeJson(packageJsonPath, packageJson);

    const buildScriptPath = path.join(targetDir, "scripts", "build-release.js");
    replaceInFile(buildScriptPath, [[/helloworld/g, addonName]]);

    const mainPath = path.join(targetDir, "src", "main.js");
    replaceInFile(mainPath, [
      [/HelloWorldAddon/g, className],
      [/createHelloWorldAddon/g, `create${className}`],
    ]);

    const helloPath = path.join(targetDir, "src", "HelloWorldAddon.js");
    const classFilePath = path.join(targetDir, "src", `${className}.js`);
    replaceInFile(helloPath, [
      [/createHelloWorldAddon/g, `create${className}`],
      [/MNHelloWorldAddon/g, className],
      [/\[HelloWorld\]/g, `[${title}]`],
    ]);
    fs.renameSync(helloPath, classFilePath);

    if (!generateCi) {
      ensureDirRemoved(path.join(targetDir, ".github"));
    } else {
      const workflowDir = path.join(targetDir, ".github", "workflows");
      fs.mkdirSync(workflowDir, { recursive: true });
      const ciPath = path.join(workflowDir, "ci.yml");
      fs.writeFileSync(ciPath, generateCiContent(packageManager));
    }

    try {
      execSync("git --version", { stdio: "ignore" });
      execSync("git init", { cwd: targetDir, stdio: "ignore" });
      execSync("git add .", { cwd: targetDir, stdio: "ignore" });
      execSync("git commit -m \"init from mn-rails\"", {
        cwd: targetDir,
        stdio: "ignore",
      });
    } catch (error) {
      console.log("Git init skipped.");
    }

    console.log(`Created: ${targetDir}`);
  } finally {
    rl.close();
  }
}

main();
