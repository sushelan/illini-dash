/**
 * Service worker: alarms, sync orchestration, and the message surface the UI
 * talks to (§2, §6).
 *
 * The loop itself lives in `core/sync.ts` with its dependencies injected, so
 * this file is only the browser-facing half — the part that cannot be tested
 * in Node.
 */

import { BUILD_ID } from "./build-info.js";
import { capture } from "./capture.js";
import { runParseSelftest } from "./core/parse-selftest.js";
import {
  parseGradescopeDashboard,
  parseHtml,
  parseSmartPhysicsCourses,
  runAdapterInOffscreen,
} from "./core/offscreen-client.js";
import {
  REGISTRY_REFRESH_MS,
  REGISTRY_URL,
  currentTermCode,
  isCurrentTerm,
  shouldSeedFromBundle,
  validateRegistry,
  validateAdapter,
} from "./core/registry.js";
import { dedupe, withoutKeys } from "./core/dedupe.js";
import { dedupeInput, editManualItem, newManualItem } from "./core/manual.js";
import { buildDiagnostics } from "./core/diagnostics.js";
import { badgeFor, sourcesToRecheck, statusAfterEnable, type NavigatedAt } from "./core/health.js";
import { sourceForUrl } from "./core/origins.js";
import { needsSetup, opensOnInstall, setupRows } from "./core/setup.js";
import { detectInOffscreen } from "./core/offscreen-client.js";
import { htmlForAuthoring } from "./core/author.js";
import { guessCourseCode, SITE_TIMEZONE } from "./core/detect.js";
import { createStoreQueue } from "./core/queue.js";
import {
  acceptSuggestion,
  courseSummaries,
  dismissSuggestion,
  hideItem,
  memberKeysOf,
  markDone,
  markNotDone,
  mergeItems,
  renameCourse,
  setCourseDisabled,
  splitItem,
  undoDueOverride,
  unhideItem,
} from "./core/overrides.js";
import { ingestPost } from "./core/suggest.js";
import { CAMPUSWIRE_MATCH } from "./core/campuswire.js";
import { projectEvents } from "./core/gcal.js";
import {
  GCAL_CLIENT_ID_PLACEHOLDER,
  GCAL_MATCH,
  GCAL_NOT_CONFIGURED,
  isGcalConfigured,
} from "./core/gcal-config.js";
import { classifyAuthFailure, nextGcalState } from "./core/gcal-auth.js";
import {
  GcalError,
  createCalendar,
  listEvents,
  purgeCalendar,
  pushEvents,
  setCalendarColor,
  type GcalHttp,
} from "./core/gcal-client.js";
import {
  applyPiazzaResult,
  bodyBatch,
  bodyFailureKind,
  cappedLastNr,
  classListLine,
  classifyClassPage,
  classesToPoll,
  classifyPiazzaResponse,
  classPageUrl,
  feedRequest,
  feedSignedOut,
  parseClassPage,
  parseFeed,
  parsePostBody,
  piazzaNeedsRecheck,
  feedLine,
  planPiazza,
  postBodyRequest,
  postsNeedingBody,
  postsToSend,
  readClassList,
  readerUpgrade,
  readerVersionOf,
  resolveBodies,
  withPostBody,
  PiazzaNeedsLogin,
  MAX_BODIES_PER_SYNC,
  PIAZZA_CSRF_HEADER,
  PIAZZA_READER_VERSION,
  PIAZZA_MATCH,
  PIAZZA_ORIGIN,
  PIAZZA_SESSION_COOKIE,
  type BodyAttempt,
  type FeedOutcome,
  type ObservedPost,
  type PiazzaClass,
  type PiazzaPoll,
  type PiazzaResult,
} from "./core/piazza.js";
import {
  loadStore,
  normalizeQuietHours,
  saveStore,
  sourcesToRetryAfterUpdate,
  withLocalAdapter,
  withoutLocalAdapter,
  ALL_OBSERVERS,
  type ObserverId,
  type ObserverState,
  MAX_POLL_MINUTES,
  MIN_POLL_MINUTES,
} from "./core/store.js";
import {
  notificationContent,
  parseAlarmName,
  planNotifications,
  shouldFireNow,
  type Lead,
} from "./core/schedule.js";
import {
  MAX_CONCURRENT_PER_HOST,
  REQUEST_TIMEOUT_MS,
  adapterPrefix,
  sourcePrefix,
  syncOnce,
  withoutRows,
  type FetchedPage,
  type SyncDeps,
  type SyncTrigger,
} from "./core/sync.js";
import { runGate0 } from "./gate0.js";
import type { Request, Response } from "./messages.js";
import type { ParserId } from "./sources/registry.js";
import { memberKey, type Adapter } from "./sources/types.js";

const SYNC_ALARM = "sync";
/** notificationId → the url its click should open (§7). */
const notificationTargets = new Map<string, string>();

/**
 * §2.2 / §4: the request that the whole project rests on. Cookies come from the
 * browser because the host is in `host_permissions`; nothing here handles a
 * credential (§0 decision 2).
 */
async function fetchPage(url: string): Promise<FetchedPage> {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return {
    url,
    finalUrl: response.url || url,
    status: response.status,
    body: await response.text(),
  };
}

/**
 * §4.5: an adapter runs only when the user enabled it *and* the host permission
 * is actually held. The permission can be revoked from Chrome's own UI at any
 * time, so it is checked per sync rather than trusted from when it was granted.
 */
/**
 * Published and self-added adapters as one list.
 *
 * A locally added entry wins a duplicate id: the student chose theirs, and a
 * published entry arriving later must not silently replace what they are
 * already using without them noticing.
 */
function allAdapters(store: Awaited<ReturnType<typeof loadStore>>): Adapter[] {
  const local = new Set(store.localAdapters.map((adapter) => adapter.id));
  return [
    ...store.localAdapters,
    ...store.registry.adapters.filter((adapter) => !local.has(adapter.id)),
  ];
}

async function enabledAdapters(): Promise<Adapter[]> {
  const store = await loadStore();
  const on = new Set(store.enabledAdapters);
  const term = currentTermCode(new Date());
  const usable: Adapter[] = [];

  for (const adapter of allAdapters(store)) {
    if (!on.has(adapter.id)) continue;
    if (!isCurrentTerm(adapter, term)) continue;
    if (await chrome.permissions.contains({ origins: [adapter.hostPattern] })) {
      usable.push(adapter);
    }
  }
  return usable;
}

/**
 * §4.1's term filter runs mid-sync and its result has to outlive the sync, but
 * the loop must not write the store itself (worker rule 4: every writer goes
 * through the queue, and `runSync` is already inside it). So it hands the list
 * back here and `sync()` saves it with everything else.
 */
let lastSetAsideCourses: Awaited<ReturnType<typeof loadStore>>["setAsideCourses"] = [];
let keptCourseIds: ReadonlySet<string> = new Set();

const deps: SyncDeps = {
  fetchPage,
  parseHtml: (source, html, page) => parseHtml(source as ParserId, html, page),
  parseGradescopeDashboard,
  parseSmartPhysicsCourses,
  runAdapter: runAdapterInOffscreen,
  enabledAdapters,
  keptCourses: () => keptCourseIds,
  reportSetAsideCourses: (courses) => {
    lastSetAsideCourses = courses;
  },
  now: () => new Date().toISOString(),
};

/**
 * §4.5: refresh the adapter registry once a day.
 *
 * A bad remote file is rejected and the previous copy stays — that is the whole
 * safety property, since this is remote data driving what the extension fetches.
 * Failure is non-blocking: the sync it precedes must still run.
 */
/**
 * §4.5: "The built-in `adapters/registry.json` is bundled with the extension."
 *
 * It is the baseline the daily GitHub refresh *replaces*, not an afterthought —
 * and until this existed the bundled file was copied into `dist/` and never
 * read, so with no published registry to fetch the adapter list stayed empty
 * and no course site could be enabled at all.
 */
async function seedRegistryFromBundle(): Promise<void> {
  try {
    const response = await fetch(chrome.runtime.getURL("adapters/registry.json"));
    const { adapters, rejected } = validateRegistry(await response.text());
    for (const line of rejected) console.warn(`[registry] bundled entry rejected: ${line}`);
    if (adapters.length === 0) return;

    // Queued, and the read is inside the hold with the write: the queue is
    // strictly exclusive now, so load-change-save is atomic only when the load
    // is in the same section (worker rule 4).
    await withStore(async () => {
      const store = await loadStore();
      if (!shouldSeedFromBundle(store.registry.adapters, adapters)) {
        // Said out loud. Returning silently here made a healthy store and a seed
        // that never ran look identical in the console, which is the difference
        // between "tick the box" and "the fix is broken".
        console.log(
          `[registry] bundle not seeded: ${store.registry.adapters.length} adapter(s) already stored`,
        );
        return;
      }
      // No `fetchedAt`: seeding must not look like a refresh, or the daily window
      // would suppress the first real fetch for 24 hours.
      store.registry = { ...store.registry, adapters };
      await saveStore(store);
      console.log(`[registry] seeded ${adapters.length} bundled adapter(s)`);
    }, "registry: seed");
  } catch (err) {
    console.warn("[registry] could not read the bundled registry:", err);
  }
}

