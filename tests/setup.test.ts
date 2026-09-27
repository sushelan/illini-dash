/**
 * First run (`src/core/setup.ts`).
 *
 * The decision this module exists to get right is *when not to show*. A setup
 * screen in front of someone who set up last week is worse than no setup screen
 * at all: it looks like the extension forgot everything.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { SOURCE_STATES } from "../src/sources/types.js";
import { toneOf } from "../src/core/health.js";
import {
  isChecking,
  loginsToOpen,
  needsSetup,
  opensOnInstall,
  parseAttempting,
  setupChip,
  setupProgress,
  setupRows,
  setupSummary,
} from "../src/core/setup.js";
import { STATE_WORD } from "../src/core/names.js";
import { emptyStore } from "../src/core/store.js";
import type { Source, SourceState } from "../src/sources/types.js";
import type { StoreV1Plus } from "../src/core/store.js";

function storeWith(
  sources: Partial<
    Record<
      Source,
      {
        enabled?: boolean;
        state?: SourceState;
        lastAttemptAt?: string;
        lastSuccessAt?: string;
        lastError?: string;
      }
    >
  >,
  extra: Partial<StoreV1Plus> = {},
): StoreV1Plus {
  const store = { ...emptyStore(), ...extra };
  for (const [source, patch] of Object.entries(sources)) {
    const key = source as Source;
    store.sources[key] = { ...store.sources[key]!, ...patch };
  }
  return store;
}

describe("needsSetup", () => {
  it("shows the screen on a genuinely fresh install", () => {
    expect(needsSetup(emptyStore())).toBe(true);
  });

  it("never shows it again once it has been finished", () => {
    expect(needsSetup(storeWith({}, { setupDoneAt: "2026-09-11T00:00:00.000Z" }))).toBe(false);
  });

  it("is not satisfied by a sync that happened to succeed", () => {
    /*
     * The bug Sushi hit: Reset, and the calendar was back within a second.
     * `needsSetup` accepted "some source has succeeded" as evidence of being
     * set up, and the popup fires a sync the moment it opens — which succeeds,
     * because the browser is still signed in to everything. Setup completed
     * itself. The upgrade case it was there for now happens once, in `migrate`.
     */
    expect(
      needsSetup(storeWith({ canvas: { state: "ok", lastSuccessAt: "2026-09-11T00:00:00.000Z" } })),
    ).toBe(true);
  });

  it("is still showing after a failed fetch", () => {
    expect(needsSetup(storeWith({ canvas: { state: "needs_login" } }))).toBe(true);
  });
});

describe("setupRows", () => {
  const rows = setupRows(emptyStore());

  it("offers the five sources a student chooses between", () => {
    expect(rows.map((row) => row.source)).toEqual([
      "canvas",
      "gradescope",
      "prairielearn",
      "prairietest",
      "smartphysics",
    ]);
  });

  it("does not offer course websites, which are chosen one at a time", () => {
    // §4.5 adapters need a per-site host permission, so a single checkbox for
    // "course websites" cannot mean anything — it was the exact control that
    // produced a green dot over nothing (worker rule 2).
    expect(rows.some((row) => row.source === "site")).toBe(false);
  });

  it("carries each source's default, so the common case needs no clicks", () => {
    const enabled = Object.fromEntries(rows.map((row) => [row.source, row.enabled]));
    expect(enabled["canvas"]).toBe(true);
    expect(enabled["gradescope"]).toBe(true);
    // Off by default: it serves PHYS 211-214 only, and everyone else would get
    // a sign-in prompt for a site they have never heard of.
    expect(enabled["smartphysics"]).toBe(false);
  });

  it("says who each site is for", () => {
    // A checklist of names nobody recognises cannot be answered, and the
    // expensive mistake here is unchecking something you do need.
    for (const row of rows) expect(row.hint.length, row.source).toBeGreaterThan(0);
    expect(rows.find((row) => row.source === "smartphysics")!.hint).toContain("211");
  });

  it("reflects a choice the student has already made", () => {
    const rows2 = setupRows(storeWith({ prairietest: { enabled: false } }));
    expect(rows2.find((row) => row.source === "prairietest")!.enabled).toBe(false);
  });
});

