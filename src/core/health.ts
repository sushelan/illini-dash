/**
 * What the UI is allowed to say about a source's health (§0 rule 3, §8.1).
 *
 * Every decision behind a dot, the status line, the stale banner, the toolbar
 * badge and the empty state lives here, because worker house rule 1 says the
 * service worker gets `chrome.*` calls and no judgement, and because this is
 * the exact area where the project has already shipped two defects:
 *
 *   - `syncSites` returned `[]` with nothing enabled and the loop recorded
 *     `ok`, painting a green dot over a source that fetched nothing;
 *   - `defaultStatus` seeds `state: "ok"` before a single request has been
 *     made, so a fresh install shows four green dots and "Not synced yet."
 *
 * Both are the same rule, which is worth stating once: **a green dot means "I
 * fetched, and it was fine". It never means "I have not fetched".** Anything
 * that has not been checked is `pending`, and pending is grey.
 */

import { groupItems } from "./grouping.js";
import { LOGIN_URL, SOURCE_NAME, STATE_WORD, fullStamp, nameList, timeAgo } from "./names.js";
import type { Item, Settings, Source, SourceState, SourceStatus } from "../sources/types.js";

/**
 * How long a source may go without a successful read before the popup says so.
 *
 * Twelve hours rather than a couple of poll intervals: §4.2's expired
 * Gradescope session is the case this exists for, and a student who closed the
 * laptop overnight should not be met with a warning about a source that is
 * about to succeed on the first sync of the morning.
 */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

/** States that mean "the last attempt did not produce data". */
const FAILING: ReadonlySet<SourceState> = new Set<SourceState>([
  "needs_login",
  "parse_error",
  "network_error",
]);

export function isFailing(state: SourceState): boolean {
  return FAILING.has(state);
}

/**
 * The state to *show*, as opposed to the state stored.
 *
 * `SourceStatus.state` records the outcome of the last attempt. When there has
 * been no attempt the field describes nothing, so it must not be rendered as
 * though it did — that is the fresh-install green dot. `pending` is a stored
 * state now (see `defaultStatus`), but a store written by an older build can
 * still hold `ok` with no `lastAttemptAt`, so the check is made here too rather
 * than trusted from disk.
 */
export function displayState(status: SourceStatus): SourceState {
  if (!status.enabled) return "disabled";
  if (status.state === "disabled") return "disabled";
  if (status.lastAttemptAt === undefined) return "pending";
  return status.state;
}

/**
 * The status a source should carry after the user flips its switch.
 *
 * In `core` rather than inline in the message handler because it is a decision,
 * and because it is the same decision `defaultStatus` got wrong: switching a
 * source on fetches nothing, so it cannot report `ok`. The sync that follows is
 * what earns that. Clearing `lastAttemptAt` is what makes `displayState` say
 * `pending` — a stale attempt from before the source was switched off does not
 * describe the source the user has just switched back on.
 *
 * `lastSuccessAt` is deliberately kept: it is still true that the source was
 * last read successfully then, and the stale banner needs it to say how old the
 * rows it kept are.
 */
export function statusAfterEnable(status: SourceStatus, enabled: boolean): SourceStatus {
  return {
    ...status,
    enabled,
    state: enabled ? "pending" : "disabled",
    lastAttemptAt: enabled ? undefined : status.lastAttemptAt,
  };
}

export interface HealthSummary {
  /** Sources the user has switched on and that have a plan. */
  checkable: Source[];
  ok: Source[];
  pending: Source[];
  failing: Source[];
  needsLogin: Source[];
  /** Enabled, but reporting nothing configured — e.g. no course site enabled. */
  disabled: Source[];
}

/**
 * Worker house rule 2, as a count.
 *
 * A source that is off, or on but unconfigured, is excluded from **both** sides
 * of "n of m OK" — otherwise turning PrairieTest off would make the ratio worse
 * and turning it on with nothing behind it would make it better.
 */
export function summarize(sources: Partial<Record<Source, SourceStatus>>): HealthSummary {
  const summary: HealthSummary = {
    checkable: [],
    ok: [],
    pending: [],
    failing: [],
    needsLogin: [],
    disabled: [],
  };
  for (const [key, status] of Object.entries(sources)) {
    if (!status) continue;
    const source = key as Source;
    const state = displayState(status);
    if (state === "disabled") {
      summary.disabled.push(source);
      continue;
    }
    summary.checkable.push(source);
    if (state === "ok") summary.ok.push(source);
    else if (state === "pending") summary.pending.push(source);
    else {
      summary.failing.push(source);
      if (state === "needs_login") summary.needsLogin.push(source);
    }
  }
  return summary;
}

