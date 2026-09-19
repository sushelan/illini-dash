/**
 * The post a suggestion or a correction came out of, as a URL.
 *
 * "from a Piazza post" is a sentence about evidence the student cannot read.
 * Sushi, 2026-09-19: "if it says from a piazza or campuswire post, i should be
 * able to get linked to the post." The link is not a new fact — every observed
 * post already carries the site's own identity for it in `ObservedPost.id`,
 * which is the thing `seenPosts` is keyed by — so this is a derivation, not a
 * field to add to the store and backfill.
 *
 * `piazza:<nid>:<nr>` → `https://piazza.com/class/<nid>/post/<nr>`, and
 * `campuswire:<classCode>:<number>` → `https://campuswire.com/c/<code>/feed/<n>`.
 *
 * Three rules from the house list are load-bearing here:
 *
 * - **Rule 7.** The answer is https on the source's own origin or it is
 *   nothing. Both origins are the module constants the observers and the
 *   fetchers use, so there is one spelling of each host, and nothing here
 *   resolves a string against a base.
 * - **Rule 5.** Each shape is matched with an **anchored** regex over the
 *   parts, never `split(":")` plus a truthiness check. A `nid` of `""` would
 *   build `https://piazza.com/class//post/3`, which is a URL, resolves, and
 *   goes nowhere — the silent-wrong-link version of house rule 5's `""`.
 * - **Rule 6.** The prefixes are matched exactly. `paste:` posts and the
 *   `"student"` id that `core/overrides.ts` stamps on the student's own
 *   corrections have no page to open, and they get `undefined` rather than a
 *   guess; a pasted post never existed on a site this extension knows.
 *
 * Pure, and in core, so the link the Alerts tab draws and the link the deadline
 * screen draws are one decision a test can mutate (worker rule 1).
 */

import { CAMPUSWIRE_ORIGIN } from "./campuswire.js";
import { PIAZZA_ORIGIN } from "./piazza.js";

/**
 * `piazza:<nid>:<nr>`, as `core/piazza.ts` builds it.
 *
 * A Piazza network id is a base-36-ish opaque token (`k5p6s9m2d1x`), and the
 * post number is the class-local integer in the URL. Both are bounded: an
 * unbounded `+` here would accept a 4000-character id off a store this build
 * did not write (worker rule 8).
 */
const PIAZZA_ID = /^piazza:([A-Za-z0-9]{1,40}):(\d{1,9})$/;

/**
 * `campuswire:<classCode>:<number>`, as `core/campuswire.ts` builds it.
 *
 * The class code is what `classCodeFromPath` read out of `/c/G794D32E4/feed`,
 * so the character class is that function's, exactly: anything it would have
 * refused cannot appear in an id, and anything it accepted must round-trip.
 */
const CAMPUSWIRE_ID = /^campuswire:([A-Za-z0-9_-]{1,40}):(\d{1,9})$/;

/**
 * The page this post is on, or `undefined` when there is no page to open.
 *
 * `undefined` for a pasted post, for the student's own `"student"` id, for an
 * id from a build that spelled them differently, and for anything that is not
 * a string — every one of those is "there is nothing to link to", which the
 * callers draw as the plain sentence they drew before.
 */
export function postUrl(postId: unknown): string | undefined {
  if (typeof postId !== "string") return undefined;

  const piazza = PIAZZA_ID.exec(postId);
  if (piazza) return `${PIAZZA_ORIGIN}/class/${piazza[1]}/post/${piazza[2]}`;

  const campuswire = CAMPUSWIRE_ID.exec(postId);
  if (campuswire) return `${CAMPUSWIRE_ORIGIN}/c/${campuswire[1]}/feed/${campuswire[2]}`;

  return undefined;
}
