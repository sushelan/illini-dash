/**
 * Health display (§0 rule 3, §8.1, worker house rule 2).
 *
 * The defect this module exists to kill is "a green dot that means I did not
 * fetch", so most of these tests are about what the UI is *forbidden* to claim.
 */

import { describe, expect, it } from "vitest";
import {
  RECHECK_AFTER_MS,
  STALE_AFTER_MS,
  badgeFor,
  displayState,
  actionFor,
  emptyStateFor,
  healthPill,
  sourceRows,
  sourcesToRecheck,
  gcalRow,
  staleNotice,
  statusAfterEnable,
  statusLine,
  summarize,
} from "../src/core/health.js";
import { DEFAULT_SETTINGS, emptyStore } from "../src/core/store.js";
import type { Item, Source, SourceStatus } from "../src/sources/types.js";

const NOW = new Date(2026, 8, 10, 18, 0, 0);
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();

function status(partial: Partial<SourceStatus> = {}): SourceStatus {
  return {
    source: "gradescope",
    enabled: true,
    state: "ok",
    lastAttemptAt: iso(60_000),
    lastSuccessAt: iso(60_000),
    consecutiveFailures: 0,
    ...partial,
  };
}

/** Only the fields `badgeFor` and `emptyStateFor` read. */
function sources(entries: Partial<Record<Source, SourceStatus>>): Partial<Record<Source, SourceStatus>> {
  return entries;
}

function item(partial: Partial<Item> = {}): Item {
  return {
    id: `i${Math.random()}`,
    members: [],
    courseLabel: "CS357",
    title: "Thing",
    kind: "assignment",
    url: "https://us.prairielearn.com/",
    status: "not_submitted",
    hidden: false,
    done: false,
    notified: {},
    ...partial,
  };
}
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

describe("displayState", () => {
  it("calls a never-attempted source pending, not ok", () => {
    // The fresh-install defect, pinned at its source: emptyStore() seeds every
    // enabled source, and none of them has been fetched.
    for (const source of ["canvas", "gradescope", "prairielearn", "prairietest"] as Source[]) {
      expect(displayState(emptyStore().sources[source]), source).toBe("pending");
    }
  });

  it("calls a stored ok with no attempt pending, so an old store cannot claim success", () => {
    // A store written before `pending` existed holds state:"ok" from
    // defaultStatus. Trusting the field would reintroduce the green dot.
    expect(displayState(status({ state: "ok", lastAttemptAt: undefined, lastSuccessAt: undefined })))
      .toBe("pending");
  });

  it("reports disabled for a switched-off source whatever its stored state says", () => {
    expect(displayState(status({ enabled: false, state: "ok" }))).toBe("disabled");
    expect(displayState(status({ enabled: false, state: "parse_error" }))).toBe("disabled");
  });

  it("passes through a real attempt result", () => {
    expect(displayState(status({ state: "ok" }))).toBe("ok");
    expect(displayState(status({ state: "needs_login" }))).toBe("needs_login");
    expect(displayState(status({ state: "parse_error" }))).toBe("parse_error");
  });
});

describe("summarize (worker rule 2: n of m excludes what was never fetched)", () => {
  it("counts neither side for a disabled or unconfigured source", () => {
    const summary = summarize(
      sources({
        canvas: status({ state: "ok" }),
        gradescope: status({ state: "ok" }),
        site: status({ enabled: false, state: "disabled" }),
        prairietest: status({ enabled: true, state: "disabled" }),
      }),
    );
    expect(summary.checkable).toEqual(["canvas", "gradescope"]);
    expect(summary.ok).toEqual(["canvas", "gradescope"]);
    expect(summary.disabled.sort()).toEqual(["prairietest", "site"]);
  });

  it("does not count a pending source as ok", () => {
    const summary = summarize(
      sources({
        canvas: status({ state: "ok" }),
        gradescope: status({ state: "pending", lastAttemptAt: undefined }),
      }),
    );
    expect(summary.ok).toEqual(["canvas"]);
    expect(summary.pending).toEqual(["gradescope"]);
  });

  it("separates needs_login from other failures, because only one is actionable", () => {
    const summary = summarize(
      sources({
        gradescope: status({ state: "needs_login" }),
        prairielearn: status({ state: "parse_error" }),
      }),
    );
    expect(summary.failing.sort()).toEqual(["gradescope", "prairielearn"]);
    expect(summary.needsLogin).toEqual(["gradescope"]);
  });
});

