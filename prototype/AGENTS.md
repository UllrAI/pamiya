# Prototype Instructions

## Approved product direction

- Pamiya is a modern, long-lived personal Agent. Conversation and autonomous work are primary; task administration is secondary.
- Match `design/selected-home.png`: quiet white canvas, cool gray sidebar, restrained typography, delicate composer, generous whitespace. No marketing cards or dashboard counters on the home screen.
- User refinement on 2026-10-15 overrides the mock's scale: desktop heading 28 px, phone heading 24 px, body/input 14 px, history 13 px, wordmark 24 px, desktop sidebar 248 px and home composer at most 760 px. Do not enlarge type with viewport width.
- Use Phosphor library icons. The selected screen has no raster art; Pamiya is editable wordmark text.
- Keep the prototype honest: local deterministic simulation, local browser storage, no real model/tool/device connection, background timer or outgoing message.
- Existing authorization covers ordinary work; ask only for concrete missing input or scope.
- Distinguish requested stop, confirmed stop, and an unknown important result. Never offer blind replay of a submitted action.
- The repository-root Chinese drafts are user-owned; do not overwrite or publish them as prototype artifacts.
- Product baseline 0.3 keeps work identity in message origins, Runs and artifact references; do not add a Work/Project creation flow.
- Demonstrate steering, questions, replacement and follow-ups with explicit deterministic rules; clarify unsupported input rather than claiming model understanding.
- Stop holds unstarted follow-ups; replacement retains old output. Archive only organizes history. Attention separates required actions from unseen results and remains available for archived conversations.
- Preserve existing browser data when migrating storage. Read acknowledgements apply to specific visible results, never to unresolved actions or future versions.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
