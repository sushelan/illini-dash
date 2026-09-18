# Piazza fixtures

Both real, captured by Sushi on 2026-09-18 from a CS 425 / ECE 428 (fall 2026) class,
then scrubbed by a one-off script (staff names → `STAFF-N`, person ids → `uid-N`, photos
and emails → placeholders) and checked with `npm run scrub`. The design they support is in
`docs/piazza-findings.md`.

## class-page.html — `GET https://piazza.com/class/<nid>` (signed in)

Captured with the options-page Fixture capture tool. The page is a shell whose only
server-rendered data is `<script> const USER = {…};` — reduced here to the two fields
discovery reads:

- `networks[]`: one per enrolment — `id` (the network id, `nid`, which is also the class
  URL's last path segment), `course_number` (`"CS 424"`, `"CS 425 / ECE 428"`,
  `"CS 446, ECE 449"` — free text, run §5.1 over it and keep every code), `my_name`
  (`"CS 425 / ECE 428: Distributed Systems"`), `term` (`"Fall 2026"`), `term_key`
  (`"fall2026"`), `start_date` / `end_date` (ISO or null), `status` (`"active"` /
  `"inactive"`), `folders[]` (the class's own tag vocabulary: `hw1`, `mp2`, `midterm1`…),
  `profs[]` (scrubbed), `office_hours` (scrubbed keys), `enrollment`.
- Four networks: two Fall 2026 (active), one Spring 2026 (still `active`), one Spring 2025
  (`inactive`) — so **`status` alone does not say "this term"**; `term_key` / `start_date`
  do, and the Canvas current-term rule (§4.1 amendment) is the precedent.
- Everything else in `USER` (profile, emails, notifications, `feed_prefetch`) is dropped
  from the fixture and must not be read by the source.
- **The signed-out capture exists** (below), and it is the marketing splash rather than a
  redirect: 200 at the unchanged URL, no `const USER =`, a login form. So the source no
  longer reads "no `const USER =`" as `needs_login` on its own — `classifyClassPage` wants
  the splash's own `form#login-form` for that, and a page with neither is reported as a
  page that changed. An *expired* session on the API is still the 401-or-`error` case
  `classifyPiazzaResponse` handles (house rule 8).

## feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`

Body `{"method":"network.get_my_feed","params":{"nid":"<nid>","limit":150,"offset":0}}`
(108 bytes on the wire), header `CSRF-Token: <the session_id cookie>`, cookies attached
by the browser. Kept: `result.feed[]` trimmed from 106 posts to all 25 `type:"note"` posts
and 6 `type:"question"` posts, `result.more`, `result.sort`, `result.tags.instructor`.
Dropped: `token_data` (a channel signature), `hof`, `notifications`, `drafts`, user counts.

What a feed entry carries, and what it does not:

- `nr` (the class-local post number, the identity: `piazza:<nid>:<nr>`), `id` (`cid`, what
  `content.get` takes), `nid`, `subject`, **`content_snipet` — the first 120 characters
  only**, `type` (`note` = an instructor or pinned announcement, `question`), `tags[]`
  (`pin`, `instructor`, `student`, `logistics`…), `folders[]`, `pin`, `bucket_name`
  (`"Pinned"`, `"This week"`…), `modified` / `updated` (ISO `Z`), `log[]` of
  `{t, u, n}` where `log[0].t` is the creation instant and `u` a person id.
- **The body is not in the feed.** A deadline sentence past character 120 needs
  `content.get` for that post (`post.json` below), so a snippet-only stage reads only what
  fits in a subject and its first line.
- Dates are real instants with a zone (`2026-09-18T09:09:00Z`), unlike Campuswire's
  date-only previews.

**The scrub was broken and has been repaired (2026-09-18).** It replaced the empty string
as well as the names, so every `subject` and `content_snipet` came back with `STAFF-36`
between every character while the real text survived underneath — 5033 copies of the
marker, and a fixture against which no assertion about the grammar would have meant
anything. The marker is removed and the one personal name left in a snippet is now
`STAFF-9`. Nothing else in the file was touched.

Deliberately unrealistic: nothing in the file itself. The cases that need an unrealistic
value — a duplicate `nr`, an unreadable `log[0].t`, a term that does not read, a snippet
that actually states a deadline — edit a copy inside `tests/piazza.test.ts` and say so
there, because the capture is healthy in every one of those respects and a parser that got
them wrong would pass against it unchanged.

## post.json — `POST https://piazza.com/logic/api?method=content.get`

Body `{"method":"content.get","params":{"cid":"<feed entry id>","nid":"<nid>"}}`, same
header and cookies. One real instructor note (nr 179, "MP1 'Recommended' solutions"),
captured 2026-09-18; every `uid` / `uid_a` is `uid-N` (same map as the other two files)
and five students credited in the body are `STUDENT-N`.

- `result.history[]` — one entry per **version**, newest first: `subject`, `content`
  (**HTML**, entities encoded: `&#34;` `&#43;`), `created` (ISO `Z`), `uid`, `anon`. The
  body a deadline sentence lives in is `history[0].content`; strip tags and unescape
  entities before the grammar sees it, and keep the span grounded in the *text* you hand
  the grammar, not the HTML.
- `result.type` (`note`), `nr` (179 — matches the feed's `nr`), `id` (the `cid`), `tags`
  (`instructor-note`, `pin`, a folder name), `folders`, `config.is_announcement` (1),
  `created`, `change_log[]` (versions; uids), `children[]` (follow-ups and answers, with
  their own `subject` text, `uid_a`, `children`).
- `instructor-note` in `tags` and `config.is_announcement` are the positive markers that
  a note is staff-written; a `type:"note"` can also be a pinned student post (the feed's
  "Search for Teammates!" carries `tags: ["pin","student"]`).
- Five versions of one note is why `history_size` exists; read `history[0]` only.

**Deliberately edited, inside the test.** The capture is a real instructor note about
solutions and it states **no deadline**, which is the honest case and is asserted as such
(with `describeEmpty` saying *which* nothing it is). It therefore cannot tell "the body
stage reads a deadline" from "the body stage is dead", so `tests/piazza.test.ts` appends
`<p>Also: MP2 is due 10/3 at 11:59pm.</p>` to a **copy** of `history[0].content` and says
so there. The sentence sits far past character 120 on purpose: that is the whole claim
this stage makes over the feed's snippet. The file on disk is untouched.

`tests/piazza.test.ts` also edits copies for the cases the capture is healthy in — a
missing `history`, an empty `content`, a naive `created`, a body answered for another
`cid`, an `instructor-notes` tag that must not match `instructor-note`.

Deliberately unrealistic in the file itself: nothing.

## class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT)

Pasted by Sushi from *view-source* on 2026-09-18 after logging out. Piazza answers the
class URL with its **marketing splash** — `<body class="qa_homepage_container new_splash">`,
an ordinary title, and a login modal (`#loginModal`, `form#login-form` posting to
`https://piazza.com/class`, `ERROR_MSG = "Please log in to proceed to your class…"`) — with
no redirect visible from the source view and **no `const USER =`** anywhere. The HTTP status
was not captured; house rule 11's case exactly (200 at the unchanged URL is the likely
answer, and the parser must not depend on it either way).

None of `loginModal`, `login-form`, `new_splash`, `qa_homepage_container` occurs in the
signed-in capture, so any of them is a candidate *positive* signed-out marker (house rule
12); the signed-in page has `const USER` and none of these.

Trimmed: the marketing panels between the product brief and the footer (professor quotes,
lecture links, the 1,500-school list, subject buttons, "Our story", "In the news") were
cut to a heading each — they hold nothing a parser reads. The login form's hidden
`csrf_token` value is replaced with `SCRUBBED-LOGIN-FORM-TOKEN`; it was a throwaway token
for the form, not a session, but it does not belong in a repo either. Nothing else changed.

Deliberately unrealistic: nothing.

## post-running.json — `POST …?method=content.get`, a note that states a deadline

Pasted by Sushi on 2026-09-18 from DevTools (the response for nr 28, the CS 425 "HW1 (All
students) Released - And Clarifications (Running Post)"), scrubbed and trimmed here. It is
the fixture `post.json` could not be: its newest version says **"HW1 is due 9/20 (Sun) 11:59
pm US Central Time. This is a hard deadline"**, a sentence far past any 120-character
snippet, which is the whole case for the post-body stage.

- `history` is trimmed from 22 versions to two: **`history[0]`, the newest** (2026-09-13,
  the sentence above), and **`history[1]`, the oldest** (2026-08-28) — which was pasted
  from the previous year and states *different* deadlines ("HW1 is due 9/18 (Thu) 2 pm",
  "MP1 is due 9/14 (Sun) 11.59 PM", a fa2025 assignments URL, "Fall 2025"). A parser that
  reads any version but the first, or reads all of them, will produce a wrong or a second
  deadline; that is why the oldest version is the one kept. `history_size` stays 22, as
  served.
- `change_log` is trimmed to five entries; `children` to three follow-ups (a student
  question with a TA answer endorsed by the instructor, an anonymous one, and the
  instructor's "make new posts" note). Follow-ups are student text and are **not read** by
  the body stage; they are kept so a test can say so.
- Scrubbed: every `uid` is `uid-N` (1 = the instructor, 2 = a TA, 3–4 = students — a fresh
  map, not the one the other three files share), post and child ids are `post-28` /
  `child-N`, endorser names are `STAFF-N`, the sign-off names in both bodies are `STAFF-N`,
  and the two Gradescope entry codes are `SCRUBBED-CODE`. Read back as text after writing
  (parser rule 14): the deadline sentence survives intact.

Deliberately unrealistic: nothing in the file itself; the trim is the only edit.

**What it is asserted to produce** (`tests/piazza-real.test.ts`, "note 28, the Running
Post, read in full"): one suggestion, titled `HW1`, at `2026-09-20T23:59:00-05:00`, with
`timeAssumed: false` — the post types the clock — and the span `9/20 (Sun) 11:59 pm`. The
old version's `9/18 (Thu) 2 pm` and `9/14`, the `9/5:` / `9/10:` / `9/13:` clarification
markers and the follow-ups' text appear in **no** suggestion, and each of those is asserted
rather than assumed: they are the ways this fixture can go wrong quietly. Against a list
that already holds a Gradescope `HW1` due the 20th it produces nothing at all; against one
due the 18th it moves the row without asking, because a stated date with a stated clock is
the 0.95 rung.

Reading that bracketed weekday is new (docs/piazza-findings.md, amendment 2026-09-18), and
the case its *absence* would break is not in this file: "(Sun)" agrees with 9/20/2026, so
dropping it from the year cross-check changes nothing here. The contradicting case —
`10/3 (Fri)`, where 10/3/2026 is a Saturday — is written out in the test instead, and
said so here (house rule 10).

The feed entry for this post is the other half of the pair: its `log[]`'s last `update` is
`2026-09-13T22:22:48Z`, which is exactly this file's `history[0].created`, while its
`modified` is `2026-09-17T03:20:42Z` (a follow-up). That is the evidence for reading the
log rather than `modified` when deciding whether a post has been rewritten since it was
read.
