# Open-source foundation and reuse boundary

[Index](README.md) · [简体中文](../zh-CN/open-source-foundation.md)

Reviewed: 2026-10-15. **Pamiya should reuse an existing Agent product rather than rebuild a general-purpose one. First validate DSH's complete Web/desktop composition, adding Pamiya experience and remote capabilities through presets, themes, and plugins.** This was the initial source/contract-level recommendation; current implementation status is linked below.

`prototype/` validates experience. Having written a demonstration UI does not justify also implementing a model loop, Session system, application Host, and backend from scratch.

Implementation update: the DSH plugin now exists in `packages/dsh-plugin`; see [installation, verification and limits](../../en/dsh-plugin.md). The review below records the original source-level decision; it is not the current delivery status.

## Candidates

| Project | Verified reusable value | Fit for Pamiya | Limits and assessment |
|---|---|---|---|
| [DeepSeek Harness / dsh](https://github.com/deepseek-ai/deepseek-harness) | MIT; plugin seams for models, Agent loop, Sessions, tools, persistence and UI; Electron shell | **First candidate:** inherit the product, configure a personal-Agent preset, reuse UI/Host, add remote execution | Developer preview with explicit breaking-change notice; inspected source is `0.2.1-alpha.4`; pin and validate |
| [Pi](https://github.com/earendil-works/pi) | MIT; embedded SDK, tools, Sessions, steer/followUp, events, abort | Lean Harness candidate when complete ownership of the product shell is required | Product shell/Host composition remains work; new `pi-durable` explicitly has an experimental API, despite stable CLI releases |
| [OpenCode](https://github.com/anomalyco/opencode) | MIT; coding Agent, Web/desktop clients, client/server and SDK interfaces | Direct product base if software development is the near-term focus | Coding/workspace framing needs adaptation; existing App uses Solid, not interchangeable React components |
| [OpenClaw](https://github.com/openclaw/openclaw) | MIT; personal assistant Gateway, channels, memory, plugins, device nodes | Strong candidate when multiple entry points and continuing-assistant behavior take priority | Broad product scope requires baseline trimming; do not expose every channel/configuration on home |

Licenses were checked against official repository/license metadata, not search snippets. AionUi is Apache-2.0, so it is not listed as an MIT candidate. Releases are not guarantees for every module, and stars were not used to determine maturity.

## Can Pamiya be a DSH plugin?

**Yes. Validate a Pamiya extension bundle inside DSH first, without maintaining an independent fork.** DSH's Cordis architecture supports external plugins, bundle/profile composition, Agent presets, client slots and plugin-owned storage domains. These are concrete extension points, not proof that Pamiya integration already works.

| Part | Recommended owner |
|---|---|
| Conversation, model loop, context, tool execution framework and Session log | DSH |
| Personal-Agent defaults, capability selection and working instructions | Pamiya preset, without another Agent loop |
| Remote resource discovery/binding, tool dispatch, Task/Attempt and result acknowledgement | Pamiya Host plugin, owning remote business facts only |
| Resource selection, connection settings and tool/artifact entry points | Client plugin in the same bundle, using existing slots and controls |
| Actual cloud, desktop and device execution | Independently deployed Worker where needed, outside the DSH process |
| Full rebranding, home replacement and standalone installers | Optional product distribution layer, not a prerequisite for the first plugin |

Start with one extension bundle containing its Host plugin, client entry and composition configuration. Do not first split it into many npm packages, a marketplace or another administration app. The first chain is **DSH conversation → Pamiya registered tool → Worker execution → result in the same conversation**. Connect one Worker and one useful tool before exposing infrastructure concepts to users.

Keep storage equally focused: DSH remains authoritative for chat history. On one Host, first validate Pamiya resource/task facts through DSH's `storageDomain` and existing SQLite backend. It provides ordered domain writes and individual durable operations, not cross-domain transactions, multi-Host concurrent scheduling or cross-process notifications. Add a separate service/database only when centralized scheduling is actually required. PostgreSQL/MQTT in the architecture describe distributed deployment, not a mandatory infrastructure stack for installing the plugin; integration must make deployment tiers and data ownership explicit.

Client slots support extensions, themes can override alias tokens, and DSH already offers font-size settings with a 14 px body default. This does not establish extension points for every branding position, arbitrary navigation changes or complete home replacement. Verify the capability in the native interface first; decide limited UI replacement/distribution changes only when an independent Pamiya product requires them.

In this form, **Pamiya is an installable Agent capability product, DSH is its Host, and Workers execute remotely.** Reuse the model loop, chat shell, authoritative Session log and general scheduler. Use existing tools/MCP for ordinary tool needs; reserve native plugins for Host lifecycle, durable tasks and integrated UI behavior.

Evidence: [plugin/composition architecture](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/architecture.md), [UI plugin entry](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/preset/agent-preset/skills/cordis-plugin-development/references/ui-plugin.md), [storage](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/subsystems/storage.md), [theme/font settings](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/client/ui-theme/README.md).

## What to reuse from DSH

- **Product/client:** Web/desktop shell, navigation, conversation, streams, file/tool presentation and existing controls. Apply Pamiya branding/theme rather than reconstruct a second component library from a screenshot.
- **General Harness:** model adapters, Agent loop, context/compaction, skills, tool registry, inbox and cancellation. A personal-Agent preset selects defaults without making programming projects mandatory for every user.
- **State/recovery:** retain the upstream Session log and persistence boundary where possible; persist only additional Pamiya-owned business facts. Avoid two authoritative chat histories, planners, or retry loops.
- **Continuing work:** first reuse Host-owned durable reminders, not a second production scheduler derived from prototype ticks.

These are reuse findings, not verified replacement/branding integration. Start with public extension points. A limited fork is appropriate only where required UI/branding cannot be replaced; record any kernel change separately. Keep the prototype as interaction and acceptance reference.

## What Pamiya still adds

Differentiation lies in the long-lived personal goals/responsibilities experience, resources spanning cloud/desktop/Edge/devices, reliable remote execution, and ongoing artifact collaboration. Reuse existing capabilities wherever they satisfy those needs.

The first remote extension should form one complete chain: upstream tool registration → durable Pamiya task → one Worker → business acknowledgement → original conversation. Stable tool/action IDs, Task/Attempt, bindings and important unknown effects are remote business facts. MQTT connectivity is not capability readiness.

Register a tool whose execution invokes the remote task path. Use `tools/pre-execute` and `tools/execute` for policy/observation without bypassing upstream guards. Around-dispatch wrappers cannot rewrite call identity, and an aborted signal does not confirm a remote operation stopped. Validate PTC subcalls, child Agents and local tools individually rather than assuming one hook owns every effect.

## Behavior differences to resolve

| Topic | Verified upstream behavior | Integration decision |
|---|---|---|
| Completion | SDK `run()` collects through next whole-Agent idle; final text is not necessarily attributable to one input | Retain message receipts/Session/turn correlation and goal evidence, not SDK-return-equals-business-success |
| Reminder/runtime composition | Schedule requires Web Host Session controller, persistence and flush acknowledgement; not independently mountable in bare SDK/headless | Validate the complete Web Host when reusing the product, rather than rebuilding its Host around the smallest SDK |
| Missed triggers | Recurring reminders coalesce the latest missed occurrence | Current Pamiya spec skips; choose and update copy/acceptance before integration |
| Archive/reminders | Active reminders block archive; stopping them deletes their records | Different from recoverable archive/pause; verify extension support, never label deletion as pause |
| Cancellation | Local cancellation/process exit does not establish absence of a remote important effect | Retain Worker receipts and business reconciliation in the remote adapter |
| Isolation/authorization | A local Host's resource boundary is not multi-tenant isolation | Validate single-user deployment first; decide Host/environment/credential isolation when serving multiple users |

These are specific compatibility checks, not reasons to first build a policy engine, multi-active failover, or global transactions.

## Adoption gate

1. Pin a DSH commit/package, run its native product, apply Pamiya preset/theme; verify messages, tools, files, persistence and cancellation before making another shell.
2. Connect one Worker and test tool calls, reconnects, duplicates, acknowledgements and stop; uncertain submitted effects must not replay.
3. Verify artifact revision, state retention through upstream upgrades, and the reminder/archive decisions. List kernel changes; if many essential behaviors require invasive changes, compare Pi/OpenClaw migration costs again.

Only after these pass does a preferred candidate become an adopted foundation. The original review did not execute or migrate a runtime; the subsequent implementation keeps the prototype separate.

## License and evidence

The DSH [MIT license](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/LICENSE) requires preserving the copyright/permission notice in relevant copies or substantial portions. Dependencies follow their [third-party notices](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/THIRD_PARTY_NOTICES.md). Pamiya uses its own name/visual identity, without inheriting the official whale or implying endorsement; see [brand guidelines](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/BRAND_GUIDELINES.md). This repository remains Apache-2.0; review alone imports no upstream code and changes no license.

Snapshots: DSH `86a402200d95fecef4529d969836f1fe13c6cb0d`; Pi `eddebaeebf8168dfc31d6712b7a021e4df3b4e6a`; OpenCode `81200db2a3a86fc72a60dff996557f59865a6f24`; OpenClaw `824fde2bfab6f335ba493819c804339c538abcca`. Latest non-preview release records inspected: Pi `v1.2.0`, OpenCode `v1.19.0`, OpenClaw `v2026.10.3`. DSH's GitHub latest-release endpoint returned no non-preview release. These pin the reviewed evidence, not successful execution.

Key contracts: [DSH architecture](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/architecture.md), [tool pipeline](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/docs/tool-execution-pipeline.md), [SDK](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/sdk/client/README.md), [schedule](https://github.com/deepseek-ai/deepseek-harness/blob/86a402200d95fecef4529d969836f1fe13c6cb0d/packages/schedule/schedule/README.md), [Pi SDK](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/packages/coding-agent/docs/sdk.md), [Pi durable](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/packages/durable/README.md), [OpenCode Server](https://opencode.ai/docs/server/).

[Other license evidence: Pi](https://github.com/earendil-works/pi/blob/eddebaeebf8168dfc31d6712b7a021e4df3b4e6a/LICENSE), [OpenCode](https://github.com/anomalyco/opencode/blob/81200db2a3a86fc72a60dff996557f59865a6f24/LICENSE), [OpenClaw](https://github.com/openclaw/openclaw/blob/824fde2bfab6f335ba493819c804339c538abcca/LICENSE), [AionUi](https://github.com/iOfficeAI/AionUi/blob/main/LICENSE).
