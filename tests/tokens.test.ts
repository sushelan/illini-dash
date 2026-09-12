/**
 * The colour tokens in `public/ui.css`, checked by measurement.
 *
 * Two defects that reached a real build motivate this, and neither was
 * catchable by looking:
 *
 *   - `--accent-ink: #ffffff` on `#ff5f05` is 3.05:1, and on the dark accent
 *     2.87:1. It carries today's date at 12px bold. It *looked* clean.
 *   - `--primary` did not exist, so the one filled button in the app used
 *     `--brand`, which in dark is `#0d1626` on a `#0b1726` page — 1.00:1. The
 *     button rendered as plain text and nobody noticed for weeks, because
 *     every screenshot taken to check it was light (CLAUDE.md, "check it in the
 *     mode Sushi actually uses").
 *
 * So the contract is enforced here rather than described in a doc: every theme
 * restates the ink tokens, and every stated pair is computed. A ratio is not a
 * matter of taste and it is one line of arithmetic, so there is no reason for
 * it to be a judgement call in review.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../public/ui.css", import.meta.url), "utf8");

/** A `:root` / `.theme-*` block, and whether it is the dark variant. */
interface Block {
  name: string;
  vars: Map<string, string>;
}

/**
 * The six palettes: three themes × light and dark.
 *
 * Written as a scan rather than with a CSS parser because the only structure
 * that matters is "which declarations are inside this selector", and adding a
 * dependency to read one stylesheet is the kind of thing SPEC.md's no-runtime-
 * dependency rule exists to discourage.
 */
function blocks(): Block[] {
  const found: Block[] = [];
  let dark = false;
  let depth = 0;
  let current: Block | undefined;
  const lines = CSS.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^@media\s*\(prefers-color-scheme:\s*dark\)/.test(trimmed)) {
      dark = true;
      depth = 0;
      continue;
    }
    const selector = /^([:.][A-Za-z-]+)\s*\{/.exec(trimmed);
    if (selector) {
      current = { name: `${selector[1]}${dark ? " (dark)" : ""}`, vars: new Map() };
      found.push(current);
      depth += 1;
      continue;
    }
    if (trimmed.startsWith("}")) {
      if (current) {
        current = undefined;
        depth -= 1;
      } else if (dark && depth <= 0) {
        dark = false;
      }
      continue;
    }
    if (!current) continue;
    for (const decl of trimmed.split(";")) {
      const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/.exec(decl);
      if (match) current.vars.set(match[1]!, match[2]!);
    }
  }
  return found;
}

/** Every palette block, keyed by the name this test reports it under. */
function palettes(): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const block of blocks()) {
    if (!block.name.startsWith(":root") && !block.name.startsWith(".theme-")) continue;
    out.set(block.name, block.vars);
  }
  return out;
}

/** Resolve `var(--x)` one hop, which is as deep as this stylesheet goes. */
function resolve(vars: Map<string, string>, token: string, fallback?: Map<string, string>): string {
  const raw = vars.get(token) ?? fallback?.get(token);
  if (raw === undefined) return "";
  const indirect = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
  if (indirect) return resolve(vars, indirect[1]!, fallback);
  return raw;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** WCAG AA for text below 18pt. Everything these tokens carry is below it. */
const AA = 4.5;

describe("the ink tokens", () => {
  const all = palettes();

  it("finds all six palettes, or this whole file is checking nothing", () => {
    // A scan that silently matched zero blocks would make every assertion below
    // vacuously true — the "false survived" failure from CLAUDE.md's mutation
    // rules, one layer up.
    expect([...all.keys()].sort()).toEqual([
      ".theme-contrast",
      ".theme-contrast (dark)",
      ".theme-neutral",
      ".theme-neutral (dark)",
      ":root",
      ":root (dark)",
    ]);
  });

  for (const token of ["--accent-ink", "--primary", "--primary-ink"] as const) {
    it(`is restated by every theme: ${token}`, () => {
      // Inheriting one of these from `:root` is how B2 happened: the neutral
      // and contrast themes redefine `--accent` and `--brand`, so an ink
      // inherited from another palette is ink for a colour that is not there.
      for (const [name, vars] of all) {
        expect(vars.has(token), `${name} does not define ${token}`).toBe(true);
      }
    });
  }

  it("puts legible ink on the accent, in all six", () => {
    const light = all.get(":root")!;
    for (const [name, vars] of all) {
      const base = name.includes("neutral") || name.includes("contrast") ? light : undefined;
      const accent = resolve(vars, "--accent", base);
      const ink = resolve(vars, "--accent-ink", base);
      // Neutral's accent is `var(--muted)`, which resolves inside its own block.
      const ratio = contrast(ink, accent.startsWith("#") ? accent : resolve(vars, "--muted", base));
      expect(ratio, `${name}: ${ink} on ${accent} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("puts legible ink on the primary button, in all six", () => {
    for (const [name, vars] of all) {
      const ratio = contrast(resolve(vars, "--primary-ink"), resolve(vars, "--primary"));
      expect(ratio, `${name}: primary is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("keeps the primary button visible against its own page", () => {
    /*
     * The B2 defect exactly. The fill has to differ from the surface it sits
     * on, or the button is a label — and this is the check that was missing
     * when `--brand` (#0d1626) was used as a fill on a #0b1726 page.
     *
     * 3:1 rather than 4.5:1 because this is a large block of colour, not text.
     */
    const light = all.get(":root")!;
    for (const [name, vars] of all) {
      const base = name === ":root" ? undefined : light;
      const ratio = contrast(resolve(vars, "--primary", base), resolve(vars, "--bg", base));
      expect(ratio, `${name}: primary on bg is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects white on the accent, which is what shipped", () => {
    // Named rather than left implicit: this is the value the uncommitted
    // reference refresh had put back, and the assertion is the record of why
    // it cannot come back again.
    expect(contrast("#ffffff", "#ff5f05")).toBeLessThan(AA);
    expect(contrast("#ffffff", "#ff6a1a")).toBeLessThan(AA);
    expect(contrast("#1a0d04", "#ff5f05")).toBeGreaterThanOrEqual(AA);
    expect(contrast("#1a0d04", "#ff6a1a")).toBeGreaterThanOrEqual(AA);
  });
});
