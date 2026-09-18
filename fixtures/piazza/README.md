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
- **No signed-out capture yet.** An expired session presumably redirects `/class/<nid>` to
  `/login` (path marker, house rule 8) and the API answers 401 or an `error` body; a
  never-signed-in student gets the marketing page (rule 11). Until captured, the source
  treats a class page without `const USER =` as `needs_login`, not as "no classes".

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
  `content.get` for that post (`fixtures/piazza/post.json`, not yet captured), so the
  snippet-only stage reads only what fits in a subject and its first line.
- Dates are real instants with a zone (`2026-09-18T09:09:00Z`), unlike Campuswire's
  date-only previews.

Deliberately unrealistic: nothing. The trim and the scrub are the only edits.
