[简体中文](../zh-CN/scope-and-decisions.md) · **English**

# Pamiya baseline scope and architecture tradeoffs

Pamiya preserves control/state/execution separation while implementing a lightweight baseline. Cross-node takeover, offline authority, strict shared spending and automated disaster recovery follow concrete requirements; they are not universal prerequisites for every Task.

Navigation: [Index](README.md) · [Protocol](capabilities-and-protocol.md) · [Recovery](reliability.md)

## Baseline requirements to retain

| Requirement | Why | Smallest implementation |
|---|---|---|
| Durable Task/Attempt | Identify ownership/progress after a crash | Task table, rounds and conditional updates |
| Recoverable delivery and result ACK | MQTT does not establish business completion | Scanner, ACCEPTED, terminal result, RESULT_ACK |
| Tool-intent and execution deduplication | Duplicate model output/commands must not repeat actions | Stable tool_call_id/event_id and one local execution record |
| Serial Session and device | Context/physical conflicts are real | One active coordinator, fixed owner, occupancy/local queue |
| Minimal identity and scope isolation | Tenants/user devices cannot invoke each other's work | TLS, credentials, Topic ACL and resource/capability checks |
| Start validity and cancellation | Reconnect does not authorize stale work | start_deadline, max_runtime_ms, canceled flag |
| File references and association | MQTT is not the entire data path | Unique keys, digests, upload verification and references |
| Reconcile uncertain important effects | Retransmission cannot resolve whether an action happened | Query or observe, no blind replay |

Implement these within existing objects. Inbox is a deduplication responsibility, not necessarily a service. A cancellation tombstone is a small Task record, not a separate system. Approval is a conditional state, not a prerequisite policy engine.

## Complexity reductions

| Former tendency | Cost | Baseline choice | Reintroduction trigger |
|---|---|---|---|
| Leases, fences and renewal on every Task | Little benefit without takeover | Attempt identity, occupancy, short-task validity | Multiple controllers/Workers take over one resource |
| Signed Grant and online check on every action | Duplicate authority within a trusted authenticated boundary | Control checks, ACLs, fixed scope | Offline authority, cross-organization trust, strict revocation |
| Registration epoch, challenge and Broker events together | Several overlapping reachability mechanisms | connection_id, exchange and heartbeat | Demonstrated registration/scale requirements |
| Independent RuntimeStep, Approval, TriggerRecord and BudgetReservation systems | Domain concepts become infrastructure too early | Checkpoint on Run, tool/approval on Task, trigger on Event | History, complex rules or parallel budgets |
| Mandatory staging/copy/finalize for all files | Additional network/storage work | Native create-once/version plus digest/reference | Untrusted upload, scanning or evidence sealing |
| control_epoch as an initial release gate | Manual recovery becomes a disaster-recovery platform | Suspend, stop stale process, reconcile manually | Automatic recovery, surviving old controllers, offline grants |
| Full budget-reservation/settlement ledger | Runtime limits become billing infrastructure | Iteration/time/count/concurrency limits, usage records | Strict shared spending or usage billing |
| Full windows, rule versioning and historical replay | Too much for basic proactive activation | Freshness, filtering, cooldown, deduplication | Actual window/replay/audit needs |
| Every conditional fault test as a baseline gate | Tests for absent features block delivery | Test implemented behavior and basic recovery | Add tests with the enhancement |

Single-active does not ignore concurrency: retain conditional task updates, tool uniqueness and local serial execution. Introduce correct resource fencing before enabling takeover, not while it has no enforcement role.

## Protection proportional to the requirement

| Overprotective tendency | Appropriate behavior |
|---|---|
| Every side effect needs another approval | Existing authorization covers execution; ask only for insufficient scope or an explicit policy |
| Every unknown result needs a human | Retry reads, reobserve navigation; reconcile important unqueryable one-shot effects manually |
| Every HID click excludes all human concurrency | Recover ordinary navigation/scroll drift; verify consequential submits |
| One uncertain device freezes all work | Pause the conflicting resource; other Runs/devices/reads continue |
| Trust no component after authentication | Trust authenticated Control and owned Workers within the baseline, while checking Schema/scope/validity/state |
| Cancellation instantly removes all in-flight work | Observable best-effort stop; immediate revocation is a separate requirement |

Signatures, containers and approvals are useful at the relevant authority/isolation boundary, not inherently safer when stacked. Untrusted cloud code needs a sandbox. A fixed-instruction ESP32 does not need the same isolation implementation; authorized desktop file work does not automatically require cloud approval.

Persist one tool intent or delegated goal, not a Task per mouse calibration, scan code, image fragment or local poll. Streaming model tokens are not scheduling records. Preserve replies, tool correlations, results and checkpoints needed for recovery.

## Explicit baseline tradeoffs

The initial design does not promise multi-active automatic takeover, exactly-once irreversible effects, immediate offline-authority revocation, arbitrary lossless in-progress vendor migration or strict global spending caps. Add the corresponding contracts when the roadmap's triggers appear.

Do preserve Task versus Attempt, Device versus Environment, business result ACKs, tenant/user ownership and uncertain important-effect records. Remove redundant mechanisms without erasing boundaries implementers would have to rediscover.

## Verification and maintenance

Examples use baseline fields; conditional fields have separate triggers. Failure acceptance covers the baseline plus additional tests for enabled features. Keep JSON, links, domain correlations and diagrams aligned. Worker, Broker, SDK and device behavior require implementation validation.

For each new mechanism, specify its trigger, prevented failure, why current behavior is insufficient, and the smallest viable alternative. A feature with no current requirement or clear trigger is not a baseline gate.
