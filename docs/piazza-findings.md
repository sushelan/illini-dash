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

**The scorecard above measures what the grammar reads, not what a student is offered.**
Note 42's deadline is 31 August and the capture is from 18 September, so an install
reading this feed today is offered *nothing at all* — `ingestPost` records "had already
passed when this post was read" and stops there (G1, below). `tests/piazza.test.ts` reads
the feed at 2026-08-31T11:00 for that reason, and note 28's body test already reads at the
14th. Neither number in the scorecard changes; the row count a student sees does.

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

### Amendment (2026-09-18, evening): the fetch plan after the trace

A seven-segment trace of the live path found nine defects in this stage. None of them is a
parsing mistake — every one is about *what a run may settle and what it may claim* — so
they are recorded here beside the stage they change.

**Discovery no longer wedges on a stored class id.** The class page was always fetched as
`/class/<the first stored class's nid>`, and that class is the one most likely to have
gone away: the list keeps inactive and archived enrolments (the capture's own Spring 2025
entry) and Piazza's `networks` order is not "active first". A 404 for it ended the run and
armed §6's ladder, a 403 ended it as "Sign in needed", neither branch clears `classes`, and
the next refresh derived the same dead URL — for ever, with no user-reachable recovery.
`classPageAttempts` now returns `[<stored nid>, undefined]` and `readClassList` falls back
to `${PIAZZA_ORIGIN}/class`, which answers for any signed-in student, logging both
branches. A sign-out is not retried: the bare URL would answer it the same way.

**A 403 on one class is that class's failure, not the session's.** Piazza answers 403 for a
class you have been removed from or that has been archived, and `classifyPiazzaResponse`
cannot tell that from an expired session (house rule 8 says the status decides whether this
is a login problem; it does not say 403 means only one thing). Raised for the whole run, it
threw away every healthy class's new notes before the body stage and put "Sign in needed" —
with a button that fixes nothing — on a source whose other three classes had just answered
200. `feedSignedOut` now decides: it is the session only when **every** polled class says
so. The class page's own sign-out still ends the run, because that one really is the
session, and the same rule is applied to the body pool.

**A body that could not be fetched no longer settles the post.** `bodyBatch` exists so that
"advancing either mark past a post whose body was never fetched would leave it read at its
120-character snippet for good" — and the worker threw that guarantee away the moment a
fetch *failed* rather than being deferred: `lastNr` was written in the feed pool, before any
`content.get` was sent, and the snippet was ingested, so `seenPosts` marked the post read
too. One transient 502 on a note whose deadline sentence is at character 400 cost that
deadline for the term. Now `bodyFailureKind` splits the failure: a timeout, a network
error, a 429 or a 5xx is **transient** — the post is not ingested and `cappedLastNr` holds
that class below it, so the feed offers it again next sync — and a 404, a 403 or a body
that is not this endpoint's JSON is **refused**, which is given up on at the snippet with
the reason logged. The retry is bounded without any per-post memory (there is no store
field for one), and the cost of holding the mark back is bounded too: `postsNeedingBody`
drops posts this store has already ingested, so a stuck class re-asks for the stuck post
only, not for everything above it.

**What the row may claim.** `PiazzaResult` now carries `requests`, `classesPolled`,
`classFailures`, `bodiesRead` and `bodiesFailed`, and `applyPiazzaResult` is the one
function that turns them into stored facts — assigned by the worker, never spread over the
old ones (a spread cannot delete a key, which is how every recovery used to put a
four-hour `nextAttemptAt` straight back). Four claims changed:

- A run that made **no request** records `pending`, not `ok` (worker rule 2). It happens
  whenever no stored class is in this term, which is every term boundary, and the row said
  "last read Dec 12 · 312 posts, 4 deadlines found" through all of it. `describePiazza`
  says why from the class list — "On · no class in this term", or "On · no Piazza classes
  found" for an empty one.
