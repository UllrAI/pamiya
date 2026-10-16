[English](../en/README.md) · **简体中文**

# Pamiya 架构文档

Pamiya 面向长期承担用户目标的 Personal Agent，将控制循环、持久化状态和异构执行网络分开。目标方案是：**逻辑集中管理的 Control Plane、持久化 State Plane、异构 Execution Network，以及跨协议的能力发现与路由层。** MQTT 优先连接远程 Worker；普通工具调用和远程 Agent 委托共用任务管理，但保留各自的执行语义。

设计基线：0.1 · 2026-10-14。本组文档描述架构提案；已实现的 DSH 插件另见[安装与使用](dsh-plugin.md)。首版按最小闭环实施，条件增强项按实际需求启用。

## 阅读顺序

| 文档 | 回答的问题 | 主要读者 |
|---|---|---|
| [01 架构形态与设计决策](architecture-patterns.md) | 为什么选择三层分离，MQTT 是否合适 | 产品负责人、架构评审者 |
| [02 平台架构与核心模型](platform-architecture.md) | 各模块负责什么，状态属于谁 | 平台与后端开发者 |
| [03 能力发现与通信协议](capabilities-and-protocol.md) | 如何发现、授权、寻址和调用 Worker 或 Agent | 协议与 SDK 开发者 |
| [04 可靠执行与故障恢复](reliability.md) | 如何处理重复、断线、重启、取消和未知结果 | Runtime 与 Worker 开发者 |
| [05 技术选型与实施路线](technology-and-roadmap.md) | BifroMQ、Tenon、ESP32 和标准协议怎样落地 | 技术负责人、实施团队 |
| [06 架构评审与实现约束](scope-and-decisions.md) | 哪些是首版必需，哪些属于过度设计或条件增强 | 评审者、开发与测试负责人 |

先阅读 01、02 可以掌握整体方向；进入开发前应同时阅读 03、04。05 列出交付顺序，06 汇总复杂度取舍。全组的“首版”统一采用 [首版实现基线](architecture-patterns.md#首版实现基线)，不能把条件增强项累计成首版门槛。

## 关键判断

1. Personal Agent 是长期目标和职责的主体，Harness 是推进模型与工具循环的实现。平台身份保持稳定；副作用工具必须受 Task Runtime 管理，不能截获的 Runtime 采用委托接入。进行中的厂商会话迁移需要单独验证。
2. State Plane 保存平台权威状态；Broker 保存的消息和 MQTT Session 不能代替 Agent Session、Task 或业务执行记录。
3. Worker 提供执行能力，Environment 表示具体工作现场，Device 表示物理资产。三者分别建模。
4. Capability Registry 统一描述和索引能力。Harness 通过授权后的工具接口使用能力，无需理解 MQTT Topic。
5. Tool Execution 接受具体操作，Agent Delegation 接受目标或子任务。第三方 Agent 可以拥有自己的 Harness 和内部状态。
6. 首版保存任务意图、执行轮次、业务结果与取消记录，按 Session 和设备串行处理，未知重要副作用先核对。使用任务表与 Dispatcher 即可；跨节点资源 fencing、续租、签名授权和自动灾备恢复按触发条件增强。
7. Always-on 通过可信事件、确定性规则和按需唤醒实现，模型无需持续运行。
8. BifroMQ 是优先评估的 MQTT Broker；Tenon 是可选事件集成组件，不承担核心任务耐久性。

## 文档中的事实与提案

数据模型、Topic、JSON 消息、状态名和阶段划分是**平台设计提案**，不宣称兼容某个外部标准。采用 A2A、MCP 或其 MQTT 扩展时，应由 Adapter 按锁定版本转换，不能直接拿内部示例充当标准报文。

第三方技术的具体能力采用相邻的官方来源链接。Dot 与 Codex 的产品关系用于说明委托模型；它不构成对 OpenAI 内部部署或通信协议的判断。ESP32 的摄像头与 MQTT 能力属于目标扩展，不能当作原开源项目已实现的功能。

[DSH 插件安装与使用](dsh-plugin.md)。

[用户上手与安装](quickstart.md) · [交给 DSH 的安装任务](install-with-dsh.md)。

[Agent、模型复用与自定义动作](agent-workers.md)。

[Skills：按需同步与准备](skills.md)。
