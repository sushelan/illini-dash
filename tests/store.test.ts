/**
 * Loading a store written by an older build.
 *
 * During a beta week fixes ship to stores nobody can see or reset, so the
 * question this pins is not "does a future migration work" but "does today's
 * build read yesterday's data without losing anything the student did".
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_SOURCES, migrate } from "../src/core/store.js";

const V1 = JSON.parse(
  readFileSync(new URL("../fixtures/store/v1.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("a committed schemaVersion 1 store", () => {
  const store = migrate(structuredClone(V1));

  it("keeps every correction the student made", () => {
    // These are the fields whose silent loss would be unrecoverable and
    // invisible: the student would simply find their split re-merged.
    expect(store.overrides.hiddenKeys).toEqual(["site:cs424-fa26:hw1"]);
    expect(store.overrides.splitKeys).toEqual(["prairielearn:224254:HW3"]);
    expect(store.overrides.disabledCourses).toEqual(["BUS_ILBC_OPEN"]);
    expect(store.overrides.mergeGroups).toEqual([
      ["canvas:assignment:9002", "gradescope:8398957"],
    ]);
  });

  it("keeps what has already been notified, so nothing re-fires", () => {
    expect(store.items[0]!.notified).toEqual({ "24h": "2026-09-08T17:00:00.000Z" });
  });

  it("keeps per-source health, backoff, misses and enabled adapters", () => {
    expect(store.sources.gradescope.state).toBe("needs_login");
    expect(store.sources.gradescope.consecutiveFailures).toBe(3);
    expect(store.sources.gradescope.lastError).toContain("401");
    expect(store.backoffUntil.gradescope).toBe("2026-09-10T15:00:00.000Z");
    expect(store.misses["site:cs424-fa26:hw1"]).toBe(1);
    expect(store.enabledAdapters).toEqual(["cs424-fa26"]);
    expect(store.lastSyncAt).toBe("2026-09-10T13:00:00.000Z");
  });

  it("fills in fields the older build never wrote", () => {
    // Added after this snapshot: the tick-off list and the not-for-credit
    // reminder switch. A store missing them must not lose the rest.
    expect(store.overrides.doneKeys).toEqual([]);
    expect(store.settings.remindNotForCredit).toBe(false);
  });

  it("drops a half-written raw entry instead of passing it on as real", () => {
    // `gradescope:junk` has no sourceId, url or fetchedAt. `gradescope:empty`
    // has all of them and an empty `sourceId`, which `typeof x === "string"`
    // accepts — house rule 5's whole point, and the one that would produce a
    // memberKey of `gradescope:` shared by every such row. Cast rather than
    // checked, both reached dedupe, grouping and schedule looking real.
    expect(Object.keys(store.raw).sort()).toEqual([
      "gradescope:8398957",
      "site:cs424-fa26:hw1",
    ]);
  });

  it("drops items that are not items, and keeps the one that is", () => {
    expect(store.items).toHaveLength(1);
    expect(store.items[0]!.id).toBe("abc123def456");
  });

  it("keeps a usable raw item whole, including extra", () => {
    const site = store.raw["site:cs424-fa26:hw1"]!;
    expect(site.extra?.["timeAssumed"]).toBe("true");
    expect(site.dueAt).toBe("2026-09-08T23:59:00-05:00");
  });

  it("does not mutate the stored blob it was handed", () => {
    const before = JSON.stringify(V1);
    migrate(structuredClone(V1));
    expect(JSON.stringify(V1)).toBe(before);
  });

  it("survives a store that is not a store at all", () => {
    for (const junk of [null, undefined, 42, "text", []]) {
      expect(() => migrate(junk)).not.toThrow();
    }
    expect(migrate(null).items).toEqual([]);
  });
});

describe("setupDoneAt — the upgrade, exactly once", () => {
  /*
   * The clause that decides whether a beta tester's next update looks like a
   * wipe. `needsSetup` originally asked "has any source ever succeeded?" live,
   * which covered the upgrade and broke Reset: the popup fires a sync on open,
   * that sync succeeds because the browser is still signed in, and setup
   * completed itself about a second after Reset was pressed.
   *
   * So the question is asked once, of a blob written by a build that predates
   * the field, and never again.
   */
  const OK = "2026-09-10T18:00:00.000Z";
  const LATER = "2026-09-10T20:00:00.000Z";

  function stored(patch: Record<string, unknown>): Record<string, unknown> {
    return {
      schemaVersion: 1,
      raw: {},
      items: [],
      sources: {},
      overrides: {},
      settings: {},
      ...patch,
    };
  }

  it("stamps a working install written before the field existed", () => {
    const store = migrate(
      stored({ sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } } }),
    );
    expect(store.setupDoneAt).toBe(OK);
  });

  it("stamps the real v1 capture, which is what a tester actually has", () => {
    expect(migrate(V1).setupDoneAt).toBeDefined();
  });

  it("uses the newest success, not whichever source came first", () => {
    const store = migrate(
      stored({
        sources: {
          canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 },
          gradescope: { source: "gradescope", enabled: true, state: "ok", lastSuccessAt: LATER, consecutiveFailures: 0 },
        },
      }),
    );
    expect(store.setupDoneAt).toBe(LATER);
  });

  it("leaves an old install that never worked needing setup", () => {
    // Installed, never signed in. That student never finished setting up, so
    // the screen is exactly what they should get.
    const store = migrate(
      stored({ sources: { canvas: { source: "canvas", enabled: true, state: "needs_login", consecutiveFailures: 1 } } }),
    );
    expect(store.setupDoneAt).toBeUndefined();
  });

  it("does not stamp a current store, however well it is doing", () => {
    // The Reset case. After `chrome.storage.local.clear()` the next save is at
    // the current version, so a sync that succeeds cannot retroactively claim
    // the student finished a screen they never saw.
    const store = migrate(
      stored({
        schemaVersion: 2,
        sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } },
      }),
    );
    expect(store.setupDoneAt).toBeUndefined();
  });

  it("keeps a stamp the student earned by finishing the screen", () => {
    expect(migrate(stored({ schemaVersion: 2, setupDoneAt: OK })).setupDoneAt).toBe(OK);
  });

  it("treats a blob with no version at all as pre-2", () => {
    // `undefined` is not a number, and comparing it as one is how a very old
    // store would have been mistaken for a current one.
    const store = migrate({
      sources: { canvas: { source: "canvas", enabled: true, state: "ok", lastSuccessAt: OK, consecutiveFailures: 0 } },
    });
    expect(store.setupDoneAt).toBe(OK);
  });
});

