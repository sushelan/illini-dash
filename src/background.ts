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
import { loadStore, saveStore, MIN_POLL_MINUTES } from "./core/store.js";
import { REQUEST_TIMEOUT_MS, runSync, type FetchedPage, type SyncDeps, type SyncTrigger } from "./core/sync.js";
import { runGate0 } from "./gate0.js";
import type { Request, Response } from "./messages.js";
import type { ParserId } from "./sources/registry.js";

const SYNC_ALARM = "sync";

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
  if (alarm.name === SYNC_ALARM) void sync("alarm");
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
