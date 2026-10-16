# Prototype and acceptance

[Index](README.md) · [简体中文](../zh-CN/prototype-and-acceptance.md) · [Prototype guide](../../../prototype/README.md)

## Delivered scope

`prototype/` uses React/Vite, Phosphor icons, and Markdown rendering. `prototype/design/selected-home.png` is the approved reference. State changes within one page implement the flows without a routing framework, application backend, or general workflow engine.

| Implemented interaction | Simulation/limit |
|---|---|
| Home, sidebar, conversation, active steering | No real model; arbitrary goals use a fixed example document and revision sections |
| Expandable activity, clarification, connection blocker, read retry | Preset local scenarios rather than actual tool results |
| Stop requested/confirmed, uncertain submission reconciliation | Notification submission is simulated; nothing is sent |
| Artifact preview, text edit, download, version history | No cloud storage, collaboration, or cross-tab merge |
| Search, rename, archive/undo | Browser storage, no accounts/cross-device sync |
| Text files, drag/drop, historical context | 5 MB/file; 20,000-character text limit; binaries retain metadata only |
| Daily/weekly schedule, zones, pause, manual trigger, Run entry | Asia/Shanghai and UTC only; no background scheduling |
| Explicit memory CRUD/provenance/undo, data export | No silent extraction or claims of a model remembering |

Real integrations retain the home mental model. Models/tools live behind service adapters, resources enter through connections, and runtime facts project into activity and artifacts.

## Prototype and production differences in product baseline 0.3

The prototype implements goal-origin/revision links, limited rule-based steering/question/replacement/follow-up treatment, withdrawal/holding, alternate material, attention groups, and specific result read markers. Archive only organizes history, retaining execution and actions; existing browser data migrates. No Work/Project management entity is added. R18–R19 have local simulated interactions and tests; real semantic understanding, identity, authoritative backend, cross-client sync, and remote stop remain outside this acceptance. The DSH plugin is unchanged in this revision.

## Walkthrough

1. Submit a goal, inspect activity, and add direction during work. It belongs to the same round.
2. Open the result, edit/save, view a historical version, download, then ask for another revision.
3. Open “原型预览” or “更多 → 体验演示” for clarification, missing connection, read recovery, and uncertain submission.
4. Stop an active round and observe stopping before stopped. No late artifact is created.
5. Under “更多 → 持续安排”, enter name, goal, frequency/timezone, inspect next occurrence, simulate a trigger, then pause future triggers.
6. Add/edit/delete/undo a memory; search, archive, and recover a conversation. Refresh retains saved content.

Refresh interrupts local simulation and offers explicit continuation. A real client instead reconnects to authoritative runtime state; local simulation behavior is not a cloud execution contract.

## Acceptance matrix

| ID | Scenario | Required result |
|---|---|---|
| A01 / R01–R03 | Submit without tool setup | Start immediately; one Run per intent; blank disabled |
| A02 / R02 | IME, files, references | No accidental send; removable context; unparsed files never claimed read |
| A03 / R05 | Steering during work | Same Run retains input; no duplicate submission |
| A04 / R04 | Missing audience | One specific question; quick/free answer resumes |
| A05 / R09 | Missing workspace | Specific purpose/scope; connection resumes original flow |
| A06 / R10 | Read failure | Retain progress, retry same intent in a new Attempt |
| A07 / R06 | Request stop | Stopping then confirmed stopped; no new descendants |
| A08 / R06, R10 | Submitted with unknown receipt | Query only, no blind retry; unrelated conversations proceed |
| A09 / R07 | Edit and follow up | New version, retained history/human work |
| A10 / R07 | Close unsaved edit | Save/discard/continue; history view does not alter current |
| A11 / R08 | Search/name/archive | Search hits, recovery, no hidden important unresolved work |
| A12 / R12 | Refresh/storage error | Saved data survives; explicit local interruption/unsaved warning |
| A13 / R13 | Daily/weekly zones | Correct future occurrence; pause does not stop current Run |
| A14 / R14 | Memory management | Visible source, editable/removable/undoable, no authorization expansion |
| A15 / R17 | Keyboard, 390 px, tablet | No hidden persistent controls/overflow; accessible dialogs |
| A16 / R11, R15–R16 | Real identity/devices/events | Production integration acceptance, not claimed by this prototype |