describe("statusLine", () => {
  it("never says everything is fine when a source failed", () => {
    // The old line read `Synced 10:32` off lastSyncAt, which runSync sets
    // unconditionally — so it read the same after four failures as after four
    // successes. That is the sentence this replaces.
    const line = statusLine(
      sources({
        canvas: status({ state: "ok" }),
        gradescope: status({ state: "needs_login" }),
        prairielearn: status({ state: "ok" }),
        prairietest: status({ state: "ok" }),
      }),
      iso(0),
      NOW,
    );
    expect(line).toContain("3 of 4 sources OK");
    expect(line).not.toContain("Synced");
  });

  it("says all N OK only when every checkable source succeeded", () => {
    expect(
      statusLine(
        sources({ canvas: status({ state: "ok" }), gradescope: status({ state: "ok" }) }),
        iso(0),
        NOW,
      ),
    ).toContain("all 2 sources OK");
  });

  it("counts a pending source against the ratio", () => {
    const line = statusLine(
      sources({
        canvas: status({ state: "ok" }),
        gradescope: status({ state: "pending", lastAttemptAt: undefined }),
      }),
      iso(0),
      NOW,
    );
    expect(line).toContain("1 of 2 sources OK");
  });

  it("says not checked yet rather than a time when there has been no sync", () => {
    expect(statusLine(sources({ canvas: status() }), undefined, NOW)).toBe("Not checked yet.");
  });

  it("says so when nothing is switched on, instead of a vacuous 0 of 0", () => {
    expect(statusLine(sources({ canvas: status({ enabled: false }) }), iso(0), NOW)).toBe(
      "No sources are switched on.",
    );
  });
});

describe("staleNotice", () => {
  it("says nothing about a source that is merely pending", () => {
    // Installing the extension must not immediately warn that a source has not
    // been read — it is about to be.
    expect(
      staleNotice(sources({ canvas: emptyStore().sources.canvas }), NOW),
    ).toBeUndefined();
  });

  it("says nothing while a failing source's last success is still recent", () => {
    expect(
      staleNotice(
        sources({ gradescope: status({ state: "network_error", lastSuccessAt: iso(3_600_000) }) }),
        NOW,
      ),
    ).toBeUndefined();
  });

  it("warns once a failing source's last success passes the threshold", () => {
    const notice = staleNotice(
      sources({
        gradescope: status({
          state: "needs_login",
          lastSuccessAt: iso(STALE_AFTER_MS + 3_600_000),
          lastError: "401 at /login",
        }),
      }),
      NOW,
    );
    expect(notice?.source).toBe("gradescope");
    expect(notice?.hours).toBe(13);
    expect(notice?.needsLogin).toBe(true);
    expect(notice?.lastError).toBe("401 at /login");
  });

  it("ranks a source that has never once succeeded above an old one", () => {
    const notice = staleNotice(
      sources({
        gradescope: status({ state: "parse_error", lastSuccessAt: iso(STALE_AFTER_MS * 10) }),
        prairielearn: status({ state: "parse_error", lastSuccessAt: undefined }),
      }),
      NOW,
    );
    // Never-succeeded is worse: there are no rows behind it at all, whereas the
    // old one is at least showing something real from Tuesday.
    expect(notice?.source).toBe("prairielearn");
    expect(notice?.hours).toBeUndefined();
  });

  it("prefers the actionable login over an equally old parse error", () => {
    const notice = staleNotice(
      sources({
        prairielearn: status({ state: "parse_error", lastSuccessAt: iso(STALE_AFTER_MS + 1000) }),
        gradescope: status({ state: "needs_login", lastSuccessAt: iso(STALE_AFTER_MS + 1000) }),
      }),
      NOW,
    );
    expect(notice?.source).toBe("gradescope");
  });

  it("says nothing about a healthy source however long ago it last succeeded", () => {
    // A source reporting ok now is not stale; lastSuccessAt is simply its most
    // recent success, and an `ok` with an old timestamp cannot happen.
    expect(
      staleNotice(sources({ canvas: status({ state: "ok", lastSuccessAt: iso(0) }) }), NOW),
    ).toBeUndefined();
  });
});

