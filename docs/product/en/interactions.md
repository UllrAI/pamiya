# Interaction specification

[Index](README.md) · [简体中文](../zh-CN/interactions.md) · [Acceptance](prototype-and-acceptance.md)

## 1. First use and a goal

Home shows Pamiya, conversation history, and “有什么想交给我？” (What would you like to hand over?). Start immediately without an onboarding wizard, workspace setup, or tool configuration. Production sign-in handles identity only; the deployer supplies a default model and cloud execution.

The composer supports multiline input, attachments, drag/drop, and `@` references to files/conversations. Enter sends, Shift+Enter inserts a line, and IME composition does not send. Blank input disables send. Attachments alone can use a default synthesis request, then accept more direction. Drafts survive conversation switching.

Production attachments distinguish reading/uploading, ready, failed, and unsupported states. Incomplete material is not already-read context. Explain alternatives for large files. The prototype accepts up to 5 MB per file and reads at most 20,000 text characters. PDF/images retain metadata with an explicit unparsed notice; nothing is uploaded to an external service.

Submission opens the conversation, shows the user's message and a short action statement, then advances. Do not ask permission to start a sufficiently clear request. Titles are generated and editable. On production network failure, retain the draft and reuse a stable request ID.

## 2. Execution and steering

A concise expandable activity says what is happening, such as reading materials or refining a plan. Detail shows occurred tool activity and sources, without invented percentages, fixed stages, or private reasoning. Ordinary read recovery happens automatically rather than through permission dialogs.

During execution, new direction joins the current goal at the next applicable boundary. Acknowledge its receipt. If it replaces or conflicts with the goal, a production Agent explains what would be abandoned and offers stop-current or next-round treatment. Two control loops must not concurrently modify the same environment. The prototype records all active-round messages as steering; it does not understand replacement semantics.

Leaving for another conversation does not stop real cloud execution. Required input appears on the affected conversation. Results appear in-app by default; system/email/message notifications require a user choice. Unseen output is not marked read.

## 3. Essential clarification

Ask a specific question only when audience, purpose, or missing input materially changes the result. “Who is this introduction for?” offers new users/team/investors plus free text. Answering resumes the same round without recreating its tool intent.

Do not block for every absent deadline or font preference. Use reasonable stated assumptions. Users can leave a waiting conversation or end the round while retaining context.

## 4. Connections and authorization

Name the missing resource and purpose in context, then offer connect, alternate material, or end round. The connection dialog shows object, scope, and real state. Clicking connect grants that specific scope; do not add a second generic confirmation.

Production uses the relevant OAuth/local-agent flow. Credentials stay out of conversation text and model context. Resume the same Run after connecting. Failures retain goals and progress. Revocation stops newly scheduled dependent operations while tracking in-flight work; other resources/conversations remain usable.

Desktop, Edge, and device selection appears only for relevant work. Select an environment or physical device; Worker describes execution ownership. “Connected, camera unavailable” is more useful than one online indicator. Specialist delegation shows its goal, progress, artifacts, and actual stop support. A remote timeout queries the existing remote task ID rather than creating another specialist task.

## 5. Completion and artifacts

Completion provides a conclusion, artifact access, and relevant limits rather than just tool success. Opening a document reveals the artifact pane; narrow layouts switch to an artifact view. Closing restores the conversation context. Provide title, current version, edit, download, and close.

Editing uses Markdown text. Save creates a version; historical versions can be viewed/downloaded. Ask save/discard/continue only when canceling, closing, or switching would lose changed human content. Unchanged content needs no warning. Viewing history does not replace current content; editing is disabled there.

Conversational follow-up updates the same artifact and retains human work. Production compares base versions so a late result cannot silently overwrite an edit. The prototype appends revision text to simulate intelligent editing; it does not perform actual semantic revision.

A concise answer may itself be the result; not every question needs a document. Unsupported preview formats still provide type, size, and download rather than pretending a blank pane is a preview.

## 6. Stop, failure, and uncertainty

| State | Copy and action | Meaning |
|---|---|---|
| Advancing | Stop; steering input | Current goal continues |
| Stopping | No new work; waiting for the current operation to exit | Stop request recorded, not completed |
| Stopped | Retained content; send another message | Required in-flight work has exited or entered explicit reconciliation |
| Read failed | Retained progress; retry read/end | Safe retry adds an Attempt to the same intent |
| Submitted result unknown | Query acknowledgement; other conversations continue | No blind replay of an important submitted effect |
| Missing connection | Connect, replace context, or end | Only dependent work blocks |
| Missing input | Quick answer or free text | Save context and release compute |
| Recovering/interrupted | Read authoritative state; explicitly continue if needed | No false failure on disconnection or invented background execution |

Stop cannot undo a completed publish, order, or message. Query business state first, then report completed, absent, or still unknown with evidence. If no reliable query exists, identify the exact item requiring human reconciliation, without freezing unrelated work. The prototype's submitted-notification scenario queries a simulated receipt without resubmission.

Stopping a parent Run prevents new descendants and tracks existing children. If a remote Agent cannot stop, show that limitation and continue tracking it. Do not cover a running remote Agent with a generic stopped label. Resuming recoverable work differs from resuming future schedule triggers; arbitrary tools/Agents do not promise pause/resume.

## 7. History and context reuse

History follows recent activity and supports title/content search, rename, and recoverable archive. Archive offers undo; search can include archived content. Running work and uncertain important effects are handled before hiding a conversation.

`@` selects a specific historical conversation and adds a removable context chip. Production records the selected version/range. One reference does not grant access to all history. Truncate long titles in navigation, but show full names when managing them.

## 8. Continuing responsibilities

Create from a conversation or More. Ask only name, goal, daily/weekly frequency, time, and timezone. Show the exact next occurrence before save. The prototype offers Asia/Shanghai and UTC; production uses IANA zones and defines repeated/missing DST-time treatment.

Baseline missed ticks are skipped, not replayed as a backlog. An overlapping occurrence merges into the active pending window rather than concurrently changing the same environment. Pause disables future triggers only; stop an active Run in its conversation. Resume starts at the next future occurrence.

Show enabled state, next occurrence, and the latest Run. Prototype “模拟触发” creates a demonstration conversation. It registers no background timer, sends no notification, and does not run after closing the page. Removing a schedule offers undo.

Event rules follow later: choose a trusted source, such as new files in a specified directory, a simple condition, and a goal. Show cooldown/merge policy, enablement, and latest Run. The server persists rule versions and event deduplication. Users do not configure an event bus or call a model for every telemetry sample.

## 9. Memory, settings, and data

Memory shows content and provenance and supports explicit add/edit/delete with undo. Do not start with automatic extraction, vector-database consoles, or layered memory settings. Preferences affect expression/context, not resource authorization.

Settings contain actual needs and demo-data export, not leases, retry counters, Topics, or model temperature. Production also needs account, revocation, and data management, without displaying every capability on home.

Prototype data lives in the browser. Storage failure explicitly reports unsaved changes and allows artifact download/data export. Refresh preserves saved messages and versions but marks local simulation interrupted; uncertain submitted effects still reconcile. Cross-browser/tab merging, cloud sync, and disaster recovery are outside the prototype.
