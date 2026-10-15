# Pamiya 交互原型 / Interactive prototype

[中文产品文档](../docs/product/zh-CN/README.md) · [English product documents](../docs/product/en/README.md) · [Design QA](design-qa.md)

一个以对话和自主推进为主线的现代个人 Agent 原型。首页遵循已确认的[视觉参考](design/selected-home.png)，不以任务管理或基础设施后台作为产品入口。

## 本地运行

```sh
cd prototype
npm ci
npm run dev -- --host 127.0.0.1 --port 4188 --strictPort
```

打开本地 4188 端口。执行 `npm test`、`npm run format:check` 和 `npm run build` 验证模型行为、格式与构建；`npm run test:sites` 校验模板自带的静态托管适配。未部署公网。

## 可以体验

- 提出目标、执行中补充方向、查看活动和停止。
- 预览/编辑/下载成果、查看历史版本、继续迭代；人工编辑与新版本冲突时提示保留双方版本。
- 搜索、重命名和可恢复归档；附件与 `@` 引用上下文。
- 工具连接、缺信息、读取失败和未知提交回执的演示。
- 简单每日/每周安排、下一次发生时间、暂停/恢复、模拟触发及执行记录。
- 显式记忆管理、撤销与本地数据导出；手机与平板布局。

点击页面“原型预览”或“更多 → 体验演示”进入场景。Enter 发送，Shift+Enter 换行，⌘/Ctrl+K 搜索；Escape 退出弹窗。

## 模拟边界

模型、工具、网页检索、工作区与通知提交均为本地确定脚本。任意目标只生成示例产品文档，后续修改以追加段落模拟，不代表真实智能处理。不会发送消息、访问真实工作区、连接设备或自动运行后台安排。记忆只演示管理。

数据保存在当前浏览器 localStorage，无账号或云同步。刷新会明确中断模拟执行，并保留继续入口；重要已提交效果仍进入核对。附件单文件不超过 5 MB，文本最多保留 20,000 字符；其他文件只保存信息，明确未解析。不要依赖此原型作为真实数据备份。默认字体使用系统字体，Inter 可从 Google Fonts 加载；消息与附件内容不因此被发送。

源码：`src/model.mjs` 为可测试的状态转换，`src/App.jsx` 为应用交互，`src/ui.jsx` 为少量共享控件，`src/styles.css` 为视觉规范。没有生产 Agent 运行时。

---

A modern personal Agent prototype centered on conversation, autonomous work, and useful artifacts. It follows the approved [home reference](design/selected-home.png), with task/infrastructure administration outside the primary experience.

Run the commands above with a compatible Node/npm installation. The local preview uses port 4188. `npm test`, `npm run format:check`, and `npm run build` verify state behavior, formatting, and build output; `npm run test:sites` checks the starter's static-hosting adapter. No public deployment is created.

Working flows include goals and steering, activity and stop, artifact editing/download/version history, conflicting-edit notice, search/rename/recoverable archive, text attachments and explicit context selection, demo connection/clarification/retry/reconciliation, schedules and manual trigger, explicit memory management/undo, data export, and phone/tablet layouts.

Use “原型预览” or “更多 → 体验演示” for scenarios. Enter sends, Shift+Enter inserts a line, ⌘/Ctrl+K searches, and Escape dismisses dialogs.

Models, tools, search, workspaces, and notification submission are deterministic local simulations. Arbitrary goals produce an example document; follow-ups append revision text. No real message, device, resource access, or background schedule executes. Memory only demonstrates management.

Browser localStorage retains content; there are no accounts or cloud sync. Refresh explicitly interrupts local simulation, while uncertain submitted effects remain subject to reconciliation. Files are capped at 5 MB and 20,000 text characters; non-text files retain metadata and remain visibly unparsed. This is not production backup. System fonts are the default fallback; Google Fonts may supply Inter without receiving message/file contents.

`src/model.mjs` contains tested state transitions, `src/App.jsx` application interactions, `src/ui.jsx` a few shared controls, and `src/styles.css` visual rules. This is not a production Agent runtime.
