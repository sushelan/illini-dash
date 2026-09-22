# smartPhysics `/Course/Calendar` — findings, 2026-09-21

Capture: `fixtures/smartphysics/calendar.html`, enrolment 151698 (scrubbed to `100001`,
matching `home.html`/`course.html`), fetched 2026-09-21 through the fixture capture tool.
No scrub warnings on the final version — see the scrubber amendment in the same day's
PROGRESS entry for what changed to get there.

## Why this page exists to be parsed at all

Sushi: *"smartphysics calendar also needs to be parsed."* The question worth answering
first is whether it needs a **parser** or a **skip** — a page that duplicates `/Course`'s
29 rows exactly would cost a second per-student fetch for nothing. It does not duplicate
them: see below.

## What is established

**The 29 dated events are the same 29 assignments `course.html` already reports**,
matched by `unitItemID`. `course.html`'s `/Course/ViewItem?unitItemID=381995&…` and the
calendar's `event-UnitItemID` span inside the `id='event-9/2/2025'` block agree on all 29,
with none extra on either side. So this is not a sixth source of deadlines; it is a
second view of the same 29.

**It exposes a real two-tier credit schedule that `/Course` collapses to one line.**
`course.html` prints `Due: Aug. 25, 2025 at 8:00 AM ... for 100% credit` and a scorebar —
one instant, one number, no window. The calendar's own event block for the same
assignment (`unitItemID=381995`, "Homework", Harmonic Waves) carries two dated,
`event-DeadlineID`-bearing sub-blocks:

```
<div id='deadline-0'>
  <span class='event-StartDate'>8/26/2025 1:00:00 PM</span>
  <span class='event-DueDate'>9/2/2025 8:00:00 AM</span>
  <span class='event-DeadlineID'>388707</span>
  <span class='event-CorrectionFactor'>100</span>
</div>
<div id='deadline-1'>
  <span class='event-StartDate'>9/2/2025 8:00:00 AM</span>
  <span class='event-DueDate'>9/9/2025 8:00:00 AM</span>
  <span class='event-DeadlineID'>393070</span>
  <span class='event-CorrectionFactor'>100</span>
</div>
```

and, on assignments that have a reduced-credit window (13 of the 29 in this capture),
a third block at `CorrectionFactor 80` a week after the second. This is §4.3's
PrairieLearn shape exactly: a schedule of `(credit, start, end)` tiers, and the highest
tier's End is the due date the student actually needs, the way `deadlinesFromSchedule`
already reads PrairieLearn's popover.

## The trap — read before writing a selector

**Every one of the 29 dated events also carries a second, un-id'd deadline block that is
identical across the entire page:**

```
<div class='deadline-0'>
  <span class='event-StartDate'>9/14/2026 8:00:00 AM</span>
  <span class='event-DueDate'>9/21/2026 8:00:00 AM</span>
  <input type='hidden' class='feedback' value='9/21/2026 10:00:00 AM' />
  <span class='event-DeadlineID'>0</span>
  <span class='event-CorrectionFactor'>100</span>
</div>
```

The date is `9/21/2026` — this capture's own `CurrentDay` hidden input, byte for byte.
Checked across all 29 dated events: this block is the *same* `StartDate`/`DueDate` pair on
every one of them, regardless of what the assignment is or when it is really due. It is
the calendar widget's own "today" marker, written into every event's markup so the client
script can highlight the current day's cell — not a deadline record, and its
`event-DeadlineID` is always the literal string `0`, never a real id.

A parser that read a `deadline-N` block by its `class` rather than its `id` would find
this one first (`class='deadline-0'` matches `.deadline-0` the same way `id='deadline-0'`
would match `#deadline-0` were anyone tempted to write it that way) and report **every
assignment on the page as due today, silently, on every single sync** — the exact failure
CLAUDE.md calls worse than reporting nothing. The rule this earns: **read `deadline-N` by
its `id` attribute only, and treat a `class='deadline-N'` sibling as decoration, never as
data.**

## What is not established, and is blocking a parser

This capture is a stale, inactive enrolment — `course.html`'s own `<title>` says
"Physics 214 Fall 2025," and every real (`id`-attributed) `deadline-N` date in it falls in
2025. Two questions only a *currently active* course's calendar can answer, and both
matter enough not to guess (house rule 9, and the silently-wrong-deadline rule):

1. **Does the highest-credit tier's `DueDate` match what `course.html`'s "Due:" line
   states for the same item?** This capture cannot check — `course.html` here already
   agrees with `id='deadline-0'`'s window (Aug 25 dueAt lines up with deadline-0's window
   in the earlier, non-tiered assignments), but an active course with an *open* tier is
   the case that actually matters for `dueAt`/`lateDueAt`, and nothing here is open.
2. **Is the fake `class='deadline-0'` "today" block a fixed feature of this view, or
   something specific to a completed, read-only course?** If an active course omits it,
   or spells it differently, the `id`-vs-`class` rule above still holds but the detection
   logic guarding against it can be simpler than defending against a case that turns out
   not to occur.

Both close with one more capture: `/Course/Calendar?enrollmentID=…` for whichever
PHYS 211–214 course is active this term, if any — home.html's Active tab says which.