Executable model tests cover stop, uncertainty, retry, steering, refresh, versions, and timezone boundaries. Browser checks cover main flows and UI states. [QA](../../../prototype/design-qa.md) records actual checks, not an automatic pass for every production requirement.

## Additional product acceptance for this revision

Use the same report scenario to validate lifecycle, message treatment, and return entry, supplementing A01–A16. Local model tests cover the relevant state boundaries; QA records browser checks and untested cases. Production behavior needs separate acceptance.

| ID | Scenario | Required result |
|---|---|---|
| A17 / R18, R07 | Revise after delivery on another day | Return to original goal/artifact; link a new Run without reviving the old one; retain artifact identity/versions |
| A18 / R05, R18 | Steering, questions, and mixed messages during execution | Shortening joins the current Run; the question gets an answer without changing the goal or conflicting execution; handle mixed intents separately; distinguish receipt/application |
| A19 / R05, R06, R18 | Explicit replacement | Stop old descendants and track in-flight effects; new goal has a new origin/Run; retain old results and hold old follow-ups; no conflicting start before uncertain stopping settles |
| A20 / R05, R12 | Follow-up, withdrawal, refresh | Original goal unchanged; inspect/withdraw pending text; no loss/duplicate queue on refresh; create subsequent Runs in order after success; already-started withdrawal becomes stop |
| A21 / R05, R06, R10 | Follow-ups after stop, final failure, or reconciliation | Hold with continue/withdraw; stop does not immediately launch the next request; future schedules are not paused by default; unresolved effects remain visible |
| A22 / R09, R18 | Replace material after a connection blocker | Remove original dependency and resume the same Run when sufficient; otherwise state remaining gaps without unconditionally requiring the old connection |
| A23 / R19, R08, R12, R17 | Return through attention | Reachable on desktop, collapsed sidebar, and 390 px; locate original question/artifact; deduplicate reports/versions per work without merging independent goals in one message; opening list does not clear count |
| A24 / R19, R10 | Read versus resolved | Viewing an issue leaves Needs your action until resolution; ending cannot clear uncertain effects; viewing the specific result marks it read, without clearing later results |
| A25 / R19, R08, R12, R13 | Pagination, archived sources, schedules, sync failure | History limits cannot hide unresolved/unread work; archive can organize ongoing conversations while work and attention remain; schedule pause retains prior issues; sync failure never fabricates an empty list |
| A26 / R18, R02 | Reference ongoing work from a new conversation | Select context and offer return to original without copying execution; only a separate goal gets a new origin, retaining provenance |

End-to-end order: request report → shorten and ask for evidence → supply alternate material → queue and withdraw a follow-up → leave → supply missing input through attention → view delivery → revise the same artifact the next day. Replacement, stop, and held requests are exception branches of this scenario. Formative testing also checks whether users can explain what happened without knowing Session, Run, or Task.

## Production integration order

1. Identity/Session service, model, one cloud executor, and object storage; serialized Sessions, stable intent IDs, durable results.
2. Replace local ticks with service events; implement goal-origin/revision links, message treatment and withdrawable follow-ups, holding after stop, idempotent submission, cursor reconnection, cancellation acknowledgement, important-effect queries, conditional artifact writes, and attention/read projections. Prioritize A17–A26.
3. One needed connector; verify scope, revocation, capability readiness, environment invalidation; then scheduling service and minimal memory storage.
4. Desktop/Edge/devices, specialists, and event rules as user goals justify them; verify environment ownership, remote task tracking, and actual stop support.

Each step delivers a complete usable loop. Unenabled enhancements are not baseline gates. Production fault acceptance still follows [reliability](../../en/reliability.md).
