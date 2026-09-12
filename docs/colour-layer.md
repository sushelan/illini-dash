# The colour layer

Everything that decides what Illini Dash looks like, and nothing else. Four files:

| File | What it is |
|---|---|
| `public/ui.css` | Every token. Three themes × light and dark. **Start here.** |
| `public/popup.css` | Where the tokens are spent — tabs, chips, grid, pills, rows |
| `src/core/theme.ts` | The theme list, the default, validation |
| `src/ui/theme-panel.ts` | The picker in Settings, and applying the choice before paint |

`public/options.html` needs one line for the panel to mount into:

```html
<h2>Appearance</h2>
<div id="themes"></div>
```

Both pages call `applyStoredTheme()` before their first paint. The choice lives in
`localStorage` under `illini-dash.theme`, deliberately: reading it from the extension's
store would mean a message to the service worker, which is a visible flash of the wrong
colours on every open.

---

## Adding a theme

1. Add it to `THEMES` in `src/core/theme.ts`. It needs a `name`, a `label` and a `hint`
   saying who it is for — a list of names nobody recognises cannot be answered.
2. Add `.theme-<name>` to `public/ui.css` defining **every** token below, plus a
   `@media (prefers-color-scheme: dark)` block redefining them for dark.
3. Nothing else. `allThemeClasses()` is derived from `THEMES`, so switching removes the
   previous class on its own, and `tests/theme.test.ts` will fail if you forget a hint.

## The token contract

Every theme must define all of these. A missing one falls through to the `:root` value,
which will be from a different palette and will look like a bug rather than read as one.

**Surfaces**

| Token | Use |
|---|---|
| `--bg` | The page and the selected tab |
| `--surface` | Raised panels |
| `--line` | Every border and grid line |
| `--fg` / `--muted` | Primary and secondary text |
| `--tint` | Header block, gutters, out-of-month cells |
| `--tint-strong` | Slightly heavier version of the same |
| `--hover` | Row hover |
| `--today-tint` | The wash on today's cell or row |

**Identity**

| Token | Use |
|---|---|
| `--brand` / `--brand-ink` | The top bar and its text |
| `--accent` | The selected tab outline, the focus ring, today |
| `--now` | Today's date and the current-time line. Usually `var(--accent)` |

**Meaning — these are spoken for**

| Token | Means |
|---|---|
| `--err` | Overdue, and a date that could not be read |
| `--warn` | A window still open: a late deadline, an unbooked exam, a sign-in needed |
| `--ok` | A source that was read successfully |

**Courses — eight pairs**

`--course-0` … `--course-7` and `--course-0-bg` … `--course-7-bg`.

The first of each pair is the **ink**: the pill's left edge and the course code. The
second is the **wash**: the pill's fill, around 12–16% strength. A `.course-N` class sets
both together so nothing can end up with a blue edge on a green field.

---

## Three rules that are not taste

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

**3. Verify in dark.** It is the only mode the author of this project sees, and a change
that reads clearly in light mode has already shipped twice looking like nothing at all.
`resize_window` takes a `colorScheme`, so there is no excuse.

---

## The one hard constraint

**The popup document must never be wider than 400px.** Chrome sizes an extension popup by
measuring the document's intrinsic box, so anything wider opens the popup at up to 800px
with the content stranded in the left half. This has happened twice — once from
`max-height` + `overflow-y` on `body`, which leaves no intrinsic height to measure, and
once from five labelled tabs measuring 454px.

Check after any change that affects width:

```js
document.body.getBoundingClientRect().width   // 400
document.body.scrollWidth                     // 400
[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > 401)  // []
getComputedStyle(document.body).overflowY     // visible, never auto or scroll
```

The full view is the same page with `?view=full`, which adds `.view-full` to the root and
lifts the width cap. Anything that only fits in a tab belongs behind that class.

---

## Looking at it

```bash
npm run build && npm run preview
```

`dist/preview-popup.html` is the real popup with the browser APIs stubbed — use it for
anything about width. `dist/preview.html` frames the list for looking at layout. Add
`?view=full` for the tab, `?setup=1` for the first-run screen.

`docs/colour-schemes.html` is a standalone mockup of the month view in several palettes,
useful for trying a direction without building the extension.
