/**
 * Gate 0 spike — SPEC.md §2.2, §9 G0, §10 step 2.
 *
 * Runs in the service worker. Fetches each hosted source's authenticated home
 * page with `credentials: "include"` and reports enough to decide, by hand,
 * whether the extension's own origin gets the user's cookies. Nothing is
 * stored and nothing is parsed; this is a diagnostic only.
 */

import type { Source } from "./sources/types.js";
import { coursesUrl } from "./sources/canvas.js";

export interface Gate0Target {
  source: Source;
  label: string;
  url: string;
}

export interface Gate0Result {
  source: Source;
  label: string;
  requestUrl: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  /** Final URL after redirects — a login host here means needs_login (§4). */
  finalUrl?: string;
  redirected?: boolean;
  contentType?: string;
  /** First 300 characters of the body, whitespace collapsed. */
  bodyPreview?: string;
  bodyLength?: number;
  /** Heuristic read of the response, for the human looking at this. */
  verdict: "logged_in" | "needs_login" | "error";
  note?: string;
  error?: string;
  durationMs: number;
}

/**
 * Canvas is checked through its API (§4.1) because that is what the real
 * module will use; the others are checked on the page the fetch plan starts
 * from (§4.2, §4.3, §4.4).
 */
export const GATE0_TARGETS: Gate0Target[] = [
  {
    source: "canvas",
    label: "Canvas (API /courses)",
    url: coursesUrl(),
  },
  {
    source: "gradescope",
    label: "Gradescope (account dashboard)",
    url: "https://www.gradescope.com/",
  },
  {
    source: "prairielearn",
    label: "PrairieLearn (student home)",
    url: "https://us.prairielearn.com/pl/",
  },
  {
    source: "prairietest",
    label: "PrairieTest (home)",
    url: "https://us.prairietest.com/pt/",
  },
];

const TIMEOUT_MS = 20_000;

/** §4 fetch rules: a landing on an SSO/login host means needs_login. */
const LOGIN_URL_MARKERS = [
  "shibboleth",
  "login.illinois.edu",
  "/login",
  "/users/sign_in",
  "/pl/login",
  "/pt/login",
];

export function looksLikeLoginUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return LOGIN_URL_MARKERS.some((m) => lower.includes(m));
}

function collapse(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function checkOne(target: Gate0Target): Promise<Gate0Result> {
  const startedAt = Date.now();
  const base: Gate0Result = {
    source: target.source,
    label: target.label,
    requestUrl: target.url,
    ok: false,
    verdict: "error",
    durationMs: 0,
  };

  try {
    const resp = await fetch(target.url, {
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await resp.text();
    const finalUrl = resp.url || target.url;
    const notes: string[] = [];

    // §4.1: Canvas prepends `while(1);` to JSON when a browser session is used.
    if (body.startsWith("while(1);")) {
      notes.push("body starts with `while(1);` (§4.1 — strip before JSON.parse)");
    }
    const link = resp.headers.get("link");
    if (link?.includes('rel="next"')) notes.push("Link header has rel=\"next\" (paginated)");

    const isLogin = looksLikeLoginUrl(finalUrl);
    const verdict: Gate0Result["verdict"] = !resp.ok
      ? "error"
      : isLogin
        ? "needs_login"
        : "logged_in";
    if (isLogin) notes.push("final URL looks like a login/SSO page");

    return {
      ...base,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      finalUrl,
      redirected: resp.redirected,
      contentType: resp.headers.get("content-type") ?? undefined,
      bodyPreview: collapse(body, 300),
      bodyLength: body.length,
      verdict,
      note: notes.length ? notes.join("; ") : undefined,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      durationMs: Date.now() - startedAt,
    };
  }
}

/** Sequential on purpose: four requests, and the log stays readable. */
export async function runGate0(): Promise<Gate0Result[]> {
  const results: Gate0Result[] = [];
  for (const target of GATE0_TARGETS) {
    const result = await checkOne(target);
    console.log(`[gate0] ${result.label}`, result);
    results.push(result);
  }
  return results;
}
