# UX plan for the store release

Written 2026-09-11 against build `20260912T041431` (831 tests passing, working tree with
the uncommitted "reference refresh" in `popup.css` / `ui.css`). Every finding below was
seen in the **real popup document** (`dist/preview-popup.html`, the harness that stubs only
`chrome.*`) and in the Settings page driven by an equivalent stub, in **dark mode first**,
then light, then the Neutral and High-contrast themes. "Before" captures are in
[`docs/ux/before/`](ux/before/); the way they were made is in §6 so they can be regenerated
after each phase. The same plan, with the captures inline, is published as a page:
https://claude.ai/code/artifact/3a66cd9e-6613-4e42-a34c-78593cf1cc2f

Nothing here changes §0 of SPEC.md, the palette from Sushi's mockup, the token contract in
[colour-layer.md](colour-layer.md), the 400px popup invariant, or the meaning of red, amber
and green. The plan is about what the pixels *say* and how many of them say it.

---

## 0. Verdict

The product underneath is unusually trustworthy — health that cannot lie, invented times
marked as invented, nothing dropped silently — and the month view already looks like a
product. The popup does not yet, for one structural reason and a handful of cheap ones:

- **The popup spends 322 of its 600 pixels before the first deadline.** Bar, stale banner,
  booking strip, tab strip, two rows of course chips, date navigator. In a healthy state
  (no banner, nothing to book) it is still 215px. The thing the student opened the popup
  for starts below the midpoint.
- **The day grid then spends most of what is left on empty hours.** Eleven empty ruled
  hours (≈290px) between a 9 AM checkpoint and a 9 PM exam, so the exam is below the
  fold. The code's own comment says most deadlines land on the same minute; an hour axis
  is the wrong shape for that data in a 400px window.
- **Three things are wrong rather than merely dense**: an exam already sat is listed as
  "Overdue"; the only primary button in the app is invisible in dark mode; text on the
  orange accent fails contrast in both themes.
- **Developer vocabulary leaks into every surface**: `GS` in a sentence, a build id in the
  popup's status line, `gradescope: due date` under a row, `SPEC.md §0` in Settings.
- **Every control is a different control.** Text links, bordered links, native checkboxes,
  native radios, four button styles, three text glyphs standing in for icons.

The fixes are mostly layout and vocabulary. The three correctness items and the contrast
item are small. The one real design decision — what the popup's default tab is and what
"week" means in it — is Sushi's, and §7 asks it.

---

## 1. What was looked at

| Capture | Where | What it shows |
|---|---|---|
| `popup-day-dark.png` | popup 400×600, dark | Default open: 322px of chrome, then an untimed band, an end-of-day band, an 8 AM row, then empty hours |
| `popup-week-dark.png` | popup, Week tab | Sunday-start week on a Friday: five past days above today; today's row is the last thing on screen |
| `popup-attention-dark.png` | popup, Attention tab | "Overdue (2)" containing an exam sat two hours ago; the row menu; the raw `gradescope: due date` detail |
| `popup-setup-dark.png` | popup, first run | Clear checklist; native checkboxes; **"Show my calendar" renders as plain text** |
| `full-month-dark.png` | full view 1280×800, dark | The strongest screen. 280px of chrome above the grid; pill titles truncated at 13–15 characters |
| `options-dark.png` | Settings, dark, whole page | 1900px single column; 13 sections; explanatory paragraphs; unstyled `h3`; worker/build line at the top |

Also inspected without saving: the popup in light mode and in the Neutral and High-contrast
themes (all consistent with dark; nothing theme-specific to report beyond §2), the full-view
Day / Week / Exams / Attention tabs, and the row menu in both widths.

**The popup's vertical budget, measured** (`getBoundingClientRect`, dark, default open):

| Block | Height | Cumulative |
|---|---|---|
| Header bar | 48 | 48 |
| Stale-source banner | 48 | 96 |
| Booking strip | 50 | 146 |
| Tab strip | 47 | 193 |
| Course chips (7 courses → 2 rows) | 81 | 274 |
| Date navigator | 39 | 313 |
| *First content pixel* | | **322** |

Popup width invariant holds: body 400, `scrollWidth` 400, no element past 401, `overflowY`
visible. Tab widths 67 / 34 / 34 / 45 / 46 (only the selected tab carries its label).

---

## 2. Findings, ranked

Severity: **B** blocks the store (wrong, or fails an accessibility floor); **M** is a
material UX cost; **m** is polish. Each carries where it lives so the fix is a lookup.

