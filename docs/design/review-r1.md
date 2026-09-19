# Review R1 — does every old popup feature exist in the new one?

Adversarial review of the Wave 12 popup redesign against
[`docs/popup-feature-inventory.md`](../popup-feature-inventory.md) (F01–F198, written
against the old popup at `03ef3b4`), [`docs/design/brief.md`](./brief.md) (D1–D15 and
"Deliberately replaced") and the Wave 12 entries in `PROGRESS.md`.

Method: every item read against the new code (`src/ui/popup.ts`, `src/ui/popup/**`,
`src/ui/editor.ts`, `src/ui/theme-panel.ts`, `src/ui/icons.ts`, `public/popup*.css`,
`public/popup.html`), the old code pulled from `git show 03ef3b4:src/ui/popup.ts` where
the inventory was not precise enough, and **the live document measured** — `dist/` served
over HTTP and driven in a 400×600 dark viewport, because three of the findings below
cannot be seen in the source or in a committed screenshot.

The workers' PROGRESS entries were treated as claims, not results. Two of them are wrong
(see R-1 and S-4).

---

## 1. Counts

| Classification | Count | Items |
|---|---:|---|
| PRESERVED | 144 | — |
| REPLACED-RECORDED | 49 | F08–F11, F14, F16, F17, F25–F27, F33, F34, F39, F42, F48, F52, F58, F71–F89, F93, F94, F112, F113, F118, F125, F139, F140, F147, F172, F175, F192, F198 |
| REPLACED-UNRECORDED | 0 | — |
| DEGRADED | 4 | F13, F35, F120, F169 |
| BROKEN | 1 | F100 |
| **Total** | **198** | |

Plus **five defects that carry no F-number**, because they are in the parts of the brief
the inventory could not describe (R-1 … R-5 below). One of them, R-1, is a shipped
regression against D2 that no reading of the TypeScript can find.

---

## 2. Findings without an F-number

### R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule

`public/popup-screens.css:234` is a bare `=======` — an unresolved merge artefact,
committed and shipped in `dist/popup-screens.css:234`:

```
233  .editor--save { flex: 1; font-weight: 700; }
234  =======
235  /* === W4: needs-you + setup ============================================= */
```

CSS error recovery swallows the marker **and the next rule**, which is exactly:

```css
.needsyou #tabs, .needsyou #filters, .needsyou #nav, .needsyou #banners { display: none; }
```

Measured in the real document (`preview-popup.html?open=health`, 400×600, dark):

```
body.className = "needsyou"        .screen.needsyou present = true
#tabs   computed display = flex    (expected none)
#banners computed display = block  (expected none)
CSSOM rules matching /needsyou/ + /tabs|banners/  →  0
```

Consequences, all of which are visible in `docs/ux/after/popup-sources-dark.png`:

- the tab strip and the banner stack (108px of a 600px window) stay on screen under a
  screen that D2 says takes the document over "the way `.setup` does";
- the stale-source sentence is printed **twice**, one line apart — measured:
  banner `"Gradescope: signed out 40h — rows may be old"` over notice
  `"Gradescope signed you out 40 hours ago."` — which is the precise failure the deleted
  rule's own comment says it exists to prevent;
- the date navigator would show on a screen it cannot act on.

31 other `.needsyou` rules survive, so nothing else in that file is affected.

**Fix:** delete line 234 of `public/popup-screens.css`.

### R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111

W2's PROGRESS says `renderSuggestions` "moved **verbatim** to
`src/ui/popup/suggestions.ts` for the Needs-you screen". Nothing imports it
(`grep -rn "popup/suggestions\|from \"./suggestions" src/ tests/ scripts/` → no hits):
W4 wrote its own copy at `src/ui/popup/screens/needs-you.ts:283-394`, including a second
`SUGGESTION_SOURCE` table. The two already differ (the dead copy styles the provenance
line inline; the live one uses `.needsyou--from`). This is the `resolveColumn` finding
from the mutation house rules in prose: one decision, two spellings, and the copy nobody
runs is the one that will be edited next.

**Fix:** delete `src/ui/popup/suggestions.ts`.

### R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed

