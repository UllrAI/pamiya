![Pamiya](assets/brand/banner.png)

**English** · [简体中文](README.zh-CN.md)

**Let DSH take the capabilities you need to the right computer.**

Pamiya is a DeepSeek Harness (DSH) plugin. Keep your conversation, model and artifacts in DSH while delegating work to local or remote DSH, Codex, Claude Code and Pi agents, or calling your own script actions.

## Skills travel with the task

A Skill should bring more than a prompt when work moves to another computer. Pamiya **transfers complete Skills on demand, checks dependencies, then prepares and continues the original task**:

1. Name a worker and Skill in conversation, or open **Pamiya → worker → Skills**.
2. Transfer `SKILL.md`, scripts and resources; check declared commands, environment variables, Node/Python packages and platform requirements.
3. Missing items produce a clear **Needs preparation** state. Choose **Prepare and continue** to install supported dependencies in an isolated worker environment and continue the same task.
4. The native Agent uses the prepared capability; progress, results and callbacks return to the original conversation.

Remote Skill files use HTTPS relay storage, so Host and Worker need outbound access only. MQTT carries small file references. Content is cached by version, avoiding repeat transfers. Existing sessions keep their pinned version; new tasks can use updates. Local Skills, worker-owned Skills and model authentication keep separate ownership, without copying an entire user profile.

[Skills guide and dependency manifest](docs/en/skills.md) · [Guided S3 setup](docs/en/file-storage.md) · [Recorded verification](docs/en/dsh-verification.md)

## What else is included

| Capability | Experience |
|---|---|
| This computer is a worker | Joins automatically over local IPC; no MQTT setup required |
| Choose a computer in conversation | Select it beside the composer, or say where to run the task |
| Four complete Agents | DSH, Codex, Claude Code and Pi keep their native tools and execution loops, with session continuation |
| Share your model by default | Use the DSH model channel, or select independent configuration per worker Agent |
| Define your own capabilities | Expose script actions with input schemas for the Agent to call |
| Follow work through completion | Durable progress, business-result acknowledgements, cancellation and reconciliation; completion returns to the original conversation |

## Start in minutes

In DSH, open **Plugins → Add plugin**, paste this URL, install and enable:

```text
https://github.com/UllrAI/pamiya/releases/download/v0.3.0/pamiya-dsh-plugin-0.3.0.tgz
```

Desktop installation needs no Git, source checkout or separate Node.js. Open **Pamiya** to use this computer. Configure MQTT when adding another computer, then copy the onboarding command shown in the interface.

To try Skills, open a worker’s **Skills → Run synthetic example**. It uses bundled test resources to show dependency checking, preparation, script execution and real result delivery end to end.

[Self-service quickstart](docs/en/quickstart.md) · [Give this document to DSH](docs/en/install-with-dsh.md) · [All installation options](INSTALL.md) · [Agents and custom actions](docs/en/agent-workers.md)

## Current boundaries

Current release: **plugin 0.3 preview**. Verified on macOS DSH Desktop and a Linux Worker; Windows still needs physical testing. Dependency checks use the optional `pamiya.json` manifest, rather than inferring every requirement from free-form instructions. Missing system commands and environment variables produce actionable checks. MCP, plugins, personal credentials and project files do not migrate automatically with a Skill.

Public RunMQTT is for built-in synthetic validation only. Use a private connection for personal Skills and real remote tasks. Local work does not pass through MQTT.

## Documents and architecture

[Plugin usage and implementation](docs/en/dsh-plugin.md) · [Architecture reading guide](docs/en/README.md) · [Requirements and interaction](docs/product/en/README.md) · [Standalone interaction prototype](prototype/README.md)

The plugin uses one DSH Host, durable tasks and multiple Workers. The diagram describes a scalable platform architecture; PostgreSQL and object storage are not prerequisites for installing the plugin. The standalone prototype remains a simulation, with platform proposals documented separately from runtime capabilities.

![Pamiya architecture at a glance](assets/diagrams/readable-overview.en.png)

[Detailed architecture](assets/diagrams/baseline-architecture.en.png) · [Editable architecture diagrams](assets/diagrams/README.md) · [Scope and decisions](docs/en/scope-and-decisions.md)

## Run from source

Requires Node.js 22.19 or newer:

```sh
npm ci
node scripts/install-dsh-plugin.mjs
npm run plugin:test
npm run docs:check
```

[Contributing](CONTRIBUTING.md) · [Visual assets](assets/brand/README.md) · [Apache-2.0](LICENSE)
