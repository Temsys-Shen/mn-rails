import { spawn } from "node:child_process";

import { fail } from "./errors.js";

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

export async function run(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(`无法执行 ${command}：${error.message}`, { cause: error }),
      );
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = stderr.trim() || stdout.trim();
      fail(
        `${command} ${args.join(" ")} 执行失败（退出码 ${code ?? signal}）${detail ? `\n${detail}` : ""}`,
        "先处理上面的命令输出，再重新运行当前命令。",
      );
    });
  });
}

export async function capture(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<string> {
  const result = await run(command, args, { ...options, stdio: "pipe" });
  return result.stdout.trim();
}
