# CS 425 / ECE 428 (FA 2026) — what the page actually says

Captured 2026-09-18 with `curl`, no login:

- `https://courses.grainger.illinois.edu/cs425/fa2026/assignments.html`

Saved verbatim as `fixtures/sites/cs425-fa2026-assignments.html`, unscrubbed. Nothing
personal is on it: the only identifiers are a Gradescope course id, a Gradescope entry
code the page publishes to the whole class, a Google Form link and a Box share link —
all of them things the course prints for anyone who opens the page.

## The page shape: the deadline is a clause, not a cell

Hand-written HTML from the late 1990s lineage — six `<table>`s, five of which are the
nav strip, and the content in the sixth (`<table align="center" width="90%">`). Inside
it, each assignment is one `<li>` holding a whole sentence:

```html
<li>[<a href="MP1.CS425.FA26.pdf">MP1 Specification Document</a>]:
  <span style="color: black;">Released 8/25</span>.
  <span style="color: black;"> Due @ 9/13 11.59 PM Central Time (Sun).
  Demos on 9/14 (Mon)</span>.</li>
```

Three dates in that row and only the middle one is a deadline. Neither of the two shapes
the schema already had can reach it:

- There is no **column**: there is no data table at all.
- There is no **label**: `matchDueLabel` reads `<label>: <rest>`, and the colon on this
  line separates the *name* from the sentence, not a label from a date.
- There is no **element** around the date either. `<span style="color: black;">` wraps
  the release date *and* the deadline *and* the demo date, and on other rows wraps
  nothing at all. Five of the eight deadline lines have no `<a>` and no inner element
  worth naming.

So the word is the hook. `duePhrase: "due"` matches the keyword as a **whole word** and
takes the text after it.

### Two rules that the page itself forces

1. **A keyword only counts when something date-shaped follows it** (within one connector
   of `:` / `@` / `on` / `by` / `at`, with an optional "date"/"deadline" noun). The page
   has three bullets that say "due" and name no date:

   - `MPs are always due on a SUNDAY at 11.59 PM Central Time, and DEMOS are on the
     subsequent MONDAY.`
   - `Homeworks are due at 11.59 PM Central Time on the due-date, for both MCS (online)
     and on-campus students (no excuses).`
   - `We try to stagger HW deadlines so that they are not the same as MP deadlines.`

   Without the rule the first two become undated rows titled with the policy sentence.

2. **Whole word, never substring** (house rule 6). "the due-date" and "Overdue" both
   contain "due". The live page has "due-date"; the adversarial fixture adds "Overdue
   12/15", which a substring match dates the row from.

Every occurrence is tried in document order and the first that *parses* wins, because
HW1's line carries two: `Due @ 9/20 at 11.59 PM Central Time. (HW1 is due on a SUNDAY!)`.

## `titleBefore`

The row's text is the whole sentence. §3.1 hashes the title, so an untrimmed title means
the `sourceId` changes whenever the course edits a word — and every override on the row
is orphaned — while the popup's title column holds a paragraph. `titleBefore: ":"` takes
the head, and the brackets come off because they are the page's own list punctuation:
`[MP1 Specification Document]` → `MP1 Specification Document`.

## What the entry reads

`cs425-fa26`, against the capture, with `fetchedAt` 2026-09-18:

| title | dueAt | clock |
|---|---|---|
| MP1 Specification Document | 2026-09-13T23:59:00−05:00 | stated |
| MP2 Specification Document | 2026-09-27T23:59:00−05:00 | stated |
| MP3 Specification Document | 2026-11-08T23:59:00−06:00 | stated |
| MP4 Specification Document | 2026-12-06T23:59:00−06:00 | stated |
| HW1 Document | 2026-09-20T23:59:00−05:00 | stated |
| HW2 Document | 2026-10-04T23:59:00−05:00 | stated |
| HW3 Document | 2026-11-01T23:59:00−06:00 | stated |
| HW4 Document | 2026-12-03T23:59:00−06:00 | stated |

