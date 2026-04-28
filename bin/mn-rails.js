#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

let promptModulePromise = null;

const TEMPLATE_PRESETS = {
  standard: {
    templateDirName: "base",
    mainModuleToken: "HelloWorldAddon",
    createFunctionToken: "createHelloWorldAddon",
    classTypeToken: "MNHelloWorldAddon",
    classFileName: "HelloWorldAddon.js",
    logTagToken: "[HelloWorld]",
  },
  web: {
    templateDirName: "web",
    mainModuleToken: "WebAddon",
    createFunctionToken: "createWebAddon",
    classTypeToken: "MNWebAddon",
    classFileName: "WebAddon.js",
    logTagToken: "[WebAddon]",
    obsoleteScriptKeys: ["live", "live:stop"],
  },
};

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl, text) {
  return new Promise((resolve) => rl.question(text, resolve));
}

async function askText(text) {
  const rl = createInterface();
  try {
    return await question(rl, text);
  } finally {
    rl.close();
  }
}

function ensureInteractiveTerminal(label, hint) {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return;
  }

  throw new Error(`${label} requires an interactive terminal. ${hint}`);
}

async function loadPromptModule() {
  if (!promptModulePromise) {
    promptModulePromise = import("@inquirer/prompts");
  }
  return promptModulePromise;
}

async function askSelect({ message, choices, defaultValue, missingTtyHint }) {
  ensureInteractiveTerminal(message, missingTtyHint);
  const { select } = await loadPromptModule();
  return select({
    message,
    choices,
    default: defaultValue,
  });
}

async function askConfirm({ message, defaultValue, missingTtyHint }) {
  ensureInteractiveTerminal(message, missingTtyHint);
  const { confirm } = await loadPromptModule();
  return confirm({
    message,
    default: defaultValue,
  });
}

function normalizeTemplateName(raw) {
  const input = String(raw || "").trim().toLowerCase();
  if (!input) return null;
  if (input === "standard" || input === "base") return "standard";
  if (input === "web") return "web";
  return null;
}

function getTemplatePreset(templateName) {
  const normalized = normalizeTemplateName(templateName);
  if (!normalized || !TEMPLATE_PRESETS[normalized]) {
    throw new Error(`Unsupported template: ${templateName}`);
  }

  const preset = TEMPLATE_PRESETS[normalized];
  return {
    ...preset,
    templateName: normalized,
    templateDir: path.join(__dirname, "..", "templates", preset.templateDirName),
  };
}

