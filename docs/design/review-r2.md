# Review R2 — new classes of defect in the redesigned popup

Adversarial review of the Wave 12 popup against the house rules in `CLAUDE.md`, hunting
for **classes R1 did not look for and the rules do not name yet**. R1
([`review-r1.md`](./review-r1.md)) checked feature parity against
`docs/popup-feature-inventory.md`; its ten fixes are in `1613605` and are not re-litigated
here. Every one of them was re-checked as landed (§5).

Scope read: `src/ui/popup.ts`, `src/ui/popup/**`, `src/ui/editor.ts`,
`src/ui/theme-panel.ts`, `src/ui/icons.ts`, `src/core/compat.ts`, `public/popup.html`,
`public/ui.css`, `public/popup*.css`, `scripts/preview.mjs`, `scripts/shots.mjs`, and
`git show 03ef3b4:src/ui/popup.ts` for the mechanisms that moved.

**Method.** Eight of the fourteen findings below are behaviour, not text, so they were
measured in the real document rather than read: `dist/measure.html` is
`dist/preview-popup.html` with one appended script that drives it with **real pointer
sequences** (`pointerdown` → `mousedown` → `focus` → `pointerup` → `mouseup` → `click`,
all `cancelable`), then prints what it found. Driven by headless Chrome,
`--blink-settings=preferredColorScheme=0` (dark first), `--virtual-time-budget=4000`,
`--dump-dom`. Measurement tables in §4.

Two notes on the method itself, because both cost time and both will cost the next
reviewer's:

- **`resize_window` in the agent's browser pane does not resize the page.** It reported
  "Viewport set to 400x600"; `innerWidth` stayed 980. Every width conclusion drawn from
  that pane would have been drawn at the wrong width. UI rule 6's neighbour: if a
  measurement is about the window, verify the window.
- **Headless Chrome ignores `--window-size` under `--dump-dom`** (measured 500×513 whatever
  was asked for). Layout is still faithful, because `body` is a fixed 400px and nothing in
  these stylesheets uses a viewport unit — but `placeFloating` reads
  `document.documentElement.clientWidth`, so the probe shims that one getter to 400. A
  `position: fixed` panel's `right` still resolves against the real viewport, so panel
  *horizontal* numbers below are stated as widths, never as right edges.

---

## 1. Counts

| Severity | Count |
|---|---:|
| **B** — blocks | 0 |
| **M** — must fix before beta | 8 |
| **L** — later | 10 |

No blocker. Two of the eight M's (M1, M2) are one new class between them, and it is the
class this project keeps re-finding one process or one listener over.

---

## 2. The new class: **a guard that asks another listener whether its own work is still undone**

The HANDOFF rule from 2026-09-18 says never to decide anything about focus inside a
microtask queued from a focus event. M1 and M2 are the same shape one level up: a
handler that reads *shared DOM state* to decide whether another handler has already
acted — and loses, because listener order or a `stopPropagation` decided it first.

Both were invisible to reading, and both reproduce with one real key press or one real
click. Neither is reachable by `npm test`.

---

## 3. Findings, ranked

### M1 — One Escape closes the menu **and** the screen behind it. Both screen guards are dead.

`src/ui/popup/screens/deadline.ts:101-109` and
`src/ui/popup/screens/needs-you.ts:104-111` each guard their Escape handler with
"not while a menu is open":

```ts
// deadline.ts:105
if (document.querySelector(`.${MENU_CLASS}`)) return;
// needs-you.ts:108
if (document.querySelector(".menu-surface")) return;
```

`shell.ts:1169-1176` registers *its* `document` keydown at module scope. `popup.ts` imports
`./popup/shell.js` (line 58) before `./popup/screens/deadline.js` (line 91), and
`needs-you`'s listener is added later still — at `openNeedsYou()` runtime
(`needs-you.ts:75`). So on one Escape, **shell's handler runs first and removes the menu**;
the screen's handler then runs, finds no `.menu-surface`, and closes the screen too.

The guard's own comment states the requirement it does not meet: *"the menu's own trap
owns Escape, and closing the screen out from under it would take the thing being dismissed
with it."*

Measured (`probe=dlescape`, Today, first row → ⋯ → Escape):

