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

import { groupItems, liveDeadline } from "./grouping.js";
import { isItemDone, isTickedDone } from "./dedupe.js";
import {
  LOGIN_URL,
  courseLabel,
  SOURCE_HOME,
  SOURCE_NAME,
  STATE_WORD,
  fullStamp,
  nameList,
  timeAgo,
} from "./names.js";
import { isFetchedSource } from "./store.js";
import { describeGcal, type GcalAction, type GcalFacts } from "./gcal-auth.js";
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

/**
 * How long an attempt has to be in the past before returning to the page is
 * worth another one.
 *
 * `visibilitychange` fires on every tab switch, so without this a student
 * alt-tabbing while still signed out would fetch every failing source each
 * time. Ten seconds is roughly the fastest a person can sign in and come back,
 * which is the case this exists for.
 */
export const RECHECK_AFTER_MS = 10_000;

/**
 * When a page last finished loading on each source's own site.
 *
 * Keyed by source, values are epoch milliseconds. The worker records these; the
 * pages read them. Absent means "nothing has happened on that site since this
 * browser session began", which is the normal state.
 */
export type NavigatedAt = Partial<Record<Source, number>>;

/**
 * The sources to re-attempt when the student comes back to the page.
 *
 * **`needs_login` is the only state whose fix happens where the extension
 * cannot see it.** Every other failure resolves on our own schedule: a network
 * error clears when the site answers, a parse error clears when we ship a
 * selector. A login is fixed in a different tab, on a different origin, by a
 * form we never touch — and nothing tells us it happened. So it is the one
 * state that must be re-checked on the student's return rather than on the
 * poll.
 *
 * The first-run screen promised exactly this and did not do it: "Open all
 * sign-in pages" opened four tabs and then nothing watched for the student
 * coming back, so signing into all four left every row still reading "not
 * signed in" until the Sync button was pressed by hand. `beta-install.md` had
 * been telling testers "come back and the dot clears itself" the whole time.
 *
 * Not `pending`: a pending source already has a sync coming, and re-checking it
 * on return would fire a second one across the first.
 */