describe("badgeFor (worker rule 2: a failure outranks any number)", () => {
  const overdue = item({ dueAt: at(2026, 8, 9) });
  const dueToday = item({ dueAt: at(2026, 8, 10, 23) });
  const later = item({ dueAt: at(2026, 9, 20) });

  it("shows ! rather than a count when any source could not be read", () => {
    const badge = badgeFor(
      [overdue, dueToday, later],
      sources({ canvas: status({ state: "ok" }), gradescope: status({ state: "parse_error" }) }),
      DEFAULT_SETTINGS,
      NOW,
    );
    // A calm "2" over a source that failed is the green dot one step further
    // from the evidence.
    expect(badge.text).toBe("!");
    // The name, not the key. This string is the toolbar tooltip — the first
    // thing a student sees when something is wrong — and it was reading
    // "gradescope could not be read".
    expect(badge.title).toContain("Gradescope");
    expect(badge.title).not.toContain("gradescope ");
  });

  it("names signing in when that is what is wrong", () => {
    const badge = badgeFor(
      [],
      sources({ gradescope: status({ state: "needs_login" }) }),
      DEFAULT_SETTINGS,
      NOW,
    );
    expect(badge.text).toBe("!");
    expect(badge.title).toContain("sign in");
  });

  it("counts needs-attention and today, and nothing further out", () => {
    const badge = badgeFor(
      [overdue, dueToday, later],
      sources({ canvas: status({ state: "ok" }) }),
      DEFAULT_SETTINGS,
      NOW,
    );
    expect(badge.text).toBe("2");
  });

  it("stays empty on a fresh install rather than alarming about nothing", () => {
    const store = emptyStore();
    const badge = badgeFor([], store.sources, DEFAULT_SETTINGS, NOW);
    expect(badge.text).toBe("");
    expect(badge.title).toContain("checking");
  });

  it("clears the badge when everything is read and nothing is urgent", () => {
    expect(
      badgeFor([later], sources({ canvas: status({ state: "ok" }) }), DEFAULT_SETTINGS, NOW).text,
    ).toBe("");
  });

  it("respects hideSubmitted, so the number matches the list the popup shows", () => {
    const done = item({ dueAt: at(2026, 8, 10, 23), status: "graded" });
    const badge = badgeFor(
      [done, dueToday],
      sources({ canvas: status({ state: "ok" }) }),
      { ...DEFAULT_SETTINGS, hideSubmitted: true },
      NOW,
    );
    expect(badge.text).toBe("1");
  });
});

describe("emptyStateFor", () => {
  it("does not say you are free when a source needs a login", () => {
    // "Nothing due in the next 60 days." said over an expired Gradescope
    // session is §11's silent missing deadline with a friendly face.
    const empty = emptyStateFor(sources({ gradescope: status({ state: "needs_login" }) }), false);
    expect(empty.text).toContain("sign in");
    expect(empty.logins).toEqual(["gradescope"]);
  });

  it("says the list is incomplete when a source broke", () => {
    const empty = emptyStateFor(sources({ prairielearn: status({ state: "parse_error" }) }), false);
    expect(empty.text).toContain("incomplete");
    expect(empty.logins).toEqual([]);
  });

  it("says it is still checking before the first success", () => {
    expect(emptyStateFor(emptyStore().sources, false).text).toContain("Checking");
  });

  it("only claims nothing is due once something was actually read", () => {
    const empty = emptyStateFor(sources({ canvas: status({ state: "ok" }) }), false);
    expect(empty.text).toBe("Nothing due in the next 60 days.");
  });

  it("mentions hidden or done work rather than implying an empty semester", () => {
    const empty = emptyStateFor(sources({ canvas: status({ state: "ok" }) }), true);
    expect(empty.text).toContain("hidden, finished, or further out");
  });
});

/**
 * Reported from a clean-profile run, 2026-09-12: "I signed into all of them and
 * it still said not signed in... only after I clicked the sync button
 * everything synced up."
 *
 * The first-run screen opens four sign-in tabs and `beta-install.md` tells the
 * student "come back and the dot clears itself". Nothing did. `visibilitychange`
 * redrew from the store, and the store still held the pre-login answer, because
 * signing in happens on an origin this extension never observes.
 */