| | `.menu-surface` count | `body[data-screen]` | rows in `#view` |
|---|---:|---|---:|
| deadline screen open | 0 | `true` | 0 |
| ⋯ open on it | 1 | `true` | 0 |
| **after one Escape** | **0** | **`-`** | **8** |

Same on Needs you (`probe=escape`): `body.className` `"needsyou"` → `""` on one press.

Input → wrong outcome: student opens a deadline, opens its ⋯ to find Merge, changes their
mind, presses Escape — and is thrown back to the list, losing the screen they were on.

**Fix:** decide it in one place — have `shell.ts`'s handler set a flag (or call
`event.stopImmediatePropagation()` after `closeMenus()`), so a second handler on the same
press cannot see a world where the menu was never there.

---

### M2 — A menu that closes by **focusout** drops the deferred redraw and leaves `body.minHeight` behind.

`closeMenus` (`shell.ts:1031-1047`) is the only path that (a) clears
`document.body.style.minHeight` and (b) runs `state.redrawAfterMenu`. `trapMenuKeys`'s
focusout (`shell.ts:1249-1257`) removes the menu **directly**:

```ts
menu.remove();
anchor.removeAttribute("aria-expanded");
```

so neither happens. `state.redrawAfterMenu` stays `true` and the next `drawIsHeld()` — which
requires a menu to be open — is the only thing that would ever reset it.

This is not an exotic path. `closeMenus` is bound to `document`'s click, so any control
that calls `stopPropagation()` reaches focusout without reaching `closeMenus`: the header
pill (`shell.ts:156`), **Sync now** (`shell.ts:851`), a row's ⋯ (`rows.ts:337`), and
plain Tab out of the menu.

Measured (`probe=deferred`, Today, header ⋯ open, `fireStorageChange()`, then focus moved
to Sync now). The first row node is tagged before the store change; a redraw replaces it:

| | menus | `body` min-height | first row still the same node |
|---|---:|---|---|
| store changed while ⋯ open | 1 | `223.5px` | `true` (correctly deferred) |
| after focus left the menu | **0** | **`223.5px`** | **`true` — the redraw never ran** |
| **control**: same store change, no menu open | 0 | `0px` | `false` (redraw ran) |

The control is the load-bearing half (mutation house rule 1 in spirit): without it
`sameNode: true` would prove nothing.

Input → wrong outcome: a sync lands while the ⋯ is open, the student Tabs out or presses
Sync now, and the list keeps showing the pre-sync rows until something else redraws —
which in a popup is often never, because the popup closes on focus loss. Plus the popup
keeps a 223px floor it no longer needs, which on a short document (Exams measures 575px,
Needs you with nothing pending is shorter) is visible blank space.

**Fix:** the focusout handler calls `closeMenus()` instead of `menu.remove()`.

---

### M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab.

`selectTab` (`shell.ts:587-596`) sets `state.view`, writes `VIEW_KEY`, and calls
`app.refresh()`. `refresh` returns immediately because `drawIsHeld()` is true while
`state.editor` is set (`shell.ts:1024-1027`). Nothing repaints, so `aria-selected` does not
move and the strip looks inert — but `localStorage` has already been rewritten.

Measured (`probe=tabwhileeditor`, header `+` → press **Week**):

```
editor-open       aria-selected = true,false,false,false,false
after Week press  aria-selected = true,false,false,false,false   editor still open
```

Input → wrong outcome: student opens **+**, presses Week to check something, nothing
happens, presses Cancel — and lands on Week, with Week remembered for every future open.
UI rule 4 exactly: a control that did something asynchronous and said nothing.

**Fix:** either disable the tab strip while a screen owns `#view` (`body[data-screen] #tabs
button { pointer-events: none }` plus `aria-disabled`), or have `selectTab` close the
editor first. Do not let a held draw swallow a write to `VIEW_KEY`.

---

### M4 — `openFullView`'s `send()` is the one in the popup with no `.catch`.

`src/ui/popup/shell.ts:515`:

```ts
void send({ type: "open-full-view" });
```

