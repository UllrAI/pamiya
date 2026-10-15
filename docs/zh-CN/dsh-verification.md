# DSH 插件验收记录

[使用指南](dsh-plugin.md) · [English](../en/dsh-verification.md)

验证日期：2026-10-16。截图来自真实 DSH Web Host，不是 `prototype/`。

## 已验证

- DSH `0.2.0-rc.2` Web 组合和 `0.2.1-alpha.4` Web 组合均成功加载插件、侧栏、认证 API 与工具。桌面版已安装插件，但本轮原生窗口验收因锁屏尚未完成。
- `0.2.1-alpha.4` 中，本机 macOS Worker 与独立 Linux x64 服务器 Worker 通过 RunMQTT 公共测试连接在线；同一演示文本的统计任务均得到真实完成结果。
- 在实际界面启动远端 90 秒等待任务并请求停止，界面收到“已停止”，远端日志确认取消结果已获 Host ACK。
- Linux Worker 采用独立 Node.js 24.22.0（来自官方发布并校验 SHA-256），由 systemd 托管；服务重启后自动恢复连接，执行日志保留，配置/日志文件权限为 600。
- 插件重载后本机托管 Worker 恢复；自动化另验证主动停止的节点不会自动重启，也不会重复创建本机节点。
- 中英文文案切换、远端配对默认选中、已存在本机节点时禁止重复创建、任务列表与状态回显均在真实宿主操作。
- 自动化共 14 项，覆盖真实 MQTT 双 Worker、去重、停止确认、暂停、Host 重启、Worker 强制退出、路径范围、私有文件/命令、本机能力配置、预先取消的工具、宿主 API 与配置保留。
- 插件生产依赖审计为 0 项漏洞；仓库文档渲染依赖另有既存 KaTeX/Mermaid 低风险提示，不通过跨主版本升级混入本次实现。

![本机与远端节点](../../packages/dsh-plugin/design/two-workers.zh-CN.png)

![两个节点完成任务](../../packages/dsh-plugin/design/activity.zh-CN.png)

## 尚未验证

原生桌面窗口中的最终操作、真实模型发起的工具调用，以及 Windows/其他桌面系统的进程行为仍待验收。没有为通过演示复制个人 API Key 到测试 Host；测试只使用合成内容。私有文件和显式授权的命令执行已通过本地真实进程测试，未通过公共服务测试。

这些证据证明当前实现链路，不代表多租户生产平台、操作系统沙箱或故障自动改派已交付。

[远端停止确认界面](../../packages/dsh-plugin/design/remote-cancel.zh-CN.png)。