async function maybeRefreshRegistry(): Promise<void> {
  await seedRegistryFromBundle();
  const store = await loadStore();
  // Seeding deliberately leaves `fetchedAt` unset so the first real refresh is
  // not suppressed for a day — which left a *failing* refresh retrying on every
  // sync, inside the store queue, for a URL that is not published yet. The
  // attempt is timestamped separately so a failure rests without a success ever
  // being faked.
  const last = Math.max(
    store.registry.fetchedAt ? Date.parse(store.registry.fetchedAt) : 0,
    store.registry.attemptedAt ? Date.parse(store.registry.attemptedAt) : 0,
  );
  if (Number.isFinite(last) && Date.now() - last < REGISTRY_REFRESH_MS) return;

  try {
    const response = await fetch(REGISTRY_URL, {
      cache: "no-store",
      // No cookies: this is a public file and has no business seeing any.
      credentials: "omit",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`registry fetch: ${response.status}`);
    const { adapters, rejected } = validateRegistry(await response.text());
    for (const line of rejected) console.warn(`[registry] rejected ${line}`);

    await withStore(async () => {
      const fresh = await loadStore();
      fresh.registry = { fetchedAt: new Date().toISOString(), adapters };
      await saveStore(fresh);
    }, "registry: refreshed");
    console.log(`[registry] ${adapters.length} adapters, ${rejected.length} rejected`);
  } catch (err) {
    // The previous copy stays. §4.5 is explicit that this must not be fatal.
    await withStore(async () => {
      const failed = await loadStore();
      failed.registry = { ...failed.registry, attemptedAt: new Date().toISOString() };
      await saveStore(failed);
    }, "registry: attempt");
    console.warn("[registry] refresh failed, keeping the stored copy:", err);
  }
}

/**
 * Every store writer goes through one queue, and **no section holds it across a
 * fetch**.
 *
 * `chrome.storage.local.get` hands back a fresh copy, so two overlapping
 * read-modify-writes lose one side wholesale: a sync landing over a
 * notification restores the empty `notified` and §7 fires the same reminder
 * again, and a sync landing over a hide reverts it — spending one of §9 G3's
 * two corrections a semester.
 *
 * It used to say that holding the queue across a sync's fetches "delays a
 * reminder by at most one sync; that is the right trade". It was not a trade,
 * because the queue was not excluding: its re-entrancy flag stayed true across
 * every await the holder made, so a Hide pressed during those fetches ran
 * unqueued and was then overwritten by the sync's own write (worker rule 4, in
 * the primitive written to prevent it). The queue is strictly exclusive now, so
 * the obligation moved here: every section below is a load, a change and a save,
 * and anything that fetches does it between two sections. `core/queue.ts` names
 * a section that outstays `SLOW_HOLD_MS`, which is the only way a section that
 * asks for the queue again — a permanent deadlock — says anything at all.
 */
const withStore = createStoreQueue();

/** One sync at a time: two overlapping runs would race on the same store. */
let running: Promise<void> | null = null;

/**
 * A source has just been switched on, so go and read it.
 *
 * Fire and forget, deliberately: the message returns at once so the switch
 * moves under the finger, and the page learns the outcome from the store
 * change. Awaiting it would hold the click for the length of a full sync.
 *
 * Not inside the `withStore` that wrote the flag — `sync` takes the queue
 * across every fetch of a run, and starting it from inside one is a nested
 * hold nobody needs to reason about.
 */
function syncAfterEnable(what: string): Promise<unknown> {
  console.log(`[sources] ${what} switched on — reading it now`);
  return sync("manual").catch((err: unknown) => {
    console.warn(`[sources] the sync after switching on ${what} failed:`, err);
  });
}

/**
 * Published so the pages can say "checking" about a sync they did not start.
 *
 * `storage.session` rather than `local`: this is true for the life of the
 * worker and meaningless after it, which is exactly that storage's lifetime —
 * and a crashed worker cannot leave a page spinning forever on a flag written
 * to disk.
 */
const SYNCING_KEY = "illini-dash.syncing";
/**
 * When a page last finished loading on each source's own site.
 *
 * In `storage.session` so the *pages* can read it too: the popup re-checks on
 * open, and it has to apply the same "has anything happened" rule the worker
 * does, or the two disagree about whether an attempt is out of date. Session
 * scope is the right lifetime — a navigation from a previous browser session
 * says nothing about this one's cookies.
 */
const NAVIGATED_KEY = "illini-dash.navigated";

async function readNavigated(): Promise<NavigatedAt> {
  const stored = await chrome.storage.session.get(NAVIGATED_KEY).catch(() => undefined);
  const value = stored?.[NAVIGATED_KEY];
  return typeof value === "object" && value !== null ? (value as NavigatedAt) : {};
}

async function setSyncing(value: boolean): Promise<void> {
  await chrome.storage.session.set({ [SYNCING_KEY]: value }).catch(() => undefined);
}

async function sync(trigger: SyncTrigger): Promise<{ skipped: boolean }> {
  if (running) {
    await running;
    return { skipped: true };
  }
  let skipped = false;
  void setSyncing(true);
  running = (async () => {
    // Outside every hold, because it fetches: `syncOnce` below is the rule for
    // everything in this worker now — read in a short section, fetch with the
    // queue free, write in a short section.
    await maybeRefreshRegistry();

    const result = await syncOnce(trigger, deps, {
      withStore,
      load: loadStore,
      save: saveStore,
      onPlanned: (store) => {
        // Read before the fetches run: the loop is pure over its deps.
        keptCourseIds = new Set(store.overrides.keptCourses);
        lastSetAsideCourses = store.setAsideCourses;
      },
      // §4.1's term filter ran during the fetches and its result has to outlive
      // them; the loop must not write the store itself (worker rule 4).
      beforeSave: (fresh) => {
        fresh.setAsideCourses = lastSetAsideCourses;
      },
    });
    skipped = result.skipped;
    if (!result.skipped) {
      // §7's alarms are derived from the item list, so they are rebuilt whenever
      // it changes — a deadline that moved, or an item that was submitted,
      // must not leave a stale reminder armed. Outside the hold: `reschedule`
      // reaches `fireNotification`, which takes the queue itself, and a section
      // that asks for the queue again never returns.
      await reschedule();
      for (const outcome of result.outcomes) {
        console.log(
          `[sync] ${outcome.source}: ${outcome.state} (${outcome.items.length} items, ` +
            `${outcome.requests} requests` +
            // A source that was resting has no duration, and printing "0.0s"
            // for it would read as "answered instantly" — the opposite of what
            // happened, which is that it was never asked.
            (outcome.ms === undefined ? "" : `, ${(outcome.ms / 1000).toFixed(1)}s`) +
            `)` +
            (outcome.error ? ` — ${outcome.error}` : ""),
        );
      }
    }
    /*
     * Piazza, after the loop and with the queue free.
     *
     * Not part of `runSync`: it contributes no `RawItem`, so putting it in the
     * loop would give it an outcome row and a health dot the loop does not know
     * how to fill. It runs here because it is a *fetch on the sync schedule* —
     * and it is a fetch, which is why it may not be inside a hold. It is still
     * awaited, so `syncing` stays true until its writes have landed, and it
     * decides for itself whether the popup's debounce applies (`planPiazza`).
     */
    await runPiazza(trigger).catch((err: unknown) => {
      console.warn("[piazza] the run itself failed:", err);
    });
  })().finally(() => {
    void setSyncing(false);
    running = null;
  });
  await running;
  /*
   * The calendar follows the list, and follows it after the sync has written.
   *
   * `gcalPush` takes the queue for each of its own writes. Started from inside
   * a section it would deadlock against it, and started before the apply it
   * would project the pre-sync list; started here it reads what this sync just
   * wrote.
   */
  if (!skipped) gcalPushAfter("sync");
  return { skipped };
}

/**
 * §7: one alarm per (item, lead), so a pending reminder survives the worker
 * being torn down. Alarms for items that no longer exist are cleared, or a
 * deadline the student already dealt with would fire days later.
 */
/**
 * Paint the toolbar icon (§9 G4: "every parse error surfaced in the UI").
 *
 * Every decision — failure outranks the count, pending shows nothing, which
 * items are urgent — is in `core/health.ts`; this only calls `chrome.action`,
 * per worker house rule 1. Refreshed from `reschedule`, which is the hook every
 * path that changes items or source health already goes through.
 *
 * The count is "today or overdue", so it drifts after local midnight until the
 * next sync. That is at most one poll interval (default 30 min) and costs a
 * dedicated midnight alarm to fix, which is not worth a worker path.
 */
/**
 * Whether Chrome will actually show this extension's notifications.
 *
 * One click on "Turn off notifications from Illini Dash" in any toast sets this
 * to `denied`, and from then on `notifications.create` resolves normally while
 * showing nothing. Every reminder surface in the extension went on looking
 * healthy — this is what lets the UI say otherwise.
 */
async function notificationsBlocked(): Promise<boolean> {
  try {
    // Callback form: this API is not promisified in the @types/chrome version
    // pinned here, and calling it as a promise returns undefined, which would
    // compare unequal to "granted" and report every install as blocked.
    const level = await new Promise<string>((resolve) => {
      chrome.notifications.getPermissionLevel((value) => resolve(String(value)));
    });
    return level !== "granted";
  } catch {
    // Never let a probe failure decide that reminders are broken.
    return false;
  }
}

async function refreshBadge(): Promise<void> {
  const store = await loadStore();
  const badge = badgeFor(store.items, store.sources, store.settings, new Date());
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setTitle({ title: badge.title });
}

async function reschedule(): Promise<void> {
  const store = await loadStore();
  await refreshBadge();
  const planned = planNotifications(store.items, store.settings, new Date());
  const wanted = new Set(planned.map((p) => p.alarmName));

  for (const alarm of await chrome.alarms.getAll()) {
    if (alarm.name.startsWith("notify:") && !wanted.has(alarm.name)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  for (const plan of planned) {
    // `fireAt` already carries the quiet-hours deferral, *including* for §7's
    // "Chrome was closed" catch-up — which is precisely the case it was computed
    // for. Branching on `overdue` instead threw that away and woke people at
    // 02:30 with a reminder whose moment had passed while they slept.
    if (shouldFireNow(plan, new Date())) await fireNotification(plan.itemId, plan.lead);
    else await chrome.alarms.create(plan.alarmName, { when: Date.parse(plan.fireAt) });
  }
}

async function fireNotification(itemId: string, lead: Lead): Promise<void> {
  return withStore(async () => {
  const store = await loadStore();
  const item = store.items.find((candidate) => candidate.id === itemId);
  // The item may have been submitted, hidden or purged since the alarm was set.
  if (!item) return;
  const plan = planNotifications([item], store.settings, new Date()).find(
    (candidate) => candidate.lead === lead,
  );
  if (!plan) return;

  // A notification the browser will not show is not a notification. Stamping
  // `notified` after a dropped `create()` is how one click on "Turn off
  // notifications from Illini Dash" silences every future reminder for good:
  // each lead is marked delivered, never replanned, and every health surface
  // goes on reporting the extension fine. Leaving it unstamped keeps the
  // reminder pending, so it fires the moment notifications are allowed again.
  if (await notificationsBlocked()) {
    console.warn(
      `[notify] Chrome is blocking notifications; "${item.title}" (${lead}) stays pending`,
    );
    return;
  }

  const content = notificationContent(item, lead, new Date());
  const notificationId = `${itemId}:${lead}:${Date.now()}`;
  notificationTargets.set(notificationId, content.url);
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon128.png"),
    title: content.title,
    message: content.message,
    // Chrome's small third line: which site this came from. A student with five
    // sources had to open the popup to find out where to go and do the thing.
    ...(content.contextMessage ? { contextMessage: content.contextMessage } : {}),
  });

  const at = new Date().toISOString();
  item.notified = { ...item.notified, [lead]: at };
  // The leads this one replaced are recorded as handled without a toast of
  // their own, or the next pass plans them again and the burst returns one
  // reminder at a time.
  for (const replaced of plan.superseded) item.notified[replaced] = at;
  console.log(
    `[notify] fired ${lead} for "${item.title}"` +
      (plan.superseded.length > 0 ? ` (superseding ${plan.superseded.join(", ")})` : ""),
  );
  await saveStore(store);
  });
}

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    // MV3 tears the idle worker down within ~30s of the toast appearing, so this
    // Map is usually empty by the time a click lands. The id starts with the
    // item id (16 colon-free hex characters), so the target is one load away.
    let url = notificationTargets.get(notificationId);
    if (!url) {
      const itemId = notificationId.split(":")[0]!;
      url = (await loadStore()).items.find((item) => item.id === itemId)?.url;
    }
    // Leave the toast up rather than clearing the only remaining pointer to it.
    if (!url) return;
    await chrome.tabs.create({ url });
    notificationTargets.delete(notificationId);
    await chrome.notifications.clear(notificationId);
  })();
});

/**
 * Read, change, re-derive, write.
 *
 * Every override changes what `dedupe` produces, so `items` is rebuilt in the
 * same step — otherwise the popup would show a stale grouping until the next
 * sync, which is up to two hours away. Notifications are rescheduled for the
 * same reason: hiding a row must silence its reminder now, not eventually.
 */
async function mutate(change: (store: Awaited<ReturnType<typeof loadStore>>) => void): Promise<void> {
  await withStore(async () => {
    const store = await loadStore();
    change(store);
    // `dedupeInput`, not `Object.values(store.raw)`: the student's own rows live
    // in `manualItems` so §5.4 cannot purge them, and every rebuild of the list
    // has to put them back or a hide — or a tick, or a rename — would make every
    // hand-typed deadline vanish until the next sync.
    store.items = dedupe(dedupeInput(store.raw, store.manualItems), store.overrides, {
      previous: store.items,
    });
    await saveStore(store);
  });
  await reschedule();
  // A tick, a hide or a rename changes what belongs on the calendar as surely
  // as a sync does — and the tick is the one this feature exists for. Queued,
  // not held: see the note in `sync`.
  gcalPushAfter("a change to the list");
}

/* -------------------------------------------------------------------------- */
/* Google Calendar (§8.3)                                                      */
/* -------------------------------------------------------------------------- */

