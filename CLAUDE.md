# illini-due

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

## Review policy

Full adversarial review is expensive (~20 min, ~1.5M tokens) and its yield is falling now
that the house rules above are written down. So:

- **Full review** — `core/dedupe.ts` and the sync loop (steps 7–8). That is where G2 and
  G3 risk lives and where a defect is hardest to see by hand.
- **Light or no review** — behaviour-preserving refactors, UI, and anything the existing
  388-test suite already pins by mutation. Rely on the suite; it has been mutation-tested.
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
