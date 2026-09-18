/**
 * The Campuswire page observer (§4.6, Sushi 2026-09-18).
 *
 * A content script, registered only after the student switches Campuswire on
 * and Chrome grants `https://campuswire.com/*`. It reads the posts the browser
 * has already rendered for the student and hands the announcements to the
 * worker. It makes **no request to Campuswire**, reads no token, no cookie, no
 * `localStorage`, and nothing on the page outside the feed's own markup — there
 * is nothing here that a student could not read by scrolling.
 *
 * Everything that is a decision lives in `core/campuswire.ts`, which the suite
 * can reach (worker rule 1). This file is the three things a test cannot have:
 * a document, a MutationObserver and `chrome.runtime.sendMessage`.
 *
 * Two silences are deliberate:
 *
 * - **Not a class feed → nothing at all.** Campuswire is a whole site, and this
 *   script runs on every page of it. A settings page or a chat channel is not a
 *   parse failure, and a console line on each one would be this extension
 *   shouting in somebody else's page.
 * - **One error line, not one per mutation.** A feed that has genuinely changed
 *   shape throws on every redraw, and a typing student redraws the page
 *   constantly.
 */

import {
  classCodeFromPath,
  isClassFeed,
  parseFeed,
  postsToSend,
} from "../core/campuswire.js";

/** How long the DOM has to settle before it is read again. */
const DEBOUNCE_MS = 400;
/** The subtree Campuswire renders the feed into. */
const ROOT_SELECTOR = "#main-content";

/**
 * Posts already sent, for this page session only.
 *
 * Not a substitute for `seenPosts` in the store — that is what actually stops a
 * correction being applied twice, and it survives a reload. This only stops the
 * same twelve posts crossing the message boundary on every keystroke.
 */
const sent = new Set<string>();

let timer: ReturnType<typeof setTimeout> | undefined;
let complained = false;

function complain(err: unknown): void {
  if (complained) return;
  complained = true;
  console.warn(
    `[illini-dash] could not read this Campuswire feed: ` +
      `${err instanceof Error ? err.message : String(err)}. ` +
      `Switch Campuswire off in Illini Dash's settings if this keeps happening.`,
  );
}

function readFeed(): void {
  const root = document.querySelector(ROOT_SELECTOR);
  // Not an error, and not logged: this is every Campuswire page that is not a
  // class feed, plus the moment before the feed has finished rendering.
  if (root === null || !isClassFeed(root)) return;

  const classCode = classCodeFromPath(location.pathname);
  if (classCode === undefined) return;

  let plan;
  try {
    plan = postsToSend(
      parseFeed(root, { classCode, observedAt: new Date().toISOString() }),
    );
  } catch (err) {
    complain(err);
    return;
  }

  for (const payload of plan.payloads) {
    if (sent.has(payload.id)) continue;
    sent.add(payload.id);
    // Every send from a page gets a `.catch` (UI rule 2). A rejection here is
    // almost always the worker running older code than this script, and that
    // is the sentence `send()` carries — swallowing it hides the one line that
    // ends the investigation. `sendMessage` is used directly rather than
    // `send()` because this is a content script: it shares no bundle with the
    // extension pages and has no `Response` to narrow.
    chrome.runtime
      .sendMessage({ type: "post-observed", post: payload })
      .catch((err: unknown) => {
        // Re-armed, so the next redraw retries rather than dropping the post
        // for the life of the page.
        sent.delete(payload.id);
        complain(err);
      });
  }
}

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(readFeed, DEBOUNCE_MS);
}

// On load, then on every settled change. Campuswire replaces the feed's
// contents without navigating, so a single read at `document_idle` sees either
// a spinner or the previous class.
readFeed();

const main = document.querySelector(ROOT_SELECTOR);
if (main !== null) {
  new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
} else {
  // `#main-content` is rendered by the app, so on a cold load it may not exist
  // yet. Watch the body until it does, rather than deciding once that this page
  // has no feed.
  const waiting = new MutationObserver(() => {
    const found = document.querySelector(ROOT_SELECTOR);
    if (found === null) return;
    waiting.disconnect();
    new MutationObserver(schedule).observe(found, { childList: true, subtree: true });
    schedule();
  });
  waiting.observe(document.documentElement, { childList: true, subtree: true });
}