describe("sourcesToRecheck (the one state fixed where we cannot see it)", () => {
  const at = (ms: number) => NOW.getTime() - ms;

  it("re-checks a source that is waiting on a login", () => {
    const sources = { gradescope: status({ state: "needs_login", lastAttemptAt: iso(60_000) }) };
    expect(sourcesToRecheck(sources, NOW.getTime())).toEqual(["gradescope"]);
  });

  it("re-checks every one of them, because the button opens every tab", () => {
    const sources = {
      canvas: status({ source: "canvas", state: "needs_login", lastAttemptAt: iso(60_000) }),
      gradescope: status({ state: "needs_login", lastAttemptAt: iso(60_000) }),
      prairielearn: status({ source: "prairielearn", state: "ok" }),
    };
    expect(sourcesToRecheck(sources, NOW.getTime()).sort()).toEqual(["canvas", "gradescope"]);
  });

  it("leaves a healthy source alone — returning to the tab is not a sync", () => {
    expect(sourcesToRecheck({ gradescope: status({ state: "ok" }) }, NOW.getTime())).toEqual([]);
  });

  it("leaves a network or parse error alone: nothing the student did fixed those", () => {
    // Those clear on our own schedule. Re-fetching them on every tab switch is
    // a retry loop wearing a different name.
    for (const state of ["network_error", "parse_error"] as const) {
      expect(sourcesToRecheck({ gradescope: status({ state }) }, NOW.getTime()), state).toEqual([]);
    }
  });

  it("leaves a disabled source alone even if its last state was needs_login", () => {
    const off = status({ enabled: false, state: "needs_login" });
    expect(sourcesToRecheck({ gradescope: off }, NOW.getTime())).toEqual([]);
  });

  it("leaves a pending source alone — it already has a sync coming", () => {
    // `displayState` calls a never-attempted source pending, and switching one
    // on fires its own sync. Re-checking here would run a second across it.
    const fresh = status({ state: "needs_login" });
    delete (fresh as { lastAttemptAt?: string }).lastAttemptAt;
    expect(sourcesToRecheck({ gradescope: fresh }, NOW.getTime())).toEqual([]);
  });

  it("debounces, because visibilitychange fires on every tab switch", () => {
    const justTried = { gradescope: status({ state: "needs_login", lastAttemptAt: iso(1_000) }) };
    expect(sourcesToRecheck(justTried, NOW.getTime())).toEqual([]);
    expect(sourcesToRecheck(justTried, at(-RECHECK_AFTER_MS))).toEqual(["gradescope"]);
  });

  /**
   * Sushi, 2026-09-12, diagnosing it exactly: "when I go to the popup it checks,
   * then when I sign in and come back within 10s it doesn't check again cuz
   * it's within the 10s time, so I have to wait until that 10s period is over
   * then come back to the popup for it to check."
   *
   * The debounce asked *how long has it been*. The question is *has anything
   * happened*. Signing in is evidence; a tab switch is not, and a clock cannot
   * tell them apart.
   */
  describe("a page loading on the site itself outranks the debounce", () => {
    it("re-checks inside the window when the site was visited after the attempt", () => {
      const sources = { gradescope: status({ state: "needs_login", lastAttemptAt: iso(3_000) }) };
      expect(sourcesToRecheck(sources, NOW.getTime())).toEqual([]);
      expect(
        sourcesToRecheck(sources, NOW.getTime(), { gradescope: NOW.getTime() - 1_000 }),
      ).toEqual(["gradescope"]);
    });

    it("ignores a visit that happened before the attempt", () => {
      // That navigation is already accounted for — the attempt came after it.
      // Without this the clause would re-fire forever off one stale timestamp.
      const sources = { gradescope: status({ state: "needs_login", lastAttemptAt: iso(3_000) }) };
      expect(
        sourcesToRecheck(sources, NOW.getTime(), { gradescope: NOW.getTime() - 9_000 }),
      ).toEqual([]);
    });

    it("is self-limiting: the attempt it triggers is newer than the navigation", () => {
      // Which is what stops a sync loop without needing a second timer.
      const visited = NOW.getTime() - 5_000;
      const after = { gradescope: status({ state: "needs_login", lastAttemptAt: iso(0) }) };
      expect(sourcesToRecheck(after, NOW.getTime(), { gradescope: visited })).toEqual([]);
    });

    it("re-checks on a tie, because the two mistakes are not equal", () => {
      // `lastAttemptAt` is stamped when the sync starts, so a navigation on the
      // same millisecond may or may not have been seen. An unnecessary
      // re-check costs one request; a skipped one costs half an hour.
      const at = NOW.getTime() - 3_000;
      const sources = {
        gradescope: status({ state: "needs_login", lastAttemptAt: new Date(at).toISOString() }),
      };
      expect(sourcesToRecheck(sources, NOW.getTime(), { gradescope: at })).toEqual(["gradescope"]);
    });

    it("does not resurrect a source that is not waiting on a login", () => {
      // Visiting Canvas is not a reason to re-fetch a page that failed to parse.
      const sources = { canvas: status({ source: "canvas", state: "parse_error" }) };
      expect(sourcesToRecheck(sources, NOW.getTime(), { canvas: NOW.getTime() })).toEqual([]);
    });

    it("re-checks a source visited before it had ever been attempted", () => {
      const fresh = status({ state: "needs_login" });
      delete (fresh as { lastAttemptAt?: string }).lastAttemptAt;
      // `pending` still wins: with no attempt recorded, `displayState` says
      // pending and a sync is already coming.
      expect(sourcesToRecheck({ gradescope: fresh }, NOW.getTime(), { gradescope: NOW.getTime() })).toEqual(
        [],
      );
    });
  });

  it("an unreadable timestamp does not get to suppress the check", () => {
    // Parser rule 5: `Date.parse("soon")` is NaN and every comparison against
    // NaN is false, so a naive `now - attempted < window` would let a corrupt
    // value through as "not recent" by accident rather than by decision.
    const broken = { gradescope: status({ state: "needs_login", lastAttemptAt: "soon" }) };
    expect(sourcesToRecheck(broken, NOW.getTime())).toEqual(["gradescope"]);
  });
});