- A run where some classes failed keeps the caveat: "1 of 4 classes couldn't be read", in
  `lastError`, which the row prints beside the counts. The `ok` branch used to delete it.
- A run whose bodies were refused says "25 posts couldn't be opened" rather than reporting
  deadline counts for posts it never received.
- A successful run that found no new notes says "On · checked 10:32, nothing new" instead
  of the words a switch that has never fetched gets. That is the steady state of a working
  class for most of the term.

**Two things that fetched more often than §6 allows.** The popup's 5-minute debounce
stopped at the loop, so five popup opens in ten minutes were 20 `network.get_my_feed` POSTs
where the loop made none; `planPiazza` now holds the same debounce, keyed on
`lastAttemptAt`. And a navigation on *another* source's site reached `runPiazza` as a
manual trigger, which overrides the ladder — so a resting Piazza was refetched on every
Gradescope page view. That path now uses a `recheck` trigger, which the loop treats as the
student asking (it is evidence about the source whose page loaded) and Piazza treats as
scheduled. A page load on piazza.com still asks for a manual run by name.

**`needs_login` has a ceiling.** It deliberately sets `failures = 0` and no
`nextAttemptAt`, so that signing in is noticed at once. That is right for an expiry and
wrong for the other thing a 401/403 means: a server refusing this client was retried on
every alarm, every popup open and every page load with no ladder — the pattern most likely
to harden the refusal. After `PIAZZA_LOGIN_GRACE` consecutive refusals the ladder applies;
the row still says "Sign in needed", and a piazza.com page load still overrides it, so a
student who does sign in never waits.

**One run at a time.** `runPiazza` has its own in-flight promise. `sync()`'s `running`
guard did not cover the two paths that call it directly — the piazza.com re-check and
`set-observer-enabled` — so two runs could put eight requests in flight at a host whose
pool is four (worker rule 9) and race each other's `seenPosts`. `lastAttemptAt` is now
stamped when a run **starts**, which is what `piazzaNeedsRecheck` compares against: stamped
at the end, every page load during a 30-second run started another whole run.

### Amendment (2026-09-18): the anchor is the version that was read

A split finding from the seven-segment trace, decided on the captures. `parsePostBody`
deliberately reads `history[0]`, the **newest** version, while `withPostBody` kept the
feed's `log[0].t` — the *create* event — as `postedAt`, which `announce.ts` calls "the
anchor for every relative phrase and for §3.2's year inference". So version N was parsed
against version 0's clock. The Running Post is the case: created `2026-08-28T01:32:51Z`,
last written `2026-09-13T22:22:48Z`, and a sentence reading "due this Friday at 11:59pm"
in its current body resolved to **28 August** instead of 18 September — three weeks in the
past, on a post the student is reading today.

The snippet is the *same* edited text (nr 28's `content_snipet` opens "[Last Updated Sep
13.]"), so the snippet-only reading was wrong for the same reason. `postAnchor` therefore
answers, in order: `history[0].created` when the body stage read the post, the feed's last
`create`/`update` (the field the amendment above established) when only the snippet was
read, and `log[0].t` when neither is readable. A post that has never been edited has all
three equal, which is why no capture could show the difference and why
`tests/piazza-real.test.ts` measures it with a sentence the post does not contain.

### Amendment (2026-09-18): `type: "note"` is not "staff wrote it"

`parsePostBody` derived `instructorNote` from two exact markers and **nothing read it**:
`withPostBody` copied three fields and dropped it, and `postsToSend` filtered on
`kind !== "note"`. The capture makes the gap concrete — five of its 31 entries are
`type: "note"` posts a *classmate* wrote (nr 1, 5, 9, 19, 147: "Search for Teammates!",
"Looking for an MP partner", "Dropping from 4cr to 3cr"), tagged `student` and not
`instructor-note`. They were ingested exactly like an instructor's announcement, so
"I think MP2 is due 10/3" from a classmate could move a real assignment.

