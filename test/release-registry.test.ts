import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

import { readDist } from "../scripts/registry.mjs";
import { publishIfMissing } from "../scripts/publish-if-missing.mjs";

afterEach(() => {
  vi.clearAllMocks();
});

describe("readDist", () => {
  it("返回注册表中的完整性值", () => {
    mocks.execFileSync.mockReturnValue('{"integrity":"sha512-current"}');

    expect(readDist("https://registry.npmjs.org", "mn-rails", "2.0.4")).toEqual({
      integrity: "sha512-current",
    });
  });

  it("查询失败时返回空值", () => {
    mocks.execFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    expect(readDist("https://registry.npmjs.org", "mn-rails", "2.0.4")).toBe(
      undefined,
    );
  });
});

describe("publishIfMissing", () => {
  const manifest = {
    version: "2.0.4",
    packages: {
      "mn-rails": {
        file: "mn-rails.tgz",
        integrity: "sha512-current",
      },
    },
  };

  it("同名版本已存在且完整性一致时跳过发布", async () => {
    mocks.execFileSync.mockReturnValue('{"integrity":"sha512-current"}');

    await expect(
      publishIfMissing("mn-rails", manifest, "/repository"),
    ).resolves.toBe("skipped");
    expect(mocks.execFileSync).toHaveBeenCalledTimes(1);
  });

  it("同名版本已存在但完整性不一致时拒绝发布", async () => {
    mocks.execFileSync.mockReturnValue('{"integrity":"sha512-other"}');

    await expect(
      publishIfMissing("mn-rails", manifest, "/repository"),
    ).rejects.toThrow("完整性不一致");
    expect(mocks.execFileSync).toHaveBeenCalledTimes(1);
  });

  it("同名版本不存在时执行发布", async () => {
    mocks.execFileSync
      .mockImplementationOnce(() => {
        throw new Error("not found");
      })
      .mockReturnValueOnce("");

    await expect(
      publishIfMissing("mn-rails", manifest, "/repository"),
    ).resolves.toBe("published");
    expect(mocks.execFileSync).toHaveBeenLastCalledWith(
      "npm",
      [
        "publish",
        "/repository/release/mn-rails.tgz",
        "--access",
        "public",
        "--provenance",
        "--registry",
        "https://registry.npmjs.org",
      ],
      { stdio: "inherit" },
    );
  });
});