describe("statusAfterEnable", () => {
  it("never reports ok for a source that has just been switched on", () => {
    // Switching a source on fetches nothing. Painting it green here was the
    // same defect as defaultStatus, on the one path a person drives by hand.
    const was = status({ enabled: false, state: "disabled", lastAttemptAt: undefined });
    const now = statusAfterEnable(was, true);
    expect(now.state).toBe("pending");
    expect(displayState(now)).toBe("pending");
  });

  it("drops a stale attempt so an old failure does not describe the new setting", () => {
    const was = status({ state: "parse_error", lastAttemptAt: iso(60_000) });
    const now = statusAfterEnable(was, true);
    expect(now.lastAttemptAt).toBeUndefined();
    expect(displayState(now)).toBe("pending");
  });

  it("keeps lastSuccessAt, which the stale banner needs to age the kept rows", () => {
    const was = status({ state: "ok", lastSuccessAt: iso(7_200_000) });
    expect(statusAfterEnable(was, true).lastSuccessAt).toBe(iso(7_200_000));
  });

  it("reports disabled when switched off", () => {
    expect(statusAfterEnable(status(), false).state).toBe("disabled");
  });
});

describe("healthPill (what replaces the six dots)", () => {
  const SYNCED = new Date(NOW.getTime() - 60_000).toISOString();

  it("says how many, and when, when everything worked", () => {
    const pill = healthPill(
      sources({
        canvas: status({ source: "canvas" }),
        gradescope: status(),
        prairielearn: status({ source: "prairielearn" }),
      }),
      SYNCED,
      NOW,
    );
    expect(pill.tone).toBe("ok");
    expect(pill.text).toMatch(/^All 3 OK · /);
  });

  it("never says OK about a source it did not fetch", () => {
    /*
     * Worker rule 2, which this module exists for. A cold install has four
     * sources switched on and no attempt behind any of them; `defaultStatus`
     * used to seed `state: "ok"`, so the popup showed four green dots under the
     * words "Not synced yet".
     */
    const pill = healthPill(
      sources({
        canvas: status({ source: "canvas", state: "ok", lastAttemptAt: undefined, lastSuccessAt: undefined }),
        gradescope: status({ state: "ok", lastAttemptAt: undefined, lastSuccessAt: undefined }),
      }),
      undefined,
      NOW,
    );
    expect(pill.tone).toBe("pending");
    expect(pill.text).toBe("Checking…");
    expect(pill.text).not.toContain("OK");
  });

  it("reports the sources it has not read yet rather than rounding up", () => {
    const pill = healthPill(
      sources({
        canvas: status({ source: "canvas" }),
        gradescope: status({ state: "pending", lastAttemptAt: undefined, lastSuccessAt: undefined }),
      }),
      SYNCED,
      NOW,
    );
    expect(pill.tone).toBe("pending");
    expect(pill.text).toBe("Checking… 1 of 2 read");
  });

  it("leads with signing in, because that is the half a student can finish", () => {
    /*
     * Both are failures and red is the more severe colour. `staleNotice`
     * already sorts this way and for the same reason: one is ten seconds of
     * work, the other can only be fixed by a new build. Leading with the red
     * one buries the actionable half.
     */
    const pill = healthPill(
      sources({
        gradescope: status({ state: "needs_login" }),
        canvas: status({ source: "canvas", state: "parse_error" }),
      }),
      SYNCED,
      NOW,
    );
    expect(pill.tone).toBe("warn");
    expect(pill.text).toBe("Sign in to Gradescope");
    expect(pill.action).toEqual({
      kind: "login",
      source: "gradescope",
      url: "https://www.gradescope.com/login",
    });
  });

  it("names the site rather than its storage key", () => {
    const pill = healthPill(
      sources({ prairietest: status({ source: "prairietest", state: "parse_error" }) }),
      SYNCED,
      NOW,
    );
    expect(pill.tone).toBe("err");
    expect(pill.text).toBe("PrairieTest looks different");
  });

  it("does not call a failed fetch a page that changed", () => {
    /*
     * Reported from a live run: Gradescope showed "couldn't be read", and the
     * entire fix was pressing Sync now.
     *
     * §6 classifies into two branches and this function threw the distinction
     * away — which is worker house rule 2's own example, reintroduced one layer
     * up. "Couldn't be read" means the page changed shape and sends someone to
     * look at selectors; "couldn't be reached" means the request failed and the
     * fix is one button.
     */
    const pill = healthPill(
      sources({ gradescope: status({ state: "network_error" }) }),
      SYNCED,
      NOW,
    );
    expect(pill.text).toBe("Gradescope didn't answer");
    expect(pill.text).not.toContain("different");
    expect(pill.action).toEqual({ kind: "retry", source: "gradescope" });
  });

  it("leads with the failure that can be retried", () => {
    // Ranked by what the student can do, not by severity: retrying is one
    // click, a page that genuinely changed shape needs a new build.
    const pill = healthPill(
      sources({
        canvas: status({ source: "canvas", state: "parse_error" }),
        gradescope: status({ state: "network_error" }),
      }),
      SYNCED,
      NOW,
    );
    expect(pill.text).toBe("2 sites didn't answer");
    expect(pill.action).toEqual({ kind: "retry", source: "gradescope" });
  });

  it("always offers something to do about a failure", () => {
    /*
     * The other half of the same report: clicking the words got a list, and the
     * list had nothing on it either, because only `needs_login` produced a
     * button. A pill that names a broken site and offers nothing is a dead end
     * at the exact moment a student needs a way forward.
     */
    for (const state of ["needs_login", "network_error", "parse_error"] as const) {
      const pill = healthPill(sources({ gradescope: status({ state }) }), SYNCED, NOW);
      expect(pill.action, state).toBeDefined();
    }
  });

  it("keeps the pill short enough to finish its own sentence", () => {
    /*
     * 400px, minus a dot, a button and three icon buttons. "Gradescope couldn't
     * be reached" truncated to "…couldn't be rea…", losing the one word the
     * whole distinction turns on — so the sentence has a budget and this is it.
     */
    for (const state of ["needs_login", "network_error", "parse_error"] as const) {
      const pill = healthPill(
        sources({ prairielearn: status({ source: "prairielearn", state }) }),
        SYNCED,
        NOW,
      );
      expect(pill.text.length, `${state}: ${pill.text}`).toBeLessThanOrEqual(28);
    }
  });

  it("counts rather than listing when several are wrong", () => {
    // 400px. Three names and two conjunctions do not fit in a 24px pill, and a
    // pill that ellipses mid-name says less than a number.
    const logins = healthPill(
      sources({
        gradescope: status({ state: "needs_login" }),
        canvas: status({ source: "canvas", state: "needs_login" }),
      }),
      SYNCED,
      NOW,
    );
    expect(logins.text).toBe("Sign in to 2 sites");

    // Both unreadable, so the sentence is the unreadable one. The mixed case —
    // where one of them is merely unreachable — is its own test above.
    const broken = healthPill(
      sources({
        gradescope: status({ state: "parse_error" }),
        canvas: status({ source: "canvas", state: "parse_error" }),
      }),
      SYNCED,
      NOW,
    );
    expect(broken.text).toBe("2 sites look different");
  });

  it("says so when nothing is switched on, instead of claiming health", () => {
    // `syncSites` returning [] with no adapters enabled, recorded as ok, is the
    // defect that cost a real user two rounds of "why don't I see any rows".
    const pill = healthPill(
      sources({ gradescope: status({ enabled: false, state: "disabled" }) }),
      SYNCED,
      NOW,
    );
    expect(pill.tone).toBe("warn");
    expect(pill.text).toBe("No sites are switched on");
  });

  it("offers no login for a source that has no login page", () => {
    // A course website is whatever host its adapter points at.
    const pill = healthPill(
      sources({ site: status({ source: "site", state: "needs_login" }) }),
      SYNCED,
      NOW,
    );
    expect(pill.action).toBeUndefined();
  });

  it("drops the clock rather than printing Invalid Date", () => {
    const pill = healthPill(sources({ gradescope: status() }), "not a date", NOW);
    expect(pill.text).toBe("Gradescope OK");
  });
});