describe("loginsToOpen", () => {
  it("opens only the sites the student said they use", () => {
    const rows = setupRows(storeWith({ prairietest: { enabled: false } }));
    expect(loginsToOpen(rows)).not.toContain("prairietest");
  });

  it("includes a source that has not been fetched yet", () => {
    // On a first run everything is pending. A strict "needs_login only" list
    // would be empty at exactly the moment this button exists for.
    expect(loginsToOpen(setupRows(emptyStore()))).toContain("canvas");
  });

  it("skips a source that is already working", () => {
    const rows = setupRows(
      storeWith({ canvas: { state: "ok", lastSuccessAt: "2026-09-10T18:00:00.000Z" } }),
    );
    expect(loginsToOpen(rows)).not.toContain("canvas");
  });

  it("includes one that asked for a sign-in", () => {
    expect(loginsToOpen(setupRows(storeWith({ gradescope: { state: "needs_login" } })))).toContain(
      "gradescope",
    );
  });

  it("skips one that failed for a reason signing in will not fix", () => {
    // A parse error means the page changed. Opening its login page tells the
    // student to do something that cannot help.
    const rows = setupRows(storeWith({ gradescope: { state: "parse_error" } }));
    expect(loginsToOpen(rows)).not.toContain("gradescope");
  });
});

/*
 * A source the last attempt read successfully. `lastAttemptAt` is what makes
 * `displayState` say anything other than `pending` — which is the point: these
 * tests used to give a row `lastSuccessAt` and nothing else, and that is the
 * exact shape the defect below read as "connected".
 */
const at = "2026-09-10T18:00:00.000Z";
const read = { state: "ok" as const, lastAttemptAt: at, lastSuccessAt: at };

