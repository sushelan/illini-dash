# PrairieLearn — what the fetched HTML actually contains

Source: `fixtures/prairielearn/assessments-cs357.html`, captured 2026-09-03 from
`/pl/course_instance/224254/assessments` (CS 357, Fall 2026), 33643 B scrubbed.
8 assessments, 8 credit popovers.

## Open question 1 — RESOLVED: the credit schedule is in the fetched HTML

Every `?` button carries the whole access-details table in `data-bs-content`, as an
HTML-escaped string, server-rendered. §4.3's **primary** path is available; the
cell-text regex stays as the documented fallback.

```html
<td class="text-center align-middle">
  100% until 23:59, Sat, Sep 5
  <button data-bs-toggle="popover" data-bs-html="true"
          data-bs-title="Access details"
          data-bs-content="&lt;table class=&#34;table&#34; aria-label=&#34;Access details&#34;&gt;…">
    <i class="fa fa-question-circle"></i>
  </button>
</td>
```

`getAttribute("data-bs-content")` returns the decoded HTML, so the parser needs a
second `DOMParser` pass over that string. The button sits inside the credit `<td>`,
so a row's schedule is found by containment — no id matching needed.

## Three differences from the §4.3 example

1. **The table has a header row.** `<tr><th>Credit</th><th>Start</th><th>End</th></tr>`,
   and there is no `<tbody>` in the source (the spec's example showed one; `DOMParser`
   will insert one anyway). Select data rows as "rows with `td`s", not "rows in tbody",
   and skip any row containing `th`.
2. **The 0-credit row's End is an em dash `—`, not empty.** §4.3 says "the last row
   (0 credit) has no end". It has a placeholder. Parsing `—` as a date must yield
   "no end", not a ParseError.
3. **`lateDueAt` must skip a 0-credit tier.** §4.3 says `lateDueAt` = End of the row
   immediately after the highest-credit row. In one real case that next row is the
   0-credit row, whose End is `—`. Semantically there is no late deadline there, so
   the rule needs "…and only if that row's credit is above 0".

Observed schedules across the 8 assessments — the shapes the parser must handle:

| Tiers | Count | `dueAt` | `lateDueAt` |
|---|---|---|---|
| `100` only | 1 | End of the 100 row | none |
| `100 → 0` | 1 | End of the 100 row | none (next tier is 0) |
| `100 → 80 → 50 → 0` | 3 | End of the 100 row | End of the 80 row |
| `100 → 96 → 50 → 0` | 3 | End of the 100 row | End of the 96 row |

Confirmed as specified: the date format `2026-08-27 12:40:01 (CDT)` matches §4.3's
regex; seconds really do carry `:01` on some starts; and the zone abbreviation flips
`CDT → CST` at `2026-12-09`, so §3.2's per-date offset lookup is required rather than
a fixed −05:00.

## A §3.1 problem: the row link is not always an assessment link

§3.1 says the PrairieLearn `sourceId` is the assessment id from
`/pl/course_instance/{ci}/assessment/{aid}`. The captured rows link to
**`/pl/course_instance/224254/assessment_instance/14550415/`** — an *assessment
instance* id, which exists only once the student has started the assessment.

So the link shape changes from `/assessment/{aid}` to `/assessment_instance/{iid}`
the first time a student opens something. Deriving `sourceId` from the href would
change the `memberKey` at that moment, which §3.1 requires to be stable: every
override on that item (hide, merge, split) would break and its `notified` record
would reset, re-firing notifications. **Needs a decision before the parser is
written** — see PROGRESS.md.

## Selectors worth using

Stable hooks exist and beat the colour classes:

- badge: `[data-testid="assessment-set-badge"]` (the class is `badge color-brown3` —
  `color-brown3` encodes colour, not meaning, exactly like Gradescope's
  `submissionStatus-*` modifiers in §4.2)
- score: `[data-testid="scorebar"]`, containing `.progress-bar` with a `width:N%`
  style and the same percentage as text
- title: the `<a>` in the second cell; `(NOT FOR CREDIT)` appears in the link text as
  §4.3 predicted, so `extra.forCredit` works off the title as specified
