# Campuswire — findings

_2026-09-18. Evidence: `fixtures/campuswire/feed-ece408-sp26.html`, a real capture of the
rendered feed of ECE 408 (spring 2026), trimmed and scrubbed by Sushi._

## Why this is an observer and not a source

Campuswire's class feed is a JavaScript shell. The HTML the server returns contains no
posts at all; the posts arrive over the wire as JSON, fetched with a bearer token the app
holds in memory. A §4-style source — a `fetch` of a URL, parsed in the offscreen document
— would receive an empty page for a signed-in student and could not tell that from a
signed-out one. There is no capture to take and no page to fetch.

So the only way to read Campuswire is to read the page **after the browser has rendered
it**, which means a content script: `src/observers/campuswire.ts`, registered at runtime
only after the student switches Campuswire on in Settings and Chrome grants
`https://campuswire.com/*`.

House rule 13 ("a per-student URL means a source, not an adapter") is answered here in a
third way: the URL is per-*class* (`/c/G794D32E4/feed`), but the content is per-token, so
neither an adapter nor a source can reach it.

## What is read, and what is not

Read, from the feed's own markup and nothing else:

- `.post-preview-wrapper` — one rendered post preview, in either of two shapes
- `.post-ref` — `#682`, the class-local post number
- `.post-title h3` — the title
- `.post-text` — the body, which the list renders in full; no click is needed
- `.post-type-icon[data-tippy-content]` — `This is a note` means an announcement
- `.post-time` (list) or `.author-name` (glance) — the posted date
- `.sidebartitle-wrap h6` — the class name, for §5.1's course-code extractor
- `location.pathname` — the class code

Not read, at all: cookies, `localStorage`, `sessionStorage`, the bearer token, the chat
channels, the member list, private messages, or any other page on `campuswire.com`. No
request is made to Campuswire. Nothing is written to the page.

What is stored afterwards is what `core/suggest.ts` already stores for any post: the
deadlines found (as `dueOverrides` or `suggestions`) and the post ids already read
(`seenPosts`). The post text itself is not kept.

## The noon assumption

A preview states a **date and no clock** — `05/17/26`. `postedAt` is the anchor every
relative phrase in a post resolves against ("due tomorrow", "11:59pm today", "this
Friday"), so an hour has to be chosen, and the choice decides which *day* those land on.

`ASSUMED_HOUR` is 12. Midnight and 23:59 each sit against a day boundary that a timezone
step can slip over; noon is the only hour that cannot, and a post is likelier to have been
written during the day in any case. It is still an invention, so it travels flagged:
`ObservedPost.extra.timeAssumed` (worker rule 3).

The offset is computed for the date, not assumed — `wallClockToIso` — so a January post is
`-06:00` and a May post is `-05:00`.

## Amendments to the fixture README (house rule 9)

The capture beats the description of it, and two sentences in
`fixtures/campuswire/README.md` do not match the file as committed:

1. **"Trimmed from 54 previews to nine."** The committed fixture holds **ten**
   `.post-preview-wrapper` elements and ten distinct post numbers: 682, 680, 679, 675,
   645, 640, 638 in the list (the first two in the pinned block) and 567, 534, 597 in the
   glance column.
2. **"The pinned block repeats posts that also appear lower down"** and **"the glance view
   renders the same posts in a second shape."** True of the live page and *not* of this
   trim: no number appears twice, and the glance column's three posts appear nowhere else
   on the page.

Both claims describe the live feed correctly, which is why `parseFeed` still dedupes by
number and why that rule is pinned by a deliberately constructed duplicate in
`tests/campuswire.test.ts` rather than by the capture (parser rules 10 and 12). The README
itself is not this change's file to edit; the correction belongs to whoever owns it next.

## The like count is glued to the date

`.post-time` renders as

```html
<span class="post-likes"><i class="far fa-thumbs-up"></i>0</span><i class="far fa-clock"></i>05/17/26
```

so its `textContent` is `005/17/26` — the like count runs straight into the date, because
the clock is an empty element with no text of its own. A parser that reads the element's
text and looks for `MM/DD/YY` after a space finds nothing, and **every post on the page
loses its date at once**, which is how the first draft behaved. `parseFeed` matches the
date at the **end** of the element's text instead.

The first fix read the element's trailing text node, so the pattern could be anchored at
both ends. A mutation check showed that branch was never reached: the end-anchored
fallback behind it accepted exactly the same inputs, in both shapes. Mutation house rule 2
— delete a guard that duplicates a reachable one — so it is gone, and what is left is one
regex.

## What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`)

The first run of `core/announce.ts` over this feed found two deadlines in nine
announcements, both without a subject, and read #682's "due **tomorrow**, **5/18 at 12:00
PM**" as an assumed 23:59 — the grammar had been built against constructed posts (worker
rule 7). Six rules came out of the real ones, all in `core/announce.ts` and pinned by
`tests/announce-real.test.ts`, which runs this capture end to end: Markdown markers are
masked with spaces (not stripped) so every span still grounds in the original text; a
clock stated beside a relative day beats the invented 23:59 when both name the same day;
"available until", "complete … by", "extend the deadline of X to" and an exam sitting
("Your exam is on Tuesday, May 5th, from 7:00 PM") are triggers; subjects may be phrases
("CNN project", "Regrade requests", "Subjective Evaluation Form"), carried to a following
sentence that names none, and fall back to the post's title; "the final deadline" is not
a deadline for something called *final*.

Now, over the same nine posts: seven yield a deadline, every mention has a subject, the
two dateless posts (#640, #638) explain themselves through `describeEmpty`, and against a
list holding "CNN Project Milestone 3" two posts (#645, #534) produce automatic moves onto
it — Sushi's "moves auto-apply" half is reachable from Campuswire.

Still open, recorded rather than worked around:

- **#597's exam sitting does not join the student's "Exam 2" row.** §5.2 fuses a numbered
  badge into one token (`exam2`), so a bare "exam" is not a subset of it. The post's title
  says "Exam 2 Resources", so the information is on the page; joining them needs either a
  looser §5.2 or a title-aware subject rule (`normalize.ts`, dedupe territory).
- The review session and the office-hours sitting in #597 are deliberately not read (one
  announcement should not become three rows); if they should be, that is a new trigger for
  "This <date> is the <event>".
- A subject carried from the previous sentence is the loosest rule: "HW3 is due Friday.
  Grades are posted Monday." would file the release under HW3. One line to remove if it
  misfires.
- An `event` mention becomes a plain suggestion; whether it should produce
  `Item.kind: "exam"` (and an `extra.endAt` from the range) is `suggest.ts`'s decision.
