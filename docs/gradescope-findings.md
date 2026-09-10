# Gradescope — what the fetched HTML actually contains

Sources, captured 2026-09-03 and audited:
- `fixtures/gradescope/dashboard.html` (16 KB) — 15 courses across 5 terms
- `fixtures/gradescope/course-1352838.html` (29 KB) — PHYS435, Fall 2026, 2 assignments

## Dashboard — §4.2 confirmed, with two traps

```html
<div class="courseList">
  <div class="courseList--term">Fall 2026</div>
  <div class="courseList--coursesForTerm">
    <a class="courseBox " href="/courses/1353501">
      <h3 class="courseBox--shortname" title="CS425 ECE428 Fall 2026">CS425 ECE428 Fall 2026</h3>
      <div class="courseBox--name" title="Distributed systems">Distributed systems</div>
      <div class="courseBox--assignments"><div class="left">0 assignments</div></div>
    </a>
```

§4.2's claim holds: terms are `div.courseList--term`, courses live in the following
`div.courseList--coursesForTerm`, and **the current term is first in DOM order**.
Observed order: Fall 2026 (2), Spring 2026 (3), Fall 2025 (6), Spring 2025 (3),
Fall 2024 (1). Taking the first group gives 2 courses, so the whole source costs
3 requests per sync.

**Trap 1 — `.courseBox` is not always a course.** The "add a course" control is
`<button class="courseBox courseBox-new js-enrollInCourse">`, sharing the class and
carrying no href. Select `a.courseBox[href^="/courses/"]`, never `.courseBox`.

**Trap 2 — shortnames are not always course codes.** One reads
`ece_408_120261_257494`, the same opaque-slug pattern Canvas uses
(docs/canvas-findings.md). §5.1 correctly declines it. Cross-listings appear as
`CS425 ECE428 Fall 2026` and `CS446/ECE449`, both of which §5.1 resolves to two codes.

**Unspecified and useful:** `div.courseBox--assignments` states `0 assignments` /
`2 assignments`. A course with 0 can be skipped without fetching it, removing a request
per empty course.

## Course page — §4.2's row rules confirmed

Header: `courseHeader--title` = `PHYS435`, `courseHeader--term` = `Fall 2026`, and the
literal text `Course ID: 1352838`, exactly as §4.2 describes.

Rows are `tr` containing `th.table--primaryLink`, and that selector correctly excludes
both the `thead` row and a second, unrelated `dropzonePreview` table on the same page.

The `<time>` rules hold exactly as written: due and late-due share the class
`submissionTimeChart--dueDate` and are discriminated by the `aria-label` prefix
(`Due at …` vs `Late Due Date at …`), and `datetime` is §3.2's format
(`2026-09-02 17:00:00 -0500` — space separator, offset without a colon).

## §3.1 correction: the row control changes when the student submits

The two rows in one course are represented differently:

| Row | State | Control | Assignment id from |
|---|---|---|---|
| Homework 1 | Submitted | `<a href="/courses/1352838/assignments/8398957/submissions/000000000">` | href |
| Homework 2 | No Submission | `<button class="js-submitAssignment" data-assignment-id="8398958" data-assignment-title="Homework 2">` | `data-assignment-id` |

§3.1 says to use the id "from the row link … if the row has no link (unsubmittable),
`hash(courseId + normalizedTitle)`". That reads the absence of a link as
*unsubmittable*; it actually means **not yet submitted**. So:

1. The hashed fallback is unnecessary for these rows — `data-assignment-id` carries the
   real id.
2. More importantly, **a row changes representation the moment the student submits.**
   Reading the id from only one of the two would change the `memberKey` at submit time,
   breaking overrides and re-firing notifications. Both forms carry the *same*
   assignment id, so reading either keeps the key stable. This is the same hazard found
   on PrairieLearn and PrairieTest, and the only one of the three that the markup
   solves for us.

Note the href is `/assignments/{id}/submissions/{submissionId}`, so the §4.2 regex must
not be anchored to the end of the string.

## Trap: the hidden "Due Date" column is state-dependent

The table carries two `th.table--hiddenColumn` headers (`Release Date`, `Due Date`) and
matching `td.hidden-column` cells holding clean, already-formatted dates. They look like
a better source than the `<time>` attributes. They are not:

| Row | due (`<time>`) | late due (`<time>`) | hidden "Due Date" cell |
|---|---|---|---|
| Homework 1 | 2026-09-02 | 2026-09-09 | **2026-09-09** — the *late* date |
| Homework 2 | 2026-09-09 | 2026-09-16 | **2026-09-09** — the *due* date |

The column holds whichever deadline is next actionable: Homework 1's due date had
already passed at capture time, so the cell shows its late date instead. Using it as
`dueAt` would silently report the wrong deadline for any past-due assignment.
§4.2's "always parse the `datetime` attribute, never the visible text" is right, and
the hidden columns fall under the same rule.

## Status cell

`td.submissionStatus` contains an empty bullet `div` and `div.submissionStatus--text`
carrying the words. Observed: `Submitted`, `No Submission`. The modifier classes
(`submissionStatus-complete`, `submissionStatus-warning`) encode colour, and §4.2 is
right to ignore them. Read `.submissionStatus--text`.

Also present and unspecified: `span.submissionTimeChart--lateStatus`
(`Accepting late submissions`) and `span.submissionTimeChart--timeRemaining`
(`Closes in 6 days, 15 hours` / `6 days, 15 hours left`).
