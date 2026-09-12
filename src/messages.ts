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
import type { SmartPhysicsCourse } from "./sources/smartphysics.js";
import type { SyncTrigger } from "./core/sync.js";
import type { CourseSummary } from "./core/overrides.js";
import type { SetupRow } from "./core/setup.js";
import type { Candidate } from "./core/detect.js";
import type {
  Adapter,
  Item,
  Overrides,
  PageCtx,
  RawItem,
  Settings,
  Source,
  SourceStatus,
} from "./sources/types.js";

/** UI → service worker. */
export type Request =
  | { type: "ping" }
  | { type: "get-setup" }
  | { type: "detect-adapter"; url: string }
  | { type: "add-local-adapter"; adapter: unknown }
  | { type: "remove-local-adapter"; adapterId: string }
  | { type: "complete-setup" }
  /**
   * Show the full view, reusing the tab it is already in.
   *
   * Handled by the worker rather than by `chrome.tabs.create` at the call site,
   * because the worker is the only thing with continuity across popup opens —
   * a popup is destroyed the moment it loses focus and cannot remember which
   * tab it opened last time. Every click was spawning a duplicate.
   */
  | { type: "open-full-view" }
  | { type: "restart-setup" }
  | { type: "gate0" }
  | { type: "parse-selftest" }
  | { type: "capture"; url: string }
  | { type: "get-state" }
  | { type: "sync"; trigger: SyncTrigger }
  | { type: "get-options-state" }
  | { type: "update-settings"; settings: Partial<Settings> }
  | { type: "set-source-enabled"; source: Source; enabled: boolean }
  | { type: "set-course-disabled"; course: string; disabled: boolean }
  | { type: "keep-course"; courseId: string; keep: boolean }
  | { type: "override"; action: OverrideAction }
  | { type: "export" }
  | { type: "reset" }
  | { type: "get-adapters" }
  | { type: "set-adapter-enabled"; adapterId: string; enabled: boolean }
  | { type: "refresh-registry" }
  | { type: "test-notification" }
  | { type: "get-diagnostics" };

export type OverrideAction =
  | { kind: "hide"; itemId: string }
  | { kind: "unhide"; itemId: string }
  | { kind: "split"; itemId: string }
  | { kind: "merge"; itemId: string; otherItemId: string }
  | { kind: "done"; itemId: string }
  | { kind: "undone"; itemId: string };

export type Response =
  | { type: "pong"; at: string; buildId: string }
  | { type: "gate0"; results: Gate0Result[] }
  | { type: "parse-selftest"; cases: SelftestCase[] }
  | { type: "capture"; result: CaptureResult }
  | { type: "diagnostics"; report: string }
  | {
      type: "state";
      items: Item[];
      sources: Record<Source, SourceStatus>;
      settings: Settings;
      lastSyncAt?: string;
      /**
       * Chrome's own switch for this extension's notifications.
       *
       * Carried to the UI because a denied extension is otherwise completely
       * silent: reminders are created, dropped by the browser, and every
       * surface goes on looking healthy.
       */
      notificationsBlocked: boolean;
    }
  | { type: "synced"; skipped: boolean; outcomes: { source: Source; state: string }[] }
  | {
      type: "options-state";
      settings: Settings;
      notificationsBlocked: boolean;
      sources: Record<Source, SourceStatus>;
      courses: CourseSummary[];
      overrides: Overrides;
      itemCount: number;
      hiddenItems: { id: string; title: string; courseLabel: string }[];
      doneItems: { id: string; title: string; courseLabel: string }[];
      setAsideCourses: { id: string; name: string; courseCode?: string; reason: string }[];
      lastSyncAt?: string;
    }
  | { type: "ok" }
  | {
      type: "detected";
      candidates: Candidate[];
      /** Present when there were none, saying which of the three dead ends it is. */
      reason?: string;
      /** Echoed back so the page can build an entry without re-parsing the URL. */
      url: string;
      courseCodeGuess?: string;
    }
  | {
      type: "setup";
      /** Absent means setup is finished and the calendar should be drawn. */
      rows?: SetupRow[];
    }
  | {
      type: "adapters";
      adapters: (Adapter & { enabled: boolean; granted: boolean; currentTerm: boolean })[];
      fetchedAt?: string;
    }
  | { type: "permission"; granted: boolean }
  | { type: "export"; json: string }
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
  | { target: "offscreen"; type: "parse-gradescope-dashboard"; html: string }
  | { target: "offscreen"; type: "parse-smartphysics-courses"; html: string }
  | {
      target: "offscreen";
      type: "run-adapter";
      adapter: Adapter;
      html: string;
      page: PageCtx;
    }
  | {
      target: "offscreen";
      type: "detect-adapter";
      html: string;
      reference: string;
      timezone: string;
    };

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
  // Named separately from `courses` so the two cannot be confused at the
  // boundary: both are "a list of courses" and neither is the other's shape.
  | { ok: true; smartPhysicsCourses: SmartPhysicsCourse[] }
  | { ok: true; candidates: Candidate[]; reason?: string }
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
        `open chrome://extensions and click Reload on the Illini Dash card, then retry.`,
    );
  }
  return response;
}
