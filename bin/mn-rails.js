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

function readJsonStrict(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath}`);
  }
}

function listFilesRecursively(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath, baseDir));
      return;
    }

    const relativePath = path.relative(baseDir, fullPath);
    files.push(relativePath);
  });

  return files;
}

function updateTemplateProject() {
  const targetDir = process.cwd();
  const templateDir = path.join(__dirname, "..", "templates", "base");

  const templatePackageJsonPath = path.join(templateDir, "package.json");
  const targetPackageJsonPath = path.join(targetDir, "package.json");
  const templateAgentsPath = path.join(templateDir, "AGENTS.md");
  const targetAgentsPath = path.join(targetDir, "AGENTS.md");
  const templateScriptsDir = path.join(templateDir, "scripts");
  const targetScriptsDir = path.join(targetDir, "scripts");

  const templatePackageJson = readJsonStrict(
    templatePackageJsonPath,
    "Template package.json",
  );
  const targetPackageJson = readJsonStrict(targetPackageJsonPath, "Target package.json");

  if (
    !templatePackageJson.scripts ||
    typeof templatePackageJson.scripts !== "object" ||
    Array.isArray(templatePackageJson.scripts)
  ) {
    throw new Error("Template package.json scripts must be an object.");
  }

  if (!fs.existsSync(templateAgentsPath)) {
    throw new Error(`Template AGENTS.md not found: ${templateAgentsPath}`);
  }

  if (!fs.existsSync(templateScriptsDir)) {
    throw new Error(`Template scripts directory not found: ${templateScriptsDir}`);
  }

  fs.copyFileSync(templateAgentsPath, targetAgentsPath);

  if (!fs.existsSync(targetScriptsDir)) {
    fs.mkdirSync(targetScriptsDir, { recursive: true });
  }
  copyDirectory(templateScriptsDir, targetScriptsDir);
  const syncedScriptFiles = listFilesRecursively(templateScriptsDir).sort();

  const managedScriptKeys = Object.keys(templatePackageJson.scripts).sort();
  const targetScripts =
    targetPackageJson.scripts &&
    typeof targetPackageJson.scripts === "object" &&
    !Array.isArray(targetPackageJson.scripts)
      ? { ...targetPackageJson.scripts }
      : {};

  managedScriptKeys.forEach((key) => {
    targetScripts[key] = templatePackageJson.scripts[key];
  });

  targetPackageJson.scripts = targetScripts;
  writeJson(targetPackageJsonPath, targetPackageJson);

  console.log("Template update completed.");
  console.log("AGENTS.md: updated");
  console.log(
    `scripts files overwritten: ${syncedScriptFiles.length ? syncedScriptFiles.join(", ") : "(none)"}`,
  );
  console.log(
    `package.json scripts keys overwritten: ${
      managedScriptKeys.length ? managedScriptKeys.join(", ") : "(none)"
    }`,
  );
}

function generateCiContent(packageManager) {
  const install = packageManager === "pnpm" ? "pnpm install" : "npm install";
  const runBuild = packageManager === "pnpm" ? "pnpm run build" : "npm run build";

  const setupStep =
    packageManager === "pnpm"
      ? "- uses: pnpm/action-setup@v4\n        with:\n          version: 9"
      : "";

  return `name: CI\n\non:\n  push:\n    tags:\n      - \"v*\"\n  pull_request:\n\npermissions:\n  contents: write\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n${setupStep ? "      " + setupStep + "\n" : ""}      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: ${packageManager}\n      - run: ${install}\n      - run: ${runBuild}\n      - name: Create GitHub Release\n        if: startsWith(github.ref, 'refs/tags/v')\n        uses: softprops/action-gh-release@v2\n        with:\n          files: \"*.mnaddon\"\n          fail_on_unmatched_files: true\n          generate_release_notes: true\n`;
}

async function createProject() {
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

    let generateCi = false;
    if (packageManager === "pnpm") {
      const ciInput = (await question(rl, "generate CI? (y/n) [y]: "))
        .trim()
        .toLowerCase();
      generateCi = ciInput === "" || ciInput === "y" || ciInput === "yes";
    }

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

async function main() {
  const command = process.argv[2];

  if (!command) {
    await createProject();
    return;
  }

  if (command === "update") {
    updateTemplateProject();
    return;
  }

  console.log("Usage:");
  console.log("  mn-rails");
  console.log("  mn-rails update");
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
