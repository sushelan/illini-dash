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
  runAdapterInOffscreen,
} from "./core/offscreen-client.js";
import {
  REGISTRY_REFRESH_MS,
  REGISTRY_URL,
  currentTermCode,
  isCurrentTerm,
  shouldSeedFromBundle,
  validateRegistry,
} from "./core/registry.js";
import { dedupe } from "./core/dedupe.js";
import { badgeFor, statusAfterEnable } from "./core/health.js";
import { createStoreQueue } from "./core/queue.js";
import {
  courseSummaries,
  hideItem,
  mergeItems,
  setCourseDisabled,
  splitItem,
  unhideItem,
} from "./core/overrides.js";
import {
  loadStore,
  normalizeQuietHours,
  saveStore,
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
import { REQUEST_TIMEOUT_MS, runSync, type FetchedPage, type SyncDeps, type SyncTrigger } from "./core/sync.js";
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
async function enabledAdapters(): Promise<Adapter[]> {
  const store = await loadStore();
  const on = new Set(store.enabledAdapters);
  const term = currentTermCode(new Date());
  const usable: Adapter[] = [];

  for (const adapter of store.registry.adapters) {
    if (!on.has(adapter.id)) continue;
    if (!isCurrentTerm(adapter, term)) continue;
    if (await chrome.permissions.contains({ origins: [adapter.hostPattern] })) {
      usable.push(adapter);
    }
  }
  return usable;
}

const deps: SyncDeps = {
  fetchPage,
  parseHtml: (source, html, page) => parseHtml(source as ParserId, html, page),
  parseGradescopeDashboard,
  runAdapter: runAdapterInOffscreen,
  enabledAdapters,
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

async function sync(trigger: SyncTrigger): Promise<{ skipped: boolean }> {
  if (running) {
    await running;
    return { skipped: true };
  }
  let skipped = false;
  running = withStore(async () => {
    await maybeRefreshRegistry();
    const store = await loadStore();
    const result = await runSync(store, trigger, deps);
    skipped = result.skipped;
    if (!result.skipped) {
      await saveStore(result.store);
      // §7's alarms are derived from the item list, so they are rebuilt whenever
      // it changes — a deadline that moved, or an item that was submitted,
      // must not leave a stale reminder armed.
      await reschedule();
      for (const outcome of result.outcomes) {
        console.log(
          `[sync] ${outcome.source}: ${outcome.state} (${outcome.items.length} items, ${outcome.requests} requests)` +
            (outcome.error ? ` — ${outcome.error}` : ""),
        );
      }
    }
  }).finally(() => {
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

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[illini-dash] installed: ${details.reason} (build ${BUILD_ID})`);
  void scheduleAlarm().then(() => sync("install"));
});

chrome.runtime.onStartup.addListener(() => {
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
            }) as const,
        ).then(async (state) => ({ ...state, notificationsBlocked: await notificationsBlocked() })),
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
          overrides: store.overrides,
          itemCount: store.items.length,
          hiddenItems: store.items
            .filter((item) => item.hidden)
            .map((item) => ({ id: item.id, title: item.title, courseLabel: item.courseLabel })),
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
            store.registry.adapters.map(async (adapter) => ({
              ...adapter,
              enabled: on.has(adapter.id),
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
          const adapter = store.registry.adapters.find((a) => a.id === adapterId);
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
            // Enabling the first adapter is what switches the source on at all.
            fresh.sources.site = {
              ...fresh.sources.site,
              enabled: fresh.enabledAdapters.length > 0,
              state: fresh.enabledAdapters.length > 0 ? "ok" : "disabled",
            };
            // §6's ladder must not outlive the thing it was punishing: a site
            // that failed while unconfigured would otherwise keep the source
            // resting for up to four hours after the user finally enables it.
            delete fresh.backoffUntil.site;
            await saveStore(fresh);
          });
          return { type: "permission", granted: true } as const;
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
