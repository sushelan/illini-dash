# CS 128 daily lessons — 2026-09-29

## Scope and source choice

CS 128's signed-in home page links to lessons, machine problems, recitation, practice,
syllabus, calendar, directory, profile and resources. The user reports MPs and tests are
already tracked through PrairieLearn/PrairieTest, so this adapter covers only daily
lessons.

`/my/gradebook` is the useful lesson source. Its lesson table is filled in by JavaScript,
which calls `GET /api/category_gradebook?category_id=80`. A same-origin request in the
signed-in Chrome session returned HTTP 200 with a 95,278-byte HTML fragment, no redirect,
and the `Assignment`, `Score`, `Percent`, and `Actions` headers. The response contained
54 table rows including detail rows; the 28 lesson rows each have a `/2026c/` lesson link.
The adapter therefore reads the API fragment directly rather than scraping the rendered
page or the JavaScript-empty `/lessons` response.

The gradebook describes its scores as a reference snapshot and says official grades and
course drops are managed elsewhere. For this deadline tracker, the user authorized using
the lesson percentage as a completion signal: 100% means done, any lower percentage means
submitted but incomplete, and `Ungraded` means no submission is required. The score
fraction itself is not used. Ungraded lessons retain their deadline as events, so they do
not appear as unfinished work. MPs and tests remain with PrairieLearn/PrairieTest.

The live page also showed Attendance and Other Resources sections. Those are outside the
lesson table and are not selected. `/lessons` was an earlier candidate, but the gradebook
is the better source because it carries each lesson's due date and automatic completion
state in the same response.

## Fixture and parser

`fixtures/sites/cs128-fa26-gradebook.html` is the signed-in API fragment with 28 lesson
rows. Row details and per-student gradebook identifiers were removed, and every score and
percentage cell was replaced with a placeholder. The tests inject invented full, partial,
zero and ungraded percentages that do not reproduce the account's completion pattern. The
parser anchors on table headers and lesson links, reads `Due <month> <day>, <year>` in
`America/Chicago`, and marks the fallback time as assumed (23:59). An unreadable
percentage leaves that row present with unknown status and an `unparsedStatus` value. A
missing Percent header or disappearance of lesson rows is a parse error.

The registry's `gradebook` field reads the Percent column by its header, never by cell
position. 100 or more is `graded`; a positive value below 100 remains incomplete and is
shown as “N% so far”; zero is incomplete without a progress label. The exact declared
`Ungraded` text becomes an event. `duePrefix` strips only the declared `Due`
prefix. The signed-out API request redirects to `/auth`, whose page title is only
`cs128@illinois`; `/auth` is therefore an explicit positive login path for this adapter.
These readers require extension 1.5.0. The user-visible completion behavior is
fixture-tested against all 28 rows.

## Live verification

The signed-in Chrome page showed the 28 lesson entries, dates, percentages, and two
Ungraded rows as expected. The gradebook API request returned 200 with no redirect. The
earlier `/lessons` page emitted repeated `e.Calendar` script errors, which do not affect
this API-based adapter.
