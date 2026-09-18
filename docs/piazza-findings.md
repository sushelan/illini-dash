# Piazza — what the live client actually does (2026-09-18)

Observed by Sushi in DevTools on a class page, before any fixture existed. Recorded here
so the source is written against evidence rather than the ten-year-old open-source client
it was first modelled on (parser house rule 9).

## Authentication: the session cookie, echoed as a header

- The API is `POST https://piazza.com/logic/api?method=<name>` with a JSON body, exactly as
  `hfaran/piazza-api` describes. Two methods were seen: `network.get_my_feed` (the class
  feed; body 108 bytes, presumably `{method, params: {nid, limit, offset}}`) and
  `content.get` (one post, on opening it).
- Every call carries a `csrf-token` header whose value **is the `session_id` cookie**
  (Sushi confirmed the first eight characters match). That cookie is `HttpOnly`, so
  `document.cookie` cannot see it — and neither can a `fetch` from the worker read it,
  although the browser attaches it. **So the source needs the `cookies` permission** (no
  install warning of its own) to read `session_id` for `https://piazza.com` and echo it,
  plus an optional host permission for `https://piazza.com/*` requested from the Settings
  switch, like Campuswire.
- The session lasts a month (`Max-Age=2592000`); a second cookie, `piazza_session`, is a
  signed JWT (ES384) whose payload is plain base64 JSON.

## Discovery: the class list is in the class page, not in the JWT

- The old client's `user.status` does **not** appear in today's traffic; what a class page
  calls is `network.get_users` and `network.get_online_users` (rosters), neither of which
  lists the student's classes.
- **What discovery actually reads is the class page.** `GET https://piazza.com/class/<nid>`
  (or `/class`) returns HTML whose only server-rendered data is
  `<script> const USER = {…};`, and `USER.networks[]` is one entry per enrolment, with the
  `id` (the `nid`), `course_number`, `my_name`, `term`, `term_key`, `status` and the rest.
  `parseClassPage` reads it by anchoring on `const USER =` and matching braces.
- The `piazza_session` JWT payload also carries `data.nids`, a `;`-separated list of
  `<network id>:<flag>` pairs, and an earlier draft of this document proposed reading it so
  discovery would cost no request. **That is not what was built, and it should not be**:
  the ids alone are not enough — the feed does not carry a class *name*, and §5.1 needs
  `course_number` to produce a course code — so the class page has to be fetched anyway,
  and once it is, a private cookie format is a second thing to be broken by a Piazza
  release for no gain. One GET a day, cached in the observer state, is the whole stage.
- The class id is the last path segment of the class URL (`/class/mswcsieiaip5ju`), per
  house rule 13 a per-account list → a source with a discovery stage, not an adapter.

## What was captured (the parser is written against these)