The marker is now read at both stages. The feed entry's own `tags[]` carries
`instructor-note`, so a post whose body this sync never fetches is still judged by it;
the body's two markers (`instructor-note` in `result.tags`, or `config.is_announcement`)
overrule it when the body has been read, and `background.ts` re-runs `postsToSend` over
the merged post, which is where that second answer lands. A classmate's note is refused
with its reason — "a note a classmate wrote, not staff" — exactly as a question is, and
`includeStudentNotes` is the opt-in switch beside `includeQuestions`. `tags` is a **hook**
(house rule 1): a feed entry without it throws, because defaulting it would hold every
announcement back silently.

The corpus in `tests/piazza-real.test.ts` is therefore **20 staff notes, not 25**, and the
five are asserted as held rather than dropped from the table.

### Amendment (2026-09-18): three ways one field cost a whole class

Three more from the same trace, all house rule 1 at different scales:

- **An out-of-range numeric entity.** `decodeEntities` called `String.fromCodePoint`
  with no range check, and that **throws** above `0x10FFFF`. A `RangeError` is not a
  `ParseError`, so one `&#9999999;` in one subject escaped `parseFeed` and cost the class
  its entire feed — on every sync, for ever, because the text is a stable property of the
  page. An entity that names no scalar (out of range, or a lone surrogate) is now left
  verbatim: a bad value costs its own character.
- **HTML comments.** `ANY_TAG` cannot match `<!--`, so a commented-out line reached the
  grammar as prose. An instructor editing the weekly post leaves the old deadline inside a
  comment, and a Word or Google Docs paste emits `<!--[if !supportLists]-->` — the first
  becomes a deadline the post does not state, the second becomes literal markup inside the
  evidence span quoted back at the student. Comments are dropped with their contents, like
  `<script>`, including an unterminated one.
- **A `>` inside an attribute value.** Both tag regexes scanned to the first `>`, which is
  not where a tag ends when `title="MP1 -> MP2"` is in it: the words before the tag
  vanished and `MP2">` became prose. The tag tail now skips quoted values whole.

### Amendment (2026-09-18): `lastNr` may not run past a post nobody read

`bodyBatch` caps `lastNr` at the batch when bodies were deferred, and that was the only
cap. `postsToSend` also refuses a note whose posted date is unreadable — the anchor is not
optional — and when nothing was deferred the mark went to the top of the feed **over that
note's head**, so it read `already read (<= 184)` on every later sync even after Piazza's
log became readable again. The refusal is now recorded (`SendPlan.held`, which holds only
this recoverable refusal — never a question or a classmate's note, since freezing the mark
under one of those would re-fetch the same bodies for ever) and `bodyBatch` caps `lastNr`
one below the lowest held post.

### Amendment (2026-09-18): a cross-listed class keeps both codes all the way down

`parseClassPage` runs §5.1 over `course_number` and keeps every code — the captured class
yields `["CS425","ECE428"]` — and the poll then carried only `courseHint`, the raw name,
from which the ingest side derives one code ("CS425"). A student whose Gradescope items
are filed under `ECE428` matched nothing, so every announcement about them raised a
*second* row instead of correcting the one they had. `ObservedPost` and `PostPayload` now
carry `courseCodes` (primary first, the one `courseHint` already yields), fed from
`FeedContext.courseCodes`. The matching side belongs to `announce.ts`/`suggest.ts`, which
must match an item on **any** of them, as `core/dedupe.ts` already does with
`extra.altCodes`.

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

### Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all

`eod` was spelled inside `CAL_REL`, the relative-day pattern, so it could only ever be
followed by a weekday word. **"Please submit HW2 by EOD 9/25." returned `[]`** — not a
deadline, not even the 0.55 `other` that parser rule 1 exists for — because `CAL_MONTH`,
`CAL_NUM` and `DATE_LIKE` are all anchored with `^` and the leading "EOD " blocked every
one of them. The same sentence written "by EOD Friday" read perfectly, which is what made
it look like a data difference rather than a grammar gap. House rule 2 at the mention
level: the post states a hard deadline and the grammar goes silent.

