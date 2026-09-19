# Popup redesign brief — "soft card direction"

Source: Sushi's Claude Design project, exported 2026-09-19 to
[`Illini Dash Popup.dc.html`](./Illini%20Dash%20Popup.dc.html) (mocks 1a–1f, 2a–2c) with
`support.js` (the design runtime; not used by the extension). The mock's palette **is**
`public/ui.css`'s light Illini tokens (`#eaf1fb`, `#dbe7f7`, `#10264d`, `#44576f`, course
hues), so this is a change of *shape*, not colour: white rounded cards on the blue ground
instead of ruled rows, more air per item, and a small set of structural moves listed below.

The feature checklist the new UI is measured against is
[`docs/popup-feature-inventory.md`](../popup-feature-inventory.md). Every feature there
must exist in the new UI or be listed under "Deliberately replaced" in this file.

## Fixed constraints (from CLAUDE.md, none negotiable)

- `html`/`body` are never scroll containers; no `max-height`/viewport units on either;
  width stated on `html` and `body` (400px); the full view keys off `html.view-full`, never
  a media query. Chrome measures the document.
- Every colour is a token from `ui.css`. Dark (`:root.is-dark`), Neutral and High-contrast
  themes must keep working — no hex literals in the new CSS except new tokens added to
  `ui.css` with light **and** dark values. Verify in **dark first**.
