/** Data model — SPEC.md §3. Kept in one place so every later module imports it. */

export type Source =
  | "canvas"
  | "gradescope"
  | "prairielearn"
  | "prairietest"
  | "smartphysics"
  | "site";

/**
 * `event` is a thing that happens at a time, not work that is owed.
 *
 * Canvas planner returns office hours, review sessions and class Zoom links as
 * `calendar_event`, which mapped to `other` and therefore behaved exactly like
 * an assignment: it sat in "Needs attention" for a week after it happened,
 * because an event has no submission and so nothing could ever mark it done.
 * Six of seven rows in that section were recurring office hours. An event that
 * has passed is over, the way a meeting is over; it is not unfinished work.
 *
 * Kept separate from `other`, which stays the deliberate catch-all for a
 * plannable type §4.1 does not list — those may well be work, and §11 ranks a
 * silently dropped deadline above every other failure.
 */
export type Kind = "assignment" | "quiz" | "exam" | "booking" | "event" | "other";

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
   * Ticked off by the student, as opposed to reported finished by a source.
   *
   * Kept separate from `status` rather than folded into it: what the source
   * says stays what the source says, so a row the student marked done that
   * Gradescope later reports as `missing` can still be surfaced.
   */
  done: boolean;
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
   * False when a source marked this work as not counting toward the grade.
   *
   * §4.3: "Titles containing NOT FOR CREDIT, WILL NOT COUNT, or extra credit
   * get `extra.forCredit = "false"`. They still appear, but the popup sorts
   * them last within their day and a filter hides them. Don't drop them: some
   * 'not for credit' surveys are required."
   */
  forCredit?: boolean;
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
  /**
   * Where to send the student to fix a `needs_login`, when the answer is not a
   * fixed login form.
   *
   * `LOGIN_URL` covers the four hosted sources, and deliberately has no entry
   * for `site`: a course website is whatever host an adapter points at, so
   * there is no single page to open — which left "Sign in needed" on the one
   * source with nothing to click. But the page *is* known, at the moment the
   * logout is detected: it is the adapter URL that just answered 401. Recorded
   * here, it also sends the student back to the course page once SSO completes,
   * rather than to a login form and then nowhere.
   */
  loginUrl?: string;
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
  /**
   * memberKeys the student ticked off by hand.
   *
   * Two of the five sources can never say "done": a course-site row is emitted
   * with `status: "unknown"` forever, and a Canvas assignment handed in on
   * paper stays `not_submitted` until someone grades it. Without this the only
   * way to clear such a row was Hide, which is permanent, lives in the options
   * page, and means "I do not want to see this" rather than "I did it".
   *
   * Keyed by memberKey like `hiddenKeys`, and pruned by §5.4 for the same
   * reason: an id-keyed override is spent the moment a second source mirrors
   * the row, and the stale key stays armed forever.
   */
  doneKeys: string[];
  /**
   * A name the student gave a course, keyed the same way `disabledCourses` is.
   *
   * The last resort, deliberately. §5.1 derives a code wherever one exists, and
   * a student should never have to type `STAT 425` for a label the slug already
   * contains — that was a parser defect wearing a feature's clothes, and it is
   * fixed. This is for names no rule can derive: a Gradescope course an
   * instructor named "Section AL1", or a cross-listing the student thinks of by
   * the other number.
   */
  courseNames: Record<string, string>;
  /**
   * Canvas course ids (as strings) the student forced back in after §4.1's term
   * filter held them aside.
   *
   * Someone legitimately enrolled across two terms — a year-long project course,
   * a repeated class — is exactly who the filter is wrong about, so it has to be
   * reversible from the UI.
   */
  keptCourses: string[];
}

export interface Settings {
  /** Default both. */
  leadTimes: ("24h" | "2h")[];
  /** Default 23–8 local. */
  quietHours: { start: number; end: number } | null;
  hideSubmitted: boolean;
  /**
   * §4.3's filter for not-for-credit work.
   *
   * Off by default, and it only silences *reminders* — the rows stay in the
   * list. §4.3 is explicit that some "not for credit" surveys are required, and
   * CS 357's own fixture carries "S1 Select your group (NOT FOR CREDIT)", which
   * is exactly that. Hiding those outright would be a silent miss; declining to
   * interrupt someone about them is not.
   */
  remindNotForCredit: boolean;
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
  /**
   * Column *headers* to read instead of CSS selectors, for a table that has a
   * header row — which most course schedules do.
   *
   * `{ "title": "Exercises", "due": "Due Date|Deadline" }` resolves each name
   * against the table's own `<th>` row on every parse, so an added column
   * cannot silently shift the date to the solutions column (house rule 3, which
   * cost 14 items the one time it was ignored). Alternatives are separated by
   * `|` because the same column is called different things across courses.
   *
   * When present it takes precedence over `title` / `due` / `link`, which stay
   * as the fallback for pages that are not tables — CS 424's rowspan grid, a
   * list of prose items — and as the escape hatch when a header is missing or
   * ambiguous.
   */
  columns?: { title: string; due: string; link?: string };
  /**
   * `|`-separated labels for a page that writes its deadlines as `label: value`
   * lines rather than table cells — ECE 411's Sphinx page, whose MPs are a
   * `<ul>` of `Release: 8/25`, `Due: 9/7`, `CP1 Due: TBD`.
   *
   * The due text is read as `<label>:<rest>`; the label is compared **exactly**
   * after whitespace and case are normalised (house rule 6, the same rule
   * `columns` follows), `rest` goes to the date parser, and the label is
   * appended to the title — `mp_pipeline CP1` — because §3.1 hashes the title
   * and three checkpoints of one MP would otherwise share one `sourceId`.
   *
   * A line whose label is not declared is not this adapter's row and is skipped.
   * A page where *no* row carries a declared label throws, like a named column
   * that is no longer on the table.
   */
  dueLabel?: string;
  /**
   * Where a row that has no name of its own gets one.
   *
   * `"section >> h3"` climbs to `row.closest("section")` and reads `h3` inside
   * it, so every line in `mp_setup`'s list is titled `mp_setup`. Without the
   * `>>` the spec is a heading selector and the nearest match preceding the row
   * in document order wins.
   */
  titleFrom?: string;
  /**
   * A selector whose text supplies the clock when the due text states none.
   *
   * ECE 411's syllabus prints `Midterm 1: September 29` with `Time: 7-9PM` in a
   * sibling `<li>`; without this the runner invents 23:59 (worker rule 3) for an
   * exam that starts at 19:00. A range gives its start. Row-relative, or scoped
   * with `>>` like `titleFrom`.
   */
  time?: string;
  dateFormat: string;
  timezone: string;
  filter?: { include?: string; exclude?: string };
  minExtensionVersion: string;
}

export interface StoreV1 {
  /**
   * Bumped to 2 with the first-run screen. The name stays `StoreV1` because the
   * *shape* is still §3's — the number is what `migrate` uses to tell a store
   * written before that screen from one written after, and nothing else.
   */
  schemaVersion: 1 | 2;
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
