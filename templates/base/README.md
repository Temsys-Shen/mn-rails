# 标准插件(打包项目)开发模板

用于MarginNote4的标准插件工程模板(输出`.mnaddon`)。

## 开始开发

安装依赖：

```bash
pnpm install
# 或(使用npm时)
npm install
```

打包调试包(不压缩，适合频繁迭代)：

```bash
pnpm dev
# 或(使用npm时)
npm run dev
```

打包发布包(先压缩再打包)：

```bash
pnpm build
# 或(使用npm时)
npm run build
```

在MarginNote4中导入生成的`.mnaddon`并启用即可。

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
