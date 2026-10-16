# Interaction specification

[Index](README.md) · [简体中文](../zh-CN/interactions.md) · [Acceptance](prototype-and-acceptance.md)

## 1. First use and a goal

Home shows Pamiya, conversation history, and “有什么想交给我？” (What would you like to hand over?). Start immediately without an onboarding wizard, workspace setup, or tool configuration. Production sign-in handles identity only; the deployer supplies a default model and cloud execution.

Show the attention entry when actions or unread results exist, as specified in section 10; do not show an empty task panel on first use. No project creation or work-type selection is required. Pamiya derives a short expected delivery, such as a report with sources, and starts when sufficient. The [lifecycle and ownership](information-architecture.md#lifecycle-of-a-piece-of-work) use the original conversation, Runs, and artifacts.

The composer supports multiline input, attachments, drag/drop, and `@` references to files/conversations. Enter sends, Shift+Enter inserts a line, and IME composition does not send. Blank input disables send. Attachments alone can use a default synthesis request, then accept more direction. Drafts survive conversation switching.

Production attachments distinguish reading/uploading, ready, failed, and unsupported states. Incomplete material is not already-read context. Explain alternatives for large files. The prototype accepts up to 5 MB per file and reads at most 20,000 text characters. PDF/images retain metadata with an explicit unparsed notice; nothing is uploaded to an external service.

Submission opens the conversation, shows the user's message and a short action statement, then advances. Do not ask permission to start a sufficiently clear request. Titles are generated and editable. On production network failure, retain the draft and reuse a stable request ID.

## 2. Execution and steering

A concise expandable activity says what is happening, such as reading materials or refining a plan. Detail shows occurred tool activity and sources, without invented percentages, fixed stages, or private reasoning. Ordinary read recovery happens automatically rather than through permission dialogs.

Handle messages during execution by intent rather than treating all input as steering or requiring a question/command mode. Constraints compatible with the current delivery are steering; replacement means explicitly abandoning the current goal. Answers to current blocking questions first resolve that blocker.

| New message | Default treatment | Example feedback |
|---|---|---|
| “Make the report shorter” | Accept a constraint in the same Run and apply at the next available boundary | “Shorter length is noted; the next edits will follow it.” |
| “What supports that number?” | Answer while the current goal continues; needed reads use the same coordination/resource boundaries, without conflicting execution | “That number comes from… The report is still being prepared.” |
| “Drop the report; make a presentation outline” | Explicit replacement: stop new operations for the old goal and track in-flight work; when safe, use this message to start a new goal/Run linked to the old records | “Stopping the report, then switching to an outline; existing output will be retained.” |
| “After that, organize the attachments” | Save a visible follow-up without changing the current goal; create its Run only when started | “Queued after the report; you can withdraw it here.” |

A separate goal with no timing defaults to after the current work, with explicit feedback rather than silent replacement. Ask one specific question only when the goal, object, or ordering is unclear and consequential. Do not reapprove clear steering, replacement, or stopping. If answering, applying, or stopping must wait, explain why; “received” cannot imply it already took effect.

One message can combine steering, a question, and follow-ups. Handle them separately with combined feedback; these are not mutually exclusive message types users must learn. Clarify only the uncertain portion without blocking already clear work.

Distinguish receipt from application. Persist the message and its treatment before acknowledging receipt; update activity when actually applied. If the original round already ended, explain that the delivered version was unaffected and fulfill an explicit revision request through a linked new Run. Clarify ambiguous steering during stopping/replacement rather than restarting the old goal. Reconnection/duplicate delivery restores the same message treatment without duplicate queues, Runs, or goal changes.

Show follow-ups under current activity only when present, with their original text and withdrawal; do not add a general queue manager. After successful completion, start them in receipt order using currently valid authorization. A stop, final incomplete outcome, or uncertain important effect holds unstarted requests and offers continue-follow-ups/withdraw, avoiding immediate restart after stopping. Withdrawal affects unstarted requests only; if already started, say so and use normal stop semantics. Accepted requests and held status survive refresh.

Replacement keeps requests queued after the old goal on hold rather than treating them as follow-ups to the new goal. Continuing follow-ups cannot bypass the previous round's stop confirmation or required reconciliation. Explain the wait; independent work in other conversations can continue.

Leaving for another conversation does not stop real cloud execution. Required actions and unread results enter attention and link to the original conversation. Results appear in-app by default; system/email/message notifications require a user choice. Unseen output is not marked read.

The prototype demonstrates this treatment through limited Chinese rules, without real semantic understanding. “报告再短一点；这个数字依据是什么？完成后再整理附件” demonstrates mixed intent; “不要报告了，改成演示提纲” demonstrates replacement. Ambiguous input offers contextual clarification rather than making mode selection mandatory. Questions receive an explicitly simulated explanation; artifacts remain fixed examples and revision sections.

## 3. Essential clarification

Ask a specific question only when audience, purpose, or missing input materially changes the result. “Who is this introduction for?” offers new users/team/investors plus free text. Answering resumes the same round without recreating its tool intent.

Do not block for every absent deadline or font preference. Use reasonable stated assumptions. Users can leave a waiting conversation or end the round while retaining context.

## 4. Connections and authorization

Name the missing resource and purpose in context, then offer connect, alternate material, or end round. The connection dialog shows object, scope, and real state. Clicking connect grants that specific scope; do not add a second generic confirmation.

Production uses the relevant OAuth/local-agent flow. Credentials stay out of conversation text and model context. Resume the same Run after connecting. Failures retain goals and progress. Revocation stops newly scheduled dependent operations while tracking in-flight work; other resources/conversations remain usable.

Replace material allows a file or message to remove this goal's dependency on the original resource. Resume the same Run when sufficient; otherwise state only what remains missing. Do not accept alternate material while unconditionally requiring the original connection. Ending the round terminates this execution; a connection problem itself does not create another piece of work.

Desktop, Edge, and device selection appears only for relevant work. Select an environment or physical device; Worker describes execution ownership. “Connected, camera unavailable” is more useful than one online indicator. Specialist delegation shows its goal, progress, artifacts, and actual stop support. A remote timeout queries the existing remote task ID rather than creating another specialist task.

## 5. Completion and artifacts

Completion provides a conclusion, artifact access, and relevant limits rather than just tool success. Opening a document reveals the artifact pane; narrow layouts switch to an artifact view. Closing restores the conversation context. Provide title, current version, edit, download, and close.

Editing uses Markdown text. Save creates a version; historical versions can be viewed/downloaded. Ask save/discard/continue only when canceling, closing, or switching would lose changed human content. Unchanged content needs no warning. Viewing history does not replace current content; editing is disabled there.

Conversational follow-up updates the same artifact and retains human work. Production compares base versions so a late result cannot silently overwrite an edit. The prototype appends revision text to simulate intelligent editing; it does not perform actual semantic revision.

A concise answer may itself be the result; not every question needs a document. Unsupported preview formats still provide type, size, and download rather than pretending a blank pane is a preview.

On ending, briefly state actual delivery, incomplete parts, and reasons; unresolved effects remain visible. Recoverable read faults stay in recovery until a decision to stop pursuing them produces a final incomplete outcome. Questions after completion only receive an answer. Explicit revisions link a new Run in the original conversation and update the same artifact, without reviving old execution or copying the report. Goal, output, and versions remain findable on another day.

## 6. Stop, failure, and uncertainty

| State | Copy and action | Meaning |
|---|---|---|
| Advancing | Stop; steering input | Current goal continues |
| Stopping | No new work; waiting for the current operation to exit | Stop request recorded, not completed |
| Stopped | Retain content and allow another message; unresolved effects remain separately visible | Stop confirmed; unconfirmed remote execution still shows stopping/reconciliation |
| Read failed | Retained progress; retry read/end | Safe retry adds an Attempt to the same intent |
| Submitted result unknown | Query acknowledgement; other conversations continue | No blind replay of an important submitted effect |
| Missing connection | Connect, replace context, or end | Only dependent work blocks |
| Missing input | Quick answer or free text | Save context and release compute |
| Recovering/interrupted | Read authoritative state; explicitly continue if needed | No false failure on disconnection or invented background execution |

Stop cannot undo a completed publish, order, or message. Query business state first, then report completed, absent, or still unknown with evidence. If no reliable query exists, identify the exact item requiring human reconciliation, without freezing unrelated work. The prototype's submitted-notification scenario queries a simulated receipt without resubmission.

Stopping a parent Run prevents new descendants and tracks existing children. If a remote Agent cannot stop, show that limitation and continue tracking it. Do not cover a running remote Agent with a generic stopped label. Resuming recoverable work differs from resuming future schedule triggers; arbitrary tools/Agents do not promise pause/resume.

Stop execution defaults to stopping the current Run and holding unstarted follow-ups in this conversation, reporting their count. It neither undoes completed effects nor pauses future schedules. Explicit instructions to withdraw follow-ups or pause the related schedule also act on those scopes, with separate feedback. When no schedule is involved, add no extra confirmation or management step.

## 7. History and context reuse

History follows recent activity and supports title/content search, rename, and recoverable archive. Archive offers undo; search can include archived content. Archive does not stop execution, withdraw follow-ups, pause schedules, or mark results read. If work continues, explain that briefly without requiring each item to end first. Unresolved actions and unread results stay in attention and can open archived conversations directly. Opening alone does not restore the archive flag.

`@` selects a specific historical conversation and adds a removable context chip. Production records the selected version/range. One reference does not grant access to all history. Truncate long titles in navigation, but show full names when managing them.

When “continue that report from last time” has a clear reference, return to the original conversation/artifact; otherwise ask only which relevant source. A history reference in a new conversation first supplies material, without copying work still running. Start a separate goal only when explicitly requested, retaining provenance links.

## 8. Continuing responsibilities

Create from a conversation or More. Ask only name, goal, daily/weekly frequency, time, and timezone. Show the exact next occurrence before save. The prototype offers Asia/Shanghai and UTC; production uses IANA zones and defines repeated/missing DST-time treatment.

Baseline missed ticks are skipped, not replayed as a backlog. When the previous occurrence is still running, record this trigger as coalesced without starting conflicting execution. Pause disables future triggers only; stop an active Run in its conversation. Resume starts at the next future occurrence.

Each actual occurrence retains its source, conversation/Run, and result entry. Required actions and unread results use section 10, so users need not inspect every schedule. Pausing never clears earlier unresolved actions or unread results. Report disabling future triggers separately from ending a particular execution.

Show enabled state, next occurrence, and the latest Run. Prototype “模拟触发” creates a demonstration conversation. It registers no background timer, sends no notification, and does not run after closing the page. Removing a schedule offers undo.

Event rules follow later: choose a trusted source, such as new files in a specified directory, a simple condition, and a goal. Show cooldown/merge policy, enablement, and latest Run. The server persists rule versions and event deduplication. Users do not configure an event bus or call a model for every telemetry sample.

## 9. Memory, settings, and data

Memory shows content and provenance and supports explicit add/edit/delete with undo. Do not start with automatic extraction, vector-database consoles, or layered memory settings. Preferences affect expression/context, not resource authorization.

Settings contain actual needs and demo-data export, not leases, retry counters, Topics, or model temperature. Production also needs account, revocation, and data management, without displaying every capability on home.

Prototype data lives in the browser. Storage failure explicitly reports unsaved changes and allows artifact download/data export. Refresh preserves saved messages and versions but marks local simulation interrupted; uncertain submitted effects still reconcile. Cross-browser/tab merging, cloud sync, and disaster recovery are outside the prototype.

## 10. Attention on return

When nonempty, show “待处理” (Attention) before history with a count per piece of work. Keep an entry reachable with the sidebar collapsed and on phone. Open a lightweight list with Needs your action and New results. Do not replace a new conversation's composer or draft, or place an empty task panel on home.

Needs your action contains only essential input, connection, failure choices, human reconciliation, or held follow-ups. Ordinary execution and automatic recovery do not enter. New results contains unseen delivery, revisions, and final incomplete/stop conclusions. Grouping, ordering, and deduplication follow the [attention projection](information-architecture.md#attention-projection-on-return); individual Tasks, messages, and artifact versions are not separate to-dos.

Use specific labels such as “Report needs the second source” or “Report has a new version,” with one primary action. Open the relevant question/result in its original conversation, and the artifact when needed. Show enough context to answer, connect, replace material, continue follow-ups, or end directly, without another processing form.

Opening the list does not clear its count. Mark a result read only when actually seen in the original conversation. An action leaves the first group only after real resolution, resumption, ending ordinary waiting, or withdrawal; seeing an error does not resolve it. Uncertain important effects require verification and cannot be cleared by ending/archiving. New versions/questions may re-enter, duplicate reports may not. A read acknowledgement for an older result cannot clear later results. Persist read positions and resolution facts. Failed synchronization shows the problem and retry, not a false all-clear.

The prototype groups attention by goal origin and persists specific result read markers, message treatment, and held requests in this browser. Only visible conversation results or the corresponding artifact version mark a result read; opening the list does not clear actions. Existing browser data is migrated and retained. Authoritative service state, synchronization failures, and cross-client consistency remain production integration requirements.
