# Graph Report - illini-due  (2026-09-21)

## Corpus Check
- 269 files · ~1,018,294 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .css 13, (none) 5, .woff2 2)

## Summary
- 3392 nodes · 9062 edges · 155 communities (143 shown, 12 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 880 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `44f309cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
- PrairieTest — what the fetched HTML actually contains
- UX plan for the store release
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- course-sites.ts
- manifest.json
- offscreen-client.ts
- options.ts
- month.ts
- Canvas — what the API actually returns
- applyStoredTheme
- parseAdapterDateParts
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- piazza.ts
- The design
- announce.ts
- manifest.test.ts
- Popup feature inventory
- rows.ts
- options.html: Settings page
- background.ts
- core/registry.ts
- types.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- names.ts
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- announce-real.test.ts
- health.ts
- ref_node_path
- screens/editor.ts
- table-grid.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gradescope.ts
- gcal-config.ts
- gate0.ts
- gcal.ts
- shell.ts
- RawItem
- renderOptions
- scrub.ts
- devDependencies
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- Installing Illini Dash (beta)
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- theme-panel.ts
- Mutation check
- Campuswire fixtures
- describeEmpty
- suggest.ts
- diagnostics.ts
- sources.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- Popup UI (§8.1)
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- provenance.test.ts
- The colour layer
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- deadline.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Gradescope fixtures provenance
- sync.ts
- resolveMentions
- markers.ts
- Defect: a Gradescope course labelled stat_425_120248_268442
- 2. Findings, ranked
- row-order.test.ts
- Illini Dash UI acceptance
- graphify reference: extra exports and benchmark
- Sync loop runSync (§6)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- announce.test.ts
- ground
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- Tier 1: highest value after the beta, no spec change
- ui-acceptance.mjs
- propose.mjs
- Asking Sushi for a browser action
- graphify reference: query, path, explain
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- options-dom.test.ts
- Asking Sushi for a browser action
- `fixtures/sites/` — the course pages the §4.5 runner is tested against
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- Auto-merge rule (§5.3)
- Piazza — what the live client actually does (2026-09-18)
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- ui-acceptance.test.mjs
- icons.mjs
- build.mjs
- vitest
- package.json
- UI acceptance reference contract
- scrub-file.mjs
- Source
- Google Stitch prompt — Illini Dash popup
- dedupe
- graphify reference: transcribe video and audio
- ref_node_fs
- ui-browser.mjs

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 82 edges
2. `Item` - 65 edges
3. `vitest` - 63 edges
4. `Z. Test files that pin popup behaviour` - 61 edges
5. `runAdapter()` - 46 edges
6. `RawItem` - 45 edges
7. `Source` - 44 edges
8. `icon()` - 37 edges
9. `validateAdapter()` - 34 edges
10. `renderRow()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can` --references--> `applyOverride()`  [INFERRED]
  docs/design/review-r3.md → src/background.ts
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .agents/skills/capture-ask/SKILL.md → src/capture.ts
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `M6 — PROGRESS's "redundant" classification for `dayList`'s title tie-break is wrong; the case is *untested*` --references--> `dayList()`  [INFERRED]
  docs/design/review-r3.md → src/core/calendar.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **validateAdapter trust-boundary rules** — docs_adapters_url_https_illinois_edu, docs_adapters_hostpattern_exact_match, docs_adapters_dateformat_closed_set, docs_adapters_bad_entry_dropped_file_kept, docs_adapters_splittitle [EXTRACTED 1.00]
- **timeAssumed honesty across popup, sort, calendar and reminders** — docs_roadmap_ideas_i06, docs_roadmap_ideas_i22, docs_roadmap_ideas_i41, docs_roadmap_ideas_i49, src_core_dedupe_builditem, src_core_schedule_plannotifications, src_core_ics_event [EXTRACTED 1.00]
- **Health that never lies: dots, status line, badge, per-adapter state** — docs_roadmap_ideas_i17, docs_roadmap_ideas_i16, docs_roadmap_ideas_i03, docs_roadmap_ideas_i47, docs_roadmap_ideas_i46, src_core_store_defaultstatus [EXTRACTED 1.00]
- **Never-signed-in 200 responses need a positive signed-out marker** — fixtures_gradescope_readme_signed_out_html, fixtures_gradescope_readme_js_loginbutton_marker, fixtures_prairietest_readme_signed_out_html, fixtures_prairietest_readme_pl_auth_handoff_marker, src_core_parsing_looksloggedout [EXTRACTED 1.00]
- **Spec amendments forced by real data (parser rule 9: the capture beats the spec)** — claude_parser_rule_9_capture_beats_spec, progress_amendment_canvas_course_code_slug, progress_amendment_no_while1_prefix, progress_amendment_prairielearn_credit_table, progress_amendment_prairietest_links_json_dates, progress_amendment_gradescope_button_row, progress_amendment_assumed_time_last_resort, progress_amendment_badge_token_merge, progress_amendment_hide_keyed_by_memberkeys [EXTRACTED 1.00]
- **Gates G0–G5, in order; do not proceed past a failed gate** — spec_gate_g0_auth_fetch, spec_gate_g1_fixtures_parsers, spec_gate_g2_recall, spec_gate_g3_dedupe, spec_gate_g4_beta, spec_gate_g5_store [EXTRACTED 1.00]
- **§0 decisions that are not up for debate in v1** — spec_decision_no_backend, spec_decision_no_credential_handling, spec_decision_parsers_fail_loudly, spec_decision_declarative_adapters_only, spec_decision_chrome_only, spec_decision_ship_ugly [EXTRACTED 1.00]
- **Stable sourceId amendment across the four sources** — docs_sourceid_decision_memberkey_stability, docs_sourceid_decision_gradescope_key, docs_sourceid_decision_prairielearn_badge_key, docs_sourceid_decision_prairietest_title_hash_key, docs_gradescope_findings_row_control_changes_on_submit, docs_prairielearn_findings_assessment_instance_link, docs_prairietest_findings_reservation_id_not_exam [EXTRACTED 1.00]
- **UX plan phases A-G** — docs_ux_plan_phase_a, docs_ux_plan_phase_b_primitives, docs_ux_plan_phase_c_popup_ia, docs_ux_plan_phase_d_settings, docs_ux_plan_phase_e_first_run, docs_ux_plan_phase_f_notifications, docs_ux_plan_phase_g_store [EXTRACTED 1.00]

## Communities (155 total, 12 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.08
Nodes (42): 4. Course-site adapters, 8. Storage, isOlderThan(), guessCourseCode(), isInstant(), ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES (+34 more)

### Community 1 - "ParseError"
Cohesion: 0.11
Nodes (38): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex), Shared parser primitives (src/core/parsing.ts), monthIndex(), FieldResult, KeyGuard (+30 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.12
Nodes (29): Row control changes on submit: <a href> vs button data-assignment-id, Status from div.submissionStatus--text, ignore colour modifiers, PrairieLearn — what the fetched HTML actually contains, Row link becomes /assessment_instance/{iid} once started, Credit schedule in data-bs-content popover, second DOMParser pass, 0-credit row End is an em dash meaning no end, Access table has a header row and no tbody; select rows with td, lateDueAt only from a next tier with credit above 0 (+21 more)

### Community 3 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (92): 7. Health, notifications, calendar, 3. Mutation table, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L9 — `countdown` says "1d late" for something two hours late, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, agendaRows() (+84 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.15
Nodes (22): applyRetention(), badgesOf(), carryNotified(), contradictsDone(), courseCodesOf(), datesCompatible(), DedupeOptions, effectiveInstant() (+14 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (36): House rules for mutation checks, A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+28 more)

### Community 8 - "schedule.ts"
Cohesion: 0.11
Nodes (34): House rules for the worker and the loop, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, W. What lives in Options, not the popup, I27 · 'Can reminders reach you?' check and test-reminder button, I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, store-toast.png is a composite, not a screenshot, Defect: the store queue deadlocked (+26 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.08
Nodes (29): CourseGroup, courseGroupsForYou(), courseKeysOf(), emptyCourseGroup(), finishGroup(), groupHasCourse(), Response, AdapterEntry (+21 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "offscreen-client.ts"
Cohesion: 0.11
Nodes (24): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), check() (+16 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (31): MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, downloadFile(), downloadIcs(), itemsToExport(), addSiteUrl, captureButton (+23 more)

### Community 13 - "month.ts"
Cohesion: 0.09
Nodes (38): 9.2 The five tabs, Exams — everything you have to turn up to, Month — two drawings of one month, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards, 1. Counts, 3. Every non-PRESERVED item (+30 more)

### Community 14 - "Canvas — what the API actually returns"
Cohesion: 0.12
Nodes (24): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+16 more)

### Community 15 - "applyStoredTheme"
Cohesion: 0.22
Nodes (11): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), applyMode() (+3 more)

### Community 16 - "parseAdapterDateParts"
Cohesion: 0.14
Nodes (24): Open: course sites split across pages, Parallelism policy, Parser rule 3: never index cells positionally, Trace the path, not just the file, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Adapter.columns — header-driven column lookup (+16 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), textOf(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.17
Nodes (20): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+12 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.20
Nodes (16): Parser rule 5: typeof x === 'string' is not validation, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Gradescope datetime attribute format, Open questions (§12), parseLocalDate(parts, zone) helper (+8 more)

### Community 20 - "site.ts"
Cohesion: 0.05
Nodes (63): A survivor sometimes indicts the design, 3. Where the date comes from, How the date is read out of the located text, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, 3. Where the date comes from, How the date is read out of the located text, The lectures page, and why it is a fixture and not an entry (+55 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.13
Nodes (20): Six-stage execution, Icons, Implementation completed in candidate 1, Piazza and Campuswire on the front, Popup and five reference views, Preview and acceptance truthfulness, Settings, Shared visual system (+12 more)

### Community 23 - "icon"
Cohesion: 0.09
Nodes (36): 10. Permissions, Y. Every DOM id and class the popup writes, END_OF_DAY_HEADING, LATE_HEADING, ExamPlacement, reservationVerified(), bookMark(), icon() (+28 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (43): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+35 more)

### Community 25 - "piazza.ts"
Cohesion: 0.04
Nodes (104): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it" (+96 more)

### Community 26 - "The design"
Cohesion: 0.20
Nodes (11): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+3 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (52): addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+44 more)

### Community 28 - "manifest.test.ts"
Cohesion: 0.14
Nodes (10): SOURCE_ORIGIN, sourceForUrl(), REGISTRY_URL, GRADESCOPE_ORIGIN, PRAIRIETEST_ORIGIN, build, justifications, listing (+2 more)

### Community 29 - "Popup feature inventory"
Cohesion: 0.10
Nodes (18): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, Contents, F. Course filter chips, H. The row (+10 more)

### Community 30 - "rows.ts"
Cohesion: 0.12
Nodes (27): AttentionName, courseColours(), coursesIn(), examDetail(), DATE_FLAGS, QualityFlag, qualityFlags(), SOFT_FLAGS (+19 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (31): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), Reporting a broken page uploads nothing, PII and authentication not collected, #back plain link to popup.html?view=full (+23 more)

### Community 32 - "background.ts"
Cohesion: 0.10
Nodes (36): Decisions worth not re-litigating, applyObserver(), applySettings(), deps, ensureObservers(), gcalClientId(), gcalEventFor(), gcalPush() (+28 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.08
Nodes (32): 4. The date grammar, 4. The date grammar, I57 · Term rollover: term dates in the registry, Expired section, allAdapters(), enabledAdapters(), BUILD_ID, EXTENSION_VERSION, ADAPTER_KINDS (+24 more)

### Community 34 - "types.ts"
Cohesion: 0.11
Nodes (36): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+28 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.19
Nodes (14): ALL_GCAL_STATES, describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+6 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "names.ts"
Cohesion: 0.32
Nodes (9): fullStamp(), LOGIN_URL, SOURCE_CODE, SOURCE_HOME, SOURCE_NAME, SOURCE_TITLE, STATE_PHRASE, STATE_WORD (+1 more)

### Community 38 - "detect.ts"
Cohesion: 0.05
Nodes (73): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say (+65 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.21
Nodes (14): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (21): adapters, courses, dataset, gcalState, item(), items, listeners, manualRaw (+13 more)

### Community 42 - "announce-real.test.ts"
Cohesion: 0.22
Nodes (8): EmptyReason, ReadMention, PostPayload, EMPTY, Expected, HTML, mentionsOf(), POSTS

### Community 43 - "health.ts"
Cohesion: 0.12
Nodes (32): Structural decisions, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, Z. Test files that pin popup behaviour, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, AlertsInput, Badge (+24 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.10
Nodes (38): L5 — Two round trips with no popup-side log line, and one with no caption., D. Banners, O. The editor (manual items), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions (+30 more)

### Community 46 - "table-grid.ts"
Cohesion: 0.29
Nodes (12): columnOf(), directCells(), formTableGrid(), GridCache, rowGroups(), rowIndex(), spanValue(), TableGrid (+4 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.16
Nodes (19): Decision 6: snooze amends §7's daily booking nag, I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I13 · Reminder toasts with Open / Snooze / Done buttons, I19 · Per-sync change log strip (+11 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "gradescope.ts"
Cohesion: 0.14
Nodes (21): Gradescope — what the fetched HTML actually contains, Dashboard: courseList--term, coursesForTerm, current term first, Hidden Due Date column is state-dependent; parse <time datetime>, Rows: tr containing th.table--primaryLink, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], Skip fetching courses stating 0 assignments, linkedom (+13 more)

### Community 50 - "gcal-config.ts"
Cohesion: 0.20
Nodes (9): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+1 more)

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (21): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime (+13 more)

### Community 53 - "shell.ts"
Cohesion: 0.04
Nodes (105): House rules from the ZIP acceptance pass, 2026-09-19, M8 — The setup screen's "Connected" chip outranks the source's current state., The focus mechanism, as built, A. Document shell and load-time behaviour, B. Header bar, E. Tabs and view state, R. First-run setup screen, S. Sync, refresh and liveness (+97 more)

### Community 54 - "RawItem"
Cohesion: 0.23
Nodes (20): 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+12 more)

### Community 55 - "renderOptions"
Cohesion: 0.27
Nodes (19): send(), clearRemoval(), el(), stateChip(), gcalSection(), observerRow(), pendingUndo(), plainRow() (+11 more)

### Community 56 - "scrub.ts"
Cohesion: 0.20
Nodes (9): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.09
Nodes (20): answer(), bands(), document, globals, gridHues(), hueOf(), items, legendHues() (+12 more)

### Community 61 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+15 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (78): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The inventory sketches one row's insides, The manifest needs no new permission (+70 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.12
Nodes (19): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Illini Dash ZIP UI acceptance handoff, Important files to resume from, Independent review results, Interaction review: four product findings and one harness gap, Objective and authority (+11 more)

### Community 64 - "ics.ts"
Cohesion: 0.27
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 65 - "piazza-real.test.ts"
Cohesion: 0.14
Nodes (14): Evidence and completion, PostBody, PostPayload, EXPECTED, FEED, ingest(), NO_OVERRIDES, notes() (+6 more)

### Community 66 - "needs_login detection"
Cohesion: 0.13
Nodes (23): Open: Coursera for the online CS courses, Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed (+15 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.14
Nodes (17): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+9 more)

### Community 68 - "theme-panel.ts"
Cohesion: 0.13
Nodes (35): menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName() (+27 more)

### Community 69 - "Mutation check"
Cohesion: 0.13
Nodes (12): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo), Always assert the match count, Mutation check (+4 more)

### Community 71 - "describeEmpty"
Cohesion: 0.12
Nodes (15): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+7 more)

### Community 72 - "suggest.ts"
Cohesion: 0.09
Nodes (37): Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, itemOfManual(), courseColour(), courseGroup(), courseNumber() (+29 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.29
Nodes (9): buildDiagnostics(), Diagnostics, hoursSince(), scrubError(), SourceDiagnostics, Settings, input(), NOW (+1 more)

### Community 74 - "sources.ts"
Cohesion: 0.21
Nodes (19): Worker rule 2: a green dot must mean 'I fetched, and it was fine', 9.3 The four screens, Notes on items classified PRESERVED that moved, C. Health pill and source popover, Defect: 'couldn't be read' for both parse and network failures, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items), Per-source health indicator (+11 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.22
Nodes (13): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I42 · Google Calendar sync via chrome.identity, I52 · Point-and-click selector picker on the live course page, I53 · Sync settings and overrides via storage.sync (+5 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (54): The summary has to show a list, not mention one, PLACEHOLDER, rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector(), bestDated() (+46 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.16
Nodes (17): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold (+9 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.18
Nodes (6): availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "illini-dash"
Cohesion: 0.12
Nodes (16): Also open, Check it in the mode Sushi actually uses, Development loop, graphify, HANDOFF — 2026-09-13, updated 2026-09-18, House rules for the UI, and for diagnosing it, illini-dash, Parallelism (+8 more)

### Community 80 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 81 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 82 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 83 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 84 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.13
Nodes (20): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Evidence first, Honest completion, Illini UI acceptance, Development loop (dist/ as unpacked extension) (+12 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "provenance.test.ts"
Cohesion: 0.21
Nodes (15): movedText(), STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), movedRange() (+7 more)

### Community 87 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

### Community 88 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 89 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 90 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 91 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 92 - "PrairieLearn fixtures"
Cohesion: 0.50
Nodes (3): `assessments-cs357.html` — a real capture, `assessments-partial-scores.html` — **constructed, not a capture**, PrairieLearn fixtures

### Community 93 - "deadline.ts"
Cohesion: 0.06
Nodes (68): The row menu bug — found and fixed 2026-09-18, 2. Findings without an F-number, 4. Cross-worker seam checks, R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, R-4 — DEGRADED. A refusal about **Ends** or **Link** lands inside a closed `<details>`, R-5 — The committed captures are stale, and one is a 404 page (+60 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.05
Nodes (61): Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error (+53 more)

### Community 100 - "resolveMentions"
Cohesion: 0.29
Nodes (8): cleanTitle(), courseMatches(), earlier(), isGenericSubject(), itemCodes(), resolveMentions(), titleFor(), normalizeTitle()

### Community 101 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 102 - "Defect: a Gradescope course labelled stat_425_120248_268442"
Cohesion: 0.50
Nodes (5): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, Course code extraction (§5.1)

### Community 103 - "2. Findings, ranked"
Cohesion: 0.14
Nodes (13): 1. Counts, 2. Findings, ranked, 4. Timezone results, 6. The one standing check worth adding, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L14 — the suite pins no timezone, and one test defeats itself outside Chicago (+5 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.12
Nodes (10): document, globals, items, now, opened, popup, Rule, SHEETS (+2 more)

### Community 105 - "Illini Dash UI acceptance"
Cohesion: 0.40
Nodes (5): Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Sync loop runSync (§6)"
Cohesion: 0.17
Nodes (21): Parser rule 4: guard duplicate sourceIds on one page, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — PrairieTest (12 findings, all survived), Repo layout: worker is wiring, decisions live in core/, Daily booking nag, §0.5 Chrome only (+13 more)

### Community 108 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 109 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "validateAdapter"
Cohesion: 0.05
Nodes (53): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter?, 1. The capture (+45 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 118 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.11
Nodes (24): Decision 5: campus rows without a course, Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I24 · Registrar deadlines as shipped campus rows (+16 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 122 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 123 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 124 - "held-press.mjs"
Cohesion: 0.20
Nodes (13): centre(), chrome, evaluate(), heldPress(), HOLD_MS, logs, mouse(), out (+5 more)

### Community 125 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 126 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 127 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 128 - "options-dom.test.ts"
Cohesion: 0.16
Nodes (11): COURSE_KEYS, Entry, globals, Mod, nameOf(), NOTHING, page, REGISTRY (+3 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "Auto-merge rule (§5.3)"
Cohesion: 0.13
Nodes (29): When live data contradicts a document: rewrite the claim, Review policy, Chrome Web Store submission (draft, not submitted), Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Open full view reuses one tab, Review outcome — dedupe + sync (16 findings, 7 code defects) (+21 more)

### Community 134 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.22
Nodes (8): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.10
Nodes (19): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status, 3. Sources (+11 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.24
Nodes (11): isDevHash(), normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, applyDevVisibility() (+3 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.10
Nodes (33): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext (+25 more)

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 145 - "vitest"
Cohesion: 0.20
Nodes (4): vitest, { document, window }, globals, V1

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 149 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 150 - "Source"
Cohesion: 0.10
Nodes (27): 2. Data model, Defect: an exam already sat counted as Overdue, UX plan phases A–G (2026-09-12), ref_node_crypto, referenceItems(), EmptyState, HealthSummary, NeedsYouInput (+19 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 156 - "dedupe"
Cohesion: 0.16
Nodes (15): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, I08 · Local Done check-off, separate from Hide, Theme: two sources can never say done, One entry per assignment across Gradescope and Canvas, #sec-tidy: Hidden and Ticked off rows, buildItem(), byPrecedence(), canonicalCourseLabel() (+7 more)

### Community 163 - "ref_node_fs"
Cohesion: 0.14
Nodes (10): ref_node_fs, ref_vitest_config, BLOCKS, CLASSICAL, POPUP, UI, USED, html (+2 more)

### Community 166 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **862 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+857 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1043 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `options-dom.test.ts`, `ParseError`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `month.ts`, `offscreen-client.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `observer-ui.ts`, `icon`, `Source`, `piazza.ts`, `manifest.test.ts`, `rows.ts`, `core/registry.ts`, `types.ts`, `ref_node_fs`, `gcal-auth.ts`, `names.ts`, `detect.ts`, `compat.ts`, `announce-real.test.ts`, `health.ts`, `table-grid.ts`, `gcal-client.ts`, `gradescope.ts`, `gate0.ts`, `gcal.ts`, `shell.ts`, `RawItem`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `Illini Dash ZIP UI acceptance handoff`, `ics.ts`, `piazza-real.test.ts`, `theme-panel.ts`, `suggest.ts`, `diagnostics.ts`, `skeleton.ts`, `provenance.test.ts`, `sync.ts`, `row-order.test.ts`, `announce.test.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `schedule.ts`, `Illini Dash — design as built`, `offscreen-client.ts`, `core/campuswire.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.ts`, `announce.ts`, `core/registry.ts`, `types.ts`, `detect.ts`, `gradescope.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `sync.ts`, `announce.test.ts`, `ground`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `Item` connect `calendar.ts` to `store.ts`, `dedupe.ts`, `prairielearn.ts`, `Illini Dash — design as built`, `schedule.ts`, `options.ts`, `month.ts`, `core/campuswire.ts`, `Source`, `icon`, `piazza.ts`, `announce.ts`, `rows.ts`, `background.ts`, `types.ts`, `announce-real.test.ts`, `health.ts`, `screens/editor.ts`, `gcal-client.ts`, `gcal.ts`, `shell.ts`, `popup-draw.test.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.ts`, `sources.ts`, `provenance.test.ts`, `deadline.ts`, `row-order.test.ts`, `Sync loop runSync (§6)`, `announce.test.ts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._