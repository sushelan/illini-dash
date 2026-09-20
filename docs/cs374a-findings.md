# CS/ECE 374 A (FA 2026) — what the pages actually say

Captured 2026-09-18 with `curl`, no login. All three are public:

- `https://courses.grainger.illinois.edu/cs374al1/fa2026/homeworks.html`
- `https://courses.grainger.illinois.edu/cs374al1/fa2026/gps.html`
- `https://courses.grainger.illinois.edu/cs374al1/fa2026/calendar.html`

Saved verbatim as `fixtures/sites/cs374a-fa2026-{homeworks,gps,calendar}.html`,
unscrubbed — see `fixtures/sites/README.md` for why. The only identifiers on them are a
Gradescope course id and its self-enrolment code, a PrairieLearn course instance id, a
MediaSpace channel id, a Discord invite and an Ed Discussion join link: everything the
course prints for the whole class, plus one guest lecturer's name in a lab title.

## Three pages, two adapters

| id | page | rows |
|---|---|---|
| `cs374a-fa26-hw` | `homeworks.html` | Homework 1–11 |
| `cs374a-fa26-gps` | `gps.html` | Guided problem set 1–11 |
| — | `calendar.html` | fixture only, deliberately no entry |

An adapter has one fixed `url`, so the two coursework pages are two entries under one
`courseCode` — the same answer ECE 411 needed for assignments and exams.

**`calendar.html` gets no entry on purpose.** It is fifteen `<dl>`s and 93 dt/dd pairs,
most of them lectures, labs and discussion sections. The homeworks and GPSs it repeats
are already read from their own pages, so an entry here would emit every deadline a
second time under a different `sourceId`; §5.3 would merge most of them and the rest
would sit in the list twice. It is committed because it is the only capture with enough
repeated structure to exercise a search over a large page.

## The page shape: the date is the row's previous sibling

```html
<dl class="calendar">
  <dt>Tue Sep 01</dt>
  <dd><a href="homeworks/hw1.pdf">Homework 1</a>: Strings and induction
      — [<span class="extra-links"><a href="solutions/hw1-sol.pdf">solutions</a></span>]</dd>
  <dt><em><strong>Wed Sep 09</strong></em></dt>
  <dd><a href="homeworks/hw2.pdf">Homework 2</a>: Regular expressions, DFAs — […]</dd>
  …
</dl>
```

A definition list. The date is not in the row, not in a cell of it, and **not in an
ancestor of it** — it is the element immediately before it. Everything the schema had
fails:

- `due` runs `querySelector` inside the row.
- `columns.due` needs a table.
- `titleFrom`'s `section >> h3` climbs to an ancestor and looks inside it; there is no
  ancestor that contains this row's `<dt>` and not the next fifteen.
- `titleFrom`'s no-`>>` form walks the document backwards and does not stop at the
  parent, so a `<dd>` with no `<dt>` of its own reaches back past the `<hr>` into the
  `<ul>` above — one assignment dated from another, silently.

Hence `duePrev: "dt"`: the nearest preceding **sibling** that matches, never leaving the
row's own parent.

Two details the capture forced:

- **The whole element is read, not its first text node.** Week 2's deadline moved off a
  Tuesday and the page marks it by bolding the `<dt>`:
  `<dt><em><strong>Wed Sep 09</strong></em></dt>`. A `dt > text()` reading would miss the
  one date on the page that is not on the usual weekday.
- **Nearest, not first.** Nothing on the live page has two `<dt>`s before one `<dd>`, so
  the adversarial fixture adds a pair: taking the first match rather than the nearest
  puts a deadline a day early.

## The clock is stated once, in prose, above the list

> Written homeworks are due every **Tuesday at 9pm** unless announced otherwise.

`gps.html` says the same for Mondays at 9pm, and `calendar.html` says it a third way
("All guided problem sets and written homeworks are **due by 9pm**"). The `<dt>`s
themselves carry a bare date and no clock, so §4.5's runner invents 23:59 — **three hours
late**, and a two-hour reminder aimed at that fires at 21:59, an hour after the real
deadline has passed.