1. `fixtures/piazza/feed.json` — the `network.get_my_feed` **response** for one class
   (DevTools → the request → Response → copy), scrubbed with `npm run scrub -- <file>`
   (it holds classmates' names and posts).
2. `fixtures/piazza/post.json` — one `content.get` response (a full instructor note),
   scrubbed. **Captured 2026-09-18** (see the fixture README): the body is HTML in
   `result.history[0].content`, `instructor-note` in `tags` marks staff posts.
3. `fixtures/piazza/class-page.html` — `https://piazza.com/class/<nid>` via the options
   page's Fixture capture tool (it accepts any https URL), scrubbed; for the course name
   and any embedded config.
4. `fixtures/piazza/class-page-signed-out.html` — the same URL with no session, pasted from
   *view-source* (2026-09-18). It is what makes a **positive** signed-out marker possible;
   see below.

## What the term rule is, and why `status` is not it

The capture holds four enrolments: two Fall 2026, one Spring 2026 and one Spring 2025. The
**Spring 2026 class is still `status: "active"`** in September — Piazza does not close a
class when its term ends. So `active` in `PiazzaClass` means "in the term the clock says it
is", derived from `term_key` (falling back to the `term` text), and `status` is never read.
Fall is Aug–Dec, spring Jan–May, summer Jun–Jul (Sushi). A class whose term cannot be read
is kept and not polled, with the raw value in `extra.unparsedTerm`.

## What the two stages read, and the scorecard over the real feed

`content_snipet` is **the first 120 characters of the body and no more**, so the feed stage
sees a subject and one line. That is why there is a second stage: `content.get` returns the
whole post, `parsePostBody` reads `result.history[0]` (newest version first), and
`background.ts` fetches a body for every new note — at most four in flight, at most 25 per
class per sync, each failure isolated to its own post, which falls back to its snippet and
says so in the log.

**The feed alone yields exactly one deadline over the 25 real notes; the first post body
read in full yields a second, and it is the one a student actually needs.** The scorecard
is therefore two numbers, not one: 1 from 25 snippets, and 1 more from the single
`content.get` response captured so far (`post-running.json`, note 28 — HW1, due
`2026-09-20T23:59:00-05:00`, clock stated). That is the whole case for the body stage
stated as a measurement: the deadline the feed cannot see is worth as much as everything
the feed can. Both halves are asserted note by note in `tests/piazza-real.test.ts` rather
than in aggregate:

| note | subject | reading |
| --- | --- | --- |
| 42 | *Reminder: Register Your MP Group by EOD Today 8/31!* | due `2026-08-31T23:59:00-05:00`, `timeAssumed`, confidence 0.65, span `EOD Today`, subject `MP Group` — **one suggestion**, though the snippet restates it |
| 28, body | *HW1 (All students) Released … (Running Post)* | due `2026-09-20T23:59:00-05:00`, **not** `timeAssumed`, confidence 0.95, span `9/20 (Sun) 11:59 pm`, subject `HW1` — one suggestion, and an auto-move when a Gradescope HW1 says another day. Its *snippet* reads `trigger-and-date-words-unmatched`, below |

The other 24 read nothing, and the file records *which* nothing each of them is
(`describeEmpty`): 14 have no date words at all, 4 say a date with no trigger, 4 say a
trigger with no date, and **two — notes 68 and 28 — say both without joining them**
("Group/VM mapping (updated 9/9)", "[Last Updated Sep 13.]"), which is the reason that
distinction exists.

Two corrections to what this document said before, both load-bearing:

1. It said the grammar "finds **zero** deadlines" and inferred that *the value of the
   snippet stage is unproven on real data*. The zero was real; the inference was wrong, and
   so was the reason given for one half of it. Note 42's *"Register … by EOD Today 8/31"* is
   the hardest deadline on the page — miss it and you get no VM — and it was declined
   because `announce.ts`'s trigger table was written from the Campuswire capture, where
   every deadline is a submission. "`<verb phrase>` … by `<date>`" is now a trigger for
   `register`, `sign up` and `respond` as well as the submission verbs, and **there is
   still no bare "by `<date>`" arm**: "slides by Prof. X", "posted by", "written by" are
   attributions, and each is pinned as producing nothing (`tests/announce.test.ts`).
2. The other half stands and is worth restating: the long "Running Post" notes keep their
   dates far past character 120, and **no grammar can reach them from the feed response**.
   That is `content.get`'s job, not the grammar's.

`timeAssumed` stays **true** for "EOD": "end of day" has been this grammar's own 23:59
since `fixtures/announcements/eod-friday.txt`, and the abbreviation follows the same
convention rather than introducing a second one. It keeps the reading below
`AUTO_MOVE_CONFIDENCE`, so it is offered and never applied silently.

### Amendment (2026-09-18): a weekday in brackets between the date and the clock

The Running Post writes its deadline as **"HW1 is due 9/20 (Sun) 11:59 pm US Central
Time"**, and `announce.ts` read it as *9/20 at an assumed 23:59*. `PROSE_SEP` — the
separator between a calendar date and its time — accepts whitespace, commas, "at", "@",
"from" and so on, and stops dead at the "(" of "(Sun)", so the stated clock was dropped
and §4.5's invented 23:59 took its place.

The two instants are **equal**, which is exactly what makes it a defect rather than a
visible bug: `timeAssumed: true` says "this extension chose this hour", §5.3 ranks an
assumed instant below a stated one, and `AUTO_MOVE_CONFIDENCE` sees 0.85 where the post
earns 0.95. A real Canvas date would have outranked an instructor sentence saying the same
thing (worker rule 3).

`CAL_MONTH` and `CAL_NUM` now take an optional bracketed weekday between the date and the
time part, captured as `weekdayAfter` — a regex cannot carry two groups of one name — and
it feeds §3.2's year cross-check exactly as the `Fri 10/3` prefix spelling does: "(Sun)"
confirms 9/20/2026, and a contradicting "10/3 (Fri)" is refused as a 0.55 `other` with the
same reason the prefix produces. Both halves are pinned in `tests/piazza-real.test.ts`; the
whole 1,742-test suite was green before and after, so no existing reading changed.

### Amendment (2026-09-18): the reader version, and posts read at their snippets

Sushi's first live sync marked all 29 notes read with the **snippet** reader: `seenPosts`
holds a key per post and `lastNr` holds the top of each class's feed, and neither says
*how much of the post was read*. The body stage would therefore never have fetched one of
them, and the HW1 deadline above would never have arrived.

So `PIAZZA_READER_VERSION` (2 — whole bodies; 1 — `content_snipet`) is stored beside the
posts it read, absent meaning 1. When the stored version is older, `planPiazza` says so,
drops every `sinceNr`, and carries `rereadAll`; the worker then, once and inside the write
that carries what it read, drops every `seenPosts` key starting `piazza:` (and no other —
the map is shared with Campuswire and the paste box), resets `lastNr`, logs
`reader upgraded 1 → 2: re-reading N posts in full`, and stamps the new version. The stamp
is never written before the fetch succeeds, so a crash mid-way re-runs the upgrade rather
than skipping it, and `MAX_BODIES_PER_SYNC` still bounds it: a 106-post class re-reads 25
bodies a sync until it catches up.

### Amendment (2026-09-18): which feed field says a post was edited

The "Running Post" is edited weekly — that is what "Running" means — and `seenPosts` is
keyed by the post and remembers nothing about which *version* was read, so a corrected
deadline in an edit was something this source structurally could not see.

The feed already carries the answer, so the check costs no request. It is **not**
`modified` (nor its epoch twin `m`): those move on any activity, including a classmate's
follow-up, and 28's `modified` is `2026-09-17T03:20:42Z` when its body was last written on
the 13th. It is the entry's own `log[]`, whose last entry with `n` of `update` (or
`create`, for a post never edited) is the edit itself. The evidence is exact and the two
captures agree to the second:

