/**
 * Every date a student reads is written in US English (Sushi, 2026-10-01:
 * "popup should use us date formats").
 *
 * The suite runs pinned to en-US (vitest.config.ts), so a formatter that took
 * the browser's locale passes here and prints "15 Sep" on an en-GB machine —
 * no rendering test can see it. So this reads the source: a locale argument of
 * `undefined`, or none at all, is the browser's.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISPLAY_LOCALE } from "../src/core/dates.js";

const SRC = new URL("../src", import.meta.url).pathname;

// `gcal-auth.ts` is held by uncommitted work in another session; its two
// formatters follow when that lands (PROGRESS.md, 2026-10-01).
const PENDING = new Set(["core/gcal-auth.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : [];
  });
}

const BROWSER_LOCALE =
  /\b(?:toLocale(?:Date|Time)?String\(\s*(?:undefined\s*[,)]|\))|Intl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat)\(\s*(?:undefined\s*[,)]|\)))/;

describe("display locale", () => {
  it("is US English", () => {
    expect(DISPLAY_LOCALE).toBe("en-US");
  });

  it("is what every formatter in src/ is given", () => {
    const offenders: string[] = [];
    for (const path of sources(SRC)) {
      const name = path.slice(SRC.length + 1);
      if (PENDING.has(name)) continue;
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, at) => {
          // Prose in comments is not a call.
          if (/^\s*(?:\*|\/\/)/.test(line)) return;
          if (BROWSER_LOCALE.test(line)) offenders.push(`${name}:${at + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("would catch the browser's locale, spelled either way", () => {
    // The pattern itself, against the two spellings it exists for — a guard
    // whose regex matched nothing would pass forever.
    expect(BROWSER_LOCALE.test(`d.toLocaleDateString(undefined, { month: "short" })`)).toBe(true);
    expect(BROWSER_LOCALE.test(`new Date(t).toLocaleString()`)).toBe(true);
    expect(BROWSER_LOCALE.test(`new Intl.DateTimeFormat(undefined, {})`)).toBe(true);
    expect(BROWSER_LOCALE.test(`d.toLocaleDateString(DISPLAY_LOCALE, { month: "short" })`)).toBe(false);
  });
});