`defaultTime: "21:00"` is that sentence, written down as data.

**It does not clear `extra.timeAssumed`, and that is the point.** 21:00 on a row is this
extension's inference from one sentence about homework in general — the row itself says
nothing about a clock. §5.3 ranks `site` above `canvas` for `dueAt`, so an unflagged
inference would silently replace a real instructor-set Canvas deadline and look
authoritative doing it (worker rule 3). Precedence is: a clock in the date cell, then a
clock the row states elsewhere, then `defaultTime`, then 23:59. The adversarial fixture
has a row that states `due by 11:59pm` and it wins, because a row that contradicts the
page's usual hour means it.

## `titleBefore` and the link

`titleBefore: ":"` takes `Homework 1` out of
`Homework 1: Strings and induction — [solutions]`. §3.1 hashes the title, so leaving the
topic in means the `sourceId` changes whenever the course edits a topic — and the course
says in as many words that future topics are subject to change.

`link: "a@href"` takes the **first** `<a>` in the `<dd>`, which for Homework 1–4 is the
homework PDF and not the solutions link (that one is inside the trailing
`<span class="extra-links">`). Homework 5–11 are not posted yet and carry no `<a>` at
all, so those fall back to the page.

### One defect this page found

The href is `homeworks/hw1.pdf` — relative to the page, not to the origin. `runAdapter`
was resolving every link against `new URL(adapter.url).origin`, which turned that into
`https://courses.grainger.illinois.edu/homeworks/hw1.pdf`: same origin, https, past every
check in `sameOriginHttpsUrl`, and a 404. It had been invisible because no adapter until
now declared a `link` whose href was relative — ECE 310's are absolute `http:` (and
therefore the fallback, house rule 7) and the synthetic fixture's are root-relative,
which resolves the same either way. `sameOriginHttpsUrl` now takes the base to resolve
against; the origin check is unchanged.

## What the entries read

`cs374a-fa26-hw`, against the capture with `fetchedAt` 2026-09-18 — eleven rows,
Homework 1 … Homework 11, at 21:00 local, `timeAssumed` on every one:

```
2026-09-01, 09-09, 09-15, 09-22, 10-06, 10-13, 10-20, 10-27,
2026-11-03 (CST), 11-17, 12-01
```

`cs374a-fa26-gps`, eleven rows, Guided problem set 1 … 11, at 21:00 local, likewise
assumed:

```
2026-08-31, 09-08, 09-14, 09-21, 10-05, 10-12, 10-19, 10-26,
2026-11-02 (CST), 11-16, 12-07
```

Every GPS links `us.prairielearn.com`, which is off-origin, so house rule 7 falls all
eleven back to the course page. (It is also a host the manifest already holds for the
PrairieLearn source — a second reason not to follow it from here.)

## What the entries do **not** read

- **The exams.** `exams.html` is a separate page and was not captured.
- **The labs.** They are on `calendar.html` and `labs.html`, they have handouts rather
  than deadlines, and nothing on either page dates them as work owed.
- **"unless announced otherwise".** The page says the 9pm rule can move and the `<dt>`s
  are what actually change; a moved deadline shows up as a changed `<dt>`, which this
  reads. A moved *hour* announced only on Ed Discussion does not reach this extension
  from here — Piazza and the Campuswire observer are where an announcement is read.

## Amendments to SPEC.md

- **§4.5's adapter shape.** A course page can put the row's date in a sibling element
  rather than inside the row. `duePrev` covers it declaratively (house rule 9: the
  capture beats the spec). This is the fifth page shape.
- **§4.5's 23:59.** A page can state its cutoff once, in prose, and then write bare
  dates. `defaultTime` carries that, and it stays `timeAssumed` — the invention is now
  "23:59 unless the adapter knows better", not "23:59, full stop".
- **`RawItem.url` resolution.** §3 says "absolute https URL on the source host", and the
  runner was resolving relative hrefs against the host rather than the page. Same host,
  wrong path. Fixed; `sameOriginHttpsUrl` takes a base.