| post | last `create`/`update` in the feed's `log[]` | `history[0].created` in the `content.get` |
| --- | --- | --- |
| nr 28 (`post-running.json`) | `2026-09-13T22:22:48Z` | `2026-09-13T22:22:48Z` |
| nr 179 (`post.json`) | `2026-09-18T03:12:18Z` | `2026-09-18T03:12:18Z` |

A seen post whose edit instant is later than its seen-at instant is fetched and ingested
again (`editedSinceSeen`, `postsToSend`'s `seenPosts` option, `ingestPost`'s `reread`);
everything else below `sinceNr` stays skipped, so this is not a re-read of the feed every
half hour. `i_answer_update` is a TA editing an *answer* and **contains** the word
`update`, so the match is on exact values (house rule 6) and the capture cannot show the
difference — `tests/piazza.test.ts` appends such an entry deliberately.

One consequence, recorded rather than fixed: a suggestion the student **dismissed** is
simply removed from the list, and nothing remembers the dismissal, so an edit to the post
that stated it will offer it again. An *accepted* one does not come back — the row it
became is already due then, and `suggest.ts` now says so instead of re-offering it.

The wiring of each stage is pinned by a deliberately edited copy of its own capture
(house rule 10) — a feed entry whose snippet states a deadline, and a `content.get` body
with a deadline sentence appended past character 400 — so "the pipeline is dead" and "the
posts say nothing" cannot be confused.