/*
 * Wiring only. What goes on the calendar is `core/gcal.ts`, what each failure
 * is called is `core/gcal-auth.ts`, and the request sequence is
 * `core/gcal-client.ts`'s `pushEvents`. What is left here is the token, the
 * permission, the queue and the logging — the four things that need a browser.
 */

/** The identity calls, behind an interface so core never sees `chrome`. */
interface Identity {
  getToken(interactive: boolean): Promise<string>;
  removeToken(token: string): Promise<void>;
  clearAll(): Promise<void>;
}

const identity: Identity = {
  getToken: (interactive) =>
    new Promise<string>((resolve, reject) => {
      // Callback form, like `notifications.getPermissionLevel` above: the
      // promise form of this API is not in the pinned @types/chrome, and
      // `chrome.runtime.lastError` is the only place the *reason* appears —
      // which is the whole input to `classifyAuthFailure`.
      chrome.identity.getAuthToken({ interactive }, (token?: string) => {
        const error = chrome.runtime.lastError?.message;
        if (error) reject(new Error(error));
        else if (typeof token !== "string" || token === "") {
          reject(new Error("Chrome returned no token and no error"));
        } else resolve(token);
      });
    }),
  removeToken: (token) =>
    new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    }),
  clearAll: () =>
    new Promise<void>((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(() => resolve());
    }),
};

function gcalClientId(): string {
  try {
    const manifest = chrome.runtime.getManifest() as unknown as {
      oauth2?: { client_id?: string };
    };
    return manifest.oauth2?.client_id ?? GCAL_CLIENT_ID_PLACEHOLDER;
  } catch {
    return GCAL_CLIENT_ID_PLACEHOLDER;
  }
}

/** Writes the gcal block, through the queue like every other writer (rule 4). */
async function writeGcal(change: (gcal: StoredGcal) => void): Promise<void> {
  await withStore(async () => {
    const store = await loadStore();
    change(store.gcal);
    await saveStore(store);
  });
}

type StoredGcal = Awaited<ReturnType<typeof loadStore>>["gcal"];

/** Records a state transition and says so, both branches (worker rule 5). */
async function noteGcal(
  event: Parameters<typeof nextGcalState>[1],
  lastError?: string,
): Promise<void> {
  await writeGcal((gcal) => {
    const before = gcal.state;
    gcal.state = nextGcalState(before, event);
    gcal.lastError = lastError;
    console.log(`[gcal] ${event.kind}: ${before} → ${gcal.state}${lastError ? ` — ${lastError}` : ""}`);
  });
}

/** A `GcalError` in the vocabulary the state machine transitions on. */
function gcalEventFor(err: unknown): Parameters<typeof nextGcalState>[1] | undefined {
  if (!(err instanceof GcalError)) return undefined;
  if (err.failure === "token_invalid") return { kind: "token-invalid" };
  if (err.failure === "rate_limited") return { kind: "rate-limited" };
  if (err.failure === "calendar_missing") return { kind: "calendar-missing" };
  return undefined;
}

/**
 * One push: make sure the calendar exists, work out the diff, send it.
 *
 * **Not** held inside one `withStore` section, although it used to be: this is
 * a sequence of Google requests, and the queue is exclusive now, so holding it
 * across them would stop every click in the extension for the length of a push
 * (and deadlock against `writeGcal`). Each write below takes the queue on its
 * own and loads the store inside it, so a sync landing in the middle cannot
 * overwrite `byItemId` — which is the only record of which Google event a
 * deadline lives in. What a concurrent sync can now change under this is the
 * *item list* it projected, and the cost of that is one deadline pushed on the
 * next push rather than this one.
 *
 * `interactive` is true only from the Connect click. Everywhere else a missing
 * grant must not open a window over whatever the student is doing.
 */