/**
 * §8.1's status line.
 *
 * The old line read `Synced 10:32 AM` off `lastSyncAt`, which `runSync` sets
 * unconditionally — so it said "Synced" just as loudly when all four sources
 * had failed. "Checked" is the honest verb for what the loop did, and the ratio
 * is what says whether it worked.
 */
export function statusLine(
  sources: Partial<Record<Source, SourceStatus>>,
  lastSyncAt: string | undefined,
  now: Date,
): string {
  const summary = summarize(sources);
  const when = lastSyncAt === undefined ? undefined : new Date(lastSyncAt);
  const clock =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : undefined;

  if (summary.checkable.length === 0) return "No sources are switched on.";
  if (clock === undefined) return "Not checked yet.";

  const total = summary.checkable.length;
  // Pending sits with the failures here rather than with the successes: it is
  // "not known to be fine", which is the whole point of the line.
  if (summary.ok.length === total) {
    return `Checked ${clock} · all ${total} source${total === 1 ? "" : "s"} OK`;
  }
  return `Checked ${clock} · ${summary.ok.length} of ${total} sources OK`;
}

/* -------------------------------------------------------------------------- */
/* The health pill                                                             */
/* -------------------------------------------------------------------------- */

export type HealthTone = "ok" | "warn" | "err" | "pending";

export interface HealthPill {
  tone: HealthTone;
  /** The whole sentence, already named and already plain. */
  text: string;
  /**
   * The one thing clicking it should do *besides* opening the source list.
   *
   * `undefined` on a healthy pill: there is nothing to fix, and the list is
   * still worth opening.
   */
  action?: { kind: "login"; source: Source };
}

/**
 * What the popup's header says about every source, in one line.
 *
 * It replaces six 9px dots. Three things were wrong with those, and only the
 * last is about size. A dot in five colours is a colour-only signal, which is
 * the exact thing the High-contrast theme exists to avoid — and that theme was
 * the only one that gave them shapes. The one dot you could *click* (needs
 * login) looked identical to the five you could not. And the fact they encoded
 * was then written out again in words at the bottom of an 883px document, where
 * nobody scrolled to read it.
 *
 * Every branch is derived from `summarize()`, so the pill inherits worker rule
 * 2 for free: it cannot say "OK" about a source that was never fetched, because
 * `displayState` calls that one `pending` and `pending` is not `ok`.
 *
 * **Signing in outranks a parse error.** Both are failures and red is the more
 * severe colour, but `staleNotice` already sorts this way and for the same
 * reason: one of them is a thing the student can finish in ten seconds, and the
 * other is a thing only a new build can fix. Leading with the red one buries
 * the actionable half.
 */
export function healthPill(
  sources: Partial<Record<Source, SourceStatus>>,
  lastSyncAt: string | undefined,
  now: Date,
): HealthPill {
  const summary = summarize(sources);
  const when = lastSyncAt === undefined ? undefined : new Date(lastSyncAt);
  const clock =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : undefined;

  if (summary.needsLogin.length > 0) {
    const [first] = summary.needsLogin;
    return {
      tone: "warn",
      text:
        summary.needsLogin.length === 1
          ? `Sign in to ${SOURCE_NAME[first!]}`
          : `Sign in to ${summary.needsLogin.length} sites`,
      ...(LOGIN_URL[first!] ? { action: { kind: "login" as const, source: first! } } : {}),
    };
  }

  if (summary.failing.length > 0) {
    return {
      tone: "err",
      text:
        summary.failing.length === 1
          ? `${SOURCE_NAME[summary.failing[0]!]} couldn't be read`
          : `${summary.failing.length} sites couldn't be read`,
    };
  }

  // Not "all OK": nothing was checked, so there is nothing to be OK about. The
  // green dot over four sources that had never been fetched is the defect this
  // whole module was written around.
  if (summary.checkable.length === 0) {
    return { tone: "warn", text: "No sites are switched on" };
  }

  if (summary.ok.length === 0) return { tone: "pending", text: "Checking…" };

  if (summary.pending.length > 0) {
    return {
      tone: "pending",
      text: `Checking… ${summary.ok.length} of ${summary.checkable.length} read`,
    };
  }

  const total = summary.ok.length;
  const named = total === 1 ? `${SOURCE_NAME[summary.ok[0]!]} OK` : `All ${total} OK`;
  return { tone: "ok", text: clock ? `${named} · ${clock}` : named };
}

