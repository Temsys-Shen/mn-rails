# MarginNote 面板插件工程约定

这个工程由 `mn-rails@2` 创建。页面运行在 MarginNote 的网页面板中，纯面板形态没有原生模块，混合形态另有 JavaScriptCore 入口。

## 构建边界

- Vite 负责页面构建。
- `mnRails()` 只复制清单、图标与原生模块，并检查构建产物。
- 需要改动打包行为时，修改 Vite 配置或 `mn-rails`，不要在业务代码中复制构建逻辑。
- `npm run build` 对应 `mn-rails build`，不要新增 `dev` 脚本。

## 页面规则

- 页面入口固定为 `index.html`，清单中的 `panel` 字段必须指向这个文件。
- Vite 的 `base` 固定为 `/pkg/`，脚本、样式、图片与字体都保留为独立文件。
- 页面引用以 `/pkg/` 开头，不使用相对路径、`data:` 地址与包外地址。
- 不使用内联脚本、内联样式、HTML 事件属性与 `style` 属性。
- 不使用 `eval`、`new Function` 与字符串形式的定时器。
- Vite 的每个构建入口都必须写入页面，脚本的模块图与构建清单一致。
- `mnaddon.json` 必须声明 `"immersiveOnly": true`。
- 背景写在 `html` 元素上，顶部留出 `--mn-drag-h` 对应的拖动区域。

## 数据与事件

- 读取当前学习集使用 `mn.api("/ui-state")`，读取卡片列表使用 `/study-sets/<id>/tree?sort=document`。
- `mn.api` 的错误通过响应中的 `error` 字段返回，业务代码必须检查这个字段。
- 事件名必须写入 `mnaddon.json` 的 `events` 数组。
- 卡片命令必须写入 `mnaddon.json` 的 `cardCommands` 数组，并在 `template/template.json` 的 `selectionMenu` 中登记。
- 页面不保存学习集状态，每次操作前重新读取当前学习集。

## 插件形态

- 纯面板产物不得包含根目录的 `main.js`。
- 混合形态必须包含 `native/main.js` 与 `native/PanelBridge.js`。
- 只有 `main.js` 可以调用 `JSB.require`。
- `PanelBridge.js` 的 `onMessage` 必须返回可 JSON 化的值。
- 原生模块改动后运行 `mn-rails build`，产物审计会检查入口与模块边界。

## 文档来源

MarginNote 接口以当前安装的版本与本地接口文档为准。实现前先核对 `mnaddon.json`、`/pkg/`、`window.mn` 与场景模板的实际契约。
