/**
 * The on-screen vocabulary (`src/core/names.ts`).
 *
 * Small functions, but every one of them is a sentence a student reads, and
 * three copies of the source names had already drifted apart across the popup,
 * the options page and the badge.
 */

import { describe, expect, it } from "vitest";
import {
  LOGIN_URL,
  SOURCE_CODE,
  SOURCE_HINT,
  SOURCE_HOME,
  SOURCE_NAME,
  SOURCE_TITLE,
  STATE_PHRASE,
  STATE_WORD,
  fullStamp,
  nameList,
  timeAgo,
} from "../src/core/names.js";
import { ALL_SOURCES } from "../src/core/store.js";

describe("the source tables", () => {
  it("names every source the sync loop can produce", () => {
    // A source added to ALL_SOURCES without a name here would render as its own
    // storage key in the middle of a sentence, which is the defect this module
    // exists to remove.
    for (const source of ALL_SOURCES) {
      expect(SOURCE_NAME[source], source).toBeTruthy();
      expect(SOURCE_TITLE[source], source).toBeTruthy();
      expect(SOURCE_CODE[source], source).toBeTruthy();
    }
  });

  it("keeps the code short enough for the row's source column", () => {
    // The column is 40px at 10px type. Three characters is what fits beside a
    // second code on a merged row.
    for (const source of ALL_SOURCES) {
      expect(SOURCE_CODE[source].length, source).toBeLessThanOrEqual(3);
    }
  });

  it("never uses a code as a name", () => {
    // "GS hasn't been read successfully" was the popup's stale banner. A new
    // student has no way to know what GS is.
    for (const source of ALL_SOURCES) {
      expect(SOURCE_NAME[source]).not.toBe(SOURCE_CODE[source]);
    }
  });

  it("spells each site the way the site spells itself", () => {
    expect(SOURCE_NAME.smartphysics).toBe("smartPhysics");
    expect(SOURCE_NAME.prairielearn).toBe("PrairieLearn");
    expect(SOURCE_NAME.gradescope).toBe("Gradescope");
  });

  it("gives the course-website category an article in prose and not in a label", () => {
    // "Sign in to Course websites" and "the course website" as a heading are
    // both wrong, in opposite directions.
    expect(SOURCE_NAME.site).toBe("the course website");
    expect(SOURCE_TITLE.site).toBe("Course websites");
  });

  it("offers a login page for every source that has one, and https only", () => {
    for (const [source, url] of Object.entries(LOGIN_URL)) {
      expect(new URL(url!).protocol, source).toBe("https:");
    }
    // A course website is whatever host its adapter points at, so there is no
    // single page to send anyone to.
    expect(LOGIN_URL.site).toBeUndefined();
  });
});

describe("nameList", () => {
  it("reads as a sentence rather than as a log line", () => {
    expect(nameList(["gradescope"])).toBe("Gradescope");
    expect(nameList(["gradescope", "canvas"])).toBe("Gradescope and Canvas");
    expect(nameList(["gradescope", "canvas", "prairietest"])).toBe(
      "Gradescope, Canvas and PrairieTest",
    );
  });

  it("says nothing about nothing", () => {
    expect(nameList([])).toBe("");
  });
});

describe("the state words", () => {
  it("never puts an enum on screen", () => {
    // The UX plan's copy guide: never `parse_error`, `needs_login`, `pending`.
    for (const [state, word] of Object.entries(STATE_WORD)) {
      expect(word, state).not.toContain("_");
      expect(word.toLowerCase(), state).not.toBe(state);
    }
    for (const [state, phrase] of Object.entries(STATE_PHRASE)) {
      expect(phrase, state).not.toContain("_");
    }
  });

  it("covers every state a status can display", () => {
    for (const state of [
      "ok",
      "pending",
      "needs_login",
      "parse_error",
      "network_error",
      "disabled",
    ]) {
      expect(STATE_WORD[state], state).toBeTruthy();
      expect(STATE_PHRASE[state], state).toBeTruthy();
    }
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 8, 11, 18, 19, 34);
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("does not say 0 min ago", () => {
    // A sync that finished while the page was opening. "just now" is what
    // happened; "0 min ago" reads as a bug.
    expect(timeAgo(ago(0), now)).toBe("just now");
    expect(timeAgo(ago(59_000), now)).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(timeAgo(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(timeAgo(ago(59 * 60_000), now)).toBe("59 min ago");
    expect(timeAgo(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(timeAgo(ago(26 * 3_600_000), now)).toBe("yesterday");
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe("3 days ago");
  });

  it("gives an actual date once counting days stops helping", () => {
    // "9d ago" is arithmetic the reader has to do.
    const old = timeAgo(ago(9 * 86_400_000), now)!;
    expect(old).not.toContain("ago");
    expect(old).toContain("Sep");
  });

  it("never reads as the future when a clock disagrees", () => {
    // The worker's stamp and the page's `new Date()` are two clocks. A stamp a
    // few seconds ahead used to produce "in -1 min".
    expect(timeAgo(new Date(now.getTime() + 4000), now)).toBe("just now");
  });

  it("says nothing rather than 'Invalid Date'", () => {
    expect(timeAgo(undefined, now)).toBeUndefined();
    expect(timeAgo("not a date", now)).toBeUndefined();
    expect(fullStamp("not a date")).toBeUndefined();
    expect(fullStamp(undefined)).toBeUndefined();
  });

  it("keeps the exact stamp available for the tooltip", () => {
    expect(fullStamp(now)).toContain("2026");
  });
});

describe("the manual source's words", () => {
  it("is named as the student's own list, not as a place to go", () => {
    // "Sign in to Manual" is not a sentence anybody could act on; `site` takes
    // an article for the same reason.
    expect(SOURCE_NAME.manual).toBe("your own list");
    expect(SOURCE_TITLE.manual).toBe("Added by you");
    expect(SOURCE_CODE.manual).toBe("ME");
  });

  it("has nowhere to sign in and nowhere to visit", () => {
    // Both maps are `Partial` precisely so a source with no page can say so.
    expect(LOGIN_URL.manual).toBeUndefined();
    expect(SOURCE_HOME.manual).toBeUndefined();
  });
});

describe("what Canvas is honest about", () => {
  it("says the planner only carries dated work", () => {
    // This extension reads the Canvas planner, and §4.1 — quoted in
    // docs/canvas-findings.md — records that an assignment with no `due_at`
    // "appear[s] nowhere in the planner window". So a green Canvas dot means
    // "the planner answered", never "all your coursework is here", and the one
    // place a student reads about Canvas has to say which of the two it is.
    // Worker rule 2, at the level of what a source claims to cover.
    expect(SOURCE_HINT.canvas).toMatch(/planner/);
    expect(SOURCE_HINT.canvas).toMatch(/due date/);
  });
});
