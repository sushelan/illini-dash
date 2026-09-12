/**
 * Health display (§0 rule 3, §8.1, worker house rule 2).
 *
 * The defect this module exists to kill is "a green dot that means I did not
 * fetch", so most of these tests are about what the UI is *forbidden* to claim.
 */

import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_MS,
  badgeFor,
  displayState,
  emptyStateFor,
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
