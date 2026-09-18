/**
 * Google Calendar's connection, as a state machine with a sentence per state.
 *
 * Every way `chrome.identity.getAuthToken` can fail is a *state* here, not an
 * error: "the user closed the consent window", "your university's Workspace
 * administrator blocks this app" and "the token we cached is no longer good"
 * want three different sentences and three different buttons, and a thrown
 * `Error` with Chrome's own wording gives none of them. That is §0 rule 2's
 * argument (`needs_login` is a state, not a parse error) applied one service
 * over.
 *
 * Pure, and with no `chrome` import, so the whole thing is reachable from the
 * suite (worker rule 1). `background.ts` injects the identity calls.
 */

import { GCAL_NOT_CONFIGURED } from "./gcal-config.js";

export type GcalState =
  /** Never connected — the switch has never been turned on, or was turned off. */
  | "never"
  /** A token was obtained and the calendar exists. Says nothing about a push. */
  | "connected"
  /** We had a grant and it stopped working: revoked, or the account signed out. */
  | "expired"
  /** The consent window was closed, or Chrome has no signed-in profile. */
  | "declined"
  /** A Workspace policy refuses this app. `@illinois.edu` is the case in hand. */
  | "admin_blocked"
  /** Google asked us to slow down (403 rate limit, or 429). */
  | "rate_limited"
  /** The calendar we created is gone — the student deleted it in Google. */
  | "calendar_missing"
  /** A push is in flight. Transient; never persisted as a resting state. */
  | "pushing";

export const ALL_GCAL_STATES: GcalState[] = [
  "never",
  "connected",
  "expired",
  "declined",
  "admin_blocked",
  "rate_limited",
  "calendar_missing",
  "pushing",
];

export function isGcalState(value: unknown): value is GcalState {
  return typeof value === "string" && (ALL_GCAL_STATES as string[]).includes(value);
}

/**
 * Chrome's `getAuthToken` failure text, classified.
 *
 * Chrome hands back a string, and the strings differ by platform and version,
 * so this matches on the stable fragments rather than on whole sentences.
 * Anchored and lower-cased, and each fragment is a phrase Chrome actually emits
 * — house rule 6 one API over: matching `"policy"` loosely would classify a
 * declined consent whose message happened to mention a policy as
 * `admin_blocked`, and send the student to an administrator who has done
 * nothing.
 *
 * The default is `declined` rather than `expired`, deliberately. `expired` says
 * "you had this and it broke", which is a claim about history; `declined` says
 * "press Connect", which is the right thing to do for every failure this does
 * not recognise.
 */
export function classifyAuthFailure(message: string): GcalState {
  const text = message.toLowerCase();
  if (text.includes("admin_policy_enforced") || text.includes("blocked by the administrator")) {
    return "admin_blocked";
  }
  if (
    text.includes("user is not signed in") ||
    text.includes("the user is not signed in") ||
    text.includes("user not signed in") ||
    text.includes("did not approve") ||
    text.includes("user rejected") ||
    text.includes("user cancel") ||
    text.includes("canceled") ||
    text.includes("cancelled")
  ) {
    return "declined";
  }
  if (
    text.includes("user interaction required") ||
    // Chrome relays Google's own error code, underscored, inside a longer
    // sentence: "OAuth2 request failed: Service responded with error:
    // 'invalid_credentials'". Both spellings are matched because the wrapper
    // sentence differs by platform and the code inside it does not.
    text.includes("invalid_credentials") ||
    text.includes("invalid credentials") ||
    text.includes("token expired") ||
    text.includes("revoked")
  ) {
    return "expired";
  }
  return "declined";
}

export type GcalEvent =
  | { kind: "connect-started" }
  | { kind: "connected" }
  | { kind: "auth-failed"; message: string }
  | { kind: "push-started" }
  | { kind: "pushed" }
  | { kind: "token-invalid" }
  | { kind: "rate-limited" }
  | { kind: "calendar-missing" }
  | { kind: "disconnected" };

/**
 * The transition table.
 *
 * Written out rather than derived, because the interesting entries are the ones
 * that *do not* move: a `push-started` from `admin_blocked` must not paint
 * "Working…" over a state the student has to act on, and a `pushed` must never
 * arrive at `connected` from `never` — that would be a green dot from a push
 * that cannot have happened (worker rule 2).
 */
export function nextGcalState(current: GcalState, event: GcalEvent): GcalState {
  switch (event.kind) {
    case "connect-started":
      return "pushing";
    case "connected":
      return "connected";
    case "auth-failed":
      return classifyAuthFailure(event.message);
    case "push-started":
      // Only a connection that exists can be pushing. From any failed state
      // the answer is that failed state: there is nothing to push with.
      return current === "connected" || current === "pushing" ? "pushing" : current;
    case "pushed":
      return "connected";
    case "token-invalid":
      return "expired";
    case "rate-limited":
      return "rate_limited";
    case "calendar-missing":
      return "calendar_missing";
    case "disconnected":
      return "never";
  }
}