async function gcalPush(reason: string, interactive = false): Promise<void> {
  {
    const store = await loadStore();
    const gcal = store.gcal;

    if (!gcal.enabled) {
      console.log(`[gcal] ${reason}: switched off, nothing pushed`);
      return;
    }
    if (!isGcalConfigured(gcalClientId())) {
      console.warn(`[gcal] ${reason}: the OAuth client id is still a placeholder (docs/gcal.md)`);
      return;
    }
    if (!(await chrome.permissions.contains({ origins: [GCAL_MATCH] }))) {
      // Not an error: the student revoked the host permission, or granted it on
      // a profile this one is not. Connect asks for it again.
      await noteGcal({ kind: "auth-failed", message: "user cancelled" }, `${GCAL_MATCH} is not granted`);
      return;
    }

    await writeGcal((g) => {
      g.state = nextGcalState(g.state, { kind: "push-started" });
    });

    let token: string;
    try {
      token = await identity.getToken(interactive);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[gcal] ${reason}: no token — ${message} (${classifyAuthFailure(message)})`);
      await noteGcal({ kind: "auth-failed", message }, message);
      return;
    }

    const attempt = async (bearer: string): Promise<void> => {
      const http: GcalHttp = { token: bearer, fetch: (input, init) => fetch(input, init) };
      let calendarId = gcal.calendarId;
      let index = new Map(Object.entries(gcal.byItemId));

      if (calendarId === undefined) {
        calendarId = await createCalendar(http);
        console.log(`[gcal] created the calendar (${calendarId})`);
        // Cosmetic, and never worth failing a push over.
        await setCalendarColor(http, calendarId).catch((err: unknown) => {
          console.warn("[gcal] the calendar colour could not be set:", err);
        });
        index = new Map();
        await writeGcal((g) => {
          g.calendarId = calendarId;
          g.byItemId = {};
        });
      } else if (index.size === 0) {
        // Adoption, not a routine cost: this runs on a reconnect or after a
        // store reset, and it is what stops a second push duplicating every
        // event that is already there.
        index = await listEvents(http, calendarId);
        console.log(`[gcal] adopted ${index.size} events already on the calendar`);
      }

      const projected = projectEvents(store.items, store.settings, store.overrides.courseNames);
      const result = await pushEvents(http, calendarId, projected, index, (line) => console.log(line));
      const at = new Date().toISOString();
      await writeGcal((g) => {
        g.byItemId = Object.fromEntries(result.index);
        // Written together and only here: worker rule 2 says the chip may say
        // "Pushed 14 events · 10:32" only from a push that returned, and this
        // is the one place that can have returned.
        g.lastPushAt = at;
        g.lastPushCount = result.total;
        g.state = nextGcalState(g.state, { kind: "pushed" });
        g.lastError = undefined;
      });
    };

    try {
      await attempt(token);
    } catch (err) {
      if (err instanceof GcalError && err.failure === "token_invalid") {
        // One retry, after throwing away the token Chrome had cached. Chrome
        // hands out a cached token without checking it, so the *first* call
        // after a revocation always fails — retrying once is the difference
        // between a self-healing hiccup and a student pressing Reconnect for
        // no reason.
        console.warn("[gcal] the cached token was refused; clearing it and retrying once");
        await identity.removeToken(token);
        try {
          const fresh = await identity.getToken(interactive);
          await attempt(fresh);
          return;
        } catch (retryErr) {
          const message = retryErr instanceof Error ? retryErr.message : String(retryErr);
          console.warn(`[gcal] the retry failed too: ${message}`);
          const event = gcalEventFor(retryErr) ?? { kind: "token-invalid" as const };
          await noteGcal(event, message);
          return;
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      const event = gcalEventFor(err);
      if (event) {
        await noteGcal(event, message);
      } else {
        // An HTTP failure with no state of its own. The connection is still
        // good, so it stays `connected` and the error rides along — a push that
        // failed for a bad body must not read as "sign in again".
        console.warn(`[gcal] ${reason}: push failed — ${message}`);
        await writeGcal((g) => {
          g.state = nextGcalState(g.state, { kind: "pushed" });
          g.lastError = message;
        });
      }
    }
  }
}

/**
 * Pushes, but only when there is a connection to push with.
 *
 * Called after every sync and after every override, so it has to be cheap and
 * silent in the overwhelmingly common case where the feature is off. Fire and
 * forget: nothing the student is waiting for depends on it, and a Google outage
 * must not hold the queue open behind a sync.
 */
function gcalPushAfter(reason: string): void {
  void gcalPush(reason).catch((err: unknown) => {
    console.warn(`[gcal] the push after ${reason} failed:`, err);
  });
}

async function applyOverride(action: import("./messages.js").OverrideAction): Promise<void> {
  let missing = false;
  let report = "";
  await mutate((store) => {
    const item = store.items.find((candidate) => candidate.id === action.itemId);
    // §0 rule 3 applied to the UI: a menu opened before a re-render closes over
    // an id that no longer exists, and reporting `ok` for a no-op leaves the
    // student thinking their correction stuck.
    if (!item) {
      // Named, with what *was* there, because "no such item" on its own cannot
      // distinguish a stale menu from an id the popup and worker disagree about
      // — and those want opposite fixes.
      console.warn(
        `[illini-dash] ${action.kind}: no item ${action.itemId}; store holds ${store.items.length}`,
      );
      missing = true;
      return;
    }
    if (action.kind === "hide" && item) store.overrides = hideItem(store.overrides, item);
    else if (action.kind === "unhide" && item) store.overrides = unhideItem(store.overrides, item);
    else if (action.kind === "split" && item) store.overrides = splitItem(store.overrides, item);
    else if (action.kind === "done" && item) store.overrides = markDone(store.overrides, item);
    else if (action.kind === "undone" && item) store.overrides = markNotDone(store.overrides, item);
    else if (action.kind === "merge" && item) {
      const other = store.items.find((candidate) => candidate.id === action.otherItemId);
      if (other) store.overrides = mergeItems(store.overrides, item, other);
      else console.warn(`[illini-dash] merge: no other item ${String(action.otherItemId)}`);
    }
    // What the override actually did, in one line: the members it was keyed to
    // and the size of the list it went into. A hide that stores nothing and a
    // hide that stores a key nothing matches look identical from the UI.
    report =
      `${action.kind} ${JSON.stringify(item.title.slice(0, 40))} ` +
      `keys=[${memberKeysOf(item).join(", ")}] ` +
      `hidden=${store.overrides.hiddenKeys.length} done=${store.overrides.doneKeys.length}`;
  });
  if (report) console.log(`[illini-dash] ${report}`);
  if (missing) {
    throw new Error(`no such item ${action.itemId} — the list changed, try again`);
  }
}

async function applySettings(patch: Partial<import("./sources/types.js").Settings>): Promise<void> {
  await withStore(async () => {
  const store = await loadStore();
  const settings = { ...store.settings, ...patch };
  // §8.2 bounds the poll interval, and §4.2 promises Gradescope no faster than
  // every 15 minutes. Clamped here as well as in migrate, because this is the
  // path a person can actually drive.
  settings.pollMinutes = Math.min(
    MAX_POLL_MINUTES,
    Math.max(MIN_POLL_MINUTES, Number(settings.pollMinutes) || store.settings.pollMinutes),
  );
  settings.quietHours = normalizeQuietHours(settings.quietHours);
  store.settings = settings;
  await saveStore(store);
  });
  await scheduleAlarm();
  await reschedule();
}

async function scheduleAlarm(): Promise<void> {
  const store = await loadStore();
  const periodInMinutes = Math.max(MIN_POLL_MINUTES, store.settings.pollMinutes);
  await chrome.alarms.create(SYNC_ALARM, { periodInMinutes });
}

/**
 * §11: "fix fast with a store update". This is what makes the fix visible now
 * rather than up to four hours from now.
 */
async function retryAfterUpdate(previousVersion: string | undefined): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  await withStore(async () => {
    const store = await loadStore();
    const stale = sourcesToRetryAfterUpdate(store);
    if (stale.length === 0) {
      // Both branches, out loud: "nothing was resting" and "the clear never
      // ran" were indistinguishable in the console, which is the ambiguity that
      // cost two rounds of Sushi's time on the registry seed (worker rule 5).
      console.log(`[update] ${previousVersion ?? "?"} → ${version}: no source was resting`);
      return;
    }
    for (const source of stale) delete store.backoffUntil[source];
    await saveStore(store);
    console.log(
      `[update] ${previousVersion ?? "?"} → ${version}: cleared backoff for ${stale.join(", ")}`,
    );
  });
}

const REPORT_MENU_ID = "report-page";

/**
 * §8.2's report flow, two clicks from the page it is about.
 *
 * It already existed and required copying a URL, opening Settings, scrolling to
 * the section and pasting. That is enough friction that a beta tester sends a
 * screenshot instead — and a screenshot cannot become a fixture, which is the
 * whole point of the flow. Restricted to the hosts the extension already reads,
 * so the menu never appears anywhere it could not act.
 */
function createReportMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: REPORT_MENU_ID,
      title: "Report this page to Illini Dash",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://canvas.illinois.edu/*",
        "https://www.gradescope.com/*",
        "https://us.prairielearn.com/*",
        "https://us.prairietest.com/*",
        "https://*.illinois.edu/*",
      ],
    });
  });
}

/**
 * Finishing a page on a source's own site is the signal that a login happened.
 *
 * This is the gap every login defect in this project has come through. Signing
 * in happens on another origin, in a tab this extension does not own, and
 * nothing crosses back — so the only prompt to look again was the student
 * returning to the popup. That made the symptom Sushi reported on the clean run
 * exactly what it was: *"gradescope and prairietest dont sync until i click on
 * smth in them after signing in."* The click was not completing the session; it
 * was producing the trip back that finally made us ask.
 *
 * `tabs.onUpdated` is the event we were missing, and it needs no new permission:
 * Chrome only reveals a tab's URL to an extension that already holds a host
 * permission for it, so this sees the five sites the student switched on and
 * nothing else — not history, not other tabs, not the SSO hosts in between,
 * which is also why waiting for the *final* landing is the right moment.
 *
 * It fires on every completed navigation rather than only the first, which is
 * what makes it correct whichever way the session actually settles: if the
 * cookie is live at the redirect we catch it there, and if the site needs one
 * more click we catch that too.
 *
 * `sourcesToRecheck` is what keeps this from being a fetch per page view — it
 * answers only for a source that is *currently* waiting on a login, and it
 * holds the debounce.
 */
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const url = tab.url ?? changeInfo.url;
  if (!url) return;
  void (async () => {
    const store = await loadStore();
    /*
     * Piazza first, and by its own rule.
     *
     * `sourcesToRecheck` does this job for the five `Source`s and is keyed by
     * `Source`, which Piazza deliberately is not — so `core/piazza.ts` carries
     * the same decision rather than `health.ts` growing a second key space.
     * The navigation *is* the evidence: nothing else tells this extension that
     * a sign-in happened, because it happens in a tab it does not own.
     */
    if (url.startsWith(`${PIAZZA_ORIGIN}/`) && piazzaNeedsRecheck(store.observers.piazza, Date.now())) {
      console.log("[piazza] a piazza.com page finished loading while we were waiting on a sign-in — re-reading");
      await runPiazza("manual").catch((err: unknown) => {
        console.warn("[piazza] the re-read after a page load failed:", err);
      });
    }
    const hosts = allAdapters(store)
      .filter((adapter) => store.enabledAdapters.includes(adapter.id))
      .map((adapter) => new URL(adapter.url).hostname);
    const source = sourceForUrl(url, hosts);
    if (!source) return;
    // Recorded *before* the decision, and the decision is then made with it:
    // this navigation is itself the evidence that the last attempt is stale,
    // which is what lets it through the debounce.
    const navigated: NavigatedAt = { ...(await readNavigated()), [source]: Date.now() };
    await chrome.storage.session.set({ [NAVIGATED_KEY]: navigated }).catch(() => undefined);
    if (!sourcesToRecheck(store.sources, Date.now(), navigated).includes(source)) return;
    // Both branches would otherwise be one silence (worker rule 5): "a page
    // finished on a site we were waiting for" and "the listener never ran".
    console.log(`[illini-dash] ${source} finished loading in a tab — re-reading it`);
    /*
     * "recheck", not "manual". §6's ladder gives way to both, because this
     * navigation is evidence about *this* source — but Piazza is read on the
     * back of the same sync, and a page load on Gradescope is no evidence at
     * all about Piazza. Passed through as "manual" it refetched a resting
     * Piazza on every page view of every other site, so the ladder never held
     * for a student who uses them (`piazzaTrigger`).
     */
    await sync("recheck").catch((err: unknown) => {
      console.warn(`[illini-dash] the sync after ${source} loaded failed:`, err);
    });
  })();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== REPORT_MENU_ID || !info.pageUrl) return;
  // Handed to the options page in the fragment, which never leaves the browser.
  // The page validates it again before using it: this is untrusted input, and
  // the options page is where a bad URL would be acted on.
  const target = chrome.runtime.getURL(`options.html#report=${encodeURIComponent(info.pageUrl)}`);
  void chrome.tabs.create({ url: target });
});

/**
 * The full view, in the tab it is already in.
 *
 * Every click on Month, and every click on "Open in a tab", called
 * `chrome.tabs.create` — so a student who checked the month four times had four
 * Illini Dash tabs. The popup cannot fix this itself: it is destroyed the moment
 * it loses focus, so it has nowhere to remember the tab it opened.
 *
 * The id lives in `chrome.storage.session`, which is exactly its lifetime: a
 * tab id means nothing after the browser restarts, and session storage is gone
 * by then too. No new permission — `tabs.get` and `tabs.update` work on an id
 * you already hold, and the `tabs` permission (which the store listing says is
 * not requested) is only needed to *search* for tabs or read their URLs.
 */
const FULL_VIEW_TAB = "fullViewTabId";

async function openFullView(): Promise<void> {
  const url = chrome.runtime.getURL("popup.html?view=full");
  let remembered: unknown;
  try {
    remembered = (await chrome.storage.session.get(FULL_VIEW_TAB))[FULL_VIEW_TAB];
  } catch {
    // Session storage unavailable. Opening a second tab is a worse outcome than
    // it used to be, not a new one.
  }

  if (typeof remembered === "number") {
    try {
      const tab = await chrome.tabs.get(remembered);
      // `tab.url` is redacted without the `tabs` permission, so it is checked
      // only when present: a tab the student navigated elsewhere must not be
      // yanked back, and an undefined url is not evidence that they did.
      if (tab.url === undefined || tab.url.startsWith(chrome.runtime.getURL("popup.html"))) {
        await chrome.tabs.update(remembered, { active: true });
        if (tab.windowId !== undefined) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
        console.log(`[full-view] focused the tab already open (${remembered})`);
        return;
      }
      console.log(`[full-view] tab ${remembered} is showing something else now`);
    } catch {
      // Both branches logged, because "it was closed" and "the lookup never ran"
      // are otherwise the same silence (worker rule 5).
      console.log(`[full-view] tab ${remembered} is gone`);
    }
  } else {
    console.log("[full-view] no tab remembered");
  }

  const created = await chrome.tabs.create({ url });
  if (created.id !== undefined) {
    await chrome.storage.session.set({ [FULL_VIEW_TAB]: created.id }).catch(() => undefined);
  }
}

/* ---- Page observers (§4.6) ------------------------------------------------
 *
 * A content script this extension registers at runtime rather than declaring in
 * the manifest, because the host is optional: nothing about Campuswire is asked
 * for at install, and the script cannot exist until the student has switched it
 * on and Chrome has granted the origin. `chrome.*` calls only — what the script
 * reads and what it sends is `core/campuswire.ts`'s.
 */

/**
 * Partial, because not every observer is a content script.
 *
 * Piazza is fetched by this worker on the sync schedule (Sushi: "background
 * source, no page needed"), so it registers nothing and injects nothing — its
 * switch is the permission and the poll, and `runPiazza` below is its whole
 * runtime. Written as a lookup that may miss rather than as a second id union,
 * so adding a third observer of either kind stays one entry.
 */
const OBSERVER_SCRIPT: Partial<Record<ObserverId, { id: string; js: string; match: string }>> = {
  campuswire: {
    id: "campuswire-observer",
    js: "campuswire-observer.js",
    match: CAMPUSWIRE_MATCH,
  },
};

/**
 * Register or unregister one observer's content script, to match the store.
 *
 * Every branch logged (worker rule 5): "it is on and registered", "it is on and
 * the permission is gone" and "this never ran" are otherwise the same silence
 * in the worker's console, and they want three different answers.
 */
async function applyObserver(observer: ObserverId, enabled: boolean): Promise<void> {
  const script = OBSERVER_SCRIPT[observer];
  if (script === undefined) {
    // Both branches (worker rule 5): "this observer has no script by design"
    // and "the registration silently did nothing" are the same silence
    // otherwise, and the second is a bug.
    console.log(`[observer] ${observer}: ${enabled ? "on" : "off"}, no content script — it is fetched by the worker`);
    return;
  }
  const registered = await chrome.scripting
    .getRegisteredContentScripts({ ids: [script.id] })
    .catch(() => []);
  const already = registered.length > 0;

  if (!enabled) {
    if (!already) {
      console.log(`[observer] ${observer}: off, nothing registered`);
      return;
    }
    await chrome.scripting.unregisterContentScripts({ ids: [script.id] });
    console.log(`[observer] ${observer}: unregistered ${script.id}`);
    return;
  }

  // The switch is in the store, but the permission is Chrome's and the student
  // can revoke it from chrome://extensions without this extension hearing. A
  // registration without it would silently never inject.
  const granted = await chrome.permissions.contains({ origins: [script.match] });
  if (!granted) {
    console.warn(
      `[observer] ${observer}: switched on, but ${script.match} is not granted — ` +
        `nothing will be read until it is allowed again in settings`,
    );
    if (already) await chrome.scripting.unregisterContentScripts({ ids: [script.id] });
    return;
  }
  if (already) {
    console.log(`[observer] ${observer}: already registered as ${script.id}`);
    return;
  }
  await chrome.scripting.registerContentScripts([
    {
      id: script.id,
      matches: [script.match],
      js: [script.js],
      runAt: "document_idle",
    },
  ]);
  console.log(`[observer] ${observer}: registered ${script.id} for ${script.match}`);
}


/* ---- Piazza (§4.6, fetched) ------------------------------------------------
 *
 * The one observer this worker fetches for. Everything with a decision in it —
 * which classes to poll, what a response means, what the row may claim — is in
 * `core/piazza.ts`; what is here is the cookie, the two requests and the write,
 * which is all worker house rule 1 leaves in this file.
 */

/** Read once per run and echoed as `CSRF-Token`; `HttpOnly`, so only this API sees it. */
async function piazzaToken(): Promise<string | undefined> {
  try {
    const cookie = await chrome.cookies.get({ url: PIAZZA_ORIGIN, name: PIAZZA_SESSION_COOKIE });
    const value = cookie?.value;
    return value === undefined || value === "" ? undefined : value;
  } catch (err) {
    console.warn(`[piazza] the ${PIAZZA_SESSION_COOKIE} cookie could not be read:`, err);
    return undefined;
  }
}

interface PiazzaFetch {
  status: number;
  finalUrl: string;
  body: string;
}

async function piazzaFetch(url: string, init: RequestInit = {}): Promise<PiazzaFetch> {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
  return { status: response.status, finalUrl: response.url || url, body: await response.text() };
}

/** JSON, or `undefined` when the body is not JSON at all (an error page, a shell). */
function asJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** At most `MAX_CONCURRENT_PER_HOST` feeds in flight, in the order they were planned. */
async function pool<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT_PER_HOST, items.length) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        out[index] = await run(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

/** The class list off the class page, cached in the observer state for a day. */
async function piazzaClasses(nid: string | undefined): Promise<PiazzaClass[]> {
  const page = await piazzaFetch(classPageUrl(nid));
  const kind = classifyPiazzaResponse({ status: page.status, finalUrl: page.finalUrl });
  if (kind === "needs_login") throw new PiazzaNeedsLogin("the Piazza class page asked for a sign-in");
  if (kind === "http_error") {
    throw new Error(`Piazza answered ${page.status} for ${classPageUrl(nid)}`);
  }
  /*
   * Status first, then the page itself (house rules 8 and 11). Piazza serves a
   * signed-out student its **marketing splash at 200**, so the status alone
   * says "signed in" — and the splash's own login form is the positive marker
   * that says otherwise. A page with neither that form nor `const USER` is
   * neither state: it is a redesign, and saying "sign in" about it would leave
   * the row asking for a click that fixes nothing.
   */
  const shape = classifyClassPage(page.body);
  if (shape === "signed_out") {
    throw new PiazzaNeedsLogin("Piazza served its signed-out splash for the class page");
  }
  if (shape === "changed") {
    throw new Error(
      "the Piazza class page has neither the enrolment list nor the sign-in form: it changed shape",
    );
  }
  return parseClassPage(page.body, new Date()).networks;
}

/**
 * The whole post behind one feed entry, or the reason it could not be read.
 *
 * Isolated per post on purpose: a `content.get` that fails costs that post its
 * body and nothing else (parser house rule 1, one level up). What it must not
 * do is *settle* the post — the worker used to fall back to the 120-character
 * snippet, ingest that and advance both marks, so one transient 502 on a note
 * whose deadline is at character 400 cost that deadline for the term. The
 * failure is classified (`bodyFailureKind`) and `resolveBodies` decides;
 * nothing here decides anything (worker rule 1).
 */
async function piazzaBody(
  post: ObservedPost,
  entry: PiazzaPoll,
  token: string,
): Promise<BodyAttempt> {
  const attempt = { nid: post.nid, courseHint: entry.courseHint };
  let status: number | undefined;
  try {
    const request = postBodyRequest(post.cid, post.nid);
    const response = await piazzaFetch(request.url, {
      method: request.method,
      body: request.body,
      headers: { "Content-Type": "application/json", [PIAZZA_CSRF_HEADER]: token },
    });
    status = response.status;
    const json = asJson(response.body);
    const kind = classifyPiazzaResponse({
      status: response.status,
      finalUrl: response.finalUrl,
      body: json,
    });
    if (kind === "needs_login") {
      // Never settled at its snippet: if the session really has gone, every
      // body says this and the run below ends as a sign-out; if only this one
      // does, the post is read again next sync.
      return {
        ...attempt,
        post,
        failure: {
          kind: "transient",
          message: `Piazza asked for a sign-in for post ${post.nr}`,
          login: true,
        },
      };
    }
    if (kind === "http_error") {
      throw new Error(`Piazza answered ${response.status} for post ${post.nr}`);
    }
    return { ...attempt, post: withPostBody(post, parsePostBody(json, { nid: post.nid, cid: post.cid })) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A 2xx whose body is not the JSON this endpoint returns is a refusal, not
    // a hiccup: `status` is 2xx and the parse is what failed.
    const unreadable = status !== undefined && status >= 200 && status < 300;
    return { ...attempt, post, failure: { kind: bodyFailureKind(status, unreadable), message } };
  }
}

/**
 * One Piazza run at a time, whichever path asked for it.
 *
 * `sync()` has its own `running` guard, and two paths went round it: the
 * `tabs.onUpdated` re-check on piazza.com and `set-observer-enabled`. Two runs
 * put eight requests in flight at a host whose pool is four (worker rule 9),
 * both computed the same `sinceNr`, and both fetched the same bodies. A student
 * signing in clicks through five or six pages while a run is in flight, and
 * every one of them started another.
 */
let piazzaRunning: Promise<void> | null = null;

async function runPiazza(trigger: SyncTrigger): Promise<void> {
  if (piazzaRunning) {
    // Both branches (worker rule 5): "a run was already going" and "the call
    // never happened" are otherwise the same silence.
    console.log("[piazza] a run is already in flight — joining it rather than starting a second");
    await piazzaRunning;
    return;
  }
  piazzaRunning = piazzaRun(trigger).finally(() => {
    piazzaRunning = null;
  });
  await piazzaRunning;
}

/**
 * What a sync trigger means to Piazza.
 *
 * "recheck" is a page finishing on *another* source's site, and the loop treats
 * it as the student asking because it is evidence about that source. It is no
 * evidence at all about Piazza, and passing it through as "manual" is how a
 * student who browses Gradescope refetched a resting Piazza on every page load,
 * for ever — §6's ladder never held. A page load on piazza.com is different,
 * and that path asks for a manual run by name.
 */
function piazzaTrigger(trigger: SyncTrigger): "manual" | "scheduled" | "popup" {
  if (trigger === "manual") return "manual";
  if (trigger === "popup") return "popup";
  return "scheduled";
}

/** The observer block, written through the queue like every other writer. */
async function writePiazza(next: (facts: ObserverState) => ObserverState): Promise<void> {
  await withStore(async () => {
    const store = await loadStore();
    store.observers.piazza = next(store.observers.piazza);
    await saveStore(store);
  }, "piazza: state");
}

/**
 * One Piazza run: plan in a short hold, fetch with the queue free, apply in a
 * second short hold.
 *
 * It never throws at its caller: a failure is a state on the row, which is the
 * only place the student can act on it.
 */
async function piazzaRun(trigger: SyncTrigger): Promise<void> {
  const granted = await chrome.permissions.contains({ origins: [PIAZZA_MATCH] }).catch(() => false);

  /*
   * Hold 1. Read what the fetches need — and stamp the attempt that is
   * *starting*, not the one that finished. `piazzaNeedsRecheck` compares a
   * navigation against `lastAttemptAt` and `core/health.ts` says the pattern is
   * "self-limiting without a timer: once the re-check runs, lastAttemptAt is
   * newer than the navigation". Stamped at the end, that was false for the
   * whole length of a run.
   */
  const planned = await withStore(async () => {
    const store = await loadStore();
    const facts = store.observers.piazza;
    const plan = planPiazza(facts, {
      granted,
      now: new Date(),
      trigger: piazzaTrigger(trigger),
      // The plan decides what the fetch filters with (`seenPostsForFetch`); the
      // worker hands it the marks and never interprets them.
      seenPosts: store.seenPosts,
    });
    if (plan.fetch) {
      store.observers.piazza = { ...facts, lastAttemptAt: new Date().toISOString() };
      await saveStore(store);
    } else if (plan.record) {
      store.observers.piazza = {
        ...facts,
        state: plan.record.state,
        ...(plan.record.lastError === undefined ? {} : { lastError: plan.record.lastError }),
      };
      await saveStore(store);
    }
    // No `seenPosts` here on purpose: the only seen-marks view this run may
    // fetch with is `plan.seenPostsForFetch`, and a second copy in scope is how
    // the reader-2 upgrade was handed the pre-upgrade marks.
    return { plan, facts };
  }, "piazza: plan");

  const { plan, facts } = planned;
  console.log(`[piazza] ${plan.reason}`);
  if (!plan.fetch) return;

  let result: PiazzaResult;
  /** The upgrade's own line, logged outside `mutate` so the queue is not held. */
  let upgraded: string | undefined;
  let requests = 0;
  let read = 0;
  let moved = 0;
  let suggested = 0;
  let classCount = plan.poll.length;

  try {
    const token = await piazzaToken();
    if (token === undefined) {
      // Not an error: no cookie is no session, which is the state with a button.
      console.log(`[piazza] cookie missing — nobody is signed in to ${PIAZZA_ORIGIN}`);
      result = { kind: "needs_login" };
    } else {
      let classes: PiazzaClass[] | undefined;
      let poll: PiazzaPoll[] = plan.poll;
      if (plan.refreshClasses) {
        classes = await readClassList(
          facts?.classes?.[0]?.nid,
          async (nid) => {
            requests += 1;
            return piazzaClasses(nid);
          },
          (line) => console.log(`[piazza] ${line}`),
        );
        /*
         * `classesToPoll`, not a second copy of it. The list the plan was made
         * with was the stored one; this is the list that just arrived — but
         * "which classes, and from which post number" is one decision, and it
         * now has a second clause (the reader upgrade drops `sinceNr`) that a
         * copy here would silently not have (mutation rule 3).
         */
        poll = classesToPoll(classes, plan.rereadAll ? undefined : facts?.lastNr);
        console.log(`[piazza] ${classListLine(classes, poll)}`);
      }
      classCount = poll.length;

      const plannedLastNr: Record<string, number> = {};
      const floors: Record<string, number> = {};
      const payloads: {
        nid: string;
        payload: ReturnType<typeof postsToSend>["payloads"][number];
        reread?: true;
      }[] = [];

      /** Every new note from every class, for one bounded pool of body fetches. */
      const queued: { entry: PiazzaPoll; post: ObservedPost }[] = [];
      const feeds: FeedOutcome[] = [];
      const outcomes = await pool(poll, async (entry) => {
        try {
          const request = feedRequest(entry.nid);
          requests += 1;
          const response = await piazzaFetch(request.url, {
            method: request.method,
            body: request.body,
            headers: { "Content-Type": "application/json", [PIAZZA_CSRF_HEADER]: token },
          });
          const json = asJson(response.body);
          const kind = classifyPiazzaResponse({
            status: response.status,
            finalUrl: response.finalUrl,
            body: json,
          });
          if (kind === "needs_login") throw new PiazzaNeedsLogin(`${entry.nid} asked for a sign-in`);
          if (kind === "http_error") {
            throw new Error(`Piazza answered ${response.status} for ${entry.courseHint}`);
          }
          const posts = parseFeed(json, {
            nid: entry.nid,
            courseHint: entry.courseHint,
            ...(entry.courseCodes ? { courseCodes: entry.courseCodes } : {}),
            fetchedAt: new Date().toISOString(),
          });
          /*
           * `seenPosts` is handed over so a post *below* `sinceNr` that has
           * been edited since it was read can come back: the "Running Post" is
           * edited weekly and a corrected deadline in an edit is otherwise
           * something this source cannot see. The evidence is the feed entry's
           * own log, already fetched — no second request, and an unedited post
           * stays skipped.
           */
          const send = postsToSend(posts, {
            sinceNr: entry.sinceNr,
            seenPosts: plan.seenPostsForFetch,
          });
          /*
           * The bodies are **not** fetched here. `content_snipet` is the first
           * 120 characters and every deadline this class states is past them,
           * so each new note needs a second request — but a pool inside a pool
           * would be four classes times four bodies, sixteen requests at once
           * at piazza.com (worker rule 9). They are queued for one pool below.
           *
           * `postsNeedingBody` first: a post above `lastNr` may already have
           * been ingested, because an earlier sync held the mark back under a
           * body it could not read. Asking for its body again every sync for
           * the rest of the term is the repeating fetch §6 exists to stop.
           */
          const needed = postsNeedingBody(send.sent, plan.seenPostsForFetch);
          // `send.held`: the mark stays below a post refused for an unreadable
          // field, so it is offered again rather than skipped for the term.
          const batch = bodyBatch(needed.fetch, posts, MAX_BODIES_PER_SYNC, send.held);
          if (batch.deferred > 0) {
            console.log(
              `[piazza] ${entry.courseHint}: ${batch.deferred} more new note(s) deferred to the ` +
                `next sync (${MAX_BODIES_PER_SYNC} bodies per sync per class)`,
            );
          }
          if (batch.lastNr !== undefined) {
            plannedLastNr[entry.nid] = Math.max(batch.lastNr, entry.sinceNr ?? 0);
          }
          floors[entry.nid] = entry.sinceNr ?? 0;
          for (const post of batch.batch) queued.push({ entry, post });
          feeds.push({ courseHint: entry.courseHint, kind: "ok" });
          return feedLine({
            courseHint: entry.courseHint,
            feedCount: posts.length,
            toRead: batch.batch.length,
            alreadyRead: needed.alreadyRead,
            ...(plan.rereadAll === true ? { rereadAll: true } : {}),
          });
        } catch (err) {
          /*
           * Per class, so one class cannot cost the others their announcements
           * — parser house rule 1 one level up, where the "row" is a class.
           * **Including a sign-out**, which used to be raised for the whole run
           * here: Piazza answers 403 for a class you have been removed from or
           * that has been archived, and `classifyPiazzaResponse` cannot tell
           * that from an expired session, so one such class threw away every
           * other class's new notes and put "Sign in needed" — with a button
           * that fixes nothing — on a source whose other three classes had just
           * answered 200. `feedSignedOut` decides below: it is the session only
           * when *every* class says so.
           */
          if (err instanceof PiazzaNeedsLogin) {
            feeds.push({ courseHint: entry.courseHint, kind: "needs_login" });
            return `${entry.courseHint}: refused — a sign-in, or no access to this class`;
          }
          const message = err instanceof Error ? err.message : String(err);
          feeds.push({ courseHint: entry.courseHint, kind: "failed", message });
          return `${entry.courseHint}: could not be read — ${message}`;
        }
      });

      for (const line of outcomes) console.log(`[piazza] ${line}`);
      if (feedSignedOut(feeds)) throw new PiazzaNeedsLogin("every class feed asked for a sign-in");

      const classFailures = feeds
        .filter((outcome) => outcome.kind !== "ok")
        .map((outcome) => ({
          courseHint: outcome.courseHint,
          message:
            outcome.message ??
            "Piazza refused this class — you may have been removed from it, or it may be archived",
        }));

      /*
       * One pool for every new note in every class: `MAX_CONCURRENT_PER_HOST`
       * requests in flight at piazza.com, whatever the classes divide into.
       */
      const attempts = await pool(queued, ({ entry, post }) => {
        requests += 1;
        return piazzaBody(post, entry, token);
      });
      if (
        feedSignedOut(
          attempts.map((body) => ({
            courseHint: body.courseHint,
            kind: body.failure === undefined ? "ok" : body.failure.login === true ? "needs_login" : "failed",
          })),
        )
      ) {
        // Every body asked for a sign-in: that is the session, not the posts.
        throw new PiazzaNeedsLogin("every post body asked for a sign-in");
      }

      const bodies = resolveBodies(attempts);
      for (const note of bodies.notes) console.warn(`[piazza] ${note}`);
      /*
       * `lastNr` stops below every post whose body this run could not read.
       * `bodyBatch` already caps it at the batch; this caps it at the *failure*,
       * which is the half the worker used to throw away — it wrote `lastNr`
       * before a single `content.get` had been sent.
       */
      const lastNr = cappedLastNr(plannedLastNr, bodies.retry, floors);

      // Re-run over the posts as they now read: one place builds a payload, and
      // these have already passed every filter in it.
      for (const body of bodies.ingest) {
        for (const payload of postsToSend([body.post]).payloads) {
          // `reread` travels on the post, not in the payload: a `PostPayload`
          // is what every surface hands `ingestPost`, and only this source can
          // know that a post it has already read has been rewritten since.
          payloads.push({
            nid: body.nid,
            payload,
            ...(body.post.reread === true ? { reread: true as const } : {}),
          });
        }
      }
      if (attempts.length > 0) {
        console.log(
          `[piazza] ${attempts.length} new note(s): ${bodies.bodiesRead} read in full, ` +
            `${bodies.bodiesFailed} unread (${bodies.retry.length} to try again next sync)`,
        );
      }

      /*
       * One `mutate`, holding the queue across every post: this is the same
       * core function `post-observed` calls, so a post read here and a post
       * read by the Campuswire observer cannot disagree about what a post does
       * (worker rules 1 and 4). Every request is already done by here, so the
       * section is a read, a change and a write like every other one.
       */
      if (payloads.length > 0 || plan.rereadAll === true) {
        await mutate((fresh) => {
          /*
           * The reader upgrade, in the write that carries what the new reader
           * read — never before the fetch. A crash anywhere above leaves the
           * stored version alone, so the next sync runs the upgrade again
           * rather than skipping it, and the upgrade is idempotent: the second
           * sync's plan no longer asks for it.
           */
          if (plan.rereadAll === true) {
            const upgrade = readerUpgrade(fresh.seenPosts, readerVersionOf(fresh.observers.piazza));
            fresh.seenPosts = upgrade.seenPosts;
            fresh.observers.piazza = {
              ...fresh.observers.piazza,
              // Every class starts again from the bottom of its feed; the
              // results below merge this sync's capped `lastNr` onto it.
              lastNr: {},
              readerVersion: PIAZZA_READER_VERSION,
            };
            upgraded = upgrade.message;
          }
          for (const { payload, reread } of payloads) {
            const outcome = ingestPost(
              {
                items: fresh.items,
                overrides: fresh.overrides,
                suggestions: fresh.suggestions,
                seenPosts: fresh.seenPosts,
              },
              payload,
              new Date().toISOString(),
              SITE_TIMEZONE,
              { ...(reread === true ? { reread: true } : {}) },
            );
            fresh.overrides = {
              ...fresh.overrides,
              dueOverrides: { ...fresh.overrides.dueOverrides, ...outcome.dueOverrides },
            };
            fresh.suggestions = [...fresh.suggestions, ...outcome.suggestions];
            fresh.seenPosts = { ...fresh.seenPosts, ...outcome.seenPosts };
            moved += outcome.movedItems;
            suggested += outcome.suggestions.length;
            // `seenPosts` is empty exactly when the post had been read before,
            // so this counts what was new rather than what was offered.
            if (Object.keys(outcome.seenPosts).length > 0) read += 1;
          }
        });
      }
      if (upgraded !== undefined) console.log(`[piazza] ${upgraded}`);

      if (classFailures.length > 0 && classFailures.length === poll.length) {
        throw new Error(classFailures.map((failure) => `${failure.courseHint}: ${failure.message}`).join("; "));
      }
      if (classFailures.length > 0) {
        console.warn(
          `[piazza] ${classFailures.length} of ${poll.length} classes failed: ` +
            classFailures.map((failure) => `${failure.courseHint}: ${failure.message}`).join("; "),
        );
      }
      result = {
        kind: "ok",
        // Every fact the row is allowed to assert comes from this run, and
        // `requests` is the one that decides whether it may claim health at all
        // (worker rule 2).
        requests,
        classesPolled: poll.length,
        ...(classFailures.length > 0 ? { classFailures } : {}),
        bodiesRead: bodies.bodiesRead,
        bodiesFailed: bodies.bodiesFailed,
        ...(classes === undefined ? {} : { classes }),
        newPosts: read,
        // Recorded whenever posts were actually ingested, including when the
        // answer is zero — that is the number the Settings row needs in order
        // to stop reading as "working" while producing nothing (worker rule 2).
        ...(payloads.length > 0 ? { deadlines: moved + suggested } : {}),
        lastNr,
      };
    }
  } catch (err) {
    if (err instanceof PiazzaNeedsLogin) {
      console.log(`[piazza] needs login — ${err.message}`);
      result = { kind: "needs_login" };
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[piazza] could not be read: ${message}`);
      result = { kind: "error", message };
    }
  }

  /*
   * Assigned, never spread over the old facts: `applyPiazzaResult` expresses
   * its recovery contract with `delete`, and `{ ...old, ...new }` put back
   * exactly the keys it had deleted — so a sync that succeeded after four
   * failures was written `state: "ok"` with a four-hour `nextAttemptAt` still
   * on it, and Piazza then fetched nothing for four hours after the student
   * watched it work.
   */
  await writePiazza((current) => applyPiazzaResult(current, result, new Date().toISOString()));

  if (result.kind === "ok") {
    console.log(
      `[piazza] ${classCount} class${classCount === 1 ? "" : "es"}, ${result.requests} request(s), ` +
        `${read} new note${read === 1 ? "" : "s"}, ${moved} moved, ${suggested} suggested`,
    );
  }
}

/** Re-apply every observer from the store. The worker is torn down constantly. */
async function ensureObservers(): Promise<void> {
  const store = await loadStore();
  for (const observer of ALL_OBSERVERS) {
    await applyObserver(observer, store.observers[observer]?.enabled === true).catch(
      (err: unknown) => {
        console.warn(`[observer] ${observer}: could not be applied:`, err);
      },
    );
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[illini-dash] installed: ${details.reason} (build ${BUILD_ID})`);
  createReportMenu();
  if (opensOnInstall(details.reason)) {
    // The first thing that happens, before the sync: a fresh install otherwise
    // does its work silently behind an icon Chrome has not pinned, so the badge
    // is invisible to exactly the student who never opens the popup.
    console.log("[illini-dash] first install — opening the setup tab");
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?view=full") });
  } else {
    // Both branches logged (worker rule 5): "this was an update, so no tab" and
    // "the listener never ran" are otherwise the same silence.
    console.log(`[illini-dash] ${details.reason}: no setup tab`);
  }
  void ensureObservers();
  void scheduleAlarm()
    .then(() =>
      // Only on `update`. `install` has nothing resting yet, and
      // `chrome_update` did not change this extension's code.
      details.reason === "update" ? retryAfterUpdate(details.previousVersion) : undefined,
    )
    .then(() => sync("install"));
});

chrome.runtime.onStartup.addListener(() => {
  // Context menus do not survive the worker being torn down.
  createReportMenu();
  // Badge text does not survive the worker being torn down, so repaint before
  // the sync rather than only after it — otherwise a browser restart shows a
  // blank icon over a source that is still failing.
  void refreshBadge().catch(() => undefined);
  // A dynamic content script survives a browser restart, but the permission
  // behind it may not have — so this re-derives the registration from the store
  // and from `chrome.permissions.contains` rather than trusting what is there.
  void ensureObservers();
  void scheduleAlarm().then(() => sync("alarm"));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    void sync("alarm");
    return;
  }
  const notify = parseAlarmName(alarm.name);
  if (notify) {
    void fireNotification(notify.itemId, notify.lead).then(reschedule);
  }
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (r: Response) => void) => {
    const request = message as (Request & { target?: string }) | undefined;

    // Offscreen traffic is delivered here too; it is not ours (see messages.ts).
    if (request?.target === "offscreen") return false;

    if (request?.type === "ping") {
      sendResponse({ type: "pong", at: new Date().toISOString(), buildId: BUILD_ID });
      return false;
    }

    const answer = (work: Promise<Response>): true => {
      work
        .then(sendResponse)
        .catch((err: unknown) => {
          // Logged, not only returned. Every rejection here became an `error`
          // response and nothing else — so a request that failed in the worker
          // left the worker's own console completely silent, and the only trace
          // was a sentence in the page's status line. That is worker rule 5's
          // exact case: both branches of a decision the student will have to
          // debug, and this one had no branch logged at all.
          console.warn(`[illini-dash] ${String(request?.type)} failed:`, err);
          sendResponse({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        });
      return true;
    };

    if (request?.type === "gate0") {
      return answer(runGate0().then((results) => ({ type: "gate0", results }) as const));
    }
    if (request?.type === "parse-selftest") {
      return answer(runParseSelftest().then((cases) => ({ type: "parse-selftest", cases }) as const));
    }
    if (request?.type === "capture") {
      return answer(capture(request.url).then((result) => ({ type: "capture", result }) as const));
    }
    if (request?.type === "get-state") {
      return answer(
        loadStore().then(
          (store) =>
            ({
              type: "state",
              items: store.items,
              sources: store.sources,
              settings: store.settings,
              lastSyncAt: store.lastSyncAt,
              courseNames: store.overrides.courseNames,
              suggestions: store.suggestions,
            }) as const,
        ).then(async (state) => ({ ...state, notificationsBlocked: await notificationsBlocked() })),
      );
    }
    if (request?.type === "detect-adapter") {
      return answer(
        (async () => {
          const result = await capture(request.url);
          if (result.needsLogin) {
            return {
              type: "error",
              message:
                "That fetch landed on a sign-in page. Sign in to the site in this browser, then try again.",
            } as const;
          }
          const { candidates, reason } = await detectInOffscreen(
            result.body,
            new Date().toISOString(),
            SITE_TIMEZONE,
          );
          return {
            type: "detected",
            candidates,
            reason,
            url: result.finalUrl,
            courseCodeGuess: guessCourseCode(result.finalUrl),
            // Carried back only so the options page's on-device-model branch
            // has the same bytes to summarise and to validate a proposal
            // against. `htmlForAuthoring` owns the size decision; nothing here
            // decides anything (worker rule 1).
            // Stated positively: a message drops an `undefined` field with its
            // key, so an absent `html` alone cannot tell "too large" from "an
            // older worker that never sent one" (worker rule 8).
            ...(((html) =>
              html === undefined
                ? { htmlOmitted: result.body.length === 0 ? ("empty" as const) : ("too-large" as const) }
                : { html })(htmlForAuthoring(result.body))),
          } as const;
        })(),
      );
    }
    if (request?.type === "add-local-adapter") {
      return answer(
        (async () => {
          // The same trust boundary a published adapter clears. Typed by the
          // student rather than fetched from GitHub changes nothing about what
          // a bad `url` or `hostPattern` could do.
          const { adapter, reason } = validateAdapter(request.adapter);
          if (!adapter) return { type: "error", message: reason ?? "invalid adapter" } as const;

          await withStore(async () => {
            const fresh = await loadStore();
            await saveStore(withLocalAdapter(fresh, adapter));
          });
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "remove-local-adapter") {
      const { adapterId } = request;
      return answer(
        withStore(async () => {
          const fresh = await loadStore();
          await saveStore(withoutLocalAdapter(fresh, adapterId));
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    /*
     * The `manual` source. Three handlers, no decisions: `core/manual.ts`
     * validates and builds, `mutate` queues the write and rebuilds the list
     * (worker rules 1 and 4). A `ManualItemError` reaches the page through
     * `answer`'s catch as an `error` response carrying its sentence.
     */
    if (request?.type === "add-manual-item") {
      const { input } = request;
      return answer(
        (async () => {
          const item = newManualItem(input, new Date().toISOString(), SITE_TIMEZONE);
          await mutate((store) => {
            store.manualItems = [...store.manualItems, item];
          });
          console.log(
            `[manual] added ${JSON.stringify(item.title.slice(0, 40))} ` +
              `(${memberKey("manual", item.sourceId)}, due ${item.dueAt})`,
          );
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "edit-manual-item") {
      const { sourceId, input } = request;
      return answer(
        (async () => {
          let missing = false;
          await mutate((store) => {
            const existing = store.manualItems.find((item) => item.sourceId === sourceId);
            if (!existing) {
              // Both branches logged (worker rule 5): "the id is stale" and "the
              // edit never ran" are otherwise the same silence in the console.
              console.warn(
                `[manual] edit: no item ${sourceId}; store holds ${store.manualItems.length}`,
              );
              missing = true;
              return;
            }
            const updated = editManualItem(existing, input, new Date().toISOString(), SITE_TIMEZONE);
            store.manualItems = store.manualItems.map((item) =>
              item.sourceId === sourceId ? updated : item,
            );
            console.log(`[manual] edited ${memberKey("manual", sourceId)} → due ${updated.dueAt}`);
          });
          if (missing) {
            throw new Error(`no such deadline ${sourceId} — the list changed, try again`);
          }
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "delete-manual-item") {
      const { sourceId } = request;
      return answer(
        (async () => {
          await mutate((store) => {
            const before = store.manualItems.length;
            store.manualItems = store.manualItems.filter((item) => item.sourceId !== sourceId);
            // The overrides go with it, exactly as §5.4's retention prunes the
            // overrides of a purged row: a key for a row that no longer exists
            // stays armed forever and silently re-applies to anything that ever
            // reforms the same member set.
            store.overrides = withoutKeys(store.overrides, [memberKey("manual", sourceId)]);
            console.log(
              `[manual] deleted ${memberKey("manual", sourceId)} ` +
                `(${before} → ${store.manualItems.length})`,
            );
          });
          return { type: "ok" } as const;
        })(),
      );
    }
    /*
     * A post an observer read. Four handlers, no decisions: `core/suggest.ts`
     * says what the post does, `core/overrides.ts` applies it, and `mutate`
     * queues the write and rebuilds the list (worker rules 1 and 4).
     */
    if (request?.type === "post-observed") {
      const { post } = request;
      return answer(
        (async () => {
          let summary = "";
          await mutate((store) => {
            const outcome = ingestPost(
              {
                items: store.items,
                overrides: store.overrides,
                suggestions: store.suggestions,
                seenPosts: store.seenPosts,
              },
              post,
              new Date().toISOString(),
              SITE_TIMEZONE,
            );
            store.overrides = {
              ...store.overrides,
              dueOverrides: { ...store.overrides.dueOverrides, ...outcome.dueOverrides },
            };
            store.suggestions = [...store.suggestions, ...outcome.suggestions];
            store.seenPosts = { ...store.seenPosts, ...outcome.seenPosts };
            /*
             * Evidence that a page was read, which is the only thing the
             * Settings row is allowed to assert (worker rule 2). Counted here
             * rather than in the observer because the observer is a page, and a
             * page cannot be trusted to have reached the worker — the count has
             * to come from the arrival, not the departure.
             */
            const facts = store.observers[post.source as ObserverId] as
              | { enabled: boolean; lastObservedAt?: string; postsSeen?: number }
              | undefined;
            if (facts) {
              facts.lastObservedAt = new Date().toISOString();
              facts.postsSeen = (facts.postsSeen ?? 0) + 1;
            }
            // Both branches, always (worker rule 5): "the post moved nothing"
            // and "the observer never reached the worker" are otherwise the
            // same silence in the console, and they want opposite fixes.
            summary =
              `post ${post.id} (${post.source}): ` +
              `${Object.keys(outcome.dueOverrides).length} key(s) moved, ` +
              `${outcome.suggestions.length} suggested, ` +
              `${outcome.skipped.length} skipped` +
              outcome.skipped.map((entry) => `\n  - ${entry.reason}`).join("");
          });
          console.log(`[posts] ${summary}`);
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "accept-suggestion") {
      const { id } = request;
      return answer(
        (async () => {
          let missing = false;
          await mutate((store) => {
            const accepted = acceptSuggestion(store.suggestions, id, SITE_TIMEZONE);
            if (!accepted) {
              console.warn(
                `[posts] accept: no suggestion ${id}; store holds ${store.suggestions.length}`,
              );
              missing = true;
              return;
            }
            // Through `newManualItem`, never straight into `manualItems`: this
            // is the student adding a row, and a row added this way has to
            // clear exactly the bar a typed one does.
            const item = newManualItem(accepted.input, new Date().toISOString(), SITE_TIMEZONE);
            store.manualItems = [...store.manualItems, item];
            store.suggestions = accepted.suggestions;
            console.log(`[posts] added ${memberKey("manual", item.sourceId)} from suggestion ${id}`);
          });
          if (missing) {
            throw new Error(`no such suggestion ${id} — the list changed, try again`);
          }
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "dismiss-suggestion") {
      const { id } = request;
      return answer(
        mutate((store) => {
          const before = store.suggestions.length;
          store.suggestions = dismissSuggestion(store.suggestions, id);
          console.log(`[posts] dismissed ${id} (${before} → ${store.suggestions.length})`);
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "undo-move") {
      const { itemId } = request;
      return answer(
        (async () => {
          let missing = false;
          await mutate((store) => {
            const item = store.items.find((candidate) => candidate.id === itemId);
            if (!item) {
              console.warn(`[posts] undo-move: no item ${itemId}; store holds ${store.items.length}`);
              missing = true;
              return;
            }
            // The item's *current* keys: a merge since the post landed means the
            // row in front of the student holds keys the override was written to
            // and keys it was not, and only the row itself can say which.
            store.overrides = undoDueOverride(store.overrides, memberKeysOf(item));
            console.log(`[posts] undid the move on ${JSON.stringify(item.title.slice(0, 40))}`);
          });
          if (missing) throw new Error(`no such item ${itemId} — the list changed, try again`);
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "get-setup") {
      return answer(
        loadStore().then((store) => ({
          type: "setup",
          // Absent rather than an empty list: "finished" and "nothing to choose"
          // are different answers and the popup acts on them differently.
          rows: needsSetup(store) ? setupRows(store) : undefined,
        }) as const),
      );
    }
    if (request?.type === "restart-setup") {
      // Deliberately not Reset. Sushi pressed Reset to get the setup screen
      // back, which throws away every hide, merge and tick to see one page.
      // This clears the one field that decides whether the screen shows.
      return answer(
        mutate((store) => {
          store.setupDoneAt = undefined;
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "complete-setup") {
      return answer(
        mutate((store) => {
          store.setupDoneAt = new Date().toISOString();
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "get-options-state") {
      return answer(
        loadStore().then(async (store) => ({
          type: "options-state",
          settings: store.settings,
          notificationsBlocked: await notificationsBlocked(),
          sources: store.sources,
          courses: courseSummaries(store.raw, store.overrides),
          courseNames: store.overrides.courseNames,
          overrides: store.overrides,
          itemCount: store.items.length,
          hiddenItems: store.items
            .filter((item) => item.hidden)
            .map((item) => ({ id: item.id, title: item.title, courseLabel: item.courseLabel })),
          doneItems: store.items
            .filter((item) => item.done)
            .map((item) => ({ id: item.id, title: item.title, courseLabel: item.courseLabel })),
          setAsideCourses: store.setAsideCourses,
          observers: store.observers,
          gcal: store.gcal,
          lastSyncAt: store.lastSyncAt,
        }) as const),
      );
    }
    if (request?.type === "update-settings") {
      return answer(applySettings(request.settings).then(() => ({ type: "ok" }) as const));
    }
    if (request?.type === "set-observer-enabled") {
      const { observer, enabled } = request;
      return answer(
        (async () => {
          await mutate((store) => {
            const facts = store.observers[observer];
            facts.enabled = enabled;
            /*
             * Only the switch. `lastObservedAt` and `postsSeen` are deliberately
             * left where they are: they say what this observer has read, and
             * flipping a switch reads nothing. Clearing them on the way off
             * would also mean a student who toggled it twice could not tell
             * "it has never worked" from "it worked yesterday".
             */
            console.log(`[observer] ${observer}: switched ${enabled ? "on" : "off"}`);
          });
          await applyObserver(observer, enabled);
          /*
           * Read it now, not at the next poll — the same reason enabling a site
           * adapter syncs immediately. Switching Piazza on and watching the row
           * say "nothing read yet" for half an hour is indistinguishable from
           * it not working.
           */
          if (observer === "piazza" && enabled) {
            void runPiazza("manual").catch((err: unknown) => {
              console.warn("[piazza] the run after switching it on failed:", err);
            });
          }
          return { type: "ok" } as const;
        })(),
      );
    }
    /*
     * Google Calendar. Three handlers; every decision in them is a call into
     * core (worker rule 1), every write goes through `withStore` (rule 4), and
     * both branches of each are logged (rule 5).
     */
    if (request?.type === "gcal-connect") {
      return answer(
        (async () => {
          if (!isGcalConfigured(gcalClientId())) {
            return { type: "error", message: GCAL_NOT_CONFIGURED } as const;
          }
          // Verified, not requested: the options page asks synchronously inside
          // the click, because a user gesture does not survive the message hop
          // (the same constraint the adapter rows and Campuswire already have).
          if (!(await chrome.permissions.contains({ origins: [GCAL_MATCH] }))) {
            console.warn(`[gcal] connect: ${GCAL_MATCH} was not granted`);
            return { type: "permission", granted: false } as const;
          }
          await writeGcal((gcal) => {
            gcal.enabled = true;
            gcal.state = nextGcalState(gcal.state, { kind: "connect-started" });
            console.log("[gcal] connect: switched on, asking Chrome for a token");
          });
          // Interactive: this is the one path that may open a consent window.
          await gcalPush("connect", true);
          const after = await loadStore();
          console.log(`[gcal] connect finished in state ${after.gcal.state}`);
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "gcal-push-now") {
      return answer(gcalPush("push now", true).then(() => ({ type: "ok" }) as const));
    }
    if (request?.type === "gcal-disconnect") {
      return answer(
        (async () => {
          /*
           * The order matters, and it is the promise §0 rule 1's amended
           * wording makes: "turning it off deletes that calendar's events".
           * So the events go first, then the calendar, then the token, and only
           * then is the local index forgotten — forgetting it first would leave
           * a calendar full of coursework nothing could ever find again.
           */
          const store = await loadStore();
          const { calendarId, byItemId } = store.gcal;
          if (calendarId === undefined) {
            console.log("[gcal] disconnect: no calendar was ever created, nothing to remove");
          } else {
            try {
              const token = await identity.getToken(false);
              await purgeCalendar(
                { token, fetch: (input, init) => fetch(input, init) },
                calendarId,
                new Map(Object.entries(byItemId)),
                (line) => console.log(line),
              );
              await identity.removeToken(token);
            } catch (err) {
              // Said out loud and then carried on. A student who revoked the
              // grant in their Google account cannot be helped by failing here,
              // and refusing to switch off would trap them in a state whose own
              // sentence says to press this button.
              console.warn(
                "[gcal] disconnect: the calendar could not be removed from Google — " +
                  "switching off locally anyway:",
                err,
              );
            }
          }
          await identity.clearAll();
          await writeGcal((gcal) => {
            gcal.enabled = false;
            gcal.calendarId = undefined;
            gcal.byItemId = {};
            gcal.lastPushAt = undefined;
            gcal.lastPushCount = undefined;
            gcal.lastError = undefined;
            gcal.state = nextGcalState(gcal.state, { kind: "disconnected" });
            console.log("[gcal] disconnect: switched off and forgotten");
          });
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "set-source-enabled") {
      const { source, enabled } = request;
      return answer(
        mutate((store) => {
          // The decision (never `ok` without a fetch) is in core so the suite
          // can reach it; worker house rule 1.
          store.sources[source] = statusAfterEnable(store.sources[source], enabled);
          // A source switched back on should not sit out a stale backoff.
          if (enabled) delete store.backoffUntil[source];
          if (!enabled) {
            // Now, not on the next sync. The loop applies the same rule, but
            // the next loop is up to a poll interval away — and Settings
            // saying "Off" over rows the calendar still shows is the whole
            // complaint. `withoutRows` returns the store untouched when there
            // is nothing to drop.
            const trimmed = withoutRows(store, sourcePrefix(source));
            store.raw = trimmed.raw;
            store.items = trimmed.items;
            console.log(`[sources] ${source} off — dropped its rows`);
          }
        })
          .then(() => {
            if (enabled) void syncAfterEnable(source);
            return { type: "ok" } as const;
          }),
      );
    }
    if (request?.type === "open-full-view") {
      return answer(openFullView().then(() => ({ type: "ok" }) as const));
    }
    if (request?.type === "keep-course") {
      const { courseId, keep } = request;
      return answer(
        mutate((store) => {
          const kept = new Set(store.overrides.keptCourses);
          if (keep) kept.add(courseId);
          else kept.delete(courseId);
          store.overrides = { ...store.overrides, keptCourses: [...kept] };
          // Putting a course back has to take effect now, not after the next
          // Canvas sync — the student has just told us the filter was wrong.
          if (keep) {
            store.setAsideCourses = store.setAsideCourses.filter((c) => c.id !== courseId);
          }
        })
          .then(() => sync("manual"))
          .then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "set-course-name") {
      const { course, name } = request;
      return answer(
        mutate((store) => {
          store.overrides = renameCourse(store.overrides, course, name);
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "set-course-disabled") {
      const { course, disabled } = request;
      return answer(
        mutate((store) => {
          store.overrides = setCourseDisabled(store.overrides, course, disabled);
        }).then(() => ({ type: "ok" }) as const),
      );
    }
    if (request?.type === "override") {
      return answer(applyOverride(request.action).then(() => ({ type: "ok" }) as const));
    }
    if (request?.type === "export") {
      return answer(
        loadStore().then((store) => ({ type: "export", json: JSON.stringify(store, null, 2) }) as const),
      );
    }
    if (request?.type === "reset") {
      return answer(
        chrome.storage.local.clear().then(async () => {
          await chrome.alarms.clearAll();
          await scheduleAlarm();
          return { type: "ok" } as const;
        }),
      );
    }
    if (request?.type === "get-adapters") {
      return answer(
        (async () => {
          const store = await loadStore();
          const on = new Set(store.enabledAdapters);
          const term = currentTermCode(new Date());
          const adapters = await Promise.all(
            allAdapters(store).map(async (adapter) => ({
              ...adapter,
              enabled: on.has(adapter.id),
              local: store.localAdapters.some((local) => local.id === adapter.id),
              granted: await chrome.permissions.contains({ origins: [adapter.hostPattern] }),
              currentTerm: isCurrentTerm(adapter, term),
            })),
          );
          return { type: "adapters", adapters, fetchedAt: store.registry.fetchedAt } as const;
        })(),
      );
    }
    if (request?.type === "set-adapter-enabled") {
      const { adapterId, enabled } = request;
      return answer(
        (async () => {
          const store = await loadStore();
          const adapter = allAdapters(store).find((a) => a.id === adapterId);
          if (!adapter) return { type: "error", message: `unknown adapter ${adapterId}` } as const;

          if (enabled) {
            // Verified, not requested. A user gesture does not survive the
            // awaits above, and Chrome refuses `permissions.request` without
            // one — so the options page asks synchronously inside the click and
            // this only confirms the result.
            const granted = await chrome.permissions.contains({
              origins: [adapter.hostPattern],
            });
            if (!granted) return { type: "permission", granted: false } as const;
          }

          // Queued. This wrote the store directly, while sync() holds the
          // queue across every network fetch of a run — so ticking the box
          // during a sync was read, then overwritten by the sync's own copy
          // seconds later, and the checkbox sprang back with no error. That is
          // indistinguishable from "the feature is broken".
          await withStore(async () => {
            const fresh = await loadStore();
            const set = new Set(fresh.enabledAdapters);
            if (enabled) set.add(adapterId);
            else set.delete(adapterId);
            fresh.enabledAdapters = [...set];
            if (!enabled) {
              // This adapter's rows go with it, immediately. A later sync would
              // replace the whole source's rows anyway, but "later" is up to a
              // poll interval and the switch has already moved.
              const trimmed = withoutRows(fresh, adapterPrefix(adapterId));
              fresh.raw = trimmed.raw;
              fresh.items = trimmed.items;
              console.log(`[sites] ${adapterId} off — dropped its rows`);
            }
            /*
             * Enabling the first adapter is what switches the source on at all.
             *
             * Through `statusAfterEnable`, not by hand: this wrote
             * `state: "ok"` directly, which is worker rule 2's own defect —
             * a source reporting success before a single request. It was masked
             * only because `displayState` calls a source with no attempt
             * `pending` anyway; switch a site off and back on after it had run
             * once, and Settings said "Connected" over a fetch that never
             * happened.
             */
            fresh.sources.site = statusAfterEnable(
              fresh.sources.site,
              fresh.enabledAdapters.length > 0,
            );
            // §6's ladder must not outlive the thing it was punishing: a site
            // that failed while unconfigured would otherwise keep the source
            // resting for up to four hours after the user finally enables it.
            delete fresh.backoffUntil.site;
            await saveStore(fresh);
          });
          // Read it now, not at the next poll. Switching a site on and watching
          // it say "Checking…" for half an hour is indistinguishable from it
          // not working — and the first-run screen has always done this, so
          // Settings was the one place that did not.
          if (enabled) void syncAfterEnable(`site adapter ${adapterId}`);
          return { type: "permission", granted: true } as const;
        })(),
      );
    }
    if (request?.type === "get-diagnostics") {
      return answer(
        (async () => {
          const [store, permissions, alarms, blocked] = await Promise.all([
            loadStore(),
            chrome.permissions.getAll(),
            chrome.alarms.getAll(),
            notificationsBlocked(),
          ]);
          // Everything with a decision in it — what to include, what to scrub —
          // is in core/diagnostics.ts; this only gathers the chrome.* facts.
          const report = buildDiagnostics({
            store,
            buildId: BUILD_ID,
            extensionVersion: chrome.runtime.getManifest().version,
            browser: /Chrome\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? "unknown",
            grantedOrigins: permissions.origins ?? [],
            alarms: alarms.map((alarm) => alarm.name),
            notificationsBlocked: blocked,
            now: new Date(),
          });
          return { type: "diagnostics", report: JSON.stringify(report, null, 2) } as const;
        })(),
      );
    }
    if (request?.type === "test-notification") {
      return answer(
        (async () => {
          if (await notificationsBlocked()) {
            return {
              type: "error",
              message:
                "Chrome is blocking notifications from Illini Dash. Turn them back on in " +
                "chrome://settings/content/notifications, then try again.",
            } as const;
          }
          await chrome.notifications.create(`test:${Date.now()}`, {
            type: "basic",
            iconUrl: chrome.runtime.getURL("icon128.png"),
            title: "Illini Dash — test reminder",
            message: "Reminders can reach you. This is the only notification you asked for.",
          });
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "refresh-registry") {
      return answer(
        (async () => {
          await withStore(async () => {
            const store = await loadStore();
            // Force it, rather than waiting out the daily window — and past the
            // failure backoff too, since pressing the button is the user saying
            // to try again now.
            store.registry = { ...store.registry, fetchedAt: undefined, attemptedAt: undefined };
            await saveStore(store);
          });
          await maybeRefreshRegistry();
          return { type: "ok" } as const;
        })(),
      );
    }
    if (request?.type === "sync") {
      return answer(
        sync(request.trigger).then(
          ({ skipped }) => ({ type: "synced", skipped, outcomes: [] }) as const,
        ),
      );
    }

    // Answer even the messages we do not understand. Silence here reaches the
    // sender as `undefined`, which is indistinguishable from a broken channel.
    sendResponse({
      type: "error",
      message: `unknown request type ${JSON.stringify(
        (message as { type?: unknown } | null)?.type ?? null,
      )} (worker build ${BUILD_ID})`,
    });
    return false;
  },
);

console.log(`[illini-dash] service worker loaded (build ${BUILD_ID})`);
