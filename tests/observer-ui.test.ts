import { describe, expect, it } from "vitest";
import { observerRows } from "../src/core/observer-ui.js";
import type { ObserverId, ObserverState } from "../src/core/store.js";
import { normalizePopupState } from "../src/core/compat.js";
const now = new Date("2026-09-22T16:14:00Z");
describe("the Alerts tab's discussion sources", () => {
  // Worker rule 2: anything the UI asserts must derive from an attempt that happened.
  it("offers configuration while off and never paints a newly enabled source healthy", () => {
    expect(observerRows({ piazza: { enabled: false }, campuswire: { enabled: false } }, [], now).map(r => r.action)).toEqual(["configure", "configure"]);
    const rows = observerRows({ piazza: { enabled: true }, campuswire: { enabled: true } }, [], now);
    expect(rows.map(r => r.tone)).toEqual(["pending", "pending"]);
    expect(rows.map(r => r.action)).toEqual(["retry", "open"]);
    expect(rows[1]!.label).toBe("Open a class feed");
    expect(rows[1]!.detail).toContain("feeds you have open");
  });
  it("routes Piazza sign-in separately from a failed read", () => {
    const login = observerRows({ piazza: { enabled: true, state: "needs_login" } }, [], now)[0]!;
    expect(login).toMatchObject({ tone: "warn", action: "open", label: "Sign in", url: "https://piazza.com/login" });
    expect(observerRows({ piazza: { enabled: true, state: "error" } }, [], now)[0]).toMatchObject({ tone: "err", action: "retry" });
  });
  it("does not misreport a successful read's caveat as a failed attempt", () => {
    const row = observerRows({ piazza: { enabled: true, state: "ok", lastAttemptAt: now.toISOString(), lastError: "1 of 4 classes couldn't be read" } }, [], now)[0]!;
    expect(row.tone).not.toBe("err");
    expect(row.action).toBe("open");
    expect(row.status).toContain("1 of 4 classes");
  });
  /*
   * The dot, now that these rows sit in the Sources list beside Canvas and
   * Gradescope (2026-09-19).
   *
   * CLAUDE.md, worker house rule 2: "A green dot must mean 'I fetched, and it
   * was fine' — never 'I did not fetch'." Piazza's green is `state === "ok"`,
   * which `applyPiazzaResult` writes only after a run that fetched;
   * Campuswire's is `lastObservedAt`, stamped only when posts were read. The
   * row above already pins that "enabled, nothing read" stays `pending`; these
   * pin the other two ends.
   */
  it("is green only for a source that was actually read, and grey when it is off", () => {
    const read = observerRows(
      {
        piazza: { enabled: true, state: "ok", lastAttemptAt: now.toISOString() },
        campuswire: { enabled: true, lastObservedAt: now.toISOString(), postsSeen: 3 },
      },
      [],
      now,
    );
    expect(read.map((r) => r.tone)).toEqual(["ok", "ok"]);

    // Off is its own grey, not pending's empty ring: "switched off" and "on but
    // not read yet" are different sentences and want different dots.
    expect(
      observerRows({ piazza: { enabled: false }, campuswire: { enabled: false } }, [], now).map(
        (r) => r.tone,
      ),
    ).toEqual(["off", "off"]);

    // Enabled with an attempt behind it that read nothing is still not green.
    expect(
      observerRows({ campuswire: { enabled: true } }, [], now)[1]!.tone,
    ).toBe("pending");
  });

  // Worker rule 8: normalize older messages before rendering fields they lack.
  it.each([{}, { observers: { piazza: { enabled: false } } }])("exposes missing worker state as a reload action", (payload) => {
    const normalized = normalizePopupState<{ observers: Partial<Record<ObserverId, ObserverState>> }>({ type: "state", ...payload });
    const row = observerRows(normalized.state.observers, normalized.missing, now)[1]!;
    expect(row).toMatchObject({ tone: "warn", label: "Reload instructions" });
    expect(row.detail).toContain("chrome://extensions");
  });
});
