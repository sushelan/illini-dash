/**
 * Open a page in the tab that already shows it (roadmap I60).
 *
 * Every "Open", "Sign in" and notification click called `chrome.tabs.create`,
 * so a student who opened the same PrairieLearn assessment from the popup three
 * times had three tabs of it. The decision — *which* open tab is "that page",
 * and what to do when there is none — is here rather than at seventeen call
 * sites or in the worker (worker rule 1); the call sites pass `chromeTabs()`.
 *
 * **No `tabs` permission.** The manifest does not request it and the store
 * listing says so. What makes this work without it: `chrome.tabs.query({ url })`
 * honours the filter, and `tab.url` is filled in, for any host the extension
 * holds a host permission for — the five sources, and every course site the
 * student granted. For any other host Chrome *ignores the filter* and returns
 * every tab with `url` undefined, so a tab with no `url` is never a match: it is
 * "we cannot see", not "it is that page". The page then opens in a new tab,
 * which is exactly the behaviour before this module.
 */

/** The part of `chrome.tabs.Tab` this reads. */
export interface TabLike {
  id?: number;
  url?: string;
  windowId?: number;
}

export interface PickedTab {
  id: number;
  windowId?: number;
}

/**
 * The key two URLs must share to be "the same page".
 *
 * - **Origin**, exactly — scheme, host and port. `http:` is not `https:`.
 * - **Path**, with one trailing slash ignored: `/pl` and `/pl/` are one page on
 *   every source this reads.
 * - **Query, exactly.** It is not decoration here: smartPhysics addresses a
 *   course by `?enrollmentID=…` (house rule 13), Piazza a class by `?cid=…`, and
 *   a course site may put the week in it. Two enrolments on one path are two
 *   pages, and focusing the wrong one would be worse than opening a new tab.
 * - **Fragment, ignored.** It never reaches the server, a row's link may carry
 *   one the tab has since scrolled away from, and Chrome's own `url` filter does
 *   not match on it either.
 *
 * A tab that went through Shibboleth and landed on the page counts: its `url` is
 * where it ended up, not where it started. A tab still sitting on the login page
 * does not — it is on another host, and nothing in it says which page it is
 * signing in *for*.
 */
function pageKey(raw: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
  const path = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, "") : parsed.pathname;
  return `${parsed.origin}${path}${parsed.search}`;
}

/**
 * The open tab already showing `url`, preferring one in `preferWindowId` (the
 * window the student is looking at), then the first in the order given.
 */
export function pickTab(
  tabs: readonly TabLike[],
  url: string,
  preferWindowId?: number,
): PickedTab | undefined {
  const want = pageKey(url);
  if (want === undefined) return undefined;
  const matches = tabs.filter(
    (tab): tab is TabLike & { id: number } =>
      typeof tab.id === "number" &&
      typeof tab.url === "string" &&
      pageKey(tab.url) === want,
  );
  const chosen =
    (preferWindowId === undefined
      ? undefined
      : matches.find((tab) => tab.windowId === preferWindowId)) ?? matches[0];
  if (chosen === undefined) return undefined;
  return chosen.windowId === undefined
    ? { id: chosen.id }
    : { id: chosen.id, windowId: chosen.windowId };
}

/** The `chrome` calls `focusOrOpen` makes, injected so the decision is testable. */
export interface TabsApi {
  /** `chrome.tabs.query({ url: pattern })`. */
  query(pattern: string): Promise<TabLike[]>;
  /** The window the student is looking at, if it can be told. */
  currentWindowId(): Promise<number | undefined>;
  /** Make the tab active and raise its window. */
  focus(tab: PickedTab): Promise<void>;
  create(url: string): Promise<void>;
}

export type OpenOutcome = "focused" | "opened";

/**
 * Focus the tab already showing `url`, or open a new one.
 *
 * Never fails to open: a query that throws, or a tab that closed between the
 * query and the focus, falls through to `create`. Both branches are logged
 * (worker rule 5) — "focused the tab already open" and "opened a new tab" are
 * otherwise indistinguishable from "the click never ran".
 */
export async function focusOrOpen(
  url: string,
  api: TabsApi,
  log: (line: string) => void = (line) => console.log(line),
): Promise<OpenOutcome> {
  const key = pageKey(url);
  if (key !== undefined) {
    try {
      const host = new URL(url).hostname;
      const [tabs, windowId] = await Promise.all([
        api.query(`${new URL(url).protocol}//${host}/*`),
        api.currentWindowId().catch(() => undefined),
      ]);
      const picked = pickTab(tabs, url, windowId);
      if (picked !== undefined) {
        await api.focus(picked);
        log(`[tabs] focused the tab already showing ${key} (${picked.id})`);
        return "focused";
      }
      log(`[tabs] no open tab shows ${key} — opening one`);
    } catch (err) {
      // The query threw, or the tab closed between the query and the focus.
      log(`[tabs] could not find or focus a tab showing ${key} (${String(err)}) — opening one`);
    }
  } else {
    log(`[tabs] ${url} is not a web page this can match — opening it`);
  }
  await api.create(url);
  return "opened";
}

/** `TabsApi` over `chrome.*`, for the worker and the extension pages alike. */
export function chromeTabs(): TabsApi {
  return {
    query: (pattern) => chrome.tabs.query({ url: pattern }),
    currentWindowId: async () => (await chrome.windows.getLastFocused()).id,
    focus: async ({ id, windowId }) => {
      await chrome.tabs.update(id, { active: true });
      if (windowId !== undefined) await chrome.windows.update(windowId, { focused: true });
    },
    create: async (url) => {
      await chrome.tabs.create({ url });
    },
  };
}
