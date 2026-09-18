# Graph Report - wf_e3c45d31-c99-1  (2026-09-18)

## Corpus Check
- 182 files · ~586,065 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 5, .css 3)

## Summary
- 2247 nodes · 5852 edges · 107 communities (102 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 302 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0da26612`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- health.ts
- Canvas — what the API actually returns
- popup.ts
- calendar.ts
- package.json
- dedupe.ts
- prairielearn.ts
- schedule.ts
- grouping.ts
- manifest.json
- types.ts
- options.ts
- piazza.test.ts
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- Defect: the store queue deadlocked
- StoreV1
- author.test.ts
- Chrome Web Store listing draft (§9 G5)
- ics.ts
- validateAdapter
- announce.ts
- Canvas source (§4.1, REST API)
- ParseError
- core/campuswire.ts
- options.html: Settings page
- background.ts
- manifest.test.ts
- overrides.ts
- openRowMenu
- render
- ECE 411 (FA 2026) — what the pages actually say
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- gcal.ts
- Per-source backoff
- shots.mjs
- announce-real.test.ts
- dates.ts
- Tier 0a: make what exists trustworthy
- gcal-client.test.ts
- smartphysics.ts
- renderOptions
- gate0.ts
- send
- icon
- sync.test.ts
- piazza.ts
- scrub.ts
- diagnostics.ts
- What You Must Do When Invoked
- tokens.test.ts
- smartPhysics fixtures provenance
- Source
- author.ts
- markers.ts
- Asking Sushi for a browser action
- gcal-auth.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- popup.html: the popup and full view document
- The design
- Campuswire fixtures
- offscreen.html: DOMParser host for the service worker
- gcal-client.ts
- ref_vitest_config
- suggest.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- Popup UI (§8.1)
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- quality.ts
- Tracing a symptom along a runtime path
- dedupe
- Adding a course-site adapter (§4.5)
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- detect
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- PROGRESS.md — what is done, which gate, what is blocked
- Gradescope fixtures provenance
- Sync loop runSync (§6)
- describeEmpty
- When nothing is proposed: the on-device model
- cellByHeader
- Piazza — what the live client actually does (2026-09-18)
- Auto-merge rule (§5.3)
- runPiazza
- syncSites

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 77 edges
2. `vitest` - 47 edges
3. `Item` - 41 edges
4. `RawItem` - 39 edges
5. `runAdapter()` - 31 edges
6. `Source` - 29 edges
7. `UX plan for the store release` - 28 edges
8. `renderOptions()` - 26 edges
9. `wallClockToIso()` - 25 edges
10. `dedupe()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `Decisions worth not re-litigating` --references--> `gcalPush()`  [INFERRED]
  docs/gcal.md → src/background.ts
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `The noon assumption` --references--> `wallClockToIso()`  [INFERRED]
  docs/campuswire-findings.md → src/core/dates.ts
- `One entry per assignment across Gradescope and Canvas` --references--> `buildItem()`  [INFERRED]
  docs/store/description.txt → src/core/dedupe.ts

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

## Communities (107 total, 5 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.09
Nodes (37): isOlderThan(), guessCourseCode(), isInstant(), PiazzaHealth, piazzaNeedsRecheck(), ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES (+29 more)

### Community 1 - "health.ts"
Cohesion: 0.11
Nodes (35): Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, UX plan phases A–G (2026-09-12), Per-source health indicator, actionFor(), Badge, badgeFor(), displayState() (+27 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "popup.ts"
Cohesion: 0.07
Nodes (53): agendaRows(), movedText(), courseLabel(), movedByText(), OverrideAction, ATTENTION_NOTE, bookingWindowText(), clearDraft() (+45 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (58): Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, allTimed(), Anchor, anchorOf(), ATTENTION_ACTIONABLE, ATTENTION_ORDER (+50 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (38): buildId, copyStatic(), observerOptions, options, setup(), watch, devDependencies, esbuild (+30 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.17
Nodes (21): applyRetention(), badgesOf(), contradictsDone(), courseCodesOf(), datesCompatible(), DedupeOptions, opensAt(), RetentionResult (+13 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.16
Nodes (20): isNoEndMarker(), parsePrairieLearnScheduleDate(), courseInstanceIdFrom(), CreditCell, creditStillOpen(), CreditTier, deadlinesFromSchedule(), isLoginResponse() (+12 more)

### Community 8 - "schedule.ts"
Cohesion: 0.12
Nodes (28): Decision 6: snooze amends §7's daily booking nag, I13 · Reminder toasts with Open / Snooze / Done buttons, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Quiet hours, alarmName(), BOOKING_HOUR (+20 more)

### Community 9 - "grouping.ts"
Cohesion: 0.14
Nodes (25): Defect: finished work with a late window open appeared nowhere, itemTone, isItemDone(), isTickedDone(), clockOf(), dayOf(), daysAway(), DueText (+17 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (34): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+26 more)

### Community 11 - "types.ts"
Cohesion: 0.11
Nodes (30): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), check() (+22 more)

### Community 12 - "options.ts"
Cohesion: 0.08
Nodes (27): BUILD_ID, PIAZZA_LOGIN_URL, Response, downloadFile(), downloadIcs(), itemsToExport(), AdapterEntry, addSiteUrl (+19 more)

### Community 13 - "piazza.test.ts"
Cohesion: 0.08
Nodes (29): Amendment (2026-09-18): which feed field says a post was edited, The feed's shapes, as captured, bodyBatch, currentTermKey(), describePiazza(), editedSinceSeen(), highestNr(), MAX_BODIES_PER_SYNC (+21 more)

### Community 14 - "sync.ts"
Cohesion: 0.16
Nodes (19): Defect: source Off but its rows still on the calendar, inBackoff(), nextAttemptAt(), adapterPrefix(), fetchAll(), FetchedPage, NeedsLogin, POPUP_DEBOUNCE_MS (+11 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.14
Nodes (33): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Light or dark is a setting (is-dark class), menu, allThemeClasses(), DARK_CLASS (+25 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.06
Nodes (67): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+59 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow(), isLoginResponse() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.13
Nodes (25): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — PrairieLearn (12 findings, all survived) (+17 more)

### Community 20 - "site.ts"
Cohesion: 0.08
Nodes (32): 3. The three page shapes, 4. The date grammar, matchesHostPattern(), AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText() (+24 more)

### Community 21 - "Defect: the store queue deadlocked"
Cohesion: 0.31
Nodes (6): Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Defect: the store queue deadlocked, Review outcome — steps 9–12 (16 findings, 13 code defects), createStoreQueue(), StoreQueue

### Community 22 - "StoreV1"
Cohesion: 0.39
Nodes (9): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Item, memberKey = source:sourceId, Overrides, RawItem, Retention and purge (§5.4), Settings (+1 more)

### Community 23 - "author.test.ts"
Cohesion: 0.14
Nodes (20): The context window, The shape, authorAdapter(), buildPrompt(), CHARS_PER_TOKEN, htmlForAuthoring(), MAX_AUTHOR_HTML, OUTPUT_RESERVE (+12 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (44): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+36 more)

### Community 25 - "ics.ts"
Cohesion: 0.33
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 26 - "validateAdapter"
Cohesion: 0.17
Nodes (21): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+13 more)

### Community 27 - "announce.ts"
Cohesion: 0.06
Nodes (41): Announcement fixtures, ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+33 more)

### Community 28 - "Canvas source (§4.1, REST API)"
Cohesion: 0.18
Nodes (17): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §5.3: an assumed time is the last resort, not the first, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: every ECE 391 deadline landed six hours late (+9 more)

### Community 29 - "ParseError"
Cohesion: 0.22
Nodes (15): parseGradescopeDateTime(), shortHash(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN, isLoginResponse() (+7 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.11
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), describeObserver(), isClassFeed(), ObservedPost, ObserverFacts (+24 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.13
Nodes (18): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script (+10 more)

### Community 32 - "background.ts"
Cohesion: 0.09
Nodes (41): House rules for the worker and the loop, I57 · Term rollover: term dates in the registry, Expired section, allAdapters(), applyObserver(), applySettings(), deps, enabledAdapters(), ensureObservers() (+33 more)

### Community 33 - "manifest.test.ts"
Cohesion: 0.12
Nodes (13): SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS, REGISTRY_URL, PRAIRIETEST_ORIGIN, SMARTPHYSICS_ORIGIN (+5 more)

### Community 34 - "overrides.ts"
Cohesion: 0.21
Nodes (20): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), CourseSummary, dismissSuggestion(), hideItem() (+12 more)

### Community 35 - "openRowMenu"
Cohesion: 0.15
Nodes (23): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view (+15 more)

### Community 36 - "render"
Cohesion: 0.21
Nodes (12): courseColours(), coursesIn(), examCount(), drawIsHeld(), makeRowsNavigable(), openFullView(), render(), renderFilters() (+4 more)

### Community 37 - "ECE 411 (FA 2026) — what the pages actually say"
Cohesion: 0.29
Nodes (6): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters

### Community 38 - "detect.ts"
Cohesion: 0.18
Nodes (17): Rules this feature is held to, adapterFromCandidate(), dataRows(), detectCandidates(), DetectedRow, hasLink(), noCandidateReason(), pickTitleColumn() (+9 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.19
Nodes (14): Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (38): adapters, courses, gcalState, item(), itemOfManual(), items, listeners, manualRaw (+30 more)

### Community 42 - "gcal.ts"
Cohesion: 0.15
Nodes (21): calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+13 more)

### Community 43 - "Per-source backoff"
Cohesion: 0.28
Nodes (9): Defect: the sync took the sum of its sources, Defect: signing in changed nothing until Sync was pressed, Per-source backoff, Fetch rules for all sources, Popup-triggered sync debounce, backoffMinutes(), MAX_CONCURRENT_PER_HOST, PLANS (+1 more)

### Community 44 - "shots.mjs"
Cohesion: 0.05
Nodes (40): ref_node_child_process, ref_node_http, ref_node_path, ref_node_url, ref_node_util, all, args, candidates (+32 more)

### Community 45 - "announce-real.test.ts"
Cohesion: 0.12
Nodes (15): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+7 more)

### Community 46 - "dates.ts"
Cohesion: 0.18
Nodes (20): Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, addDays(), nextWeekday(), readClock(), readDatePhrase(), DAYS_IN_MONTH (+12 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.17
Nodes (18): I02 · Exam-day card on PrairieTest rows (room, duration, format), I03 · Toolbar badge: today's count, red ! when a source is broken, I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows (+10 more)

### Community 48 - "gcal-client.test.ts"
Cohesion: 0.16
Nodes (17): gcalClientId(), gcalEventFor(), gcalPush(), call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent() (+9 more)

### Community 49 - "smartphysics.ts"
Cohesion: 0.17
Nodes (25): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Shared parser primitives (src/core/parsing.ts), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), nonEmpty() (+17 more)

### Community 50 - "renderOptions"
Cohesion: 0.20
Nodes (22): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterPagePath(), adapterRow(), clearRemoval(), dataStatus(), el() (+14 more)

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "send"
Cohesion: 0.12
Nodes (33): UI rule 2: every send() from a page needs a .catch, bookings(), staleWorkerNotice(), loginsToOpen(), setupProgress, setupSummary(), send(), applyOverrideAction() (+25 more)

### Community 53 - "icon"
Cohesion: 0.13
Nodes (19): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, EditorValues, ERROR_FIELD, fieldFor() (+11 more)

### Community 54 - "sync.test.ts"
Cohesion: 0.12
Nodes (11): linkedom, ref_node_fs, vitest, courseUrl(), docOf(), fixture(), page, fetchPage() (+3 more)

### Community 55 - "piazza.ts"
Cohesion: 0.08
Nodes (35): CLASS_LIST_MAX_AGE_MS, ClassPage, ClassPageKind, CONTENT_EDIT, decodeEntities(), FEED_LIMIT, FeedContext, htmlToText() (+27 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "diagnostics.ts"
Cohesion: 0.20
Nodes (13): buildDiagnostics(), Diagnostics, hoursSince(), scrubError(), emptyGcal(), emptyStore(), Settings, input() (+5 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 61 - "Source"
Cohesion: 0.12
Nodes (22): M13: open the first-run tab on install, Phase E: first run and install, DiagnosticsInput, SourceDiagnostics, EmptyState, HealthSummary, SourceRow, staleNotice (+14 more)

### Community 62 - "author.ts"
Cohesion: 0.11
Nodes (25): attemptCount(), AuthorOptions, AuthorOutcome, COLUMN_FIELDS, FILTER_FIELDS, GROUNDED, groundingSelector(), groundProposal() (+17 more)

### Community 63 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "gcal-auth.ts"
Cohesion: 0.18
Nodes (16): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState (+8 more)

### Community 66 - "needs_login detection"
Cohesion: 0.15
Nodes (17): Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), The one source with no login page (course sites), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption) (+9 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.14
Nodes (17): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+9 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.10
Nodes (23): Decision 4: manual deadline entry, aggregator or planner, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+15 more)

### Community 69 - "The design"
Cohesion: 0.18
Nodes (11): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Decisions worth not re-litigating, Google Calendar sync, Looking at it without a Google account, The design, What it costs (+3 more)

### Community 71 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 72 - "gcal-client.ts"
Cohesion: 0.14
Nodes (17): FetchLike, GcalFailure, GcalHttp, PushResult, RETRY_DELAYS_MS, retryDelay(), withRetry(), GCAL_API_ORIGIN (+9 more)

### Community 74 - "suggest.ts"
Cohesion: 0.13
Nodes (25): earlier(), resolveMentions(), normalizeTitle(), alreadySuggested(), AUTO_MOVE_CONFIDENCE, describePost(), IngestInput, IngestOptions (+17 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (24): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm, I19 · Per-sync change log strip (+16 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.20
Nodes (23): rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), cellsOf(), clip(), DATE_SHAPED, describe() (+15 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.25
Nodes (11): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, Export .ics moved to the bar, npm run preview — the real popup over canned data, Calendar export (§8.3), §0.1 No backend, §0.6 Ship ugly, Out of scope for v1 (+3 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.22
Nodes (5): LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "illini-dash"
Cohesion: 0.20
Nodes (9): Check it in the mode Sushi actually uses, illini-dash, Parallelism, Review policy, Rules, Sushi's time is the scarce resource, The popup is measured by Chrome, not sized by you, Things I have to do (you can't) (+1 more)

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

### Community 84 - "quality.ts"
Cohesion: 0.29
Nodes (6): DATE_FLAGS, QualityFlag, qualityFlags(), SOFT_FLAGS, unreadableDeadline(), unreadableSummary()

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "dedupe"
Cohesion: 0.17
Nodes (14): I08 · Local Done check-off, separate from Hide, Theme: two sources can never say done, #sec-tidy: Hidden and Ticked off rows, buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+6 more)

### Community 87 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.29
Nodes (6): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5)

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

### Community 93 - "detect"
Cohesion: 0.50
Nodes (4): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

### Community 97 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.14
Nodes (31): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Chrome Web Store submission (draft, not submitted), Defect: cs124.org could not be added at all, Fixtures captured (+23 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (20): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Worker rule 5: log both branches of any decision the user will have to debug, Adapter.columns — header-driven column lookup, Defect: bundled registry was never read, smartPhysics as a fifth source (+12 more)

### Community 100 - "describeEmpty"
Cohesion: 0.12
Nodes (14): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Why this is an observer and not a source, class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT) (+6 more)

### Community 101 - "When nothing is proposed: the on-device model"
Cohesion: 0.22
Nodes (8): A selector the page has not got is refused before the runner, Checking the three lines without a model, The manifest needs no new permission, The summary has to show a list, not mention one, The three shapes it may propose, What the student is told, When nothing is proposed: the on-device model, availability()

### Community 102 - "cellByHeader"
Cohesion: 0.23
Nodes (12): House rules for mutation checks, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code (+4 more)

### Community 103 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.15
Nodes (13): Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): the reader version, and posts read at their snippets, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), The fixture's scrub was broken, and is repaired, What the term rule is, and why `status` is not it, What the two stages read, and the scorecard over the real feed (+5 more)

### Community 104 - "Auto-merge rule (§5.3)"
Cohesion: 0.38
Nodes (7): Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Title normalization (§5.2), Transitive union-find merge with overrides, BADGE_TOKEN, itemId()

### Community 105 - "runPiazza"
Cohesion: 0.15
Nodes (20): The signed-out page, and the positive marker it made possible, asJson(), piazzaBody(), piazzaClasses(), PiazzaNeedsLogin, piazzaToken(), pool(), runPiazza() (+12 more)

### Community 108 - "syncSites"
Cohesion: 0.17
Nodes (15): Parallelism policy, Trace the path, not just the file, Worker rule 2: a green dot must mean 'I fetched, and it was fine', Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: a failing registry refresh retried on every sync, Defect: site: ok (0 items) was a lie (+7 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **523 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+518 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 640 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `sync.test.ts` to `store.ts`, `health.ts`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `types.ts`, `piazza.test.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `Defect: the store queue deadlocked`, `author.test.ts`, `ics.ts`, `ParseError`, `core/campuswire.ts`, `manifest.test.ts`, `overrides.ts`, `detect.ts`, `compat.ts`, `preview-data.ts`, `gcal.ts`, `announce-real.test.ts`, `gcal-client.test.ts`, `gate0.ts`, `icon`, `piazza.ts`, `scrub.ts`, `diagnostics.ts`, `tokens.test.ts`, `Source`, `gcal-auth.ts`, `suggest.ts`, `skeleton.ts`, `quality.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `types.ts`, `piazza.test.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `announce.ts`, `core/campuswire.ts`, `background.ts`, `announce-real.test.ts`, `dates.ts`, `smartphysics.ts`, `sync.test.ts`, `piazza.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `runPiazza`, `syncSites`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `detect()` connect `detect` to `detect.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 4 INFERRED edges - model-reasoned connections that need verification._