# Pamiya product and interaction design

[简体中文](../zh-CN/README.md) · [Repository](../../../README.md) · [Architecture](../../en/README.md)

**Product design baseline 0.3 · 2026-10-16 · A modern personal Agent.** Pamiya is first a persistent Agent to work with: express a goal, provide context, let it use tools and advance the work, then receive and improve a useful result. Task tracking, execution nodes, and protocols support this experience. This is a specification version, not a new plugin or prototype release.

These implementation-ready decisions start from the approved home-screen visual and cover requirements, domain/navigation, interactions, visual rules, and acceptance. They are design hypotheses, not validated user-research findings. Production requirements and the local prototype are explicitly distinguished.

| Document | Purpose |
|---|---|
| [Requirements and scope](requirements.md) | Positioning, use cases, priorities, acceptance goals, baseline boundary |
| [Information architecture and model](information-architecture.md) | Entry points, relationships, UI/runtime mapping, ownership |
| [Interaction specification](interactions.md) | First use, collaboration, artifacts, connections, memory, schedules, recovery |
| [Visual system and components](design-system.md) | Approved visual, sizing, components, responsiveness, accessibility |
| [Prototype and acceptance](prototype-and-acceptance.md) | Implemented scope, walkthrough, acceptance matrix, production integration |
| [Open-source foundation](open-source-foundation.md) | MIT candidates, DSH reuse, compatibility gaps and adoption gate |

[Prototype guide](../../../prototype/README.md) · [Approved home](../../../prototype/design/selected-home.png)

The implemented DSH extension is documented in [installation and usage](../../en/dsh-plugin.md). It reuses the native Agent; the standalone prototype remains an experience reference.

## Experience

```mermaid
flowchart LR
  A[Express a goal and context] --> B[Agent understands and advances]
  B --> C[Use tools as needed]
  C --> D[Deliver a useful artifact]
  D --> E[Discuss and revise]
  E --> B
  B --> F[Request essential input or connection]
  F --> B
```

Home retains conversation, history, and tool connections, plus an attention entry when nonempty. Activity and artifacts appear when needed. Schedules, memory, and settings remain auxiliary; a task administration console is not the primary experience.

This revision focuses on [work lifecycle and ownership](information-architecture.md#lifecycle-of-a-piece-of-work), [messages during execution](interactions.md#2-execution-and-steering), and [attention on return](interactions.md#10-attention-on-return). They reuse messages, Session, Runs, and artifacts without another object users must create/manage. See [prototype and acceptance](prototype-and-acceptance.md) for pending differences and A17–A26.

The prototype has working local interactions and browser persistence. Model answers, tool execution, and external submissions are deterministic simulations. Schedules save configuration and allow manual simulation; nothing runs after the page closes. Prototype UI is Chinese; product and architecture documents have matching English and Chinese chapters.

The prototype now demonstrates goal links, message treatment, follow-ups, alternate material, and attention through local deterministic rules. Recognition covers explicit rules and user clarification, not a real model, background execution, or server synchronization. This does not establish these product interactions in the DSH plugin.
