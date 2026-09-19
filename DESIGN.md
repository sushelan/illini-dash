# Illini Dash — design as built

**What this is.** `SPEC.md` is the contract written before the code; `PROGRESS.md` is the
day-by-day record. This file is neither: it describes the system **as it exists in the
tree today** (2026-09-19, build of commit `0d41212`) — the layers, why each boundary is
where it is, and the invariants the code is actually written to. Where the build has
moved past the spec, this file states the build and points at the amendment.

One sentence of scope: a Manifest V3 Chrome extension that reads every UIUC deadline a
student already has access to — Canvas, Gradescope, PrairieLearn, PrairieTest,
smartPhysics, arbitrary course websites, instructor posts, and anything typed by hand —
merges them into one list, and reminds. No backend, no credentials, no accounts.

---

## 1. The shape of the thing

```
  chrome.alarms ──► background.ts ──► core/sync.ts ──► core/dedupe.ts ──► chrome.storage.local
   (every N min)     service worker    plan/fetch/apply    merge + retention        (one key)
                          │                  │                                          │
                          │                  └─► sources/*.ts  (fetch plan + pure parser)
                          │                          │
                          │                          └─► offscreen.html  (DOMParser only)
                          │
                          ├─► core/schedule.ts ──► chrome.notifications
                          ├─► core/gcal*.ts    ──► the student's own Google Calendar
                          └─► chrome.runtime messaging
                                    │
                          ┌─────────┴──────────┐
                     popup.html            options.html        observers/campuswire.ts
                     (five views,          (sources, adapters,  (content script, opt-in,
                      four screens)         appearance, gcal)    reads posts in the page)
```

Four bundles come out of `esbuild` (`build.mjs`): `background`, `popup`, `options`,
`offscreen`, plus `campuswire-observer` built separately as an **IIFE** — a dynamically
registered content script is injected as a classic script, so ESM output would fail to
parse inside somebody else's page. Every bundle carries `__BUILD_ID__`, because Chrome
keeps a running service worker across a page reload and the two builds then disagree
(see §9.3).

### 1.1 Why an offscreen document

MV3 service workers have no `DOMParser`. Rather than regexes or a bundled HTML parser,
the worker fetches HTML as a *string* and posts it to an offscreen document with reason
`DOM_PARSER`, which parses it and returns plain JSON. `DOMParser` documents are inert —
no scripts, no resource loads — which is also the security property wanted when handling
untrusted course HTML. Parsers are therefore `(doc: Document, ctx: PageCtx) => RawItem[]`
— pure, no I/O — so the identical function runs in the offscreen document and in `vitest`
under `linkedom`. `core/offscreen-client.ts` is the worker's side of that boundary;
`src/offscreen.ts` is 70 lines of dispatch and nothing else.

### 1.2 Where decisions are allowed to live

`background.ts` is 2,605 lines of `chrome.*` wiring and message dispatch — and no
decisions. That is a rule the project arrived at the expensive way: every defect found in
the first live end-to-end sync lived in the worker, because the worker is the one file the
1,915-test suite structurally cannot reach. So anything with a *decision* in it is a
module under `src/core/`, where it can be pinned by a test and mutation-checked.

`core/queue.ts` exists for the same reason: a `sync → reschedule → fireNotification`
deadlock hid in the worker for four build steps.

---

## 2. Data model

`src/sources/types.ts` is the single definition, imported everywhere.

| Type | Role |
|---|---|
| `RawItem` | one row as **one source** sees it; immutable once parsed |
| `Item` | one deadline as the **student** sees it: one or more `RawItem`s merged |
| `SourceStatus` | per-source health — `ok` \| `needs_login` \| `parse_error` \| `network_error` \| `disabled` \| `pending` |
| `Overrides` | everything the student forced: merges, splits, hides, dones, renames, instructor corrections |
| `Suggestion` | a deadline read out of prose, waiting one click from becoming real |
| `Adapter` | a course-site parser expressed entirely as JSON |
| `StoreV1` | the whole persisted document under one `chrome.storage.local` key |

`Source` is `canvas | gradescope | prairielearn | prairietest | smartphysics | site |
manual`. `manual` is a source rather than a parallel identity because everything
downstream — `memberKey`, dedupe, overrides, the row's source column — is keyed by one;
but its rows live in `manualItems`, never in `store.raw`, since `raw` is what the sync
loop replaces per source and §5.4 purges, and a row nobody fetches would be deleted after
three syncs. It is excluded from every health count: a dot that can only ever be green is
not information.

