# Pamiya design QA

Date: 2026-10-15. Scope: approved Agent-first visual and interactive local prototype. This is design/interaction verification, not validation of a production Agent runtime.

## Comparison target and evidence

- Source visual truth: [selected-home.png](design/selected-home.png), explicitly approved by the user.
- Final browser-rendered implementation: [implemented-home.png](design/implemented-home.png).
- CSS viewport: 1566 × 1004, desktop, home/empty composer, sidebar expanded, initial three demonstration conversations, light theme.
- Source pixels: 1566 × 1004. Implementation pixels: 1566 × 1004. Device scale: 1. No crop, density scaling, browser chrome, or device frame was used in comparison.
- Both artifacts were opened and placed together in a [full-view comparison](design/qa/home-comparison.png), then inspected together. Focused comparisons cover the [composer/heading](design/qa/composer-comparison.png) and [sidebar](design/qa/sidebar-comparison.png).
- Additional browser evidence: [artifact view](design/implemented-artifact.png), [390 × 844 home](design/qa/mobile-home.png), [390 × 844 artifact](design/qa/mobile-artifact.png), [1024 × 768 artifact](design/qa/tablet-artifact.png).
- Intermediate captures, stop/unknown-result/failure/schedule states, and first-pass comparisons remain in local ignored `evidence/`; no personal browser data is committed.

## Findings and comparison history

1. **First desktop pass — blocked. [P2] Undersized secondary UI and composer controls.** Source sidebar text, wordmark, attachment/send controls and composer height were larger than the first implementation. The smaller controls changed the interface density. Fixed sidebar type/spacing, home input height/type scale, controls and heading-to-input gap; recaptured at the same viewport and compared again.
2. **Responsive/interaction pass — blocked. [P2] Narrow artifact continuation did not reveal conversation.** “继续交流” focused a hidden composer while the artifact remained visible. Fixed it to close the narrow artifact view before focusing the composer. Verified in the browser at 390 × 844.
3. **Responsive pass — blocked. [P2] Long tablet history displaced the persistent More entry.** A content-sized sidebar exceeded its intended grid height. Added explicit viewport height and a shrinkable, independently scrolling history area. Recaptured 1024 × 768 with ten conversations; More remains visible at the bottom.
4. **Interaction pass — blocked. [P2] Undo feedback outside a native modal was not actionable.** Moved feedback into the active dialog's top layer. Deleted and restored a memory using that dialog's undo action, then inspected the returned state.
5. **Final comparison — passed.** Full and focused comparisons show the approved proportions, hierarchy, copy, and surface treatment. No actionable P0/P1/P2 visual or primary-flow issues remain in the tested scope. Slight raster-versus-browser type/stroke differences and the reference's generated background texture are acceptable P3 differences; no code drawing or fake illustration was introduced to imitate texture.

## Required fidelity surfaces

| Surface | Review result |
|---|---|
| Fonts and typography | Inter/system sans with Chinese system fallback; wordmark, heading, body, placeholders and navigation checked in focused views. Weight and wrapping preserve the reference hierarchy; informative secondary text is darkened slightly for readability. |
| Spacing and layout rhythm | Matching desktop viewport and sidebar/main proportions; composer width, height, gap, corner radius and diffuse shadow compared. Wide artifact split and narrow replacement views remain usable. |
| Colors and tokens | White canvas, cool-gray sidebar, low-contrast selection, charcoal type and muted teal send action match the intended visual. Errors use specific text and restrained emphasis. |
| Image quality and assets | Source has no custom raster art, avatars or pictorial logo. Editable Pamiya wordmark text and official Phosphor icons are appropriate. The UI is interactive DOM, not a raster screenshot or handcrafted illustration. |
| Copy and content | Approved home text retained. Simulation is explicit; unsupported file content, stopping and unknown results do not claim success. Management vocabulary stays outside the home focus. |

## Primary interactions checked in the in-app browser

- Empty-send disabled; submit a goal; activity changes; completion and artifact opening.
- Artifact edit/save, unsaved-close warning/continue editing, current/historical versions, and actual Markdown download. Concurrent Agent update during editing produced an explicit conflict prompt; saving retained both generated and human versions, and the generated version remained readable in history.
- Missing audience and quick answer; stop requested then confirmed stopped.
- Read failure and safe retry to completion; a short locator wait expired before completion, then a fresh snapshot confirmed success. This was a test-wait timing issue, not an application failure.
- Unknown submitted notification, query receipt, single confirmed simulated submission without replay.
- Missing workspace, scoped connection dialog, automatic continuation of the same flow.
- Daily/weekly schedule form, next occurrence (Monday 2026-10-19 at 09:00 Asia/Shanghai), save, simulated trigger, latest-run entry, pause/resume.
- Memory add, delete, dialog-local undo and restored content.
- Explicit `@` historical context selection; actual text-file chooser and attachment chip.
- Refresh during simulated execution; saved context retained and explicit continuation available.
- Search by content/title, rename, archive, undo and subsequent search hit.
- Phone home, navigation drawer, artifact reading, continue-to-conversation; tablet artifact and scrolling history. DOM width equals viewport width at 390 and 1024 px.
- Keyboard search shortcut and Escape dismissal checked.
- Console warning/error logs checked: no application warnings or errors in the verified browser flow. Native dialog supplies focus containment; visible focus and labeled controls are implemented.

## Automated verification and limits

- Four bilingual product Mermaid diagrams were parsed and rendered in the in-app browser with no console errors. A direct Node-only parse lacked a DOM/DOMPurify environment; browser verification resolved that tooling limitation without changing the diagrams.
- Nine model tests cover goal completion, active steering, stop acknowledgement/no late artifact, uncertain-result reconciliation without retry, safe read retry, missing input/connection, refresh interruption, version preservation and timezone/date boundaries.
- Production build, code-format check and bundled static-hosting adapter tests are required alongside the repository document check. Their execution is recorded in the completion handoff.
- Real models, identity, storage, devices, event rules, backend scheduling, production authorization, cross-tab concurrent edits and remote Agent cancellation are outside the implemented prototype. They are specified, not tested as integrations.
- Native IME composition, screen-reader announcements, OS virtual keyboards, artificially exhausted browser storage and cross-browser rendering were not tested end to end. IME guard, storage error path, reduced-motion style and semantic labels were inspected in code. Formative user testing remains future validation.

## Implementation checklist

- [x] Resolve approved source and preserve it in the project.
- [x] Compare browser implementation with source in one full-view and focused input.
- [x] Fix and recapture identified P2 issues.
- [x] Verify primary happy path, recovery, artifact and auxiliary interactions.
- [x] Check desktop, tablet and phone layouts; retain persistent controls.
- [x] Document simulation and untested production boundaries.

## Follow-up polish

P3: exact font rasterization and subtle icon optical sizes can be adjusted after user feedback. Do not recreate the reference's generated texture or add marketing content to fill whitespace.

final result: passed
