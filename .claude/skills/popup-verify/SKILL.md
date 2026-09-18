---
name: popup-verify
description: Verify an illini-dash UI change in the real popup document before claiming it works. Use when changing popup/options CSS or layout, when something "does not work" in the popup (a menu, a panel, a status line), when checking colours or contrast, when taking screenshots, or when a harness result disagrees with what Sushi sees.
---

# Verifying the popup

## Build the real documents

```bash
npm run preview                 # runs build.mjs, then scripts/preview.mjs
npx http-server dist -p 8731    # or any static server
# http://localhost:8731/preview-popup.html
```

`preview-popup.html` is *"an exact copy of the shipped document, pointed at the stubbed
bundle. Nothing else changes: same `body { width: 400px }`, same stylesheet links, same
element ids."* It drives `dist/popup.js` unmodified with only `chrome.*` stubbed, so
*"a layout that breaks here breaks in the extension."*

**Never use a framed harness.** One existed — the popup's list inside a fixed-width `<div>`
— and it *"cost three rounds of Sushi's time: it cannot reproduce a `body`-level sizing
bug by construction."* CLAUDE.md: *"When the symptom is about the window, the harness has
to be the real document."*

## Dark mode first

*"Sushi's machine is dark. Every screenshot taken to verify a colour change was light, so
the one person who had to be convinced was looking at something nobody had looked at."*
`resize_window` takes a `colorScheme`, *"so there is no excuse."* Set `colorScheme: "dark"`
before the first screenshot; check light afterwards.

A tint does **different work at each end of the range**: *"5.5% of navy on white drops the
surface 12 points out of 255, while 6% of pale blue on `#1c1c1c` lifted it 8."* The dark
tints are roughly double the light ones. **Measure the composited luminance rather than
trusting the alpha**:

```js
getComputedStyle(el).backgroundColor  // then composite it against the body yourself
```

## The query switches

| Switch | What it shows |
|---|---|
| `?view=full` | the tab, not the popup (the full view keys off a marker the page sets from its own URL) |
| `?setup=1` | the first-run screen |
| `?fail=network` | a fetch failure — *"the one Sushi hit"* |
| `?fail=parse` | a parse error (the login case is cleared deliberately: a login outranks a parse error) |
| `?fail=sitelogin` | the course-website source signed out — its own state |
| `?slow=<ms>` | the in-flight/checking state; default 1200 |
| `?open=health` | clicks the health pill ~1.9s after load, once the open-sync redraw has landed |
| `preview-options.html?stale=1` | the older-worker banner |
| `shot.html?tab=week&theme=dark&page=options&hash=…` | seeds `localStorage` then redirects; `tab`, not `view` |

*"A state the harness cannot reach is a state nothing checks"* — the sources panel shipped
clipped half way down its fifth row because `npm run shots` could never click it. If your
symptom has no switch, add one to `scripts/preview-data.ts` rather than testing by eye in
the extension.

## Pressing things

UI rule 5: *"A synthetic `.click()` is not a press. It fires no `pointerdown`, no
`mousedown`, no focus change, and no default action. Every harness check of the row menu
passed while the real menu was unusable."* Where the defect is about *pressing* something,
drive real pointer events.

UI rule 6: *"the preview pane's coordinates are not the page's."* Driving real mouse events
at it produced "the menu never opens" *because the click landed in dead space* — and that
was nearly reported as a finding. **If a click-driven result is surprising, verify the
click landed before believing the result**: `document.elementFromPoint(x, y)` at the
pointer, and check the element you meant is what comes back.

## Height is the recurring bug

UI rule 8: *"A menu opening below the fold, a floating panel contributing no height for
Chrome to measure, a status line out of sight, the sources panel clipped — all the same
600px ceiling. When something in the popup 'does not work', measure where it is before
reading what it does."* So `getBoundingClientRect()` on the thing first, against 600.

And the sizing rule that caused it: *"Chrome sizes an extension popup by measuring the
document's intrinsic box."* `body { max-height: 600px; overflow-y: auto }` left nothing to
measure and opened the popup at 800×600.

- **Never make `body` or `html` a scroll container in the popup**, and be suspicious of any
  percentage or viewport unit on either — *"they all take away the thing Chrome needs to
  measure."* §8.1's 600px cap is satisfied by writing nothing; Chrome caps and scrolls it.
- **A layout rule keyed on window width can feed itself**: *"Chrome lays the document out
  to decide the width, so `@media (min-width: …)` that changes the layout can measure wide,
  restyle wider and open wider."*
- Width belongs on `html` as well as `body`, because `html` is the box being measured.

## Two more, when the UI is quiet

- UI rule 3: *"A status line at the bottom of the document is not a channel."* `#status`
  sits below ~1100px of week view in a 600px window. If a surface reports errors, the
  report must be reachable from where the error happened.
- UI rule 7: *"A class selector matches whole tokens."* Three redraw guards asked for
  `.menu` while the class was `menu-surface`, so every store write deleted an open menu.
  Route a selector and the class it matches through **one constant**.

## Other pages the preview builds

`dist/preview-options.html` (the real Settings page), `dist/components.html` (every
primitive in every state, all three themes — an icon broken there is broken in the
extension), `dist/promo.html`, `dist/toast.html`, `dist/shot.html`. `dist/` is cleared by
every build, so re-run `npm run preview` after each one.
