# 标准插件(打包项目)开发模板

用于MarginNote4的标准插件工程模板(输出`.mnaddon`)。

## 开始开发

安装依赖：

```bash
pnpm install
# 或(使用npm时)
npm install
```

单次热部署到本机MarginNote4并自动重启：

```bash
pnpm dev
# 或(使用npm时)
npm run dev
```

进入持续监听模式，源码变化后自动同步并重启MarginNote4：

```bash
pnpm live
# 或(使用npm时)
npm run live
```

停止监听进程并清理锁：

```bash
pnpm live:stop
# 或(使用npm时)
npm run live:stop
```

打包发布包：

```bash
pnpm build
# 或(使用npm时)
npm run build
```

如果需要安装正式包，再执行`build`后将生成的`.mnaddon`导入MarginNote4。

## 常用命令

更新版本号(同时更新`package.json`与`src/mnaddon.json`)：

```bash
pnpm version:patch
pnpm version:minor
pnpm version:major
```

如果当前目录是干净的git工作区，会自动创建commit并打tag(例如`v0.2.0`)。

## 发布到GitHubRelease

推送tag后，GitHubActions会自动构建并把`*.mnaddon`上传到GitHubRelease：

```bash
pnpm version:patch
git push
git push --tags
```

## 注意事项

- 请先读`AGENTS.md`，尤其是“只允许在`src/main.js`里调用`JSB.require(...)`”这条
- MarginNote插件运行在JavaScriptCore环境中，不能按浏览器/Node.js假设(例如没有fetch/DOM/localStorage)
- `dev`和`live`依赖本机已安装MarginNote4，且会直接同步`src/`到`~/Library/Containers/QReader.MarginStudy.easy/Data/Library/MarginNote Extensions/<addonid>`
- `live`通过轮询监听变更，可用环境变量`MN_LIVE_POLL_MS`和`MN_LIVE_DEBOUNCE_MS`调整轮询与防抖时间
