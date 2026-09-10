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

/** Only our own hosts, so a typo cannot make the extension fetch the open web. */
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

export async function capture(url: string): Promise<CaptureResult> {
  if (!isAllowedCaptureUrl(url)) {
    throw new Error(
      `Refusing to capture ${url}: must be https on a UIUC or source host ` +
        `(${ALLOWED_HOSTS.join(", ")}, or any *.illinois.edu).`,
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
