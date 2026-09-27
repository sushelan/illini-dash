/**
 * Focus the tab already showing a page (`core/tabs.ts`, roadmap I60).
 *
 * The adversarial rows are the point (parser rule 12's shape): a tab Chrome
 * returned with no `url` — which is every tab on a host we hold no permission
 * for, because Chrome then *ignores* the query's url filter — must never be
 * taken for the page, or every Open would yank the student to some unrelated
 * tab.
 */

import { describe, expect, it } from "vitest";
import { focusOrOpen, pickTab, type PickedTab, type TabLike, type TabsApi } from "../src/core/tabs.js";

const PL = "https://us.prairielearn.com/pl/course_instance/1/assessment/2";

describe("pickTab", () => {
  it("finds the tab already showing the page", () => {
    expect(pickTab([{ id: 3, url: "https://example.com/" }, { id: 7, url: PL, windowId: 1 }], PL))
      .toEqual({ id: 7, windowId: 1 });
  });

  it("ignores the fragment on either side", () => {
    expect(pickTab([{ id: 7, url: `${PL}#question-3` }], PL)).toEqual({ id: 7 });
    expect(pickTab([{ id: 7, url: PL }], `${PL}#top`)).toEqual({ id: 7 });
  });

  it("does not ignore the query: two enrolments on one path are two pages", () => {
    const course = "https://smart.physics.illinois.edu/Course?enrollmentID=111";
    expect(
      pickTab([{ id: 1, url: "https://smart.physics.illinois.edu/Course?enrollmentID=222" }], course),
    ).toBeUndefined();
    expect(pickTab([{ id: 1, url: course }], course)).toEqual({ id: 1 });
  });

  it("treats one trailing slash as the same page, and nothing looser", () => {
    expect(pickTab([{ id: 1, url: "https://us.prairielearn.com/pl/" }], "https://us.prairielearn.com/pl"))
      .toEqual({ id: 1 });
    expect(pickTab([{ id: 1, url: "https://us.prairielearn.com/pl/course_instance/1" }], "https://us.prairielearn.com/pl"))
      .toBeUndefined();
    expect(pickTab([{ id: 1, url: "https://us.prairielearn.com/plx" }], "https://us.prairielearn.com/pl"))
      .toBeUndefined();
  });

  it("matches the origin exactly — scheme, host and port", () => {
    expect(pickTab([{ id: 1, url: PL.replace("https:", "http:") }], PL)).toBeUndefined();
    expect(pickTab([{ id: 1, url: PL.replace("us.", "ca.") }], PL)).toBeUndefined();
    expect(pickTab([{ id: 1, url: PL.replace(".com/", ".com:8443/") }], PL)).toBeUndefined();
  });

  it("never matches a tab it cannot see (no url: no host permission)", () => {
    // Chrome ignores the url filter on a host we hold no permission for and
    // returns every tab, url-less. None of them is the page.
    const unseen: TabLike[] = [{ id: 1 }, { id: 2, url: "" }, { id: 3, windowId: 9 }];
    expect(pickTab(unseen, PL, 9)).toBeUndefined();
  });

  it("skips a tab with no id", () => {
    expect(pickTab([{ url: PL }, { id: 4, url: PL }], PL)).toEqual({ id: 4 });
  });

  it("a tab that went through the Shibboleth login and landed on the page counts; one still on the login page does not", () => {
    expect(pickTab([{ id: 1, url: "https://shibboleth.illinois.edu/idp/profile/SAML2/Redirect/SSO?execution=e1s1" }], PL))
      .toBeUndefined();
    expect(pickTab([{ id: 1, url: PL }], PL)).toEqual({ id: 1 });
  });

  it("prefers a match in the current window, then the first", () => {
    const tabs = [
      { id: 1, url: PL, windowId: 10 },
      { id: 2, url: PL, windowId: 20 },
    ];
    expect(pickTab(tabs, PL, 20)).toEqual({ id: 2, windowId: 20 });
    expect(pickTab(tabs, PL, 30)).toEqual({ id: 1, windowId: 10 });
    expect(pickTab(tabs, PL)).toEqual({ id: 1, windowId: 10 });
  });

  it("matches nothing for a target that is not a web page", () => {
    expect(pickTab([{ id: 1, url: "javascript:alert(1)" }], "javascript:alert(1)")).toBeUndefined();
    expect(pickTab([{ id: 1, url: "not a url" }], "not a url")).toBeUndefined();
  });
});

function fakeApi(tabs: TabLike[], options: { queryThrows?: boolean; focusThrows?: boolean } = {}) {
  const calls: { queried: string[]; focused: PickedTab[]; created: string[] } = {
    queried: [],
    focused: [],
    created: [],
  };
  const api: TabsApi = {
    query: async (pattern) => {
      calls.queried.push(pattern);
      if (options.queryThrows) throw new Error("no");
      return tabs;
    },
    currentWindowId: async () => 20,
    focus: async (tab) => {
      if (options.focusThrows) throw new Error("No tab with id");
      calls.focused.push(tab);
    },
    create: async (url) => {
      calls.created.push(url);
    },
  };
  return { api, calls };
}

describe("focusOrOpen", () => {
  it("focuses the tab already open, preferring the current window, and says so", async () => {
    const { api, calls } = fakeApi([
      { id: 1, url: PL, windowId: 10 },
      { id: 2, url: PL, windowId: 20 },
    ]);
    const lines: string[] = [];
    await expect(focusOrOpen(`${PL}#x`, api, (l) => lines.push(l))).resolves.toBe("focused");
    expect(calls.queried).toEqual(["https://us.prairielearn.com/*"]);
    expect(calls.focused).toEqual([{ id: 2, windowId: 20 }]);
    expect(calls.created).toEqual([]);
    expect(lines).toEqual([`[tabs] focused the tab already showing ${PL} (2)`]);
  });

  it("opens a new tab when none shows the page, and says so", async () => {
    const { api, calls } = fakeApi([{ id: 1 }, { id: 2 }]);
    const lines: string[] = [];
    await expect(focusOrOpen(PL, api, (l) => lines.push(l))).resolves.toBe("opened");
    expect(calls.created).toEqual([PL]);
    expect(calls.focused).toEqual([]);
    expect(lines).toEqual([`[tabs] no open tab shows ${PL} — opening one`]);
  });

  it("still opens the page when the query throws", async () => {
    const { api, calls } = fakeApi([], { queryThrows: true });
    await expect(focusOrOpen(PL, api, () => undefined)).resolves.toBe("opened");
    expect(calls.created).toEqual([PL]);
  });

  it("still opens the page when the tab closed between the query and the focus", async () => {
    const { api, calls } = fakeApi([{ id: 1, url: PL }], { focusThrows: true });
    const lines: string[] = [];
    await expect(focusOrOpen(PL, api, (l) => lines.push(l))).resolves.toBe("opened");
    expect(calls.created).toEqual([PL]);
    expect(lines[0]).toMatch(/could not find or focus a tab showing/);
  });

  it("opens a non-web target without querying", async () => {
    const { api, calls } = fakeApi([]);
    const target = "chrome-extension://abc/options.html#sec-help";
    await expect(focusOrOpen(target, api, () => undefined)).resolves.toBe("opened");
    expect(calls.queried).toEqual([]);
    expect(calls.created).toEqual([target]);
  });
});
