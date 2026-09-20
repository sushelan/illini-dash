# Course-site adapters (§4.5)

Adapters are **data, not code**. Manifest V3 forbids remotely loaded code, so an
adapter is a URL, a few CSS selectors and a date format — never a script. That is what
lets a broken selector be fixed by editing a JSON file on GitHub, without a store
re-review that takes days (§0 decision 4).

## The shape

```json
{
  "id": "cs225-fa26",
  "label": "CS 225 course site",
  "courseCode": "CS225",
  "term": "fa26",
  "url": "https://courses.grainger.illinois.edu/cs225/fa2026/assignments/",
  "hostPattern": "https://courses.grainger.illinois.edu/*",
  "rows": "table.assignments tbody tr",
  "title": "td.name a",
  "due": "td.due",
  "link": "td.name a@href",
  "dateFormat": "MMM d, h:mm a",
  "timezone": "America/Chicago",
  "filter": { "exclude": "no submission|optional" },
  "minExtensionVersion": "0.1.0"
}
```

- `rows` selects one row per deadline. **Zero matches is an error for that adapter**,
  never an empty result (§0 rule 3) — and it fails that adapter alone, which is the
  whole reason course sites are adapters rather than a fifth hand-written parser.
- `title`, `due` and `link` are selectors *relative to a row*. A `@attr` suffix reads an
  attribute instead of the text: `time@datetime`, `a@href`.
- `dateFormat` is chosen from a closed set, not supplied. An adapter cannot provide a
  pattern, so a bad registry entry can produce a wrong selector but never arbitrary
  matching behaviour. Currently: `yyyy-MM-dd`, `MMM d, h:mm a`, `M/d`.

  Each is start-anchored and carries the optional bits real pages put around a date: a
  weekday in front, a weekday **after** it — `09/24, Thursday 11.59 PM`, `08/27 Thu¹` —
  and a footnote mark after that, then a time introduced by a comma, `at`, `@` or an ISO
  `T`. The trailing weekday is not cosmetic: the formats stop at the first thing they
  cannot read, so before it was understood `09/24, Thursday 5 PM` landed six hours early
  while looking stated. A clock may be written `11:59`, `11.59 PM` — CS 425 writes all
  eight of its deadlines that way — or `0930 - 1045 hrs.`, where four digits with no
  separator count as a clock only because the page itself says `hrs`, and a range gives
  its start. A bare `5` is still not a time: on a course page it could be either end of
  the day, and guessing would put a 5 PM deadline at 05:00, which is worse than admitting
  the time is unknown because it looks stated.
- `kind` says what the rows on this page *are*, when they are not assignments — one of
  `assignment`, `quiz`, `exam`, `booking`, `event`, `other`, and validated against that
  union like `dateFormat` is. Omitted means `assignment`, which is what `runAdapter`
  hard-coded before the field existed. It is per *adapter*, not per row, because a course
  site splits by page: `ece411-fa26-exams` points at a syllabus whose only rows are
  Midterm 1, Midterm 2 and the final, and without `"kind": "exam"` those three landed in
  the homework list while the popup's Exams tab — which filters on `kind === "exam"` —
  stayed empty for a course that has two midterms in it.
- `term` expires the adapter — the options page hides adapters from other terms, so a
  stale one disappears on its own rather than quietly fetching last year's page.

Six more fields arrived in 1.1.0. All are optional, and no entry carries all of them:
`duePrev` and `dueSlot` are two more answers to the question `columns.due` answers, and
`validateAdapter` refuses an entry that gives two.

```json
"duePrev": "dt",
"duePhrase": "due",
"dueSlot": 1,
"titleSlot": 4,
"titleBefore": ":",
"defaultTime": "21:00"
```

