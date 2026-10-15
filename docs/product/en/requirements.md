# Requirements and scope

[Index](README.md) · [简体中文](../zh-CN/requirements.md) · [Interactions](interactions.md)

## Positioning and users

Pamiya is a persistent personal Agent. People express goals, supply context, see meaningful progress, steer the work, and receive useful results without learning Harness, Worker, Task, or MQTT. A Session spans multiple rounds; the Agent's long-term identity and explicitly saved preferences can span Sessions.

Primary users delegate research, synthesis, writing, and everyday work. Developers and device users can extend execution, but cloud-only work must stand on its own. Directories, browsers, and devices are resources for accomplishing goals; they do not define home navigation.

| Use case | Desired outcome | Success evidence |
|---|---|---|
| Understand and decide | Read sources and compare alternatives | Readable conclusion with sources and uncertainty |
| Create and revise | Turn a goal into a plan, document, or code | Openable, editable, downloadable, iterative artifact |
| Work across resources | Use an authorized workspace or environment | Correct resource and evidence tied to the goal |
| Carry a responsibility | Periodic synthesis or a specified event response | Clear trigger, next occurrence, per-run results, pause |
| Resume earlier work | Continue a conversation and its artifacts | Preserved context and versions |

Do not assume everyone needs projects, code, devices, or automation. First use does not require selecting an Agent, drawing a workflow, or installing a Worker.

## Principles

1. Start directly. One default Personal Agent accepts language and materials. Deployers configure the model and default cloud capability; end users do not initialize the runtime.
2. Advance autonomously. Understand, plan, and use tools within existing authorization. Reversible, low-impact work uses reasonable stated assumptions rather than repeated approvals.
3. Reveal what matters. Show current activity, important results, and blockers, with expandable detail. Do not expose private reasoning or imply every goal has three fixed stages.
4. Preserve continuity. Conversation, current execution, artifacts, and memory have separate persistence. Compute can be released while work remains.
5. Verify the goal. Tool success alone is insufficient: provide a conclusion/artifact and resolve required work that can still cause important effects.
6. Make boundaries specific. Explain exactly what input or resource is missing and why. Avoid generic risk scores and duplicate authorization.

## Functional requirements

P0 is required for the baseline loop, P1 follows as a deliverable extension, and P2 requires a concrete business trigger.

| ID | Priority | Requirement and acceptance |
|---|---|---|
| R01 | P0 | Enter a goal immediately; default cloud work requires no connection setup; blank input cannot send |
| R02 | P0 | Multi-turn conversation, attachments, selected historical context; avoid duplicate execution; IME Enter does not send |
| R03 | P0 | Autonomous use of available tools; concise activity and optional detail; waiting releases compute |
| R04 | P0 | Clarify only consequential gaps; offer quick answers and free input |
| R05 | P0 | Accept steering during execution at an appropriate boundary; stop or queue conflicting replacement goals |
| R06 | P0 | Distinguish stop requested/confirmed; retain delivered work; query important submitted effects before retry |
| R07 | P0 | Artifact preview, editing, download, versions, conversational revision; no silent overwrite of human edits |
| R08 | P0 | History, search, rename, recoverable archive; leaving a Session does not stop real cloud execution |
| R09 | P0 | Connect a missing resource within the flow; state scope; block only dependent work |
| R10 | P0 | Explain retained progress, failure, and recovery; retry safe reads, never blindly replay uncertain important effects |
| R11 | P0 | User/tenant data and resource isolation; existing authorization covers ordinary operations |
| R12 | P0 | Restore authoritative execution state; never fabricate completion or recovery |
| R13 | P1 | Simple daily/weekly schedules with timezone, next occurrence, pause/resume, missed-tick policy, run history |
| R14 | P1 | Visible, editable, removable long-term preferences with provenance; memory cannot grant authority |
| R15 | P1 | On-demand desktop, Edge, device, and specialist Agent integration; connectivity differs from capability readiness |
| R16 | P1 | Event triggers expose specific sources/conditions; runtime handles deduplication/merging, without a workflow builder |
| R17 | P0 | Natural Chinese, keyboard use, narrow-screen core flows, aligned bilingual documentation |

R13–R16 are designed in this set. The prototype implements schedule and memory interactions; actual connections, event sources, and device execution have explicit integration boundaries.

## Baseline and later work

**Baseline product:** default Agent, one cloud environment, conversation/context, activity, artifacts, reliable stop/recovery, history, minimal connections. Runtime uses one active coordinator, serialized Sessions, durable Run/Task/Attempt state, and business acknowledgements.

**Next:** simple schedules, explicit memory management, one desktop/Edge adapter, specialist delegation. Add devices and event rules for actual user goals, not as launch prerequisites.

**Conditional:** multi-Agent administration, complex workflows, skill marketplace, team roles, arbitrary state migration, multi-active failover, offline grants, and strict shared spending ledgers. Each needs a concrete requirement and cost justification. Do not expose model-parameter panels or policy editors to everyone by default.

Identity, model credential configuration, file storage, and the real runtime remain production implementation work. The prototype does not connect identity services or collect credentials; production still needs identity and data isolation.

## Measurement targets

These are hypotheses, not measured results: first-time users complete a delivery without help; a typical user submits an effective first goal within 30 seconds; at least 4/5 formative-test participants find and revise an artifact; every stop/recovery test avoids false success and duplicate uncertain submissions.

Measure effective goal submission, missing input, connection blockers, artifact open/edit/download, follow-up, stop requested/confirmed, and recovery outcome. Use anonymous events and object references rather than message bodies, file contents, or private reasoning. Build analytics infrastructure only when needed.

## Definition of done

Requirements, interactions, domain states, and acceptance align; the prototype covers primary flows with honest simulation labels and passes visual/responsive review. Production additionally requires real models, persistence, adapters, identity, reconciliation, and fault acceptance. Screenshots are not production proof.