describe("sourceRows (the pill's popover, and Settings)", () => {
  it("puts whatever is wrong first and whatever is off last", () => {
    // The reason to open the list is almost always one broken row, and scanning
    // six of them to find it is the cost the pill was supposed to remove.
    const rows = sourceRows(
      sources({
        canvas: status({ source: "canvas", state: "ok" }),
        gradescope: status({ state: "needs_login" }),
        prairielearn: status({ source: "prairielearn", enabled: false, state: "disabled" }),
        prairietest: status({ source: "prairietest", state: "parse_error" }),
      }),
      NOW,
    );
    expect(rows.map((r) => r.source)).toEqual([
      "gradescope",
      "prairietest",
      "canvas",
      "prairielearn",
    ]);
  });

  it("says the state in words a student has seen before", () => {
    const [row] = sourceRows(sources({ gradescope: status({ state: "needs_login" }) }), NOW);
    expect(row!.word).toBe("Sign in needed");
    expect(row!.word).not.toContain("_");
    expect(row!.action).toEqual({
      kind: "login",
      source: "gradescope",
      url: "https://www.gradescope.com/login",
    });
  });

  it("gives every failing row something to press", () => {
    // It used to carry a `loginUrl`, so the shape of the data said only logins
    // were actionable — and a source that could not be reached rendered as a
    // red row with nothing on it.
    const rows = sourceRows(
      sources({
        gradescope: status({ state: "network_error" }),
        canvas: status({ source: "canvas", state: "parse_error" }),
        prairietest: status({ source: "prairietest", state: "needs_login" }),
      }),
      NOW,
    );
    for (const row of rows) expect(row.action, row.source).toBeDefined();
    expect(rows.find((r) => r.source === "gradescope")!.action!.kind).toBe("retry");
    expect(rows.find((r) => r.source === "canvas")!.action!.kind).toBe("open");
  });

  it("reports a never-attempted source as pending, not as its seeded state", () => {
    const [row] = sourceRows(
      sources({ canvas: status({ source: "canvas", state: "ok", lastAttemptAt: undefined }) }),
      NOW,
    );
    expect(row!.state).toBe("pending");
    expect(row!.word).toBe("Checking…");
  });

  it("keeps the exact stamp behind the relative one", () => {
    const [row] = sourceRows(sources({ gradescope: status() }), NOW);
    // The helper's status() is stamped a minute back.
    expect(row!.lastRead).toBe("1 min ago");
    expect(row!.lastReadExact).toBeTruthy();
  });

  it("says nothing about a read that never happened", () => {
    const [row] = sourceRows(
      sources({ gradescope: status({ state: "needs_login", lastSuccessAt: undefined }) }),
      NOW,
    );
    expect(row!.lastRead).toBeUndefined();
  });

  it("offers nothing to do about a source that is fine, or merely off", () => {
    // Offering "log in" beside a switch the student deliberately turned off is
    // an invitation to undo a choice they just made — and a button on a healthy
    // row is a button that teaches people to ignore the buttons.
    const [off] = sourceRows(
      sources({ gradescope: status({ enabled: false, state: "disabled" }) }),
      NOW,
    );
    expect(off!.action).toBeUndefined();
    const [ok] = sourceRows(sources({ gradescope: status({ state: "ok" }) }), NOW);
    expect(ok!.action).toBeUndefined();
    expect(actionFor("gradescope", "pending")).toBeUndefined();
  });

  it("sends a parse error to the site rather than to a login form", () => {
    // The session is valid — that is what makes it a parse error rather than a
    // needs_login. A login page is an answer to a question nobody asked; the
    // useful thing is to see the page the parser could not make sense of.
    const action = actionFor("gradescope", "parse_error");
    expect(action).toEqual({
      kind: "open",
      source: "gradescope",
      url: "https://www.gradescope.com/",
    });
  });

  it("falls back to a retry for a source with no page to open", () => {
    // A course website is whatever host its adapter points at, so there is no
    // single URL — and a row with no action is the dead end this fixes.
    expect(actionFor("site", "parse_error")).toEqual({ kind: "retry", source: "site" });
  });

  /**
   * Reported 2026-09-12, from the clean-profile run: "for reading the cs424
   * website it just says sign in needed but it doesnt link me to the sign in
   * page."
   *
   * `LOGIN_URL` has no entry for `site` and correctly cannot: a course website
   * is whatever host an adapter points at. But the page *is* known by the time
   * the row is drawn — it is the URL that answered 401 — and the sync loop now
   * records it.
   */
  describe("a course website has no login form, but it does have a page", () => {
    const PAGE = "https://courses.grainger.illinois.edu/cs424/fa2026/secure/schedule.html";

    it("offers the page the last attempt found locked", () => {
      expect(actionFor("site", "needs_login", PAGE)).toEqual({
        kind: "login",
        source: "site",
        url: PAGE,
      });
    });

    it("still has nothing to offer when no attempt recorded one", () => {
      // Honest: before the first fetch there is no way to know which of several
      // course sites needs signing into, and inventing one is worse than a row
      // with no button.
      expect(actionFor("site", "needs_login")).toBeUndefined();
    });

    it("a real login form still wins over a page that merely demanded one", () => {
      const action = actionFor("gradescope", "needs_login", "https://www.gradescope.com/courses/1");
      expect(action).toEqual({
        kind: "login",
        source: "gradescope",
        url: "https://www.gradescope.com/login",
      });
    });

    it("reaches the popover row, which is where it was missing", () => {
      const rows = sourceRows(
        { site: status({ source: "site", state: "needs_login", loginUrl: PAGE }) },
        NOW,
      );
      expect(rows[0]?.action).toEqual({ kind: "login", source: "site", url: PAGE });
    });

    it("and the pill, so the header button opens it too", () => {
      const pill = healthPill(
        { site: status({ source: "site", state: "needs_login", loginUrl: PAGE }) },
        NOW.toISOString(),
        NOW,
      );
      expect(pill.action).toEqual({ kind: "login", source: "site", url: PAGE });
    });
  });
});