`Kind` gained `event` over the spec's list. Canvas planner returns office hours and review
sessions as `calendar_event`; mapped to `other` they behaved like assignments and sat in
"Needs attention" for a week after they had happened, because an event has no submission
and nothing could ever mark it done.

**`memberKey` = `` `${source}:${sourceId}` ``** is the identity that everything durable is
keyed by. `Item.id` is a hash of the sorted member keys, so it changes the moment a group
gains or loses a member — which is why every override (`hiddenKeys`, `doneKeys`,
`dueOverrides`) is keyed by memberKey and not by item id. An id-keyed hide is spent as
soon as a second source mirrors the row, and the stale id stays armed forever.

Two `extra` keys cross module boundaries and are therefore schema, not parser-private:
`timeAssumed: "true"` (this code invented the clock) and `endAt` (an ISO instant at which
a span ends — never a second deadline).

---

## 3. Sources

Each source module is a **fetch plan** plus one or more **pure parsers**, and a
`isLoginResponse` that takes the HTTP status as well as the body.

| Source | Shape | Notes |
|---|---|---|
| Canvas | JSON API (`/api/v1/courses`, planner) | dates arrive by LTI copy and are ranked last |
| Gradescope | HTML dashboard → per-course page | two-stage; where most work is actually handed in |
| PrairieLearn | HTML assessments + credit schedule | reduced-credit deadlines become `lateDueAt` |
| PrairieTest | HTML home | booked and available exam cards; `booking` kind |
| smartPhysics | HTML, per-enrolment URL | a *source*, not an adapter — the URL carries an enrolment id |
| site | `adapters/registry.json` | declarative; §4 below |
| manual | none | typed by the student, `core/manual.ts` validates |

Piazza (`core/piazza.ts`, 2,170 lines) and Campuswire (`core/campuswire.ts` plus the
content-script observer) are **post readers**, not deadline sources: they produce
`Suggestion`s and instructor corrections, both opt-in and both off by default.

### 3.1 Login detection needs the status

An expired session on an API path does not redirect and does not return HTML — it returns
401 with JSON at the unchanged URL. Without the status that reads as "logged in", the
parser then finds nothing and reports `parse_error`, which means "go fix the selectors"
in the one case where signing in is the entire fix.

And "never signed in" is a third case: **200 at the unchanged URL** with an ordinary
title, because Gradescope serves marketing and PrairieTest serves a page with no exam
cards. So every hosted source carries a *positive* signed-out marker, anchored on a class
hook or a path — never a substring like `"Log In"`, which an assignment named *Log
Interpretation* contains. `core/parsing.ts::looksLoggedOut` owns all of this.

---

## 4. Course-site adapters

An adapter is **data, never code** (MV3 forbids remotely loaded code; remote data is
fine). `adapters/registry.json` ships five bundled entries and is refreshed from GitHub
daily; `core/registry.ts` validates every entry before it is allowed near a page, and
`withLocalAdapter` keeps student-authored ones separate from the published set.

The schema has grown past the spec's `rows`/`title`/`due`/`link`, each field forced by a
real captured page:

- **`columns`** — resolve `title`/`due`/`link` against the table's own `<th>` row on every
  parse. Positional `cells[2]` turned one added column into 14 undated, mis-statused items
  with no error; this is the fix and the rule.
