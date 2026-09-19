/**
 * Where the window is scrolled to after a redraw — decided here, applied by
 * the draw.
 *
 * **The defect** (Sushi, 2026-09-19): "clicking a button shifts the location in
 * the popup/full screen page, like hiding a button brings the screen back up to
 * the top after i already scrolled down midway." Scroll halfway down the list,
 * press a row's ⋯ › Hide, and the row goes — along with your place. Every one of
 * the eight redraws nobody asked for did it too: the open-sync about two seconds
 * after the popup opens, a store write, the worker's syncing flag, the minute
 * tick, a return to a hidden tab.
 *
 * **The mechanism.** `render` calls `viewEl.replaceChildren()`. For the moment
 * between that and the re-append the document has no height, so the browser
 * clamps the scroll offset to 0, and nothing in `src/ui/` ever put it back —
 * `grep -rn "scrollTop\|scrollY\|scrollTo" src/ui/` returned exactly one hit
 * before this file, the `preventScroll` on a focus call.
 *
 * This is the same shape as the focus request of the same day (`focus.ts`), and
 * it is fixed the same way, for the same reason: a redraw can be **deferred** —
 * `createPressHold` holds the draw off by a task while a mouse button is down
 * inside the list — so anything chained onto `refresh()` runs against the old
 * document. The offset is read *before* the replace, by the draw that is about
 * to do the replacing, and written back by that same draw. A held draw reads
 * and writes nothing; the deferred one that actually rebuilds does both.
 *
 * **When it restores, and when it must not.** The rule is one sentence: *a
 * redraw keeps your place; a navigation starts at the top; coming back from a
 * screen returns you to where you left.* Three cases, and only the third needs
 * anything remembered:
 *
 *   - **The same place, drawn again** — Hide, a tick, a sync, the minute tick,
 *     a store write, stepping a course filter. Keep the offset. This is the
 *     reported defect and it is the overwhelmingly common case.
 *   - **A different place** — another tab, the next week, the next month, or a
 *     screen opening in front of the list. New content, so the top. Restoring
 *     an offset here would drop a student into the middle of a list they have
 *     not seen, which is the bug this fix would otherwise introduce.
 *   - **The place we most recently left for a screen** — ‹ back from a deadline
 *     or an editor. The one thing worth remembering, because the row that was
 *     pressed is at that offset and `focus.ts` is about to put focus on it.
 *
 * A place is the *tab and the day it is anchored on*, so Week's › is a new
 * place (a different seven days is different content, exactly like a different
 * tab) while Hide is not. Returning to a tab visited earlier is **not** a
 * remembered place — one slot, cleared by anything but the screen round trip —
 * because a tab pressed on the strip is a navigation whatever you did there
 * ten minutes ago.
 *
 * Pure, and DOM-free: everything here takes the numbers it reads. The entry
 * owns the two lines that touch `document.scrollingElement`, so a linkedom test
 * can pin every branch of the decision without a browser (worker house rule 1).
 */

import type { ViewName } from "../../core/calendar.js";

/**
 * What the student is looking at, for the purpose of "is this the same thing
 * drawn again, or somewhere else?".
 *
 * `screen` is a sub-screen's identity — `state.screen`'s kind and item id — and
 * `undefined` when the list itself is showing. `dayOffset` is in here because
 * Week's ‹ › and Month's ‹ › change the content without changing the tab, and
 * a student who steps forward a week wants its top and not the middle.
 */
export interface Place {
  view: ViewName;
  dayOffset: number;
  screen: string | undefined;
}

/** One remembered offset: the place it belongs to, and how far down it was. */
export interface ScrollMemory {
  key: string;
  y: number;
}

/**
 * A place as one comparable string.
 *
 * The prefix is load-bearing rather than decoration: `scrollPlan` asks whether
 * it is *entering* a screen, and encoding that in the key keeps the two answers
 * — "is this the same place?" and "is this a screen?" — derived from one value
 * instead of from two that could disagree.
 */
export function placeKey(place: Place): string {
  return place.screen === undefined
    ? `list:${place.view}:${place.dayOffset}`
    : `screen:${place.screen}`;
}

/**
 * The offset the next draw should land on, and what to remember for later.
 *
 * @param previous the place the last draw rendered, or `undefined` on the first
 *   draw of the document.
 * @param next the place this draw is about to render.
 * @param y the offset read from the scroller *before* anything was replaced.
 * @param memory the one remembered offset, from the last call.
 */
export function scrollPlan(
  previous: Place | undefined,
  next: Place,
  y: number,
  memory: ScrollMemory | undefined,
): { y: number; memory: ScrollMemory | undefined } {
  const nextKey = placeKey(next);
  const previousKey = previous ? placeKey(previous) : undefined;

  // The same place, drawn again: the reported defect. Keep the offset.
  if (previousKey === nextKey) return { y, memory };

  // Back from the screen we left this place for.
  if (memory?.key === nextKey) return { y: memory.y, memory: undefined };

  /*
   * Somewhere else: the top, and remember where we were only if a screen is
   * what we are opening. `previous.screen === undefined` so that a screen
   * opened *from another screen* cannot overwrite the list's offset with a
   * screen's — the list is what ‹ back eventually returns to.
   */
  const leavingListForScreen =
    previousKey !== undefined && previous?.screen === undefined && next.screen !== undefined;
  return { y: 0, memory: leavingListForScreen ? { key: previousKey, y } : undefined };
}

/**
 * The offset, held inside what the document can actually be scrolled to.
 *
 * Hiding a row makes the list shorter, so the offset a draw remembered may be
 * past the end of the document it is being applied to — and the answer must be
 * the bottom of the new list, never a blank viewport and never a throw. A
 * browser clamps an out-of-range `scrollTop` assignment itself; this is here so
 * the decision is one a test can reach rather than one only Chrome knows, and
 * so a scroller that reports nothing useful (linkedom lays nothing out, and a
 * document mid-teardown can answer `NaN`) lands at the top instead of throwing.
 */
export function clampScroll(y: number, metrics: { scrollHeight: number; clientHeight: number }): number {
  if (!Number.isFinite(y)) return 0;
  const { scrollHeight, clientHeight } = metrics;
  if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight)) return Math.max(0, y);
  return Math.max(0, Math.min(y, Math.max(0, scrollHeight - clientHeight)));
}