/**
 * The student's own list is not a source with health.
 *
 * Worker house rule 2 says a green dot means "I fetched, and it was fine".
 * Nothing is ever fetched for `manual`, so there is no attempt behind any dot it
 * could show — and a row that can only ever read "Off", with a switch that does
 * nothing and no error it could ever report, is a line that costs a reader
 * attention and returns nothing.
 */
describe("the manual source is excluded from every health surface", () => {
  const manual = status({ source: "manual", enabled: true, state: "disabled" });

  it("is on neither side of \"n of m sources OK\"", () => {
    const withoutIt = summarize(sources({ canvas: status(), gradescope: status() }));
    const withIt = summarize(sources({ canvas: status(), gradescope: status(), manual }));
    expect(withIt).toEqual(withoutIt);
    // Not in `disabled` either: that list reads as "switched off or
    // unconfigured", which is something a student could act on.
    expect(withIt.disabled).toEqual([]);
  });

  it("does not change the status line", () => {
    const line = statusLine(
      sources({ canvas: status(), gradescope: status(), manual }),
      NOW.toISOString(),
      NOW,
    );
    expect(line).toContain("all 2 sources OK");
  });

  it("gets no row in the sources panel", () => {
    const rows = sourceRows(sources({ canvas: status(), manual }), NOW);
    expect(rows.map((row) => row.source)).toEqual(["canvas"]);
  });

  it("never becomes a stale banner", () => {
    // Nothing is fetched for it, so "hasn't been read since…" has no meaning.
    expect(staleNotice(sources({ manual }), NOW)).toBeUndefined();
  });
});

