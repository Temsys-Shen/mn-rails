# Web插件开发模板

用于MarginNote4的Web插件工程模板。模板内置React+Vite前端与WebView面板桥接，产物仍输出`.mnaddon`。

## 开始开发

安装依赖：

```bash
pnpm install
# 或(使用npm时)
npm install
```

开发模式：

```bash
pnpm dev
# 或(使用npm时)
npm run dev
```

说明：启动Vitedevserver。修改`web/`下前端代码时由Vite自己reload；修改`src/`下插件代码时会自动重新部署插件并重启MarginNote。

## 打包发布

执行`build`会先运行Web构建，把Vite产物输出到`src/web-dist`，再打包成`.mnaddon`：

```bash
pnpm build
# 或(使用npm时)
npm run build
```

## 桥接协议

Web页面与插件层按以下结构通信：

- `command`：命令名
- `requestId`：请求ID
- `payload`：命令参数
- `error`：错误对象

模板示例使用URL拦截桥接：

- Web调用`MNBridge.send(command,payload)`
- 插件侧在`webView:shouldStartLoadWithRequest:navigationType:`中解析`mnaddon://bridge?...`

## 面板交互

- 插件面板采用浮动窗口，挂载在`studyController.view`上
- 标题栏拖拽可移动窗口
- 右下角拖拽可缩放窗口
- 标题栏双击可最大化/还原
- 右下角双击可居中窗口
- 窗口位置与大小会保存到`NSUserDefaults`键`mn_web_template_frame_config`

## 目录说明

- `src/`：插件代码与打包根目录
- `src/WebPanelController.js`：浮动面板UI、页面加载与URL scheme入口
- `src/WebBridgeCommands.js`：bridge命令函数定义，命令名必须与前端`command`字段一致
- `src/web-dist/`：发布期静态前端产物目录
- `web/`：React+Vite源码目录
- `web/src/lib/mnBridge.js`：前端bridge SDK入口，页面和组件直接从这里import

## 注意事项

- 插件运行在JavaScriptCore环境中，不是浏览器环境
- 只允许在`src/main.js`中调用`JSB.require(...)`
- 新增bridge命令时，只需要在`src/WebBridgeCommands.js`里增加同名函数并导出到命令表
- 前端调用插件命令时，统一从`web/src/lib/mnBridge.js`引入`MNBridge`
- 若`src/web-dist/index.html`缺失，插件将直接报错并提示重新执行`build`
- MarginNote插件共享全局上下文，模板已对全局符号做前缀隔离；新增脚本时不要在顶层声明通用名常量或函数

## 常见排查顺序

- 先执行`pnpm dev`或`npm run dev`进入联调模式
- 修改`web/`下文件时观察Vite是否正常reload
- 修改`src/`下文件时观察插件是否重新部署并重启MarginNote
- 若要离线验证，执行`pnpm build`或`npm run build`确认`src/web-dist/index.html`已生成
