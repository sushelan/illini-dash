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
import { parseGradescopeDashboard, parseHtml } from "./core/offscreen-client.js";
import { dedupe } from "./core/dedupe.js";
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
  saveStore,
  MAX_POLL_MINUTES,
  MIN_POLL_MINUTES,
} from "./core/store.js";
import {
  notificationContent,
  parseAlarmName,
  planNotifications,
  type Lead,
} from "./core/schedule.js";
import { REQUEST_TIMEOUT_MS, runSync, type FetchedPage, type SyncDeps, type SyncTrigger } from "./core/sync.js";
import { runGate0 } from "./gate0.js";
import type { Request, Response } from "./messages.js";
import type { ParserId } from "./sources/registry.js";

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

const deps: SyncDeps = {
  fetchPage,
  parseHtml: (source, html, page) => parseHtml(source as ParserId, html, page),
  parseGradescopeDashboard,
  now: () => new Date().toISOString(),
};

/** One sync at a time: two overlapping runs would race on the same store. */
let running: Promise<void> | null = null;

async function sync(trigger: SyncTrigger): Promise<{ skipped: boolean }> {
  if (running) {
    await running;
    return { skipped: true };
  }
  let skipped = false;
  running = (async () => {
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
  })().finally(() => {
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
async function reschedule(): Promise<void> {
  const store = await loadStore();
  const planned = planNotifications(store.items, store.settings, new Date());
  const wanted = new Set(planned.map((p) => p.alarmName));

  for (const alarm of await chrome.alarms.getAll()) {
    if (alarm.name.startsWith("notify:") && !wanted.has(alarm.name)) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  for (const plan of planned) {
    // An overdue plan is §7's "Chrome was closed" case: fire it now rather than
    // waiting for a moment that has already gone by.
    if (plan.overdue) await fireNotification(plan.itemId, plan.lead);
    else await chrome.alarms.create(plan.alarmName, { when: Date.parse(plan.fireAt) });
  }
}

async function fireNotification(itemId: string, lead: Lead): Promise<void> {
  const store = await loadStore();
  const item = store.items.find((candidate) => candidate.id === itemId);
  // The item may have been submitted, hidden or purged since the alarm was set.
  if (!item) return;
  const stillWanted = planNotifications([item], store.settings, new Date()).some(
    (plan) => plan.lead === lead,
  );
  if (!stillWanted) return;

  const content = notificationContent(item, lead, new Date());
  const notificationId = `${itemId}:${lead}:${Date.now()}`;
  notificationTargets.set(notificationId, content.url);
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon128.png"),
    title: content.title,
    message: content.message,
  });

  item.notified = { ...item.notified, [lead]: new Date().toISOString() };
  await saveStore(store);
}

chrome.notifications.onClicked.addListener((notificationId) => {
  const url = notificationTargets.get(notificationId);
  if (url) void chrome.tabs.create({ url });
  notificationTargets.delete(notificationId);
  void chrome.notifications.clear(notificationId);
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
  const store = await loadStore();
  change(store);
  store.items = dedupe(Object.values(store.raw), store.overrides, { previous: store.items });
  await saveStore(store);
  await reschedule();
}

async function applyOverride(action: import("./messages.js").OverrideAction): Promise<void> {
  await mutate((store) => {
    const item = store.items.find((candidate) => candidate.id === action.itemId);
    if (action.kind === "hide") store.overrides = hideItem(store.overrides, action.itemId);
    else if (action.kind === "unhide") store.overrides = unhideItem(store.overrides, action.itemId);
    else if (action.kind === "split" && item) store.overrides = splitItem(store.overrides, item);
    else if (action.kind === "merge" && item) {
      const other = store.items.find((candidate) => candidate.id === action.otherItemId);
      if (other) store.overrides = mergeItems(store.overrides, item, other);
    }
  });
}

async function applySettings(patch: Partial<import("./sources/types.js").Settings>): Promise<void> {
  const store = await loadStore();
  const settings = { ...store.settings, ...patch };
  // §8.2 bounds the poll interval, and §4.2 promises Gradescope no faster than
  // every 15 minutes. Clamped here as well as in migrate, because this is the
  // path a person can actually drive.
  settings.pollMinutes = Math.min(
    MAX_POLL_MINUTES,
    Math.max(MIN_POLL_MINUTES, Number(settings.pollMinutes) || store.settings.pollMinutes),
  );
  store.settings = settings;
  await saveStore(store);
  await scheduleAlarm();
  await reschedule();
}

async function scheduleAlarm(): Promise<void> {
  const store = await loadStore();
  const periodInMinutes = Math.max(MIN_POLL_MINUTES, store.settings.pollMinutes);
  await chrome.alarms.create(SYNC_ALARM, { periodInMinutes });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[illini-due] installed: ${details.reason} (build ${BUILD_ID})`);
  void scheduleAlarm().then(() => sync("install"));
});

chrome.runtime.onStartup.addListener(() => {
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
        ),
      );
    }
    if (request?.type === "get-options-state") {
      return answer(
        loadStore().then((store) => ({
          type: "options-state",
          settings: store.settings,
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
          store.sources[source] = {
            ...store.sources[source],
            enabled,
            state: enabled ? "ok" : "disabled",
          };
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

console.log(`[illini-due] service worker loaded (build ${BUILD_ID})`);
