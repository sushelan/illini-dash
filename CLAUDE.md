# illini-dash

Chrome extension (MV3) that aggregates UIUC deadlines. Full design in SPEC.md — read it before doing anything.

## Rules
- Follow the build order in SPEC.md §10. Don't skip ahead; don't start a parser before its fixtures exist.
- Gates in §9 are hard stops. If a gate fails, stop and report; don't work around it.
- The decisions in §0 are fixed. If something seems to require changing one, stop and ask.
- Anything marked VERIFY or listed in §12 is an open question. When you hit one, tell me what you need from my browser rather than guessing.
- Parsers are pure functions over a DOM and must have a fixture test before they're wired into the sync loop. Empty results on a page with the expected structure are errors, never [].
- TypeScript, esbuild, vitest + linkedom. No runtime dependencies without asking.
- Keep a short PROGRESS.md: what's done, what gate we're at, what's blocked on me.

## Things I have to do (you can't)
- Load the unpacked extension and report console output.
- Log into the sites and capture fixture HTML.
- Grant permissions and click through UI.
Ask for these explicitly, one at a time, with exact steps.

---

## House rules for parsers

Distilled from 39 defects that four adversarial reviews found in the four source
modules. Several were introduced, fixed, then reintroduced in the next parser, so these
are not style preferences — they are the specific ways this codebase goes wrong. Apply
them **before** asking for a review, so reviews find new classes instead of these.

`src/core/parsing.ts` implements most of them. Use it rather than rewriting them.

1. **A bad value costs its own field. A missing hook throws.** A `ParseError` escaping a
   row loop discards every other item on the page — every assignment in a course, or on
   a single-page source, the whole source. If the element or attribute is *gone*, the
   page shape changed: throw. If the hook is there and the *value* is unreadable: record
   it in `extra.unparsed*`, warn, keep the row. (`parseField`. Found 3×.)
2. **Silent empty is the worst outcome.** If a container exists and its rows stopped
   matching, that is a redesign, not an empty page — throw. Guarding the container alone
   is not enough; guard the rows too. (Found 2×.)
3. **Never index cells positionally.** Anchor on a `data-testid`, a class, or the
   table's own header row. `cells[2]` turns one added column into a page of undated,
   mis-statused items with no error. (Found 1×, cost: 14 items.)
4. **Every parser guards against duplicate `sourceId`s on one page.** §3's `raw` is keyed
   by memberKey, so a collision silently merges two items into one. (`KeyGuard`. Found 3×.)
5. **`typeof x === "string"` is not validation.** `""` passes it and shadows the fallback
   behind it. `Date.parse` accepts naive local times and bare dates — a bare `2026-09-11`
   lands at 7pm the previous day here. `Number("")` is `0`. Validate the shape positively
   with an anchored regex. (`isInstant`, `nonEmpty`. Found 4×.)
6. **Match markers exactly, not by substring, and scope them to the smallest element.**
   `"not submitted"` contains `"submitted"`; an exam title containing an empty-state
   sentence blanked its whole card. (Found 2×.)
7. **`RawItem.url` is https on the source origin or it is the fallback.** Resolving
   against a base silently accepts `//other.host`, `javascript:` and `http:`, and throws
   on a malformed href. (`sameOriginHttpsUrl`. Found 3×.)
8. **Login detection needs the HTTP status.** An expired session on an API path does not
   redirect and does not return HTML — it returns 401 with JSON at the unchanged URL.
   Without the status that reads as "logged in" and the parser then reports
   `parse_error` instead of `needs_login`, which is §0 rule 2's whole point.
   (`looksLoggedOut`. Found 2×.)
9. **The capture beats the spec.** Where real markup contradicts SPEC.md, the capture
   wins — but write the amendment down in `docs/<source>-findings.md` and in
   PROGRESS.md's amendments list, with the evidence. Six such amendments exist already.
10. **A test that passes against a wrong implementation is not a test.** Before calling a
    behaviour covered, mutate the source in a scratch copy and confirm the suite fails.
    Realistic fixture values often make a wrong implementation indistinguishable from a
    right one; where that happens, make a fixture row deliberately unrealistic and say so
    in the fixture's README.
