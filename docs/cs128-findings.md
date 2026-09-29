# CS 128 lessons page — 2026-09-29

## Scope and page map

The signed-in CS 128 home page identifies a personalized Daily lesson and links to
Lessons, Machine Problems, Recitation, Even More Practice, Start Here, Syllabus,
Calendar, Directory, Profile and Resources. The user reports MPs and tests are already
tracked through PrairieLearn/PrairieTest; this integration covers the missing daily
lessons only.

The Lessons page at `https://cs128.org/lessons` is the schedule source. It groups dates
under week headings; each day card has a weekday, a month/day date, and one or more
`.lesson-item` links. Chrome verified the live page has 24 day cards and 28 lesson links; the fall 2026 capture contains the same 28 links. Some days have two
lessons, so treating each day card as one row loses lesson titles; the `itemRows` field
reads each nested lesson while taking its date from the parent card. Lessons are events,
not submitted work. No time is stated, so the runner's standard 23:59 fallback is marked
`timeAssumed`.

Other visible course pages include the Calendar and the informational pages listed
above. The Calendar includes course events beyond the lesson list, while the stated gap
is daily lesson tracking; the adapter therefore reads the dedicated Lessons page and
does not duplicate MPs/tests or ingest unrelated calendar events. An unauthenticated
request to `/lessons` redirects to `/auth`; the adapter depends on the student's existing
CS128 session and will use the normal site-source login detection on expiry.

Chrome's console already showed four repeated `TypeError: Cannot read properties of
undefined (reading 'isConnected')` errors from the site's `e.Calendar` script while the
Lessons page rendered. The live selector check still found all 24 day cards and 28 lessons;
this script error is separate from the adapter.

## Fixture

`fixtures/sites/cs128-fa26-lessons.html` is a 2026-09-29 signed-in capture. It was read
after scrubbing. The scrub report recorded two student-name replacements, one session-id
meta replacement and one CSRF-token meta replacement. No NetID was supplied. The session
and CSRF meta tags remain structurally intact with `SCRUBBED` values. The capture has 28
lesson links and no personal name or email remaining.

## Adapter and runtime note

The registry entry uses `#lessons .row.mb-3.rounded.border.lh-sm > .col-md-2` for day
cards, `.lesson-item` for nested lesson rows, `p.mb-2` for the date, `a` for the lesson
title and `a@href` for its link. The date text is read under `America/Chicago`. `itemRows`
was added in extension 1.4.0 and is restricted to row-relative title/date selectors.
