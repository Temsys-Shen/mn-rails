export function publishIfMissing(
  packageName: string,
  manifest: {
    version: string;
    packages: Record<string, { file: string; integrity: string }>;
  },
  root?: string,
  registry?: string,
): Promise<"published" | "skipped">;