Every other `send` from this page has one; UI rule 2 exists because this is the call that
turns "the worker is running older code than this page" into a sentence. ⋯ › **Open full
view** on a stale worker does nothing at all, produces no UI, and the rejection lands as an
unhandled promise in the popup's console — which is the console UI rule 1 says nobody
opens.

**Fix:** `.catch((err) => showStatus(...))`, and say "Applying…" is not needed here but a
sentence is.

---

### M5 — `placeFloating`'s cap is computed for a border box and applied to a content box, so every downward panel overshoots the ceiling.

`.menu-surface` (`ui.css:476-488`) has `padding` and a `1px` border and **no
`box-sizing: border-box`** — there is no global reset in these stylesheets. `max-height`
therefore applies to the content box, while `placeFloating` (`shell.ts:1108-1128`) derives
its cap from `offsetHeight` and screen coordinates, which are border-box.

Measured (`probe=appearance`, Today, ⋯ › Appearance, dark):

```
menu-surface popover popover--wide
  top=36  bottom=608  height=573   maxHeight=554.5px   boxSizing=content-box
  padding=8px/8px  border=1px      scrollHeight=641
body min-height = 600px            (clamped at MAX_POPUP_HEIGHT)
```

554.5 + 8 + 8 + 1 + 1 = 572.5 ≈ 573. The panel ends **8px past Chrome's 600px ceiling**,
and the `min-height` it asked for is already clamped, so the document cannot grow to reveal
it. For an ordinary `.menu-surface` (padding `4px 0`) the overshoot is 10px.

Consequence today is small — the panel scrolls internally, so content is reachable — but it
is the arithmetic, not the pixels, that matters: the one function that owns "does this fit
in the popup" is wrong by a constant, on the surface where "does it fit" is the recurring
bug (UI rule 8).

Second-order, same measurement: **the Appearance panel wants 573px of a 600px window.** It
is the popup. The two new D14 switches are the last thing in it, below three theme rows and
three mode rows, reachable only by scrolling a panel with no visible bottom edge.

**Fix:** `box-sizing: border-box` on `.menu-surface`, or subtract
`offsetHeight - clientHeight` from `cap`. Separately, consider collapsing the theme/mode
rows in the popup's copy of the panel.

---

### M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open.

`shell.ts:1037-1039` removes `aria-expanded` from every element that has it set to `"true"`,
and `closeMenus` is bound to `document`'s click (`shell.ts:1150`). `renderHealth` sets
`aria-expanded` on the pill from `state.screen?.kind === "needs-you"`
(`shell.ts:132`) — a **screen**, not a menu, so nothing should be clearing it.

Measured (`probe=pillaria`): open Needs you, then dispatch one ordinary click on the
document.

```
needsyou-open        pill aria-expanded = "true"
after a stray click  pill aria-expanded = ABSENT   (body class still "needsyou")
```

Also stripped the moment the header ⋯ is opened over the screen (`probe=escape`:
`pillExpanded: ABSENT` while the screen is open).

Two consequences. A screen reader announces the pill as an ordinary button while the screen
it opened is on screen — the attribute R1's F13 note says is now carrying the whole "this
opens something" promise. And `shell.ts:1172`'s Escape handler picks its refocus anchor with
`document.querySelector('[aria-expanded="true"]')`, which is document order: the pill
(`#health`) precedes `#actions`, so the only reason Escape refocuses the right control today
is that `closeMenus` has already vandalised the pill.

**Fix:** clear `aria-expanded` only on the anchors of the panels just removed (`closeMenus`
already has the list), not by selector sweep.

---

### M7 — `recheckLogins` has exactly the silent early return worker rule 5 was written for, under a comment claiming it does not.

`src/ui/popup.ts:436-439`:

```ts
if (due.length === 0) return;
// Both branches logged, or "came back, nothing was waiting on a login" and
// "the check never ran" are the same silence (worker rule 5).
console.log(`[illini-dash] back on the page — re-checking ${due.join(", ")}`);
```

The return is **above** the log. "Nothing was waiting" and "the function never ran" print
nothing and nothing. The comment asserts the rule and the code next to it breaks it, which
is worse than neither: the next person to debug a login that did not re-check will read the
comment, conclude the check never ran, and go looking in the worker.