### Blockers

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **A sat exam is "Overdue".** `attentionGroups` puts anything past its instant, not done and not an event, into Overdue for 7 days; an exam has no submission so it is never "done". The same item is "Just sat" on the Exams tab. | `core/calendar.ts:397-406`; `popup-attention-dark.png` | `if (item.kind === "exam") continue;` in the past branch — an exam cannot be handed in late. Test: "an exam sat 2h ago is not overdue"; mutate the line back and confirm the suite fails. |
| B2 | **The one primary button is invisible in dark.** `.setup--primary` fills with `--brand`, which in dark is `#0d1626` on a `#0b1726` page. "Show my calendar" reads as plain text. | `popup.css:467-471, 594`; `ui.css:66, 75`; `popup-setup-dark.png` | New tokens `--primary` / `--primary-ink`: light = brand navy / white; dark = accent orange / `#1a0d04`. Every primary action uses them (§4.4). |
| B3 | **White on the accent fails contrast.** `--accent-ink: #ffffff` on `#ff5f05` is 3.0:1 (light) and on `#ff6a1a` 2.9:1 (dark). It carries today's date in the calendar (12px bold) and would carry primary-button labels. AA needs 4.5:1 for text this size. The uncommitted diff changed dark `--accent-ink` from `#1a0d04` (6.6:1) to white. | `ui.css:45, 86`; §4.9 | `--accent-ink: #1a0d04` in both themes (6.2:1 / 6.6:1). Restore before anything else ships on orange. |

### Major

| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | **322px of chrome before content**; 215px healthy. | §1 table | Phase C: header 40, tabs 36, chips 36, nav 32 → **144px healthy, ≤ 226px worst case**. |
| M2 | **The hour grid is the wrong shape for the popup.** 8 AM–6 PM axis widens to hold any timed row, so one 9 PM exam adds 11 empty hours (≈290px) and lands below the fold. | `core/calendar.ts:235-256`; `popup.ts:1024-1089`; `popup-day-dark.png` | In the popup, render the day as an **agenda** (untimed → end of day → timed rows in order, a "now" rule between past and future). The hour grid stays in the full view, where it has room. `agendaRows()` in core, tested. |
| M3 | **Week starts on Sunday, so today sinks.** On a Friday, five past days (two struck-through, three "—") sit above today; today's row is the last thing on screen. | `core/calendar.ts:263-266`; `popup-week-dark.png` | Popup Week = rolling 7 days from today; compact 22px rows for empty days. Full-view Week stays Sun–Sat. **Decision 1 in §7.** |
| M4 | **Health is six colour-only 9px dots** with no labels; the clickable one (needs login) looks like the others; the stale banner and the "5 of 6 OK" line say the same thing again lower down. Shapes exist only in the High-contrast theme. | `popup.css:70-77, 542-546`; `popup.ts:136-161` | One **health pill** in the bar, derived from `summarize()`: "All 5 OK · 11:16 PM", "Sign in to Gradescope" (amber, click opens login), "Gradescope couldn't be read" (red, click opens the source panel), "Checking…" (hollow). Click on any state opens a per-source popover. Dots go. |
| M5 | **Only the selected tab has a name.** Four icons with no label; the bell and the document icon do not explain themselves. | `popup.css:605-609`; `popup.ts:818-822` | Labels on all five tabs (Day · Week · Month · Exams · Attention ≈ 314px incl. badges at 12px semibold, fits 376px). Icons only in the full view. |
| M6 | **Course chips wrap to two rows** (81px) at seven courses; the "reference refresh" doubled their size. | `popup.css:243-256, 622-623` | One 36px row, 11px chips with 7px dots, `overflow-x: auto` on the strip (never on `body`), fade at the right edge. Two rows allowed only in the full view. |
| M7 | **Sync feedback is off-screen.** "Syncing…" is written to `#status` at the bottom of an 883px document. | `popup.ts:1576-1580` | The sync button spins; the pill reads "Checking…" then the result. Status line removed from the popup (M9). |
| M8 | **Source codes in prose.** "GS hasn't been read successfully", "Sign in to GS", "CV WEB". A new student does not know these. | `popup.ts:181, 1515` | `SOURCE_NAME` in every sentence; the two-letter code stays only in the row's source column, with the full name in its tooltip (already there). |
| M9 | **Build id in the popup.** "Checked 11:16 PM · 5 of 6 sources OK · build 20260912T041431" is the last line every student sees. | `popup.ts:160` | Build id → Settings › Developer. The popup shows it only inside the stale-worker warning, where it is the evidence. |
| M10 | **Settings is a 1900px essay.** Thirteen `h2` sections, a paragraph each ("Presets rather than a colour picker, because…"), `SPEC.md §0` cited to the student, "Service worker alive, build …" as the first line, native checkboxes and radios, `h3` unstyled so "Older courses" renders *larger* than "Courses". | `options.html`; `options.ts:63`; `ui.css` (no `h3` rule) | Phase D: sticky section nav, one-line descriptions with "Why?" disclosures, switches and state chips, version line, Developer section holds the worker/build detail. |
| M11 | **Rows are not keyboard-reachable and the menu is invisible.** Rows are `div`s with click handlers; `⋯` is `opacity: 0` until hover, so nobody learns it exists; the menu has no arrow-key handling; tabs carry `aria-selected` with no `role`. | `popup.ts:390, 813`; `popup.css:161-164` | Rows become `<a href>` with a roving tabindex; `⋯` at 35% opacity always, 100% on hover/focus; `role="tablist"/"tab"`; menu handles ↑ ↓ Esc and opens on Shift+F10 / `.`. |
| M12 | **Full view rows span any width.** The uncommitted diff removed `max-width: 1400px` from `.view-full body`; the comment above it still argues for the cap. On a 27" monitor an agenda row puts its clock 2400px from its title. | `popup.css:46-59` | Cap list-like views (Day/Week/Exams/Attention) at 1100px centred; the month may use up to 1400px. Fix the comment either way. |
| M13 | **Nothing happens on install.** The worker syncs silently; Chrome leaves the icon unpinned, so the badge is invisible to exactly the student who never opens the popup. | `background.ts:545-552` | On `reason === "install"`, open `popup.html?view=full` (it already renders the first-run screen) with a "Pin Illini Dash" card. |