/**
 * One source, as the popover and Settings both need it.
 *
 * Both surfaces were assembling this from `displayState`, a word table and a
 * date format, separately — which is how the popup came to say "read
 * successfully" where the options page said "ok", about the same source, in the
 * same second.
 */
export interface SourceRow {
  source: Source;
  state: SourceState;
  /** Plain wording for `state`: "Connected", "Sign in needed", "Couldn't read". */
  word: string;
  /** "5 min ago", or undefined when it has never once succeeded. */
  lastRead?: string;
  /** The exact stamp, for the tooltip behind `lastRead`. */
  lastReadExact?: string;
  lastError?: string;
  /** Whether there is a login page to offer. */
  loginUrl?: string;
}

export function sourceRows(
  sources: Partial<Record<Source, SourceStatus>>,
  now: Date,
): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const [key, status] of Object.entries(sources)) {
    if (!status) continue;
    const source = key as Source;
    const state = displayState(status);
    const login = state === "needs_login" ? LOGIN_URL[source] : undefined;
    rows.push({
      source,
      state,
      word: STATE_WORD[state] ?? state,
      ...(timeAgo(status.lastSuccessAt, now) !== undefined
        ? { lastRead: timeAgo(status.lastSuccessAt, now)! }
        : {}),
      ...(fullStamp(status.lastSuccessAt) !== undefined
        ? { lastReadExact: fullStamp(status.lastSuccessAt)! }
        : {}),
      ...(status.lastError ? { lastError: status.lastError } : {}),
      ...(login ? { loginUrl: login } : {}),
    });
  }
  // Whatever is wrong first, then whatever is off last: the reason to open this
  // list is almost always one broken row, and scanning six to find it is the
  // cost the pill was supposed to remove.
  const rank: Record<SourceState, number> = {
    needs_login: 0,
    parse_error: 1,
    network_error: 2,
    pending: 3,
    ok: 4,
    disabled: 5,
  };
  return rows.sort((a, b) => rank[a.state] - rank[b.state] || a.source.localeCompare(b.source));
}

export interface StaleNotice {
  source: Source;
  /** Whole hours since the last success; undefined when there has never been one. */
  hours?: number;
  state: SourceState;
  lastError?: string;
  needsLogin: boolean;
}

/**
 * The source most worth warning about, or nothing.
 *
 * §11 calls a silently missing deadline catastrophic, and this is the shape it
 * takes in practice: a source keeps its previously fetched rows when it fails
 * (`runSync`'s failure branch does that deliberately, so the list does not go
 * blank), which means a Gradescope session that expired on Tuesday leaves a
 * list that still looks complete on Thursday. The dot alone has not been
 * enough — the first live run proved nobody is looking at it.
 *
 * A source that has never succeeded and has never been attempted is *not*
 * stale; it is pending, and saying "hasn't been read since never" to somebody
 * who installed the extension a minute ago is noise.
 */
export function staleNotice(
  sources: Partial<Record<Source, SourceStatus>>,
  now: Date,
  staleAfterMs: number = STALE_AFTER_MS,
): StaleNotice | undefined {
  const candidates: StaleNotice[] = [];
  for (const [key, status] of Object.entries(sources)) {
    if (!status) continue;
    const state = displayState(status);
    if (state === "disabled" || state === "pending" || state === "ok") continue;

    const success = status.lastSuccessAt ? Date.parse(status.lastSuccessAt) : Number.NaN;
    if (Number.isNaN(success)) {
      // Attempted and never once succeeded: worth saying immediately, because
      // there are no rows behind it at all.
      candidates.push({
        source: key as Source,
        state,
        lastError: status.lastError,
        needsLogin: state === "needs_login",
      });
      continue;
    }
    const age = now.getTime() - success;
    if (age < staleAfterMs) continue;
    candidates.push({
      source: key as Source,
      hours: Math.floor(age / 3_600_000),
      state,
      lastError: status.lastError,
      needsLogin: state === "needs_login",
    });
  }
  if (candidates.length === 0) return undefined;
  // Never-succeeded first, then oldest. A login prompt is the one the student
  // can actually act on, so it outranks a parse error of the same age.
  candidates.sort((a, b) => {
    if ((a.hours === undefined) !== (b.hours === undefined)) return a.hours === undefined ? -1 : 1;
    if (a.needsLogin !== b.needsLogin) return a.needsLogin ? -1 : 1;
    return (b.hours ?? 0) - (a.hours ?? 0);
  });
  return candidates[0];
}

/* -------------------------------------------------------------------------- */
/* Toolbar badge                                                              */
/* -------------------------------------------------------------------------- */

