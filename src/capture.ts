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
const ALLOWED_HOSTS = [
  "canvas.illinois.edu",
  "www.gradescope.com",
  "us.prairielearn.com",
  "us.prairietest.com",
];

export function isAllowedCaptureUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return (
    ALLOWED_HOSTS.includes(parsed.hostname) || parsed.hostname.endsWith(".illinois.edu")
  );
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
      `Refusing to capture ${url}: must be https on a UIUC or source host ` +
        `(${ALLOWED_HOSTS.join(", ")}, or any *.illinois.edu).`,
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
