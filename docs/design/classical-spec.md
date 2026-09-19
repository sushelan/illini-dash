# Classical Calendar — previous alignment measurements (2026-09-19)

Historical measurements from the earlier alignment pass. **These values are no longer
the visual authority.** Sushi's later request on 2026-09-19 makes the original
`stitch_extension_ui_design.zip` authoritative, including fonts, icons, colors and
structure. Use [the acceptance contract](ui-acceptance/reference-contract.md) and its
hash-verified `classical-mock/` files for current work. Do not use this earlier
interpretation to override the export. Product truth and Chrome sizing constraints
still apply; the contract records conflicts and justified adaptations explicitly.

---

## 1. Tokens

```css
:root {
  /* Paper & Surface Materials */
  --bg-parchment:    #fdf9f1;  /* Base extension window surface */
  --bg-card:         #ffffff;  /* Crisp paper card */
  --bg-card-tint:    #faf6ee;  /* Column strips & inactive headers */
  --bg-subbar:       #fbf7ee;  /* Sync bar and footer strip background */
  --bg-active-tab:   #f2e9dc;  /* Active tab indicator & day selection */
  --bg-hover:        #f7f2e8;  /* Row hover highlight */

  /* Ink & Text */
  --ink-navy:        #1a2744;  /* Deep Prussian Ink (brand / headers / active) */
  --ink-charcoal:    #23272e;  /* Primary body & card titles */
  --ink-muted:       #6b665c;  /* Aged umber (dates, subtitles, secondary) */
  --ink-faint:       #9c9689;  /* Tertiary placeholders, icons */

  /* Hairline Borders & Rules */
  --border-rule:     #e6dfd1;  /* Fine intaglio divider & card outline */
  --border-subtle:   #ede7dc;  /* Header/footer dividing hairline */

  /* Semantic Status Accents (low saturation) */
  --terracotta:        #a64b2a;  /* Overdue / late / urgent */
  --terracotta-bg:     #fdf8f5;  /* Overdue card wash */
  --terracotta-border: #f5dcd2;
  --forest-green:      #2e6047;  /* Connected / graded / done */
  --amber-gold:        #b47a28;  /* Warning / ambiguous date */

  /* Academic Course Badges — keyed by DEPARTMENT, not by arrival order */
  --cs-bg:   #e8ecf4;  --cs-text:   #1a2744;  /* CS    — Prussian blue */
  --phys-bg: #fbede8;  --phys-text: #8e3519;  /* PHYS  — Terracotta red */
  --math-bg: #eeebe5;  --math-text: #4e4438;  /* MATH  — Bronzed umber */
}
```

**Type.** Primary `'EB Garamond', serif`. Badges and mono counts `'JetBrains Mono',
ui-monospace, monospace`. Small caps / uppercase tracking `0.05em`–`0.08em`. Tight
leading (`leading-snug`; `leading-none` on badges).

---

## 2. Shell

**Top app bar — 40px.** Book glyph (`M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z` +
`M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z`, 16px, `--ink-navy`) then
`Illini Dash UIUC` at **17px serif bold, tracking-tight, `--ink-navy`**. Settings
control on the right. Bottom hairline `--border-rule`, ground `--bg-parchment`.

**Health & sync bar — 28px, directly under the header.** Ground `--bg-subbar`, bottom
hairline `--border-subtle`, `px-4 py-1.5`.
Left: a 6px `--forest-green` dot + `5 Connected` at **11px sans medium, `--ink-muted`**.
Right: a 13px sync glyph + `Sync Now` at **11px serif semibold, `--ink-navy`**.

**Bottom 5-tab bar — 48px.** Ground `--bg-subbar`, top hairline `--border-rule`, five
equal tabs.
- Icon 17px over label; label **10px serif, `uppercase`, `tracking-wider`**, `mt-0.5`.
- Active: ground `--bg-active-tab`, ink `--ink-navy`, **bold**, and a **2px top border in
  `--ink-navy`**.
- Inactive: `--ink-muted`; hover ground `--bg-hover`.

---

## 3. Today

1. **Date subheader.** `Tuesday, September 22` at **20px serif bold `--ink-navy`**; an
   items pill `4 ITEMS` at **10px mono, tracking-widest, uppercase, `--ink-muted`, on
   `#ede7dc`, `px-1.5 py-0.5`, 4px radius**; a semester annotation
   `Fall Semester 2024` at 11px serif italic `--ink-muted`. Hairline under the lot.
2. **Band 1 — OVERDUE.** Heading in `--terracotta`; count badge `1 item` on
   `--terracotta-bg` with a `#f2cebe` border, 10px, 4px radius.
   Card: `--terracotta-bg` ground, `--terracotta-border` edge, 4px radius, `p-2.5`.
   - Top line: course pill **solid `--ink-navy` with white text**, 10px bold,
     `px-1.5 py-0.5`; then the source name; then a **16px square checkbox with a
     `--terracotta` border** on the right.
   - Title: 15px serif semibold `--ink-navy`.
   - Subline: `Due: Yesterday 11:59 PM`, 11px serif, `--terracotta`.
3. **Band 2 — END OF DAY.** Heading + count. Untimed items first, then midnight items.
   Cards: white, `--border-rule` edge, 4px radius, `p-2.5`.
