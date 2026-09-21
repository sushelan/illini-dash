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
import type { ManualInput } from "./core/manual.js";
import type { ObservedPost } from "./core/suggest.js";
import type { GcalStore, ObserverId, ObserverState } from "./core/store.js";
import type {
  Adapter,
  Item,
  Overrides,
  PageCtx,
  RawItem,
  Settings,
  Source,
  SourceStatus,
  Suggestion,
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
  | { type: "set-course-name"; course: string; name: string }
  | { type: "keep-course"; courseId: string; keep: boolean }
  | { type: "override"; action: OverrideAction }
  /*
   * The `manual` source (§3). The worker only wires these: `core/manual.ts`
   * validates the input and builds the row, and a refusal comes back as an
   * `error` response carrying the sentence the student should read.
   */
  | { type: "add-manual-item"; input: ManualInput }
  | { type: "edit-manual-item"; sourceId: string; input: ManualInput }
  | { type: "delete-manual-item"; sourceId: string }
  /*
   * A post an observer read (§4.6, Sushi 2026-09-18: auto-move known items,
   * suggest new ones). `core/suggest.ts` decides what it does; the worker only
   * queues the write.
   *
   * `source: "paste"` is carried from the first build even though no paste box
   * exists, because a paste fallback is then this one message with a textarea
   * in front of it rather than a second path with its own rules.
   */
  | { type: "post-observed"; post: ObservedPost }
  | { type: "accept-suggestion"; id: string }
  | { type: "dismiss-suggestion"; id: string }
  /** Take back a move a post applied. Keyed by item, resolved to member keys. */
  | { type: "undo-move"; itemId: string }
  /*
   * A page observer's switch (§4.6). The host permission is requested in the
   * click that sends this — a user gesture does not survive an await, so the
   * worker cannot ask — and the worker registers or unregisters the content
   * script once the store is written.
   */
  | { type: "set-observer-enabled"; observer: ObserverId; enabled: boolean }
  | { type: "export" }
  | { type: "reset" }
  | { type: "get-adapters" }
  | { type: "set-adapter-enabled"; adapterId: string; enabled: boolean }
  | { type: "refresh-registry" }
  | { type: "test-notification" }
  /*
   * Google Calendar (§8.3). Three messages, no decisions in the worker:
   * `core/gcal.ts` decides what goes on the calendar, `core/gcal-auth.ts`
   * decides what every failure is called, and the worker holds the token and
   * the queue (worker rules 1 and 4).
   *
   * `gcal-connect` is sent from a click, because `getAuthToken({interactive:
   * true})` opens a window and Chrome refuses that without a user gesture in
   * recent memory — the same constraint `permissions.request` has.
   */
  | { type: "gcal-connect" }
  | { type: "gcal-disconnect" }
  | { type: "gcal-push-now" }
  | { type: "get-diagnostics" };

export type OverrideAction =
  | { kind: "hide"; itemId: string }
  | { kind: "unhide"; itemId: string }
  | { kind: "split"; itemId: string }
  | { kind: "merge"; itemId: string; otherItemId: string }
  | { kind: "done"; itemId: string }
  | { kind: "undone"; itemId: string }
  /*
   * "Give it a date" (brief D3), for a row a source listed and never dated — or
   * dated unreadably. A source row has no editable field of its own (the next
   * sync overwrites the whole `RawItem`), so the date lands in the same
   * `dueOverrides` record an announcement writes, via `studentDueOverride`.
   *
   * `date` is `YYYY-MM-DD` and `time` is `HH:MM`; both go through
   * `core/manual.ts`'s own anchored regexes, so this message cannot loosen what
   * a student is allowed to type, and a refusal arrives as the same sentence
   * the editor shows.
   */
  | { kind: "set-due"; itemId: string; date: string; time?: string };

export type Response =
  | { type: "pong"; at: string; buildId: string }
  | { type: "gate0"; results: Gate0Result[] }
  | { type: "parse-selftest"; cases: SelftestCase[] }
  | { type: "capture"; result: CaptureResult }
  | { type: "diagnostics"; report: string }
  | {
      type: "state";
      items: Item[];
      /**
       * The student's own names for their courses.
       *
       * Sent with the state rather than fetched separately, because every
       * surface that draws a row also draws a course label — a second round
       * trip would let the two arrive out of step and paint one frame with the
       * old name.
       */
      courseNames: Record<string, string>;
      sources: Record<Source, SourceStatus>;
      observers: Record<ObserverId, ObserverState>;
      settings: Settings;
      /**
       * Deadlines a post stated that nothing else accounts for.
       *
       * Sent with the state rather than fetched separately, for the same reason
       * `courseNames` is: the Attention tab's count is drawn from both, and two
       * round trips would paint one frame with the two out of step.
       */
      suggestions: Suggestion[];
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
      /** The student's own names for their courses; see the `state` message. */
      courseNames: Record<string, string>;
      settings: Settings;
      notificationsBlocked: boolean;
      sources: Record<Source, SourceStatus>;
      courses: CourseSummary[];
      overrides: Overrides;
      itemCount: number;
      /**
       * `members` is what a Trash button rests on: a row is deletable only when
       * every row that merged into it is one the student typed (`core/manual.ts`'s
       * `trashable`). It is the source and the id and nothing else, because a
       * page that only has to answer "may this be deleted, and which stored rows
       * is it" has no business carrying the titles twice.
       */
      hiddenItems: TidyItem[];
      doneItems: TidyItem[];
      setAsideCourses: { id: string; name: string; courseCode?: string; reason: string }[];
      /**
       * Page observers and what they have actually read.
       *
       * Carried with the rest of the state for the same reason `courseNames`
       * is: the row draws a switch and a state chip from it, and the chip must
       * be derived from an attempt that happened rather than from the switch
       * (worker rule 2).
       */
      observers: Record<ObserverId, ObserverState>;
      /**
       * Google Calendar's switch and what it has actually pushed.
       *
       * Carried with the rest of the state for the same reason `observers` is,
       * and with the same rule behind it: the chip says "Pushed 14 events ·
       * 10:32" only when a push wrote those two fields, never because the
       * switch is on (worker rule 2). Optional on the wire because a worker
       * from before this change does not send it; `core/compat.ts` fills it in
       * and the page says so.
       */
      gcal?: GcalStore;
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
      /**
       * The page's own HTML, when it is small enough to carry.
       *
       * Only the options page's model branch reads it, and only when the
       * deterministic proposer found nothing: it needs a DOM to summarise for
       * the prompt and the same DOM to run the model's proposal against. Sent
       * back with the candidates rather than re-fetched, because a second
       * request is a second chance to land on a login page, a second row in the
       * course's access log, and a page that may have changed in between — the
       * proposal must be validated against the bytes the student was shown.
       *
       * Absent for a page over `MAX_AUTHOR_HTML`; `core/author.ts` owns that
       * decision and the branch says so on screen rather than failing quietly.
       */
      html?: string;
      /**
       * Why `html` is absent, when it is: the worker chose. An absent `html`
       * with no `htmlOmitted` means the worker predates this field.
       */
      htmlOmitted?: "too-large" | "empty";
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


/**
 * One row in Settings' "hidden and ticked off" line.
 *
 * Its own name because two message fields have the shape and a third thing —
 * `core/manual.ts`'s `trashable` — reads one of its fields; three copies of a
 * shape is how the fourth one quietly loses a field.
 */
export interface TidyItem {
  id: string;
  title: string;
  courseLabel: string;
  members: { source: string; sourceId: string }[];
}
