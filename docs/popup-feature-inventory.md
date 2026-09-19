# Popup feature inventory

An exhaustive, redesign-checkable list of everything the current popup surface does.
Read-only survey, 2026-09-19, against `public/popup.html`, `public/popup.css`,
`public/ui.css`, `src/ui/popup.ts` (3809 lines), `src/ui/editor.ts`,
`src/ui/theme-panel.ts`, `src/ui/icons.ts`, `src/ui/download.ts`, `src/messages.ts`,
`src/core/compat.ts`, `src/core/health.ts`, `src/core/grouping.ts`, `src/core/calendar.ts`,
`src/core/names.ts`, SPEC.md §8.1, and the UI sections of CLAUDE.md.

**The popup and the full view are the same document.** `popup.html` is served both as the
browser-action popup and, with `?view=full`, as an ordinary tab (§8.1's "⤢ open full
view"). Every feature below exists in both unless the "where" column says otherwise.

A note on scope: the popup has **no DOM tests at all**. Everything the suite pins about it
is pinned in `core/` (see the last section). Any behaviour that lives in `src/ui/popup.ts`
itself is pinned only by the preview harness (`npm run preview`, `npm run shots`) and by
Sushi in the real browser.

---

## Contents

- [A. Document shell and load-time behaviour](#a-document-shell-and-load-time-behaviour)
- [B. Header bar](#b-header-bar)
- [C. Health pill and source popover](#c-health-pill-and-source-popover)
- [D. Banners](#d-banners)
- [E. Tabs and view state](#e-tabs-and-view-state)
- [F. Course filter chips](#f-course-filter-chips)
- [G. Date navigator](#g-date-navigator)
- [H. The row](#h-the-row)
- [I. The row menu](#i-the-row-menu)
- [J. Day view (agenda + grid + drag)](#j-day-view)
- [K. Week view](#k-week-view)
- [L. Month view](#l-month-view)
- [M. Exams view](#m-exams-view)
- [N. Attention view and suggestions](#n-attention-view-and-suggestions)
- [O. The editor (manual items)](#o-the-editor-manual-items)
- [P. Empty and error states](#p-empty-and-error-states)
- [Q. Status line](#q-status-line)
- [R. First-run setup screen](#r-first-run-setup-screen)
- [S. Sync, refresh and liveness](#s-sync-refresh-and-liveness)
- [T. Floating-panel mechanics (menus, popovers)](#t-floating-panel-mechanics)
- [U. Keyboard and a11y summary](#u-keyboard-and-a11y-summary)
- [V. Theme and dark mode](#v-theme-and-dark-mode)
- [W. What lives in Options, not the popup](#w-what-lives-in-options-not-the-popup)
- [X. Load-bearing CSS/layout invariants](#x-load-bearing-csslayout-invariants)
- [Y. Every DOM id and class the popup writes](#y-every-dom-id-and-class-the-popup-writes)
- [Z. Test files that pin popup behaviour](#z-test-files-that-pin-popup-behaviour)

---

## A. Document shell and load-time behaviour

- [ ] **F01 — Static skeleton, seven slots, in order.**
  `public/popup.html` ships `header.bar` > `#health` + `#actions`, then `#banners`,
  `nav#tabs.tabs[role=tablist][aria-label=Views]`, `#filters.filters`, `#nav.datenav`,
  `main#view`, `#status[hidden]`. Everything else is built in JS.
  *Budget stated in the HTML comment: 144px of chrome above `#view` on a healthy popup
  (was 215 healthy / 322 worst).*
  Where: `public/popup.html`.

- [ ] **F02 — Theme applied before first paint.**
  `applyStoredTheme()` is called at module top, before any element is read, so there is no
  flash of the wrong palette. Reads `localStorage`, never the store (a store read costs a
  worker round trip).
  Where: `src/ui/popup.ts` top-level → `src/ui/theme-panel.ts:applyStoredTheme`.

- [ ] **F03 — Full-view marker set from the URL, before first paint.**
  `new URLSearchParams(location.search).get("view") === "full"` adds `view-full` to
  `documentElement` and sets `document.title = "Illini Dash — everything due"`.
  `const isFullView = documentElement.classList.contains("view-full")`.
  **Load-bearing (CLAUDE.md, "The popup is measured by Chrome"): the full view must key off
  this marker and never off a `@media (min-width:…)` query** — Chrome lays the document out
  to decide the popup's width, so a width-keyed layout rule can measure wide, restyle wider
  and open wider.
  Where: `src/ui/popup.ts:139-143, 1786`; `public/popup.css:38-45, 802-908`.

- [ ] **F04 — Module-scope bootstrap sequence.**
  On load, in order: `renderActions()`; `void refresh()`; `void send({type:"sync",
  trigger:"popup"}).then(refresh).catch(() => undefined)`; `void recheckLogins()`.
  §6: opening the popup triggers a sync, debounced worker-side to 5 minutes.
  Where: `src/ui/popup.ts:3729-3736`.

- [ ] **F05 — `safeUrl` gate on every rendered URL.**
  §8.1's security rule, second line of defence: a URL is only made clickable if
  `new URL(raw).protocol === "https:"`. Refuses `javascript:`, `http:` and malformed
  hrefs. **Amended 2026-09-18**: it used to also require `.illinois.edu` or one of four
  hosted hosts, which made valid adapter rows (cs124.org, cs225.org) render as unclickable
  divs. Everything from a source is inserted with `textContent`, never `innerHTML`; icons
  are built with `createElementNS`.
  Where: `src/ui/popup.ts:124-133`; `src/ui/icons.ts`.

---

## B. Header bar

- [ ] **F06 — Wordmark.** `span.wordmark` reading "Illini Dash", in `--brand-mark`,
  `flex: none` so it never shrinks (the pill is what absorbs a narrow window). 12px in the
  popup, 15px in the full view.
  Where: `src/ui/popup.ts:renderWordmark` (385); `public/popup.css:142-147`.

- [ ] **F07 — "+" Add a deadline.**
  `iconButton("plus", "Add a deadline")`. `stopPropagation` (else the document click
  listener closes the panel it opens) → `openAddEditor()`. Prefills the **day being
  viewed**, not today.
  Messages: none directly; the editor sends `add-manual-item`.
  Where: `src/ui/popup.ts:403-409`.

- [ ] **F08 — Sync button.**
  `iconButton("sync", "Sync now")` → `runSync()`. Held in module-level `syncButton`.
  States: idle; `data-busy="true"` + `disabled` while syncing (CSS spins the icon,
  `ui.css:322`); re-enabled by `endSync()`.
  Messages: `{type:"sync", trigger:"manual"}` → awaited, then `refresh()`.
  Where: `src/ui/popup.ts:411-413, 3593-3669`.

- [ ] **F09 — "Open in a tab".**
  `iconButton("open-tab", "Open in a tab")`, **popup only** (`if (!isFullView)`).
  Messages: `{type:"open-full-view"}` — handled by the worker, which owns "is it already
  open" because a popup is destroyed on focus loss and cannot remember the tab it opened.
  Where: `src/ui/popup.ts:415-421, openFullView (1903)`; `src/background.ts:1092`.

- [ ] **F10 — Export .ics from the header.**
  `iconButton("calendar-out", "Save this list as a calendar file (.ics)")`.
  Messages: `{type:"get-state"}` → on `type === "state"`, `downloadIcs(response.items)`,
  then `showStatus("Saved N deadlines to illini-dash.ics — a one-time copy, not a
  subscription. Import it into Google Calendar, Apple Calendar or Outlook.")`.
  `itemsToExport` drops hidden rows, keeps done rows. Filename `illini-dash.ics`,
  mime `text/calendar`, object URL revoked on the next task.
  **No `.catch` on this `send`** — the one header control that violates UI rule 2.
  Where: `src/ui/popup.ts:437-448`; `src/ui/download.ts`.

- [ ] **F11 — Settings gear.**
  `iconButton("settings", "Settings")`. In the full view it navigates the current tab
  (`location.href = chrome.runtime.getURL("options.html")`) so two Illini Dash tabs do not
  pile up; in the popup it calls `chrome.runtime.openOptionsPage()`.
  Where: `src/ui/popup.ts:450-460`.

- [ ] **F12 — Header actions hidden during setup.**
  `.setup .bar--right { visibility: hidden }` — nothing to sync to, nowhere to open yet.
  Where: `public/popup.css:670`.

---

## C. Health pill and source popover

- [ ] **F13 — The health pill.**
  One `button.pill.is-<tone>` with `aria-haspopup="dialog"`, `title="Which sites were read,
  and when"`, containing `i.pill--dot` + `span.pill--text` (+ a `right` chevron **only when
  the pill has no action button beside it**). Replaces six 9px dots *and* the old status
  line. Tone/text from `healthPill(sources, lastSyncAt, now)` (`core/health.ts:365`), which
  derives everything from `summarize()` so it can never claim a source is fine when nothing
  was fetched (worker rule 2).
  Where: `src/ui/popup.ts:renderHealth (165)`; `public/ui.css:397-415`.

- [ ] **F14 — Pill states, in precedence order** (`healthPill`):
  1. a sync is in flight → `{tone:"pending", text:"Checking…"}` (set locally in
     `renderHealth`, outranking the store — a real sync is 5–10s and the store holds the
     *last* outcome);
  2. `needsLogin > 0` → warn, `Sign in to <Name>` / `Sign in to N sites`, action = login;
  3. `failing > 0` → err, `<Name> didn't answer` (network_error, ranked first because it is
     a button press) / `<Name> looks different` (parse_error) / `N sites didn't answer|look
     different`, action = retry or open;
  4. no checkable sources → warn, `No sites are switched on`;
  5. `ok === 0` → pending, `Checking…`;
  6. `pending > 0` → pending, `Checking… N of M read`;
  7. otherwise → ok, `<Name> OK · 10:32` or `All N OK · 10:32`.
  Tones map to `is-ok|is-warn|is-err|is-pending` on `.pill`, colouring `.pill--dot`.
  Where: `src/core/health.ts:365-440`.

- [ ] **F15 — The pill is a toggle, not an opener.**
  Click: if `aria-expanded === "true"` → `closeMenus()` and drop the attribute; else
  `openHealthPopover(...)`. Without this, pressing it a second time closed and immediately
  rebuilt the panel — the one dismiss gesture everybody tries was the one that could not
  work. `event.stopPropagation()` so the document click listener does not eat it.
  Where: `src/ui/popup.ts:204-216`.

- [ ] **F16 — Action button beside the pill.**
  `actionButton(pill.action)` rendered in `#health` with `btn-quiet` (not `btn-secondary`).
  Three kinds (`SourceAction`):
  - `login` → "Sign in", title `Open <Name>'s login page`, `chrome.tabs.create({url})`;
  - `open` → "Open", title `Open <Name> and see what the page looks like`;
  - `retry` → "Retry" (one word — "Try again" cost the health sentence four characters),
    title `Read <Name> again`; `stopPropagation`, `closeMenus()`, `runSync()`.
  Where: `src/ui/popup.ts:actionButton (329)`; `core/health.ts:actionFor (304)`.

- [ ] **F17 — Source health popover.**
  `div.menu-surface.popover[role=dialog][aria-label="Source health"]`, one `.srow` per
  `sourceRows(sources, now)`, placed by `placeFloating(menu, anchor, "left")` and trapped by
  `trapMenuKeys`. Clicks inside are `stopPropagation`'d.
  Where: `src/ui/popup.ts:openHealthPopover (243)`.

- [ ] **F18 — A source row in the popover.**
  Grid `8px / 1fr / auto / auto`: `i.srow--dot.is-<tone>`, `span.srow--name` (`SOURCE_TITLE`,
  not `SOURCE_NAME` — "the course website" reads wrong between Canvas and PrairieTest),
  `span.srow--state.is-<tone>` reading `"<word> · <lastRead>"` when state is `ok` and a
  last-read exists, else just the word. `title` carries `lastError` and
  `last read <exact stamp>`, newline-joined. Then the same `actionButton`.
  State words (`names.ts:STATE_WORD`): ok → **Connected**, pending → **Checking…**,
  needs_login → **Sign in needed**, parse_error → **Couldn't read**, network_error →
  **Unreachable**, disabled → **Off**.
  Tones (`toneFor`): ok→ok, needs_login→warn, disabled→off, pending→pending, else err.
  Row order (`sourceRows`): needs_login, parse_error, network_error, pending, ok, disabled,
  then alphabetical by source.
  The `manual` source is excluded (`isFetchedSource`) — it has no last-read, no error and
  no action.
  Where: `src/ui/popup.ts:renderSourceRow (266)`; `core/health.ts:sourceRows (470)`.

- [ ] **F19 — `signInUrl` is one decision in one place.**
  Three surfaces open a login page (setup checklist, empty state, stale banner) and all
  three go through `signInUrl(source, status, assume?)` → `actionFor(...)`, because a
  course website has no fixed login form and the four copies of `LOGIN_URL[source]` were
  wrong for it in all four places.
  Where: `src/ui/popup.ts:319-327`.

---

## D. Banners

One slot (`#banners`), one line each, one action each. Replaces three separate elements
(notification warning, stale warning, booking strip) that could all be on screen at once
for 146px of a 600px window. Rule: **if a banner needs a second sentence, the second
sentence belongs on the page it links to.**
Where: `src/ui/popup.ts:renderBanners (485)`, `renderBanner (562)`; `public/ui.css:424-449`.

- [ ] **F20 — Banner shape.** `div.banner-line.banner-<tone>` (`info|warn|err`) with an
  icon, `span.banner-line--text` (ellipsed, `white-space: nowrap`, full text in `title`),
  and an optional `button.btn.btn-quiet.btn-sm`.

- [ ] **F21 — Notifications blocked.** tone err, glyph `warning`,
  "Chrome is blocking reminders, so nothing will notify you", action "How to fix" →
  `chrome.runtime.openOptionsPage()`. Driven by `state.notificationsBlocked` from the
  `state` message.

- [ ] **F22 — Stale source.** From `staleNotice(sources, new Date())`
  (`core/health.ts:572`, 12h threshold, never-succeeded first, then needs-login, then
  oldest). tone warn, text `<Name>: never read — nothing from it is listed` or
  `<Name>: signed out Nh — rows may be old`. Action "Sign in" only when
  `stale.needsLogin && signInUrl(...)` resolves.

- [ ] **F23 — Undo a deletion.** tone info, glyph `info`, `Deleted “<title>”`, action
  "Undo" → `undoDelete()`. Shown while `pendingUndo && Date.now() < pendingUndo.until`
  (10s, `UNDO_MS`). Held in a module variable, not in the element, so a sync landing two
  seconds after a delete cannot take the Undo away; the banner is re-derived on every draw.
  **In `#banners`, not `#status`** — UI rule 3: the week view is ~1100px in a 600px window,
  and this message has a deadline on it.

- [ ] **F24 — Booking strip (§4.4).** One banner per `bookings(state.items)`. tone warn,
  glyph `tab-exams`, text `<title minus "Book a slot: "> · sessions Sep 22–24` (from
  `bookingWindowRange`, which writes the month once) or `… · not booked`. Action "Book" →
  opens the row's `safeUrl`. Pinned above the tabs because a booking window closes whether
  or not the student looked.

---

## E. Tabs and view state

- [ ] **F25 — Five tabs, always labelled, in both windows.**
  `VIEWS = ["day","week","month","exams","attention"]`, labels Day / Week / Month / Exams /
  Attention. Each is `button.tab[role=tab][aria-selected]` with `tabIndex = selected ? 0 :
  -1`, an icon (`tab-day`…`tab-attention`) and `span.tab--label`.
  Where: `src/ui/popup.ts:renderTabs (1830)`.

- [ ] **F26 — Count badges.**
  `span.chip-count` (`.is-warn` on Exams) when count > 0, plus
  `title = "<Label> — N need(s) attention"`.
  - Exams badge = `examCount(items, now)` = **unbooked exams only**.
  - Attention badge = `attentionCount(owed, now) + currentSuggestions.length`, i.e. only
    the *actionable* attention groups (Overdue, Couldn't read) plus suggestions. The folded
    "No date at all" group is deliberately excluded — a badge that only grows is a badge
    nobody reads.

- [ ] **F27 — Month is full-view only.**
  `FULL_VIEW_ONLY = new Set(["month"])`. In the popup the Month tab gets
  `title = "Opens the full view — a month needs more width than a popup has"` and
  `selectTab("month")` calls `openFullView("month")` instead of switching. A stored view of
  `month` is coerced to `day` on load in the popup.

- [ ] **F28 — Tab selection persists.** `selectTab` sets `view`, resets `dayOffset = 0`,
  writes `localStorage["illini-dash.view"]`, and `refresh()`s. `storedView()` validates
  against `VIEWS` and falls back to `day`. All `localStorage` access is try/caught
  (`readStored`/`writeStored`) because the accessor itself throws with site data blocked.

- [ ] **F29 — ← → moves between tabs** (wrapping), `preventDefault`ed; Tab leaves the strip
  entirely rather than walking five buttons (roving tabindex).

- [ ] **F30 — Popup → full view handoff.**
  `openFullView(view?)` writes `VIEW_KEY` **and** `HANDOFF_KEY =
  "illini-dash.openView"` (`{view, at}`) before sending `{type:"open-full-view"}`. An
  already-open full-view tab listens for the `storage` event, ignores everything but
  `HANDOFF_KEY`, validates the view name, resets `dayOffset` and redraws. Two keys, because
  `VIEW_KEY` is written on every ordinary tab change and a full view that followed the
  popup around would be a surprise.
  Where: `src/ui/popup.ts:1901-1932`.

- [ ] **F31 — Tab strip is sticky under the header.**
  `render()` measures `.bar`'s `offsetHeight` and sets `tabsEl.style.top` — measured, not
  hard-coded, because the bar's height is a font metric.

- [ ] **F32 — `document.body.dataset.view`** is set from the drawn view on every render.
  The full view's width cap keys off it (`--frame-max`: 900px for lists, 1400px for month)
  **instead of a media query**, for the same self-feeding-width reason as F03.

---

## F. Course filter chips

- [ ] **F33 — Legend and filter as one control.**
  `renderFilters(items, colours)` draws one `button.fchip.course-N[aria-pressed]` per course
  in `coursesIn(items)` — only when there are ≥ 2 courses. Each chip is a coloured dot `i`
  plus the course label (`courseLabel(course, courseNames)`, i.e. the student's rename if
  any). `title` = `Hide <label>` / `Show <label> again`.
  Where: `src/ui/popup.ts:1945-1980`.

- [ ] **F34 — Switching off keeps the chip on screen.**
  `aria-pressed="false"` → 45% opacity, hollow dot, label struck through. A filter that
  removes the control along with the work gives no way back (§11 one level up).

- [ ] **F35 — "N hidden" counter.** `span.fhidden` with
  `title="Switched off here, not gone. Click a struck-through course to bring it back."`

- [ ] **F36 — Persistence.** `localStorage["illini-dash.hiddenCourses"]`, a JSON array,
  parsed defensively (`hiddenCourses()` filters to strings, returns empty on throw).

- [ ] **F37 — Colour assignment.** `courseColours(coursesIn(visibleItems(items, settings,
  new Set(), now)))` — computed over the **unfiltered** list, so hiding a course does not
  recolour the others. `course-0`…`course-7` each set `--course` (ink) and `--course-bg`
  (wash) together, so nothing can get a blue bar on a green field.

- [ ] **F38 — Horizontal scroll on the strip only.**
  `.filters { overflow-x: auto }` with a mask fade and hidden scrollbar. **Never on
  `body`/`html`** — that is what opened the popup at 800×600 once already.
  `.filters:empty { display: none }`.

---

## G. Date navigator

- [ ] **F39 — `‹ label ›`, arrows either side of the label.**
  `renderDateNav(label, step)`; `#nav` is `hidden` when `step === 0` (Exams and Attention).
  Back/Forward are `iconButton("left"|"right", "Back"|"Forward")` with `btn-sm`, adjusting
  `dayOffset` by `step` and refreshing.
  Steps (`navFor`): day → 1, week → 7, month → 28 (whole weeks, so ‹ › lands on the same
  weekday), exams/attention → 0.
  Labels: day → `Today · Sat, Sep 12` at offset 0 else `Sat, Sep 12`; week →
  `Sep 12 – Sep 18`; month → `September 2026`.
  Where: `src/ui/popup.ts:1997-2033, 3398-3426`.

- [ ] **F40 — "Today" appears only when `dayOffset !== 0`.**
  `button.btn.btn-quiet.btn-sm.datenav--today`, placed next to the arrows
  (`margin-left: 6px`), not at the far end of the bar.

---

## H. The row

`renderRow(item, now, section, dueText?, colours?)` — `src/ui/popup.ts:612-857`.

- [ ] **F41 — `<a>` when there is a safe URL, `<div>` otherwise.**
  An `<a href>` is focusable, middle-clickable, copyable and announces as a link; a `<div>`
  with a click handler is none of those. A URL-less row is a `<div>` plus `.row--flat`
  (`cursor: default`) — an `<a>` with no href announces as a link that goes nowhere.

- [ ] **F42 — Click opens in a new tab.**
  `preventDefault()` then `chrome.tabs.create({url})` — a popup navigating itself away
  leaves a 400px window showing Gradescope.

- [ ] **F43 — Keyboard context menu on a row.**
  `Shift+F10`, `ContextMenu` and `.` all open the row menu via the `.row--menu` trigger.

- [ ] **F44 — Roving tabindex.** `row.tabIndex = -1` at build; `makeRowsNavigable()` after
  every draw sets the first to 0. `rowsInView()` = `a.row, .mpill[role='button']` (the month
  has no `a.row` — its pills are the same ring).

- [ ] **F45 — ↑ ↓ walks the list.** One `keydown` listener on `#view`, attached **once at
  module scope** — it used to be inside `makeRowsNavigable`, so listeners stacked and after
  two redraws one ArrowDown moved three rows.

- [ ] **F46 — Course colour on the row.** `row.classList.add("course-N")` → 3px left edge
  in `--course`, `--course-bg` fill inside calendar containers, and the chip takes the hue.

- [ ] **F47 — Tone class from `itemTone(item, now)`** (`core/calendar.ts:856`), one decision
  shared with the month grid. `open` earns no class. Others: `row-booking`, `row-done`
  (title struck, 70% opacity), `row-event` (muted title and due — furniture, not work),
  `row-overdue` (red due), `row-late` (amber left border + amber due).

- [ ] **F48 — Course chip.** `span.chip` with `courseLabel(item.courseLabel, courseNames) ||
  "—"`. `max-width: 100%` + ellipsis is load-bearing: a grid item does not clip to its
  60px track, and `stat_425_120248_268442` painted straight over the title.

- [ ] **F49 — Title.** `span.row--title`, `textContent`, `title` attribute = same. One line
  with ellipsis in list shapes; **two lines then ellipsis inside calendar containers**
  (`.grid--stack`, `.witems`, `.band`) via `-webkit-line-clamp: 2`.

- [ ] **F50 — Practice chip (§4.3).** When `item.forCredit === false`, a
  `span.row--practice.chip.chip-practice` reading "practice" with
  `title="The source says this does not count toward your grade"`. Lives **inside**
  `.row--name`, not in a grid track of its own — a conditional grid child shifts every
  column after it and the dates stop lining up.

- [ ] **F51 — Source codes.** `span.row--sources` = distinct `SOURCE_CODE` per member,
  space-joined, on **every** row (not only merged ones). Tooltip:
  - >1 source: `One deadline, seen by N sources: A and B. If they are not really the same
    thing, use ⋯ → Split.`
  - `manual`: `You added this[ — click the row to open the link you gave]`
  - else: `On <Name>[ — click the row to open it]`
  Fixed 44px track (holds two codes; three ellipse), `cursor: help`.

- [ ] **F52 — The "when" column.** `span.row--due`, `tabular-nums`, right-aligned. Three
  sources, in order:
  1. `unreadableDeadline(item)` non-empty → class `row--unreadable`, text **"unreadable"**,
     plus a `.row--detail.row--detail-error` line with `unreadableSummary(...)` and a
     `title` listing `<source> <field>: <raw>` per flag (as text — §8.1's rendering rule);
  2. an explicit `dueText` passed by the caller (agenda clock, exam date, booking window,
     or `{primary: ""}` for the untimed band, which deliberately says nothing because the
     band heading already did);
  3. `formatDue(item, now, section)` (`core/grouping.ts:353`), whose precision depends on
     the section heading above it — Today/Tomorrow → clock (+ `· in 4h` under Today), This
     week → `Thu 11:59 PM`, Later → `Sep 22`, otherwise relative.

- [ ] **F53 — Assumed-time marker.** `item.timeAssumed` → `.row--assumed` (italic,
  `cursor: help`) and `title="The course site gives a date but no time. Check the course
  page for the cutoff."` `formatDue` also appends `· no time` to the primary.
  Worker rule 3: a value this code invented is marked as invented.

- [ ] **F54 — Soft quality flag.** `qualityFlags(item).filter(f => !f.blocksDate)` non-empty
  and the date *is* readable → a `span.row--flag` "!" appended inside `.row--due`, tooltip
  listing `<source> <field>: <detail>`.

- [ ] **F55 — Second-line detail rows.** Each is a `span` with `grid-column: 2 / -1`:
  - `.row--detail` — the `formatDue` qualifier (late window, credit remaining, `N% so far`,
    `not open yet`);
  - `.row--detail-exam` — `examDetail(item)`: `<location> · <room> · <duration>` from §4.4's
    long-parsed-never-shown fields, muted (information, not a problem);
  - `.row--detail-moved` — `movedByText(item)` (a post's correction, permanent, with undo)
    or `movedText(item)` (`moved Tue → Fri`, derived per sync, no undo). Amber.

- [ ] **F56 — "undo" on a moved-by-post row.**
  A `<button class="link row--undo">undo</button>`, **not a link** — it sits inside an `<a>`
  row and a nested anchor is invalid, so the press would open Gradescope.
  `preventDefault` + `stopPropagation`, then `applySuggestionRequest({type:"undo-move",
  itemId}, undo)`. `title="Put this deadline back to what the source says"`.

- [ ] **F57 — The ⋯ trigger.** `iconButton("more", "More actions")` with
  `.row--menu.btn-sm`, `tabIndex = -1`. **Visible at 35% opacity always**, 100% on row
  hover / its own hover / `:focus-visible` / `[aria-expanded="true"]` — it was
  `opacity: 0` until hover, and it carries the whole of §5.3's correction story.
  `preventDefault` + `stopPropagation` → `openRowMenu(item, menu)`.

- [ ] **F58 — Row DOM order.** `chip, name(title + practice), sources, due, menu`, then the
  detail lines. Grid: `60px minmax(0,1fr) 44px 92px 24px`; agenda shape narrows the when
  column to 62px; calendar containers use `… 62px 16px` with `align-items: start`; the full
  view caps the title track at 420px and adds a trailing `minmax(0,1fr)` so the clock
  follows the title instead of being flung at the frame.

---

## I. The row menu

`openRowMenu(item, anchor)` — `src/ui/popup.ts:1288-1395`. `div.menu-surface[role=menu]`,
items are `button.menu-item[role=menuitem]` with `tabIndex=-1`, icon + label. Placed with
`placeFloating(menu, anchor, "right")`, keys trapped by `trapMenuKeys`. Clicks inside are
`stopPropagation`'d.

Entries, in order (conditional ones marked):

- [ ] **F59 — "Open in `<Name>`"** *(only when `safeUrl(item.url)`)*. Icon `open-tab`. Names
  the *first member's* source. `closeMenus()` then `chrome.tabs.create({url})`.
- [ ] **F60 — "Mark done" / "Not done"** (icon `check` / `close`) →
  `applyOverrideAction({kind: item.done ? "undone" : "done", itemId})`.
  Reached for most: two of five sources can never report completion.
- [ ] **F61 — "Hide" / "Unhide"** (icon `close` / `plus`) →
  `applyOverrideAction({kind: item.hidden ? "unhide" : "hide", itemId})`.
- [ ] **F62 — "Split (N sources)"** *(only when `item.members.length > 1`)*, icon `more` →
  `applyOverrideAction({kind:"split", itemId})`.
- [ ] **F63 — "Merge with…"** *(only when candidates exist)*, icon `plus`. Candidates =
  other non-hidden items sharing a course by **`sameCourse` on any member pair** (not the
  derived `courseLabel`, so a cross-listed course "CS425 ECE428" can be re-merged after a
  split). Pressing it **replaces the menu in place** with a `.menu-heading` reading
  `Merge "<title>" with:` and up to **12** candidate entries, then focuses the first
  (the pressed entry and its focus were just removed). Each →
  `applyOverrideAction({kind:"merge", itemId, otherItemId})`.
- [ ] **F64 — "Add to Google Calendar"** *(only when `googleCalendarUrl(item)` resolves)*,
  icon `tab-month` → `chrome.tabs.create({url})`. §8.3 route 1: a TEMPLATE link, no OAuth.
- [ ] **F65 — "Edit"** *(only when `soleManualMember(item)`)*, icon `settings` →
  `closeMenus()` + `openEditEditor(item, member)`.
- [ ] **F66 — "Delete"** *(same condition)*, icon `close` → `deleteManual(item, member,
  entry)`.
  `soleManualMember` requires **exactly one member** and `source === "manual"`: a typed
  deadline merged with a Gradescope one is deliberately left alone (split first).

- [ ] **F67 — `applyOverrideAction` — the three guarantees.**
  `src/ui/popup.ts:1245-1286`. Every correction, every time:
  1. the pressed entry becomes `icon("sync") + "Applying…"` and **every sibling button is
     disabled** — UI rule 4, feedback and a diagnostic at once;
  2. `console.log("[illini-dash] <kind> requested for <itemId>")` **on the popup side**,
     because the popup's console and the worker's are different windows;
  3. `send({type:"override", action})` → `reportOverride` (shows `response.message` when
     `type === "error"`) → `closeMenus(); refresh()`, **with a `.catch`** that closes menus
     and shows `Could not <kind> that row: <message>` (UI rule 2).
  Message: `{type:"override", action: OverrideAction}` where `OverrideAction` is
  `hide | unhide | split | merge | done | undone`.

- [ ] **F68 — `applySuggestionRequest`** — the same three guarantees for Add / Ignore /
  undo-move. Sets `control.textContent = "Applying…"`, disables it and its siblings, logs
  `[illini-dash] <type> requested`, `send(request).then(reportOverride).then(refresh)`,
  `.catch(showStatus)`.
  Where: `src/ui/popup.ts:876-893`.

- [ ] **F69 — `deleteManual`.** Control becomes `icon("sync") + "Deleting…"`, siblings
  disabled, logs `[illini-dash] delete requested for manual:<sourceId>`, sends
  `{type:"delete-manual-item", sourceId}`. On success: captures `valuesOfMember(member)`
  into `pendingUndo` with a 10s expiry and a timer that clears it and refreshes; on `error`
  response shows the message; `.catch` → `Could not delete that deadline: …`;
  `.finally` → `closeMenus(); refresh()`.

- [ ] **F70 — `undoDelete`.** Clears the pending undo and re-saves the captured values via
  `saveManual(values)` — **as a new row with a new `sourceId`**, because the delete pruned
  the old key's overrides and reusing the id would re-arm a hide or a tick against a row
  the student just re-created. `.catch` → `Could not put that deadline back: …`.

---

## J. Day view

- [ ] **F71 — Two shapes.** `renderDayView` → `renderDayGridView` in the full view,
  `renderAgenda` in the popup. The hour axis needs height to be worth its cost and the
  popup has none (Sushi's decision).

### Agenda (popup)

- [ ] **F72 — `viewEl.dataset.shape = "agenda"`**, which is what narrows the when column
  from 92px to 62px in CSS.
- [ ] **F73 — Row sequence from `agendaRows(contents, now, isToday)`** (`core/calendar.ts`),
  not decided in the renderer. Kinds:
  - `heading` → `p.band--head`. `UNTIMED_HEADING` ("Time not posted") gets
    `title = UNTIMED_NOTE`; `END_OF_DAY_HEADING` ("By end of day") gets
    `title = "11:59 PM is the site's default, not an hour anyone picked."`
  - `untimed` → `renderRow(..., {primary: ""})`
  - `item` → `renderPlaced`
  - `now` → `div.nowrule` with a pill of the current clock, drawn only where it separates
    something from something else, and only when `isToday` (`dayOffset === 0`).
- [ ] **F74 — Empty agenda** → `emptyNote("Nothing due this day.")` (`p.muted.empty`).

### Day grid (full view)

- [ ] **F75 — Untimed band above the grid.** `div.band` + `p.band--note` carrying
  `UNTIMED_NOTE = "The course site posted a day, not a time — check the page for the
  cutoff."` Said once above the group, not once per row. **Never "all day"** — that is the
  calendar convention and it is wrong here.
- [ ] **F76 — "By end of day" band, above the grid.** `div.band.band--eod` + `p.band--head`.
  Hoisted because at the bottom of a 16-hour axis the commonest deadline there is sat below
  the fold.
- [ ] **F77 — The hour axis.** `div.grid` = `div.grid--hours` (one `div.grid--hour` per
  hour, `hourLabel`: "noon", "12 AM", "3 PM") + `div.grid--slots` at `26px` per hour
  (`HOUR_PX`), with a `div.grid--line` per hour. Range from `hourRange(contents, include)`.
- [ ] **F78 — Placed items.** One `div.grid--stack` per stack, absolutely positioned at
  `minutesInto(anchor)`; each row gets `{primary: clockOf(at)}` as its due text; an
  `opening` anchor adds `.row-opening` (dashed left edge, italic due) and
  `title = "Not open yet — opens <clock>"`.
- [ ] **F79 — Spans.** `spanMinutes(item, anchor)` (PrairieTest `"50min"`, a typed `endAt`)
  → `.row-span` plus an inline `min-height` of `(span/60)*HOUR_PX`, floored at `HOUR_PX`.
  `min-height` not `height`, so a title still wraps.
- [ ] **F80 — "Now" line.** `div.grid--now` at `minutesInto(now)`, drawn only when
  `dayOffset === 0` **and** now is inside the axis range — at 12:30 AM the offset is
  negative and it drew a red rule straight through the booking strip.
- [ ] **F81 — `fit()` after insertion.** Stacks are absolute so they do not grow the
  container; the slot height is re-measured from the lowest stack after the grid is in the
  document, or an 11:59 PM row drew over whatever is below the grid.
- [ ] **F82 — Empty-day note plus a grid.** `"Nothing due this day. Drag on the grid to add
  something."` or `"Nothing else at a set time today. Drag on the grid to add something."`
  The grid is drawn even on an empty day — reversing an earlier decision — because the axis
  is now where deadlines are *added*.

### Drag-to-add

- [ ] **F83 — Press or drag on the slots.** `pointerdown` (button 0 only), ignoring targets
  inside `.row, .grid--stack, .editor` (but **not** `.grid--line`/`.grid--now`, which are
  decoration across the full width and are what a student aiming at 4 PM hits half the
  time). Pointer capture on `.grid--slots` so a drag leaving the grid still reports.
- [ ] **F84 — Snapping.** `SNAP_MINUTES = 15`; `DRAG_SLOP_PX = 4` below which the gesture is
  a press (one instant, no end time) rather than a drag.
- [ ] **F85 — The ghost box.** `div.grid--draft` (dashed, `--accent-wash`,
  `pointer-events: none` so it cannot become the drag target) with a
  `span.grid--draft-label` from `draftLabel(start, end)` — `"3:00–4:30 PM"`, meridiem
  written once when it is the same one, because the box can be 13px tall.
- [ ] **F86 — The axis widens for the draft.** `setDraft` repaints when the draft fits the
  current range and calls `rebuildDayGrid()` when it does not; `clearDraft()` rebuilds so
  the axis gives back the hours it borrowed.
- [ ] **F87 — Release opens the editor.** `openDraftEditor(startMin, endMin?)`: a dragged
  **span** opens as `kind: "event"` with `time` and `endTime` prefilled; a press with no
  drag opens as `kind: "assignment"` with only `time`. `pointercancel` clears the draft
  instead.
- [ ] **F88 — The ghost follows what is typed.** `onChange` parses the editor's `time` /
  `endTime` with an anchored `^([01]\d|2[0-3]):([0-5]\d)$` and moves the box, so the two
  controls for one fact cannot disagree. A half-typed time leaves the box where it was.
  `onClose` clears the draft.
- [ ] **F89 — `rebuildDayGrid` replaces only the grid element**, leaving an open editor
  above it untouched.

---

## K. Week view

`renderWeekView` — `src/ui/popup.ts:2874-2942`.

- [ ] **F90 — Seven rolling days starting today**, in **both** windows (`WEEK_MODE =
  "rolling"`). Sunday-first was tried and abandoned: opening the tab on a Saturday made
  "this week" six days that had already happened.
- [ ] **F91 — Row shape.** `div.wrow` (+`.wrow--today`, +`.wrow--quiet`) = `div.wday`
  (`div.wday--dow` short weekday, `div.wday--num` date) + `div.witems`.
- [ ] **F92 — Quiet day.** `quietDay(contents, now)` — every item on the day is `done` —
  collapses the header padding. Applies whether the day is empty or holds four finished
  things.
- [ ] **F93 — Empty day.** `.witems--empty` with text `"—"`, a 22px line. Seven full-height
  empty rows is the whole popup.
- [ ] **F94 — Timed items** via `renderPlaced`, then, if any untimed exist, a
  `div.wuntimed` label reading `"time not posted —"` with `title = UNTIMED_NOTE`, then the
  untimed rows with `{primary: ""}`.
- [ ] **F95 — Click the empty part of a day to add.** `box.addEventListener("click", …)`
  guarded by `event.target !== box`, opening the editor **inside that day's box**
  (`where: "end"`) with `date` prefilled.
- [ ] **F96 — Per-day "+" button.** `iconButton("plus", "Add something on Tuesday, Sep 15")`
  with `.btn-sm.wadd`, `stopPropagation`. `opacity: 0` → `.75` on row hover **and on
  `:focus-visible`** — `display:none` would make it unreachable by keyboard.

---

## L. Month view

`renderMonthView` — `src/ui/popup.ts:2948-3019`. Full view only.

- [ ] **F97 — Weekday header.** `div.mhead` with seven short weekday names, **Sunday-first**
  (the month genuinely is a calendar; the week is a list of the next seven days).
- [ ] **F98 — Cells.** `div.mgrid` of `div.mcell` from `monthCells(items, anchor, now)`;
  `.mcell--out` for days outside the month, `.mcell--today`. `div.mnum` holds the date
  (today's is a 24px accent circle).
- [ ] **F99 — Per-cell "+".** `iconButton("plus", "Add something on …")` with `.btn-sm.madd`,
  absolutely positioned (a second child inside `.mnum` would push today's date out of its
  ring). Opens the editor **at the top of `#view`**, not in the cell — a month cell is
  ~100px tall and a seventh of the window wide. A click on the empty part of the cell does
  the same.
- [ ] **F100 — Pills.** `MONTH_CELL_ROWS = 3` per cell, then a `button.mmore` reading
  `+N more` which jumps to the **day view** for that date (`dayOffset` computed, `view =
  "day"`, `VIEW_KEY` written, refresh).
- [ ] **F101 — Pill anatomy.** `div.mpill.course-N` with `span.mpill--code` and
  `span.mpill--name` (one clamped line in the popup, two in the full view). Modifier
  classes: `--event` (transparent, dotted edge), `--exam` (`--warn-wash-strong`),
  `--opening` (transparent, dashed), `--untimed` (italic name), plus the **same tone
  vocabulary as the list** — `--done` (55%, struck), `--overdue` (red edge + red code),
  `--late` (amber edge + amber code) — because a month of finished work looked exactly like
  a month of work still owed.
  `title` = `<title> — <UNTIMED_NOTE>` or `<title> — [opens ]<clock>`.
- [ ] **F102 — The pill *is* the row menu trigger.**
  `role="button"`, `tabIndex = -1`, click **and** Enter/Space open `openRowMenu(item, pill)`.
  A `⋯` of its own does not fit; `openRowMenu` leads with "Open in …", which is the
  destination the pill used to go to directly. Before this, Mark done / Hide / Split / Merge
  and the keyboard were unreachable from the month entirely.
- [ ] **F103 — Dark Illini flattening.** `.theme-illini.is-dark .mpill:not(--exam,
  --opening, --event)` and the equivalent calendar rows take one `--pill-fill` navy instead
  of eight washes; the course keeps its edge and its saturated code.

---

## M. Exams view

`renderExamsView` — `src/ui/popup.ts:3102-3149`. Drawn from **`items`, not `onGrid`** — a
booking is filtered out of the grid on purpose, and an exam should not be hideable by a
course filter by accident.

- [ ] **F104 — No 60-day horizon.** Every other view stops at 60 days; in September a
  December final would otherwise be invisible.
- [ ] **F105 — Three sections** from `examBoard(items, now)`, each an
  `h2.section` reading `<text> (<count>)`:
  - "Not booked" (`.section--err`) — rows rendered with `bookingWindowText(item)`
    (`{primary: "not booked", detail: "sessions Sep 21–23"}`) and the `"Book a slot: "`
    prefix **stripped from the displayed title** (the full title stays in the `title`
    attribute) because the heading already said it three times;
  - "Coming up" — `examWhen(placed, now)` = `{primary: "Thu Sep 24 7:00 PM", detail:
    "today" | "tomorrow" | "in 5d"}`. The only view that prints date *and* day, because it
    spans a whole term;
  - "Just sat" — kept a week so "I already sat that" and "this never existed" look
    different; rows get `.row-sat` (55% opacity).
- [ ] **F106 — Empty state.** `"No exams or quizzes from any source you have switched on."`
  — deliberately not "no exams", which would be a claim about the term.

---

## N. Attention view and suggestions

`renderAttentionView` — `src/ui/popup.ts:3332-3392`. Drawn from `owed`
(`visibleItems(..., {dropFinished: true})`).

- [ ] **F107 — Suggestions first (§4.6).** `renderSuggestions` draws
  `h2.section` reading `Found in a post (N)` with
  `title = "Deadlines read out of an instructor's post that no source lists. Nothing here
  is on your calendar until you add it."` At the top because it is the only section here
  asking a question.
- [ ] **F108 — A suggestion row.** `div.row.row--flat.row--suggestion` containing the course
  chip, `.row--name > .row--title`, `.row--due` (localised weekday/month/day/time, or `—`
  for an unparseable instant; `.row--assumed` + `title="The post gives a day but no time.
  11:59 PM is this extension's guess."` when `timeAssumed`), and a
  `.row--detail.row--suggestion-actions` flex line.
  `row.title = suggestion.context` so hovering anywhere shows the instructor's sentence.
- [ ] **F109 — Provenance line.** `span.muted` reading
  `from the Piazza post “<subject>”` / `from a Campuswire post` / `from a pasted post`
  (`SUGGESTION_SOURCE` maps `piazza|campuswire|paste`). The subject is only quoted when it
  differs from the row's own title — otherwise the row drew the same 90 characters twice.
  `title` = subject + blank line + the verbatim span, **as text**. Styled inline
  (flex/ellipsis/nowrap) rather than in CSS, deliberately, so it stays one clipped line: a
  suggestion whose buttons wrap below the fold is one nobody answers (UI rule 8).
- [ ] **F110 — Add.** `button.btn.btn-primary.btn-sm`, `title="Add this to your own list"` →
  `applySuggestionRequest({type:"accept-suggestion", id}, add)`.
- [ ] **F111 — Ignore.** `button.btn.btn-sm`, `title="Take this suggestion off the list"` →
  `applySuggestionRequest({type:"dismiss-suggestion", id}, ignore)`.
- [ ] **F112 — Attention groups.** `attentionGroups(items, now)` →
  `Overdue`, `Couldn't read`, `No date at all` (`ATTENTION_ORDER`).
  Actionable ones (`isActionable`) get an `h2.section` reading `<name> (<count>)` with
  `title` from `ATTENTION_NOTE`; `Couldn't read` also takes `.section--err`.
  Notes: Overdue → "Past its deadline in the last week."; Couldn't read → "The source
  printed a date this extension could not make sense of, so these have no place on the
  calendar. They are the deadlines it is least sure about."; No date at all → "Listed by a
  source with no deadline on it anywhere."
- [ ] **F113 — "No date at all" is folded.** `renderFoldedGroup` → `details.fold` +
  `summary.fold--summary` with an SVG `right` chevron (rotated 90° when `[open]`) and the
  same tooltip. Folded because it never empties, and excluded from the tab badge. Still
  present — dropping a row a source listed is the silent loss §11 ranks worst.
- [ ] **F114 — Empty attention.** `"Nothing needs attention."` — but **only when there are
  also no suggestions**, since a suggestion is something needing attention and printing
  that sentence under one is the silent-empty failure with a sentence attached.
- [ ] **F115 — Rows use `section = "Needs attention"`**, so `formatDue` uses relative
  precision ("3d ago").

---

## O. The editor (manual items)

`src/ui/editor.ts` + `openEditor`/`openAddEditor`/`openEditEditor` in `popup.ts`.

- [ ] **F116 — It renders in flow, always.** `form.editor`, prepended (or appended for the
  week's per-day boxes) into a container already in the document. **Load-bearing:** a
  floating form contributes nothing to the intrinsic height Chrome measures, so it would be
  clipped by the 600px ceiling with Save past the bottom edge. No `position`, no percentage
  height, no viewport unit.
- [ ] **F117 — One editor at a time.** `openEditor` calls `closeMenus()` then
  `closeEditor()`. Two forms would each claim the day grid's draft box.
- [ ] **F118 — Fields.** `.editor--grid` (2 columns at 400px, 4 in the full view, via
  `repeat(n, …)` and a `.view-full` rule — **not** a media query):
  Title (wide, placeholder "What is due"), Course (wide, `<datalist>` of on-screen course
  labels — a suggestion list, not a closed one, with a per-instance id
  `editor-courses-<n>`), Date (`<input type="date">`), Time (`<input type="time">`, wrapper
  `title="Leave blank for “by end of day”."`), Ends (`type="time"`, **hidden unless kind is
  event or exam**, `hidden` beaten by an explicit `.editor--field[hidden]{display:none}`
  because `display:flex` wins otherwise), Kind (`<select>`: Deadline/Event/Exam →
  `assignment|event|exam`; a `booking` value falls back to `assignment` rather than showing
  a blank control), Link (wide, placeholder `https://…`).
  Each control carries `data-field="<name>"`.
  **`type="date"`/`type="time"` are deliberate:** their `value` is `YYYY-MM-DD` / 24-hour
  `HH:MM` whatever the locale shows, which is exactly what `ManualInput` wants — a text box
  would need a second copy of `core/manual.ts`'s regexes here.
- [ ] **F119 — No validation in the UI.** `form.noValidate = true`. All judgement lives in
  `core/manual.ts`; the editor collects strings and displays the refusal.
- [ ] **F120 — Refusals routed to a field.** `ERROR_FIELD` matches `core/manual.ts`'s
  sentences with **anchored** regexes (house rule 6: a substring match on "time" would put
  the end-time complaint on the start-time field) and shows the message in that field's
  `span.editor--error`, focusing the control. Anything unmatched lands in
  `p.editor--error-form` at the foot — a refusal in the wrong place is acceptable, a
  swallowed refusal is not. Errors wrap (unlike a banner) because they are whole sentences.
- [ ] **F121 — Save feedback.** On submit: both buttons disabled, Save becomes
  `icon("sync") + "Saving…"` (UI rule 4), restored in `.finally` **only if the form is still
  connected**.
- [ ] **F122 — Keyboard.** `Escape` inside the form is `preventDefault`+`stopPropagation`'d
  and cancels the editor (otherwise the document handler would close menus behind it);
  `Enter` from any `<input>` calls `form.requestSubmit()` (not `submit()`, which bypasses
  the handler). `focus()` always selects the **title**.
- [ ] **F123 — Clicks and pointerdowns inside the editor are `stopPropagation`'d**, so the
  document click listener does not close menus and the day grid does not start a drag
  because someone pressed a text box on top of it.
- [ ] **F124 — Open editor defers redraws.** `drawIsHeld()` returns true while `editor` is
  set, setting `redrawAfterEditor`; `closeEditor()` runs the deferred `refresh()`.
  **Any** open editor blocks, not only a dirty one — a clean editor is one whose date was
  prefilled by the drag that opened it. `isDirty()` still exists, for the Escape
  confirmation path.
- [ ] **F125 — Add vs Edit.** Add: heading "Add a deadline", submit "Add", values
  `{date: viewedDate(), kind: "assignment", …overrides}`. Edit: heading `Edit “<title>”`,
  submit "Save", values from `valuesOfMember(member)` and `sourceId` set.
- [ ] **F126 — `valuesOfMember` reads the member, not the merged item** — editing a merged
  row would silently rewrite the student's own row to say what Gradescope says. **A time the
  extension invented comes back blank** (`extra.timeAssumed === "true"`), so an invention
  cannot become a stated value the moment the student opens the form to fix a typo.
- [ ] **F127 — Messages.** `saveManual(values, sourceId?)` sends
  `{type:"add-manual-item", input}` or `{type:"edit-manual-item", sourceId, input}`;
  an `error` response is rethrown as an `Error` for the editor to display.
  On success: `closeEditor()` then an **undeferred** `await refresh()`.
- [ ] **F128 — Scroll into view.** `handle.el.scrollIntoView({block: "nearest"})` after
  mounting, so a form opened well down a scrolled week does not sit off screen — and
  `nearest` so a form already visible does not move the page under the pointer.

---

## P. Empty and error states

- [ ] **F129 — `emptyNote(text)`** → `p.muted.empty`, centred, 24px padding.
- [ ] **F130 — Whole-list empty (`onGrid.length === 0`), day/week/month only.**
  If any course filter is on → `"Every course is switched off above."` and nothing else.
  Otherwise `emptyStateFor(sources, items.length > 0)` (`core/health.ts:711`):
  - no checkable sources → "No sources are switched on — open Settings to turn one back on."
  - needs_login → `Nothing to show: <names> need(s) you to sign in.` + **login buttons**
  - failing → `Nothing to show: <names> could not be read, so this list is incomplete.`
  - nothing succeeded yet → "Checking your sources…"
  - rows exist but none reached a section → "Nothing due in the next 60 days. Other items
    are hidden, finished, or further out."
  - otherwise → "Nothing due in the next 60 days."
  **The whole point:** "Nothing due" said over an expired session reads as "you are free"
  and means "I could not look" (§11).
- [ ] **F131 — Empty-state login buttons.** `div.empty--actions` of
  `button.btn.btn-primary` reading `Sign in to <Name>`, one per `state.logins` that resolves
  a URL. **Real buttons, not `.link`** — they used to be text that looked like the sentence
  they sat under, on the one screen with nothing else to click.
- [ ] **F132 — Draw failure.** `refresh()` wraps `draw()` in try/catch and shows
  `Illini Dash could not draw the list: <message>. Open chrome://extensions and click
  Reload on the Illini Dash card.` A popup that fails halfway is a blank rectangle with no
  scrollback.
- [ ] **F133 — Unexpected response.** `draw()` on `response.type !== "state"` shows
  `response.message` (for `error`) or `"Unexpected response."`
- [ ] **F134 — Stale-worker notice.** `normalizePopupState(response)` fills in
  `items`/`sources`/`courseNames`/`suggestions`/`settings` that an older worker did not
  send, and `staleWorkerNotice(missing)` is shown in `#status` naming the missing fields and
  the one-click fix. Worker rule 8: a message is data from another build, never a typed
  object. The page renders what it was given and says what was missing.
- [ ] **F135 — `send()` rejection message.** `chrome.runtime.sendMessage` resolves
  `undefined` when a listener declined; `send` turns that into
  `The service worker received "<type>" but returned no response. The usual cause is that
  the worker is running older code than this page: open chrome://extensions and click
  Reload on the Illini Dash card, then retry.` — which is exactly the sentence a missing
  `.catch` would hide.

---

## Q. Status line

- [ ] **F136 — `#status` is errors only, and hidden the rest of the time.**
  `showStatus(text)` replaces children, sets `hidden = !text`, renders a
  `banner-line.banner-err` with the `warning` glyph, and **`statusEl.scrollIntoView({block:
  "nearest"})`** because the element sits at the bottom of a document that may be 1100px
  tall in a 600px window (UI rule 3 — every failure it reported for a month landed below the
  fold). Scroll rather than a fixed overlay, so a two-line message does not cover the rows
  it is about.
  `showStatus(undefined)` clears it. Callers: draw failure, unexpected response, stale
  worker, override `.catch`, suggestion `.catch`, delete `.catch`/error, undo `.catch`,
  sync cap, sync send failure, and the .ics "Saved N deadlines" confirmation (the one
  non-error use).
  Where: `src/ui/popup.ts:591-610`.

---

## R. First-run setup screen

`renderSetup(rows)` — `src/ui/popup.ts:1447-1636`. Reached when
`send({type:"get-setup"})` answers `{type:"setup", rows}` with `rows` present.

- [ ] **F137 — It replaces the calendar entirely.** `document.body.classList.add("setup")`;
  `#health` is emptied to just the wordmark (the checklist *is* the health pill's job);
  `#banners`, `#tabs`, `#filters`, `#nav` are emptied **and** hidden by
  `.setup #banners, .setup #tabs, .setup #filters, .setup #nav { display: none }` — an empty
  tab strip is still 36px and an empty filter strip another 36.
- [ ] **F138 — Pin card, full view only.** `div.pincard` with a `puzzle` glyph, "Pin Illini
  Dash to your toolbar" and the two-click instruction. Dismissible via an `iconButton
  ("close", "Dismiss")` that writes `localStorage["illini-dash.pinCardDismissed"] = "1"` and
  **stays dismissed**. Not in the popup: 90px of a 600px window to advise somebody who has
  just demonstrated they can find the icon.
- [ ] **F139 — Heading and blurb.** "Which sites do your courses use?" and "Illini Dash
  reads your deadlines from these using the logins already in your browser. It never sees a
  password, and nothing leaves your computer."
- [ ] **F140 — One row per source.** `div.setup--row` = `input.switch[type=checkbox]#setup-<source>`,
  a `<label.setup--label>` with `.setup--name` (`SOURCE_NAME`) and `.setup--hint`
  (who the site is for), a state chip, and optionally a Sign in button.
- [ ] **F141 — The switch.** On change: disables itself, sends
  `{type:"set-source-enabled", source, enabled}`; **if switching on, also sends
  `{type:"sync", trigger:"manual"}`** so the row is not left pending until the next poll;
  then `refresh()`.
- [ ] **F142 — The state chip**, same `chip-base chip-state` vocabulary as Settings:
  not enabled → "Not used"; a sync in flight → "Checking…" with
  `title="Reading this site now. This can take a few seconds."` (this screen has no pill, so
  its rows are the only thing that can say a sync is running);
  `lastSuccessAt` set → `.is-ok` "Connected"; `needs_login` → `.is-warn` "Sign in needed"
  with `title = lastError`; `parse_error|network_error` → `.is-err` "Couldn't read" with
  `title = lastError`; else "Checking…".
- [ ] **F143 — Per-row Sign in button** beside the chip (not instead of it — replacing the
  state with the action left a row whose state was a verb), from `signInUrl(row.source,
  row.status)`.
- [ ] **F144 — Summary line.** `setupSummary(setupProgress(rows), lastFound)`, where
  `lastFound = {items, courses}` is recorded on every draw **before** anything is drawn, so
  the first paint falls back to the connection count.
- [ ] **F145 — "You can change any of this later in Settings."** (`p.setup--note`).
- [ ] **F146 — "Open all N sign-in pages".** `btn-secondary`. URLs are resolved
  **before** the label is written, so the count cannot promise more tabs than it opens.
  Opens each with `active: false` — four tabs stealing focus one after another leaves the
  student wherever the last one landed.
- [ ] **F147 — "Show my calendar".** `btn-primary`, clickable from the first paint (nothing
  here blocks). Disables itself, sends `{type:"complete-setup"}`, removes the `setup` class,
  `await refresh()`, then `recheckLogins()` — pressing this is the clearest "I have finished
  signing in" a student can say, and it used to land on a calendar still asserting nobody
  was.

---

## S. Sync, refresh and liveness

- [ ] **F148 — `draw()` order.** `get-setup` → (setup screen, return) → `get-state` →
  normalize → record `lastFound` → `courseNames` → `currentSuggestions` → `lastHealth` →
  `renderHealth` → `renderBanners` → `render` → `showStatus(stale notice or undefined)`.
- [ ] **F149 — `render()` bookkeeping.** Bails if `drawIsHeld()` (checked here too, after
  the awaits in `draw`, because a menu can open while state is in flight); stores
  `currentItems`; `viewEl.replaceChildren()`; clears `dayGrid` and `draft`; deletes
  `data-shape`; sets `body.dataset.view`.
- [ ] **F150 — Two item lists, deliberately.**
  `onGrid = visibleItems(items, settings, hidden, now)` — the calendar keeps finished work,
  struck through, because a week you worked through should not look like a week nothing
  happened in (Sushi, 2026-09-18).
  `owed = visibleItems(..., {dropFinished: true})` — the Attention tab is a list of what is
  still owed.
- [ ] **F151 — `runSync()`.** Guards re-entry (`if (syncing) return`); sets `syncing`,
  `syncButton.dataset.busy` and `disabled`; **repaints the header before the request** (a
  sync is 5–10s and the pill was still asserting the previous outcome); refreshes the setup
  screen if it is showing; clears `#status`.
- [ ] **F152 — The spinner is capped, the request is not.**
  `SYNC_SPINNER_CAP_MS` timer → `endSync()`, `paintHealth()`, and the message
  `"This is taking longer than usual. Illini Dash is still trying — if nothing changes, open
  chrome://extensions and click Reload on the Illini Dash card."` The send is still awaited,
  and a late success clears the message. `chrome.runtime.sendMessage` does not reject when
  the worker is torn down mid-answer, which is the defect this exists for.
- [ ] **F153 — Sync failure message.** `"Illini Dash could not reach its own background
  part: <message>. Open chrome://extensions and click Reload on the Illini Dash card."`
- [ ] **F154 — `paintHealth()` repaints the header from `lastHealth` with no round trip.**
- [ ] **F155 — Store-change redraw.** `chrome.storage.onChanged`: `local` + `STORAGE_KEY` →
  `refresh()`. Left open, the full view otherwise showed whatever it drew when it opened.
- [ ] **F156 — Worker-driven sync state.** `session` + `illini-dash.syncing` → sets
  `workerSyncing` and refreshes, so a window that did not start the sync still says
  "Checking…". Also read once at load
  (`chrome.storage.session.get(SYNCING_KEY)`), because the worker commonly starts a sync the
  moment the student finishes signing in. `isSyncing() = syncing || workerSyncing`.
- [ ] **F157 — Minute tick.** `setInterval(…, 30_000)`; returns early if `document.hidden`
  or the minute has not changed; then `refresh()`. "in 4h", "6d ago", the now-line and the
  word "Today" are all answers that change while nobody touches anything — a tab left open
  overnight showed yesterday under a heading reading Today.
- [ ] **F158 — `visibilitychange`.** On becoming visible: `refresh()` **and**
  `recheckLogins()` — the tick cannot cover a tab that sat hidden for hours, because a
  hidden page is throttled or frozen.
- [ ] **F159 — `recheckLogins()`.** Guarded by `recheckInFlight || syncing`. Sends
  `get-state`, reads `chrome.storage.session["illini-dash.navigated"]`, asks
  `sourcesToRecheck(sources, Date.now(), navigated)` (`core/health.ts:134` — `needs_login`
  only; fires when a page loaded on that source's own site after our last attempt, or after
  a 10s debounce), and if anything is due **logs both branches** (worker rule 5) and calls
  `runSync()`. Signing in happens on another origin in a tab the extension does not own and
  no event crosses back; `trigger: "popup"` is debounced to 5 minutes and backoff skips
  every non-`manual` trigger, so neither covers this.

---

## T. Floating-panel mechanics

These are the mechanics behind F17 and F59–F66, and CLAUDE.md records each of them as a
defect that shipped.

- [ ] **F160 — One class constant.** `MENU_SELECTOR = ".menu-surface"`,
  `MENU_CLASS = MENU_SELECTOR.slice(1)`. It was written out as a literal in five places and
  **three of them spelled it `.menu`**, which matches nothing (a class selector matches
  whole tokens) — so all three redraw guards were dead from the day they were written, and a
  sync or a minute tick could delete an open menu between mousedown and mouseup, swallowing
  the press with nothing to show for it. *A constant rather than a test: a test would have
  to know the right answer; this makes the wrong answer unspellable.* (UI rule 7.)

- [ ] **F161 — Redraws are deferred, never skipped.** `drawIsHeld()` returns true when a
  `.menu-surface` exists (setting `redrawAfterMenu`) or an editor is open (setting
  `redrawAfterEditor`); `closeMenus()` and `closeEditor()` run the deferred `refresh()`.
  Six things redraw this page — the popup's own open-sync, a store write, the worker's
  in-flight flag, the minute tick, `visibilitychange`, and a manual sync — and three used to
  skip while three tore the menu down mid-press.

- [ ] **F162 — `closeMenus()`** removes every `.menu-surface`, clears **every**
  `[aria-expanded="true"]` (only the focusout path used to, so the pill's toggle and the
  Escape handler kept finding a stale anchor), resets `document.body.style.minHeight`, and
  runs any deferred redraw.

- [ ] **F163 — `placeFloating(panel, anchor, align)`.** Two halves, both needed:
  1. **Ask Chrome for the room** — a temporary pixel `min-height` on `body` (removed on
     close), because a `position: fixed` panel contributes nothing to the intrinsic box
     Chrome measures and the source list was being clipped mid-fifth-row. *A pixel minimum
     supplies intrinsic height; a percentage or viewport unit would take it away.* Only when
     the panel opens downward.
  2. **Cope without it** — cap at `MAX_POPUP_HEIGHT = 600` (or `window.innerHeight` in the
     full view) and scroll inside itself (`overscroll-behavior: contain` so the page does
     not move under an open menu).
  Flips upward when it does not fit below and there is more room above; ties and near-ties
  go downward. Reported as "hide doesn't work in week view" — week is the tallest list
  there is, and Hide and Merge are the third and fourth of five items.

- [ ] **F164 — Document-level `click` closes menus.** `document.addEventListener("click",
  closeMenus)`.

- [ ] **F165 — Capture-phase `scroll` on `window` closes menus — except the menu's own
  scroll.** A fixed panel does not travel with the document; but without the containment
  check, scrolling the menu to reach "Merge with…" deleted the menu being scrolled.

- [ ] **F166 — Escape closes from anywhere** and returns focus to the
  `[aria-expanded="true"]` anchor. Without it the only keyboard exit was Tab, which walked
  *into* the menu and out the far side of the page.

- [ ] **F167 — `trapMenuKeys(menu, anchor)`.** Sets `aria-expanded="true"` on the anchor;
  ↑ ↓ Home End move focus among `.menu-item:not(:disabled)` with a `data-active` highlight
  (not `:focus`, so hovering a different row while arrowing does not leave two rows looking
  selected); `focusAt(0)` on open; focus returns to the anchor on close.

- [ ] **F168 — The focusout rule.**
  > **Never decide anything about focus inside a microtask queued from a focus event.**
  > Read `event.relatedTarget` (the element gaining focus, known during the event); if it is
  > null, wait one **task**, not a microtask.

  This is the row-menu bug of 2026-09-18: `focusAt(0)` focuses item 0 the instant the menu
  opens, a real mousedown on "Hide" moves focus to the pressed button, Blink fires
  `focusout` *before* updating `document.activeElement`, and a microtask ran in exactly that
  gap, saw `<body>` and removed the menu between mousedown and mouseup — no mouseup on the
  same element, no `click`, no handler, nothing reaching the worker. The health popover
  always worked because it has no `.menu-item` for `focusAt` to focus; Enter worked because
  focus never left. A synthetic `.click()` and a programmatic `blur()` cannot produce the
  sequence, which is why every harness passed (UI rule 5).

---

## U. Keyboard and a11y summary

- [ ] **F169 — Roving tabindex over the list** (F44/F45): one Tab stop, then ↑ ↓.
- [ ] **F170 — Tab strip**: `role="tablist"` + `aria-label="Views"` on `#tabs`,
  `role="tab"` + `aria-selected` per tab, roving tabindex, ← → to move.
- [ ] **F171 — Row menu**: `role="menu"` / `role="menuitem"`, `aria-haspopup`/`aria-expanded`
  on triggers, ↑ ↓ Home End, Escape, focus return.
- [ ] **F172 — Health popover**: `role="dialog"` + `aria-label="Source health"`.
- [ ] **F173 — Month pills** are `role="button"` with Enter/Space handlers and live in the
  arrow ring.
- [ ] **F174 — Every icon button has a mandatory accessible name** — `iconButton(name,
  label)` sets both `title` and `aria-label`; the SVG itself is `aria-hidden="true"` and
  carries no `<title>` (a title inside an SVG is announced inconsistently).
- [ ] **F175 — Course filter chips** use `aria-pressed`.
- [ ] **F176 — Setup switches** are real `<input type="checkbox">` with `<label for>`; the
  theme picker uses real `<input type="radio">` groups.
- [ ] **F177 — One focus ring**: `:focus-visible` only (a mouse click should not leave a
  ring), 2px outside the control so nothing reflows.
- [ ] **F178 — Hover-only controls are also `:focus-visible`-visible** (`.wadd`, `.madd`,
  `.row--menu`) — `opacity`, never `display: none`.
- [ ] **F179 — `prefers-reduced-motion: reduce`** collapses every animation and transition
  (the whole interface has two of each, all under 120ms, none moving layout).

---

## V. Theme and dark mode

- [ ] **F180 — Three palettes** (`core/theme.ts` → `THEMES`): Illini (default), Neutral,
  High contrast; class `theme-illini|theme-neutral|theme-contrast` on `<html>`.
- [ ] **F181 — Three modes**: light, dark, system (default). `is-dark` on `<html>`,
  resolved once by `applyMode` from the stored choice and `matchMedia`. **Keyed on a class,
  not a media query, so the setting can win** — every dark value used to live behind a media
  query, so a student on a dark machine could not have a light calendar.
- [ ] **F182 — A machine that changes its mind mid-session** is followed, but only on
  `system`.
- [ ] **F183 — The picker lives in Options** (`#themes`), not the popup — but the *applying*
  half (`applyStoredTheme`, `applyMode`) runs in the popup at module top (F02). Swatches
  carry their own theme class plus `is-dark` so they preview the mode that is actually on.
- [ ] **F184 — High contrast gives the health dot a shape as well as a colour**
  (`.theme-contrast .pill.is-warn .pill--dot` rotates to a diamond, `.is-err` squares off,
  `.srow--dot.is-off` becomes a bar) — a colour-only signal is the exact thing that theme
  exists to avoid.
- [ ] **F185 — Dark mode is the verification default** (CLAUDE.md): Sushi's machine is dark,
  and every screenshot taken to verify a colour change was light. `resize_window` takes a
  `colorScheme`. **Measure the composited luminance, not the alpha** — the dark tints are
  roughly double the light ones and that is arithmetic, not taste.

---

## W. What lives in Options, not the popup

The popup links to Options from F11 (gear), F21 ("How to fix" on the notifications banner),
and F130's "open Settings to turn one back on". Options is `public/options.html` +
`src/ui/options.ts` and owns:

| Section | What it holds | Popup equivalent? |
|---|---|---|
| Sources | per-source switches, status chips, "log in" links, "Choose again" (→ `restart-setup`) | read-only in the health popover (F17); switches only on the setup screen (F141) |
| Courses | every course seen, switch to hide; **rename** (`set-course-name`); "Older courses" set-aside list (`keep-course`) | the popup only *reads* `courseNames`; the filter chips (F33) are a separate, `localStorage`-scoped hide |
| Course websites | adapter list, enable + host permission, "Check for updates", "Add a course site" (detect + on-device model proposal) | none |
| Reminders | lead-time checkboxes, quiet hours, poll interval, test notification | none — the popup only reports `notificationsBlocked` (F21) |
| Appearance | theme + light/dark picker (`renderThemePanel`) | the popup applies the stored choice (F02) but offers no picker |
| Hidden & done | the way back for hidden and ticked rows | the row menu's Unhide / Not done (F60, F61) |
| Data & privacy | Download .ics, Export JSON, Reset everything, privacy note | the header's .ics export (F10) is the popup's only copy |
| Google Calendar | connect / disconnect / push now (`gcal-*`) | only the per-item TEMPLATE link (F64) |
| Observers | Campuswire / Piazza opt-in switches (`set-observer-enabled`) | the popup only shows the suggestions they produce (F107–F111) |
| Help | Copy diagnostics (`get-diagnostics`), **Report a page** (scrub + download) | none — the popup has no "Report this page"; that is the options page plus a context-menu item |
| Developer | build info, Gate 0, parser round-trip, fixture capture | none |

**Explicitly *not* in the popup**, despite being in the task's checklist: notification
settings, the theme picker, Google Calendar connect/push, "Report this page", and
diagnostics download. The popup's only file-producing control is the .ics export (F10).

---

## X. Load-bearing CSS/layout invariants

Every one of these is recorded in CLAUDE.md as something that already shipped broken.

- [ ] **F186 — `html { width: 400px }` and `body { width: 400px; max-width: 100% }`.**
  The width goes on `html` *as well*, because `html` is the box Chrome measures.
- [ ] **F187 — No `max-height` and no `overflow-y` on `body` or `html`, ever.**
  They were there, and they are what made the popup open at **800×600 with the 400px list in
  its left half**: making `body` its own scroll container leaves the document with no
  intrinsic height to measure, and Chrome falls back to its maximum. Chrome already caps a
  popup at 600 and scrolls it itself, so §8.1's "max height 600px" is satisfied by writing
  nothing.
- [ ] **F188 — Be suspicious of any percentage or viewport unit on `html`/`body`.** They all
  take away the thing Chrome needs to measure. A **pixel** `min-height` is the one
  exception, and is how `placeFloating` asks for room (F163).
- [ ] **F189 — No `@media (min-width: …)` that changes layout.** Chrome lays the document
  out to decide the popup's width, so a width-keyed rule can measure wide, restyle wider and
  open wider. The full view keys off `.view-full` (F03) and the month's wider frame off
  `body[data-view="month"]` (F32); the editor's column count uses `.view-full`, not a query.
- [ ] **F190 — Scroll containers are always inner elements** — `.filters` (`overflow-x`),
  `.menu-surface` (`overflow-y` + `overscroll-behavior: contain`) — never `body`/`html`.
- [ ] **F191 — The tab strip may shrink, never push.** Five labelled tabs fit 400px with
  ~3px to spare; "three pixels is not a margin, it is a coincidence", and a two-digit badge
  is enough to cross it. So labels carry `min-width: 0` and ellipse, icons are `flex: none`,
  and the document width is never a function of what the badges say.
- [ ] **F192 — Fixed grid tracks on `.row`**, everything except the title. With `auto`
  tracks the source labels and dates landed at a different x on every row. `minmax(0,1fr)`
  on the title is what lets it actually ellipse rather than forcing the row wider.
  Measured widths: 60 (chip) / 1fr (title) / 44 (sources, holds two codes) / 92 (when; 62 in
  agenda and calendar shapes) / 24 (menu; 16 in calendar shapes).
- [ ] **F193 — `max-width: 100%` on `.chip`** — a grid item does not clip to its track.
- [ ] **F194 — `tabular-nums` on every clock, count and date number**, or a column of clocks
  does not line up and a badge flickers wider as it ticks 9 → 10.
- [ ] **F195 — Height is the popup's recurring bug in different costumes** (UI rule 8): a
  menu opening below the fold, a floating panel contributing no height, a status line out of
  sight, the sources panel clipped, a suggestion's buttons pushed down by a wrapped
  provenance line. When something "does not work" in the popup, **measure where it is before
  reading what it does.**
- [ ] **F196 — Banners are one line and stay one line** (`white-space: nowrap` + ellipsis):
  without it a 32px banner becomes 41px, which is nine pixels from three of them on screen
  at once.
- [ ] **F197 — The full view's chrome sits at the wide gutter permanently.** Header, tabs and
  chips used `--full-max` too, so switching to Month slid the whole interface 200px sideways.
  Only `.datenav` and `#view` use `--frame-max`.
- [ ] **F198 — `.view-full` row grid adds a trailing `minmax(0,1fr)`** and caps the title
  track at 420px, so the clock follows the title instead of sitting 584px away from it.

---

## Y. Every DOM id and class the popup writes

**Ids (static, in `popup.html`):** `health`, `actions`, `banners`, `tabs`, `filters`, `nav`,
`view`, `status`. Dynamic ids: `setup-<source>` (setup checkboxes),
`editor-courses-<n>` (datalist).

**Data attributes:** `body[data-view]`, `#view[data-shape="agenda"]`,
`.btn-icon[data-busy="true"]`, `.menu-item[data-active="true"]`, editor controls'
`[data-field]`.

**localStorage keys:** `illini-dash.view`, `illini-dash.openView`,
`illini-dash.hiddenCourses`, `illini-dash.pinCardDismissed`, plus the theme panel's
`THEME_KEY` / `MODE_KEY`.
**chrome.storage.session keys read:** `illini-dash.syncing`, `illini-dash.navigated`.

**Classes, grouped:**

- shell: `bar`, `bar--right`, `wordmark`, `tabs`, `filters`, `datenav`, `setup`, `view-full`
- pill/health: `pill`, `pill--dot`, `pill--text`, `is-ok|is-warn|is-err|is-pending`,
  `popover`, `srow`, `srow--dot`, `srow--name`, `srow--state`, `is-off`
- banners: `banner-line`, `banner-line--text`, `banner-info|banner-warn|banner-err`
- tabs/filters/nav: `tab`, `tab--label`, `tab-warn`, `chip-count`, `fchip`, `fhidden`,
  `datenav--label`, `datenav--today`
- row: `row`, `row--flat`, `row--name`, `row--title`, `row--practice`, `row--sources`,
  `row--due`, `row--menu`, `row--undo`, `row--flag`, `row--assumed`, `row--unreadable`,
  `row--detail`, `row--detail-error`, `row--detail-exam`, `row--detail-moved`,
  `row--moved`, `row--suggestion`, `row--suggestion-actions`, `row-span`, `row-opening`,
  `row-sat`, `row-done`, `row-late`, `row-overdue`, `row-booking`, `row-event`,
  `course-0`…`course-7`, `chip`, `chip-practice`
- menus: `menu-surface`, `menu-item`, `menu-heading`
- day: `grid`, `grid--hours`, `grid--hour`, `grid--slots`, `grid--line`, `grid--stack`,
  `grid--now`, `grid--draft`, `grid--draft-label`, `nowrule`, `band`, `band--note`,
  `band--head`, `band--eod`
- week: `wrow`, `wrow--today`, `wrow--quiet`, `wday`, `wday--dow`, `wday--num`, `witems`,
  `witems--empty`, `wuntimed`, `wadd`
- month: `mhead`, `mgrid`, `mcell`, `mcell--out`, `mcell--today`, `mnum`, `madd`, `mpill`,
  `mpill--code`, `mpill--name`, `mpill--event`, `mpill--exam`, `mpill--opening`,
  `mpill--untimed`, `mpill--done`, `mpill--overdue`, `mpill--late`, `mmore`
- sections/empty: `section`, `section--err`, `fold`, `fold--summary`, `empty`,
  `empty--actions`, `muted`
- setup: `setup--page`, `setup--title`, `setup--blurb`, `setup--row`, `setup--label`,
  `setup--name`, `setup--hint`, `setup--summary`, `setup--note`, `setup--actions`,
  `pincard`, `pincard--glyph`, `pincard--text`
- editor: `editor`, `editor--head`, `editor--title`, `editor--grid`, `editor--field`,
  `editor--field-wide`, `editor--label`, `editor--error`, `editor--error-form`,
  `editor--actions`, `field`
- shared primitives (`ui.css`): `btn`, `btn-primary`, `btn-secondary`, `btn-quiet`,
  `btn-icon`, `btn-sm`, `icon`, `switch`, `chip-base`, `chip-state`, `link`
- booking strip (`.book`, `.book--text`, `.book--go`) — **CSS only; dead.** The strip was
  replaced by banner F24 and nothing in `popup.ts` emits these classes any more.

**Selectors referenced from JS** (a redesign must keep these in step):
`MENU_SELECTOR = ".menu-surface"`, `EDITOR_SELECTOR = ".editor"`, `".menu-item"`,
`".row--menu"`, `".row--title"`, `".grid--stack"`, `".grid--draft"`, `".row, .grid--stack,
.editor"` (drag exclusion), `"a.row, .mpill[role='button']"` (arrow ring), `".bar"`
(sticky measurement), `".swatches"`, `'[aria-expanded="true"]'`.

---

## Z. Test files that pin popup behaviour

**No test constructs the popup's DOM.** The suite pins the popup indirectly, by pinning the
`core/` functions the renderers call. A redesign is free to move the markup and must keep
these contracts.

| File | What it asserts that the popup depends on |
|---|---|
| `tests/health.test.ts` | `displayState` (pending vs stored ok), `summarize` excluding off/unconfigured and the `manual` source from "n of m", `statusLine`, `healthPill`'s tone/text/action per branch (F14), `actionFor`'s three kinds (F16), `sourceRows` wording and ordering (F18), `staleNotice` thresholds and ranking (F22), `emptyStateFor`'s five branches (F130), `sourcesToRecheck` (F159), `badgeFor`. |
| `tests/calendar.test.ts` | `dayKey`, `anchorOf`, `dayContents`, `weekContents`, `monthCells`/`MONTH_CELL_ROWS`, `hourRange`, `spanMinutes`, `agendaRows` sequence and headings (F73), `visibleItems` incl. `dropFinished`, `attentionGroups`/`attentionCount`/`isActionable` (F112, F26), `examBoard`/`examCount` (F105), `itemTone` (F47), `quietDay` (F92), `courseColours`/`coursesIn`. Comments explicitly reason about the 600px popup fold. |
| `tests/grouping.test.ts` | `sectionFor` (§8.1's six sections), `liveDeadline`, `groupItems`, `formatDue`'s precision-per-section (F52), `examDetail` (F55), `movedText` (F55), the `no time` marker (F53). |
| `tests/compat.test.ts` | `normalizePopupState` filling `items`/`sources`/`courseNames`/`suggestions`/`settings`, and `staleWorkerNotice`'s wording (F134). A comment notes that either of two missing fields is "a blank popup". |
| `tests/quality.test.ts` | `qualityFlags`, `unreadableDeadline`, `unreadableSummary` — the "unreadable" due column and the `!` flag (F52, F54). |
| `tests/names.test.ts` | `SOURCE_NAME`/`SOURCE_CODE`/`SOURCE_TITLE`/`LOGIN_URL`/`SOURCE_HOME` tables, `STATE_WORD` (F18), `nameList`, `timeAgo`/`fullStamp`, `courseLabel`. |
| `tests/icons.test.ts` | every `ICON_PATHS` entry exists and is well-formed; `icon()` builds via `createElementNS` with **no `<title>`**; `iconButton()` always has an accessible name (F174). |
| `tests/theme.test.ts` | `normalizeTheme`/`normalizeMode`, the preset list, `themeClass`/`allThemeClasses`/`DARK_CLASS`, and that `view-full` shares the root element with theme classes (F03/F180). |
| `tests/manual.test.ts` | `newManualItem`/`editManualItem` — every refusal sentence the editor's `ERROR_FIELD` table is anchored against (F120), and what a blank time means. |
| `tests/ics.test.ts` | `buildIcs`, escaping/folding, and `googleCalendarUrl` — F10 and F64. |
| `tests/setup.test.ts` | `needsSetup`, `setupRows`, `loginsToOpen`, `setupProgress`, `setupSummary` — the first-run screen (F140–F146). |
| `tests/suggest.test.ts` | `Suggestion` shape, `movedByText` (F55), what accept/dismiss/undo-move do — F56, F110, F111. |
| `tests/dedupe.test.ts` | `sameCourse` (the Merge-with candidate rule, F63), `isItemDone`/`isTickedDone` (F47), `opensAt`. |
| `tests/messages.test.ts` | `send()` rejecting with the stale-worker sentence when the worker returns `undefined` (F135). |
| `tests/store.test.ts` | `DEFAULT_SETTINGS`, `STORAGE_KEY` (F155), `ALL_SOURCES`, `isFetchedSource` (F18), and manual rows surviving a reload. |
| `tests/sync.test.ts` | `SYNC_SPINNER_CAP_MS`'s neighbourhood, backoff (which is why `recheckLogins` uses `trigger: "manual"`), and the sync outcome classification the pill reports. |
| `tests/schedule.test.ts` | notification planning and quiet hours — the popup only surfaces `notificationsBlocked` (F21). |
| `tests/manifest.test.ts` | `default_popup: "popup.html"`, the `key`, the `oauth2` block, and the store copy limits. |
| `tests/gcal.test.ts` | Google Calendar push/delete rules; a comment notes an unreadable date "is already shown as such in the popup" (F52). |

**Harnesses, not tests:**
`scripts/preview.mjs` builds `dist/preview-popup.html` — **the real `popup.html` with only
`chrome.*` stubbed**, at 400px. CLAUDE.md: *"When the symptom is about the window, the
harness has to be the real document"* — the earlier harness wrapped the list in a
fixed-width `<div>`, which cannot reproduce a `body`-level sizing bug by construction.
`scripts/shots.mjs` screenshots it (default page `preview-popup.html`).
`scripts/components.ts` renders a `.menu-surface` in a static component gallery.
And UI rule 5: **a synthetic `.click()` is not a press** — where a defect is about
*pressing* something, only real pointer events in the real document prove anything.
