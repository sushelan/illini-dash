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

- a `url` that is not **https on `*.illinois.edu`** — §2.3 requests optional permission
  for that suffix only, so anything else could never be granted and must not be offered;
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

## Seeding another one

§4.5 asks for 2–3 seed adapters. One (`cs424-fa26`) now ships; a second and third still
need real pages, which need a logged-in browser.

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
