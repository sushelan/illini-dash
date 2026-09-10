/** Data model — SPEC.md §3. Kept in one place so every later module imports it. */

export type Source =
  | "canvas"
  | "gradescope"
  | "prairielearn"
  | "prairietest"
  | "site";

export type Kind = "assignment" | "quiz" | "exam" | "booking" | "other";

export type Status =
  | "not_submitted"
  | "submitted"
  | "graded"
  | "missing"
  | "unknown";

/** One row as one source sees it. Immutable once parsed. */
export interface RawItem {
  source: Source;
  /** Stable within the source; see §3.1. */
  sourceId: string;
  /** Course name exactly as the source displays it. */
  courseRaw: string;
  /** Canonical "CS225" if extractable (§5.1). */
  courseCode?: string;
  /** Exactly as displayed. */
  title: string;
  /**
   * A literal separator that splits one cell into several deadlines (§4.5:
   * "extend the schema with a new declarative field rather than embedding
   * code"). CS 424's HW/MP column reads `HW5 Due; HW6 Out` — two events, one
   * of them not a deadline at all — so without this a row yields one item with
   * a nonsense title, and `filter` cannot reach inside it.
   *
   * A literal, never a regex: adapter data is remote, and a regex here would be
   * a ReDoS run against every row of every page.
   */
  splitTitle?: string;
  kind: Kind;
  /** ISO 8601 with offset. undefined = undated. */
  dueAt?: string;
  /** Gradescope late due / PrairieLearn reduced-credit deadline. */
  lateDueAt?: string;
  /** Absolute https URL on the source host. */
  url: string;
  status: Status;
  extra?: Record<string, string>;
  fetchedAt: string;
}

/** One deadline as the student sees it: one or more RawItems merged. */
export interface Item {
  /** Deterministic: sha1 of sorted member keys (§5.3). */
  id: string;
  members: RawItem[];
  courseCode?: string;
  courseLabel: string;
  title: string;
  /**
   * A literal separator that splits one cell into several deadlines (§4.5:
   * "extend the schema with a new declarative field rather than embedding
   * code"). CS 424's HW/MP column reads `HW5 Due; HW6 Out` — two events, one
   * of them not a deadline at all — so without this a row yields one item with
   * a nonsense title, and `filter` cannot reach inside it.
   *
   * A literal, never a regex: adapter data is remote, and a regex here would be
   * a ReDoS run against every row of every page.
   */
  splitTitle?: string;
  kind: Kind;
  dueAt?: string;
  lateDueAt?: string;
  /** Where you actually submit (§5.3 precedence). */
  url: string;
  status: Status;
  hidden: boolean;
  /**
   * ISO timestamp per lead that has already fired.
   *
   * `late24h` / `late2h` are separate keys on purpose: they aim at the
   * reduced-credit window rather than the full-credit deadline, and sharing a
   * key with the full-credit lead meant the late reminder was suppressed as
   * already-sent — silencing the one deadline the student could still meet.
   */
  notified: Partial<Record<"24h" | "2h" | "booking" | "late24h" | "late2h" | "dayOf", string>>;
  /**
   * True when the instant in `dueAt` carries a time this extension invented
   * rather than one the source printed (§4.5's runner fills in 23:59 for a
   * course page that gives a bare date).
   *
   * Lifted from the winning member onto the Item because every consumer of
   * `dueAt` needs it and none of them should have to re-derive which member
   * won: the popup must not show it as fact, the calendar export must not
   * write a hard 23:59 event, and a change between an assumed and a stated
   * time is the extension correcting itself, not the course moving a deadline.
   */
  timeAssumed?: boolean;
  /**
   * The previous stated deadline, when this sync's differs from the last one's.
   *
   * Only ever set when the source stated *both* instants: an assumed 23:59
   * being replaced by a real time is this extension learning the truth, and
   * announcing it as "moved" would blame the course for our own placeholder.
   */
  movedFrom?: string;
}

export type SourceState =
  | "ok"
  | "needs_login"
  | "parse_error"
  | "network_error"
  | "disabled"
  /**
   * Enabled, but not yet attempted — so nothing is known about it.
   *
   * AMENDED from §3. Without this, `defaultStatus` had to seed something, it
   * seeded `ok`, and a fresh install showed four green dots before a single
   * request had been made. Worker house rule 2 says a green dot means "I
   * fetched, and it was fine"; this is the state for "I have not fetched".
   */
  | "pending";

export interface SourceStatus {
  source: Source;
  enabled: boolean;
  state: SourceState;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  /** Short, human-readable. */
  lastError?: string;
  consecutiveFailures: number;
}

export interface Overrides {
  /** Arrays of memberKeys the user forced together. */
  mergeGroups: string[][];
  /** memberKeys the user forced apart from auto-merges. */
  splitKeys: string[];
  /**
   * memberKeys of hidden work.
   *
   * AMENDED from §3's `hiddenItemIds`. `Item.id` is a hash of the sorted member
   * keys, so it changes whenever a group gains or loses a member — a hide keyed
   * by it is spent the moment the item merges with anything, and the stale id
   * stays armed forever, silently re-hiding any future group that happens to
   * re-form the same member set.
   */
  hiddenKeys: string[];
  /** courseCodes or courseRaw values. */
  disabledCourses: string[];
}

export interface Settings {
  /** Default both. */
  leadTimes: ("24h" | "2h")[];
  /** Default 23–8 local. */
  quietHours: { start: number; end: number } | null;
  hideSubmitted: boolean;
  /** Default 30, min 15. */
  pollMinutes: number;
}

export interface Adapter {
  id: string;
  label: string;
  courseCode: string;
  term: string;
  url: string;
  hostPattern: string;
  rows: string;
  title: string;
  /**
   * A literal separator that splits one cell into several deadlines (§4.5:
   * "extend the schema with a new declarative field rather than embedding
   * code"). CS 424's HW/MP column reads `HW5 Due; HW6 Out` — two events, one
   * of them not a deadline at all — so without this a row yields one item with
   * a nonsense title, and `filter` cannot reach inside it.
   *
   * A literal, never a regex: adapter data is remote, and a regex here would be
   * a ReDoS run against every row of every page.
   */
  splitTitle?: string;
  due: string;
  link?: string;
  dateFormat: string;
  timezone: string;
  filter?: { include?: string; exclude?: string };
  minExtensionVersion: string;
}

export interface StoreV1 {
  schemaVersion: 1;
  /** key = memberKey (§3.1) */
  raw: Record<string, RawItem>;
  items: Item[];
  sources: Record<Source, SourceStatus>;
  overrides: Overrides;
  settings: Settings;
  registry: {
    /** Last *successful* refresh. Never set by the bundled seed. */
    fetchedAt?: string;
    /** Last attempt, successful or not, so a failing refresh rests too. */
    attemptedAt?: string;
    adapters: Adapter[];
  };
}

/** §3.1 */
export function memberKey(source: Source, sourceId: string): string {
  return `${source}:${sourceId}`;
}

/** Thrown when a page's structure is not what the parser expects (§0 rule 3). */
export class ParseError extends Error {
  override readonly name = "ParseError";
}

/** What a parser knows about the page it was handed (§4). */
export interface PageCtx {
  /** Absolute URL the HTML came from, after redirects. */
  url: string;
  /** ISO timestamp of the fetch, copied onto every RawItem. */
  fetchedAt: string;
  /** Source-specific context discovered during planning, e.g. a course id. */
  extra?: Record<string, string>;
}

/** A parser is a pure function over a DOM: same input, same output, no I/O. */
export type ParseFn = (doc: Document, page: PageCtx) => RawItem[];
