# PrairieLearn — what the fetched HTML actually contains

Source: `fixtures/prairielearn/assessments-cs357.html`, captured 2026-09-03 from
`/pl/course_instance/224254/assessments` (CS 357, Fall 2026), 33643 B scrubbed.
8 assessments, 8 credit popovers.

## Open question 1 — RESOLVED: the credit schedule is in the fetched HTML

Every `?` button carries the whole access-details table in `data-bs-content`, as an
HTML-escaped string, server-rendered. §4.3's **primary** path is available; the
cell-text regex stays as the documented fallback.

```html
<td class="text-center align-middle">
  100% until 23:59, Sat, Sep 5
  <button data-bs-toggle="popover" data-bs-html="true"
          data-bs-title="Access details"
          data-bs-content="&lt;table class=&#34;table&#34; aria-label=&#34;Access details&#34;&gt;…">
    <i class="fa fa-question-circle"></i>
  </button>
</td>
```

`getAttribute("data-bs-content")` returns the decoded HTML, so the parser needs a
second `DOMParser` pass over that string. The button sits inside the credit `<td>`,
so a row's schedule is found by containment — no id matching needed.

## Three differences from the §4.3 example

1. **The table has a header row.** `<tr><th>Credit</th><th>Start</th><th>End</th></tr>`,
   and there is no `<tbody>` in the source (the spec's example showed one; `DOMParser`
   will insert one anyway). Select data rows as "rows with `td`s", not "rows in tbody",
   and skip any row containing `th`.
2. **The 0-credit row's End is an em dash `—`, not empty.** §4.3 says "the last row
   (0 credit) has no end". It has a placeholder. Parsing `—` as a date must yield
   "no end", not a ParseError.
3. **`lateDueAt` must skip a 0-credit tier.** §4.3 says `lateDueAt` = End of the row
   immediately after the highest-credit row. In one real case that next row is the
   0-credit row, whose End is `—`. Semantically there is no late deadline there, so
   the rule needs "…and only if that row's credit is above 0".

Observed schedules across the 8 assessments — the shapes the parser must handle:

| Tiers | Count | `dueAt` | `lateDueAt` |
|---|---|---|---|
| `100` only | 1 | End of the 100 row | none |
| `100 → 0` | 1 | End of the 100 row | none (next tier is 0) |
| `100 → 80 → 50 → 0` | 3 | End of the 100 row | End of the 80 row |
| `100 → 96 → 50 → 0` | 3 | End of the 100 row | End of the 96 row |

Confirmed as specified: the date format `2026-08-27 12:40:01 (CDT)` matches §4.3's
regex; seconds really do carry `:01` on some starts; and the zone abbreviation flips
`CDT → CST` at `2026-12-09`, so §3.2's per-date offset lookup is required rather than
a fixed −05:00.

## A §3.1 problem: the row link is not always an assessment link

§3.1 says the PrairieLearn `sourceId` is the assessment id from
`/pl/course_instance/{ci}/assessment/{aid}`. The captured rows link to
**`/pl/course_instance/224254/assessment_instance/14550415/`** — an *assessment
instance* id, which exists only once the student has started the assessment.

So the link shape changes from `/assessment/{aid}` to `/assessment_instance/{iid}`
the first time a student opens something. Deriving `sourceId` from the href would
change the `memberKey` at that moment, which §3.1 requires to be stable: every
override on that item (hide, merge, split) would break and its `notified` record
would reset, re-firing notifications. **Needs a decision before the parser is
written** — see PROGRESS.md.

## Selectors worth using

Stable hooks exist and beat the colour classes:

- badge: `[data-testid="assessment-set-badge"]` (the class is `badge color-brown3` —
  `color-brown3` encodes colour, not meaning, exactly like Gradescope's
  `submissionStatus-*` modifiers in §4.2)
- score: `[data-testid="scorebar"]`, containing `.progress-bar` with a `width:N%`
  style and the same percentage as text
- title: the `<a>` in the second cell; `(NOT FOR CREDIT)` appears in the link text as
  §4.3 predicted, so `extra.forCredit` works off the title as specified

## Amendment 2026-09-18 — a partial score is not "done" (roadmap I37)

**What §4.3 said, and what it now says.** The status rule read: *"a percentage bar
`> 0%` → `graded` (PrairieLearn grades on the spot, so this is 'done' for our
purposes)"*. The line has been rewritten in place, not annotated: **full marks** are
done, `0` is not started, and anything in between is done **only when no credit tier
with credit above 0 is still open at fetch time**. A still-open partial row is
`not_submitted` and carries `extra.scorePercent`, which the popup renders as "40% so
far". *("Full marks" read `>= 100` when this was written, which the 2026-09-21
amendment below corrects: past the full-credit window, full marks is the open tier's
credit.)*

