/**
 * Which source a page belongs to.
 *
 * Exists because of the one signal this extension never had: **it only found
 * out about a login by being looked at.** Signing in happens on another origin,
 * in a tab we do not own, and the only thing that ever prompted a re-check was
 * the student coming back to the popup. Sushi, 2026-09-12: *"gradescope and
 * prairietest dont sync until i click on smth in them after signing in"* — the
 * click was not fixing the session, it was producing the return trip that
 * finally made us ask again.
 *
 * Chrome does tell us, through `tabs.onUpdated`, and for these hosts alone: a
 * tab's URL is only readable by an extension that already holds a host
 * permission for it, which is exactly the five sites the student switched on.
 * Nothing here widens what this extension can see.
 */

import { CANVAS_ORIGIN } from "../sources/canvas.js";
import { GRADESCOPE_ORIGIN } from "../sources/gradescope.js";
import { PRAIRIELEARN_ORIGIN } from "../sources/prairielearn.js";
import { PRAIRIETEST_ORIGIN } from "../sources/prairietest.js";
import { SMARTPHYSICS_ORIGIN } from "../sources/smartphysics.js";
import type { Source } from "../sources/types.js";

/** The five hosted sources, by the origin each is read from. */
export const SOURCE_ORIGIN: Record<Exclude<Source, "site">, string> = {
  canvas: CANVAS_ORIGIN,
  gradescope: GRADESCOPE_ORIGIN,
  prairielearn: PRAIRIELEARN_ORIGIN,
  prairietest: PRAIRIETEST_ORIGIN,
  smartphysics: SMARTPHYSICS_ORIGIN,
};

/**
 * The source a URL belongs to, or nothing.
 *
 * Hostnames are compared exactly rather than by suffix. `endsWith` would make
 * `notgradescope.com` and `gradescope.com.evil.test` match — the same class of
 * mistake parser rule 6 names for markers, one layer up: a host is matched in
 * full or not at all.
 *
 * `adapterHosts` are the course websites currently switched on, which cannot be
 * a constant: §4.5's adapters name whatever host their course uses, and the
 * registry can add one without a new build.
 */
export function sourceForUrl(url: string, adapterHosts: readonly string[] = []): Source | undefined {
  let hostname: string;
  try {
    const parsed = new URL(url);
    // http: and everything else is not a page we read, so it is not a page that
    // tells us anything about a session either.
    if (parsed.protocol !== "https:") return undefined;
    hostname = parsed.hostname;
  } catch {
    return undefined;
  }

  for (const [source, origin] of Object.entries(SOURCE_ORIGIN)) {
    if (new URL(origin).hostname === hostname) return source as Source;
  }
  return adapterHosts.includes(hostname) ? "site" : undefined;
}
