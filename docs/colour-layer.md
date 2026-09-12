# The colour layer

Everything that decides what Illini Dash looks like, and nothing else. Four files:

| File | What it is | Edit it to… |
|---|---|---|
| `public/ui.css` | **Every colour value in the extension.** Three themes × light and dark. | change any colour |
| `public/popup.css` | Where those tokens are spent. Contains no colour values at all. | change *how* colour is applied — pill shape, which surfaces get tinted |
| `src/core/theme.ts` | The theme list, the light/dark mode, the defaults, validation | add, remove or rename a theme |
| `src/ui/theme-panel.ts` | The picker in Settings, and applying the choice before paint | change the picker itself — rarely |

**To change the colour scheme, edit `ui.css` and nothing else.** It is the only file in
the project containing a colour value; `popup.css` was checked and has none. If a change
there does not show up, the token is not being consumed — grep `popup.css` for it rather
than adding a value somewhere new.

`public/options.html` needs one line for the panel to mount into:

```html
<h2>Appearance</h2>
<div id="themes"></div>
```

Both pages call `applyStoredTheme()` before their first paint. The choice lives in
`localStorage` under `illini-dash.theme`, deliberately: reading it from the extension's
store would mean a message to the service worker, which is a visible flash of the wrong
colours on every open.

## Light and dark are a class, not a media query

`is-dark` on `<html>`, put there by `applyMode()` from `illini-dash.mode`
(`system` / `light` / `dark`) and the machine's own preference. **There is no
`@media (prefers-color-scheme: dark)` anywhere in either stylesheet**, and adding one
back would undo the setting: a media query cannot be overridden by a choice without
writing every dark value twice, once inside it and once for the forced case — which is
rule 3 below, in its most expensive form.

Two consequences worth knowing before you edit:

- **A page that does not call `applyStoredTheme()` renders light.** That is right for the
  store assets (`promo.html`, `toast.html`), which must look the same for everyone, and
  wrong for anything else — `components.html` calls `applyMode()` for exactly this reason.
- **A descendant does not inherit the root's class.** Anything that paints itself in a
  *different* palette than the page — the theme picker's swatches — has to carry
  `is-dark` itself, and `syncSwatchMode()` keeps them in step. Without it the picker
  previews three light palettes on a dark page.

`color-scheme` is stated per mode rather than left as `light dark`, so a forced-light
calendar does not get dark scrollbars on a dark machine.

---

## Adding a theme

1. Add it to `THEMES` in `src/core/theme.ts`. It needs a `name`, a `label` and a `hint`
   saying who it is for — a list of names nobody recognises cannot be answered.
2. Add `.theme-<name>` to `public/ui.css` defining **every** token below, plus a
   `.theme-<name>.is-dark` block redefining them for dark.
3. Nothing else. `allThemeClasses()` is derived from `THEMES`, so switching removes the
   previous class on its own, and `tests/theme.test.ts` will fail if you forget a hint.

## The token contract

Every theme must define all of these. A missing one falls through to the `:root` value,
which will be from a different palette and will look like a bug rather than read as one.

**Washes and ink**

| Token | Use |
|---|---|
| `--warn-wash` / `--warn-wash-strong` | Behind a booking strip, a banner, an exam pill |
| `--err-wash` | Behind an error banner |
| `--accent-ink` | Text sitting *on* the accent, e.g. today's date in its circle. **Never white** — 3.05:1 on the light accent, 2.87:1 on the dark one |
| `--accent-wash` | A tint of the accent: the selected tab, a pressed chip |
| `--shadow` | The row menu's drop shadow |

**Surfaces**

| Token | Use |
|---|---|
| `--bg` | The page and the selected tab |
| `--surface` | Raised panels |
| `--surface-raised` | A menu or popover floating over the page |
| `--line` | Every border and grid line |
| `--fg` / `--muted` | Primary and secondary text |
| `--tint` | Header block, gutters, out-of-month cells |
| `--tint-strong` | Slightly heavier version of the same |
| `--hover` | Row hover |
| `--today-tint` | The wash on today's cell or row |

**Identity**

| Token | Use |
|---|---|
| `--brand` / `--brand-ink` | Section headings and identity surfaces |
| `--accent` | The selected tab's wash, the focus ring, today |
| `--primary` / `--primary-ink` | The one filled button on a screen, and its label. **Not `--brand`**: in dark the brand *is* the page, and the button rendered as plain text at 1.00:1 |
| `--focus` | The focus ring. `var(--accent)`, named so it is one decision |
| `--now` | Today's date and the current-time line. Usually `var(--accent)` |

**Meaning — these are spoken for**

| Token | Means |
|---|---|
| `--err` | Overdue, and a date that could not be read |
| `--warn` | A window still open: a late deadline, an unbooked exam, a sign-in needed |
| `--ok` | A source that was read successfully |

**One value that is not a token by accident**

`--pill-fill` exists only in dark Illini, and it is what a month pill and a calendar row
use instead of their own `--course-N-bg`. Eight washes chosen to sit behind an 11px pill
read as a patchwork behind a full-width row, and that is rule 2 again: the same wash does
different work at a different size. The course still carries its 3px edge and its
saturated code, which are the two signals that identify it.

**Courses — eight pairs**

`--course-0` … `--course-7` and `--course-0-bg` … `--course-7-bg`.

