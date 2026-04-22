const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function readAddonId() {
  const addonConfigPath = path.join(projectRoot, "src", "mnaddon.json");
  const addonConfig = JSON.parse(fs.readFileSync(addonConfigPath, "utf8"));
  return addonConfig.addonid || projectRoot;
}

function getLockDir(lockSource) {
  const lockKey = crypto.createHash("sha1").update(lockSource).digest("hex");
  return path.join(os.tmpdir(), `mn-addon-live-${lockKey}.lock`);
}

function readLockPid(pidPath) {
  if (!fs.existsSync(pidPath)) {
    return null;
  }

  const text = fs.readFileSync(pidPath, "utf8").trim();
  const pid = Number(text);
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`锁文件中的PID无效: ${text}`);
  }

  return pid;
}

function tryKill(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if (error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function removeLockDir(lockDir) {
  if (fs.existsSync(lockDir)) {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
}

function main() {
  const lockDir = getLockDir(readAddonId());
  const pidPath = path.join(lockDir, "pid");
  const pid = readLockPid(pidPath);

  if (!pid) {
    removeLockDir(lockDir);
    console.log("未发现live锁，已完成清理");
    return;
  }

  const sentTerm = tryKill(pid, "SIGTERM");
  if (sentTerm) {
    console.log(`已发送SIGTERM到PID:${pid}`);
  } else {
    console.log(`PID:${pid}不存在，按僵尸锁处理`);
  }

  removeLockDir(lockDir);
  console.log("已清理live锁");
}

try {
  main();
} catch (error) {
  console.error(`停止live失败: ${error.message}`);
  process.exit(1);
}