### Minor

| # | Finding | Evidence | Fix |
|---|---|---|---|
| m1 | `gradescope: due date` under a "Couldn't read" row is a raw source key and field. | `popup.ts:306-314` | "Gradescope's due date couldn't be read" — `SOURCE_NAME` + a field-label map. |
| m2 | Text glyphs as icons: `⚙`, `⤢`, `⋯`, `‹ ›`, `▸` — font-dependent, unaligned, no hit area. | `popup.html`; `popup.ts:931, 946` | One inline-SVG icon set (16px, 1.5 stroke, `currentColor`), built the way the tab icons already are. 28×28 hit targets. |
| m3 | "⤢ full view" names the mechanism, not the benefit. | `popup.html:14` | "Open in a tab" (icon + tooltip). |
| m4 | Month pills truncate titles at 13–15 characters because the course code eats 45px of a 137px cell. | `full-month-dark.png`; `popup.css:332-346` | Code as a 6px dot + 4-letter code (`CS357`, `PH214`), title first; two-line pills at ≥ 1100px. |
| m5 | Month-only header: 280px of bar/banner/booking/tabs/chips above the grid in an 800px window. | `full-month-dark.png` | Same header work as M1; in the full view put the date navigator on the tab row. |
| m6 | `List updated 9/11/2026, 6:19:34 PM` — raw `toLocaleString()`. | `options.ts:612` | Relative: "Updated 5 min ago" (tooltip carries the full stamp). |
| m7 | "STALE SERVICE WORKER" and "Service worker unreachable" are the right detection with beta wording. | `options.ts:66-70`; `popup.ts:1543` | "Illini Dash was updated, but the background part is still running the old version. Open chrome://extensions and click Reload." Keep the build ids in the sentence; they are the evidence. |
| m8 | Report-a-broken-page asks for NetID and full name in the middle of Settings; the pitch is "never sees a password". | `options.html:112-118` | Under Help, behind "Prepare a report", with the one-line reason first ("so they can be removed from the file"). |
| m9 | Buttons: `.link`, `#sync`, `.book--go`, `.setup--primary`, `.setup--secondary`, `.datenav--today`, `.mmore`, generic `button` — eight styles, three radii. | `popup.css`, `ui.css` | §4.4 button system. |
| m10 | 9.5px and 10px text (hour labels, chips, week gutter, month pills). | `popup.css:282, 300, 336` | Floor at 11px; 10px only for tracked uppercase labels. |
| m11 | `popup.css` layers three "refresh" passes: `.bar` background is set three times, `.tabs` three, `.tab[aria-selected]` four. The cascade decides, silently. | `popup.css:61-65, 516, 613; 416, 559, 619; 229, 524, 560, 620` | Behaviour-preserving consolidation: one rule per selector, grouped by component. Light review per CLAUDE.md. |
| m12 | `dist/preview.html` (the framed harness) is stale: it mounts `#list`, the popup needs `#view`, `#tabs`, `#filters`, `#nav`, `#booking`, so `popup.js` throws on it. There is no Settings preview. | `scripts/preview.mjs:71-83` | Delete the framed page; add `preview-options.html` with a stub for `ping`, `get-options-state`, `get-adapters`; add the screenshot script (§6). |
| m13 | Icon is a generic list glyph on orange; no wordmark; only 16/48/128 (no 32 for 2× toolbars). | `public/icon*.png` | Phase G: one SVG mark, rendered to 16/32/48/128 and a 440×280 tile. |
| m14 | Manifest: no `homepage_url`, no `commands` (keyboard shortcut to open), version `0.1.0`. | `public/manifest.json` | Add `homepage_url`, `commands._execute_action` (suggested Alt+Shift+D), version `1.0.0` at submission. |
| m15 | Notification title "CS357 — assignment due in 2 hours" leads with the code; the thing to do is second. | `core/schedule.ts:409-410` | "HW3 Errors and Big-O due in 2 hours" / "CS 357 · 11:59 PM · Gradescope" in the message. Exams carry the room. |

