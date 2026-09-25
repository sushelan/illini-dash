# Roadmap ideas — what is missing, ranked

Written 2026-09-10, the day of the first live sync. Steps 1–12 are done and G0–G3 have
passed (see PROGRESS.md); this document answers "what tools are extremely helpful or needed
that aren't implemented already", and turns the answer into the checklist for getting to a
trustworthy G4 beta and past it.

## Status — checked against the code, 2026-09-25

The ideas below were written on 2026-09-10. Each entry's **In the code today** field, the
checklist marks and the appendix's status column now say what the code does as of
2026-09-25 (1.3.1), judged feature by feature. Only I37 was ever cited by id in PROGRESS.md.

| Tier | Done | Partial | Not done |
|---|---|---|---|
| 0a (20 ideas) | 20 | – | – |
| 0b (6 ideas) | 3, plus the registry URL and the course-site adapters | – | 3: I82, I44, I46 |
| 1 (40) | 4 | 14 | 22 |
| 2 (20) | 2 | 2 | 16 |

G4 has not run.

Shipped, and on none of these lists: Piazza as a polled announcement feed; the Campuswire
observer (a content script, opt-in); deadlines proposed from posts, with accept and reject;
the on-device model adapter author; the Exams tab (PrairieTest bookings, Canvas quizzes,
typed exams); the popup redesign with Today/Week/Month/Alerts/Exams tabs, themes and a light
mode; the full view in its own tab; and the published Chrome Web Store listing (unlisted).

## How this list was made

Ten idea-finders, each with one lens (other UIUC systems, daily workflow, trust, notifications,
Chrome platform, integrations, beta onboarding, adapter growth, prior art, grades and workload),
read this repo and produced 116 raw ideas. A merge step folded them into 88 distinct ones. Each
of the 88 was then (a) **audited against the code** — a second agent read the real files and
recorded whether the feature is missing or partial, what it touches, and which CLAUDE.md house
rules it is likely to trip — and (b) **attacked by a skeptic** told to refute it, who scored
student value and MV3 feasibility 1–5 and said when to build it relative to the beta. Claims
behind the top-ranked items were then spot-checked by hand against the source. **None of the 88
turned out to be already implemented.** Verdicts and scores are recorded per idea below; they
are leads with evidence, not decisions.

Three ideas that finders proposed were pure restatements of gaps already listed in PROGRESS.md
"Next" and were folded into the entries here rather than dropped.

## What the gaps have in common

On 2026-09-10 there were five common threads. Tier 0a closed four of them.

1. **The parsers captured far more than the UI showed.** Exam room and duration, release
   times, the PrairieLearn credit ladder, the not-for-credit flag and the assumed-time flag now
   reach the row, the detail screen or the toast (I02, I07, I36, I62, I06). What is still
   captured and unused is narrower: exam location in the .ics (I02) and the late window in the
   calendar export (I66).
2. **Health was honest only inside the popup.** Closed by I17, I16 and I03: grey until a
   source has succeeded, a status line derived from attempts (`core/health.ts`), and a toolbar
   badge. Worker house rule 2 records how.
3. **The system had no notion of change over time.** Closed by I01: moved and new markers,
   and fired reminders re-armed when the stated instant moves. A per-sync change log (I19) is
   still missing.
4. **Two sources could never say "done".** Closed by I08, the local Done check-off. I37's
   partial-score rule is only partly done.
5. **Growth is gated on captures from a logged-in browser.** Still true. Public course pages
   no longer need one, because the proposer and the registry take any https URL, but every
   new signed-in source in Tier 2 still starts with a fixture only Sushi or a tester can
   produce.

## The checklist, in priority order

Tier 0a needs nothing from Sushi and can start now. Tier 0b needs a capture, a decision or a
tester. Tier 1 is after the beta. Tier 2 needs a §0/§1 decision or a new permission first.

### Tier 0a — make what exists trustworthy (before any tester)

> **All 13 items landed 2026-09-10** (commits `Tier 0a.1` … `Tier 0a.13`). 388 → 546
> tests. See PROGRESS.md for the summary table.


1. **Health that never lies** — grey dots until a source has succeeded once; status line
   "Checked 10:32 · 3 of 4 OK" plus a stale-source banner; toolbar badge with today's count and
   a red `!` on any failing source. (I17, I16, I03)
2. **Reminder plumbing** — detect Chrome's notification-denied level and offer a test reminder;
   coalesce catch-up bursts after Chrome was closed and word the title by real remaining time.
   (I27, I38)
3. **Moved deadlines** — re-arm fired leads when the *stated* due instant changes; then a
   "moved Thu → Sat" / NEW marker and an optional toast. (I01)
4. **Late and reduced-credit windows stay live** — amber row, "late until Wed 5 PM · 6d left"
   or "80% until Sep 22", stays listed until `lateDueAt`, gets its own leads; fold in the
   pre-deadline "then 80% until" wording. (I04, I07)
5. **Assumed times, end to end** — popup wording and sort, all-day calendar export, morning
   toast instead of a 2-hour countdown. (I06, I22, I41)
6. **Local Done check-off**, separate from Hide, pruned like `hiddenKeys`, with a rule for a
   source later saying `missing`. (I08)
7. **Not-for-credit demotion** — practice chip, sort last, reminders off by default. §4.3
   already requires it. (I62)
8. **Surface unparsed rows** — a "Couldn't read" group so a row kept under house rule 1 is not
   invisible. (I31)
9. **Settings page hygiene** — retitle from "debug", move developer tools behind a disclosure,
   collapse the duplicate "Course websites" control. (I43)
10. **Lift backoff on extension update** so a shipped fix turns the dot green at once. (I59)
11. **Adapter date grammar** — weekday prefixes, `at`/`@`, 24-hour times, and never record a
    stated time as assumed because the tail was ignored. Needed before adapters two and three.
    (I49)
12. **Versioned store migrations, cheap half** — a `schemaVersion` switch, positive validation
    of `raw`/`items`, a committed v1 snapshot test. (I54)
13. **Beta instruments** — one-click scrubbed diagnostics bundle; right-click "Report this
    page". (I30, I61)

### Tier 0b — beta prerequisites that need Sushi

14. **Git remote and registry URL** — push the repo and point `src/core/registry.ts` at it, or
    the daily adapter refresh stays dead. (not an idea id; from `docs/store/listing.md`)
    **Done 2026-09-10.**
15. **Beta install kit** — `npm run package` zip plus a one-page tester guide with the
    reload-and-check-build-id step. (I55) **Done.**
16. **Adapters two and three** — from captures of course sites the testers are actually in.
    Public course pages can be fetched without a login; Shibboleth-protected ones need the
    options-page capture tool. **Done**: the registry ships CS 424, ECE 310, ECE 391, ECE 411,
    CS 425, CS 374 A and CS 341.
17. **Canvas concluded-course filter** via `include[]=term`, with an "Older courses" group.
    Needs one capture. (I45) **Done.**
18. **Non-CS tester's first look** — name the publisher host behind undated external-tool rows
    ("MCB 150 · 14 items in McGraw Hill Connect"), then a collapsed Canvas "No date" section
    with the LTI-shell explanation. (I82 stage 1, I44)
19. **"Not used by you" for PrairieLearn / PrairieTest** — cheap half now (friendlier wording,
    one-click turn-off); the positive empty marker waits for a capture from a student without
    PL courses. (I46)
20. **First-run page, minimal** — open Settings on install with per-source login state; the
    per-course "what I found" table can wait for beta feedback. (I05) **Done**: install opens
    the setup screen in the full view.
21. **Run G4** — ten testers across three or more majors for a week; collect broken-page
    reports; this is also what measures the §5.3 badge-token trade G3 could not.

### Tier 1 — highest value after the beta, no spec change
Ordered by skeptic value, then how many lenses proposed it, then effort. Full entries below.


- I13 · Reminder toasts with Open / Snooze / Done buttons, requireInteraction for the 2h lead (M)
- I21 · Manual deadlines as a sixth 'manual' source (M) — **done**
- I24 · Registrar deadlines (drop, CR/NC, refund) as shipped campus rows (M)
- I60 · Page-aware popup: this course first, focus existing tab, auto-resync after login (M)
- I25 · Final exam time and room from Course Explorer (L)
- I02 · Exam-day card on PrairieTest rows (room, duration, format) in row, toast and calendar (M) — **done**
- I09 · Per-course coverage table with 'request an adapter' flow (M) — **partial**
- I10 · Side panel view of the same list (S)
- I11 · Search box and click-a-chip course filter (S)
- I14 · Done / Graded-recently section with score chips and per-source confirmation (L) — **partial**
- I34 · Calendar dates past this week and day headings inside Later (S)
- I66 · Calendar export carries late and reduced-credit deadlines (S)
- I67 · 'Add to Outlook' deep link (S)
- I18 · Custom lead times, per-kind leads, per-course mute (M) — **partial**
- I19 · Per-sync change log strip ('2 new · 1 moved · 1 gone') (M)
- I26 · Morning digest at the end of quiet hours (M)
- I32 · Show when merged members disagree on due date or status (M) — **partial**
- I33 · Snooze / 'not today' defer on a row (M)
- I35 · Keyboard shortcut, arrow navigation, real links (M) — **done**
- I36 · 'Opens Thu 9 AM': surface release times, dim not-yet-open rows, remind on open (M) — **partial**
- I37 · A partial PrairieLearn score is not 'done' (M) — **partial**
- I40 · CBTF reservation-window escalation and missed-reservation notice (M) — **partial**
- I47 · Per-adapter health state and N->0 guard per course site (M)
- I48 · Header-anchored adapter columns and 'Due'-header autodetect (M) — **done**
- I51 · In-options adapter workbench with 'Propose this adapter' bundle (M) — **partial**
- I64 · This-week workload strip per course (M)
- I71 · 'Why is this here / why isn't X here' merge-reason explainer (M)
- I73 · 30-minute 'last call' only when the source still says not submitted (M)
- I50 · Adapter row-context fields (rowspan carry-forward, ancestor title, per-column kind, recurring rules) (L) — **partial**
- I12 · Per-row Details panel: provenance and what each parser extracted (S) — **partial**
- I20 · Collapsible sections that remember their state (S)
- I56 · Adapter linting and golden tests in CI (S) — **partial**
- I68 · Copy this week as Markdown / plain text (S)
- I23 · Stable .ics UID across merges plus SEQUENCE (M) — **partial**
- I28 · Keep reminders working past Chrome's 500-alarm cap (M)
- I29 · Import JSON (restore corrections / load a snapshot) (M)
- I57 · Term rollover: term dates in the registry, Expired section, fa26->sp27 carry-over (M) — **partial**
- I72 · Override audit with loss notices (M) — **partial**
- I78 · Recent Canvas announcements panel, deliberately unparsed (M)
- I84 · University Housing and dining deadlines from the public campus .ics feed (M)


### Tier 2 — bigger bets, or need a decision first
See "Decisions only Sushi can make" below. Compact entries further down.


- I42 · Google Calendar sync via chrome.identity (v1.1 row, brought forward as opt-in beta) (L) — **done**
- I53 · Sync settings and overrides across Chrome profiles via storage.sync (items stay local) (M)
- I70 · Subscribable .ics feed published to the student's own Google Drive (L)
- I76 · Content script writing real due dates onto Canvas's dateless LTI rows (L)
- I77 · On-page 'Upcoming across everything' strip on the four sites' home pages (M)
- I52 · Point-and-click selector picker on the live course page (L)
- I87 · renders:'client' flag plus visit-time content-script fallback (L)
- I83 · Moodle (learn.illinois.edu): enrolment probe, then a timeline adapter if testers hit it (M)
- I81 · smartPhysics prelectures and checkpoints (PHYS 211-214) (M) — **done**
- I85 · Queue @ Illinois: 'office hours open now' on the course row (M)
- I80 · Section seat-status watch for registration season (M)
- I79 · Spring 2027 registration dates and personal time ticket (L)
- I65 · Canvas current score on the course chip (M)
- I58 · Course colours on the chip from the student's Canvas colours (M) — **partial**
- I15 · Week grid in the full view, with a printable week (L) — **partial**
- I63 · Credit-at-stake ordering within a day (M)
- I69 · Per-course .ics files with a calendar name (S)
- I74 · Hold catch-up reminders while the screen is locked (S)
- I75 · Omnibox keyword 'due <course>' (M)
- I39 · Reminder inbox with missed reminders and unread badge (M)


### G5 — store (after G4, per §9)
Privacy policy at a public URL (GitHub Pages), the four listing screenshots, version bump,
confirm the registry URL, submit. Permission justifications are already written in
`docs/store/listing.md`.

## Decisions only Sushi can make

1. **Google Calendar OAuth sync (I42)** — **decided: shipped as opt-in**, live 2026-09-18,
   under the `calendar.app.created` scope. The privacy policy was rewritten for it.
2. **Is §0 decision 1 negotiable in wording?** Settings and overrides via `chrome.storage.sync`
   (I53) and a subscribable feed on the student's own Drive (I70) both work technically and
   both break "nothing leaves the browser" as written.
3. **Content scripts on host pages, yes or no in principle?** Writing real dates onto Canvas's
   dateless LTI rows (I76), an upcoming strip on the four home pages (I77), a selector picker
   (I52), a client-rendered-site fallback (I87). All add `scripting`/`activeTab` and change the
   privacy story from "reads" to "modifies". **Half decided:** `scripting` shipped for the
   opt-in Campuswire observer, which reads a page and modifies nothing. None of these four is
   built, and "modifies" is still open.
4. **Manual deadline entry (I21)** — **decided: shipped** (quick add and the editor).
5. **Campus rows without a course** — registrar deadlines (I24) and final exam times (I25) are
   public and verified live, but a course-less row is a scope expansion from "course deadlines".
6. **Snooze (I33)** amends §7's "booking nag fires daily until the item disappears".

## What Sushi has to do, in order

Each item is one browser action or one decision; the literal thing to report is in brackets.

Items 1–5 are done; 6 is half done; 7 is still waiting on testers.

1. ~~Say go on Tier 0a.~~ **Done**: all of Tier 0a landed 2026-09-10.
2. ~~Create the GitHub remote and push.~~ **Done 2026-09-10:** https://github.com/sushelan/illini-dash
3. ~~Capture Canvas courses with the term included.~~ **Done**: the concluded-course filter
   (I45) shipped on it.
4. ~~Name the courses your first testers are in.~~ **Done**: nine registry entries across
   seven courses.
5. ~~Load each Tier 0a build and report the worker console.~~ **Done**, and superseded by the
   beta and the store build.
6. **Decide the open questions above**: 2, 5 and 6 are still open; 1 and 4 are decided; 3 is
   half decided.