- **`dueLabel`** — for pages that write `Release: 8/25`, `Due: 9/7` as list items rather
  than cells (ECE 411's Sphinx page). Labels match exactly after normalising case and
  whitespace; the label is appended to the title so three checkpoints of one MP do not
  share a `sourceId`.
- **`titleFrom`**, **`time`** — `"section >> h3"` climbs to a container and reads from it;
  `time` supplies the clock when the due text states none, so an exam at 7–9PM is not
  filed at 23:59.
- **`splitTitle`** — a **literal** separator (never a regex: adapter data is remote, and a
  regex here is a ReDoS against every row of every page) for cells like `HW5 Due; HW6 Out`.
- **`kind`** — one value per adapter, because a course site splits by *page*: the page
  that lists exams lists nothing else.

`core/detect.ts` proposes an adapter from a captured page by search, with a hard test for
every candidate. `core/author.ts` asks an on-device model only when that search returns
nothing, and holds the answer to the identical test — `validateAdapter`, then the real
`runAdapter` on the real page, and the student is shown the rows that came out.

---

## 5. Normalize, merge, retain

`core/normalize.ts` extracts `CS225`-shaped codes (all of them for cross-listings) and
reduces titles to a comparison token set — the displayed title is never altered.

`core/dedupe.ts` unions two `RawItem`s when: same course code (any alt-code match), both
dated within 24h or both undated, title Jaccard ≥ 0.6 or subset with ≥ 2 tokens, and they
come from **different** sources. Merging is transitive; then `splitKeys` are pulled out and
`mergeGroups` unioned in.

Canonical field selection is by `SOURCE_RANK`:

```
gradescope 0 · prairielearn 1 · prairietest 2 · smartphysics 3 · manual 4 · site 5 · canvas 6
```

The system a student actually submits in owns its own deadline; Canvas dates set by LTI
sync are copies, and this account proved it — 66 Canvas rows mirroring PrairieLearn
assessments, none of them dated. `manual` sits above `site` and `canvas` because a student
typing a date is *stating* one, and below the submission systems because those are what
will refuse a late upload.

Two amendments to the spec's precedence are load-bearing:

1. **A stated instant beats a higher-ranked assumed one.** The adapter runner fills in
   23:59 for a bare date; ranking that above a real Canvas deadline is ranking this
   extension's invention above a fact. `timeAssumed` is lifted from the winning member
   onto the `Item` so no consumer has to re-derive which member won.
2. **`url` is the highest-ranked member *that has a link*** — a row without one is drawn
   as a `<div>`, never dropped.

`status` takes the "most done" member (`graded > submitted > not_submitted > missing >
unknown`); `done` is kept separate, because what the source says stays what the source
says. Retention purges raw items more than 60 days past due, and undated items unseen for
three syncs, dropping overrides that referenced them.

---

## 6. The sync loop

`core/sync.ts` is orchestration only: what to fetch, in what order, what a failure means,
what gets written. Fetching, parsing and the clock are **injected** (`SyncDeps`), so the
whole loop runs in Node — which matters because its failure modes (a source going dark, a
backoff that never lifts, a partial write) are exactly the ones invisible in manual
testing.

The loop is three phases, and the split is the point:

```
planSync(store, trigger, now)   →  a short store hold: what needs fetching
fetchSync(plan, deps)           →  the network. NO store hold.
applySync(plan, outcomes, …)    →  a short hold, onto a FRESH store
```

**No section holds the store queue across a fetch.** `core/queue.ts` is strictly
exclusive and non-reentrant; a section never calls `withStore` again (nested is a deadlock
by design) and `SLOW_HOLD_MS` names any section that outstays 2s in the console. The first
attempt at fixing that deadlock made the queue "re-entrant" with a global flag — and a
flag cannot tell a nested call from a concurrent one, so every click landing during a
sync's fetches ran unqueued and was silently overwritten by the sync's older snapshot.

Other constants that are decisions: `REQUEST_TIMEOUT_MS = 20s`,
`MAX_CONCURRENT_PER_HOST = 4` (**one flat pool per host across everything sync fetches —
a bounded pool inside a bounded pool multiplies**), `POPUP_DEBOUNCE_MS = 5min`,
`SYNC_SPINNER_CAP_MS = 30s` (`sendMessage` does not reject when the worker is torn down
mid-answer, so an uncapped spinner turns forever with nothing behind it).

Replacement is **per source**, so a Gradescope outage cannot wipe Canvas items. Failures
back off per source and are classified before they are reported: throwing `ParseError`
whenever every adapter failed once announced a `TypeError: Failed to fetch` as "the page
changed", sending someone to debug selectors that were fine.

---

## 7. Health, notifications, calendar

**Health** (`core/health.ts`) derives everything the UI asserts about a source from an
attempt that actually happened, and re-derives it from `lastAttemptAt` rather than
trusting `state` from disk, so an old store cannot claim success. `pending` is a real
state. A green dot means "I fetched, and it was fine" — never "I did not fetch": a source
that is off, unconfigured, or resting reports *that*.

**Notifications** (`core/schedule.ts`): one alarm per (item, lead), named
`notify:{itemId}:{lead}`, so they survive worker restarts. Leads are `24h`, `2h`, `dayOf`,
`booking` (daily at 10:00 until an unbooked exam disappears), and `late24h`/`late2h` —
which are separate keys on purpose, because sharing a key with the full-credit lead
suppressed the late reminder as already-sent, silencing the one deadline the student could
still meet. Quiet hours (default 23:00–08:00) defer rather than drop.

**Calendar** (`core/gcal*.ts`): a `.ics` download and per-item Google template links need
nothing; the OAuth sync is opt-in, off by default, and uses the single non-sensitive
`calendar.app.created` scope — it can create one secondary calendar and touch nothing else
the student owns. Turning it off deletes that calendar's events. `gcal.ts` decides what is
projected, `gcal-auth.ts` names every failure, `gcal-client.ts` does HTTP with retries, and
the worker holds only the token and the queue.

---

## 8. Storage

One `chrome.storage.local` key holds the whole `StoreV1Plus` document: `raw` (keyed by
memberKey), `items`, `sources`, `overrides`, `settings`, `registry`, plus `manualItems`,
`localAdapters`, `enabledAdapters`, `suggestions`, `seenPosts`, `observers`, `gcal`,
`setAsideCourses`, and the loop's own bookkeeping (`misses`, `backoffUntil`,
`lastSyncAt`, `setupDoneAt`). `migrate()` is the only way a store is
read; `schemaVersion` is 1 or 2 (2 since the first-run screen). Pruning runs on load:
`pruneSeenPosts`, `pruneSuggestions`.