Rule 6 of the mutation house rules, in prose: when a defect turns up in covered ground, look
for the thing that was pinning the bug. Here it is a comment.

**Fix:** move the `console.log` above the return and branch its wording; and log the two
other early returns beside it (`recheckInFlight`, `state.syncing`).

---

### M8 — The setup screen's "Connected" chip outranks the source's current state.

`src/ui/popup/screens/setup.ts:378`:

```ts
} else if (row.status?.lastSuccessAt !== undefined) {
  chip.textContent = `${prefix}Connected`;          // is-ok
} else if (row.status?.state === "needs_login") {
```

`lastSuccessAt` is "this source succeeded once, ever". A source that connected on Monday and
was signed out on Friday has both, and the first branch wins. Meanwhile
`renderGroup` (`setup.ts:331-340`) derives its button from `signInUrl` → `displayState`,
which reads the *current* state — so the row draws a green **Connected** chip with a **Sign
in** button next to it.

This is worker rule 2 in the UI with the branches in the wrong order: the chip is derived
from an attempt that happened, just not the most recent one.

**Fix:** test `state` first and let `lastSuccessAt` decide only the `ok` branch — i.e.
reuse `displayState(status)` here, which is the one function that already owns this.

---

### L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand.

`MENU_SELECTOR` / `MENU_CLASS` exist so that "a test would have to know the right answer;
this makes the wrong answer unspellable" (`state.ts:94-109`). This is the one place in the
new code that spells it. It happens to be right today, which is exactly how the three dead
`.menu` guards happened. **Fix:** import `MENU_SELECTOR`.

### L2 — Opening a screen moves focus nowhere.

Measured on both screens: `document.activeElement` is `<body>` immediately after
`openDeadline` (`probe=dlescape`) and after `openNeedsYou` (`probe=needsyou`). A keyboard
user who pressed Enter on a row is now at the top of the document, and the next Tab walks
the header. The editor is the only screen that focuses anything (`handle.focus()`,
`screens/editor.ts:188` — measured `INPUT.field`).
**Fix:** focus the `‹` in `renderBar` after the draw that opens a screen.

### L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it.

`rows.ts:86` makes a row a `<div>` when `safeUrl(item.url)` is undefined — every manual row
without a link, and every suggestion row. `rowsInView()` (`shell.ts:1527`) matches only
`a.row` and `.mpill[role=button]`, and `closeScreen` (`deadline.ts:82-87`) does
`(match ?? rows[0])?.focus()` over `"a.row, .row"` — `focus()` on a `<div>` with no
`tabindex` is a no-op. So ‹ back from a manual deadline drops focus to `<body>` silently,
and ↑ ↓ skip those rows entirely.
**Fix:** give a URL-less `.row` `tabIndex = -1` at construction and include `div.row` in
`rowsInView()`.

### L4 — The deadline screen's ⋯ does not toggle.

`deadline.ts:267-271` calls `openScreenMenu` unconditionally; `openScreenMenu` leads with
`closeMenus()`. A second press therefore closes and reopens — visually, nothing happens.
The header's ⋯ (`shell.ts:315-322`) reads `aria-expanded` and toggles. Two spellings of one
gesture. **Fix:** copy the header's branch.

### L5 — Two round trips with no popup-side log line, and one with no caption.

`saveManual` (`screens/editor.ts:79-95`) sends `add-manual-item` / `edit-manual-item` with
no `console.log`; `undoDelete` (`screens/editor.ts:327-337`) sends with no log **and** no
"Applying…" on the Undo button, so the one control with a ten-second deadline on it is the
one that gives no sign it was pressed. `set-due` and `delete-manual-item` beside them both
log. **Fix:** log both; caption Undo.

### L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter.

`openAppearance` (`shell.ts:488-500`) calls `trapMenuKeys`, whose `focusAt(0)` looks for
`.menu-item` — the theme panel has radios and checkboxes, none. Measured: after opening it,
`activeElement` is `<body>` and moving focus to the footer does **not** dismiss the panel
(`probe=residue2`: `menus: 1` afterwards), because focus was never inside it to leave.
So: opened from the keyboard, a modal-labelled panel with no focus in it and no arrow keys.
**Fix:** focus the first focusable descendant, not the first `.menu-item`.

