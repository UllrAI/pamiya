# 在节点上运行 Agent 与自定义动作

[上手指南](quickstart.md) · [English](../en/agent-workers.md)

Pamiya 复用 DSH 的对话入口。节点可以执行小工具、自定义动作，或启动一套真实 DSH、Codex、Claude Code、Pi。Agent 用各自官方 CLI 执行；模型与鉴权来源由用户选择。

## 第一次使用

安装插件后，本机自动连接，无需 MQTT。打开 **Pamiya → 这台电脑 → Agent 能力**，能看到已检测到的 Agent；缺少时点击 **安装**。安装从 npm 官方注册表下载已指定版本，过程显示在运行记录中，不修改系统级全局安装。安装依赖网络与当前系统支持。

默认选择 **复用 DSH**。点击 **合成验证**，任务只要求返回 `PAMIYA_AGENT_OK`，成功后在运行记录显示答案。合成验证始终使用共享模型，使用独立的测试目录，不加载 Agent 的个人登录。它验证启动、模型请求、状态和回传，不证明所有工具或真实工作流均已验收。

添加远端电脑前才需要配置 MQTT。公共 RunMQTT 只做合成验证；远端真实文件、命令、自定义动作和自由 Agent 任务需要自己的私有连接。本机通过进程 IPC 工作，本机任务不会经过公共 Broker。

## 模型与鉴权

| 选择 | 行为 |
|---|---|
| 复用 DSH（默认） | 对话委派沿用发起对话的模型路由，由 Host 的 DSH 模型服务鉴权。节点上的 Agent 连接临时的本机模型接口，模型请求经过现有加密通道返回 Host。无需在每台电脑再次登录，也不复制整份密钥库。管理页合成验证使用 DSH 默认模型。 |
| 独立配置 | 使用该电脑上所选 Agent 原有的模型配置与登录状态。可在界面覆盖模型名；Pi 提供商可在节点 `capabilities.json` 设置。需先在那台电脑完成对应 Agent 的登录或模型配置。 |

独立配置是显式选择，缺少登录时报告失败，不静默换成共享模型。共享接口支持文本与本地工具调用，兼容 Anthropic Messages、OpenAI Responses 和 Chat Completions；提供商托管工具、图片/文档等专有输入请使用独立模式。共享模式不代表把 Codex/Claude 订阅权益转给其他提供商，而是使用用户在 DSH 中选择的模型和费用来源。

Worker 的命令与完整 Agent 都以它的操作系统用户身份运行。文件工具的工作目录检查不会把完整 Agent 变成操作系统沙箱；原生 Agent 保留自己的权限策略，Pamiya 不加跳过权限的开关。需要交互授权的任务可能无法在无界面的 CLI 中继续，应在该电脑按 Agent 的提示配置后再执行。

## Skills、插件与节点环境

已支持[Skills 按需同步、依赖检查与准备并继续](skills.md)，适用于 DSH、Codex、Claude Code 和 Pi。选择完整 Skill 及资源后，本机直接读取快照，远端通过 HTTPS 文件中转下载；MQTT 只传文件引用。节点检查可选 `pamiya.json` 声明的依赖，在独立环境准备可安装项，再继续原任务。

模型与鉴权默认复用；Skills 按本次选择传递。MCP、插件、项目文件及个人凭据不自动迁移。原生节点能力仍由对应 Agent 管理。

## 从对话中委派

输入框底部的 **执行节点** 菜单选择电脑，或者在“自动选择”下直接在消息中命名电脑。随后可以说：

> 用 Pamiya 的 Codex 在所选电脑分析这个测试项目。使用当前 DSH 模型，完成后回到这个对话汇报。

公共连接请改用：

> 在 Linux 测试节点分别验证 DSH、Codex、Claude Code 和 Pi。只用固定合成任务，不读取文件；同一节点按顺序运行，每次完成后再继续下一个。

DSH 会先查询 `pamiya_workers`，使用 `pamiya_delegate` 提交任务。工具立即返回任务 ID，不占住对话等待长任务；完成、失败或结果待核对都会回到发起对话。对话未加载时回调待投递，重新打开后继续投递。回调带固定消息 ID，重复结果不会重复发起工作。节点输出是待判断的数据，不成为新的权限指令。

`pamiya_task` 可以读取最新进度、结果、查询节点持久日志或请求停止。停止进程不撤销此前修改；可能产生副作用的取消保留“结果待核对”。节点或 Host 重启后不自动重放不确定任务。

## 继续同一 Agent 会话与产物

结果包含 `sessionRef`，后续委派传入同一引用、Agent 与模型来源即可续接原生会话。该引用属于节点自己保存的会话，不是任意用户文件路径。DSH、Codex、Claude 使用原生 Session ID；Pi 使用专属会话文件。运行详情也提供续接入口。

结果含答案、原生会话信息和产物列表。每次运行的完整 JSONL 事件保存在节点 `runs/<task-id>/events.jsonl`；答案在回传中保留最多 24,000 字符。`agent.artifact` 通过 `{taskId, name, offset}` 分块读取任务登记的产物，返回 Base64、下一偏移与结束标记，不开放任意文件路径。文件产物目前登记工作目录顶层新增或修改的文件；子目录产物需要 Agent 明确汇报或使用该节点文件工具读取。

## 自定义动作

在节点详情展开 **编辑动作定义（JSON）**，填写并保存。公共远端不开放命令定义；本机和私有远端支持。也可编辑 Worker 目录中的 `capabilities.json`，然后在界面核对能力或重启节点。

```json
{
  "version": 1,
  "actions": [
    {
      "name": "custom.echo",
      "description": "Echo a JSON input for a connectivity check",
      "command": "python3",
      "args": ["-c", "import sys,json; print(json.dumps(json.load(sys.stdin)))"],
      "inputSchema": {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "additionalProperties": false
      },
      "timeoutSeconds": 120
    }
  ],
  "agents": {
    "dsh": {"enabled": true, "modelSource": "inherit"},
    "codex": {"enabled": true, "modelSource": "inherit"},
    "claude": {"enabled": true, "modelSource": "independent"},
    "pi": {"enabled": true, "modelSource": "independent", "provider": "anthropic"}
  }
}
```

界面的动作编辑框只填 `actions` 数组，Agent 设置单独保存。输入按 JSON Schema 验证，以完整 JSON 写入子进程 stdin；命令和固定 args 由节点所有者定义，不把用户参数插值到 Shell。stdout 可以是 JSON 或文本，非零退出码报告失败。动作名称与说明、参数 Schema 会出现在 `pamiya_workers`，模型可以使用 `pamiya_execute` 调用 `custom.*`。自定义动作异步返回任务 ID，完成后回到发起对话，避免 DSH 单次工具超时截断长动作；用 `pamiya_task` 查看或取消。

## 已验证范围

四种官方 CLI 的真实启动、共享模型接口及原生续接有可选集成检查：

```sh
PAMIYA_REAL_AGENT_TESTS=1 npm run plugin:test
```

它使用受控模型响应验证适配协议；实际 DSH 模型、物理节点、取消与回调的验收证据见[验证记录](dsh-verification.md)。Windows 实机和各第三方独立登录账号不因通用测试通过而视为已验收。
