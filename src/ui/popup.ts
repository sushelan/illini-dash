/** Popup — empty placeholder for build step 1. The real list is step 8 (§10). */

import { BUILD_ID } from "../build-info.js";
import { send } from "../messages.js";

const status = document.getElementById("status")!;

send({ type: "ping" })
  .then((resp) => {
    if (resp.type !== "pong") {
      status.textContent = "Service worker responded unexpectedly.";
      return;
    }
    status.textContent =
      resp.buildId === BUILD_ID
        ? `Service worker alive, build ${resp.buildId}.`
        : `Stale service worker: popup is build ${BUILD_ID}, worker is ${resp.buildId}. Reload the extension.`;
  })
  .catch((err: unknown) => {
    status.textContent = `Service worker unreachable: ${
      err instanceof Error ? err.message : String(err)
    }`;
  });

document.getElementById("options-link")!.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