**Every writer goes through the queue.** A writer that bypasses it loses whatever the user
just clicked.

---

## 9. UI

Vanilla DOM, no framework. All source-derived text goes in with `textContent`.

Two surfaces: the **popup** (`popup.html`, 400px wide, capped at 600 tall by Chrome) and
the **full view** — the same document opened as an ordinary tab, which has width and no
ceiling. One codebase draws both; a view that wants to differ branches inside itself
rather than at the entry, so the two drawings cannot drift apart about what they are
showing.

### 9.1 The shell

`src/ui/popup.ts` asks the worker for state, picks a view, and wires what keeps an open
window honest. Around whichever view is current, `shell.ts` draws: the tab strip, a filter
strip, a date navigator, banners, a status line, and the footer strip. The footer's source
text is the entry to the Needs-you screen — it replaced a header pill that was removed on
2026-09-19 for saying too little in too much space ("All clear" names nothing).

A **screen** — Needs-you, one deadline, the editor, first-run setup — replaces `#view`
entirely and sets a body class that hides the tab strip, the filter strip and the date
navigator, because all three describe the calendar underneath and none is answerable from
inside a screen. Screens are never floating panels; see §9.6.

`core/calendar.ts` and `core/grouping.ts` own every decision the views render — which rows
belong to a day, what a group is called, what word goes in the status column. The files
under `views/` are layout over those answers, which is why a tab's behaviour is testable
without a browser.

### 9.2 The five tabs

`VIEWS = ["day", "week", "month", "nodate", "exams"]`, labelled **Today · Week · Month ·
No date · Exams**. `FULL_VIEW_ONLY` is now empty — every tab fits in 400px. The chosen tab
persists across popup opens; Today is the fallback.

The tab set is itself a design decision with history: there used to be an **Attention** tab
holding three groups — Overdue, No date at all, Couldn't read. It mixed *late work* with
*rows that are not asking for anything yet*, so its badge crept upward all semester and the
one genuinely late row sat eleven deep. It was split: the undated half became the No date
tab, the late half and the post suggestions went to the Needs-you screen.

#### Today — a schedule for the day

Three bands, in this order, and a row appears in exactly one of them:

1. **Late** — everything unfinished whose instant has gone.
2. **By end of day** — today's untimed rows first, then rows stated at or after 11 PM.
   Untimed first because an invented 11:59 PM can be hiding a 5 PM cutoff and a stated one
   cannot. Finished rows sink: this band is what is still owed by bedtime.
3. **The timeline** — today's clocked rows on a rail, clock on the left, a "now" marker,
   and empty hours collapsed to one 14px dotted segment. Nothing is drawn to scale.
   Finished rows stay in place, because a struck-through 9 AM quiz sitting under 11 AM
   would be a claim that it happened at 11.

