[简体中文](../zh-CN/README.md) · **English**

# Pamiya architecture

Pamiya separates the long-lived responsibilities of a Personal Agent from its harness, durable state, and heterogeneous execution network. The target architecture combines a logically centralized **Control Plane**, a durable **State Plane**, and a pluggable **Execution Network** with capability discovery and routing. MQTT connects remote Workers; tool execution and Agent delegation share task tracking while retaining different execution semantics.

Design baseline: **0.1 · 2026-10-14**. This set describes architecture proposals; the implemented DSH plugin is documented separately in [installation and usage](dsh-plugin.md). Implement the lightweight baseline first; enable stronger mechanisms when their triggering requirements appear.

## Reading order

| Document | Question | Audience |
|---|---|---|
| [Architecture patterns](architecture-patterns.md) | Why separate control, state, and execution; when MQTT fits | Product and architecture reviewers |
| [Platform architecture](platform-architecture.md) | Module responsibilities and authoritative state | Platform and backend developers |
| [Capabilities and protocol](capabilities-and-protocol.md) | Discovery, authorization, addressing, and invocation | Protocol and SDK developers |
| [Reliability](reliability.md) | Duplicates, reconnects, cancellation, and uncertain effects | Runtime and Worker developers |
| [Technology and roadmap](technology-and-roadmap.md) | BifroMQ, Tenon, ESP32, interoperability, and delivery | Technical leads |
| [Scope and decisions](scope-and-decisions.md) | Baseline requirements versus conditional enhancements | Reviewers and implementers |

Read the first two documents for the system model, then the protocol and reliability documents before implementation. The roadmap defines delivery order. Scope and decisions explains the complexity tradeoffs. Every reference to the baseline uses the [same deployment assumptions](architecture-patterns.md#initial-implementation-baseline); do not accumulate conditional enhancements into baseline acceptance criteria.

## Key decisions

1. A Personal Agent owns long-term goals and responsibilities. A harness advances the model/tool loop. Platform identities remain stable. Side effects managed by the platform go through Task Runtime; runtimes whose built-in tools cannot be intercepted enter through delegation. Migrating an in-progress vendor session requires separate validation.
2. State Plane is authoritative for platform state. MQTT messages and MQTT Sessions do not replace Agent Sessions, Tasks, or execution records.
3. Worker, Environment, and Device have distinct identities and responsibilities, even when their storage is shared.
4. Capability Registry describes and indexes abilities. Harnesses use authorized tool interfaces rather than constructing MQTT Topics.
5. Tool Execution accepts concrete operations; Agent Delegation accepts goals. A third-party Agent may own its harness and internal state.
6. The baseline persists intent, Attempts, results, and cancellation records; serializes each Session and device; and reconciles uncertain important effects. Task tables plus a Dispatcher are sufficient. Resource fencing, renewable leases, signed grants, and automated disaster recovery are conditional enhancements.
7. Always-on means trusted events, deterministic rules, and on-demand activation, not continuous model execution.
8. Evaluate BifroMQ first as the MQTT Broker. Tenon is an optional integration runtime, not the durable task core.

## Facts and proposals

The data model, Topics, JSON messages, state names, and delivery phases are platform design proposals. They do not claim wire compatibility with an external standard. A2A, MCP, and their MQTT profiles require version-pinned adapters; internal examples are not standard protocol messages.

Official links support third-party capability statements. The Dot/Codex example illustrates delegation, not OpenAI's internal architecture or transport. MQTT and camera capabilities for ESP32 are proposed extensions, not features claimed for the original iPhone project.

[DSH plugin installation and usage](dsh-plugin.md).

[User quickstart and installation](quickstart.md) · [Installation task for DSH](install-with-dsh.md).

[Agents, model sharing and custom actions](agent-workers.md).
