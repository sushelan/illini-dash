# Progress

Spec: SPEC.md. Build order §10, gates §9. Detailed evidence lives in `docs/`.

`npm run build`, `npm run typecheck`, `npm test` (901 tests) all pass.

**Steps 1–12 are done. G0–G3 have passed. G4 and G5 are Sushi's and cannot start
from here.**

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
