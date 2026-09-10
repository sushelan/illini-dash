# §3.1 amendment — stable `sourceId` per source

Approved by Sushi 2026-09-03. §3.1 requires `memberKey = ${source}:${sourceId}` to be
stable across re-scrapes, or "every override breaks on the next sync" and each item's
`notified` record resets, re-firing notifications the student already saw.

Three of the four sources link to ids that change under ordinary student behaviour.
The amended rules:

| Source | §3.1 as written | Amended rule | Why |
|---|---|---|---|
| Canvas | `${plannable_type}:${plannable_id}` | unchanged | Stable; implemented in step 5. |
| Gradescope | assignment id from the row link, else `hash(courseId + normalizedTitle)` | assignment id from the row link **or** the submit button's `data-assignment-id` | The row is an `<a>` once submitted and a `<button>` before; both carry the same assignment id, so reading either keeps the key stable. The hash fallback stays only for a row with neither. |
| PrairieLearn | assessment id from `/pl/course_instance/{ci}/assessment/{a}` | `${courseInstanceId}:${badge}` | Rows link to `/assessment_instance/{iid}`, which only exists once the student opens the assessment — the href changes mid-semester. Badges (`HW3`, `PQ1`, `L4a`) are the course's own identifiers and do not churn. |
| PrairieTest | exam id from the exam link; booking items `${examId}:booking` | `hash(normalizedExamTitle)`; booking items `${that}:booking` | There is no exam link at all; the row links to `/pt/student/reservation/{rid}`, which changes if the student cancels and rebooks. |

Evidence: [prairielearn-findings.md](prairielearn-findings.md),
[prairietest-findings.md](prairietest-findings.md),
[gradescope-findings.md](gradescope-findings.md).

## Known cost of the amendment

The PrairieLearn and PrairieTest keys are now content-derived, so §3.1's stated
limitation for course sites applies to them too: **if staff rename an assessment or an
exam, the key changes and any hide/merge/split on it is lost, and its notifications can
re-fire.** That is strictly better than the alternative, where the key changes for every
student the moment they open the assessment or rebook a seat — an event that is certain,
rather than rare.

A PrairieLearn badge is unique within a course instance in every capture seen so far
(8 assessments, 8 distinct badges). If a course ever ships two rows with the same badge,
the second would collide with the first; the parser must detect a duplicate key within
one page and raise `ParseError` rather than silently dropping a row (§0 rule 3).
