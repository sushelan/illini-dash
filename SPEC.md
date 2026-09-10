# Illini Dash — v1 Spec

Working name: `illini-dash` (rename freely). Version: spec v1.0, 2026-09-02.

A Chrome extension that shows every deadline from Canvas, Gradescope, PrairieLearn,
PrairieTest, and a curated set of UIUC course websites in one list, deduped, with
reminders and calendar export. No backend, no accounts, no stored passwords: the
extension reads the pages the student is already logged into.

This document is written to be handed to Claude Code. Sections marked **VERIFY**
contain assumptions about third-party sites that must be checked against real
fixtures before code is written against them.

---

## 0. Decisions that are not up for debate in v1

These are load-bearing. Changing any of them changes the whole project.

1. **No backend.** All data lives in `chrome.storage.local`. Nothing leaves the browser.
   This is what makes the project legal, private, free to run, and buildable in weeks.
2. **No credential handling.** The extension never sees a password. It fetches pages
   using the session cookies already in the browser. If a session is expired, the
   extension says so and links to the login page; it never tries to log in.
3. **Parsers fail loudly.** A page that should contain assignments but yields zero
   rows is a parse error, not an empty result. Silent emptiness is the worst failure
   mode because the student trusts a list that is missing things.
4. **Declarative adapters only.** Course-site adapters are JSON (URLs + CSS selectors +
   date formats), never code. Manifest V3 forbids remotely loaded code; remote *data*
   is fine.
5. **Chrome only.** Firefox later. The parser layer is written so it can move, but
   nothing else is abstracted for it.
6. **Ship ugly.** The popup is a list. Design polish is v1.1.

---

## 1. Scope

### In scope (v1)

| Area | Included |
|---|---|
| Sources | Canvas, Gradescope, PrairieLearn, PrairieTest, course-site adapters (2–3 seed adapters) |
| Core | Fetch, parse, normalize, dedupe, store, list UI, per-source health |
| Reminders | Chrome notifications at configurable lead times; daily nag for unbooked PrairieTest exams |
| Calendar | Per-item "Add to Google Calendar" link (no OAuth) and bulk `.ics` download |
| Overrides | Manual merge / unmerge / hide, per-course toggles |
| Robustness | Fixture-based parser tests, parse-error surfacing, "report broken page" flow |

### Out of scope (v1) — with the reason, so nobody re-litigates it

| Item | Why not now |
|---|---|
| Campuswire | Q&A site; deadlines appear only inside unstructured announcements. Needs LLM extraction, which needs a backend and costs money. v2 Pro feature. |
| LLM announcement parsing ("MP3 extended to Friday") | Same as above. |
| Google Calendar OAuth sync | Calendar scopes are "sensitive"; unverified OAuth apps are capped at 100 users and show a scary warning. Submit for verification during v1, ship sync in v1.1. |
| Subscribable `.ics` feed | Needs a URL, which needs a server. |
| SMS / email reminders | Needs a server and money. |
| Moodle (`learn.illinois.edu`) | Some UIUC courses still use it. Only add if beta testers hit it; it's a separate adapter. |
| Course Explorer seat alerts | Separate feature, separate timing (November). Design so it can slot in as a sixth source. |
| Firefox / Safari | MV3 differences (no `offscreen` API in Firefox). |
| Accounts, sync across devices | No backend. |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Service worker (background.ts)                                │
│  - chrome.alarms every 30 min → runSync()                    │
│  - runSync(): for each enabled source → fetch → parse → items│
│  - normalize → dedupe (with overrides) → store               │
│  - schedule/fire notifications                               │
│  - refresh adapter registry daily                            │
└───────────────┬──────────────────────────────┬───────────────┘
                │ chrome.runtime messaging      │ chrome.storage.local
      ┌─────────▼──────────┐          ┌─────────▼─────────┐
      │ Offscreen document │          │ Popup / Options   │
      │ (DOM_PARSER)       │          │ read-only view of │
      │ HTML string → JSON │          │ storage + user    │
      └────────────────────┘          │ overrides         │
                                      └───────────────────┘
```

### 2.1 Why an offscreen document

MV3 service workers have no `DOMParser`. Options were: regex (fragile), bundle an
HTML parser (adds 100KB+ and a dependency), or `chrome.offscreen` with reason
`DOM_PARSER`, which exists for exactly this. The worker fetches HTML as a string,
posts it to the offscreen document, which runs the source's parser against a
`DOMParser` document and returns plain JSON. `DOMParser` documents are inert (no
script execution, no resource loading), which is also the security property we want
when parsing untrusted HTML.

Parsers are written as pure functions `(doc: Document, ctx) => RawItem[]` so they run
unchanged in Node tests (via `linkedom` or `jsdom`) and in the offscreen document.

### 2.2 Cookie-authenticated fetch — Gate 0 (page-context half PASSED 2026-09-02)

Requests from extension contexts to hosts listed in `host_permissions` are sent with
the user's cookies when `credentials: "include"` is set, and Chrome exempts these from
SameSite restrictions. This is the assumption the whole project rests on.

**Verified so far:** `fetch(..., {credentials: "include"})` run from each site's own
tab returned `200` with logged-in content on all four sources (Gradescope home page
title "Your Courses | Gradescope"; Canvas API JSON). So the sessions are plain cookie
sessions and the pages are fetchable. **Still to do:** repeat from the bare
extension's service worker (build step 2), because the extension's origin is
different. Expected to pass; if it doesn't, use the fallback below.

Fallback if a host fails Gate 0: inject a content script into a tab on that origin and
perform the fetch from page context (same-origin, cookies guaranteed). Uglier (needs a
tab), so only if needed.

### 2.3 Permissions

```json
{
  "permissions": ["storage", "alarms", "notifications", "offscreen"],
  "host_permissions": [
    "https://canvas.illinois.edu/*",
    "https://www.gradescope.com/*",
    "https://us.prairielearn.com/*",
    "https://us.prairietest.com/*",
    "https://raw.githubusercontent.com/*"
  ],
  "optional_host_permissions": ["https://*.illinois.edu/*"]
}
```

- Hostnames confirmed 2026-09-02: `canvas.illinois.edu`, `www.gradescope.com`,
  `us.prairielearn.com`, `us.prairietest.com` all responded to authenticated requests.
- Course sites live on many subdomains (`courses.grainger.illinois.edu`,
  `courses.engr.illinois.edu`, `cs.illinois.edu`, …). Requesting all of them up front
  makes the store listing look greedy. Use `optional_host_permissions` and call
  `chrome.permissions.request` the first time the user enables a course-site adapter.
- Never request `<all_urls>`, `tabs`, or `webRequest`. Store review is much faster
  without them and the privacy story stays one sentence.

### 2.4 Build

- TypeScript, esbuild (or Vite + `@crxjs/vite-plugin` if it's already familiar). Keep
  dependencies near zero at runtime: no framework for the popup in v1 (vanilla DOM), a
  small date library only if `Intl` + hand parsing proves painful.
- Tests: `vitest` with `linkedom` for parser tests against fixtures.
- Repo layout:

```
src/
  background.ts          service worker: alarms, sync orchestration, notifications
  offscreen.ts           receives {source, html, ctx} → returns RawItem[]
  sources/
    types.ts             RawItem, Item, SourceStatus, etc.
    canvas.ts            API client (JSON, not HTML)
    gradescope.ts        fetch plan + parser
    prairielearn.ts
    prairietest.ts
    site.ts              generic declarative adapter runner
  core/
    normalize.ts         course-code extraction, title normalization, tz handling
    dedupe.ts            grouping + override application
    store.ts             storage schema, migrations, purge
    schedule.ts          notification scheduling
    ics.ts               .ics + Google Calendar template links
  ui/
    popup.html/.ts
    options.html/.ts
