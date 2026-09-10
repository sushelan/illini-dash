# PrairieTest — what the fetched HTML actually contains

Source: `fixtures/prairietest/home-booked-none-available.html`, captured 2026-09-03
from `https://us.prairietest.com/pt/`, 14631 B scrubbed. Audited: the only `@` and the
only `STUDENT` in the file are the scrubber's own placeholders.

State at capture, confirmed by Sushi against the live page: **one booked reservation
(CS 357 Quiz 1), zero exams available for reservation.**

## Server-rendered — §4.5's client-rendering worry does not apply

The page contains zero `hx-*` attributes and the card contents are present in the
fetched HTML. The `HX-Assets-Version` meta and `homeClient-*.js` in the head are
asset-versioning and progressive enhancement, not client-side rendering. §4.4's
fetch-and-parse plan works, and the §2.2 content-script fallback is not needed.

## Open question 2 — RESOLVED, and the question was mis-framed

There is **no `/pt/exam` link anywhere on the page.** The reservations-card row links to:

```html
<a href="/pt/student/reservation/3573947">CS 357 (Fa26): Quiz 1</a>
```

That is a **reservation** id, not an exam id. §4.4 says "Exam id from the link href"
and §3.1 says the PrairieTest `sourceId` is the "exam id from the exam link"; neither
is obtainable from this page. See "§3.1 problem" below.

Consequently the both-cards cross-check in §4.4 (`unbooked = present in available card
AND absent from reservations card`) must match on **exam title text**, which is the
fallback §4.4 already anticipated. The title is identical in shape across both cards
(`CS 357 (Fa26): Quiz 1`).

## The exam time is machine-readable — §4.4's regex and §3.2's year inference are unnecessary here

```html
<span class="js-format-date-friendly-live-update"
      data-format-date='{"date":"2026-09-10T18:00:00.000Z","timezone":"America/Chicago","options":{"liveUpdate":true}}'
      data-bs-toggle="tooltip"
      data-bs-title="2026-09-10 13:00:00 (Central Daylight Time)">Thu, Sep 10, 1pm (CDT)</span>
```

`data-format-date` is JSON carrying **ISO 8601 UTC plus an IANA timezone**. So for
PrairieTest we do not need §4.4's
`^(Sun|Mon|…), ([A-Z][a-z]{2}) (\d{1,2}), (\d{1,2})(?::(\d{2}))?(am|pm) \((C[DS]T)\)$`
regex, and we do not need §3.2's year inference — the riskiest date code in the
project, since it guesses a year and then checks the guess against a weekday.

**Parse `data-format-date` as primary.** `data-bs-title` (`2026-09-10 13:00:00 (Central
Daylight Time)`) is a full-date secondary, and the visible text stays as the last
resort. `RawItem.dueAt` gets `2026-09-10T18:00:00.000Z` directly.

## Structure and selectors

Cards are `div.card` > `div.card-header` > `h2` for the heading, then
`ul.list-group` > `li.list-group-item` for entries. §4.4 asked whether entries are
`li`, `tr` or `div`: they are `li`. The columns carry stable hooks, so there is no need
to select the exam link and walk up:

| Hook | Contents |
|---|---|
| `[data-testid="exam"]` | the `<a>` with the title and the reservation href |
| `[data-testid="date"]` | the `span` with `data-format-date` |
| `[data-testid="location"]` | `CBTF: <a>DCL L410</a>` + `<small class="text-muted">` detail line |
| *(fourth column, no testid)* | `50min, In-person, No accommodations` — newline-separated in source, so normalise whitespace before splitting on `, ` |

Three cards exist, not two. §4.4 documents the first two:

1. `Exams available for reservations`
2. `Exam reservations`
3. **`Testing center availability`** — undocumented, links to `/pt/student/center/{id}`.
   Not needed for v1; noted so it is not mistaken for a parse target.

## The empty-card text in §4.4 belongs to the other card

