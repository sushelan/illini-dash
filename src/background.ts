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
import { dedupe } from "./core/dedupe.js";
import { buildDiagnostics } from "./core/diagnostics.js";
import { badgeFor, sourcesToRecheck, statusAfterEnable, type NavigatedAt } from "./core/health.js";
import { sourceForUrl } from "./core/origins.js";
import { needsSetup, opensOnInstall, setupRows } from "./core/setup.js";
import { detectInOffscreen } from "./core/offscreen-client.js";
import { guessCourseCode, SITE_TIMEZONE } from "./core/detect.js";
import { createStoreQueue } from "./core/queue.js";
import {
  courseSummaries,
  hideItem,
  markDone,
  markNotDone,
  mergeItems,
  renameCourse,
  setCourseDisabled,
  splitItem,
  unhideItem,
} from "./core/overrides.js";
import {
  loadStore,
  normalizeQuietHours,
  saveStore,
  sourcesToRetryAfterUpdate,
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
  REQUEST_TIMEOUT_MS,
  adapterPrefix,
  runSync,
  sourcePrefix,
  withoutRows,
  type FetchedPage,
  type SyncDeps,
  type SyncTrigger,
} from "./core/sync.js";
import { runGate0 } from "./gate0.js";
import type { Request, Response } from "./messages.js";
import type { ParserId } from "./sources/registry.js";
import type { Adapter } from "./sources/types.js";

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

    const fresh = await loadStore();
    fresh.registry = { fetchedAt: new Date().toISOString(), adapters };
    await saveStore(fresh);
    console.log(`[registry] ${adapters.length} adapters, ${rejected.length} rejected`);
  } catch (err) {
    // The previous copy stays. §4.5 is explicit that this must not be fatal.
    const failed = await loadStore();
    failed.registry = { ...failed.registry, attemptedAt: new Date().toISOString() };
    await saveStore(failed);
    console.warn("[registry] refresh failed, keeping the stored copy:", err);
  }
}

/**
 * Every store writer goes through one queue.
 *
 * `chrome.storage.local.get` hands back a fresh copy, so two overlapping
 * read-modify-writes lose one side wholesale: a sync landing over a
 * notification restores the empty `notified` and §7 fires the same reminder
 * again, and a sync landing over a hide reverts it — spending one of §9 G3's
 * two corrections a semester. Holding the queue across a sync's fetches delays
 * a reminder by at most one sync; that is the right trade.
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
  running = withStore(async () => {
    await maybeRefreshRegistry();
    const store = await loadStore();
    // Read before the loop runs, written after: the loop is pure over its deps.
    keptCourseIds = new Set(store.overrides.keptCourses);
    lastSetAsideCourses = store.setAsideCourses;
    const result = await runSync(store, trigger, deps);
    skipped = result.skipped;
    if (!result.skipped) {
      result.store.setAsideCourses = lastSetAsideCourses;
      await saveStore(result.store);
      // §7's alarms are derived from the item list, so they are rebuilt whenever
      // it changes — a deadline that moved, or an item that was submitted,
      // must not leave a stale reminder armed.
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
  }).finally(() => {
    void setSyncing(false);
    running = null;
  });
  await running;
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
    store.items = dedupe(Object.values(store.raw), store.overrides, { previous: store.items });
    await saveStore(store);
  });
  await reschedule();
}

async function applyOverride(action: import("./messages.js").OverrideAction): Promise<void> {
  let missing = false;
  await mutate((store) => {
    const item = store.items.find((candidate) => candidate.id === action.itemId);
    // §0 rule 3 applied to the UI: a menu opened before a re-render closes over
    // an id that no longer exists, and reporting `ok` for a no-op leaves the
    // student thinking their correction stuck.
    if (!item) {
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
    }
  });
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
    await sync("manual").catch((err: unknown) => {
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
        .catch((err: unknown) =>
          sendResponse({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
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
            fresh.localAdapters = [
              ...fresh.localAdapters.filter((existing) => existing.id !== adapter.id),
              adapter,
            ];
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
          fresh.localAdapters = fresh.localAdapters.filter((a) => a.id !== adapterId);
          fresh.enabledAdapters = fresh.enabledAdapters.filter((id) => id !== adapterId);
          fresh.sources.site = {
            ...fresh.sources.site,
            enabled: fresh.enabledAdapters.length > 0,
            state: fresh.enabledAdapters.length > 0 ? fresh.sources.site.state : "disabled",
          };
        }).then(() => ({ type: "ok" }) as const),
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
          lastSyncAt: store.lastSyncAt,
        }) as const),
      );
    }
    if (request?.type === "update-settings") {
      return answer(applySettings(request.settings).then(() => ({ type: "ok" }) as const));
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
