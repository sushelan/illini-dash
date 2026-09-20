/** Data model — SPEC.md §3. Kept in one place so every later module imports it. */

export type Source =
  | "canvas"
  | "gradescope"
  | "prairielearn"
  | "prairietest"
  | "smartphysics"
  | "site"
  /**
   * Deadlines the student typed in themselves.
   *
   * Not a site: nothing is fetched for it, it can never be logged out of, and
   * it can never fail — so it is excluded from every health count (worker rule
   * 2's converse: a dot that can only ever be green is not information). It is
   * a `Source` anyway because everything downstream — `memberKey`, `dedupe`,
   * the overrides, the row's source column — is keyed by one, and a second,
   * parallel identity for hand-typed work would need all of it again.
   *
   * Its rows live in `manualItems`, never in `store.raw`: `raw` is what the
   * sync loop replaces per source and §5.4 purges, and a row nobody fetches is
   * absent from every sync by construction, so retention would delete it after
   * three of them.
   */
  | "manual";

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
  /**
   * Absolute https URL on the source host.
   *
   * Optional since `manual`: a deadline the student typed has somewhere to be
   * done only if they said so, and a parser that cannot read a link still
   * records the row (house rule 1). Every consumer must treat "no link" as a
   * row that is not clickable, never as a reason to drop it.
   */
  url?: string;
  status: Status;
  /**
   * Source-specific facts, as strings because this crosses a message boundary.
   *
   * Two keys are read outside the source that wrote them and so are part of the
   * schema rather than private to a parser:
   *
   * - `timeAssumed: "true"` — the instant in `dueAt` carries a time this code
   *   invented rather than one the source stated (worker rule 3).
   * - `endAt` — an optional ISO 8601 instant **with an offset** at which the
   *   thing ends, for work that occupies a span rather than a moment: an exam
   *   sitting, a lab session, a manual entry given an end time. `dueAt` stays
   *   the instant everything sorts and reminds on; `endAt` is never a second
   *   deadline, and code that finds one must not treat it as one.
   */
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
  /**
   * Where you actually submit (§5.3 precedence).
   *
   * Absent when no member has one — a `manual` row the student gave no link.
   * A row without a link is still a row: it is drawn as a `<div>` rather than
   * an `<a>`, and nothing may drop it for want of somewhere to go.
   */
  url?: string;
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
  /**
   * Who moved it, when an instructor's post did (`Overrides.dueOverrides`).
   *
   * Separate from `movedFrom`, which is derived per sync and says only *that*
   * something changed. A student who reads "moved Fri → Mon" on a row whose
   * source still prints Friday needs to know where the Monday came from before
   * they will believe it — and needs somewhere to press when it is wrong, which
   * is what `postId` and the undo behind it are for.
   */
  movedBy?: { reason: string; from?: string; postId: string };
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
  /**
   * A deadline an instructor's post moved, keyed by memberKey like every other
   * override here.
   *
   * Keyed by memberKey and written to **every** member of the item, for the
   * reason `hiddenKeys` is: `Item.id` is a hash of the sorted member keys, so
   * an id-keyed correction is spent the moment a second source mirrors the row
   * — and a later merge or split would silently drop the instructor's own
   * correction while the row went on showing the stale date.
   *
   * `reason` is what the row says out loud ("Campuswire post 2026-09-18") and
   * `postId` is what stops the same post applying twice. `from` is the instant
   * the item held when the override landed, so the row can say what it moved
   * *from* after the fact — `Item.movedFrom` is derived per sync and is gone by
   * the next one.
   *
   * `timeAssumed` travels with the value for worker rule 3's reason: a post
   * that names a day and no clock is 23:59 by this extension's invention, and
   * §5.3 must go on ranking a stated instant above it.
   */
  dueOverrides: Record<string, DueOverride>;
}

