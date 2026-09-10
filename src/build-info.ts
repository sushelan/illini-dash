/**
 * Build identity, injected by esbuild (see build.mjs).
 *
 * Chrome re-reads extension *pages* from disk every time they open, but keeps the
 * registered *service worker* until the extension is reloaded. So a rebuilt popup
 * can end up talking to a worker built from older source, and the symptom is a
 * message type the worker has never heard of. Both sides report this id so that
 * mismatch is visible instead of mysterious.
 */

declare const __BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