This replaced both an hour grid and a "Next up" hero. The grid went because an axis is the
wrong shape for data that lands on the same minute; the hero went because it said in a
14.5px title what the first timeline row says in 12px. Today is anchored to now and has no
‹ › navigator — the Week tab is what moves.

#### Week — seven day cards

A 44px `[DOW / date]` column, the day's deadlines beside it as compact cards, one line per
row, and one status word in the right-hand column: `done`, `late ok`, `1d late`, `EOD`, or
the clock. Days are **rolling** (the next seven days, not Sunday-first — that is what the
Month grid is for). A day with nothing says "Nothing due"; quiet days collapse. Today's
card is tinted *and* captioned "today", because a colour-only signal is exactly what the
high-contrast theme exists to avoid. Pressing the empty part of a day adds something to it.

#### Month — two drawings of one month

The **full view** draws the grid of titled pills: a cell there is ~100px and carries three.
The **popup** cannot fit a word in a seventh of 400px, so it draws weight instead — one
5px dot per deadline in the course hue, capped at `MONTH_DOT_CAP` — and the titles appear
under the grid for the one day the student taps. Both drawings read `anchorDate` and go
through `monthCells`, so they cannot disagree about which month they are on. The pills were
why this tab used to be full-view-only; the dots are what took it off that list.

#### No date — listed somewhere, dated nowhere

Two groups, in this order: **No date at all** (a source listed it with no deadline
anywhere) and **Couldn't read** (the source printed a date this extension could not make
sense of — the deadlines it is least sure about). Derived from the same `attentionGroups`
the Needs-you screen uses, so the two surfaces cannot disagree about which row is which.

Nothing here folds. On the old Attention tab "No date at all" was a `<details>` because it
never empties and was burying the actionable groups; on a tab that *is* that group, folding
it leaves a screen with one word on it. What it gets instead is three buttons per row —
**Give it a date**, **Tick off**, **Hide** — because "listed with no date" is a state the
student can end, and the old tab offered no way to end it. The explanation is said once at
the top, not on every row.

#### Exams — everything you have to turn up to

`kind === "exam"` or `"booking"`, and nothing else. That line is drawn by the sources, not
by taste: PrairieTest maps a reservation to `exam` and an open window to `booking`, and
Canvas promotes a calendar event whose title says exam, midterm or final. Everything else a
student calls a quiz is work done from a laptop whenever, and including it would refill this
tab with most of PrairieLearn — the same dilution that made Attention read 11 when one
thing was late.

Three sections: **Not booked** (the only rows asking for anything — §7 nags daily, because
the window closes whether or not the student has looked), **Upcoming**, and **Recent** (sat
in the last week, so "done" is distinguishable from "never existed"). The booking rows
strip PrairieTest's own `Book a slot:` prefix, which under a heading already reading "Not
booked" was the third time the row said the same thing at the cost of the exam's name.

**No 60-day horizon**, unlike every other view. In September a December final is otherwise
invisible, and it is the deadline a student most wants a month's warning about.

Empty states are claims about sources, not about the term: "No exams or quizzes from any
source you have switched on", never "no exams".

### 9.3 The four screens

- **Needs-you** — everything waiting on the student, in one place: overdue work, post
  suggestions awaiting a yes or no, and any source with a button on it. Those were three
  surfaces answering one question, and a student wanting to know whether anything needed
  them had to look in three places. Every count and sentence about a source comes from
  `sourceRows` / `staleNotice` / `actionFor` — the same three functions Settings › Sources
  uses, so the two cannot disagree.
- **Deadline** — one item opened: the live countdown, the stated due text, which sources
  contributed it, exam detail, who moved it and the undo for that, and a calendar link.
  `state.screen` holds an **item id**, not an item, and the row is looked up fresh on every
  draw — half of what this screen says is relative, and holding the draw would freeze a
  live countdown. A row that has gone closes the screen rather than leaving a stale copy.
- **Editor** — typing a deadline in, editing one, deleting one, and undoing that. The form
  itself (`ui/editor.ts`) knows nothing about the popup.
- **Setup** — the first-run screen: which sites this student's courses actually use. It
  hides the calendar chrome entirely rather than sitting above it, because a full calendar
  shell with one sentence of explanation under it reads as a broken app rather than a first
  step. Nothing about it blocks; the primary button is clickable from the first paint.

### 9.4 A row