Eight rows out of 42 matched `<li>`s. Not one invented time: the page writes
`11.59 PM Central Time` on every deadline, which is why the grammar had to learn a dot
as the minute separator — with only `:` every one of these carried `timeAssumed`, and
§5.3 would have let any Canvas row overwrite a deadline the course had stated plainly.

`courseCode` is `CS425/ECE428`, so `extractCourseCodes` yields both and `ECE428` lands in
`extra.altCodes`; a Gradescope or Canvas row filed under either number can still merge.

## What the entry does **not** read

- **The midterm.** `Midterm Exam on 10/8.` is on this page and carries no deadline
  keyword. Adding "exam on" to `duePhrase` would also pick up
  `contact the instructors at least 2 weeks before the posted exam date`, and the row
  would be `kind: "assignment"` anyway — `kind` is per adapter, and this page is mostly
  homework. The right answer if it is wanted is a second entry pointed at the lectures
  page, the way ECE 411 is two entries.
- **The final.** The page says the date is set by campus and not yet posted.
- **The practice midterm**, whose release date reads `TBD` and which is not a deadline.
- **The PDF links.** Three of the eight rows link a specification or homework PDF, and
  the entry declares no `link`. §5.3 defines `RawItem.url` as *where you actually submit*,
  and this page says in as many words that everything is submitted on Gradescope; the
  course page at least carries the Gradescope link and the entry code, and a PDF carries
  nothing. So every row falls back to the page (house rule 7 would have applied anyway to
  the two rows whose link is off-origin).

## The rows selector

`table[align=center] li` — 42 rows, 8 of them deadlines.

The HW and MP lists carry **no `id` and no `class`**, and `<ul>` nesting on this page is
malformed enough that a browser re-parents most of it (the nested lists come out as
siblings of the `<li>`s they were written inside). So there is nothing structural to
anchor on below the table. The one content table is the only stable hook: every other
`<table>` on the page is a two-cell nav strip with an `id` of `table14`…`table18`, and
the content table is the only one with `align="center"`.

Breadth is cheap here because the reader is selective: a row the keyword does not hook is
skipped, so 34 of the 42 rows cost nothing. Breadth would be dangerous on a page where
some *other* sentence said "due" followed by a date; this page has none.

## Amendments to SPEC.md

- **§4.5's adapter shape, again.** A course page can write its deadline as a clause in
  the middle of a sentence with two other dates beside it. `duePhrase` and `titleBefore`
  cover it declaratively (house rule 9: the capture beats the spec). This is the fourth
  page shape after the header table, the rowspan grid and the `label: value` list.
- **§4.5's date grammar.** `11.59 PM` is not a typo the course will fix; it is how the
  page writes all eight of its deadlines. `TIME` takes `.` as a minute separator.

## The adversarial fixture

`fixtures/sites/cs425-fa2026-assignments-adversarial.html` adds three homework lines that
are not on the real page, because the real page reads identically under a right
implementation and several wrong ones (parser rule 10). Its banner says which and why:
HW5 (a "due" with no date behind it), HW6 (`Due Date: TBD` — kept undated, never dated
from the `Released 12/1` in the same sentence), HW7 ("Overdue"/"Undue", and two hooked
occurrences so that taking the last rather than the first is visible).

One decision recorded there and here: **a placeholder on a prose page survives as an
undated row.** The proposer attaches `filter.exclude: "\bTB[DA]\b|\bN/?A\b"` to a list
candidate, and `filter` is matched against the **title** — HW6's title is "HW6 Document",
and the "TBD" is in the due text, which no filter ever sees. That is different from
ECE 411, where the whole `<li>` *is* `Due: TBD` and the filter does drop it. Deliberate:
the row names a real assignment the course has not dated yet, and §11 ranks a silently
dropped deadline above every other failure.
