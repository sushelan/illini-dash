# illini-due

Chrome extension (MV3) that aggregates UIUC deadlines. Design: [SPEC.md](SPEC.md).

## Develop

```
npm install
npm run build      # -> dist/
npm run watch      # rebuild on change
npm run typecheck
npm test
```

Load `dist/` as an unpacked extension (see below). After `npm run build`, hit the
reload icon on the extension card in `chrome://extensions`.

After ticking a course site in Options, Chrome prompts for that host — the adapter only
runs once the permission is actually held.

## Layout

- `src/background.ts` — service worker: `chrome.*` wiring only. Decisions belong in
  `core/`, which is the half the test suite can reach.
- `src/core/` — everything with a decision in it: `sync` (§6 loop), `dedupe` (§5.3/5.4),
  `store` + `queue` (§3), `schedule` (§7), `registry` (§4.5 trust boundary), `dates`,
  `normalize`, `parsing` (shared parser primitives), `ics` (§8.3), `overrides` (§8.1)
- `src/sources/` — one pure parser per source, plus `site.ts`, §4.5's declarative runner
- `src/ui/` — popup, options, and the capture/debug page
- `adapters/registry.json` — course-site adapter registry, bundled and seeded on install,
  refreshed daily from GitHub (see [docs/adapters.md](docs/adapters.md))
- `fixtures/`, `tests/` — real captured pages and the tests driven by them
- `PROGRESS.md` — what's done, which gate we're at, what's blocked
- `CLAUDE.md` — house rules, distilled from the defects that actually happened
