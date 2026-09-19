# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 216 files · ~743,150 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 6, (none) 5)

## Summary
- 2793 nodes · 7662 edges · 133 communities (126 shown, 7 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 750 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b441eb7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
- PrairieTest — what the fetched HTML actually contains
- send
- calendar.ts
- package.json
- dedupe.ts
- prairielearn.ts
- schedule.ts
- rows.ts
- manifest.json
- messages.ts
- options.ts
- Auto-merge rule (§5.3)
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- sourcesToRecheck
- site.ts
- support.js
- piazza.test.ts
- piazza-real.test.ts
- Chrome Web Store listing draft (§9 G5)
- needs-you.ts
- validateAdapter
- announce.ts
- Course-site adapters and runner (§4.5)
- Sync loop runSync (§6)
- core/campuswire.ts
- options.html: Settings page
- background.ts
- core/registry.ts
- overrides.test.ts
- gcal-auth.ts
- Adapter registry (bundled + daily GitHub refresh)
- validateRegistry
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- types.ts
- health.ts
- shots.mjs
- announce-real.test.ts
- diagnostics.ts
- Tier 0a: make what exists trustworthy
- gcal.ts
- gradescope.ts
- Canvas — what the API actually returns
- gate0.ts
- UI rule 8: height is the popup's recurring bug in different costumes
- shell.ts
- manual.ts
- piazza.ts
- scrub.ts
- deadline.ts
- /graphify
- tokens.test.ts
- renderOptions
- 2. Findings, ranked
- author.ts
- wallClockToIso
- Asking Sushi for a browser action
- parsePostBody
- needs_login detection
- I08 · Local Done check-off, separate from Hide
- popup.html: the popup and full view document
- cellByHeader
- Campuswire fixtures
- Campuswire — findings
- Installing Illini Dash (beta)
- ref_vitest_config
- suggest.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- Popup UI (§8.1)
- proposeWithModel
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- The colour layer
- applyStoredTheme
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- popup.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- /graphify
- Gradescope fixtures provenance
- PageCtx
- Defect: the store queue deadlocked
- What You Must Do When Invoked
- Mutation check
- What You Must Do When Invoked
- syncSites
- Piazza — what the live client actually does (2026-09-18)
- graphify reference: extra exports and benchmark
- StoreV1Plus
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- Adding a course-site adapter (§4.5)
- Triaging a beta report
- queue.ts
- Defect: a Gradescope course labelled stat_425_120248_268442
- detect
- Tracing a symptom along a runtime path
- Popup redesign brief — "soft card direction"
- Adapter
- markers.ts
- Asking Sushi for a browser action
- Mutation check
- Store description (plain text)
- graphify reference: query, path, explain
- 4. Measurements
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Step 3 - Extract entities and relationships
- Step 3 - Extract entities and relationships
- J. Day view
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 79 edges
2. `Z. Test files that pin popup behaviour` - 62 edges
3. `Item` - 54 edges
4. `vitest` - 47 edges
5. `RawItem` - 40 edges
6. `Source` - 36 edges
7. `send()` - 34 edges
8. `runAdapter()` - 33 edges
9. `piazzaRun()` - 32 edges
10. `renderRow()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can` --references--> `applyOverride()`  [INFERRED]
  docs/design/review-r3.md → src/background.ts
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .agents/skills/capture-ask/SKILL.md → src/capture.ts
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `post.json — `POST https://piazza.com/logic/api?method=content.get`` --references--> `describeEmpty()`  [INFERRED]
  fixtures/piazza/README.md → src/core/announce.ts

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

## Communities (133 total, 7 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.12
Nodes (30): isOlderThan(), isGcalState(), isInstant(), PiazzaHealth, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth() (+22 more)

### Community 1 - "ParseError"
Cohesion: 0.13
Nodes (33): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Shared parser primitives (src/core/parsing.ts), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), nonEmpty() (+25 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.12
Nodes (29): Row control changes on submit: <a href> vs button data-assignment-id, Status from div.submissionStatus--text, ignore colour modifiers, PrairieLearn — what the fetched HTML actually contains, Row link becomes /assessment_instance/{iid} once started, Credit schedule in data-bs-content popover, second DOMParser pass, 0-credit row End is an em dash meaning no end, Access table has a header row and no tbody; select rows with td, lateDueAt only from a next tier with credit above 0 (+21 more)

### Community 3 - "send"
Cohesion: 0.10
Nodes (41): setup(), Fixed constraints (from CLAUDE.md, none negotiable), R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 6. Checked and clean, L5 — Two round trips with no popup-side log line, and one with no caption., M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M7 — `recheckLogins` has exactly the silent early return worker rule 5 was written for, under a comment claiming it does not., B. Header bar (+33 more)

### Community 4 - "calendar.ts"
Cohesion: 0.06
Nodes (68): N. Attention view and suggestions, Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, AgendaRow, agendaRows(), Anchor, anchorOf(), ATTENTION_ACTIONABLE (+60 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (38): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), watch, devDependencies, esbuild (+30 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (33): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+25 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.11
Nodes (27): RFC-3339, DAYS_IN_MONTH, isNoEndMarker(), MONTHS, pad(), parsePrairieLearnScheduleDate(), WEEKDAYS, ZONE_OFFSETS (+19 more)

### Community 8 - "schedule.ts"
Cohesion: 0.13
Nodes (24): I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, store-toast.png is a composite, not a screenshot, UX plan phases A–G (2026-09-12), SOURCE_HINT, alarmName(), BOOKING_HOUR (+16 more)

### Community 9 - "rows.ts"
Cohesion: 0.10
Nodes (36): REPLACED-RECORDED (49), 4. Timezone results, opensAt(), clockOf(), countdown(), dayOf(), daysAway(), DueText (+28 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.09
Nodes (30): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+22 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (30): BUILD_ID, MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, downloadFile(), downloadIcs(), itemsToExport(), AdapterEntry (+22 more)

### Community 13 - "Auto-merge rule (§5.3)"
Cohesion: 0.20
Nodes (15): When live data contradicts a document: rewrite the claim, Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Canvas plannable_type → Kind mapping (+7 more)

### Community 14 - "sync.ts"
Cohesion: 0.12
Nodes (25): Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, dedupeInput(), backoffMinutes(), inBackoff(), nextAttemptAt() (+17 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.15
Nodes (31): menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, isModeName(), isThemeName() (+23 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.17
Nodes (23): Header health dots: grey/green/yellow/red, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+15 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), textOf(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "sourcesToRecheck"
Cohesion: 0.10
Nodes (32): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 3: never index cells positionally, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Adapter.columns — header-driven column lookup, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates (+24 more)

### Community 20 - "site.ts"
Cohesion: 0.10
Nodes (31): 3. The three page shapes, 3. The three page shapes, matchesHostPattern(), AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText() (+23 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "piazza.test.ts"
Cohesion: 0.08
Nodes (31): The feed's shapes, as captured, bodyBatch, currentTermKey(), highestNr(), MAX_BODIES_PER_SYNC, ObservedPost, PIAZZA_LOGIN_GRACE, PIAZZA_MATCH (+23 more)

### Community 23 - "piazza-real.test.ts"
Cohesion: 0.16
Nodes (12): PostBody, PostPayload, EXPECTED, FEED, ingest(), NO_OVERRIDES, PAGE, REGISTRATION (+4 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (39): Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5), Store icon: navy tile, one orange bar, white tick, alarms permission justification, commands permission justification, contextMenus permission justification (+31 more)

### Community 25 - "needs-you.ts"
Cohesion: 0.13
Nodes (28): 1. Counts, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked, 6. One structural note, DEGRADED (4), Notes on items classified PRESERVED that moved, Review R1 — does every old popup feature exist in the new one?, L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it. (+20 more)

### Community 26 - "validateAdapter"
Cohesion: 0.16
Nodes (22): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+14 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (48): Announcement fixtures, ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+40 more)

### Community 28 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.27
Nodes (13): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, smartPhysics as a fifth source (+5 more)

### Community 29 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (22): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — steps 9–12 (16 findings, 13 code defects), The one source with no login page (course sites), Repo layout: worker is wiring, decisions live in core/, §0.5 Chrome only, Item, memberKey = source:sourceId (+14 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.11
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), describeObserver(), isClassFeed(), ObservedPost, ObserverFacts (+24 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (19): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script (+11 more)

### Community 32 - "background.ts"
Cohesion: 0.08
Nodes (48): House rules for the worker and the loop, Decisions worth not re-litigating, W. What lives in Options, not the popup, I57 · Term rollover: term dates in the registry, Expired section, allAdapters(), applyObserver(), applySettings(), deps (+40 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.09
Nodes (17): GCAL_API_ORIGIN, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_SCOPE, SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS (+9 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.15
Nodes (26): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+18 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.23
Nodes (11): ALL_GCAL_STATES, describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, when(), GCAL_NOT_CONFIGURED (+3 more)

### Community 36 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.83
Nodes (4): Worker rule 5: log both branches of any decision the user will have to debug, Defect: bundled registry was never read, Adapter registry (bundled + daily GitHub refresh), shouldSeedFromBundle()

### Community 37 - "validateRegistry"
Cohesion: 0.20
Nodes (10): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Remote code: No (+2 more)

### Community 38 - "detect.ts"
Cohesion: 0.13
Nodes (26): Rules this feature is held to, What a student is told now, adapterFromCandidate(), bestGroupSentence(), candidatesFoundLine(), dataRows(), detectCandidates(), DetectedRow (+18 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (21): adapters, courses, gcalState, item(), itemOfManual(), items, listeners, manualRaw (+13 more)

### Community 42 - "types.ts"
Cohesion: 0.12
Nodes (18): linkedom, ref_node_fs, vitest, QualityFlag, DEFAULT_SETTINGS, memberKey(), RawItem, Settings (+10 more)

### Community 43 - "health.ts"
Cohesion: 0.07
Nodes (65): Structural decisions, M8 — The setup screen's "Connected" chip outranks the source's current state., 3. Mutation table, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover, Z. Test files that pin popup behaviour, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand (+57 more)

### Community 44 - "shots.mjs"
Cohesion: 0.05
Nodes (40): ref_node_child_process, ref_node_http, ref_node_path, ref_node_url, ref_node_util, all, args, candidates (+32 more)

### Community 45 - "announce-real.test.ts"
Cohesion: 0.13
Nodes (14): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+6 more)

### Community 46 - "diagnostics.ts"
Cohesion: 0.16
Nodes (15): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, defaultStatus(), emptyGcal() (+7 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.21
Nodes (15): I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I41 · Morning toast instead of 2h lead for runner-invented times (+7 more)

### Community 48 - "gcal.ts"
Cohesion: 0.05
Nodes (69): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs (+61 more)

### Community 49 - "gradescope.ts"
Cohesion: 0.13
Nodes (23): Gradescope — what the fetched HTML actually contains, Dashboard: courseList--term, coursesForTerm, current term first, Hidden Due Date column is state-dependent; parse <time datetime>, Rows: tr containing th.table--primaryLink, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], Skip fetching courses stating 0 assignments, parseGradescopeDateTime() (+15 more)

### Community 50 - "Canvas — what the API actually returns"
Cohesion: 0.12
Nodes (24): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+16 more)

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "UI rule 8: height is the popup's recurring bug in different costumes"
Cohesion: 0.33
Nodes (7): UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold, MENU_SELECTOR

### Community 53 - "shell.ts"
Cohesion: 0.05
Nodes (72): M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, D. Banners, E. Tabs and view state, F. Course filter chips, bookings(), ViewName, createEditor() (+64 more)

### Community 54 - "manual.ts"
Cohesion: 0.25
Nodes (18): 5. Checked and clean, Proposal, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput (+10 more)

### Community 55 - "piazza.ts"
Cohesion: 0.06
Nodes (58): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The signed-out page, and the positive marker it made possible, The two re-read lines now count the same thing, piazzaClasses(), piazzaRun(), piazzaToken(), piazzaTrigger() (+50 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "deadline.ts"
Cohesion: 0.08
Nodes (54): 4. Cross-worker seam checks, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 5. R1's ten, re-checked, 7. The single cheapest standing check, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand. (+46 more)

### Community 58 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "renderOptions"
Cohesion: 0.24
Nodes (20): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterRow(), clearRemoval(), el(), gcalSection(), noteRemoval() (+12 more)

### Community 61 - "2. Findings, ranked"
Cohesion: 0.14
Nodes (14): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago, L15 — a stale comment claims the No date badge counts suggestions (+6 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (56): A selector the page has not got is refused before the runner, The attempt line says what the model emitted, The inventory sketches one row's insides, The schema requires what the validator will demand, The shape, The three shapes it may propose, attemptCount(), AttemptInfo (+48 more)

### Community 63 - "wallClockToIso"
Cohesion: 0.30
Nodes (14): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, addDays(), nextWeekday(), readClock(), readDateBody(), inferYear() (+6 more)

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "parsePostBody"
Cohesion: 0.15
Nodes (19): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed (+11 more)

### Community 66 - "needs_login detection"
Cohesion: 0.17
Nodes (16): Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption), §0.2 No credential handling (+8 more)

### Community 67 - "I08 · Local Done check-off, separate from Hide"
Cohesion: 0.12
Nodes (20): I08 · Local Done check-off, separate from Hide, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+12 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.10
Nodes (25): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, I60 · Page-aware popup: this course first, focus tab, auto-resync (+17 more)

### Community 69 - "cellByHeader"
Cohesion: 0.26
Nodes (13): House rules for mutation checks, A survivor sometimes indicts the design, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, 2. Findings without an F-number, R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111, R-4 — DEGRADED. A refusal about **Ends** or **Link** lands inside a closed `<details>` (+5 more)

### Community 71 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time (+15 more)

### Community 74 - "suggest.ts"
Cohesion: 0.08
Nodes (44): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, cleanTitle(), describeEmpty(), earlier() (+36 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.11
Nodes (26): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm (+18 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.13
Nodes (39): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip() (+31 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.25
Nodes (11): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, Export .ics moved to the bar, npm run preview — the real popup over canned data, Calendar export (§8.3), §0.1 No backend, §0.6 Ship ugly, Out of scope for v1 (+3 more)

### Community 78 - "proposeWithModel"
Cohesion: 0.08
Nodes (23): And the deterministic proposer reads the list itself, Checking the three lines without a model, Every group now says how much of it is dated, One session per attempt, and what `kErrorUnknown` meant, The context window, The inventory says which groups carry dates, and the search reads lists, The manifest needs no new permission, The retry names the groups that do carry dates (+15 more)

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
Cohesion: 0.16
Nodes (25): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Chrome Web Store submission (draft, not submitted), Fixtures captured, Open full view reuses one tab, PROGRESS.md — what is done, which gate, what is blocked, The store documents, aligned and published (+17 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.16
Nodes (22): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+14 more)

### Community 87 - "applyStoredTheme"
Cohesion: 0.22
Nodes (11): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), applyMode() (+3 more)

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

### Community 93 - "popup.ts"
Cohesion: 0.12
Nodes (43): BROKEN (1), M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, O. The editor (manual items), Audit: 'hiding an event doesn't work on the calendar' — not found, allTimed(), dayContents, dayKey(), dayList() (+35 more)

### Community 97 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "PageCtx"
Cohesion: 0.25
Nodes (9): fetchAll(), NeedsLogin, syncCanvas(), SyncDeps, syncGradescope(), syncPrairieLearn(), syncPrairieTest(), syncSmartPhysics() (+1 more)

### Community 100 - "Defect: the store queue deadlocked"
Cohesion: 0.25
Nodes (11): Parallelism policy, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failing registry refresh retried on every sync, Defect: the store queue deadlocked, Defect: set-adapter-enabled wrote the store outside the queue (+3 more)

### Community 101 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 102 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 103 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 104 - "syncSites"
Cohesion: 0.31
Nodes (9): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, adapterFailureKind(), HttpStatusError, SourceDisabled, SYNC_SPINNER_CAP_MS (+1 more)

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.12
Nodes (16): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), What the term rule is, and why `status` is not it, What was captured (the parser is written against these), class-page.html — `GET https://piazza.com/class/<nid>` (signed in) (+8 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "StoreV1Plus"
Cohesion: 0.46
Nodes (4): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult

### Community 108 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 109 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.12
Nodes (16): 0. Is it even an adapter?, 1. The capture, 2. The schema, 4. The date grammar, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter? (+8 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 114 - "Defect: a Gradescope course labelled stat_425_120248_268442"
Cohesion: 0.47
Nodes (6): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, Course code extraction (§5.1)

### Community 115 - "detect"
Cohesion: 0.28
Nodes (7): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "Popup redesign brief — "soft card direction""
Cohesion: 0.29
Nodes (4): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Module plan, Popup redesign brief — "soft card direction", Verification

### Community 118 - "Adapter"
Cohesion: 0.25
Nodes (5): guessCourseCode(), withLocalAdapter(), withoutLocalAdapter(), Adapter, VALID

### Community 119 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 120 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 121 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 122 - "Store description (plain text)"
Cohesion: 0.29
Nodes (7): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Description field is plain text: paste description.txt, Runs entirely in the browser; never sees a password

### Community 123 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 124 - "4. Measurements"
Cohesion: 0.33
Nodes (6): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.4 Tokens, 4.5 The sizing invariants, 4. Measurements

### Community 125 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 126 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 127 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 128 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 129 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 130 - "J. Day view"
Cohesion: 0.50
Nodes (4): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **646 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+641 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 790 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `types.ts` to `store.ts`, `ParseError`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `rows.ts`, `messages.ts`, `sync.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.test.ts`, `piazza-real.test.ts`, `core/campuswire.ts`, `core/registry.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `health.ts`, `announce-real.test.ts`, `diagnostics.ts`, `gcal.ts`, `gradescope.ts`, `gate0.ts`, `shell.ts`, `scrub.ts`, `tokens.test.ts`, `author.ts`, `suggest.ts`, `skeleton.ts`, `queue.ts`, `Adapter`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `messages.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.test.ts`, `announce.ts`, `core/campuswire.ts`, `background.ts`, `detect.ts`, `types.ts`, `announce-real.test.ts`, `gradescope.ts`, `piazza.ts`, `author.ts`, `wallClockToIso`, `parsePostBody`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `PageCtx`, `syncSites`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `detect()` connect `detect` to `detect.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 5 INFERRED edges - model-reasoned connections that need verification._