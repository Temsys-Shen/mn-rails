import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export async function ensureEmptyDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function copyFileWithParents(
  source: string,
  destination: string,
): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

export async function copyDirectory(
  source: string,
  destination: string,
  options: { filter?: (relativePath: string) => boolean } = {},
): Promise<void> {
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    const relativePath = relative(source, sourcePath);
    if (options.filter && !options.filter(relativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath, options);
      continue;
    }
    if (entry.isFile()) {
      await copyFileWithParents(sourcePath, destinationPath);
    }
  }
}

export async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function listFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(path);
      for (const item of nested) {
        result.push(join(entry.name, item));
      }
      continue;
    }
    if (entry.isFile()) {
      result.push(entry.name);
    }
  }
  return result.sort();
}

export async function isDirectoryEmpty(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.every((name) => name.startsWith("."));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return true;
    throw error;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw error;
  }
}