### L7 — The No date tab's badge tooltip contradicts D3 and its own comment.

`shell.ts:560-567` comments *"an exam already booked and a row with no date are not [asking
for an action], and neither is counted"* — then writes
`` `${label} — ${count} needs attention` `` over a count that `popup.ts:185` fills with
`noDateCount`. D3's explainer on the tab says the opposite in prose: *"kept out of the
calendar and out of the badge, so they cannot bury anything that is actually due."*
**Fix:** word the No date tooltip as "N waiting on a date", and correct the comment.

### L8 — `openedFrom` survives a screen the tab change discarded.

`renderOpenScreen` (`deadline.ts:125-128`) clears `state.screen` when the tab moved out from
under a screen, but only `closeScreen` clears `openedFrom` (`deadline.ts:79-80`). The next
screen opened inherits nothing harmful today (it is overwritten at `openDeadline`), so this
is bookkeeping — but it is a second copy of "the screen is over" and only one of them runs.

### L9 — `closeNeedsYou` assumes the refresh it asked for actually drew.

`needs-you.ts:92-102` removes the body class and `state.screen` synchronously and then
awaits `app.refresh()`, which returns early whenever `drawIsHeld()`. In that window the
screen's markup is still in `#view` while `#tabs`, `#nav` and `#banners` have un-hidden
themselves over it. Narrow (it needs a `survivesRedraw` panel open at the moment ‹ back is
pressed) but it is the same "the state and the DOM disagree because a draw was held"
seam as M3.

### L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape).

`needs-you.ts:361-362` indexes a three-key record with a value the worker chose. A worker on
a build with a fourth observer renders *"from a undefined"*. `compat.ts` normalizes
`suggestions` to `[]` but says nothing about what is inside one — the same gap
`observers.piazza` was added to `OPTIONS_STATE_FIELDS` to close.
**Fix:** `SUGGESTION_SOURCE[s.source] ?? "post"`.

---

## 4. Measurements

All dark (`preferredColorScheme=0`), `dist/measure.html`, real pointer sequences.

### 4.1 Width — the invariant holds everywhere

