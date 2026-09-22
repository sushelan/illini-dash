# smartPhysics fixtures — provenance

| File | Origin |
|---|---|
| `home.html` | **Real capture**, 2026-09-10, `https://smart.physics.illinois.edu/` signed in. The enrolment list. |
| `course.html` | **Real capture**, 2026-09-10, `/Course?enrollmentID=…`. PHYS 214, 29 assignments, all dated. |

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
