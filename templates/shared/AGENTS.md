# MarginNote 插件开发工程

本项目是 Marginnote 5 （简称MN）的插件开发工程。
页面运行在 MarginNote 的网页面板中。vite 配置中已经配置了插件的形态：面板形态（panel）没有Objective-C原生模块，混合形态（hybrid）另有 JavaScriptCore 入口。

## 文档发现

开发过程中有不确定的和 MN 相关的信息，请查阅：dev.marginnote.com.cn。该站为 AI 原生站，因此可以访问 [llms.txt](https://dev.marginnote.com.cn/llms.txt)。工程根目录的 `.mcp.json` 已配置 `mn-docs` 文档服务，支持项目级 MCP 配置的客户端可以直接读取 `https://dev.marginnote.com.cn/mcp`。

## 工程化

开发时尽可能少地手写代码，优先寻找是否有好用的开源库，如果实在无法满足需求再手写实现。

不论任何修改，都要注意适时分文件与合理的模块化，实现高内聚低耦合。

进行tsx页面改动时优先进行布局设计，然后再修改页面，不要进行线性堆积，要实现多维布局，在合理的时间展示合适的信息。UI 设计要参考《平面设计中的网格系统》

## 特别注意

- 页面入口固定为 `index.html`，`mnaddon.json`中的 `panel` 字段必须指向这个文件。
- Vite 的 `base` 固定为 `/pkg/`，脚本、样式、图片与字体都保留为独立文件。
- 页面引用以 `/pkg/` 开头，不使用相对路径、`data:` 地址与包外地址。
- 不使用内联脚本、内联样式、HTML 事件属性与 `style` 属性。
