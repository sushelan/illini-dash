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
- `term` expires the adapter — the options page hides adapters from other terms, so a
  stale one disappears on its own rather than quietly fetching last year's page.

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
  unclickable div; it is now the same check (mutation house rule 3);
- a `hostPattern` that is not **exactly** `https://<the url's host>/*` — the pattern is
  what `chrome.permissions.request` asks for, so a wildcard like
  `https://*.illinois.edu/*` (the manifest's own optional entry, and therefore
  grantable) would prompt once for every illinois.edu site. Worse: only the adapter
  **id** is stored, so a later daily refresh could repoint that adapter's `url` anywhere
  under the wildcard with no second prompt and no user action at all;
- an unsupported `dateFormat`, a `filter` that is not a valid regex, a duplicate `id`,
  a missing required field, a file over 512 KB or over 200 adapters.

A single bad entry is dropped and reported; the rest of the file still applies, so one
broken adapter cannot block a fix for a different course. A file that is not a registry
at all is rejected whole and **the previously stored copy is kept** (§4.5).

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

## The third page shape: `label: value` lines under a heading

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

## One course, two adapters

An adapter has one fixed `url`, and ECE 411 keeps its MPs on `assignments.html` and its
exam dates on `syllabus.html`. So the course ships as **two registry entries** —
`ece411-fa26-mp` and `ece411-fa26-exams` — with one `courseCode`. Only `id` has to be
unique; `courseCode` is what merges them back into one course in the popup.

This is the general answer to "course sites split across pages", and it needs no schema
change: a second entry costs a registry edit and no build. The cost is that the student
sees and enables two rows for one course, which is honest — they are two pages and either
can break on its own.

## Adding one yourself

Settings → Course websites → **Add a course site**. Paste the page that lists the
deadlines, press **Read this page**, and it shows the rows it found — assignment names
on the left, the dates it read on the right — before anything is saved.

That preview is the whole safety argument. `src/core/detect.ts` proposes; it does not
decide. A wrong column produces visibly wrong titles and dates, and the student taking
the course is the only one who can tell. It is also why the count is shown above the
rows: "13 of 13" and "6 of 20" are different answers, and the second means the page is
not fully covered.

The proposal is a search, not a guess. For every column of every table it asks whether
the cells parse as a date the runner already supports, and keeps the columns where most
of the rows do. That is why it needs no model: the question has a checkable answer.
It reaches the hand-written `ece310-fa26` entry unaided — same table, same two columns,
same format, 13 of 13 rows. It proposes nothing for CS 424, whose schedule has no header
row and packs two events into one cell, and says so rather than inventing something
plausible.

A saved adapter goes in `store.localAdapters`, apart from the fetched registry so a daily
refresh cannot overwrite it, and through `validateAdapter` exactly like a published one.
Typed by a student rather than fetched from GitHub changes nothing about what a bad `url`
or `hostPattern` could do.

**Copy for sharing** puts the entry on the clipboard. A locally added adapter helps one
person; pasting it into this registry helps everyone in the course. There is no automatic
submission and there should not be: accepting an entry means trusting a URL and a set of
selectors written by a stranger, and a human reading the paste is that check.

## Seeding another one

§4.5 asks for 2–3 seed adapters. Five ship: `cs424-fa26`, `ece310-fa26`, `ece391-fa26`,
`ece411-fa26-mp` and `ece411-fa26-exams`, each written against a real captured page.

**Delivery is live as of 2026-09-10.** The registry is published at
`https://raw.githubusercontent.com/sushelan/illini-dash/main/adapters/registry.json`
and returns 200. Adding a course is therefore: edit that one JSON file, push, and every
installed copy picks it up on its next daily refresh — no new build, no reinstall, no
store review. That is the whole reason §0 decision 4 makes adapters data.

**To seed one**, capture the page with the options-page capture tool (it accepts any
`*.illinois.edu` URL), then send it over. From the saved HTML the selectors are usually
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
