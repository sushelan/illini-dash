/**
 * Handing the student a file, and deciding what goes in it.
 *
 * Both halves were written inline in Settings, which was fine while Settings
 * was the only place that exported anything. The header button makes it two
 * places, and two copies of "which items go in the calendar" is how a filter
 * drifts: one surface exports hidden rows and the other does not, and nothing
 * says which is right.
 */

import { buildIcs } from "../core/ics.js";
import type { Item } from "../sources/types.js";

/**
 * What an export contains.
 *
 * Hidden rows are left out, because hiding one is the student saying "this is
 * not mine" — putting it in their calendar anyway is the extension overruling
 * that somewhere they cannot see it happen. Done rows stay: a finished
 * deadline is still a thing that happened, and a calendar is a record as much
 * as a plan.
 */
export function itemsToExport(items: readonly Item[]): Item[] {
  return items.filter((item) => !item.hidden);
}

export function downloadFile(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoke on the next task so the download has taken the reference.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Returns how many items were written, for the line that reports it. */
export function downloadIcs(items: readonly Item[]): number {
  const exported = itemsToExport(items);
  downloadFile("illini-dash.ics", buildIcs(exported), "text/calendar");
  return exported.length;
}
