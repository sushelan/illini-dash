# Dev loop gotchas

## Reload the extension after every build

Chrome re-reads extension **pages** (popup.html, options.html and their bundles)
from disk each time they open, but keeps the registered **service worker** until
the extension is reloaded. After `npm run build` you can therefore be looking at a
brand-new options page that is talking to a worker built from older source. The
symptom is a message type the worker has never heard of, which it silently declines,
which reaches the page as `undefined`.

Every bundle is stamped with a build id (`build.mjs` injects `__BUILD_ID__`). The
popup and the options page ping the worker on load and compare ids:

- `Service worker alive, build 20260903T052059.` — page and worker agree.
- `STALE SERVICE WORKER: this page is build A, the worker is build B.` — hit
  **Reload** on the Illini Dash card at `chrome://extensions`.

Build ids are UTC timestamps, so they will not match your wall clock. They are
only meant to be compared with each other.

## The two silences

Both of these used to look identical from the UI, and neither said anything useful:

| What happened | What `sendMessage` does |
|---|---|
| No listener anywhere (worker failed to start) | promise **rejects**, "Could not establish connection" |
| A listener saw the message and declined it without responding | promise **resolves `undefined`** |

`send()` in `src/messages.ts` now turns the second case into a named error, and the
worker answers unrecognized message types with an explicit `error` response instead
of falling through to `return false`. A worker built from current source can no
longer go quiet on a message; only a stale one can, and the build-id banner catches
that.

## Project skills (`.claude/skills/`)

Six procedures this repo kept re-deriving from CLAUDE.md are now Claude Code project
skills, each grounded in the text it came from: **mutation-check** (the scratch copy, the
`assert s.count(old) == 1` before running, and the untested / unreachable / redundant
classification of a survivor), **capture-ask** (how to ask Sushi for *one* browser action —
exact steps, the literal output to look for, what each answer proves, which console, and
the options-page capture tool with its scrub step), **new-adapter** (a captured course page
to an `adapters/registry.json` entry: the schema and what `registry.ts` refuses, the three
page shapes, the closed date grammar, the fixture test, and the daily-refresh delivery
loop), **trace-symptom** (fanning agents over segments of one runtime path — bundle →
storage → options UI → permission → sync → offscreen → popup — when a symptom is real but
no test reproduces it, and treating the findings as leads), **beta-triage** (a tester's
message to a fix: quote it verbatim, separate symptom from cause, check whether the
fixtures can reach the state at all, add the log line that would have answered it, and the
dated PROGRESS entry shape), and **popup-verify** (`npm run preview` →
`dist/preview-popup.html` served statically, dark mode first, never a framed harness, real
pointer events, the query switches, and measuring against the 600px ceiling). Each loads on
its own when a request matches its description; `/mutation-check` and friends invoke one by
name.

## Two tools Sushi may want installed

**Graphify** — a knowledge graph over the repo, so a question about the codebase can be
answered without reading it all again:

```bash
uv tool install graphifyy
graphify install --project        # from the repo root
graphify query "where is the adapter date grammar decided?"
```

The graph lives in `graphify-out/` (excluded from version control). Once it exists, a
natural-language question about this codebase should be run as a `graphify query` first.

**Ponytail** — vendored at `.claude/skills/ponytail/SKILL.md`, invoked with `/ponytail`.
It forces the laziest solution that actually works: question whether the task needs to
exist at all, standard library before custom code, one line before fifty. It is
**subordinate to CLAUDE.md** — where it would argue away a guard the house rules require (a
loud parser failure, a `KeyGuard`, a positive signed-out marker), CLAUDE.md wins.