- `duePrev` is *"a selector for the nearest **preceding sibling** that carries the
  date"*. ECE 374 A's homework page is a definition list: the date is the `<dt>` and the
  assignment is the `<dd>` after it, so the date is not inside the row, not in a cell of
  it and not in an ancestor either. The walk stops at the row's own parent, deliberately
  — a document-order walk would take a `<dt>` from the list above whenever a row has none
  of its own, which dates one assignment from another silently. `@attr` is honoured; the
  plain form reads the whole element, because the page wraps some of its dates in
  `<em><strong>`. Mutually exclusive with `columns.due`.
- `duePhrase` is `|`-separated keywords *"that introduce a deadline **inside a sentence**,
  for a page that writes its dates as prose rather than as cells or labelled lines"*.
  Matched as a **whole word**, case-insensitively (this page writes "Overdue" and "the
  due-date" too), and it counts only when something date-shaped follows within one
  connector — `:` / `@` / `on` / `by` / `at`, with an optional "date"/"deadline" noun.
  Every occurrence is tried in document order and the first that parses wins. A keyword
  followed by TBD/TBA/N/A still counts as a hook, so the row is kept and reported undated
  rather than dated from a release date elsewhere in the same sentence. Mutually exclusive
  with `dueLabel`.
- `dueSlot` is *"a zero-based **grid column**, for a table with no header row to name"*,
  and `titleSlot` is *"the title's grid column, for the same table"*. A grid column, not
  a child index: `core/table-grid.ts` lays the table out the way a browser does, so a
  `rowspan` above and a `colspan` beside both move the column rather than shifting this
  row's cells under it. This is the one place house rule 3 is knowingly broken, and it is
  paid for by the hit-rate guard below. Mutually exclusive with `columns.due` and
  `duePrev`.
- `titleBefore` is *"a literal separator; the title is everything before its first
  occurrence"* — `[HW1 Document]: Released 8/27. Due @ 9/20…` is called "HW1 Document".
  §3.1 hashes the title, so without it the `sourceId` changes whenever the course edits a
  word of the sentence, losing every override on the row, and the popup's title column
  holds a paragraph. A title wholly wrapped in `[ ]` loses the brackets, because those are
  the page's own list punctuation rather than part of the name. Applied before
  `splitTitle` and before `filter`. A literal, never a regex, for the reason `splitTitle`
  is one.
- `defaultTime` is *"`HH:mm`: the hour this **page** states its work is due at, once, in
  prose"* — ECE 374 A prints "Written homeworks are due every Tuesday at 9pm" above a
  list of bare dates. *"Lowest precedence but one: a clock in the date cell wins, then a
  clock the row states elsewhere, then this, then 23:59."* And `extra.timeAssumed` is
  **still set**: this is an adapter's inference from a sentence, not a clock this row
  states, and §5.3 must go on preferring a real Canvas instant (worker rule 3).

## Where the date comes from — exactly one locator per entry

Four fields answer "which text on this page is this row's date". An entry declares one;
`validateAdapter` refuses two, and `dueLocatorOf` reads them in this order as belt to
that braces. *How* the date is then read out of that text is the next table's question.

| Locator | Written for | What it guards against |
|---|---|---|
| `columns.due` | ECE 310's homework table | The table's own header row, re-resolved on every parse, so an added column cannot shift the date to the solutions column. |
| `dueSlot` | CS 424's schedule | A grid column for a table with **no** header row to name. Positional by necessity, so it is guarded by output instead of by input. |
| `duePrev` | ECE 374 A's `<dl>` homework list | The nearest preceding **sibling**, never leaving the row's parent — so a row with no date of its own cannot borrow the list above's. |
| `due` (with `@attr`) | everything else | A selector relative to the row; `@attr` reads an attribute rather than the text. The fallback every entry carries. |

## How the date is read out of the text

| Reader | Reads | Written for |
|---|---|---|
| none | The whole located text | A cell that holds a date and nothing else. |
| `dueLabel` | `<label>: <rest>`, the label matched exactly after whitespace and case are normalised | ECE 411's `Due: 9/7` bullets |
| `duePhrase` | The text after a whole-word keyword, when something date-shaped follows within one connector | CS 425's `Due @ 9/13 11.59 PM Central Time (Sun).` |

`dueLabel` and `duePhrase` are refused together: both read the date out of the located
text, and an entry declaring both has not decided what the page looks like.

## What validation refuses

`src/core/registry.ts` is the only place this extension ingests data authored
elsewhere, so it is a trust boundary:

- a `url` that is not **https**. It used to have to be on `*.illinois.edu`, because §2.3
  said course sites live on illinois.edu subdomains. That was incomplete when written,
  not merely stale: the CS department's sites are their own domains — cs124.org,
  cs128.org, cs225.org — and those are the highest-enrolment courses there are, so the
  rule excluded exactly the students most likely to want the feature.
  `optional_host_permissions` covers every https host now, which is safe only because of
  the `hostPattern` rule directly below. The popup's own `safeUrl` was a second copy of
  the old rule and outlived it by six days, rendering every cs225.org row as an
  unclickable div; `src/capture.ts` was a **third** copy and outlived it by six more,
  so a student could add a cs225.org adapter and then not capture the page it points
  at. All three are the same check now, and capture asks only for https — which host
  it is on is decided by the permission prompt, not by a hostname list (mutation house
  rule 3);
- a `hostPattern` that is not **exactly** `https://<the url's host>/*` — the pattern is
  what `chrome.permissions.request` asks for, so a wildcard like
  `https://*.illinois.edu/*` (the manifest's own optional entry, and therefore
  grantable) would prompt once for every illinois.edu site. Worse: only the adapter
  **id** is stored, so a later daily refresh could repoint that adapter's `url` anywhere
  under the wildcard with no second prompt and no user action at all;
- an unsupported `dateFormat`, a `filter` that is not a valid regex, a duplicate `id`,
  a missing required field, a file over 512 KB or over 200 adapters;
- a 1.1.0 field that is not the shape it has to be: `bad duePrev`, `bad duePhrase` or
  `duePhrase has an empty keyword` (an empty keyword in `"due|"` matches at every
  position in every sentence on the page), `bad titleBefore`,
  `bad dueSlot (a column index from 0 to 99)` — the same line for `titleSlot`, because
  `NaN`, `1.5` and `-1` are all numbers and each indexes the grid to `undefined` on every
  row, which reads as "this course has no deadlines" rather than as a bad entry — and
  `bad defaultTime (HH:mm, 24-hour)`, checked with an anchored regex rather than
  split-and-`Number` because `Number("")` is 0 and would put every deadline on the page
  at midnight, a whole day early and looking exactly like a real answer;
- two answers to one question: `columns.due and duePrev each locate the date cell;
  declare one` (any two of `columns.due`, `dueSlot` and `duePrev`, named in the message),
  `columns.title and titleSlot both locate the title cell; declare one`, and
  `dueLabel and duePhrase both read the date out of the located text; declare one`.
  Refused rather than silently ranked, because the ranking would be invisible in the
  preview — what the student approves would not be what the runner goes on reading;
- `unknown field ${key}`. A key this build has never heard of means the entry was written
  for a later one, and running it on the fields we *do* recognise would read the wrong
  cell rather than nothing. `KNOWN_FIELDS` is a
  `satisfies Record<keyof Adapter | "$comment", true>`, so the compiler notices when
  `Adapter` gains a field, and `$comment` is allowed because the shipped registry already
  uses it;
- `bad minExtensionVersion (a dotted version like 1.2.0)`, and
  `needs extension 1.1.0, this is 1.0.0`.

A single bad entry is dropped and reported; the rest of the file still applies, so one
broken adapter cannot block a fix for a different course. A file that is not a registry
at all is rejected whole and **the previously stored copy is kept** (§4.5).

## The version gate, which is real as of 1.1.0

`minExtensionVersion` was a string nothing ever read. It is enforced now: an entry that
demands a newer build than this one is dropped with a reason, and the worker prints the
counts with the version that decided them — `[registry] 8 adapters accepted by 1.1.0,
0 rejected`. "3 rejected" against an unknown build is a mystery; against 1.0.0 it is
"update and they come back".

The registry is one published file and every installed build reads it, so an entry using
a new field *will* reach a build that does not have it. Dropping it is the only honest
answer: running it would mean reading the date out of whichever hook the old code does
understand, which is a wrong deadline rather than a missing one.

An entry carries the version that introduced its fields, and nobody has to remember which
build learned `duePrev`: `requiredVersionFor` returns `1.1.0` when an entry uses
`duePrev`, `duePhrase`, `dueSlot`, `titleSlot`, `titleBefore` or `defaultTime`, and
`0.1.0` otherwise, and the search writes it onto every proposal. **So a new field means a
manifest bump.** Until one ships, no build has the code the entry needs: every installed
copy reads it at the next daily refresh and refuses it as `unknown field`, which is the
right answer and not a substitute for shipping the version that can run it.

An update also clears the registry's own refresh window (`registryDueForRefresh`), so the
first sync after it refetches. §4.5 rests the registry for a day after any attempt, and
the entries a build was refusing as `needs extension 1.1.0` are exactly the ones the new
build should pick up — leaving the window in place means the student updates and still
sees nothing for up to 24 hours. Both branches are logged, because "nothing to clear" and
"the clear never ran" are otherwise the same silence (worker rule 5).

## What CS 424 taught us (the first real adapter)

`fixtures/sites/cs424-fa2026-schedule.html` is a real capture, and it broke two
assumptions the synthetic fixture had let stand:

**Row cell counts vary.** The table uses `rowspan` for unit labels, so a row carries 7
cells when it opens a unit block and 6 when it does not — and some carry 5, 4 or 1
because a `<td>` is simply missing. `td:nth-child(n)` is therefore wrong about half the
time, and `nth-last-child` is wrong for the 5-cell rows. What is stable is that the
spacer cells all use one presentational class, so `td:not(.auto-style6)` finds the date.
Matching on a presentational class is exactly as brittle as it sounds — which is the
argument for adapters being remote data, fixable without a store re-review.

**One cell can hold two events, only one of which is a deadline.** The HW/MP column reads
`HW5 Due; HW6 Out`. Without splitting, the row yields one item with a nonsense title, and
`filter` cannot reach inside it to reject the half that is a release rather than a
deadline. That is §4.5's "extend the schema with a new declarative field" case, and the
field is `splitTitle`:

```json
"title": "td:nth-last-child(3)",
"splitTitle": ";",
"filter": { "include": "\bdue\b" }
```

Split first, then filter each part, then emit one item per surviving part. `splitTitle`
is a **literal** separator and never a regex: adapter data is remote and is applied to
every row of every page, so a regex there would be a ReDoS waiting to happen.

The page also proves the fetch path end to end: it is Shibboleth-protected and answers
**401 in place** rather than redirecting to an SSO host, which is why the runner checks
`looksLoggedOut` before its status test.

## Name the column, do not count to it

`columns` reads a table's own header row instead of a CSS selector:

```json
"rows": "#homework table.timetable tbody tr",
"columns": { "title": "Exercises", "due": "Due Date|Deadline", "link": "Exercises" }
```

This is house rule 3 in declarative form. `td:nth-child(2)` is wrong the moment a
course adds a column, and it fails *silently*: the date column becomes the solutions
column and every row lands undated, or dated from the wrong text. A header name is
re-resolved on every parse, so an added column costs nothing. Alternatives are separated
by `|`, because the same column is called different things across courses and an adapter
should not need editing when only the wording differs.

Matched **exactly** after whitespace and case are normalised — never by substring. The
ECE 310 page is its own counterexample: its schedule table has a column headed
`Assessment Due` whose cells hold `HW1`, while its homework table has `Due Date` whose
cells hold the dates. A substring match on `due` reads an assignment name as a deadline.

A named column that is not on the page throws for that adapter, naming the column, so
the fix is one registry edit. `title` / `due` / `link` stay required and are the fallback
for pages that are not tables — CS 424's rowspan grid, a list of prose items.

A header's position is not a cell's position, so `columns` resolves through the same grid
`dueSlot` uses: a `<th colspan="2">` shifts every later column, and counting children
would read the wrong cell on every row of a table that has headers and looks entirely
ordinary.

## `label: value` lines under a heading

CS 424 is a rowspan grid and ECE 310 is a header table. ECE 411 is neither — it is a
Sphinx page whose deadlines are bullets:

```html
<section id="mp-setup">
  <h3>mp_setup</h3>
  <ul class="simple">
    <li><p>Release: 8/25</p></li>
    <li><p>Due: 9/7</p></li>
  </ul>
</section>
```

Three fields cover it, all optional:

```json
"rows": "#mp-information ul.simple > li",
"title": "p",
"titleFrom": "section >> h3",
"due": "p",
"dueLabel": "Due|CP1 Due|CP2 Due|CP3 Due|Advance Features Due"
```

- **`dueLabel`** reads the due text as `<label>:<rest>`. `rest` goes to the date parser —
  which matters because the date formats are `^`-anchored, so `Due: 9/7` parses as
  nothing at all until the label comes off the front. The label is matched **exactly**
  after whitespace and case are normalised, never by substring, for the same reason
  column headers are: `Due Date: 11/3` contains `Due`, and a substring match dates the MP
  from a line the adapter never asked for with nothing on the page looking wrong. A line
  whose label was not declared — `Release: 8/25`, `Location: ECEB 1002` — is not a
  deadline row and is skipped rather than emitted undated. A page where *no* row carries
  a declared label throws, naming the labels, exactly like a named column that has left
  the table.

  The matched label is also **appended to the title**, minus a trailing `Due` (which
  every deadline line carries and so names nothing). That is what makes `mp_pipeline CP1`,
  `CP2` and `CP3` three items: §3.1 hashes the title, so without it the three checkpoints
  share one `sourceId` and `KeyGuard` keeps one of them.

- **`titleFrom`** gives a row a name it does not have. `section >> h3` climbs to
  `row.closest("section")` and reads the `h3` inside; without the `>>` the spec is a
  heading selector and the nearest match *preceding* the row in document order wins. The
  label's position in the list varies by section — `mp_setup` puts `Due` second, `mp_ooo`
  has five labelled lines — so `nth-child` is wrong here for house rule 3's reason.

- **`time`** supplies the clock when the due text states none. ECE 411's syllabus prints
  `Midterm 1: September 29` with `Time: 7-9PM` in a sibling `<li>`; with `"time": "ul"`
  the exam lands at 19:00 instead of an invented 23:59, and carries no `timeAssumed`.
  A range gives its **start**, and a range written with one meridiem lends it to the
  start. The search is anchored on the word `Time`, exactly as `statedTimeInText` is
  anchored on `due`: a room number is a number too, and an unanchored search finds
  `ECEB 1002` first.

## What CS 425 taught us: the deadline is mid-sentence

`fixtures/sites/cs425-fa2026-assignments.html` is hand-written HTML with no data table on
it at all. Each assignment is one `<li>` holding a whole sentence, and there are three
dates in it:

```html
<li>[<a href="MP1.CS425.FA26.pdf">MP1 Specification Document</a>]:
  <span style="color: black;">Released 8/25</span>.
  <span style="color: black;"> Due @ 9/13 11.59 PM Central Time (Sun).
  Demos on 9/14 (Mon)</span>.</li>
```

Only the middle one is a deadline. There is no column, no `label: value` line, and no
element around the date either — the same `<span>` wraps the release date, the deadline
and the demo date, and on five of the eight rows there is no inner element worth naming.
So the *word* is the hook: `duePhrase: "due"`.

Three rules, each forced by something on this page:

- **A keyword only counts when something date-shaped follows it**, within one connector
  of `:` / `@` / `on` / `by` / `at`. The page has three bullets that say "due" and name
  no date — `MPs are always due on a SUNDAY at 11.59 PM Central Time` is one — and
  without this rule each becomes an undated row titled with the policy sentence. The
  adversarial fixture puts one mid-row: `To be Released 12/1, due to the printer's
  schedule. Due @ 12/10`, where hooking on the keyword alone dates HW5 nine days early. A
  placeholder counts as a hook, though: `Due Date: TBD` is the page naming this row's
  deadline, so the row is kept and reported undated rather than dated from the release
  date sitting in the same sentence.
- **Whole word, never substring** (house rule 6). The live page writes "the due-date";
  the adversarial fixture adds `Overdue 12/15. Undue 12/16.`, and a substring match dates
  the row from either.
- **Every occurrence is tried in document order, and the first that parses wins.** HW1's
  line carries two on the live page: `Due @ 9/20 at 11.59 PM Central Time. (HW1 is due on
  a SUNDAY!)`. The adversarial fixture makes the order visible, with `Due @ 12/13` and
  `Resubmissions due @ 12/20` both hooking on one row.

`titleBefore: ":"` takes the name off the head of the sentence and drops the brackets,
which are the page's own list punctuation. The evidence, row by row, is in
**[docs/cs425-findings.md](cs425-findings.md)**.

## What ECE 374 A taught us: the date is the element before the row, and the clock is stated once

`fixtures/sites/cs374a-fa2026-homeworks.html` is a definition list. The date is the `<dt>`
and the assignment is the `<dd>` after it:

```html
<dl class="calendar">
  <dt>Tue Sep 01</dt>
  <dd><a href="homeworks/hw1.pdf">Homework 1</a>: Strings and induction — […]</dd>
</dl>
```

The date is not in the row, not in a cell of it, and **not in an ancestor of it**. `due`
runs `querySelector` inside the row; `columns.due` needs a table; `titleFrom`'s
`section >> h3` climbs to an ancestor and looks inside it, and there is no ancestor that
holds this row's `<dt>` and not the next fifteen. `titleFrom`'s other form walks the
document backwards and does not stop at the parent, so a `<dd>` with no `<dt>` of its own
reaches past the `<hr>` into the list above — one assignment dated from another, silently.

`duePrev: "dt"` is the nearest preceding **sibling**, and it never leaves the row's
parent. Two details the capture forced: the **whole element** is read rather than its
first text node, because week 2's deadline moved off a Tuesday and the page marks that by
bolding the `<dt>` (`<dt><em><strong>Wed Sep 09</strong></em></dt>`); and **nearest, not
first**, which nothing on the live page exercises, so the adversarial fixture puts two
`<dt>`s before one `<dd>`.

**The clock is stated once, in prose above the list**: "Written homeworks are due every
Tuesday at 9pm". The `<dt>`s carry bare dates, so every row landed on §4.5's invented
23:59 — three hours late, with a two-hour reminder arriving at 21:59, an hour after the
deadline had passed. `defaultTime: "21:00"` is that sentence written down as data. It
does **not** clear `extra.timeAssumed`, and that is the point: 21:00 on a row is this
extension's inference from a sentence about homework in general, and §5.3 ranks `site`
above `canvas`, so an unflagged inference would silently replace a real instructor-set
deadline (worker rule 3). Precedence is the cell, then a clock the row states elsewhere,
then `defaultTime`, then 23:59 — the adversarial fixture has a row stating "due by
11:59pm" and it wins.

This is also the first adapter to link a *relative* same-origin href, and it found a
defect that had been there since the first adapter: `runAdapter` resolved every href
against `new URL(adapter.url).origin`, so `homeworks/hw1.pdf` became
`https://courses.grainger.illinois.edu/homeworks/hw1.pdf` — same origin, https, past
every check in `sameOriginHttpsUrl`, and a 404 in the browser. It takes a base now, and
resolves against the page. A row that links nowhere is worse than one that links to the
course page, because the student has no way to tell which happened.

The course ships as two entries, `cs374a-fa26-hw` and `cs374a-fa26-gps`, for the reason
ECE 411 does. Every link on the GPS page is on `us.prairielearn.com`, so house rule 7
falls every one of those rows back to the course page. `calendar.html` is committed as a
fixture with **no** registry entry: it repeats the same deadlines under different
`sourceId`s, and it exists because it is the only capture with enough repeated structure
to exercise a search over a large page. The rest is in
**[docs/cs374a-findings.md](cs374a-findings.md)**.

## The grid, and why CS 424 keeps its class selector

`src/core/table-grid.ts` is the WHATWG "forming a table" algorithm, as much of it as a
parser needs. A `<tr>`'s children are not its columns: a `rowspan` in an earlier row
occupies a slot in this one, and a `colspan` beside occupies several, so `cells[2]` is a
different column on every row of a table that uses either. That is house rule 3's cost —
recorded as 14 items — and both shapes that need the grid are real: CS 424's schedule,
which has no header row at all, and a `<th colspan="2">` on a table that does, which
shifts every later column while looking entirely ordinary.

`dueSlot` and `titleSlot` address that grid, and they are the only positional addressing
in the project. Positional **by necessity**: CS 424's schedule has no header row (its
first row is seven `<td>`s), no class on its date cells, and rows carrying 7, 6, 5, 4 or
1 children, so `nth-child` is wrong on most of them and `nth-last-child` on the rest.
There is nothing to name.