`rows.ts` draws one `Item`: course label in its hue, title, the clock or status word, tone
from `itemTone`, source provenance, and a menu: **Open in ‹source›** (naming the site,
because clicking the row already did this and nothing on screen said so), **Mark done**,
**Hide**, **Split (n sources)** when merged, **Merge with…**, **Add to Google Calendar**,
and **Edit** / **Delete** for a hand-typed row. §5.3 leans on that menu: a false merge is
visible because the row shows two source labels, and the fix has to be one click. A row with no `url` is a `<div>` rather than an `<a>` and is never dropped for want
of somewhere to go. Facts that belong to a group are said once above it, not repeated per
row — five bare dates from a course site produced five consecutive rows each carrying the
same sentence before that rule existed. The untimed note is never the word "all day": that
is the calendar convention and it is wrong here, since the real cutoff may be 5 PM.

### 9.5 The options page

A single scrolling document with a sticky section nav driven by `IntersectionObserver`
(a scroll handler on a 1,900px page runs every frame to answer a question that changes a
handful of times). Nine sections: **Sources · Courses · Course websites · Reminders ·
Appearance · Hidden & done · Data & privacy · Help · Developer**.

Every control re-draws the whole page after it writes, so the catch lives in
`refreshOptions` rather than at a dozen call sites — and it catches into a visible warning
naming the fix ("Open chrome://extensions, click Reload"), because a throw here otherwise
leaves the page frozen half-drawn with nothing but an uncaught rejection in a console the
student does not have open.

### 9.6 The 600px ceiling

Chrome sizes a popup by measuring the document's intrinsic box. Two rules follow, and every
popup defect so far has been one of them in a costume:

- **Never make `body` or `html` a scroll container**, and be suspicious of percentages and
  viewport units on either. `body { max-height: 600px; overflow-y: auto }` read like a
  faithful implementation of the spec's cap and is what made the popup open at 800×600 with
  the 400px list in its left half. Chrome already caps at 600 and scrolls itself.
- **Nothing that matters floats.** A panel positioned out of flow contributes no height to
  the box being measured, so it gets clipped. Needs-you replaces `#view` in document flow
  *because* it replaces a popover that shipped clipped halfway down its fifth row. The
  deadline screen does the same.

A layout rule keyed on window width can also feed itself — Chrome lays the document out to
decide the width — so the full view keys off a marker the page sets from its own URL, not
`@media (min-width: …)`.

### 9.7 A message is data from another build

Chrome reloads an extension page from disk on every open but keeps the running service
worker until the extension is reloaded, so page and worker routinely disagree about what a
message contains. `Response` is a compile-time claim about the *sender's* build.
`core/compat.ts` normalizes every field a page dereferences, names missing ones on screen,
and no render function is allowed to reject into a console the user does not have open.
Every `send()` from a page carries a `.catch`.

### 9.8 Interaction

- A class selector matches whole tokens — three redraw guards asked for `.menu` while the
  element's class was `menu-surface`, and were dead from the day they were written. The
  selector and the class go through **one constant** (`MENU_SELECTOR` / `MENU_CLASS`).
- **Never decide anything about focus inside a microtask queued from a focus event.**
  Blink fires `focusout` before it updates `document.activeElement`; a microtask running in
  that gap saw `<body>` and tore the menu down between mousedown and mouseup, so no `click`
  ever fired. Read `event.relatedTarget`; if it is null, wait one *task*.
- Redraws that find a menu open are **deferred, not skipped**.
- When a control does something asynchronous it says so on itself — "Hide" becomes
  "Applying…", which distinguishes "the click never ran" from "the round trip failed" with
  no console at all.

### 9.9 Appearance

`core/theme.ts` + `ui/theme-panel.ts` + two stylesheets, deliberately four files so the
colour layer is something you can hand to someone. Themes: **Illini**, **Neutral**, **High
contrast**; modes: system / light / dark. **Dark is the default for verification** — the one
person who has to be convinced runs dark. A tint does different work at each end of the
range: 5.5% navy on white drops the surface 12/255, while 6% pale blue on `#1c1c1c` lifts it
8, so the dark tints are roughly double and that is arithmetic, not taste.

---

## 10. Permissions

`storage`, `alarms`, `notifications`, `offscreen`, `contextMenus`, `scripting`,
`identity`, `cookies`. Host permissions are the five source origins plus
`raw.githubusercontent.com` for the registry; everything else is
`optional_host_permissions`, requested at the click that enables an adapter or an observer
(a user gesture does not survive an `await`, so the worker cannot ask — the page does, then
messages the worker). Never `<all_urls>`, `tabs`, or `webRequest`.