`src/ui/popup/rows.ts:60-63` refreshes on `TWEAKS_EVENT`; `refresh` bails on
`drawIsHeld()` (`src/ui/popup.ts:265`), and the Appearance panel carries `MENU_CLASS`
(`shell.ts:487`), so the redraw is deferred to `closeMenus`. Measured live — the three
first rows' meta lines before / with the panel open after pressing **Source names** /
after dismissing it:

```
before  "PHYS 214·smartPhysics·8:00 AM"
during  "PHYS 214·smartPhysics·8:00 AM"   ← unchanged
after   "PHYS 214·8:00 AM"
```

W1's PROGRESS claims "a real press on the new **Source names** switch redrew the list
with the source gone". It does not; it redraws when the panel closes. The hold is
over-broad here: the panel lives on `document.body`, not in `#view`, so a redraw cannot
destroy it — this is the one floating surface a redraw is safe under. The same applies to
⋯ › Courses, whose comment explicitly wants the list behind to follow each press.

**Fix:** let `drawIsHeld` ignore a panel that is not anchored in `#view` (e.g. mark the
Appearance/Courses surfaces `data-redraw-safe` and exclude them), or have the tweak
listener repaint `#view` directly.

### R-4 — DEGRADED. A refusal about **Ends** or **Link** lands inside a closed `<details>`

D11 folds End time and URL under **More** (`src/ui/editor.ts:309-316`). `showError`
(`editor.ts:391-402`) writes the sentence into that field's `.editor--error` and calls
`control?.focus()`. When `<details>` is closed — its default, and the state on every
fresh open — the sentence is not rendered and the focus call does nothing, so
`"Give the end time as HH:MM"`, `"The end time has to be after…"`, `"That link is not a
web address"` and `"A link has to start with https://"` are **invisible** while the
submit button returns to its label. F120's own rule: "a refusal in the wrong place is
acceptable, a swallowed refusal is not."

**Fix:** in `showError`, `field.closest("details")?.setAttribute("open", "")` before
focusing.

### R-5 — The committed captures are stale, and one is a 404 page

`docs/ux/after/popup-unreadable-light.png` is a white image reading **"not found"** (3 KB,
02:36) — committed as verification evidence in `4121c61`.

`popup-day-*.png` and `popup-sources-*.png` (02:30–02:35) predate the CSS fixes in the
same commit: they still show the ellipsed `No d…` tab and the see-through amber footer
that commit says it fixed. I re-measured both in the live document and both are fixed
(`.foot` computes `rgb(16,32,51)` + the wash, tabs are 74px each with "No date" intact),
so the captures — not the code — are wrong. `popup-sources-*.png` is the only capture
that shows R-1, and it was read as a stale shot rather than as a defect.

**Fix:** re-run `npm run shots -- popup` after R-1, and check every output is a popup.

### R-6 — D8's ⋯ is missing **Rename course**

D8 lists "Rename course" among the deadline screen's ⋯ entries. `openScreenMenu`
(`screens/deadline.ts:481-549`) carries Split, Merge with…, Edit, Delete and Report this
page…, and no rename. Not an inventory regression (renaming has always been Options-only,
inventory §W), so it is a brief item that was not built and was not recorded as dropped.

---

## 3. Every non-PRESERVED item

### DEGRADED (4)

| F | What is missing | Evidence | One-line fix |
|---|---|---|---|
| **F13** | The pill's `right` chevron. F13 says it is drawn whenever no action button sits beside it — and since W0 removed that button (F16), it should now be drawn always. The new pill builds only `.pill--dot` + `.pill--text`. `aria-haspopup="dialog"` is deliberately gone (W4); the chevron is not mentioned anywhere. | `src/ui/popup/shell.ts:144-149` | Append `icon("right")` to the pill, or record the drop in the brief. |
| **F35** | "N hidden". Nothing on screen says a course is switched off once ⋯ › Courses is closed: the menu marks it (`menu-item--off`, `aria-checked="false"`) but the list itself has no counter, and `render`'s "Every course is switched off" sentence only fires when *all* are off. Hiding one course now removes rows with no on-screen trace — the §11 failure F34/F35 were written for. | `shell.ts:443-473` (menu), `src/ui/popup.ts:220-228` (the only surviving notice), `shell.ts:898-905` (the `.fhidden` counter, in the never-called `renderFilters`) | Add an "N hidden" line to the Courses menu heading, or a one-line note under the footer count. |
| **F120** | See R-4 — refusals routed into the collapsed **More** block. | `src/ui/editor.ts:309-316, 391-402` | Open the `<details>` before focusing the field. |
| **F169** | The roving tabindex is not applied on the Needs-you screen: `render` returns at `popup.ts:166-169` before `makeRowsNavigable()`, so every Late row keeps `tabIndex = -1` and no row is reachable by Tab or by ↑ ↓ (the buttons beside them are). Every other view calls it. | `src/ui/popup.ts:166-169` vs `:206, :214, :253` | Call `makeRowsNavigable()` after `renderNeedsYou`. |