adapters/
  registry.json          built-in copy of the adapter registry (also published raw on GitHub)
fixtures/
  gradescope/*.html      scrubbed real pages
  prairielearn/*.html
  prairietest/*.html
  canvas/*.json
  sites/*.html
tests/
```

---

## 3. Data model

```ts
type Source = "canvas" | "gradescope" | "prairielearn" | "prairietest" | "site";

type Kind = "assignment" | "quiz" | "exam" | "booking" | "other";

type Status = "not_submitted" | "submitted" | "graded" | "missing" | "unknown";

/** One row as one source sees it. Immutable once parsed. */
interface RawItem {
  source: Source;
  sourceId: string;        // stable within the source; see §3.1
  courseRaw: string;       // course name exactly as the source displays it
  courseCode?: string;     // canonical "CS225" if extractable (§5.1)
  title: string;           // exactly as displayed
  kind: Kind;
  dueAt?: string;          // ISO 8601 with offset. undefined = undated
  lateDueAt?: string;      // Gradescope late due / PrairieLearn reduced-credit deadline
  url: string;             // absolute https URL on the source host
  status: Status;
  extra?: Record<string, string>;  // e.g. PrairieTest reservation text, points
  fetchedAt: string;       // ISO
}

/** One deadline as the student sees it: one or more RawItems merged. */
interface Item {
  id: string;              // deterministic: sha1 of sorted member keys (§5.3)
  members: RawItem[];
  courseCode?: string;
  courseLabel: string;     // best display name
  title: string;           // chosen from members (§5.3)
  kind: Kind;
  dueAt?: string;
  lateDueAt?: string;
  url: string;             // where you actually submit (§5.3 precedence)
  status: Status;
  hidden: boolean;         // user override
  notified: Partial<Record<"24h" | "2h" | "booking", string>>; // ISO when fired
}

interface SourceStatus {
  source: Source;
  enabled: boolean;
  state: "ok" | "needs_login" | "parse_error" | "network_error" | "disabled";
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;      // short, human-readable
  consecutiveFailures: number;
}

interface Overrides {
  mergeGroups: string[][];     // arrays of memberKeys the user forced together
  splitKeys: string[];         // memberKeys the user forced apart from auto-merges
  hiddenItemIds: string[];
  disabledCourses: string[];   // courseCodes or courseRaw values
}

interface StoreV1 {
  schemaVersion: 1;
  raw: Record<string, RawItem>;          // key = memberKey (§3.1)
  items: Item[];
  sources: Record<Source, SourceStatus>;
  overrides: Overrides;
  settings: Settings;
  registry: { fetchedAt?: string; adapters: Adapter[] };
}

