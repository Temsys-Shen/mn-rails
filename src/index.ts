import { Command } from "commander";

import { buildProject } from "./commands/build.js";
import { deployCurrentProject } from "./commands/deploy.js";
import { runDoctor } from "./commands/doctor.js";
import { initProject, type InitOptions } from "./commands/init.js";
import { packageCurrentProject } from "./commands/package.js";
import { MnRailsError } from "./core/errors.js";
import { MN_RAILS_VERSION } from "./core/version.js";

export { mnRails } from "./vite.js";
export type { MnRailsOptions } from "./vite.js";

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();
  program
    .name("mn-rails")
    .description("MarginNote 面板插件的现代脚手架")
    .version(MN_RAILS_VERSION)
    .showHelpAfterError()
    .configureOutput({
      writeErr: (text) => process.stderr.write(text),
    });

  program
    .command("init")
    .description("创建插件工程")
    .argument("[directory]", "目标目录")
    .option("--framework <name>", "react、vue 或 svelte")
    .option("--kind <name>", "panel 或 hybrid")
    .option("--addonid <id>", "插件标识")
    .option("--author <name>", "作者")
    .option("--title <name>", "插件名称")
    .option("--package-manager <name>", "npm、pnpm、yarn 或 bun")
    .option("--no-install", "不安装依赖")
    .option("--no-git", "不初始化 Git")
    .action(async (directory: string, options: InitOptions) => {
      await initProject({ ...options, directory });
    });

  program
    .command("build")
    .description("构建插件")
    .option("--package-manager <name>", "npm、pnpm、yarn 或 bun")
    .action(async (options: { packageManager?: string }) => {
      await buildProject(options);
    });

  program
    .command("package")
    .description("生成 .mnaddon 与 .mntemplate")
    .action(packageCurrentProject);

  program
    .command("deploy")
    .description("部署到已安装的 MarginNote 并重启应用")
    .action(deployCurrentProject);

  program
    .command("doctor")
    .description("检查工程与 MarginNote 环境")
    .option("--package-manager <name>", "npm、pnpm、yarn 或 bun")
    .action(async (options: { packageManager?: string }) => {
      await runDoctor(options);
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof MnRailsError) {
      console.error(`mn-rails: ${error.message}`);
      if (error.hint) console.error(`提示：${error.hint}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
