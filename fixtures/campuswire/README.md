# Campuswire fixtures

## feed-ece408-sp26.html (real, trimmed and scrubbed, 2026-09-18)

The **rendered** DOM of a class feed — `<main id="main-content">` on
`https://campuswire.com/c/G794D32E4/feed` (ECE 408, spring 2026) — copied by Sushi from
DevTools. There is no server HTML to capture: the page is a shell that loads posts with a
bearer token, which is why this source is a page **observer** and not a fetched source.

Trimmed from 54 previews to **ten** (seven in the dated list, three in the glance view, ten distinct post numbers — so the pinned-block repetition the live page shows is NOT in this file; the observer's dedupe-by-number rule is pinned by a constructed duplicate in tests/campuswire.test.ts instead), scrubbed by hand: staff and student names are
`STAFF-N` / `STUDENT`, the one email is `staff@illinois.edu`, attachment and form URLs are
`PLACEHOLDER`. Structure, class names, nesting and markers are verbatim.

What it pins:

- **A post preview** is `.post-preview-wrapper[role=button]` inside `.posts-list-wrap`,
  with `.post-title h3` (title), `.post-ref` (`#682`, the class-local post number),
  `.post-text` (the **full** body, Markdown-ish, in the list itself — no click needed),
  `.post-type-icon[data-tippy-content]` (`This is a note` for an announcement,
  `This question is resolved` / other text for a question), and `.post-time` whose text
  ends in the date as `MM/DD/YY` after a clock icon. **No clock time on a preview.**
- **The class** is named in `.sidebartitle-wrap h6` (`ECE 408: Applied Parallel
  Programming`); its code is in the URL path (`/c/G794D32E4/feed`), which the fixture
  cannot carry — a test must supply it.
- **The pinned block** (`.pinned-post-wrap`) repeats posts on the live page that also
  appear lower down or on later loads (not reproduced here): the post number, not the DOM
  node, is the identity.
- **The "glance" view** (`.left-col-3`, hidden by default) renders the same posts in a
  second shape: `.glance-post-preview-wrapper` with `Posted on MM/DD/YY <strong>Name</strong>`
  in `.author-name` and the category in `span.category-N`. An observer must not read the
  same post twice from the two shapes.
- **Deadline wordings in the wild** — the reason the announcement grammar exists:
  "Regrade requests are due tomorrow, **5/18 at 12:00 PM** (noon) CDT" (#682),
  "available until Monday, 05/18 at 12:00 PM CT (noon)" (#680), "complete the … Form …
  by Friday, May 15th, 11:59 PM Central Time" (#675), "extend the final deadline of CNN
  project to 11:59pm today" (#645), "extended to May 11" (#567), "due on **May 1** …
  final deadline is **May 4**" (#534), "Your exam is on **Tuesday, May 5th, from 7:00 PM
  to 10:00 PM**" (#597). "Good luck on your midterms!" (#638) states no deadline.
- Posts are unread or not (`.unread` on the wrapper); irrelevant to deadlines.

Also on the live page and worth knowing: `.post-time`'s text collapses to `005/17/26`
because the like count runs straight into the date past an empty clock icon; the date is
read end-anchored for that reason.

Deliberately unrealistic: nothing. Everything here was on the page.
