# Canvas — what the API actually returns

Source: `fixtures/canvas/courses-active.json` and
`fixtures/canvas/planner-items-empty.json`, captured 2026-09-03 from
`canvas.illinois.edu`. Both audited: no emails, no 9-digit ids, no name residue.

## `course_code` is an opaque slug, not a course code

§4.1 says `/api/v1/courses` returns `course_code` "(e.g. `"CS 225"`)", and §5.3 says
`courseLabel` should be "Canvas `course_code` if present". Neither holds here. All
three enrolments:

| `course_code` | `name` | §5.1 regex on `course_code` | on `name` |
|---|---|---|---|
| `bus_ilbc_open_249233` | `FA25 IBC NDA and Code of Conduct Forms` | no match | no match |
| `cs_357_120268_263847` | `Fall 2026-CS 357-Numerical Methods I-Sections AL1, CSP, OL1` | no match | **CS357** |
| `cs_425_120268_266229` | `Fall 2026-CS 425-Distributed Systems-Sections CSP, DS3, DS4, MC3, MC4, SG, SU` | no match | **CS425** |

Amendments needed:

1. **§5.1** should run against Canvas's `name`, not `course_code`. The regex itself is
   fine — it finds `CS357` and `CS425` from the name and correctly declines the slug
   (`CS_357` has an underscore where the regex allows only spaces and a hyphen).
2. **§5.3** must not use `course_code` as `courseLabel`; it would show
   `cs_357_120268_263847` in the popup. Use the extracted code, else a cleaned `name`.
3. The FA25 admin course yields no code from either field, so it exercises §5.1's
   "no match → fall back to `courseRaw`" path, and §4.1's warning about concluded
   courses leaking through `enrollment_state=active` is confirmed with a second year's
   distance.

Useful and unmentioned in the spec: each course carries `time_zone: "America/Chicago"`,
which is a per-course answer to §3.2 rather than an assumption.

Course `uuid`s are present in the fixture. They identify the course, not the student,
so they are left in place.

## The planner came back empty — RESOLVED: it is correct

`/api/v1/courses/{id}/assignments` for both Fall 2026 courses, captured 2026-09-03:

| Course | Assignments | With `due_at` | `submission_types` |
|---|---|---|---|
| CS 357 (72393) | 66 | **0** | all `external_tool` |
| CS 425 (74798) | 1 | **0** | `none` |

All 67 are `published: true`. No dates under any key: `due_at`, `lock_at`,
`unlock_at`, `all_dates` and `has_overrides` are empty on every one. So the empty
planner is Canvas behaving exactly as §4.1 documents — "assignments with no `due_at`
appear nowhere in the planner window" — and not a broken query.

### What that means for the project

**Canvas contributes zero deadlines for this account, and cannot contribute any.**

> **Superseded 2026-09-10 by a live sync.** The loop now reports
> `[sync] canvas: ok (1 items, 2 requests)`. Between the Sep 3 capture and today a
> fourth enrolment appeared (CS 424, see the `include[]=term` capture above) and the
> planner returned a dated row. So the claim below holds for the *courses captured on
> Sep 3* and not for the account in general: a Canvas source that yields nothing is
> a fact about which instructors dated their assignments that week, not a property of
> this deployment. Anything reasoning from "Canvas is always empty here" — including
> G2's recall note — should be re-read with that in mind.
CS 357's 66 rows are LTI shells for PrairieLearn assessments; the dates live in
PrairieLearn, which we already parse. CS 425 has one dateless `HW1`.

This confirms §4.1's prediction that external-tool assignments "are the main dedupe
case (§5)" — structurally — but with a twist the spec did not anticipate: because the
Canvas copies are **undated**, §5.3 cannot merge them with their PrairieLearn
originals. That rule needs both items dated within 24 h *or* both undated, and here
one side is dated and the other is not. Surfacing the undated Canvas rows would
therefore add 66 unmergeable duplicates to the list rather than enriching it.

It also means **G2 (recall) will show Canvas contributing 0 items on this account, and
that is a pass, not a failure.** Recorded here so it is not misread later.

### G1 consequence

There is no non-empty planner fixture to be had from this account, so the Canvas
parser's date, status and kind mapping cannot be tested against real data yet.

## Historical note: a scrubber bug corrupted 8 values in these two fixtures

`/api/v1/planner/items?start_date=2026-08-27&end_date=2026-11-02&per_page=100`
returned exactly `[]`, with two active Fall 2026 enrolments in the same account.

Under §0 rule 3 this cannot be accepted as "no deadlines". Either:

- **the query is wrong or the endpoint needs something we are not sending** — in which
  case the Canvas module would silently contribute nothing all semester; or
