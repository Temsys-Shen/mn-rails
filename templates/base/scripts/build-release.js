const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function copyRecursiveSync(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach((child) => {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    });
    return;
  }
  fs.copyFileSync(src, dest);
}

function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach((file) => {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getAllFiles(name, files);
    } else {
      files.push(name);
    }
  });
  return files;
}

function minifyFiles(distDir) {
  const jsFiles = getAllFiles(distDir).filter((f) => f.endsWith(".js"));
  jsFiles.forEach((file) => {
    execSync(`pnpm exec terser "${file}" -o "${file}" --compress --mangle`);
  });

  const htmlFiles = getAllFiles(distDir).filter((f) => f.endsWith(".html"));
  htmlFiles.forEach((file) => {
    execSync(
      `pnpm exec html-minifier-terser "${file}" -o "${file}" --collapse-whitespace --remove-comments --minify-js true --minify-css true`,
    );
  });

  const cssFiles = getAllFiles(distDir).filter((f) => f.endsWith(".css"));
  cssFiles.forEach((file) => {
    execSync(`pnpm exec cleancss -o "${file}" "${file}"`);
  });
}

function build() {
  const rootDir = path.join(__dirname, "..");
  const pkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
  );
  const distDir = path.join(rootDir, "dist");
  const srcDir = path.join(rootDir, "src");
  const outputName = `helloworld-v${pkg.version}.mnaddon`;
  const outputPath = path.join(rootDir, outputName);

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  copyRecursiveSync(srcDir, distDir);
  minifyFiles(distDir);

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const absOutputPath = path.resolve(outputPath);
  execSync(`cd "${distDir}" && zip -r -q "${absOutputPath}" .`);
  console.log(`Build successful: ${outputName}`);
}

build();
