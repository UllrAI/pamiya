# Pamiya for DeepSeek Harness

A DSH extension that takes selected Skills and work to local or remote DSH, Codex, Claude Code and Pi agents. Includes on-demand Skill transfer, dependency checks, Prepare and continue, guided setup and durable result callbacks. Validated with the 0.2.0-rc.2 and 0.2.1-alpha.4 Host compositions. The host conversation, model and session history remain owned by DSH.

Install the prebuilt release through **DSH → Plugins → Add plugin**:

```text
https://github.com/UllrAI/pamiya/releases/download/v0.3.0/pamiya-dsh-plugin-0.3.0.tgz
```

Select **Enable now**, then open Pamiya; this computer joins through a local channel without MQTT. Desktop UI installation needs no separate Node.js or Git. [User quickstart](https://github.com/UllrAI/pamiya/blob/main/docs/en/quickstart.md) · [简体中文](https://github.com/UllrAI/pamiya/blob/main/docs/zh-CN/quickstart.md) · [Ask DSH to install](https://github.com/UllrAI/pamiya/blob/main/docs/en/install-with-dsh.md).

Build: `npm ci && npm run plugin:build` from the repository root. Package: `npm pack --workspace @pamiya/dsh-plugin --pack-destination artifacts` after creating `artifacts/`.

Install the generated tarball through DSH's plugin manager, then open **Pamiya** in the sidebar. This computer joins automatically without MQTT. Configure a connection only for remote workers. Download the standalone Worker for another computer. The interface generates its pairing command.

Public RunMQTT mode supports fixed synthetic Agent tests, checks, echo, wait and text statistics. Local IPC and private remote connections support scoped files and custom actions; command execution requires explicit `--allow-shell` on the worker. The latter is permission to run commands, not an OS sandbox. Pairing codes are private; do not commit or publish them.

Worker requires Node.js 22.19 or later. Run `node pamiya-worker.mjs --help`. DSH manages its local worker; remote workers continue only while their process is running. MQTT QoS is not task success: results are acknowledged after host persistence, uncertain operations are queried rather than replayed, and stopping does not undo prior effects.

Skills include scripts and resources, cached by content version. Local files stay local; remote Skill bodies use HTTPS relay storage, with MQTT carrying references only. No direct Host-to-Worker network access is required. Configure S3-compatible storage once for personal remote Skills; public synthetic examples need no storage account.

[Skills guide](https://github.com/UllrAI/pamiya/blob/main/docs/en/skills.md) · [Skills 中文指南](https://github.com/UllrAI/pamiya/blob/main/docs/zh-CN/skills.md).

[S3 first-time setup](https://github.com/UllrAI/pamiya/blob/main/docs/en/file-storage.md): prepare storage, test a signed download, then return and continue the original task.
