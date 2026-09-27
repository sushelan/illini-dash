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

import { SOURCE_HINT, SOURCE_NAME, STATE_WORD, nameList, stateClause } from "./names.js";
import { displayState, toneOf } from "./health.js";
import { ALL_SOURCES } from "./store.js";
import type { Source, SourceState, SourceStatus } from "../sources/types.js";
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
 * Whether an install should open the first-run screen in a tab.
 *
 * Nothing used to happen on install. The worker synced silently, and Chrome
 * leaves a new extension unpinned — so the badge, which is the only thing that
 * would ever tell a student something was due, is behind the puzzle-piece menu
 * and invisible to exactly the student who never opens the popup. A first run
 * that nobody sees is a first run that did not happen.
 *
 * **Only `install`.** `update` is the branch where this would be actively
 * wrong: Chrome updates extensions in the background, and a tab opening by
 * itself over whatever someone was reading is the behaviour that gets an
 * extension uninstalled. `chrome_update` and `shared_module_update` are not
 * this extension changing at all.
 *
 * In core with a test rather than as a comparison inside the listener, because
 * it is a decision and `background.ts` is the file the suite cannot reach.
 */
export function opensOnInstall(reason: string): boolean {
  return reason === "install";
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

/**
 * The state a setup row shows, from the same derivation every other surface
 * uses (`displayState`), with the switch on the row as the authority on
 * `enabled` — the row is what the screen drew the switch from.
 */
function shownState(row: SetupRow): SourceState {
  if (!row.enabled) return "disabled";
  return row.status ? displayState({ ...row.status, enabled: true }) : "pending";
}

/** How far along setup is, for the line under the checklist. */
export interface SetupProgress {
  /**
   * Chosen sources whose **latest** attempt read the site: `ok`, or `empty`
   * (read fine, and the site says there is nothing for this student — I46).
   *
   * It was `lastSuccessAt !== undefined`, which a source keeps through every
   * later failure, so a Canvas that read yesterday and did not answer today
   * counted as connected while the badge, the footer and the Sources tab all
   * said otherwise (sync-health #5, 2026-09-27). `empty` counts because it is
   * a successful read: a student with Canvas ok and PrairieLearn empty is
   * "All 2 connected", and anything less would send them to sign in to a site
   * they are signed in to.
   */
  connected: number;
  chosen: number;
  /** True once at least one chosen source has been read successfully. */
  working: boolean;
  /** Chosen, and the latest attempt was asked to sign in. */
  signIn: Source[];
  /** Chosen, and the latest attempt did not get an answer. */
  unreachable: Source[];
  /** Chosen, and the latest attempt got a page it could not read. */
  unreadable: Source[];
  /** Chosen, and no attempt has answered yet (or one is running now). */
  waiting: Source[];
}

export function setupProgress(
  rows: readonly SetupRow[],
  checking: (source: Source) => boolean = () => false,
): SetupProgress {
  const chosen = rows.filter((row) => row.enabled);
  const progress: SetupProgress = {
    connected: 0,
    chosen: chosen.length,
    working: false,
    signIn: [],
    unreachable: [],
    unreadable: [],
    waiting: [],
  };
  for (const row of chosen) {
    // A row being read right now has not answered this time, whatever it said
    // last time; the chip says "Checking…" and the summary must agree with it.
    const state = checking(row.source) ? "pending" : shownState(row);
    if (state === "ok" || state === "empty") progress.connected += 1;
    else if (state === "needs_login") progress.signIn.push(row.source);
    else if (state === "network_error") progress.unreachable.push(row.source);
    else if (state === "parse_error") progress.unreadable.push(row.source);
    else progress.waiting.push(row.source);
  }
  progress.working = progress.connected > 0;
  return progress;
}

/**
 * What the line under the checklist says.
 *
 * It never says "you are done" while nothing has been read, and it never
 * blocks: "show my calendar" stays clickable throughout, because a student who
 * wants to look at an empty calendar is allowed to.
 *
 * `found` is the whole point of the last branch. "All 3 connected" is a fact
 * about plumbing; "Found 43 deadlines across 6 courses" is the thing the
 * student installed this for, and it is the first evidence they get that it
 * worked. The connection count stays for every state before that, because
 * until something has been read there is nothing to count.
 *
 * **What is left is said per source, from its own last attempt** (pl-empty #5,
 * popup-live #8, 2026-09-27). It said "The rest still need you to sign in"
 * about every source not yet connected — over a PrairieLearn still being
 * checked and a PrairieTest whose page had changed, neither of which a sign-in
 * fixes. The verbs are `stateClause`'s, the footer's and the badge's.
 */
export function setupSummary(
  progress: SetupProgress,
  found?: { items: number; courses: number },
): string {
  if (progress.chosen === 0) {
    return "Nothing selected yet, so there is nothing to read. Pick the sites your courses use.";
  }
  if (progress.connected === progress.chosen) {
    if (found && found.items > 0) {
      const items = `${found.items} deadline${found.items === 1 ? "" : "s"}`;
      const courses = `${found.courses} course${found.courses === 1 ? "" : "s"}`;
      return `Found ${items} across ${courses}.`;
    }
    return `All ${progress.chosen} connected.`;
  }
  // Nothing has answered at all yet: the first run, before the first sync
  // lands. Naming five sources as "hasn't answered yet" says less than this.
  if (progress.waiting.length === progress.chosen) {
    return `Checking ${progress.chosen} ${progress.chosen === 1 ? "site" : "sites"}. Sign in to any that ask.`;
  }
  const clauses = [
    progress.signIn.length > 0 ? `Sign in to ${nameList(progress.signIn)}.` : "",
    progress.unreachable.length > 0 ? `${stateClause(progress.unreachable, "network_error")}.` : "",
    progress.unreadable.length > 0 ? `${stateClause(progress.unreadable, "parse_error")}.` : "",
    progress.waiting.length > 0 ? `${stateClause(progress.waiting, "pending")}.` : "",
  ].filter((clause) => clause !== "");
  return [`${progress.connected} of ${progress.chosen} connected.`, ...clauses].join(" ");
}

/** The chip on one row of the first-run screen. */
export interface SetupChip {
  text: string;
  /** `toneOf`'s answer; the screen maps it to a chip class. */
  tone: ReturnType<typeof toneOf>;
  /** What the site answered, for the one student who wants to know. */
  title?: string;
}

/**
 * The first-run screen's chip, derived exactly as Settings' is.
 *
 * It was an if-chain in `screens/setup.ts` that tested `lastSuccessAt` before
 * the failure states, so a Gradescope that read once on Monday and failed
 * since was a green "Connected" there while the Sources tab said "Couldn't
 * read" about it in the same second (pl-empty #4, copy-audit #2) — under a
 * comment claiming "the same chips Settings uses". It is now that derivation:
 * `displayState`, `STATE_WORD`, `toneOf`. `lastSuccessAt` is not read at all.
 *
 * Off is "Off", Settings' word (copy-audit #8). The screen had kept "Not
 * used" after PROGRESS 2026-09-19 moved the rest of it onto Settings' chips,
 * and one state with two names on two screens is what that change removed.
 *
 * `checking` is whether *this* source is being read right now (`isChecking`),
 * which outranks the stored answer: the store is written once, at the end of a
 * sync, so for the whole fetch the stored word is about the previous attempt.
 */
export function setupChip(row: SetupRow, checking: boolean): SetupChip {
  if (!row.enabled) return { text: STATE_WORD["disabled"]!, tone: "off" };
  if (checking) {
    return {
      text: STATE_WORD["pending"]!,
      tone: "pending",
      title: "Reading this site now. This can take a few seconds.",
    };
  }
  const state = shownState(row);
  const error = state === "ok" || state === "pending" ? undefined : row.status?.lastError;
  return {
    text: STATE_WORD[state] ?? state,
    tone: toneOf(state),
    ...(error ? { title: error } : {}),
  };
}

/**
 * Where the worker publishes the sources the running sync attempts.
 *
 * `chrome.storage.session`, beside `illini-dash.syncing`, as
 * `{ attempting: Source[] }` — written when the plan is made, removed when a
 * sync starts, so a page never reads the previous sync's list as this one's.
 */
export const ATTEMPTING_KEY = "illini-dash.attempting";

/**
 * The worker's list, or `undefined` when there is none to trust.
 *
 * Worker rule 8: the value was written by whichever worker is running, which
 * may be older or newer than this page. Anything that is not the expected
 * shape is "not said"; a key this build does not know is dropped.
 */
export function parseAttempting(value: unknown): Source[] | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const list = (value as { attempting?: unknown }).attempting;
  if (!Array.isArray(list)) return undefined;
  return list.filter(
    (entry): entry is Source => typeof entry === "string" && ALL_SOURCES.includes(entry as Source),
  );
}

/**
 * Whether a row is being read right now.
 *
 * Only while a sync runs, and then only the sources its plan attempts: a
 * source resting in §6's backoff is not asked, and "Checking…" on it claimed a
 * fetch that was not happening (sync-health #5). With no list from the worker
 * — an older build, or the moment between the syncing flag and the plan —
 * every row is checking, which is what the screen said before.
 */
export function isChecking(
  source: Source,
  syncing: boolean,
  attempting: readonly Source[] | undefined,
): boolean {
  if (!syncing) return false;
  return attempting === undefined ? true : attempting.includes(source);
}