So the guarantee comes from the output instead of the input. A date column reads as a
date: the slot must parse on at least `MIN_DATED_ROWS` (2) rows and `MIN_DATED_SHARE`
(50%) of the rows that have text there, or the adapter throws naming the column and both
counts — `adapter cs424-fa26: column 2 read as a date on 0 of 32 rows, below the floor of
2 rows and 50%; a column has moved`. Counted over **every matched row**, before the loop:
a count taken inside it would only see rows that already have a title, and on a shifted
grid those are a self-selected set — exactly the rows least able to answer the question.

**The shipped `cs424-fa26` entry is unchanged.** It still reads `td:not(.auto-style6)`,
because the class works and rewriting a working entry buys nothing. What the grid gets
instead is an identity test: the same page, read with `dueSlot: 1` and `titleSlot: 4`,
must produce exactly the nine rows the shipped selectors do. Its `title` and `due` are
deliberately dead selectors, because with the shipped ones left in place the whole block
proved nothing — removing the `titleSlot` branch fell through to
`title: "td:nth-last-child(3)"`, which produces the same nine rows, and the mutation
survived (mutation house rule 4: the adversarial input never reached the line).

## One course, two adapters

An adapter has one fixed `url`, and ECE 411 keeps its MPs on `assignments.html` and its
exam dates on `syllabus.html`. So the course ships as **two registry entries** —
`ece411-fa26-mp` and `ece411-fa26-exams` — with one `courseCode`. Only `id` has to be
unique; `courseCode` is what merges them back into one course in the popup.