- **it is true**, because the CS 357 and CS 425 staff publish no dated Canvas
  assignments (CS 357's work lives in PrairieLearn). §4.1 already warns that
  assignments with no `due_at` "appear nowhere in the planner window", so an empty
  planner alongside a populated assignments list is a documented, expected outcome.

The discriminator is `/api/v1/courses/{id}/assignments`: if it lists assignments, the
planner query is at fault; if it is also empty, Canvas genuinely holds nothing for
these courses. **Blocked on that capture before the Canvas parser is written** — a
parser cannot be tested against `[]`, and G1 requires hand-written expected outputs.


The first version of the Appendix A scrubber matched a 9-digit run using digit-only
lookarounds. Canvas embeds 9-digit runs inside longer hex tokens, so it rewrote the
middle of one `lti_context_id` UUID and six `resource_link_id` hashes to
`000000000` in `assignments-cs357.json`.

The rule now requires the run not to touch a word character or hyphen, with a
regression test built from the real values. None of the affected fields are read by
any parser (§4.1 uses `plannable_type`, `plannable_id`, `title`, `due_at`,
`course_id`, `html_url` and `submissions`), so the fixtures are kept as captured.
Re-capture is one click if those fields ever matter.


## Open: §4.1's concluded-course filter cannot be implemented from this response

§4.1 says `/api/v1/courses` is used "to build the course map **and to filter out
concluded courses that still leak into the planner**", and `docs/gate0-results.md`
calls that filter load-bearing. It is **not implemented**, because the captured data
offers nothing to implement it from. Course 58438 ("FA25 IBC NDA and Code of Conduct
Forms") reports:

| Field | Value | Says "concluded"? |
|---|---|---|
| `workflow_state` | `available` | no |
| `end_at` | `2026-12-11T06:00:00Z` (future) | no |
| `enrollments[].enrollment_state` | `active` | no |
| `enrollment_term_id` | `109` vs `262` for the real courses | only signal |

By every field Canvas returns, that course is current — just old. Three ways forward:

1. **Term heuristic** — keep only courses whose `enrollment_term_id` equals the
   highest (or modal) term id seen. Cheap, no extra request, and wrong for anyone
   legitimately enrolled across two terms.
2. **Ask Canvas for the term** — add `include[]=term` to the courses request and
   filter on the term's own start/end dates. Real data instead of a guess; costs
   nothing extra in requests, but needs a capture to confirm the shape.
3. **Do not filter** — §8.2 already specifies a per-course checkbox list "so old-term
   Gradescope courses can be turned off", which handles this case by hand.

Deferred to step 8, when Canvas is first wired into a sync loop. Until then the course
map contains every active enrolment, and a planner row for course 58438 would produce
a live item. This is harmless today: that course publishes nothing dated.

## RESOLVED 2026-09-10 by `include[]=term` — but not the way option 2 assumed

`fixtures/canvas/courses-active-term.json` is the same request with `include[]=term`,
captured 2026-09-10. Four enrolments now (CS 424 has appeared since the Sep 3 capture,
which is the course the `cs424-fa26` adapter serves):

| Course | `enrollment_term_id` | Term name | Term `start_at` | Term `end_at` |
|---|---|---|---|---|
| 58438 FA25 IBC NDA and Code of Conduct Forms | 109 | `OPEN` | **null** | **null** |
| 72393 CS 357 | 262 | `2026 - Fall` | 2026-03-30T05:00:00Z | 2027-01-15T06:00:00Z |
| 75165 CS 424 | 262 | `2026 - Fall` | 2026-03-30T05:00:00Z | 2027-01-15T06:00:00Z |
| 74798 CS 425 | 262 | `2026 - Fall` | 2026-03-30T05:00:00Z | 2027-01-15T06:00:00Z |

So the term object is there and it carries real dates for the real term — but **the
stale course's term has null dates on both ends**, and that is not an accident or a
missing field. In Canvas a term with no start and no end is *unbounded*: the "OPEN"
term is a self-paced container for compliance and onboarding courses that are meant to
be available indefinitely. It is not concluded. It never will be.

**This inverts the question.** "Filter out concluded courses" cannot be answered from
dates, because the course we want to set aside belongs to a term that is, correctly,
always current. The answerable question is the one the student actually means:
*which courses belong to the term my real coursework is in?*

### The rule this supports

1. A term is **current** if it has both dates and they bracket now. Here: term 262.
2. Keep every course whose term is current.
3. A course whose term is **unbounded** (either date null) is undecidable by dates.
   Set it aside only when at least one current term exists and the course is not in
   one — which is exactly course 58438's case.
4. **Fail open.** If no term is current at all (between terms, or an account whose
   terms all carry null dates), keep everything. §11 makes a hidden real deadline
   catastrophic and a visible stale course merely untidy, and §8.2's per-course
   checkbox already handles untidy.

Set-aside courses are listed in Options as a collapsed "Older courses" group and can
be switched back on, so rule 3 is never final and never silent.

### Consequences for the code

- `coursesUrl()` gains `include[]=term`. The response shape is otherwise unchanged, so
  `parseCourses` keeps working; `termId` (parsed at `canvas.ts:147` and currently read
  by nothing) stops being dead code.
- The set-aside list has to be **persisted**. `courseSummaries` is built from
  `store.raw`, so a course that contributes no items has nothing to hang a flag on and
  would be invisible in Options — the opposite of "never silent".
- Under house rule 1, a course whose `term` is missing entirely costs that course its
  term, not the whole courses page: treat it as unbounded and let rule 3 decide.
- Under house rule 5, `start_at`/`end_at` are validated with `isInstant` before use.
  `Date.parse(null)` is `NaN`, and a `NaN` comparison is silently false in both
  directions, which would make every term look non-current and quietly disable rule 1.
