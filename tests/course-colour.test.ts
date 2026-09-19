import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COURSE_COLOURS } from "../src/core/calendar.js";

/**
 * The slot a course gets is decided in `src/core/calendar.ts`; what a slot
 * looks like is decided in the stylesheets. Nothing in either file can see the
 * other, and a slot with no tokens or no binding draws an *uncoloured* chip —
 * silently, in whichever theme or design the student happens to be using. That
 * is UI house rule 7 ("a selector and the class it matches belong to one
 * constant a test can read") across two files rather than one.
 */
const CLASSICAL = readFileSync(new URL("../public/design-classical.css", import.meta.url), "utf8");
const POPUP = readFileSync(new URL("../public/popup.css", import.meta.url), "utf8");
const UI = readFileSync(new URL("../public/ui.css", import.meta.url), "utf8");

/** Every slot a course can be given. There are no families: see `calendar.ts`. */
const USED = Array.from({ length: COURSE_COLOURS }, (_, i) => i);
/** The two `:root` blocks in the Classical sheet: light, then dark. */
const BLOCKS = CLASSICAL.split("html[data-design=\"classical\"]:root").slice(1);

describe("course colour slots and the stylesheets that draw them", () => {
  it("has a light and a dark block to look in", () => {
    expect(BLOCKS).toHaveLength(2);
    expect(BLOCKS[1]!.startsWith(".is-dark")).toBe(true);
  });

  for (const [theme, index] of [
    ["light", 0],
    ["dark", 1],
  ] as const) {
    it(`gives every slot a ${theme} ink and wash`, () => {
      const block = BLOCKS[index]!.slice(0, BLOCKS[index]!.indexOf("\n}"));
      for (const slot of USED) {
        expect(block, `--course-${slot} (${theme})`).toMatch(
          new RegExp(`--course-${slot}:\\s*[^;]+;`),
        );
        expect(block, `--course-${slot}-bg (${theme})`).toMatch(
          new RegExp(`--course-${slot}-bg:\\s*[^;]+;`),
        );
      }
    });
  }

  it("binds every slot's class to those tokens, in one sheet or the other", () => {
    for (const slot of USED) {
      const bound = new RegExp(`\\.course-${slot}\\s`).test(POPUP + CLASSICAL);
      expect(bound, `.course-${slot} has no binding rule`).toBe(true);
    }
  });

  /*
   * `ui.css` — the other four designs — defines `--course-0` through
   * `--course-7` and stops, so a slot above 7 has no token there at all and
   * would draw an uncoloured chip. Every binding above 7 therefore carries a
   * fallback to `slot % 8`, which those designs do define. Inside the
   * Classical sheet the fallback never fires — all 25 are declared — so this
   * is about the designs this file cannot see.
   */
  it("falls back to a slot the other designs actually define", () => {
    for (const slot of USED.filter((n) => n > 7)) {
      expect(CLASSICAL, `.course-${slot}`).toContain(
        `--course: var(--course-${slot}, var(--course-${slot % 8}));`,
      );
      expect(CLASSICAL, `.course-${slot} wash`).toContain(
        `--course-bg: var(--course-${slot}-bg, var(--course-${slot % 8}-bg));`,
      );
    }
    // `ui.css` carries all 25 now. It stopped at 7, and the `% 8` fallback was
    // load-bearing because of that — which collapsed 25 hues onto 8 in every
    // design but Classical, so two of Sushi's seven courses drew the same dot
    // (measured in Plain: CS 357 and Real-Time Systems both rgb(47,211,170)).
    // The fallback stays as defence for a design sheet that misses a slot; this
    // asserts it is no longer the thing doing the work.
    for (const slot of USED) {
      expect(UI, `--course-${slot} in ui.css`).toContain(`--course-${slot}:`);
    }
  });

  it("does not paint a slot no course can be given", () => {
    expect(USED.every((slot) => slot < COURSE_COLOURS)).toBe(true);
    for (const block of BLOCKS) expect(block).not.toMatch(/--course-25:/);
  });
});
