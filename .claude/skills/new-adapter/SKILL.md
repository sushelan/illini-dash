---
name: new-adapter
description: Add a course-site adapter to illini-dash — from a captured page to a registry entry in adapters/registry.json. Use when someone wants a new course, department schedule or course website tracked, when a captured course page arrives, when an existing adapter's selectors break, or when deciding adapter vs. new source. Covers the schema, the three page shapes, the date grammar, the fixture test, and the delivery loop.
---

# Adding a course-site adapter (§4.5)

docs/adapters.md: *"Adapters are **data, not code**. Manifest V3 forbids remotely loaded
code, so an adapter is a URL, a few CSS selectors and a date format — never a script."*
That is what lets a broken selector be fixed by editing a JSON file on GitHub, *"without a
store re-review that takes days"*.

## 0. Is it even an adapter?

CLAUDE.md parser rule 13: *"A per-student URL means a source, not a §4.5 adapter. An
adapter has one fixed `url`, so anything addressed by an enrolment or account id …
cannot be served by one. Check the URL shape before writing selectors."* A per-student URL
means a day's work, fixtures, a manifest change and a review — not a registry entry.

Also open, needing a decision rather than a patch: **a course split across two pages**
(ECE 391's `schedule.html` and `exams.html`). One adapter is one URL, so half of such a
course cannot be read.

## 1. The capture

Use the capture-ask skill: the options-page **Fixture capture** tool accepts any
`*.illinois.edu` URL, scrubs per Appendix A, and hands back a file for
`fixtures/sites/`. Two things to check on it first (docs/adapters.md):

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

`src/core/registry.ts` is a trust boundary and refuses: a `url` that is not **https on
`*.illinois.edu`**; a `hostPattern` that is not **exactly** `https://<the url's host>/*`
(a wildcard would prompt once per illinois.edu site, and *"only the adapter **id** is
stored, so a later daily refresh could repoint that adapter's `url` anywhere under the
wildcard"*); an unsupported `dateFormat`; an invalid `filter` regex; a duplicate `id`; a
missing field; >512 KB; >200 adapters. One bad entry is dropped and reported; a file that
is not a registry at all is rejected whole and **the stored copy is kept**.

## 3. The three page shapes

| Shape | Field | Note |
|---|---|---|
| Table with a header row | `columns: { title, due, link }` | Header names, matched **exactly** after whitespace/case normalising, alternatives with `\|`. House rule 3 in declarative form: *"`td:nth-child(2)` is wrong the moment a course adds a column, and it fails silently."* A named column not on the page throws, naming the column. |
| `rowspan` grid, no header | `title`/`due` selectors + `splitTitle` | CS 424: cell counts vary 7/6/5/4/1, so `nth-child` is *"wrong about half the time"*; the spacer cells share a class, hence `td:not(.auto-style6)`. One cell holds `HW5 Due; HW6 Out`, so `"splitTitle": ";"` splits, then `filter` rejects each part. `splitTitle` is a **literal** separator, never a regex — remote data applied to every row would be a ReDoS. |
| `label: value` prose list | `dueLabel` / `titleFrom` | The list shape (a parallel worker is landing these fields). Check `src/sources/site.ts` and `docs/adapters.md` for the exact names and semantics before writing an entry against it. |

Never substring-match a header: ECE 310 has `Assessment Due` holding `HW1` *and*
`Due Date` holding the dates — *"a substring match on `due` reads an assignment name as a
deadline."*

## 4. The date grammar

`dateFormat` is **chosen from a closed set, not supplied** — `supportedDateFormats()` in
`src/sources/site.ts`: `yyyy-MM-dd`, `MMM d, h:mm a`, `M/d`. Each is a start-anchored
regex with optional weekday, separator and time, so `Tue, Sep 8`, `09/04 @ 11:59pm` and
`Fri, 2026-09-11 at 18:00` all parse. A bare `5` with no meridiem is **not** read as a
time: *"guessing would put a 5 PM deadline at 05:00 — worse than admitting the time is
unknown, because it looks stated."*

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

Students can add their own: Settings → Course websites → **Add a course site** →
**Read this page** shows the rows before anything is saved (`src/core/detect.ts`
*proposes; it does not decide*). Those land in `store.localAdapters`, apart from the
fetched registry, and go through `validateAdapter` exactly like a published one.
**Copy for sharing** puts the entry on the clipboard; accepting one into the registry
means a human reading the paste, and there is no automatic submission.