11. **"Never signed in" is not "session expired", and both are `needs_login`.** §4.2 and
    §4.4 were written for an expiry, which redirects or answers 401. A student who has
    never signed in gets **200 at the unchanged URL** with an ordinary title — Gradescope
    serves its marketing splash, PrairieTest serves a page with no exam cards — so the
    parser runs, finds nothing, and throws. That is `parse_error`, which means "the page
    changed, go fix the selectors" and offers nothing to click, in the one case where
    signing in is the entire fix. Every hosted source needs a *positive* signed-out marker.
    (Found 2×, on a real beta build.)
12. **A marker must be absent from the healthy page, and the fixtures usually cannot show
    it.** A signed-out marker that also matches a signed-in page turns every successful
    sync into `needs_login` and freezes the list at whatever it last held — silently, which
    is worse than the bug it was added to fix. `"Log In"` is not safe: an assignment called
    *Log Interpretation* contains it. Anchor on a class hook or a path, and since both the
    loose and the correct marker are absent from a real capture, make one deliberately
    adversarial (rule 10's case, in its most dangerous form).
13. **A per-student URL means a source, not a §4.5 adapter.** An adapter has one fixed
    `url`, so anything addressed by an enrolment or account id — smartPhysics's
    `/Course?enrollmentID=…` — cannot be served by one. Check the URL shape before writing
    selectors; it decides whether the answer is a JSON entry or a two-stage fetch plan.
14. **Read a scrubbed fixture before building on it.** A scrub that maps names to
    markers will, the moment one name is the empty string, insert its marker *between
    every character* and redact nothing — `feed.json` came back with 5,033 copies of
    `STAFF-36` and the guest lecturer's name intact underneath, and `class-page.html`
    grew to 334KB the same way. `npm run scrub` passed both. A fixture in that state is
    worse than none: every assertion about what a parser reads is made against text no
    parser will see. Word-bound and length-gate every replacement, then open the file
    and read a subject line. (Found 2×, on one day.)

## House rules for the worker and the loop

The parser rules above came from reviewing parsers. These came from the first sync that
ran end to end on live data, which found four defects in a day — three of them in
`background.ts`, with 382 tests passing throughout. They are a different class: nothing
here is a parsing mistake, and no fixture could have caught any of it.

1. **The service worker is the file the suite cannot reach, so keep it empty.** Every
   defect below lived in `background.ts` because that is the only place a decision was
   unreachable by a test. Anything with a *decision* in it belongs in `core/`, where it
   can be pinned and mutated; the worker should be `chrome.*` calls and wiring. When a
   defect is found there, the fix includes moving the logic out — `core/queue.ts` exists
   because a deadlock hid in the worker for four steps.
2. **A green dot must mean "I fetched, and it was fine" — never "I did not fetch".** A
   source that is off, unconfigured, or resting reports *that*. `syncSites` returned `[]`
   with no adapters enabled, the loop recorded `ok`, and the UI showed a healthy source
   fetching nothing. This is house rule 2 one level up: silent empty is the worst outcome
   at the source level too, and it cost a real user two rounds of "why don't I see any
   rows".

   Three more of these turned up in one pass, so the rule generalises past the dot:
   `defaultStatus` seeded `state: "ok"` before any request, so a cold install showed four
   green dots under the words "Not synced yet"; `set-source-enabled` painted `ok` on a
   source the user had merely switched on; and the status line read `Synced 10:32` off
   `lastSyncAt`, which the loop sets whether or not anything succeeded. **Anything the UI
   asserts about a source must be derived from an attempt that happened.** `pending` is a
   real state, `core/health.ts` owns the derivation, and it is re-derived from
   `lastAttemptAt` rather than trusted from disk so an old store cannot claim success.

   The same rule decides *which* failure to report. `syncSites` threw `ParseError` whenever
   every adapter failed, so a `TypeError: Failed to fetch` was announced as "the page
   changed" — sending someone to debug selectors that were fine. §6 has two branches for a
   reason; classify before you report.
3. **A value this code invented is not a value the source stated.** §4.5's runner fills
   in 23:59 when a course page prints a bare date; §5.3 then ranked that invention above
   a real Canvas deadline, because the ranks assume every instant is stated. Mark what was
   assumed (`extra.timeAssumed`) and make every precedence rule prefer a stated value.
   The general form: whenever a default is filled in, ask what downstream code will treat
   it as authoritative.
4. **Every store writer goes through the queue, and the queue is re-entrant.** A writer
   that bypasses it loses whatever the user just clicked — a sync holds the queue across
   all of its fetches, so an unqueued write is read and then overwritten seconds later,
   with no error and a control that springs back. A queue that is *not* re-entrant
   deadlocks the moment one queued path calls another (`sync` → `reschedule` →
   `fireNotification`), and it deadlocks permanently.
5. **Log both branches of any decision the user will have to debug.** A silent early
   return in the registry seed made "already seeded, all healthy" and "the seed never ran"
   identical in the console. That ambiguity cost two rounds of the user's time in the
   browser, which is the most expensive resource in this project (see the section below).
6. **A mutation check proves a test is load-bearing, not that it pins the right
   requirement.** The `state: "ok"` defect in rule 2 survived an otherwise
   mutation-checked suite because a test *asserted* it. When a defect turns up in covered
   code, look for the test that was pinning the bug — and when writing a test from a spec
   line, quote the line.
7. **Live data is a source of truth the fixtures are not.** Four defects came from one
   real sync; three of the four could not exist in a fixture test, because they need two
   sources, or a queue, or a browser. When something finally runs for real, read the
   output as evidence rather than as confirmation.
8. **A message from the worker is data from another build, not a typed object.**
   Chrome reloads an extension page from disk on every open but keeps the running
   service worker until the extension is reloaded, so the two routinely disagree about
   what a message contains. An options page that had gained `setAsideCourses` asked an
   older worker for `options-state`, read `.length` on it, and threw — after drawing four
   sections and before drawing five, with nothing in the UI to say that one click on
   chrome://extensions was the fix. This is parser rule 5 one process over: `Response` is
   a compile-time claim about the *sender's* build. Normalize every field a page
   dereferences (`core/compat.ts`), name the missing ones on screen, and never let a
   render function reject into a console the user does not have open.

9. **A bounded pool inside a bounded pool multiplies.** Four classes polled four-wide,
   each fetching bodies four-wide, is sixteen requests in flight at piazza.com while
   `MAX_CONCURRENT_PER_HOST` says four. Per-host concurrency is one flat pool across
   everything that sync fetches from that host, or the constant is a lie.

## House rules for mutation checks

Parser rule 10 says to mutate before calling a behaviour covered. Doing that across ~60
mutations in one day taught three things about the *procedure* itself.

1. **Verify the mutation applied.** Twice, a `sed` reported "survived" when it had never
   patched anything — once the pattern omitted an optional-chaining dot
   (`item.extra?.["k"]` vs `item.extra?["k"]`), once the leading whitespace was wrong.
   Both mutations, applied properly, failed instantly. A false "survived" is worse than no
   mutation test: it says a behaviour is unpinned when it is pinned, and the natural
   response is to write a redundant test or delete a live guard. Always assert the match
   count first:

   ```python
   assert s.count(old) == 1, f"count={s.count(old)}"
   ```

2. **A survivor has three possible meanings; decide which before acting.**
   - *Untested* — the common case. Write the test. Six of today's survivors were this, and
     every one was a behaviour a student would notice first.
   - *Unreachable* — the mutation cannot be triggered by any input the code accepts. With
     two lead times a third lead cannot exist, so `collapseOverdue`'s "leave a future lead
     alone" clause is unexercised. Keep it, and say in a comment that it is unreachable
     today and why it stays.
   - *Redundant* — a second guard rejects exactly what the first does. `isRealWallClock`
     before `wallClockToIso`, which already throws the same error for the same inputs.
     **Delete it.** An unreachable branch that duplicates a reachable one is not defence,
     it is a second thing to read.

3. **A survivor sometimes indicts the design, not the suite.** `cellByHeader` and
   `headerExists` each wrote out the header-matching rule, so loosening one was masked by
   the other staying strict, and no test could reach it. The fix was not a cleverer test —
   it was one `resolveColumn` used by both. When a mutation cannot be reached because
   another copy of the same decision compensates, that is the finding.

4. **A survivor can mean the adversarial input never reached the line.** The grounding
   marker's "survived" was a test string whose quotes had been escaped, so the loosened
   regex could not have matched it whatever the code did. Before reading a survivor as
   untested, unreachable or redundant, confirm the input actually exercises the mutated
   line — a fixture that defeats itself looks exactly like a gap in the suite.

## House rules for the on-device model

One so far, from the first live run of the adapter author (2026-09-18).

1. **An example value in a prompt is a value the model may return.** `buildPrompt` showed
   `"#schedule .event"` as its example row selector, for another course; on ECE 411 the
   model returned it three times, the runner rejected it three times, and the retry told
   it only that nothing matched. If a field has a closed set of right answers derivable
   from the input, derive it (`repeatedStructures`), put it in the prompt, and enumerate
   it in the response schema; make every remaining example a placeholder. And before a
   model's answer costs a round trip, check it against the input with the cheapest thing
   that can refuse it (`groundProposal`) — with a refusal that names what the input *does*
   contain, or the retry has nowhere to go.

## When live data contradicts a document

`docs/canvas-findings.md` said Canvas "contributes zero deadlines for this account, and
cannot contribute any". A live sync returned one. The first fix appended a "superseded"
note under the sentence, and Sushi rejected it: that leaves the false claim as the thing a
reader sees first and buries the correction.

**Rewrite the claim, and ask whether it was wrong when written rather than only whether it
is stale now.** It was: the evidence was 67 undated assignments on one day, which supports
"none of these is dated today" and nothing about whether an instructor will set a date.

Then **follow what was inferred from it**, because those are usually wrong too. Two were,
and both were load-bearing: G2's "Canvas contributing 0 is a pass" exemption, and G1's
"no non-empty planner fixture is obtainable" — which had quietly left `parsePlannerItems`
the only parser in the project never checked against a real response.

## The popup is measured by Chrome, not sized by you

`body { max-height: 600px; overflow-y: auto }` looked like a faithful reading of
§8.1's "max height 600px". It is what made the popup open at **800x600 with the
400px list in its left half**.

Chrome sizes an extension popup by measuring the document's intrinsic box. Making
`body` its own scroll container leaves the document with no intrinsic height to
measure, so Chrome falls back to its maximum. The width was being honoured the whole
time — inside a window that had no reason to be that wide. Chrome already caps a popup
at 600 tall and scrolls it itself, so §8.1's cap is satisfied by writing nothing, and
the width belongs on `html` as well as `body` because `html` is the box being measured.

Two things follow for any future popup CSS:

- **Never make `body` or `html` a scroll container in the popup**, and be suspicious of
  any percentage or viewport unit on either — they all take away the thing Chrome needs
  to measure.
- **A layout rule keyed on window width can feed itself.** Chrome lays the document out
  to decide the width, so `@media (min-width: …)` that changes the layout can measure
  wide, restyle wider and open wider. The full view keys off a marker the page sets from
  its own URL instead.

It also took Sushi telling me three times. The first two answers reasoned from a preview
harness that wrapped the list in a fixed-width `<div>` — which cannot reproduce a
`body`-level sizing bug by construction. `npm run preview` now also emits
`preview-popup.html`, the real `popup.html` with only `chrome.*` stubbed. **When the
symptom is about the window, the harness has to be the real document.**

## Check it in the mode Sushi actually uses

Sushi's machine is dark. Every screenshot taken to verify a colour change was
light, so the one person who had to be convinced was looking at something nobody had
looked at — "u didnt rly change anything at all" arrived about a build that had, in a
mode he never sees.

**Two things follow, and the second is the one worth remembering.**

Dark mode is the default for verification, not the afterthought. `resize_window` takes a
`colorScheme`, so there is no excuse.

And a tint does *different work at each end of the range*. A wash composites toward its
own luminance, so the same alpha is not the same change: 5.5% of navy on white drops the
surface 12 points out of 255, while 6% of pale blue on `#1c1c1c` lifted it 8 — and the eye
is far less sensitive to lightening near-black than to darkening white. The dark tints are
roughly double the light ones, and that is arithmetic rather than taste. **Measure the
composited luminance rather than trusting the alpha**, which is one line in the console:

```js
getComputedStyle(el).backgroundColor  // then composite it against the body yourself
```

## House rules for the UI, and for diagnosing it

From a day of live beta reports. Every one of these cost several round trips of
Sushi's time, which is the resource this project has least of.

1. **A popup and the service worker have different consoles, and neither shows the
   other's output.** Five rounds of "nothing shows up in the console" were spent on the
   `background.js` inspector, which structurally cannot contain a page's errors. Say
   *which* console when asking, and prefer the full view: it is an ordinary tab with
   ordinary devtools, where a popup needs right-click → Inspect popup.

2. **Every `send()` from a page needs a `.catch`.** Four correction handlers were written
   as `void send(…).then(…)` with none, so a rejection became an unhandled promise
   rejection — invisible in the UI *and* in the worker's console. `send` rejects with the
   one message that explains the commonest cause ("the worker is running older code than
   this page"), so swallowing it hides exactly the sentence that would have ended the
   investigation.

3. **A status line at the bottom of the document is not a channel.** `#status` sits below
   ~1100px of week view in a 600px window. Every failure it reported for a month landed
   below the fold. If a surface reports errors, the report has to be reachable from where
   the error happened.

4. **When a control does something asynchronous, say so on the control.** "Hide" becoming
   "Applying…" is feedback *and* a diagnostic: it distinguishes "the click never ran" from
   "the click ran and the round trip failed" with no console at all. That one change
   produced more information than four builds of logging.

5. **A synthetic `.click()` is not a press.** It fires no `pointerdown`, no `mousedown`, no
   focus change, and no default action. Every harness check of the row menu passed while
   the real menu was unusable. Where a defect is about *pressing* something, a JS-driven
   click proves nothing.

6. **And the preview pane's coordinates are not the page's.** Driving real mouse events at
   it produced "the menu never opens" — because the click landed in dead space. That was
   nearly reported as a finding. If a click-driven result is surprising, verify the click
   landed before believing the result.

7. **A class selector matches whole tokens.** Three redraw guards asked for `.menu` while
   the element's class was `menu-surface`; all three were dead from the day they were
   written, so any store write or minute tick deleted an open menu. Route a selector and
   the class it matches through **one constant** — a test has to know the right answer, a
   shared constant makes the wrong answer unspellable.

8. **Height is the popup's recurring bug, in different costumes.** A menu opening below the
   fold, a floating panel contributing no height for Chrome to measure, a status line out
   of sight, the sources panel clipped — all the same 600px ceiling. When something in the
   popup "does not work", measure where it is before reading what it does.

---

## HANDOFF — 2026-09-13, updated 2026-09-18

### The row menu bug — found and fixed 2026-09-18

**Cause.** `trapMenuKeys` decided "is focus still inside the menu?" inside a
`queueMicrotask` queued from `focusout`. A real mousedown on a menu item moves focus from
item 0 (focused by `focusAt(0)` the instant the menu opens) to the pressed button, and
Blink fires `focusout` *before* it updates `document.activeElement`. A microtask runs in
exactly that gap, saw `<body>`, and removed the menu between mousedown and mouseup; no
mouseup on the same element means no `click`, so the handler never ran and nothing
reached the worker. The probe's "waiting for a press…" was a menu re-opened afterwards.
The health popover shares the code and always worked because it has no `.menu-item` for
`focusAt` to focus; Enter worked because focus never left. A synthetic `.click()` and a
programmatic `blur()` cannot produce the sequence, which is why every harness passed
(UI rule 5) and why the ruled-out table above was right about everything it ruled out.

**Rule.** Never decide anything about focus inside a microtask queued from a focus event.
Read `event.relatedTarget` (the element gaining focus, known during the event); if it is
null, wait one *task*, not a microtask.

Two more defects sat on the same path and are fixed with it: the popup's own open-sync
called `refresh()` with no menu guard (three callers guarded, three did not), and the
capture-phase `scroll` listener on `window` closed a menu that was scrolling itself.
Redraws that find a menu open are now **deferred, not skipped**, and run when it closes;
`closeMenus` clears `aria-expanded`; the probe is gone. Verified with real pointer events
in the preview document (Hide and a Merge candidate both reach their handlers and log
`… requested for …`), and confirmed by Sushi in the real popup the same evening.

### Also open

- **Course sites split across pages.** An adapter is one fixed URL, and a course keeps
  assignments on one page and exams on another (ECE 391: `schedule.html` and `exams.html`).
  Half of such a course can never be read. Needs a decision — several adapters per course,
  or an adapter with several URLs — not a patch.
- **Coursera**, for the online CS courses. Blocked on one observation only Sushi can make:
  whether a Coursera deadline URL carries an account or enrolment id. Per-student means a
  source (a day's work, fixtures, a manifest change, a new review); a fixed per-course URL
  means a registry entry and no build at all. House rule 13.
- **A course with no derivable code** still shows its raw name. The rename tool covers it;
  nothing else is needed unless it turns out to be common.

### The store submission

Draft `mimgaiaicopabbiabakmknkcbfekplei`, **not submitted**. Everything needed is written
down: listing copy in `docs/store/listing.md`, the description in
`docs/store/description.txt` (plain text — the field renders no Markdown), every
privacy-form answer in `docs/store/privacy-practices.txt` — **eleven blocks now, not nine**
(`identity` and `cookies` joined on 2026-09-18), each measured against its 1000-character limit by
`tests/manifest.test.ts` — and the reviewer's Test instructions drafted in
`docs/store/test-instructions.txt` around the public ECE 411 page (a reviewer has no UIUC
account; Sushi to approve the wording). The privacy policy is live and generated from
`docs/store/privacy-policy.md` by `npm run site`; it was rewritten on 2026-09-18 for the
Campuswire observer (a content script, opt-in), Piazza (own session, opt-in), and Google
Calendar (an export to the student's own account, opt-in).

The permission set the draft was uploaded with is stale. Since then: `scripting` (the
Campuswire observer), `identity` + an `oauth2` block with the single non-sensitive
`calendar.app.created` scope, `www.googleapis.com` as a runtime host, `cookies` (Piazza), and `campuswire.com` / `piazza.com` as opt-in origins. The certification "no
selling or transferring — there is no transfer at all" is no longer true as written: the
one transfer is user-directed, to the student's own Google account, and the form answer
says so.

Outstanding, all in the developer console: re-upload the current zip, replace every
justification from `privacy-practices.txt` (all eleven), tick **Website content** and nothing
else under Data usage, paste the Test instructions (500 chars), set Visibility to
**Unlisted**, submit. Before that, `public/manifest.json` needs the real `key` (Package
tab → View public key) and the OAuth `client_id` (`docs/gcal.md`); a test currently
asserts `key` is absent as a tripwire and must flip to "is base64" when it is pasted.

§9 still gates G5 behind G4. The beta has one tester and found six real defects in a day,
which is the argument for the gate rather than against it.

### Development loop

`dist/` is a loadable unpacked extension. Load it once from `chrome://extensions`, then
`npm run build` (or `npm run watch`) and click reload on the card — no zip, no unzip. Zips
are only for sending to testers.

## Review policy

Full adversarial review is expensive (~20 min, ~1.5M tokens) and its yield is falling now
that the house rules above are written down. So:

- **Full review** — `core/dedupe.ts` and the sync loop (steps 7–8). That is where G2 and
  G3 risk lives and where a defect is hardest to see by hand.
- **Light or no review** — behaviour-preserving refactors, UI, and anything the existing
  1742-test suite already pins by mutation. Rely on the suite; it has been mutation-tested.
- Any review prompt should include the house rules above and be told to hunt for
  *new* classes.
- When a review's refuters fail (API errors), findings that could not be judged are
  **unverified, not refuted** — surface them separately and verify by hand.

**Trace the path, not just the file.** Reviewing `background.ts` as a file had found
nothing in four steps. Fanning agents out over *segments of one runtime path* — bundle →
storage → options UI → permission → sync → offscreen → popup, one agent each, each asked
how its segment could produce the observed symptom — found the deadlock, the unqueued
writer and the repeating failed fetch in a single pass. Use this shape whenever a symptom
is real but no test reproduces it: the unit of work is a hop in a chain, not a module.

Findings from a trace are **leads, not results**. Refuters killed several of these before
they reached Sushi, and of the survivors two needed correcting when I read the source
myself. Verify every one against the code before acting or reporting.

## Parallelism

- **Steps 7–8 stay sequential.** One tightly coupled core; splitting it produces
  inconsistent merge semantics, and every spec ambiguity there needs one decision from
  Sushi, not three.
- **Steps 9–12 ran in parallel** and that worked — notifications, options/overrides UI,
  adapter runner + registry, and broken-page report + store assets are genuinely
  independent and touch different files.
- More coder agents do not fix a defect class that keeps recurring; shared helpers and
  the house rules above do. Extract before parallelising.
- The highest-yield fan-out so far was not coding at all — it was the path trace above.
  Parallelise *investigation* of one symptom across independent segments more readily
  than implementation across features.

## Sushi's time is the scarce resource

Every browser round-trip — load, log in, capture, tick, read the console — is a real
interruption, and several were spent on ambiguity I could have removed for free. So:

- Ask for **one** browser action at a time, with exact steps and the literal output to
  look for, and say what each possible answer would prove. A question whose answers all
  lead to the same next step is not worth asking.
- Before asking, exhaust what the repo can answer: read `dist/`, run the adapter over the
  fixture, check the built bundle actually contains the code in question.
- Prefer a diagnostic that distinguishes several hypotheses at once over a yes/no.
- When a round-trip is spent on something a log line would have answered, add the log
  line (worker rule 5) — do not just apologise for the round-trip.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