/**
 * `manualItems` — the one list in the store that exists in exactly one place.
 *
 * A fetched row that is dropped on load comes back on the next sync. A
 * hand-typed one does not come back at all, so both directions matter: nothing
 * valid may be discarded, and nothing half-written may be kept.
 */
describe("the student's own deadlines, across a reload", () => {
  const typed = {
    source: "manual",
    sourceId: "uuid-1",
    courseRaw: "RHET 105",
    title: "Essay draft",
    kind: "assignment",
    dueAt: "2026-09-30T23:59:00-05:00",
    status: "unknown",
    extra: { timeAssumed: "true" },
    fetchedAt: "2026-09-18T13:00:00.000Z",
  };

  it("keeps a row that has no link, which is the whole point of the field", () => {
    // `isUsableRaw` required a non-empty `url` until `RawItem.url` became
    // optional. Left alone, every hand-typed deadline without a link would have
    // been dropped on the next load — silently, and with nothing to restore it.
    const store = migrate({ manualItems: [typed] });
    expect(store.manualItems).toHaveLength(1);
    expect(store.manualItems[0]!.title).toBe("Essay draft");
    expect(store.manualItems[0]!.extra?.["timeAssumed"]).toBe("true");
  });

  it("still refuses a half-written one", () => {
    // Same bar the fetched rows clear: a missing sourceId would produce the
    // memberKey `manual:`, shared by every such row (house rule 4), and an empty
    // string passes `typeof x === "string"` (house rule 5).
    const store = migrate({
      manualItems: [
        typed,
        { source: "manual", title: "no id, no stamp" },
        { ...typed, sourceId: "" },
        { ...typed, url: "" },
        "not an object",
      ],
    });
    expect(store.manualItems.map((item) => item.sourceId)).toEqual(["uuid-1"]);
  });

  it("is an empty list in a store written before the field existed", () => {
    expect(migrate(structuredClone(V1)).manualItems).toEqual([]);
    expect(migrate({ manualItems: "nope" }).manualItems).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* What a post left behind                                                     */
/* -------------------------------------------------------------------------- */

describe("corrections an instructor's post applied", () => {
  const NOW = "2026-09-18T15:30:00-05:00";
  const entry = {
    at: "2026-10-02T23:59:00-05:00",
    from: "2026-09-30T23:59:00-05:00",
    reason: "Campuswire post 2026-09-18",
    postId: "cw-1",
    appliedAt: "2026-09-18T15:30:00-05:00",
  };

  it("survives a reload", () => {
    const store = migrate({ overrides: { dueOverrides: { "gradescope:mp3": entry } } }, NOW);
    expect(store.overrides.dueOverrides["gradescope:mp3"]).toEqual(entry);
  });

  it("refuses one whose instant is not an instant", () => {
    // House rule 5, and this is the field where it bites hardest: `buildItem`
    // treats this value as *stated*, so a `""` or a bare `2026-10-02` — which
    // `Date.parse` accepts and lands at 7 PM the previous day here — would win
    // over every source and put the row on the wrong day.
    const store = migrate(
      {
        overrides: {
          dueOverrides: {
            "gradescope:a": { ...entry, at: "" },
            "gradescope:b": { ...entry, at: "2026-10-02" },
            "gradescope:c": { ...entry, at: "2026-10-02T23:59:00" },
            "gradescope:d": { ...entry, reason: "" },
            "gradescope:e": { ...entry, postId: "" },
            "gradescope:f": "not an object",
            "gradescope:ok": entry,
          },
        },
      },
      NOW,
    );
    expect(Object.keys(store.overrides.dueOverrides)).toEqual(["gradescope:ok"]);
  });

  it("is an empty map in a store written before the field existed", () => {
    expect(migrate(structuredClone(V1)).overrides.dueOverrides).toEqual({});
  });
});

describe("suggestions and the posts they came from", () => {
  const NOW = "2026-09-18T15:30:00-05:00";
  const suggestion = {
    id: "s1",
    kind: "new",
    title: "Quiz 1",
    courseRaw: "CS 357",
    at: "2026-10-12T23:59:00-05:00",
    timeAssumed: true,
    span: "10/12",
    context: "Quiz 1 is due 10/12.",
    source: "campuswire",
    postId: "cw-1",
    postedAt: "2026-09-18T15:00:00-05:00",
    createdAt: "2026-09-18T15:30:00-05:00",
  };

  it("survives a reload", () => {
    const store = migrate({ suggestions: [suggestion], seenPosts: { "cw-1": NOW } }, NOW);
    expect(store.suggestions).toEqual([suggestion]);
    expect(store.seenPosts).toEqual({ "cw-1": NOW });
  });

  it("refuses a half-written one", () => {
    // A suggestion exists in exactly one place and its evidence *is* its
    // fields: one with no `span` is a deadline with no words behind it, which
    // is the one thing this feature promises never to show.
    const store = migrate(
      {
        suggestions: [
          suggestion,
          { ...suggestion, id: "s2", span: "" },
          { ...suggestion, id: "s3", at: "2026-10-12" },
          { ...suggestion, id: "s4", source: "reddit" },
          { ...suggestion, id: "s5", kind: "move" },
          // `postSubject` is optional and, when present, a real string: an
          // empty one passes `typeof` and draws `the Piazza post ""` — a row
          // claiming to name the post it came from and naming nothing.
          { ...suggestion, id: "s6", postSubject: "" },
          "not an object",
        ],
      },
      NOW,
    );
    expect(store.suggestions.map((entry) => entry.id)).toEqual(["s1"]);
    // …and a stated one survives, so the rule is "non-empty", not "absent".
    expect(
      migrate({ suggestions: [{ ...suggestion, postSubject: "MP1 Demo" }] }, NOW).suggestions[0]
        ?.postSubject,
    ).toBe("MP1 Demo");
  });

  it("forgets a suggestion nobody answered in thirty days", () => {
    const old = { ...suggestion, createdAt: "2026-08-01T15:30:00-05:00" };
    expect(migrate({ suggestions: [old] }, NOW).suggestions).toEqual([]);
  });

  it("forgets a suggestion whose deadline is more than a week gone", () => {
    // Pressing Add on one of these files a row that is already overdue, in a
    // list whose entire job is what is still ahead.
    const past = { ...suggestion, at: "2026-09-09T23:59:00-05:00" };
    expect(migrate({ suggestions: [past] }, NOW).suggestions).toEqual([]);
    // Six days past is still worth offering — as long as it was ahead when it
    // was found, which is the third clock's business below. Read on the 11th,
    // due on the 13th: one clock at a time.
    const recent = {
      ...suggestion,
      at: "2026-09-13T23:59:00-05:00",
      createdAt: "2026-09-11T15:30:00-05:00",
    };
    expect(migrate({ suggestions: [recent] }, NOW).suggestions).toHaveLength(1);
  });

  it("forgets a suggestion that was already past when it was found", () => {
    /*
     * The store-side twin of the ingest rule, for rows written before it.
     *
     * Sushi's Attention tab on the 19th still held two of these: read on the
     * 18th, due on the 13th and the 14th. Both clocks above measure against
     * *today*, so neither refuses one until a week has gone by — and the
     * evidence that it was useless is on the row itself, the day it was made.
     */
    const found = { ...suggestion, at: "2026-09-13T23:59:00-05:00" }; // createdAt: 18 Sep
    expect(migrate({ suggestions: [found] }, NOW).suggestions).toEqual([]);
    // Not a date test: the same pair, moved so both clocks are comfortable,
    // still goes. `at` a minute before `createdAt` is enough.
    const later = {
      ...suggestion,
      at: "2026-10-12T23:59:00-05:00",
      createdAt: "2026-10-12T23:59:01-05:00",
    };
    expect(migrate({ suggestions: [later] }, NOW).suggestions).toEqual([]);
    // And the healthy shape — found before it is due, both clocks recent —
    // survives, so the rule is the *order* of the two instants and not a third
    // way of saying "old".
    const ahead = {
      ...suggestion,
      at: "2026-10-12T23:59:00-05:00",
      createdAt: "2026-09-18T15:30:00-05:00",
    };
    expect(migrate({ suggestions: [ahead] }, NOW).suggestions).toHaveLength(1);
  });

  it("forgets a post it read more than sixty days ago", () => {
    const store = migrate(
      {
        seenPosts: {
          ancient: "2026-06-01T15:30:00-05:00",
          recent: "2026-09-01T15:30:00-05:00",
          "not a string": 7,
        },
      },
      NOW,
    );
    expect(Object.keys(store.seenPosts)).toEqual(["recent"]);
  });

  it("is empty in a store written before the fields existed", () => {
    const store = migrate(structuredClone(V1), NOW);
    expect(store.suggestions).toEqual([]);
    expect(store.seenPosts).toEqual({});
  });
});

describe("page observers", () => {
  const NOW = "2026-09-18T15:30:00-05:00";

  it("is off in a store written before the field existed", () => {
    // Not absent: the worker reads `observers.campuswire.enabled` at startup to
    // decide whether to register a content script, and `undefined.enabled`
    // there is a throw in the one place nothing is watching.
    const store = migrate(structuredClone(V1), NOW);
    expect(store.observers).toEqual({ campuswire: { enabled: false }, piazza: { enabled: false } });
  });

  it("only `true` is on", () => {
    // House rule 5: `typeof x === "boolean"` is not what is wanted either. A
    // half-written `"yes"` must not register a content script on a host the
    // student never granted.
    for (const stored of ["yes", 1, null, undefined, {}]) {
      expect(
        migrate({ observers: { campuswire: { enabled: stored } } }, NOW).observers.campuswire
          .enabled,
        JSON.stringify(stored),
      ).toBe(false);
    }
    expect(
      migrate({ observers: { campuswire: { enabled: true } } }, NOW).observers.campuswire.enabled,
    ).toBe(true);
  });

  it("keeps the evidence of what was actually read", () => {
    const store = migrate(
      {
        observers: {
          campuswire: { enabled: true, lastObservedAt: "2026-09-18T10:32:00-05:00", postsSeen: 3 },
        },
      },
      NOW,
    );
    expect(store.observers.campuswire).toEqual({
      enabled: true,
      lastObservedAt: "2026-09-18T10:32:00-05:00",
      postsSeen: 3,
    });
  });

  it("drops a last-read stamp that is not an instant, rather than printing it", () => {
    // It is rendered straight into the Settings row; `new Date("soon")` reads
    // "Invalid Date" beside a switch that is working perfectly.
    const store = migrate(
      { observers: { campuswire: { enabled: true, lastObservedAt: "soon", postsSeen: -2 } } },
      NOW,
    );
    expect(store.observers.campuswire).toEqual({ enabled: true });
  });

  it("keeps a deadline count, and refuses one that is not a whole number", () => {
    /*
     * The Piazza row prints "none with a deadline" for `0` and prints nothing
     * at all when this is absent, so the difference between a bad value and a
     * missing one is the difference between a claim and a silence. `"1"` and
     * `1.5` and `-1` are all the absence.
     */
    expect(
      migrate(
        { observers: { piazza: { enabled: true, postsSeen: 25, deadlinesFound: 0 } } },
        NOW,
      ).observers.piazza,
    ).toEqual({ enabled: true, postsSeen: 25, deadlinesFound: 0 });

    for (const bad of ["1", 1.5, -1, null]) {
      expect(
        migrate(
          { observers: { piazza: { enabled: true, postsSeen: 25, deadlinesFound: bad } } },
          NOW,
        ).observers.piazza,
        JSON.stringify(bad),
      ).toEqual({ enabled: true, postsSeen: 25 });
    }
  });

  it("ignores an observer this build has never heard of", () => {
    const store = migrate({ observers: { edstem: { enabled: true } } }, NOW);
    expect(Object.keys(store.observers)).toEqual(["campuswire", "piazza"]);
  });

  it("ignores a source this build has never heard of — an observer most of all", () => {
    /*
     * The mirror of the line above, and the one line the whole
     * observer/source separation rests on.
     *
     * `ObserverId` is a separate type and `store.observers` is a sibling of
     * `store.sources`, but nothing in the *type system* stops a blob written
     * by another build — or by a hand-edited store — from carrying `piazza`
     * under `sources`. This loop is what does: `sources` is rebuilt from
     * `ALL_SOURCES` rather than merged over whatever arrived. Without it a
     * Piazza entry would be a sixth health dot, in "n of m sources", on the
     * toolbar badge and in the footer strip, for a thing the sync loop never
     * fetches and could never turn green (worker rule 2).
     */
    const store = migrate(
      { sources: { piazza: { enabled: true, state: "needs_login" }, edstem: { enabled: true } } },
      NOW,
    );
    expect(Object.keys(store.sources).sort()).toEqual([...ALL_SOURCES].sort());
  });

  /*
   * Piazza's half: an observer the worker *fetches* for, so its entry carries
   * the evidence of an attempt. Every field is validated rather than trusted,
   * for the reason the rest of this file is — a store blob is data from another
   * build, and `describePiazza` prints these at the student.
   */
  it("keeps a Piazza entry's attempt, and only the parts of it that are readable", () => {
    const store = migrate(
      {
        observers: {
          piazza: {
            enabled: true,
            state: "needs_login",
            lastAttemptAt: "2026-09-18T10:32:00-05:00",
            classesFetchedAt: "soon",
            classes: [
              { nid: "abc", courseRaw: "CS 425 / ECE 428", courseCodes: ["CS425"], active: true },
              { nid: "", courseRaw: "no id", courseCodes: [], active: true },
              { nid: "def", courseRaw: "no active flag", courseCodes: [] },
            ],
            lastNr: { abc: 184, notANumber: "184", negative: -3 },
            failures: 2,
          },
        },
      },
      NOW,
    );
    expect(store.observers.piazza).toEqual({
      enabled: true,
      state: "needs_login",
      lastAttemptAt: "2026-09-18T10:32:00-05:00",
      classes: [
        { nid: "abc", courseRaw: "CS 425 / ECE 428", courseCodes: ["CS425"], active: true },
      ],
      lastNr: { abc: 184 },
      failures: 2,
    });
  });

  it("keeps a reader version only when it is a positive integer", () => {
    /*
     * The field that decides whether every Piazza post gets read again. A store
     * written before it existed carries nothing, which must mean **reader 1**
     * (the snippet-only reader) and therefore an upgrade — that is the case
     * Sushi's install is in. A half-written `0`, `-1` or `"2"` must not be
     * mistaken for a reader, in the direction that skips the upgrade: an
     * unreadable value is dropped here and read as 1 by `readerVersionOf`.
     */
    const piazza = (readerVersion: unknown) =>
      migrate({ observers: { piazza: { enabled: true, readerVersion } } }, NOW).observers.piazza;
    expect(piazza(2).readerVersion).toBe(2);
    expect(piazza(1).readerVersion).toBe(1);
    for (const bad of [0, -1, 1.5, "2", null, true, Number.NaN]) {
      expect(piazza(bad).readerVersion, JSON.stringify(bad)).toBeUndefined();
    }
    expect(
      migrate({ observers: { piazza: { enabled: true } } }, NOW).observers.piazza.readerVersion,
    ).toBeUndefined();
  });

  it("refuses a stored state word this build does not know", () => {
    // It is printed on the row. "green", "healthy" or a half-written value
    // would reach `describePiazza`, which answers for the words it knows and
    // would have to invent an answer for anything else.
    for (const state of ["green", "healthy", "", 1, null]) {
      expect(
        migrate({ observers: { piazza: { enabled: true, state } } }, NOW).observers.piazza.state,
        JSON.stringify(state),
      ).toBeUndefined();
    }
    expect(
      migrate({ observers: { piazza: { enabled: true, state: "ok" } } }, NOW).observers.piazza.state,
    ).toBe("ok");
  });
});

/**
 * The `gcal` block.
 *
 * Every field here is validated positively on the way back in, for a sharper
 * reason than the rest of the store: a half-written `byItemId` entry is an
 * event id that goes into a URL, and `""` passing a `typeof` check would build
 * a request against the events *collection* rather than one event.
 */
describe("Google Calendar's stored block", () => {
  it("is off, empty and 'never' in a store that has never heard of it", () => {
    // §0 rule 1's amended wording: the one exception to "nothing leaves the
    // browser" is opt-in, so an upgrade must not switch anything on.
    const store = migrate({ schemaVersion: 2 });
    expect(store.gcal).toEqual({ enabled: false, byItemId: {}, state: "never" });
  });

  it("keeps a real connection across a reload", () => {
    const store = migrate({
      schemaVersion: 2,
      gcal: {
        enabled: true,
        calendarId: "cal-1",
        byItemId: { abc: { eventId: "ev-1", hash: "deadbeef" } },
        lastPushAt: "2026-09-18T15:00:00.000Z",
        lastPushCount: 14,
        state: "connected",
      },
    });
    expect(store.gcal.calendarId).toBe("cal-1");
    expect(store.gcal.byItemId["abc"]).toEqual({ eventId: "ev-1", hash: "deadbeef" });
    expect(store.gcal.lastPushCount).toBe(14);
    expect(store.gcal.state).toBe("connected");
  });

  it("drops an index entry with no usable event id", () => {
    const store = migrate({
      schemaVersion: 2,
      gcal: {
        enabled: true,
        byItemId: {
          good: { eventId: "ev-1", hash: "h" },
          empty: { eventId: "", hash: "h" },
          missing: { hash: "h" },
          junk: "nope",
        },
        state: "connected",
      },
    });
    expect(Object.keys(store.gcal.byItemId)).toEqual(["good"]);
  });

  it("refuses a lastPushAt that is not an instant", () => {
    // The chip prints this. A half-written value would render
    // "Pushed 14 events · Invalid Date".
    const store = migrate({
      schemaVersion: 2,
      gcal: { enabled: true, byItemId: {}, state: "connected", lastPushAt: "yesterday" },
    });
    expect(store.gcal.lastPushAt).toBeUndefined();
  });

  it("does not restore 'pushing', which a torn-down worker leaves behind", () => {
    // Restoring it would draw "Working…" forever over nothing happening.
    const store = migrate({
      schemaVersion: 2,
      gcal: { enabled: true, byItemId: {}, state: "pushing" },
    });
    expect(store.gcal.state).toBe("never");
  });

  it("falls back to 'never' for a state this build has no sentence for", () => {
    const store = migrate({
      schemaVersion: 2,
      gcal: { enabled: true, byItemId: {}, state: "quantum_entangled" },
    });
    expect(store.gcal.state).toBe("never");
  });
});