describe("setupProgress and setupSummary", () => {
  it("counts only the sources the student chose", () => {
    const rows = setupRows(
      storeWith({
        canvas: read,
        prairietest: { enabled: false, ...read },
      }),
    );
    const progress = setupProgress(rows);
    expect(progress.chosen).toBe(3);
    expect(progress.connected).toBe(1);
  });

  it("never claims a source works before anything has been read", () => {
    // The fresh-install green dot, one level up (worker rule 2): "connected"
    // has to mean a fetch happened and succeeded.
    expect(setupProgress(setupRows(emptyStore()))).toMatchObject({ connected: 0, working: false });
  });

  it("does not count a source whose latest attempt failed, however recently it once worked", () => {
    /*
     * sync-health #5 / copy-audit #2 / pl-empty #4 (2026-09-27). `connected`
     * was `lastSuccessAt !== undefined`, so a Canvas that read yesterday and
     * did not answer today was "connected" here while the badge, the footer
     * and the Sources tab all said it was not — on one store, in one second.
     * Worker rule 2: what the UI asserts about a source comes from the attempt
     * that happened, and that is the latest one.
     */
    const rows = setupRows(
      storeWith({
        canvas: { state: "network_error", lastAttemptAt: at, lastSuccessAt: "2026-09-09T18:00:00.000Z" },
        gradescope: { state: "parse_error", lastAttemptAt: at, lastSuccessAt: "2026-09-09T18:00:00.000Z" },
        prairielearn: read,
        prairietest: { enabled: false },
      }),
    );
    expect(setupProgress(rows)).toMatchObject({ connected: 1, chosen: 3 });
    expect(setupSummary(setupProgress(rows))).not.toMatch(/^All /);
  });

  it("counts a source that read fine and has no courses as connected", () => {
    // DESIGN (b): `empty` stamps `lastSuccessAt` because the fetch and the
    // read both succeeded; "All 2 connected" over Canvas ok + PrairieLearn
    // with no courses is true, and anything less would send the student to
    // sign in to a site they are signed in to.
    const rows = setupRows(
      storeWith({
        canvas: read,
        prairielearn: { state: "empty", lastAttemptAt: at, lastSuccessAt: at },
        gradescope: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupSummary(setupProgress(rows))).toBe("All 2 connected.");
  });

  it("says what is left rather than only how far along it is", () => {
    const rows = setupRows(
      storeWith({
        canvas: read,
        gradescope: { state: "needs_login", lastAttemptAt: at },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupSummary(setupProgress(rows))).toBe("1 of 2 connected. Sign in to Gradescope.");
  });

  it("promises a sign-in only for the sources that asked for one", () => {
    /*
     * pl-empty #5 / popup-live #8: "3 of 5 connected. The rest still need you
     * to sign in." while `loginsToOpen` was empty, and "1 of 3 connected. The
     * rest still need you to sign in." while PrairieLearn was still checking.
     * Each remaining source gets what its own last attempt found.
     */
    const rows = setupRows(
      storeWith({
        canvas: read,
        gradescope: { state: "needs_login", lastAttemptAt: at },
        prairielearn: { state: "network_error", lastAttemptAt: at },
        prairietest: { state: "parse_error", lastAttemptAt: at },
        smartphysics: { enabled: true, state: "pending" },
      }),
    );
    expect(setupSummary(setupProgress(rows))).toBe(
      "1 of 5 connected. Sign in to Gradescope. PrairieLearn didn't answer. " +
        "PrairieTest looks different. smartPhysics hasn't answered yet.",
    );
  });

  it("does not ask for a sign-in while the only thing left is still being checked", () => {
    const rows = setupRows(
      storeWith({
        canvas: read,
        gradescope: read,
        prairielearn: { state: "pending" },
        prairietest: { enabled: false },
      }),
    );
    const sentence = setupSummary(setupProgress(rows));
    expect(sentence).toBe("2 of 3 connected. PrairieLearn hasn't answered yet.");
    expect(sentence).not.toContain("sign in");
  });

  it("agrees with the chip about a row being read right now", () => {
    // The chip on a row being read says "Checking…" over its stored answer;
    // the sentence under it said "Sign in to Gradescope" about the same row in
    // the same frame, because it read the store and not the sync. Found as a
    // surviving mutation (the `checking` argument ignored), 2026-09-27.
    const rows = setupRows(
      storeWith({
        canvas: read,
        gradescope: { state: "needs_login", lastAttemptAt: at },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    const checking = (source: Source) => source === "gradescope";
    expect(setupSummary(setupProgress(rows, checking))).toBe(
      "1 of 2 connected. Gradescope hasn't answered yet.",
    );
  });

  it("handles the student who unchecked everything", () => {
    const none = setupRows(
      storeWith({
        canvas: { enabled: false },
        gradescope: { enabled: false },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupProgress(none).chosen).toBe(0);
    expect(setupSummary(setupProgress(none))).toContain("Nothing selected");
  });

  it("says so when everything chosen is working", () => {
    /*
     * Rewritten 2026-09-27 (worker rule 6). This test used to give every row
     * `lastSuccessAt` and no state, and asserted "All 4 connected." — which
     * pinned the defect: a row with an old success and a failing latest
     * attempt satisfied it too. Each row now carries the attempt that earned
     * the word, and the test above holds the inverse.
     */
    const all = setupRows(
      storeWith({ canvas: read, gradescope: read, prairielearn: read, prairietest: read }),
    );
    expect(setupSummary(setupProgress(all))).toBe("All 4 connected.");
  });

  it("counts one site as a site, not sites", () => {
    const one = setupRows(
      storeWith({
        gradescope: { enabled: false },
        prairielearn: { enabled: false },
        prairietest: { enabled: false },
      }),
    );
    expect(setupSummary(setupProgress(one))).toContain("1 site.");
  });
});

describe("setupSummary, once something has actually been read", () => {
  const connected = () =>
    setupProgress(
      setupRows(
        storeWith({
          canvas: read,
          gradescope: read,
          prairielearn: { enabled: false },
          prairietest: { enabled: false },
          smartphysics: { enabled: false },
        }),
      ),
    );

  it("says what it found rather than how many sites answered", () => {
    // "All 2 connected" is a fact about plumbing. The student installed this
    // for the deadlines, and this line is the first evidence they get that it
    // worked at all.
    expect(setupSummary(connected(), { items: 43, courses: 6 })).toBe(
      "Found 43 deadlines across 6 courses.",
    );
  });

  it("counts one of each without reading as a plural", () => {
    expect(setupSummary(connected(), { items: 1, courses: 1 })).toBe(
      "Found 1 deadline across 1 course.",
    );
  });

  it("falls back to the connection count when nothing was found", () => {
    // Week one, or every deadline further out than the horizon. "Found 0
    // deadlines" reads as a failure; "All 2 connected" is the true statement
    // available at that moment.
    expect(setupSummary(connected(), { items: 0, courses: 0 })).toBe("All 2 connected.");
    expect(setupSummary(connected())).toBe("All 2 connected.");
  });

  it("never claims a find while a source still needs signing in", () => {
    // The count would be from the sources that *did* answer, and presenting it
    // as the whole picture is the §11 failure with a friendly face.
    const partial = setupProgress(
      setupRows(
        storeWith({
          canvas: read,
          gradescope: { state: "needs_login", lastAttemptAt: at },
          prairielearn: { enabled: false },
          prairietest: { enabled: false },
          smartphysics: { enabled: false },
        }),
      ),
    );
    expect(setupSummary(partial, { items: 43, courses: 6 })).toBe(
      "1 of 2 connected. Sign in to Gradescope.",
    );
  });
});

/*
 * The chip on each row of the first-run screen (DESIGN (b) "Setup screen",
 * test 26). It was an if-chain in `screens/setup.ts` that tested
 * `lastSuccessAt` before the failure states, so a source that read once and
 * failed since was a green "Connected" — and the comment above it claimed
 * "the same chips Settings uses" while Settings derived from `displayState`.
 * Now it is that derivation.
 */
describe("setupChip", () => {
  const rowOf = (source: Source, patch: Parameters<typeof storeWith>[0][Source]) =>
    setupRows(storeWith({ [source]: patch }, {})).find((row) => row.source === source)!;

  it("says what the latest attempt found, not that one once succeeded", () => {
    const chip = setupChip(
      rowOf("gradescope", {
        state: "parse_error",
        lastAttemptAt: at,
        lastSuccessAt: "2026-09-01T18:00:00.000Z",
        lastError: "no .courseList on /account",
      }),
      false,
    );
    expect(chip).toEqual({
      text: STATE_WORD["parse_error"],
      tone: "err",
      title: "no .courseList on /account",
    });
  });

  it("says Unreachable, not Connected, for a source that did not answer", () => {
    const chip = setupChip(
      rowOf("canvas", {
        state: "network_error",
        lastAttemptAt: at,
        lastSuccessAt: "2026-09-01T18:00:00.000Z",
        lastError: "TypeError: Failed to fetch",
      }),
      false,
    );
    expect(chip.text).toBe(STATE_WORD["network_error"]);
    expect(chip.tone).toBe("err");
  });

  it("is green only for a read that happened", () => {
    expect(setupChip(rowOf("canvas", read), false)).toEqual({ text: "Connected", tone: "ok" });
    // A stored `ok` with no attempt behind it is the fresh-install green dot.
    expect(
      setupChip(rowOf("canvas", { state: "ok", lastSuccessAt: at }), false).tone,
    ).toBe("pending");
  });

  it("says No courses, grey, with the site's sentence behind it", () => {
    const chip = setupChip(
      rowOf("prairielearn", {
        state: "empty",
        lastAttemptAt: at,
        lastSuccessAt: at,
        lastError: "PrairieLearn lists no courses for you",
      }),
      false,
    );
    expect(chip).toEqual({
      text: "No courses",
      tone: "off",
      title: "PrairieLearn lists no courses for you",
    });
  });

  it("asks for a sign-in with the site's answer as the tooltip", () => {
    const chip = setupChip(
      rowOf("gradescope", {
        state: "needs_login",
        lastAttemptAt: at,
        lastSuccessAt: at,
        lastError: "302 to /login",
      }),
      false,
    );
    expect(chip).toEqual({ text: "Sign in needed", tone: "warn", title: "302 to /login" });
  });

  it("says Off for a source the student did not pick, the word Settings uses", () => {
    // copy-audit #8: this screen said "Not used" where Settings and the
    // Sources tab say "Off". PROGRESS 2026-09-19 moved the checklist onto
    // Settings' chips; this one wording survived that.
    expect(setupChip(rowOf("smartphysics", {}), false)).toEqual({
      text: STATE_WORD["disabled"],
      tone: "off",
    });
    expect(setupChip(rowOf("smartphysics", {}), true).text).toBe(STATE_WORD["disabled"]);
  });

  it("says Checking… on a row being read right now, over whatever it last said", () => {
    const chip = setupChip(
      rowOf("gradescope", { state: "needs_login", lastAttemptAt: at }),
      true,
    );
    expect(chip.text).toBe("Checking…");
    expect(chip.tone).toBe("pending");
  });

  it("says Checking… for a row never attempted, with nothing else to say", () => {
    expect(setupChip(rowOf("canvas", {}), false).text).toBe("Checking…");
  });
});

/*
 * Which rows are being read *right now* (sync-health #5, second half). While
 * any sync ran, every enabled row said "Checking…" — including a source
 * resting in §6's backoff that the running plan does not attempt, so a chip
 * claimed a fetch that was not happening (worker rule 2).
 */
describe("isChecking and parseAttempting", () => {
  it("is false for every row when nothing is syncing", () => {
    expect(isChecking("canvas", false, ["canvas"])).toBe(false);
    expect(isChecking("canvas", false, undefined)).toBe(false);
  });

  it("names only the sources the running plan attempts", () => {
    expect(isChecking("canvas", true, ["canvas"])).toBe(true);
    expect(isChecking("gradescope", true, ["canvas"])).toBe(false);
  });

  it("falls back to every row when the worker has not said which", () => {
    // An older worker, or the moment between the syncing flag and the plan.
    expect(isChecking("gradescope", true, undefined)).toBe(true);
  });

  it("reads the worker's list as data from another build", () => {
    // Worker rule 8: the value in storage.session was written by whichever
    // worker is running, which may be older or newer than this page.
    expect(parseAttempting({ attempting: ["canvas", "prairielearn"] })).toEqual([
      "canvas",
      "prairielearn",
    ]);
    expect(parseAttempting({ attempting: [] })).toEqual([]);
    expect(parseAttempting(undefined)).toBeUndefined();
    expect(parseAttempting(true)).toBeUndefined();
    expect(parseAttempting({ attempting: "canvas" })).toBeUndefined();
    // An unknown key is dropped rather than trusted; the rest still count.
    expect(parseAttempting({ attempting: ["canvas", "moodle", 3] })).toEqual(["canvas"]);
  });
});

describe("opensOnInstall", () => {
  it("opens the first-run screen when the extension is installed", () => {
    // Nothing used to happen on install. The worker synced silently behind an
    // icon Chrome does not pin, so the badge — the only thing that would ever
    // tell a student something was due — was invisible to exactly the student
    // who never opens the popup.
    expect(opensOnInstall("install")).toBe(true);
  });

  it("never opens a tab on an update", () => {
    /*
     * The branch where this would be actively wrong. Chrome updates extensions
     * in the background, so a tab that opens by itself over whatever someone
     * was reading is the behaviour that gets an extension uninstalled — and an
     * update is the one case where the student has already been through setup.
     */
    for (const reason of ["update", "chrome_update", "shared_module_update"]) {
      expect(opensOnInstall(reason), reason).toBe(false);
    }
  });

  it("does not open a tab for a reason it has never heard of", () => {
    // A future Chrome release adding a fifth reason must not default to
    // "spawn a tab".
    expect(opensOnInstall("something_new")).toBe(false);
    expect(opensOnInstall("")).toBe(false);
  });
});

/*
 * One state, one colour, on both screens that draw a chip for it.
 *
 * Settings' `stateChip` (src/ui/options/dom.ts) had its own if-chain for the
 * tone, which painted the new `empty` state `is-err` red — "No courses" in the
 * colour of a broken page — because it was not in its grey list. It now takes
 * the tone from `toneOf`, the same function `setupChip` and the Sources tab's
 * dots use, and this walks every state to hold the two screens together.
 */
describe("Settings' chip and the setup chip agree on colour", () => {
  let stateChip: typeof import("../src/ui/options/dom.js").stateChip;
  beforeAll(async () => {
    const page = parseHTML("<!doctype html><html><body></body></html>");
    (globalThis as unknown as Record<string, unknown>)["document"] = page.document;
    ({ stateChip } = await import("../src/ui/options/dom.js"));
  });
  const CLASS = { ok: "is-ok", warn: "is-warn", err: "is-err", pending: "", off: "" } as const;

  it("paints every source state the colour toneOf gives it", () => {
    for (const state of SOURCE_STATES) {
      const chip = stateChip(state);
      const expected = CLASS[toneOf(state)];
      for (const tone of ["is-ok", "is-warn", "is-err"]) {
        expect(chip.classList.contains(tone), `${state} ${tone}`).toBe(tone === expected);
      }
      expect(chip.textContent, state).toBe(STATE_WORD[state]);
    }
  });

  it("paints No courses grey, not red", () => {
    const chip = stateChip("empty");
    expect(chip.textContent).toBe("No courses");
    expect(chip.className).toBe("chip-base chip-state");
  });

  it("keeps the observers' own states: a missing permission is a warning, an unknown word a failure", () => {
    expect(stateChip("needs_permission").classList.contains("is-warn")).toBe(true);
    expect(stateChip("something_new").classList.contains("is-err")).toBe(true);
  });
});
