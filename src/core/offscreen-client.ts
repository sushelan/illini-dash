/**
 * Service-worker side of the offscreen parser (§2.1). Creates the document on
 * first use, keeps it for later syncs, and re-creates it if Chrome tore it down.
 */

import type { OffscreenRequest, ParseResponse } from "../messages.js";
import type { GradescopeCourse } from "../sources/gradescope.js";
import type { SmartPhysicsCourse } from "../sources/smartphysics.js";
import type { Adapter } from "../sources/types.js";
import type { ParserId } from "../sources/registry.js";
import { ParseError, type PageCtx, type RawItem } from "../sources/types.js";

const OFFSCREEN_PATH = "offscreen.html";

/** Single-flight: two syncs starting together must not both call createDocument. */
let ensuring: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  // Assigned before any await, so a second caller cannot slip past the check.
  if (ensuring) return ensuring;

  ensuring = (async () => {
    if (await chrome.offscreen.hasDocument()) return;
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: "Parse fetched course pages into deadline data.",
      });
    } catch (err) {
      // Another context won the race. Ask Chrome rather than matching on the
      // error text, which is not part of any contract.
      if (await chrome.offscreen.hasDocument()) return;
      throw err;
    }
  })().finally(() => {
    ensuring = null;
  });

  return ensuring;
}

/** Runs a parser against `html` in the offscreen document. Throws on parse failure. */
export async function parseHtml(
  parserId: ParserId,
  html: string,
  page: PageCtx,
): Promise<RawItem[]> {

  const response = await ask({ target: "offscreen", type: "parse", parserId, html, page });
  if ("items" in response) return response.items;
  throw new Error("offscreen document returned the wrong shape");
}

/** Gradescope's dashboard (§4.2 step 1), which returns courses rather than items. */
export async function parseGradescopeDashboard(html: string): Promise<GradescopeCourse[]> {
  const response = await ask({ target: "offscreen", type: "parse-gradescope-dashboard", html });
  if ("courses" in response) return response.courses;
  throw new Error("offscreen document returned the wrong shape");
}

/** smartPhysics's enrolment list, which returns courses rather than items. */
export async function parseSmartPhysicsCourses(html: string): Promise<SmartPhysicsCourse[]> {
  const response = await ask({ target: "offscreen", type: "parse-smartphysics-courses", html });
  if ("smartPhysicsCourses" in response) return response.smartPhysicsCourses;
  throw new Error("offscreen document returned the wrong shape");
}

/** §4.5: one adapter over one fetched page, in the offscreen document. */
export async function runAdapterInOffscreen(
  adapter: Adapter,
  html: string,
  page: PageCtx,
): Promise<RawItem[]> {
  const response = await ask({ target: "offscreen", type: "run-adapter", adapter, html, page });
  if ("items" in response) return response.items;
  throw new Error("offscreen document returned the wrong shape");
}

async function ask(request: OffscreenRequest): Promise<Extract<ParseResponse, { ok: true }>> {
  await ensureOffscreenDocument();
  const response = (await chrome.runtime.sendMessage(request)) as ParseResponse | undefined;

  if (!response) throw new Error("offscreen document did not respond");
  if (response.ok) return response;

  // Rebuild the error on this side so callers can tell a structural surprise
  // (ParseError → parse_error state, §6) from a plumbing bug.
  const { name, message } = response.error;
  if (name === "ParseError") throw new ParseError(message);
  const error = new Error(message);
  error.name = name;
  throw error;
}

export async function closeOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
}