interface Settings {
  leadTimes: ("24h" | "2h")[];           // default both
  quietHours: { start: number; end: number } | null;  // default 23–8 local
  hideSubmitted: boolean;                // default true
  pollMinutes: number;                   // default 30, min 15
}
```

### 3.1 memberKey and sourceId

`memberKey = ${source}:${sourceId}`. It must be stable across re-scrapes or every
override breaks on the next sync.

| Source | sourceId |
|---|---|
| Canvas | `${plannable_type}:${plannable_id}` |
| Gradescope | assignment id from the row link `/courses/{c}/assignments/{a}`; if the row has no link (unsubmittable), `hash(courseId + normalizedTitle)` |
| PrairieLearn | assessment id from the row link `/pl/course_instance/{ci}/assessment/{a}` |
| PrairieTest | exam id from the exam link; booking pseudo-items get `${examId}:booking` |
| Site | `${adapterId}:${hash(normalizedTitle + dueDate)}` — course sites have no ids |

Limitation: a course site that renames an assignment produces a new key, so a hide or
merge on it is lost. Acceptable; it's rare and the cost is one extra click.

### 3.2 Timezones

- Store every instant as ISO 8601 **with offset**. Never store a naive local time.
- Display in the browser's local zone. Everything at UIUC is America/Chicago, but a
  student on break in California should still see the right local time.
- Confirmed formats per source (2026-09-02):
  - Canvas: ISO 8601 UTC (`2026-09-09T22:00:00Z`).
  - Gradescope: `datetime="2026-09-09 17:00:00 -0500"` — full date, 24h time, and a
    numeric offset, but **not** ISO (space separator, offset without a colon). Parse
    explicitly: `/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/` →
    `${d}T${t}${oh}:${om}`. Do not rely on `new Date()` accepting the raw string.
  - PrairieLearn: `100% until 23:59, Tue, Sep 8` — 24h time, weekday, month, day.
    **No year, no zone.** Zone is the course-instance zone, America/Chicago for UIUC.
    Year is inferred (§4.3) and the weekday is used to check the inference.
  - PrairieTest: `Thu, Sep 10, 1pm (CDT)` — weekday, month, day, 12h time (minutes
    optional), zone abbreviation. No year. Map `CDT`→`-05:00`, `CST`→`-06:00`.
  - Course sites carry whatever they carry; the adapter declares `dateFormat` and
    `timezone`.
- Shared helper `parseLocalDate(parts, zone)`: build the instant from wall-clock
  parts in a named zone using `Intl.DateTimeFormat` offset lookup (no library needed
  for one zone). Year inference: assume the current year; if the result is more than
  6 months in the past, add one; if a weekday is present and doesn't match, try the
  adjacent years and pick the one that matches (this catches almost every bad guess).
- DST: 2026-11-01 falls back. Storing absolute instants makes this a non-issue for
  display; it only matters inside `parseLocalDate`, which must compute the offset for
  the specific date, not a fixed -05:00.

---

## 4. Sources

General contract for every source module:

```ts
interface SourceModule {
  source: Source;
  /** URLs to fetch, possibly discovered in stages (dashboard → course pages). */
  plan(ctx: Ctx): Promise<FetchPlan>;
  /** Pure. Throws ParseError on structural surprise. Never returns [] for a page
      whose structure says items should exist. */
  parse(doc: Document | object, page: PageCtx): RawItem[];
  /** Detect a logged-out response so it's reported as needs_login, not parse_error. */
  isLoginPage(resp: Response, body: string): boolean;
}
```

Fetch rules for all sources:
- `credentials: "include"`, `redirect: "follow"`, then check `resp.url`: if it landed
  on a login/SSO host (`shibboleth`, `login.illinois.edu`, `/login`), that's
  `needs_login`.
- Timeout 20 s per request. At most 4 concurrent requests per host.
- Per-source backoff on failure: 30 min → 1 h → 2 h → 4 h cap; reset on success.
- User-Agent is the browser's; do not spoof anything.
- Total request budget per sync: roughly 1 + (#courses) per HTML source. With six
  courses that's about 25 requests per 30 minutes across all sources. Polite.

### 4.1 Canvas (API, not scraping)

Canvas has a real REST API and it works with session cookies for GET requests.

Endpoints:
- `GET /api/v1/courses?enrollment_state=active&per_page=100` → `id`, `name`,
  `course_code` (e.g. `"CS 225"`). Used to build the course map and to filter out
  concluded courses that still leak into the planner.
- `GET /api/v1/planner/items?start_date={now-7d}&end_date={now+60d}&per_page=100`
  → one entry per assignment/quiz/discussion/calendar event with `plannable_type`,
  `plannable_id`, `plannable.title`, `plannable.due_at`, `course_id`,
  `context_name`, `html_url`, and `submissions` (either `false` or an object with
  `submitted`, `graded`, `missing`, `late`, `excused`).

Known quirks (real, not hypothetical):
- **`while(1);` prefix.** When the API is called with a browser session instead of a
  bearer token, Canvas prepends `while(1);` to every JSON body as JSON-hijacking
  protection. Strip it before `JSON.parse`. Detect it rather than blindly slicing 9
  characters, in case it's absent for token users later.
- **Pagination** is via the `Link` header (`rel="next"`). Follow it.
- **Undated items.** Assignments with no `due_at` appear nowhere in the planner window.
  v1 ignores them; a later version could pull `/api/v1/courses/{id}/assignments` to
  list them under "No date". Note this in the options page so students know.
- **External-tool assignments.** Gradescope assignments linked through Canvas LTI show
  up here as Canvas assignments with `plannable_type: "assignment"` and a
  `html_url` on Canvas. These are the main dedupe case (§5).
- **Instructor sloppiness.** Some courses set due dates only in Gradescope and leave
  Canvas undated, or vice versa. This is why every source stays enabled; the union
  is what's correct.

Kind mapping: `quiz` → `quiz`; `assignment` → `assignment`; `calendar_event` whose
title contains `exam|midterm|final` → `exam`, else `other`; `discussion_topic` →
`assignment`; `planner_note`/`announcement`/`wiki_page` → skip.

### 4.2 Gradescope (HTML) — structure confirmed 2026-09-02, still capture fixtures

Fetch plan:
1. `GET https://www.gradescope.com/` (logged in, this is the account dashboard,
   `<title>Your Courses | Gradescope</title>`). Course cards are links matching
   `/courses/\d+`, grouped under term headings. **Confirmed: the current term is the
   first group and past terms are also present.** Take the first group in DOM order;
   the options page lets the user re-enable older courses. Term strings are free
   text (`Fall 2026`); never parse them.
2. `GET /courses/{id}` for each selected course. The page header shows the short
   course name (`PHYS435`), the term (`Fall 2026`), and `Course ID: 1352838`. The
   assignments table has header cells `Name`, `Status`, `Released`, `Due (CDT)`.

Confirmed row structure (student view):

```html
<tr role="row">
  <th class="table--primaryLink" role="rowheader">   <!-- name; contains <a> if submittable -->
  <td class="submissionStatus submissionStatus-warning">No Submission</td>
  <td>
    <div class="submissionTimeChart submissionTimeChart-warning">
      <div class="submissionTimeChart--dueDetails">…</div>   <!-- "6 days, 17 hours left" -->
      <div class="progressBar progressBar-slim">…</div>
      <div class="progressBar--caption">
        <time class="submissionTimeChart--releaseDate"
              aria-label="Released at September 01 at 7:59AM"
              datetime="2026-09-01 07:59:00 -0500">Sep 01 at 7:59AM</time>
        <time class="submissionTimeChart--dueDate"
              aria-label="Due at September 09 at 5:00PM"
              datetime="2026-09-09 17:00:00 -0500">Sep 09 at 5:00PM</time>
        <br>
        <time class="submissionTimeChart--dueDate"                 <!-- optional -->
              aria-label="Late Due Date at September 16 at 5:00PM"
              datetime="2026-09-16 17:00:00 -0500">Late Due Date: Sep 16 at 5:00PM</time>
      </div>
    </div>
  </td>
</tr>
```

