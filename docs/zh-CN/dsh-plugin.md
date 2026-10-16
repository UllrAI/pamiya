# Pamiya DSH 插件：安装、使用与实现边界

[阅读指南](README.md) · [English](../en/dsh-plugin.md)

普通用户先看[上手指南](quickstart.md)，或把[安装任务文档](install-with-dsh.md)交给 DSH；本页包含源码安装、完整运行说明与实现边界。

这是 `packages/dsh-plugin` 的实际实现说明。Pamiya 复用 DSH 的对话、模型、Agent 循环和 Session；插件增加远程工具、配置页、多节点管理与执行记录。`prototype/` 仍是独立的模拟交互原型。

## 当前实现组合

```mermaid
flowchart TB
  Agent[DSH Agent / Session] -->|pamiya tools| Host[Pamiya Host plugin]
  Host <--> State[DSH storageDomain + credentials]
  Host <--> Broker[MQTT Broker]
  Broker <--> Local[Local Worker]
  Broker <--> Remote[Remote Worker]
```

Host 与本机 Worker 在同一台电脑上，以独立进程运行。所有 Worker 主动向 Broker 建立出站连接，图中双向箭头表示消息流。Agent 与权威聊天历史仍由 DSH 提供。

## 安装

需要已有 DeepSeek Harness 和 Node.js 22.19 或更新版本。源码构建使用 npm；下载的 Worker 已包含运行依赖，无需单独安装 MQTT 库。

```sh
npm ci
npm run plugin:test
node scripts/install-dsh-plugin.mjs
```

macOS 安装器优先使用官方桌面应用自带的 CLI，不依赖额外注册全局命令。其他环境可用 `--dsh` 指定 CLI，`--profile web` 选择 Web profile。安装器备份已有 profile patch，只修改自己标记的配置段；遇到用户自定义 Pamiya 配置不会覆盖。若宿主未自动重载，完全退出后重新打开。

当前接受的宿主版本是 `0.2.0-rc.2`、`0.2.1-alpha.4`。桌面官方更新通道和 npm `latest` 在本次核对时仍提供前者；后者来自 npm `alpha`，不能把安装 alpha CLI 说成桌面应用已经升级。alpha 验证使用独立 Harness home，避免混用个人数据。

测试部署可运行 `node scripts/install-dsh-plugin.mjs --demo`：仅在尚未配置连接时，填入当前 RunMQTT 公共测试参数，启动一个本机节点并执行连接检查。普通安装不主动选定外部消息服务。

## 第一次使用

1. 在 DSH 侧栏打开 **Pamiya → 连接设置**。选公共测试连接，点击“填入当前测试参数”，再“保存并连接”。账号从 RunMQTT 的官方公开页面读取，不把轮换密码写死在仓库。
2. 连接成功后，本机 Worker 自动加入。DSH 使用自己的 Node 兼容运行环境启动，无需额外终端或配对；主动停止的本机节点不会因重连而再次启动。
3. 出现“可用”后检查连接，或在“节点体验”中运行回声、文本统计、可取消的等待任务。状态、结果与错误都来自实际 Worker。
4. 回到原来的 DSH 对话，让 Agent 先调用 `pamiya_workers`，再用 `pamiya_execute` 选择节点与能力。模型登录和 API Key 由 DSH 管理；Pamiya 不另设模型账号。

