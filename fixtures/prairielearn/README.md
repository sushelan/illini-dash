# PrairieLearn fixtures

## `assessments-cs357.html` — a real capture

`GET https://us.prairielearn.com/pl/course_instance/224254/assessments`, signed in,
captured 2026-09-03. Unmodified. Evidence and amendments are in
`docs/prairielearn-findings.md`.

Its seven score bars read **0%, 100% and 103%** and nothing else, which is why the
file below exists.

## `assessments-partial-scores.html` — **constructed, not a capture**

Written by hand for roadmap I37 ("a partial PrairieLearn score is not done", Sushi
2026-09-18). Parser house rule 10: against the real capture a `> 0 → graded` rule and
a `>= 100 → graded, partial → depends on the credit window` rule are **indistinguishable**,
because the capture contains no bar strictly between 0 and 100. A test over it alone
would pass against the implementation the amendment replaces, so it would not be a test.

The four rows are deliberately unrealistic in that no single real course page would
line them up this way. Read against `page.fetchedAt = 2026-09-03T05:34:00.000Z`:

| Badge | Score bar | Credit window | Expected |
|---|---|---|---|
| PS1 | 40% | 100% closed Sep 1, **80% open until Sep 10** | `not_submitted`, `extra.scorePercent = "40"` |
| PS2 | 40% | 100% closed Aug 27, then a 0-credit tier with no End | `graded`, `extra.scorePercent = "40"` |
| PS3 | 100% | same open 80% tier as PS1 | `graded`, no `scorePercent` |
| PS4 | 40% | no popover and an empty credit cell | `graded`, `extra.scorePercent = "40"` |

PS3 is the row that kills a `> 0` mutation the other way round, and PS4 pins the
"openness not stated → treat as closed" default, which keeps an unreadable row from
being re-opened on a guess.

Everything else on the page (head, wrapper markup, badge markup, popover escaping) is
copied from the real capture so the selectors under test are the real ones.