/**
 * Google Calendar's row.
 *
 * It is not a `Source`, and the two assertions that matter are both about what
 * it must *not* do: it must never earn a green state from a switch, and it must
 * never appear in any count of sources that were fetched.
 */
describe("the Google Calendar row", () => {
  it("is absent when the feature is off", () => {
    // A permanently grey line about a feature nobody turned on is the dot that
    // can only be one colour (worker rule 2).
    expect(gcalRow({ enabled: false, state: "never" }, NOW)).toBeUndefined();
    expect(gcalRow(undefined, NOW)).toBeUndefined();
  });

  it("is not green on a connection alone", () => {
    const row = gcalRow({ enabled: true, state: "connected" }, NOW);
    expect(row?.tone).not.toBe("ok");
  });

  it("is green once a push wrote what it wrote", () => {
    const row = gcalRow(
      { enabled: true, state: "connected", lastPushAt: NOW.toISOString(), lastPushCount: 14 },
      NOW,
    );
    expect(row?.tone).toBe("ok");
    expect(row?.word).toContain("14 events");
  });

  it("never counts as a source that was fetched", () => {
    /*
     * The toolbar pill, the badge and the sources panel all walk
     * `store.sources`, and this lives in `store.gcal` - so the exclusion is
     * structural. Asserted anyway, because the cheapest way to break it later
     * is to add a `gcal` entry to `sources` and think it is tidier.
     */
    const only = sources({ canvas: status({ state: "ok", lastSuccessAt: iso(60_000) }) });
    expect(summarize(only).checkable).toEqual(["canvas"]);
    expect(sourceRows(only, NOW).map((row) => row.source)).toEqual(["canvas"]);
    expect(healthPill(only, NOW.toISOString(), NOW).text).not.toContain("Calendar");
  });
});
