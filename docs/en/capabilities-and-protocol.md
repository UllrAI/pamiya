[简体中文](../zh-CN/capabilities-and-protocol.md) · **English**

# Pamiya capability discovery and communication protocol

Above the Broker, Pamiya describes, indexes, discovers, authorizes and routes capabilities. Topics identify a communication target and message type; a Manifest explains the ability; Scheduler chooses the executor. This logical layer spans MQTT, HTTP, MCP and A2A.

Topics and JSON below propose the internal [baseline contract](architecture-patterns.md#initial-implementation-baseline). Enhanced protocols are enabled only for their triggering requirements; external compatibility belongs in versioned adapters.

Navigation: [Index](README.md) · [Domain model](platform-architecture.md) · [Reliability](reliability.md)

## Questions the capability layer answers

| Question | Information |
|---|---|
| Who | Worker/Agent, tenant, user and device identity |
| What | Ability name, semantics, input/output Schema, version |
| Where | Provider, Device, Environment and protocol Binding |
| How | Tool invocation, delegated goal, subscription or asynchronous execution |
| State | Connectivity, readiness, capacity and work state |
| Policy | Discovery and invocation scope, applicable approval |

Registry stores declarations validated against identity and policy. Resolver returns authorized candidates; Router translates Tasks into provider protocols. The Broker authenticates and routes messages rather than interpreting business capabilities.

## Topic contract

Use `agent/v1/{tenant_id}/workers/{worker_id}`. Validate IDs so `/`, `+`, `#` and similar characters cannot change namespace or subscription semantics.

| Suffix | Direction | Content | QoS | Retain |
|---|---|---|---|---|
| `/manifest` | Worker → Registry | Register/update capabilities | 1 | false; database owns the directory |
| `/registration` | Control → Worker | Accept, reject or request registration | 1 | false |
| `/heartbeat` | Worker → Presence | boot_id, connection_id, sequence, health and work summary | 0; 1 when needed | false |
| `/presence` | Worker/LWT → Presence | Current-connection reachability hint | 1 | optionally true with boot_id and connection_id |
| `/commands` | Control → Worker | EXECUTE, CANCEL, QUERY | 1 | false |
| `/task-events` | Worker → Result Ingest | Acceptance, progress, terminal outcomes and rejection | 1 | false |
| `/acks` | Control → Worker | RESULT_ACK and control responses | 1 | false |
| `/events` | Worker → Event Engine | Observations or business activation | telemetry 0/1; durable facts 1 plus EVENT_ACK | false |

Put ability names in the payload rather than creating a Topic per `hid.click` or `camera.capture`. Stable communication Topics simplify ACLs, versions and dispatch.

Retained information is a last declaration or hint, not current schedulability. Clear obsolete announcements on revocation, ownership transfer and removal; update the authoritative Registry. The baseline does not create a second authoritative retained Manifest directory.

Native Broker tenant isolation may permit omitting the tenant Topic segment through an Adapter; the baseline keeps it explicit. Identity comes from authentication, never the tenant/Worker fields claimed in a payload.

A subscriber's PUBLISH packet is not automatically a trusted publisher-identity assertion. Bind credentials, ClientID, tenant and Worker Topic prefix at the Broker. Result Ingest derives identity from its trusted tenant context and protected Topic, then cross-checks payload and task assignment. Plugin-added identity must be unforgeable; ordinary User Properties are not trusted identity. [MQTT PUBLISH](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

Native tenant isolation also affects subscription spaces. Do not assume one ordinary Control client sees every tenant. Choose a tenant-scoped connection pool or authenticated Broker management integration and verify both ingestion and dispatch. Workers cannot subscribe to other Workers' command or acknowledgement Topics.

## Registration and presence

1. Authenticate over TLS with independent credentials and a stable ClientID. Generate connection_id for each CONNECT and include it in that connection's LWT.
2. Subscribe to commands, then publish Manifest, protocol version and connection_id. Re-sending the complete Manifest is sufficient initially; no separate digest-negotiation protocol.
3. Registry validates identity, Schema, device binding and version, and returns registration. Use a fresh registration exchange; no baseline registration_epoch, challenge service or Broker connection-event dependency.
4. Worker reports unacknowledged results and active Tasks. Reconcile them, then derive schedulability from business heartbeat, readiness and free capacity.
5. Resolver filters by tenant, user, policy, device, environment and capacity. Scheduler checks again when assigning because discovery can become stale.

boot_id changes on process/firmware startup; connection_id changes on reconnect. Heartbeat sequence increases within a connection. Presence accepts current registration signals and prevents an old sequence/LWT from replacing the new connection state. A Will is fixed at CONNECT time; its embedded timestamp is not the disconnection time. Record observation time separately. Will Delay helps short interruptions but is not application ownership. [MQTT Will Delay](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

Replay current Attempts and unacknowledged results before accepting new work. QUERY reads persistent prior execution records; insufficient recovery data is unknown. Reconnect does not automatically replay side effects. Stronger registration generations and full inventory protocols follow demonstrated scale/integration requirements.

## Capability Manifest example

This describes a proposed camera/HID ESP32 Worker, not features claimed for the original open-source iPhone firmware. Machine-readable examples are identical in both languages.

```json
{
  "protocol_version": "1.0",
  "worker_id": "worker_esp32_01",
  "boot_id": "boot_01",
  "connection_id": "connection_01",
  "manifest_version": 3,
  "worker_kind": "embedded",
  "recovery_profile": "durable_ledger",
  "capacity": {"max_concurrency": 1},
  "device_ids": ["device_iphone_01"],
  "capabilities": [
    {
      "name": "camera.capture",
      "version": "1.0",
      "description": "Capture the bound phone screen with a camera.",
      "execution_mode": "tool",
      "input_schema": {
        "type": "object",
        "properties": {"device_id": {"type": "string"}},
        "required": ["device_id"],
        "additionalProperties": false
      },
      "output_schema": {
        "type": "object",
        "properties": {"artifact_id": {"type": "string"}},
        "required": ["artifact_id"],
        "additionalProperties": false
      },
      "retry_class": "read_only",
      "required_scope": "device.observe",
      "binding": {"transport": "mqtt", "contract_version": "1.0"}
    },
    {
      "name": "hid.click",
      "version": "1.0",
      "description": "Click once at a calibrated screen coordinate.",
      "execution_mode": "tool",
      "input_schema": {
        "type": "object",
        "properties": {
          "device_id": {"type": "string"},
          "x": {"type": "integer", "minimum": 0},
          "y": {"type": "integer", "minimum": 0},
          "observation_id": {"type": "string"}
        },
        "required": ["device_id", "x", "y", "observation_id"],
        "additionalProperties": false
      },
      "output_schema": {
        "type": "object",
        "properties": {"input_sent": {"type": "boolean"}},
        "required": ["input_sent"],
        "additionalProperties": false
      },
      "retry_class": "requires_reconciliation",
      "required_scope": "device.control",
      "binding": {"transport": "mqtt", "contract_version": "1.0"}
    }
  ]
}
```

Coordinate bounds, calibration version and observation freshness are validated against the Environment. `input_sent=true` means HID input was sent, not that the desired screen or business change happened. Verify the goal through subsequent observations as appropriate.

Declarations of retry policy, scope or risk do not lower platform requirements. Agent Cards and tool descriptions are external data, not authority.

recovery_profile declares whether acceptance, cancellation and final records survive restart or power loss. durable_ledger requires fault validation. volatile provides deduplication only within the surviving process; uncertain important effects after power loss require reconciliation. A declaration alone is not a validated recovery guarantee.

## Discovery and upper-level interfaces

A harness requests capabilities through the platform:

```json
{
  "operation": "capabilities.find",
  "required": ["camera.capture", "hid.click"],
  "device_id": "device_iphone_01",
  "execution_mode": "tool"
}
```

The authenticated caller and Session determine scope. Return authorized definitions, Schemas and opaque binding_id candidates. Models do not assemble Topics or bypass authorization by choosing Worker IDs. Same-named implementations are candidates for one logical ability; deterministic upper-level naming can distinguish them when required.

Registry can expose an MCP Server with tools/list, tool Schemas and list-change support. The referenced MCP version permits authorization-dependent lists, not arbitrary connection-private state changes. A busy Worker does not imply a tool definition disappeared. [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

Authorization determines visibility; dispatch handles current availability. Revalidate permission, ownership and Environment state at invocation.

## Tool command

```json
{
  "protocol_version": "1.0",
  "message_id": "cmd_01",
  "type": "EXECUTE",
  "task_id": "task_01",
  "attempt_no": 1,
  "action_id": "action_01",
  "run_id": "run_01",
  "worker_id": "worker_esp32_01",
  "target_boot_id": "boot_01",
  "environment_id": "env_iphone_01",
  "environment_generation": 2,
  "capability": "hid.click",
  "capability_version": "1.0",
  "start_deadline": "2026-10-14T04:00:10Z",
  "max_runtime_ms": 10000,
  "args": {
    "device_id": "device_iphone_01",
    "x": 120,
    "y": 360,
    "observation_id": "observation_01"
  }
}
```

Protected Topics establish routing identity; worker_id cross-checks the target. Time is UTC with an agreed skew tolerance. Reject new sensitive work when deadline validity cannot be established.

Use payload_ref instead of args for larger input and include digest/format metadata; they are mutually exclusive. Control checks tenant, user, capability, device and approval before dispatch. Worker accepts only protected command Topics and validates its capability, target scope, parameters and time limits.

The baseline trusts authenticated Control; each click does not call another authorization service or carry a signed Grant. Required approval scope/parameters belong on Task and are rechecked after material changes. Offline authority, untrusted Broker environments or cross-organization trust trigger an explicit ExecutionGrant contract.

### Control messages

| Message | Rule |
|---|---|
| EXECUTE | Immutable execution content remains identical for the same Attempt; changing message_id does not permit another effect |
| QUERY | Correlate by its own message_id and target Task/Attempt; report stored state or UNKNOWN without starting execution |
| CANCEL | Use its own message_id and target task_id; repeat cancellation with the same cancellation ID, never the EXECUTE ID |
| CONTROL_ACK | Report cancellation registration or actual stop through task-events; registration is not proof of stopping |

Task cancellation is one-way. Re-execution uses a new Task, so no baseline cancel_generation is needed. Short work uses start_deadline and max_runtime_ms, measured with a local monotonic clock; timeout is not proof of stopping. Continuous motion uses local control and stopping constraints.

Only EXECUTE uses start_deadline. CANCEL/QUERY have their own validity so an expired start deadline does not prevent stopping or reconciliation. In-flight commands can race cancellation: after registering CANCEL, Worker rejects old execution, but the platform cannot promise all published commands disappear at the moment cancellation is requested.

### Conditional fields

| Trigger | Enhancement |
|---|---|
| Multiple controllers automatically take over a resource | lease_token, resource-scoped resource_fence and resource-side validation |
| Long execution needs takeover, revocation or renewable authority | LEASE_RENEW_REQUEST, LEASE_GRANTED and lease_revision |
| Authority must be usable without online Control | Time-bound, parameter/resource-bound signed ExecutionGrant |
| Automatically resume dispatch after authoritative database rollback | control_epoch and execution-ledger reconciliation |

Define and validate new semantics when enabling these requirements; do not put every field on short Tasks. A lease/fence constrains only a resource that actually enforces it and does not prove an external effect stopped.

## Results and acknowledgement

```json
{
  "protocol_version": "1.0",
  "event_id": "evt_01",
  "type": "COMPLETED",
  "task_id": "task_01",
  "attempt_no": 1,
  "action_id": "action_01",
  "worker_id": "worker_esp32_01",
  "boot_id": "boot_01",
  "occurred_at": "2026-10-14T04:00:05Z",
  "effect_status": "confirmed",
  "output": {"input_sent": true}
}
```

Use output for small results and result_ref for large results; they are mutually exclusive. Commit the result event, classification and applicable state change before acknowledging:

```json
{
  "protocol_version": "1.0",
  "type": "RESULT_ACK",
  "event_id": "evt_01",
  "task_id": "task_01",
  "attempt_no": 1,
  "disposition": "applied"
}
```

disposition may be applied, duplicate, stale or quarantined. Keep a durable handling record for each. ACK means the platform processed the event, not that the user goal succeeded. Old Attempts may supply reconciliation evidence but cannot overwrite new execution. Quarantined events retain an owner and a resolution path.

effect_status is not_started, confirmed, partial or unknown, independently of success/failure/cancellation. Deduplicate by event_id and constrain Task/Attempt transitions. A terminal event may arrive before ACCEPTED. Add sequence/cursor restoration only when reconstructible streaming progress is required, not as a mandatory embedded event log.

Results retain the boot_id of the execution that produced them. After reboot, retransmit a stored result without rewriting that identity; validate it against the recorded Attempt rather than only the current presence boot_id. A new boot cannot execute an old target_boot_id command, but QUERY can recover its prior record.

ACCEPTED means validation and acceptance registration, RUNNING means execution began, COMPLETED means the capability contract completed. Persistence and recovery limits are defined in [Reliability](reliability.md).

## Artifacts and object permissions

payload_ref/result_ref identify an Artifact with artifact_id, object_key, digest, size and media_type. A short-lived URL grants transport access; refresh it for the same Artifact without substituting input.

Use a unique key per artifact. After upload, verify existence, size and digest and associate it with the result transaction. Native create-once conditions or object versions can fix content; no separate finalize service or mandatory staging-copy pass for every file. S3 conditional writes can prevent replacement; check the selected store's actual support. [S3 conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)

Object storage and database writes are not one transaction: upload/verify first, then commit references. Delay cleanup of unreferenced objects and retain pending-result artifacts. Retry failed uploads without rerunning the completed tool. Approval/evidence inputs use fixed content or a digest, not only a mutable URL.

Presigned URLs can be reused while valid and may overwrite the same key. They are not single-use tokens. Staging/finalize, quarantine and additional proxies are conditional on untrusted uploads, scanning or evidence-preservation requirements. [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)

## Event ingress and reliable activation

Distinguish telemetry from durable_event by business need. Telemetry may be dropped/coalesced under source configuration; not every message needs a class field or local journal. Important non-lossy facts use stable event_id, a source record/replay path, and EVENT_ACK after platform persistence. PUBACK does not replace that ACK.

EVENT_ACK confirms ingestion, not execution. Keep processing state and run_id on Event. Atomically create Run and trigger handling; scan unresolved events. A rule-version/window/replay platform or separate TriggerRecord service is unnecessary initially. Webhooks acknowledge after commit, and schedules deduplicate occurrences.

Reconnecting does not turn the same recorded fact into a new event. Windows, watermarks, replay and event sourcing follow actual needs. Ordinary device notifications use freshness, simple filters and cooldowns.

## Delegated Agent state mapping

Delegation does not reuse every atomic-tool message. Adapter stores delegation_id, remote task/context, original remote_state, input round and resume cursor. Need for information maps WAITING_INPUT; authorization maps WAITING_APPROVAL. Continue the original remote task after resolving either condition.

Keep delegation_id stable across sends of the same create intent. Do not transparently create a second Runtime after a terminal outcome. A deliberate redo reconciles prior effects and authority and creates explicit new work. Third-party Agent control depends on its API rather than forcing MQTT heartbeat, Worker leases or resource fencing.

A stable local delegation_id prevents duplicate local intent, but cannot by itself deduplicate remote creation. Require provider idempotent creation or a queryable client correlation ID. If creation times out without either, keep the Task RECONCILING and discover the original remote task before another creation; declare this adapter limitation.

Map submitted/working to ACTIVE, completed/failed/canceled to respective outcomes, rejected to FAILED with rejection_reason, and input/auth-required to waiting states. Exact strings, errors and terminal behavior depend on the pinned A2A version. Waiting is not LOST or a reason to create another Agent. [A2A specification](https://a2a-protocol.org/latest/specification/)

For long operations exposed through MCP, use supported task interfaces or start/query/cancel tools that quickly return task_id. RPC timeout/cancellation does not prove the underlying Task stopped; query its identity instead of transparently creating another effect.

## MQTT parameters and business validity

| Parameter | Rule |
|---|---|
| Command QoS | Default 1 plus business acceptance/terminal confirmation |
| Retain | false for execution, cancellation and query |
| Message Expiry | Remaining start validity for EXECUTE; request validity for controls |
| Session Expiry | Offline tolerance, Broker capacity and identity lifecycle |
| Will Delay | Reduce transient offline noise, not establish task ownership |
| Keep Alive | Connection activity, not tool health |
| Heartbeat | Capability readiness, free slots and current work |

Expiry affects messages whose delivery has not begun, not work already queued locally. Worker separately checks start_deadline and max_runtime_ms. Retransmission does not extend the original start deadline. Publishing and subscribing QoS must meet the important-result contract. [MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html)

## A2A, MCP, and MQTT responsibilities

| Target | Semantic contract | Transport or wrapper |
|---|---|---|
| Professional Agent with its own harness | A2A or equivalent goal API | Native API/HTTP or validated MQTT binding |
| Desktop, browser and business tools | MCP or platform Tool interface | HTTP, MCP Adapter, optional MCP over MQTT |
| Embedded controllers/sensors | Lightweight Worker contract | Native MQTT, optionally wrapped by Edge MCP |

A2A describes Agent Cards, tasks, states and artifacts for autonomous work. MCP describes tools/resources. MQTT can transport either; a MQTT client is not inherently an A2A Agent. [A2A](https://a2a-protocol.org/latest/specification/)

EMQX A2A over MQTT defines discovery and request/response/task mappings, including `$a2a/v1/discovery/{org_id}/{unit_id}/{agent_id}`. It is an external Profile, not Pamiya's `agent/v1/...` contract or a Registry automatically supplied by every Broker. [A2A over MQTT 0.1](https://www.emqx.com/mqtt-for-ai/a2a-over-mqtt/specification/0.1/basic/mqtt_transport.html)

Keep one internal Task/Capability/Delegation model and adapt pinned external contracts. MCP over MQTT is also conditional; resource-limited devices need not implement full MCP. [MQTT for AI](https://github.com/emqx/mqtt-for-ai)

## Authorization and versions

Broker ACLs scope Workers to their registration/reporting and command/ACK Topics. Only Control publishes execution commands and business ACKs. Control validates user/tool/device/environment authority; Worker checks target, parameters, validity and readiness. Bridging and management publishing must preserve the trusted identity boundary.

Object permissions grant only the current object and operation; logs do not contain usable tokens. Revocation or device transfer stops new work and reconciles in-flight actions. Start with Control policy, Broker ACL and fixed capability scope. Signatures, per-action checks and immediate-revocation proxies need specific requirements; strict revocation deadlines use an online pre-execution check, while other operations have an explicit short-lived authority window.

Separate Envelope, Capability Schema, Manifest and Firmware versions. Negotiate support at registration. Reject incompatible majors, unknown commands and unknown mandatory authority semantics. Optional extensions may be ignored; mandatory execution/security changes may not. Bound rolling compatibility, and pin unfinished Tasks to their original capability contract.
