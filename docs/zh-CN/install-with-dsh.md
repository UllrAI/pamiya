# 交给 DSH 的 Pamiya 安装任务

[普通用户指南](quickstart.md) · [English](../en/install-with-dsh.md)

用户可以在 DSH 新会话中切换到 **创造模式（Creator）**，然后发送：

> 请阅读并执行 https://raw.githubusercontent.com/UllrAI/pamiya/main/docs/zh-CN/install-with-dsh.md ，为我安装 Pamiya。

下面是一份自包含安装任务。用户让你按本文安装，即授权在**当前 DSH profile** 安装并启用这个插件。若当前模式没有 `plugin_manager`，先引导用户切换创造模式；仍无此工具时，提供下方界面安装步骤。

## 安装目标

- 插件包：`@pamiya/dsh-plugin`，版本 `0.2.0`。
- 发布页：https://github.com/UllrAI/pamiya/releases/tag/v0.2.0
- 安装 spec：`https://github.com/UllrAI/pamiya/releases/download/v0.2.0/pamiya-dsh-plugin-0.2.0.tgz`
- 已验证宿主：DSH `0.2.0-rc.2`、`0.2.1-alpha.4`。其他版本以宿主的兼容性检查结果为准。
- 保留已有模型、对话、工作区、其他插件和连接配置。安装此预构建包不需要克隆仓库、构建源码或发布 npm 包。

## 执行步骤

1. 调用 `plugin_manager`，`action="list_bundles"`，检查当前 profile 是否已有 `@pamiya/dsh-plugin`；必要时分页。若已有且已启用，不重复安装；版本/来源不同则先说明实际情况，再按更新流程处理，不删除数据目录。
2. 未安装时调用：

```json
{
  "action": "install_bundle",
  "target": "https://github.com/UllrAI/pamiya/releases/download/v0.2.0/pamiya-dsh-plugin-0.2.0.tgz",
  "enabled": true
}
```

已有但关闭时，使用 `set_bundle`，`target="@pamiya/dsh-plugin"`、`enabled=true`。安装确认沿用 DSH 本身的提示；构建脚本若另需授权，说明实际包名并等待对应授权。

3. 根据真实返回处理：`applied` 后继续检查；`restart-required` 时告诉用户完全退出并重新打开 DSH，然后继续验收。不要把“下载完成”或“等待重启”描述成可用。
4. 再次 `list_bundles` 确认包已安装并启用。若工具目录已刷新，调用 `pamiya_workers`；尚未加载时先完成重启。
5. 首次没有配置 MQTT 是正常状态。本机通过本地通道自动加入，不需要先连接公共服务或重复添加。远端接入才需要 **Pamiya → 连接设置**。
6. 当 `pamiya_workers` 返回至少一个可用节点时，用其真实 ID 调用 `pamiya_execute`：`action="system.check"`、`input={}`。需要时再执行 `text.stats`，输入 `{"text":"Hello Pamiya"}`；预期为 12 字符、1 行、2 词。以工具实际结果判断成功。
7. 告诉用户实际安装版本、已完成到哪一步、本机节点是否可用，以及下一步如何添加其他电脑。只能在真实执行成功后报告“已安装并验证”。

## 遇到问题

- 下载失败：提供发布页，让用户下载 `.tgz`，把本机绝对路径作为 `install_bundle` 的 `target`；或走界面安装。不要用 `github:UllrAI/pamiya` 代替包地址，仓库根目录并不是可直接安装的插件包。
- 版本不兼容：报告实际 DSH 版本与要求，不自动添加版本豁免。
- 插件管理工具不可用：让用户打开 **插件 → 添加插件**，粘贴上述完整安装地址，安装后选择 **立即启用**；不要因此重写整个 profile。
- 公共连接仅使用合成测试，不发送个人文件。远程节点另行从 Pamiya 配对，不在安装文档中收集或公开凭据。

用户自助操作、远端 Worker 安装与常见问题见[上手指南](quickstart.md)。