The `key` in `public/manifest.json` pins the extension id to the store draft's
`mimgaiaicopabbiabakmknkcbfekplei`; the `oauth2` `client_id` is public (the Chrome
Extension client type has no secret). `tests/manifest.test.ts` pins the shape of both.

---

## 11. Build and test

```bash
npm run build      # esbuild → dist/, a loadable unpacked extension
npm run watch      # rebuild on change; click Reload on the card
npm test           # 1,915 tests, vitest + linkedom over fixtures
npm run typecheck
npm run preview    # renders the real popup.html with chrome.* stubbed
npm run package    # zip, for testers only
```

The build refuses to copy a static file containing a merge-conflict marker: CSS error
recovery swallows a marker *and the following rule*, which once hid the tab strip behind
the Needs-you screen without any error anywhere.

Two things the suite is built to resist:

- **A test that passes against a wrong implementation is not a test.** Before a behaviour
  is called covered, the source is mutated in a scratch copy and the suite must fail —
  and the mutation's match count is asserted first, because a `sed` that silently patches
  nothing reports a false "survived", which is worse than no mutation test at all.
- **A mutation check proves a test is load-bearing, not that it pins the right
  requirement.** The `state: "ok"` defect survived an otherwise mutation-checked suite
  because a test *asserted* it. When a defect turns up in covered code, look for the test
  that was pinning the bug.

Fixtures are scrubbed real pages (`npm run scrub`), and a scrubbed fixture is **read**
before anything is built on it — a scrub that maps names to markers once inserted its
marker between every character of an empty-string name and redacted nothing, producing a
334KB file and 5,033 copies of one marker while `npm run scrub` reported success.

---

## 12. Invariants

The short form of everything above. These are not style preferences; each one is a defect
class this codebase has actually produced, several of them more than once.

1. **Silent empty is the worst outcome.** A container that exists with rows that stopped
   matching is a redesign, not an empty page — throw. Guard the rows, not just the
   container.
2. **A bad value costs its own field; a missing hook throws.** A `ParseError` escaping a
   row loop discards every other item on the page.
3. **Never index cells positionally.** Anchor on a testid, a class, or the header row.
4. **`typeof x === "string"` is not validation.** `""` passes it; `Date.parse` accepts a
   bare `2026-09-11` and lands it at 7pm the previous day. Validate positively with an
   anchored regex.
5. **Match markers exactly, scoped to the smallest element.** `"not submitted"` contains
   `"submitted"`.
6. **A URL is https on the source origin, or it is the fallback.**
7. **A value this code invented is not a value the source stated.** Mark it, and make
   every precedence rule prefer a stated one.
8. **A green dot means "I fetched, and it was fine".** Anything the UI asserts about a
   source is derived from an attempt that happened.
9. **Every store writer goes through the queue; nothing holds it across a fetch.**
10. **The worker holds no decisions**, because the suite cannot reach it.
11. **Log both branches of any decision the user will have to debug.** "Already seeded,
    all healthy" and "the seed never ran" must not look identical in a console.
12. **The capture beats the spec** — and the amendment gets written down, in
    `docs/<source>-findings.md` and in PROGRESS.md, with the evidence.
13. **When live data falsifies a document, rewrite the claim** rather than annotating it,
    and chase what was inferred from it — those are usually wrong too.

---

## 13. Known open design questions

- **A course split across pages.** An adapter has one fixed URL, and ECE 391 keeps
  assignments on `schedule.html` and exams on `exams.html`, so half such a course can
  never be read. Needs a decision — several adapters per course, or an adapter with
  several URLs — not a patch.
- **Coursera.** Blocked on one observation: whether a Coursera deadline URL carries an
  account or enrolment id. Per-student means a *source* (fixtures, manifest change,
  review); a fixed per-course URL means a registry entry and no build at all.
- **Merge threshold.** §5.3's Jaccard ≥ 0.6 has not been measured against a full semester
  of real data. False merges are visible and one click to split, which is the mitigation,
  not the answer.
- **Store submission.** Draft `mimgaiaicopabbiabakmknkcbfekplei` is not submitted; the
  permission set it was uploaded with is stale, and §9's G5 gate is still behind G4.