---

## 3. The plan

Seven phases. A, B and G are sequential; C and D touch different files and can run in
parallel once B has landed (CLAUDE.md: extract before parallelising — B *is* the
extraction). Effort is agent time; "Sushi" marks what needs the browser or a decision.

### Phase A — Trust and correctness (S, ½ day)

Ships first, on its own, because every item is a wrong claim or a missing affordance and
none needs design.

1. B1 exam-is-not-overdue in `core/calendar.ts`, with test and mutation check.
2. B2 + B3: `--primary`, `--primary-ink`, `--accent-ink` tokens in `ui.css` (all three themes,
   light and dark); `.setup--primary` and the empty-state "Sign in" button use them.
   Verify by luminance, not by eye (colour-layer.md rule 2).
3. M8 + m1: source names in prose; field-label map for unreadable rows.
4. M9: build id out of the popup status line; into Settings › Developer.
5. M12: restore the full-view cap and reconcile the comment.
6. m6, m7: relative time in Settings; reword the stale-worker notices.
7. `h3` rule in `ui.css`; remove `SPEC.md §0` from the Sources copy.
8. m12: delete the stale framed preview; add the Settings preview and the screenshot script
   so every later phase is checked in the mode Sushi uses.

Verification: suite green; the three core changes mutation-checked; `npm run shots` in
dark shows the primary button, the pill of B3 legible, and no `GS` in any sentence.

### Phase B — Primitives (S–M, ½ day)

One set of components, extracted before C and D reuse them, so the eight button styles do
not become sixteen.

- `ui.css`: `.btn` (`-primary`, `-secondary`, `-quiet`, `-icon`; sizes `-sm`), `.switch`,
  `.chip` (course, state, count), `.pill` (health), `.banner` (`-info`, `-warn`, `-err`,
  one action slot), `.menu` with keyboard states, `.field` (text, time, select).
- `src/ui/icons.ts`: one inline-SVG set (sync, open-in-tab, settings, more, chevron-left /
  right, check, warning, calendar, bell, exam, pin) built with `createElementNS` exactly as
  `tabIcon` is — §8.1's rendering rule, no markup strings.
- Focus ring, hover, active and disabled states defined once. `prefers-reduced-motion`
  guard around the only two transitions (menu open, tab change, 120ms).
- `accent-color: var(--accent)` as the floor for any native control that survives.

Verification: a `preview-components.html` page in the harness showing every primitive in
every state, dark and light. No behaviour change, so no review beyond the suite.

### Phase C — Popup information architecture (M–L, 2 days)

Goal: the first deadline is visible within 144px of the top in the healthy state, and the
day's content fits without scrolling on a typical day.

1. **Header (40px).** Left: the health pill (M4), `healthPill()` in `core/health.ts`
   beside `badgeFor`, tested. Right: sync (icon button, spins while `sync` is in flight),
   open-in-tab, settings. Click on the pill opens a popover listing each enabled source
   with its state word, last read, and a Sign in / Details action — the same facts Settings
   › Sources shows.
2. **Banners (32px, one line, one action).** Stale source: "Gradescope: signed out for 40h —
   its rows may be out of date [Sign in]". Notifications blocked keeps its own line. The
   booking strip becomes one line at 40px: title · window · not booked [Book].
3. **Tabs (36px).** Labels on all five (M5); count badges in `--err` / `--warn`; `role`s.
   Month still opens the full view from the popup.
