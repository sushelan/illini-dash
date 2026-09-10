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

## Layout

- `src/background.ts` — service worker (no-op so far)
- `src/gate0.ts` — Gate 0 auth-fetch spike (§9 G0)
- `src/sources/types.ts` — data model (§3)
- `src/ui/` — popup and options/debug pages
- `adapters/registry.json` — course-site adapter registry (empty for now)
- `fixtures/`, `tests/` — parser fixtures and tests
