# ECE 411 (FA 2026) — what the pages actually say

Captured 2026-09-18 with `curl`, no login. Both pages are public:

- `https://courses.grainger.illinois.edu/ece411/fa2026/assignments.html`
- `https://courses.grainger.illinois.edu/ece411/fa2026/syllabus.html`

Saved verbatim as `fixtures/sites/ece411-fa2026-assignments.html` and
`fixtures/sites/ece411-fa2026-syllabus.html`. Nothing personal appears on either — the
only NetID on the assignments page is the literal placeholder `NETID` in the git setup
snippet, and the only name is the instructor's in the Sphinx copyright footer.

## Two pages, so two adapters

The course splits assignments and exams across two URLs. An adapter has one fixed `url`,
so the course is two registry entries under one `courseCode`:

| id | page | what it reads |
|---|---|---|
| `ece411-fa26-mp` | `assignments.html` | MP and checkpoint deadlines |
| `ece411-fa26-exams` | `syllabus.html` | midterm dates and start times |

This is the general answer to the "course sites split across pages" item in the handoff,
and it needs no schema change. `validateRegistry` only requires `id` to be unique.

## The page shape: `label: value` bullets, not a table

Sphinx. Each MP is a `<section>` with an `<h3>` and a `<ul class="simple">`:

```html
<section id="mp-setup">
  <h3>mp_setup<a class="headerlink" href="#mp-setup"> </a></h3>
  <ul class="simple">
    <li><p>Release: 8/25</p></li>
    <li><p>Due: 9/7</p></li>
  </ul>
</section>
```

Three things follow, and each is one of the new declarative fields (`docs/adapters.md`):

1. **The row has no name.** The name is the `<h3>` above the list, which no row-relative
   selector reaches. → `titleFrom: "section >> h3"`.
2. **The date is behind a label.** The date formats are `^`-anchored, so `Due: 9/7`
   parses as nothing until `Due:` comes off. And `Release: 8/25` is the *same markup* as
   `Due: 9/7` — the label is the only thing that says one is a deadline. →
   `dueLabel: "Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due"`.
3. **The label's position varies by section.** `mp_setup` has two bullets, `mp_ooo` has
   six, and `mp_pipeline`'s checkpoints are three consecutive `Due` lines with different
   prefixes. `nth-child` is wrong for house rule 3's reason, and here it would be wrong
   differently in every section.

The label is appended to the title (`mp_pipeline CP1`) because §3.1 hashes the title.
Without it the three checkpoints of one MP collide on one `sourceId` and `KeyGuard`
keeps one of the three — house rule 4's failure, arriving through the title rather than
through a repeated row.

**As captured, only `mp_setup` and `mp_verif` have dates** (both 9/7). Everything else —
`mp_cache`, and every checkpoint of `mp_pipeline` and `mp_ooo` — reads `TBD`, and the
filter drops those rather than emitting eleven undated rows that claim to be deadlines
whose date the parser merely failed to read.

Because the live page cannot show a dated checkpoint, `ece411-fa2026-assignments-dated.html`
is derived from it and is **deliberately unrealistic** (parser rules 10 and 12); its own
banner comment says exactly how, including the `Due Date: 11/3` line that exists only to
catch a substring match on `Due`.

## The exam times are stated somewhere else

```html
<li><p>Midterm 1: September 29</p>
  <ul><li><p>Location: ECEB 1002</p></li>
      <li><p>Time: 7-9PM</p></li></ul></li>
```

The date bullet states no clock, so §4.5's runner would invent 23:59 — four and a half
hours after the exam ended, and a two-hour reminder for it would fire at 21:59, after it
ended too. `time: "ul"` reads the sibling bullets and takes the **start** of the range.
Worker rule 3: the resulting 19:00 is a value the *source* stated, so it carries no
`extra.timeAssumed` and is allowed to outrank a Canvas entry; the 23:59 on the MPs still
does carry it.

The final is `TBD` in both the date and the time field and is excluded.

**And this list is not reachable by the deterministic proposer — it needs the entry that
was written by hand.** Three things about it, each of which alone would be enough:

