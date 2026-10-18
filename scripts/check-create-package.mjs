import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const temporary = await mkdtemp(join(tmpdir(), "create-mn-rails-pack-"));
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packCommand = resolvePackCommand();

try {
  execFileSync(packCommand.file, [...packCommand.args, "pack", "--pack-destination", temporary], {
    cwd: join(repositoryRoot, "create"),
    stdio: "inherit",
  });
  const packed = (await readdir(temporary)).find((file) => file.endsWith(".tgz"));
  if (!packed) throw new Error("pack 没有生成 create-mn-rails 包");

  const archive = join(temporary, packed);
  const contents = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
  const entries = contents.trim().split("\n");
  const required = [
    "package/bin/create-mn-rails.js",
    "package/package.json",
  ];
  const missing = required.filter((entry) => !entries.includes(entry));
  if (missing.length > 0) {
    throw new Error(`create-mn-rails 发布包缺少文件：\n${missing.join("\n")}`);
  }

  const packageJson = JSON.parse(
    execFileSync("tar", ["-xOzf", archive, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  const rootPackageJson = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  const expectedVersion = rootPackageJson.version;
  if (packageJson.version !== expectedVersion) {
    throw new Error(
      `create-mn-rails 版本与主包不一致：主包为 ${expectedVersion}，create 包为 ${packageJson.version}`,
    );
  }
  if (packageJson.bin?.["create-mn-rails"] !== "bin/create-mn-rails.js") {
    throw new Error("create-mn-rails 的 bin 映射不正确");
  }
  const mnRailsDependency = packageJson.dependencies?.["mn-rails"];
  if (mnRailsDependency !== expectedVersion) {
    throw new Error(
      `create-mn-rails 发布包中的 mn-rails 依赖必须改写为 ${expectedVersion}`,
    );
  }

  console.log(`create-mn-rails 发布包检查通过：${packed}，${entries.length} 个条目`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function resolvePackCommand() {
  const execPath = process.env.npm_execpath;
  if (execPath) {
    const extension = extname(execPath).toLowerCase();
    if (extension === ".js" || extension === ".cjs" || extension === ".mjs") {
      return { file: process.execPath, args: [execPath] };
    }
    return { file: execPath, args: [] };
  }
  return { file: "pnpm", args: [] };
}