This is the general answer to "course sites split across pages", and it needs no schema
change: a second entry costs a registry edit and no build. The cost is that the student
sees and enables two rows for one course, which is honest — they are two pages and either
can break on its own.

CS/ECE 374 A is the second course to need it — `cs374a-fa26-hw` for `homeworks.html` and
`cs374a-fa26-gps` for `gps.html`, both under `courseCode` `CS374` — which is what turned
this from ECE 411's special case into the pattern.

## Adding one yourself

Settings → Course websites → **Add a course site**. Paste the page that lists the
deadlines, press **Read this page**, and it shows the rows it found — assignment names
on the left, the dates it read on the right — before anything is saved.

That preview is the whole safety argument. `src/core/detect.ts` proposes; it does not
decide. A wrong column produces visibly wrong titles and dates, and the student taking
the course is the only one who can tell. It is also why the count is shown above the
rows: "13 of 13" and "6 of 20" are different answers, and the second means the page is
not fully covered.

The proposal is a search, not a guess — and one search rather than a shape per site. It
takes the page's repeated structures (every set of sibling elements that looks like a
list of rows) and tries each date locator and each supported format against each of them:
a named column, a grid slot, a preceding sibling, a label, a keyword in a sentence, a
`time[datetime]`. Every combination that clears the thresholds is then run through **the
real `runAdapter`**, on the page that was just fetched, and judged by what comes out;
candidates that produce the same rows are one candidate. That is why it needs no model:
the question has a checkable answer, and the thing checking it is the code that will do
the reading. It reaches `ece310-fa26` unaided — same table, same two columns, same
format, 13 of 13 rows — and ECE 411's MP page, CS 425's sentences, ECE 374 A's definition
list, and CS 424's headerless schedule through the grid locator.