export function sourcesToRecheck(
  sources: Partial<Record<Source, SourceStatus>>,
  now: number,
  navigatedAt: NavigatedAt = {},
): Source[] {
  const due: Source[] = [];
  for (const status of Object.values(sources)) {
    if (status === undefined) continue;
    if (displayState(status) !== "needs_login") continue;
    const attempted = status.lastAttemptAt === undefined ? undefined : Date.parse(status.lastAttemptAt);

    /*
     * A page finished loading on this source's own site *after* our last
     * attempt, so the attempt is out of date whatever the clock says.
     *
     * The debounce below was keyed on "how long since we asked", which cannot
     * tell idle tab-switching from the one case it exists to serve. Sushi found
     * it exactly: "when I go to the popup it checks, then when I sign in and
     * come back within 10s it doesn't check again, so I have to wait until that
     * 10s period is over." Signing in is *evidence*; a tab switch is not. The
     * question is not how long it has been, it is whether anything has happened.
     *
     * This is self-limiting without a timer: once the re-check runs,
     * `lastAttemptAt` is newer than the navigation and the clause stops firing
     * until the next page load.
     */
    const navigated = navigatedAt[status.source];
    // `>=`, not `>`. `lastAttemptAt` is stamped when the sync *starts*, so a
    // navigation landing on the same millisecond may or may not have been seen
    // by the fetch — and the two errors are not equal. A re-check we did not
    // need costs one request; a re-check we skipped costs the student half an
    // hour of "sign in needed" while signed in.
    if (navigated !== undefined && (attempted === undefined || navigated >= attempted)) {
      due.push(status.source);
      continue;
    }
    /*
     * Phrased as "was it recent" rather than "was it long ago", because an
     * unreadable timestamp must not suppress the check and the two forms differ
     * exactly there: `Date.parse` of nonsense is NaN, and every comparison
     * against NaN is false — so NaN fails *this* test and the source is
     * re-checked, where `now - attempted >= WINDOW` would have failed too and
     * silently skipped it.
     *
     * An explicit `Number.isFinite` here was deleted rather than kept: it
     * rejected exactly what this rejects, and a second guard saying the same
     * thing is not defence (mutation house rule 2).
     */
    const recentlyTried = attempted !== undefined && now - attempted < RECHECK_AFTER_MS;
    if (recentlyTried) continue;
    due.push(status.source);
  }
  return due;
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
    // The student's own list is not a source that can be OK or not OK, so it
    // belongs on neither side of the ratio — and not in `disabled` either, which
    // is read as "switched off or unconfigured", something a student could act
    // on. Worker rule 2 in the other direction: only report what was attempted.
    if (!isFetchedSource(source)) continue;
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

/**
 * The one thing to do about a source that is not fine.
 *
 * Every failing state has one, and that is the point. The pill and the popover
 * both derive theirs from `actionFor`, so a source cannot be described as
 * broken in one place and offered nothing in the other — which is exactly what
 * happened: only `needs_login` produced a button, so a source that could not be
 * reached rendered as a red row with nothing on it. A student clicked the words
 * "Gradescope couldn't be read", got a list, and found no way forward.
 */
export type SourceAction =
  /** The session expired. Open the login page. */
  | { kind: "login"; source: Source; url: string }
  /** A fetch failed. It is transient far more often than not — try again. */
  | { kind: "retry"; source: Source }
  /** The page was not what the parser expected. Open it and look. */
  | { kind: "open"; source: Source; url: string };

/**
 * `loginUrl` is the page the *last attempt* found locked, recorded by the sync
 * loop. It only matters for `site`: the four hosted sources have a fixed login
 * form in `LOGIN_URL`, and a course website has none by construction, which is
 * why its row said "Sign in needed" over nothing to click. A fixed form still
 * wins where one exists — it is a page built for signing in, and the recorded
 * URL is merely a page that happens to demand it.
 */
export function actionFor(
  source: Source,
  state: SourceState,
  loginUrl?: string,
): SourceAction | undefined {
  if (state === "needs_login") {
    const url = LOGIN_URL[source] ?? loginUrl;
    return url ? { kind: "login", source, url } : undefined;
  }
  // A network error is the recoverable one, and retrying is the whole fix in
  // most cases. Offering "open the site" here would be advice to go and check
  // by hand what one click could settle.
  if (state === "network_error") return { kind: "retry", source };
  if (state === "parse_error") {
    const url = SOURCE_HOME[source];
    return url ? { kind: "open", source, url } : { kind: "retry", source };
  }
  return undefined;
}

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
  action?: SourceAction;
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
 * **The failures are ranked by what the student can do about them**, not by
 * severity. Signing in is ten seconds; retrying a fetch is one click; a page
 * that genuinely changed shape needs a new build. `staleNotice` already sorts
 * on the same principle, and leading with the one nobody can act on buries the
 * ones they can.
 *
 * **And the two kinds of failure are not the same sentence.** "Couldn't be
 * read" means the page changed — it sends someone to look at selectors. A
 * `TypeError: Failed to fetch` is "couldn't be reached", and the fix is to
 * press the button again. Collapsing both into "couldn't be read" is worker
 * house rule 2's own example, and this function did it: §6 classifies into two
 * branches and the pill threw the distinction away.
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
    const first = summary.needsLogin[0]!;
    const action = actionFor(first, "needs_login", sources[first]?.loginUrl);
    return {
      tone: "warn",
      text:
        summary.needsLogin.length === 1
          ? `Sign in to ${SOURCE_NAME[first]}`
          : `Sign in to ${summary.needsLogin.length} sites`,
      ...(action ? { action } : {}),
    };
  }

  if (summary.failing.length > 0) {
    // Unreachable before unreadable: one is a button press, the other is a bug
    // report. The pill leads with whichever the student can actually finish.
    const unreachable = summary.failing.filter(
      (source) => displayState(sources[source]!) === "network_error",
    );
    const lead = unreachable[0] ?? summary.failing[0]!;
    const state = displayState(sources[lead]!);
    /*
     * Short, because the pill is 24px in a 400px bar with a button beside it.
     *
     * "Gradescope couldn't be reached" truncated to "Gradescope couldn't be
     * rea…" — losing the one word the whole distinction turns on. A sentence
     * whose ending is the information must fit, so it is four words instead of
     * five: "didn't answer" is plainly a thing to retry, and "looks different"
     * is plainly a thing that needs a fix.
     */
    const verb = unreachable.length > 0 ? "didn't answer" : "looks different";
    const plural = unreachable.length > 0 ? "didn't answer" : "look different";
    return {
      tone: "err",
      text:
        summary.failing.length === 1
          ? `${SOURCE_NAME[lead]} ${verb}`
          : `${summary.failing.length} sites ${plural}`,
      ...(actionFor(lead, state, sources[lead]?.loginUrl)
        ? { action: actionFor(lead, state, sources[lead]?.loginUrl)! }
        : {}),
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

/* -------------------------------------------------------------------------- */
/* The header pill, redesigned (brief D2)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Why the pill says what it says.
 *
 * The caller needs this rather than the text: the pill is a button, and what
 * clicking it should open is a function of the state, not of the sentence. A
 * page that switched on `text === "All clear"` would break the first time the
 * wording did.
 */
export type PillKind = "syncing" | "pending" | "late" | "needs-you" | "clear";

export interface NeedsYouPill {
  text: string;
  tone: HealthTone;
  kind: PillKind;
}

export interface NeedsYouInput {
  sources: Partial<Record<Source, SourceStatus>>;
  /** A sync is in flight right now. */
  syncing: boolean;
  /** `overdueItems(...).length` — the Overdue group, counted by one rule. */
  overdue: number;
  /** Open suggestions from posts, each one a question waiting for an answer. */
  suggestions: number;
}

/**
 * The header pill the redesign puts "Late" into (brief D2).
 *
 * `healthPill` answers "are the sources fine", which is a question about this
 * extension. This answers "is anything asking for you", which is a question
 * about the student's week — and the mock puts it where six source dots used to
 * be, because the source dots are the thing nobody was looking at.
 *
 * The order is not severity, it is **how much the words can be trusted**:
 *
 * 1. A sync is running, so every count below is about to change — say so rather
 *    than flash a number that is one second old.
 * 2. Nothing has been fetched yet, so every count below is about nothing.
 *    Worker house rule 2, exactly: a green "All clear" over a source that was
 *    never read is the fresh-install green dot in a wider costume, and this
 *    time it says the student has no work. `displayState` calls an unattempted
 *    source `pending`, and `pending` is never `ok`.
 * 3. Late work, which is the one thing with a deadline behind it.
 * 4. Something needs the student: a source with an action to press, or a
 *    suggestion waiting for a yes. Both are one click from done.
 * 5. Nothing — and only now can that be said.
 *
 * `healthPill` stays exactly as it is: it still owns the wording for *which*
 * source is broken, which the Needs-you screen (D2) prints per row.
 */
export function needsYouPill(input: NeedsYouInput): NeedsYouPill {
  const { sources, syncing, overdue, suggestions } = input;

  if (syncing) return { kind: "syncing", tone: "pending", text: "Syncing…" };

  const summary = summarize(sources);

  // Not "All clear": nothing has been switched on, so nothing has been read,
  // and the student's list is empty because this extension never looked.
  if (summary.checkable.length === 0) {
    return { kind: "pending", tone: "pending", text: "No sites are switched on" };
  }
  // *Every* checkable source unattempted, not merely one: once a single source
  // has answered, the counts below describe something real, and the sources
  // still waiting are named on the Needs-you screen rather than in three words.
  if (summary.pending.length === summary.checkable.length) {
    return { kind: "pending", tone: "pending", text: "Not synced yet" };
  }

  if (overdue > 0) return { kind: "late", tone: "err", text: `${overdue} late` };

  // A source with something to press, plus every suggestion waiting for a yes.
  // `actionFor` rather than `isFailing`, because the pill is an invitation: a
  // failure nobody can act on is a sentence for the Needs-you screen, not a
  // count on a button. It is the same derivation the screen's rows use, so the
  // pill can never promise a button that is not there.
  const actionable = summary.failing.filter(
    (source) => actionFor(source, displayState(sources[source]!), sources[source]?.loginUrl) !== undefined,
  ).length;
  const needsYou = actionable + suggestions;
  if (needsYou > 0) return { kind: "needs-you", tone: "warn", text: `${needsYou} needs you` };

  // Never green over a fetch that did not happen (worker rule 2). A source
  // just switched on is `pending` until its first attempt, and "All clear"
  // beside it would be a claim about a list this extension has not read yet
  // (R3 B2). Late and needs-you above are real whatever else is pending; this
  // is only what the pill may say when nothing is asking.
  if (summary.pending.length > 0) {
    const n = summary.pending.length;
    return { kind: "pending", tone: "pending", text: `${n} not read yet` };
  }
  // A failure with nothing to press is still a failure: it gets no count, but
  // it does not get a green pill either (R3 M7).
  if (summary.failing.length > 0) {
    return { kind: "needs-you", tone: "warn", text: "Something needs a look" };
  }

  return { kind: "clear", tone: "ok", text: "All clear" };
}

/* -------------------------------------------------------------------------- */
/* The footer strip (brief D10)                                                */
/* -------------------------------------------------------------------------- */

export interface FooterLine {
  /** The dot's colour. What the *sources* are doing. */
  dot: HealthTone;
  /** "8 sources", or "7 of 8 sources" when they are not all answering. */
  sources: string;
  /** "synced 2m ago" · "not synced yet" · "syncing…". */
  synced: string;
  /**
   * The strip's own wash, which is not always the dot's.
   *
   * A sync in flight is `pending` across the whole strip — the words say
   * "syncing…" and an amber background under them would read as a failure that
   * has already happened. Once it finishes the strip takes the dot's tone
   * again, which is where D10's `--warn-wash` comes from.
   */
  tone: HealthTone;
}

/**
 * "2m ago", the footer's clock.
 *
 * Not `timeAgo`, which says "2 min ago" and "yesterday" — right for a source
 * row with a whole line to itself, too wide for a strip that also has to carry
 * a count and a button inside 400px. Mock 1e: "synced 2m ago".
 */
function compactAgo(at: number, now: Date): string {
  const seconds = Math.round((now.getTime() - at) / 1000);
  // A clock behind the worker's. "in -3s" is worse than rounding (`timeAgo`
  // makes the same call for the same reason).
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The always-present footer: `[dot] N sources · synced 2m ago · Sync now`.
 *
 * **There is no `lastSyncAt` parameter, and that is the point.** `runSync`
 * stamps that field whether or not anything succeeded, so the old
 * `Synced 10:32` said "synced" just as loudly after four failures — worker
 * house rule 2's own example. This reads the newest `lastSuccessAt` across the
 * sources that are switched on, so "synced 2m ago" means at least one source
 * was actually read 2m ago. A parameter that cannot be passed cannot be used.
 *
 * The count is `ok` of `checkable`, so a source that is off, or on with nothing
 * behind it, is on neither side (`summarize`), and a pending source is not
 * quietly counted as answering. That makes a cold install read
 * "0 of 4 sources · not synced yet", which is exactly what has happened.
 */
export function footerLine(
  sources: Partial<Record<Source, SourceStatus>>,
  syncing: boolean,
  now: Date,
): FooterLine {
  const summary = summarize(sources);
  const total = summary.checkable.length;
  const answering = summary.ok.length;

  const dot: HealthTone =
    total === 0
      ? "pending"
      : summary.failing.length > 0
        ? "warn"
        : answering < total
          ? "pending"
          : "ok";

  // Only from a source the student has switched on: a disabled source's old
  // success is not evidence about the list in front of them.
  let newest: number | undefined;
  for (const source of summary.checkable) {
    const raw = sources[source]?.lastSuccessAt;
    if (raw === undefined) continue;
    const at = Date.parse(raw);
    if (Number.isNaN(at)) continue;
    if (newest === undefined || at > newest) newest = at;
  }

  return {
    dot,
    sources:
      total === 0
        ? "no sources"
        : answering === total
          ? `${total} source${total === 1 ? "" : "s"}`
          : `${answering} of ${total} sources`,
    synced: syncing
      ? "syncing…"
      : newest === undefined
        ? "not synced yet"
        : `synced ${compactAgo(newest, now)}`,
    tone: syncing ? "pending" : dot,
  };
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
  /**
   * The one thing to do about this row, or nothing when it is fine.
   *
   * Every failing state has one. This field used to be `loginUrl`, which is why
   * a source that could not be reached rendered as a red row with no button:
   * the shape of the data said only logins were actionable.
   */
  action?: SourceAction;
}

export function sourceRows(
  sources: Partial<Record<Source, SourceStatus>>,
  now: Date,
): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const [key, status] of Object.entries(sources)) {
    if (!status) continue;
    const source = key as Source;
    // No row for the student's own list: it has no last-read time, no error it
    // could ever report, and no action — a permanently grey "Off" line beside
    // five real ones, saying nothing and inviting a click that does nothing.
    if (!isFetchedSource(source)) continue;
    const state = displayState(status);
    const action = actionFor(source, state, status.loginUrl);
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
      ...(action ? { action } : {}),
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

/**
 * Google Calendar's row, for the health popover and for Settings.
 *
 * A row rather than a `SourceRow`, and deliberately *not* a `Source`: nothing
 * is fetched for it, so it has no `lastSuccessAt`, no backoff ladder, and no
 * business in "n of m sources OK" or in the toolbar badge. `summarize` walks
 * `store.sources` and this lives in `store.gcal`, so the exclusion is
 * structural rather than a `!== "gcal"` somebody has to remember — the same
 * shape `isFetchedSource` gave the `manual` source.
 *
 * Absent entirely when it is switched off. A permanently grey line about a
 * feature the student never turned on is the dot that can only be one colour,
 * which worker rule 2 says is not information.
 */
export interface GcalRow {
  /** The chip, from `describeGcal` — never green without a push behind it. */
  word: string;
  sentence: string;
  tone: HealthTone;
  action: GcalAction;
}

export function gcalRow(
  facts: GcalFacts | undefined,
  now: Date,
  configured = true,
): GcalRow | undefined {
  if (!facts?.enabled) return undefined;
  const described = describeGcal(facts, now, configured);
  return {
    word: described.chip,
    sentence: described.sentence,
    tone: described.tone,
    action: described.action,
  };
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

/* -------------------------------------------------------------------------- */
/* The quiet state (brief D13, mock 1f)                                        */
/* -------------------------------------------------------------------------- */

export interface QuietState {
  /** "Nothing due for 3 days". */
  headline: string;
  /** "Next up is ECE 374 GPS5 on Tuesday. All 8 sources answered 2 min ago." */
  detail: string;
  /** The deadline the sentence names, so the caller can make it clickable. */
  next: Item;
}

/** Whole local days from today's midnight to `at`'s. */
function daysFromToday(at: number, now: Date): number {
  const midnight = (when: Date) =>
    new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();
  return Math.round((midnight(new Date(at)) - midnight(now)) / 86_400_000);
}

/**
 * How far out the quiet state is worth drawing.
 *
 * "Nothing due for 1 day" is a sentence about tomorrow, which the Today view is
 * already showing in full; the reassurance only means anything once the next
 * thing is far enough away that the student would otherwise wonder whether the
 * list is broken.
 */
const QUIET_MIN_DAYS = 2;

/**
 * A week with nothing in it, said as a fact rather than as an absence.
 *
 * `emptyStateFor` answers "why is this list empty", and every one of its
 * sentences is either an apology or a warning — which is right, because it is
 * called when a view has *no rows at all*. The quiet state is the other case:
 * there is plenty in the list, none of it is soon, and the student's actual
 * question is "am I really free until Tuesday, or is this thing broken again".
 *
 * So it returns something **only when every source answered**. That is worker
 * house rule 2 in its most direct form: "All 8 sources answered 2 min ago" is a
 * claim about eight fetches, and one `pending` or one expired session makes it
 * false in the exact way that reads as "I am free" while meaning "I could not
 * look" (§11). Those cases keep `emptyStateFor`'s wording, which names the
 * source and offers the login.
 */
export function quietState(
  items: Item[],
  sources: Partial<Record<Source, SourceStatus>>,
  now: Date,
  courseNames: Record<string, string> = {},
): QuietState | undefined {
  const summary = summarize(sources);
  // Not `failing.length === 0`: a pending source has not answered either, and
  // a sentence counting it among the eight would be counting a fetch that has
  // not happened.
  if (summary.checkable.length === 0 || summary.ok.length !== summary.checkable.length) {
    return undefined;
  }

  let next: Item | undefined;
  let nextAt = Number.POSITIVE_INFINITY;
  for (const item of items) {
    if (item.hidden) continue;
    // Neither is a thing that is *due*: a booking is a window and an event is
    // something that happens. "Next up is Fall 2026 Office Hours" would be the
    // same dilution that once made the Attention tab read 11.
    if (item.kind === "booking" || item.kind === "event") continue;
    if (isItemDone(item) || isTickedDone(item)) continue;
    const live = liveDeadline(item, now);
    if (live === undefined || live.at <= now.getTime()) continue;
    if (live.at < nextAt) {
      nextAt = live.at;
      next = item;
    }
  }
  if (next === undefined) return undefined;

  const days = daysFromToday(nextAt, now);
  if (days < QUIET_MIN_DAYS) return undefined;

  const when = new Date(nextAt);
  // A weekday only while it is unambiguous. Past six days "on Tuesday" is two
  // different Tuesdays, and the one the student assumes is the near one.
  const day =
    days < 7
      ? when.toLocaleDateString(undefined, { weekday: "long" })
      : when.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const total = summary.checkable.length;
  let newest: number | undefined;
  for (const source of summary.checkable) {
    const at = Date.parse(sources[source]?.lastSuccessAt ?? "");
    if (Number.isNaN(at)) continue;
    if (newest === undefined || at > newest) newest = at;
  }
  const ago = timeAgo(newest, now);

  return {
    headline: `Nothing due for ${days} days`,
    detail:
      `Next up is ${courseLabel(next.courseLabel, courseNames)} ${next.title} on ${day}.` +
      ` All ${total} source${total === 1 ? "" : "s"} answered${ago ? ` ${ago}` : ""}.`,
    next,
  };
}
