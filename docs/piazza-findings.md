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

## What the term rule is, and why `status` is not it

The capture holds four enrolments: two Fall 2026, one Spring 2026 and one Spring 2025. The
**Spring 2026 class is still `status: "active"`** in September — Piazza does not close a
class when its term ends. So `active` in `PiazzaClass` means "in the term the clock says it
is", derived from `term_key` (falling back to the `term` text), and `status` is never read.
Fall is Aug–Dec, spring Jan–May, summer Jun–Jul (Sushi). A class whose term cannot be read
is kept and not polled, with the raw value in `extra.unparsedTerm`.

## What the snippet stage actually reads — and what it does not

`content_snipet` is **the first 120 characters of the body and no more**, so this build
sees a subject and one line. Run over the whole captured feed (25 notes), the existing
grammar in `announce.ts` finds **zero deadlines**, and `tests/piazza.test.ts` asserts that
number rather than loosening the assertion. Two reasons, both worth knowing before this is
called a feature:

1. The notes that carry real dates are the long "Running Post" ones, and every date in them
   is far past character 120.
2. The two subjects that do carry a date say *"Register Your MP Group by EOD Today 8/31"*.
   `announce.ts` requires a due-word — "due", "deadline", "extended to" — and "by EOD" is
   not one of them. This is a grammar question, not a Piazza one; widening it would affect
   every source, so it is recorded here rather than done here.

So **the value of the snippet stage is unproven on real data**, and `content.get` is what
would change that. The wiring is pinned separately by a deliberately edited feed entry
whose snippet states a deadline (house rule 10), so "the pipeline is dead" and "the posts
say nothing" cannot be confused.

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

## VERIFY — the two captures this is still missing

1. **A signed-out class page.** Until one exists, "no `const USER =` on the page" is treated
   as `needs_login` rather than `parse_error`: signing in is the fix in the case that
   matters, and a wrong "sign in" costs a click while a wrong "the page changed" costs the
   deadlines. That is a *negative* marker, which house rule 11 says is the weak form — a
   positive one (a login form's own hook, or a `/login` landing) needs the capture. Logging
   out also rotates the session cookie, which is worth doing anyway.
2. ~~`fixtures/piazza/post.json`~~ — **captured** (2026-09-18, the same evening this was
   written, on a branch the feed build could not see): one `content.get` response, a
   five-version instructor note whose body is HTML in `result.history[0].content`. The
   request shape is in `postBodyRequest`, and `fetchPostBody` throws rather than returning
   an empty answer until the parser for it exists — which is the next build, not a VERIFY.

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
