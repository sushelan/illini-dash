/**
 * Fixture capture (§10 step 4, §9 G1).
 *
 * Fetches one URL from the service worker — the same way the real sync will, so
 * what lands in fixtures/ is what the parsers will actually be handed — and
 * returns the body to the options page for scrubbing and download. Nothing is
 * stored and nothing is written automatically.
 */

import { looksLikeLoginUrl } from "./gate0.js";

export interface CaptureResult {
  requestUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  contentType?: string;
  redirected: boolean;
  bytes: number;
  body: string;
  /** True when the fetch landed on a login/SSO page (§4). */
  needsLogin: boolean;
  durationMs: number;
}

const TIMEOUT_MS = 20_000;

/**
 * Hosts the manifest grants up front (§2.3). Anything else on illinois.edu is
 * an *optional* permission and has to be granted at runtime before a fetch can
 * work at all — without it the request falls back to ordinary CORS rules and is
 * blocked by the browser, with an error that says nothing about permissions.
 */
/**
 * Hosts the manifest grants up front, so no runtime request is needed.
 *
 * Must stay in step with `host_permissions`. `tests/manifest.test.ts` asserts
 * that every source this extension fetches is covered, because the one that was
 * not — smartPhysics — failed with a bare "TypeError: Failed to fetch" and
 * nothing in the UI could say why.
 */
const ALLOWED_HOSTS = [
  "canvas.illinois.edu",
  "www.gradescope.com",
  "us.prairielearn.com",
  "us.prairietest.com",
  "smart.physics.illinois.edu",
];

/**
 * Whether this URL may be captured at all.
 *
 * **AMENDED (2026-09-18).** This was the third copy of an `.illinois.edu` host
 * rule that `validateAdapter` dropped on 2026-09-12 and `popup.ts`'s `safeUrl`
 * dropped in wave 1, and being the last one left it was the one that bit: a
 * student could *add* a cs225.org adapter and then could not capture the page it
 * points at, with an error naming a restriction nothing else in the extension
 * still enforced. The CS department's highest-enrolment course sites are their
 * own domains — cs124.org, cs128.org, cs225.org — and excluding them excluded
 * exactly the students most likely to want this.
 *
 * Any https URL may be captured, which gives away nothing: `capture` still
 * refuses to fetch a host `chrome.permissions` has not granted, and every host
 * outside `ALLOWED_HOSTS` is an optional permission the student grants by name
 * in Chrome's own prompt. https stays required — a capture carries credentials.
 */
export function isAllowedCaptureUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === "https:";
}

/**
 * The URL carried in `options.html#report=…`, if it is one this may act on.
 *
 * The fragment is untrusted input — anything can navigate to an extension page
 * with any fragment — so it is validated here rather than trusted from whoever
 * wrote it, and `decodeURIComponent` throws on a malformed escape (parser rule
 * 7).
 */
export function reportUrlFromHash(hash: string): string | undefined {
  const match = /^#report=(.*)$/.exec(hash);
  if (!match) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1]!);
  } catch {
    return undefined;
  }
  return isAllowedCaptureUrl(decoded) ? decoded : undefined;
}

/** The match pattern `chrome.permissions` uses for a URL's origin. */
export function originPattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

/** True when the manifest already grants this host without a runtime request. */
export function isGrantedUpFront(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function capture(url: string): Promise<CaptureResult> {
  if (!isAllowedCaptureUrl(url)) {
    throw new Error(
      `Refusing to capture ${url}: a capture must be an https URL. ` +
        `Which host it is on is decided by the permission below, not here.`,
    );
  }

  // Checked, not requested: a permission prompt needs a user gesture, which
  // does not survive the message hop into this worker. The options page asks
  // inside the click; this only turns "TypeError: Failed to fetch" — which is
  // what the browser gives you for a cross-origin request without permission —
  // into something that names the actual problem.
  if (!isGrantedUpFront(url) && !(await chrome.permissions.contains({
    origins: [originPattern(url)],
  }))) {
    throw new Error(
      `No permission for ${originPattern(url)}. This host is an optional ` +
        `permission (§2.3), so Chrome must be asked for it from a click before ` +
        `it can be fetched.`,
    );
  }

  const startedAt = Date.now();
  const resp = await fetch(url, {
    credentials: "include",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await resp.text();
  const finalUrl = resp.url || url;

  return {
    requestUrl: url,
    finalUrl,
    status: resp.status,
    statusText: resp.statusText,
    contentType: resp.headers.get("content-type") ?? undefined,
    redirected: resp.redirected,
    bytes: body.length,
    body,
    needsLogin: looksLikeLoginUrl(finalUrl),
    durationMs: Date.now() - startedAt,
  };
}
