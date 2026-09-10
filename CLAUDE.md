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
