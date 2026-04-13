# mn-rails

用于快速创建MarginNote4标准插件(打包项目)工程的脚手架。内置 `AGENTS.md`作为AI辅助开发Prompt，建议使用Codex、Trae等支持新的通用协议的开发工具进行开发。如果您使用AI进行开发，强烈建议首先安装[MCP](https://github.com/Temsys-Shen/marginnote-addon-docs?tab=readme-ov-file#本地mcp搜索)

## 创建项目

在目标目录运行：

```bash
npx mn-rails
```

按提示输入 `addonid/author/title`等信息后会生成项目目录。

## 更新已有项目模板

在已有项目目录运行：

```bash
npx mn-rails update
# 或全局安装后
mn-rails update
```

会同步以下内容到当前项目：

- 覆盖更新`AGENTS.md`
- 覆盖更新模板`scripts`目录下的脚本文件
- 覆盖更新`package.json`中由模板管理的`scripts`键

保留策略：

- 保留用户自定义的`package.json scripts`键
- 保留`scripts`目录下不在模板中的用户自定义文件

## 下一步

进入项目目录：

```bash
cd <your-project>
pnpm i
pnpm dev
# or
npm i
npm run dev
```

更多用法与打包/发布流程见生成项目内的 `README.md`。

# 注意事项

- 目标目录必须为空目录，否则会中止生成
- 若检测到git可用，会自动 `git init`并创建一次初始commit；否则跳过
