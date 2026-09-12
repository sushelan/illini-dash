/**
 * First run: which sources this student actually uses.
 *
 * A fresh install opened straight onto the calendar — tabs, chips, an hour
 * grid, and nothing in it, because nothing was signed in yet. The sign-in
 * message was a sentence under a full calendar shell, which reads as "the app
 * is broken" rather than "there is one thing to do first".
 *
 * The rejected design was a gate: no calendar until every source is connected.
 * It fails four ways, and the reasons are the requirements for this one.
 *
 * 1. **Nobody uses all of them.** PrairieLearn and PrairieTest are CS and ECE;
 *    smartPhysics is PHYS 211–214 and nothing else. A gate on all five locks
 *    out every student who does not take those courses, permanently.
 * 2. **Sessions expire.** Gating the calendar on being signed in everywhere
 *    means losing it in week six when Gradescope logs you out — hiding
 *    deadlines already fetched, which is the failure §11 ranks worst.
 * 3. **Being signed in is only knowable by fetching.** The screen has to run a
 *    sync either way, so a gate saves no work; it only changes what is on
 *    screen while the sync happens.
 * 4. **Three of five sources is a useful calendar.** Refusing to draw it is
 *    worse than drawing it with a warning.
 *
 * So this is a screen, not a wall: it shows once, it remembers the answer, and
 * "show my calendar" is always clickable.
 */

import { SOURCE_HINT, SOURCE_NAME } from "./names.js";
import type { Source, SourceStatus } from "../sources/types.js";
import type { StoreV1Plus } from "./store.js";

export interface SetupRow {
  source: Source;
  label: string;
  /**
   * Who actually uses it.
   *
   * The reason the list can be edited at all: a student who does not recognise
   * "PrairieTest" cannot decide whether they need it, and a checklist that
   * cannot be answered is worse than no checklist. Unchecking something you do
   * need is the expensive mistake here, so each line says who it is for.
   */
  hint: string;
  enabled: boolean;
  status: SourceStatus | undefined;
}

/**
 * §4.5's course-site adapters are chosen individually in Settings, not here.
 *
 * The names and hints come from `core/names.ts`. They used to be written out a
 * second time in this file and a third time, without hints, on the options page
 * — so Settings listed the same five sites with nothing to say which was which.
 */
const SETUP_SOURCES: Source[] = [
  "canvas",
  "gradescope",
  "prairielearn",
  "prairietest",
  "smartphysics",
];

export function setupRows(store: StoreV1Plus): SetupRow[] {
  return SETUP_SOURCES.map((source) => ({
    source,
    label: SOURCE_NAME[source],
    hint: SOURCE_HINT[source],
    enabled: store.sources[source]?.enabled ?? false,
    status: store.sources[source],
  }));
}

/**
 * Whether the setup screen should be shown at all.
 *
 * One field, asked plainly. It used to also accept "some source has succeeded"
 * as evidence of being set up, which covered the upgrade but broke Reset: the
 * popup syncs the moment it opens, that sync succeeds because the browser is
 * still signed in, and setup completed itself a second later. The upgrade is
 * handled once in `migrate` instead, where it cannot fire twice.
 */
export function needsSetup(store: StoreV1Plus): boolean {
  return store.setupDoneAt === undefined;
}

/**
 * The sources whose login page "Sign in to everything" should open.
 *
 * Only the ones the student said they use, and only the ones that actually need
 * it: opening a tab for a site already signed in wastes the click, and opening
 * one for a source they switched off contradicts what they just told us.
 *
 * `pending` counts. On a first run nothing has been fetched yet, so every row
 * is pending and a strict "needs_login only" list would be empty at exactly the
 * moment the button exists for.
 */
export function loginsToOpen(rows: readonly SetupRow[]): Source[] {
  return rows
    .filter((row) => row.enabled)
    .filter((row) => {
      const state = row.status?.state;
      return state === "needs_login" || state === "pending" || state === undefined;
    })
    .map((row) => row.source);
}

/** How far along setup is, for the line under the checklist. */
export interface SetupProgress {
  connected: number;
  chosen: number;
  /** True once at least one chosen source has been read successfully. */
  working: boolean;
}

export function setupProgress(rows: readonly SetupRow[]): SetupProgress {
  const chosen = rows.filter((row) => row.enabled);
  const connected = chosen.filter((row) => row.status?.lastSuccessAt !== undefined).length;
  return { connected, chosen: chosen.length, working: connected > 0 };
}

/**
 * What the line under the checklist says.
 *
 * It never says "you are done" while nothing has been read, and it never
 * blocks: "show my calendar" stays clickable throughout, because a student who
 * wants to look at an empty calendar is allowed to.
 */
export function setupSummary(progress: SetupProgress): string {
  if (progress.chosen === 0) {
    return "Nothing selected yet, so there is nothing to read. Pick the sites your courses use.";
  }
  if (progress.connected === 0) {
    return `Checking ${progress.chosen} ${progress.chosen === 1 ? "site" : "sites"}. Sign in to any that ask.`;
  }
  if (progress.connected < progress.chosen) {
    return `${progress.connected} of ${progress.chosen} connected. The rest still need you to sign in.`;
  }
  return `All ${progress.chosen} connected.`;
}
