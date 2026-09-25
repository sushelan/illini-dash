# CS 341 (fa26) — course site findings

Captured 2026-09-24 with `curl`; public, no login. Fixture: `fixtures/sites/cs341-fa2026-home.html`.

## What the site offers

| Page | Deadline text | Readable? |
|---|---|---|
| `/` (home) | `Due: Week 8 · 2026-10-12 23:59`, under "Latest Assignments" | Yes, from 1.3.1 |
| `/assignments` | A table whose Due Date column says `Week 5`, `Week 8` | No: a week number is not a date |
| `/assignments` progress bar | `title="Luscious Locks - Due: 2026-01-28 23:59"` | **Must not be read**, see below |

The home page lists only the current MP and the current lab. The adapter therefore
tracks those two as they rotate, not the whole term. Anything already released but no
longer "latest" drops off the page, and §5's normal disappearance handling applies.

## The week prefix

The formats are start-anchored, so `Week 8 · 2026-10-12` read as nothing, and the search
proposed no schedule for the page. 1.3.1 adds `WEEK_FIRST` in `src/sources/site.ts`: an
optional `Week <n>` followed by a **required** separator (`·`, `•`, `|`, `,`, `:`, or a
dash). The separator is required because, with it optional, `Week 12/1` backtracks to
week 1 and reads `2/1` as February 1st (pinned in `tests/site.test.ts`). The week number
is thrown away. Turning a week into a date would mean inventing a term start date
(worker rule 3).

The entry carries `minExtensionVersion: "1.3.1"`: a 1.3.0 build would accept it and then
leave both rows undated.

## The trap on `/assignments`

The progress bar's markers carry due dates in their `title` attributes, and on
2026-09-24 they are **spring 2026's** (January–April), while the table and the home page
are fall's. An adapter that read them would put every lab months in the past. Nothing
reads that page today. If a future entry does, it must anchor on the table, not
`.progress-marker`.

## What the search proposes, and why the registry entry is hand-written

`scripts/propose.mjs` on the home page now finds both rows, but builds a `dueLabel` out
of the whole heading text (`System Project (with AI) Malloc Due|…`). That breaks the
moment the current MP changes. The registry entry uses `dueLabel: "Due"` with
`title: "h3 a"` instead. A student using **Add a course site** on this page gets the
proposer's version. That is a proposer quality issue, not tracked here.