4. **Band 3 — TIMELINE.** A 1.5px `#dcd4c3` rail; a `Now · 11:14 AM` anchor on an ink
   pill; clocks to the left of the rail, cards to the right.

---

## 4. Week

- **Navigator.** `‹ Sep 20 – Sep 26, 2024 ›` at 16px serif bold `--ink-navy` — **the
  range carries the year**. Pill `This Week`: white ground, `#dcd4c3` edge, fully
  rounded, `px-2.5 py-1`.
- **Day card.** `flex`, `--border-rule` edge, 4px radius, white ground, `mb-2.5`.
  - Left column **52px**, ground `--bg-card-tint`, right hairline `--border-rule`:
    weekday at 10px sans bold `--ink-muted` tracking-wider; date at 20px serif bold
    `--ink-navy`; a `TODAY` badge at 8px mono bold on `#ecdcca` in `#5a3f28`.
  - Right column `p-2`, entries divided by `#f3ede2` hairlines.
  - Entry: course tag (10px mono bold, department colours), title (serif, truncate),
    right-hand status word — `1d late` terracotta, `EOD` muted, `11:59 PM` charcoal.
- **Quiet day.** Italic `Nothing due`, `#8a857a`, 12px.

---

## 5. Month

- **Header.** `September 2024` at 20px serif bold; a `Today` pill and a joined `‹ | ›`
  segmented control.
- **Grid.** White card, `--border-rule` edge, 4px radius, `p-2`.
  - Weekday headers `S M T W T F S` at 11px serif semibold `--ink-muted`, hairline under.
  - Cells **~32px tall**; number centred at 12px serif; dots below at **4px**,
    `gap-0.5`, coloured by department.
  - Selected cell: `--ink-navy` border on `--bg-active-tab`, 4px radius.
- **Legend** under the grid: `● CS 225 ● PHYS 212 ● MATH 257` at 10px mono `--ink-muted`.
- **Agenda box.** `Agenda for Tuesday, Sep 22` at 14px serif semibold `--ink-navy` with a
  `4 items` badge; rows carry a checkbox, a course badge, the title, and a `›`.

---

## 6. No date

- **Header.** `Undated & Unparsed Items` with a `4 tasks` count badge, then a 12px serif
  italic `--ink-muted` paragraph.
- **Section heads.** `SECTION 1 · NO DATE AT ALL —— 3 items` and
  `SECTION 2 · COULDN'T READ —— 1 ambiguous`, at **10px mono, tracking-widest,
  uppercase, `--ink-muted`**.
- **Cards.** White paper, source tag, and three buttons on a `#f0eae0` top rule:
  `Give it a date` (`--ink-navy`), `Tick off` (`--forest-green`), `Hide` (`--ink-muted`)
  — each white ground, `#dcd4c3` edge, 4px radius, 10px serif, hover `--bg-hover`.
- **Ambiguous card.** Peach edge, a `⚠ Ambiguous date text` warning pill, and a callout:
  ground `#fcfaf5`, **2px left border in `--amber-gold`**, `p-2`, 12px serif italic
  `#4a3b32`, reading `SOURCE TEXT: "…"`.

---

## 7. Exams

- **Section 1 — NOT BOOKED.** Heading + an `Action Required` badge in terracotta.
  Card: **4px top border in `--amber-gold`**, ground `#fdfaf4`, `#ecdcca` edge, `p-3`,
  4px radius. Title 16px serif bold `--ink-navy`. Detail lines with a calendar glyph
  (`Window open: …`) and a place glyph. CTA: full-width **solid `--ink-navy`** pill,
  white text, 12px serif medium, a 6px `#ea580c` dot before the label and a `→` after it;
  hover `#25375c`.
- **Section 2 — UPCOMING EXAMS.** Cards with time, room, and a verification badge.
- **Section 3 — RECENT.** Past week, with a status pill.

---

## Functional and platform constraints

These constraints explain implementation choices; they do not license visual drift.

1. **`body { max-height: 600px; overflow-y: auto }`, `position: fixed` on the tab bar,
   and `padding-bottom: 56px` to clear it.** Chrome sizes a popup by measuring the
   document's intrinsic box. Making `body` a scroll container leaves nothing to measure
   and the popup opens at **800×600 with the 400px list in its left half**; a fixed bar
   contributes no height at all. The same visual result comes from a flex column with
   `order` and a sticky bar, which measures correctly. See CLAUDE.md, "The popup is
   measured by Chrome, not sized by you".
2. **`@import url('https://fonts.googleapis.com/…')`.** An extension's own CSP blocks it,
   so the popup would silently fall back to Georgia — which is exactly the defect this
   pass was opened to fix. The faces are bundled under `public/fonts/classical/`.
3. **Illustrative labels and counts need source evidence.** A source may report a
   graded status; show it only when it did. Counts, terms, venues, seat confirmation
   and reservation destinations must come from the actual item/source. The mock's
   `Desk Roster Verified` or `Fall Semester 2024` is not evidence about this account.

## Earlier choices superseded by the ZIP contract

- **Tab casing follows the ZIP.** The earlier uppercase choice is historical.
- **The ZIP's light vellum appearance is the default, even on a dark OS.** Optional
  dark mode is a derived design, checked separately and dark-first during verification.
