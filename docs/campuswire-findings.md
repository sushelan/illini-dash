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

## Open: the grammar reads these posts, but cannot aim them

Run over this feed, `core/announce.ts` finds two deadlines in nine announcements:

| Post | Sentence | Read as |
|---|---|---|
| #682 | "Regrade requests are due **tomorrow**, **5/18 at 12:00 PM** (noon) CDT" | `tomorrow` → 2026-05-18T23:59, confidence 0.65 |
| #567 | "CNN competition deadline has been extended to **May 11**" | `May 11` → 2026-05-11T23:59, confidence 0.85 |

and nothing at all in the other seven, including #645's "We'll extend the final deadline of
CNN project to **11:59pm today**" (`describeEmpty` → `trigger-and-date-words-unmatched`)
and #534's "due on **May 1** … the final deadline is **May 4**".

Two things follow, and neither is this change's to fix (`core/announce.ts` is owned
elsewhere):

1. **The `subject` is empty for every mention on this page**, so `resolveMentions` can
   never match an existing item and every reading becomes a *new* suggestion. Nothing on
   this feed can be auto-moved, whatever the student's list holds. Sushi's decision was
   "moves auto-apply, new ones become suggestions"; as things stand the first half is
   unreachable from Campuswire.
2. **#682's stated clock is dropped.** The sentence says both "tomorrow" and "5/18 at
   12:00 PM"; the grammar takes the weaker of the two, lands on 23:59 with `timeAssumed`,
   and scores it 0.65 — below `AUTO_MOVE_CONFIDENCE`. The stated time is right there in
   the same clause.

`tests/campuswire.test.ts` pins this behaviour as it is rather than weakening the
expectation, so teaching the grammar to read these will fail that test and say so.
