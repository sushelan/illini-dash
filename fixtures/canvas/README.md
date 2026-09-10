# Canvas fixtures — provenance

| File | Origin |
|---|---|
| `courses-active.json` | **Real capture**, 2026-09-03, `/api/v1/courses?enrollment_state=active&per_page=100`. 3 courses. |
| `courses-active-term.json` | **Real capture**, 2026-09-10, the same with `include[]=term`. 4 courses; settles §4.1's concluded-course filter (`docs/canvas-findings.md`). |
| `planner-items.json` | **Real capture**, 2026-09-10, `/api/v1/planner/items` over Sep 3 – Nov 9. **One dated row** — the first this account has ever produced. |
| `planner-items-empty.json` | **Real capture**, 2026-09-03, `/api/v1/planner/items` over now−7d…now+60d. Genuinely `[]`. |
| `assignments-cs357.json` | **Real capture**, 2026-09-03, `/api/v1/courses/72393/assignments`. 66 rows, none dated. |
| `assignments-cs425.json` | **Real capture**, 2026-09-03, `/api/v1/courses/74798/assignments`. 1 row, undated. |
| `planner-items-SYNTHETIC.json` | **HAND-WRITTEN. NOT A CAPTURE.** See below. |

All real captures were scrubbed per Appendix A and audited: no emails, no 9-digit
ids, no name residue, `user_id` redacted.

## Why a synthetic planner fixture still exists

**Updated 2026-09-10.** When this was written the account had no dated Canvas
assignment, and an earlier version of `docs/canvas-findings.md` overreached from that
to "Canvas cannot contribute any" — which was never supported by the evidence and is
now corrected there. `planner-items.json` is a real capture with one dated row, taken
the day an instructor first set a Canvas due date on this account.

One row is not ten, so the synthetic fixture stays. It is what exercises the kind
mapping across `assignment`, `discussion_topic`, `calendar_event` and the skipped
types, the status mapping across submitted / graded / missing / excused, undated rows,
and the malformed shapes §0 rule 3 requires to throw. The real capture is a `quiz` that
is `not_submitted` with a `plannable.due_at`, and it pins the four things only a real
response could: the relative `html_url`, the absent `course_code`, the extra
`submissions` keys, and §3.1's key shape on live ids.

**It encodes assumptions, not observations**, and that is still true of everything it
covers beyond the single real row — the kind and status mappings in particular remain
unmeasured against Canvas itself. That stays true until more real planner rows appear — a beta tester at G4 whose instructors set Canvas due dates is
the expected source. Anything the parser learns to depend on that appears only here
should be treated as unverified.

Specifically unverified: the `plannable_date` fallback used when `plannable.due_at`
is absent. §4.1 names only `due_at`.

### Deliberate divergences from what real Canvas would send

Three rows are shaped to make a wrong implementation fail. Real Canvas would not
look like this, and that is the point — with realistic values the behaviour is
unpinnable, because a mutation testing the wrong field still passes:

- **row 9002** has `plannable_date` (09-13) *different* from `plannable.due_at`
  (09-12). Real Canvas sets them equal, so a parser reading the wrong field would
  be indistinguishable from a correct one.
- **row 9003** has a `context_name` that deliberately disagrees with its mapped
  course's `name`, pinning the map-first precedence.
- **row 9017** has an off-host `html_url` (`//evil.example/phish`), pinning the
  https-and-same-origin guard on `RawItem.url`.

Rows 9015 (no date field at all) and 9016 (`due_at: "TBD"`) cover the undated and
unparseable-date branches, which no real row on this account can reach.

It covers, in one file: each kind mapping in §4.1 including the `exam` title test;
every branch of the `submissions` state machine including `false`, `excused` and
`late`; all three skipped types; an unknown `plannable_type`; a relative and an
absolute `html_url`; a cross-listed course name for §5.1; a `course_id` absent from
the course map; and a row with no `due_at`.
