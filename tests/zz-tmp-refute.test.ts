import { describe, it, expect } from "vitest";
import { ingestPost } from "../src/core/suggest";

describe("tmp", () => {
  it("two courses same badge", () => {
    const base = { items: [], overrides: { dueOverrides: {}, hidden: {}, done: {}, merges: [], splits: [], titles: {}, courses: {} } as any, suggestions: [] as any[], seenPosts: {} as any };
    const now = "2026-09-22T15:00:00.000Z";
    const p1 = { id: "p1", source: "piazza" as const, courseHint: "CS 425", text: "HW2 is due 9/25 at 11:59 pm.", postedAt: "2026-09-22T14:00:00.000Z" };
    const p2 = { ...p1, id: "p2", courseHint: "ECE 411" };
    const r1 = ingestPost(base as any, p1 as any, now);
    console.log("r1", JSON.stringify(r1, null, 1));
    const r2 = ingestPost({ ...base, suggestions: [...base.suggestions, ...r1.suggestions], seenPosts: { ...base.seenPosts, ...r1.seenPosts } } as any, p2 as any, now);
    console.log("r2", JSON.stringify(r2, null, 1));
    expect(true).toBe(true);
  });
});
