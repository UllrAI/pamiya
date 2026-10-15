# 开源基座选型与复用边界

[索引](README.md) · [English](../en/open-source-foundation.md)

评审日期：2026-10-15。结论：**Pamiya 不应从零重建通用 Agent 产品。优先验证 DSH 的完整 Web/桌面产品组合，通过 preset、主题和插件增加 Pamiya 的体验与远程能力。** 这是源码与契约层面的推荐，尚未完成运行验证或迁移。

此前 `prototype/` 的作用是验证体验。它不是生产运行时的起点，也不应因为已经写了演示 UI，就要求后端、会话系统和执行循环都自行实现。

## 候选比较

| 项目 | 已核实的复用价值 | 适合 Pamiya 的方式 | 限制与判断 |
|---|---|---|---|
| [DeepSeek Harness / dsh](https://github.com/deepseek-ai/deepseek-harness) | MIT；模型、Agent 循环、会话、工具、持久化与 UI 都有插件边界，已有 Electron 桌面壳 | **优先候选**：继承完整产品，配置个人 Agent preset，复用 UI 与 Host，再扩展远程执行 | 仍为 developer preview；本次源码版本是 `0.2.1-alpha.4`，上游明确说明会破坏兼容，必须固定版本验证 |
| [Pi](https://github.com/earendil-works/pi) | MIT；可嵌入 SDK、工具、Session、steer/followUp、事件与中止接口 | 更适合需要完全自主产品壳时的轻量 Harness 候选 | 要自行承担产品壳和 Host 组合；新 `pi-durable` 明确为实验 API，不能仅因已有稳定 CLI 发布就假定所有模块稳定 |
| [OpenCode](https://github.com/anomalyco/opencode) | MIT；已有编码 Agent、Web/桌面客户端、客户端/服务端及 SDK 接口 | 如果近期核心是软件开发，可直接改造现有产品 | 编码工作区的心智较强；现有 App 使用 Solid，与当前 React 原型并非可直接拼接的同一组件系统 |
| [OpenClaw](https://github.com/openclaw/openclaw) | MIT；个人助理 Gateway、多渠道、记忆、插件与设备节点 | 当多入口、长期运行和个人助理能力比界面改造更优先时重点考虑 | 覆盖面较广，需要按 Pamiya 首版裁剪；不能因功能多就把全部渠道和配置都带入首页 |

上述许可均核对官方 LICENSE/仓库元数据，不以搜索摘要代替。AionUi 根许可证为 Apache-2.0，不列作 MIT 候选。发布标记也不等于模块兼容保证；本次未基于星数判断成熟度。

## Pamiya 能否直接作为 DSH 插件

**可以，且建议把“DSH 上的 Pamiya 扩展包”作为首个验证形态，先不维护独立 fork。** DSH 基于 Cordis，支持外部插件、bundle/profile 组合、Agent preset、客户端插槽和插件自有存储域。这提供了明确的接入面；尚不代表 Pamiya 的接入已通过运行验证。

| 部分 | 推荐归属 |
|---|---|
| 对话、模型循环、上下文、工具执行框架、Session 日志 | 直接由 DSH 提供 |
| 个人 Agent 默认指令、能力选择与工作方式 | Pamiya preset；不另建一套 Agent 循环 |
| 远程资源发现、绑定、工具分派、Task/Attempt 与结果确认 | Pamiya Host 插件；只管理远程业务事实 |
| 资源选择、连接配置、工具状态/成果入口 | 同包的客户端插件，通过现有插槽与组件呈现 |
| 云端、电脑、设备上的实际执行 | 独立 Worker，按需要部署；不因叫插件就塞进 DSH 进程 |
| 品牌与首页大改、独立安装包 | 可选产品发行层，按真实需求再做；首版不以它为前提 |

首版一个扩展包即可包含 Host 插件、客户端入口及组合配置，不先拆成一组 npm 包、插件市场或新的管理后台。主链路是：**DSH 对话 → Pamiya 注册工具 → Worker 执行 → 结果回到同一对话**。第一次只接一个 Worker 和一个有用工具；不强迫用户先理解 MQTT、Task 或控制平面。

存储也先收敛：聊天历史仍由 DSH 保存；单 Host 下的 Pamiya 资源与任务事实可先验证 DSH 的 `storageDomain` 配合现有 SQLite 后端。它提供域内写入顺序和单次持久化，不等于跨域事务、多个 Host 并发调度或跨进程通知。只有部署确实需要集中式调度时，再引入独立服务/数据库。架构文档中的 PostgreSQL/MQTT 是分布式部署方案，不应成为安装插件的必备整套设施；接入后需同步明确部署档位与数据归属。

客户端插槽可承载扩展，主题可覆盖 alias token，DSH 自身也有字号设置（默认正文 14 px）。这不保证所有品牌位置、任意导航重排和首页替换都已开放。先保留原生界面验证能力；若未来需要独立 Pamiya 产品，再决定少量 UI 插件替换或发行层改动。

这种形态下，**Pamiya 是可安装的 Agent 能力产品，DSH 是宿主；Worker 是执行端。** 不重复建设模型循环、聊天壳、Session 权威日志和通用调度器。普通工具先考虑现有工具/MCP 能否满足；需要 DSH 生命周期、持久任务与界面协作的部分才使用原生插件。

依据：[插件与组合架构](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/architecture.md)、[UI 插件入口](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/preset/agent-preset/skills/cordis-plugin-development/references/ui-plugin.md)、[Storage](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/subsystems/storage.md)、[主题与字号](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/client/ui-theme/README.md)。

## DSH 具体复用什么

- **产品与客户端：** Web/桌面壳、侧栏、对话、流式显示、文件/工具呈现和现有组件。用 Pamiya 品牌与主题收敛界面，避免照着截图重新写一套组件库。
- **通用 Harness：** 模型适配、Agent 循环、上下文与压缩、skills、工具注册、输入队列和取消机制。Pamiya 用个人 Agent preset 配置默认能力，不默认把编程项目当作所有人的工作入口。
- **状态与恢复：** 优先保留上游 Session 日志与持久化边界；Pamiya 仅保存自己额外拥有的业务事实。不要同时维护两套权威聊天历史、规划器和重试循环。
- **持续安排：** 优先复用上游已有的 Host 级持久提醒服务，而不是把原型本地 tick 改成另一套生产调度器。

这是复用范围判断，具体插件替换与品牌槽位需通过 PoC 验证。先采用上游公开扩展面；不能满足的产品入口才做有限 fork，内核修改单独记录原因。原型继续保留为体验规格与验收参考。

## Pamiya 仍需补充什么

产品差异在于：长期个人目标与职责的体验、跨云端/电脑/Edge/设备的资源选择、远程执行的可靠性，以及成果的持续协作。已有能力能满足的部分仍复用。

首个扩展只做一条完整远程工具链：上游 Tool 注册 → Pamiya 任务持久化 → 一个 Worker → 结果确认 → 返回原对话。稳定工具调用/动作 ID、Task/Attempt、绑定资源与重要未知结果是远程链路的业务事实；MQTT 在线状态不能代替能力就绪。

使用注册工具的执行函数作为远程分派入口；`tools/pre-execute` 与 `tools/execute` 用于授权和执行观察，不能绕过上游 guards。源码中的调用身份不可被 around-dispatch 包装器改写，`AbortSignal` 传播也不能当成远端动作已确认停止。PTC 子调用、子 Agent 和本地工具需要分别验证覆盖面，不能宣称一个 hook 已接管一切副作用。

## 必须先对齐的行为差异

| 事项 | 上游已核实行为 | Pamiya 接入决策 |
|---|---|---|
| 完成判断 | SDK `run()` 收集到整个 Agent 下一次 idle；最终回复未必只由某条输入导致 | 保留消息回执/Session/turn 关联，按目标证据判断完成，不直接映射一个 SDK run 为业务成功 |
| 提醒与运行模式 | schedule 依赖 Web Host 的 Session controller、持久化及 flush 确认，不能独立挂到纯 SDK/headless 组合 | 想复用完整产品就从 Web Host 组合验证，不选最小 SDK 后再重建 Host |
| 错过触发 | 周期提醒合并最近一次错过的发生点 | 现有规格是跳过；接入前明确是否采用上游合并，并同步修改文案与验收，避免悄悄变更 |
| 归档与提醒 | 有活跃提醒时拒绝归档；停止提醒会删除对应记录 | 与 Pamiya 可恢复归档/暂停语义不同，验证上游扩展是否足够，避免用删除伪装暂停 |
| 取消 | 本地取消传播与进程退出不证明远程重要动作未发生 | Worker 回执及业务查询保留在远程执行适配层 |
| 隔离与授权 | 一个本地 Host 的资源边界不等于多租户服务 | 首先验证单用户部署；需要服务多人时再确定 Host/环境与凭据的隔离方式 |

这些是明确兼容性检查，不意味着先建设通用策略引擎、多活接管或全局事务系统。

## 最小验证与采用门槛

1. 固定 DSH 提交或发布包，运行原生产品，换成 Pamiya preset/主题；验证消息、工具、文件、持久化和取消，不先做新壳。
2. 接一个 Worker，走通工具调用、断线重连、重复消息、结果确认与停止；核对未知已提交效果不会被重放。
3. 验证成果继续修改、上游升级保留状态，以及提醒/归档的语义选择。需要修改上游内核的点必须列出；若大量核心行为无法通过插件接入，再与 Pi/OpenClaw 比较迁移成本。

以上三步通过后才能把“首选候选”改为“已采用”。本轮没有安装或运行 DSH 模型、执行其构建脚本、复制源码到生产目录，或用假集成替换现有原型。

## 许可证与来源

DSH 的 [MIT LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/LICENSE)要求分发相应副本/重要部分时保留版权和许可文本；依赖按[第三方声明](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/THIRD_PARTY_NOTICES.md)逐项处理。Pamiya 使用自己的名称与视觉，不继承官方鲸鱼标志或暗示官方背书，参见[品牌说明](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/BRAND_GUIDELINES.md)。当前仓库仍为 Apache-2.0；这里只做评审，没有导入上游代码，不更改项目许可。

源码快照：DSH `86a402200d95fecef4529d969836f1fe13c6cb0d`；Pi `eddebaeebf8168dfc31d6712b7a021e4df3b4e6a`；OpenCode `81200db2a3a86fc72a60dff996557f59865a6f24`；OpenClaw `824fde2bfab6f335ba493819c804339c538abcca`。Pi 最新非预览发布为 `v1.2.0`，OpenCode 为 `v1.19.0`，OpenClaw 为 `v2026.10.3`；DSH 的 GitHub latest release 接口当时未返回非预览发布。快照与发布时间只说明所评审版本，不代表已跑通这些项目。

主要契约：[DSH 架构](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/architecture.md)、[工具执行管线](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/tool-execution-pipeline.md)、[SDK](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/sdk/client/README.md)、[schedule](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/schedule/schedule/README.md)、[Pi SDK](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/packages/coding-agent/docs/sdk.md)、[Pi durable](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/packages/durable/README.md)、[OpenCode Server](https://opencode.ai/docs/server/)。

其他许可依据：[Pi](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/LICENSE)、[OpenCode](https://github.com/anomalyco/opencode/blob/81200db2a3a86fc72a60dff996557f59865a6f24/LICENSE)、[OpenClaw](https://github.com/openclaw/openclaw/blob/824fde2bfab6f335ba493819c804339c538abcca/LICENSE)、[AionUi](https://github.com/iOfficeAI/AionUi/blob/main/LICENSE)。
