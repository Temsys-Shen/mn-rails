import { assertReleaseTag, readReleaseVersion } from "./release-metadata.mjs";

const version = await readReleaseVersion();
if (!assertReleaseTag(version)) {
  console.log("当前不在标签发布环境中，跳过标签检查。");
} else {
  console.log(`发布标签与包版本一致：v${version}`);
}