export interface Badge {
  /** "" clears the badge. */
  text: string;
  /** CSS colour for `chrome.action.setBadgeBackgroundColor`. */
  color: string;
  /** Tooltip for `chrome.action.setTitle`. */
  title: string;
}

const BADGE_RED = "#c5221f";
const BADGE_BLUE = "#1a73e8";

/**
 * What the toolbar icon says without the popup being open.
 *
 * §9 G4 requires "every parse error surfaced in the UI (not silent)", and until
 * now the only surface was inside the popup and the options page — both of
 * which require the student to already suspect something. The first live run
 * cost two rounds of Sushi's time for exactly this reason.
 *
 * **A failure outranks any number.** Worker house rule 2 again: a calm "3"
 * sitting over a source that could not be read is the same lie as a green dot,
 * one step further from the evidence. Pending is not a failure and shows
 * nothing at all, so a fresh install is quiet rather than alarming.
 */
export function badgeFor(
  items: Item[],
  sources: Partial<Record<Source, SourceStatus>>,
  settings: Settings,
  now: Date,
): Badge {
  const summary = summarize(sources);

  if (summary.failing.length > 0) {
    const login = summary.needsLogin.length > 0;
    return {
      text: "!",
      color: BADGE_RED,
      // Names, not source keys. This string is a tooltip on the toolbar icon,
      // which is the first thing a student sees when something is wrong, and
      // "gradescope, prairietest" is not what those sites are called.
      title: login
        ? `Illini Dash — sign in to ${nameList(summary.needsLogin)}`
        : `Illini Dash — ${nameList(summary.failing)} could not be read`,
    };
  }

  if (summary.checkable.length === 0) {
    return { text: "", color: BADGE_BLUE, title: "Illini Dash — no sources are switched on" };
  }
  if (summary.ok.length === 0) {
    // Everything enabled is still pending: nothing has been fetched, so there
    // is nothing to count and nothing to complain about yet.
    return { text: "", color: BADGE_BLUE, title: "Illini Dash — checking…" };
  }

  const sections = groupItems(items, now, settings);
  const urgent = sections
    .filter((section) => section.name === "Needs attention" || section.name === "Today")
    .reduce((total, section) => total + section.items.length, 0);

  if (urgent === 0) {
    return { text: "", color: BADGE_BLUE, title: "Illini Dash — nothing due today" };
  }
  return {
    text: String(urgent),
    color: BADGE_BLUE,
    // The count is "needs attention or due today", so the tooltip says that
    // rather than "due today" — an overdue item is neither today's nor a lie.
    title: `Illini Dash — ${urgent} item${urgent === 1 ? "" : "s"} due today or overdue`,
  };
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

export interface EmptyState {
  text: string;
  /** Sources to offer a login link for. */
  logins: Source[];
}

/**
 * Why the list is empty (§8.1).
 *
 * "Nothing due in the next 60 days." is true only when every source was read
 * and every source was empty. Said while Gradescope is asking for a login, it
 * is the §11 failure with a friendly face: the student reads it as "I am free"
 * when it means "I could not look".
 */
export function emptyStateFor(
  sources: Partial<Record<Source, SourceStatus>>,
  hasHiddenOrDone: boolean,
): EmptyState {
  const summary = summarize(sources);

  if (summary.checkable.length === 0) {
    return { text: "No sources are switched on — open Settings to turn one back on.", logins: [] };
  }
  if (summary.needsLogin.length > 0) {
    return {
      text: `Nothing to show: ${nameList(summary.needsLogin)} ${
        summary.needsLogin.length === 1 ? "needs" : "need"
      } you to sign in.`,
      logins: summary.needsLogin,
    };
  }
  if (summary.failing.length > 0) {
    return {
      text: `Nothing to show: ${nameList(summary.failing)} could not be read, so this list is incomplete.`,
      logins: [],
    };
  }
  if (summary.ok.length === 0) {
    return { text: "Checking your sources…", logins: [] };
  }
  if (hasHiddenOrDone) {
    // Deliberately vague about *which* filter applied. All that is known here is
    // that rows exist and none reached a section, and that covers hidden, done,
    // further out than 60 days, and overdue by more than a week. Naming only
    // "done or hidden" would be wrong for a course whose work is all in
    // December, which is the common case in week one of a semester.
    return {
      text: "Nothing due in the next 60 days. Other items are hidden, finished, or further out.",
      logins: [],
    };
  }
  return { text: "Nothing due in the next 60 days.", logins: [] };
}
