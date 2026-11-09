# 工程定位

本项目是 Marginnote 5 （简称MN）的插件开发工程。页面运行于 MarginNote 的网页面板中。vite 配置中已经配置了插件的形态：面板形态（panel）没有Objective-C原生模块，混合形态（hybrid）另有 JavaScriptCore 入口。

# 开发流程

1. 查阅文档，确认 MarginNote 的接口与模板写法。
2. 先完成布局设计，再修改页面，不要线性堆叠控件。
3. 编写页面或原生模块，实现所需功能。
4. 运行 `pnpm check`，执行 ESLint 与类型检查。
5. 运行 `pnpm build`，构建 Vite 项目。
6. （仅 MacOS）运行 `pnpm sync`，构建产物安装到本机 MarginNote，应用随后重启。
7. 要求用户在 MN 中将插件添加到模态中并告知添加到的模态。得知插件所在场景模板和模态后进行测试。

# 工程结构

```text
├── index.html          面板入口
├── mnaddon.json        插件清单
├── src/                页面代码
├── public/             原样复制的静态资源
├── template/           场景模板配置
├── eslint/             当前框架的 ESLint 规则
├── native/             （Optional）混合形态的原生模块
└── vite.config.ts      Vite 配置
```

`mnaddon.json` 声明插件标识、名称、版本、入口与事件。`template/template.json` 决定插件在场景界面中的入口，`template/localizations.json` 提供场景模板名称的本地化内容。`native/` 目录只出现在混合形态中，纯面板形态不包含该目录。

# 开发细节

## 按开发任务查找改动文件

### 读取与写入数据

数据请求集中在数据模块中，工程自带的示例模块为 `src/topic.ts`。页面组件读取数据模块返回的结果。页面调用 `mn.api("/ui-state")` 读取当前打开的学习集，返回值的 `state.topicid` 为学习集标识；页面使用该标识读取卡片列表，路径为 `/study-sets/<学习集标识>/tree?sort=document`。`mn.api` 失败时返回带有 `error` 字段的响应体，业务代码先检查该字段。可调用的接口受白名单限制，取值以 `/capabilities` 的返回结果为准。

### 接收事件

事件名先写入 `mnaddon.json` 的 `events` 数组，页面随后才能收到 MarginNote 的推送。事件名写入 `events` 数组之后，`mn.on` 的监听才会生效。页面调用 `mn.on` 注册事件回调，参数为事件名与回调函数。同一事件与同一张卡片在一秒半以内的重复推送，MarginNote 直接忽略。页面加载完成之前推送的事件进入队列，加载完成后统一发放。可用的事件名、返回值与触发条件见文档站的“事件系统”一节。

### 卡片菜单命令

卡片菜单命令在 `mnaddon.json` 的 `cardCommands` 数组里声明，每条命令带有一个标识。模板在 `template/template.json` 的 `selectionMenu.cards` 中写入代号 `addon.<插件标识>.<命令标识>:`，代号末尾的冒号不可省略。插件声明命令与模板写入代号都要完成，菜单上才会出现该条目。`when` 字段限定命令出现的卡片范围，例如 `hasExcerpt` 与 `hashtag`。代号拼写错误时，MarginNote 静默忽略，界面不给出提示。

### 工具条按钮

插件的图标写在 `mnaddon.json` 的 `icon` 字段。MarginNote 依据该字段生成代号 `addon.<插件标识>.primary`，表示插件胶囊按钮。在模板 `bottom.modes[].tools` 中写入该代号，工具条上才会出现插件按钮。插件标识同时写入模板的 `plugins` 数组。代号拼写错误时，MarginNote 静默忽略该条目。  
由于目前缺乏模板的自动化安装手段，所以效率起见，建议由用户在 MN 里手动添加插件到模态，插件在安装后会自动提醒用户进行添加。

### 模板放行与配置

模板的 `plugins` 数组是白名单，取值来自插件的 `addonid`。`plugins` 数组写入了插件标识，场景界面才显示该插件的入口。`pluginConfigs` 以插件标识为键，值是模板交给该插件的配置。页面调用 `mn.api("/immersive/template")` 读取当前模板放行的插件列表与各插件的配置；响应中的 `available` 为假时表示取不到模板，原因写在 `reason` 字段。工具条按钮的代号为 `addon.<插件标识>.primary`，该代号写入 `bottom.modes[].tools`。代号拼写错误时，MarginNote 静默忽略该条目。

