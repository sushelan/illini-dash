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
  **Reload** on the Illini Due card at `chrome://extensions`.

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
