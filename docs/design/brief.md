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
| D2 | "Late moves into the header pill" | **There is no header pill (decided 2026-09-19).** It was built as `needsYouPill` and removed on Sushi's reading of the merged build — "I don't even know what All clear means", "there's just too much information being shown", "remove the pill". Late work is the first thing on the **Today** tab, and source health is the footer strip, so the pill restated two things that were already on screen and its best case named nothing to act on. The **Needs you** screen stays exactly as specified — banner sentence → *Late* rows (Mark done / Hide) → *A post said…* suggestion rows (Add / Dismiss, verbatim as tooltip) → *Sources* list with per-source action buttons (Sign in / Allow / Turn on) → "Nothing was dropped" note when a source is stale — and is opened by the footer strip's source text instead (D10). It is still where the old Attention tab's "Overdue" group, `renderSuggestions` and `openHealthPopover` live. `needsYouPill` stays in `core/health.ts`, tested and unused. |
| D3 | No date tab (2c) | Holds the current Attention groups "No date at all" and "Couldn't read" (the latter carries the amber **check** chip and "date unreadable"). Rows offer **Give it a date** (opens the editor prefilled; on save applies the existing due override for source items, or `edit-manual-item` for manual ones), **Mark done**, **Hide** — all three in the row's ⋯ since 2026-09-19, not as buttons on the card ("rather would just have it in the 3 dot option"). Tab badge = count; never counted in the toolbar badge. Explainer card at top. "Add something by hand" dashed card at bottom opens the editor. |
| D4 | Today (1a) | **A schedule for the day (decided 2026-09-19).** Three bands from `todaySchedule`, each drawn only if it has rows: **Late** (`LATE_HEADING`; every unfinished row whose instant has gone, today's or the past week's, with `weekStatus` — "2h late" / "late ok" — in `--err`), **By end of day** (`END_OF_DAY_HEADING`; today's untimed rows then its stated ≥11 PM rows, done sunk, **no clock and no status** — the heading has said when), then the **timeline**: today's clocked rows before 11 PM in clock order, three columns per line — `[clock 52px, tabular-nums] [rail 16px] [row]` — with a 2px vertical rail, a course-hue dot on the rail per row, elapsed rows muted, a `--now` bar **across** the rail where now is (drawn at the top when nothing has elapsed and at the bottom when everything has, because a rail with no mark cannot say where you are), a 14px dotted rail segment wherever two rows are more than two hours apart, and no heading — the clock column is the heading. It is still **not an hour rail**: nothing is to scale and no empty hour gets a row. Nothing today and no quiet state: "Nothing on the schedule today." The **"Next up" hero is gone** ("Next up is way too loud"), and with it *Also today*, *Tomorrow* and *This week* — the week is a tab. `todayBoard` / `WEEK_PREVIEW_ROWS` are unused. The hour grid, its drag-to-draft and the day ‹ › navigator stay **replaced** (see below). |
| D5 | Week (1b) | Seven days with ‹ › range nav ("Sep 14 – 20"), **not cards (2026-09-19)**: no fill, no nested card, no course edge — a hairline between days and nothing else. Three filled surfaces deep on a 400px screen was most of "each item per day is too large". Today keeps its "today" caption and gains a **3px `--accent` edge down the left of the date column** in place of the `--today-tint` wash; `--today-tint` stays defined, for the month. A day with nothing says "Nothing due" and stays the tight row it is. Rows are D7's one-liner and carry the same right-hand status word: clock, `done` (struck through), `late ok`, `1d late`, `EOD`. Keep `WEEK_MODE` as-is unless the inventory says otherwise. |
| D6 | Month (2a) | New **popup** month: 7-column grid, one dot per deadline in the course hue, dots dimmed once done, today filled with the accent, the tapped day outlined; tapping a day lists it underneath in card rows; the month name carries "Full view ↗" which opens the existing full-view month grid. `FULL_VIEW_ONLY` no longer contains `month`. The full-view month keeps its current renderer. |
| D7 | Row (1a) | **Two shapes, and Today and Week share the smaller one (2026-09-19).** *Compact* is one line of about 28px — `[dot] Title  CODE  [status/clock]` — with no fill, no card, no meta line, and the ⋯ `visibility: hidden` until hover or focus. It drops the whole meta line — the source name, the relative text, the `time assumed` marker, "+N more" **and the exam room** (kept back for one build, then dropped: "Grainger Library · Room 57…" is a second clause competing with the title on a 400px line). Everything dropped is on the deadline screen, one press away, and the room is also in full on the Exams tab. *Standard* — used by No date, Exams and Needs you — stays the card: `[course dot] Title / CODE · detail` left, `relative / clock` right, `time assumed` in italics, PrairieLearn "opens 9 AM", practice chip. Its two "when" halves no longer both draw: a **stated** clock still ahead collapses to the clock inside 24h and to the relative beyond it, because "in 16h" and "8:00 PM" are one fact twice. A **late** row keeps both ("2h late" says overdue, "8:00 AM" only says when), and "no date", "unreadable", "end of day" and the exam board's own text keep both. Both shapes: a press opens the **deadline screen** (D8); middle-click / ⌘-click still open the source URL; rows stay `<a>` when they have a URL, keep `tabIndex` rolling and ↑↓, and Shift+F10 / `.` opens the row's ⋯. |
| D8 | Deadline screen (1c) | In-flow sub-screen with ‹ back: course pill (code + student's course name), title, Due card with countdown, facts list (Source with Open ↗, Also seen in, Status, Late window, Moved by an announcement + Undo move), then buttons **Mark done / Undo done**, **Add to Calendar** (Google Calendar URL), **Hide CODE** (hide course), and the ⋯ with everything the current row menu offers that is not already a button: Hide this item, Split, Merge with…, Edit / Delete (manual), Rename course, Report this page. **Snooze is not built** (no store support; a snoozed deadline still falls due). |
| D9 | Header (1a/2a) | `[mark] Illini Dash [+] [⋯]` — the mark and the name on the left, two controls on the right, and nothing between them (the pill went on 2026-09-19, D2). `+` opens the editor (mock 2b) on every tab. `⋯` carries: Open full view, Download .ics, Google Calendar (existing controls), Courses (show/hide, replacing the chip strip), Appearance (theme panel), Settings. The sync button moves to the footer. |
| D10 | Footer strip | Always present, sticky bottom, in flow: `[dot] N sources · synced 2m ago` **as one button** then `Sync now` as a second. Amber (`--warn-wash`) with "7 of 8 sources" when a source fails; "Syncing…" with the spinner cap while a sync runs. Derived from `core/health.ts` (`footerLine`), never from `lastSyncAt` alone. **The source text opens the Needs you screen** (D2) and toggles closed on a second press, carrying the per-source "which site was read, and when" tooltip (`sourceRows`) that used to hang off the pill; `Sync now` stays a separate control. `#status` (errors) becomes a banner in the `#banners` slot near the control that failed. |
| D11 | Editor (2b) | Sub-screen with ‹ back and ×: uppercase labels, Title full-width, Course (with dot) / Kind / Date / Time in a 2-col grid, refusal in `--err` beside its field, **No date yet** toggle (saves without a date → No date tab; `core/manual.ts` gains optional `date` with a test). End time and URL stay, folded under "More". Buttons **Add it / Save** and **Cancel**. Undo-delete toast stays. |
| D12 | First run (1d) | Restyled `renderSetup`: mark, headline, pin card (dismissable, as now), "Where to look" toggle list per source group, **Find my deadlines** primary button, hint line. The existing setup progress/sign-in flow is kept underneath. |
| D13 | Empty state (1f) | "Nothing due for N days / Next up is … on Tuesday. All N sources answered 2 minutes ago." with **See the week** and **Add something**. Text from `emptyStateFor` extended in core. |
| D14 | Tweaks | Two per-device toggles in the theme panel, **both default off (Source names flipped 2026-09-19)**: **Urgency edge** (a 4px course-hue edge on rows) and **Source names** (which site a deadline came from, on the standard row's meta line; the compact row never shows it). "There's just too much information being shown" — and where a deadline came from is on the deadline screen, next to the link that opens it. Both toggles stay, so either can be turned back on. `localStorage`, same pattern as the theme; `DEFAULT_TWEAKS` in `core/theme.ts` is unchanged and the flip is in the two UI readers. |
| D15 | Badge / notification (1f) | No change to `badgeFor` or notifications. |

## Deliberately replaced (must be listed in PROGRESS.md and the inventory)

- **"Next up" hero** → the Late band and the agenda's first row (D4, 2026-09-19). "Next up is
  way too loud": a 14.5px title with a fine countdown and a kicker rule said in four lines
  what the first row of a schedule says in one, and it was the loudest thing on screen
  whether or not it was the thing to do next. `todayBoard` and `WEEK_PREVIEW_ROWS` stay in
  `core/calendar.ts`, tested and unused.
- **Today's *Also today* / *Tomorrow* / *This week* groups** → the day's three bands (D4)
  and the Week tab. Today is today; tomorrow is one press away.
- **Day hour grid + drag-to-draft** → Today's timeline (D4) + the header `+` (D9). The
  UX plan (docs/ux-plan.md §0) found the hour *axis* the wrong shape for data that lands on
  the same minute, and that still holds: the timeline draws a rail, not an axis — nothing
  is to scale, no empty hour gets a row, and a stretch of more than two hours is one dotted
  14px segment. Sushi asked for the rail back on 2026-09-19 ("I really prefer the timeline
  look, it's just hard to look at the info presented otherwise") after a flat agenda, so
  what §0 ruled out and what he asked for are two different things.
- **Day ‹ › navigator** → Week's ‹ › and Month's tap-a-day. Today is anchored to now.
- **Course chip strip** → "Courses" in the header ⋯ and "Hide CODE" on the deadline screen.
- **Attention tab** → Needs you screen (D2, opened from the footer) and No date tab (D3).
- **Header health pill** → Late work at the top of Today, source health in the footer strip,
  and the footer's source text as the way into Needs you (D2/D10, 2026-09-19).
- **Booking banner above the tabs** → the Exams tab's "Not booked" group, which carries the
  same window text and the same link, under a tab badge (`examCount`) counting exactly those
  rows (2026-09-19). Three open windows were three permanent amber lines in a 600px window.
- **Row ⋯ menu as the primary path** → deadline screen (D8); the ⋯ stays for keyboard
  users and carries the rarer actions.
- **Health popover** → Needs you screen (in flow, so never clipped).

## Module plan

`src/ui/popup.ts` (3809 lines) is split first, behaviour-preserving, into
`src/ui/popup/`: `state.ts` (shared mutable state + storage keys), `shell.ts` (header,
tabs, footer, banners, status, menus, floating placement, redraw guards, key
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