§4.4 records the empty text as `You don't have any upcoming reservations.` for the
reservations card. This capture has the **available** card empty, and its text is
different:

> *You don't currently have any exams available for reservations.*

Both are legitimate-empty markers and both must be recognised, one per card, or an
empty card becomes a spurious `ParseError` under §0 rule 3.

## Second capture, 2026-09-10 — the available card, and a reschedule

`fixtures/prairietest/home-booked-and-available.html` (16040 B) closes the gap below.

### §12 Q2 fully resolved: the available row DOES link to the exam

```html
<div class="col-xl-2 col-md-3" data-testid="action">
  <a class="btn btn-success btn-sm" href="/pt/student/exam/76745"
     aria-label="Make a reservation for CS 357 (Fa26): Quiz 2">Make a reservation</a>
</div>
<div class="col-xl-5 col-md-4" data-testid="exam">CS 357 (Fa26): Quiz 2</div>
```

The **button is the link**, and it carries an exam id. So an exam id exists — but only
on this card; the booked row still has nothing but a reservation id. The both-cards
rule therefore still matches on title, as §4.4 anticipated.

Note the hooks differ between the two cards: the booked row uses
`data-testid="date"` (singular) and its title cell is the link; the available row uses
`data-testid="dates"` (plural), `data-testid="action"`, and its title cell is plain text.

### The reservation window is machine-readable too

```html
<span class="js-format-date-range-friendly-live-update"
      data-format-date-range='{"start":"2026-09-21T05:01:00.000Z","end":"2026-09-24T04:59:00.000Z","timezone":"America/Chicago","options":{"dateOnly":true,"liveUpdate":true}}'
      data-bs-title="2026-09-21 00:01:00 — 2026-09-23 23:59:00 (Central Daylight Time)"
      >Mon, Sep 21 to Wed, Sep 23 (CDT)</span>
```

So §4.4's window regex is unnecessary as well, and §4.4's instruction to synthesise
`windowStart` as "00:00 on the first day" and `windowEnd` as "23:59:59 on the second"
is superseded by real instants: the window really runs 00:01 → 23:59 local.

### The visible text is not a fixed format

This capture was taken on the day of Quiz 1, and the booked row renders as
**`today, 9pm (CDT)`** — which §4.4's
`^(Sun|Mon|…), ([A-Z][a-z]{2}) (\d{1,2}), …$` regex rejects outright. Decisive
evidence that the attribute is the only correct source, not merely the tidier one.

### A reschedule happened between the two captures, and it proves the §3.1 amendment

Quiz 1 appears in both captures, but:

| | 2026-09-03 | 2026-09-10 |
|---|---|---|
| reservation id | `3573947` | **`3607740`** |
| room | DCL L410 | **Grainger Library 057** |
| session | Thu Sep 10, 1pm | **Sep 10, 9pm** |

§3.1 as written keys PrairieTest on the id in that href. Had it shipped, this student's
Quiz 1 would have changed `memberKey` mid-semester — losing any hide/merge on it and
re-firing its notifications — for nothing more than moving a seat. The title-derived key
in [sourceid-decision.md](sourceid-decision.md) produces `6107374e` in both captures.
This is no longer a predicted hazard; it is an observed one.

## G1 gap — closed 2026-09-10

The 2026-09-03 capture had zero rows in the available card, so §4.4's booking
pseudo-item — the daily-nag feature the spec calls the headline — had never been seen
in real markup. The 2026-09-10 capture closes that: the row, its `Make a reservation`
link, and its machine-readable window are all above, and both are parser-tested.

The one state still uncaptured is a student with **no CBTF-enabled courses at all**.
Both captures come from an account that has them, so "both cards are always rendered,
empty or not" rests on n=1 for the available card's empty case. The parser now treats a
missing card as a `ParseError`; if that assumption is wrong, this trades a silent drop
for a spurious `parse_error`, and the right shape is to require only the reservations
card and treat the available card's absence as a distinct visible state.