4. **Course strip (36px).** Compact chips, one scrolling row (M6); "n hidden" note stays.
5. **Date navigator (32px)**, arrows adjacent to the label, Today button only when moved.
6. **Day → agenda in the popup (M2).** `agendaRows(contents, now)` in `core/calendar.ts`
   returns the sequence the popup draws: untimed group (one-line note), end-of-day group,
   timed rows in order, a "now" marker. The full-view Day keeps `renderDayGrid`.
7. **Week (M3)** — pending Decision 1: rolling 7 days from today in the popup, empty days
   as 22px rows.
8. **Rows.** `<a href>`, roving tabindex, `⋯` visible at 35%, first menu item "Open in
   Gradescope ↗", then Mark done / Hide / Split / Merge with… / Add to Google Calendar.
   Menu keyboard handling. Tooltip on the source column unchanged.
9. **Empty states** use the primitives (a real button under the sentence).

Files: `popup.html`, `popup.css`, `src/ui/popup.ts`, `core/health.ts`, `core/calendar.ts`.
House-rule hazards: the strip's `overflow-x` must sit on the strip, never `body`/`html`;
run the width check from colour-layer.md after every step; every "the UI says" string in
the pill derives from `summarize()` (worker rule 2); the agenda's "now" position and the
rolling window are decisions → core, tests, mutation.

Verification: `npm run shots` dark + light; the budget table re-measured (target row:
144 / 226); the width invariant; keyboard walk (Tab reaches every row, Enter opens,
Shift+F10 opens the menu, Esc closes).

### Phase D — Settings (M, 1.5 days)

Goal: a student can find Sources, fix a sign-in, mute a course and set reminders without
reading a paragraph.

- **Layout.** `max-width: 880px`, sticky left nav in the tab (Sources · Courses · Course
  websites · Reminders · Appearance · Calendar · Data & privacy · Help · Developer).
  Top line: "Illini Dash 1.0.0 · checked 11:16 PM · 5 of 6 sources OK".
- **Copy.** Every section: title, one line, optional "Why?" `<details>` holding today's
  paragraph. No spec references, no worker vocabulary.
- **Sources.** Rows: switch · name · who it is for · state chip ("Connected · 11:16 PM",
  "Sign in needed [Sign in]", "Couldn't read [Details]", "Off"). "Choose again" as a quiet
  button under the list.
- **Courses.** Switch rows with `n items · Canvas, PrairieLearn` (names, not keys); Older
  courses as a subsection with the same row shape and a "Put back" secondary button.
- **Course websites.** Adapter rows: switch · label · host · state ("On · read 2 min ago",
  "Permission missing [Allow]"). "Add a course site" as a field + button; found tables as
  cards with the sample rows. "Check for updates" quiet, with "Updated 5 min ago".
- **Reminders.** Lead-time chips (24h · 2h), quiet hours with `<input type="time">`,
  poll interval as a select (15 / 30 / 60 / 120), "Send a test reminder" secondary, the
  blocked-notifications banner from the primitives.
- **Hidden / Ticked off.** Table rows: course chip · title · undo button.
- **Calendar, Data & privacy.** Buttons in a row with one-line descriptions; Reset alone in
  a bordered "Careful" block with the confirm.
- **Help.** Copy diagnostics, the right-click entry point, then "Prepare a report" with the
  NetID/name explanation first (m8).
- **Developer** (collapsed): worker/build line, stale detection, Gate 0, round-trip, capture.

Files: `options.html`, `src/ui/options.ts`, `ui.css`, `src/ui/theme-panel.ts` (rows use the
primitives; the panel stays liftable). Hazards: every write still goes through the queued
messages; `compat.ts` normalisation stays in front of every field the page dereferences
(worker rule 8); the build-id ping stays, only its wording and position change.

Verification: preview-options in dark and light; a stale-worker simulation (stub returns an
older build id and omits `setAsideCourses`) renders with the warning and no throw.

### Phase E — First run and install (S–M, ½ day)

- `onInstalled` with `reason === "install"` opens `popup.html?view=full`
  (`opensOnInstall(reason)` in `core/setup.ts`, one test). Chrome's own update reloads
  the worker, so the stale-worker case stays a beta-only path.
- A dismissible "Pin Illini Dash" card at the top of the first-run screen with an inline
  SVG of the puzzle piece and the two clicks.
- Rows: switch · name · hint · state chip or "Sign in" secondary button; "Open all sign-in
  pages" secondary; "Show my calendar" primary (visible, B2).