公共服务只用于合成测试。它没有可用性保证，可能重置状态或轮换账号，不承载个人文件与真实业务动作。插件在该模式下不开放文件和命令工具；端到端加密不改变公共服务的使用范围。[RunMQTT 参数及限制](https://runmqtt.com/public-broker)

## 添加其他电脑或服务器

选择“添加节点 → 另一台电脑或服务器”，命名后创建配对。界面提供单文件 Worker 下载、Node.js 安装链接、macOS/Linux 与 Windows PowerShell 启动命令和 30 分钟配对提示。若剪贴板不可用，可选择“显示命令以手动复制”。命令中的配对信息包含连接凭据和节点密钥，只交给自己的电脑，不能放进公开文档、Issue 或截图。每台电脑分别生成配对。

Worker 在自己的用户目录保存配置和执行日志，目录/文件采用相应平台可支持的私有权限。已配对节点不因原配对码过期而停止；再次启动使用界面显示的节点 ID：

```sh
node pamiya-worker.mjs start --id <worker-id>
```

运行进程退出后，远程节点会离线。本机托管节点随 DSH 启动；远程服务器长期运行可以由自己的进程管理器托管同一个 `start` 命令，不假装浏览器关闭后还有平台调度器运行。

连接地址或模式与已配对节点绑定，变更前需要移除节点。更新 MQTT 账号会重连 Host 与本机托管 Worker；远程节点在详情中选择“更新连接 / 重新配对”，先停止旧进程，再运行新命令，保留原节点身份及执行日志。

## 多节点管理

- 支持按名称搜索、状态筛选、重命名、暂停/恢复分配、连接检查、本机进程启停、重新配对和移除。
- 暂停只阻止新分配，不把在途工作当作已停止。移除不删除历史记录；存在未完成或待核对任务时先处理结果。远程进程需在远程电脑停止。
- 一次工具执行绑定一个节点、boot 和 Attempt。显式指定节点时不静默改派；省略节点时选择一个可用且提供该能力的节点。
- “体验多节点”向每个可用节点发送相同合成文本，可以比较真实结果。它要求至少两个可用节点，不用假数据凑节点数量。
- 当前每个 Worker 容量为 1。Agent 可并行调用不同节点；同一节点正忙、暂停、离线或有未知结果时不会分配新动作。

## 文件与命令能力

自有私有 MQTT 连接可使用 `fs.list`、`fs.read`、`fs.write`。本机节点详情可设置允许读写的已有文件夹，并单独选择是否允许命令执行；保存后重启节点，存在未完成或待核对任务时先处理任务。远程配对命令可以添加 `--workspace` 指定工作目录；路径检查拒绝越界与指向外部的符号链接。目录内读写不等于操作系统隔离。

`shell.run` 还需要在 Worker 启动时显式添加 `--allow-shell`。它以 Worker 所属用户身份执行命令，工作目录不是系统沙箱；只给自己信任的 Host 配对。非零命令退出码保留输出并报告失败。Worker 不自带浏览器自动化、桌面控制、ESP32 固件或第三方 Agent 委托适配器。

## 状态与恢复

| 状态 | 含义 |
|---|---|
| 已发送 | Host 已保存意图与执行归属，并尝试投递 |
| 执行中 | Worker 已持久记录并确认接收 |
| 已完成/未完成 | 实际业务结果已回到 Host 并持久保存 |
| 正在请求停止 | 尚未得到节点的确定结果 |
| 已停止 | 可取消动作已由 Worker 确认；不撤销此前效果 |
| 结果待核对 | 断线、超时或重启后缺少确定结果，不自动重放或换节点执行 |

聊天日志仍以 DSH Session 为准；资源和 Task/Attempt 记录保存在 DSH `storageDomain` 的 `pamiya` 域。当前采用已安装宿主的 JSON 后端，不额外建设 PostgreSQL。MQTT 凭据与每节点密钥使用 DSH credential store，不返回给状态查询或模型工具。Worker 使用本地原子执行日志，落盘后才确认接收，结果在收到 Host ACK 前持续重报。

原生工具经过 DSH 自身的工具执行链；UI RPC 使用宿主已经认证的 `/api` Fetch 路由，不新开未认证的控制服务。MQTT 为 QoS 1、小型非 retained 消息；每节点 AES-256-GCM 密钥与方向绑定，拒绝修改或过期消息。重复分派查询同一日志，不再次执行。

“核对结果”只查询节点。只有人已在节点确认事实时，才可为未知任务登记状态及说明；这会记录核对来源，不重新执行。命令取消、写入取消与进程崩溃可能已经产生效果，保留未知状态等待核对。

## 当前通信契约

插件采用一个精简的版本 1 契约；[平台协议提案](capabilities-and-protocol.md)不是它当前的线格式。

- Topic：`sandbox/pamiya/<namespace-id>/workers/<worker-id>/down` 用于 Host 命令，`/up` 用于 Worker 事件；QoS 1，不使用 retained。
- 明文消息字段：`v`、唯一消息 `id`、时间戳 `at`、`workerId`、`bootId`、`kind`、可选 `taskId` 与 `payload`。`kind` 为 `status`、`dispatch`、`accepted`、`result`、`resultAck`、`query` 或 `cancel`。
- 传输层使用 AES-256-GCM，`iv`、`tag`、`data` 为 Base64url，附加认证数据为 `<namespace>|<workerId>|<up-or-down>`。消息需属于选定节点，且与本机时间相差不超过 120 秒；机器时钟需要同步。
- Agent Session 与 DSH `callId` 生成持久意图键；Task UUID 绑定一个 Worker、boot 与 Attempt 1。重复分派查询 Worker 日志，传输消息 ID 不充当业务去重键。
- 分派载荷为 `{action, input, deadline}`；结果为 `{status, result?, error?, bootId?}`，Host 持久保存后才确认。状态包含已开放能力与容量；心跳间隔 5 秒，Host 在 18 秒无响应后认为在线信息已过期。
- 输入上限 24 KB，接收方拒绝超过 96 KB 的数据包；大结果返回截断预览，保留实际执行状态。文件能力用于范围内的小文件读写，不伪装成产物传输服务。
- 重连保留 Broker 连接空间与节点身份；不引入续租、fencing、签名授权、自动重放或第二套调度器。

准确实现以 `packages/dsh-plugin` 的 `src/protocol.js`、`src/controller.js`、`src/worker.js` 为准。

## 验证与限制

自动化覆盖真实本地 MQTT 双 Worker、意图与消息去重、停止确认、暂停分配、Host 重启、Worker 进程强制退出、路径越界、私有文件/命令执行、宿主 API 契约和安装配置保留。公共 RunMQTT 上已用两个独立 Worker 验证连接与结果回传；这不等于已验证任意远程机器。

浏览器验收使用真实 DSH 宿主，而非原型模拟。多租户托管、控制器多活、自动故障改派、操作系统沙箱、海量节点调度、跨域事务和生产级部署均未作为本轮能力交付。物理机部署、模型端到端调用与跨平台情况以实际验收记录为准，不由单元测试推定。


[实际验收证据与剩余检查](dsh-verification.md)。
