# Progress

Spec: SPEC.md. Build order §10, gates §9. Detailed evidence lives in `docs/`.

`npm run build`, `npm run typecheck`, `npm test` (2467 tests) all pass.

**Steps 1–12 are done. G0–G3 have passed. G4 and G5 are Sushi's and cannot start
from here.**

## One search over rows and date locators, and three pages that were not readable — 2026-09-20

Three public course pages, none of them a header table or a `Due:` list: CS 425 writes
`Released 8/25. Due @ 9/13 11.59 PM Central Time (Sun). Demos on 9/14 (Mon)` inside one
`<li>`; ECE 374 A puts the date in the `<dt>` before each `<dd>` and says once, in prose,
that everything is due by 9pm; CS 424 has no header row to name. The proposer in
`detect.ts` hard-coded two page shapes, so each of these was "needs a hand-written entry".
It is now one search: every repeated structure on the page × every way a row's date can
be located × every supported format, each candidate run through the real `runAdapter`,
ranked, and deduped by the `(title, dueAt)` pairs it produced. A page shape is no longer a
code path; "where is the date" is a value in the adapter. Branch `general-search`, ten
commits, on top of 0f74bc2.

- **Runner (`site.ts`).** One `locateDue(row, adapter, grids)` that both the runner and the
  search call. Locators: `columns.due` (header cell, now resolved through the grid),
  `dueSlot` (grid column after WHATWG rowspan/colspan normalisation, `core/table-grid.ts`),
  `duePrev` (nearest preceding sibling), `due` (selector, the fallback). Readers of the
  located text: whole, `dueLabel`, `duePhrase` (first date after a whole-word keyword and
  at most one connector; a row is hooked only when a date-shaped token or a placeholder
  follows, so the policy bullet "always due on a SUNDAY" is not a row). `titleBefore`
  (title is the text before a literal), `defaultTime` (an adapter-level clock; the row
  stays `timeAssumed`, so §5.3 still ranks it last). A loud hit-rate guard on `dueSlot`,
  and one page-level throw per new hook. Every dated item carries `extra.dueText`.
- **Grammar.** A trailing weekday token (`09/03 Thu.`, `09/24, Thursday`, `08/27 Thu¹`),
  `11.59 PM`, and `0930 - 1045 hrs.` (four digits are a clock only when the page says
  `hrs`). `Thu 9/3 5` still refuses to read 5 as a clock. `clockGroups` is the one copy of
  the hour/minute/meridiem rule, shared with `announce.ts`.
- **`minExtensionVersion` is enforced.** Manifest and package 1.0.0 → 1.1.0;
  `EXTENSION_VERSION` is a build-time define (build.mjs and vitest.config.ts) so core can
  compare without `chrome.*`; an entry newer than the build is dropped with
  `[registry] rejected <id>: needs extension 1.1.0, this is 1.0.0`, unknown top-level keys
  are refused by name, `requiredVersionFor` derives the floor an entry needs from the
  fields it uses, and an extension update clears the registry's refresh window so the
  first sync fetches what the old build refused. Until this build, unknown fields were
  silently ignored, so the gate protects from 1.1.0 onward.
- **Search (`detect.ts`, `skeleton.ts`).** `RepeatedStructure.locators` measures, per
  group, which hook dates its rows; the inventory sorts on the best of those, so a `<dd>`
  group dated through its `<dt>`s enters the twelve. `searchCandidates` builds a trial
  adapter per (group, hook), runs the real runner, refuses under 2 dated rows, under 50%
  for a named column and under 80% of hooked rows for everything else, ranks by dated
  rows then share then hook specificity, dedupes by produced pairs. `noCandidateReason`
  names what the page has and no longer lists shapes. The options page draws one heading
  per hook (`date in the <dt> before each entry`), a `Read from` column, and shows five
  with "Show N more". `npm run propose <file>` prints what the search would offer.
  The model branch is untouched and does not yet propose the new locators.
- **Registry: eight entries.** `cs425-fa26` (`CS425/ECE428`, `table[align=center] li`,
  `duePhrase "due"`, `titleBefore ":"`; 8 rows, every clock stated), `cs374a-fa26-hw`
  and `cs374a-fa26-gps` (`dl.calendar > dd`, `duePrev "dt"`, `defaultTime "21:00"`; 11
  rows each, every url on the GPS page falling back to the page because PrairieLearn is
  another origin). `cs424-fa26` keeps `td:not(.auto-style6)`: a migrated entry would
  vanish from every 1.0.0 install, and the grid spelling (`dueSlot 1, titleSlot 4`) is
  pinned against it by row identity. The ECE 374 A calendar page is a fixture only: it
  mixes lectures, labs and exams, and its `Midterm 1: 7:00pm- 9:00pm` clock sits in the
  `<dd>` text where no field reads it yet.
- **Fixtures.** Four unmodified `curl` captures (CS 425 assignments; ECE 374 A homeworks,
  GPS, calendar), two derived adversarial files, and `fixtures/sites/README.md` (parser
  rule 10) naming every unrealistic row. Not scrubbed: the scrubber would rewrite a public
  MediaSpace channel id and nothing else.
- **A defect found on the way.** `sameOriginHttpsUrl` resolved a relative `href` against
  the bare origin; `homeworks/hw1.pdf` was the first same-origin relative link any
  adapter met and it 404ed. It resolves against the page now.
- **Numbers.** Tests 2285 → 2455, typecheck clean, `npm test` green with the build. The
  inventory on the 12,000-element page: main 640ms, branch 960ms, bound 2,000ms (every
  considered group is probed before the twelve are chosen).
- **Mutation-checked**, every mutation count-asserted. Runner: 45 mutations; 40 died on
  the first run, one was unreachable by construction (`x += colspan` after the `while`
  re-establishes the cursor; kept, commented), four were untested and each got its test
  (nested rows through `<tbody>`; `columns` read by child index; the share-only and
  no-cell branches of the slot guard; `titleSlot` masked by a working fallback selector).
  Search: 9 mutations; 7 died, two were masked by a parallel mechanism (the slot's
  due-word rule by `filter.include`; `bestShare` by the twelve-cap never biting on a real
  capture) and each got the input that separates them.
- **What the search now says about the pages it already read.** ECE 310: one candidate,
  as before. ECE 411 assignments: the label candidate first, and a second, coarser
  phrase reading of `#mp-information > section` (2 of 5) ranked below it, because a
  placeholder date no longer refuses a candidate. ECE 411 syllabus: still nothing;
  `docs/ece411-findings.md` stands. Calendar: 90 rows of 93 (two `(time TBA)` rows are
  filtered, two `Fall Break` rows are character-identical and share a key).
- **Still open.** The calendar's `(11:59pm)` and `7:00pm- 9:00pm` clocks inside `<dd>`
  text; a trailing weekday is consumed but not cross-checked against the date; ECE 391's
  exams page has no entry (a registry edit, not a decision).
- **Verified by Sushi in the real options page, 2026-09-20**: CS 425 `8 of 8 rows have a
  date this can read.` with the right instants and `Read from` text; ECE 374 A homeworks
  and GPS `11 of 11` each at 21:00 with the `defaultTime` note. Two papercuts in what he
  pasted, both fixed the same morning with tests and four count-asserted mutations: the
  course-code box read its placeholder for `cs374al1` (the guesser now reads past a
  section suffix), and under the right CS 425 box sat a second one, `span`, 7 of 7,
  every name a sentence long — a reading of the same dates from *inside* each row.
  `dedupe` folds a candidate whose dated rows all sit inside a kept candidate's dated
  rows and date nothing new.
- **The second live run** (Sushi enabled a self-added CS 374 A page) found three more
  things, fixed with tests and five count-asserted mutations, all killed. The ask to look
  for `[registry] 8 adapters accepted` was mine and wrong: the worker reads the registry
  from GitHub `main`, the bundle only seeds an empty store, and the branch is not merged;
  the line arrives with the merge. `site: ok (19 items, 2 requests)` could not say which
  adapter read what, so `[site] adapter <id>: N item(s)` is logged per adapter now. The
  self-added id was `<course>-<term>-local`, so a second page of one course replaced the
  first; it carries the page now (`cs374-fa26-homeworks-local`). And a published entry
  for a page a local adapter already reads is set aside by `mergeAdapters` (core, by id
  and by url) with one console line per sync, because two adapters on one page are two
  rows per deadline. Sushi's `cs374-fa26-local` will shadow `cs374a-fa26-hw` after the
  merge; the count is the same either way.

**Amendments recorded this day:** §4.5 — an entry is `rows` plus exactly one date locator
and one reader, not `title`/`due` selectors; four new fields (`duePrev`, `duePhrase`,
`dueSlot`/`titleSlot`, `titleBefore`, `defaultTime`); `minExtensionVersion` is enforced,
which §4.5 lists and never defined (`docs/adapters.md`, `docs/cs425-findings.md`,
`docs/cs374a-findings.md`).

## Settings, with a quarter of the words — 2026-09-20

"Can u make the settings less text heavy." It carried **1,035 words** down a 6,033px
column, most of it two- and three-sentence explanations under every control — which
makes the one sentence that matters, the one beside the switch you are reaching for,
indistinguishable from the four around it. Measured in the real page, it is **739 words
now** (−29%), 4,430 characters (−27%), 342px shorter.

The rule, and it is a rule rather than a pass: **a caption says what a control does; the
reasoning goes behind a `<details class="why">`**, which is the disclosure the page
already used for "Why does it need these?" and "Why not let me pick the colours?".
Nothing was deleted — the 92-word privacy statement is the same text, inside a
disclosure; the on-device model's three sentences became "What if it cannot read the
page?" and say more there than they did in the lede.