**The evidence.** PrairieLearn homework is resubmittable: the credit schedule on this
very capture runs `100 → 80 → 50 → 0`, so a student sitting at 40% with the 80% tier
open can still take the row to 100. Under the old rule that row was `graded` — filtered
out of the list by "hide done" the moment the first question was answered, in exactly
the window where it most needed to be on it. The closed case is the mirror image: once
every tier with credit has ended, nothing the student does changes the score, and a row
that can never be cleared is worse than one hidden a day early. Decision by Sushi.

**Where it is decided.** At parse time, in `mapStatus`/`creditCeiling`
(`src/sources/prairielearn.ts`) — not in `dedupe.ts`'s `isItemDone`, which I37's
"Touches" line suggested. `isItemDone` sees a merged item and no clock; openness is a
fact the page states, about one source's row, at the instant it was fetched.

**The strongest objection, recorded rather than papered over.** *The table cannot tell a
retake-to-100 homework from a one-shot quiz that ended at 40.* Both render a sub-100 bar
with a tier still open — a quiz whose access window runs to the end of the module, but
which allows one attempt, is indistinguishable in this markup from a homework with
unlimited attempts. Nothing on the assessments page states the attempt limit; only the
assessment page itself does, and fetching it per row is a second request per assessment.
The badge (`extra.badge`, from `assessment-set-badge`: `HW3`, `Q1`, `E1`) is the only
hint available here, and it is a heuristic — courses name their sets freely — so it is
**not** used. The consequence is a known false positive: a one-shot quiz scored 40% with
its window still open stays on the list until the window closes, at which point it goes
`graded` on its own. That is the direction the error was chosen to fall, since the
opposite failure hides work that can still be fixed.

**The fixture.** `fixtures/prairielearn/assessments-cs357.html` has seven score bars and
they read only 0%, 100% and 103%, so a `> 0 → graded` implementation and the amended one
are indistinguishable against it (house rule 10). The constructed
`fixtures/prairielearn/assessments-partial-scores.html` supplies the missing rows —
40% with an open 80% tier, 40% with everything closed, 100% with an open tier, and 40%
with no access details at all — and its README says plainly that it is not a capture.

## Amendment 2026-09-21 — full marks is the ceiling, not 100

**What was wrong.** The amendment above compares the score against **100**, and 100 is
only the ceiling while the full-credit window is open. PrairieLearn caps what a
submission earns at the running tier's credit, so once the 100% window has passed and an
80% one is running, **80 is full marks** — there is nothing left to earn, and the rule
above called the row `not_submitted` anyway. Sushi's own CS 357 list, 2026-09-21: seven
lectures and homeworks scored at their cap sat in the Late band for up to ten days
("HW4b IEEE 754 Standard — 10d late"), each one telling him to go and redo finished
work. *"there needs to be a way for it to detect the max score on prairielearn and if the
user has gotten that score, like for example some max scores can only be 96%, etc. after
a missed deadline, and if the user gets that number then it should still be marked as
done."*

**The rule now.** `creditCeiling(now, tiers, cell)` answers "what is the most this row
can reach at `now`": the **highest-credit tier inside its window**, `0` when the page
states a schedule and none is open, and `undefined` when the page states nothing.
`mapStatus` takes that instead of a boolean and calls the row done at `percent >=
ceiling`. The three answers stay distinct on purpose — `undefined` keeps the old
behaviour (compare against 100), because a row we could not read must be neither closed
nor re-opened on a guess (worker rule 3).

Two deliberate asymmetries:

- **100% is done before the ceiling is consulted.** PrairieLearn writes credit *above*
  100 for an early-submission bonus, and a student sitting on a finished 100 with a 110%
  tier open must not be told the work is unfinished.
- **The tolerance is 0.01 points, not a rounding rule.** The score bar's width comes back
  as `79.99999999999999` for a page that prints 80, and a hundredth of a percent cannot
  separate two scores a student would tell apart. Anything larger would start calling a
  genuinely short score full marks, which is §11's failure in its quietest form: 79.5
  against an 80 cap stays open.

**Saying why.** A row flipping from "10d late" to "done" with nothing on screen to
justify it is the same silent-state problem one surface over. `mapStatus` sets
`extra.scoreCeiling` **only** where the cap is what finished the row, so it doubles as
the reason: the popup draws "80% was full marks", and it is in every export. Being set
only on those rows is what makes it usable as a condition — a plain 100% never carries
one, and neither does a closed row graded because nothing is open.

That note also *displaces* the credit wording rather than yielding to it, which every
other note does. A cell-only entry finished at its cap has no `dueAt`, so it took the
"`${credit}% credit remaining`" branch and announced credit remaining on work with none.