### BROKEN (1)

| F | Failure | Evidence | One-line fix |
|---|---|---|---|
| **F100** | The full-view month's `+N more` promises "jumps to the **day view** for that date". It sets `state.dayOffset` for that day and `state.view = "day"` — but the day tab is now Today, which draws `todayBoard(items, now)` and never reads `anchorDate`/`dayOffset` (`navFor` returns `step: 0` for exactly that reason). So `+3 more` on Oct 14 lands on today's board and the three deadlines are still not listed. | `views/month.ts:115-124` sets the offset; `views/today.ts:40-73` ignores it | Point `+N more` at the popup month's own day list (select that day) or at the Week anchored on it. |

### REPLACED-RECORDED (49)

Each is named as deliberate either in the brief's "Deliberately replaced" list, in a D-item,
or in the Wave 12 PROGRESS entry cited.

| F | Replaced by | Where recorded | New home |
|---|---|---|---|
| F08 | Sync button → footer strip | D10, W0 | `shell.ts:839-848` |
| F09 | "Open in a tab" → ⋯ › Open full view | D9, W0 | `shell.ts:341-348` |
| F10 | Header .ics → ⋯ › Download .ics (and the missing `.catch` is now present) | D9, W4 | `shell.ts:364-380` |
| F11 | Settings gear → ⋯ › Settings (both branches kept) | D9 | `shell.ts:406-428` |
| F14 | `healthPill` wording → `needsYouPill` | D2, W-core | `shell.ts:118-123` |
| F16 | Pill's action button → the same button in the screen it opens | W0 "Not preserved, deliberately" | `needs-you.ts:447` |
| F17 | Health popover → Needs-you screen (facts kept as the pill's tooltip) | D2, W4 | `needs-you.ts:126-162`, `shell.ts:170-178` |
| F25 | Five tabs relabelled, icons dropped in the popup | D1, W0 | `shell.ts:536-580` |
| F26 | Attention badge → No date badge = `noDateCount` (both groups); suggestions now counted by the pill | D1/D2, W-core | `popup.ts:179-184` |
| F27 | `FULL_VIEW_ONLY` emptied | D6, W2 | `state.ts:190` |
| F33, F34 | Course chip strip → ⋯ › Courses (`renderFilters` kept, uncalled) | "Deliberately replaced", W0 | `shell.ts:443-473` |
| F39 | Day ‹ › navigator → `step: 0`, Today anchored to now | D4, W1 | `popup.ts:96-113` |
| F42 | Row click opens the source → opens the deadline screen; ⌘/middle-click still open the source | D7 | `rows.ts:111-131` |
| F48 | `.chip` course chip → `<b class="row--code">` on the meta line | D7, W1 | `rows.ts:357-360` |
| F52 | `formatDue`'s section-aware primary → clock + `countdown`; only its qualifier survives | D7 | `rows.ts:228-283` |
| F58 | Five fixed grid tracks → the card's four | D7, W1 | `popup-rows.css:33-49` |
| F71–F89 | Day hour grid, drag-to-draft, `renderPlaced`, the untimed/EOD bands | "Deliberately replaced", W1 (names F71–F89) | `views/today.ts` |
| F93 | `"—"` empty day → "Nothing due" | W1 | `views/week.ts:87-89` |
| F94 | `time not posted` band → a row carrying `EOD` | D5, W1 | `views/week.ts:83-98` |
| F112 | Attention groups split: Overdue → Needs you, the other two → No date | D2/D3, W2 | `needs-you.ts:239`, `views/nodate.ts:57` |
| F113 | The folded "No date at all" group is unfolded | D3, W2 | `views/nodate.ts:77-82` |
| F118 | Field order and the **More** fold | D11, W3 | `editor.ts:318-328` |
| F125 | "Add" → "Add it" | D11, W3 | `screens/editor.ts:196-208` |
| F139, F140 | Setup headline/blurb rewritten, sources grouped | D12, W4 | `screens/setup.ts:132-166` |
| F147 | "Show my calendar" → "Find my deadlines", now running a sync | D12, W4 | `screens/setup.ts:219-244` |
| F172 | Popover `role=dialog` → the Appearance panel keeps it; the health popover is gone | W4 | `shell.ts:488-489` |
| F175 | `aria-pressed` chips → `role=menuitemcheckbox` + `aria-checked` | D9 | `shell.ts:463-464` |
| F192, F198 | Fixed row tracks and the full-view row grid → the card | D7 | `popup-rows.css:33-49, 264-266` |

### Notes on items classified PRESERVED that moved

These are not findings; they are the ones most likely to be mis-read as losses.

- **F18** — the popover's source row survives whole on the Needs-you screen: `SOURCE_TITLE`,
  `"<word> · last read <ago>"`, the `lastError`/exact-stamp tooltip, `sourceRows`' ordering,
  `manual` excluded, the same `actionButton` (`needs-you.ts:413-454`).
- **F43** — Shift+F10 / ContextMenu / `.` are still attached only inside the
  `url && HTMLAnchorElement` branch (`rows.ts:95-107`) — exactly where `03ef3b4:645` had
  them. Not a regression.
- **F53** — the assumed-time marker is now `end of day` + an italic `time assumed` with
  `ASSUMED_NOTE`, rather than `· no time` (`rows.ts:241-252`).
- **F109** — the provenance line's inline flex/ellipsis moved to `.needsyou--from`
  (`popup-screens.css:347-356`), which is *after* the merge marker and does apply.
- **F136** — `#status` keeps every caller and loses only `scrollIntoView`, because it moved
  to the top of the document (`popup.html:50`, `shell.ts:713-733`). That is D10 and UI rule 3.
- **F186–F191, F194–F197** — verified live: `html`/`body` are 400px with no `max-height`,
  no `overflow`, no viewport unit; the only `@media` in the four popup stylesheets is
  `prefers-reduced-motion`; five tabs measure 74px each and "No date" no longer ellipses;
  **0 elements past x=401** on Today, the deadline screen and Needs you.

---

## 4. Cross-worker seam checks

| # | Seam | Verdict |
|---|---|---|
| 1 | Late row on Needs you → deadline screen, and Needs you stands down cleanly | **PASS.** `rows.ts:130` → `app.openDeadline` → `openDeadline` calls `closeMenus()` then `leaveNeedsYou()`, which removes the body class **and** `document.removeEventListener("keydown", onKeyDown)` before `state.screen` becomes the deadline (`deadline.ts:61-67`, `needs-you.ts:85-90`). No listener leak: `onKeyDown` is a module-level function reference, so add/remove pair exactly. ‹ back from the deadline returns to the tab, not to Needs you — documented at `needs-you.ts:80-84`. |
| 2 | "Give it a date" → `set-due` vs `edit-manual-item`, and the error beside the form | **PASS with R-4.** `openGiveDate` branches on `soleManualMember` (`screens/editor.ts:234-278`): manual → `openEditor({sourceId})` → `saveManual` → `edit-manual-item`; source → `save:` → `{type:"override", action:{kind:"set-due"…}}`, logged on the popup side first. Both reject with the worker's sentence, which `createEditor`'s submit `.catch` routes to the field (`editor.ts:453-457`) — except when the field is inside **More** (R-4). |
| 3 | ⋯ › Courses and the deadline screen's "Hide CODE" write the same key, and the list redraws | **PASS.** Both mutate `state.hidden` and `writeStored(HIDDEN_KEY, …)` (`shell.ts:455-461`, `deadline.ts:447-455`); the menu redraws in place + `app.refresh()`, the screen closes first and its `closeScreen` refreshes. `coursesIn(state.currentItems)` is built from the **unfiltered** list (`popup.ts:148`), so a hidden course stays on the menu and can be turned back on. |
| 4 | The tweaks toggles re-render rows | **FAIL (R-3).** Measured: no change until the Appearance panel is dismissed. |
| 5 | A redraw while each screen is open | **PASS, except the Needs-you tab strip (R-1).** Deadline: re-rendered from the fresh item on every draw and closed when the row is gone or the tab changes (`deadline.ts:120-144`) — the countdown keeps counting. Editor: `drawIsHeld` holds and `closeEditor` runs the deferred draw (`shell.ts:982-992`, `screens/editor.ts:133-150`). Needs you: re-rendered every draw (`popup.ts:166-169`). Header menu: `drawIsHeld` holds, `closeMenus` runs the deferred draw and only when one was actually deferred. Nothing is skipped forever in any of the four. |
| 6 | `?view=full` and the old month grid | **PASS.** The marker is set from the URL before first paint (`state.ts:31-35`); `renderMonthView` branches on `isFullView` and the full view keeps `mhead`/`mgrid`/`mcell`/`mpill` untouched (`views/month.ts:48-130`); `openFullView` still writes both `VIEW_KEY` and `HANDOFF_KEY` and the receiving `storage` listener still validates the view name (`popup.ts:475-489`). Caveat: F100 above. |
| 7 | Options page still compiles against what it shared | **PASS.** `npx tsc --noEmit` exits 0 over the whole project; `renderThemePanel`/`applyStoredTheme`/`TWEAKS_EVENT` are exported unchanged from `src/ui/theme-panel.ts` and `healthPill` is untouched in `core/health.ts` (the popup simply stopped calling it). |

---

## 5. The ten fixes worth making, ranked

1. **Delete `=======` at `public/popup-screens.css:234`** (R-1). One character-run; it is
   the difference between D2's screen and a screen with the tab strip, the date nav and a
   duplicate of its own headline stacked above it. Shipped in `dist/`.
2. **Re-shoot the popup captures and re-read them** (R-5). One is a 404 page; two show
   defects that are already fixed; the only capture that shows R-1 was dismissed as stale.
   A capture nobody reads is worse than none (parser rule 14, one surface over).
3. **Fix F100** — the full-view month's `+N more` goes nowhere now that Today ignores
   `dayOffset`. It is a silent wrong answer: the student presses "+3 more" and gets a board
   that does not contain them.
4. **Open `<details>` before showing a refusal** (R-4/F120) — four of `core/manual.ts`'s
   sentences are currently swallowed, which is the one failure F120 says is not allowed.
5. **`makeRowsNavigable()` after `renderNeedsYou`** (F169) — the Late rows are the most
   actionable list in the product and no keyboard reaches them.
6. **Let a tweak repaint the list while the panel is open** (R-3) — and correct W1's
   PROGRESS claim, which asserts behaviour the build does not have.
7. **Delete `src/ui/popup/suggestions.ts`** (R-2) — two copies of §4.6's row, one of them
   unreachable and already drifting.
8. **Say somewhere in the list that a course is switched off** (F35) — hiding a course now
   removes rows with nothing on screen to say so, and the way back is two levels into a menu.
9. **Give the pill its chevron back, or record the drop** (F13) — it is the only affordance
   saying the pill opens something, now that `aria-haspopup` has gone too.
10. **Either build D8's "Rename course" or strike it from the brief** (R-6) — the brief is
    the checklist this redesign is measured against, and an unbuilt line in it is the next
    reviewer's false positive.

---

## 6. One structural note

Every defect above — R-1, R-3, F100, F120, F169 — is invisible to `npm test`. The suite is
2065 green tests and, as inventory §Z says, **not one of them constructs the popup's DOM**;
R-1 is not even reachable from TypeScript, since it is a stylesheet the bundler copies
verbatim. Three of the five were found by measuring the real document and two by reading
one file against another. If anything from this review becomes a standing check, the
cheapest by far is a build-time assertion that no file in `public/` contains `^<<<<<<<`,
`^=======$` or `^>>>>>>>` — three lines, and it would have caught the worst finding here
before the merge commit.
