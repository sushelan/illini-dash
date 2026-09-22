# smartPhysics fixtures — provenance

| File | Origin |
|---|---|
| `home.html` | **Real capture**, 2026-09-10, `https://smart.physics.illinois.edu/` signed in. The enrolment list. |
| `course.html` | **Real capture**, 2026-09-10, `/Course?enrollmentID=…`. PHYS 214, 29 assignments, all dated. |

| `calendar.html` | **Real capture**, 2026-09-21, `/Course/Calendar?enrollmentID=151698`. Physics 214 Fall 2025 — the same inactive enrolment as `course.html`, same enrolment id (151698 → 100001), captured through the calendar view instead of the assignment list. |

## Scrubbing

Per Appendix A, the **enrolment ids are replaced** (`151698` → `100001`,
`150666` → `100002`). An enrolment id names a (student, course) pair, so it is
an identifier in the sense Appendix A means, unlike a Canvas course id or uuid
which names only the course. `unitItemID` is per-assignment and is kept.

That replacement was done **by hand** for these two files and nothing recorded
it as a step, which cost a real capture: on 2026-09-21 the calendar page came
back reading *"nothing identifying was recognized"* over markup carrying the
real id in every nav link. `src/core/scrub.ts` does it now, mapping each
distinct id to the next counter in first-seen order — distinct ids stay
distinct, or two courses would merge and this fixture would pin
`parseCourseList` to the wrong answer. Re-scrubbing either file is a fixed
point and leaves it byte-identical, which is how the rule was checked against
the hand-done mapping.

The capture tool had already replaced the NetID, which appears on the home page
in the Unique ID column. No email addresses, no name.

## What these do and do not establish

**Established.** The site is server-rendered: 79 KB of the home page's 97 KB is
the app bundle, but every course name, assignment title and due date is in the
HTML. No content script is needed. The markup carries stable hooks —
`.course-title`, `.unit-assignment`, `.unit-assignment-title`, `.duedate`,
`.UnitTitle`, and `#CurrentEnrollments` / `#PastEnrollments` tab panes.

**Not established: a current term.** The account these came from finished
PHYS 213 and 214 in **Fall 2025** and has no active enrolment, so both courses
sit under Inactive and `course.html` is last year's. The parser is therefore
measured against real markup and real dates but never against a live course.
What a current course adds is unknown; the likely differences are an unstarted
assignment's state and whatever the site does with a deadline that has not
passed. **This is the §12-style open question for this source**, and it closes
the first time a PHYS 211–214 tester sends a capture.

## Traps these fixtures exist to pin

- **Three links share each course's URL.** The nav "Home" link, the course
  title, and the row's role cell all point at `/Course?enrollmentID=…`, so a
  page-wide query returns three links per course and the first is titled
  "Home". The parser scopes to `.course-title`.
- **"Inactive Courses" contains "active Courses."** A text match on the wrong
  label classifies every course backwards. The parser reads the tab pane id
  instead (house rule 6).
- **A dozen rows are titled bare "Checkpoint" or "Homework".** Unqualified they
  are indistinguishable in a mixed list, and a content-derived key would
  collide across all of them, so each is prefixed with its unit.
- **§5.1 cannot read "Physics 214."** Its regex wants two to four letters before
  the number and "Physics" is seven, so a row would carry no course code and
  could never merge with the Gradescope or Canvas copy of the same course.

## `calendar.html` — what it establishes, and one live trap

**Same 29 items as `course.html`, cross-checked by id.** Every `unitItemID` in the
calendar's 29 dated events (`event-UnitItemID`) matches one of `course.html`'s 29
`unit-assignment` rows exactly — 29 of 29, no extra, none missing. The calendar is not a
second source of deadlines; it is the same 29 deadlines in a month grid instead of a list.

**Richer than `course.html`'s one "Due:" line, in the same way PrairieLearn's
access-details popover is richer than its credit cell.** Each dated event carries one or
two `<div id='deadline-N'>` blocks with a real `event-DeadlineID`, a `CorrectionFactor`
(the credit percentage) and a `StartDate`/`DueDate` pair. On every assignment that has two
of them, the second is one week later at 80% credit — a genuine two-tier schedule
`course.html`'s single line collapses into "Due: Aug. 25, 2025 at 8:00 AM ... for 100%
credit" and says nothing about. This is exactly §4.3's PrairieLearn shape, and a future
`parseCalendar` should read the same way: `dueAt` from the 100%-tier End, `lateDueAt` from
the next tier down, never inventing a time the tier does not state.

**The trap: every event also carries one identical, fake `<div class='deadline-0'>`
block — `id`-less, `event-DeadlineID` always `0`, and its `StartDate`/`DueDate` is the
*same* pair on every single one of the 29 events, matching the page's own `CurrentDay`
hidden input exactly (this capture: 9/21/2026, taken 2026-09-21). It is not a deadline —
it is the client's "today" marker for highlighting the calendar grid, stamped onto every
event's markup regardless of what that event actually is. A parser that reads it as a due
date reports **every assignment on the page as due today**, silently, on every sync — the
single most dangerous failure this file could produce, and the reason `deadline-N` **must
be matched by the `id` attribute, never by the `class` attribute of the same name.**

**Not yet established, and blocking a parser.** This capture is a stale, inactive
enrolment (`course.html`'s own title: "Physics 214 Fall 2025"; every real `deadline-N`
date is in 2025) — house rule 9's "the capture beats the spec" needs a capture to check
against, and every date here is in the past. Two things only a *currently active*
course's calendar can answer:

1. Whether the 100%-tier `deadline-0`'s `DueDate` is the same instant `course.html`'s
   "Due:" line states for the same item, confirming which tier the two pages agree on.
2. Whether the fake same-date-on-every-event block is a general behaviour of this calendar
   view or something specific to an inactive, completed course being rendered read-only.

`docs/smartphysics-calendar-findings.md` has the worked examples.