Elements whose right edge passes **x = 401**, excluding `position: fixed` subtrees (which
resolve against the harness's real viewport, not the 400px document):

| Surface | `body.scrollWidth` | document height | elements past 401 |
|---|---:|---:|---:|
| Today | 400 | 798 | 0 |
| Week | 400 | 1511 | 0 |
| Month (popup dots) | 400 | 828 | 0 |
| No date | 400 | 831 | 0 |
| Exams | 400 | 575 | 0 |
| Deadline screen | 400 | 562 | 0 |
| Editor screen | 400 | 635 | 0 |
| Editor, **More** open | 400 | 688 | 0 |
| Needs you | 400 | 986 | 0 |
| ⋯ menu open | 400 | 798 | 0 (menu 192px wide) |
| ⋯ › Courses open | 400 | 798 | 0 (menu 192px wide) |
| Appearance panel open | 400 | 798 | 0 (panel 378px wide) |

Setup was not driven (it needs `?setup=1` through `shot.html`); R1 measured it clean and
nothing in this pass touches it.

### 4.2 Height — floating panels against the 600px ceiling

| Panel | anchor | top | bottom | height | `max-height` | box-sizing | over 600? |
|---|---|---:|---:|---:|---|---|---|
| header ⋯ | `#actions` more | 36 | 214 | 178 | 554.5px | content-box | no |
| ⋯ › Courses | same | 36 | 274 | 239 | 554.5px | content-box | no |
| **Appearance** | same | 36 | **608** | **573** | 554.5px | content-box | **yes, by 8** |
| row ⋯, last row of Today | `.row--menu` | 270 | 420 | 150 | 320.1px | content-box | no (flipped up ✓) |

The upward flip works: the last row's menu anchor sits at y≈424 with 140px below it and
412 above, and `placeFloating` flipped. That was the "hide doesn't work in week view"
defect and it is fixed.

`.foot` measures `top=476 bottom=513` in the harness's 513px viewport — i.e. it sticks, in
flow, as `position: sticky; bottom: 0` (popup.css:1131) intends. Nothing is clipped behind
it at the end of the document, so no bottom padding is owed.

### 4.3 Contrast, dark — nothing under 4.5:1

Every leaf text node on Today, composited through its real background stack against
`--bg`. Lowest twelve:

| ratio | size | weight | element | text |
|---:|---:|---:|---|---|
| **5.52** | 9.5px | 700 | `.row--kicker-text` (`--brand-mark` → `--accent` on `--surface-raised`) | "Next up" |
| 5.52 | 12px | 700 | `.row--rel-soon` | "in 4h 46m" |
| 5.74 | 12px | 700 | `.wordmark` | "Illini Dash" |
| 5.74 | 11px | 600 | `.foot--sync` | "Sync now" |
| 6.22 | 10.5px | 700 | `.row--code` course-3 on `--surface-raised` | "CS 425" |
| 6.48 | 11px | 700 | `.row--code` course-5 | "PHYS 214" |
| 6.56 | 10.5px | 700 | `.row--code` course-0 | "CS 357" |
| 6.56 | 9.5px | 600 | `.chip-practice` | "practice" |
| 6.75 | 10.5px | 700 | `.row--code` course-2 | "Distributed Systems" |
| 6.93 | 11px | 600 | `.btn-quiet` on `--warn-wash` over `--surface` | "Sign in" |
| 7.35 | 10.5px | 400 | `--muted` on `--surface-raised` | "smartPhysics" |
| 7.64 | 11px | 400 | `.foot--when` on `--surface` | "synced just now" |

Needs you, same method, lowest: 5.74 (`.wordmark`), 6.64 (`.btn-primary` ink on
`--accent`), 7.05 (`.needsyou--source-detail.is-warn`, `--warn` on `--surface-raised`),
11.34 (`.needsyou--notice-text` on `--warn-wash-strong` over `--surface`).

**All six pairs the brief singled out clear 4.5 comfortably.** No finding.

### 4.4 Tokens

Resolved every `var(--x)` in the four popup stylesheets against `ui.css` in all six
theme × mode combinations (`:root`, `:root.is-dark`, `.theme-neutral`,
`.theme-neutral.is-dark`, `.theme-contrast`, `.theme-contrast.is-dark`), with cascade
specificity and source order applied.

- **0 tokens undefined** in any combination. The six that are absent from `ui.css`
  (`--course`, `--course-bg`, `--chrome-max`, `--frame-max`, `--full-max`, `--pill-fill`)
  are all defined in `popup.css` itself (`:406-413`, `:120-124`) or used only under a
  `.theme-illini.is-dark` selector (`--pill-fill`, `popup.css:988, 1006`).
- **0 hex or `rgb()` literals** in `popup.css`, `popup-rows.css`, `popup-views.css`,
  `popup-screens.css`, except `#000` twice inside a `mask-image` gradient
  (`popup.css:500-501`), where the value is an alpha stop and not a colour. Not a finding.

### 4.5 The sizing invariants

```
html     width=400px   overflow-x/y=visible   max-height=none   height=auto
body     width=400px   overflow-x/y=visible   max-height=none   min-height=0px
@media rules in popup.css / popup-rows.css / popup-views.css / popup-screens.css:
         1 — (prefers-reduced-motion: reduce), popup.css:1103
position: fixed:  .menu-surface only (ui.css:481, set again by placeFloating)
position: sticky: .bar (popup.css:138), #tabs (popup.css:432), .foot (popup.css:1131)
merge markers (^<<<<<<< / ^======= / ^>>>>>>>) in public/ and dist/:  none
```

R1's R-1 is fixed: `popup-screens.css:253-265` carries the whole
`.needsyou #tabs, #filters, #nav, #banners { display: none }` rule again, and the
Needs-you screen measures `bodyClass: "needsyou"` with the strips down.

---

## 5. R1's ten, re-checked

| # | R1 finding | State |
|---|---|---|
| 1 | `=======` in `popup-screens.css` | **Fixed** — no marker in `public/` or `dist/` |
| 2 | Stale captures | Not re-shot here; `docs/ux/after/popup-*-dark.png` are modified in the working tree |
| 3 | F100 `+N more` | **Fixed** — `views/month.ts:115-126` now sets `state.view = "week"` |
| 4 | F120 refusal inside closed `<details>` | **Fixed** — `editor.ts:404-406` opens the fold before focusing |
| 5 | F169 roving tabindex on Needs you | **Fixed** in code (`popup.ts:169`) — but see **L3**: it still cannot reach a `div.row`, and the Needs-you Late rows are `div`s whenever the item has no URL |
| 6 | R-3 tweak repaints under the panel | **Fixed** — `data-survives-redraw` (`shell.ts:492`, `drawIsHeld` `shell.ts:1020`) |
| 7 | Delete `popup/suggestions.ts` | **Fixed** — file gone |
| 8 | F35 "N hidden" | **Fixed** — `renderHiddenNote` (`shell.ts:884-901`) |
| 9 | F13 pill chevron | **Fixed** — `shell.ts:151-153` |
| 10 | D8 "Rename course" | **Fixed** — `deadline.ts:544-547` (opens Settings › Courses) |

`redrawAfterMenu` **is** consumed (`shell.ts:1043-1046`), answering the brief's question —
but only on the `closeMenus` path. See M2.

---

## 6. Checked and clean

Stated so the next pass does not spend the time again.

- No `innerHTML` / `insertAdjacentHTML` / `outerHTML` anywhere in `src/ui/`.
- Every `href` and every course-derived link goes through `safeUrl` (`state.ts:58`);
  `googleCalendarUrl` and `actionFor().url` come from `core/`. All eleven
  `chrome.runtime.getURL` targets are `options.html` with an internal fragment.
- `renderFooter` (`shell.ts:778-856`) derives the clock from the newest `lastSuccessAt`
  across `summarize().checkable` and never from `lastSyncAt` — `lastSyncAt` is read exactly
  once in the popup (`popup.ts:310`) and only stashed, never rendered. `pending` is a real
  branch (`shell.ts:820-824`). Worker rule 2 holds in the footer and in the pill
  (`needsYouPill`, with `isSyncing()` outranking the store).
- `renderSources` refuses to invent the mock's "6 courses · 31 items" (worker rule 3), and
  the Needs-you "Nothing was dropped" note returns `undefined` rather than lying when the
  source has never succeeded.
- `applyOverrideAction` / `applySuggestionRequest` both caption the pressed control,
  disable its siblings, log popup-side, and `.catch` (`shell.ts:1301-1381`). Every
  correction surface routes through them — Needs you's Mark done/Hide, No date's
  Tick off/Hide, the deadline screen's four buttons, the row menu.
- The tweaks listener and the ↑↓ listener are both at module scope, once
  (`rows.ts:60`, `shell.ts:1545`) — the stacked-listener defect is not reintroduced.
- `normalizePopupState` covers every field `draw` dereferences (`items`, `sources`,
  `courseNames`, `suggestions`, `settings`); `staleWorkerNotice` reaches `#status`, which
  is at the top of the document and is not hidden by `.setup` or `.needsyou`.
- `placeFloating` asks for room with a pixel `min-height` on `body` and gives it back on
  close — the one legitimate use, and it is not a percentage or a viewport unit.
- `trapMenuKeys`'s focusout reads `event.relatedTarget` and falls back to **one task**, not
  a microtask (`shell.ts:1249-1257`). The 2026-09-18 bug is properly fixed; M2 is a
  different defect on the same handler.

---

## 7. The single cheapest standing check

R1 proposed asserting no merge markers in `public/`. The equivalent for this pass, and it
would have caught M1, M2 and M6 between them: **one probe file, `dist/measure.html`, kept
in the repo and run by `npm run preview`** — the real document, driven with real pointer
and key sequences, asserting a handful of invariants after each gesture:

```
after Escape with a menu open over a screen   →  the screen is still open
after focus leaves a menu                     →  body.style.minHeight === ""
after a store change deferred by a menu       →  the first row node was replaced
while a screen is open                        →  document.activeElement is inside it
```

Four assertions, no dependency, and each one is a defect the 2065-test suite structurally
cannot see — because, as inventory §Z says, not one of those tests constructs this DOM.