- After the first successful read: "Found 43 deadlines across 6 courses" replaces the
  "n of m connected" line, then the primary button.

Hazards: `setupSummary`/`setupProgress` are tested wording — extend, do not fork.

### Phase F — Notifications and badge (S, ½ day)

- Titles lead with the work (m15); `contextMessage` carries course · time · source;
  exam toasts carry room and duration from `examDetail`.
- Booking nag: "Book a seat: CS 357 Quiz 2 · sessions Sep 21–23".
- Badge colours unchanged (they are fixed strings in core by design).
- Later (v1.1, I13): Open / Mark done buttons with a queued write in the handler.

Verification: `schedule.test.ts` wording tests updated by quoting the new pattern; "Send a
test reminder" in Settings shows the new shape.

### Phase G — Store readiness (M, 1 day + Sushi)

- **Icon.** One SVG mark rendered to 16 / 32 / 48 / 128 with `qlmanage -t -s <n>` (no
  dependency). Two candidates for Decision 4: (a) navy tile, one heavy orange dash, a small
  white tick at its end — "Dash", reads at 16px; (b) navy tile with an orange calendar
  header and a white dot for today. Not the Block I: the listing already says "not
  affiliated", and the mark is a trademark.
- **Screenshots** (1280×800, five): week and month in the full view, the Exams tab, the
  first-run screen, a reminder toast composited onto a `preview-frame.html` page. Generated
  by the §6 script from the harness data (real UI, canned rows), dark and light.
- **Promo tile** 440×280 from the same frame page.
- **Manifest**: version `1.0.0`, `homepage_url`, `commands`.
- **Listing**: copy in `docs/store/listing.md` stands; add the privacy-policy URL once
  published (Sushi).
- **Pre-submit QA** (§6 checklist) on a clean profile: install → first run → sign in →
  popup → Settings → notification → uninstall.

---

## 4. Specs

### 4.1 Popup vertical budget (target)

| Block | Now | Target |
|---|---|---|
| Header bar | 48 | 40 |
| Stale banner (when shown) | 48 | 32 |
| Booking strip (when shown) | 50 | 40 |
| Tabs | 47 | 36 |
| Course strip | 81 | 36 |
| Date navigator | 39 | 32 |
| **Healthy total** | **215** | **144** |
| **Worst case** | **322** | **226** |

### 4.2 Type scale

`system-ui` stays (a webfont in a popup is a flash on every open). Sizes 13 / 12 / 11,
and 10 only for tracked uppercase labels; weights 400 / 600 / 700; `tabular-nums` on every
clock and count; line-height 1.4 in rows, 1.45 in prose. Nothing below 10px anywhere.

### 4.3 Tokens to add (`ui.css`, all three themes, light and dark)