**What this does not change.** The known false positive above stands: a one-shot quiz
scored 40% with an 80% tier open is still indistinguishable from a resubmittable
homework, and still stays on the list. The ceiling only decides what *counts* as
finished, never how many attempts remain.

## The student home page — 2026-09-27 (roadmap I46)

**What is captured and what is not.** No `/pl/` home capture exists, signed in or out.
Everything below is read from PrairieLearn master's *source* on 2026-09-27
(`apps/prairielearn/src/pages/home/home.html.tsx`, `components/HomeCards.tsx`,
`components/StudentCoursesCard.tsx`, `components/EmptyStateCards.tsx`, `home.sql`, and
`packages/react/src/server.tsx` for `<Hydrate>`), and the three home fixtures are
**constructed** from those templates (`fixtures/prairielearn/README.md`). Production may lag
master; the day a real capture lands it supersedes them.

**Why it matters.** Sushi, 2026-09-27: *"prairielearn also shows unable to read when theres
no classes/assignments on there."* §4.3 step 1 was a regex over the whole home body for
`/pl/course_instance/(\d+)`, and zero hits threw `ParseError` — "Couldn't read", a red badge
and §6's backoff for every student with no current PrairieLearn course. `home.sql` keeps an
instance on the student list only while `$req_date` is inside its dates, so every CS student
meets that page over a term break.

**The shape.**

- The **instructor card** (`Courses with instructor access`,
  `table[aria-label="Courses with instructor access"]`) is rendered *outside* `<Hydrate>`.
  Its instance links are `/pl/course_instance/{id}/instructor`, and expired instances sit
  under `<details><summary>Older instances</summary>`. The old regex matched both, so a
  TA fetched every instance they ever staffed. None of these are enrolments.
- `<Hydrate>` emits **two** elements with `data-component="HomeCards"`: first a
  `<script type="application/json" data-component-props>` with the superjson props (bare
  `"id"` strings, `urlPrefix: "/pl"`), then the `<div class="js-hydrated-component">` with
  the server-rendered markup. `querySelector('[data-component="HomeCards"]')` returns the
  **script**; the parser takes the first non-script match.
- Inside the region, one of three student-side shapes:
  1. `StudentCoursesCard` with `table[aria-label="Courses"]` (or `"Courses with student
     access"` when the student also has instructor courses). One `<tr>` per course; an
     accessible row links `/pl/course_instance/{id}`; an **invitation** row has no link, an
     "Invitation" badge, and a form with `input[name="__action"][value="accept_invitation"]`
     (and the colour class `table-warning`, which is not used as a hook).
  2. `StudentCoursesCard` with no table and a direct `.card-body` reading "No courses found
     with student access. …" — only when the student has instructor courses. (The plain "No
     courses found." branch is unreachable from `HomeCards`, but is read the same way.)
  3. `EmptyStateCards` — two cards; the student one has `h3.card-title` "Students" and
     `p.card-text` "Add a course and start learning." A student with no course at all always
     gets this (`hasCourses = studentCourses.length > 0 || hasInstructorCourses`).
- Anonymous `GET /pl/` answers **302 → `/pl/login`** (curl, 2026-09-27), so the existing
  `loginPath` marker already covers never-signed-in (parser rule 11); the empty case needs a
  signed-in student with no course.

**The parser** (`parseHome` in `src/sources/prairielearn.ts`) reads the student table first,
so a course *titled* "Add a course and start learning." is a course (parser rule 12), then
the two empty markers exactly and on their smallest elements, and throws when the region is
missing, the table has no rows, a row has no enrolment link, or the region has neither a
table nor a marker (parser rule 2). "Add course" is never a marker: that button is in the
healthy card's header too.

**The state.** An empty reading is the source state `empty` (SPEC §3 as amended): read fine,
nothing for this student. No failure counted, no backoff, rows dropped, `lastSuccessAt`
stamped, re-read every poll so joining a course flips it to `ok` unaided. `lastError` carries
one of three sentences (`emptyReason`).

**An empty assessments page is `[]`.** Upstream `studentAssessments.html.tsx` always renders
the `<thead>`, so a course with nothing published is a header-only table, which
`parseAssessments` returns as `[]` (pinned by `assessments-empty-CONSTRUCTED.html`). A held
row from an instance the home no longer lists does not trip the N→0 guard; one from a listed
instance still does.

**Unsettled.** Whether PrairieLearn answers 403 in place for an instance a student cannot
open — `looksLoggedOut` treats any 403 as needs_login. Moot for instructor instances now that
they are never fetched; no capture of a PL 403 exists.
