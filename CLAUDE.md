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

## Review policy

Full adversarial review is expensive (~20 min, ~1.5M tokens) and its yield is falling now
that the house rules above are written down. So:

- **Full review** — `core/dedupe.ts` and the sync loop (steps 7–8). That is where G2 and
  G3 risk lives and where a defect is hardest to see by hand.
- **Light or no review** — behaviour-preserving refactors, UI, and anything the existing
  186-test suite already pins by mutation. Rely on the suite; it has been mutation-tested.
- Any review prompt should include the house rules above and be told to hunt for
  *new* classes.
- When a review's refuters fail (API errors), findings that could not be judged are
  **unverified, not refuted** — surface them separately and verify by hand.

## Parallelism

- **Steps 7–8 stay sequential.** One tightly coupled core; splitting it produces
  inconsistent merge semantics, and every spec ambiguity there needs one decision from
  Sushi, not three.
- **Steps 9–12 can run in parallel** — notifications, options/overrides UI, adapter
  runner + registry, and broken-page report + store assets are genuinely independent and
  touch different files.
- More coder agents do not fix a defect class that keeps recurring; shared helpers and
  the house rules above do. Extract before parallelising.