/** What the Settings row reads. The shape of `store.gcal`, minus the plumbing. */
export interface GcalFacts {
  enabled: boolean;
  state: GcalState;
  calendarId?: string;
  lastPushAt?: string;
  lastPushCount?: number;
  lastError?: string;
}

export type GcalAction = "connect" | "reconnect" | "retry" | "disconnect" | "none";

export interface GcalDescription {
  /** The chip beside the switch: short, and true. */
  chip: string;
  /** The sentence under it, including what to press. */
  sentence: string;
  /** Which control the sentence is telling them to press. */
  action: GcalAction;
  /** Whether the chip may be drawn green. */
  tone: "ok" | "warn" | "err" | "pending";
}

function when(at: string | undefined, now: Date): string | undefined {
  if (at === undefined) return undefined;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The chip and the sentence, derived from an attempt that happened.
 *
 * Worker rule 2 is the whole of this function. `state: "connected"` means a
 * token was obtained — it does not mean anything reached the calendar, and a
 * green "Connected" over a calendar that is still empty is exactly the dot that
 * cost a real user two rounds of "why don't I see any rows". So the green chip
 * is spelled from `lastPushAt` and `lastPushCount`, which are only ever written
 * by a push that returned; a connection with no push behind it says so.
 *
 * `lastPushCount` of 0 is a real answer and reads as one ("nothing to add"):
 * a student with every deadline ticked off has an empty calendar and a healthy
 * connection, and those must not look like a failure.
 */
export function describeGcal(
  facts: GcalFacts | undefined,
  now: Date = new Date(),
  configured = true,
): GcalDescription {
  if (!configured) {
    return {
      chip: "Not set up",
      sentence: GCAL_NOT_CONFIGURED,
      action: "none",
      tone: "err",
    };
  }
  if (!facts?.enabled || facts.state === "never") {
    return {
      chip: "Off",
      sentence:
        "Your deadlines stay in this browser. Turn this on and Illini Dash will " +
        "create a calendar called “Illini Dash” in your own Google account and " +
        "keep it up to date. It cannot see or change any of your other calendars.",
      action: "connect",
      tone: "pending",
    };
  }

  switch (facts.state) {
    case "pushing":
      return {
        chip: "Working…",
        sentence: "Talking to Google Calendar.",
        action: "none",
        tone: "pending",
      };
    case "declined":
      return {
        chip: "Not connected",
        sentence:
          "Google did not grant access — either the window was closed, or Chrome " +
          "has no Google account signed in. Sign in to Chrome, then press Connect.",
        action: "connect",
        tone: "warn",
      };
    case "admin_blocked":
      return {
        chip: "Blocked",
        sentence:
          "Your @illinois.edu administrator blocks this; connect a personal Google " +
          "account in Chrome instead, then press Connect.",
        action: "connect",
        tone: "err",
      };
    case "expired":
      return {
        chip: "Reconnect needed",
        sentence:
          "Google stopped accepting the permission you gave — usually because it " +
          "was removed in your Google account, or that account was signed out of " +
          "Chrome. Press Reconnect.",
        action: "reconnect",
        tone: "warn",
      };
    case "rate_limited":
      return {
        chip: "Slowed down",
        sentence:
          "Google asked Illini Dash to slow down. It will try again on the next " +
          "sync; Push now retries straight away.",
        action: "retry",
        tone: "warn",
      };
    case "calendar_missing":
      return {
        chip: "Calendar gone",
        sentence:
          "The “Illini Dash” calendar is no longer in your Google account. " +
          "Press Push now and it will be created again, or Disconnect to stop.",
        action: "retry",
        tone: "warn",
      };
    case "connected": {
      const at = when(facts.lastPushAt, now);
      // The green chip is spelled from the push, never from the connection.
      if (at === undefined || facts.lastPushCount === undefined) {
        return {
          chip: "Connected · nothing pushed yet",
          sentence:
            "Connected to Google Calendar. Nothing has been written yet — the next " +
            "sync will do it, or press Push now.",
          action: "retry",
          tone: "pending",
        };
      }
      const n = facts.lastPushCount;
      return {
        chip: `Pushed ${n} event${n === 1 ? "" : "s"} · ${at}`,
        sentence:
          "Your deadlines are on the “Illini Dash” calendar in your Google " +
          "account. Turning this off deletes that calendar's events.",
        action: "disconnect",
        tone: "ok",
      };
    }
  }
  /*
   * Unreachable, and kept anyway (mutation rule 2's second class).
   *
   * `never` is handled by the guard above, so TypeScript narrows it out of the
   * switch entirely — which is exactly why this line has to exist: a state
   * added later and forgotten would otherwise fall out of a function whose
   * return type promises a sentence, and the Settings row would draw
   * `undefined`. A state with no words is the one thing this section must never
   * show.
   */
  return {
    chip: "Off",
    sentence: "Google Calendar is switched off.",
    action: "connect",
    tone: "pending",
  };
}