- No remote fonts (the mock's Figtree stays out; use the existing `system-ui` stack).
  No runtime dependencies.
- `textContent` only for source strings; `safeUrl` for any href.
- Every `send()` has a `.catch` that shows the sentence on screen where the click happened;
  async controls show "Applying…" on the control.
- Redraws while a menu/panel is open are deferred, not skipped; `MENU_SELECTOR` /
  `MENU_CLASS` stay one constant; focus decisions use `relatedTarget`, never a microtask.
- No decision in `background.ts`; anything with a rule goes in `core/` with a test.
- Sub-screens (detail, editor, setup, needs-you) render **in document flow** (they replace
  or push `#view`), never as a floating panel, so Chrome can measure them (UI rule 8).

## Structural decisions

| # | Mock | Decision |
|---|------|----------|
| D1 | tab strip (2a/2c) | Five tabs: **Today · Week · Month · No date · Exams**. `ViewName` gains `"nodate"`; `"attention"` is removed as a tab. Stored view `attention` falls back to `day`. |
| D2 | "Late moves into the header pill" | The header pill is the existing `healthPill` extended: it counts overdue items, open suggestions and sources needing the student, in that priority ("2 late", "1 needs you", "All clear", "Syncing…", "Not synced yet"). Clicking it opens the **Needs you** screen (mock 1e) in document flow: banner sentence → *Late* rows (Mark done / Hide) → *A post said…* suggestion rows (Add / Dismiss, verbatim as tooltip) → *Sources* list with per-source action buttons (Sign in / Allow / Turn on) → "Nothing was dropped" note when a source is stale. This is where the current Attention tab's "Overdue" group, `renderSuggestions`, and `openHealthPopover` go. |
| D3 | No date tab (2c) | Holds the current Attention groups "No date at all" and "Couldn't read" (the latter carries the amber **check** chip and "date unreadable"). Rows offer **Give it a date** (opens the editor prefilled; on save applies the existing due override for source items, or `edit-manual-item` for manual ones), **Tick off** (`done`), **Hide**. Tab badge = count; never counted in the toolbar badge. Explainer card at top. "Add something by hand" dashed card at bottom opens the editor. |
| D4 | Today (1a) | Grouped list: **Next up** hero (the soonest open deadline; countdown "in 4h 12m"), **Also today**, **Tomorrow**, **This week** (through Sunday, "N more" in the heading). Events (`kind: event`) are dashed, lighter rows. The hour grid, its drag-to-draft and the day ‹ › navigator are **replaced** (see below). |
| D5 | Week (1b) | Seven day cards Mon–Sun with ‹ › range nav ("Sep 14 – 20"); today's card tinted `--today-tint` with a "today" caption; a day with nothing says "Nothing due"; rows carry a right-hand status word: clock, `done` (struck through), `late ok` (late window open), `1d late`, `EOD` (end-of-day / time assumed). Keep `WEEK_MODE` as-is unless the inventory says otherwise. |
| D6 | Month (2a) | New **popup** month: 7-column grid, one dot per deadline in the course hue, dots dimmed once done, today filled with the accent, the tapped day outlined; tapping a day lists it underneath in card rows; the month name carries "Full view ↗" which opens the existing full-view month grid. `FULL_VIEW_ONLY` no longer contains `month`. The full-view month keeps its current renderer. |
| D7 | Row (1a) | `[course dot] Title / CODE · Source · detail` left, `relative / clock` right, as a white card. Merged rows say "+N more" in the detail; `time assumed` in italics; PrairieLearn "opens 9 AM"; exam room. Practice/no-credit chip stays. Clicking a row opens the **deadline screen** (D8); middle-click / ⌘-click / the row's "Open ↗" still open the source URL. Rows stay `<a>` when they have a URL, keep `tabIndex` rolling and ↑↓, Shift+F10 / `.` opens the row's ⋯. |
| D8 | Deadline screen (1c) | In-flow sub-screen with ‹ back: course pill (code + student's course name), title, Due card with countdown, facts list (Source with Open ↗, Also seen in, Status, Late window, Moved by an announcement + Undo move), then buttons **Mark done / Undo done**, **Add to Calendar** (Google Calendar URL), **Hide CODE** (hide course), and the ⋯ with everything the current row menu offers that is not already a button: Hide this item, Split, Merge with…, Edit / Delete (manual), Rename course, Report this page. **Snooze is not built** (no store support; a snoozed deadline still falls due). |
| D9 | Header (1a/2a) | `[mark] Illini Dash [pill] [+] [⋯]`. `+` opens the editor (mock 2b) on every tab. `⋯` carries: Open full view, Download .ics, Google Calendar (existing controls), Courses (show/hide, replacing the chip strip), Appearance (theme panel), Settings. The sync button moves to the footer. |
| D10 | Footer strip | Always present, sticky bottom, in flow: `[dot] N sources · synced 2m ago · Sync now`. Amber (`--warn-wash`) with "7 of 8 sources" when a source fails; "Syncing…" with the spinner cap while a sync runs. Derived from `core/health.ts` (`statusLine`/`healthPill`), never from `lastSyncAt` alone. `#status` (errors) becomes a banner in the `#banners` slot near the control that failed. |
| D11 | Editor (2b) | Sub-screen with ‹ back and ×: uppercase labels, Title full-width, Course (with dot) / Kind / Date / Time in a 2-col grid, refusal in `--err` beside its field, **No date yet** toggle (saves without a date → No date tab; `core/manual.ts` gains optional `date` with a test). End time and URL stay, folded under "More". Buttons **Add it / Save** and **Cancel**. Undo-delete toast stays. |
| D12 | First run (1d) | Restyled `renderSetup`: mark, headline, pin card (dismissable, as now), "Where to look" toggle list per source group, **Find my deadlines** primary button, hint line. The existing setup progress/sign-in flow is kept underneath. |
| D13 | Empty state (1f) | "Nothing due for N days / Next up is … on Tuesday. All N sources answered 2 minutes ago." with **See the week** and **Add something**. Text from `emptyStateFor` extended in core. |
| D14 | Tweaks | Two per-device toggles in the theme panel: **Urgency edge** (default off; a 4px course-hue edge on rows) and **Source names** (default on). `localStorage`, same pattern as the theme. |
| D15 | Badge / notification (1f) | No change to `badgeFor` or notifications. |

## Deliberately replaced (must be listed in PROGRESS.md and the inventory)

- **Day hour grid + drag-to-draft** → Today grouped list (D4) + the header `+` (D9). The
  UX plan (docs/ux-plan.md §0) already found the hour axis the wrong shape for data that
  lands on the same minute; the mock keeps no grid.
- **Day ‹ › navigator** → Week's ‹ › and Month's tap-a-day. Today is anchored to now.
- **Course chip strip** → "Courses" in the header ⋯ and "Hide CODE" on the deadline screen.
- **Attention tab** → header pill + Needs you screen (D2) and No date tab (D3).
- **Row ⋯ menu as the primary path** → deadline screen (D8); the ⋯ stays for keyboard
  users and carries the rarer actions.
- **Health popover** → Needs you screen (in flow, so never clipped).

## Module plan

`src/ui/popup.ts` (3809 lines) is split first, behaviour-preserving, into
`src/ui/popup/`: `state.ts` (shared mutable state + storage keys), `shell.ts` (header,
pill, tabs, footer, banners, status, menus, floating placement, redraw guards, key
trapping), `rows.ts` (card row, tone, due text), `screens/deadline.ts`, `screens/editor.ts`
(wraps `ui/editor.ts`), `screens/setup.ts`, `screens/needs-you.ts`, `views/today.ts`,
`views/week.ts`, `views/month.ts`, `views/nodate.ts`, `views/exams.ts`, and `popup.ts`
as the entry that wires them. CSS: `popup.css` keeps the sizing invariants and shell;
each area appends its own file linked from `popup.html` (`popup-rows.css`,
`popup-views.css`, `popup-screens.css`) so parallel workers never touch one CSS file.

## Verification

`npm run typecheck`, `npm test`, `npm run preview` then the real document
`dist/preview-popup.html` at 400×600, dark first (`resize_window` colorScheme dark, or
`npm run shots -- popup`). Measure `document.documentElement.scrollWidth === 400` and that
no element's right edge passes 401. Every sub-screen must be reachable in the harness by a
query (`?editor=1`, `?open=health`, add `?open=deadline`, `?tab=nodate`, `?tab=month`).
