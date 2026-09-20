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

declare const __EXTENSION_VERSION__: string;

/**
 * The version in `public/manifest.json`, injected the same way `BUILD_ID` is.
 *
 * It is what `minExtensionVersion` is compared against (§4.5), so it has to be
 * the number Chrome shows on the card rather than a second copy someone has to
 * remember to bump — a registry entry that needs a field this build does not
 * have must be dropped with a reason, and a gate reading a stale constant would
 * drop the wrong entries or none at all. `tests/manifest.test.ts` pins the two
 * together.
 *
 * The fallback is deliberately `0.0.0` rather than something plausible: a build
 * that lost the define refuses *every* versioned entry loudly instead of
 * silently accepting entries it cannot run.
 */
export const EXTENSION_VERSION: string =
  typeof __EXTENSION_VERSION__ === "string" ? __EXTENSION_VERSION__ : "0.0.0";