When the search finds nothing, and only then, Chrome's built-in on-device model is
asked instead, and whatever it proposes is run through the real runner on the page
that was just fetched before the student ever sees it. That path is its own decision
and its own document: **[docs/adapter-author.md](adapter-author.md)**, which says why
the search comes first, what the model is shown (`core/skeleton.ts`), and what it is
checked against (`core/author.ts`).

A saved adapter goes in `store.localAdapters`, apart from the fetched registry so a daily
refresh cannot overwrite it, and through `validateAdapter` exactly like a published one.
Typed by a student rather than fetched from GitHub changes nothing about what a bad `url`
or `hostPattern` could do.

**Copy for sharing** puts the entry on the clipboard. A locally added adapter helps one
person; pasting it into this registry helps everyone in the course. There is no automatic
submission and there should not be: accepting an entry means trusting a URL and a set of
selectors written by a stranger, and a human reading the paste is that check.

## Seeding another one

§4.5 asks for 2–3 seed adapters. Eight ship: `cs424-fa26`, `ece310-fa26`, `ece391-fa26`,
`ece411-fa26-mp`, `ece411-fa26-exams`, `cs425-fa26`, `cs374a-fa26-hw` and
`cs374a-fa26-gps`, each written against a real captured page. The last three declare
`minExtensionVersion: "1.1.0"`, so a 1.0.0 install drops those three by name and keeps
the other five.

