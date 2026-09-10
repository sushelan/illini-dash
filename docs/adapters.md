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
- a `hostPattern` that does not cover its own `url` — the pattern is what
  `chrome.permissions.request` asks for, and a mismatch would prompt for one origin and
  then fetch another;
- an unsupported `dateFormat`, a `filter` that is not a valid regex, a duplicate `id`,
  a missing required field, a file over 512 KB or over 200 adapters.

A single bad entry is dropped and reported; the rest of the file still applies, so one
broken adapter cannot block a fix for a different course. A file that is not a registry
at all is rejected whole and **the previously stored copy is kept** (§4.5).

## Why the registry ships empty

§4.5 asks for 2–3 seed adapters for courses you or your beta testers are in. Writing one
needs the actual course page, which needs a logged-in browser — the runner, the schema,
the validator and the permission flow are all built and tested, but the selectors cannot
be invented.

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
