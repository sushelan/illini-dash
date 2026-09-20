---
name: new-adapter
description: Add a course-site adapter to illini-dash — from a captured page to a registry entry in adapters/registry.json. Use when someone wants a new course, department schedule or course website tracked, when a captured course page arrives, when an existing adapter's selectors break, or when deciding adapter vs. new source. Covers the schema, where the date comes from and how it is read out of the text, the date grammar, the fixture test, the version gate, and the delivery loop.
---

# Adding a course-site adapter (§4.5)

docs/adapters.md: *"Adapters are **data, not code**. Manifest V3 forbids remotely loaded
code, so an adapter is a URL, a few CSS selectors and a date format — never a script."*
That is what lets a broken selector be fixed by editing a JSON file on GitHub, *"without a
store re-review that takes days"*.

## 0. Is it even an adapter?

AGENTS.md parser rule 13: *"A per-student URL means a source, not a §4.5 adapter. An
adapter has one fixed `url`, so anything addressed by an enrolment or account id …
cannot be served by one. Check the URL shape before writing selectors."* A per-student URL
means a day's work, fixtures, a manifest change and a review — not a registry entry.

**A course split across two pages is not open.** One adapter is one URL, so the course
ships as two entries under one `courseCode`: `ece411-fa26-mp` and `ece411-fa26-exams`,
`cs374a-fa26-hw` and `cs374a-fa26-gps`. Only `id` has to be unique, and `courseCode` is
what merges them back into one course in the popup (docs/adapters.md, *"One course, two
adapters"*). It costs a registry edit and no build; the student sees two rows, which is
honest — they are two pages and either can break on its own.

## 1. The capture

Use the capture-ask skill: the options-page **Fixture capture** tool accepts **any https
URL**, scrubs per Appendix A, and hands back a file for `fixtures/sites/`. The
`*.illinois.edu` rule it used to carry went on 2026-09-18 — it was the third copy of a
restriction `validateAdapter` had dropped six days earlier, and being the last one left
it was the one that bit: a student could add a cs225.org adapter and then not capture the
page it points at. Which host a capture is on is decided by the permission prompt, not by
a hostname list. Two things to check on it first (docs/adapters.md):

1. **Is the schedule in the HTML at all?** *"Some course sites build their table in
   JavaScript, and `fetch` returns an empty shell. The runner cannot run JS."*
2. **Is it behind Shibboleth?** That works while the SSO session is alive and reports
   `needs_login` otherwise — CS 424 answers **401 in place** rather than redirecting.

## 2. The schema

```json
{
  "id": "cs225-fa26", "label": "CS 225 course site",
  "courseCode": "CS225", "term": "fa26",
  "url": "https://courses.grainger.illinois.edu/cs225/fa2026/assignments/",
  "hostPattern": "https://courses.grainger.illinois.edu/*",
  "rows": "table.assignments tbody tr",
  "title": "td.name a", "due": "td.due", "link": "td.name a@href",
  "dateFormat": "MMM d, h:mm a", "timezone": "America/Chicago",
  "filter": { "exclude": "no submission|optional" },
  "minExtensionVersion": "0.1.0"
}
```

- `rows`: one row per deadline. **Zero matches is an error for that adapter**, never an
  empty result (§0 rule 3) — and it fails that adapter alone.
- `title` / `due` / `link` are relative to a row; a `@attr` suffix reads an attribute
  (`time@datetime`, `a@href`). They stay required, as the fallback for non-tables.
- `term` expires the adapter, so a stale one disappears instead of fetching last year.
- Six optional fields arrived in 1.1.0: `duePrev`, `duePhrase`, `dueSlot`, `titleSlot`,
  `titleBefore`, `defaultTime`. See §3.

`src/core/registry.ts` is a trust boundary and refuses: a `url` that is not **https** (the
`*.illinois.edu` rule went on 2026-09-12 — cs124.org, cs128.org and cs225.org are the
CS department's own domains and its highest-enrolment courses); a `hostPattern` that is
not **exactly** `https://<the url's host>/*` (a wildcard would prompt once for every host
it covers, and *"only the adapter **id** is stored, so a later daily refresh could
repoint that adapter's `url` anywhere under the wildcard"*); an unsupported `dateFormat`;
an invalid `filter` regex; a duplicate `id`; a missing field; an `unknown field`; two
locators for one date (`columns.due and duePrev each locate the date cell; declare one`)
or `dueLabel and duePhrase` together; >512 KB; >200 adapters. One bad entry is dropped and
reported; a file that is not a registry at all is rejected whole and **the stored copy is
kept**.

## 3. Where the date comes from

Two questions, answered separately and once each: **which text on the page is this row's
date**, and **how the date is read out of that text**. `dueLocatorOf` and `dueReaderOf`
in `src/sources/site.ts` are the single copy of each, and `core/detect.ts`'s search calls
them rather than re-deriving them.

One locator per entry — `validateAdapter` refuses two:

| Field | Written for | The trap it guards |
|---|---|---|
| `columns: { title, due, link }` | ECE 310's homework table | Header names, matched **exactly** after whitespace/case normalising, alternatives with `\|`, resolved through the grid so a `<th colspan="2">` cannot shift them. House rule 3 in declarative form: *"`td:nth-child(2)` is wrong the moment a course adds a column, and it fails silently."* A named column not on the page throws, naming the column. |
| `dueSlot` / `titleSlot` | CS 424's schedule | A zero-based **grid column** (`core/table-grid.ts`, the WHATWG "forming a table" algorithm) for a table with no header row to name: CS 424's rows carry 7/6/5/4/1 children, so `nth-child` is *"wrong about half the time"*. The only positional addressing in the project, and paid for by a loud hit-rate guard — ≥2 dated rows and ≥50% of the rows with text there, or it throws naming the column and both counts. |
| `duePrev` | ECE 374 A's `<dl>` homework list | The nearest preceding **sibling** that matches, never leaving the row's parent. The date is the `<dt>` and the row is the `<dd>`, so nothing inside the row or above it reaches the date; the parent stop is what keeps a `<dd>` with no `<dt>` of its own from taking one out of the list above and dating one assignment from another. `@attr` honoured; the plain form reads the whole element, because the page bolds a moved date as `<dt><em><strong>`. |
| `due` / `title` selectors | everything else | Relative to the row, `@attr` for an attribute. Always required, as the fallback. CS 424 still ships on these: its spacer cells share a class, hence `td:not(.auto-style6)`, and a working entry is not rewritten. |

Two more fields ride along with these rather than answering either question. `splitTitle`
splits one cell holding two events — CS 424's `HW5 Due; HW6 Out` — and then `filter`
rejects each part; `titleBefore` takes the title off the head of a sentence
(`[HW1 Document]: Released 8/27. Due @ 9/20…` → `HW1 Document`, brackets dropped) and is
applied before `splitTitle` and before `filter`. Both are **literal** separators, never
regexes — remote data applied to every row would be a ReDoS.

### How the date is read out of the located text

| Reader | Reads | Written for |
|---|---|---|
| none | The whole located text | A cell holding a date and nothing else. |
| `dueLabel` | `<label>: <rest>`, label matched **exactly** | ECE 411's `Due: 9/7` bullets |
| `duePhrase` | The text after a whole-word keyword, when something date-shaped follows within one connector | CS 425's `Due @ 9/13 11.59 PM Central Time (Sun).` |

`dueLabel` and `duePhrase` are refused together. The fields, all optional, all in
`src/sources/site.ts`:

- **`dueLabel`** — `|`-separated labels; the due text is read as `<label>:<rest>` and
  `rest` goes to the date parser. `matchDueLabel`: *"The date formats are `^`-anchored
  (deliberately: a format that matched mid-string would read a date out of any prose), so
  `Due: 9/7` parses as nothing at all until the label is taken off the front."* Matched
  **exactly** after normalising whitespace and case, never by substring — *"`Due Date: 9/7`
  is a different line from `Due: 9/7`, and a substring match on `Due` would claim both"*.
  A line whose label was not declared (`Release: 8/25`, `Location: ECEB 1002`) is skipped,
  not emitted undated; a page where *no* row carries a declared label throws, naming the
  labels. The **declared** spelling is returned, not the page's, *"so the title suffix …
  is decided by the registry and cannot be reworded by the page"* — and it is appended to
  the title minus a trailing `Due`, which is what makes `mp_pipeline CP1`/`CP2`/`CP3`
  three items instead of one (§3.1 hashes the title).
- **`duePhrase`** — `|`-separated keywords that introduce a deadline *inside a sentence*,
  for a page with no cell and no label to hang the date on. CS 425's row is
  `[MP1 …]: Released 8/25. Due @ 9/13 11.59 PM Central Time (Sun). Demos on 9/14 (Mon).`
  — three dates, one deadline. Matched as a **whole word**, case-insensitively (house
  rule 6: the page writes "Overdue" and "the due-date"), and it counts *"only when
  something date-shaped follows within one connector"* — `:` / `@` / `on` / `by` / `at`,
  with an optional "date"/"deadline" noun. That second condition is what keeps
  `MPs are always due on a SUNDAY at 11.59 PM` from becoming an undated row. Every
  occurrence is tried in document order and the first that parses wins; a keyword followed
  by TBD/TBA/N/A *"still counts as a hook"*, so the row is kept undated rather than dated
  from a release date in the same sentence. A page where no row carries a keyword throws,
  naming it.
- **`titleFrom`** — a name for a row that has none. `"section >> h3"` climbs to
  `row.closest("section")` and reads the `h3` inside; without the `>>` the spec is a
  heading selector and the nearest match *preceding* the row in document order wins.
  `nth-child` is wrong here for house rule 3's reason: *"the label's position in the list
  varies by section — `mp_setup` puts `Due` second, `mp_ooo` has five labelled lines"*.
- **`time`** — the clock when the due text states none, row-relative or scoped with `>>`.
  The syllabus prints `Midterm 1: September 29` with `Time: 7-9PM` in a sibling `<li>`;
  with `"time": "ul"` the exam lands at 19:00 rather than an invented 23:59 and carries no
  `timeAssumed` (worker rule 3). A range gives its **start**. The search is anchored on the
  word `Time` — a room number is a number too, and an unanchored search finds `ECEB 1002`
  first.
- **`defaultTime`** — `HH:mm`: *"the hour this **page** states its work is due at, once,
  in prose"*. ECE 374 A prints "Written homeworks are due every Tuesday at 9pm" above a
  list of bare dates, so every row landed on the invented 23:59 — three hours late, with
  the two-hour reminder arriving an hour after the deadline. Precedence: the date cell,
  then a clock the row states elsewhere, then this, then 23:59. It leaves
  `extra.timeAssumed` **set**, because it is the adapter's inference from a sentence
  rather than a clock the row states, and §5.3 ranks `site` above `canvas`.

Add `"kind": "exam"` when the page lists exams rather than assignments: it is per
adapter, and the popup's Exams tab filters on it.

Never substring-match a header: ECE 310 has `Assessment Due` holding `HW1` *and*
`Due Date` holding the dates — *"a substring match on `due` reads an assignment name as a
deadline."*

## 4. The date grammar

`dateFormat` is **chosen from a closed set, not supplied** — `supportedDateFormats()` in
`src/sources/site.ts`: `yyyy-MM-dd`, `MMM d, h:mm a`, `M/d`. Each is a start-anchored
regex with optional weekday, separator and time, so `Tue, Sep 8`, `09/04 @ 11:59pm` and
`Fri, 2026-09-11 at 18:00` all parse.

Three tolerances real fa26 pages forced, all additive:

- **A weekday *after* the date**, and a footnote mark after that: `09/24, Thursday 11.59
  PM`, `08/27 Thu¹`. The formats stop at the first thing they cannot read, so an unread
  trailing weekday hides whatever follows it — `09/24, Thursday 5 PM` would land six
  hours late while looking stated. Matched against an exact weekday table with a `\b`
  after it, so "9/1 Monthly report at 5pm" does not lose "Monthly" to it.
- **`11.59 PM`** — a dot as the minute separator, which CS 425 uses on all eight of its
  deadlines. With only `:` the format stopped at the date and invented 23:59, the same
  instant and therefore invisible, but carrying `timeAssumed` and so losing to any Canvas
  row (§5.3 + worker rule 3).
- **`0930 - 1045 hrs.`** — four digits with no separator, and only where the page itself
  writes `hrs`: "Sep 11 1045" is far more likely to be a room or a section. A range gives
  its **start**, and `hrs` is never ambiguous because the page has said it is 24-hour.

A bare `5` with no meridiem is still **not** read as a time: *"guessing would put a 5 PM
deadline at 05:00 — worse than admitting the time is unknown, because it looks stated."*

When no time is stated the runner fills in **23:59 and marks `timeAssumed`** (worker rule
3), `statedTimeInText` first mines the row's prose for `… due at 18:00`, and
`timeLikeTail` turns an unconsumed time-shaped tail into an unparsed field rather than a
silent invention. Never rank an assumed time above a stated one.

## 5. The fixture test (required before it ships)

A parser is a pure function over a DOM and *"must have a fixture test before it is wired
into the sync loop"*. Follow `tests/site.test.ts`: read the real capture with `linkedom`,
read the entry **out of `adapters/registry.json`** (not retyped), call
`runAdapter(adapter, doc, ctx)` with a fixed `fetchedAt`, and assert the **exact list of
titles and instants** plus `validateAdapter(entry).adapter` being defined. Assert the
count the page actually has — "13 of 13" and "6 of 20" are different answers. Then
mutation-check it (see the mutation-check skill).

## 6. Delivery

Live since 2026-09-10: the registry is published at
`https://raw.githubusercontent.com/sushelan/illini-dash/main/adapters/registry.json`.
Adding a course is *"edit that one JSON file, push, and every installed copy picks it up
on its next daily refresh — no new build, no reinstall, no store review."* Keep
`adapters/registry.json` and `dist/adapters/registry.json` in step — `tests/site.test.ts`
guards the copy step, because *"a registry that never reaches `dist/` cannot be fetched
from `chrome.runtime.getURL` at runtime."*

**An entry using a field introduced in version X carries `minExtensionVersion: "X"`;
older installs drop it with a logged reason, so a new field means a manifest bump.**
`requiredVersionFor` derives it from the fields the entry uses — `1.1.0` for `duePrev`,
`duePhrase`, `dueSlot`, `titleSlot`, `titleBefore` or `defaultTime`, `0.1.0` otherwise —
so nobody has to remember which build learned which field. The worker prints
`[registry] 8 adapters accepted by 1.1.0, 0 rejected`, and an update clears the
registry's daily rest so the first sync after it refetches what the old build refused.

Students can add their own: Settings → Course websites → **Add a course site** →
**Read this page** shows the rows before anything is saved (`src/core/detect.ts`
*proposes; it does not decide*). Those land in `store.localAdapters`, apart from the
fetched registry, and go through `validateAdapter` exactly like a published one.
**Copy for sharing** puts the entry on the clipboard; accepting one into the registry
means a human reading the paste, and there is no automatic submission.
