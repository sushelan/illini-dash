/**
 * "Is this text a page I could be asked to read?" — decided once, in core.
 *
 * **Finding I04.** Typing `not a url` into Settings' "Read this page" answered
 * *"Chrome did not grant access to not a url, so it cannot be read."* No
 * permission was ever requested: the string never parsed as a URL, so
 * `originPattern`/`isGrantedUpFront` threw inside `ensureHostPermission`'s try,
 * it returned `false`, and the handler had only one sentence for `false` — the
 * one that blames a refused host permission. Three handlers in
 * `ui/options.ts` (capture, report-a-broken-page, add-a-course-site) shared the
 * shape and so shared the wrong answer.
 *
 * The decision lives here rather than in the page (worker rule 1) for the
 * ordinary reason: a decision in `ui/` is a decision no test can reach, and
 * "which sentence does a student get" is exactly the kind of decision that
 * needs pinning and mutating. Nothing in this file touches the DOM, `chrome.*`
 * or the network.
 *
 * Every shape is matched **positively** (parser rule 5): an anchored regex for
 * the scheme, an anchored regex for a bare host, and a real `new URL` parse for
 * the rest. Nothing here asks whether a substring is present.
 */

/** Accepted: the canonical form of the address. Rejected: a sentence to show. */
export type PageUrlResult = { ok: true; url: string } | { ok: false; reason: string };

/**
 * RFC 3986's scheme production, anchored: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ).
 * Anchored because an unanchored version matches the `http:` inside a path.
 */
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/**
 * A bare host, optionally with a port: dot-separated labels, **at least one
 * dot**, no whitespace, nothing else.
 *
 * The dot is the whole test. Without it `schedule` normalises to
 * `https://schedule/` — which `new URL` is perfectly happy with — and the
 * student is back to a permission prompt for a host that cannot exist.
 */
const HOST_AND_PORT =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+(?::\d{1,5})?$/;

/** How much of the student's own text is echoed back at them in a status line. */
const MAX_QUOTED = 60;

function quoted(text: string): string {
  return text.length <= MAX_QUOTED ? text : `${text.slice(0, MAX_QUOTED)}…`;
}

const PASTE_THE_ADDRESS = "Paste the page's full address, starting with https://.";

function notAWebAddress(text: string): { ok: false; reason: string } {
  return { ok: false, reason: `“${quoted(text)}” is not a web address. ${PASTE_THE_ADDRESS}` };
}

/**
 * The scheme this text carries, lowercased — or `undefined` when it carries none.
 *
 * A dot disqualifies it: `cs225.org:8080/schedule` matches the scheme
 * production exactly as `mailto:x` does, and calling it a scheme would answer a
 * pasted host-and-port with "Illini Dash cannot read cs225.org: addresses".
 * No scheme this extension can meet contains a dot.
 */
function schemeOf(text: string): string | undefined {
  const match = SCHEME.exec(text);
  if (!match) return undefined;
  const scheme = match[1]!.toLowerCase();
  return scheme.includes(".") ? undefined : scheme;
}

/**
 * The address a student meant, or the sentence to show them instead.
 *
 * Accepts `http(s)` URLs that really parse, and a scheme-less host — with or
 * without a path — which it completes with `https://`; the returned `url` is
 * always the canonical `URL.toString()`, so callers that ask Chrome for a
 * permission, send the worker a message and print a sentence all use the same
 * string. Total: every input, including `""`, gets one of the two answers.
 *
 * Rejection reasons are *local*: they describe the text, not a browser
 * decision that has not happened yet. That is the finding above.
 */
export function normalizePageUrl(raw: string): PageUrlResult {
  const text = raw.trim();
  if (text === "") return { ok: false, reason: PASTE_THE_ADDRESS };

  // Internal whitespace, before anything else. `new URL` would silently take
  // `https://cs225.org/sche dule` and percent-encode the space, which turns a
  // half-pasted address into a 404 the extension then reports as a broken page.
  if (/\s/.test(text)) return notAWebAddress(text);

  const scheme = schemeOf(text);
  if (scheme !== undefined) {
    // One place decides http(s)-ness. A second check on `url.protocol` after
    // the parse would say the same thing twice and mask a mutation of either
    // (mutation-check rule 3), and it cannot fire: a `^https?:` text parses to
    // an `https?:` URL or it throws.
    if (scheme !== "http" && scheme !== "https") {
      return {
        ok: false,
        reason: `Illini Dash can only read http(s) pages, not ${scheme}: addresses.`,
      };
    }
    try {
      return { ok: true, url: new URL(text).toString() };
    } catch {
      // `https://` alone, `http://[`, a port out of range: a scheme is not a URL.
      return notAWebAddress(text);
    }
  }

  // No scheme. Everything up to the first `/`, `?` or `#` has to look like a
  // host — which also refuses `//other.host/x`, whose first segment is empty.
  const host = text.split(/[/?#]/)[0] ?? "";
  if (!HOST_AND_PORT.test(host)) return notAWebAddress(text);
  try {
    return { ok: true, url: new URL(`https://${text}`).toString() };
  } catch {
    return notAWebAddress(text);
  }
}

/* -------------------------------------------------------------------------- */
/* The Developer section's address                                             */
/* -------------------------------------------------------------------------- */

/**
 * The address that reveals Settings' Developer section, and the only one.
 *
 * Four harnesses — Gate 0, the offscreen round trip, the fixture capture and
 * the build ids — were four of the ten headings in the sidebar, and not one of
 * them answers a question a student has. They stay, because they are how this
 * project is debugged; they are addressed rather than listed.
 *
 * Here rather than in `ui/options.ts` because "which addresses show it" is a
 * decision, and a decision in the page is one the suite cannot mutate (worker
 * house rule 1). Matched exactly, never by substring: `#developer` and
 * `#report=…` are not it, and `"#report=…".includes("#dev")` is false only by
 * luck of spelling (parser house rule 6).
 */
export function isDevHash(hash: string): boolean {
  return hash === "#dev";
}