7. **Later, when testers exist:** a PrairieLearn home page from a student with no PL courses
   and a PrairieTest home from a student with no CBTF exams (PROGRESS.md's open VERIFY); one
   graded Gradescope course page (for score chips, Tier 1); a check that the Outlook deep link
   opens under the campus tenant (I67).

---

## Tier 0a and 0b — full entries


### I17 · Health-aware popup empty state; no green dot before a source has succeeded
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

When the list is empty, the popup says why: 'Gradescope and PrairieLearn need you to log in' with buttons, or 'Canvas found 3 courses but none of their assignments has a due date', or 'Still fetching…' during the first sync. Separately, a source whose `lastSuccessAt` is unset renders grey ('not checked yet'), not green, and 'Sync now' shows progress instead of leaving 'Not synced yet.' on screen for 20 seconds.

- *Why:* Right now a fresh install shows four green dots and 'Not synced yet.' — green before a single fetch has happened, which is exactly the 'green means I did not fetch' failure the worker house rules already call out.
- *Touches:* src/core/status.ts (or store.ts) emptyStateFor()+pending rule; types.ts SourceState if adding 'pending'; store.ts defaultStatus; background.ts:466; popup.ts render/renderDots; popup.css .dot-pending…
- *House-rule hazards:* Worker rule 2 is exactly this (fix 7ede6dc covered only `site`). Worker rule 6: find tests asserting fresh-store `state: "ok"` before changing defaultStatus.
- *Audit correction:* Idea cites `src/core/grouping.ts`; the file is `src/ui/grouping.ts`. '20 seconds' is REQUEST_TIMEOUT_MS per request (sync.ts:28); a first sync over 4 sources can run longer.
- *Strongest objection:* The popup fires a sync on open, so the green-before-fetch window is seconds unless a source fails; after that the dots are real.

### I16 · Honest status line and stale-data banner
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Replace the popup's status line — which today reads "Synced 10:32 AM" whenever the loop ran, even if all four sources failed — with "Checked 10:32 AM · 3 of 4 sources OK". When any enabled source's lastSuccessAt is older than N hours (or never), show a banner: "Gradescope hasn't been read successfully since Tue 9:14 AM (2d). Its 5 rows may be out of date. [Log in]". Rows from that source get a muted 'stale' glyph.

- *Why:* Gradescope sessions expire every couple of weeks (§4.2) and the source keeps its old rows on failure by design (sync.ts:428-430), so the list keeps looking healthy while any Gradescope deadline posted after the expiry is silently absent…
- *Touches:* New src/core/status.ts (staleness + 'n of m OK' pure fns, tests); popup.html/popup.css banner; popup.ts renderDots/status; background.ts sync() calls chrome.action.setBadgeText after saveStore…
- *House-rule hazards:* Worker rule 1: badge text/colour decided in core, worker only calls setBadge. Worker rule 2: 'n of m OK' must exclude disabled/unconfigured (site) from both counts and never count a resting/backoff…
- *Strongest objection:* Dots already encode state and click through to login (spec §8.1); a banner spends popup height on the same fact.

### I03 · Toolbar badge: today's count, red '!' when a source is broken
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 3

The Illini Dash icon shows a number (items in Needs attention + Today) and turns red with '!' the moment any enabled source is needs_login / parse_error / network_error, with the tooltip carrying the lastError. The student sees 'PT needs login' or '3 due today' from the toolbar without opening anything; today every health dot only exists inside the popup.

- *Why:* §0 rule 3 says fail loudly, but the only place a red or yellow dot renders is popup.ts renderDots, which runs when the popup is open. The first live run (PROGRESS.md 'site: ok (0 items)') cost two rounds because nobody was looking at the dots.
- *Touches:* new core/badge.ts (pure badgeFor over groupItems from ui/grouping.ts), background.ts (setBadgeText/BackgroundColor/Title after sync(), mutate(), applySettings(), fireNotification()…
- *House-rule hazards:* W1 whole decision in core/badge.ts; worker only calls chrome.action. W2 a disabled/backoff/needs_login source must not sit under a calm count — failure outranks any number…
- *Audit correction:* 'popup.ts renderDots is the sole health surface' is wrong: options.ts:474-482 shows per-source state + lastError + a 'log in' link. Still nothing outside an extension page, so the verdict stands.
- *Strongest objection:* Chrome leaves new extensions unpinned, so the badge is invisible to exactly the tester who never opens the popup.
- *Proposed by:* beta-onboarding, chrome-platform, daily-workflow

### I27 · 'Can reminders reach you?' check and send-test-reminder button
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Options → Reminders (and the popup status line) shows a red 'Reminders are blocked in Chrome' when the extension's notification level is denied, updates live if it changes, and offers a 'Send a test reminder' button that walks the real fireNotification path. Turns a silent no-op into a visible state.

- *Why:* One click on 'Turn off notifications from Illini Dash' in any toast (or a Chrome site-settings block) sets the extension's permission level to denied; from then on every 24h/2h/booking reminder is created and dropped…
- *Touches:* background.ts (getPermissionLevel in get-state/get-options-state, onPermissionLevelChanged, a 'test-notification' message that skips the stamp), messages.ts Request/Response…
- *House-rule hazards:* Worker rule 2 is the motive: 'denied' must be its own colour, never green. Worker rule 1: the denied-stamp decision goes in core with a test; the worker only reads the level.
- *Audit correction:* Minor: the Reminders section also carries 'Hide submitted and graded work' (options.ts:585-593) and the poll interval is not rendered there. Otherwise accurate.
- *Strongest objection:* getPermissionLevel reflects only Chrome's per-extension flag; the common campus case is macOS Focus or Chrome lacking System Settings permission, which it cannot see.

### I38 · Coalesce catch-up reminder bursts and word them by real remaining time
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

When Chrome starts after being closed, or right after install, collapse all overdue leads for one item into a single toast worded from the actual time left ("due in 40 min", not "due tomorrow"), and when more than three items are overdue at once send one list toast ("5 reminders you missed while Chrome was closed") instead of five individual ones.

- *Why:* Concrete trace of today's code: laptop closed since Tuesday, opened Thursday 08:30 with CS 357 HW3 due 09:00 — planNotifications marks both the 24h and 2h leads overdue, reschedule fires both, and the 24h one is titled "CS357…
- *Touches:* src/core/schedule.ts planNotifications (collapse per item, burst flag) + notificationContent wording; src/background.ts reschedule (one `type:"list"` toast; onClicked mapping for a list id…
- *House-rule hazards:* Worker 1: collapse/burst decisions in core, worker only emits. Worker 3: marking a never-fired 24h lead as 'fired' invents a value — record it as superseded.
- *Audit correction:* Accurate. Nuance: the message body is already worded from real remaining time (schedule.ts:190-195,219); only the title is lead-keyed.
- *Strongest objection:* Install burst is bounded by items due in the next 24h (typically 1-4, not 6-10), and macOS stacks Chrome toasts anyway.

### I01 · Deadline moved / new item markers, notification, and reminder re-arm
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 4/5, keep, before_beta · **Lenses** 3

Each sync diffs items against the previous store. A new item carries a NEW dot for 24 hours; a moved deadline shows "moved Thu → Sat" for a few days and fires one notification ("CS 424 HW1 moved to Sat 11:59 PM"); a moved deadline also clears the already-fired 24h/2h record so both reminders fire again for the new instant. An Options toggle turns the change notification off.

- *Why:* Per-student extensions in Gradescope and PL (SPEC §4.3: schedules can be per-student), mid-week edits to the CS 424 schedule page, and Canvas's LTI copy lagging Gradescope are routine.
- *Touches:* core/dedupe.ts (diff before vs rebuilt instants, drop fired leads), sources/types.ts Item (+changes/firstSeenAt), core/store.ts migrate, core/schedule.ts (+'changed' lead, parseAlarmName)…
- *House-rule hazards:* W1 keep the diff in core, not background. W3 a timeAssumed 23:59 flipping to a stated time, or precedence switching members, reads as a 'move' — compare stated instants only.
- *Audit correction:* 'grep changed in sync.ts hits only comments' — sync.ts has no hit; the 'a deadline that moved' comment is background.ts:219. Otherwise accurate.
- *Strongest objection:* Item.id is a hash of member keys, so every merge, split, adapter enable or Canvas due_at appearing over a timeAssumed 23:59 re-ids or re-ranks the group and would read as NEW/moved.
- *Proposed by:* notifications, prior-art, trust-transparency

### I04 · Late / reduced-credit window stays live after dueAt, with reminders on lateDueAt
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 4/5, keep, before_beta · **Lenses** 3

When the full-credit deadline has passed but a late / reduced-credit deadline is still ahead, the row turns amber instead of red and reads "late until Wed 5:00 PM · 6d left" (Gradescope) or "80% until Sep 22" (PrairieLearn), stays in the list until lateDueAt rather than falling out 7 days after dueAt, and gets its own 24h/2h reminder: "PHYS435 — late window closes in 2 hours".

- *Why:* PHYS 435 Homework 2 is due Wed Sep 9 5 PM and Gradescope accepts it until Sep 16 5 PM. On Sep 10 the popup says "Wed 5:00 PM · 1d ago" and plans no reminder for Sep 16.
- *Touches:* ui/grouping.ts (sectionFor/formatDue late branch), popup.css amber class, core/schedule.ts (late24h/late2h leads, parseAlarmName regex, notificationContent wording)…
- *House-rule hazards:* W6 schedule.test.ts:131 'never fires stale once the deadline has passed' and grouping.test.ts:194 '2d ago' pin today's behaviour; rewrite quoting §4.3.
- *Strongest objection:* A student who missed a deadline usually knows it, and Gradescope/PL print the late window on the page the row already opens.
- *Proposed by:* grades-workload, notifications, prior-art

### I07 · Reduced-credit ladder and late window shown before the deadline passes
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, defer, v1.1 · **Lenses** 2

A PrairieLearn row's due cell shows the next step of its credit schedule, not just one instant: "100% until Tue 11:00 AM · then 80% until Sep 22", with the full ladder (100 → 80 → 50 → 0, each with its end) in the row tooltip. Once the 100% step has passed the row reads "80% until Sep 22 · 12d left" instead of "Tue 11:00 AM · 2d ago".

- *Why:* CS 357 (and every PL course with 100 → 80 → 50 ladders) makes the student's real decision "is L4a still worth doing at 80%?".
- *Touches:* new core/credit.ts (nextTier/ladder over creditSchedule JSON), ui/grouping.ts formatDue, ui/popup.ts renderRow (muted second line / title tooltip) + popup.css, core/ics.ts DESCRIPTION…
- *House-rule hazards:* P1/P5 JSON.parse in the UI must never throw; validate each tier positively (integer credit 0-100, end passes isInstant, end absent on the 0 tier). W3 don't invent a close from a missing end.
- *Strongest objection:* Same rows, same defect as I04: the only line a student acts on is '80% until Sep 22', which is I04's wording. The full ladder is in PL's own popover on the page the row opens.
- *Proposed by:* daily-workflow, grades-workload

### I06 · Show runner-assumed 23:59 times as assumed (popup, sort order, calendar export)
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 2

When the member whose dueAt won carries `extra.timeAssumed === "true"`, render "Fri Sep 18 · by end of day (no time given on the course site)" instead of "Fri 11:59 PM", sort it after stated times on the same day, and in the .ics / Google Calendar link emit an all-day event (DTSTART;VALUE=DATE) or a description note rather than a hard 23:59 event.

- *Why:* PROGRESS.md already names this: every CS 424 row reads 11:59 PM although the course schedule prints only a date, and a tester will miss a 5 PM cutoff trusting it.
- *Touches:* core/dedupe.ts buildItem (+timeAssumed on Item from the chosen member) and sortItems tie-break, sources/types.ts Item, ui/grouping.ts formatDue, ui/popup.ts tooltip…
- *House-rule hazards:* W3 this is rule 3's follow-through: every dueAt consumer must check the flag, including schedule.ts — a 2h lead on an invented 23:59 fires at 9:59 PM for a cutoff that may have been 5 PM.
- *Audit correction:* Sorting lives in core/dedupe.ts sortItems:361-369, not grouping.ts; the 'sort after stated times' part touches dedupe.
- *Strongest objection:* Only one small course (CS 424) has an adapter, so few of the 10 testers will ever see an assumed time.
- *Proposed by:* daily-workflow, trust-transparency

### I22 · Honest .ics / calendar link (all-day for invented times, hideSubmitted, VALARM, footer button)
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

The .ics and the per-row 'Add to Google Calendar' link should export what the popup shows, the way the popup will soon show it: an item whose 23:59 the runner invented (`extra.timeAssumed`) becomes an all-day event (`DTSTART;VALUE=DATE`, and `dates=YYYYMMDD/YYYYMMDD+1` in the TEMPLATE link) with 'time not stated by the course site' in the description; graded/submitted rows are skipped when hideSubmitted is on…

- *Why:* PROGRESS.md's own top item for G4 is 'the popup shows invented times as fact' — the calendar export makes that worse, because a calendar entry at 11:59 PM looks even more authoritative than a list row.
- *Touches:* core/ics.ts (event(), googleCalendarUrl take settings + flag), core/dedupe.ts buildItem (+Item.timeAssumed), sources/types.ts, ui/grouping.ts exportable predicate → core/, ui/options.ts:700-705…
- *House-rule hazards:* Worker rule 3 is the whole idea, and the flag must track dedupe's chosen member, not any member. Parser rule 5/6: compare `=== "true"` exactly.
- *Audit correction:* `members.some(timeAssumed)` is wrong for merged rows: dedupe.ts:229-231 picks the first *stated* member's dueAt, so CS424 HW1 (Canvas stated + site assumed) has a real time yet would export all-day.
- *Strongest objection:* The .ics is a low-use, one-shot export; Google ignores VALARM and applies its own defaults, and most testers will never re-import.

### I41 · Morning toast instead of '2h' lead for runner-invented times
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

For items whose only instant carries `extra.timeAssumed` (course-site rows with a bare date, e.g. every CS 424 row), replace the 2h lead with a morning toast at quiet-hours end: "CS 424 HW2 is due today — the course page gives no time; check it" — and never phrase an assumed 23:59 as a countdown. The 24h lead is reworded the same way.

- *Why:* PROGRESS.md already flags the popup displaying invented 11:59 PM as fact; the reminder side is worse. CS 424's schedule prints "HW1 Due" against a bare date; if the real cutoff is 5 PM, the extension's "due in 2 hours" fires at 9:59 PM…
- *Touches:* src/core/schedule.ts (assumed-time detection, dayof plan, wording), Lead union + parseAlarmName, types.ts:79 notified type, tests/schedule.test.ts via fixtures/sites cs424 + site.ts…
- *House-rule hazards:* Worker 3 is this rule. Worker 6: schedule.test.ts:235 pins 'CS357 — due tomorrow'.
- *Audit correction:* Accurate. No Item-level field is strictly needed — members[].extra is already on Item — but provenance of the *chosen* dueAt is what matters…
- *Strongest objection:* Affects only members whose sole source is a site adapter (one adapter today); when Canvas or Gradescope also lists the item, dedupe.ts:230 already prefers the stated time.

### I08 · Local 'Done' check-off, separate from Hide
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 5/5, feasibility 5/5, keep, before_beta · **Lenses** 2

A checkbox (or ⋯ → "Mark done") on every row that the student controls, independent of what the source reports. A done row drops out of Today/This week exactly as a source-reported `submitted` row does today, stops its 24h/2h reminders, and is reachable under a collapsed "Done" section or an "undo" in the row menu rather than being buried in the options page's Hidden items.

- *Why:* Two of the five sources can never say "done": every course-site row is emitted with `status: "unknown"` (src/sources/site.ts:212) and Canvas LTI shells carry `submission_types: ["none"]` (fixtures/canvas/assignments-cs425.json), so CS 424 HW1…
- *Touches:* types.ts (Overrides.doneKeys), store.ts migrateOverrides, overrides.ts (doneItem/undoneItem), dedupe.ts (buildItem sets Item.done like `hidden`; applyRetention must prune doneKeys with hiddenKeys)…
- *House-rule hazards:* Worker 4: write via queued `mutate`. §5.4 pruning: doneKeys left unpruned repeat the hiddenItemIds defect.
- *Audit correction:* CS 425's `submission_types: ["none"]` is one dateless HW1; CS 357's 66 LTI shells are `external_tool` (docs/canvas-findings.md:41-45).
- *Strongest objection:* A local done flag ORed into isItemDone keeps a row hidden and un-reminded even if Gradescope later flips it to missing — a student-level silent empty.
- *Proposed by:* daily-workflow, prior-art

### I62 · Practice / not-for-credit tagging and demotion
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Rows whose PrairieLearn title says NOT FOR CREDIT, WILL NOT COUNT or extra credit get a small "practice" chip next to the course chip, sort last within their section, and a Reminders checkbox "Remind me about not-for-credit work" (default off) suppresses their 24h/2h notifications. The chip stays visible so a required-but-ungraded survey is not lost.

- *Why:* Half of CS 357's assessments page is not-for-credit (S1, PQ1, L1, HW1, GA 0, GA00 in the real fixture). On Sep 10 the probe shows "PQ1 Practice Quiz 1 (NOT FOR CREDIT)" and "S1 Select your group (NOT FOR CREDIT)" in Needs attention indistinguishable from HW3…
- *Touches:* ui/grouping.ts (secondary sort per bucket, not dedupe.sortItems which is full-review territory), ui/popup.ts + popup.css (practice chip), sources/types.ts Settings…
- *House-rule hazards:* Worker 6: a test almost certainly pins 'dueAt then title'; quote SPEC §4.3:535 when changing it.
- *Audit correction:* Only line 292 writes extra.forCredit; line 200 is the regex definition. Verdict is partial, not missing: the parser half the spec requires is done, the UI and notification half is absent.
- *Strongest objection:* Default-off reminders for not-for-credit rows contradict §4.3's own warning that some such surveys are required — S1 'Select your group' is exactly that.

### I31 · Surface parser data-quality flags instead of dropping unreadable rows
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

The parsers record `unparsedDueDate`, `unparsedLateDate`, `unparsedSchedule`, `unparsedCredit`, `unparsedDate`, `unparsedDateRange`, `creditMismatch`, `unknownStatus` and `idFallback` in `extra`, and console.warn in the offscreen document. Nothing reads them.

- *Why:* This is the exact §11 path, live today: house rule 1 keeps a row whose date failed to parse (correct), but `sectionFor` returns undefined for any row without an instant, so the popup shows it nowhere.
- *Touches:* New core/quality.ts (qualityFlags(item) over members[].extra); ui/grouping.ts (new bucket + SECTION_ORDER); ui/popup.ts (glyph, raw text via textContent, link)…
- *House-rule hazards:* Parser 2 / Worker 2 (this is the row-level fix for silent empty; 0 flags must still mean 'checked, none'), Worker 3 (never invent a date to section an unparsed row)…
- *Audit correction:* Minor: the offscreen console.warns are reachable by the maintainer (chrome://extensions -> offscreen document console) but by no student, and nothing in the message protocol carries them.
- *Strongest objection:* Flags fire only on rows fixtures had to be made deliberately unrealistic to trigger; a 'Couldn't read' section is a mostly-empty bucket in a 600px popup…

### I43 · Split Options into Settings and a hidden Developer panel; fix the 'debug' title and duplicate 'Course websites' label
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

The gear icon opens a page titled 'Illini Dash — debug' whose lower half asks for the student's NetID and full name and offers Gate 0, an offscreen round-trip and fixture capture.

- *Why:* The privacy pitch is 'nothing leaves the browser, it never sees your password'; the first settings screen a tester opens then asks for their name and NetID twice.
- *Touches:* public/options.html (retitle; `<details>` or a new public/debug.html), src/ui/options.ts (filter `site` from the Sources loop ~461-485; move its state label into the adapters section)…
- *House-rule hazards:* Worker rule 2: the site state/lastError must survive the removed row or a failed adapter loses its only signal. Worker rule 5: keep the build-id/STALE SERVICE WORKER line on Settings.
- *Audit correction:* Removing the row also removes where `sources.site` state/lastError is shown (options.ts:474-476); move it to the adapters section.
- *Strongest objection:* §0 rule 6 says ship ugly, and the title/heading is cosmetic. Testers who never open ⚙ never see it, and the debug tools are inert unless clicked.

### I59 · Lift backoff and resync immediately on extension update
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

After Chrome installs a new version, the worker clears the §6 backoff for any source sitting in parse_error/network_error and syncs at once, logging 'update 0.1.0→0.1.1: cleared backoff for gradescope'. The student who saw a red dot yesterday sees it turn green the moment the fix arrives, not up to four hours later.

- *Why:* §11's mitigation for a Gradescope redesign is 'fix fast with a store update'. But onInstalled calls sync('install') for every reason, and runSync honours backoff for anything but 'manual' (sync.ts:356)…
- *Touches:* background.ts onInstalled (branch on details.reason==='update'), core/sync.ts (SyncTrigger 'update' treated like manual, or core clearBackoff helper), test in sync tests…
- *House-rule hazards:* Worker 1: which states to clear is a decision, belongs in core. Worker 4: clear inside withStore (set-adapter-enabled at background.ts:540-556 is the pattern).
- *Audit correction:* backoffUntil is also cleared by runSync itself on an ok or needs_login outcome (sync.ts:396, 417), not only by the two options handlers the idea lists.
- *Strongest objection:* Only felt the day after a parser breaks, and Sync now already bypasses backoff (sync.ts:356). Worst case is a red dot for ≤4h.

### I49 · Adapter date grammar matching real fa26 pages (weekday prefix, at/@, 24h, split columns)
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Grow the closed set of `dateFormat` tokens so real strings parse and, crucially, so a time the page *states* is not recorded as `timeAssumed`. Concretely: tolerate an optional weekday prefix (`Tue Sep 08`, `Tue, Sep 01`, `Friday, September 4`), accept `@` and `at` between date and time, accept 24-hour `18:00`/`23:59` without am/pm, ignore trailing zone text (`US Central time`)…

- *Why:* Ran the shipped `parseAdapterDateParts` (bundled from src/sources/site.ts) over strings copied from live fa26 pages: ECE 391 `Due Friday, September 4 at 18:00 US Central time` — unparseable in every format; CS 374 `Tue Sep 08` — unparseable; CS 357 `Tue…
- *Touches:* site.ts (tokens, dueStrip, defaultTime, dueTime, weekday→inferYear), registry.ts (validate), dedupe.ts:229-231 (stated > rule > assumed), popup.ts + grouping.ts formatDue (render assumed/rule)…
- *House-rule hazards:* Rule 5: anchor both ends — the ignored tail is why `@ 11:59pm` becomes an assumed 23:59; record an unparsed tail. Rule 10: one unrealistic fixture row per token.
- *Audit correction:* Mechanism differs slightly: M/d and yyyy-MM-dd match the date prefix and ignore the tail, so with `@ 11:59pm` the time is never seen, not mis-parsed.
- *Strongest objection:* With one adapter nobody in the beta feels any of this; the two half-parsing live examples (ECE 310 '@ 11:59pm', CS 341 'at 23:59') land on the right instant by coincidence because the invented time…

### I54 · Versioned store migrations with memberKey remapping and a load-old-store test
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 2/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Replace the single merge-style `migrate` with a version switch (`schemaVersion` 1→2→…), validate `raw` and `items` instead of casting them, and give each migration a hook to remap `memberKey`s in `overrides.hiddenKeys/splitKeys/mergeGroups` and in `items[].notified` when a source's `sourceId` derivation changes.

- *Why:* During the beta week the maintainer will ship fixes to stores he cannot see or reset. The repo has already changed `sourceId` derivation once (PrairieTest, docs/sourceid-decision.md) and dropped stored hides once (`hiddenItemIds` → `hiddenKeys`).
- *Touches:* src/core/store.ts (migrations table, positive validation of raw/items, remap hook over raw keys, items.members, overrides, misses), types.ts schemaVersion union…
- *House-rule hazards:* Worker 6: tests/sync.test.ts:78 pins schemaVersion===1 and moves with the bump. Parser 5: replace the `as RawItem`/`as Item` casts with positive shape checks.
- *Audit correction:* A remap must also rewrite `raw` keys (memberKey-keyed, types.ts:159-160), `items[].members[].sourceId` and `misses` keys (store.ts:65), not only overrides and notified.
- *Strongest objection:* dedupe.ts already carries `notified` by memberKey and schedule.ts never fires past a deadline, so a key change re-fires only rows inside a lead window, not 14.

### I30 · One-click scrubbed diagnostics bundle
**Effort** M · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

A 'Copy diagnostics' button in Settings that assembles: build id and manifest version, Chrome version, per-source state / lastAttempt / lastSuccess / consecutiveFailures / request counts, the last error per source with any page-body snippet scrubbed, held permissions (`chrome.permissions.getAll`), the alarm list, the registry state, settings, course codes with per-source item counts, and section counts…

- *Why:* The maintainer's scarce resource is browser round-trips, and with ten testers every 'it shows nothing' report becomes three messages of back-and-forth.
- *Touches:* New core/diagnostics.ts (pure summarize: hash titles, scrub lastError, per-source counts) + tests; messages.ts ('get-diagnostics'); background.ts (alarms.getAll, permissions.getAll…
- *House-rule hazards:* Worker 1 (only chrome.* gathering in the worker; summarising and scrubbing in core), Worker 5 (include both-branch facts: backoffUntil, registry seeded/fetched, enabledAdapters)…
- *Audit correction:* 'Request counts' exist nowhere in the store: SourceOutcome.requests is console.logged at background.ts:224 and dropped; SourceStatus (types.ts:89-98) has no such field…
- *Strongest objection:* Ten testers are a trusted group: 'send me your Export JSON' over DM already works, and the health dot tooltip (popup.ts:69) already shows state+lastError to the tester.

### I61 · Right-click 'Report this page to Illini Dash'
**Effort** S · **In the code today** done (Tier 0a, 2026-09-10) · **Skeptic** value 2/5, feasibility 5/5, keep, before_beta · **Lenses** 1

On a Gradescope, PrairieLearn, PrairieTest, Canvas or enabled course-site page, the context menu gets one item. It opens Options with the Report-a-broken-page URL prefilled to the page you are looking at, so the student who notices 'Quiz 4 is on this page but not in my list' can report it in two clicks while still looking at it.

- *Why:* The report flow exists (options.html #report-url) but requires copying the URL, opening ⚙, scrolling to the section, pasting.
- *Touches:* public/manifest.json (+contextMenus), background.ts (contextMenus.create in onInstalled, onClicked → tabs.create options.html#report=…), ui/options.ts (parse hash, validate, prefill, scroll)…
- *House-rule hazards:* Parser 7: the hash is untrusted input; validate https + allowed host before prefill and catch decodeURIComponent throws. Worker 1: hash parsing as a pure tested function, not inline in options.ts.
- *Audit correction:* Trivial: isAllowedCaptureUrl is at capture.ts:41, not 39; the report-url read is at options.ts:744, not 732-790. Substance of the idea's evidence holds.
- *Strongest objection:* Students never feel this; only the maintainer does. The flow still ends in a downloaded scrubbed file the tester must email (no backend, §0-1), so two clicks become three-plus-an-email.

### I55 · Beta install kit: packaged zip, install guide, unlisted-store decision
**Effort** S · **In the code today** done (`npm run package`, docs/beta-install.md) · **Skeptic** value 4/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Add `npm run package` that zips `dist/` with a `INSTALL.txt`, and write a tester-facing guide with screenshots: enable Developer mode, Load unpacked, pin the icon, expect the 'Disable developer mode extensions' bubble on Chrome start, how to update when a new zip arrives (Reload on the card, then check the build id line).

- *Why:* G5 (store) is gated behind G4 (beta), so the ten testers must install a non-store build. Nothing in the repo produces a distributable artifact or explains the process to someone who has never opened chrome://extensions.
- *Touches:* package.json (package script), new scripts/package.mjs (zip dist/ + INSTALL.txt, stamp version), new docs/beta-install.md, README.md, PROGRESS.md…
- *House-rule hazards:* No parser/worker rule directly. CLAUDE 'Sushi's time': each guide step names one literal thing to report (dev-loop.md's build-id banner, the `[sync]` console lines).
- *Audit correction:* README's 'see below' points at nothing — there are no install steps at all, not 'developer-oriented' ones.
- *Strongest objection:* The maintainer can zip dist/ by hand once; the doc is the real deliverable. Unlisted store is worse for the beta week: every mid-week fix waits days on review while the first live run found 4 defects…
- *Spec tension:* Load-unpacked path: none. Unlisted-store path: touches §9's gate order (a listing, privacy-policy URL and permission justifications would precede G4).

### I45 · Canvas concluded-course filter via include[]=term with an 'Older courses' group
**Effort** M · **In the code today** done (`include[]=term` in src/sources/canvas.ts; "Older courses" in Settings) · **Skeptic** value 3/5, feasibility 4/5, keep, before_beta · **Lenses** 1

Add `include[]=term` to the courses request, keep only courses whose term contains today (fallback: the modal `enrollment_term_id`), and list anything filtered as a collapsed 'Older courses (3)' group in Options so a student who really is enrolled across terms can re-enable one. The onboarding page shows the decision ('kept 5 courses, set aside 2 from FA25').

- *Why:* `enrollment_state=active` leaks a year-old 'FA25 IBC NDA and Code of Conduct Forms' course on the owner's account, and Gies students accumulate more of these than CS students do: org and cohort 'courses' (community shells…
- *Touches:* canvas.ts (coursesUrl + filterCurrentTerm), sync.ts, store.ts + messages.ts (persist set-aside Canvas courses), options.ts/html ('Older courses' group), overrides.ts (a keep-list)…
- *House-rule hazards:* CLAUDE.md: no include[]=term capture, so no parser before the fixture. Rule 5: validate term start_at/end_at with isInstant. Rule 1: a course lacking `term` costs its field, not the page.
- *Audit correction:* `courseSummaries` (overrides.ts:124) is built from `raw` items, not the Canvas course list, so a filtered course has nothing to flag `setAside` on; the list must be persisted.
- *Strongest objection:* The leaked FA25 course publishes nothing dated, so today it costs nothing; §8.2's Courses checkbox already handles it by hand.

### I82 · Publisher-tool deadlines (Connect, Mastering, WebAssign, zyBooks): name the host first
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 4/5, keep, before_beta · **Lenses** 1

Stage 1 (small): call /api/v1/courses/{id}/assignments?per_page=100 (already an options capture preset, never used by sync), take undated rows with `submission_types:["external_tool"]`, group them by the host in `external_tool_tag_attributes.url`, and show one row per course in a "No date — lives elsewhere" section: "MCB 150 · 14 items in McGraw Hill Connect · open Connect".

- *Why:* docs/canvas-findings.md proves the mechanism on this very account: 66 of 66 CS 357 Canvas assignments are `external_tool` shells with no `due_at`.
- *Touches:* Stage 1: canvas.ts (assignmentsUrl + parseAssignments grouping mapper + pagination), sync.ts syncCanvas (N extra GETs per sync), grouping.ts (sixth SectionName + undated branch), popup.ts…
- *House-rule hazards:* Parser 7: `external_tool_tag_attributes.url` is off-origin (connect.mheducation.com); RawItem.url must stay on canvas.illinois.edu or sameOriginHttpsUrl rejects it.
- *Audit correction:* 'partial' overstates it: nothing user-facing exists. What exists is a debug capture preset, a fixture, and generic undated-item plumbing (§5.4 misses, formatDue 'no date').
- *Strongest objection:* Stage 1 adds undated rows to a deadline list in non-collapsible sections; for the owner it would print 'CS 357 · 66 items in PrairieLearn'…
- *Spec tension:* Stage 1: none. Stage 2: every publisher host is off illinois.edu, so it is a manifest host_permissions change plus a hand-written parser per platform (code, like Gradescope — fine under rule 4).

### I46 · 'Not used by you' source state for PrairieLearn / PrairieTest
**Effort** M · **In the code today** missing (the "Not used" chip shows only for a source the student switched off) · **Skeptic** value 3/5, feasibility 3/5, defer, v1.1 · **Lenses** 1

A student with no PrairieLearn course instances, or a PrairieTest home with no exam cards, gets a grey 'You do not seem to use PrairieLearn this term' state with a one-click 'turn it off' instead of a red parse_error dot and a 30-minute backoff ladder.

- *Why:* For a Gies or LAS student the honest state of PrairieLearn is 'not enrolled', but `syncPrairieLearn` throws `ParseError("no course instances on the student home page")`, which is a red dot plus backoff, and the tooltip text is written for the maintainer.
- *Touches:* types.ts (SourceState), sync.ts (SourceEmpty beside SourceDisabled :266; third branch like :388-399), prairielearn.ts/prairietest.ts markers after captures, popup.ts + options.ts (grey state…
- *House-rule hazards:* Rule 2/§0 rule 3: turns an error into a benign state, so key on a captured marker, never zero rows. Rule 6: exact, scoped marker (the PT isEmptyCard defect).
- *Audit correction:* PL's zero-instance check is a regex over the whole body (sync.ts:169), not a DOM marker, and no test pins it (`grep 'no course instances' tests` empty).
- *Strongest objection:* A student who never uses PrairieLearn is not logged in, so /pl/ redirects and the dot is yellow, not red — the red case needs them to log into a system they do not use.
- *Spec tension:* Borders §0 rule 3 (empty = error). It does not conflict if the empty state is *positively* detected — a specific marker on PrairieLearn's home for zero enrolments…

### I44 · Canvas 'No date' section with an LTI-shell explanation
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

Fetch `/api/v1/courses/{id}/assignments` per active course, and show undated, unsubmitted assignments in a collapsed 'No date' section at the bottom of the popup, grouped by course and off by default. Where a course has N assignments and zero dates, the Courses row and the onboarding page say 'CS 357: 66 Canvas assignments, none dated — these are PrairieLearn links; PrairieLearn is where the deadlines are'.

- *Why:* On the owner's account, 67 of 67 Canvas assignments were undated when this was written (Canvas has since started carrying a dated row), and the popup gives no hint why an undated one is missing. A CS 425 student sees 'HW1' on Canvas with no date and nothing in Illini Dash, and concludes the extension missed it.
- *Touches:* canvas.ts (+assignmentsUrl, parseAssignments), sync.ts (+1 fetch/course; FetchedPage needs a Link-header field), types.ts + store.ts (Settings.showUndated), grouping.ts (+"No date"), popup.ts…
- *House-rule hazards:* Rule 4: dated assignments also come from planner as `assignment:{id}`, so emitting all rows collides sourceIds — emit undated only. Rule 5: reuse isInstant.
- *Audit correction:* `linkHeaderNext` exists (canvas.ts:66-75) but `FetchedPage` (sync.ts:33-38) has no headers, so pagination is not wired in the loop; per_page=100 hides it.
- *Strongest objection:* On the CS-heavy beta the section is 66 PrairieLearn LTI shells that §5.3 cannot merge (dated vs undated), behind a default-off toggle nobody flips…

### I05 · First-run onboarding page (pin, per-source login check, per-course what-I-found)
**Effort** M · **In the code today** done (`onInstalled` opens the setup screen in the full view) · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 2

On `onInstalled` (reason `install`) open a `welcome.html` tab instead of silently syncing. It runs the existing Gate 0 probe against all four hosts and shows one row per source: Logged in / Log in here (button opens the login page, and the row re-checks when that tab closes) / Not something you use.

- *Why:* Today a cold install does nothing visible: the worker schedules an alarm and syncs in the background, and the student has to find an unpinned icon to learn anything.
- *Touches:* background.ts (onInstalled reason==='install' → tabs.create; tabs.onRemoved re-probe), messages.ts (+get-setup-state Request/Response), new public/welcome.html + src/ui/welcome.ts…
- *House-rule hazards:* W1 'what to tell the user' logic in core with tests, not in welcome.ts. W2 the per-course table must separate 'not fetched' (needs_login/disabled/backoff) from 'fetched, 0 dated' (Canvas LTI shells).
- *Audit correction:* onInstalled also fires with reason 'update' and 'chrome_update'; today's handler does not branch on reason, so the page must gate on details.reason === 'install' or every rebuild reopens it.
- *Strongest objection:* G4 is 10 hand-picked testers the maintainer can brief directly. A welcome surface is a new untestable UI (§0 rule 6: ship ugly).
- *Proposed by:* beta-onboarding, chrome-platform


## Tier 1 — full entries


### I13 · Reminder toasts with Open / Snooze / Done buttons, requireInteraction for the 2h lead
**Effort** M · **In the code today** missing · **Skeptic** value 4/5, feasibility 3/5, keep, v1.1 · **Lenses** 2

Each reminder carries two Chrome notification buttons: "Snooze 1h" (or 'until 6 PM' for a morning toast) and "Done — hide". Snooze re-fires the same reminder later; Done applies the existing Hide override so the row leaves the popup and no further leads fire. On macOS the buttons sit under the toast's Options chevron, which the toast text should mention once.

- *Why:* Today the only interactions are click-to-open and dismiss. A student who sees "due in 2h" in the middle of a lecture cannot ask to be reminded when it ends, and a student who already submitted somewhere the source cannot see (email, in person…
- *Touches:* core/schedule.ts (Lead type, LEAD_MS typing, parseAlarmName regex, snooze lead in planNotifications), types.ts Item.notified, background.ts (buttons, onButtonClicked, queued write)…
- *House-rule hazards:* Worker 1: the snooze-until decision goes in core/schedule.ts, not the handler. Worker 4: button handler must write through withStore (onClicked today only reads).
- *Audit correction:* Verdict 'partial' is too generous: no snooze/button code exists at all; only the click-to-open notification plumbing does.
- *Strongest objection:* On macOS Chrome uses native notifications: buttons hide behind the hover Options chevron and requireInteraction is not honoured (banner vs alert is a system setting), so the 2h toast still vanishes.
- *Proposed by:* chrome-platform, notifications

### I21 · Manual deadlines as a sixth 'manual' source
**Effort** M · **In the code today** done (src/core/manual.ts, quick add and the editor) · **Skeptic** value 4/5, feasibility 3/5, defer, v1.1 · **Lenses** 1

A "+ Add" control in the popup header opens a three-field form (course, title, due date/time, optional weekly repeat). The row then appears in the list like any other, labelled ME, gets the 24h/2h reminders, goes into the .ics, and can be edited or deleted from its row menu. Nothing is fetched for it; it is the escape hatch for anything the four sources and the one seed adapter do not cover.

- *Why:* Adapter coverage will lag for a long time (one seed adapter, and authoring one needs a logged-in capture plus hand-written selectors).
- *Touches:* types.ts Source; dedupe.ts SOURCE_RANK (Record<Source>); store.ts ALL_SOURCES/defaultStatus; popup.ts SOURCE_LABEL/renderDots (skip a dot)/safeUrl + form; options.ts SOURCE_NAMES…
- *House-rule hazards:* Worker rule 4: writes via mutate()/queue. Worker rule 3: typed bare date → 23:59 must set timeAssumed, and SOURCE_RANK must not let a manual time outrank Canvas on merge.
- *Audit correction:* runSync iterates Object.keys(PLANS) (sync.ts:341), so a source absent from PLANS is never visited—but its keys never enter seenThisSync…
- *Strongest objection:* Turns an aggregator into another to-do app; Google Calendar and Canvas To-Do already take typed entries with reminders.

### I24 · Registrar deadlines (drop, CR/NC, refund) as shipped campus rows
**Effort** M · **In the code today** missing · **Skeptic** value 4/5, feasibility 4/5, keep, v1.1 · **Lenses** 1

Ship `adapters/campus-fa26.json` next to registry.json — same GitHub daily-refresh path, same data-not-code posture — holding the Fall 2026 undergraduate deadline table: Sep 4 11:59 PM add / change hours / drop with refund (POT 1); Oct 16 11:59 PM drop without W, withdraw without W, credit/no-credit election, grade-replacement intent (POT 1); Oct 30 withdraw with 40% refund; POT A: Sep 18 / Sep 25…

- *Why:* Oct 16 (drop without W) is the most-missed date on campus: it is in no course tool, and a student deciding whether to bail on CS 374 after the first midterm (typically the week of Oct 12) has days, not weeks.
- *Touches:* types.ts Source (ripples through every Record<Source>: store.ts ALL_SOURCES/defaultStatus, dedupe.ts SOURCE_RANK, popup.ts SOURCE_LABEL, options.ts SOURCE_NAMES, sync.ts PLANS)…
- *House-rule hazards:* Parser rule 5: dates need full ISO with offset, and Nov rows are -06:00 after the CST flip; a bare 2026-10-16 lands the day before. Rule 4: KeyGuard on JSON sourceIds.
- *Audit correction:* 'Same GitHub daily-refresh path' overstates it: validateRegistry throws on anything but an `adapters` array of selector adapters…
- *Strongest objection:* Scope drift from course deadlines to a campus calendar: a course-less row breaks RawItem.courseRaw and the popup chip. The registrar states no clock time, so these are timeAssumed rows too.

### I60 · Page-aware popup: this course first, focus existing tab, auto-resync after login
**Effort** M · **In the code today** missing (only the full view reuses its tab) · **Skeptic** value 4/5, feasibility 4/5, keep, v1.1 · **Lenses** 1

Open the popup while on us.prairielearn.com/pl/course_instance/… for CS 357 and CS 357's rows are pinned at the top with the row for the page you are on marked 'this page'. Clicking a row focuses the Gradescope/PL tab that is already open instead of opening a ninth copy. And when a source is yellow and the student logs in on that site's tab, the worker notices the navigation and resyncs, so the dot clears itself.

- *Why:* Every row click today is chrome.tabs.create, so a study session ends with a stack of duplicate Gradescope tabs.
- *Touches:* New core/pageMatch.ts (url → source/course, pure), ui/popup.ts (active-tab query, focus-existing on click), ui/grouping.ts (pin this course), background.ts tabs.onUpdated → sync…
- *House-rule hazards:* Worker 1: matching and the resync debounce are decisions, put them in core (manual trigger bypasses the 5-min popup debounce, so onUpdated could hammer).
- *Audit correction:* None material. Tab URLs are visible without the 'tabs' permission only on hosts already permitted, which holds for the four sites and for granted illinois.edu adapters…
- *Strongest objection:* Three features in one. 'This course first' breaks the by-time list model of §8 and is scope creep — drop it.

### I25 · Final exam time and room from Course Explorer
**Effort** L · **In the code today** missing · **Skeptic** value 4/5, feasibility 3/5, keep, v1.1 · **Lenses** 1

A new source fetches https://courses.illinois.edu/ajax/finalexam/{year}/{fall|spring|summer}/{SUBJ}/{NUM} with the header `HX-Request: true` for every courseCode already in the store (CS357 -> CS/357) and parses the table it returns: Section | CRN | Date | Day | Start Time | End Time | Room | Exam Type (Combined / Conflict).

- *Why:* Finals are the one deadline where the cost of being wrong is total, and the schedule is by class meeting time with combined-section overrides: MATH 241 FA25 had its Combined exam at 1:30 PM in Foellinger and a Conflict sitting at 7:00 PM in DCL the same day…
- *Touches:* types.ts Source (+ every Record<Source> as in I24), new sources/finalexam.ts + sources/registry.ts PARSERS, sync.ts PLANS + SyncDeps.knownCourses, store.ts, dedupe.ts SOURCE_RANK…
- *House-rule hazards:* Parser rule 3: 8-column table — anchor on the header row. Rules 2/6: the 'not available' sentence is a legitimate-empty marker to match exactly on its alert element; a table with zero rows throws.
- *Audit correction:* Mostly accurate. Gaps: (1) plans cannot see store.raw — sync.ts:248 `(deps: SyncDeps) => Promise<RawItem[]>` — so a `deps.knownCourses()` injection is new work…
- *Strongest objection:* No current source tells the extension the student's section, so multi-section courses either show several candidate finals (one wrong building, the exact risk it cites) or guess.

### I02 · Exam-day card on PrairieTest rows (room, duration, format) in row, toast and calendar
**Effort** M · **In the code today** done (`examDetail` in row, detail screen and toast; the .ics still has no LOCATION) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 4

A PrairieTest exam row reads "Thu 9:00 PM · Grainger Library 057 · 50 min", with the grey detail line ("Room 057 in the basement of Grainger Library"), format and accommodations in the tooltip. The 24h/2h notification says "CS357 — Quiz 1 starts in 2 hours / 9:00 PM · Grainger Library 057 (basement) · 50 min · In-person" instead of "CS357 — due in 2 hours".

- *Why:* CBTF sessions split between Grainger 057 and DCL L410, and the two real captures show the same Quiz 1 moving from DCL L410 to Grainger 057 after a reschedule. Walking to the wrong basement at 9 PM is a missed exam.
- *Touches:* new core/exam.ts (examDetails), ui/popup.ts renderRow (+detail line, tooltip) + popup.css, core/schedule.ts notificationContent exam branch, background.ts fireNotification (contextMessage)…
- *House-rule hazards:* P5 capture prints '50min' (no space) — anchor /^(\d{1,3})\s*min$/, never Number(). P1 helper must never throw in the popup; unreadable duration costs its field.
- *Strongest objection:* PrairieTest, the CBTF confirmation email and CBTF's reschedule email already tell the student the room, and the row click opens PT. The 8:45-9:00 block is what SPEC §8 (line 861) prescribes.
- *Proposed by:* daily-workflow, grades-workload, notifications, uiuc-systems

### I09 · Per-course coverage table with 'request an adapter' flow
**Effort** M · **In the code today** partial (per-course item counts in Settings; no "request an adapter" flow) · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 3

In the onboarding page and Settings, each course shows a coverage line: 'CS 225 — Canvas (0 dated), PrairieLearn (8). Course website: not configured.' A 'This course uses a website for deadlines' button asks for the schedule URL, requests that host's permission, runs the existing capture+scrub…

- *Why:* The list is only complete if every place a course posts deadlines is covered, and for CS majors that place is often a course site (CS 225, CS 233, CS 374 all keep schedules on courses.grainger.illinois.edu).
- *Touches:* overrides.ts CourseSummary (+datedCount per source, singleSource flag), background.ts get-options-state, options.ts course row button → ensureHostPermission (l.686) + `capture` message +…
- *House-rule hazards:* Worker 2/parser 2: a single-source course must read as 'one source saw it', never as healthy coverage. Worker 5: log both branches of the permission request.
- *Audit correction:* There is no onboarding page to put this in: public/options.html is titled 'Illini Dash — debug' and grep for onboard/welcome/first-run in src, public, docs, SPEC.md finds nothing.
- *Strongest objection:* Canvas yields ~0 dated items on this account, so 'single-source course' is the norm, not a signal.
- *Spec tension:* The cs128.org / cs124.org sub-point conflicts with §2.3 (optional host permission is `*.illinois.edu` only) and with the registry's illinois.edu rule…
- *Proposed by:* adapter-growth, beta-onboarding, trust-transparency

### I10 · Side panel view of the same list
**Effort** S · **In the code today** missing · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 2

A "⇥ open in side panel" link (next to the existing ⤢ full view) docks the same list in Chrome's side panel, where it stays visible while the student works in Canvas, Gradescope or PrairieLearn in the main pane and updates after each sync.

- *Why:* The comment in popup.ts:284-286 says it: popups close on focus loss, "which is maddening while cross-checking against a course page." The current answer is opening popup.html in a tab…
- *Touches:* public/manifest.json (permission `sidePanel`, `side_panel.default_path`), popup.html/popup.ts (open link, `chrome.storage.onChanged` re-render — STORAGE_KEY is module-private in store.ts:21…
- *House-rule hazards:* Worker 1: keep `sidePanel.open` in the page, not background.ts. Worker 5: log when open() is refused (needs user gesture).
- *Audit correction:* Nothing side-panel-shaped exists, so 'partial' overstates it; the ⤢ tab view is a different mechanism. `chrome.storage.onChanged` is not used anywhere in src/ui today.
- *Strongest objection:* Cross-checking against course pages is a maintainer/tester activity, not a weekly student one, and the ⤢ full-view tab already covers it.
- *Proposed by:* chrome-platform, daily-workflow

### I11 · Search box and click-a-chip course filter
**Effort** S · **In the code today** missing (no search box in the popup) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 2

A search input under the header bar filters rows live by title and course label; clicking a course chip toggles a transient filter to that course (chip highlighted, "× clear" in the status line). `/` focuses the box.

- *Why:* "What is due for CS 374 this week?" is the most common question and the only answer today is scanning. The one filter that exists is options → Courses, which is a persistent disable meant for stale Gradescope terms, not a glance.
- *Touches:* public/popup.html (input), popup.css, src/ui/popup.ts (module query state, filter `currentItems` before `groupItems` in render(), chip click handler, `/` keydown).
- *House-rule hazards:* Parser 2 analogue: a filter with zero matches must say 'no matches for CS 374', not reuse 'Nothing due in the next 60 days' (popup.ts:251). §8.1 textContent rule for the echoed query.
- *Strongest objection:* Sections already partition by time and most students have under 30 rows in a 400x600 popup; a search input steals vertical space to save a two-second scan. Options→Courses covers the persistent case.
- *Proposed by:* daily-workflow, prior-art

### I14 · Done / Graded-recently section with score chips and per-source confirmation
**Effort** L · **In the code today** partial ("40% so far" on a row; no Graded-recently section) · **Skeptic** value 3/5, feasibility 3/5, defer, v1.1 · **Lenses** 2

A graded row shows its score chip — Gradescope "87 / 100", PrairieLearn "100%" (or "103%" for GA 1) — and a collapsed "Graded recently" section lists items whose status flipped to graded since the popup was last opened.

- *Why:* Students refresh Gradescope for days waiting for MP and midterm grades; the extension already fetches the exact page that changes when grades post, then throws the number away.
- *Touches:* gradescope.ts + prairielearn.ts (extra.score via parseField; GS needs a new graded-row capture first), new core helper diffing store.raw statuses called from sync.ts (full-review zone)…
- *House-rule hazards:* Fixture-first rule: no Gradescope graded row exists, so GS score parsing cannot start yet (PL fixture has 100%/103%/80%/96%/1%). Parser 1/5: bad score → extra.unparsedScore, row kept; anchored regex.
- *Audit correction:* PL fixture already carries real percents (100%, 103%, 80%, 96%, 1%), so the PL chip is testable today; only Gradescope needs a capture. prairielearn.ts mapStatus is at l.178-192, not 184-191.
- *Strongest objection:* Grades are a gradebook feature, not 'every deadline in one list'. No fixture has a graded Gradescope row, so score parsing cannot start under the house rules.
- *Proposed by:* grades-workload, prior-art

### I34 · Calendar dates past this week and day headings inside Later
**Effort** S · **In the code today** missing (a Month view exists; no day headings inside Later) · **Skeptic** value 3/5, feasibility 5/5, keep, before_beta · **Lenses** 1

Rows beyond Sunday show "Thu Sep 24 11:59 PM · in 9d" instead of "Thu 11:59 PM · in 9d", and the Later section is broken up with small date sub-headings ("Mon Sep 21", "Wed Sep 23", …) so the 60-day tail reads like a calendar, not a pile.

- *Why:* `formatDue` prints weekday+time only, so two rows reading "Thu 11:59 PM · in 9d" and "Thu 11:59 PM · in 16d" force the student to do date arithmetic to know which Thursday.
- *Touches:* ui/grouping.ts (formatDue gains month/day once due >= endOfWeek(now); a dayKey helper; re-sort by instantOf), ui/popup.ts render (day `<div>` inside Later), public/popup.css…
- *House-rule hazards:* Worker 3 (a runner-invented 23:59 would now print as 'Thu Sep 24 11:59 PM', compounding the known timeAssumed display gap; pair with a marker)…
- *Audit correction:* 'Items are already dueAt-sorted by dedupe.ts:362-367' is true only for dueAt: a row whose sole instant is lateDueAt sorts last (dedupe.ts:364) while grouping sections it by lateDueAt…
- *Strongest objection:* 'in 9d' vs 'in 16d' already tells the two Thursdays apart with no date arithmetic, and day sub-headings spend vertical space in a 600px popup on the section students scroll past least.

### I66 · Calendar export carries late and reduced-credit deadlines
**Effort** S · **In the code today** missing (the .ics exports one instant per item) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

The .ics download and the per-row Google Calendar link include the late window: for a Gradescope item a second event at the late due ("PHYS435: Homework 2 — late deadline"), for a PrairieLearn item the ladder in the description ("100% until Sep 8 11:00, 80% until Sep 22, 50% until Dec 9") and an event at the next credit drop.

- *Why:* Students who live in Google Calendar export once and stop opening the popup; for them the calendar is the only view, and it currently omits the deadline they will actually be racing after a slip.
- *Touches:* src/core/ics.ts event() + googleCalendarUrl, tests/ics.test.ts (test at :94 asserts exactly one BEGIN:VEVENT and must change). creditSchedule is member-level → members.find. popup/options untouched.
- *House-rule hazards:* Rule 5: creditSchedule is a JSON string — parse defensively, isInstant each tier.end; a bad ladder costs the description, not the event.
- *Strongest objection:* Most Gradescope HWs have a late window, so a second VEVENT per item doubles calendar clutter and quietly trains students to aim for the late date.

### I67 · 'Add to Outlook' deep link
**Effort** S · **In the code today** missing · **Skeptic** value 3/5, feasibility 4/5, keep, v1.1 · **Lenses** 1

Add a second row-menu item, 'Add to Outlook', that opens `https://outlook.office.com/calendar/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=…&startdt=…&enddt=…&body=…` (and the `outlook.live.com` twin for personal accounts) — the same no-OAuth, no-permission pattern as the existing Google TEMPLATE link, implemented as `outlookCalendarUrl(item)` next to `googleCalendarUrl`.

- *Why:* Illinois provisions every student an Outlook inbox by default; the campus help page says undergrads who claimed a NetID after November 2018 — which in Fall 2026 is all of them — and all graduate students use outlook.office.com.
- *Touches:* core/ics.ts outlookCalendarUrl; ui/popup.ts row menu; types.ts Settings, store.ts DEFAULT_SETTINGS + migrate() (store.ts:110-134 normalises every field)…
- *House-rule hazards:* Rule 5: migrate must validate calendarTarget against an enum, not typeof string. Worker rule 4: reuse the queued update-settings path.
- *Strongest objection:* UIUC does give every student Outlook (Tech Services confirms), but ACM and CS wikis document students rerouting to Gmail, and phone calendars are mostly Google/Apple.

### I18 · Custom lead times, per-kind leads, per-course mute
**Effort** M · **In the code today** partial (fixed 24h/2h toggles and a not-for-credit switch only) · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

Options → Reminders becomes: Assignments & quizzes: [24h] [2h] [+ add: N hours/days]; Exams (CBTF/PrairieTest): [7d] [24h] [2h]; and a per-course "remind me" checkbox next to the existing course list so a student can keep a course visible but silent. The 7-day exam lead reads "CS 357 Quiz 2 is one week out — Thu Oct 1, 9 PM, Grainger 057".

- *Why:* A CBTF midterm needs a different runway than a PrairieLearn homework: students block study time a week ahead, and "due tomorrow" for a 50-minute proctored exam is the wrong frame.
- *Touches:* types.ts (Settings.leadTimes, Item.notified keys, Overrides.mutedCourses); store.ts migrate strings→minutes; schedule.ts LEAD_MS/alarmName/parseAlarmName/planNotifications per…
- *House-rule hazards:* Parser rule 5: custom-hours input—`Number("")` is 0, clamp positively (see normalizeQuietHours). Worker rule 3: a 7d exam lead must key off a stated instant, not assumed 23:59/windowStart.
- *Audit correction:* Accurate (prairietest.ts:205 `kind: "exam"` confirmed). Addition: notificationContent (schedule.ts:225) hard-codes 'tomorrow'/'in 2 hours', so wording must also be derived from minutes.
- *Strongest objection:* Three features bundled, none requested by a user yet. A booked CBTF exam is one the student already chose a slot for, and it is visible in This week regardless…

### I19 · Per-sync change log strip ('2 new · 1 moved · 1 gone')
**Effort** M · **In the code today** missing (only the per-row "moved" note) · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

After every sync, diff each source's new raw set against what it replaced (by memberKey, then dueAt/lateDueAt/status) and keep the last ~20 deltas in a `syncLog` ring buffer in the store. The popup gets a one-line strip under the header — "Since 9:32 AM: 2 new · 1 moved · 1 gone" — that expands to titles with before/after times.

- *Why:* The repo already holds a live example of a silent move: between the Sep 3 and Sep 10 PrairieTest captures the student's CS 357 Quiz 1 went from DCL L410 at 1pm to Grainger 057 at 9pm (docs/prairietest-findings.md).
- *Touches:* New src/core/delta.ts (diffRaw, pure) + tests; sync.ts runSync returns delta and appends to store.syncLog (capped ~20); store.ts StoreV1Plus.syncLog + migrate []…
- *House-rule hazards:* Worker rule 1: diff lives in core. Parser rule 2/worker 2: 'gone' must exclude failing, resting and disabled sources (they keep old keys) and split purged from removed-while-ok.
- *Audit correction:* Accurate. Addition: `applyRetention` already returns `purged` and runSync (sync.ts:434-437) discards it, so the benign/alarming split is one field away.
- *Strongest objection:* Churn will swamp signal: Canvas's now-7d..now+60d window slides daily (boundary new/gone), PL lateDueAt moves at every credit tier…

### I26 · Morning digest at the end of quiet hours
**Effort** M · **In the code today** missing (quiet hours exist; no digest) · **Skeptic** value 3/5, feasibility 4/5, keep, v1.1 · **Lenses** 1

One list-style toast at quiet-hours end (08:00 by default, or a user-set time): "Today: CS 357 HW3 11:59 PM · PHYS 435 Lab 2 5:00 PM · Tomorrow: 2 more · 1 CBTF exam not booked". Click opens the full-view tab. Nothing fires when the day is empty.

- *Why:* The per-item leads answer "what's about to hit me", not "what does today look like" — a student with three things due today gets three separate toasts at three separate times and no overview.
- *Touches:* core/schedule.ts (planDigest + a non-`notify:` alarm name or Lead extension), ui/grouping.ts → core/ so the worker can compose the text…
- *House-rule hazards:* Worker rule 1: composition and the 'fired today' decision belong in core. Worker rule 4: the fired-today stamp is a store write inside sync→reschedule — queue it.
- *Audit correction:* 'Would absorb the booking nag' changes §7 ('one notification per day at 10:00 local until the item disappears', SPEC.md:795-796), pinned by schedule.test.ts:181-230 — label it an amendment.
- *Strongest objection:* macOS native notifications show only the first list item, so on the campus-majority platform the toast reads 'Today: CS 357 HW3' and drops the rest.

### I32 · Show when merged members disagree on due date or status
**Effort** M · **In the code today** partial ("X says …" on the detail screen only) · **Skeptic** value 3/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

When two members of one Item have dueAt values more than a few minutes apart (the merge window is 24h) or conflicting statuses, render both: "Fri 5:00 PM (GS) · Canvas says Fri 11:59 PM" with a small disagreement icon; the Details panel explains which §5.3 rule picked the winner and offers 'use this one', stored as a per-item preference.

- *Why:* §4.1 names 'instructor sloppiness' — one system extended, the other not — as the reason all sources stay on.
- *Touches:* Display: ui/grouping.ts or new core/disagreement.ts (spread + status conflict from members), ui/popup.ts (secondary due string, icon).
- *House-rule hazards:* Worker 3 (a timeAssumed 23:59 vs a real Canvas time is not a disagreement; exclude assumed members or every CS424 CV+WEB row flags), Worker 4 (new override via queued handler + reschedule)…
- *Audit correction:* 'The other members' values are not recorded on Item' is misleading: Item.members (types.ts:56) keeps every RawItem with its own dueAt/status, so the display half needs no dedupe change.
- *Strongest objection:* Inside a 24h merge window small spreads are routine (Canvas copies vs Gradescope full/late deadlines), so a disagreement glyph would light up many rows as noise…

### I33 · Snooze / 'not today' defer on a row
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

⋯ → "Snooze until tomorrow / next Monday / pick a date" moves the row out of Needs attention/Today into a collapsed "Snoozed" section until the chosen instant, without hiding it and without changing its due date. A snoozed PrairieTest booking row also pauses the 10:00 daily nag until the snooze ends.

- *Why:* A PL quiz the student has decided to take the zero on sits in Needs attention for seven days with no way out except Hide (permanent, dumped into options). A CBTF exam the student intends to book on Friday nags every morning until then.
- *Touches:* types.ts (Overrides.snoozedUntil, Item.snoozedUntil), core/overrides.ts, core/dedupe.ts (buildItem + applyRetention prune), core/schedule.ts (isEligible/planBooking)…
- *House-rule hazards:* Worker 4 (queued override, then reschedule), Worker 2 (a snoozed booking must still be visible as snoozed, not vanish like 'handled'), Worker 3 (expiry judged against now at read time…
- *Audit correction:* planNotifications(items, settings, now) (schedule.ts:121) takes no overrides, and fireNotification re-plans from store.items (background.ts:268).
- *Strongest objection:* Overdue rows already fall out of Needs attention after 7 days (grouping.ts OVERDUE_WINDOW_DAYS) and Hide is undoable from options 'Hidden items' (options.ts:670), so snooze mostly duplicates 'hide…
- *Spec tension:* §7 says the booking nag fires daily "until the item disappears"; pausing it for a user-chosen snooze is a deliberate amendment to that line. Otherwise none.

### I35 · Keyboard shortcut, arrow navigation, real links
**Effort** M · **In the code today** done (Alt+Shift+D, arrow navigation, real `<a href>` rows) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

Alt+Shift+D (user-rebindable at chrome://extensions/shortcuts) opens the popup; Up/Down move a focus ring through rows, Enter opens the item, `m` opens its menu, `/` focuses search. Rows become `<a href>` so Ctrl/Cmd-click and middle-click open in a background tab like every other link.

- *Why:* Rows are `<div>`s with a click handler: Tab skips them and lands on the ⋯ buttons, which are invisible (opacity 0) until hovered — so keyboard users tab through nothing.
- *Touches:* public/manifest.json (commands._execute_action), src/ui/popup.ts renderRow (anchor + roving tabindex + keydown on #list, menu as sibling not child), public/popup.css (focus ring), public/popup.html…
- *House-rule hazards:* Parser 7 / §8.1 rendering rule (href only when safeUrl passes; keep the .illinois.edu suffix check), Review policy calls UI light-review but popup.ts:8 names this the one exploitable layer…
- *Audit correction:* 'Keyboard users tab through nothing' overstates it: the ⋯ is a real `<button>` and popup.css:42 makes it visible on :focus, so Tab reaches every row's menu today.
- *Strongest objection:* Extension popups are mouse-driven and rarely receive keyboard focus reliably; screen-reader users are a tiny slice of beta. The '/ focuses search' part is void — the popup has no search field.

### I36 · 'Opens Thu 9 AM': surface release times, dim not-yet-open rows, remind on open
**Effort** M · **In the code today** partial ("opens …" on the row; no reminder at opening) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

A row whose `extra.releasedAt` is in the future renders dimmed with "opens Thu 9:00 AM ·" prefixed to its due text, and the row menu offers "Remind me when it opens". PrairieTest booking rows already do the equivalent with their window; assignments do not.

- *Why:* PL quizzes and Gradescope assignments are often created with a future release; the row looks open, the student clicks it two days early, gets "not yet available", and — worse — plans to start tonight something that opens tomorrow.
- *Touches:* Display: src/ui/grouping.ts (new pure `unreleasedUntil`), src/ui/popup.ts renderRow, public/popup.css, tests/grouping.test.ts.
- *House-rule hazards:* Worker 1: put the 'is unreleased' decision in grouping.ts, not untested popup.ts. Parser 5: guard releasedAt with Date.parse/isInstant.
- *Audit correction:* Gradescope fixture release dates all precede the fetch (students only see released work), so the future-release case is realistically PrairieLearn tier-starts…
- *Strongest objection:* Gradescope hides assignments from students until release, so its releasedAt is almost always past; only PL rows whose first tier starts in the future ever qualify.

### I37 · A partial PrairieLearn score is not 'done'
**Effort** M · **In the code today** partial (decided in the parser; any score counts as graded when no credit ceiling is stated) · **Skeptic** value 3/5, feasibility 4/5, keep, v1.1 · **Lenses** 1

A PL homework showing 40% while its 100% (or 80%) tier is still open stays in the list as "40% so far · 100% until Tue 11:59 PM" and keeps its 24h/2h reminders; only 100% (or a score at or above the current credit cap) counts as finished. Today any bar above 0% is mapped to graded, so with the default "hide submitted and graded work" the row disappears and its reminders are silenced.

- *Why:* CS 357 / CS 225-style PL homeworks are retake-until-100 by design. A student who opens HW4a, scores 40%, and closes the tab loses the remaining 60% with no reminder and no row — the "silent missing deadline" §11 calls catastrophic, one level down.
- *Touches:* src/sources/prairielearn.ts mapStatus/extra (scorePercent); src/core/dedupe.ts isItemDone gains `now` + PL tier rule (callers grouping.ts:79,104, schedule.ts:82); grouping.ts formatDue wording…
- *House-rule hazards:* Parser 10: fixture widths are only 0%/100%, so a wrong impl passes — add an unrealistic row and say so. Parser 5: anchor the percent regex. Parser 9: write the §4.3 amendment down.
- *Audit correction:* Fixture bars are 0% and 100% only (7 scorebars); '103%' is the GA 1 bar's text with width:100% plus an inline test cell (prairielearn.test.ts:518).
- *Strongest objection:* The assessments table cannot tell a retake-to-100 homework from a one-shot quiz that ended at 40%: both show a bar <100 with an open tier.
- *Spec tension:* Amends SPEC.md §4.3's line "a percentage bar > 0% → graded (PrairieLearn grades on the spot, so this is 'done' for our purposes)". §0 is untouched.

### I40 · CBTF reservation-window escalation and missed-reservation notice
**Effort** M · **In the code today** partial (the daily 10:00 booking nag only) · **Skeptic** value 3/5, feasibility 3/5, keep, v1.1 · **Lenses** 1

The daily 10:00 booking nag stays, but when the session window ends within 24h (or today) a second, sticky toast fires in the evening: "Last day to book CS 357 Quiz 1 — sessions end Wed Sep 23. Reserve a seat now." If the window passes with no reservation, one final toast says so and the popup keeps a "Missed reservation — contact course staff" row in Needs attention for 3 days, as §4.4 already promises.

- *Why:* CBTF slots fill from the good times outward; a student who snoozed the 10 AM nag on the last day discovers at 11 PM that the only remaining slot was 8 AM, or that there is none.
- *Touches:* src/core/schedule.ts planBooking (+ 'booking-last' Lead, parseAlarmName), types.ts:79 notified, src/core/sync.ts or dedupe.ts applyRetention (keep a passed-window booking 3 days, mark missed)…
- *House-rule hazards:* §0 rule 3 / Parser 2 tension: retaining a raw item the source no longer reports cuts against sync.ts:401-408's per-source atomic replace and the N→0 guard — decide where the ghost lives.
- *Audit correction:* Accurate. Unknown from the repo: whether PrairieTest keeps a past-window exam in the available card (both fixtures are pre-window) — VERIFY…
- *Strongest objection:* The 10:00 nag already fires on the last day; the escalation is one extra toast. The 'missed' row requires the extension to keep emitting an item the source stopped emitting…

### I47 · Per-adapter health state and N->0 guard per course site
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

`SourceStatus.site` grows `adapters: Record<adapterId, { state, lastAttemptAt, lastSuccessAt, itemCount, lastError }>`. Options -> Course websites shows next to each enabled adapter: `ok · 9 rows · 2 min ago`, `parse_error: 0 rows matched "table tr"`, `needs login`, `permission missing`, or `was 9 rows, now 0`. The popup's WEB dot goes yellow/red when *any* enabled adapter failed, with the tooltip naming it.

- *Why:* With two adapters enabled — say CS 424 and ECE 310 — and ECE 310's table redesigned, today's loop records the failure in a local `failures[]`, console.warns it, and returns CS 424's items with `state: "ok"`.
- *Touches:* sync.ts (syncSites returns per-adapter outcomes; ok-branch deletes keys per `site:{id}:` prefix), types.ts SourceStatus, store.ts migrate default, background.ts get-adapters, options.ts adapter rows…
- *House-rule hazards:* Worker rule 2, exactly: green dot over a failed adapter. Worker rule 1 + review policy: sync-loop change, full review.
- *Audit correction:* Worse than stated: partial failure is `ok`, and sync.ts:403 deletes ALL `site:` keys before re-adding survivors' items — the failed adapter's rows vanish next sync; they do not linger to §5.4.
- *Strongest objection:* There is one seed adapter. With one adapter every failure already throws (failures.length === adapters.length) and the WEB dot goes red…

### I48 · Header-anchored adapter columns and 'Due'-header autodetect
**Effort** M · **In the code today** done (`columns` by header name, src/core/table-grid.ts) · **Skeptic** value 3/5, feasibility 3/5, defer, v1.1 · **Lenses** 1

Let an adapter name columns by header text instead of positional CSS: `columns: { title: "Exercises|Assignment", due: "Due Date|Deadline|Due" }`, resolved once per table from its own `<th>` row (with a colspan/rowspan grid expansion so the CS 424 rowspan problem cannot recur).

- *Why:* The one real adapter needed `td:not(.auto-style6)` because `nth-child` was wrong about half the time on CS 424's rowspan table (docs/adapters.md).
- *Touches:* core/parsing.ts (header→column + rowspan/colspan grid), sources/site.ts (columns/autodetect), core/registry.ts (validate; keep rows/title/due fallback), types.ts Adapter, docs/adapters.md…
- *House-rule hazards:* CLAUDE.md: no header-shaped site fixture yet — capture ECE 310 first. Rule 2: autodetect that finds a table whose rows then match nothing must throw.
- *Audit correction:* `grep header site.ts` returns one comment (:167), not nothing. PL's columnFor resolves an index then reads `cells[i]`, so lifting it as-is still indexes positionally…
- *Strongest objection:* Live TAM 212 (fetched today): header is 'Week|Day|Date|Lecture|Quiz|Assignment Due Dates|Discussion' — the /due/i autodetect would pick the title column as the date column.

### I51 · In-options adapter workbench with 'Propose this adapter' bundle
**Effort** M · **In the code today** partial (the search proposer and "Copy for sharing"; no free-form workbench) · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

A new Options -> Course websites -> "Try an adapter" panel: a textarea prefilled with the cs424-fa26 entry as a template, a Fetch-and-run button. It shows validateAdapter's verdict, the fetch outcome (401 -> "log in to that site first", using the same looksLoggedOut path as sync), rows matched / rows with a title / rows kept after filter, then one line per item: title, raw date text, parsed instant…

- *Why:* Today the authoring loop is: student captures HTML -> sends it to Sushi -> Sushi writes selectors in a vitest run -> commits -> daily refresh -> student enables. That is one maintainer-hour per adapter and cannot reach 40.
- *Touches:* src/messages.ts (try-adapter), src/background.ts (wiring), new src/core/try-adapter.ts (validate→fetch→looksLoggedOut→run + diagnostics), public/options.html + src/ui/options.ts panel.
- *House-rule hazards:* Parser 8: use looksLoggedOut with status, not capture's URL-only check. Worker 1: verdict/diagnostics logic in core/, worker wires only. Worker 4: localAdapters writes through withStore.
- *Audit correction:* capture() does not share sync's login check: capture.ts:110 uses looksLikeLoginUrl(finalUrl) (URL only); sync.ts:230 uses looksLoggedOut(status, finalUrl, body).
- *Strongest objection:* Beta testers should test the list, not author adapters; anyone who can fix `0 rows matched` can already send a capture.

### I64 · This-week workload strip per course
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

One muted line per course above the list for the current week: "CS357 · 2 HW · 1 lab · Quiz 1 (CBTF Thu 9 PM) · 1 opens Sat", "PHYS435 · 1 HW". Counts come from kind plus the PL badge prefix (HW/L/PQ/GA) and group heading ("Module 4. Floating Point"); "opens" comes from Gradescope's release time and the PL schedule's first tier start, both captured on every row and never displayed.

- *Why:* The list answers "what is next", not "how heavy is this week" — the question that decides whether to book the Tuesday or Friday CBTF slot.
- *Touches:* src/ui/grouping.ts (new pure weekSummary(items, now)), src/ui/popup.ts render(), public/popup.css, tests/grouping.test.ts.
- *House-rule hazards:* Parser rule 6: badge prefixes must be anchored (`^L\d` not substring, else "LA" or "HWQ" miscounts). Rule 5: validate releasedAt with isInstant before Date.parse.
- *Strongest objection:* It re-renders rows the This-week section already shows. PL badge prefixes (HW/L/PQ) are CS357-specific, so most courses get a bare count.

### I71 · 'Why is this here / why isn't X here' merge-reason explainer
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

Two halves. (a) The Details panel states the merge reason in words — 'merged automatically: same course CS357, due within 24h, titles share hw3' or 'merged by you on Sep 8' — and which rule chose the URL and time.

- *Why:* Between dedupe, retention, section rules and settings there are at least seven ways a real deadline can be absent from the popup.
- *Touches:* New core/explain.ts (whyAbsent, mergeReason). dedupe.ts export isCourseDisabled; grouping.ts export window consts. messages.ts new explain request/response; background.ts read-only handler.
- *House-rule hazards:* Worker rule 1: verdict logic must live in core and import grouping/dedupe predicates, not re-derive them. Worker rule 3: a reason quoting an assumed 23:59 must say it was assumed.
- *Audit correction:* No 'Details panel' exists to extend — rows have only a ⋯ menu (popup.ts:144-223); it would be new.
- *Strongest objection:* The one absence that matters — a parser miss — is invisible to a tool that queries `raw`, because the item is not in `raw`.

### I73 · 30-minute 'last call' only when the source still says not submitted
**Effort** M · **In the code today** missing · **Skeptic** value 3/5, feasibility 3/5, defer, v1.1 · **Lenses** 1

A third, opt-in lead at T-30m that fires only if every member with a known status is `not_submitted`: "Last call — PHYS 435 HW 3 is due at 11:59 PM and Gradescope shows nothing submitted (as of 11:15)." Sticky (requireInteraction) and high priority; never fires for items whose status is `unknown` (course-site adapters) so it cannot cry wolf.

- *Why:* The 2h toast arrives while the student is still working and is dismissed; the failure mode that actually loses points is the forgotten upload — the PDF is done, Gradescope never got it.
- *Touches:* types.ts Settings.leadTimes + Item.notified unions; schedule.ts Lead/LEAD_MS/parseAlarmName/planNotifications gate; background.ts fireNotification options; store.ts migrate leadTimes…
- *House-rule hazards:* Worker rule 3: status is a fetched value up to a poll stale — toast must say 'as of'; never treat unknown as not_submitted. Worker rule 6: schedule.test.ts:56-59 pins the Lead regex.
- *Audit correction:* Missed interaction: T-30m for an 11:59 PM deadline is 11:29 PM, inside default quiet hours (store.ts:34 {23,8}).
- *Strongest objection:* deferPastQuietHours applies to every lead and default quiet hours start 23:00, so T-30m for an 11:59 PM deadline (the dominant UIUC time) is deferred to 08:00 and skipped as past-due.

### I50 · Adapter row-context fields (rowspan carry-forward, ancestor title, per-column kind, recurring rules)
**Effort** L · **In the code today** partial (rowspan and colspan through table-grid.ts, `titleFrom`; no carry-forward or recurring rules) · **Skeptic** value 3/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

Four small declarative fields that cover the page shapes the first adapter did not: `dueInherit: true` (a row whose date cell is absent — which is what a `rowspan` date column looks like in the DOM of every row after the first — takes the last date seen above it); `titleContext: "h3"` (prefix each row's title with the nearest preceding heading or ancestor, so ECE 391's list items become `MP 2…

- *Why:* ECE 391 fa26 assignments.html is a nested list where MP 2 and MP 3 each carry several `Checkpoint N due Friday, September 18 at 18:00` items — with `rows: "li"` the popup would show `Checkpoint 1` three times with no MP name.
- *Touches:* src/sources/site.ts (carry-forward across rows, ancestor lookup, per-column emit, recurring generator), src/sources/types.ts Adapter, src/core/registry.ts validateAdapter…
- *House-rule hazards:* Parser 4: site.ts:195 silently `continue`s on duplicate sourceIds, so inherited dates + repeated titles merge rows with no error.
- *Audit correction:* Per-column `kind` is cosmetic today: nothing treats `exam` specially — `kind` is consumed only for `booking` (grouping.ts:69,104; schedule.ts:131; ics.ts:74; popup.ts:85; dedupe.ts:245).
- *Strongest objection:* Half the evidence is wrong: CS 341 lists explicit yyyy-MM-dd times (recurring unneeded); TAM 212 has no rowspan and its Quiz/HW rows are PL/PT-served anyway; `kind` changes nothing in popup/schedule.

### I12 · Per-row Details panel: provenance and what each parser extracted
**Effort** S · **In the code today** partial (sources and facts on the detail screen; no per-member age) · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 2

Add a 'Details' entry to the row menu that lists every member: source, its own title, its own due/late time, status, 'seen 12 min ago' from `fetchedAt`, and an open-in-that-source link. If a member's source is currently failing, say so inline: "GS · last seen 2d ago — Gradescope needs login".

- *Why:* The one merge on the owner's account, CS424 Homework 1 (CV WEB), shows Canvas's time because the site's is an invented 23:59 — a student looking at the row cannot tell which system the time came from, whether the course site said anything different…
- *Touches:* src/ui/popup.ts (Details entry in openRowMenu, per-member rows via safeUrl, age from member.fetchedAt, failing-source marker from `sources[member.source]` kept from refresh()), popup.css.
- *House-rule hazards:* Parser 7 / §8.1: every member URL through `safeUrl`, textContent only. Worker 3: label a member whose time was assumed as 'no time stated' rather than printing 23:59 — the known gap.
- *Strongest objection:* One merge exists on the owner's account; a details panel is a debugging view students will not open.
- *Proposed by:* prior-art, trust-transparency

### I20 · Collapsible sections that remember their state
**Effort** S · **In the code today** missing · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

Each section heading ("This week (7)") toggles its rows, and the collapsed set is remembered across popup opens. Needs attention and Today stay open by default; Later starts collapsed once it exceeds ~10 rows.

- *Why:* SPEC §8.1 line 816 requires "each collapsible" and it was not built. The popup is 600px tall; a Needs attention section holding two PrairieTest booking rows plus a week of overdue Canvas shells pushes Today off-screen…
- *Touches:* popup.ts render() (wrap in <details>, reapply state on every re-render since refresh() rebuilds the list); popup.css summary/h2…
- *House-rule hazards:* Worker rule 4/1: persisting via update-settings runs applySettings, which re-arms scheduleAlarm+reschedule on every toggle—use localStorage or a dedicated message.
- *Strongest objection:* Empty sections are already hidden and Later is last, so it pushes nothing off-screen; the student scrolls. Overdue rows are capped at 7 days.

### I56 · Adapter linting and golden tests in CI
**Effort** S · **In the code today** partial (fixture tests for every shipped entry; no CI, no `adapters:check`) · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

A GitHub Actions workflow running build, typecheck and the suite on every PR, plus `npm run adapters:check`: validateRegistry on adapters/registry.json; for every adapter with `fixtures/sites/<id>.html` + `<id>.expected.json`, run `runAdapter` and diff; fail an adapter that has no fixture (so proposals must ship one), one whose `rows`/`title`/`due` are not parseable CSS (try `querySelector` in linkedom)…

- *Why:* src/core/registry.ts REGISTRY_URL points at `main` on raw.githubusercontent.com and every install refreshes within 24 h, so a merged typo reaches every student of that course with no store review in between — that is the feature, and it is also the risk.
- *Touches:* new .github/workflows/ci.yml, new fixtures/sites/<id>.expected.json, golden runner (simplest as a vitest file globbing fixtures/sites under linkedom, not a separate scripts/check-adapters.mjs)…
- *House-rule hazards:* Parser 10: expected.json generated from current output pins current behaviour, bugs included — mutate to prove it fails.
- *Audit correction:* `td[` does not land as network_error: sync.ts:222-245 catches per adapter and, when every adapter failed, throws ParseError → parse_error (backoff still armed, sync.ts:418-427).
- *Strongest objection:* There is no GitHub remote, so REGISTRY_URL is dead, no PRs exist, and 'a Tuesday registry fix bricks Wednesday' cannot happen this semester. One adapter, zero contributors.

### I68 · Copy this week as Markdown / plain text
**Effort** S · **In the code today** missing · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

A 'Copy' control in the popup header (and a small copy icon on each section heading) that writes the visible list to the clipboard as Markdown task lines — `- [ ] Thu Sep 17 5:00 PM · CS 357 · HW3 Errors and Big-O (Gradescope) <url>` — grouped under the same Today/Tomorrow/This week headings, with a plain-text variant that drops the link syntax.

- *Why:* The 'what's due this week?' message gets posted in every course Discord and study-group chat at UIUC every Sunday night, and today the student either types it by hand or screenshots the popup.
- *Touches:* New core/textExport.ts (toMarkdown/toPlainText over groupItems + formatDue), ui/popup.ts header button + section headings, public/popup.html, new tests.
- *House-rule hazards:* Worker rule 3: timeAssumed (member-level extra) must print as date-only. §8.1/popup.ts:27 safeUrl: only paste https URLs on known hosts…
- *Strongest objection:* A screenshot is one keystroke and already what group chats use. A pasted list reflects one student's hides, merges and course toggles, so it is not a trustworthy 'what is due' post for others.

### I23 · Stable .ics UID across merges plus SEQUENCE
**Effort** M · **In the code today** partial (stable `UID`; no SEQUENCE) · **Skeptic** value 2/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

Today a student who downloads the .ics in week 2 and again in week 6 gets duplicate events for any deadline whose member set changed in between — the moment Gradescope starts mirroring a Canvas-only assignment, or the student clicks Split/Merge, the row's id (and therefore its UID) changes.

- *Why:* The one cross-source merge that G3 rests on — CS424 Homework 1 from Canvas + the CS 424 site — is exactly the case that changes the id: a student who exported before the site adapter was enabled has `canvas:...`-hashed UID…
- *Touches:* sources/types.ts Item (+calendarUid, +revision/updatedAt), core/dedupe.ts buildItem + the `previous` block (332-352), core/ics.ts (UID, SEQUENCE, LAST-MODIFIED), core/store.ts migrate defaults…
- *House-rule hazards:* Worker rule 3: bump revision only when a stated value changes (assumed 23:59 → stated time is a bump; equal instants from two members is not).
- *Audit correction:* 'carries notified forward only on exact item.id match, so a merge also resets notifications' is false: dedupe.ts:332-352 builds `firedByMember` and unions `notified` from any previous item sharing a…
- *Strongest objection:* Evidence overstated: dedupe.ts:330-352 already carries notified across merges by member key, so there is no shared root cause. Re-export then re-import is rare without OAuth sync (v1.1).

### I28 · Keep reminders working past Chrome's 500-alarm cap
**Effort** M · **In the code today** missing · **Skeptic** value 2/5, feasibility 5/5, keep, v1.1 · **Lenses** 1

A student in six courses whose Gradescope pages list the whole term ends up with 200–250 dated items and two leads each; reschedule() tries to arm 400–500 one-shot alarms. Past 500, Chrome rejects alarms.create, the loop in reschedule() throws mid-way, and the remaining items' reminders are never armed — with no UI change and a saved store that looks fine.

- *Why:* This is §11's 'silent missing deadline' in the reminder layer. planNotifications has no horizon (grouping.ts's 60-day HORIZON is UI-only), so December's items are armed in September; the per-(item, lead) design that §7 specifies predates the Chrome 117 limit.
- *Touches:* core/schedule.ts (horizon constant shared with grouping's HORIZON_DAYS → move to core; or `notify:next` coalescing via alarmName/parseAlarmName), background.ts reschedule/onAlarm…
- *House-rule hazards:* Worker rule 1: the cap/horizon decision belongs in planNotifications (return armable ≤ N by fireAt, flag the rest), not a try/catch in background.ts.
- *Audit correction:* 'No UI change' holds for alarm/popup syncs, but mutate() (background.ts:314-322) awaits reschedule(), so a Hide/Split during overflow surfaces the rejection in the popup status line — misleading…
- *Strongest objection:* Needs 250+ future dated items with both leads on; and it self-heals: sortItems orders by dueAt ascending, so the alarms that fail are December's, saveStore runs before reschedule()…

### I29 · Import JSON (restore corrections / load a snapshot)
**Effort** M · **In the code today** missing · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

Next to 'Export JSON' add 'Import…' (file picker) with two modes: 'Restore my corrections' imports overrides (hide/split/merge/disabled courses), settings and enabledAdapters, and 'Replace everything (debug)' loads a whole snapshot.

- *Why:* 'Reset everything' warns it deletes 'your hide/merge corrections' and there is no way back; a student who reinstalls, switches laptops, or resets to clear a stuck source loses every Split/Merge/Hide they made.
- *Touches:* New core/importStore.ts (applyImport + RawItem/Overrides validators) + tests; messages.ts (Request 'import'); background.ts handler inside withStore then reschedule()…
- *House-rule hazards:* Parser 5 (typeof-string is not validation; imported dueAt/url need isInstant/anchored checks), Parser 7 (imported RawItem.url bypasses sameOriginHttpsUrl), Worker 4 (write via queue…
- *Audit correction:* Idea says the worker 'validates through the existing migrate()'. migrate() is a default-filling merge, not a validator: raw/items are cast unvalidated (store.ts:135-136)…
- *Strongest objection:* Resets and laptop swaps are rare inside one semester, and the maintainer's G4 case is already covered: dedupe() is pure over RawItem[]+Overrides (dedupe.ts:271)…

### I57 · Term rollover: term dates in the registry, Expired section, fa26->sp27 carry-over
**Effort** M · **In the code today** partial (the Canvas term filter only) · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

The registry gains a `terms` table (`{ fa26: { start: "2026-08-24", end: "2026-12-18" }, sp27: {...} }`) or per-adapter `activeFrom`/`activeUntil`. Options shows next-term adapters about two weeks before the term starts, shows the current term's end date on each row, and lists last term's under "Expired" instead of making them vanish.

- *Why:* `currentTermCode` is a pure month rule: on 2027-01-01 it flips to `sp27`, every fa26 adapter disappears from Options and from `enabledAdapters()`, `syncSites` throws `SourceDisabled("no course sites are enabled")`…
- *Touches:* core/registry.ts (terms table validation, next/expired calc), sources/types.ts + messages.ts (adapter term status), core/store.ts (schema v2: prune enabledAdapters, carry-over answer)…
- *House-rule hazards:* Worker 1: hourly-vs-daily cadence is a decision, keep it out of background.ts. Worker 2: 'sp27 list not published yet' must report distinctly from disabled/ok.
- *Audit correction:* Minor: `grep expired src` is not empty (comments in sync/parsing/canvas), just nothing term-related.
- *Strongest objection:* Registry has ONE adapter (cs424-fa26). Canvas/GS/PL/PT ignore term entirely, so on Jan 1 only the WEB source greys out — and that course is over.

### I72 · Override audit with loss notices
**Effort** M · **In the code today** partial (hidden and ticked-off items listed with Unhide; splits, merges and set-aside courses not) · **Skeptic** value 2/5, feasibility 5/5, defer, v1.1 · **Lenses** 1

Options shows hidden items only. Add an audit of every correction the student has made — splits and forced merges with the titles they bind (resolved from `raw` via memberKey), disabled courses with their row counts, hidden rows — each with one-click undo.

- *Why:* G3 budgets two corrections a semester on the premise that a correction sticks. docs/sourceid-decision.md already admits that a rename loses 'any hide/merge/split on it' and can re-fire notifications…
- *Touches:* dedupe.ts RetentionResult (+droppedOverrides, +dangling keys); sync.ts SyncResult; store.ts notices field + migrate; messages.ts options-state (+titles resolved from raw); background.ts…
- *House-rule hazards:* Worker rule 4: undo/re-apply writers must go through mutate()/the queue. Worker rule 5: log 'nothing lost' as well as losses.
- *Audit correction:* There is no 'sync log' to land a notice in — only console.log (background.ts:222-227); a store field is needed.
- *Strongest objection:* G3 budgets ≤2 corrections a semester, so the audit lists ~2 rows. Pruning an override on a purged key is correct, so a notice about it is noise…

### I78 · Recent Canvas announcements panel, deliberately unparsed
**Effort** M · **In the code today** missing · **Skeptic** value 2/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

An "Announcements" tab in the full view listing the last ~10 Canvas announcements across active courses (course, title, posted time, link). Titles containing "extended", "postponed", "moved", "due" or a date pattern are highlighted, so "MP3 extended to Friday" sits one tab away from the MP3 row that still says Thursday. No date is extracted and no item is ever changed by it.

- *Why:* §1's own example ("MP3 extended to Friday") lives in announcements the parsers cannot turn into a date; the honest v1 move is to show the announcement, not interpret it.
- *Touches:* canvas.ts (second pure mapper over planner rows, or announcements endpoint + isLoginResponse), sync.ts syncCanvas, types.ts/store.ts (new field + migrate + retention purge)…
- *House-rule hazards:* Parser 6: highlighting 'due'/'moved'/'extended' is substring marker matching by design; scope to title only and anchor on word boundaries.
- *Audit correction:* Nothing false. Note 'a new tab in the full view' means adding a tab UI that does not exist; the full view is the same popup.html rendered in a browser tab (popup.ts:287).
- *Strongest objection:* Canvas already emails and dashboards every announcement; a second, unparsed inbox in a deadline list is scope creep.

### I84 · University Housing and dining deadlines from the public campus .ics feed
**Effort** M · **In the code today** missing · **Skeptic** value 2/5, feasibility 4/5, defer, v1.1 · **Lenses** 1

calendars.illinois.edu publishes a public .ics per calendar. https://calendars.illinois.edu/icalGmail/7523.ics (University Housing Important Dates, 39 VEVENTs — fetched today) contains "Deadline to change Fall 2026 meal plan" Sep 19, "Deadline to request a room change for Fall 2026" Nov 11, "Deadline to apply for fall break housing" Nov 20, halls close Nov 21 / Dec 18…

- *Why:* The meal-plan change deadline is nine days from today and the returning-resident intent deadline (11:59 PM in late October last cycle) each cost real money when missed; both are announced by one email.
- *Touches:* New core/ics-read.ts (RFC 5545 unfold + VEVENT parse, pure), a new Source member fanning into store.ts ALL_SOURCES/defaultStatus, dedupe.ts SOURCE_RANK, popup.ts SOURCE_LABEL/LOGIN_URL + 'UIUC' chip…
- *House-rule hazards:* Parser 5 exactly: `DTSTART;VALUE=DATE:20260919` is a bare date; Date.parse lands it 7 PM the previous day; route through wallClockToIso in America/Chicago and set timeAssumed like site.ts:200 (worker…
- *Audit correction:* No manifest change is needed (existing optional `*.illinois.edu`). 'S' undercounts: there is no ICS reader at all, and a sixth Source member touches six Record<Source> tables plus the popup chip and…
- *Strongest objection:* The verified feed has 7 'Deadline' events in a year, none course-related, all already emailed and nagged by MyHousing; most residents never change a meal plan.


## Tier 2 — compact entries


- **I42 · Google Calendar sync via chrome.identity (v1.1 row, brought forward as opt-in beta)** — L, value 4/5, feasibility 3/5. Options → Calendar gets 'Connect Google Calendar'. The extension asks for `https://www.googleapis.com/auth/calendar.app.created` (create its own secondary calendar and touch only events on it), creates one calendar named 'Illini Dash'… *Why:* A moved deadline is the case the .ics cannot handle: the course extends MP2 to Friday, the extension sees it within 30 minutes, and the student's phone calendar still says Wednesday. *Spec tension:* CONFLICT, labelled: §1 out-of-scope row 'Google Calendar OAuth sync — submit for verification during v1, ship in v1.1' (the spec's own plan, so this is scheduling… *Objection:* getAuthToken only uses the Chrome profile's signed-in account: a student signed into Chrome as @illinois.edu on a tenant that blocks unverified apps cannot pick personal Gmail…
- **I53 · Sync settings and overrides across Chrome profiles via storage.sync (items stay local)** — M, value 2/5, feasibility 4/5. Mirror the small, portable parts of the store — settings, overrides (hidden/split/merge memberKeys, disabled courses), enabledAdapters and per-source enabled flags — into `chrome.storage.sync`, and merge inbound `onChanged` events into local through the store queue. *Why:* Chrome already installs the extension on every profile-synced machine (dorm desktop, laptop, Grainger/EWS lab PCs); today each one starts with default settings and no corrections… *Spec tension:* CONFLICT with the literal text of §0 decision 1 ('All data lives in chrome.storage.local. *Objection:* Overrides ride Google's sync servers, so 'nothing leaves the browser' becomes false and the listing/privacy text must change for a population nobody has measured.
- **I70 · Subscribable .ics feed published to the student's own Google Drive** — L, value 3/5, feasibility 2/5. Honest evaluation of §1's 'needs a URL, which needs a server'. The student's Drive can be the server: with the non-sensitive `drive.file` scope the extension creates one file it owns (`illini-dash.ics`), rewrites it after each sync, sets a link-share permission once… *Why:* iPhone + Apple Calendar and Outlook users have no live path at all today, and an Apple subscription polling every 5-15 minutes would give them near-live deadlines including extensions. *Spec tension:* §1 out-of-scope row 'Subscribable .ics feed — needs a server' (the student's Drive is the server, so the reason no longer holds, but the row must be consciously reopened). *Objection:* It uploads the deadline list to a link-shared Drive file, breaking §0.1 verbatim, and needs identity permission, a Google Cloud OAuth client and a published consent screen.
- **I76 · Content script writing real due dates onto Canvas's dateless LTI rows** — L, value 3/5, feasibility 3/5. On canvas.illinois.edu/courses/{id}/assignments (and the modules page), rows like 'Homework 3' that Canvas shows with no date get an injected 'due Thu 11:59 PM · PrairieLearn' link taken from the extension's own store, and the course card gets '2 due this week'. *Why:* This is the most UIUC-specific pain in the repo: docs/canvas-findings.md shows 0 of 67 Canvas assignments on this account carry a due_at because they are external_tool shells for PrairieLearn… *Objection:* Evidence is one account (CS 357's 66 LTI shells). Matching Canvas titles to PL by tokens is exactly the false-merge risk G3 guards…
- **I77 · On-page 'Upcoming across everything' strip on the four sites' home pages** — M, value 3/5, feasibility 4/5. A content script injected into the Canvas dashboard, the PrairieLearn /pl/ home, the Gradescope dashboard and the PrairieTest /pt/ home renders a small shadow-DOM strip at the top of the page: the next five deadlines from all sources with their CV/GS/PL/PT/WEB labels, an "N exams not booked" line… *Why:* Every single-site helper students already install lives on the page, because that is where they are; none can show the other sites. *Objection:* It duplicates the popup into four host pages the student must submit on; a layout collision or stale-store bug now breaks the page you submit from…
- **I52 · Point-and-click selector picker on the live course page** — L, value 2/5, feasibility 3/5. From the popup, on a course page the student already has open: "Pick deadlines on this page". A content script overlays the page; the student clicks one assignment title, then its date; the picker walks up to the common row ancestor… *Why:* This is the bottleneck named in the brief: each adapter needs a logged-in capture and hand-written selectors, and many schedule pages (CS 424's `secure/schedule.html`… *Spec tension:* Not a §0 conflict (output is data; §0.4 holds), but it touches §2.3: needs the `scripting` permission plus `activeTab` — neither is on §2.3's never-list (`<all_urls>`, `tabs`… *Objection:* Selector generalisation is the unsolved part: CS 424 needed `td:not(.auto-style6)`; a two-click generator emits nth-child, which house rule 3 forbids.
- **I87 · renders:'client' flag plus visit-time content-script fallback** — L, value 2/5, feasibility 3/5. Registry entries may declare `renders: "client"`. The options row then says "this site builds its schedule in the browser; Illini Dash reads it when you open the page" and, if the student opts in, the extension registers a content script for that adapter's already-granted origin. *Why:* CS 225 fa26 (`/cs225/fa2026/assignments/`) renders assignment cards client-side — an unauthenticated fetch shows placeholder tokens and no dates… *Spec tension:* §0.4 holds (bundled script, adapter stays data). Touches §2.3: `chrome.scripting.registerContentScripts` needs the `scripting` permission (not on §2.3's never-list… *Objection:* CS 225 submits every MP, lab and POTD on PrairieLearn, which the extension already parses, so the flagship case is largely covered.
- **I83 · Moodle (learn.illinois.edu): enrolment probe, then a timeline adapter if testers hit it** — M, value 2/5, feasibility 3/5. Moodle is alive in September 2026: learn.illinois.edu serves the Moodle home page, ATLAS states "Learn@Illinois is NOT being retired", and it runs inside Canvas via the Moodle-LTI tool for quizzes, peer review and the appointment scheduler. *Why:* A Moodle quiz launched from Canvas is one more undated LTI shell in the planner: a course that keeps its weekly quiz in Moodle-in-Canvas has no visible deadline in this extension and a green dot. *Spec tension:* Touches SPEC §1 out-of-scope row 'Moodle (learn.illinois.edu)' — the probe is not a source and produces no items… *Objection:* Since the Canvas mandate, Moodle activities surface via LTI inside Canvas, and the in-Canvas instance may not share learn.illinois.edu's session.
- **I81 · smartPhysics prelectures and checkpoints (PHYS 211-214)** — M, value 3/5, feasibility 3/5. smart.physics.illinois.edu is live (verified 2026-09-10: it hands off to the ATLAS LAS-SSO gateway lassso.las.illinois.edu, so it is a cookie session on an *.illinois.edu host) and hosts the prelecture / checkpoint / homework list for PHYS 211, 212, 213 and 214. *Why:* PHYS 211–214 are required for every Grainger student and each has two or three smartPhysics items a week due 8:00 AM the morning of lecture ("must be completed before 8:00 am the day of the lecture"… *Objection:* Prelectures fall on every lecture day at a fixed 8 AM, so students run on habit, not a list, and the lowest few are usually dropped.
- **I85 · Queue @ Illinois: 'office hours open now' on the course row** — M, value 3/5, feasibility 3/5. queue.illinois.edu is the campus office-hours queue (open source, illinois/queue). Its API under https://queue.illinois.edu/q/api/ answers to the Shibboleth session cookie (verified today: 401 without it): GET /api/queues lists open queues with course, location and question count… *Why:* The deadline and the help live on different screens. A student stuck on MP3 at 9 PM does not know whether the queue is open without opening it, and by the time they look there are 40 people ahead. *Objection:* Not a deadline. Live queue state is useless on a 30-min loop and impolite at 1-min; the Queue already gives each course its own page one click away.
- **I80 · Section seat-status watch for registration season** — M, value 3/5, feasibility 3/5. In Options, let the student paste CRNs or pick sections of a course they already have. Every 15 minutes during Nov 2 – Jan 19 fetch the public per-CRN XML https://courses.illinois.edu/cisapp/explorer/schedule/2027/spring/{SUBJ}/{NUM}/{CRN}.xml (about 2 KB… *Why:* Every November students hand-write Discord bots to poll Course Explorer for a seat in CS 374 or ECE 391, and everyone else refreshes manually for days. *Spec tension:* §1 out-of-scope row: "Course Explorer seat alerts — separate feature, separate timing (November). *Objection:* A seat flip is a state change, not a deadline, and it has no dueAt. The §4.2 15-minute floor loses the race to Coursicle and student bots polling every 30s…
- **I79 · Spring 2027 registration dates and personal time ticket** — L, value 3/5, feasibility 3/5. Two layers. Static, shippable now: "Priority registration for Spring 2027 begins Mon Nov 2, 2026" and "Open registration Thu Nov 19" as campus rows, plus a "Spring 2027 schedule is live in Course Explorer" row the day https://courses.illinois.edu/cisapp/explorer/schedule/2027/spring.xml stops… *Why:* A time ticket is a start, not a deadline, which is exactly why students miss it: nothing nags. Registering four hours late on Nov 3 is the difference between a seat in CS 374 and a waitlist. *Spec tension:* §0 rule 2 holds (the extension never logs in; it reads a session the student already opened), but the Banner endpoint path and its JSON shape are VERIFY… *Objection:* Time tickets are a start, not a deadline, and the registrar emails them. The Banner endpoint/JSON is unverified…
- **I65 · Canvas current score on the course chip** — M, value 3/5, feasibility 4/5. The options page's Courses list and the popup's course-chip tooltip show Canvas's computed current score per course ("PHYS 435 · 91.3% (A-)"), refreshed on every sync. *Why:* Non-CS UIUC courses (PHYS, MATH, CHEM, gen-eds) keep grades in Canvas, and the student's "am I okay in this class" check is one Canvas grades page per course. *Objection:* Grades are not deadlines: this is the first step off 'every deadline in one list'.
- **I58 · Course colours on the chip from the student's Canvas colours** — M, value 3/5, feasibility 4/5. Each course chip gets a colour: by default a stable hue hashed from `courseCode`, and when Canvas is enabled the exact colours the student already assigned in their Canvas dashboard (`GET /api/v1/users/self/colors`, keyed `course_{id}`). *Why:* Every chip is the same grey outline (`.chip`, popup.css:27-30), so a 25-row list is scanned by reading text. *Spec tension:* §0 decision 6 (ship ugly) — arguably polish; but it is a scanning aid, not styling. *Objection:* It is styling, and §0-6 says polish is v1.1. Hashed hues in a 5-course popup collide or fail contrast; Canvas colours are keyed course_{id} so the chip needs an id→courseCode map…
- **I15 · Week grid in the full view, with a printable week** — L, value 2/5, feasibility 4/5. A "Week" toggle in the ⤢ full view renders a Mon–Sun grid with each deadline placed at its hour, PrairieTest session windows drawn as shaded spans across their days, PL credit-tier drops as small markers on the same row, and the 24h/2h reminder moments as ticks. *Why:* Two of the four sources produce ranges, not instants: CBTF windows (Sep 8–10) and PL tiers (100%→80%→50%). *Spec tension:* §0 decision 6 ("Ship ugly; design polish is v1.1") — flag as v1.1 material, though it is a layout, not polish. Does not touch the §1 calendar-sync rows (no OAuth, no feed). *Objection:* Nearly every UIUC deadline is 11:59 PM, so an hour grid stacks everything in one row; day columns duplicate the existing Today/Tomorrow/This week sections.
- **I63 · Credit-at-stake ordering within a day** — M, value 2/5, feasibility 3/5. Within Today and Tomorrow, rows sort by what missing them costs and print it: PrairieLearn from the ladder ("−20% at 11:00 AM, −50% by Sep 22", or "closes for good" when the next tier is 0), Canvas from points_possible ("100 pts"), Gradescope by time as now (its course page carries no points). *Why:* On Sep 8 in the real CS 357 fixture, L4a (100 → 80 → 50 → 0: lose 20% at 11 AM), PQ1 (100 → 0: closes for good at 11:59 PM) and S1 group selection (100 → 0) all render as plain "Tue" rows sorted by… *Objection:* The ladder exists only for PrairieLearn; Canvas points are not fetched and plannable.points_possible is unverified; Gradescope has none.
- **I69 · Per-course .ics files with a calendar name** — S, value 2/5, feasibility 5/5. Turn the single 'Download .ics' into a picker: 'All courses' or one course (from the same `CourseSummary` list Options already renders), producing `illini-dash-CS357.ics` with `X-WR-CALNAME:Illini Dash — CS 357` and `CATEGORIES:CS 357` on each event. *Why:* A very common student setup is one Google/Apple calendar per course, each its own colour, so the week reads at a glance. *Objection:* The .ics is a one-time copy (§8.3 says so in the UI); N per-course files make staleness N times worse and re-import N times more tedious.
- **I74 · Hold catch-up reminders while the screen is locked** — S, value 2/5, feasibility 3/5. Reminders that come due while the machine is locked or idle (the 08:00 batch deferred out of quiet hours, a 2h lead that lands over lunch) are held and fired the moment the student becomes active again, unless the deadline is within 30 minutes, in which case they fire regardless. *Why:* shouldFireNow fires every overdue plan at whatever instant the worker wakes (background.ts:257), and quiet hours default to 23:00–08:00, so the common morning case is: lid opens at 08:00 on the desk… *Objection:* The batch that fires at a locked 08:00 screen is only the 24h leads deferred out of quiet hours — low urgency, and macOS Notification Center keeps them anyway.
- **I75 · Omnibox keyword 'due <course>'** — M, value 2/5, feasibility 5/5. Typing 'due' then a space in Chrome's address bar turns it into an Illini Dash search: 'due 357' suggests 'CS357 · HW3 Errors and Big-O — Thu 11:59 PM · in 2d (PL)' and Enter opens the PrairieLearn page; 'due book' finds the unbooked CBTF exam. *Why:* The popup has no search or filter (context brief), so with 40+ rows across five sections a student scrolls to find one item; and opening a specific submission page today means popup → scan → click. *Objection:* Omnibox keywords are undiscoverable; the 'grade'+Tab reflex is URL autocomplete, not a keyword, so the analogy fails. The live run had ~20 rows, one flick in a 400px popup.
- **I39 · Reminder inbox with missed reminders and unread badge** — M, value 2/5, feasibility 5/5. A bell in the popup header opens a list of the last ~50 reminders: when each fired, what it said, whether it was deferred by quiet hours, and — new — reminders that were skipped because Chrome was closed past the deadline ("Missed: 2h reminder for CS 424 MP1, Chrome was closed"). *Why:* macOS shows a Chrome toast for about five seconds and macOS Focus / Windows Focus Assist swallow it entirely with no API for the extension to know… *Objection:* The question a student actually has after a swallowed toast is 'what is due', and the popup already answers it: an item whose reminder was lost still sits in Today…


## Rejected


- **I86 · Library loan due dates (Primo VE)** — L, value 1/5, feasibility 2/5. The University Library catalog is Primo VE at i-share.carli.illinois.edu; loans appear under My Account -> Loans with due dates, renew buttons, and an I-Share block after 21 days overdue. *Why:* Overdue fines and I-Share blocks are small but real, and course-reserve textbooks have due times measured in hours. *Spec tension:* §0 rule 2 is touched if the content script must read a JWT out of storage — the same grey area as zyBooks; if the endpoints accept the cookie session instead, none. *Objection:* UIUC Primo VE lives on i-share-uiu.primo.exlibrisgroup.com, not *.illinois.edu, so the optional grant does not cover it: a new host permission, a content script…
- **I88 · Day-7 beta check-in card opening a prefilled GitHub issue** — S, value 1/5, feasibility 5/5. Record `installedAt` on install. Seven days later the popup shows a dismissible card: 'You have had Illini Dash for a week. Would you keep it? [Yes] [No] [Tell us why]'. *Why:* G4's pass criterion is a number — seven of ten say they would keep it — and the repo has no way to collect it except the maintainer messaging each tester. *Objection:* G4 is ten testers the maintainer recruits by hand; a day-7 DM measures the same thing with no code, no GitHub account needed, and no card in a ship-ugly popup.


## Appendix — every idea at a glance

| id | title | tier | status | effort | value | feas. | skeptic: when | spec tension |
|---|---|---|---|---|---|---|---|---|

| I17 | Health-aware popup empty state; no green dot before a source has succe | 0a | done | S | 4 | 5 | before_beta |  |
| I16 | Honest status line and stale-data banner | 0a | done | S | 4 | 5 | before_beta |  |
| I03 | Toolbar badge: today's count, red '!' when a source is broken | 0a | done | S | 4 | 5 | before_beta |  |
| I27 | 'Can reminders reach you?' check and send-test-reminder button | 0a | done | S | 3 | 5 | before_beta |  |
| I38 | Coalesce catch-up reminder bursts and word them by real remaining time | 0a | done | M | 4 | 5 | before_beta |  |
| I01 | Deadline moved / new item markers, notification, and reminder re-arm | 0a | done | M | 4 | 4 | before_beta |  |
| I04 | Late / reduced-credit window stays live after dueAt, with reminders on | 0a | done | M | 4 | 4 | before_beta |  |
| I07 | Reduced-credit ladder and late window shown before the deadline passes | 0a | done | S | 3 | 5 | v1.1 |  |
| I06 | Show runner-assumed 23:59 times as assumed (popup, sort order, calenda | 0a | done | S | 3 | 5 | before_beta |  |
| I22 | Honest .ics / calendar link (all-day for invented times, hideSubmitted | 0a | done | M | 3 | 5 | before_beta |  |
| I41 | Morning toast instead of '2h' lead for runner-invented times | 0a | done | M | 3 | 5 | before_beta |  |
| I08 | Local 'Done' check-off, separate from Hide | 0a | done | M | 5 | 5 | before_beta |  |
| I62 | Practice / not-for-credit tagging and demotion | 0a | done | S | 4 | 5 | before_beta |  |
| I31 | Surface parser data-quality flags instead of dropping unreadable rows | 0a | done | M | 4 | 5 | before_beta |  |
| I43 | Split Options into Settings and a hidden Developer panel; fix the 'deb | 0a | done | S | 4 | 5 | before_beta |  |
| I59 | Lift backoff and resync immediately on extension update | 0a | done | S | 3 | 5 | before_beta |  |
| I49 | Adapter date grammar matching real fa26 pages (weekday prefix, at/@, 2 | 0a | done | M | 4 | 5 | before_beta |  |
| I54 | Versioned store migrations with memberKey remapping and a load-old-sto | 0a | done | M | 2 | 5 | before_beta |  |
| I30 | One-click scrubbed diagnostics bundle | 0a | done | M | 3 | 5 | before_beta |  |
| I61 | Right-click 'Report this page to Illini Dash' | 0a | done | S | 2 | 5 | before_beta |  |
| I55 | Beta install kit: packaged zip, install guide, unlisted-store decision | 0b | done | S | 4 | 5 | before_beta | yes |
| I45 | Canvas concluded-course filter via include[]=term with an 'Older cours | 0b | done | M | 3 | 4 | before_beta |  |
| I82 | Publisher-tool deadlines (Connect, Mastering, WebAssign, zyBooks): nam | 0b | missing | M | 3 | 4 | before_beta | yes |
| I46 | 'Not used by you' source state for PrairieLearn / PrairieTest | 0b | missing | M | 3 | 3 | v1.1 | yes |
| I44 | Canvas 'No date' section with an LTI-shell explanation | 0b | missing | M | 3 | 4 | v1.1 |  |
| I05 | First-run onboarding page (pin, per-source login check, per-course wha | 0b | done | M | 3 | 4 | v1.1 |  |
| I13 | Reminder toasts with Open / Snooze / Done buttons, requireInteraction  | 1 | missing | M | 4 | 3 | v1.1 |  |
| I21 | Manual deadlines as a sixth 'manual' source | 1 | done | M | 4 | 3 | v1.1 |  |
| I24 | Registrar deadlines (drop, CR/NC, refund) as shipped campus rows | 1 | missing | M | 4 | 4 | v1.1 |  |
| I60 | Page-aware popup: this course first, focus existing tab, auto-resync a | 1 | missing | M | 4 | 4 | v1.1 |  |
| I25 | Final exam time and room from Course Explorer | 1 | missing | L | 4 | 3 | v1.1 |  |
| I02 | Exam-day card on PrairieTest rows (room, duration, format) in row, toa | 1 | done | M | 3 | 5 | v1.1 |  |
| I09 | Per-course coverage table with 'request an adapter' flow | 1 | partial | M | 3 | 4 | v1.1 | yes |
| I10 | Side panel view of the same list | 1 | missing | S | 3 | 5 | v1.1 |  |
| I11 | Search box and click-a-chip course filter | 1 | missing | S | 3 | 5 | v1.1 |  |
| I14 | Done / Graded-recently section with score chips and per-source confirm | 1 | partial | L | 3 | 3 | v1.1 |  |
| I34 | Calendar dates past this week and day headings inside Later | 1 | missing | S | 3 | 5 | before_beta |  |
| I66 | Calendar export carries late and reduced-credit deadlines | 1 | missing | S | 3 | 5 | v1.1 |  |
| I67 | 'Add to Outlook' deep link | 1 | missing | S | 3 | 4 | v1.1 |  |
| I18 | Custom lead times, per-kind leads, per-course mute | 1 | partial | M | 3 | 4 | v1.1 |  |
| I19 | Per-sync change log strip ('2 new · 1 moved · 1 gone') | 1 | missing | M | 3 | 4 | v1.1 |  |
| I26 | Morning digest at the end of quiet hours | 1 | missing | M | 3 | 4 | v1.1 |  |
| I32 | Show when merged members disagree on due date or status | 1 | partial | M | 3 | 5 | v1.1 |  |
| I33 | Snooze / 'not today' defer on a row | 1 | missing | M | 3 | 5 | v1.1 | yes |
| I35 | Keyboard shortcut, arrow navigation, real links | 1 | done | M | 3 | 5 | v1.1 |  |
| I36 | 'Opens Thu 9 AM': surface release times, dim not-yet-open rows, remind | 1 | partial | M | 3 | 5 | v1.1 |  |
| I37 | A partial PrairieLearn score is not 'done' | 1 | partial | M | 3 | 4 | v1.1 | yes |
| I40 | CBTF reservation-window escalation and missed-reservation notice | 1 | partial | M | 3 | 3 | v1.1 |  |
| I47 | Per-adapter health state and N->0 guard per course site | 1 | missing | M | 3 | 5 | v1.1 |  |
| I48 | Header-anchored adapter columns and 'Due'-header autodetect | 1 | done | M | 3 | 3 | v1.1 |  |
| I51 | In-options adapter workbench with 'Propose this adapter' bundle | 1 | partial | M | 3 | 5 | v1.1 |  |
| I64 | This-week workload strip per course | 1 | missing | M | 3 | 5 | v1.1 |  |
| I71 | 'Why is this here / why isn't X here' merge-reason explainer | 1 | missing | M | 3 | 4 | v1.1 |  |
| I73 | 30-minute 'last call' only when the source still says not submitted | 1 | missing | M | 3 | 3 | v1.1 |  |
| I50 | Adapter row-context fields (rowspan carry-forward, ancestor title, per | 1 | partial | L | 3 | 4 | v1.1 |  |
| I12 | Per-row Details panel: provenance and what each parser extracted | 1 | partial | S | 2 | 5 | v1.1 |  |
| I20 | Collapsible sections that remember their state | 1 | missing | S | 2 | 5 | v1.1 |  |
| I56 | Adapter linting and golden tests in CI | 1 | partial | S | 2 | 5 | v1.1 |  |
| I68 | Copy this week as Markdown / plain text | 1 | missing | S | 2 | 5 | v1.1 |  |
| I23 | Stable .ics UID across merges plus SEQUENCE | 1 | partial | M | 2 | 4 | v1.1 |  |
| I28 | Keep reminders working past Chrome's 500-alarm cap | 1 | missing | M | 2 | 5 | v1.1 |  |
| I29 | Import JSON (restore corrections / load a snapshot) | 1 | missing | M | 2 | 5 | v1.1 |  |
| I57 | Term rollover: term dates in the registry, Expired section, fa26->sp27 | 1 | partial | M | 2 | 5 | v1.1 |  |
| I72 | Override audit with loss notices | 1 | partial | M | 2 | 5 | v1.1 |  |
| I78 | Recent Canvas announcements panel, deliberately unparsed | 1 | missing | M | 2 | 4 | v1.1 |  |
| I84 | University Housing and dining deadlines from the public campus .ics fe | 1 | missing | M | 2 | 4 | v1.1 |  |
| I42 | Google Calendar sync via chrome.identity (v1.1 row, brought forward as | 2 | done | L | 4 | 3 | v1.1 | yes |
| I53 | Sync settings and overrides across Chrome profiles via storage.sync (i | 2 | missing | M | 2 | 4 | v2 | yes |
| I70 | Subscribable .ics feed published to the student's own Google Drive | 2 | missing | L | 3 | 2 | v2 | yes |
| I76 | Content script writing real due dates onto Canvas's dateless LTI rows | 2 | missing | L | 3 | 3 | v2 |  |
| I77 | On-page 'Upcoming across everything' strip on the four sites' home pag | 2 | missing | M | 3 | 4 | v1.1 |  |
| I52 | Point-and-click selector picker on the live course page | 2 | missing | L | 2 | 3 | v2 | yes |
| I87 | renders:'client' flag plus visit-time content-script fallback | 2 | missing | L | 2 | 3 | v2 | yes |
| I83 | Moodle (learn.illinois.edu): enrolment probe, then a timeline adapter  | 2 | missing | M | 2 | 3 | v2 | yes |
| I81 | smartPhysics prelectures and checkpoints (PHYS 211-214) | 2 | done | M | 3 | 3 | v1.1 |  |
| I85 | Queue @ Illinois: 'office hours open now' on the course row | 2 | missing | M | 3 | 3 | v2 |  |
| I80 | Section seat-status watch for registration season | 2 | missing | M | 3 | 3 | v1.1 | yes |
| I79 | Spring 2027 registration dates and personal time ticket | 2 | missing | L | 3 | 3 | v1.1 | yes |
| I65 | Canvas current score on the course chip | 2 | missing | M | 3 | 4 | v2 |  |
| I58 | Course colours on the chip from the student's Canvas colours | 2 | partial | M | 3 | 4 | v1.1 | yes |
| I15 | Week grid in the full view, with a printable week | 2 | partial | L | 2 | 4 | v2 | yes |
| I63 | Credit-at-stake ordering within a day | 2 | missing | M | 2 | 3 | v2 |  |
| I69 | Per-course .ics files with a calendar name | 2 | missing | S | 2 | 5 | v2 |  |
| I74 | Hold catch-up reminders while the screen is locked | 2 | missing | S | 2 | 3 | v2 |  |
| I75 | Omnibox keyword 'due <course>' | 2 | missing | M | 2 | 5 | v2 |  |
| I39 | Reminder inbox with missed reminders and unread badge | 2 | missing | M | 2 | 5 | v2 |  |
| I86 | Library loan due dates (Primo VE) | rejected | rejected | L | 1 | 2 | never | yes |
| I88 | Day-7 beta check-in card opening a prefilled GitHub issue | rejected | rejected | S | 1 | 5 | never |  |