The first of each pair is the **ink**: the pill's left edge and the course code. The
second is the **wash**: the pill's fill, around 12–16% strength. A `.course-N` class sets
both together so nothing can end up with a blue edge on a green field.

---

## Four rules that are not taste

**1. A course is a label. Being late is a meaning.** The two must not compete. A course
pill identifies itself with three weak signals of one hue — a solid edge, a weak fill, a
saturated code — and that reads clearly without ever being as loud as `--err`. If a course
colour starts shouting as much as the overdue red, the screen has no hierarchy left.

**2. A tint does different work at each end of the range.** A wash composites toward its
own luminance, so the same alpha is not the same change. 5.5% of navy on white drops the
surface 12 points out of 255; 6% of pale blue on `#1c1c1c` lifts it 8, and the eye is far
less sensitive to lightening near-black. **Dark values need roughly double the light
ones.** Measure the composited result rather than trusting the alpha:

```js
getComputedStyle(el).backgroundColor
```

**3. One file holds the values.** Two copies of the course palette used to exist — one in
`ui.css` and a stale one in `popup.css` — and because `popup.css` loads second it quietly
won, so the pills drew the new washes with the old inks. Nothing failed; it just looked
slightly wrong for days. If you add a value outside `ui.css`, you are recreating that.

**4. Verify in dark.** It is the only mode the author of this project sees, and a change
that reads clearly in light mode has already shipped twice looking like nothing at all.
`resize_window` takes a `colorScheme`, so there is no excuse.

---

## The one hard constraint

**The popup document must never be wider than 400px.** Chrome sizes an extension popup by
measuring the document's intrinsic box, so anything wider opens the popup at up to 800px
with the content stranded in the left half. This has happened twice — once from
`max-height` + `overflow-y` on `body`, which leaves no intrinsic height to measure, and
once from five labelled tabs measuring 454px — at 12.5px type, 11px of padding either
side and a 14px icon on every tab.

All five now carry an icon **and** a label and measure 365px, at 12px type, 5px of
padding and a 12px icon. **Both halves of that history matter.** The constraint was real;
the answers "show one label" and "drop the icons" were both the wrong place to pay it.

The tab strip is the part that has broken this twice, so it also carries a structural
guard: `.tab` and `.tab--label` have `min-width: 0`, so if the content ever does exceed
400px the labels ellipse instead of the document growing. **A clipped word is a bug you
can see; a popup that opens at 800px looks like a different product.** Verify both — that
it fits *and* that it still fits with two-digit count badges:

```js
document.getElementById('tabs').scrollWidth            // <= 400
[...document.querySelectorAll('.tab--label')]
  .filter(l => l.scrollWidth > l.clientWidth + 1)      // [] — nothing truncated
```

Check after any change that affects width:

```js
document.body.getBoundingClientRect().width   // 400
document.body.scrollWidth                     // 400
getComputedStyle(document.body).overflowY     // visible, never auto or scroll
// Nothing past the edge — except inside a container that scrolls on purpose.
[...document.querySelectorAll('*')]
  .filter(e => e.getBoundingClientRect().right > 401)
  .filter(e => !e.closest('#filters'))        // []
```

**The last line's exemption is new, and it is the rule rather than a hole in
it.** The course strip is `overflow-x: auto`, so the eighth chip legitimately
sits past 401 — it is scrolled, not overflowing, and `scrollWidth` stays 400
because a scroll container does not contribute its content's width to its
ancestors. The thing the check is actually asking is "does anything make the
*document* wider than 400", and `scrollWidth` is the authoritative answer;
the element sweep is the diagnostic that says *which* element did it. Any
future scrolling strip goes in the same exemption list — and `overflow-x`
still never goes on `body` or `html`, for the reason above.

The full view is the same page with `?view=full`, which adds `.view-full` to the root and
lifts the width cap. Anything that only fits in a tab belongs behind that class.

---

## Looking at it

```bash
npm run build && npm run preview
```

| File | What it is |
|---|---|
| `dist/preview-popup.html` | The real popup, 400px, with only `chrome.*` stubbed. Use it for anything about size. `?view=full` for the tab, `?setup=1` for the first-run screen. |
| `dist/preview-options.html` | The real Settings page. `?stale=1` answers as a worker on an older build. |
| `dist/components.html` | Every primitive in every state, all three themes. |
| `dist/shot.html` | Seeds the tab and theme from its query string, then redirects. What `npm run shots` drives. |

The framed harness that used to sit here is gone. It wrapped the list in a fixed-width
`<div>`, so it could not reproduce a `body`-level sizing bug by construction — and two
answers about the popup opening at 800px were reasoned from it before that was noticed.
**When the symptom is about the window, the harness has to be the real document.**

```bash
npm run shots        # every surface, dark then light, into docs/ux/after/
npm run shots -- popup
```

`--force-dark-mode` does **not** set `prefers-color-scheme` — headless Chrome follows the
system theme, so on a dark machine it is a no-op and the "light" set comes out dark.
`--blink-settings=preferredColorScheme=0|1` is the one that works (0 dark, 1 light,
measured), and `shots.mjs` states it for both halves rather than leaving dark implicit.

`docs/colour-schemes.html` is a standalone mockup of the month view in several palettes,
useful for trying a direction without building the extension.
