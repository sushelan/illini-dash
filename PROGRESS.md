# Progress

Spec: SPEC.md. Build order §10, gates §9. Detailed evidence lives in `docs/`.

`npm run build`, `npm run typecheck`, `npm test` (388 tests) all pass.

**Steps 1–12 are done. G0–G3 have passed. G4 and G5 are Sushi's and cannot start
from here.**

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
| 8 — store + sync + popup | `src/core/store.ts` (§3 schema, migrations, §6 backoff), `src/core/sync.ts` (§6 loop, injected fetch/parse/clock), `src/ui/grouping.ts` + `popup.ts` (§8.1). 32 tests, driven end-to-end by the real fixtures. Review in flight. |

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
| Canvas | `courses-active.json`, `planner-items-empty.json`, `assignments-cs357.json`, `assignments-cs425.json`, `planner-items-SYNTHETIC.json` | Planner is genuinely `[]`; 0 of 67 assignments carry a date. The synthetic fixture is hand-written — see `fixtures/canvas/README.md`. |
| Gradescope | `dashboard.html`, `course-1352838.html` | 15 courses / 5 terms; PHYS435 with 2 assignments covering both the submitted and unsubmitted row shapes. |
| PrairieLearn | `assessments-cs357.html` | 8 assessments, all 8 credit popovers present. |
| Course site | `cs424-fa2026-schedule.html` | Real capture, 2026-09-10. Shibboleth-protected; answers 401 in place rather than redirecting. Drives the `cs424-fa26` seed adapter: 9 deadlines, all dated, across the CDT→CST flip. |
| PrairieTest | `home-booked-none-available.html`, `home-booked-and-available.html` | Sep 3 and Sep 10. Between them the student rescheduled Quiz 1, so the pair is live evidence for the §3.1 amendment. The Sep 10 capture has the first available-card row ever seen. |

## Next

**G4** — 10 beta users across ≥3 majors for a week, ≥7 saying they would keep it. Then
**G5**, which §9 gates behind it.

Worth doing before handing this to ten people:

- **The popup shows invented times as fact.** Every CS 424 row reads 11:59 PM and the
  course states no time at all. `extra.timeAssumed` stops it overriding a real deadline
  (§5.3 amendment above) but the UI still displays it plainly. A tester will trust it and
  miss a 5 PM cutoff — this is the §11 "silent missing deadline" risk wearing a different
  hat. Natural to fold into the UI pass Sushi has asked for.
- **`fixtures/sites/` has one seed and §4.5 wants 2–3.** One adapter is one shape of
  course page; the second is where the schema's gaps show up. `splitTitle` only exists
  because the first real page needed it.
- **Two Options controls both read "Course websites"** — the per-source row and the
  adapter list. Sushi ticked the wrong one, which is what sent the first live sync into a
  green dot with nothing behind it. Rename or drop the source row: `set-adapter-enabled`
  owns that flag anyway.
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
  0 items and that was a pass, not a failure: 0 of 67 assignments carry a due date
  (docs/canvas-findings.md).
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

## Open decision — still open, now due before G4
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