Parser rules:
- Rows: every `tr` that contains a `th.table--primaryLink`. Title = that cell's text
  trimmed. Assignment id = from the `<a href>` inside it (`/courses/{c}/assignments/{a}`)
  when present; otherwise the hashed fallback from §3.1.
- Status: `td.submissionStatus` text. `No Submission` → `not_submitted`;
  `Submitted` → `submitted`; a percentage or `Graded` → `graded`; anything else →
  `unknown` and log once. Ignore the `submissionStatus-*` modifier classes; they
  encode color, not meaning.
- Due date: the **first** `time.submissionTimeChart--dueDate` whose `aria-label`
  starts with `Due`. Late due: a `time.submissionTimeChart--dueDate` whose
  `aria-label` starts with `Late Due Date`. Both due and late-due share the same
  class, so the aria-label prefix is the discriminator, with DOM order (first = due,
  second = late) as the fallback if the label text ever changes. Always parse the
  `datetime` attribute (format in §3.2), never the visible text.
- Release date (`time.submissionTimeChart--releaseDate`) goes in `extra.releasedAt`;
  not shown in v1 but useful later for "opens in 2 days".
- Header-based column detection is now the **fallback**, used only if the expected
  classes are missing from a page that has a table. Keep it; it's cheap insurance.
- If there is no table at all on a page whose URL matched `/courses/\d+` and which
  is not a login page, throw `ParseError("no assignments table")`. A table with zero
  rows is a legitimate empty course.
- Rows whose due date is more than 60 days in the past are dropped at parse time.

Known limitations:
- Gradescope has **no API** and its terms of service discourage automated access.
  This extension makes about the same requests a student's browser makes when they
  click through their courses, at a low rate, using their own session. Keep it that
  way: no polling faster than every 15 minutes, no fetching pages the student can't
  see. If Gradescope ever blocks extension-originated requests (they sit behind
  Cloudflare), the fallback is the content-script fetch from §2.2.
- Sessions expire; when they do, the dashboard fetch redirects to `/login`. Report
  `needs_login` with a button that opens `https://www.gradescope.com/login`.
- Students enrolled via a personal email in one course and school email in another
  will only see whichever account is logged in. Not fixable; document it.

### 4.3 PrairieLearn (HTML) — layout confirmed 2026-09-02; one popover still to capture

Fetch plan:
1. `GET https://us.prairielearn.com/pl/` → student home lists enrolled course
   instances with links `/pl/course_instance/{id}`. Take all; the list is already
   current-term biased. Per-course toggles handle stragglers.
2. `GET /pl/course_instance/{id}/assessments` → one table headed "Assessments" with
   columns: badge, name, **Available credit**, **Score**. Rows are grouped under bold
   heading rows that are the course's own groupings (`Module 4. Floating Point`,
   `Quiz 1: Modules 1-3`, `Course surveys`, …), which are **not** reliable type
   labels. The badge is what encodes type: `HW3`, `L4a`, `PQ1`, `GA 1`, `S1`.

Confirmed cell contents (CS 357, Fall 2026):

| Badge | Name | Available credit | Score |
|---|---|---|---|
| `HW3` | link | `100% until 23:59, Thu, Sep 3` + `?` icon | `Not started` |
| `L3` | link | `80% until 23:59, Tue, Sep 8` + `?` | progress bar `100%` |
| `HW2` | link | `96% until 23:59, Tue, Sep 8` + `?` | progress bar `100%` |
| `PQ1` | plain text (no link) | `100% until 23:59, Tue, Sep 8` + `?` | button `New instance` |
| `GA 1` | link + group icon | *(empty)* | progress bar `103%` |
| `S3` | link | *(empty)* | `Not started` |
| `L1` | link, title ends `(NOT FOR CREDIT)` | *(empty)* | progress bar `0%` |

The important semantic: **the cell shows only the credit tier that is available right
now and when it ends, not the full schedule.** `80% until Sep 8` means the 100%
deadline already passed and 80% is what's left.

The full schedule is in the `?` popover, confirmed 2026-09-02. It's a Bootstrap 5
popover (`div.popover.bs-popover-auto`, header "Access details") containing:

```html
<table class="table" aria-label="Access details">
  <tbody>
    <tr><td>100</td><td>2026-09-01 08:00:01 (CDT)</td><td>2026-09-08 11:00:00 (CDT)</td></tr>
    <tr><td>80</td> <td>2026-09-08 11:00:00 (CDT)</td><td>2026-09-22 23:59:59 (CDT)</td></tr>
    <tr><td>50</td> <td>2026-09-22 23:59:59 (CDT)</td><td>2026-12-09 23:59:59 (CST)</td></tr>
    <tr><td>0</td>  <td>2026-12-09 23:59:59 (CST)</td><td></td></tr>
  </tbody>
</table>
```

Columns are Credit, Start, End. Full dates, seconds, and a zone abbreviation that
flips between CDT and CST across the semester. The last row (0 credit) has no end.
This is the best-structured deadline data in the whole project, so it becomes the
**primary** source for PrairieLearn dates; the cell text is the fallback.

