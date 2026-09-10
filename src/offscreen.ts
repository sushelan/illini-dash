/**
 * Offscreen document (§2.1). The service worker has no DOMParser, so it ships
 * HTML here as a string; this document parses it with DOMParser — which is inert,
 * running no scripts and loading no resources — and sends plain JSON back.
 *
 * It holds no state and makes no network requests.
 */

import { getParser } from "./sources/registry.js";
import type { ParseRequest, ParseResponse } from "./messages.js";

chrome.runtime.onMessage.addListener(
  (message: ParseRequest, _sender, sendResponse: (r: ParseResponse) => void) => {
    if (message?.target !== "offscreen") return false;

    try {
      if (message.type !== "parse") throw new Error(`unknown offscreen message`);
      const doc = new DOMParser().parseFromString(message.html, "text/html");
      const items = getParser(message.parserId)(doc, message.page);
      sendResponse({ ok: true, items });
    } catch (err) {
      sendResponse({
        ok: false,
        error:
          err instanceof Error
            ? { name: err.name, message: err.message }
            : { name: "Error", message: String(err) },
      });
    }
    return false;
  },
);
