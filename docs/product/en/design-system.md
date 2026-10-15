# Visual system and components

[Index](README.md) · [简体中文](../zh-CN/design-system.md) · [Approved home](../../../prototype/design/selected-home.png)

## Direction

Follow the approved quiet desktop Agent visual: white canvas, light gray sidebar, compact heading, generous whitespace, and a refined composer. Expressing a goal is the focus. Use the Pamiya text wordmark and consistent icons, without abstract illustrations, marketing cards, duplicated brand headings, or large green status blocks.

The selected image is 1566 × 1004 and preserves the palette/layout direction. User feedback on 2026-10-15 requested smaller type; the scale below supersedes the mock. Compare before/after at the same CSS viewport and 1× density. Physical screenshot pixels must not cause enlarged CSS sizing. Real text, controls, and inputs implement the interface.

## Foundations

| Token | Specification |
|---|---|
| Canvas | `#FFFFFF` |
| Sidebar | `#EEF0F3`, low-contrast selected row |
| Primary text | `#182028` |
| Secondary text | Around `#65717B`, with readable informative content |
| Divider / input border | `#E5E8EC` / `#DCE0E6` |
| Accent | Restrained gray teal; deep blue gray for primary actions |
| Fonts | Inter, system sans serif, PingFang SC / Microsoft YaHei fallback |
| Body | Body/input 14 px, history 13 px, comfortable document leading |
| Home heading | 28 px desktop, 24 px phone; no viewport-driven enlargement |
| Spacing | Mainly 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| Radius | Composer about 21 px; controls/list rows about 8–11 px |
| Elevation | Extremely subtle composer shadow; elevated dialogs when needed; no nested cards |
| Icons | [Phosphor React](https://github.com/phosphor-icons/react), one consistent line family |

Retain existing repository banner branding. The app need not use a dark banner background or redesign its logo. Icon buttons have accessible names; each text button has one clear action.

## Components

**Sidebar:** wordmark/collapse, new conversation, tools/connections, history/search, More at bottom. Selected conversation is subtly gray. Long names truncate; management appears on hover/focus. Collapsing always leaves an expand control.

**Composer:** multiline text, removable context chips, attachment, tool connections, send/stop. Do not require a model, mode, or device first. Empty send is disabled. Stop remains reachable during work, and entered steering exposes a send action.

**Messages/activity:** subtle user bubble; prose-first Agent response. Activity is an expandable line. Specific blockers have contextual actions rather than alarming red panels. Running/waiting/stopped/completed all have text, not color alone.

**Artifacts:** title/current version, secondary version/edit/download toolbar, readable document width. Fullscreen is a view of the same artifact. Editing differs visibly from preview; a historical version cannot be mistaken for the current editable one.

**Dialogs:** native dialog for focus containment and Escape. Short title, labeled fields, adjacent errors; focus does not execute an action. Only changed unsaved human content needs a loss warning. Ordinary scoped connection does not prompt twice.

**Feedback:** dismissible non-focus-stealing success notice. Archive, schedule removal, and memory deletion offer short undo. Critical blockers stay in the conversation rather than disappearing in a toast.

## Responsive behavior

| Width | Layout |
|---|---|
| Above 1150 px | 248 px sidebar, home composer at most 760 px; one-column conversation, optional artifact |
| 761–1150 px | Narrow fixed sidebar; artifact replaces main content until closed |
| 360–760 px | Sidebar drawer; conversation/artifact occupy the main region in turn; input/close remain reachable |

Use dynamic viewport height. Conversation and artifact content scroll separately so long documents do not push away persistent controls. Check long names, Chinese titles, larger text, and scrolling dialogs. No phone bezel or simulated OS chrome.

## Accessibility and QA

Semantic controls and labels, visible focus, Tab reachability, Escape dismissal, and IME-safe sending. Keep meaningful text readable; icons cannot be the only state signal. Phone primary targets are approximately 44 px and meet applicable target-size requirements. Respect reduced motion.

Compare matching desktop typography, spacing, grayscale, icons, and copy; then check 390 px and intermediate widths. Build success does not replace browser verification. The [QA report](../../../prototype/design-qa.md) records evidence, fixes, and result.
