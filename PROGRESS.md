# Progress

Spec: SPEC.md. Build order §10, gates §9. Detailed evidence lives in `docs/`.

`npm run build`, `npm run typecheck`, `npm test` (186 tests) all pass.

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

## Fixtures captured

| Source | Files | Notes |
|---|---|---|
| Canvas | `courses-active.json`, `planner-items-empty.json`, `assignments-cs357.json`, `assignments-cs425.json`, `planner-items-SYNTHETIC.json` | Planner is genuinely `[]`; 0 of 67 assignments carry a date. The synthetic fixture is hand-written — see `fixtures/canvas/README.md`. |
| Gradescope | `dashboard.html`, `course-1352838.html` | 15 courses / 5 terms; PHYS435 with 2 assignments covering both the submitted and unsubmitted row shapes. |
| PrairieLearn | `assessments-cs357.html` | 8 assessments, all 8 credit popovers present. |
| PrairieTest | `home-booked-none-available.html`, `home-booked-and-available.html` | Sep 3 and Sep 10. Between them the student rescheduled Quiz 1, so the pair is live evidence for the §3.1 amendment. The Sep 10 capture has the first available-card row ever seen. |

## Next
Step 7 — `normalize.ts` §5.2 title normalization + `dedupe.ts` (union-find merge,
overrides), then step 8 (store + sync loop + popup) where **G2 and G3** are decided.

## Blocked on Sushi
1. **Nothing blocking.** The last outstanding capture (a PrairieTest available-card row)
   landed 2026-09-10.
2. **No commits yet** — 60+ files, no history. Worth doing before step 7 touches the
   dedupe core.
3. Later: **G2 recall** and **G3 dedupe** at step 8 are hands-on and cannot be automated.

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

## Open decision (due at step 8)
**§4.1's concluded-course filter** cannot be built from what Canvas returns — the stale
FA25 course reports `workflow_state: available`, a future `end_at` and an active
enrolment. Only `enrollment_term_id` separates it. Options in
[canvas-findings.md](docs/canvas-findings.md); lean is adding `include[]=term`.

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