function parseCliArgs(argv) {
  let command = null;
  let template = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--template") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("Missing value for --template");
      }
      template = next;
      i += 1;
      continue;
    }

    if (arg.startsWith("--template=")) {
      template = arg.slice("--template=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (command) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    command = arg;
  }

  return { command, template };
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

function toSafeIdentifier(input) {
  const normalized = String(input || "").replace(/[^a-zA-Z0-9_]/g, "_");
  const safe = /^[a-zA-Z_$]/.test(normalized) ? normalized : `_${normalized}`;
  return safe || "_WebAddon";
}

function isDirEmpty(dir) {
  return fs.readdirSync(dir).length === 0;
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  const hasGitignore = entries.some((entry) => entry.name === ".gitignore");
  const hasGitignoreTmp = entries.some((entry) => entry.name === ".gitignore.tmp");

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
    const destName =
      entry.name === ".gitignore.tmp"
        ? ".gitignore"
        : entry.name === ".npmignore" && !hasGitignore && !hasGitignoreTmp
          ? ".gitignore"
          : entry.name;
    const destPath = path.join(dest, destName);

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

function escapeReplacementValue(value) {
  return String(value).replace(/\$/g, "$$$$");
}

function escapeJsStringContent(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function escapeDoubleQuotedJsReplacement(value) {
  return escapeReplacementValue(escapeJsStringContent(value));
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

function readProjectTemplateName(targetPackageJsonPath) {
  const targetPackageJson = readJsonStrict(targetPackageJsonPath, "Target package.json");
  const marker = targetPackageJson.mnRails && targetPackageJson.mnRails.template;
  const normalized = normalizeTemplateName(marker);
  if (normalized) {
    return normalized;
  }
  return "standard";
}

function updateTemplateProject() {
  const targetDir = process.cwd();
  const targetPackageJsonPath = path.join(targetDir, "package.json");
  const templateName = readProjectTemplateName(targetPackageJsonPath);
  const preset = getTemplatePreset(templateName);
  const templateDir = preset.templateDir;

  const templatePackageJsonPath = path.join(templateDir, "package.json");
  const templateAgentsPath = path.join(templateDir, "AGENTS.md");
  const templateGitignoreTmpPath = path.join(templateDir, ".gitignore.tmp");
  const templateGitignorePath = path.join(templateDir, ".gitignore");
  const templateNpmignorePath = path.join(templateDir, ".npmignore");
  const targetAgentsPath = path.join(targetDir, "AGENTS.md");
  const targetGitignorePath = path.join(targetDir, ".gitignore");
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

  const templateIgnoreSourcePath = fs.existsSync(templateGitignoreTmpPath)
    ? templateGitignoreTmpPath
    : fs.existsSync(templateGitignorePath)
      ? templateGitignorePath
      : templateNpmignorePath;
  if (!fs.existsSync(templateIgnoreSourcePath)) {
    throw new Error(
      `Template ignore file not found: ${templateGitignoreTmpPath} or ${templateGitignorePath} or ${templateNpmignorePath}`,
    );
  }

  if (!fs.existsSync(templateScriptsDir)) {
    throw new Error(`Template scripts directory not found: ${templateScriptsDir}`);
  }

  fs.copyFileSync(templateAgentsPath, targetAgentsPath);
  fs.copyFileSync(templateIgnoreSourcePath, targetGitignorePath);

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

  const obsoleteScriptKeys = Array.isArray(preset.obsoleteScriptKeys)
    ? preset.obsoleteScriptKeys
    : [];
  obsoleteScriptKeys.forEach((key) => {
    if (!(key in templatePackageJson.scripts)) {
      delete targetScripts[key];
    }
  });

  targetPackageJson.scripts = targetScripts;
  if (!targetPackageJson.mnRails || typeof targetPackageJson.mnRails !== "object") {
    targetPackageJson.mnRails = {};
  }
  targetPackageJson.mnRails.template = templateName;
  writeJson(targetPackageJsonPath, targetPackageJson);

  console.log("Template update completed.");
  console.log(`template: ${templateName}`);
  console.log("AGENTS.md: updated");
  console.log(".gitignore: updated");
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
      ? "- uses: pnpm/action-setup@v4\\n        with:\\n          version: 9"
      : "";

  return `name: CI\n\non:\n  push:\n    tags:\n      - \"v*\"\n  pull_request:\n\npermissions:\n  contents: write\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n${setupStep ? "      " + setupStep + "\\n" : ""}      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: ${packageManager}\n      - run: ${install}\n      - run: ${runBuild}\n      - name: Create GitHub Release\n        if: startsWith(github.ref, 'refs/tags/v')\n        uses: softprops/action-gh-release@v2\n        with:\n          files: \"*.mnaddon\"\n          fail_on_unmatched_files: true\n          generate_release_notes: true\n`;
}

function applyWebTemplateNaming(targetDir, className, classFilePath, title) {
  const safeClassToken = toSafeIdentifier(className);
  const webApiGlobal = `__MN_WEB_API_${safeClassToken}`;
  const bridgeCommandsGlobal = `__MN_WEB_BRIDGE_COMMANDS_${safeClassToken}`;
  const panelControllerClass = `MNWebPanelController_${safeClassToken}`;
  const bridgeReceiveFn = `__MNBridgeReceive_${safeClassToken}`;
  const devServerFn = `__MNGetWebDevServerURL_${safeClassToken}`;
  const stateKeyPrefix = `mn_web_template_${safeClassToken.toLowerCase()}`;
  const panelTitle = escapeDoubleQuotedJsReplacement(title);

  const replacements = [
    [/__MN_WEB_API_GLOBAL__/g, webApiGlobal],
    [/__MN_WEB_BRIDGE_COMMANDS_GLOBAL__/g, bridgeCommandsGlobal],
    [/__MN_WEB_PANEL_CONTROLLER_CLASS__/g, panelControllerClass],
    [/__MN_WEB_PANEL_TITLE__/g, panelTitle],
    [/__MN_WEB_BRIDGE_RECEIVE_FN__/g, bridgeReceiveFn],
    [/__MN_WEB_GET_DEV_SERVER_URL_FN__/g, devServerFn],
    [/__MN_WEB_STATE_KEY_PREFIX__/g, stateKeyPrefix],
  ];

  replaceInFile(path.join(targetDir, "src", "WebBridgeCommands.js"), replacements);
  replaceInFile(path.join(targetDir, "src", "WebPanelController.js"), replacements);
  replaceInFile(classFilePath, replacements);
  replaceInFile(path.join(targetDir, "src", "WebDevServerConfig.js"), replacements);
  replaceInFile(path.join(targetDir, "web", "src", "lib", "mnBridge.js"), replacements);
}

async function createProject(options = {}) {
  const cwd = process.cwd();
  const defaultName = "marginnote-addon";

  const nameInput = (await askText(`Project name (${defaultName}): `)).trim();
  const projectName = nameInput || defaultName;
  const targetDir = projectName === "." ? cwd : path.join(cwd, projectName);

  if (fs.existsSync(targetDir) && !isDirEmpty(targetDir)) {
    console.log("Target directory is not empty. Please choose another name.");
    process.exit(1);
  }

  let templateName = normalizeTemplateName(options.template);
  if (!templateName) {
    templateName = await askSelect({
      message: "Select template",
      choices: [
        { name: "web", value: "web", description: "Web addon template with React and Vite" },
        { name: "standard", value: "standard", description: "Standard JavaScriptCore addon template" },
      ],
      defaultValue: "web",
      missingTtyHint: "Pass --template standard|web or run mn-rails in a TTY session.",
    });
  }

  const preset = getTemplatePreset(templateName);

  const addonId = (await askText("addonid: ")).trim();
  if (!addonId) {
    console.log("addonid is required.");
    process.exit(1);
  }

  const author = (await askText("author: ")).trim();
  if (!author) {
    console.log("author is required.");
    process.exit(1);
  }

  const title = (await askText("title: ")).trim();
  if (!title) {
    console.log("title is required.");
    process.exit(1);
  }

  const defaultClassName = `MN${toPascalCase(title)}Addon`;
  const classNameInput = (await askText(`class name (${defaultClassName}): `)).trim();
  const className = classNameInput || defaultClassName;

  const packageManager = await askSelect({
    message: "Select package manager",
    choices: [
      { name: "pnpm", value: "pnpm", description: "Recommended for the generated template" },
      { name: "npm", value: "npm", description: "Use npm scripts and lockfile" },
    ],
    defaultValue: "pnpm",
    missingTtyHint: "Run mn-rails in a TTY session to choose a package manager.",
  });

  let generateCi = false;
  if (packageManager === "pnpm") {
    generateCi = await askConfirm({
      message: "Generate CI workflow?",
      defaultValue: true,
      missingTtyHint: "Run mn-rails in a TTY session to choose whether to generate CI.",
    });
  }

  copyDirectory(preset.templateDir, targetDir);

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
  if (!packageJson.mnRails || typeof packageJson.mnRails !== "object") {
    packageJson.mnRails = {};
  }
  packageJson.mnRails.template = templateName;
  writeJson(packageJsonPath, packageJson);

  const buildScriptPath = path.join(targetDir, "scripts", "build-release.js");
  replaceInFile(buildScriptPath, [[/helloworld/g, addonName]]);

  const mainPath = path.join(targetDir, "src", "main.js");
  replaceInFile(mainPath, [
    [new RegExp(preset.mainModuleToken, "g"), className],
    [new RegExp(preset.createFunctionToken, "g"), `create${className}`],
  ]);

  const sourceClassPath = path.join(targetDir, "src", preset.classFileName);
  const classFilePath = path.join(targetDir, "src", `${className}.js`);
  const logTag = escapeDoubleQuotedJsReplacement(`[${title}]`);
  replaceInFile(sourceClassPath, [
    [new RegExp(preset.createFunctionToken, "g"), `create${className}`],
    [new RegExp(preset.classTypeToken, "g"), className],
    [new RegExp(preset.logTagToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), logTag],
  ]);
  fs.renameSync(sourceClassPath, classFilePath);

  if (templateName === "web") {
    applyWebTemplateNaming(targetDir, className, classFilePath, title);
  }

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
  console.log(`Template: ${templateName}`);
}

function printUsage() {
  console.log("Usage:");
  console.log("  mn-rails [--template standard|web]");
  console.log("  mn-rails update");
}

async function main() {
  const { command, template } = parseCliArgs(process.argv.slice(2));

  if (!command) {
    if (template && !normalizeTemplateName(template)) {
      throw new Error(`Unsupported template: ${template}`);
    }
    await createProject({ template });
    return;
  }

  if (command === "update") {
    if (template) {
      throw new Error("update does not accept --template. It reads package.json mnRails.template.");
    }
    updateTemplateProject();
    return;
  }

  printUsage();
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