**One thing to VERIFY in the fetched HTML** (not the live page): the rendered
`div.popover` only exists after a click. In the server-rendered HTML the same table
should be sitting in a `data-bs-content` attribute on the `?` trigger button as an
escaped HTML string (that's how PrairieLearn does popovers). Capture the assessments
page with "Save as HTML only" and grep for `Access details`. If it's there, parse the
attribute value with `DOMParser`. If it's absent (built client-side from JSON), the
cell-text fallback below is the whole story.

Parser rules:
- Rows: table rows that have a badge cell and a name cell; heading rows (single
  bold cell) are skipped but their text is kept as `extra.group` for display.
- Title = badge + name (`HW3 Errors and Big-O`). The badge is also stored in
  `extra.badge` and takes part in title normalization (§5.2), because Canvas names
  the same thing `Homework 3`, which normalizes to `hw3`, matching the badge.
- Assessment id from the name link `/pl/course_instance/{ci}/assessment/{aid}`;
  rows without a link (`PQ1`) use the hashed fallback from §3.1.
- **Schedule (primary).** From the popover table, rows sorted as given:
  - `dueAt` = End of the highest-credit row (normally 100). If the highest credit is
    below 100 (some courses cap at 90), it's still the "full credit" deadline.
  - `lateDueAt` = End of the row immediately after it, i.e. the next credit drop.
    Not the last nonzero tier: `50% until Dec 9` is a semester-long tail, not a
    late deadline anyone plans around.
  - The whole table is stored in `extra.creditSchedule` as JSON
    (`[{credit, start, end}]`) so the popup can show "then 80% until Sep 22".
  - Start of the first row → `extra.releasedAt`.
  - Dates: `^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) \((C[DS]T)\)$`, zone from the
    abbreviation. Note the `:01` seconds on some starts; keep seconds, don't round.
- **Cell text (fallback)**, regex
  `^(\d{1,3})% until (\d{1,2}):(\d{2}), (Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2})$`
  (24h time; no year; no zone → America/Chicago; weekday validates the year guess,
  §3.2).
  - Percentage `100` → `dueAt` = that instant.
  - Percentage `< 100` → the full-credit deadline has passed. `dueAt` = undefined,
    `lateDueAt` = that instant, `extra.creditRemaining = "80"`. The UI shows
    "80% until Tue 11:59 PM".
  - Any non-empty cell that doesn't match the regex → `ParseError` for that row,
    logged with the raw text, and the row is still emitted as undated. (One weird
    row must not take the whole course down.)
- Both the schedule and the cell present: use the schedule, and assert the cell's
  current tier matches what the schedule says for "now". A mismatch is logged, not
  fatal; it would mean the popover belongs to a different row (selector bug).
- Empty credit cell and no popover → no active deadline (closed, or always
  available). Item is undated and only shown if unfinished and the user has "show
  undated" on. Default off.
- Score cell → status: `Not started` → `not_submitted`; a `New instance` button →
  `not_submitted`; a percentage bar `> 0%` → `graded` (PrairieLearn grades on the
  spot, so this is "done" for our purposes); a `0%` bar → `not_submitted` (opened
  but nothing earned).
- Titles containing `NOT FOR CREDIT`, `WILL NOT COUNT`, or `extra credit`
  (case-insensitive) get `extra.forCredit = "false"`. They still appear, but the popup
  sorts them last within their day and a filter hides them. Don't drop them: some
  "not for credit" surveys are required.
- Rows with no link and an `Exam`-like badge (`E1`, `Q1` in an exam set) are usually
  CBTF exams whose real time comes from PrairieTest; keep the row but it will merge
  with the PrairieTest item under §5.3.
- If the assessments table is missing on a page that isn't a login page: `ParseError`.

Known limitations:
- Credit schedules can be per-student (extensions, accommodations). The page shows
  the student's own schedule, so this is handled; the popover table shape should be
  identical, just with different numbers.
- If the popover isn't in the fetched HTML, a passed full-credit deadline is
  unrecoverable and the item shows only its reduced-credit deadline. Still correct as
  far as "what can I still do" goes.
- Some courses use PrairieLearn for practice only, with no deadlines. Those show as
  undated and are hidden by default, which is correct.

### 4.4 PrairieTest (HTML) — booked card confirmed 2026-09-02; **VERIFY the unbooked section**

This is the headline feature. The `/pt/` home page has (at least) two cards:

**"Exam reservations"** — confirmed layout, one entry per booked exam:

```
CS 357 (Fa26): Quiz 1              ← link; href carries the exam id
CBTF: Grainger Library 057         ← "CBTF:" label + link to the location
Room 057 in the basement of Grainger Library   ← grey description line
                          Thu, Sep 10, 1pm (CDT)                  ← right column, line 1
                          50min, In-person, No accommodations     ← right column, line 2
```

**"Exams available for reservations"** — confirmed layout, one row per exam whose
reservation window is open:

```
[Make a reservation]   CS 357 (Fa26): Quiz 1   Tue, Sep 8 to Thu, Sep 10 (CDT)
```

The right column is the **session window** (dates only, no times), not a booking
deadline. PrairieTest does not display a "reserve by" date.

**Confirmed unbooked state (2026-09-03):** the exam appears only in the available
card, and the reservations card shows the italic text
`You don't have any upcoming reservations.` That text is a legitimate empty card,
not a parse error. Whether a booked exam also remains listed in the available card
is unconfirmed (an earlier pair of screenshots suggested it might; they may have been
taken before and after a cancellation). The rule below is written so it doesn't
matter: `unbooked = present in available card AND absent from reservations card`,
matched on the exam title text (or the exam id if the available-card row links to
it — capture HTML to check; the button may be the only link).

Parser rules for the reservations card:
- Entry = each block under the "Exam reservations" heading (capture HTML to learn
  whether entries are `li`, `tr`, or `div`s; select by the exam link `a[href*="exam"]`
  and walk up to the entry container rather than depending on the container class).
- Title = link text with the `(Fa26)` term stripped for display but kept in
  `extra.term`. Course code from the link text via §5.1 (`CS 357` → `CS357`).
- `dueAt` = right column line 1, regex
  `^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2}), (\d{1,2})(?::(\d{2}))?(am|pm) \((C[DS]T)\)$`
  → §3.2 parser with the zone from the abbreviation.
- `extra.location` = the CBTF link text; `extra.locationDetail` = the grey line;
  `extra.duration`, `extra.format`, `extra.accommodations` from splitting line 2 on
  `, `.
- Exam id from the link href; `kind: "exam"`; `status: "unknown"`.

Parser rules for the available card:
- Row = each row under the "Exams available for reservations" heading containing a
  `Make a reservation` button (the button text may change to something like
  `Change reservation` once booked; do not depend on it, use the cross-check above).
- Title = the middle cell text. Window regex:
  `^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2})(?: to (Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2}))? \((C[DS]T)\)$`
  — the `to …` part is optional for single-day windows (not yet seen; guarding for
  it costs nothing).
- `extra.windowStart` = first date at 00:00 in the zone, `extra.windowEnd` = second
  date at 23:59:59 (or same day if absent). Year inferred with weekday check (§3.2).

Two `RawItem`s per exam:

| Item | Produced when | `kind` | `dueAt` | `status` |
|---|---|---|---|---|
| The exam itself | present in reservations card | `exam` | reserved session start | `unknown` (status field means "submitted", not meaningful here) |
| `Book a slot: {exam}` | in available card, not in reservations card | `booking` | `windowStart` (00:00 on the first session day) | `not_submitted` |

The booking item disappears (and its notifications stop) once the exam shows up in
the reservations card.

Booking-item semantics:
- `dueAt = windowStart` is deliberately early. Slots fill, and by the time the window
  opens the good ones are gone. `extra.deadlineIsEstimate = "true"` and the UI
  wording is "sessions Sep 8–10, not booked" rather than "due Sep 8".
- Once `windowEnd` has passed with no reservation, the item is shown as
  "missed reservation" in Needs attention for 3 days, then purged. The extension
  can't know whether the student took the exam another way.
- The booking nag (§7) fires daily at 10:00 from the moment the exam appears in the
  available card. Exams not yet open for reservations don't appear there at all, so
  the "opens on" case doesn't arise; if a future capture shows such rows, add
  `extra.bookingOpensAt` and suppress until then.

### 4.5 Course-site adapters (declarative)

Many UIUC CS courses keep the real schedule on a course website. Each site is
different, so the extension ships a generic runner and a JSON registry of adapters.

```ts
interface Adapter {
  id: string;                    // "cs225-fa26"
  label: string;                 // "CS 225 course site"
  courseCode: string;            // "CS225"
  term: string;                  // "fa26" — adapters expire; the UI hides stale ones
  url: string;                   // page to fetch
  hostPattern: string;           // "https://courses.grainger.illinois.edu/*" for optional permission
  rows: string;                  // CSS selector for one row/entry
  title: string;                 // selector relative to row; "@attr" suffix allowed
  due: string;                   // selector relative to row
  link?: string;                 // optional selector; default = adapter.url
  dateFormat: string;            // token format, e.g. "MMM d, h:mm a" or "yyyy-MM-dd"
  timezone: string;              // "America/Chicago"
  filter?: { include?: string; exclude?: string };  // regexes applied to title text
  minExtensionVersion: string;
}
```

Runner rules:
- Fetch `url`, parse with `DOMParser`, apply selectors, parse dates with the declared
  format, produce `RawItem`s with `source: "site"`.
- Zero rows matched on a fetched page → `ParseError` for that adapter only; other
  sources are unaffected.
- Adapters are **data**. There is no expression language, no JS, no eval. If a site
  needs logic (e.g. dates in one column and times in another), extend the schema with
  a new declarative field rather than embedding code.
- The built-in `adapters/registry.json` is bundled with the extension. Once a day the
  worker fetches the same file from
  `https://raw.githubusercontent.com/{you}/illini-dash/main/adapters/registry.json`,
  validates it against the schema, and replaces the stored copy. A bad remote file is
  rejected and the previous copy stays. This lets you fix a broken selector without a
  store re-review.
- An adapter is only active if the user enabled it (options page) and granted the
  host permission. Enabling it triggers `chrome.permissions.request`.

Known limitations:
- Sites behind Shibboleth work only while the SSO session is alive; same
  `needs_login` handling.
- Sites rendered by JavaScript (some use a client-side table) produce empty HTML from
  `fetch`. The runner can't run JS. Such sites need the content-script fallback or
  are simply unsupported in v1; the registry entry should say `renders: "client"` so
  the UI can warn.
- Seed the registry with 2–3 adapters for courses you or your beta testers are in
  this semester. Don't try to cover the catalog.

---

## 5. Normalization and dedupe

### 5.1 Course code extraction

Sources name the same course differently: Canvas `"CS 225 Data Structures Fall 2026"`,
Gradescope `"CS 225"`, PrairieLearn `"CS 225: Data Structures, Fall 2026"`.

- Regex `\b([A-Z]{2,4})\s*-?\s*(\d{3}[A-Z]?)\b` on the raw course string, uppercase.
  First match becomes `courseCode` (`"CS225"`).
- Cross-listed courses (`ECE 391 / CS 391`) produce two matches; keep the first as the
  key and stash all codes in `extra.altCodes`. When comparing courses across sources,
  a match on any code counts.
- No match (e.g. `"Senior Design"`) → `courseCode` undefined; dedupe falls back to
  case-insensitive comparison of the first 12 characters of `courseRaw`. Weak, but
  those courses rarely appear in more than one source.

### 5.2 Title normalization

Applied only for comparison; the displayed title is never altered.

1. Lowercase; strip everything except letters, digits, spaces.
2. Expand/contract synonyms: `machine problem` → `mp`, `homework` → `hw`,
   `programming assignment` → `pa`, `lab(oratory)?` → `lab`, `quiz` stays.
3. Join a bare prefix and number: `mp 3` → `mp3`, `hw 02` → `hw2` (strip leading
   zeros in numbers).
4. Remove filler tokens: `due`, `submission`, `the`, `a`, `and`, `fall`, `2026`.
5. Result is a token set.

### 5.3 Auto-merge rule

Two `RawItem`s are merged if all of:
- same `courseCode` (or any-alt-code match), and
- both dated and `|dueAt₁ − dueAt₂| ≤ 24 h`, **or** both undated, and
- title token sets have Jaccard similarity ≥ 0.6 **or** one token set is a subset of
  the other and the smaller has ≥ 2 tokens, and
- they come from **different** sources (never merge two rows from the same source).

Merging is transitive: build a union-find over all raw items. Then apply overrides:
`splitKeys` are removed from their auto-group and become singletons;
`mergeGroups` are unioned in. `Item.id` = sha1 of the sorted member keys, so an
unchanged group keeps its id (and its `notified` record) across syncs.

Canonical fields for a merged item:
- `url`: precedence Gradescope > PrairieLearn > PrairieTest > site > Canvas. The link
  should go where the student actually submits.
- `dueAt`: same precedence, because the submission system is the source of truth
  for its own deadline. Canvas dates set by LTI sync are copies.
- `status`: the "most done" of the members: `graded` > `submitted` > `not_submitted`
  > `missing` > `unknown`. Rationale: if Gradescope says submitted and Canvas hasn't
  synced yet, the student did submit.
- `title`: the longest member title (usually the most descriptive).
- `courseLabel`: Canvas `course_code` if present, else the shortest `courseRaw`.

Known limitations:
- The threshold will produce false merges on courses with many similarly named items
  (`Quiz 1` / `Quiz 10` share tokens `quiz` only if number stripping is wrong; the
  rule keeps numbers attached so `quiz1` ≠ `quiz10`). Weekly "Lab 3" in Canvas vs
  "Lab 3 Report" in Gradescope due a day apart will merge, which is correct.
- False merges are visible: the row shows two source icons. The user's fix is one
  click ("split"), stored in `splitKeys`. Gate 3 (§9) measures how often this is
  needed; if it's more than a couple per semester on real data, raise the threshold
  before launch.

### 5.4 Retention

Purge raw items whose `dueAt` is more than 60 days past, and undated items not seen
in the last 3 syncs (they were removed at the source). Overrides referencing purged
keys are dropped.

---

## 6. Sync loop

```
runSync(trigger):
  if trigger == "popup" and lastSyncAt within 5 min: return
  registry = maybeRefreshRegistry()           // once per day, non-blocking on failure
  for each source with enabled && not in backoff:
    try:
      plan = source.plan()
      pages = fetchAll(plan)                   // concurrency 4/host, 20 s timeout
      for page: if source.isLoginPage(page): mark needs_login; break
      raw = parseAll(pages)                    // via offscreen document
      replace this source's raw items in store (atomic per source)
      mark ok
    catch ParseError: mark parse_error(message), backoff
    catch NetworkError: mark network_error, backoff
  items = dedupe(allRaw, overrides)
  store.items = items
  scheduleNotifications(items)
  lastSyncAt = now
```

- Alarm: `chrome.alarms.create("sync", { periodInMinutes: settings.pollMinutes })`
  and on `runtime.onInstalled` / `onStartup`. Chrome throttles alarms while idle;
  that's fine.
- A failing source never blocks the others. Replacement is per source, so a
  Gradescope outage doesn't wipe Canvas items.
- The popup triggers `runSync("popup")` on open (debounced by the 5-minute rule) so
  the list is fresh when it matters.

---

## 7. Notifications

- For each item that is dated, not hidden, not `submitted`/`graded`, and not a
  `booking`: fire at `dueAt − 24h` and `dueAt − 2h` if enabled, once each, recorded in
  `item.notified`. Use `chrome.alarms` with one alarm per (item, lead) named
  `notify:{itemId}:{lead}`; alarms survive worker restarts.
- For `booking` items: one notification per day at 10:00 local until the item
  disappears (i.e. the student booked). Recorded as `notified.booking`.
- Quiet hours (default 23:00–08:00): notifications that would fire inside the window
  are deferred to the window's end. A 2-hour lead for an 11:59 PM deadline fires at
  9:59 PM, which is outside the window, so the common case is unaffected.
- Clicking a notification opens `item.url`.
- Chrome only fires while running. If Chrome was closed at fire time, the alarm fires
  on next start if the deadline hasn't passed; if it has, skip and mark as missed so
  it doesn't fire stale.

Limitation: a sync cadence of 30 minutes means "2 hours before" is really "between 1.5
and 2 hours before" if the item was only just discovered. Acceptable.

---

## 8. UI

### 8.1 Popup (`popup.html`)

A single scrolling list, width 400px, max height 600px. Sections in order, each
collapsible, empty sections hidden:

1. **Needs attention** — `booking` items, and overdue unsubmitted items (past due,
   ≤ 7 days ago).
2. **Today**
3. **Tomorrow**
4. **This week** (through Sunday)
5. **Later** (next 60 days)

Row: `[course chip] Title …………………… [source icons] [due: "Thu 11:59 PM · in 2d"]`
Clicking the row opens `url` in a new tab. A row menu (⋯) offers: Hide, Split (if
merged), Merge with… (opens a picker of same-course items), Add to Google Calendar.

Header bar: sync status per source as small dots (green ok / yellow needs login /
red error) with a tooltip showing `lastSuccessAt` and `lastError`; clicking a yellow
dot opens that source's login page. A "sync now" button. A "⤢ open full view" link
that opens the same UI in a tab (popups close on focus loss, which is annoying when
you're cross-checking against a course page).

Footer: "Download .ics" and a settings gear.

Rendering rules (security): all text from sources is inserted with `textContent`,
never `innerHTML`. URLs are only rendered if they parse as `https:` on one of the
known hosts or the adapter's host.

### 8.2 Options page

- Sources: enable/disable each; show status; "log in" links.
- Courses: checkbox list of every course seen across sources (keyed by `courseCode`
  or `courseRaw`), so old-term Gradescope courses can be turned off.
- Course-site adapters: list from the registry filtered to the current term, each
  with an Enable toggle that requests the host permission.
- Reminders: lead-time checkboxes, quiet hours, poll interval (15–120 min).
- Data: "Export JSON", "Reset everything", and the **Report a broken page** flow:
  the user pastes the URL of the page that isn't parsing; the extension fetches it,
  scrubs obvious PII (email addresses, the student's name if known from Canvas),
  and offers it as a download the user can attach to a GitHub issue. Nothing is
  sent automatically.
- Privacy note in plain language: what is fetched, that nothing leaves the browser,
  link to the privacy policy.

### 8.3 Calendar export

- Per item: a Google Calendar template link
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…`
  with the due instant as a 15-minute event ending at `dueAt`. No OAuth required.
- Bulk: generate an `.ics` (RFC 5545) of all visible items and trigger a download.
  Importing an `.ics` into Google Calendar is a one-time copy, not a subscription;
  say so in the UI. Real sync is v1.1 after OAuth verification.

---

## 9. Gates (in order; do not proceed past a failed gate)

| Gate | Passes when |
|---|---|
| **G0 Auth fetch** | From the service worker, the authenticated home page of all four hosted sources returns logged-in HTML/JSON with `credentials: "include"`. Document the result per host. |
| **G1 Fixtures + parsers** | Scrubbed fixtures captured for every page type (dashboard + course page per source, PrairieTest with and without reservation). Parser tests pass on all fixtures with expected outputs written by hand. A fixture with the table removed makes the parser throw. |
| **G2 Recall** | End-to-end sync on your own account. Manually list every deadline visible on every source for the next 3 weeks; the extension's list contains all of them (recall 100%). Precision: no phantom items. |
| **G3 Dedupe** | On the same data, auto-merge produces the right groups with ≤ 2 manual corrections. If more, tune §5.3 and re-run. |
| **G4 Beta** | 10 users across ≥ 3 majors for 1 week. Zero data-loss bugs, every parse error surfaced in the UI (not silent), and ≥ 7 of 10 say they'd keep it installed. Collect their broken-page reports; fix or document. |
| **G5 Store** | Privacy policy published (GitHub Pages), permission justifications written, listing screenshots, submitted. Review typically takes days. |

---

## 10. Build order for Claude Code

1. Repo scaffold, manifest, esbuild, a no-op service worker, empty popup. Load
   unpacked. (Half a day.)
2. **G0 spike**: a debug button in the popup that fetches each source's home page
   and logs status + first 500 chars. Decide fallback need.
3. Offscreen document plumbing: `parseHtml(source, html) → RawItem[]` round-trip
   with a trivial parser.
4. Fixture capture script: a page in the options UI that fetches a URL you type and
   downloads the HTML, plus a scrub step. Capture everything in §9 G1.
5. Canvas module (JSON; easiest, no offscreen needed). Tests against saved JSON.
6. Gradescope parser + tests. Then PrairieLearn. Then PrairieTest.
7. `normalize.ts` + `dedupe.ts` with table-driven tests from real titles.
8. Store + sync loop + per-source status. Popup list (ugly). **G2, G3.**
9. Notifications + quiet hours.
10. Options page, overrides UI, `.ics` + calendar links.
11. Adapter runner + registry fetch + 2 seed adapters + optional permissions.
12. Broken-page report flow, privacy policy, store assets. **G4, G5.**

Estimated effort: 3 weeks at 10–15 hours/week, most of it in steps 4–8.

---

## 11. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cookie-auth fetch blocked on some host | Low–medium | G0 first; content-script fallback designed in §2.2 |
| Gradescope/PrairieLearn redesign breaks parser | Medium per semester | Header-based column detection; loud failures; fixtures; "report broken page"; fix fast with a store update (parsers are code, so they do need review) |
| Course site structure changes | High, every term | Adapters are remote data; fix without review; adapters carry a `term` and expire |
| False merges annoy users | Medium | Visible source icons; one-click split; G3 threshold tuning |
| Silent missing deadline | Catastrophic if it happens | Rule 3 (fail loudly), per-source health dots, G2 recall test |
| Store review rejects for permissions | Low | Minimal permissions; optional host permissions; single-purpose listing text |
| Gradescope objects to automated access | Low at this scale | Own-session, own-pages, low rate; stop if asked; not legal advice, just the posture |
| Launch lands with nobody using it | Medium | Beta first; launch timed to first midterm wave; ask course staff to pin it |

---

## 12. Open questions

Resolved 2026-09-02: hostnames (§2.3); cookie fetch works from page context on all
four sources (§2.2); Gradescope lists the current term first (§4.2); Gradescope row
DOM and `datetime` format (§4.2, §3.2); PrairieLearn assessments layout, credit
string format, and the full access-details schedule in the `?` popover (§4.3);
PrairieTest booked-exam card, available-for-reservations card, and the empty
reservations-card text (§4.4).

Still open:

1. Whether the PrairieLearn access-details table is present in the **fetched** HTML
   (as a `data-bs-content` attribute on the `?` button) or only built after a click
   (§4.3). Save the assessments page as HTML and search for `Access details`.
2. Whether the PrairieTest available-card row links to the exam or only has the
   button (§4.4). Decides title-text vs id matching for the both-cards rule.
3. The extension-context half of Gate 0 (§2.2), done in build step 2.
4. PrairieLearn credit-string and schedule shapes across your other courses (the
   regexes in §4.3 are built from one course).
5. Whether any of your courses this term use Moodle or a client-rendered site
   (§1 out-of-scope table, §4.5 limitation).

---

## Appendix A — Fixture scrubbing

Before committing any fixture: replace your name, NetID, email, and any student IDs
with `STUDENT`, `netid`, `student@illinois.edu`, `000000000`. Keep course names,
assignment names, and dates real; those are what the parsers depend on. Fixtures are
small HTML files, fine to commit.

## Appendix B — Privacy policy (draft text)

> Illini Dash runs entirely in your browser. It reads assignment and exam information
> from Canvas, Gradescope, PrairieLearn, PrairieTest, and course websites you
> explicitly enable, using the login sessions already in your browser. It never sees
> or stores your password. All data is stored locally in your browser's extension
> storage and is never transmitted to the developer or any third party. The
> extension makes one network request to GitHub once a day to update its list of
> supported course websites; that request contains no personal data. Uninstalling
> the extension deletes all stored data.