## The feed's shapes, as captured

- A healthy response carries **`"error": null` at the top level**. `if ("error" in json)`
  would therefore fail every successful sync; only a non-empty `error` string is an error.
- `result.feed[]` present but empty is a legitimately empty class and returns `[]`. A
  missing `result`, or a missing `feed`, is a `ParseError`.
- `nr` is the identity (`piazza:<nid>:<nr>`), `id` is the `cid` that `content.get` takes,
  and `log[0].t` is a real instant with a zone — never invented here, so no
  `timeAssumed` is involved at this stage.
- Subjects and snippets are HTML-entity encoded (`&#34;`, `&amp;`, `&nbsp;`) because they
  arrive as JSON rather than through a DOM. They are decoded before the text reaches the
  grammar, since a suggestion quotes its span back at the student.

## The signed-out page, and the positive marker it made possible

1. **A signed-out class page is captured** (`fixtures/piazza/class-page-signed-out.html`,
   2026-09-18), and the negative marker it was standing in for is gone. Piazza answers
   `/class/<nid>` for a signed-out student with its **marketing splash** — 200, the
   unchanged URL, an ordinary title, no redirect, and no `const USER =` — which is house
   rule 11's case exactly.

   `classifyClassPage` now answers three ways, and the third is the one that had no name:

   - `const USER =` present → **signed in**, whatever else is on the page.
   - Absent, and the splash's own `<form id="login-form" action="https://piazza.com/class">`
     present → **signed out**, so the row says "Sign in needed" and offers the button.
   - Neither → **the page changed**, reported as an error rather than as a sign-in. Until
     this build, "no `const USER`" alone meant `needs_login`, which is right for a sign-out
     and wrong the day Piazza renames the object: the row would ask a signed-in student to
     sign in and the list would freeze at whatever it last held, silently.

   The form was chosen over `body.qa_homepage_container` because a class attribute is a
   list that can acquire neighbours and can be reused by any page borrowing the homepage
   shell, while a form posting credentials to `/class` *is* the sign-in prompt — and both
   halves of its match (the id and the literal `action`) are required, because "a form
   somewhere on the page" is the loose marker house rule 12 warns about. House rule 12's
   other half is covered by a deliberately adversarial page in `tests/piazza.test.ts`: the
   real signed-in capture, with a class renamed *Log Interpretation*, a `/login` link and a
   hidden login form appended, which must still read as signed in.
2. **`fixtures/piazza/post.json` is captured and read** (2026-09-18): one `content.get`
   response, a five-version instructor note whose body is HTML in
   `result.history[0].content`. `postBodyRequest` builds the request and `parsePostBody`
   reads the response; the seam that used to throw is gone. The one thing still unobserved
   is what `content.get` answers for an **expired** session — `classifyPiazzaResponse` is
   written for a 401/403 or an `error` string and handles a 200 with neither as a parse
   failure of that one post, which costs a snippet rather than the run.

## The fixture's scrub was broken, and is repaired

The first scrub replaced the empty string, so every `subject` and `content_snipet` in
`feed.json` came back with `STAFF-36` inserted **between every character** — 5033 copies —
while the real text (including a named guest lecturer) survived intact underneath. A
fixture in that state is worse than no fixture: every assertion about what the grammar
reads would have been made against text no parser will ever see. It is repaired in place
(the marker removed, the one personal name replaced with `STAFF-9`), and the one-off scrub
script that produced it is not in the repo, so nothing regenerates it.

Never paste cookie or token **values** into chat or files; the header/cookie equality was
established by comparing eight characters.
