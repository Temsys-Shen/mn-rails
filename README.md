# mn-rails

`mn-rails` 是 MarginNote 网页面板插件的脚手架。页面由 React、Vue 或 Svelte 与 Vite 构建，`mn-rails` 负责校验构建产物、整理插件目录、打包与部署。

当前版本为 `2.0.0`。这个版本与 `1.x` 不兼容，不提供旧模板迁移，也不提供 `update` 命令。

## 能力

- 支持纯面板与混合形态。
- 提供 React 19、Vue 3、Svelte 5 的 TypeScript 模板。
- 生成工程内置 `build`、`package`、`deploy`、`doctor` 与 `check` 命令。
- 同时支持 npm、pnpm、yarn 与 bun。
- 构建产物中的脚本、样式、图片与字体全部通过 `/pkg/` 引用。
- 混合形态保留 `main.js`，并由脚手架检查 `main.js` 与 `PanelBridge.js` 的边界。

## 创建工程

```bash
npm create mn-rails@latest
pnpm create mn-rails@latest
yarn create mn-rails
bun create mn-rails
```

也可以直接调用命令行接口：

```bash
npx mn-rails@latest init my-addon
pnpm dlx mn-rails@latest init my-addon
```

创建命令会询问框架、插件形态、插件名称、插件标识、作者与包管理器。不需要交互时，可以直接传入参数：

```bash
npx mn-rails@latest init my-addon \
  --framework react \
  --kind panel \
  --addonid com.example.my-addon \
  --author Example \
  --title 我的插件 \
  --package-manager pnpm \
  --no-git
```

`--kind panel` 创建纯面板工程，`--kind hybrid` 创建面板与原生模块组成的混合形态工程。

## 工程命令

```bash
pnpm check
pnpm build
pnpm package
pnpm deploy
pnpm doctor
```

这些脚本分别映射到 `mn-rails` 的对应命令。`build` 调用 Vite 构建页面，随后检查产物；`package` 生成 `.mnaddon` 与 `.mntemplate`；`deploy` 把构建产物安装到本机 MarginNote 并重启宿主；`doctor` 检查工程、构建产物与宿主环境。

`mn-rails` 作为 `devDependency` 写入生成工程，版本范围为 `^2.0.0`。脚手架工具不会复制到业务工程中。

本仓库的 `create-mn-rails` 位于 `create/` 工作区。发布时先发布根包，再发布 `create-mn-rails`；发布流程会改写工作区依赖的版本。

## 页面产物规则

页面入口固定为根目录的 `index.html`。Vite 的基础路径固定为 `/pkg/`，构建产物必须满足以下规则：

- 脚本、样式、图片与字体引用以 `/pkg/` 开头。
- 不使用内联脚本、内联样式、`data:` 地址与内联事件属性。
- 不使用 `eval`、`new Function` 与字符串形式的定时器。
- Vite 的每个构建入口都必须写入页面，脚本的模块图与构建清单一致。
- 纯面板产物不含根目录的 `main.js`。
- 混合形态产物包含根目录的 `main.js` 与 `PanelBridge.js`。

构建、打包、部署与 Vite 插件使用同一套产物审计。命令名称与页面接口沿用宿主定义，脚手架不增加别名。

`public/` 中的文件由 Vite 复制到产物根目录。清单引用图标时写包根相对路径，例如 `"icon": "icon.png"`；脚手架会同时识别源目录的 `public/icon.png` 与构建后的 `dist/icon.png`。

## 混合形态

混合形态适合需要动态图标、菜单条件或其他原生能力的插件。`native/main.js` 是 JavaScriptCore 入口，其他原生模块由 `JSB.require` 载入。`native/PanelBridge.js` 创建网页面板，并通过 `onMessage` 接收页面命令。

纯面板形态没有原生入口，面板与菜单由宿主根据 `mnaddon.json` 合成。纯面板模板不展示原生通道演示。

## 模板与打包

工程包含 `template/template.json` 与 `template/localizations.json`。`mn-rails package` 生成两个文件：

- `.mnaddon`：插件目录的压缩包。
- `.mntemplate`：包含模板配置、插件文件与包清单的场景模板包。

模板的 `plugins` 白名单、`pluginConfigs` 与界面中的 `addon.<插件标识>.*` 条目由脚手架检查。

发布前运行：

```bash
pnpm pack:check
```

这条命令执行类型检查、单元测试、构建，并检查 `mn-rails` 与 `create-mn-rails` 两个发布包的内容、版本和 `bin` 映射。

生成待发布的包：

```bash
pnpm release:pack
```

这条命令调用 pnpm 打包两个工作区，把 `workspace:*` 改写为固定版本，校验包内清单与文件，并把产物写入 `release/`。`release/manifest.json` 记录文件大小、条目数量与 `sha512` 完整性。

发布由标签触发。先确认工作区干净，再执行：

```bash
git tag v2.0.0
git push origin v2.0.0
```

发布流程依次检查类型、测试、构建、包内容、标签与版本，上传 `mn-rails`，等待注册表可见，然后上传 `create-mn-rails`。两个包都使用 npm 的可信发布与 provenance 证明。发布完成后，工作流创建同名 GitHub Release，附带两个 tarball 与 `manifest.json`；重复运行发布会更新已有 Release 的附件。

`create-mn-rails` 已完成首次登记和可信发布配置。后续新增 npm 包时，仍需先完成一次人工发布，再添加指向本仓库 GitHub Actions 工作流 `publish.yml` 的可信发布者配置。

## 与旧版的关系

`mn-rails@2` 不保留 `mn-rails@1` 的 `standard`、`web` 模板，也不提供模板更新命令。旧工程需要新建 v2 工程并迁移业务代码。
