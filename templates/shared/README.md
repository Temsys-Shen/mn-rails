# __PROJECT_TITLE__

这个工程由 `mn-rails@2` 创建，使用现代前端框架开发 MarginNote 网页面板。

## 开始使用

```bash
__INSTALL_COMMAND__
```

可用命令：

```bash
npm run check
npm run build
npm run package
npm run sync
npm run doctor
```

使用 pnpm 时，同步脚本可以直接运行 `pnpm sync`。使用 yarn 或 bun 时，命令对应改为 `yarn run sync` 或 `bun run sync`。

## 命令职责

- `check` 运行当前框架的类型检查。
- `build` 调用 Vite 构建页面，并检查插件目录与 `/pkg/` 引用。
- `package` 生成 `.mnaddon` 与 `.mntemplate`。
- `sync` 把 `dist` 安装到本机 MarginNote，并重启应用。
- `doctor` 检查 Node、包管理器、工程清单、产物与 MarginNote 环境。

## 工程结构

```text
├── native/              # 混合形态的原生模块
├── public/              # Vite 原样复制的静态资源
├── src/                 # 页面代码
├── template/            # 场景模板配置与本地化文件
├── index.html           # 面板入口
├── mnaddon.json         # 插件清单
└── vite.config.ts       # Vite 与 mn-rails 插件配置
```

页面引用必须使用 `/pkg/` 开头的绝对路径。Vite 已配置固定文件名与关闭资源内联，业务代码不要改写这些约束。

`public/` 中的文件会复制到构建产物根目录。`mnaddon.json` 的 `icon` 字段写产物根目录中的路径，例如 `"icon": "icon.png"`。
