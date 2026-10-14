[English](../en/capabilities-and-protocol.md) · **简体中文**

# Pamiya 能力发现与通信协议

平台在 Broker 之上建设能力描述、目录、发现、授权和路由。Topic 只标识通信对象与消息类型；Capability Manifest 描述可以执行什么；Scheduler 决定具体由谁执行。这个逻辑层同时支持 MQTT、HTTP、MCP 和 A2A。

以下 Topic 和 JSON 是 [首版基线](architecture-patterns.md#首版实现基线) 的内部协议提案；增强协议只在对应场景启用，对外兼容通过 Adapter 实现。导航：[阅读指南](README.md) · [核心模型](platform-architecture.md) · [可靠执行](reliability.md)

## 能力层需要回答的问题

| 问题 | 平台信息 |
|---|---|
| Who | Worker、Agent、租户、用户和设备身份 |
| What | 能力名称、语义、输入输出 Schema、版本 |
| Where | Worker、Device、Environment 及协议 Binding |
| How | 工具调用、目标委托、订阅或异步执行 |
| State | 连接、能力就绪、资源容量与任务状态 |
| Policy | 是否可发现、可调用，授权范围与审批要求 |

Registry 保存经过身份与策略校验的元数据。Resolver 返回调用者可以使用的候选能力。Router 将平台 Task 转换为具体协议。MQTT Broker 执行认证后的连接与路由，不负责解释业务能力。

## Topic 契约

建议固定命名空间 `agent/v1/{tenant_id}/workers/{worker_id}`，将协议版本和租户作用域显式写入。ID 必须经过规范化验证，禁止包含 `/`、`+`、`#` 等能改变层级或订阅语义的字符。

| 后缀 | 方向 | 内容 | 建议 QoS | Retain |
|---|---|---|---|---|
| `/manifest` | Worker → Registry | 注册或更新能力声明 | 1 | false，首版由数据库持有目录 |
| `/registration` | Control → Worker | 注册接受、拒绝或要求重报 | 1 | false |
| `/heartbeat` | Worker → Presence | boot_id、connection_id、seq、健康与执行摘要 | 0；必要时 1 | false |
| `/presence` | Worker/LWT → Presence | 连接周期内的上线、离线提示 | 1 | 可选 true，必须带 boot_id、connection_id |
| `/commands` | Control → Worker | EXECUTE、CANCEL、QUERY | 1 | false |
| `/task-events` | Worker → Result Ingest | ACCEPTED、RUNNING、终态和拒绝原因 | 1 | false |
| `/acks` | Control → Worker | RESULT_ACK 与控制消息确认 | 1 | false |
| `/events` | Worker → Event Engine | 感知或业务触发事件 | 遥测 0 或 1；耐久事件 1 加 EVENT_ACK | false |

具体能力名放在 Payload，不创建 `.../hid/click`、`.../camera/capture` 等无限扩展的命令 Topic。稳定 Topic 可以统一 ACL、版本和调度语义。

Retained 信息仅是最近一次声明或状态提示。节点撤销、所有权转移与能力删除时需要清除旧声明，并由 Registry 更新权威状态。消费者不得把 Retained online 当作当前可调度证据。首版无需用 Retained Manifest 建设另一套权威目录。

若 Broker 以认证身份原生隔离租户，可在适配层简化 Topic 中的 tenant 段；首版先保留明确结构。无论采用哪种结构，租户和 Worker 身份都由认证结果确定，不能信任 Payload 中自报的身份。

普通 MQTT 消费端收到的 PUBLISH 不能被当作自带已认证发布者身份。首版由 Broker 强制将凭据、ClientID、租户和 Worker Topic 前缀绑定，Result Ingest 从受保护 Topic 与其消费租户上下文推导身份，交叉校验 Payload。使用 Broker 插件或受控入口附加身份时，必须确保发布者无法伪造该信息；普通 User Property 不是可信身份。[MQTT PUBLISH 格式](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

Broker 原生租户隔离通常还隔离订阅空间，Control 不能假设一个普通客户端订阅就能看见所有租户。首版选用按租户管理的控制连接池或经过认证的 Broker 管理接入，PoC 必须验证实际的跨租户消费与下发方式。Worker 不允许订阅其他 Worker 的命令和确认 Topic。

## 注册与状态更新

1. Worker 使用独立凭据和稳定 ClientID 通过 TLS 连接，每次 CONNECT 生成新的 connection_id，并写入该次连接的 LWT。
2. Worker 完成命令订阅后提交 Manifest、协议版本和 connection_id。首版重报完整 Manifest 即可，不建设独立摘要协商协议。
3. Registry 校验身份、Schema、设备绑定与版本，返回注册结果。首版使用一次新鲜的注册请求响应确认本次 connection_id，不增加 registration_epoch、挑战服务和 Broker 连接事件依赖。
4. Worker 重报未确认结果和正在执行的任务，平台核对后按业务心跳、能力 readiness 和空闲槽位标记可调度。
5. Resolver 按租户、用户、策略、设备、环境和容量筛选；Scheduler 在正式分配时重新核对，避免发现后状态发生变化。

boot_id 每次进程或固件启动改变，connection_id 每次重新连接改变，心跳 seq 在连接周期内递增。Presence 只接受当前注册 connection_id 的状态，并拒绝旧序列覆盖新状态；同一进程重连也不能被旧 LWT 改成离线。LWT 在 CONNECT 时已固定，其自带时间不能当作实际断线时间，平台另外记录观察时间。MQTT 的 Will Delay 可减轻短断线，但不能代替应用层连接代际校验。[MQTT Will Delay](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

重连先重报当前 Attempt 和未确认结果，再开放新任务。QUERY 可查询本地保存的旧执行记录；恢复缓存不足的节点把相关任务报告为 unknown。首版不因重新上线自动重放有副作用的动作。只有注册规模或 Broker 事件适配需要时，才增加额外的注册代际与完整库存同步协议。

## Capability Manifest 示例

示例描述计划实现的 ESP32 iPhone 摄像头 Worker，不表示原项目具备这些能力。

```json
{
  "protocol_version": "1.0",
  "worker_id": "worker_esp32_01",
  "boot_id": "boot_01",
  "connection_id": "connection_01",
  "manifest_version": 3,
  "worker_kind": "embedded",
  "recovery_profile": "durable_ledger",
  "capacity": {"max_concurrency": 1},
  "device_ids": ["device_iphone_01"],
  "capabilities": [
    {
      "name": "camera.capture",
      "version": "1.0",
      "description": "Capture the bound phone screen with a camera.",
      "execution_mode": "tool",
      "input_schema": {
        "type": "object",
        "properties": {"device_id": {"type": "string"}},
        "required": ["device_id"],
        "additionalProperties": false
      },
      "output_schema": {
        "type": "object",
        "properties": {"artifact_id": {"type": "string"}},
        "required": ["artifact_id"],
        "additionalProperties": false
      },
      "retry_class": "read_only",
      "required_scope": "device.observe",
      "binding": {"transport": "mqtt", "contract_version": "1.0"}
    },
    {
      "name": "hid.click",
      "version": "1.0",
      "description": "Click once at a calibrated screen coordinate.",
      "execution_mode": "tool",
      "input_schema": {
        "type": "object",
        "properties": {
          "device_id": {"type": "string"},
          "x": {"type": "integer", "minimum": 0},
          "y": {"type": "integer", "minimum": 0},
          "observation_id": {"type": "string"}
        },
        "required": ["device_id", "x", "y", "observation_id"],
        "additionalProperties": false
      },
      "output_schema": {
        "type": "object",
        "properties": {"input_sent": {"type": "boolean"}},
        "required": ["input_sent"],
        "additionalProperties": false
      },
      "retry_class": "requires_reconciliation",
      "required_scope": "device.control",
      "binding": {"transport": "mqtt", "contract_version": "1.0"}
    }
  ]
}
```

最大坐标范围、标定版本和 observation 新鲜度由实际 Environment 与能力实现检查。`input_sent=true` 表示 HID 输入已发送；屏幕或业务是否发生预期变化，需要后续观测验证。

Worker 的 retry_class、权限或风险描述是声明信息。平台策略可以收紧，不能由不可信 Manifest 降低审批和执行要求。远程 Agent Card 或工具 Description 也按外部数据处理，避免其文本变成平台授权指令。

recovery_profile 说明节点能否跨进程或断电保留接单、取消与终态记录。durable_ledger 必须通过对应故障验收；volatile 节点只保证当前存活周期内去重，断电后有副作用的历史任务进入核对。字段声明不是已验证的可靠性保证。

## 发现与上层接口

Harness 通过平台接口查询能力，例如：

```json
{
  "operation": "capabilities.find",
  "required": ["camera.capture", "hid.click"],
  "device_id": "device_iphone_01",
  "execution_mode": "tool"
}
```

查询主体由请求认证和 Session 关联推导。返回受权限过滤的描述、Schema 与不透明的 binding_id；不要求模型自己拼 Topic 或指定可绕过授权的 Worker。不同 Worker 提供的同名工具先作为同一逻辑能力的候选 Binding，必要时在上层使用确定的命名映射。

平台可以将 Registry 暴露为 MCP Server，使用 `tools/list`、工具 Schema 与列表变更机制。MCP 当前规范允许按请求授权返回不同工具集合；适配层不能随意依赖连接私有状态改变工具列表，也不能把 Worker 暂时忙碌直接解释为工具定义消失。[MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

授权范围决定可见工具集合，实时可用性由调用和调度处理。列出能力后仍须在执行时再次校验当前授权、设备状态和环境归属。

## 工具任务命令

```json
{
  "protocol_version": "1.0",
  "message_id": "cmd_01",
  "type": "EXECUTE",
  "task_id": "task_01",
  "attempt_no": 1,
  "action_id": "action_01",
  "run_id": "run_01",
  "worker_id": "worker_esp32_01",
  "target_boot_id": "boot_01",
  "environment_id": "env_iphone_01",
  "environment_generation": 2,
  "capability": "hid.click",
  "capability_version": "1.0",
  "start_deadline": "2026-10-14T04:00:10Z",
  "max_runtime_ms": 10000,
  "args": {
    "device_id": "device_iphone_01",
    "x": 120,
    "y": 360,
    "observation_id": "observation_01"
  }
}
```

消息通过认证后的 Topic 路由，Payload 的 worker_id 只用于一致性核对。时间使用 UTC；平台与节点需要时钟同步和可接受偏差，节点无法判断有效期时应拒绝敏感操作，不能忽略期限。

参数较大时以 payload_ref 替代 args，并携带内容摘要和格式版本。args 与 payload_ref 互斥。平台下发前校验当前租户、用户、能力、设备和审批；Worker 只接受受 ACL 保护的控制 Topic，并校验自身能力、设备范围、参数和期限。

首版信任认证后的控制服务，不对每次点击额外请求授权服务，也不发送签名 Grant。需要人工批准的参数与资源范围保存到 Task，实质变化后重新检查审批。只有离线授权、不信任 Broker 或跨组织信任边界需要时，才定义带摘要和有效期的 ExecutionGrant。

### 控制消息

| 消息 | 必要规则 |
|---|---|
| EXECUTE | 同 Attempt 的不可变执行内容必须一致；重复 message_id 或不同 message_id 均不得触发重复动作 |
| QUERY | 用自身 message_id 关联响应并指定 Task/Attempt，返回状态或明确的 UNKNOWN，不开始执行 |
| CANCEL | 使用自身 message_id 和目标 task_id，保存已取消记录；同一次取消重发沿用其 ID，不与 EXECUTE 共用 ID |
| CONTROL_ACK | 从 `/task-events` 回报 CANCEL 等控制消息已登记或实际已停止；确认登记取消不等于停止证明 |

Task 取消是单向状态，不支持取消后复活同一个 task_id，因此首版不需要 cancel_generation。短任务使用 start_deadline 和 max_runtime_ms，Worker 以本地单调计时约束运行；超时不证明动作已停止，仍按实际结果核对。持续运动控制使用本地控制器的时限和停止机制。

只有 EXECUTE 适用 start_deadline。CANCEL 与 QUERY 使用各自请求有效期，不能因原动作开始期限已过就拒绝停止或查询。取消请求与在途命令仍有竞态：Worker 收到并登记 CANCEL 后拒绝旧动作；平台不能承诺请求取消的一瞬间所有已发布命令都失效。

### 条件增强字段

| 场景 | 增强项 |
|---|---|
| 多个控制实例自动接管同一资源 | lease_token、资源作用域 resource_fence 与执行端校验 |
| 长时间执行且允许接管、撤销或续权 | LEASE_RENEW_REQUEST、LEASE_GRANTED、lease_revision |
| 设备需脱离在线控制使用授权 | 有期限且绑定参数与资源的签名 ExecutionGrant |
| 自动从回退的权威数据库恢复派发 | control_epoch 与节点账本对账协议 |

接入这些场景时先定义并验收新增语义，不预先把字段塞进所有短任务。租约或 fence 只能约束实际实施它们的资源端，不能推导外部副作用已停止。

## 结果与确认

```json
{
  "protocol_version": "1.0",
  "event_id": "evt_01",
  "type": "COMPLETED",
  "task_id": "task_01",
  "attempt_no": 1,
  "action_id": "action_01",
  "worker_id": "worker_esp32_01",
  "boot_id": "boot_01",
  "occurred_at": "2026-10-14T04:00:05Z",
  "effect_status": "confirmed",
  "output": {"input_sent": true}
}
```

小结果使用 output，大结果使用 result_ref，二者互斥。平台在事务中写入结果事件、分类处理及必要状态转换后，才发送确认：

```json
{
  "protocol_version": "1.0",
  "type": "RESULT_ACK",
  "event_id": "evt_01",
  "task_id": "task_01",
  "attempt_no": 1,
  "disposition": "applied"
}
```

disposition 可为 applied、duplicate、stale 或 quarantined。后三类也必须有可核对的持久化处理记录。确认只说明平台已处理该事件，不代表用户目标完成；旧 Attempt 的观察可能用于核对副作用，但不得覆盖新 Attempt 的任务状态。quarantined 结果需保留待处理责任与人工或自动核对入口，不能确认后就当作已解决。

effect_status 使用 not_started、confirmed、partial 或 unknown，与任务成功、失败、取消分别记录。首版用 event_id 去重，按 Task/Attempt 状态限制转换，终态可先于迟到 ACCEPTED 到达。只有需要重建流式进度时才增加 sequence 和游标恢复，不要求每块嵌入式设备维护完整的耐久事件序列。

结果保留实际执行时的 boot_id。重启后重报已有结果不能改写执行身份，平台按已登记 Attempt 校验，而非只对比当前 Presence 的 boot_id。新进程不执行旧 target_boot_id 命令，但 QUERY 可以读取此前的持久化记录。

ACCEPTED 表示执行端完成验证并登记接单；RUNNING 表示已经开始；COMPLETED 表示该工具契约的结果。终态与关键接单记录的持久化要求见 [可靠执行](reliability.md)。

## 产物提交与对象授权

payload_ref 和 result_ref 指向平台 Artifact，携带 artifact_id、object_key、digest、size 和 media_type。短期 URL 只提供传输权限，过期后为同一个 Artifact 重新授权，不能换成另一份输入。

首版每个产物生成独立 key，上传完成后平台验证存在、大小和摘要，在结果事务中登记引用。采用存储原生的写一次条件或对象版本固定内容即可，不要求单独部署 finalize 服务，也不要求每个文件先上传 staging 再复制一次。S3 的条件写入可阻止同 key 覆盖，其他存储按实际支持选型。[S3 条件写入](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

对象存储与数据库不构成事务：先上传和校验，再登记结果；未引用对象延迟清理，待重报结果引用的对象保留。文件上传失败时只重传文件，不重新执行工具。用于审批或业务证据的内容要固定版本或校验摘要，不能只保存一个可变化的 URL。

预签名 URL 在有效期内可重复使用，直接上传可能覆盖同 key，不能当作一次性令牌。只有接受不可信上传、需要内容扫描或有强合规证据要求时才采用 staging/finalize、隔离区和额外代理。[S3 预签名 URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

## 事件接入与可靠触发

事件按业务需要区分 telemetry 与 durable_event。遥测可以丢弃或合并，平台可在源配置中声明这一点，不要求所有消息增加分类字段或本地落盘。只有不能丢失的事实采用稳定 event_id、源端记录或可重放，在平台入库后返回 EVENT_ACK；MQTT PUBACK 不能代替业务确认。

EVENT_ACK 表示事件已接收，不表示动作已执行。首版将处理状态和 run_id 保存在 Event 中，Run 创建与触发记录原子提交，扫描器补处理未决事件。无需先建设规则版本、窗口、历史重放与独立 TriggerRecord 服务。Webhook 在落库后确认，Cron 按计划发生标识去重。

来源换 boot 或连接不会把同一持久化业务事件变成新事件。复杂窗口、迟到水位、规则重放和事件溯源在实际需求出现时增加；普通设备状态提醒使用新鲜度、简单过滤和冷却时间即可。

## 子 Agent 任务状态适配

委托不复用原子工具的完整报文。Adapter 保存 delegation_id、远程任务和上下文标识、原始 remote_state、输入轮次和恢复游标。任务需补充输入时进入 WAITING_INPUT，需授权时进入 WAITING_APPROVAL，并保留原远程任务；补充信息后继续跟踪，而非重新创建 Agent。

delegation_id 在同一创建意图的发送重试中保持稳定。远程任务终态后不透明地创建另一个 Runtime 作为“重试”；重新执行目标时核对既有副作用与权限，登记新的委托。平台对第三方 Agent 的控制程度由其接口决定，不强迫它实现 Worker 租约、MQTT 心跳和资源 fence。

本地稳定的 delegation_id 只能防止重复创建本地意图，不能自动让第三方创建接口幂等。适配器需要提供方的幂等创建能力或可查询的客户端关联 ID；两者都没有时，创建超时进入 RECONCILING，找到原远程任务后再决定是否创建，并明确该接入限制。

远程 submitted/working 映射 ACTIVE，completed/failed/canceled 映射对应终态，rejected 映射 FAILED 并保存 rejection_reason；input-required 和 auth-required 分别映射等待输入或审批。实际字符串、错误与终态集合按锁定版本转换，不能把远程输入等待当作 LOST 或超时重试。[A2A 任务交互](https://a2a-protocol.org/latest/specification/)

MCP 对上调用长任务时，Adapter 选择客户端支持的任务接口，或使用快速返回 task_id 的 start/query/cancel 工具族。客户端的一次 RPC 超时和取消不能直接认定底层 Task 已停止；重新查询关联任务，不在透明重试中创建第二个动作。

## MQTT 参数与业务期限

| 参数 | 平台规则 |
|---|---|
| 执行命令 QoS | 默认 1，业务接单和终态另外确认 |
| Retain | 执行、取消、查询命令均 false |
| Message Expiry | EXECUTE 按剩余开始期限设置；控制消息按自身有效期设置 |
| Session Expiry | 按离线容忍度、Broker 容量与身份生命周期配置 |
| Will Delay | 可减轻短暂掉线噪声，不能作为任务归属依据 |
| Keep Alive | 判断连接活跃，不能证明工具健康 |
| 业务心跳 | 汇报能力就绪、空闲槽位和当前任务 |

Message Expiry 约束尚未开始交付的消息，不能撤销已进入 Worker 队列的操作。Worker 另查 start_deadline，并按 max_runtime_ms 控制短任务。重发不得扩大原开始期限，发布和订阅的 QoS 都须满足重要结果的约定。[MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

## A2A MCP 与 MQTT 的分工

| 执行对象 | 语义接口 | 传输或包装 |
|---|---|---|
| 有独立 Harness 的专业 Agent | A2A 或等价目标委托 API | 原生 HTTP 等，或经验证的 MQTT Binding |
| 桌面、浏览器、业务工具 | MCP 或平台 Tool 接口 | HTTP、MCP Adapter、可选 MCP over MQTT |
| ESP32、传感器、物理控制器 | 轻量 Worker 协议 | Native MQTT；也可由 Edge 包装成 MCP |

A2A 定义 Agent Card、任务、状态和产物，适合自主子任务；MCP 描述工具和资源，适合上层调用能力。MQTT 是两者可采用的传输之一，不能把所有 MQTT 客户端都叫 A2A Agent。[A2A 规范](https://a2a-protocol.org/latest/specification/)

EMQX 的 A2A over MQTT 文档提出 Retained Agent Card、请求响应、任务更新等映射；发现 Topic 为 `$a2a/v1/discovery/{org_id}/{unit_id}/{agent_id}`。这是外部 MQTT Profile，不能与本文的 `agent/v1/...` 内部协议混用，也不能视为任意 Broker 自带的 Registry。[A2A over MQTT 0.1](https://www.emqx.com/mqtt-for-ai/a2a-over-mqtt/specification/0.1/basic/mqtt_transport.html)

平台内部保持统一的 Task、Capability 与 Delegation 模型，对外锁定协议版本、映射状态和错误，并验证恢复行为。MCP over MQTT 同样作为 Adapter 的候选方向，不要求资源受限设备直接实现完整 MCP。[MQTT for AI 项目](https://github.com/emqx/mqtt-for-ai)

## 权限与协议版本

Broker ACL 将 Worker 限定到自己的注册、上报和命令接收 Topic；只有控制服务能发布业务命令与业务确认。控制端校验用户、工具、设备和环境权限，Worker 再校验目标、授权、期限与能力 readiness。结果接入校验受保护 Topic 所绑定的身份与 Task 归属；桥接、规则转发和管理发布也必须遵守该身份边界。

大文件权限限定到当前对象和操作，日志不记录可使用的令牌。用户撤销权限或设备转移时停止新任务并核对在途动作。首版采用控制端权限检查、Broker ACL 与 Worker 能力白名单；额外签名、每动作在线审批或实时撤销代理仅在业务确有该要求时启用。对撤销有严格时限的动作采用执行前在线校验，其他场景明确短期授权的有效窗口。

区分 Envelope、Capability Schema、Manifest 和 Firmware 版本。首次注册协商支持范围；不兼容的主版本、未知命令与未知授权语义必须拒绝。可选扩展字段可以忽略，影响安全或执行语义的必选字段不能静默忽略。滚动升级期间保留有界的兼容窗口，未完成任务使用其创建时锁定的能力契约。
