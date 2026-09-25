# `fixtures/sites/` — the course pages the §4.5 runner is tested against

Every file here is either an unmodified `curl` capture of a **public** course page or a
file *derived* from one. The derived files are deliberately unrealistic; each says so in
a banner comment at the top of its own `<body>`, and each row that is invented is listed
below as well (parser rule 10).

## Why the captures are committed unscrubbed

`npm run scrub` exists for pages behind a login, where a capture carries the student's
name, NetID, section, submission history or a session token. **None of these pages is
behind a login.** They are the same bytes any anonymous visitor gets, and the only
identifiers on them are things the course publishes to the whole class: a Gradescope
course id and self-enrolment code, a MediaSpace channel id, a PrairieLearn course
instance id, a Google Form link, a Box share link, and the instructors' names in a
copyright footer.

Scrubbing them anyway would be actively harmful, for two reasons the project has already
paid for:

- **A scrub rewrites the thing under test.** Parser house rule 14: a scrub that maps
  names to markers, run with an empty name, inserted `STAFF-36` between every character
  of a 334 KB file and redacted nothing — and `npm run scrub` passed it. A fixture in
  that state is worse than none, because every assertion about what a parser reads is
  made against text no parser will ever see.
- **The ids are load-bearing.** `ece391-schedule.html`'s 9-digit numbers are MediaSpace
  channel ids on public lecture links, and a scrub that took them for student numbers
  would change the markup the selectors run over.

So: a page that needs a login gets scrubbed and the scrub gets read (rule 14). A public
page is committed verbatim, and this file records that the decision was made rather than
forgotten.

## The captures

| file | page | captured | shape |
|---|---|---|---|
| `example-course-schedule.html` | **synthetic**, not a capture | — | header table, written to be awkward |
| `cs424-fa2026-schedule.html` | `courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html` | 2026-09-11 | a table with **no header row** and rowspan block headings |
| `ece310-fa2026-index.html` | `courses.grainger.illinois.edu/ece310/fa2026/` | 2026-09-11 | two header tables, one of them a trap (`Assessment Due` holds names, not dates) |
| `ece411-fa2026-assignments.html` | `…/ece411/fa2026/assignments.html` | 2026-09-18 | Sphinx; `Release: 8/25` / `Due: 9/7` bullets under an `<h3>` |
| `ece411-fa2026-syllabus.html` | `…/ece411/fa2026/syllabus.html` | 2026-09-18 | exam dates, with the clock in a sibling `<li>` |
| `cs425-fa2026-assignments.html` | `…/cs425/fa2026/assignments.html` | 2026-09-18 | prose: the deadline is a clause between a release date and a demo date |
| `cs425-fa2026-lectures.html` | `…/cs425/fa2026/lectures.html` | 2026-09-20 | a lecture table: a column of lecture dates beside cells reading `MP1 due 11.59 PM 9/13 (Sun)`. **One edit**: `</head><body>` inserted after `</title>`, because the page has neither and linkedom keeps every table under `<head>` while Chrome implies a body; the banner in the file says so. Fixture only — its deadlines repeat `assignments.html`'s |
| `cs374a-fa2026-homeworks.html` | `…/cs374al1/fa2026/homeworks.html` | 2026-09-18 | `<dl class="calendar">`; the date is the `<dt>` **before** each `<dd>` |
| `cs374a-fa2026-gps.html` | `…/cs374al1/fa2026/gps.html` | 2026-09-18 | same shape, every link off-origin |
| `cs341-fa2026-home.html` | `cs341.cs.illinois.edu/` | 2026-09-24 | two "Latest Assignments" cards; the date sits behind the course week, `Due: Week 8 · 2026-10-12 23:59` |
| `cs374a-fa2026-calendar.html` | `…/cs374al1/fa2026/calendar.html` | 2026-09-18 | fifteen `<dl>`s, 93 pairs — **fixture only, no registry entry** |