### 原生能力

混合形态的工程带有 `native/` 目录，入口文件为 `native/main.js`。`native/main.js` 运行在 JavaScriptCore 环境中，JavaScriptCore 环境不提供浏览器接口。`native/PanelBridge.js` 创建网页面板，`native/main.js` 用 `JSB.require("PanelBridge")` 载入该模块。页面调用 `mn.call` 发出请求，`native/main.js` 中的 `panel.onMessage` 接收请求。`onMessage` 的返回值序列化之后作为 `mn.call` 的结果返回页面，返回值必须可以序列化为 JSON。原生模块使用 `JSB.require` 组织依赖，不使用 `import` 与 `export`。

## 面板尺寸与模式

`mn.fit` 负责适配面板高度，适配对象为页面内容的高度，内容变化之后再次调用。`mn.height` 修改页面高度，没有动画。`mn.size` 同时修改面板宽度与高度，面板宽度只能由 `mn.size` 修改。`mn.mode` 只修改面板模式的标记，不改变面板尺寸。面板模式的取值为 `workspace` 或 `mini`，样式按 `html` 元素的 `data-mode` 属性区分。面板顶部有一条高度为 36 像素的拖拽条，拖拽条高度可以读取 CSS 变量 `--mn-drag-h`。

# 工程命令

- `lint` 运行 ESLint 与当前框架的推荐规则。
- `typecheck` 运行当前框架的类型检查。
- `check` 依次运行 ESLint 与类型检查。
- `build` 调用 Vite 构建页面，执行上述检查。
- `package` 生成 `.mnaddon` 与 `.mntemplate` 安装包。
- `sync` 将已构建产物安装到本机 MarginNote，并重启应用；`sync` 只在 macOS 上可用。
- `doctor` 检查 Node、包管理器、工程清单、产物与 MarginNote 环境。

# 工程要求

优先使用成熟的开源库，缺少可用库时再自行实现。避免自己重复造轮子、绘制已有资源。
改动时适时拆分文件，保持模块边界清晰。

进行 UI 创建和改动时
需遵守（所有都要遵守，否则继续修改直至满足条件）：
1. UI 改动前先完成/修改设计稿
2. 设计稿拥有合理网格系统：❌摆放控件时忘记考虑和其他组件的关系和间距 ✅控件按统一列宽和间距对齐 ✅按照平面设计规范平衡占用和留白
3. 界面以示能为主导，避免非必要意符：❌在普通文本旁增加无功能装饰文字、统计数据 ✅可拖动区域显示拖动手柄
4. 人机交互需要合理便捷
5. 界面无信息堆叠
6. 不得出现 3 级及以上的框架嵌套

鼓励：
1. 采用低认知负荷设计：主要操作突出，次要信息按需展示
2. 采用直觉式设计：不需要文本说明，只看 UI 元素就能知道用途
3. 使用清晰的主次视觉层级
4. 使用一致的控件样式
5. 在操作位置就近展示提示
6. 在合适的时间和位置仅展示**必要**的信息

不鼓励：
1. 默认展开全部高级设置
2. 使用无标签图标表达关键操作
3. 仅用隐藏手势作为唯一操作方式
4. 使用需要额外说明才能理解的操作
5. 使用装饰性元素干扰主要操作
6. 除列表外，使用线性堆叠 UI 元素导致用户需要滚动才能操作
7. 避免同时显示过多信息影响用户选择
8. 使用对用户决策无效的数据：如阅读时翻译插件只需要翻译，并不需要展示翻译了多少，还差多少没翻译

# 文档与问题反馈

调试小技巧：mn.api()的可用 API 是由 Marginnote CLI 裁剪而来，因此可以使用 Marginnote CLI 进行 API 实测，会得到相同的结果。如果用户没有配置强烈建议配置一下。

文档站地址为 `https://dev.marginnote.com.cn`，用于人工查阅。文档站提供 `https://dev.marginnote.com.cn/llms.txt`，供人工智能工具读取。工程根目录的 `.mcp.json` 配置了 `mn-docs` 服务，支持项目级 MCP 配置的客户端直接读取 `https://dev.marginnote.com.cn/mcp`。

开发过程中发现文档表述不清、内容错误或内容缺失时，请提交 issue 到 `https://github.com/Temsys-Shen/marginnote-extension-docs`。提交之前检索已有 issue，避免重复提交。issue 正文写明涉及的页面地址、原文引用、问题类型与期望行为。