1. **The labels are the exams' own names.** `Midterm 1`, `Midterm 2`, `Final` — one line
   each, no convention. `dated.label` is built from labels that end in the word *due*,
   or failing that from a label at least two dated rows share; this list offers neither,
   and a proposer that guessed "the label is whatever this line starts with" would
   produce a `dueLabel` covering one exam.
2. **The clock is in a nested `<li>`**, reached by `time: "ul"`. Nothing in the group's
   own rows says so, and without it every exam lands at an invented 23:59.
3. **`kind: "exam"`** is a fact about what the page lists, not about its markup.

The inventory does say the group carries dates — `#schedule ul.simple > li ×3 dated 2/3
(1 TBD)`, read off the `<p>` child rather than the flattened row, which is what the
shipped entry reads — so a model shown this page is pointed at the right group. The
deterministic search declines it, and says so: *"The nearest thing to a schedule is
#schedule ul.simple > li: 3 lines, 2 with a date this can read."*

## The live schedule is in a Google Sheets iframe, and cannot be read

`syllabus.html` opens its Schedule section with:

```html
<iframe src="https://docs.google.com/spreadsheets/d/16CoKT…/preview?widget=true&headers=false"
        style="width: 100%; height: 325px"></iframe>
```

That sheet is the week-by-week schedule — lectures, discussion topics, and the dates the
course actually keeps current. **It is not readable by this extension, and should not
become readable:**

- **It is client-rendered.** Measured, not assumed: `curl` on that iframe URL returns 200
  and 52 KB containing **zero `<table>` elements** and not one of the words `lecture`,
  `midterm` or `discussion`. The grid is built in JavaScript from a separate data
  request; `fetch` returns the shell and the runner cannot run JS. This is exactly the
  `renders: "client"` case §4.5 anticipated and that no site had shown until now.
- **It is on `docs.google.com`.** Reading it means a host permission for
  `https://docs.google.com/*`, which is every Google Doc, Sheet and Slide the student is
  signed into. §2.3's whole safety argument is that a student sees one course's host in
  Chrome's own prompt; `docs.google.com` is not one course's host and no wording of the
  prompt would make it one. Refused on those grounds, not on effort.

**So the HTML page is what we read, and the HTML page lags the sheet.** As captured, the
sheet is maintained and `assignments.html` still says `TBD` for eight of the ten MP
deadlines. What this adapter contributes is therefore *correct but incomplete*, and it
will stay incomplete until the course fills in the HTML page. It will never announce a
wrong date — `TBD` produces no row — but a student should not read an empty ECE 411 as
"nothing is due".

## Amendments to SPEC.md

- **§4.5's adapter shape.** The spec's schema covers tables. A course page can be a list
  of `label: value` lines with the item's name in a heading outside the row, and the
  clock in a different element from the date. Three optional fields (`dueLabel`,
  `titleFrom`, `time`) cover it declaratively; the capture beats the spec (house rule 9).
- **"An adapter is a course."** It is a *page*. A course with deadlines on two pages is
  two adapters sharing a `courseCode`, and nothing in §4.5 forbids that once you notice
  only `id` is checked for uniqueness.
- **This page is read without a model (2026-09-19).** `assignments.html` was the page
  that sent the on-device author three failing runs, one build apart; the last of them
  ended *"only 1 of 3 rows carried a readable date"*. It is now read by the
  deterministic search: `detectListCandidates` takes the inventory group
  `#mp-information ul.simple > li` (×16 — character for character the selector
  `ece411-fa26-mp` uses), reads `Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due` off
  the lines themselves, takes `section >> h3` as the title, and runs the result through
  the real runner: `mp_setup` and `mp_verif`, both 2026-09-07T23:59-05:00, which is what
  the hand-written entry produces. `tests/detect.test.ts` pins the rows by element
  identity and the items against the shipped entry. The model is not asked about this
  page at all, and on a machine without one the page is readable anyway.

  What made the difference was measuring which groups carry dates: four of this group's
  sixteen lines state one and the other twelve read `TBD`, so counted as *4 of 4 stated*
  it is the best group on the page, and counted as *4 of 16* it sits below a bare `li`
  (×39) that covers the whole document. See `docs/adapter-author.md`.
