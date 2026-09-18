/**
 * Google Calendar's states and their sentences (`src/core/gcal-auth.ts`).
 *
 * §0 rule 2's argument, one service over: every way this can fail is a state
 * with a sentence and a button, not a thrown error. The sentences are asserted
 * here because they are the whole of what a student gets — a state with no
 * words is the failure this module exists to prevent.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_GCAL_STATES,
  classifyAuthFailure,
  describeGcal,
  isGcalState,
  nextGcalState,
  type GcalFacts,
  type GcalState,
} from "../src/core/gcal-auth.js";
import { GCAL_NOT_CONFIGURED } from "../src/core/gcal-config.js";

const now = new Date("2026-09-18T15:00:00.000Z");
const connected: GcalFacts = { enabled: true, state: "connected" };

describe("Chrome's getAuthToken failures, classified", () => {
  const cases: [string, GcalState][] = [
    ["admin_policy_enforced", "admin_blocked"],
    ["Access blocked by the administrator", "admin_blocked"],
    ["The user did not approve access.", "declined"],
    ["The user is not signed in.", "declined"],
    ["User interaction required.", "expired"],
    ["OAuth2 request failed: Service responded with error: 'invalid_credentials'", "expired"],
    ["Something nobody has seen before", "declined"],
  ];
  for (const [message, expected] of cases) {
    it(`${JSON.stringify(message)} → ${expected}`, () => {
      expect(classifyAuthFailure(message)).toBe(expected);
    });
  }

  it("does not read a declined consent that mentions a policy as an admin block", () => {
    /*
     * House rule 6 one API over: matching "policy" loosely would send a student
     * to an administrator who has done nothing. The marker is Chrome's own
     * `admin_policy_enforced`, and this message is deliberately adversarial —
     * it contains the word and nothing else that matters.
     */
    expect(classifyAuthFailure("The user did not approve access (see your policy).")).toBe(
      "declined",
    );
  });
});

describe("the transition table", () => {
  it("cannot reach connected from never on a push alone", () => {
    // Worker rule 2: a green state from a push that cannot have happened.
    expect(nextGcalState("never", { kind: "push-started" })).toBe("never");
  });

  it("does not paint Working… over a state the student has to act on", () => {
    for (const state of ["admin_blocked", "declined", "expired", "calendar_missing"] as const) {
      expect(nextGcalState(state, { kind: "push-started" })).toBe(state);
    }
  });

  it("moves a connection into pushing, and a finished push back", () => {
    expect(nextGcalState("connected", { kind: "push-started" })).toBe("pushing");
    expect(nextGcalState("pushing", { kind: "pushed" })).toBe("connected");
  });

  it("reports a 401 as an expiry and a 403 as a rate limit", () => {
    expect(nextGcalState("connected", { kind: "token-invalid" })).toBe("expired");
    expect(nextGcalState("connected", { kind: "rate-limited" })).toBe("rate_limited");
  });

  it("takes every state back to never on disconnect", () => {
    for (const state of ALL_GCAL_STATES) {
      expect(nextGcalState(state, { kind: "disconnected" })).toBe("never");
    }
  });
});

describe("every state says something, and says what to press", () => {
  for (const state of ALL_GCAL_STATES) {
    it(`${state} has a sentence`, () => {
      const described = describeGcal({ enabled: true, state }, now);
      expect(described.chip.length).toBeGreaterThan(0);
      expect(described.sentence.length).toBeGreaterThan(0);
    });
  }

  it("tells an @illinois.edu student exactly what their administrator did", () => {
    const described = describeGcal({ enabled: true, state: "admin_blocked" }, now);
    expect(described.sentence).toContain("@illinois.edu administrator blocks this");
    expect(described.sentence).toContain("personal Google account");
    expect(described.action).toBe("connect");
    expect(described.tone).toBe("err");
  });

  it("says the calendar can be recreated rather than that something broke", () => {
    const described = describeGcal({ enabled: true, state: "calendar_missing" }, now);
    expect(described.action).toBe("retry");
  });
});

describe("the chip is spelled from a push, never from a connection", () => {
  it("does not claim a number before anything was written", () => {
    // Worker rule 2, in its own words: a green "Connected" over an empty
    // calendar is the dot that cost a real user two rounds of "why don't I see
    // any rows".
    const described = describeGcal(connected, now);
    expect(described.tone).not.toBe("ok");
    expect(described.chip).toBe("Connected · nothing pushed yet");
  });

  it("does not claim a number from lastPushAt alone", () => {
    const described = describeGcal({ ...connected, lastPushAt: now.toISOString() }, now);
    expect(described.tone).not.toBe("ok");
  });

  it("says what was pushed and when, once both were written by a push", () => {
    const described = describeGcal(
      { ...connected, lastPushAt: now.toISOString(), lastPushCount: 14 },
      now,
    );
    expect(described.tone).toBe("ok");
    expect(described.chip).toMatch(/^Pushed 14 events · /);
  });

  it("reads a push of nothing as a healthy answer, not a failure", () => {
    // Every deadline ticked off is an empty calendar and a working connection.
    const described = describeGcal(
      { ...connected, lastPushAt: now.toISOString(), lastPushCount: 0 },
      now,
    );
    expect(described.tone).toBe("ok");
    expect(described.chip).toContain("Pushed 0 events");
  });

  it("says Off for a switch that was never turned on", () => {
    expect(describeGcal({ enabled: false, state: "never" }, now).chip).toBe("Off");
    expect(describeGcal(undefined, now).chip).toBe("Off");
  });

  it("says a build with a placeholder client id is not set up, and names the doc", () => {
    const described = describeGcal(connected, now, false);
    expect(described.sentence).toBe(GCAL_NOT_CONFIGURED);
    expect(described.sentence).toContain("docs/gcal.md");
  });
});

describe("a stored state from another build", () => {
  it("is recognised only if this build knows it", () => {
    expect(isGcalState("connected")).toBe(true);
    expect(isGcalState("some_future_state")).toBe(false);
    expect(isGcalState(undefined)).toBe(false);
  });
});
