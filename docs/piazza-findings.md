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

## Discovery: the client list is in the JWT, not in a method

- The old client's `user.status` does **not** appear in today's traffic; what a class page
  calls is `network.get_users` and `network.get_online_users` (rosters), neither of which
  lists the student's classes.
- The `piazza_session` payload carries `data.nids`, a `;`-separated list of
  `<network id>:<flag>` pairs — one per enrolled class — and `data.user`. Reading our own
  cookie's payload (no signature check; we are not trusting it for security, only for the
  list of classes to ask about) gives the discovery stage without a request. It is a
  private format and may change; the source must treat a payload it cannot read as
  "needs a class captured", not as an empty enrolment (rule 2), and the class page
  `https://piazza.com/class/<nid>` (a normal GET with cookies) is the fallback for the
  class **name**, which the feed does not carry.
- The class id is the last path segment of the class URL (`/class/mswcsieiaip5ju`), per
  house rule 13 a per-account list → a source with a discovery stage, not an adapter.

## What is still to capture, before any parser is written

1. `fixtures/piazza/feed.json` — the `network.get_my_feed` **response** for one class
   (DevTools → the request → Response → copy), scrubbed with `npm run scrub -- <file>`
   (it holds classmates' names and posts).
2. `fixtures/piazza/post.json` — one `content.get` response (a full instructor note),
   scrubbed.
3. `fixtures/piazza/class-page.html` — `https://piazza.com/class/<nid>` via the options
   page's Fixture capture tool (it accepts any https URL), scrubbed; for the course name
   and any embedded config.

Never paste cookie or token **values** into chat or files; the header/cookie equality was
established by comparing eight characters.
