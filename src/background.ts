/**
 * Service worker. Build steps 1–3: no alarms, no sync, no storage writes yet.
 * It answers the two debug probes (Gate 0 §9, offscreen round-trip §2.1) and
 * otherwise does nothing.
 */

import { BUILD_ID } from "./build-info.js";
import { capture } from "./capture.js";
import { runGate0 } from "./gate0.js";
import { runParseSelftest } from "./core/parse-selftest.js";
import type { Request, Response } from "./messages.js";

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[illini-due] installed:", details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[illini-due] startup");
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
    if (request?.type === "gate0") {
      runGate0()
        .then((results) => sendResponse({ type: "gate0", results }))
        .catch((err: unknown) =>
          sendResponse({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async response
    }
    if (request?.type === "parse-selftest") {
      runParseSelftest()
        .then((cases) => sendResponse({ type: "parse-selftest", cases }))
        .catch((err: unknown) =>
          sendResponse({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async response
    }

    if (request?.type === "capture") {
      capture(request.url)
        .then((result) => sendResponse({ type: "capture", result }))
        .catch((err: unknown) =>
          sendResponse({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      return true; // async response
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