The lead-in is now stripped in one place (`EOD_LEAD`) ahead of all four patterns and ahead
of `DATE_LIKE`, with its length added back so the span still quotes the instructor's own
"EOD 9/25". `CAL_REL`'s own `eod` arm is **deleted** rather than kept beside it (mutation
house rule 2, the redundant case): two copies of one decision is what lets loosening
either go unnoticed.

Separately, `describeEmpty` — written in wave 4 precisely to tell "this post states no
deadline" from "this grammar failed on one it states" — had **no caller in `src/`** at
all. `ingestPost` now records it in `result.skipped` whenever a post yields no mention,
which is the console line the next gap of this kind will be found by (worker rule 5).

### Amendment (2026-09-18): a cross-listed class matched none of the student's rows

This class is named **"CS 425 / ECE 428: Distributed Systems"**, and `resolveMentions`
reduced that hint with `extractCourseCode` — the **first** code — and demanded
`item.courseCode === code`. A student registered under ECE 428 has Gradescope and Canvas
rows filed as `ECE428`, so the candidate pool was empty for every mention in every post:
**no announcement could ever move a deadline**, and every one arrived as a new suggestion
beside the identical row it should have corrected, labelled with a course the student is
not in. Cross-listed CS/ECE numbering is the norm at UIUC, and this is Sushi's own class.

The rule is now `dedupe.ts`'s `sameCourse`: **any code in common**, between every code the
post's class carries and every code the item carries (its own, its members', and each
member's `extra.altCodes`). `ObservedPost.courseCodes` is additive and primary-first, so
Piazza's stored `PiazzaClass.courseCodes` is used when the observer supplies it and both
codes are read out of the hint when it does not.

### Amendment (2026-09-18): what the first seven live suggestions said

The first real sync on Sushi's install showed **"Found in a post (7)"**, and four of the
seven were wrong in ways a student notices first. Read as evidence (worker rule 7):

- **Three had already passed when they were found** (11, 13 and 14 September, read on the
  18th). A fresh install's first sync reads a month of history. `ingestPost` now records
  such a mention and offers nothing — for moves as well as for new rows, because an old
  post dragging a live row backwards is the branch with no click in it.
- **One title was a whole sentence with its Markdown intact**: *"Note that the \*\*demo
  slot (signup) is due by this Friday at 11:59 pm."* Two defects in one row — a title must
  never carry the markers, and a sentence-length title means the subject rule found
  nothing and the fall-back to the post's subject never fired. Both are fixed;
  `fixtures/announcements/demo-signup-live.txt` is that post, transcribed.
- **Two titles were generic phrase subjects** — "See Demo", "Google Form" (from "fill out
  the Google Form by 9/20"). They are the object of the verb, not the assignment. A bare
  vehicle noun, or one behind nothing but its platform, now loses to the post's subject;
  "MP2", "MP1 Report (4cr only, EXCEPT Coursera)" and "CNN Project Milestone 3" are kept.
- **Every row said "from a Piazza post"**, which is true of all seven and therefore useless
  for telling them apart. `Suggestion.postSubject` is additive — older suggestions keep the
  old wording — and the popup draws "from the Piazza post “MP1 Demo Sign-up Sheet”",
  clipped to one line so a long subject cannot grow the row (UI rule 8).

And one more, found by the trace rather than by the sync: **`alreadySuggested` ignored the
course**, so two classes announcing "HW2 is due Friday" in one sync collided —
`background.ts` ingests every class's payloads through one `mutate` and feeds the growing
list back in, so the second class's deadline was dropped as a duplicate and, its post
stamped read on the same pass, never offered again. The comparison is now keyed on the
course as well, and the skipped reason names it.
