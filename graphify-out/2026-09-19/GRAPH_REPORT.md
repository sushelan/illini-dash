# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 182 files · ~628,903 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 2344 nodes · 6164 edges · 104 communities (99 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 371 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7378170f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- smartphysics.ts
- Canvas — what the API actually returns
- popup.ts
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- grouping.ts
- manifest.json
- messages.ts
- options.ts
- Auto-merge rule (§5.3)
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- Source
- openRowMenu
- piazza-real.test.ts
- Chrome Web Store listing draft (§9 G5)
- Item
- validateAdapter
- announce.ts
- parseAdapterDateParts
- StoreV1
- core/campuswire.ts
- options.html: Settings page
- background.ts
- vitest
- overrides.ts
- gcal-auth.ts
- Sync loop runSync (§6)
- validateRegistry
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- gcal.ts
- health.ts
- shots.mjs
- announce.test.ts
- Settings
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- ParseError
- build.mjs
- gate0.ts
- send
- icon
- types.ts
- piazza.ts
- scrub.ts
- render
- What You Must Do When Invoked
- tokens.test.ts
- ref_node_fs
- site.mjs
- author.ts
- icons.mjs
- Asking Sushi for a browser action
- gcal-config.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- popup.html: the popup and full view document
- The design
- Campuswire fixtures
- Campuswire — findings
- Installing Illini Dash (beta)
- ref_vitest_config
- suggest.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- UX plan phases A–G (2026-09-12)
- proposeWithModel
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- The colour layer
- linkedom
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- smartPhysics fixtures provenance
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- skeleton.test.ts
- Gradescope fixtures provenance
- markers.ts
- The first live run (2026-09-10): four defects, none caught by 382 tests
- preview.mjs
- dates.ts
- classifyPiazzaResponse

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 78 edges
2. `vitest` - 47 edges
3. `Item` - 41 edges
4. `RawItem` - 39 edges
5. `piazzaRun()` - 32 edges
6. `runAdapter()` - 31 edges
7. `Source` - 30 edges
8. `UX plan for the store release` - 28 edges
9. `ingestPost()` - 27 edges
10. `renderOptions()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `The noon assumption` --references--> `wallClockToIso()`  [INFERRED]
  docs/campuswire-findings.md → src/core/dates.ts
- `One entry per assignment across Gradescope and Canvas` --references--> `buildItem()`  [INFERRED]
  docs/store/description.txt → src/core/dedupe.ts
- `Trap: §5.1 cannot read 'Physics 214'` --references--> `buildItem()`  [INFERRED]
  fixtures/smartphysics/README.md → src/core/dedupe.ts

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

## Communities (104 total, 5 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.10
Nodes (34): isOlderThan(), guessCourseCode(), isInstant(), PiazzaHealth, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, isObserverHealth() (+26 more)

### Community 1 - "smartphysics.ts"
Cohesion: 0.14
Nodes (27): House rules for parsers, Shared parser primitives (src/core/parsing.ts), monthIndex(), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), nonEmpty() (+19 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "popup.ts"
Cohesion: 0.07
Nodes (59): agendaRows(), dayKey(), movedText(), qualityFlags(), unreadableSummary(), movedByText(), EditorValues, anchorDate() (+51 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (43): AgendaRow, allTimed(), Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, attentionCount(), AttentionName, bookingWindowEnd() (+35 more)

### Community 5 - "scripts"
Cohesion: 0.10
Nodes (19): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest, scripts (+11 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (34): I06 · Show runner-assumed 23:59 times as assumed, What is stored: deadlines, courses, settings, corrections in chrome.storage.local, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus() (+26 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.15
Nodes (21): I37 · A partial PrairieLearn score is not 'done', inferYear(), isNoEndMarker(), parsePrairieLearnScheduleDate(), courseInstanceIdFrom(), CreditCell, creditStillOpen(), CreditTier (+13 more)

### Community 8 - "schedule.ts"
Cohesion: 0.09
Nodes (40): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Defect: the store queue deadlocked (+32 more)

### Community 9 - "grouping.ts"
Cohesion: 0.12
Nodes (32): Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups(), isFinished(), isPast(), itemTone, visibleItems() (+24 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.14
Nodes (18): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+10 more)

### Community 12 - "options.ts"
Cohesion: 0.08
Nodes (46): BUILD_ID, saveProposedAdapter(), describeObserver(), staleWorkerNotice(), displayCourseLabel(), piazzaChipState(), currentTermCode(), AdapterEntry (+38 more)

### Community 13 - "Auto-merge rule (§5.3)"
Cohesion: 0.32
Nodes (13): Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Build order (§10), Gate G2 — Recall, Gate G3 — Dedupe, Gate G4 — Beta (+5 more)

### Community 14 - "sync.ts"
Cohesion: 0.05
Nodes (60): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, Per-source backoff, Fetch rules for all sources (+52 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.15
Nodes (31): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), Light or dark is a setting (is-dark class), menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME (+23 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (15): parseDateAttribute(), parseDateRangeAttribute(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow(), parseHome() (+7 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.15
Nodes (22): Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses? (+14 more)

### Community 20 - "site.ts"
Cohesion: 0.10
Nodes (33): 3. The three page shapes, 4. The date grammar, matchesHostPattern(), AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText() (+25 more)

### Community 21 - "Source"
Cohesion: 0.10
Nodes (29): buildDiagnostics(), hoursSince(), scrubError(), SourceDiagnostics, EmptyState, HealthSummary, SourceRow, staleNotice (+21 more)

### Community 22 - "openRowMenu"
Cohesion: 0.19
Nodes (16): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the sources panel was clipped, makeRowsNavigable() (+8 more)

### Community 23 - "piazza-real.test.ts"
Cohesion: 0.09
Nodes (32): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed (+24 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (40): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+32 more)

### Community 25 - "Item"
Cohesion: 0.18
Nodes (20): I22 · Honest .ics / calendar link (all-day for invented times), AttentionGroup, DedupeOptions, Section, buildIcs(), escapeIcsText(), event(), foldIcsLine() (+12 more)

### Community 26 - "validateAdapter"
Cohesion: 0.12
Nodes (26): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion) (+18 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (57): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+49 more)

### Community 28 - "parseAdapterDateParts"
Cohesion: 0.22
Nodes (16): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §5.3: an assumed time is the last resort, not the first, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline (+8 more)

### Community 29 - "StoreV1"
Cohesion: 0.21
Nodes (14): Open: course sites split across pages, Parser rule 3: never index cells positionally, Parser rule 7: RawItem.url is https on the source origin or the fallback, Adapter.columns — header-driven column lookup, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Tier 0b (4 of 7 done), Adapter (declarative course-site adapter), Item (+6 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.08
Nodes (37): EmptyReason, ReadMention, ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost (+29 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.10
Nodes (23): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', offscreen permission justification, Promo tile 440x280 from ui.css tokens, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker (+15 more)

### Community 32 - "background.ts"
Cohesion: 0.10
Nodes (36): Decisions worth not re-litigating, Open full view reuses one tab, allAdapters(), applyObserver(), applySettings(), deps, enabledAdapters(), ensureObservers() (+28 more)

### Community 33 - "vitest"
Cohesion: 0.10
Nodes (16): vitest, SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS, isPlainString(), REGISTRY_REFRESH_MS (+8 more)

### Community 34 - "overrides.ts"
Cohesion: 0.18
Nodes (22): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+14 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.21
Nodes (14): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+6 more)

### Community 36 - "Sync loop runSync (§6)"
Cohesion: 0.23
Nodes (15): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 5: log both branches of any decision the user will have to debug, Defect: bundled registry was never read, Repo layout: worker is wiring, decisions live in core/, Adapter registry (bundled + daily GitHub refresh), Course-site adapters and runner (§4.5) (+7 more)

### Community 37 - "validateRegistry"
Cohesion: 0.20
Nodes (10): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+2 more)

### Community 38 - "detect.ts"
Cohesion: 0.15
Nodes (20): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), Rules this feature is held to, adapterFromCandidate(), dataRows(), detectCandidates(), hasLink() (+12 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.21
Nodes (14): Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (38): adapters, courses, gcalState, item(), itemOfManual(), items, listeners, manualRaw (+30 more)

### Community 42 - "gcal.ts"
Cohesion: 0.16
Nodes (20): calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID (+12 more)

### Community 43 - "health.ts"
Cohesion: 0.10
Nodes (35): Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, Per-source health indicator, GcalAction, actionFor(), Badge, badgeFor(), displayState() (+27 more)

### Community 44 - "shots.mjs"
Cohesion: 0.14
Nodes (10): ref_node_http, ref_node_util, chrome, CHROME_CANDIDATES, dist, filter, outDir, run (+2 more)

### Community 45 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 46 - "Settings"
Cohesion: 0.17
Nodes (16): When live data contradicts a document: rewrite the claim, Chrome Web Store submission (draft, not submitted), Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, The store documents, aligned and published, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API) (+8 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.21
Nodes (14): I01 · Deadline moved / new markers, notification, reminder re-arm, I04 · Late / reduced-credit window stays live after dueAt, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I41 · Morning toast instead of 2h lead for runner-invented times, I54 · Versioned store migrations with memberKey remapping (+6 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "ParseError"
Cohesion: 0.20
Nodes (16): parseGradescopeDateTime(), shortHash(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN, isLoginResponse() (+8 more)

### Community 50 - "build.mjs"
Cohesion: 0.15
Nodes (12): buildId, copyStatic(), observerOptions, options, setup(), watch, esbuild, ref_node_fs_promises (+4 more)

### Community 51 - "gate0.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "send"
Cohesion: 0.12
Nodes (37): UI rule 2: every send() from a page needs a .catch, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, Defect: signing in changed nothing until Sync was pressed, Defect: three dead redraw guards and a status line below the fold, bookings(), sourcesToRecheck(), send() (+29 more)

### Community 53 - "icon"
Cohesion: 0.15
Nodes (17): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+9 more)

### Community 54 - "types.ts"
Cohesion: 0.17
Nodes (15): check(), checkThrows(), describe(), PAGE, runParseSelftest(), ParseRequest, ParseResponse, getParser() (+7 more)

### Community 55 - "piazza.ts"
Cohesion: 0.05
Nodes (82): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, piazzaClasses(), piazzaRun(), piazzaToken(), piazzaTrigger(), pool(), ANY_TAG (+74 more)

### Community 56 - "scrub.ts"
Cohesion: 0.20
Nodes (10): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+2 more)

### Community 57 - "render"
Cohesion: 0.19
Nodes (15): courseColours(), coursesIn(), examCount(), courseLabel(), courseChoices(), drawIsHeld(), openFullView(), render() (+7 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "ref_node_fs"
Cohesion: 0.15
Nodes (8): ref_node_fs, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, V1

### Community 61 - "site.mjs"
Cohesion: 0.21
Nodes (12): ref_node_url, escape(), ESCAPES, inline(), manifest, out, page(), policy (+4 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (56): A selector the page has not got is refused before the runner, The attempt line says what the model emitted, The schema requires what the validator will demand, The shape, The three shapes it may propose, attemptCount(), AttemptInfo, attemptLogLine() (+48 more)

### Community 63 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "gcal-config.ts"
Cohesion: 0.20
Nodes (9): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+1 more)

### Community 66 - "needs_login detection"
Cohesion: 0.13
Nodes (22): Open: Coursera for the online CS courses, Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after (+14 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (23): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup (+15 more)

### Community 69 - "The design"
Cohesion: 0.18
Nodes (12): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+4 more)

### Community 71 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.15
Nodes (21): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+13 more)

### Community 74 - "suggest.ts"
Cohesion: 0.09
Nodes (37): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures (+29 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.09
Nodes (31): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I02 · Exam-day card on PrairieTest rows (room, duration, format) (+23 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.21
Nodes (27): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip() (+19 more)

### Community 77 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.20
Nodes (14): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, Defect: an exam already sat counted as Overdue, Export .ics moved to the bar, UX plan phases A–G (2026-09-12), npm run preview — the real popup over canned data, Calendar export (§8.3), §0.1 No backend (+6 more)

### Community 78 - "proposeWithModel"
Cohesion: 0.10
Nodes (18): Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The context window, The manifest needs no new permission, What the student is told, When nothing is proposed: the on-device model, AuthorOutcome, ModelOutcome (+10 more)

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

### Community 84 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.27
Nodes (13): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload, README — illini-dash, Build toolchain (§2.4) (+5 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.17
Nodes (21): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+13 more)

### Community 87 - "linkedom"
Cohesion: 0.22
Nodes (8): name, private, type, version, linkedom, @types/chrome, @types/node, typescript

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

### Community 93 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 97 - "skeleton.test.ts"
Cohesion: 0.33
Nodes (5): The inventory sketches one row's insides, text(), MAX_SKETCH_CHARS, docFrom(), repeated()

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "markers.ts"
Cohesion: 0.20
Nodes (11): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult, render() (+3 more)

### Community 100 - "The first live run (2026-09-10): four defects, none caught by 382 tests"
Cohesion: 0.33
Nodes (6): Parallelism policy, Trace the path, not just the file, Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failing registry refresh retried on every sync, Defect: set-adapter-enabled wrote the store outside the queue, The first live run (2026-09-10): four defects, none caught by 382 tests

### Community 101 - "preview.mjs"
Cohesion: 0.40
Nodes (4): ref_node_child_process, dist, stubOut, stubSource

### Community 102 - "dates.ts"
Cohesion: 0.12
Nodes (25): House rules for mutation checks, Mutation rule 2: a survivor is untested, unreachable, or redundant, Mutation rule 3: a survivor sometimes indicts the design, A survivor has three meanings — decide which before acting, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting (+17 more)

### Community 105 - "classifyPiazzaResponse"
Cohesion: 0.11
Nodes (20): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), The feed's shapes, as captured, The signed-out page, and the positive marker it made possible, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), class-page.html — `GET https://piazza.com/class/<nid>` (signed in) (+12 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `npm run shots headless capture script` → `--blink-settings=preferredColorScheme, not --force-dark-mode`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **539 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+534 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 656 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `npm run shots headless capture script` and `--blink-settings=preferredColorScheme, not --force-dark-mode`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `smartphysics.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `sync.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `Source`, `piazza-real.test.ts`, `Item`, `core/campuswire.ts`, `overrides.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `preview-data.ts`, `gcal.ts`, `health.ts`, `announce.test.ts`, `gcal-client.ts`, `ParseError`, `gate0.ts`, `icon`, `types.ts`, `piazza.ts`, `scrub.ts`, `tokens.test.ts`, `ref_node_fs`, `author.ts`, `suggest.ts`, `linkedom`, `skeleton.test.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `smartphysics.ts`, `prairielearn.ts`, `schedule.ts`, `messages.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `Review outcome — PrairieLearn (12 findings, all survived)`, `site.ts`, `piazza-real.test.ts`, `announce.ts`, `core/campuswire.ts`, `announce.test.ts`, `gate0.ts`, `types.ts`, `piazza.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `skeleton.test.ts`, `dates.ts`, `classifyPiazzaResponse`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `PROGRESS.md — what is done, which gate, what is blocked` connect `PROGRESS.md — what is done, which gate, what is blocked` to `Canvas — what the API actually returns`, `Installing Illini Dash (beta)`, `Roadmap ideas (88 ranked gaps)`, `Auto-merge rule (§5.3)`, `Settings`, `UX plan for the store release`, `Chrome Web Store listing draft (§9 G5)`, `validateAdapter`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 5 INFERRED edges - model-reasoned connections that need verification._