`fixtures/site/ece391-schedule.html` (singular `site/`) is a separate older directory
and is left where it is.

### `cs374a-fa2026-calendar.html` has no entry on purpose

93 dt/dd pairs, and most of them are lectures, labs and discussion sections rather than
deadlines. The homeworks and GPSs it repeats are already read from their own pages, so an
entry here would double every one of them under a different `sourceId` — §5.3 would merge
most of them and the rest would sit in the list twice. It is kept because it is the only
capture with enough repeated structure to exercise the search over a big page.

## The derived files, and every row that is invented in them

A derived file exists when the live page is *realistic enough that a wrong implementation
reads it exactly as a right one does* (parser rule 10), or when it cannot reach a state
the parser has to handle (rule 12).

### `ece411-fa2026-assignments-dated.html`

From `ece411-fa2026-assignments.html`. Every checkpoint on the live page reads `TBD`.

| invented | why |
|---|---|
| dates on `mp_pipeline`'s CP1/CP2/CP3 | the live page cannot show that three checkpoints of one MP get three titles and therefore three `sourceId`s (§3.1 hashes the title) |
| a `Due Date: 11/3` line | house rule 6's trap: "Due Date" **contains** "Due", so a `dueLabel` matched by substring dates the MP from it |
| an `Advance Features Due: N/A` line | the filter's second spelling of "no date yet"; the live page only ever writes `TBD` |

### `cs425-fa2026-assignments-adversarial.html`

From `cs425-fa2026-assignments.html`. Three homework lines added at the end of the HW
list; nothing else changed.

| invented row | what it pins |
|---|---|
| `[HW5 Document]: To be Released 12/1, due to the printer's schedule. Due @ 12/10 11.59 PM Central Time.` | two whole-word "due"s where the **first is not a deadline** — nothing date-shaped follows it. Hooking on the keyword alone dates HW5 nine days early. Expected 12/10. |
| `[HW6 Document]: Due Date: TBD. Released 12/1.` | a placeholder still hooks: the course is naming this row's deadline and has not set one. Expected kept, undated, `unparsedDate` "TBD. Released 12/1.", and **never** 12/1. |
| `[HW7 Document]: Overdue 12/15. Undue 12/16. Due @ 12/13 … Resubmissions due @ 12/20 (Sun).` | "Overdue"/"Undue" contain "due" (house rule 6), **and** two occurrences really do hook, so taking the last rather than the first is visible. Expected 12/13. |

### `cs374a-fa2026-homeworks-adversarial.html`

From `cs374a-fa2026-homeworks.html`. Four pairs added to the `<dl>`; nothing else changed.

| invented row | what it pins |
|---|---|
| `<dd>Homework 0…</dd>` as the **first** child of the `<dl>` | the walk stays inside the row's own parent and stops. A document-order walk reaches past the `<hr>` into the `<ul>` above and dates one assignment from another. Expected: skipped. |
| `<dt>Mon Dec 07</dt><dt>Tue Dec 08</dt><dd>Homework 13…</dd>` | the **nearest** `<dt>` wins, not the first match. Expected Dec 08. |
| `<dt>Mid-semester break</dt><dd>Homework 14…</dd>` | the hook is there and the *value* is unreadable — house rule 1's other half. Expected undated, with the text in `unparsedDate`. |
| `<dd>Homework 15: … due by 11:59pm …</dd>` | a clock the **row** states beats the page-wide `defaultTime` of 21:00. Expected 23:59 and *not* `timeAssumed`. |

## Adding one

1. `curl` the page and commit it verbatim, or scrub it and then **read the scrub** —
   open the file and read a line of it (house rule 14).
2. Add a row to the table above.
3. If a behaviour cannot be reached from the live capture, derive a second file, put a
   banner in its `<body>` saying exactly what is invented and what each row is for, and
   add it to the derived section here. A derived file with no banner is a fixture nobody
   can trust.