**Delivery is live as of 2026-09-10.** The registry is published at
`https://raw.githubusercontent.com/sushelan/illini-dash/main/adapters/registry.json`
and returns 200. Adding a course is therefore: edit that one JSON file, push, and every
installed copy picks it up on its next daily refresh — no new build, no reinstall, no
store review. That is the whole reason §0 decision 4 makes adapters data.

**To seed one**, capture the page with the options-page capture tool (it accepts any
https URL you hold the host permission for), then send it over. From the saved HTML the selectors are usually
obvious in a couple of minutes. Good candidates are courses whose real schedule lives on
the course site rather than in Canvas or Gradescope.

Two things to check on the captured page first:

1. **Is the schedule in the HTML at all?** Some course sites build their table in
   JavaScript, and `fetch` returns an empty shell. The runner cannot run JS. §4.5 says
   such a site should carry `renders: "client"` in the registry so the UI can warn —
   not yet implemented, because no such site has been seen.
2. **Is it behind Shibboleth?** That works while the SSO session is alive and reports
   `needs_login` when it is not, like any other source.

`fixtures/sites/example-course-schedule.html` is **synthetic** — it exists so the runner
can be tested against the shapes course sites use, and is deliberately awkward in the
ways real pages are: a header row, a row the filter must exclude, an unparseable date,
and a duplicate.
