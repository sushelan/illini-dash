/**
 * Message protocol.
 *
 * chrome.runtime.onMessage is delivered to every extension context at once, so
 * messages aimed at the offscreen document carry `target: "offscreen"` and every
 * other listener ignores them.
 */

import type { CaptureResult } from "./capture.js";
import type { Gate0Result } from "./gate0.js";
import type { ParserId } from "./sources/registry.js";
import type { GradescopeCourse } from "./sources/gradescope.js";
import type { SyncTrigger } from "./core/sync.js";
import type {
  Item,
  PageCtx,
  RawItem,
  Settings,
  Source,
  SourceStatus,
} from "./sources/types.js";

/** UI → service worker. */
export type Request =
  | { type: "ping" }
  | { type: "gate0" }
  | { type: "parse-selftest" }
  | { type: "capture"; url: string }
  | { type: "get-state" }
  | { type: "sync"; trigger: SyncTrigger };

export type Response =
  | { type: "pong"; at: string; buildId: string }
  | { type: "gate0"; results: Gate0Result[] }
  | { type: "parse-selftest"; cases: SelftestCase[] }
  | { type: "capture"; result: CaptureResult }
  | {
      type: "state";
      items: Item[];
      sources: Record<Source, SourceStatus>;
      settings: Settings;
      lastSyncAt?: string;
    }
  | { type: "synced"; skipped: boolean; outcomes: { source: Source; state: string }[] }
  | { type: "error"; message: string };

export interface SelftestCase {
  name: string;
  expectation: string;
  passed: boolean;
  detail: string;
}

/** Service worker → offscreen document. */
export type OffscreenRequest =
  | { target: "offscreen"; type: "parse"; parserId: ParserId; html: string; page: PageCtx }
  | { target: "offscreen"; type: "parse-gradescope-dashboard"; html: string };

/** Kept as a name because the parse case is by far the common one. */
export type ParseRequest = OffscreenRequest;

/** Errors cannot cross a message boundary as Error objects; carry the shape. */
export interface SerializedError {
  name: string;
  message: string;
}

export type ParseResponse =
  | { ok: true; items: RawItem[] }
  | { ok: true; courses: GradescopeCourse[] }
  | { ok: false; error: SerializedError };

/**
 * Send to the service worker and insist on an answer.
 *
 * chrome.runtime.sendMessage resolves with `undefined` when a listener saw the
 * message and declined it without calling sendResponse. The commonest way to get
 * there in development is a stale service worker: the page was re-read from disk
 * after a rebuild, the worker was not, and the worker has never heard of the
 * message type the new page just sent. Left alone this surfaces as
 * "Cannot read properties of undefined", which says nothing useful, so translate
 * it here (§0 rule 3, applied to our own plumbing).
 */
export async function send(request: Request): Promise<Response> {
  const response = (await chrome.runtime.sendMessage(request)) as Response | undefined;

  if (response === undefined) {
    throw new Error(
      `The service worker received "${request.type}" but returned no response. ` +
        `The usual cause is that the worker is running older code than this page: ` +
        `open chrome://extensions and click Reload on the Illini Due card, then retry.`,
    );
  }
  return response;
}
