/**
 * Offscreen document (§2.1). The service worker has no DOMParser, so it ships
 * HTML here as a string; this document parses it with DOMParser — which is inert,
 * running no scripts and loading no resources — and sends plain JSON back.
 *
 * It holds no state and makes no network requests.
 */

import { currentTermCourses } from "./sources/gradescope.js";
import { getParser } from "./sources/registry.js";
import type { ParseRequest, ParseResponse } from "./messages.js";

chrome.runtime.onMessage.addListener(
  (message: ParseRequest, _sender, sendResponse: (r: ParseResponse) => void) => {
    if (message?.target !== "offscreen") return false;

    try {
      const doc = new DOMParser().parseFromString(message.html, "text/html");
      if (message.type === "parse") {
        sendResponse({ ok: true, items: getParser(message.parserId)(doc, message.page) });
      } else if (message.type === "parse-gradescope-dashboard") {
        // The dashboard yields courses, not RawItems, so it needs its own op
        // rather than being squeezed through the RawItem protocol.
        sendResponse({ ok: true, courses: currentTermCourses(doc) });
      } else {
        throw new Error("unknown offscreen message");
      }
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