| Token | Light (Illini) | Dark (Illini) | Use |
|---|---|---|---|
| `--primary` | `#13294b` | `#ff6a1a` | The one filled button on a screen |
| `--primary-ink` | `#ffffff` | `#1a0d04` | Its label |
| `--accent-ink` | `#1a0d04` | `#1a0d04` | Text on the accent (today's date) — replaces white |
| `--accent-wash` | `rgba(255,95,5,.12)` | `rgba(255,106,26,.16)` | Selected tab, pressed chip |
| `--focus` | `var(--accent)` | `var(--accent)` | Focus ring (already the accent; named) |
| `--surface-raised` | `#ffffff` | `#132339` | Popover, menu |

Neutral and High-contrast define the same six with their own values. Nothing else changes;
the meaning tokens stay spoken for.

### 4.4 Buttons

| Class | Fill | Border | Ink | Where |
|---|---|---|---|---|
| `.btn-primary` | `--primary` | none | `--primary-ink` | Show my calendar, Book, Sign in (empty state) |
| `.btn-secondary` | `--bg` | `--line` | `--fg` | Sync now, Open all sign-in pages, Not done, Put back |
| `.btn-quiet` | none | none | `--muted` → `--fg` on hover | Today, Choose again, +2 more |
| `.btn-icon` | none | none | `--muted` → `--fg` | Header icons, ⋯, arrows; 28×28 hit area |

Height 28px (`-sm` 24px), radius 6px everywhere, 12px/600 label, focus ring 2px `--focus`
offset 1px. Disabled at 50% with `cursor: default`. A spinner state for `.btn-icon` (sync).

### 4.5 Tabs

`role="tablist"` strip, 36px; each tab a `role="tab"` button, 12px/600, padding 6px 8px,
radius 6px; selected = `--accent-wash` fill + `--fg` ink (no outline, no box-shadow);
count badge 16px pill in `--err`/`--warn` wash with its ink. Icons only when `.view-full`.

### 4.6 Course chips

24px tall, 11px/600, padding 2px 8px 2px 6px, 7px dot, radius 12px; pressed-off state
keeps the hollow dot and the strikethrough (a filter must never remove its own control).
Strip: `display: flex; overflow-x: auto; scrollbar-width: none;` on the strip, a 24px
`mask-image` fade at the right edge, 36px total.

### 4.7 Rows and menu

Grid tracks stay (`60px minmax(0,1fr) auto 92px 16px`). Row = `<a href>` with
`tabindex` roving; hover `--hover`, focus ring inside the row; `⋯` opacity .35 → 1.
Menu: `--surface-raised`, `--shadow`, 6px radius, items 28px, ↑ ↓ Home End Esc, first item
"Open in {Source}"; positioned to the anchor's left edge when it would overflow.

### 4.8 Banners and the health pill

Banner: 32px, 12px text, icon 14px, one `.btn-quiet` action at the right, `-warn` and
`-err` washes from the existing tokens. Health pill: 24px, dot 8px (filled ok / warn / err,
hollow pending), 11px/600 text, `--surface` fill, `--line` border; clickable states get
`cursor: pointer` and a chevron. In High-contrast the dot keeps its per-state shape.

### 4.9 Contrast (WCAG ratios, computed)

| Pair | Ratio | Verdict |
|---|---|---|
| white on `#ff5f05` (light accent) | 3.05:1 | fails AA text |
| white on `#ff6a1a` (dark accent) | 2.87:1 | fails |
| `#1a0d04` on `#ff5f05` | 6.24:1 | passes |
| `#1a0d04` on `#ff6a1a` | 6.64:1 | passes |
| `--muted #5b6a82` on white | 5.48:1 | passes |
| `--muted #9bb3d0` on `#0b1726` | 8.37:1 | passes |
| `--warn #9a6700` on white | 4.87:1 | passes |
| `--warn #d4a72c` on `#0b1726` | 8.03:1 | passes |
| `--brand #0d1626` on `#0b1726` (B2) | 1.03:1 | invisible |

### 4.10 Icons and motion

One inline-SVG set at 16px / 1.5 stroke / round caps, `currentColor`, `aria-hidden`, a
`title` on the button, never on the SVG. Motion: menu open 120ms ease-out, tab content
120ms opacity; nothing moves layout; `@media (prefers-reduced-motion: reduce)` zeroes both.
No spinner longer than the request timeout; the pill takes over after 20s.

---

## 5. Copy guide

- **Names.** Canvas, Gradescope, PrairieLearn, PrairieTest, smartPhysics, "the course
  website". Codes (`GS`, `CV`, `WEB`) only in the row's source column.
- **States.** Connected · Checking… · Sign in needed · Couldn't read · Unreachable · Off.
  Never `parse_error`, `needs_login`, `pending` on screen.
- **Verbs on controls say what happens.** Sign in, Book, Mark done, Hide, Split, Merge
  with…, Open in Gradescope, Reload. A control's result is confirmed in place ("Checked ·
  all 5 OK"), never only at the bottom of the page.
- **Times.** Clock for today ("11:59 PM · in 4h"), weekday this week, date beyond; relative
  ("5 min ago") for "last read"; the full stamp in a tooltip. An invented time is never
  shown as a clock (unchanged).
- **Errors** say what happened and what to do, in that order, in one sentence each. No
  build ids except inside the one warning whose evidence they are.
- **Nothing from a spec, a house rule or a worker** reaches a student's screen.

---

## 6. Verification and process

- **Dark first**, every time, then light, then Neutral and High-contrast on the popup.
- **The width invariant** after any popup change (from colour-layer.md):
  `body.getBoundingClientRect().width === 400`, `scrollWidth === 400`, no element with
  `right > 401`, `overflowY === "visible"`.
- **Decisions in core** with tests, and a mutation check per decision: exam-not-overdue
  (B1), `healthPill` text per state (M4), `agendaRows` order and the now-marker (M2), the
  rolling window (M3), `opensOnInstall` (E). Assert the mutation applied before trusting a
  "survived" (CLAUDE.md, mutation rule 1).
- **The harness grows two pages**: `preview-options.html` (stub answers `ping` with the
  current build id, `get-options-state`, `get-adapters`; a `?stale=1` variant answers with
  an older build id and omits `setAsideCourses`), and `preview-components.html`.
- **`npm run shots`** renders every page in dark and light to `docs/ux/after/` with headless
  Chrome and no dependencies. `scripts/preview.mjs` gains a third output, `shot.html`, a
  one-line page that seeds `localStorage` (view, theme) from its query string and then loads
  `preview-popup.html` or `preview-options.html`. This is how the captures in
  `docs/ux/before/` were made:

  ```bash
  # --force-dark-mode flips prefers-color-scheme in headless Chrome.
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "$CHROME" --headless=new --no-first-run --user-data-dir=/tmp/shot-profile \
    --hide-scrollbars --force-dark-mode --virtual-time-budget=2500 \
    --window-size=400,600 --screenshot=docs/ux/after/popup-day-dark.png \
    "http://localhost:8731/shot.html?view=day"
  ```

  Chrome sometimes lingers after writing; the script waits for the file, then kills the
  process. Drop `--force-dark-mode` for the light set.
- **Store QA on a clean profile**: install → first-run tab opens → pin card → sign in to
  one source → popup shows the pill turning green → Settings loads in under a second with
  no console error → test reminder arrives → uninstall clears storage.
- **Review policy**: everything above is UI or a small core decision; light review and the
  suite, per CLAUDE.md. No full review is warranted.

---

## 7. Decisions for Sushi

Asked one at a time, when the phase reaches them; each answer changes what gets built.

1. **Popup Week: rolling 7 days from today (recommended), or Sun–Sat like the full view?**
   Rolling puts today first on every weekday; Sun–Sat keeps one definition of "week" in
   both windows.
2. **Popup Day: agenda (recommended), or keep the hour grid?** The grid stays in the full
   view either way.
3. **Health pill replacing the six dots (recommended), or dots with labels?** The pill also
   retires the popup's bottom status line.
4. **Icon direction**: the dash-and-tick tile or the calendar tile. Two candidates will be
   rendered at 16 / 32 / 128 in the harness before asking.
5. **Version and listing**: `1.0.0` at submission (recommended) or keep `0.x` for a public
   beta; the privacy-policy URL once it is on GitHub Pages.

Browser checks Sushi will be asked for, one at a time, each with the literal thing to
report: the first-run tab opening on a clean-profile install (E); the pinned badge
after a sign-in (C); one reminder toast (F).

---

## 8. Order and effort

| Phase | Effort | Depends on | Needs Sushi |
|---|---|---|---|
| A — Trust and correctness | ½ day | — | no |
| B — Primitives | ½ day | A | no |
| C — Popup IA | 2 days | B | decisions 1–3 |
| D — Settings | 1½ days | B | no |
| E — First run and install | ½ day | B | one clean-profile check |
| F — Notifications | ½ day | A | one toast check |
| G — Store readiness | 1 day | C, D, E | decision 4, 5; account; policy URL |

About six and a half days of agent time; C and D can overlap. G4 (the beta) is unchanged
by this plan and can run on the Phase A build; G5 needs everything through G.

---

## 9. Course websites, once a course has several pages

*Decided while building it, 2026-09-18. Recorded here because two of these are
choices a reader would otherwise read as accidents.*

An adapter is one fixed URL (§4.5), so a course that keeps assignments on one page
and exams on another needs two of them — and the flat list showed those as two rows
both called `ECE 411 course site` on the same host, with no way to tell which switch
turned off the exams.

- **The course code is a heading, not a column.** Each course gets its own bordered
  list, headed by the code, and a row is named for its page — the adapter's label with
  the code taken off the front, so `ECE 411 assignments` reads as `assignments`. A
  label that is not prefixed with its code is left exactly as written rather than
  guessed at.
- **The page path is the row's hint.** `assignments.html · courses.grainger.illinois.edu`.
  The hostname stays because a course site on a host nobody recognises is the thing
  worth noticing before granting it; the path is what makes two rows of one course
  different.
- **The undo line names the page, not just the course.** The brief said
  `Removed ECE 411 · Undo`; it says `Removed ECE 411 exams · Undo`, because after a
  change made entirely to tell one page of a course from another, an undo that cannot
  say which page went is the one place the old ambiguity would survive.
- **Remove offers an undo rather than asking first.** The JSON to put it back is already
  in hand, so it is one click to do it and one to take it back, against two clicks every
  time for a dialog nobody reads. Undo restores the switch as well as the entry:
  removing switches it off, and putting it back switched off would be half an undo.
- **A course whose last page was removed keeps its heading for those ten seconds**, with
  no rows under it, because otherwise the notice has nowhere to hang — and that is
  exactly the removal most likely to be a mistake.
