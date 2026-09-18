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
purposes)"*. The line has been rewritten in place, not annotated: `>= 100` is done, `0`
is not started, and anything in between is done **only when no credit tier with credit
above 0 is still open at fetch time**. A still-open partial row is `not_submitted` and
carries `extra.scorePercent`, which the popup renders as "40% so far".

**The evidence.** PrairieLearn homework is resubmittable: the credit schedule on this
very capture runs `100 → 80 → 50 → 0`, so a student sitting at 40% with the 80% tier
open can still take the row to 100. Under the old rule that row was `graded` — filtered
out of the list by "hide done" the moment the first question was answered, in exactly
the window where it most needed to be on it. The closed case is the mirror image: once
every tier with credit has ended, nothing the student does changes the score, and a row
that can never be cleared is worse than one hidden a day early. Decision by Sushi.

**Where it is decided.** At parse time, in `mapStatus`/`creditStillOpen`
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