/** One instructor correction, as stored. See `Overrides.dueOverrides`. */
export interface DueOverride {
  /** ISO 8601 with offset — the instant the post stated. */
  at: string;
  /** What the item was due at when this landed, when it was dated at all. */
  from?: string;
  /** Human-readable provenance, shown on the row: "Campuswire post 2026-09-18". */
  reason: string;
  /** The post this came from, so one post can never be ingested twice. */
  postId: string;
  appliedAt: string;
  /** True when the clock in `at` is this code's invention, not the post's. */
  timeAssumed?: boolean;
}

/**
 * A deadline a post stated that nothing in the store accounts for.
 *
 * Not an item, and deliberately not a `manual` row either: this extension did
 * not invent the deadline, but it did *read* it out of prose, and prose is the
 * one input where a confident misreading looks exactly like a fact. So it waits
 * one click away, carrying the verbatim `span` it came from, and becomes a real
 * row only when the student says so (`acceptSuggestion` → `newManualItem`).
 */
export interface Suggestion {
  /** Deterministic in the post, the title and the instant: ingesting the same
   * post twice can never produce two rows. */
  id: string;
  kind: "new";
  title: string;
  courseRaw: string;
  courseCode?: string;
  /** ISO 8601 with offset. */
  at: string;
  timeAssumed: boolean;
  /** Verbatim: the words in the post that stated the date. */
  span: string;
  /** Verbatim: the sentence the span sits in. */
  context: string;
  source: "piazza" | "campuswire" | "paste";
  postId: string;
  /**
   * The subject line of the post this was read out of.
   *
   * Additive, and optional because it has to be: a suggestion written by an
   * earlier build does not carry it, and the row draws today's wording ("from a
   * Piazza post") for those rather than an empty pair of quotes. "Found in a
   * post" is only actionable if the student can tell *which* post, and the
   * subject is the one string that says so without a round trip to the site.
   */
  postSubject?: string;
  postedAt: string;
  createdAt: string;
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
   * `|`-separated keywords that introduce a deadline *inside a sentence*, for a
   * page that writes its dates as prose rather than as cells or labelled lines.
   *
   * CS 425's assignments page is one `<li>` per item and the row reads
   * `[MP1 Specification Document]: Released 8/25. Due @ 9/13 11.59 PM Central
   * Time (Sun). Demos on 9/14 (Mon).` — three dates, and only the middle one is
   * the deadline. There is no element around it and no label in front of it, so
   * the word "Due" is the only thing that selects it.
   *
   * Matched as a **whole word**, case-insensitively (house rule 6: this page
   * writes "Overdue" and "the due-date" too), and it counts only when something
   * date-shaped follows within one connector — `:`/`@`/`on`/`by`/`at`, with an
   * optional "date"/"deadline" noun. That second condition is what keeps the
   * page's own `MPs are always due on a SUNDAY at 11.59 PM Central Time` bullet
   * from becoming an undated row claiming to be a deadline.
   *
   * Every occurrence is tried in document order and the first that parses wins.
   * A keyword followed by TBD/TBA/N/A still counts as a hook — the page *is*
   * naming this row's deadline — so the row is kept and reported undated rather
   * than dated from a release date elsewhere in the same sentence.
   *
   * Mutually exclusive with `dueLabel`: both read the date out of the located
   * text, and `validateAdapter` refuses an entry that declares both.
   */
  duePhrase?: string;
  /**
   * A selector for the nearest **preceding sibling** that carries the date.
   *
   * ECE 374 A's homework page is a definition list: the date is the `<dt>` and
   * the assignment is the `<dd>` after it. The date is not inside the row, not
   * in a cell of it and not in an ancestor either, so `due`, `columns.due` and
   * `titleFrom`'s `>>` all fail to reach it.
   *
   * The walk stops at the row's own parent, deliberately: `titleFrom`'s
   * document-order walk would take a `<dt>` from the list above whenever a row
   * has none of its own, which dates one assignment from another silently.
   * `@attr` is honoured; the plain form reads the whole element, because the
   * page wraps some of its dates in `<em><strong>`.
   *
   * Mutually exclusive with `columns.due`: `validateAdapter` refuses both.
   */
  duePrev?: string;
  /**
   * A zero-based **grid column**, for a table with no header row to name.
   *
   * CS 424's schedule is a table whose first row is seven `<td>`s rather than
   * `<th>`s, so `columns` has nothing to resolve against, and whose date cells
   * carry no class. Its left-hand column is a `rowspan` spacer drawing unit
   * headings, so rows carry 7, 6, 5, 4 or 1 children and `nth-child` is wrong
   * on most of them. There is nothing to anchor on but the position.
   *
   * A grid column, not a child index: `core/table-grid.ts` lays the table out
   * the way a browser does, so a `rowspan` above and a `colspan` beside both
   * move the column rather than shifting this row's cells under it.
   *
   * This is the one place house rule 3 is knowingly broken, so it is paired
   * with a loud run-time check: the column must read as a date on at least
   * `MIN_DATED_ROWS` rows and `MIN_DATED_SHARE` of the rows that have text
   * there, or the adapter throws naming the column and both counts. A column
   * that has moved is a redesign, and the whole cost of indexing by position is
   * that it otherwise fails in silence.
   *
   * Mutually exclusive with `columns.due` and `duePrev`.
   */
  dueSlot?: number;
  /** The title's grid column, for the same table. See `dueSlot`. */
  titleSlot?: number;
  /**
   * `HH:mm`: the hour this *page* states its work is due at, once, in prose.
   *
   * ECE 374 A prints "Written homeworks are due every **Tuesday at 9pm**" in a
   * paragraph above the list and then writes bare dates — so every row lands on
   * §4.5's invented 23:59, three hours late, and a two-hour reminder for it
   * arrives at 21:59, an hour after the deadline passed.
   *
   * Lowest precedence but one: a clock in the date cell wins, then a clock the
   * row states elsewhere, then this, then 23:59. And `extra.timeAssumed` is
   * **still set** — this is an adapter's inference from a sentence, not a clock
   * this row states, and §5.3 must go on preferring a real Canvas instant
   * (worker rule 3).
   */
  defaultTime?: string;
  /**
   * A literal separator; the title is everything before its first occurrence.
   *
   * The prose shape's rows are a whole sentence, and the name is the head of it:
   * `[HW1 Document]: Released 8/27. Due @ 9/20…` is called "HW1 Document". §3.1
   * hashes the title, so without this the `sourceId` changes whenever the course
   * edits a word of the sentence — losing every override on the row — and the
   * popup's title column holds a paragraph.
   *
   * A title wholly wrapped in `[ ]` loses the brackets, because those are the
   * page's own list punctuation rather than part of the name. Applied before
   * `splitTitle` and before `filter`.
   *
   * A literal, never a regex, for the reason `splitTitle` is one: this is remote
   * data applied to every row.
   */
  titleBefore?: string;
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
  /**
   * What the rows on this page *are*, when they are not assignments.
   *
   * `runAdapter` used to stamp `kind: "assignment"` on everything, so
   * `ece411-fa26-exams` — a whole page whose only rows are Midterm 1, Midterm 2
   * and the final — produced three assignments. That is not a label the student
   * reads past: `examBoard` filters on `kind === "exam"`, so the Exams tab
   * showed nothing for a course with two midterms in it, and the exams sat
   * mixed into the list of homework instead.
   *
   * One value for the whole adapter rather than per row, because a course site
   * splits by *page* (see "One course, two adapters"): the page that lists
   * exams lists nothing else. A page that genuinely mixed them would need a
   * per-row rule, and no captured page does.
   *
   * Omitted means `"assignment"`, which is what every entry meant before this
   * field existed.
   */
  kind?: Kind;
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
