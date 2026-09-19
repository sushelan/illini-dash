/**
 * Piazza and Campuswire, as rows in the Alerts tab's Sources section.
 *
 * They used to be two bordered cards under the source list, in a shape nothing
 * else on the screen used — which said, in layout, that they were a different
 * kind of thing. They are not: they are sources, with a state derived from an
 * attempt, a sentence about what that attempt found, and one button. So they
 * are drawn as `.needsyou--source` rows, with the same dot, the same name/detail
 * stack and the same trailing action as Canvas and Gradescope.
 *
 * Every word still comes from `observerRows` (core/observer-ui.ts), which is
 * where the decisions are and where the suite can mutate them. Nothing is
 * invented here: Campuswire reads a feed the student has open rather than
 * fetching, and its wording says so unchanged.
 */

import { observerRows } from "../../core/observer-ui.js";
import { app, state } from "./state.js";
import { openOptions, showStatus } from "./shell.js";

export function renderObserverRows(now: Date): HTMLElement[] {
  return observerRows(state.currentObservers, state.observerMissing, now).map((row) => {
    const line = document.createElement("div");
    line.className = "needsyou--source";

    const dot = document.createElement("i");
    dot.className = `needsyou--dot is-${row.tone}`;

    const text = document.createElement("div");
    text.className = "needsyou--source-text";
    const name = document.createElement("div");
    name.className = "needsyou--source-name";
    name.textContent = row.name;
    const detail = document.createElement("div");
    detail.className = `needsyou--source-detail is-${row.tone}`;
    // `row.status` is the sentence an attempt produced — "On · last read 3:42 PM
    // · 12 posts", "Sign in needed", "Off". `row.detail` is what this source is
    // for, which belongs on the hover rather than on a second line in a 400px
    // window.
    detail.textContent = row.status;
    detail.title = row.detail;
    text.append(name, detail);

    line.append(dot, text);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-sm";
    button.textContent = row.label;
    button.title = row.detail;
    button.addEventListener("click", () => {
      if (row.label === "Reload instructions") showStatus(row.detail);
      else if (row.action === "configure") openOptions("sec-sources");
      else if (row.action === "retry") void app.runSync();
      else void chrome.tabs.create({ url: row.url });
    });
    line.append(button);

    return line;
  });
}
