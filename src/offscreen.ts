/**
 * Offscreen document (§2.1). The service worker has no DOMParser, so it ships
 * HTML here as a string; this document parses it with DOMParser — which is inert,
 * running no scripts and loading no resources — and sends plain JSON back.
 *
 * It holds no state and makes no network requests.
 */

import { currentTermCourses } from "./sources/gradescope.js";
import { parseCourseList as parseSmartPhysicsCourseList } from "./sources/smartphysics.js";
import { getParser } from "./sources/registry.js";
import { runAdapter } from "./sources/site.js";
import { noCandidateReason, searchCandidates } from "./core/detect.js";
import { repeatedStructures } from "./core/skeleton.js";
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
      } else if (message.type === "parse-smartphysics-courses") {
        // Same reason as the Gradescope dashboard: the enrolment list yields
        // courses, not RawItems.
        sendResponse({ ok: true, smartPhysicsCourses: parseSmartPhysicsCourseList(doc) });
      } else if (message.type === "run-adapter") {
        // §4.5's runner needs the adapter alongside the DOM, which the RawItem
        // protocol does not carry, so it gets its own op.
        sendResponse({ ok: true, items: runAdapter(message.adapter, doc, message.page) });
      } else if (message.type === "detect-adapter") {
        // §4.5 self-serve: propose selectors for a page nobody has an adapter
        // for. Here rather than in the worker for the same reason as every
        // other op — there is no DOMParser in a service worker.
        // The inventory is computed here and used twice: the search is a search
        // over it, and the "nothing found" sentence is read off it. Computing
        // it twice would let the two disagree about the same page.
        const structures = repeatedStructures(doc, message.timezone, message.reference);
        // One call, not `proposeCandidates` and then a second search for the
        // sentence: the refusal the search got closest with is the sentence's
        // whole content, and a second pass could refuse something else.
        const { candidates, nearest } = searchCandidates(
          doc,
          message.reference,
          message.timezone,
          structures,
        );
        sendResponse({
          ok: true,
          candidates,
          reason:
            candidates.length === 0 ? noCandidateReason(doc, structures, nearest) : undefined,
        });
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