- Trimmed: Older courses (3 sentences → 1), Add a course site, Ticked off, Data &
  privacy, the .ics / Reset / diagnostics / report captions, the Campuswire and Piazza
  captions (the longer sentence is still the row's `title`), three Reminders captions,
  the Google Calendar lede and its "Off" sentence (`describeGcal`, in core), and the
  site-health caption. Two ledes that only restated their heading went entirely.
- `tests/options-copy.test.ts` is the budget: 20 words for any `.lede` or
  `.srow2--hint` **outside** a disclosure, and a count of the disclosures so the page
  cannot pass by deleting the explanations instead of moving them. Prose grows back one
  well-meant sentence at a time and nothing could see it happen before.
- Mutation-checked by putting the Older-courses paragraph back: the budget test fails.
  Measured in the real options document in dark.

## Three duplicate controls removed — 2026-09-19

All one objection, made three times about one screenshot: two controls for one
destination, and the buried one is the one nobody presses (the `#ledger` rule).

- **No Sources tab.** "Theres alr a sources tab at the top, no need for one at the
  bottom right." The thing at the top is the footer strip — `● 4 sources · synced just
  now` — which selects the Sources view, and which is the control he meant in the first
  place ("in the sources tab *after i click on it at the top of the popup*"). `sources`
  stays a `ViewName` and a view; what it loses is a stop on the strip. `VIEWS` is the
  strip, `SELECTABLE_VIEWS` is what may be stored and restored — two questions that were
  one, which is how it became a tab. `selectTab` now asks for focus on the **footer
  button** for any view with no tab, or the draw leaves the keyboard on a `<body>` it
  just emptied (I01's mechanism, one case further out).
- **No "+" in the bar.** "Theres no need to have a + at the top right to add cuz theres
  already one at the bottom right." The floating "+" is drawn on **every** tab now, not
  the three calendar ones, because the bar's was the only add Alerts, Exams and Sources
  had. What goes with it is the complete *form* (`openFullAdd` is gone): Kind, the end
  time, the link and "No date yet" are not on the four-field panel Sushi asked for, and
  they are still on **Edit** — a row you typed carries the full panel behind its ⋯. The
  order is add, then edit, rather than choose a form before you start. Said out loud
  here because it is the one thing this removal costs.
- **No "Settings" in the header ⋯.** The gear is one element to its right. "Google
  Calendar…" and "Appearance…" stay: the first opens a *section* of a 4000px page that
  nothing else can address, the second is a panel that exists nowhere else.
- The harness followed the control again (UI rule 4): `?editor=1` presses `.qfab`, and
  `tests/preview-acceptance.test.ts` holds that string against `QUICK_FAB_SELECTOR` so
  a moved control fails a test instead of silently changing what the screenshots mean.
- Mutation-checked: putting `sources` back on the strip, and asking for tab focus on a
  view with no tab, each failed the suite on their own. Measured in the real preview
  document in dark — header is `[Open full view] [More] [Settings]`, five tabs, the "+"
  at `bottom: 65px` clear of the strip, and the footer press lands on Sources with no
  tab selected and focus on the button.

## The No date card loses its three buttons — 2026-09-19

Sushi, on a live Alerts tab with twelve undated rows: "i dont like how theres 3 large
choices, rather would just have it in the 3 dot option to give a date, mark as done, or
hide." Three 29px controls under every card is ~45px a row — twelve rows is a whole
600px window of buttons offering what the ⋯ two lines up offers on every other tab, and
it is the third time the same objection has been made about this popup's corners ("pick
one bro. just pick the 3 dots").

- `renderNoDateCard` draws the row, the amber chip and the quoted source text, and
  nothing else. `.nodate-actions` / `.nodate-act` went from `popup-views.css` and
  `design-classical-nodate.css` with the markup — a selector with nothing behind it is
  the harness defect of 2026-09-19 in a stylesheet.
- **Give it a date** is an `openRowMenu` entry now (Mark done and Hide already were),
  offered only for a row with no date this extension trusts: `dueAt === undefined ||
  unreadableDeadline(item).length > 0`, which is the same pair of conditions that puts a
  row in those two groups rather than a third spelling of them. A student re-dating a
  *stated* deadline is §5.3's open precedence question and this entry must not quietly
  become it.
- This is a **deliberate departure from the ZIP**, written down in
  `docs/design/classical-spec.md` §6, `docs/design/brief.md` D3 and the reference
  contract, since the mock draws the three buttons and has only four cards to draw them
  under.
- Mutation-checked: dropping the menu entry, and dropping its condition so every row
  offers it, each failed the suite. Verified with `scripts/held-press.mjs` at 120ms —
  the new step 7 scrolls the card into view first, because the first run pressed at
  y=796 in a 600px window and landed nowhere (UI rule 6, caught by asserting what the
  point actually hit). Held, the ⋯ opens `[Mark done, Give it a date, Open in
  PrairieLearn, Hide, Merge with…]` and a held press on Give it a date closes the menu
  and opens the dated form.

## Sources is a tab, and a post's row links to the post — 2026-09-19

Two asks from Sushi on the running extension: "the sources page in alerts should be in
the sources tab after i click on it at the top of the popup", and "if it says from a
piazza or campuswire post, i should be able to get linked to the post in reference."

- **The source list is the sixth tab.** It was the last section of Alerts, under late
  work, the post suggestions and two groups of undated rows — about 900px down a 600px
  window, which is UI house rule 8 in its usual costume. `views/sources.ts` now holds the
  stale notice, the list (the four sources, the two observers) and the "nothing was
  dropped" sentence; Alerts keeps only what the student can answer. The footer strip's
  health button selects `sources` rather than `nodate`, and `aria-pressed` follows it.
  The badge split with the list: `alertCount` no longer counts sources and
  `sourceAlertCount` (core, `actionFor`-derived) is the Sources badge, so the number and
  the buttons under it cannot disagree. Six labelled tabs fit 400px measured — every
  label's `scrollWidth === clientWidth`, `#tabs` does not overflow, and `body`/`html`
  stay 400 wide.
- **`core/post-link.ts`.** `postUrl("piazza:<nid>:<nr>")` and
  `postUrl("campuswire:<code>:<n>")` derive the thread from the id the observer already
  recorded — no store field, no backfill. Anchored regexes over each part, exact
  prefixes, https on the source's own origin or nothing (house rules 5, 6, 7): `piazza::3`
  and `https://evil.example/piazza:abc:1` both answer `undefined`, where a `split(":")`
  version answers a URL that resolves and goes somewhere else. A pasted post and the
  student's own `"student"` id have no page and keep the plain sentence.
- **Three surfaces use it.** The "from the Piazza post “…”" line on Alerts is the link
  (a `<button>`, because a popup that follows an `<a href>` navigates itself; dotted
  underline, no button chrome); the deadline screen's moved-by note gains **Open the
  post ↗** beside Undo move; and `acceptSuggestion` carries the post as the accepted
  row's `url`, so "Open ↗" on a row added from a post lands on the sentence it was read
  out of.
- **The harness followed.** `preview-data.ts`'s suggestions carried invented ids
  (`pz-2`, `cw-1`) that no observer produces, so the link branch was unreachable from
  `npm run shots`; three now carry real-shaped ids and one keeps the old shape on purpose
  so both branches are on screen. `popup-sources` is `tab=sources`, plus
  `popup-sources-from-footer` for the press that used to open the panel.
- Mutation-checked with count asserts: unanchoring the Piazza id, sending the footer back
  to `nodate`, re-adding a source row to Alerts and forcing the provenance back to a span
  each failed the suite. Verified in the real preview document in **dark** and light —
  the Sources tab, the Alerts tab without it, and the moved-by note — and the link was
  pressed: `chrome.tabs.create` received `https://campuswire.com/c/G794D32E4/feed/682`.

## Live: five defects from Sushi's own screenshots — 2026-09-19

Reported from the running extension, not from a fixture. Four lanes in disjoint files,
one build at the end, everything below measured on the real document in dark first.

- **Today showed no date.** `navFor` built `"Today · Mon, Sep 22"` and returned `step: 0`;
  `renderDateNav` read `step` as *both* "how far the arrows move" and "does this strip
  exist", so it hid the strip and returned before appending the label. The label now
  decides whether the strip is drawn and `step` only decides the arrows. Week and Month
  take the same branch as before.
- **The list jumped to the top after any action.** Nothing anywhere preserved scroll — one
  `grep` for `scrollTop` across `src/ui/` returned a single hit, and it was `preventScroll`
  on focus. Fixed with the shape the focus request already uses (`popup/scroll.ts`): the
  offset is read *before* the document is replaced and applied by the draw that actually
  rebuilt it, never chained onto `refresh()`. The rule is: a redraw keeps your place, a
  navigation starts at the top, and returning from a screen returns you to the row you
  left. Verified with a real 120ms held press — scrollTop 700 before Hide, 700 after.
- **The ⋯ covered the clock.** `popup-rows.css` positions it `absolute` over the row's
  right end, which was sound while it was hidden until hover. Drawing it unconditionally
  (e60f4c4, "just pick the 3 dots") made a permanent overlay: measured at 400px it covered
  the last 19px of every week time and 27px of every day time, and `elementFromPoint` at
  the time's last glyph returned the button's own svg in four of six rows. It is
  `position: static` in its declared `menu` column now, and `when` stops at the column
  before it (`"when when menu"`).
  - **And that broke the Alerts card**, whose row is `display: block` — so `grid-area`
    bound to nothing and a static button fell into normal flow at the card's bottom-left,
    opening its menu off the window. Pinned back to the row's top-right there, where
    there is no clock to cover. *Two lanes, each green, disagreeing about the composite:
    the exact failure the parallelism note warns about.*
- **Titles wrapped instead of truncating.** Two mechanisms, and fixing one did not fix the
  other: the title's own `white-space: normal`, and `.row--main`'s `flex-wrap: wrap`,
  which moved the whole title element onto a second flex line when it did not fit beside
  the course chip — so the left edge changed from row to row. Both are single-line now.
  The week document went 1491 → 1247px; day 974 → 942, month 1082 → 1021.
- **"No date at all" was indented.** Its blocks were written when it was its own screen
  inside `#view` and each stated the 16px page gutter itself; inside the Alerts screen,
  which already pads 10px, that read as 26 against every sibling's 10. A dead
  `#view > .nodate-group--head` rule had also stopped matching at the merge — its silent
  fallback was the wanted box, so it was deleted rather than repaired.
- **Two trailing controls returned** on the No-date card (an archive glyph 8px from the
  ⋯). Both glyphs removed; `tests/popup-draw.test.ts` had been *asserting* the four of
  them, which is mutation house rule 6's case — a test pinning the bug.
- **Course colour is per course, not per department.** It was keyed by department on
  purpose, and Sushi overruled it: "each class should be its own unique color". First
  attempt kept the department as a colour family and produced five blues for five CS
  courses ("colors arent that much different, they should be extremely different man
  cmon"), so the family structure is gone. Twenty-five hues evenly spaced around the
  wheel at one lightness and one chroma, generated rather than hand-picked; the slot rule
  puts a department's courses five slots apart, so two courses a student holds are 72°
  apart. Worst measured contrast 8.32:1 dark, 4.98:1 light.
- **The Alerts tab is a bell**, and the tab is Alerts rather than No Date.

A second round from the same screenshots:

- **A quick Add panel**, opened by a floating "+" on Day/Week/Month, replacing the
  full-screen form for every add that starts from a day. The header "+" still opens the
  complete form and is the only add Alerts and Exams have.
- **The panel orphaned the tab strip.** `position: sticky; bottom: 0` is sticky *upwards*
  — it never pushes a box down — so the real cause was Classical making `body` a flex
  column with `#tabs` last: the panel's `min-height` reserve collected its spare pixels
  *after* the strip, stranding it mid-document with 144px of empty page beneath it and the
  panel drawn across it. Only its left 32px escaped, which is the "Toda" in Sushi's shot.
  Fixed with `margin-top: auto` on the strip when it is bottom-pinned, so the free space
  goes above it. No document height touched — in this popup the document's height is what
  Chrome measures to size the window.
- **The week was still gold in dark.** Five hard-coded browns in the view sheet's dark
  block survived the move to white-on-black, so the TODAY badge and every "Nothing due"
  kept the old theme's colour. Deleted rather than replaced: the aliases above them
  already resolve per theme, and the second copy is what went stale.
- **Illini Dash is UIUC orange** — `#ff7a4d` dark (7.08:1 on the page), `#b83d0f` light
  (5.39:1 on parchment; `#e84a27` itself reaches only 4.73:1 on dark). Orange at hue 15
  sat 6 deg from "late" and 22 deg from "warn", which is the collision the gold palette
  already shipped once, so late moved to pink (347) and warn to a yellower amber (42),
  about 27 deg each way. Overdue chips were filled with `--primary` and had turned
  brand-orange, reading as "selected" as loudly as "late"; they are `--now` now.
- **The full view right-aligned every week row.** `.row--main` and `.row--when` opted out
  of the shared grid with `grid-area: auto`, which means "wherever auto-placement puts
  you" — i.e. document order. One extra in-flow child ahead of them slides the row by
  whatever slack the `1fr` track has: 8px at 400px, 449px at 1400px. That is why it looked
  like a full-view-only bug on a build whose popup was fine. The lines are named
  explicitly now, so the row's shape no longer depends on what else is in it.

Still unverified, and needs Sushi's browser: whether Chrome actually grows the popup
window when the Add panel opens on a near-empty day (only the document's intrinsic height
is observable from here), and whether the native date picker opens inside the popup or is
clipped by it — that calendar is browser chrome drawn outside the page.

Not verified: how close a course hue sits to `--warn` or `--ok`. The optimiser that would
have proven that clearance was cut short for time; even spacing puts a yellow-green and a
mint in the ring, so a chip that reads as a status colour is plausible and unmeasured.

## ZIP-based UI acceptance workflow — 2026-09-19

Constructed [the six-stage workflow](docs/design/ui-acceptance/README.md) and
[illini-ui-acceptance skill](.agents/skills/illini-ui-acceptance/SKILL.md): pinned ZIP
tokens/hashes, 43 journeys, 55 reproducible captures, independent visual/interaction
reviews, an evidence ledger and a completion check that rejects stale or missing proof.
The existing preview now supports a fixed clock, reference/empty/stress datasets,
observer states, denied permissions and explicit errors for unsupported writes.

**Design amendment:** the original ZIP outranks the previous `classical-spec.md`.
All 11 repository reference files match it. Default light on a dark OS, consistent
Settings and front-page Piazza/Campuswire are acceptance requirements. This constructs
the workflow; the application has not yet been realigned or fully journey-tested.

Validation: 2096 Vitest tests, 17 workflow checks, typecheck and skill validation pass.
Six asserted scratch mutations were killed; a test initially combined wrong theme and
viewport, so those cases now fail independently. An independent skill dry run's
environment-substitution ambiguity was fixed and rechecked. Evidence is in ignored
`artifacts/ui-acceptance/workflow-checks/`; captures/reviews never auto-approve themselves.
The current `artifacts/ui-acceptance/baseline/` has all 55 captures and a comparison
gallery. All 43 journeys remain pending; two verified typography findings are open.
G0–G3 remain passed; no G4/G5 claim or browser action is requested for workflow setup.

## Classical Calendar: the alignment pass against the pixel spec — 2026-09-19

Sushi wrote the design out as a spec — tokens, metrics, per-view DOM — and asked whether
the build matched. It matched in materials and structure and missed most of the numbers.
`docs/design/classical-spec.md` is that spec, written down so six agents could read his
words rather than my paraphrase, along with the refusals and the two contradictions.

Six workers, one goal each, disjoint files: the shell, the tokens and type, the course
colours, Today, Week+Month, and No date+Exams. Every lane held. 2089 tests.

### What the pass actually found

Most of the value was not in setting numbers. It was in **rules that had never applied**:

- Three of my own `design-classical.css` rules were dead because `popup-rows.css` and
  `popup-views.css` anchor on `#view`, and an id beats any number of classes. The overdue
  `Due:` line, the late band's count badge and the Exams `Action Required` badge had all
  been rendering `--muted` since the day they were written.
- The week sheet's entire "Corrections against the mock" block — the shaded day gutter,
  its rule, the title size — was one specificity step under the `#view` rules *earlier in
  the same file*. It had never drawn.
- `--bg-subbar`, `--border-subtle` and `--bg-active-tab` ended up declared in two sheets
  with **three different dark values**. The later sheet won, silently, and only in dark.
  Deleted; the values live in `design-classical.css` with the rest of §1.

**The structural lesson: `#view` in the base sheet defeats the layering it sits in.** Six
stylesheets load in order precisely so a later one may override; an id in the first one
means every later sheet has to escalate to match, and the ones that forget are invisible.
The ids are still there — un-anchoring them at the end of a pass would move every rule
that has since escalated against them, unverified. Next change to that file starts by
removing them.

### Other findings worth keeping

- `border: 1px solid` on a checkbox **computes back as white**: Chrome discards an author
  border on an `appearance: auto` control. A `box-shadow` ring is what actually draws.
  The dead declaration was deleted rather than left looking correct.
- The active tab's 2px marker is `box-shadow: inset`, not `border-top` — a border makes
  the selected tab 2px shorter inside than its neighbours and lets the strip's height
  move with the selection. Height is this popup's recurring bug.
- The month's 32px cell was blocked not by the dots but by **today's numeral**, still a
  20px round box from `popup-views.css`; a grid row is as tall as its tallest cell, so
  today's week measured 37px at a 32px minimum.
- The 52px week column costs the title track nothing — 200.13 → 202.33px — because §4
  puts the padding on the columns rather than on the card.
- Google serves JetBrains Mono as a distinct file per weight, unlike EB Garamond and
  Newsreader, which came back byte-identical because they are variable files.
- `--amber-gold` is 3.6:1 on parchment and `--warn` is drawn as 11px text, so light keeps
  a darkened pigment for text and the gold exists as its own token for rules.
- Course colours are keyed by **department**, computed per course rather than by walking
  a list, so enrolling in one more course no longer repaints the rest. Two mutation
  findings on the way: a fixture ordered `CS, PHYS, MATH` made an index-assigning
  mutation indistinguishable from the fix, and a second mutation survived only because no
  realistic department hashes onto slots 0–2 — `PHIL103`, `AE202` and `SOC100` are in the
  fixture because they are adversarial, not because anyone takes them.

### Deliberate departures from the spec, each stated once

The sub-bar keeps `5 of 6 sources · synced just now` rather than the spec's literal
`5 Connected`: the count is derived once in `core/health.ts` from attempts that happened,
and a second wording would be a second owner (worker rule 2). The filled
`Give it a date` on an ambiguous card was dropped — it put the loudest control on the row
with the least certain date. The exams card's terracotta went to amber: terracotta is
this design's *late* ink and nothing on an unbooked card is late. And the five labels the
data cannot justify stay refused.

### Known flake

`tests/skeleton.test.ts` has a 2000ms perf budget that two agents independently tripped
at 2058ms and 2213ms while other agents were building. It passes alone and in a clean
run. The budget is tight enough to fail for reasons unrelated to the code.

## Classical Calendar is the design, and the fonts are bundled — 2026-09-19

It stopped being an exploration. `applyDesign` returns `classical` when nothing is
stored, so a fresh load and a Reload on the extension card both get it with no console
and no Settings visit; opting out is an explicit stored `none`, because "nothing stored"
is now a choice rather than an absence. The Appearance picker's second row is **Plain**.

**The fonts were the whole problem, and I flagged them and then left them.** `EB Garamond`
and `Newsreader` were *named* in the stack and never shipped, so **Georgia** drew every
screen — larger x-height, heavier strokes, lining figures. The design was not "nearly
right", it was set in a different typeface throughout, and every size in the sheet had
been tuned against the wrong one. The latin subsets of the three variable files now live
in `public/fonts/classical/` (132KB, `font-display: block` — a popup is open for four
seconds and a swap is a visible reflow), and the whole scale was re-measured against the
real face: Garamond's lowercase is about 0.86 of Georgia's at one size, and it is
narrower, so titles went 13 → 15 and the week's title track grew by 33px. `--label`
(Newsreader) is the honest name for what `--sans` holds; the mock's own DESIGN.md
specifies Newsreader for every tracked small-caps label, and an earlier pass had argued
against that spec from a face that was never going to draw.

Five agents in parallel, one per independent piece, disjoint files so they could not
collide: the tick box (`rows.ts`/`shell.ts`/`state.ts`), and one per view
(`views/<v>.ts` + `public/design-classical-<v>.css`). Each was given the mock's own
`code.html` as the spec rather than a description of it, and its own server and debug
ports. Every lane held.

### The tick box: two defects, one of them mine

A held press on the box opened the deadline screen. `pointerdown` hit the box and `click`
fired on the **row** — the element was replaced between mousedown and mouseup, so the
click landed on the nearest survivor.

The redraw that replaced it was **the deferred one this fix had just added**. `endPress`
ran on `pointerup` and called `refresh()` synchronously; in the preview every `await`
settles as a microtask, so the draw completed before Chrome dispatched `mouseup`, inside
the exact gap the guard existed to protect. The release now waits one **task**, which is
the 2026-09-18 handoff's own rule about focus events applied to redraws.
`createPressHold` is DOM-free and injectable, in `state.ts`, because a decision in an
event handler is a decision the suite cannot reach.

Second and unrelated: `.row--menu` is `position: absolute` and painted **over** the box.
Nine of the box's fifteen rows were the ⋯ button, so aiming at the visible square pressed
the menu. One line — `position: relative` on the tick, which paints later in source
order. No event trace would ever have shown this; only measuring both rectangles did.

`tests/press-hold.test.ts`, 9 tests, mutation-checked twice (synchronous release fails 2;
clearing the flag eagerly at `pointerup` fails 1). Suite 2085.

### What the mock asks for that the data cannot say

The exams board refused four of the mock's own words rather than invent them: no source
reports a grade (`Taken`, not `✓ Graded`), nothing records that a seat was taken
(`3 scheduled`, not `2 Confirmed`, and the verified tick means only "read from
PrairieTest"), no term is stored (`all-term`, not `Fall Semester 2024`), and the venue is
only sometimes in `extra.location` (`Reserve a seat`, not `Reserve CBTF Seat`). §11 one
level up: a label the sources never justified is worse than a plainer true one.

### Still not the mock

Named here rather than quietly left: the sub-bar (`5 Connected` / `Sync Now`) is at the
**foot** in this build, not under the header; the date range reads `Sep 19 – 25` rather
than `Sep 20 – Sep 26, 2024`; the footer says `5 of 6 sources` rather than
`5/5 ok · Needs-You Ledger ›` beside an `Expand Popout`; the mark is the shield, not a
book; and the tab strip carries counts the mock had no data for.

## Classical Calendar: the fourth visual-language exploration — 2026-09-19

From Sushi's Stitch bundle (`stitch_extension_ui_design.zip`, five screens) and the
schema he pasted with it. `public/design-classical.css`, scoped under
`html[data-design="classical"]` like the three stubs beside it, so nothing applies until
a device picks it and the shipped design is untouched by every rule in the file.

What it is: warm vellum ground, a serif (`EB Garamond` / `Newsreader` / **Georgia**, which
is what actually draws — see the caveat below) for everything a person reads, hairline
rules in place of card borders, 3px corners, and the five tabs moved to the **foot** of
the window as a labelled icon bar.

Three things it is careful about, all three of them this project's own recurring bugs:

- **The sizing invariants survive.** No `max-height`, no `overflow`, no viewport unit, no
  percentage height, no width media query. `body` becomes a flex *column* — which still
  has an intrinsic height for Chrome to measure — and the tab strip is moved by `order`,
  never `position: fixed`. Measured in the real `preview-popup.html`: `html.offsetWidth`
  400, `body.scrollWidth` 400, `overflow-y` visible on both, `max-height` none, document
  917px tall on the week.
- **It carries a dark half, and dark was verified first.** The dark washes are roughly
  twice the alpha of the light ones, because a wash composites toward its own luminance
  and the eye is far less sensitive to lightening a near-black than to darkening a
  near-white.
- **It outranks the theme picker on purpose**, via `html[…]:root` — Classical *is* a
  palette, so it has to beat `.theme-neutral` / `.theme-contrast`, and it does without an
  `!important` anywhere.

The course palette is re-pigmented to match: eight inks and eight washes, the first three
being the mock's own (CS prussian, PHYS terracotta, MATH bronze). `.chip` **and**
`.row--code` both become filled badges — they are one decision ("which class is this?") in
two elements, and styling only the chip left the week and the timeline uncoloured.

Two small changes outside the sheet, both of which leave the shipped design byte-identical
on screen: `renderTabs` now builds a glyph per tab (an icon is markup, so it belongs with
`icons.ts` and not in a `background-image`), `popup.css` hides `.tabs .icon`, and
`icons.ts` gained `tab-nodate`.

**Caveats, both Sushi's call.** (1) No webfont is bundled — an extension cannot fetch
Google Fonts under its own CSP — so Georgia draws, not Garamond; bundling one `.woff2`
into `public/fonts/classical/` is a ten-minute follow-up. (2) ~~There is still no picker
UI~~ — **there is now**: Settings › Appearance › *Visual language*, beside the palette and
the mode. Added the same day, because the honest answer to "why can't I just reload the
card" was that a design lives in `localStorage` and reloading the card reloads the
*build* — so turning one on meant devtools and a `setItem`, and the first thing anyone
tries is the one thing that cannot work. The rows carry no swatch: a theme is a class a
swatch can wear, a design is an attribute on the root plus a stylesheet only `popup.html`
links, so a swatch there would preview the page it is sitting in. Only designs with rules
in them are listed — the other three stylesheets are still one-line stubs, and a picker
whose options look identical says the click did nothing.

Captured dark and light to `docs/ux/design/classical/`. 2076 tests pass.

## Popup: less on screen — pill removed, booking banner removed, footer opens Needs you — 2026-09-19

Sushi on the merged redesign: "I don't even know what All clear means", "there's just too
much information being shown", "remove the pill". The header pill is gone. Late work is
being moved to the top of the Today tab and source health already lives in the footer
strip, so the pill's every branch restated something on screen a second time, and its best
case spent three words saying nothing a student could press. The **Needs you** screen it
opened is unchanged and now opens from the footer strip's source text — a toggle, keyboard
reachable, `aria-expanded`, carrying the per-source "which site was read, and when"
tooltip the pill used to hold; `Sync now` stays its own control. The booking banner went
with it: §4.4 pinned one amber line above the tabs per unbooked exam, and the Exams tab
already lists exactly those rows under "Not booked" with the same window text, the same
link and a tab badge counting them (`examCount` is `examBoard().unbooked.length`). The
stale-source sign-in banner, the notifications-blocked banner and the undo banner stay.
`needsYouPill` stays in `core/health.ts` with its tests, marked unused by the UI.

Brief D2, D9 and D10 are rewritten to the new truth rather than annotated. The
Today-as-schedule and Week-one-line work is in flight in parallel and will be recorded
separately.

One thing to fold in when `public/popup.css` is free: the footer button carries its reset
inline (`.foot--health` — flex, `flex: 1`, `min-width: 0`, no border/background, inherited
font) because that file belonged to another worker while this landed. The pill's own CSS
is now dead: `.pill`, `.pill--text`, `.pill--dot`, `.pill--chevron`, `.pill .icon`,
`.pill:hover`, `.pill.is-*` in `public/ui.css`, plus `#health .pill` and the two
`.theme-contrast .pill.is-*` rules in `public/popup.css`. (`.mpill--*` is the month grid
and stays.)

## Popup: Today as a timeline, Week as one-line rows — 2026-09-19

Sushi, on the merged redesign: "I look at everything for today and whether anything is
late. Next up is way too loud. I'd like the day tab to look like a schedule for the day;
anything due at the EOD appears at the top. 11:59 should be EOD. Agenda with collapsed
gaps. For week each item per day is too large. There's just too much information."

`core/calendar.ts` gained `todaySchedule`: **Late** (unfinished, deadline passed — today's
9 AM row included), **By end of day** (no stated time, or stated 11 PM or later), then the
timed rows in clock order. A row appears in at most one band; the day boundary and the
end-of-day threshold stay in `dayContents`, not copied. Seven mutations, all killed. The
grouped `todayBoard` (Next up / Also today / Tomorrow / This week) and its nine tests are
deleted. Today draws the timed band as a timeline: clock column, a 2px rail with the
course dot on it, a "now" bar, a dotted break where more than two hours are skipped, no
empty hours (the axis §0 ruled out is still out). Rows on Today and Week are one 28px
line — dot, title, code, status — with no source name, no room, no relative-plus-clock
pair; the week's nested chips and today-tint are gone, today's date column carries a 3px
accent edge instead. Source names default off (`DEFAULT_TWEAKS`, one spelling in core).
First row on a busy Today with one banner: 146px from the top. From the first live look
(same day): the week's per-day "+" sat under the rows as a row of its own, so a one-item
day was as tall as a two-item day — removed, the header "+" and the empty-area press
remain; and every list carried a ~60px right margin, which was the ⋯ column drawn at 35%
(invisible in dark) or reserved-but-hidden — the ⋯ now overlays the row's right end on
hover / focus / Shift+F10 and reserves nothing. 2076 tests, typecheck and
build green; verified in `preview-popup.html`, dark first, with real pointer presses.

Two things fell out along the way. `npm run shots` had been writing light captures under
dark names since `DEFAULT_MODE` became light (`popup-day-dark.png` and `-light.png` were
byte-identical); it now seeds `illini-dash.mode` per end. And `acceptSuggestion` dropped
the suggestion's `courseCode`, so a class whose display name carried no code could never
merge with its coded rows; it is carried through `ManualInput` now, three mutations
killed. The "Distributed Systems" row in the captures was the preview harness's rename
demo on CS 424, not a source defect; the demo course is renamed so it stops looking like one.

## Live: "the button click to Light doesn't work", and the popup opens dark — 2026-09-19

Sushi, on the merged redesign: the colour scheme did not match the mock, and in Appearance
the press on **Light** did nothing. Both real, both mine.

**Light.** The Appearance panel is a `.menu-surface`, and `trapMenuKeys` closes a panel
when focus leaves it: `relatedTarget` if the event has one, otherwise one task later. A
press on the **label** — non-focusable — blurs the radio at mousedown with no
`relatedTarget`; the radio regains focus only at the click, which comes at mouseup. A
machine press is over in 0ms, so the task ran after the click and every harness passed
(three synthetic presses, one CDP click with no hold). A human press holds for 80–150ms:
the task ran in the middle, saw `<body>`, removed the panel, and the release landed on a
row underneath. Reproduced with a 26ms held press in the browser pane and with a 120ms
real press through Chrome's input pipeline (`scripts/held-press.mjs`, new: old build → panel
closed at mousedown, mode unchanged; fixed build → Light and Neutral apply, an outside
press still closes, the row menu's Hide still logs its request). The fix: a mousedown on
non-focusable chrome inside a panel does not move focus at all (`preventDefault`), and the
"has focus left" decision is never taken while a press that started inside the panel is
held. CLAUDE.md UI rule 5 now says so.

**The palette.** The mocks are light — pale blue ground, white cards — and have no dark
version. The workers built that palette exactly; Sushi's machine is dark and the mode
defaulted to *system*, so the popup opened on the pre-redesign dark palette, which nobody
had redesigned, and read as "you didn't match the colour scheme at all". `DEFAULT_MODE` is
`light` now: the popup opens on the design, Appearance › Dark is one press away. A dark
variant of the mock is still to be designed (cards lifted off a deep blue ground) if Sushi
wants one — it is a decision, not a fix.

## Wave 12: the popup redesign, merged and reviewed — 2026-09-19

**The popup is the soft-card design from Sushi's Claude Design project** (mocks 1a–1f,
2a–2c, exported to `docs/design/`; decisions in `docs/design/brief.md`). Five tabs —
Today · Week · Month · No date · Exams — a header of mark, pill, `+` and `⋯`, a sticky
footer strip, card rows, and four in-flow screens (deadline, editor, Needs-you, first
run). `1970 → 2071 tests`. Built by one core worker and five UI workers in parallel
worktrees (W-core, W0–W4, entries below), then reviewed sequentially by three max-effort
reviewers in fresh contexts, each fixed before the next ran:

- **R1, feature parity** (`docs/design/review-r1.md`): all 198 items of
  `docs/popup-feature-inventory.md` classified — 144 preserved, 49 replaced and recorded,
  0 lost unrecorded, 4 degraded and 1 broken, all fixed. Its first finding was a bare
  `=======` a merge had left in `popup-screens.css`, which CSS error recovery swallowed
  together with the rule hiding the tabs behind the Needs-you screen; the build now
  refuses any static file carrying a conflict marker.
- **R2, house rules in the UI** (`review-r2.md`): 0 B, 8 M, 10 L. The new class it named:
  *a guard that asks another listener whether its own work is still undone* — one Escape
  closed the menu and the screen behind it because the screen's "not while a menu is
  open" guard ran after the menu was gone; a menu closed by focus leaving dropped the
  deferred redraw. Both fixed and verified with real key presses in
  `dist/preview-popup.html` (and the first three attempts failed because the browser was
  serving a cached `preview.js` — the served bundle has to be proven current before a
  harness result means anything).
- **R3, the core wave** (`review-r3.md`): 3 B, 5 M, 7 L; 47 mutations, 44 killed, the 3
  survivors re-judged. The new class: *a decision moved into core, given eleven tests,
  mutation-checked — and never called*, while the footer on screen kept its own second
  copy and said "4 sources" in green over three never read. Fixed: the footer calls
  `footerLine`; the pill says "N not read yet" over a pending source and "Something needs
  a look" over an unactionable failure, never "All clear"; a student-typed year outside
  this school year is refused (a typo'd 2016 had removed a row from every tab, permanently);
  the deadline screen heads a student-set date "You set this date" and prints what the
  source now says; `countdown`'s late branch is elapsed time; the suite pins
  `America/Chicago`.

**Deliberately replaced** (brief, "Deliberately replaced"; per-item table in review-r1):
the day hour grid and drag-to-draft (→ Today's grouped list and the header `+`), the day
‹ › navigator (→ Week and Month), the course chip strip (→ `⋯` › Courses and "Hide
CODE"), the Attention tab (→ the pill's Needs-you screen and the No date tab), the row
menu as the primary path (→ the deadline screen; the `⋯` stays for the keyboard), the
health popover (→ the Needs-you screen, in flow). Not built: **Snooze** (no store
support; a snoozed deadline still falls due) and the mock's Figtree font (no remote
fonts in an extension).

**Two decisions for Sushi, both from R3, both left as they were:**

1. **A date the student set outranks every later source date, for ever** (R3 M5).
   SPEC §5.3 says nothing about `dueOverrides`; brief D3 says only "applies the existing
   due override". When PrairieTest finally publishes the slot, the popup keeps the
   placeholder. Interim: the deadline screen now says "PrairieTest says Nov 3, 9:00 AM"
   under "You set this date", so it is never silent. Options: the source's first stated
   date supersedes the placeholder; or the row asks "use it?".
2. **Student-typed dates are built in campus time; every view buckets in the browser's
   zone** (R3 M8). A student outside Central who types `2026-09-22` gets Chicago 23:59,
   filed on Sep 23 in their own zone. Predates the redesign (`newManualItem` always did
   this) but the redesign added a second surface. Options: build them in the browser's
   zone, or say "campus time" beside the date field.

**One browser round-trip, for the morning** (everything else was verified in the real
document, dark first, `docs/ux/after/popup-*-dark.png` regenerated on the final build):

> `npm run build`, then click **Reload** on the Illini Dash card at `chrome://extensions`,
> open the popup, and look at it in dark mode. Then: press one row (the deadline screen
> should open in place, ‹ back should return you to the same tab with focus on that row);
> press the pill (the Needs-you screen); press `+` (the add form) and Cancel; open the
> `⋯` and Escape it. If anything is wrong, right-click the popup → Inspect popup and
> paste the console — that console, not `background.js`'s.
>
> What each answer proves: all four work → the redesign is on the real document, G4's
> beta can continue on it. A screen opens but the popup is 800px wide → a sizing
> invariant broke in the real window and the harness could not see it (measure `html`
> width first). A press does nothing and the console is empty → the worker is running
> the older build; Reload again.

## Wave 12 / W1: the card row, Today, the week, the quiet state — 2026-09-19

**D4, D5, D7, D13, D14.** `2065 tests, unchanged` — the suite does not import the popup.
Verified by `npm run typecheck`, `npm run build`, `npm run shots -- popup` in both modes
(dark first) and by **real pointer events** in `dist/preview-popup.html`: the row ⋯ opens
on the right row (menu bottom 544 of 600), "See the week" reaches the week, and a press on
the new **Source names** switch redrew the list with the source gone.

**The row (D7)** is one function with three variants — card, hero, compact — so the Today
board, the week's day cards and the exam board cannot drift apart. The one-phrase
qualifiers moved onto the meta line under the title (source, exam room, "opens 9 AM",
italic "time assumed", "+2 more", the practice chip); the ones that are a sentence with a
control in them kept their own full-width line. A plain press calls `app.openDeadline`,
which is still a no-op stub until D8 lands; ⌘/Ctrl-click and middle click open the source,
and middle click needed its own `auxclick` because Chrome fires no `click` for it. The
countdown is `--err` once past and `--brand-mark` inside a day — the accent-as-text token,
because `--accent` is a fill and fails contrast at 12px.

**Today (D4)** is `todayBoard`, and **the week (D5)** is seven cards with `weekStatus`'s
one word. **The quiet state (D13)** draws only when `quietState` answers, which is only
when every checkable source did; `emptyStateFor`'s failure wording is untouched.

**Deliberately replaced** (inventory F71–F89, F93, F94): the day hour grid, its
drag-to-draft and `renderPlaced`/the untimed band — `views/day.ts` is deleted rather than
left dead — and the day ‹ › navigator (`navFor` now returns step 0 for the day, so `#nav`
is hidden and Today is anchored to now). The week's `"—"` empty day is now "Nothing due",
and its `time not posted` band is a row carrying `EOD`.

**Measured** at 400×600, Today, dark: `html` 400 wide, `body.scrollWidth` 400, **0 elements
past x=401**, **164px before the first row** (W0 measured 184 with the navigator). Week:
400 wide, 0 past 401, label "Sep 19 – 25", seven cards.

**One thing left short of clipped.** The Appearance panel gained a "Deadline rows" section,
and with three palettes, three modes and two switches its content is 641px against a 571px
box: the second switch sits 70px below the fold. The panel scrolls (`overflow-y: auto`), so
both are reachable, and a real press on the scrolled-to switch works — but it is UI rule 8
again and the panel belongs to the shell, so whoever owns `placeFloating` should decide
whether the section moves to Settings.
## Wave 12 / W4: the header pill opens a screen — 2026-09-19

**2065 tests, unchanged — the suite does not import the popup.** Verified by
`npm run typecheck`, `npm run build`, `npm test`, and `npm run shots -- popup` in both
modes (dark first).

**The pill (D2).** `renderHealth` no longer writes its own sentence: it takes the items
and asks `needsYouPill({ sources, syncing, overdue, suggestions })`, so "2 late" outranks
"1 needs you" and both outrank "All clear" by one rule in core rather than by two
copies — the pill and the screen it opens count the same `overdueItems`. `healthPill` is
untouched and still owns which source broke; nothing in the popup calls it any more.
Signature: `renderHealth(sources, items, now)` — `lastSyncAt` is gone from it, which is
worker rule 2 removing the last field the header could have lied from.

**The Needs-you screen (D2, mock 1e)** is `screens/needs-you.ts`, **in document flow**,
replacing `#view` with `.needsyou` on `body` hiding the tabs, the chips and the date nav
the way `.setup` does. It replaces the health popover, which is the point: a floating
panel contributes no height to the box Chrome measures, and that list shipped clipped
half way down its fifth row. Order is the mock's — the amber `staleNotice` sentence with
its `actionFor` button, **Late** (the Attention tab's Overdue group, each row followed by
*Mark done* / *Hide* through `applyOverrideAction`), **Found in a post** (`renderSuggestions`
moved over unchanged: Add / Ignore, the provenance line, the verbatim span as the
tooltip), **Sources** (one card, `sourceRows` + `actionButton`), and the "Nothing was
dropped while X was out" note. `state.screen` holds it; ‹ back and Escape close it and
return focus to the pill; it re-renders from fresh state on every draw rather than
holding the redraw, because every sentence on it is a claim about the store.

**One deliberate deviation from mock 1e.** Its source rows read "6 courses · 2m ago" and
"31 items"; core counts neither, so the detail line says what `sourceRows` gives —
the state word and "last read 2 min ago". A count this file invented is a count the
student would trust (worker rule 3).

**First run (D12, mock 1d).** `renderSetup` restyled to the mock: the mark, "One
calendar, nothing to maintain", the two-sentence blurb, the pin card (unchanged, still
full-view-only and still `PIN_DISMISSED_KEY`), a "Where to look" list card, **Find my
deadlines** and a hint line. The switches are **grouped** as the mock groups them —
PrairieLearn and PrairieTest share one, which sends `set-source-enabled` per source and
one `sync` — and a pair shows one chip each, because "PrairieLearn connected, PrairieTest
needs a sign-in" is two facts. Piazza & Campuswire and Course websites are named as the
mock names them but carry a **Settings** button rather than a switch: both need a host
permission granted in the click on a page that stays open, which a popup is not.
"Find my deadlines" now runs `app.runSync()` between `complete-setup` and
`recheckLogins`, and its `send` has the `.catch` the old one did not.

**Two findings from the inventory.** F10's missing `.catch` on the header's .ics export
was already fixed when the shell was split (`shell.ts`, `Download .ics`) — nothing to do,
and the inventory line is stale. The dead `.book` / `.book--text` / `.book--go` rules are
deleted from `popup.css`; the booking strip has been a `.banner-line` since D-banners.

**Not preserved, deliberately:** `openHealthPopover` and `renderSourceRow` are deleted —
the screen is the source list now, and the popover's per-source facts survive as the
pill's tooltip (`pillTooltip`, built from the same `sourceRows`). The pill's
`aria-haspopup="dialog"` is gone with it; `aria-expanded` stays and now tracks the
screen.
## Wave 12 / W3: the deadline screen and the editor — 2026-09-19

**2065 tests, unchanged** — the suite does not import the popup. Verified by
`npm run typecheck`, `npm run build`, `npm run shots` in both modes (dark first),
and by **real pointer events** in `dist/preview-popup.html`: the screen's dot menu
opens and lists Merge with... / Report this page..., back returns to the list and
puts focus on the row it came from, the No date toggle disables Date and Time,
Escape closes the editor screen, and a "Give it a date" save on a PrairieTest row
logs `set-due requested for ...` and closes the form.

**The deadline screen (D8, mock 1c)** is `screens/deadline.ts`, in document flow
inside `#view`. Course pill, title, Due card with the countdown, facts list
(Source + Open, Also seen in, Status, Late window, exam room), the amber *moved by
an announcement* note with **Undo move**, then **Mark done / Not done**, **Add to
Calendar** (hidden when `googleCalendarUrl` does not resolve), **Hide CODE** (the
header's Courses set, `HIDDEN_KEY`) and **Hide this / Unhide**. The row menu
carries the rest of inventory section I - Split, Merge with... (replace-in-place,
twelve `sameCourse` candidates), Edit / Delete for a sole manual member - plus
**Report this page...**, which opens Settings > Help; the scrub needs a NetID, a
name and a file to download. Snooze is not built (D8).

**It is re-rendered from the fresh item on every draw, not held over one.**
`state.screen` is `{kind, itemId, view}` and `renderOpenScreen` looks the row up in
`state.currentItems`, so the countdown keeps counting, a row a sync deleted takes
its screen with it, and a tab press stands the screen down. `drawIsHeld` is
untouched.

**The editor (D11, mock 2b).** Screen bar, intro sentence, 9.5px uppercase labels,
Title wide with Course / Kind and Date / Time in two columns, a real
`role="switch"` **No date yet** (disables the clock fields; `read()` sends no date,
so `core/manual.ts`'s optional date is what saves), End time and Link under a
**More** `<details>`, **Add it** + **Cancel**. Without a `container` the form
replaces `#view`, like the deadline screen; the week's per-day boxes and the day
grid's draft still pass one and still open in place. **`valuesOfMember` now answers
a blank date for an undated row** instead of `viewedDate()`, which would have
turned "open the form to fix a title" into a deadline nobody typed.

**"Give it a date" (D3)** is that form with two saves behind it:
`edit-manual-item` for a sole manual member, and otherwise `{kind:"set-due"}` ->
`studentDueOverride`, through `EditorRequest.save`, which rejects with the sentence
the editor shows.

**Preserved F-numbers:** F59 (now the Source row's *Open*), F60, F61, F62, F63,
F64, F65, F66, and F67-F70 untouched; F116-F128, with F118's field order and
F125's "Add it" changed to the mock and F126 extended as above.
**Measured** at 400 wide: `body.scrollWidth` 400, **0 elements past x=401**,
deadline screen document **598px** (no scroll). The editor screen is **613px** on
the fixture that carries two banners - 13px past Chrome's ceiling, which Chrome
scrolls itself; with no banner it is under 600.

**Two harness findings.** A `MouseEvent("click")` is `cancelable: false` unless you
say otherwise, so every `preventDefault` on its way up is ignored - the first
`popup-deadline` capture was gradescope.com's login page. And nothing yet routes a
row press to `app.openDeadline` (D7 is the rows worker's), so `?open=deadline`
presses the row *and* falls back to opening the screen through `__illiniDash`,
printing which of the two happened. That fallback and the `__illiniDash` handle in
`popup.ts` can go the day a row's press opens the screen.
## Wave 12 / W2: the month, the No date tab, and the exam board — 2026-09-19

**2065 tests, unchanged — the suite does not import the popup.** Verified by
`npm run typecheck`, `npm run build`, `npm run shots -- popup` (18 shots, dark first)
and by measuring the real `dist/preview-popup.html` in headless Chrome.

**Month (D6, mock 2a).** `renderMonthView` branches on `isFullView`; the full view's
titled-pill grid is untouched. The popup draws `monthDots` — a 5px course-hue dot per
deadline, `.45` when done, `MONTH_DOT_CAP` of them and a `+N` rather than a silent
truncation — over a Sunday-first header taken from a known Sunday rather than a
hand-written "S M T W T F S". Every cell is a `<button>` with `aria-pressed` and a
title ("Tuesday, Sep 22 — 2 due"), because a dot says nothing to a screen reader.
`dayList` names the tapped day underneath through `renderRow`, with **EOD** where §4.5
invented the time (worker rule 3). The selection is module state — the minute tick and
the open-sync must not snap it back to today — and is ignored when it falls outside the
month shown, so the heading can never name a day the grid is not drawing. The month's
name keeps its place in the date navigator and gains "Full view ↗" beside it.
`FULL_VIEW_ONLY` is now **empty**: the month was in it because of the pills, which need
~100px a cell, not because of the month.

**No date (D3, mock 2c).** `views/nodate.ts`: the explainer card, one "Waiting on a
date" head over both groups, and a card per row — `renderRow` for the body, three
`.btn-sm` under it. **Give it a date** opens the editor through `app.openGiveDate`;
**Tick off** and **Hide** go through `applyOverrideAction`, which owns "Applying…", the
log line and the catch. "Couldn't read" rows carry the amber `check` chip on the
actions line — not inside the row, which is `rows.ts`'s object — and both groups keep
their `ATTENTION_NOTE` as the card's tooltip. Nothing is folded: the fold made sense
when this group was burying two actionable ones, and none on a tab it is all of.

**`views/attention.ts` is deleted.** `SUGGESTION_SOURCE` and `renderSuggestions` moved
**verbatim** to `src/ui/popup/suggestions.ts` for the Needs-you screen; `ATTENTION_NOTE`
keeps all three sentences, exported from `views/nodate.ts`, so the Overdue one is not
written twice.

**Exams**, restyled onto the card language with nothing removed: `h2.section` →
`.section-head` with the count in its own span, rows stacked in `.exam-stack`, the empty
sentence in a `.view-note` card. Inventory §M F104–F106 all preserved, including the
stripped `"Book a slot: "` prefix, `examWhen`'s date-*and*-day and `.row-sat`.

**Measured** on the real document, both modes, all three tabs: `html` 400px,
`body.scrollWidth` 400, **0 elements past x=401**. A **real pointer press** on Sep 22 —
CDP `Input.dispatchMouseEvent`, because a synthetic `.click()` proves nothing (UI rule
5) — moved the heading from "Sat, Sep 19 · 5 due" to "Tue, Sep 22 · 2 due" and moved
`aria-pressed`. The preview *pane* could not do it: another session was driving the same
window and its coordinates landed two hundred pixels away, which is UI rule 6 exactly —
three "the press does nothing" results were the pane, not the code.

**Shots**: `popup-month` and `popup-nodate` added; `popup-attention` is gone, and the two
entries still asking for `tab=attention` — which now falls back to `day` — were moved to
`nodate` rather than left quietly capturing the wrong screen.

## Wave 12 / W0: popup.ts split, and the new shell — 2026-09-19

**1970 tests, unchanged — the suite does not import the popup, so none of this is pinned
by it.** Verified instead by `npm run typecheck`, `npm run build`, `npm run shots` in
both modes (dark first), and by real pointer events in `dist/preview-popup.html`.

**The split.** `src/ui/popup.ts` (3809 lines) became `src/ui/popup/` and a 523-line entry
that owns `render` / `refresh` / `draw` / `runSync` / `recheckLogins` and the four
listeners that keep an open window honest. `state.ts` holds the document's elements, the
`localStorage` keys and one mutable `state` record; `shell.ts` the header, tabs, banners,
`#status`, footer, every menu and `placeFloating` / `trapMenuKeys` / `drawIsHeld`;
`rows.ts` the row; `views/{day,week,month,exams,attention}.ts` and
`screens/{setup,editor}.ts` the rest. Every function moved whole with the comment that
explains it. **The cycle it would otherwise have had is one object**: `state.ts` imports
nothing local and carries `app` — `refresh`, `runSync`, `openAddEditor`, `openEditEditor`,
`deleteManual`, `undoDelete` — assigned once at the bottom of the entry, so `shell` never
imports a view or a screen.

**The shell (D9, D10).** Header is `[mark] Illini Dash [pill] [+] [⋯]`: the mark is a new
`appMark()` in `icons.ts`, drawn from `--brand-mark` and `--surface-raised` so it works in
all six theme/mode combinations. Sync, full view, .ics and Settings came off the bar; the
⋯ carries Open full view, Download .ics, Google Calendar…, Courses…, Appearance…,
Settings. **Courses replaces the chip strip** — `renderFilters` is kept and reachable but
no longer called, and `.filters:empty` collapses it. The tab strip is five `flex: 1`
columns, so the strip's width is a function of the document rather than of the labels: a
long label ellipses inside its fifth and can no longer push the popup to 800px. The
footer is `position: sticky; bottom: 0` **in flow** — a fixed strip contributes no height
and the document's height is all Chrome measures — and every word of it is derived from
an attempt that happened: `summarize()` for the ratio, the newest `lastSuccessAt` across
checkable sources for the clock, never `lastSyncAt` (worker rule 2). `#status` moved to
the top of the document beside `#banners`, which retires the `scrollIntoView` that never
worked on the week view (UI rule 3).

**Measured** at 400×600, day tab, healthy: `html` 400px wide, `body.scrollWidth` 400, **0
elements past x=401**; header 44, banners 66, tabs 42, date nav 32 — **184px before the
first row**, against 210 before (the chip strip's 36 back, minus 10 of header and tabs) —
footer 37, document 513. (`documentElement.scrollWidth` cannot be read as 400 in headless
Chrome: macOS pins its minimum window to 500px, so it reports the viewport. `htmlW` and
the right-edge sweep are the measurements that mean it.) D1's five labels need
37/34/39/48/40px in a 74px column, so "No date" fits with 26px to spare.

**Card language**, for the workers building on this: `.card`, `.card--dashed`,
`.section-head`, `.screen` / `.screen-bar` in `popup.css`, documented in a block at the
top of that file. Two new tokens in `ui.css` — `--card-line` and `--card-shadow` — with
light, dark, Neutral, Neutral-dark, High-contrast and High-contrast-dark values.
`popup-rows.css`, `popup-views.css`, `popup-screens.css` exist and are linked, empty but
for a header, one per parallel worker.

**Not preserved, deliberately:** the pill's inline action button (the same button is in
the source list the pill opens, and at 400px a second control beside the sentence costs
the sentence); the tab icons in the popup (five equal columns have no room for one, and
the full view keeps them); the course chip strip (above). **Not built:** the header's
Google Calendar entry opens Settings › Google Calendar rather than doing anything itself —
the popup's actions bar never had a gcal control, and `gcal-connect` needs
`getAuthToken({interactive: true})` from a page that stays open, which a popup is not.
**Still wrong until D1 lands:** the fifth tab reads "Atten…" — "Attention" plus its badge
needs 83px in a 74px column. It ellipses rather than pushing, which is the property that
matters, and the label goes when `nodate` does.
## Wave 12 / W-core: the rules behind the popup redesign — 2026-09-19

**1970 → 2065 tests.** The core half of `docs/design/brief.md`, so the UI workers have
pure functions to draw rather than decisions to re-derive. Every item mutation-checked;
four survivors, each classified and acted on (see below). New API, by file:

`src/core/calendar.ts`
- `ViewName` is `day | week | month | nodate | exams` — `"attention"` is gone as a tab
  (D1). A stored `"attention"` is not in the union, so `VIEWS.includes` falls it back to
  `day` with no migration.
- `noDateGroups(items, now)`, `NO_DATE_ORDER`, `noDateCount(items, now)` — the No date
  tab (D3). Undated first, then "Couldn't read"; the badge counts **both**, unlike
  `attentionCount`.
- `overdueItems(items, now)` — the Overdue group, for the pill and the Needs-you screen.
- `todayBoard(items, now)` → `{ nextUp?, nextUpWhen?, alsoToday, tomorrow, thisWeek,
  weekMore }` and `WEEK_PREVIEW_ROWS` (5) — the Today tab (D4). Grouped by `sectionFor`,
  not by a second copy of `endOfWeek`.
- `monthDots(items, anchor, now)`, `MONTH_DOT_CAP` (4) and `dayList(items, day, now)` —
  the popup month (D6). `FULL_VIEW_ONLY` can drop `month`.
- `weekStatus(item, now)` → `done | N late | late ok | EOD | clock` — the week card (D5).

`src/core/grouping.ts`
- `countdown(instant, now, "coarse" | "fine")` — the row's right-hand column (D4). `fine`
  adds the minutes for the hero; mock 1a shows one 11:59 PM deadline as "in 4h 12m" and
  "in 4h".

`src/core/health.ts`
- `needsYouPill({ sources, syncing, overdue, suggestions })` → `{ text, tone, kind }`,
  kind ∈ `syncing | pending | late | needs-you | clear` — the header pill (D2).
  `healthPill` is unchanged and still owns "which source broke".
- `footerLine(sources, syncing, now)` → `{ dot, sources, synced, tone }` — the footer
  strip (D10). **It takes no `lastSyncAt`**, by design.
- `quietState(items, sources, now, courseNames?)` → `{ headline, detail, next }` — the
  quiet empty state (D13). Undefined unless *every* checkable source answered.

`src/core/manual.ts`
- `ManualInput.date` is optional (D11); such a row has no `dueAt` and **no**
  `timeAssumed`. A time with no day is refused; a *mistyped* date is still refused.
- `statedInstant(date, time, zone)` — one answer to "what counts as a date a student
  typed", now shared with the override below.

`src/core/overrides.ts`
- `studentDueOverride(stated, item, zone, now)` and `STUDENT_POST_ID` — "Give it a date"
  for a source row (D3). `applyDueOverride` had no caller in `src/` at all; the gap was a
  message, not a rule.

`src/core/theme.ts`
- `TWEAK_KEYS`, `DEFAULT_TWEAKS`, `normalizeTweaks(stored)` — `urgencyEdge` (off) and
  `showSourceNames` (on) (D14).

**Outside core, pure wiring only** (flagged for the worker splitting `popup.ts`):
`src/ui/popup.ts`'s three `"attention"` literals renamed to `"nodate"` and the tab count
swapped to `noDateCount`, so the file still compiles; one `OverrideAction` member
(`set-due`) in `src/messages.ts`; one `else if` in `background.ts`'s `applyOverride`
calling the two core functions.

**Mutation survivors, classified — corrected by review R3.** `dayList`'s title
tie-break was deleted, rightly, but the first note called it *redundant*, and it was not:
re-adding it survives the suite because the case it changes — a stated 23:59 and an
assumed 23:59 on one day, titled so alphabetical order contradicts stated-first — was
*untested*. That test exists now. Its NaN guard "survived" because the input never reached
it (mutation house rule 4) — the test uses two untimed rows named so the concatenation
answers wrongly. `todayBoard`'s "today before the rest of the week" and `weekStatus`'s
"done before late ok" are *equivalent mutants*, not merely unreached: `sectionFor` never
files a past instant under Today and `itemTone` returns one value, so no input can tell
the mutated line from the original. They say nothing about the suite and are kept with a
comment at the line.

**One deliberate deviation from the mock**, in `quietState`: "All 8 sources answered
2 min ago" rather than "2 minutes ago", reusing `timeAgo` instead of adding a third
ago-format beside it and `compactAgo`.

**Nothing here draws anything.** `docs/popup-feature-inventory.md`'s "Deliberately
replaced" list still has to be written by whoever lands the UI.

## Wave 10: the page is read without the model — 2026-09-19

**1939 → 1970 tests.** Third live run of the author on ECE 411: "only 1 of 3 rows carried
a readable date" — schema-valid, grounded proposals that kept choosing small groups,
because the inventory ranked by row count and said nothing about dates. Now every
inventory group carries `dated` — rows readable *by the runner's own date reader*, with
TBD/TBA counted apart as pending, one sample line, and the label convention (every label
ending in *due*: `Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due`, character for
character the shipped entry's `dueLabel`) — and ranks by dated share first, so ECE 411's
`#mp-information ul.simple > li` is first instead of fourth. The retry names the top
three dated groups. And **the deterministic proposer reads labelled lists**: a group with
≥3 rows, ≥80% of its stated rows dated, a due-label convention and an enclosing heading
becomes a `list` candidate run through the real runner; over the capture it matches the
same sixteen elements as `ece411-fa26-mp` by identity and yields the same items. The
model is no longer consulted for that page at all. `noCandidateReason` names both shapes
it reads and says what it did find. The syllabus exam list stays hand-written: its labels
are the exams' names, not a due convention, and the clock sits in a nested `<li>`
(amendment in docs/ece411-findings.md).

## Wave 11: the Attention tab, tidied — 2026-09-19

**1927 → 1939 tests.** The store prunes a suggestion whose instant precedes its
`createdAt` — found already past, the store-side twin of wave 8's ingest rule, for rows
written before it (Sushi's 13 and 14 Sep rows). A title that resolved to the post's whole
subject is cut at its first spaced separator — " (", ": ", " — ", " – ", " - ", " + " — with
a three-character floor, in `suggest.ts` (`rowTitle`), decided by *equality with the
subject* rather than by which rung produced it, because the phrase scan can also reach
into the subject line: "MP1 Demo Signups May have moved location (+ Reminder …)" becomes
"MP1 Demo Signups May have moved location", the running post's subject becomes "HW1",
"Proj-CNN Mini Extension" and "11:59" are untouched. The grey line quotes the post only
when the subject adds something to the title. And the two reader-upgrade lines print
one number, carried on the plan (`rereadCount`), pinned over the exact store shape that
printed 0 live.

## Live: the Attention tab after reader 3; classmate notes stay ignored — 2026-09-19

**Decision (Sushi):** classmate-written pinned notes are **ignored** — not read for
deadlines at all. `includeStudentNotes` stays off; the six held-back CS 425 notes stay
held. Recorded in docs/piazza-findings.md as policy, not as a gap.

**The tab, read as evidence.** Five rows. Four are from the first run, in the old wording
("from a Piazza post"): MP1 Report (Mon 14 Sep), Code Submission Instructions (Sun 13
Sep), Google Form (Sun 20 Sep), MP2 (Sun 27 Sep) — the three 11 Sep rows have aged out
of `SUGGESTION_PAST_DAYS`, and the 13th and 14th will follow, but they were *found* on
the 18th already past, which wave 8's rule now refuses at ingest and nothing yet refuses
in the store. The one new row is the body stage's: Sun 20 Sep, titled with the post's
whole subject — "MP1 Demo Signups May have moved location (+ Reminder to TAG your MP1
report on Gradescope)" — and the grey line quoting the same subject in full underneath.
The fallback to the subject fired (right: the phrase subject was generic), but a
sentence-length subject as a title, repeated verbatim one line below, is the next thing a
student notices. Two small fixes queued: the store prunes a stored suggestion whose
instant precedes its `createdAt` (found already past, from before the ingest rule), and a
subject-derived title is cut at its first parenthetical, colon or dash while the "from"
line carries the full subject only when it adds something.

## Live: reader 3 reads 23 bodies; the debounce and the diff hold — 2026-09-19

Sushi's console on build 20260919T052601, read as evidence (worker rule 7). In order:
"every post here was read by reader 2, and this build is reader 3: re-reading them in
full"; "CS 424: 4 post(s) in the feed, 3 note(s) to re-read"; "CS 425 / ECE 428: 107
post(s) in the feed, 20 note(s) to re-read"; "23 new note(s): 23 read in full, 0
unread"; "reader upgraded 2 → 3"; "2 classes, 25 request(s), 23 new notes, 0 moved, 1
suggested". The next sync: "0 new note(s) to read", two requests, and the popup-open
line "inside the 5-minute debounce, so nothing is refetched" — the upgrade ran once, the
bodies were fetched (25 requests = 2 feeds + 23 bodies), and neither the loop nor the
popup re-reads. Google Calendar said "nothing changed — 25 events already on the
calendar" on every pass, which is the content-hash diff doing what it is for.

Three readings of the numbers:

- **29 became 23.** The first live run read 29 notes; reader 3 re-read 23. The six are the
  classmate-written pinned notes wave 8 now holds back (P5), which makes the open policy
  question concrete: six of this student's 29 notes are classmate posts, unread until
  Sushi says whether they may raise suggestions.
- **HW1 produced nothing, which is right.** Sushi has a Gradescope HW1 for CS 425 (the
  hide/unhide lines name it); the running post states the same 20 Sep 23:59, so the
  mention is a zero-distance match and neither a move nor a suggestion — exactly what
  `tests/piazza-real.test.ts` pins. The one suggestion is something else; asked which.
- **"reader upgraded 2 → 3: re-reading 0 posts in full"** is a cosmetic contradiction: the
  apply-time line counts the `piazza:` keys it drops, and by then the fetch had already
  been planned on the cleared view, so it counted the fresh marks' absence rather than the
  29 it announced in the plan line. Harmless — the next sync shows no loop — but the two
  lines should agree; small, and noted for the next Piazza worker.

## Wave 9: the reader upgrade re-reads for real; the author's schema demands what its validator does — 2026-09-19

**1900 → 1927 tests.** Two workers. The Piazza plan now carries `seenPostsForFetch` — the
store's marks with every `piazza:` key removed when `rereadAll`, computed by the same
`readerUpgrade` the write uses — and it is the only seen-marks field the fetch stage can
be handed; the plan hold no longer returns raw marks, so the live mistake is a type error.
`PIAZZA_READER_VERSION` is 3, because 2 was stamped on real installs without a fetch. The
test the wave-7 suite lacked now exists: the worker's sequence, plan → postsToSend →
postsNeedingBody → bodyBatch, over the real feed with every post marked read under an old
reader, asserting 20 notes sent and "already read" 0 — the exact mutation that was live
survived all 131 Piazza tests before it and fails now. The per-class line moved into core
(`feedLine`) and says "N note(s) to re-read", keeping the "already read" clause on that
branch as a tripwire.

The author's response schema requires `shape, rows, title, due, dueLabel, dateFormat` of
every shape (Chrome's `responseConstraint` is flat, so the per-shape conditional cannot
live there); "" means "not given" and, for `title`/`due` off a table, becomes the runner's
`.`. `columns` left the model's vocabulary — the validator assembles it. A test builds the
minimal schema-valid object per shape *from the schema* and asserts no rejection reason
says "needs" or "missing". Each inventory entry now carries a sketch of one row's inside
("inside one row: p  e.g. "Release: 8/25""), so `title` is a choice from something shown.
Open: ECE 411's bullets are `Due: 9/7`, so the right answer is the `list` shape with a
`dueLabel`; if the model still fails, the inventory's ordering (bare `li ×39` above the
section's list) is the next lever, not the schema.

## Live: the click survives the sync; the reader upgrade did not — 2026-09-19

Three results from Sushi on build 20260919T002513, read as evidence (worker rule 7).

**The queue fix holds.** Sync now, then Hide pressed while the status still said syncing:
the row stayed hidden after the sync finished. That is the exact click that the
re-entrancy flag lost, and the first live proof that a store write during a fetch
survives. The store's test instructions were approved the same message.

**The reader upgrade fetched nothing.** The console showed the plan's "re-reading them in
full" line, then per class "0 new note(s) to read, 20 already read", then "reader
upgraded 1 → 2: re-reading 29 posts in full", then "0 new notes". The plan dropped
`sinceNr` but the fetch stage was still handed the *pre-upgrade* seen marks
(`planned.seenPosts` into both `postsToSend` and `postsNeedingBody`), and the apply
stage then cleared the marks and stamped version 2 — after the only fetch that could have
used the clearing. The wave-7 tests pinned plan and apply separately and never the
sequence. Version 2 is burnt on real installs; the fix (wave 9) moves the fetch's
seen-marks view into the plan, bumps to 3, and pins the worker's sequence end to end
over the real feed.

**The author asked three times for a shape it could not answer.** "shape "rows" needs
title": the response schema requires only shape, rows and dateFormat; which keys each
shape needs lives in the validator the model never sees, and a constrained decode emits
exactly what the schema requires. Wave 9 makes the schema demand what the validator
demands, so no schema-valid proposal can be rejected for a missing key, and shows the
model a sketch of one row's inside so `title` is a choice rather than a guess.

## Wave 8: the trace's 41 findings, fixed by four workers — 2026-09-18 night

**1783 → 1900 tests.** Four workers by file territory, merged with one conflict (both
had appended to the same findings doc); the seams between them — the class's codes and
the note's subject travelling from the poll plan into the payload, the chip's tone in
core, the worker stating the "html omitted" decision positively — wired by hand and
pinned afterwards.

**The queue (high effort).** `createStoreQueue` is strictly exclusive; the re-entrancy
flag and the four tests that pinned it are gone, replaced by the opposite test (a caller
arriving mid-section waits, and its write survives) and a `SLOW_HOLD_MS` warning that
names a section outstaying 2s. Nothing holds the queue across a fetch any more:
`core/sync.ts` gained `planSync` / `fetchSync` / `applySync` and `syncOnce`, which is the
whole plan → fetch → apply orchestration *in core* so the load-bearing second `load()` is
testable; `runPiazza`, the registry refresh and `gcalPush` have the same shape; `runPiazza`
has an in-flight promise its three callers join. Worker rule 4 rewritten (not annotated),
docs/gcal.md's push bullet likewise.

**Piazza honesty, in one contract.** `PiazzaResult` carries `requests`, `classesPolled`,
`classFailures`, `bodiesRead`, `bodiesFailed`; `applyPiazzaResult` is assigned, never
spread (a spread cannot delete a key, which is how every recovery kept its four-hour
`nextAttemptAt`). No request → `pending` with "On · no class in this term"; a class that
failed → the caveat beside the counts; every body refused → "25 posts couldn't be
opened"; nothing new → "checked 10:32, nothing new". A failed body no longer settles its
post: transient failures hold `lastNr` below the post, refusals give up at the snippet
with a reason. A per-class 403 is that class's failure, not a sign-out (`feedSignedOut`);
`needs_login` gets `PIAZZA_LOGIN_GRACE` free retries before the ladder; one bad nid falls
back to the bare `/class` URL; a navigation elsewhere is a `recheck`, not `manual`, for
Piazza.

**Parsing.** `courseCodes` finally reaches the post (both halves of a cross-listing);
`lastNr` stops below a post refused for an unreadable field; a bad numeric entity costs
its character, not the feed; HTML comments go with their contents; a `>` inside a quoted
attribute no longer eats text; `instructorNote` travels and a classmate's pinned note is
held back with its reason (policy, flagged for Sushi); a re-read body's `postedAt` is the
version's own instant (amendment); the chip's tone comes from `piazzaChipState`; compat
normalises `observers.piazza`.

**Grammar and suggestions.** `released` never moves a deadline; a carried subject
reaches the next sentence only and never crosses a paragraph; ingest matches items on
any of the post's codes; "EOD <date>" resolves; `alreadySuggested` is per course. From
the live list: **a deadline already past when read is recorded and never offered** (three
of the seven were), a title never carries Markdown and never is a sentence, a generic
phrase subject ("Google Form", "See Demo") yields to the post's subject, and the row says
*which* post: "from the Piazza post “MP1 Demo Sign-up Sheet”" (`Suggestion.postSubject`,
additive).

**The author.** An older worker's missing `html` is named as such (`htmlOmitted`
stated positively by the worker); a malformed selector costs its proposal, not the run;
`repeatedStructures` is bounded and measured; the tbody spelling outranks the header one;
the skeleton's summary and the schema's enum come from one inventory; "Use this one"
re-enables and says what failed.

**Open, and Sushi's:** whether a classmate's pinned note may raise a suggestion (never a
move); whether `event` mentions should also never move; the `PIAZZA_LOGIN_GRACE = 4`
guess; `recheck` still overriding the ladder for the five hosted sources.

## Wave 7: the HW1 deadline reaches the student; a seven-segment trace — 2026-09-18 night

**Builder (1742 → 1772 → 1783 on main after the author merge).** `post-running.json` is
pinned end to end: newest version only, one suggestion, HW1 at 2026-09-20T23:59:00-05:00
with a *stated* clock — which turned up a grammar defect: `PROSE_SEP` stopped at the "(" of
"(Sun)", so "9/20 (Sun) 11:59 pm" dropped its stated time and took the invented 23:59
(equal instants, invisible, and ranked below a stated value by §5.3 — worker rule 3's
exact hazard). A bracketed weekday between a date and its clock is now read and fed to
§3.2's weekday cross-check (amendment; the builder stepped outside its file list for it
and was right to). `PIAZZA_READER_VERSION = 2`: a store read by reader 1 drops its
`piazza:` seen marks and per-class `lastNr` once, in the same write as the results, and
logs "reader upgraded 1 → 2". Edited posts are re-read on the feed's own signal — the last
create/update entry of each entry's `log[]`, which equals `history[0].created` in both
captures; `modified` is last *activity* and would re-fetch on every follow-up (amendment).
A post already due exactly when a suggestion would say is never re-offered, so an edit
does not offer the student the row they just accepted.

**Trace (7 finders, 2 refuters each, 102 agents).** 47 findings; **36 confirmed by both
refuters, 5 split, 6 refuted.** The one I verified by reading before anything else, and
the most important defect found today: **the store queue is not exclusive.**
`createStoreQueue` implements re-entrancy with a global `held` flag, so while a sync holds
the queue across its fetches, *any* concurrent caller — a Hide, a tick, an accept — sees
`held` and runs immediately, then the sync's `saveStore` of its older snapshot overwrites
the click. Worker rule 4's defect, reintroduced by the fix for its deadlock; the queue test
"does not deadlock when work re-enters" pins the mechanism (worker rule 6). The other
confirmed ones cluster: Piazza runs overlapping and recording `ok` without a request or
after every body failed; a failed body marking its post read forever; one bad nid wedging
the class list; a `released` mention auto-moving a deadline; the carried subject unbounded;
cross-listed classes matching nothing (`courseCodes` computed and never read); HTML
comments read as text; a per-class 403 signing the whole source out; the author's
inventory and skeleton summary disagreeing; "Use this one" stuck disabled. All 41
(confirmed + split) are in `/tmp/illini-trace-findings.json` for the fix wave, which runs
as four workers by file territory — queue/sync/worker at high effort, Piazza parsing,
grammar + suggestions + popup, author.

## Live: the calendar delete path, and Piazza's first seven suggestions — 2026-09-18 evening

Two more results from Sushi's fresh install, read as evidence (worker rule 7).

**Google Calendar, the delete path:** a deadline ticked done in the popup vanished from
the "Illini Dash" calendar within the minute. Connect, push, and delete have now all run
for real.

**Piazza, the body stage, unprompted:** because the install was fresh, the wave-6 build
ran its first sync with no seen posts, so the body stage read the CS 425 feed in full on
the first pass. The Attention tab showed **"Found in a post (7)"**: MP2 (Sun 27 Sep), a
Google Form (Sun 20 Sep), MP1 Report (Mon 14 Sep), Code Submission Instructions (Sun 13
Sep), and three for the demo sign-up on Fri 11 Sep. What that list says, before any
console line is read:

- **Three of the seven had already passed when they were found** (11, 13, 14 Sep, read on
  the 18th). A suggestion to *add* a deadline that is already over is noise a student
  has to dismiss; the first sync of a busy class will always surface a month of history.
  A mention whose instant precedes the moment it was read should be recorded and skipped,
  not offered.
- **Titles.** One title is a whole sentence with its Markdown intact ("Note that the
  \*\*demo slot (signup) is due by this Friday at 11:59 pm.") — the masking keeps spans
  grounded in the original text, which is right, but a title must never carry the
  markers, and a sentence-length title means the subject rule found nothing and the
  fallback to the post's subject did not fire. "See Demo" and "Google Form" are phrase
  subjects that are technically the object of the verb and useless as a row: when the
  phrase is generic (form, sheet, link, "see …"), the post's subject is the better title,
  and the "from a Piazza post" line should carry the post's subject in every case.
- **HW1 (due 20 Sep, in the running post's body) is not among the seven.** Either it was
  matched to the Gradescope HW1 already in the list and became a zero-distance move (the
  right outcome), or its body was not read. The `[piazza]` console lines decide which;
  asked for.

## The author gets a fresh session per attempt — 2026-09-18 evening

Live evidence, second ECE 411 run on the grounded author: "tried 2 attempts and its last
proposal read no deadlines: An unknown error occurred: kErrorUnknown". Two defects, both
certain from the code: one model session was reused across attempts, so the retry's prompt
(the whole skeleton and inventory again) sat on top of the first exchange in a window the
budget had sized as empty; and a thrown prompt came back as `{ok:false, failed}` with no
`reason`, which the page mapped to "rejected" — the "failed" state and its sentence had
never been reachable from that path. Now every attempt runs in `pristine.clone()` (a
fresh session per attempt where `clone` is missing, logged once), `AuthorOutcome` carries
`kind: "threw" | "rejected"` as a discriminant, `modelOutcomeFor` in core does the mapping
the page used to do, every attempt is logged as `[author] attempt N: …` with the input
usage, and the retry's quoted reason is capped so it cannot push a retry over the window.
**1742 → 1753 tests.** The one that matters restores the live defect and fails.

## Google Calendar sync, live — 2026-09-18 evening

First real push, read as evidence (worker rule 7): with the real `key` and OAuth client id
in the manifest, on a fresh install under `mimgaiaicopabbiabakmknkcbfekplei`, Sushi switched
the sync on, Chrome asked for the googleapis host, Google's consent window named the one
app-created-calendars permission, and the row read **"Pushed 26 events · 05:18 PM"**. No
tenant block, no Testing-mode refusal, no "Connected · nothing pushed yet". Still to see:
the calendar itself in calendar.google.com, and a finished deadline disappearing from it.

**What the ID change cost, and the rule.** Adding `key` to the manifest of an unpacked
extension that is *already loaded* does not change that install's ID: a Reload on the old
card (`ipbd…`) went into a reload loop with an Errors button, and Load unpacked from the
same `dist/` folder created a **second** card under the key's ID. The old card had to be
removed, and its local state (hidden rows, ticks, switches, manual entries) went with it —
a one-time cost that also means the Piazza and Campuswire switches are off again on the
new install. Recorded in `docs/gcal.md` and the dev-loop note in CLAUDE.md.

## Wave 6: Piazza reads whole posts; the author proposes from the page — 2026-09-18

Two workers in parallel; **1659 → 1742 tests.** Pushed to GitHub the same evening (Sushi's
call, so the registry's ECE 411 entries reach his install — confirmed in the popup).

**Piazza, stage 2.** `parsePostBody` reads `result.history[0]` — the newest version; the
new `post-running.json` fixture keeps the *oldest* version too, pasted from last year with
different deadlines, so reading any other version is a pinned wrong answer. `htmlToText`
is in core with no DOM (the worker has none): block tags become line breaks, script and
style go with their contents, entities decode last. Bodies are fetched in one flat pool
across classes (worker rule 9), at most 25 per class per sync, oldest first, with
`lastNr` capped at the batch so a deferred post is never marked read at its snippet. The
signed-out marker is now **positive** — the splash's `form#login-form` with a literal
`action="https://piazza.com/class"` — so "no `const USER`" alone is now `parse_error`,
not `needs_login` (amendment). The grammar's `byDo` trigger gained register / sign up /
respond, which turns the real feed's scorecard from **0 deadlines to 1** (note 42, "Register
Your MP Group by EOD Today 8/31" → one suggestion, 23:59, `timeAssumed`); the other 24
notes are asserted one by one with *which* kind of nothing each is. **Decision, mine:**
"EOD" stays an assumed clock, as `eod-friday.txt` already had it — it is below the
auto-move rung, so a registration deadline is offered rather than applied, which is the
safer side for a phrase whose hour differs by instructor. The row reads "… 25 posts, 1
deadline found" / "… none with a deadline" from an attempt that counted, and stays silent
when none did.

**Known consequence, not yet fixed:** Sushi's first live sync marked all 29 notes seen
with only the snippet read, so the HW1 deadline in the body will not appear until the
upgraded reader re-reads them once — a reader-version bump is the next worker's job,
together with re-reading a post whose newest version is younger than the seen mark (the
"Running Post" is edited weekly).

**The author.** Live evidence: the model answered `#schedule .event` three times on ECE
411, which is the *example* selector in `buildPrompt`'s system text. `skeleton.ts` now
inventories the page's repeated groups (selectors verified against the DOM, with counts);
the inventory goes in the first prompt and every retry, `rows` is an enum of it in the
response schema, and `groundProposal` refuses a proposal naming anything the page lacks
before the runner is paid for — naming what the page *does* have. On ECE 411 the inventory
contains the shipped registry selector character for character. New house rule for the
on-device model in CLAUDE.md; live confirmation from Sushi's machine still owed.

**Also from the wave:** the two workers shared one scratchpad directory and one
overwrote the other's mutation script mid-run (no source affected); prompts now name a
per-branch scratch dir. The privacy policy's Piazza paragraph says full bodies are read.

## Piazza as a polled announcement feed — 2026-09-18

One worker; **1611 → 1659 tests** after the merge with Google Calendar (both touched
the manifest, the store, the options page and every store document; resolved by keeping
both sides, and the privacy form is now eleven blocks). Piazza is not a `Source` and
not in `PLANS`: `core/piazza.ts` is the pure half (class list from the class page's
`const USER`, the feed, the request bodies the live client sends, the response
classifier with the HTTP status first, the plan/apply/describe trio for its row), and
the worker reads the `session_id` cookie, GETs the class page once a day, POSTs one
feed per current-term class, and hands every new note through the same `ingestPost`
path the Campuswire observer uses, inside one `mutate()`. Its Settings row says what an
attempt found, with a Sign in button on `needs_login`.

**Two findings, both about the data rather than the code.** First, `feed.json` was
corrupt as committed: the one-off scrub had replaced the empty string as well as the
names, so every subject and snippet carried `STAFF-36` between every character while
the real text — including the name the scrub existed to remove — survived underneath.
Repaired in place; the class-page capture had the same defect and was repaired the same
day; `post.json` was checked and is clean. Second, **over the real feed the snippet
stage reads nothing**: every date the class states sits past `content_snipet`'s
120-character cut, and the two subjects that carry one say "by EOD Today 8/31", which
the grammar declines. The test asserts zero rather than loosening, and pins the wiring
with a deliberately edited entry (parser rule 10). So Piazza produces no row until the
post-body stage exists; that is the next build, and `post.json` is on main for it.

**Amendments** (docs/piazza-findings.md, rewritten not annotated): discovery reads the
class page's `const USER`, not the `piazza_session` JWT — the feed carries no class
name, so the page is fetched anyway, and a private cookie format would be a second
breakable thing for no gain. And a class's currency comes from `term_key` against the
clock, not from `status`: the spring 2026 class is still `status: "active"` in
September.

**Open:** a positive signed-out marker (needs the logged-out capture); whether "by
EOD <date>" and "register … by <date>" should be due-phrases (affects every source);
the polling rate (four classes ≈ 48 POSTs a day at the default cadence); and whether
the switch should ship before the post-body stage, since "On · 25 posts" would read as
working while producing nothing.

## Campuswire observer, live — 2026-09-18

Sushi's three checkpoints on the real ECE 408 feed, read as evidence (worker rule 7):
the row read **On · nothing read yet** before the page was opened; the worker logged
`[observer] campuswire: registered`; and one open of the feed produced **58** `[posts]`
lines, one per post, of which **14 yielded a suggestion** (one of them two) and one
was skipped as *already suggested* — the seen-post and duplicate-suggestion guards
both fired. **0 moved** on every line, correctly: the class is last spring's, and none
of its assignments is in the list, so there was nothing to move. The Attention tab's
"Found in a post" block is still to be looked at.

Also from the day: the model author on ECE 411 ended on the deterministic "No table on
this page" paragraph with no visible model verdict above it; the options page now logs
`[author] on-device model: {state…}` so the branch can be read from its console. And
the manifest test that pinned `key` absent now accepts the real key's shape instead, so
pasting it (docs/gcal.md) no longer means editing a test.

## Google Calendar sync, opt-in, under the one scope that needs no review — 2026-09-18

Sushi's Cloud console classified `calendar.app.created` as **non-sensitive**, which
retires §1's out-of-scope row — a row whose premise was wrong when written, not stale:
"Calendar scopes are sensitive" is not true of the scope that can only touch calendars
the app itself creates. One worker; **1515 → 1611 tests.**

Four pure modules because the worker gets no decisions: `core/gcal.ts` projects items to
events (finished or hidden rows are *deleted* from the calendar — a Google calendar has no
strikethrough, and a finished deadline still holding a slot was the complaint that started
the day; timed rows as a 15-minute event ending at the deadline; `timeAssumed` rows as
ALL-DAY, never a 23:59 event; a distinct late deadline as a second event; the diff runs on
a content hash so an unchanged item costs no request), `core/gcal-auth.ts` is the state
machine (never, connected, expired, declined, admin_blocked, rate_limited,
calendar_missing, pushing) with one student sentence each — "Connected · nothing pushed
yet" stays grey until a push has written `lastPushAt` (worker rule 2, pinned at both the
auth and health levels), `core/gcal-client.ts` speaks the API (never `events.update`, which
deletes unlisted properties; deletes before inserts; 401 → one cached-token removal and
retry; purge deletes events, then the calendar), `core/gcal-config.ts` holds the one scope
and the placeholders. `chrome.identity.getAuthToken` with a "Chrome Extension" OAuth
client: no client secret, Chrome holds the grant. The push runs after each sync and each
override, taking the queue itself rather than inside the sync's hold (a re-entrant first
section with the rest unqueued is worker rule 4's exact defect, and the worker saw it
coming). Switching the toggle off *is* disconnect — §0 rule 1's new wording promises one
switch. SPEC §0.1, §1 and §8.3 rewritten, not annotated; `docs/gcal.md` has the setup.

Two things are still Sushi's: the manifest `key` (a test asserts it is absent, as a
tripwire) and the OAuth client id. Nothing can talk to Google until both are pasted.

**Also found:** `privacy-practices.txt`'s single-purpose block still claimed the
extension runs no content scripts — false since the Campuswire observer; rewritten.

1611 tests.

## The store documents are measured, not trusted — 2026-09-18

The wave-4 store-copy worker showed a 1455-character justification had sat in a
1000-character field with nothing to say so, and that `manifest.test.ts` accepted a
permission named *anywhere* in listing.md — renaming the `scripting` table row left the
suite green because the pre-submit prose at the bottom still said the word. Fourteen tests
now pin the store documents to what they claim: every numbered block of
`privacy-practices.txt` under the limit its own header states (the limit is read from the
file, never re-typed), the marker count matching the "of 9" the markers print, the
reviewer instructions under 500, the description plain text and under 16000, and every
permission, up-front host and runtime-requested origin with its own table row — the
substring check is rewritten, not duplicated. Each pinned by mutating the document.

1515 tests.

## Wave 4: the grammar reads the posts instructors write — 2026-09-18

Two workers. **1460 → 1501 tests.**

1. **The announcement grammar against the real feed.** Built against sixteen constructed
   posts, `extractDeadlineMentions` read two of the nine real ECE 408 announcements, with
   no subject on either. Six rules, each one documented decision in `core/announce.ts`:
   Markdown markers are *masked* with spaces rather than stripped, so the masked copy is
   the same length as the input and every span still grounds in the original (three posts
   were unreadable only because `**` came first and every pattern is anchored); a clock
   stated beside a relative day beats the invented 23:59 when both name the same day, and
   a disagreement is left alone; four new triggers ("available until", "complete … by",
   "extend the deadline of X to", and an exam sitting read as `kind: "event"` at its start
   clock, not as a due); phrase subjects found in reader order (the trigger's object, a
   badge before it, a capitalised phrase before it, then after the date), carried to a
   following sentence that names none, with the post's title as the subject of last
   resort; a first line with no sentence punctuation followed by a capital is a title, not
   a hard wrap; "the final deadline" is not a deadline for something called *final*. One
   survivor indicted the design rather than the suite (mutation rule 3): the title rule
   was spelled twice, in the sentence boundary and in the title pattern, so loosening
   either was masked by the other — they now come from one pair of constants. Scorecard:
   seven of nine posts yield a deadline (was two), nine of nine mentions carry a subject
   (was none), two automatic moves onto rows the student already has (was none). Still
   open: a bare "exam" cannot join "Exam 2" because §5.2 fuses the badge into one token.
2. **The store's host-permission justification fits its field again.** It had grown to
   1455 characters by accretion against a 1000-character limit the file itself states; it
   is 991 now, every host still named with its reason, and `listing.md`'s table gains the
   two rows it lacked (raw.githubusercontent.com, and Campuswire's opt-in origin). Two
   findings for the tests: nothing measures the character limits, and `manifest.test.ts`
   checks that a permission is mentioned *anywhere* in listing.md, so renaming the
   `scripting` table row left the suite green. And one for this file's own handoff: the
   Test instructions were never written; CLAUDE.md said they were in
   `privacy-practices.txt`, which was false when written and is rewritten.

**Amendment recorded:** §3.2 for announcements — a relative day restated in the same
clause as an explicit calendar date with a clock takes that clock.

1501 tests.

## Wave 3: the Campuswire observer, and the author learns the list page — 2026-09-18

Two workers from the wave-2 merge. **1360 → 1460 tests.** Both built on evidence Sushi
sent the same evening: the rendered DOM of an ECE 408 class feed (now
`fixtures/campuswire/feed-ece408-sp26.html`, trimmed and scrubbed), and a run of Add a
course site on his own machine that printed "Asking the on-device model…" and then the
generic no-table text.

1. **Campuswire is a page observer.** There is nothing to fetch — the page is a shell that
   loads posts with a bearer token — so `src/observers/campuswire.ts`, a self-contained
   content script registered with `chrome.scripting` only after the student switches
   Campuswire on in Settings (the origin is requested inside the click), reads the feed the
   student already has open and sends each announcement to the wave-2 pipeline as
   `post-observed`. The pure half, `src/core/campuswire.ts`, keys posts by their class-local
   **number**, because the live page renders one post in the pinned block, the dated list
   and the hidden glance column and a node-keyed parser would report it three times; one
   number wearing two titles throws (house rule 4). A feed container with no previews
   throws; a missing note-or-question marker throws too, deliberately stricter than the
   brief, because defaulting it either drops every announcement or feeds the grammar every
   classmate's guess. A preview states a date and no clock, so `postedAt` is noon in
   America/Chicago with `extra.timeAssumed` — the one hour a zone step cannot push across a
   day boundary, which matters because "tomorrow" resolves against it. Questions are parsed
   but not sent, behind a flag. The Settings row derives its words from evidence ("On ·
   nothing read yet" until a post reaches the worker — worker rule 2). The capture
   contradicted two of my own fixture notes, both corrected rather than annotated, and
   found one shape no reading would have guessed: `.post-time` collapses to `005/17/26`
   because the like count runs into the date past an empty icon, so the date is read
   end-anchored. `docs/campuswire-findings.md`, the privacy policy and the store copy say
   what is read and what is not.
2. **The on-device author can propose the list-shaped page, and says what it did.** The
   model's proposal is now one of three named shapes — table, list (with `dueLabel`,
   `titleFrom`, `time`) and bare rows — plus `kind` and `filter.exclude`, each validated by
   `validateAdapter` rather than a second copy of its rules; a positional selector is a
   rejection, not only a line in the prompt. The skeleton makes labelled lists peers of
   tables in one budget. `buildAdapter` moved into core as `adapterFromCandidate` because
   the options page's copy wrote `columns` and nothing else, so a validated `dueLabel` was
   dropped on the way to the store — the round trip (propose, validate, build, validate,
   run) is pinned now. The status line is derived in core from a `ModelOutcome`: "proposed
   an entry (N attempts)", "tried N attempts and its last proposal read no deadlines:
   <reason>", or "not available on this computer", with the deterministic search's own
   reason underneath rather than instead. A Kind picker beside the preview lets a syllabus
   page file exams. `?model=ok|fail|absent` makes all three states reachable in the
   harness.

**What the real feed taught the grammar (fixed the same night; see Wave 4 above):** over the nine announcements in
the capture, `extractDeadlineMentions` finds a subject for none of them (so no "move" can
ever resolve and every reading becomes a new suggestion), reads #682's "due tomorrow,
**5/18 at 12:00 PM** (noon) CDT" as an assumed 23:59 (the clock in the same clause is
dropped), and yields nothing at all for seven of the nine, including "extend the final
deadline of CNN project to 11:59pm today" and "due on May 1 … the final deadline is
May 4". The fixtures the grammar was built against were constructed; this is worker rule
7 in its plainest form, and it is wave 4's job.

**Amendments recorded:** Campuswire is a source read from the page, not fetched (§1's
out-of-scope row is retired; §2.3 gains `scripting` and an opt-in `campuswire.com`
origin); §4.5's "those need a hand-written entry" for lists is false since `dueLabel` and
is rewritten in `noCandidateReason`.

1460 tests.

## Wave 2: the editor, the announcement wiring, and five fixes — 2026-09-18

Four workers, same method as wave 1, branched from the wave-1 merge. **1268 → 1360
tests**, typecheck clean, merged with two additive conflicts (both workers had appended
to the same two files).

1. **A student can add, edit and delete their own deadlines in place.** Sushi's ask: *"for
   the day when they click on the timeline, they can drag a box to the specific time and
   it should show up at that time, or they have the option to manually write the time and
   the box should appear at the time, maybe also just a + icon."* `src/ui/editor.ts` is
   DOM only: it collects strings, sends `add/edit-manual-item`, and routes the sentence a
   `ManualItemError` comes back with to the field its wording names. It uses
   `<input type=date>` and `<input type=time>` so no second copy of `manual.ts`'s
   anchored regexes exists. It renders **in flow** in both windows — a floating form in
   the popup contributes no height for Chrome to measure and would put Save past the
   600px edge. The full view's day grid is now always drawn, 8 AM to 10 PM, because the
   axis is where you add (the popup keeps the agenda); `hourRange` widens under a dragged
   or typed time, and `spanMinutes` draws a typed `extra.endAt` — or PrairieTest's own
   "50min" — as a box as tall as the sitting. Drag-to-place: pointer capture, 15-minute
   snap, 4px slop, a dashed ghost labelled "6:00–8:00 PM"; a dragged span opens the form as
   an Event, a press with no drag as a Deadline. Week rows and month cells get a hover "+"
   and click-to-add. Edit and Delete appear in the row menu only for a row whose sole
   member is `manual` (a merged row would rewrite something Gradescope also owns); Delete
   leaves "Deleted … · Undo" in the banner slot for ten seconds. The redraw guard that
   defers a draw under an open menu now also defers under an open editor. Two harness
   defects fell out: the preview's stub and page bundle collided on an identifier (fixed by
   wrapping the stub) and the stub had never sent `courseNames`, so every preview carried a
   false stale-worker banner. Verified twice with real pointer events in the dark preview:
   by the worker (drag, typed times moving the ghost, Escape, Edit/Delete/Undo, typed text
   surviving a sync) and by the orchestrator ("+" opens in flow — the document grew from
   1470 to 1801px — an empty Course is refused with "Say which course this is for." on the
   field, and the saved row appears as "CS 357 · Lab writeup · ME").
2. **What a post says now changes the list, the way Sushi split it.** `core/suggest.ts`
   is one pure `ingestPost` that returns what to add and, in `skipped`, every reason
   something was not applied. A move to a deadline the student already has is written as a
   `dueOverride` on **every member key** of the item (the same shape as hide and done: an
   `Item.id` is a hash of its members and is spent the moment a second source mirrors the
   row); it needs confidence 0.75, so a bare weekday is downgraded to a suggestion; a row
   the student typed is never overwritten; a post is read once by id; a deadline already
   suggested for that day is not suggested twice. `buildItem` treats the override's instant
   as the item's *stated* one — the instructor said it — and records `Item.movedBy`, which
   routes through the existing moved-deadline machinery so the fired 24h/2h leads re-arm
   with no change to `schedule.ts`. An invented 23:59 keeps `timeAssumed` from the post
   through the override into `acceptSuggestion`, which hands `newManualItem` no time at all
   rather than laundering a guess into something the student appears to have typed. The
   store validates `dueOverrides`, `suggestions` and `seenPosts` positively and prunes them
   (60 days for seen posts; 30 days, or a week past due, for suggestions), with `migrate`
   taking `now` so the rule is testable. Four worker handlers wire through `mutate()` and
   the state message carries `suggestions` with `compat.ts`'s entry in the same change.
   The Attention tab opens with "Found in a post" rows with Add and Ignore; a moved row's
   detail reads "moved Sun, Sep 20 → Wed, Sep 23 · from Campuswire post …" with an undo.
   Nothing sends `post-observed` yet — that is the Piazza source and the Campuswire
   observer, which wait on captures.
3. **Wave 1's five defects, closed.** The local-adapter handlers now save the store
   (`withLocalAdapter` / `withoutLocalAdapter` in `core/store.ts`, eight tests, including
   that neither mutates the store it was handed — the shape that let the defect look
   right); `detectCandidates` scopes to `tbody tr` (`rowSelectorForTable`), with the test
   that runs a detected candidate through the real runner and asserts no header item;
   `capture.ts` asks only for https (the third copy of the `.illinois.edu` rule, six days
   behind `safeUrl` and twelve behind `validateAdapter`); `Adapter.kind` is optional,
   validated against the Kind union with `Object.hasOwn` — a deliberately unrealistic test
   value (`kind: "constructor"`) caught `in` accepting prototype names in the first draft —
   and `ece411-fa26-exams` now reaches the Exams tab; `pretest` builds before `npm test`
   so a fresh checkout passes.
4. **Settings groups course sites by course.** One heading per courseCode ("ECE 411 ·
   2 pages") over its pages, each named by the label minus the code and hinted by its
   path; every existing control kept; local adapters gain Remove with a ten-second
   "Removed ECE 411 exams · Undo" (module-level state, because every control refreshes the
   section); the add-site copy mentions the on-device model in one hedged sentence.

**Decisions the workers deferred to Sushi:** whether a personal deadline may have no
course (today "Say which course this is for." is required, and a suggestion with no
course hint is filed under "From a post"); whether "next Friday" on a Friday means +7 (as
built) or +14; whether a post that corrects itself mid-way should take its last mention
rather than its first; whether `project` joins §5.2's numbered prefixes (it would make
`project2` a badge for §5.3, the split-deliverable case `dedupe.ts` already warns about);
whether the capture tool accepting any https URL in `options.html#report=` is acceptable
(the permission prompt remains the real boundary); and that drag-to-place stores a
dragged clock in the campus zone while the grid draws in the browser's zone, which is
pre-existing across the calendar but now writable.

**Still owed by Sushi (one batch):** one press on Hide in the real popup; a Piazza
capture (`user.status` and one feed) plus whether `document.cookie` on piazza.com shows
the session cookie; a Campuswire feed DOM capture; the Cloud console classification of
`calendar.app.created` and the draft item's public key; a run of Add a course site on a
machine where `LanguageModel.availability()` is `available`.

1360 tests.

## Wave 1: seven workers, seven branches, one merge — 2026-09-18

Sushi's instruction for this phase: coding goes to parallel subagents (Opus 5, medium
effort), each in its own worktree with an explicit goal, and the orchestrator merges. Seven
ran at once from `ee4ade2`; every branch passed typecheck and the suite alone, and the
merge passed as a whole: **1023 → 1268 tests.** Each item below was mutation-checked by
its worker (the counts are in the commit messages); survivors were classified and either
tested or documented as unreachable.

1. **Finished work is drawn on the calendar, struck through, instead of vanishing.**
   *"completed assignments from prairielearn don't show up in the calendar."* `visibleItems`
   dropped finished work whose anchor was still ahead, so something handed in at 14:00 and
   due at 23:59 left today's list, and a finished undated row was hidden for good. The drop
   is now an opt-in (`{ dropFinished: true }`) that only the Attention tab asks for; the
   badge and reminders filter for themselves and are unchanged. Two layout rules moved into
   core with tests: `sinkDone` orders finished pills after open ones inside a month cell so
   three struck pills cannot hide the one thing still owed, and `quietDay` keeps a week day
   that holds only finished work at its 22px header. Five tests that pinned the old default
   now quote the decision. Hand-ticked rows are drawn struck too (Sushi's choice).
2. **A partial PrairieLearn score is not "done" (roadmap I37), decided in the parser.**
   Any bar above 0% was `graded`, so a 40% homework with its 80% tier still open vanished
   from the list and lost its reminders. `mapStatus` now returns `graded` only at 100% or
   when no credit tier is still open, and records `extra.scorePercent`; `formatDue` says
   "40% so far" on an open row. The capture has only 0/100/103% bars, so
   `fixtures/prairielearn/assessments-partial-scores.html` is a **constructed** page (its
   README says so). SPEC §4.3 is rewritten in place; the one-shot-quiz false positive is
   recorded in `docs/prairielearn-findings.md` as the chosen direction for the error.
3. **A third page shape for course-site adapters: the `label: value` list.** ECE 411's
   Sphinx site keeps `Due: 9/7` bullets under an `<h3>` per MP, with the label's position
   varying by section, so neither a header table nor a rowspan grid could read it. Three
   optional declarative fields: `dueLabel` (exact match on the text before the colon, the
   remainder to the date parser, the label appended to the title so checkpoints get
   distinct keys), `titleFrom` (`section >> h3`, or the nearest preceding heading) and
   `time` (a clock stated in a sibling bullet, anchored on the word *Time*, start of a
   range; a clock read this way is stated, not assumed). Two page guards throw rather than
   return []. `ece411-fa26-mp` and `ece411-fa26-exams` ship as two entries under one
   courseCode — the general answer to "course sites split across pages". Both fixtures are
   unmodified public captures. Also: `safeUrl` in the popup was a second, stricter copy of
   the `.illinois.edu` rule `validateAdapter` dropped on 2026-09-12, so cs225.org rows
   rendered as unclickable divs; it now accepts any https URL.
4. **An announcement grammar, pure and unwired** (`src/core/announce.ts`). Reads "due Fri
   10/3 at 11:59pm", "extended to Oct 10", "pushed back to Tuesday", "tonight", 24-hour
   times and the rest into mentions whose `span` is provably a substring of the post; a
   bare date is 23:59 with `timeAssumed`; an unreadable date-like phrase comes back as
   `other` with a reason rather than being dropped; `describeEmpty` makes "no dates" and
   "could not read" distinguishable. `resolveMentions` reuses §5.2 to match a subject to an
   existing item. Sixteen constructed posts in `fixtures/announcements/`. Wiring into the
   Piazza source, the Campuswire observer and the attention section is the next wave.
5. **A sixth source, `manual`, without its UI yet.** Manual rows live in
   `store.manualItems`, never in `raw`: §5.4 purges an undated raw row after three syncs in
   which nothing fetched it, and nothing ever fetches a typed one. `dedupeInput` splices the
   two lists at the three places the item list is rebuilt. `RawItem.url` is optional now,
   which found a real defect on the way: `buildItem` took the top-ranked member's URL, so a
   typed row merged with a Gradescope row would have lost the Gradescope link — it now takes
   the highest-ranked member *with* a link. `core/manual.ts` holds every decision (anchored
   date/time regexes, blank time → 23:59 assumed, https-only link, `endAt` after start,
   opaque `randomUUID` id that editing keeps) and refuses with a student-readable sentence
   rather than a `ParseError`. Health excludes the source everywhere via `isFetchedSource`.
   Delete prunes override keys through `withoutKeys`, which `applyRetention` now shares.
6. **Six procedures became project skills** under `.claude/skills/` (mutation-check,
   capture-ask, new-adapter, trace-symptom, beta-triage, popup-verify), each quoting the
   rules from this file and CLAUDE.md rather than paraphrasing them; `docs/dev-loop.md`
   indexes them and explains Graphify and Ponytail.
7. **Add a course site can ask Chrome's on-device model when the search finds nothing.**
   `core/skeleton.ts` renders a page compactly inside the model's context budget (each
   table gets an equal share — in document order, ECE 310's homework table, last on its
   page, was the one that fell off); `core/author.ts` owns the schema (row selector and
   column *headers* only — never a date, never a positional selector), the prompt, the
   validator (the real runner over the real DOM: ≥1 row, ≥50% dated, no unparsed tails) and
   a retry loop that feeds the rejection back, capped at three. The options page uses it
   only when `LanguageModel.availability()` is `available`; otherwise the page reads exactly
   as before. Nothing has run against a real model yet — one round trip on a qualifying
   machine is the evidence.

**Defects found by the workers, outside their own goals, not yet fixed:**

- `background.ts` `add-local-adapter` and `remove-local-adapter` mutate the loaded store
  and never call `saveStore`, so adding or removing a course site is lost when the worker
  reloads. Two lines each. (Found while mapping the manual source; the adapter section
  was another worker's.)
- `detect.ts` proposes `<table> tr`, which matches the header row too; run through the
  real runner that yields an undated "Exercises" item the preview never showed. The
  hand-written entry and the model author both use `tbody tr`.
- `capture.ts` is a third copy of the `.illinois.edu` host rule that `validateAdapter` and
  `safeUrl` no longer apply: a student can add a cs225.org adapter but cannot capture the
  page to build it from.
- `runAdapter` hard-codes `kind: "assignment"`, so ECE 411's midterms are labelled
  assignments; an adapter-level `kind` is the missing field.
- `npm test` in a fresh checkout fails one test until `npm run build` has produced
  `dist/adapters/registry.json`.

**Amendments recorded this day:** §4.3 (partial score, above); §4.5 (three new adapter
fields, `docs/adapters.md`); §3.1/§3 (`manual` source keyed by an opaque id, `RawItem.url`
optional); §3.2 for announcements only (an instructor never states a deadline in a previous
year, so a weekday-preferring year inference that lands before the post is refused).

**Decisions Sushi took, driving all of this:** finished work struck through, including
hand-ticked; the model only at adapter-authoring time and for pasted or observed text;
Piazza as a background source, Campuswire as a page observer, Discord not yet; moves to
known items auto-apply, new deadlines are suggestions; Google Calendar after the bugs and
manual entries, opt-in.

1268 tests.

## The menu received every press; a microtask threw it away — 2026-09-18

Five rounds and a probe had concluded that not even `pointerdown` reached the menu. It
did. `trapMenuKeys` closed the menu from a `focusout` handler via `queueMicrotask`, and a
real mousedown on "Hide" fires `focusout` *before* `document.activeElement` moves to the
pressed button — so the microtask saw `<body>` and removed the menu between mousedown and
mouseup, and no `click` ever fired. The probe read "waiting for a press…" because it was
a fresh menu, opened after the first one had been destroyed under the pointer.

Three facts had been pointing at it all along: the health popover uses the same code and
always worked (it has no `.menu-item` for `focusAt(0)` to focus, so focus never enters
it); Enter worked (focus never leaves); and no harness fires a real focus change, so every
harness passed. The fix reads `event.relatedTarget` and, when there is none, waits one
task. Two smaller defects on the same path went with it: the popup's own open-sync called
`refresh()` with no menu guard (the three guarded callers were not the ones that fired
most), and the `scroll` listener in capture on `window` closed a menu that was scrolling
itself. A redraw that finds a menu open is now deferred and runs when it closes, rather
than being skipped or tearing the menu down. `closeMenus` clears `aria-expanded`, and the
TEMPORARY probe is gone.

Proven the only way it could be: real pointer events in the preview document, dark mode,
the menu held open across the stubbed sync landing, then "Hide" and a "Merge with…"
candidate each logging `… requested for …` from the click handler. Confirmed by Sushi in the real popup
the same evening: "hide works."

Also this day: Graphify is installed (`graphify-out/`, `.claude/skills/graphify`),
Ponytail is vendored (`.claude/skills/ponytail`, subordinate to this file), and the
2026-09-18 design decisions are recorded in the plan file until they land here with
their work.

1023 tests.

## UI reference refresh — 2026-09-11
- Updated light/navy surfaces, orange selected tabs and today marker, rounded course
  filters, sync toolbar, and full-width framed calendar with larger date navigation.
  No Illinois logo, building, or slogans. Existing calendar behavior is unchanged.
- Verified dark and light month previews and dark compact popup using the real popup
  document with canned data. Build, typecheck, and all 831 tests pass.
- G4/G5 remain pending. Native Chrome popup sizing still requires Sushi's extension
  reload; no body/html scroll container or popup width media query was added.

## UX plan for the store release — 2026-09-11
- Reviewed every surface in the real popup document (dark first), the full view and
  Settings; six "before" captures in `docs/ux/before/`. Findings and a seven-phase plan in
  [ux-plan.md](docs/ux-plan.md): three blockers (a sat exam counted as Overdue, the
  first-run primary button invisible in dark, white on the orange accent at 3.0:1), then
  the popup's 322px of chrome, a component system, Settings, first run, notifications and
  store assets. Five decisions for Sushi are listed in its §7.
- Nothing in the extension changed. G4/G5 unchanged.

## The one source with no login page — 2026-09-12

*"For reading the cs424 website it just says sign in needed but it doesnt link me to the
sign in page."*

`LOGIN_URL` has no entry for `site`, and the comment saying why is correct: *"a course
website is whatever host the adapter points at, and there is no single page to open."*
True in general — and the reason the one source a student cannot guess the address of was
also the one with nothing to press.

But the page **is** known, at the moment the logout is detected: it is the adapter URL
that just answered 401. `syncOneSource` records it (`SourceStatus.loginUrl`), and
`actionFor` falls back to it when there is no fixed form. For a Shibboleth-protected
course page that URL is both the sign-in trigger and the destination — the student lands
on the schedule rather than on a login form and then nowhere. The **requested** URL, not
`finalUrl`: `finalUrl` is the middle of a SAML handshake.

Chasing it found the real shape of the bug. **Four surfaces were each deciding what a
sign-in link is**, all by reading `LOGIN_URL[source]` for themselves: the first-run
checklist, the popover row, the empty state and the stale banner. One decision in four
places, wrong in all four for the same source. They go through one `signInUrl` now. One of
them had its own defect alongside: the button counted the sources and *then* skipped the
ones with no URL, so "Open all 5 sign-in pages" could open four and say nothing about the
fifth.

Two things about the mutation pass. `loginUrl: err.page.finalUrl` **survived**, because
the 401 fixture answers in place — `url === finalUrl` there, so it cannot tell them apart.
The assertion moved to the Shibboleth fixture, which is the only one where they differ
(parser rule 10: where a realistic fixture cannot distinguish a wrong implementation, use
the one that can). And the harness could not reach the state at all until `?fail=sitelogin`
existed, which is the same finding as every previous live defect.

**And the preview stated a version that does not exist.** `getManifest` was stubbed
`0.1.0` while the manifest said `1.0.0`, so every Settings capture — and
`docs/ux/after/options*.png` are candidates for the store listing — showed a version
nobody could install. It is defined in from `public/manifest.json` at bundle time now: a
harness that asserts a fact about the build has to read it from the build.

`node scripts/shots.mjs <name>` already filtered; using it turned a twelve-minute
iteration into thirty seconds.

973 tests, 38 shots.

## Handed off with the menu bug unsolved — 2026-09-13

The probe answered, and the answer eliminates almost everything: pressing Hide leaves it
reading "waiting for a press…", so **not even `pointerdown` in capture on the menu
element** arrives. The press is not landing on the menu. Every fix made today was
downstream of that.

Those fixes are real and none of them was the cause: four correction handlers with no
`.catch`, a worker that swallowed every error unlogged, three redraw guards that matched
nothing, a menu that opened below the fold in week, month pills with no menu at all, and a
status line that reported failures below the fold of a 1100px document. Six silent channels,
uncovered one at a time, none of them the bug — which is its own finding about how this
popup was built.

The full handoff is in CLAUDE.md: the ruled-out table with the evidence for each, so the
next session does not repeat five rounds of it, and the three things worth trying first —
whether two `.menu-surface` elements exist at once (the health popover shares the class),
whether the visible menu is still connected when pressed, and what
`document.elementFromPoint()` returns under the pointer. The last is one line.

The temporary probe in `openRowMenu` is marked TEMPORARY and should come out with the fix.

1023 tests, and the build in `dist/` carries the probe.

## Four rounds with no evidence, so the control says it itself — 2026-09-13

Still not found. What is fixed so far is real and none of it is confirmed to be *the* one:
four correction handlers with no `.catch` at all, a worker that swallowed every error
without logging, three redraw guards that matched nothing, and a menu that opened below the
fold in week.

**The reason four rounds produced no evidence is that every channel that could have carried
it was somewhere nobody was looking.** The popup's console — not the worker's, which is the
one people open, and the only one that has been pasted. A status line that rendered below
the fold of a 1100px document. An unhandled rejection that reached neither. Each fix
uncovered the next silent layer rather than the cause.

An attempted reproduction with real mouse events was **invalid and nearly reported as a
finding**: the preview pane renders that page offset from its own coordinate frame, so the
click landed in dead space and "the menu never opened" was an artifact of clicking nothing.
The earlier harness checks have the opposite flaw — a synthetic `.click()` fires no
mousedown and moves no focus, so neither kind of probe here reproduces a real press.

So the pressed control reports for itself: **"Hide" becomes "Applying…"** and the rest of
the menu greys out, before anything can go wrong. It is feedback and a diagnostic at once —
a correction is a round trip to the service worker and it was always wrong for that to look
instantaneous — and if that word never appears, the click handler never ran, which is a
different bug from any investigated so far and says so with no console at all.

1023 tests.

## Three dead guards, and an error nobody could see — 2026-09-12

*"Hide still doesn't work, none of the options for week work at all."*

The flip fixed a real thing and not this one. "None of them work" is a different failure
from "I can't reach them", and it took two defects together.

**1. Three redraw guards asked for `.menu`, and a menu's class is `menu-surface`.** A class
selector matches whole tokens, so `.menu` matched **nothing** — the storage listener, the
session listener and the minute tick were all unguarded from the day they were written.
Each redraw calls `closeMenus`, which removes the open panel. And a `click` only fires when
mousedown and mouseup land on the same element, so a menu deleted between them **swallows
the press entirely**: nothing happens, and nothing says why.

The popup starts a sync the moment it opens, which is exactly when a student is reaching
for a row. Proven rather than argued: with the old guard an open menu does not survive a
store write, with the fix it does — checked both ways in the real popup document.

Now one `MENU_SELECTOR`, with the class derived from it. A constant rather than a test: a
test has to know the right answer, and this makes the wrong answer unspellable.

**2. And when an override did fail, it said so where nobody could look.**
`reportOverride` writes to `#status`, which sits at the **bottom of the document** — fine
on a short list, invisible on a long one. The week view is ~1100px of document in a 600px
window, so every failure it reported landed hundreds of pixels below the fold. That is this
project's own worst-ranked outcome, a silent failure, produced by the one control written
to prevent it. It scrolls itself into view now; not a fixed overlay, because the message can
run to two lines and pinning it would cover the rows it is about.

**Why week and not day, again.** Same reason as the menu flip: week is the tallest view
there is, so it is furthest from both the status line and from having room below a row.
Every one of these has been a height problem wearing a different costume.

1023 tests.

## Found it: the menu opened below the fold — 2026-09-12

*"For week, hide doesn't work. Merge doesn't work either. And for month, there's none of
those options."*

Two views named, and that is what made it findable. Reproduced in a 400x600 iframe of the
real popup: **the menu for the last week row opened at y=561 and ended at y=711.**

`placeFloating` only ever opened downward, and its floor made that worse — offered 31
pixels of room it refused to shrink below 140 and then ran off the bottom anyway. Nothing
downstream can rescue that: `MAX_POPUP_HEIGHT` is Chrome's own cap, so growing the document
cannot reveal what is past it, and a `position: fixed` panel does not scroll into view.

**Week hits it and day does not, for a structural reason.** Week is the tallest list there
is — seven day rows, 1113px of document in a 600px window — so its rows sit low far more
often. And **Hide and Merge are the third and fourth of five menu items**: the student sees
the menu open, sees the top of it, and the two entries they wanted are the ones past the
edge. "It opens but the thing I want isn't there" reads exactly as "hide doesn't work".

It flips above the anchor when there is no room below. Ties go downward, because that is
where a menu is expected and flipping for a few pixels makes a control feel unpredictable.
Verified across all 17 week rows: nothing off-screen, Hide and Merge reachable on every one.

**The month had no menu at all**, which was not a bug so much as an omission — Mark done,
Hide, Split and Merge were unreachable there, and so was the keyboard, because a pill was a
`div` with a click handler and no role. A `⋯` of its own does not fit: a cell holds three
pills and each is a course code plus a title in a seventh of the window, so a control beside
that takes the characters that say *which* assignment this is.

So the pill **is** the control. It costs one click on the open path rather than removing it
— `openRowMenu` leads with "Open in Gradescope", the same destination the click used to go
to directly — and that trade reads the right way round for a month, which is the view you
plan in rather than work from. Pills join the roving tabindex too; `rowsInView` matched
`a.row` only, so ↑ ↓ did nothing in the month.

All 23 pills verified: menu opens, nothing off-screen, Hide reachable.

1023 tests.

## "Hiding an event doesn't work on the calendar" — audited, not found — 2026-09-12

**I did not find this one, and I am recording that rather than a fix.**

Traced the whole path: the menu sends `{kind: "hide", itemId}`, `applyOverride` resolves the
id and stores **memberKeys** (not the id — §3's amendment, because an id is a hash of the
member set and a hide keyed by it is spent the moment the row merges with anything), and
`mutate` re-runs `dedupe` in the same step so `hidden` is live immediately rather than at
the next sync. Every live consumer filters it: `visibleItems` for all four views,
`groupItems` for the toolbar badge, §7 for reminders, `examBoard` for the exam tab.

What the audit *did* find is a latent hazard. `dayContents`, `weekContents`, `monthCells`
and `attentionGroups` were correct **by convention rather than by construction** — each
returns a hidden row happily when handed an unfiltered list, and the popup is correct only
because it pipes everything through `visibleItems` first. That fails silently, in one view,
to a student looking at a thing they have already asked to remove. Closed: the flag is now
filtered by each of them, and a test asserts it for every view.

**And one real mechanism worth naming, which may be the report.** A course-site row's
`sourceId` is `${adapterId}:${hash(title + date)}` — content-derived, because §3.1 says
course sites have no ids. So **any change to a site row's title or date mints a new key and
the hide stops applying**. Today's 23:59 → 18:00 fix changes the date of every ECE 391 row,
which will un-hide anything hidden there. Documented in §3.1 and accepted, but it is
indistinguishable from "hiding doesn't work" and nothing on screen says so.

To settle it: which view, and does the row vanish and come back, or never vanish at all?

1023 tests.

## First beta report: three things, one of them a bug — 2026-09-12

*"The course website thing is slightly buggy, for example it's not reading the ece 391 page
that well. It also seems like it's not reading where the exam dates might be on a course
syllabus rather than an assignment or module. But if it's a module or an assignment on
canvas gradescope or prairielearn/test it's working really good."*

ECE 391's site is public, so this cost the tester nothing more to diagnose. Three findings,
and only the third is a defect:

1. **The adapter was reading a page with no deadlines on it.** The course's landing page
   has exactly two tables and the first is *instructor office hours* — so `table tr` matched
   it and produced nothing useful. The deadlines are on `schedule.html`, mixed in with
   lectures and discussion sections; `assignments.html` has **zero** tables and is prose.

2. **The exams are genuinely not there.** `exams.html` says "Time and location to be
   determined" for all three. There is nothing to read, and the extension showed nothing,
   which is right — **but the tester could not tell that apart from a failure**, and that
   is a real finding about the UI rather than about ECE 391.

3. **Every deadline landed six hours late.** This is the bug. `schedule.html` prints
   `Fri, Aug 28 | MP0 due at 18:00 US Central time` — the date in one cell, the time in the
   other, inside the title. The date cell parses cleanly and states no time, so
   `timeAssumed` fired and the row went to 23:59. **A two-hour reminder for it would have
   arrived at 21:59, nearly four hours after the deadline passed.** Worker rule 3 in its
   sharpest form: the value was not merely invented, it was invented *next to the real one*.

`statedTimeInText` reads a cutoff the row states in prose, anchored on the word that makes
it a deadline — a schedule row is full of times, and only the one attached to "due" is this
row's. The date cell still wins where it states a time, and an ambiguous bare `5:00` is
still refused, because guessing would move a 5 PM deadline twelve hours.

A guard written alongside it **survived its mutation and was deleted**: the `stated ?`
ternaries already reject exactly what it rejected. Three other survivors were the opposite
case — untested, because every row in the ECE 391 fixture says "due at 18:00", so
precedence, ambiguity and the anchoring could not be exercised by it at all. Those got
constructed tests that say they are constructed.

`ece391-fa26` is in the bundled registry now, pointed at `schedule.html` with a due filter.

**Still open:** an adapter is one fixed URL, and this course splits its work across
`schedule.html` and `exams.html`. A course whose exams live on a different page can only
ever be half-read — which is the general form of the tester's second point, and it needs a
decision rather than a patch.

1020 tests.

## Renaming a course, and the two cases that are not the same — 2026-09-12

**`CS 498DK2` needed no rename and still does not.** Sushi: *"idk if u can just eliminate
the dk2 because that's part of the course name."* Right — CS 498 is the special-topics
number and `DK2` is what says *which* class it is, so the identity is the whole string.
§5.1 declines it, the raw name falls through untouched, and that is the correct outcome.
The opposite case, `stat_425_120248_268442`, is a machine slug with the code inside it,
which is why extraction handles that one and must not touch this one. The only thing wrong
with `CS 498DK2` was that its space made it look inconsistent beside `CS421`, and that was
a formatting bug, not a naming one.

**So the rename is for the third case**: names no rule can derive and no formatting can
rescue — a Gradescope course an instructor called "Section AL1", a cross-listing the
student thinks of by the other number. It is deliberately the *last* resort. A student
should never have to type `STAT 425` for a label the slug already contains; that was a
parser defect wearing a feature's clothes, and it is fixed.

`overrides.courseNames` is the first override that stores **text the student typed**, and
it is rendered into the calendar, the filter strip and Settings. So:

- **An empty name is not a name.** `renameCourse` *deletes* on empty rather than storing
  `""`, because clearing the box is how a student gets the derived label back — and a
  blank label is invisible, so storing one would make the course vanish from the filter
  strip and its rows lose their chip, with nothing left on screen to click to undo it.
  `migrateOverrides` refuses to store one and `courseLabel` refuses to trust one anyway:
  the store is data from a previous build, and that build may not have had the rule
  (worker rule 8).
- **Capped at 60 characters.** A 4000-character name is not a name.
- **One resolver.** Four surfaces draw a course label, and a rename the calendar honours
  while the filter strip ignores is worse than no rename — the student then has two names
  for one course and no way to tell which is which.

`courseNames` joined `items` and `sources` in `POPUP_STATE_FIELDS`, because every row looks
a course up in it: an older worker's message would throw once per row rather than once.
Four compat tests failed on the new field, which is exactly what those tests are for.

1012 tests.

## Two paths to a course label, disagreeing about one space — 2026-09-12

*"There's a space between CS 498DK2 but not between CS421."* Both in the same row of
filter chips.

They are not the same path. §5.1 joins its two captures directly, so every code it
**recognises** arrives as `CS421`. A name it **cannot** read falls through untouched, so
`CS 498DK2` keeps whatever spacing its source gave it — and the regex declines that one,
because `\d{3}[A-Z]?` has no room for a `DK2` suffix. Recognition decided the typography,
which is not a thing recognition should decide.

`displayCourseLabel` puts the space back, and it is **display only**. The stored
`courseLabel` is a grouping key — it decides colour, filtering, and which rows are one
course — so reformatting it would split every course in the store from its own history
until the next sync. Four surfaces render a label (row chip, filter chip, month pill,
Settings) and all four go through it, rather than four places each deciding.

Anything that is not a bare code is returned exactly as found. There is no rule that
improves arbitrary text and several that damage it.

1003 tests.

## A course site on its own domain, and a slug where a course name should be — 2026-09-12

**cs124.org could not be added at all.** §2.3 declared `https://*.illinois.edu/*` as the
only optional host permission, reasoning that *"course sites live on many subdomains
(courses.grainger.illinois.edu, courses.engr.illinois.edu, cs.illinois.edu, …)"*. That was
not stale — it was **incomplete when written**. The CS department's course sites are their
own domains: cs124.org, cs128.org, cs225.org. The rule excluded precisely the students most
likely to want the feature.

Widened to every https host, **optional only**, Sushi's decision. It is safe because of a
rule that already existed: `validateAdapter` requires an adapter's `hostPattern` to name
its own host *exactly*, so a registry entry can never request more than the one site it
describes and the student sees that host in Chrome's own prompt. Widening the declaration
does not widen what any single adapter can ask for.

Widening it did expose one hole the exact-pattern rule cannot cover: **an adapter naming a
host the extension already holds**. Those need no permission prompt, so enabling one would
prompt for nothing, grant nothing, and then read arbitrary Canvas or Gradescope pages under
a permission granted at install for something else. Refused now, derived from the source
modules so a sixth source cannot be added without this list learning about it.

**And a Gradescope course was labelled `stat_425_120248_268442`**, overflowing its 60px
chip and painting on top of "homework 2 (UG)". Two defects in one screenshot:

1. **The chip did not clip.** A grid item does not clip to its track, and `.chip` had no
   `max-width`. Ellipsis rather than a wider track: the track is 60px because the title
   needs the rest, and one oddly-named course must not re-columnise every row.
2. **§5.1 declined the slug**, so the raw string became the label. `canvas-findings.md`
   recorded declining it as correct, **and it was — for Canvas**, which carries a
   human-readable `name` beside the slug and was amended to read that. Gradescope has no
   such field. The amendment was applied to one source and the finding it came from applied
   to two.

`\b` could not express the fix: an underscore **is** a word character, so there is no
boundary between `425` and the `_` after it. Both ends are explicit lookarounds now.

**The test was pinning the defect** (worker rule 6): `tests/gradescope.test.ts` asserted
that course 1273605 yields *no* code — and that course is `ece_408_120261_257494`, which
is ECE 408, a real course a real student is enrolled in. And `extractCourseCodes` had no
direct test at all until now, which is how one assertion inside a parser suite came to
define what every row on the calendar is called.

One mutation survived: `\b` at the *head* of the pattern, because every slug in every
fixture starts the string. A term-prefixed one (`fa26_stat_425_…`) reaches it, and no
capture in this repo has one — so the test says in as many words that the value is
invented (parser rule 10, house rule 12's form).

**Still open, and Sushi's call:** a course whose name contains no code at all still shows
its raw name. A manual rename would fix that, and is the right shape for names no rule can
derive — but it should stay the fallback, not the first answer: a student should not have
to type `STAT 425` for a label the slug already contains.

1000 tests.

## The debounce asked the wrong question — 2026-09-12

Sushi, diagnosing it exactly: *"When I go to the popup it checks. Then when I sign in and
come back within 10s, it doesn't check again cuz it's within the 10s time, so I have to
wait until that 10s period is over then come back to the popup for it to check."*

Right, and it is my error rather than a tuning problem. `RECHECK_AFTER_MS` asked **how long
has it been**. The question is **has anything happened**. Signing in is evidence; idle
tab-switching is not; a clock cannot tell them apart — so the debounce suppressed precisely
the case it exists to serve, and it suppressed the *navigation-triggered* sync too, which
is why the new listener did not rescue it either.

The worker records when a page last finished loading on each source's own site
(`storage.session`, since a navigation from a previous browser session says nothing about
this one's cookies), and `sourcesToRecheck` treats a navigation newer than the last attempt
as overriding the window entirely. Both the worker and the popup read the same map, or the
two would disagree about whether an attempt is stale — which is the ten seconds all over
again, one process apart.

**Self-limiting without a second timer**: once the re-check runs, `lastAttemptAt` is newer
than the navigation and the clause stops firing until the next page load. That is the
property worth keeping; a timer would have needed one more number to get wrong.

One mutation survived — `>` against `>=` on the tie — and it was a real undecided case
rather than an untested one. `lastAttemptAt` is stamped when the sync *starts*, so a
navigation on the same millisecond may or may not have been seen by the fetch, and **the
two mistakes are not equal**: an unnecessary re-check costs one request, a skipped one
costs the student half an hour of "Sign in needed" while signed in. Decided for `>=`, and
pinned.

988 tests.

## A screen that could not say "checking" — 2026-09-12

A screenshot: a fully signed-in Gradescope Course Dashboard, with the first-run screen on
top of it reading **Sign in needed**. *"Either there's a really long delay or it's waiting
on something to trigger the sync."*

**Both readings were available because the screen offered no third one.** The store is
written once, at the end of a sync, so for the five to ten seconds one takes, every row
asserts the *previous* answer with nothing to say it is being re-read. The header pill has
said "Checking…" throughout — and the first-run screen has no pill, which is exactly why
it needed its own word.

Two things were missing, not one:

1. **A sync this page started** set `syncing`, but nothing redrew until it finished, so
   the rows never showed it. `runSync` now redraws the checklist at the *start*.
2. **A sync the page did not start** was invisible entirely — and that is now the common
   case, because the navigation listener fires while the student is on Gradescope. The
   worker publishes an in-flight flag in `chrome.storage.session`, which is exactly the
   right lifetime: true for the life of the worker, meaningless after it, and a crashed
   worker cannot leave a window spinning on a flag written to disk.

**And the "Sign in needed" chip now carries what the site actually answered.** The two
error states had that tooltip and the one people get stuck on did not — which is the
difference between *the cookie is not reaching us* and *the page says something we
misread*, and nothing else on that screen can tell those apart.

The harness could not reach the state, again and for the same reason: its `storage.session`
stub answered `{}` forever, so "a sync is running" was unreachable by construction. It
keeps a real store now and the sync stub publishes the flag the way the worker does.
`?setup=1&slow=4000` shows every enabled row reading "Checking…" mid-sync and settling
after.

**This is a visibility fix, and it may not be the whole report.** If Gradescope still says
"Sign in needed" after a sync visibly completes, the tooltip now names the page that was
served, and `[sync]` carries the status, final URL and first 120 characters. The marker is
`js-logInButton`, documented as absent from the real signed-in dashboard capture — so a
house-rule-12 misfire is *not* the leading hypothesis, and the leading one is that the
session cookie is not reaching a service-worker fetch. Both are decided by the same line.

982 tests.

## The signal we never had: a page finishing on the site itself — 2026-09-12

*"Gradescope and prairietest dont sync until i click on smth in them after signing in."*

**The click was not completing the session. It was producing the trip back.** Every login
defect in this project has come through the same hole: the only thing that ever prompted a
re-check was the student *returning to the popup*. Sign in, stay on Gradescope, and
nothing happens; click around, wander back, and it works — which reads as "clicking fixes
it" and is really "looking at us fixes it".

Chrome does have the event, and it needs **no new permission**: `tabs.onUpdated` reveals a
tab's URL only to an extension that already holds a host permission for it. That is
exactly the five sites the student switched on — not history, not other tabs, and not the
SSO hosts in between, which is also why the *final* landing is the right moment to act on.

It fires on **every** completed navigation rather than only the first, and that is what
makes it correct whichever way the session actually settles: if the cookie is live at the
redirect we catch it there, and if the site needs one more click we catch that too. So it
does not depend on my being right about *why* Gradescope and PrairieTest lagged — which
matters, because I am not certain. Those two are the only sources whose signed-out
detection reads a body marker rather than a status code (house rule 11), so a transitional
page is a live hypothesis, and the `[sync]` line now carries the status, final URL and
first 120 characters of whatever was served.

`sourcesToRecheck` is what keeps this from being a fetch per page view: it answers only
for a source *currently* waiting on a login, and it holds the debounce.

`core/origins.ts` matches hostnames **in full**. `endsWith` would accept
`evilwww.gradescope.com`, and the consequence is not cosmetic — this function decides
whether a page finishing in any tab makes the extension go and fetch. The mutation
**survived** the first suite, because the hosts I had reached for (`notgradescope.com`,
`www.gradescope.com.evil.test`) do not end with `www.gradescope.com` and so pass a suffix
match too. House rule 12 in its most literal form: the adversarial case has to be built on
purpose, and a plausible-looking one is not it.

**The privacy policy now says this**, and is republished. No permission changed and no new
data is read, but "it notices when a page on one of those sites finishes loading in a tab"
is a true sentence about the extension that was not in the document, and the policy is the
one place that has to be complete rather than merely accurate.

982 tests.

## The sync took the sum of its sources — 2026-09-12

*"There's a delay when I log into gradescope, prairielearn and prairietest and on the sign
in screen it says they're not connected. It takes some time, maybe it gets hung."*

It was hung, in the sense that mattered. The loop **awaited each source in turn**, so a
sync cost the sum of its sources rather than the slowest one. With `REQUEST_TIMEOUT_MS` at
20 seconds and six sources, one site sitting on a request delays every source queued
behind it — and because the store is written **once**, at the end
(`background.ts:287`), the screen shows the pre-sync answer for the entire wait. Three
sources reading "not connected" while they are in fact being read is not a cosmetic
problem; it is the screen asserting something false.

Every source that is going to be read now starts before any of them is awaited. The
decision of *whether* to read still happens first, so §6's backoff is not quietly
defeated, and outcomes are still applied in `PLANS` order, so the store does not depend on
which host answered first.

**Safe because the fetches were already concurrent one level down.**
`MAX_CONCURRENT_PER_HOST` runs four requests per source at a time, so the offscreen parser
has always had several parses in flight; different sources are different hosts, so nothing
here shares a rate limit either. This is the one argument that makes the change small
rather than frightening.

The test asserts the property rather than the clock: **every source has begun fetching
before any of them has finished**, using a gate that records who asked and resolves
nothing until released. A wall-clock assertion would measure the machine and flake.
Mutated back to sequential: killed. Mutated to start a backed-off source: killed.

**And the `[sync]` line now carries a duration** — `prairielearn: ok (12 items, 9
requests, 8.4s)`. "The sync feels slow" is not actionable; "one source sat for 20.0s" and
"one source made nine requests" want opposite fixes and now say which. Worker rule 5: add
the line rather than spend another round trip in Sushi's browser. A resting source prints
no duration, because "0.0s" would read as "answered instantly" when it means "was never
asked".

## Export moved to the bar, and it cost thirteen pixels — 2026-09-12

*"There should be a calendar icon in the popup/full screen view at the top right directly
instead of having to go into settings each time to download a .ics."*

It lived under **Data & privacy**, which is where you go to understand what the extension
stores — not where you go to put this week in your calendar. It is an icon in the bar now,
in both windows, and `src/ui/download.ts` holds the one answer to "which items go in the
file" that Settings and the bar now share. Two copies of that filter is how one surface
ends up exporting hidden rows and the other does not.

**The popup is 400px and the sixth control cost the sentence.** Measured, not guessed:
"Gradescope didn't answer" went **13px** over and ellipsed. The pill is the only thing in
that bar that can shrink, and it is the thing that says what is wrong, so the 13 came back
off the fixed costs instead — two pixels from each of four icons (26 → 24), two from the
bar's padding, one from the pill's. All five pill sentences measure unclipped at
`bodyW: 400`.

**The full view's buttons were borrowing the popup's answer.** 28px in a 1280px bar made
the only three controls up there read as an afterthought. 34px, with 18px glyphs — still
smaller than the tab strip below, which is where the eye should land first.

**On making the .ics sync itself:** it cannot, and the reason is architectural rather than
effort. A calendar that updates itself is a *subscription* — a URL the calendar app polls
on its own schedule — and that needs a server. This extension has none, deliberately, and
the published privacy policy says so in as many words: "There is no server, no account, no
analytics, no telemetry." The button's status line says "a one-time copy, not a
subscription" for that reason. The nearest real alternative is **Add to Google Calendar**,
already on each row's `⋯` menu, which hands one deadline to a calendar that does sync.

975 tests.

## Still open — PrairieLearn and PrairieTest "have a delay to show connected"

Reported on the same run and **not diagnosed**. What the code establishes: the sync loop
is sequential over sources and the store is written **once**, after all of them
(`background.ts:287`). So within one sync no source can turn Connected before another —
they flip together. That leaves two candidates, wanting opposite fixes:

- they are genuinely the slowest (PrairieLearn fetches course instances, then an
  assessment list per course), and the whole sync waits on them; or
- a sync **skipped** them — a non-manual trigger skips sources in backoff
  (`sync.ts:581`), which would park them for up to half an hour after one early failure.

The `[sync] <source>: <state> (N items, R requests)` line distinguishes these in one
reading, and Sushi has been asked for it.

## Clean-profile run: signing in changed nothing until you pressed Sync — 2026-09-12

The first thing the clean-profile walk found, and it is the first five minutes of
every beta tester's install. Sushi: *"when I signed in, it didn't update the status
automatically... I signed into all of them and it still said not signed in, so I clicked
on show calendar anyway, and it still said not signed in. Only after I clicked the sync
button everything synced up."*

`beta-install.md` has been promising **"come back and the dot clears itself"** since the
guide was written. Nothing did it.

**`needs_login` is the only state whose fix happens where the extension cannot see it.**
Every other failure resolves on our own schedule — a network error clears when the site
answers, a parse error clears when we ship a selector. A login is fixed in a different
tab, on a different origin, by a form we never touch, and *no event crosses back*. So it
is the one state that has to be re-checked on the student's **return** rather than on the
poll, and it was the one state nothing re-checked.

The popup did have a `visibilitychange` listener. It called `refresh()`, which reads the
store and redraws — and the store still held the pre-login answer, because nothing had
fetched. A redraw of a stale fact is indistinguishable from a fact.

Two more layers were hiding underneath, and both are judgements that signing in
invalidates:

- the sync fired on popup open is `trigger: "popup"`, **debounced to five minutes**;
- a source that has failed a few times is **in backoff**, which every trigger except
  `manual` skips.

Both are correct reasoning about a source that has not changed. Signing in is exactly the
event that changes one, and neither had any way to hear about it. `core/health.ts` gains
`sourcesToRecheck`, which holds the rule and its own debounce — ten seconds, because
`visibilitychange` fires on every tab switch — and the three moments that mean "I am
back" now use it: opening the popup (a fresh document, so `visibilitychange` never fires
for it — opening *is* the return), returning to the full view or Settings, and pressing
**Show my calendar**, which is the clearest "I have finished signing in" a student can
say and was landing on a calendar still asserting nobody was.

A `Number.isFinite` guard written alongside it **survived its mutation and was deleted**:
`Date.parse` of nonsense is NaN, every comparison against NaN is false, and the
comparison already did the whole job. Mutation house rule 2's third case — a second guard
that rejects exactly what the first does is not defence. The test it was written for
stays, and now pins the surviving form: flipping `< WINDOW` to `!(>= WINDOW)` fails it.

And the harness could not have shown any of this, for the usual reason. The preview's
signed-out Gradescope carried `lastAttemptAt: new Date()` — a source that failed a login
*this second*, which is the one shape the return-from-signing-in path cannot occur in,
since the debounce suppresses it. Dated two minutes back, all three call sites are now
observable in the real popup document: opening fires `popup` then `manual`, returning
fires `manual`, and **Show my calendar** fires `manual`.

967 tests.

## The store documents, aligned and published — 2026-09-12

**The one store file no test read is the one that drifted.** `tests/manifest.test.ts`
pinned `listing.md` against the manifest and said nothing about `privacy-policy.md` — so
the listing stayed correct and the policy went stale, which is the worse way round: the
policy is the document with a public URL and a legal claim in it. It told students the
extension reads **four** sites while the manifest held an up-front host permission for
**five**. smartPhysics has been a first-class source since 2026-09-10, named in the
listing's own one-liner, and absent from the policy entirely. `contextMenus` was missing
too, and the registry fetch was described as "a public file on GitHub" rather than
`raw.githubusercontent.com`, which is the host a reviewer has to match against
`host_permissions`.

The policy is now derived from the same things the listing is — every source origin, every
manifest permission, the registry host, and the number of granted sites written as a
*count* rather than as a word typed once. The manifest `description` had the identical
gap, naming four of five sources under an install button that asks for all five. Five
mutations, five killed. `package.json` still said `0.1.0` next to a manifest at `1.0.0`.

**The policy is live**: <https://sushelan.github.io/illini-dash/privacy.html>, served from
an orphan `gh-pages` branch holding three files, so nothing in `docs/` becomes a website.
`scripts/site.mjs` generates it from `docs/store/privacy-policy.md` — a hand-written copy
would be a second policy checked by nothing, which is exactly how the first one went
stale. The renderer handles the markdown subset that file uses and **throws** on anything
else: a bullet list emitted as a literal dash on a legal page is silent-empty in its
public form. It caught its own first bug that way, when a markdown link leaked through as
literal text. Measured AA in both modes.

**[pre-submit.md](docs/pre-submit.md)** now holds the two walks that cannot be run from
here: the clean-profile install (ten ordered steps, each saying what a failure would mean
— the setup tab on install, the pin card, a real notification, and the course-site enable
from `962add6`, none of which has ever been observed outside a unit test), and the G4 beta
(why the spread has to be across *sources* rather than majors, since G3 passed on n=1 and
the badge-token trade is still unmeasured).

959 tests.

## Light carries the brand hue; switching a site on now reads it — 2026-09-12

**"Why is light mode just white and orange?"** Because the palette's own first principle
was only ever applied to one end of it: *"the page itself is navy, not grey with a blue
bar on top — that is the whole difference between an Illini product and a grey box wearing
a hat."* Light was `#ffffff` with two faintly blue tints, which is that grey box in white.
The light surfaces are a blue ramp now — `--bg #eaf1fb`, `--tint #dbe7f7`,
`--tint-strong #ccdcf2`, `--line #b5cce7` — with `--surface-raised` staying pure white,
which is what makes a menu read as *raised* rather than as more page. The course washes
were deepened with it: a wash tuned to sit on white is invisible on a blue ground.

Everything on those surfaces was re-measured against them rather than against white, and
**two things had slipped under AA**: `--ok` at 4.42:1 on the new header tint, and the
wordmark at 4.47:1. `tests/tokens.test.ts` now computes `--fg`, `--muted`, `--ok`,
`--warn` and `--err` against both `--bg` and `--tint` in all six palettes — and writing it
exposed a bug in the test itself, which resolved a dark theme's missing tokens through the
*light* root instead of `:root.is-dark`, reporting a 2.83:1 failure that did not exist.
A test that measures the wrong values is worse than no test.

**"I enabled the CS 424 course site and it still says checking."** Three separate faults
in one sentence:

1. **Nothing fetched.** Enabling a source or an adapter wrote the flag and stopped, so the
   state stayed `pending` until the next poll — up to half an hour of "Checking…", which
   is indistinguishable from broken. The first-run screen has always synced on enable;
   Settings was the one place that did not.
2. **`set-adapter-enabled` wrote `state: "ok"` by hand**, which is worker rule 2's own
   defect — a source reporting success before a single request. Masked only because
   `displayState` calls a never-attempted source `pending` anyway; switch a site off and
   on after it had run once and Settings said "Connected" over a fetch that never
   happened. It goes through `statusAfterEnable` now, like every other toggle.
3. **Settings never redrew.** The popup has listened to `chrome.storage.onChanged` since
   the calendar landed; this page never did, so even once the sync finished the screen
   kept saying "Checking…" until a reload. Guarded on a focused control, so the switch
   under your finger does not move.

**Week view: merging labels shifted the due time.** The source column was `auto`, and the
comment that chose it — *"empty on a single-source row, so the title gets those 44px
back"* — stopped being true the day source codes started appearing on every row rather
than only merged ones. The reason went; the `auto` stayed. Measured across 17 real rows,
the clock landed at **five different x positions**, 700 for `PL`, 711 for `WEB`, 729 for a
merged `CV WEB`. Fixed at 44px (two codes; three ellipse, and the tooltip has named them
in full all along) — now one x for all 17.

950 tests.

## Light mode, the wordmark, and a pill that closes — 2026-09-12

- **Light or dark is a setting now.** It was never one: every dark value lived behind
  `@media (prefers-color-scheme: dark)`, so a student on a dark machine could not have a
  light calendar and one on a light machine could not have a dark one. The stylesheet
  keys on **one class**, `is-dark`, resolved once by `resolveDark(mode, systemPrefersDark)`
  — because a media query cannot be overridden by a choice without writing every dark
  value twice, which is colour-layer.md rule 3 in its most expensive form. Settings gains
  a "Light or dark" group under the palette: Match my system (default) / Light / Dark.
  `color-scheme` is stated per mode so a forced-light calendar does not get dark
  scrollbars.

  Two consequences, both found by looking: the component gallery renders light without
  `applyMode()` (fixed), and the theme picker's swatches paint themselves in their own
  palette and do **not** inherit the root's class — so the picker previewed three light
  palettes on a dark page until `syncSwatchMode()` kept them in step.

- **The pill closes when you press it again.** `openHealthPopover` closed whatever was
  open and then opened its own, so the second press closed the panel and rebuilt it in
  the same gesture — the one thing everybody tries.

- **"Illini Dash" in the bar**, top left, with the health pill beside it, in both windows.
  `flex: none` on the wordmark and the pill absorbing the slack, since the pill already
  ellipses.

  The bar now carries five things in 400px, so the fixed costs were trimmed (26px icons,
  tighter gaps, "Retry" rather than "Try again") until all four pill sentences fit
  unclipped. **And the orange failed contrast**: `--accent` on the header tint is
  **2.86:1** at 12px bold — the same failure `--accent-ink` had in phase A, on the one
  word that names the product. `--brand-mark` is a darkened orange in light (4.82:1) and
  the accent itself in dark (5.74:1); `tests/tokens.test.ts` computes it for all six
  palettes, mutation-checked.

- Rendering reviewed as asked, in both modes, across popup / full view / Settings /
  first run: a sweep for overlapping siblings and clipped text found **no overlaps** and
  no clipping except the row title's intended ellipsis. Width invariant holds.

949 tests.

## Live run: the source list was cut off — 2026-09-12

Reported on the Attention tab, and the tab is the clue. **A floating panel is positioned
out of flow, so it contributes nothing to the document's height — and Chrome sizes an
extension popup by measuring exactly that.** Reproduced: a document 179px tall against a
panel that needs 218 from y=34. The browser clipped it half way down the fifth row, and
nothing could scroll to reveal the rest, because the popup was not scrollable — it was
small. The shorter the tab's list, the worse it gets, which is why Attention showed it
first.

This is the note at the top of `popup.css` from the other side. That one is about *taking
away* the height Chrome measures; this is a panel that never contributed any.

`placeFloating()` now does both halves, for the health popover and the row menu:

1. **Asks for the room** — a temporary pixel `min-height` on `body`, cleared on close.
   Not the forbidden thing from colour-layer.md: a percentage or viewport unit removes
   the intrinsic height, a pixel minimum supplies one. Measured: the document goes
   179 → 218 when the panel opens and back to nothing when it closes.
2. **Copes without it** — capped at what a popup can ever be (600px) and scrolls inside
   itself, so the worst case is a scrollbar rather than a row that is not there.

Also `position: fixed` rather than absolute, so the cap is against the window; menus close
on scroll, because a fixed panel does not travel with the document and one left open over
a scrolled list points at a different row.

**And the harness could not reach it**, which is why it shipped: opening the panel takes a
click. `?open=health` clicks the pill once the open-sync has settled, and `popup-sources`
is in `npm run shots` — on Attention, the shortest page and so the smallest window.

## Live run: the hour axis had no room above it — 2026-09-12

"8 AM" was touching the 11:59 PM row above it. Measured: the end-of-day band ended at
y=411, the grid started at y=414 — three pixels — and the first hour label started at
y=409, which is *five pixels above the grid* and two pixels inside the last end-of-day
row.

Every hour label is shifted up 5px so it straddles its own gridline, which is what makes
an axis read as an axis. **The first label has no line above it to straddle**, so those
5px put it outside the grid entirely, on top of whatever band is there. The grid takes
5px of top padding to hold it in, the gutter takes an equal negative margin so its tint
still reaches the grid's top edge, and a 14px margin separates the two blocks.

Gap 3px → 17px, label inside the grid, tint flush with the top edge — all three measured
rather than eyeballed.

## Live run: the month's vocabulary, and duplicate tabs — 2026-09-12

- **The month showed finished work as if it were still owed.** The "is this done, late,
  or lost" decision lived inline in the popup's `renderRow`, and the month draws pills
  rather than rows — so it knew none of it. Extracted to `itemTone()` in
  `core/calendar.ts`, used by both, tested and mutation-checked three ways. The month now
  strikes through and dims finished work, takes `--err` on the edge and the course code
  for overdue, and `--warn` for a window still open.

  Worth noting *why* this surfaced now: before the previous fix, finished work never
  appeared on the calendar at all, so the month had nothing to get wrong. One fix made
  the next defect visible.

- **Clicking Month opened a new tab every time**, and so did "Open in a tab". The popup
  cannot fix this itself — it is destroyed the moment it loses focus, so it has nowhere
  to remember the tab it opened. The worker owns it now (`open-full-view`), keeping the
  tab id in `chrome.storage.session`, which is exactly the right lifetime: a tab id means
  nothing after a browser restart and session storage is gone by then too.

  **No new permission.** `tabs.get` and `tabs.update` work on an id you already hold; the
  `tabs` permission is only needed to *search* for tabs or read their URLs, and the store
  listing says it is not requested. `tab.url` is redacted without it, so it is checked
  only when present — a tab the student navigated elsewhere must not be yanked back, and
  an undefined url is not evidence that they did.

  The *view* is handed over through `localStorage`: both documents are the same extension
  origin, so a write fires a `storage` event in an already-open tab. A dedicated key, not
  `VIEW_KEY` — that one is written on every ordinary tab change, and a full view that
  followed the popup around would be a surprise.

940 tests.

## Live run: tab icons, and a month that stops moving the page — 2026-09-12

- **Icons on the popup tabs.** Dropped in phase C on the grounds that five labelled tabs
  once measured 454px — but that was 12.5px type, 11px of padding either side and a 14px
  icon. At 12px, 5px and 12px the strip measures **365px**, so both fit and the reasoning
  for dropping them does not survive being measured.

  The first attempt fit with *three pixels* to spare, which is a coincidence rather than a
  margin, and the thing on the other side of it is the worst failure in this project. So
  the strip also carries a structural guard: `min-width: 0` on the tab and the label means
  that if it ever does overflow, the labels ellipse and the document stays 400px wide. A
  clipped word is a bug you can see; a popup that opens at 800px looks like a different
  product. Verified at two- and three-digit count badges.

- **Switching to Month no longer slides the whole page.** The header, tabs and chips were
  on the same `--full-max` as the calendar, so Month's wider cap moved the entire
  interface 200px sideways and switching back moved it home — the whole page answering a
  question only the calendar had asked. The chrome sits at a fixed gutter now
  (`--chrome-max`) and only the calendar frame changes width (`--frame-max`): measured at
  a 1000px window, the pill, tabs and chips are at x=24 in **both** views and the frame
  moves 50 → 24.

## Live run: finished work with a late window open — 2026-09-12

Two reports, one defect, and the largest one found so far by volume of missing rows.

- Gradescope PHYS 435 **Homework 2**: submitted, due Sep 9 5:00 PM, still "accepting late
  submissions" until Sep 16. It appeared nowhere.
- Every completed **PrairieLearn** assessment with a reduced-credit tail — "100% until
  Sep 15, 80% until Sep 22" with a score already on it. Same. By October that is most of
  a semester's work.

`liveDeadline` promotes a passed deadline to the late one, because a deadline that has
gone is not the one that matters *while the work can still be handed in late*. **That
premise is false for work that has been handed in**, and the consequence was compounding:
the anchor moved into the future, so `isPast` said no, so `visibleItems` dropped the row
as finished-but-not-yet-past — and nothing drew it on the day it was actually due either.
So it was hidden from the future for being done, and hidden from the past for not being
past. A finished item's deadline is the one it was finished against.

- `isItemDone || isTickedDone` gates the promotion. Unfinished late work is unchanged —
  that is the case the promotion exists for, and saying "overdue" about something
  Gradescope is still accepting was the defect it was written to fix.
- Merged rows need **every** source to agree before the promotion stops; one submitted
  member out of two is not finished.
- Nothing was pinning this: all 925 tests passed before and after the fix. Ten new tests
  across `grouping` and `calendar`, three mutation checks, and both real shapes are in the
  preview data now — verified in the real popup, where they land on Sep 9, struck through,
  at 5:00 PM and 11:59 PM.

935 tests.

## Live run: "course websites off, but CS424 is still loaded" — 2026-09-12

The report is the whole bug: Settings said **Off** and the calendar still showed that
source's rows. Two branches of `runSync` kept them, and both said so in their comments —
"disabling a source in the options page should not delete history the user may re-enable",
and the `disabled` outcome explicitly marking its keys as *seen* so §5.4's miss counter
could not purge them either.

That reasoning is wrong, and the argument it borrowed is the giveaway. Keeping rows is for
a source that **failed** — a transient, where the source is still being read and will
answer again, and §11's silent-shrink is the risk. A source that is switched off is not
being read at all: its rows can never update, can never be flagged stale (`staleNotice`
skips `disabled`), and can never be corrected. **A row on the calendar is a claim that some
source currently reports this deadline**, and nothing was standing behind these. Nothing is
lost either — switching a source back on runs a sync, which is where the rows come from.

- `runSync` drops a source's rows in both disabled branches; the backoff and failure
  branches keep theirs, which is the case the argument was always for.
- `withoutRows(store, prefix)` applies the same rule **the moment the switch is flipped**,
  in `set-source-enabled` and `set-adapter-enabled`. The loop alone would leave up to a
  poll interval — half an hour — of "Off" over visible rows, which is the gap that was
  seen. Overrides survive: dropping rows must not drop the user's own corrections.
- `sourcePrefix` / `adapterPrefix` are one copy of the prefix rule for three callers.
  Switching off one course site no longer has to wait for the whole source to be re-read.
- **Three tests were pinning the defect** and are rewritten to pin the requirement
  (worker rule 6). One of them — "keeps items from a previous run while the source is
  switched off" — was Sushi's exact scenario, asserted backwards.
- Six mutations. One survived: dropping the colon from `sourcePrefix` changes nothing,
  because no current source name is a prefix of another. That is the *unreachable* case
  from CLAUDE.md's mutation rules, so the colon stays and the comment says why rather than
  a test pretending to cover it.

925 tests.

## Live run: the full view — 2026-09-12

Two more from Sushi, both in the tab, both from screenshots at ~1000 CSS px (2× retina).

1. **"The current week items aren't showing up."** The full view's Week was Sunday–Saturday
   and he opened it on a **Saturday**, so "this week" was six days that had already
   happened plus today — an empty grid whose only useful control was the forward arrow.
   That is precisely why the popup went rolling, and the argument does not weaken in a
   bigger window; it gets *more* visible, because there is room to draw all six empty
   rows. **Both windows are rolling now**, which also buys the one thing Sunday–Saturday
   was supposed to: a single definition of "week". The **month** stays Sunday-first — it
   is a grid of calendar weeks and genuinely is a calendar.
2. **"The fullscreen UI looks very weird."** Measured: **584px between the end of a row's
   title and the clock belonging to it.** The title track is `1fr`, so it absorbed every
   spare pixel and shoved the fixed right-hand tracks against the frame — the exact
   scanning problem the fixed tracks exist to prevent, and the M12 view-level cap did
   nothing about it, because a 1100px cap is inert in a 1000px window.
   - The title track stops at **420px** (≈60 characters; the longest real title is 48) and
     a trailing `1fr` takes the slack *after* the row. Clocks still align in a column.
   - The list cap drops **1100 → 900**, which is what the rows actually occupy — and it
     engages at a 1000px window, which is the width a laptop opens a tab at. The month
     keeps 1400.
   - "Today" moved from `margin-left: auto` to beside the arrows. It was 700px from the
     two controls it undoes.

   Gap is 200–360px now, bounded by the reserved track rather than by the window: a
   reserved track is reserved whether or not the title fills it, so every pixel of
   headroom is a pixel of gap on every short title.

## Live run: three findings from Sushi — 2026-09-12

All three from one session with the real extension. The first two are the same defect.

1. **"Gradescope couldn't be read" when the whole fix was pressing Sync now.**
   `sync.ts` classifies a failure into `parse_error` and `network_error` — §6 has two
   branches for a reason — and `healthPill` then said "couldn't be read" for both. That
   is worker house rule 2's own recorded example, reintroduced by this work one layer up,
   in the function that replaced the dots. A `TypeError: Failed to fetch` was being
   announced as "the page changed", which sends someone to debug selectors that are fine.
   Now: **"Gradescope didn't answer"** (retryable) vs **"Canvas looks different"** (needs
   a build). Four words, not five, because "Gradescope couldn't be reached" truncated to
   `…couldn't be rea…` in a 400px bar — losing the one word the distinction turns on.
   A test pins the character budget.
2. **Clicking the text offered nothing.** `SourceRow` carried a `loginUrl`, so the *shape
   of the data* said only a login was actionable — a source that could not be reached
   rendered as a red row with no button, in the popover and in the pill. `actionFor()`
   now returns one for every failing state (`login` / `retry` / `open`), and the pill and
   the popover both derive theirs from it, so they cannot disagree. The action sits as a
   named button beside the pill — "Try again", "Open", "Sign in" — because a sentence
   naming a site should not need a second click to act on.
3. **Sync took 5–10 seconds with the header still asserting the last result.** The pill
   reads **"Checking…"** for the duration now, repainted before the request rather than
   after it. The spinner is capped at `SYNC_SPINNER_CAP_MS`:
   `chrome.runtime.sendMessage` does not reject when the worker is torn down mid-answer,
   so without it a dead worker left the button disabled and turning forever.

**Why the suite did not catch any of this.** None of the three states was reachable in
the harness — the stub had no failing source and answered `sync` instantly. `?fail=network`,
`?fail=parse` and a 1.2s sync delay fix that, and `popup-unreachable` / `popup-unreadable`
are in `npm run shots` so both sentences are rendered on every run. The general form is
CLAUDE.md's own: *live data is a source of truth the fixtures are not* — and the answer
to that is not only to read the live output, but to make the state it revealed reachable.

918 tests; the classification, the per-state action and the ranking each mutation-checked.

## UX plan — polish pass and what is left — 2026-09-12
- **m10** nothing renders below 10px any more (was 9px on "+N more" and 9.5px on the hour
  axis, the week's gutter and the month header). 10px is kept only for tracked uppercase
  labels and the hour axis; everything else is 11 or up.
- **§4.2** `tabular-nums` on every clock, date number and count. Proportional digits make
  "11:59 PM" narrower than "10:00 AM", so a column of clocks does not line up on its right
  edge — which is the one thing the row's fixed tracks exist to buy.
- **m4** month pills take two lines in the full view. A cell is 137px and the course code
  eats 45 of them, so a one-line pill cut most UIUC titles before the noun; the tab has
  the height and the popup does not draw a month at all.
- **m2** the last text glyphs are gone: the Attention fold's `▸`/`▾` is an SVG chevron
  that rotates.
- Final check in the real popup document, **dark, light and High contrast**: body 400 /
  `scrollWidth` 400 / `overflowY: visible`, nothing past 401px outside the course strip,
  smallest type 10px, chrome 145px healthy and 211px worst case. In High contrast the
  health dot keeps a shape per state, which survived the six-dots→one-pill change.

### Still Sushi's — nothing here can be done from this side

1. **Load the unpacked build and report the console.** `npm run build`, load `dist/`, open
   the popup. What to look for: the header pill, and no `Could not draw the list` banner.
2. **A clean-profile install (phase E).** Does a tab open by itself, does it lead with the
   pin card, and does "Show my calendar" work. This is the one thing `opensOnInstall`'s
   test cannot tell us, because the test is about the argument and the question is about
   Chrome.
3. **One reminder toast (phase F).** The title should lead with the assignment, and the
   small third line should name the site.
4. **G4's beta**, then the developer account, the privacy-policy URL on GitHub Pages, and
   the pre-submit walk in `docs/store/listing.md`.

## UX plan phase G — store readiness — 2026-09-12
Sushi's decisions: **icon A (Dash)**, **version 1.0.0**.

- **Icon.** `public/icon-src/dash.svg` — a navy tile, one heavy orange bar, a white tick
  — rendered to 16 / 32 / 48 / 128 by `npm run icons` (headless Chrome, no dependency).
  **32 was missing from the manifest**, and it is the size a toolbar icon is most often
  drawn at on a 2× display: Chrome was scaling 16 up or 48 down, and a two-shape mark at
  a fractional scale is a smudge. The first draft had two bars at 14 units and they
  merged into a blur at 16px; the shipped one spends the whole width on one 20-unit bar.
  `docs/ux/icons/candidates.png` is the sheet both candidates were judged on.
- **Screenshots were listed as BLOCKED — "needs a browser and real account data".**
  Neither is true: the harness renders the real `popup.js` and `options.js` with only
  `chrome.*` stubbed, against row shapes taken from Sushi's own account. All five store
  images are generated by `npm run shots` and regenerate when the UI changes, so they
  cannot go quietly stale.
- **Promo tile** 440×280 from `ui.css`'s own tokens and the shipping icon.
  **Reminder screenshot** composites the real `notificationContent` output into Chrome's
  toast shape — the one image that is a mock, and the wording is quoted by
  `schedule.test.ts` so it cannot promise what the build does not do.
- **Manifest**: version 1.0.0, `homepage_url`, `commands._execute_action` (Alt+Shift+D),
  the 32px icon. Five new assertions in `tests/manifest.test.ts`, including that every
  icon file the manifest names actually exists.
- `docs/store/listing.md` updated: screenshots and version are ticked, `commands` has a
  justification.
- 911 tests.
- **Still Sushi's, and only Sushi's:** the developer account, the privacy-policy URL on
  GitHub Pages, G4's beta, and the clean-profile pre-submit walk.

## UX plan phase F — notifications — 2026-09-12
- **m15** a toast leads with the work. `CS357 — assignment due in 2 hours` put the one
  thing a student already knows first and the thing they have to act on second; it is
  `HW3 Errors and Big-O — due tomorrow` / `CS357 · Fri 11:59 PM · in 1d` now.
- `contextMessage` — Chrome's small third line — carries **which site**. A student with
  five sources had to open the popup to find out where to go and do the thing.
- An exam toast carries its room and duration, from the `examDetail` the parser has
  produced all along and no toast ever showed.
- The booking nag leads with the verb: `Book a seat: CS 357: Quiz 2` / `CS357 · sessions
  Sep 21–24`. Still never worded as a deadline (§4.4).
- `clampTitle` clamps **only the work**, and the words after it are appended — a real
  UIUC title ("MP1 Report (4cr only, EXCEPT for students in MC3)") is 48 characters
  before anything is said about when it is due, so a naive clamp drops the half that
  matters. Three mutations, all caught.
- `INSTALL.txt` in the beta zip described the six dots and the build id in the status
  line, neither of which exists any more.
- 906 tests.

## UX plan phase E — first run and install — 2026-09-12
- **M13** nothing used to happen on install. `opensOnInstall(reason)` in `core/setup.ts`
  — tested and mutation-checked — and `onInstalled` opens `popup.html?view=full` on
  `install` only. `update` is the branch where this would be actively wrong: Chrome
  updates in the background, and a tab that opens over what someone was reading is the
  behaviour that gets an extension uninstalled. Both branches log (worker rule 5).
- A dismissible **"Pin Illini Dash to your toolbar"** card, with the two clicks. Chrome
  leaves a new extension unpinned, so the badge — the only thing that tells a student
  something is due without them asking — sits behind the puzzle-piece menu. It is the
  project's own "never fail silently" rule at the operating-system level.
  **Only in the tab**, which is the screen the install opens: in a 400px popup it cost
  ~90px and pushed "Show my calendar" below the fold, to give advice to somebody who has
  just demonstrated they can find the icon.
- The checklist uses the same switches and state chips as Settings. It had invented four
  wordings of its own ("✓ connected", "needs sign-in", "could not read", "not used"), and
  "Sign in" replaced the state rather than sitting beside it — leaving a row whose state
  was a verb.
- `setupSummary` gained a `found` argument: once every chosen source has answered it says
  **"Found 43 deadlines across 6 courses"** rather than "All 3 connected". The second is a
  fact about plumbing; the first is what the student installed this for. It falls back
  whenever nothing was found, because "Found 0 deadlines" reads as a failure.
- 901 tests.
- **Still Sushi's:** the clean-profile install check (does the tab open, does the pin card
  read right). See the list at the end of this file.

## UX plan phase D — Settings — 2026-09-12
- A 1900px essay becomes a page you can navigate: a sticky section list built from the
  sections themselves (`data-nav`, so there is one list rather than two that can
  disagree), one line of description per section, and the paragraphs behind a "Why?"
  disclosure — still there, and out of the way of anyone who wants a switch.
- Top line: `Illini Dash 0.1.0 · All 5 OK · 11:16 PM`, from the same `healthPill()` the
  popup's header uses, so the two surfaces cannot disagree about the same second.
- Rows are switch · name · who it is for · state chip. **Sources finally say who each
  site is for** — the first-run screen had those hints and Settings listed the same five
  names with nothing to tell them apart. One copy now, `SOURCE_HINT` in `core/names.ts`;
  `core/setup.ts` reads it too.
- Quiet hours are two `<input type="time">` rather than two numbers between 0 and 23; the
  poll interval is a select (15 / 30 / 60 / 120) rather than a box that accepted 17.
  A stored value outside the four is added as its own option rather than silently
  becoming the first one.
- Reset is alone in a bordered "Careful" block. "Permission missing" no longer reads
  "Sign in needed" — nothing about a Chrome host grant is a login.
- m8: the NetID and full-name fields are behind "Prepare a report" under Help, with the
  reason ("used *only* to find them in the page and take them out") above them rather
  than in the middle of Settings on a page whose pitch is "never sees a password".
- The theme picker shows three swatches per row — the page, the accent, a course colour.
  "High contrast" and "Neutral" do not say what they look like, and the choice is visual.
- Two stale-build warnings share one container in the page's own margins; the
  `?stale=1` harness confirms both render and the other eight sections still draw.
  A `chrome.runtime.getManifest()` throw took the whole page down while this was being
  built — guarded, and the stub gained the method (worker rule 8).

## UX plan phase C — popup information architecture — 2026-09-12

Sushi's three decisions from ux-plan §7: agenda, rolling week, one health pill. All three
as recommended.

**The budget, re-measured in the real popup document.** Healthy **145px** of chrome before
the first deadline (was 215; target 144), worst case **211px** (was 322; target ≤226).

| Block | Was | Now |
|---|---|---|
| Header | 48 | 41 |
| Stale banner | 48 | 33 |
| Booking strip | 50 | 33 |
| Tabs | 47 | 36 |
| Course chips | 81 | 36 |
| Date navigator | 39 | 32 |

- **M4** six 9px dots and the status line that restated them 800px lower become one
  health pill, from `healthPill()` in `core/health.ts`. Clicking it opens a per-source
  list built by `sourceRows()` — the same facts, from the same function, that Settings
  shows. Signing in outranks a parse error, for `staleNotice`'s reason: one is ten seconds
  of work and the other needs a new build.
- **M2** the popup's Day is an agenda (`agendaRows`). Eleven empty ruled hours between a
  9 AM checkpoint and a 9 PM exam cost ~290px and put the exam below the fold. The full
  view keeps the grid, where the height exists — `full-day-dark.png` is the evidence for
  both halves.
- **M3** the popup's Week is a rolling 7 days from today; the full view stays Sun–Sat.
- **M5** all five tabs are named. The old rule — five labels measure 454px — was measured
  at 12.5px with an icon on every tab; without the icons and at 12px they fit in 400 with
  room to spare, and the width check confirms it.
- **M6** one 36px scrolling chip row. `overflow-x` is on the strip, never on `body`.
- **M7** sync spins the button that started it. **M9/M11** the status line is gone except
  when something is actually wrong.
- **M11** rows are `<a href>` with a roving tabindex, `⋯` is visible at 35%, the menu
  handles ↑ ↓ Home End Esc and opens on Shift+F10 / `.`, and its first item names the site.
  A keyboard walk in the real document found a defect no test could: the arrow handler was
  re-attached on every draw, so after the popup's own open-sync one press moved three rows.
- **m11** `popup.css`'s three stacked "refresh" layers are one. `.bar` was set three times
  and `.tab[aria-selected]` four, with the cascade deciding.
- Amendment: in dark Illini a calendar row now takes `--pill-fill`, the single navy the
  month pill already used. Eight washes chosen for an 11px pill read as a patchwork behind
  a full-width row — colour-layer.md rule 2. Measured: all six rows composite to
  `rgb(26,48,80)` against a `rgb(11,23,38)` page.
- Amendment to the width check in colour-layer.md: an element inside a deliberately
  scrolling strip may sit past 401px. `scrollWidth === 400` is the authoritative test.
- 894 tests; `agendaRows`, the rolling window, `healthPill` and `sourceRows` each
  mutation-checked (six mutations, one of which reported a false "survived" until the
  match count was asserted).

## UX plan phase B — primitives — 2026-09-12
- One component layer in `ui.css`, below the palette and containing no colour values of
  its own: `.btn` (`-primary` / `-secondary` / `-quiet` / `-icon`, plus `-sm`), `.switch`,
  `.chip-base` / `-state` / `-count`, `.pill`, `.banner-line`, `.menu-surface` /
  `.menu-item`, `.field`. One focus ring, one hover, one disabled, and
  `accent-color: var(--accent)` for the native controls that survive.
- `src/ui/icons.ts`: 19 inline SVGs on one 16px/1.5-stroke grid, built with
  `createElementNS` the way `tabIcon` already was. Replaces `⚙ ⤢ ⋯ ‹ › ▸` — text glyphs
  differ per machine, sit on the text baseline, and have no hit area. `iconButton` makes
  the accessible name mandatory rather than optional; both are mutation-checked.
- `dist/components.html` — every primitive in every state, all three themes, driven by the
  real `icons.ts`. Also in the shot set, so it is checked dark and light each run.
  The eight button styles it replaces were one decision made eight times, in eight files,
  because there was no page on which they would ever be seen side by side.
- `scripts/package.mjs` no longer zips the development pages. `dist/` is what gets
  packaged, so a build run after a preview was shipping a component gallery and a
  canned-data copy of the popup inside the extension.
- 866 tests. Nothing in the extension consumes the primitives yet — phases C and D do.

## UX plan phase A — trust and correctness — 2026-09-12
- **B1** an exam already sat is no longer "Overdue". An exam has no submission, so
  `isItemDone` was never true for one and it fell through to the past branch for a week
  while the Exams tab called the same row "Just sat". Two tests, mutation-checked.
- **B2 + B3** new tokens `--primary` / `--primary-ink` / `--accent-wash` / `--focus` /
  `--surface-raised` in all six palettes, and `--accent-ink` back to `#1a0d04`.
  "Show my calendar" was `--brand` on a `--brand`-family page: 1.00:1 in dark, i.e.
  plain text. White on the orange accent was 2.87:1. `tests/tokens.test.ts` now parses
  `ui.css` and computes every pair, so neither can come back silently; both mutations
  were checked.
- **M8 + m1** one vocabulary module, `core/names.ts`. `GS`, `gradescope` and
  `gradescope: due date` are gone from every sentence; the two-letter code stays only in
  the row's source column. It also holds `timeAgo`, which retires
  `List updated 9/11/2026, 6:19:34 PM` (m6).
- **M9** the build id leaves the popup's status line and lands in Settings › Developer,
  beside the worker's. The stale-worker warnings are rewritten to say what happened and
  what to do (m7); the build ids stay in the one sentence they are the evidence for.
- **M12** the full view is capped again — 1100px for list-shaped views, 1400px for the
  month — keyed off `body[data-view]`, not a width media query. The comment that still
  argued for the cap now matches the code.
- `h3` had no rule at all, so "Older courses" rendered larger than "Courses". `SPEC.md §0`
  is out of the Sources copy.
- **m12, and the finding that matters most here.** The framed preview is deleted (it
  mounted `#list` and threw, and by construction it cannot reproduce a `body`-level
  sizing bug). `npm run preview` now emits `preview-popup.html`, `preview-options.html`
  (`?stale=1` for an older worker) and `shot.html`; `npm run shots` renders all ten
  surfaces dark and light to `docs/ux/after/`.

  **`--force-dark-mode` does not set `prefers-color-scheme`**, which ux-plan.md §6
  asserts and a probe disproved: on macOS headless Chrome follows the system theme, so on
  a dark machine every capture is dark with or without it, and the twenty "light" files
  were byte-identical to the dark ones. `--blink-settings=preferredColorScheme=0|1` is
  the one that works, and both halves now state it rather than leaving dark implicit.
- 857 tests, typecheck and build pass. Verified in the real popup document in **dark and
  light**: width invariant still 400/400/visible, no element past 401.

## Done

| Step | State |
|---|---|
| 1 — scaffold | TypeScript + esbuild → `dist/`, vitest + linkedom, manifest per §2.3, layout per §2.4, data model per §3. |
| 2 — **Gate 0** | **PASSED 2026-09-03, 4/4.** All four hosts return logged-in content to a `credentials: "include"` fetch from the service worker. The §2.2 content-script fallback is **not** needed. → [gate0-results.md](docs/gate0-results.md) |
| 3 — offscreen | **Verified in Chrome**, round-trip 3/3. `ParseError` survives the message boundary as a `ParseError`, so §6 can tell a structural surprise from a plumbing bug. |
| 4 — fixture capture | Options page fetches an allowlisted URL from the worker, scrubs it per Appendix A, probes it for §4 marker strings, downloads it. Also `npm run scrub` for re-scrubbing from the CLI. |
| 5 — Canvas | `src/sources/canvas.ts`, planner-only as decided. Adversarially reviewed; four code defects fixed. → [canvas-findings.md](docs/canvas-findings.md) |
| 6a — Gradescope | `src/sources/gradescope.ts` + `src/core/dates.ts`, 37 tests on two real fixtures. Adversarially reviewed: 12 findings, 11 survived, all fixed. → [gradescope-findings.md](docs/gradescope-findings.md) |
| 6c — PrairieTest | `src/sources/prairietest.ts`, both cards + the booking pseudo-item. 30 tests on **two** real captures a week apart. Adversarially reviewed: 12 findings, **all 12 survived refutation**, all fixed. → [prairietest-findings.md](docs/prairietest-findings.md) |
| 6b — PrairieLearn | `src/sources/prairielearn.ts` + the §3.2 half of `src/core/dates.ts` (wall-clock in a named zone, year inference, CDT/CST). 48 tests on the real fixture. Adversarially reviewed: 12 findings, **all 12 survived refutation**, all fixed. → [prairielearn-findings.md](docs/prairielearn-findings.md) |

## Review outcome — Gradescope
Two silent-empty paths that §4 forbids outright: a table whose **rows** stop matching the
row selector parsed to `[]` (the table element was guarded, the row class was not), and a
dashboard whose course cards moved returned healthy-looking empty term groups. Both now
throw. Also fixed: a row whose only `<time>` is the late date reported that late date as
`dueAt`; `mapStatus` matched by substring, so `Not Submitted` → `submitted` and
`Not yet graded` → `graded` (the fail-silent direction, which would then win §5.3's
"most done" merge); one bad `datetime` anywhere in a row — including the release date,
which §4.2 says is not even displayed — threw away every assignment in the course, while
an *empty* one silently dropped the date with no record; and `data-assignment-id` was
used unvalidated as both the memberKey and a URL path segment.

§4.2's class-independent date fallback ("cheap insurance", and §11's redesign mitigation)
was missing and is now implemented, matching `<time datetime>` by aria-label prefix —
never via the hidden Due Date column, which is state-dependent.

Nine of ten mutations the review found now fail the suite; the tenth is benign
(two independent guards reject the enrol button, so loosening one changes nothing).

## Review outcome — PrairieLearn
Three high-severity defects. **One unreadable popover discarded all 14 assessments** —
the same "cost must be one field, not the page" rule already fixed in Gradescope, and the
credit cell that could have rescued the row was gated off behind `!scheduleHtml` rather
than "no usable schedule". **§4.3's schedule-vs-cell cross-check did not exist**: the cell
was parsed on every row and thrown away, so swapping two rows' popovers produced two wrong
deadlines with no error, no marker and no log. **Positional `cells[1..3]`** meant an added
column yielded 14 undated rows, all URLs fallen back, and 8 rows reported `graded` because
the status reader was handed the credit text — columns now come from the table's own header.

Also fixed: `Number("") === 0` fabricated a 0-credit tier that dragged `dueAt` onto the
50% semester-long tail §4.3 explicitly rejects; a tie for the highest credit reported the
earlier window as the deadline and a still-full-credit window as `lateDueAt`;
`wallClockToIso` formatted its input verbatim, so `Sep 31` stored a date that does not
exist and `25:00` threw a `RangeError` (not a `ParseError`, so §6 would have called it a
plumbing bug); `inferYear` kept a year the weekday check had just rejected; and the row
URL had no scheme/origin check while a malformed href killed the page.

The DST path was entirely unpinned — hard-coding `-05:00` passed all 137 tests. Now pinned
by a December date, the fall-back hour, and the previous-year candidate. Eleven mutations
were tried; the two that survived the first pass have tests and now fail too.

| 7 — normalize + dedupe | `src/core/normalize.ts` §5.2, `src/core/dedupe.ts` §5.3 union-find + overrides + §5.4 retention. 41 tests, table-driven from real fixture titles. |
| 9 — notifications | `src/core/schedule.ts` §7: 24h/2h leads, quiet hours, the daily booking nag, alarms rebuilt after every sync. Plus the extension icons, without which `chrome.notifications.create` fails silently. |
| 10 — options, overrides, calendar | §8.2's options page, §8.1's row menu (hide/split/merge/calendar) over `src/core/overrides.ts`, and §8.3's `.ics` + Google Calendar links in `src/core/ics.ts`. |
| 11 — course-site adapters | §4.5's declarative runner (`src/sources/site.ts`), the registry trust boundary (`src/core/registry.ts`), the daily refresh and the runtime permission flow. Ships one real seed adapter, **cs424-fa26**. Shipped inert: the bundled registry was copied to `dist/` and never read, so no adapter could be enabled at all until the first live run. → [adapters.md](docs/adapters.md) |
| 12 — report, policy, listing | §8.2's report-a-broken-page flow, plus [privacy-policy.md](docs/store/privacy-policy.md) and [listing.md](docs/store/listing.md). |
| 8 — store + sync + popup | `src/core/store.ts` (§3 schema, migrations, §6 backoff), `src/core/sync.ts` (§6 loop, injected fetch/parse/clock), `src/core/grouping.ts` + `ui/popup.ts` (§8.1). 32 tests, driven end-to-end by the real fixtures. Review in flight. |

## Review outcome — dedupe + sync (the full review CLAUDE.md reserves for this layer)
16 findings, 14 survived, 7 code defects fixed. **None of the seven was pinned by the
260 tests that existed** — every fix left the suite green, which is what the mutation
pass is for.

Two would have broken the G2 run itself:
- A source reporting `ok` with **zero** items deleted every key it had, behind a green
  dot. Gradescope's own §0-rule-3 guard passes if *any* term has courses while its only
  consumer reads the current term alone, so a breakage confined to this term produced
  `{ok, 0 items}`. It happens before §5.4, so the 3-miss grace never applied. Now keyed
  on N→0, so Canvas's legitimately empty planner stays green.
- `hideSubmitted` hid a **merged** row whenever *any* member was done, taking the member
  that was still outstanding with it. If that half was also overdue there was no escape
  hatch at all — turning the setting off tested the same collapsed status.

Also: the Jaccard path was badge-blind, so `Quiz 1: LA + Python + Errors` and
`Quiz 10: …` merged at 0.667 — the exact pair §5.3 cites as proof the rule is safe;
union-find could put two rows of one source in a group, making one deadline unreachable
behind a row that looked like an honest two-source merge; §5.2's join list and §5.3's
badge shape disagreed above four letters, so identical exams merged or not on whether
staff typed "Exam" or "Midterm"; an item whose only deadline was `lateDueAt` rendered in
no section and read "no date", losing §4.3's whole reduced-credit case; and a *disabled*
source lost its undated items after three syncs, contradicting its own comment.

## Review outcome — PrairieTest
Three high-severity silent-failure paths. **A single reworded card heading deleted that
card's entire contents** — the guard fired only when *both* cards were missing, two lines
under a comment asserting the opposite invariant; a booked exam vanished with no error, or
§4.4's booking item and its §7 nag ceased to exist. **`isEmptyCard` substring-matched the
whole card subtree** and gated the row loop, so a hidden empty-state element left beside a
real row, or an exam whose title happened to contain the empty-state sentence, blanked the
card silently; emptiness is now decided per row, by the absence of the data hook. **No
duplicate-key guard** in the one source whose key is purely content-derived — two rows
sharing a key silently became one item in §3's `raw` map.

Also fixed: the date attributes accepted anything `Date.parse` tolerated, so a bare
`2026-09-11` would have stored a `dueAt` resolving to 7pm the *previous* day and fired
§7's −24h reminder ~29h early; and one unreadable value discarded the whole page — on a
single-page source, 100% of it — where the house rule is that a bad *value* costs its
field while a missing *hook* stays loud.

Seven mutations were tried against the fixed code; all seven fail.

## Review outcome — steps 9–12
16 findings, **all 16 survived refutation**, 13 code defects fixed. None was pinned by the
347 tests that existed.

Wrong interruptions: a catch-up reminder threw away the quiet-hours deferral the planner
had just computed and fired at 02:30; §7 read `dueAt` alone, so a reduced-credit deadline
that the popup and the `.ics` both show as live got no reminder at all; every store write
was an unserialized whole-store read-modify-write, so a sync landing over a notification
restored the empty `notified` and re-fired it — and one landing over a hide reverted it;
a split or merge dropped `notified` entirely and the reschedule two lines later re-fired
both halves; quiet-hours inputs were unvalidated, so a cleared box left midnight to 08:00
loud with the checkbox still on.

Trust: `validateAdapter` accepted a `hostPattern` broader than the adapter's own host.
`https://*.illinois.edu/*` is the manifest's own optional entry, so Chrome would grant
it — and since only the adapter *id* is stored, a later daily refresh could repoint its
`url` anywhere under that wildcard with no second prompt.

Silent losses: an adapter whose title selector broke returned `[]` rather than throwing;
`hiddenItemIds` was keyed by the group-derived `Item.id`, so a hide was spent the moment
a second source mirrored the row, and the stale id stayed armed forever — it is now
keyed by member keys and pruned by §5.4 like every other override; a notification's
click target lived only in worker memory, which MV3 discards ~30s after the toast, so
clicking opened nothing; the row menu survived a re-render and acted on stale ids while
still reporting success.

Eight mutations tried against the fixes; all eight fail.

## Fixtures captured

| Source | Files | Notes |
|---|---|---|
| Canvas | `courses-active.json`, `courses-active-term.json`, `planner-items.json`, `planner-items-empty.json`, `assignments-cs357.json`, `assignments-cs425.json`, `planner-items-SYNTHETIC.json` | The Sep 3 planner was genuinely `[]` and 0 of 67 assignments were dated. **Sep 10: `planner-items.json` is a real capture with one dated row**, so `parsePlannerItems` is measured against a real response for the first time. The synthetic fixture stays for the mappings one row cannot reach — see `fixtures/canvas/README.md`. |
| Gradescope | `dashboard.html`, `course-1352838.html` | 15 courses / 5 terms; PHYS435 with 2 assignments covering both the submitted and unsubmitted row shapes. |
| PrairieLearn | `assessments-cs357.html` | 8 assessments, all 8 credit popovers present. |
| Course site | `cs424-fa2026-schedule.html` | Real capture, 2026-09-10. Shibboleth-protected; answers 401 in place rather than redirecting. Drives the `cs424-fa26` seed adapter: 9 deadlines, all dated, across the CDT→CST flip. |
| PrairieTest | `home-booked-none-available.html`, `home-booked-and-available.html` | Sep 3 and Sep 10. Between them the student rescheduled Quiz 1, so the pair is live evidence for the §3.1 amendment. The Sep 10 capture has the first available-card row ever seen. |

## Next

**G4** — 10 beta users across ≥3 majors for a week, ≥7 saying they would keep it. Then
**G5**, which §9 gates behind it.

The full pre-beta checklist, and 88 verified feature ideas ranked with audit and skeptic
verdicts, are in [roadmap-ideas.md](docs/roadmap-ideas.md) (2026-09-10).

## Tier 0a — DONE 2026-09-10, all 13 items

Everything that needed no capture, decision or tester. 388 → 546 tests. Each item was
mutation-checked; six mutations survived a first pass and their tests were written before
the item landed (recorded in the commits).

| # | What changed |
|---|---|
| 1 | `SourceState` gains `pending`; no green dot before a fetch. `core/health.ts` owns the dots, the "3 of 4 sources OK" line, a stale-source banner and a **toolbar badge** — health outside an extension page for the first time. |
| 2 | A Chrome-blocked extension no longer marks reminders delivered (which silenced them forever). Catch-up fires one toast per deadline, not one per lead, and the title comes from the clock rather than the alarm's name. |
| 3 | A moved deadline re-arms its reminders and says "moved Tue → Fri". An assumed time turning into a stated one is not a move. |
| 4 | A still-open late or reduced-credit window is listed, worded and reminded on its own instant, and painted amber rather than overdue red. |
| 5 | An invented 23:59 is no longer shown as a clock, sorted as one, exported as a timed calendar event, or counted down to. |
| 6 | `doneKeys`: the student can tick work off, which two sources can never do for them. A source saying `missing` overrides the tick. |
| 7 | Not-for-credit work is chipped, sorted last and silent by default — §4.3 required this and nothing read the flag. |
| 8 | `core/quality.ts` surfaces the nine `unparsed*` flags the parsers already wrote. A row whose date failed to parse leads the list instead of vanishing. |
| 9 | Settings is titled Settings, developer tools are collapsed, and there is one "Course websites" control instead of two. |
| 10 | A new build lifts §6's backoff for the sources a code change could have fixed. |
| 11 | The adapter date grammar reads weekday prefixes, `at`/`@`, and 24-hour times; an ambiguous `5:00` is refused rather than guessed, and an unread tail is recorded. |
| 12 | `migrate` validates `raw` and `items` instead of casting them; `fixtures/store/v1.json` pins that an older store survives. |
| 13 | "Copy diagnostics" (counts and states, no titles or links) and a right-click "Report this page". |

### What the first post-Tier-0a sync found (2026-09-10)

Console from a reload: all four hosted sources `ok` (canvas 1, gradescope 5,
prairielearn 25, prairietest 2), the update hook logging `no source was resting`, and
the registry seed logging `bundle not seeded: 1 adapter(s) already stored` — every new
both-branch log line doing its job.

One defect, and one superseded claim:

- **A failed fetch was reported as `parse_error`.** The sync that fires right after an
  extension reload got `TypeError: Failed to fetch` for the CS 424 site; `syncSites`
  threw `ParseError` whenever *every* adapter failed, regardless of why. It healed on the
  next sync (`site: ok (9 items)`), but the label means "the page changed, go fix the
  selectors" and would have sent someone to debug selectors that were fine.
  `adapterFailureKind` now separates structural failures (a `ParseError`, or a 4xx —
  the adapter is asking for a URL the site will not serve) from network ones (a failed
  fetch, a 5xx), and the per-adapter warning names the kind so a recurrence is
  diagnosable without another trip to the browser.
- **Canvas is no longer empty on this account.** `[sync] canvas: ok (1 items)`, where
  canvas-findings.md claimed Canvas "cannot contribute any" deadlines here. That claim
  was never supported by its own evidence — 0 of 67 assignments dated on one day says
  nothing about whether an instructor will set a date — and it is corrected rather than
  annotated. It also unblocks G1's last gap: `parsePlannerItems` is the only parser in
  the project never tested against a real response, and a real planner fixture is now
  one capture away. **Taken the same day**: `fixtures/canvas/planner-items.json`, one
  dated CS 424 quiz. It pins the four things only a real response could — a *relative*
  `html_url`, an absent `course_code` (the code comes from `context_name`, per the §4.1
  amendment), four `submissions` keys the synthetic fixture never had, and §3.1's key
  shape on live ids. All four already worked. Still open: whether the
  first-fetch-after-reload failure recurs.

## Tier 0b — 4 of 7 done

| # | State |
|---|---|
| 14 — repo + registry | **Done.** Pushed to https://github.com/sushelan/illini-dash and made public. The registry URL returns 200, so **an adapter now reaches every installed copy within a day, with no new build and no store review.** Until then the daily refresh was dead code. |
| 15 — beta install kit | **Done.** `npm run package` → `release/illini-dash-<version>-<build>.zip`, build id in the filename, `INSTALL.txt` inside. [beta-install.md](docs/beta-install.md) is the tester-facing guide. The unlisted-store route was declined: it reorders §9 and a mid-week fix would wait days on review. |
| 16 — adapters 2 and 3 | **Half done.** ECE 310 shipped (13 homeworks, verified by running the shipped runner over a real capture). A third is cheap now — see "Adapters" below. |
| 17 — Canvas term filter | **Done**, see the resolved decision above. |
| 18 — non-CS first look | Not started. Publisher-host naming + a Canvas "No date" section. |
| 19 — PL/PT "not used by you" | Not started; the cheap half needs nothing from Sushi. |
| 20 — first-run page | Not started. |
| 21 — run G4 | Sushi's. |

## The UI pass (2026-09-10 → 11)

Started once Tier 0b's shippable half was done, because the list is the product and it
had never been looked at outside a fixture.

**The popup opened at 800×600 with the list in its left half.** `body { max-height:
600px; overflow-y: auto }` read like a faithful implementation of §8.1's "max height
600px" and was the cause: it makes `body` its own scroll container, which leaves the
document with no intrinsic height for Chrome to measure, so Chrome falls back to its
maximum. Chrome already caps a popup at 600 tall and scrolls it itself, so the cap is
satisfied by writing nothing. Sushi reported this three times before it was diagnosed —
the first two answers reasoned from a preview harness that wrapped the list in a
fixed-width `<div>`, which cannot reproduce a `body`-level sizing bug by construction.
`npm run preview` now emits **`preview-popup.html`** as well, the real `popup.html` with
only `chrome.*` stubbed. Written up in CLAUDE.md as its own section.

**Row layout.** The rows are a CSS grid with fixed tracks, so dates line up on one right
edge across every row instead of drifting with title length; `minmax(0, 1fr)` on the
title is the only track that shrinks. The date column stopped repeating what the section
heading already says (`formatDue` takes the section and picks relative, time, weekday or
date accordingly), which freed 42px. Qualifiers that used to compete with the title —
"no time", "moved Tue → Fri", a late window — moved to a second line spanning the row.

**Source labels were removed and put back.** They were dropped from single-source rows to
buy title width, on the grounds that §5.3 gives one purpose for them ("a merged row shows
both icons, so a false merge is visible"). Sushi pointed out that where a deadline lives
is separately useful: it says which site to open, it is what the row's click does, and it
is most of what makes a row checkable rather than asserted. Restored on every row, with
different hover text for the merged and single cases. Truncation went 3 → 5 of 17 rows,
against 8 of 17 (worst case 5px) before the pass.

**Still open — Sushi's call:** where the UI goes next. Function (search, chip filtering,
collapsible sections, keyboard nav), information already fetched and hidden (exam room and
duration, release times, the full credit ladder), or visual (course colours, a week grid).
Recommendation on file is function first, specifically search plus chip filtering, since a
real list runs past thirty rows with no way to narrow it. Also noted and untouched: the
health dots are hard to tell apart at 9px, yellow against green especially in dark mode —
shape or a letter would fix it.

### A worker on an older build killed the settings page (2026-09-11)

`TypeError: Cannot read properties of undefined (reading 'length')` on
`state.setAsideCourses`. That field arrived with Tier 0b.17; the page was build
20260911T011632 and the running worker was older, so it answered `get-options-state`
without it.

The crash was the symptom. The defect was that both UI surfaces treat a message from
another process as a typed object — `Response` is a compile-time claim about the
*sender's* build. Four sections had drawn and five had not, `refreshOptions` is called as
`void refreshOptions()` from a dozen controls so the rejection was uncaught, and the only
evidence was a line in a console most people never open, for a problem whose fix is one
click on chrome://extensions.

`src/core/compat.ts` normalizes every field a page dereferences and reports which were
absent, so the page renders and names the missing fields on screen. In core, not in the
UI, because it is a decision and the options page is as unreachable by the suite as
`background.ts` (worker rule 1). The popup had the same exposure and worse consequences —
no scrollback and no console, so a throw there is a blank rectangle — and it already
carried a hand-written `settings ?? DEFAULT_SETTINGS`, which is this defect found once and
patched at one call site; `items` and `sources` are dereferenced on the next two lines and
were unguarded. A *partial* settings object slipped past that guard too, so an older
worker's missing `hideSubmitted` would have read as "show everything". Both render paths
now catch and report into the one channel each surface has.

13 tests, 9 mutations, all killed — one only after adding the settings-backfill case it
first survived. Now house rule 8 for the worker and the loop.

## Two sources and an adapter mechanism added after Tier 0a

- **smartPhysics is a fifth source** (`src/sources/smartphysics.ts`), for PHYS 211–214,
  whose deadlines are at **8:00 AM** — the ones a 11:59 PM habit misses. It is a *source*
  and not an adapter because every course page is addressed by a per-student enrolment id,
  so no fixed adapter URL could serve two people; it gets a two-stage plan like
  Gradescope. Off by default, so a student who has never used it does not get a yellow
  "sign in" dot for a site they do not know. **Open:** the capture is a Fall 2025 course,
  because the account has no active enrolment, so the parser has never seen a live term.
- **`Adapter.columns`** reads a table's own header row instead of counting cells —
  house rule 3 in declarative form. It is what makes a table-shaped course page a
  five-minute job. It stops short of blind autodetection deliberately: ECE 310's own page
  has a column headed `Assessment Due` whose cells hold `HW1`, so anything scanning for a
  due-ish header reads an assignment name as a deadline.
- **Never-signed-in detection** for Gradescope and PrairieTest. Both answer 200 at the
  unchanged URL when the student has never signed in, so the parsers threw and the UI
  showed a red dot with nothing to click — see parser rules 11 and 12 in CLAUDE.md.

## Adapters — the delivery loop, now that the registry is live

Adding a course is: capture the page (public ones need no login), write the entry, push.
Every installed copy has it on its next daily refresh.

Shipped: `cs424-fa26`, `ece310-fa26`.

What is *not* generic, and why: course sites have no API, no feed and no shared markup, so
the judgement of which table and which column holds a deadline still needs a person once
per course. `columns` removes the mechanical half of that. The remaining per-course cost
is minutes for a table-shaped page; a prose page (CS 425 lists deadlines mid-sentence in
`<li>` items) still needs a schema field that does not exist yet.

**Next: Tier 0b items 18–20**, none of which need Sushi. Adapters two and three, the
Canvas term filter (now unblocked, see canvas-findings.md), the beta install kit, and G4.

Worth doing before handing this to ten people:

- ~~**The popup shows invented times as fact.**~~ **Done** in Tier 0a.5, and in three
  more places the note did not mention: the sort order, the calendar export and the
  reminders. Tier 0a.11 also found that some of those 23:59s were never assumed at all —
  the page stated a time and the date grammar matched past it.
- **`fixtures/sites/` has one seed and §4.5 wants 2–3.** One adapter is one shape of
  course page; the second is where the schema's gaps show up. `splitTitle` only exists
  because the first real page needed it.
- ~~**Two Options controls both read "Course websites"**~~ — **done** in Tier 0a.9. The
  per-source row is gone and the site source's health moved under Course websites.
- **G3 rests on a single merge.** See the gates section — the §5.3 BADGE_TOKEN trade is
  still unexercised, and G4 is what measures it.

## The first live run (2026-09-10)

Four defects in one day, none caught by the 382 tests passing at the time, three of them
in `background.ts`. Written up as house rules in CLAUDE.md; the short version:

| Defect | Why no test caught it |
|---|---|
| Bundled registry never read — no adapter could be enabled | Nothing tested that `dist/`'s copy was *loaded*, only that it was valid |
| `site: ok (0 items)` with no adapters enabled — a green dot over nothing | A test **asserted** `state: "ok"` for exactly this case |
| An invented 23:59 outranked a real Canvas deadline | Needs two sources at once; every fixture test runs one |
| Store queue deadlocked (`sync` → `reschedule` → `fireNotification`) | Lived in the worker, which the suite cannot reach |

The last one was ~20 minutes from wedging the extension on Sushi's machine: it fires the
first time a reminder comes due *during* a sync, and only default quiet hours (23:00–08:00)
were holding it off. It was found by tracing one runtime path across parallel agents —
bundle → storage → options → permission → sync → offscreen → popup — after reviewing
`background.ts` as a file had found nothing across four steps.

### The four defects, in detail
- **§4.5 bundled registry was never read.** The build copied `adapters/registry.json`
  into `dist/`, but the only code that filled `store.registry.adapters` was the daily
  GitHub fetch — and nothing is published at that URL yet. The stored list stayed empty,
  Options → Course websites listed nothing, and the CS 424 adapter could not be enabled,
  so no item was ever labelled WEB. The worker now seeds from the bundle when the stored
  list is empty; the remote fetch stays an *update*, never rolled back by the seed.

- **`site: ok (0 items)` was a lie.** With no adapter enabled, `syncSites` returned `[]`
  and the loop recorded `ok`, so the options page showed a green dot on a source that was
  fetching nothing. It now raises `SourceDisabled` and the loop records `disabled` —
  a third branch, because the failure branch would arm §6's backoff against a source that
  is merely switched off. The old behaviour was *asserted by a test*, which is how it
  survived a mutation-checked suite.
- **The bundle seed returned silently** when the store already had adapters, so a healthy
  store and a seed that never ran looked identical in the console. It logs both cases now.

### §5.3 amendment: an assumed time is the last resort, not the first
SOURCE_RANK puts `site` above `canvas` for `dueAt`, on the reasoning that the system a
student submits in owns its deadline. That holds only while the site *states* a time.
CS 424's schedule prints "HW1 Due" against a bare date, §4.5's runner fills in 23:59, and
the merged CS424 HW1 row therefore showed an invented instant in place of the real Canvas
one — looking authoritative while being wrong. `parseAdapterDateParts` now reports
`timeAssumed` and the runner records it in `extra`; `dedupe` prefers any member with a
stated instant and falls back to an assumed one only when it is the only instant there.
A site that does print a time still wins, as §5.3 intends.

### Three worker defects found by the path trace
All three lived in `background.ts`, the one file the suite cannot reach. The store queue
is now `core/queue.ts` so it can be.
- **The store queue deadlocked.** `sync()` held it for a whole run and called
  `reschedule()` → `fireNotification()`, which asked for it again; the inner request
  chained onto a tail that could not resolve until the outer work returned. It wedged
  permanently — `running` never cleared, so every later sync returned `skipped` until
  Chrome tore the worker down. It fires the first time a reminder comes due *during* a
  sync; on live data that was ~20 minutes away. `withStore` is now re-entrant.
- **`set-adapter-enabled` wrote the store outside the queue**, so ticking a course site
  while a sync was in flight was overwritten seconds later and the checkbox sprang back
  with no error. Same for `refresh-registry`. Both queued now, and enabling an adapter
  clears §6's backoff for the source.
- **A failing registry refresh retried on every sync** (the seed leaves `fetchedAt`
  unset by design). `registry.attemptedAt` now rests a failure without faking a success.


## Shared parser primitives
`src/core/parsing.ts` holds the rules that were previously written three or four times
each across the source modules — and reintroduced as defects after being fixed
elsewhere: `parseField` (a bad value costs its field, not the page), `KeyGuard`
(duplicate `sourceId` on one page), `sameOriginHttpsUrl`, `looksLoggedOut`, `isInstant`,
`nonEmpty`, `textOf`. Each is now pinned by tests from three or four different source
test files at once. The house rules they encode are in CLAUDE.md.

## Blocked on Sushi — the gates
- **G2 recall — PASSED.** 100% recall on live data, no phantom items. Canvas contributed
  0 items on the day it was measured, which was a pass rather than a failure because
  none of the 67 assignments captured on Sep 3 carried a due date.
  **Canvas is no longer empty** (`[sync] canvas: ok (1 items)`, 2026-09-10), so that
  exemption has expired: a Canvas source reporting 0 items is now something to explain
  like any other empty source. The stronger claim this note used to lean on — that
  Canvas "cannot contribute any" deadlines on this account — was an overreach and is
  corrected in [canvas-findings.md](docs/canvas-findings.md).
- **G3 dedupe — PASSES, on n=1.** Confirmed 2026-09-10, once course sites were finally
  running. The list holds exactly **one** cross-source merge, `CS424 · Homework 1` from
  Canvas + the CS 424 site (`CV WEB`), and Sushi confirmed it is the same assignment.
  One merge opportunity, one correct merge, **zero corrections** — inside §9's budget of
  two, but the budget was never tested. Nothing was under-merged either: no other item on
  the list has a counterpart in a second source.

  **This does not retire the threshold question.** §9's ≤2 corrections is meant to be
  measured against many merge opportunities; one is not a sample. The BADGE_TOKEN trade
  below is still unexercised in the wild — nothing on this account produced a `{mp2}` vs
  `{mp2, checkpoint}` shape. G4's ten testers are what actually measures this, and §5.3's
  threshold stays open until then.
- **G4 beta / G5 store** — both need Sushi and neither can start from here.

## Spec amendment made in step 7 — still not confirmed by G3
§5.3's "a subset match needs ≥ 2 tokens" rejected **both** pairs the spec names as its own
purpose, because §5.2 step 3 collapses `Lab 3` into the single token `lab3`:
`Lab 3`/`Lab 3 Report` (§5.3: "will merge, which is correct") and
`Homework 3`/`HW3 Errors and Big-O` (§4.3: the badge match "is the point").
`dedupe.ts` now also accepts a single *badge* token — letters bound to a number.

**This is a trade, not a free win**, and an earlier version of this note wrongly claimed
otherwise. The ≥2-token rule also bounded the *larger* side, and dropping it lets `{mp2}`
merge into `{mp2, checkpoint}`. The claim that "a badge is unique within a course" is
also falsified by this repo's own fixture: CS 357 ships both `GA 0` and `GA00`, which
§5.2 collapses to the same token. What keeps the trade survivable is the same-source
group check added after the review — §5.3's "never two rows from one source" is a
property of the *group*, and union-find was routing around the pairwise test.
§5.3 makes G3 the arbiter of the threshold itself — and G3 passed with a single
merge, which does not exercise this trade at all. It remains G4's job.

## VERIFY (§12-style, needs your browser eventually)
**Does PrairieTest render the "Exams available for reservations" card at all for a student
with no CBTF-enabled courses?** Both captures come from an account that has them, so
"both cards always render, empty or not" rests on n=1 for that card's empty case. The
parser now treats a missing card as a `ParseError`. If the assumption is wrong, a
non-CBTF beta tester would see a spurious red dot rather than a clean empty state — worth
checking at G4 rather than now.

## Decisions taken
- **Canvas scope** (2026-09-03): planner-only as specced, even though it yields 0 items
  on this account; mapping tested against a clearly-labelled synthetic fixture until
  real planner data appears at G4.
- **§3.1 `sourceId`** (2026-09-03): amended per source, with costs, in
  [sourceid-decision.md](docs/sourceid-decision.md).

## Open decision — RESOLVED and IMPLEMENTED 2026-09-10 (Tier 0b.17)
**§4.1's concluded-course filter.** `include[]=term` was captured
(`fixtures/canvas/courses-active-term.json`) and it settles the design: the real term
(262, `2026 - Fall`) carries real dates, while the stale course's term (109, `OPEN`)
has **null start and end** — an unbounded term, which is never "concluded". So the
filter keeps courses whose term brackets today, sets aside unbounded-term courses only
when a current term exists, and fails open when none does. Details and the code
consequences in [canvas-findings.md](docs/canvas-findings.md). Shipped: `coursesUrl()`
asks for `include[]=term`, `currentTermCourses` applies the rule, the loop drops planner
rows for held-back courses, and Options → Courses → **Older courses** lists what was held
back with a "Put back" button for anyone legitimately enrolled across two terms.

## Spec amendments forced by real data
- **§4.5** — the schema is `rows` plus exactly one date *locator* (`columns.due`,
  `dueSlot`, `duePrev`, or the `due` selector) and one *reader* (whole, `dueLabel`,
  `duePhrase`), not a pair of selectors: CS 425 prints its deadlines mid-sentence, ECE 374 A's
  date is the `<dt>` before the row, CS 424 has no header to name. `defaultTime` is a
  page-level clock the row still reports as assumed. And `minExtensionVersion` gates an
  entry: an install older than the field an entry uses drops it with a logged reason.
  (2026-09-20, from three public captures.)
- **§4.1 / §5.3** — Canvas `course_code` is an opaque slug (`cs_357_120268_263847`), not
  `"CS 225"`. §5.1 runs against `name` instead, and `courseLabel` must not use it.
- **§4.1** — no `while(1);` prefix on this deployment. Keep the detection, don't require it.
- **§4.3** — the credit table has a header row and no `<tbody>`; the 0-credit row's End
  is an em dash, not empty; `lateDueAt` must skip a 0-credit tier.
- **§4.4** — the *booked* row links to `/pt/student/reservation/{id}` and has no exam id;
  the *available* row's "Make a reservation" button links to `/pt/student/exam/{id}`.
  Both the exam instant and the reservation window are machine-readable JSON
  (`data-format-date`, `data-format-date-range`), so neither of §4.4's regexes nor
  §3.2's year inference is needed here — and the visible text is not even a fixed
  format ("today, 9pm (CDT)" on the day). The empty-card text in the spec belongs to the
  *other* card; there is one wording per card. A third card exists.
- **§4.2 / §3.1** — a Gradescope row is a `<button data-assignment-id>` before submission
  and an `<a>` after; both carry the same id. The hidden "Due Date" column is
  state-dependent and must not be used as `dueAt`.
- **§5.3** — `SOURCE_RANK` assumes every instant is one its source *stated*. §4.5's runner
  fills in 23:59 for a course page that prints a bare date, so a member whose time was
  assumed is now the last resort for `dueAt`, not the first choice. A site that prints a
  real time still outranks Canvas, as §5.3 intends. (2026-09-10, found on live data.)
- **Piazza (docs/piazza-findings.md)** — class discovery reads the class page's
  `const USER` object, not the session JWT; and "current" is `term_key` against the
  clock, because `status` stays `active` after a term ends. (2026-09-18, from the capture.)
- **Piazza (docs/piazza-findings.md)** — the signed-out marker is positive (the splash's
  login form with its literal `/class` action); a page with neither it nor `const USER` is
  a `parse_error`. (2026-09-18, from the signed-out capture.)
- **§3.2 / announce.ts** — a bracketed weekday between a calendar date and its clock
  ("9/20 (Sun) 11:59 pm") is part of the date, not a prose boundary: the clock is stated,
  and the weekday is cross-checked like a prefix weekday. (2026-09-18, from the running post.)
- **Piazza (docs/piazza-findings.md)** — a post's modification signal is the last
  create/update entry of the feed entry's `log[]`, not `modified`, which moves on every
  follow-up. (2026-09-18, from both captures.)
- **Piazza (docs/piazza-findings.md)** — a re-read body's `postedAt` is the version's own
  `history[0].created`, not the post's creation; relative phrases in an edit resolve
  against the edit. And a per-class 403 is that class's failure, not the session's.
  (2026-09-18, from both captures and the trace.)

## §12 open questions
- ~~1. PrairieLearn access-details in fetched HTML~~ — **yes**, resolved 2026-09-03.
- ~~2. PrairieTest available-row link~~ — **resolved**, and the question was mis-framed.
- ~~3. Gate 0 extension-context half~~ — **passed**.
- 4. PrairieLearn credit-string shapes in other courses — only CS 357 captured.
- 5. Any Moodle or client-rendered course sites this term — PrairieTest turned out to be
  server-rendered, so that worry is retired for it.

## Dev-loop note
Chrome caches the service worker until you press Reload on the extension card, so a
rebuilt page can talk to an old worker. Every bundle carries a build id and the UI says
**STALE SERVICE WORKER** when they disagree. → [dev-loop.md](docs/dev-loop.md)
