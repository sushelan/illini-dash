# Graph Report - illini-due  (2026-09-18)

## Corpus Check
- 180 files · ~559,537 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 2192 nodes · 5670 edges · 108 communities (102 shown, 6 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 285 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a6ebc297`
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
- messages.ts
- options.ts
- PROGRESS.md — what is done, which gate, what is blocked
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- loadStore
- Sync loop runSync (§6)
- author.test.ts
- Chrome Web Store listing draft (§9 G5)
- ics.ts
- validateAdapter
- announce.ts
- Course-site adapters and runner (§4.5)
- gradescope.ts
- core/campuswire.ts
- options.html: Settings page
- background.ts
- vitest
- overrides.ts
- refresh
- renderMonthView
- Adapter registry (bundled + daily GitHub refresh)
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- gcal.ts
- health.test.ts
- shots.mjs
- announce.test.ts
- Canvas source (§4.1, REST API)
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- ParseError
- renderOptions
- gate0.ts
- campuswire.test.ts
- icon
- types.ts
- piazza.ts
- scrub.ts
- diagnostics.ts
- What You Must Do When Invoked
- tokens.test.ts
- smartPhysics fixtures provenance
- setup.ts
- author.ts
- markers.ts
- Asking Sushi for a browser action
- gcal-auth.ts
- needs_login detection
- manual.ts
- gcal-config.ts
- The design
- Campuswire fixtures
- offscreen.html: DOMParser host for the service worker
- Installing Illini Dash (beta)
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
- Item
- Tracing a symptom along a runtime path
- The colour layer
- openDraftEditor
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- detect
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- gcalPush
- Gradescope fixtures provenance
- sync.test.ts
- Campuswire — findings
- announce-real.test.ts
- Mutation check
- ground
- sourcesToRecheck
- Piazza — what the live client actually does (2026-09-18)
- courseLabel
- Sushi's time is the scarce resource

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 76 edges
2. `vitest` - 46 edges
3. `Item` - 39 edges
4. `RawItem` - 37 edges
5. `runAdapter()` - 30 edges
6. `Source` - 29 edges
7. `UX plan for the store release` - 28 edges
8. `renderOptions()` - 26 edges
9. `wallClockToIso()` - 25 edges
10. `dedupe()` - 25 edges

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

## Communities (108 total, 6 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.09
Nodes (33): isOlderThan(), guessCourseCode(), ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES, FETCHED_SOURCES, isObserverHealth(), isRecord() (+25 more)

### Community 1 - "health.ts"
Cohesion: 0.13
Nodes (25): describeSources(), Badge, EmptyState, emptyStateFor(), FAILING, HealthSummary, HealthTone, NavigatedAt (+17 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "popup.ts"
Cohesion: 0.07
Nodes (54): courseColours(), coursesIn(), examCount(), movedText(), movedByText(), EditorValues, ATTENTION_NOTE, bookingWindowText() (+46 more)

### Community 4 - "calendar.ts"
Cohesion: 0.08
Nodes (47): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, Anchor, anchorOf(), ATTENTION_ACTIONABLE, ATTENTION_ORDER (+39 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (38): buildId, copyStatic(), observerOptions, options, setup(), watch, devDependencies, esbuild (+30 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (33): I08 · Local Done check-off, separate from Hide, I40 · CBTF reservation-window escalation and missed-reservation notice, Theme: two sources can never say done, #sec-tidy: Hidden and Ticked off rows, applyRetention(), badgesOf(), buildItem(), byPrecedence() (+25 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.11
Nodes (36): Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDatePhrase(), DAYS_IN_MONTH, inferYear(), isNoEndMarker(), isRealWallClock() (+28 more)

### Community 8 - "schedule.ts"
Cohesion: 0.14
Nodes (24): I38 · Coalesce catch-up reminder bursts, word by real remaining time, store-toast.png is a composite, not a screenshot, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, examDetail(), alarmName(), BOOKING_HOUR, deferPastQuietHours() (+16 more)

### Community 9 - "grouping.ts"
Cohesion: 0.15
Nodes (19): opensAt(), clockOf(), dayOf(), daysAway(), DueText, dueTextFor(), endOfWeek(), formatDue() (+11 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (34): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+26 more)

### Community 11 - "messages.ts"
Cohesion: 0.12
Nodes (19): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+11 more)

### Community 12 - "options.ts"
Cohesion: 0.08
Nodes (27): BUILD_ID, downloadFile(), downloadIcs(), itemsToExport(), AdapterEntry, adapterPagePath(), addSiteUrl, captureButton (+19 more)

### Community 13 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.17
Nodes (27): When live data contradicts a document: rewrite the claim, CLAUDE.md project instructions and house rules, Review policy, Chrome Web Store submission (draft, not submitted), Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Review outcome — dedupe + sync (16 findings, 7 code defects) (+19 more)

### Community 14 - "sync.ts"
Cohesion: 0.06
Nodes (56): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Worker rule 7: live data is a source of truth the fixtures are not, I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Tier 0b: beta prerequisites that need Sushi (+48 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.16
Nodes (29): Light/dark is the is-dark class, not a media query, menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, isModeName(), isThemeName() (+21 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.14
Nodes (27): Rows say 'time not given' rather than inventing a time, --accent-ink is never white, --primary / --primary-ink for the one filled button, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon (+19 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.12
Nodes (21): Shared parser primitives (src/core/parsing.ts), parseDateAttribute(), parseDateRangeAttribute(), looksLoggedOut(), sameOriginHttpsUrl(), textOf(), isLoginResponse(), cardFor() (+13 more)

### Community 18 - "canvas.ts"
Cohesion: 0.19
Nodes (18): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse(), linkHeaderNext() (+10 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.17
Nodes (19): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — PrairieLearn (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Gradescope datetime attribute format (+11 more)

### Community 20 - "site.ts"
Cohesion: 0.07
Nodes (47): House rules for mutation checks, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. The three page shapes, 4. The date grammar (+39 more)

### Community 21 - "loadStore"
Cohesion: 0.21
Nodes (18): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Defect: the store queue deadlocked, applySettings(), fireNotification(), gcalPushAfter(), mutate() (+10 more)

### Community 22 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (24): Parser rule 4: guard duplicate sourceIds on one page, Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — PrairieTest (12 findings, all survived), Tier 0a (2026-09-10, 13 items), Repo layout: worker is wiring, decisions live in core/, Auto-merge rule (§5.3), Daily booking nag (+16 more)

### Community 23 - "author.test.ts"
Cohesion: 0.18
Nodes (17): The context window, The shape, authorAdapter(), buildPrompt(), htmlForAuthoring(), MAX_AUTHOR_HTML, proposalSchema(), skeletonBudgetChars() (+9 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (44): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+36 more)

### Community 25 - "ics.ts"
Cohesion: 0.33
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 26 - "validateAdapter"
Cohesion: 0.11
Nodes (28): Checking the three lines without a model, Rules this feature is held to, The manifest needs no new permission, The summary has to show a list, not mention one, The three shapes it may propose, When nothing is proposed: the on-device model, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion) (+20 more)

### Community 27 - "announce.ts"
Cohesion: 0.06
Nodes (42): addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+34 more)

### Community 28 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.30
Nodes (12): Open: course sites split across pages, Parser rule 3: never index cells positionally, Worker rule 3: a value this code invented is not a value the source stated, Adapter.columns — header-driven column lookup, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0b (4 of 7 done) (+4 more)

### Community 29 - "gradescope.ts"
Cohesion: 0.19
Nodes (14): Parser rule 1: a bad value costs its field, a missing hook throws, parseGradescopeDateTime(), shortHash(), parseField(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes() (+6 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.14
Nodes (21): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), describeObserver(), isClassFeed(), ObservedPost, ObserverFacts (+13 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (28): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+20 more)

### Community 32 - "background.ts"
Cohesion: 0.07
Nodes (34): I57 · Term rollover: term dates in the registry, Expired section, Open full view reuses one tab, allAdapters(), applyObserver(), asJson(), deps, enabledAdapters(), ensureObservers() (+26 more)

### Community 33 - "vitest"
Cohesion: 0.10
Nodes (19): ref_node_fs, vitest, SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS, REGISTRY_REFRESH_MS (+11 more)

### Community 34 - "overrides.ts"
Cohesion: 0.21
Nodes (21): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+13 more)

### Community 35 - "refresh"
Cohesion: 0.09
Nodes (45): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 2: every send() from a page needs a .catch, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes (+37 more)

### Community 36 - "renderMonthView"
Cohesion: 0.21
Nodes (17): allTimed(), dayKey(), itemsOn(), monthCells(), quietDay(), sinkDone(), startOfDay(), weekContents() (+9 more)

### Community 37 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.15
Nodes (17): Parallelism policy, Trace the path, not just the file, Worker rule 5: log both branches of any decision the user will have to debug, Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table (+9 more)

### Community 38 - "detect.ts"
Cohesion: 0.21
Nodes (14): dataRows(), detectCandidates(), DetectedRow, hasLink(), noCandidateReason(), pickTitleColumn(), rowSelectorForList(), rowSelectorForTable() (+6 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.21
Nodes (14): Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState(), normalizePopupState() (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (20): adapters, courses, gcalState, item(), itemOfManual(), items, listeners, manualRaw (+12 more)

### Community 42 - "gcal.ts"
Cohesion: 0.17
Nodes (19): calendarDate(), calendarDayAfter(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID, Leg (+11 more)

### Community 43 - "health.test.ts"
Cohesion: 0.16
Nodes (16): Header health dots: grey/green/yellow/red, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, The one source with no login page (course sites), #page-sub: version, last check, sources answered, #health: the health pill, actionFor(), displayState(), healthPill (+8 more)

### Community 44 - "shots.mjs"
Cohesion: 0.05
Nodes (40): ref_node_child_process, ref_node_http, ref_node_path, ref_node_url, ref_node_util, all, args, candidates (+32 more)

### Community 45 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 46 - "Canvas source (§4.1, REST API)"
Cohesion: 0.22
Nodes (11): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: a Gradescope course labelled stat_425_120248_268442, Canvas plannable_type → Kind mapping, Canvas planner items endpoint (+3 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.14
Nodes (22): I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button (+14 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "ParseError"
Cohesion: 0.12
Nodes (30): House rules for parsers, Parser rule 5: typeof x === 'string' is not validation, FieldResult, isInstant(), KeyGuard, LoggedOutOptions, nonEmpty(), applyPiazzaResult() (+22 more)

### Community 50 - "renderOptions"
Cohesion: 0.27
Nodes (19): displayCourseLabel(), send(), adapterGroup(), adapterPageName(), adapterRow(), clearRemoval(), el(), gcalSection() (+11 more)

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "campuswire.test.ts"
Cohesion: 0.27
Nodes (11): byNumber(), feed(), HTML, ingestAll(), items(), member(), NO_OVERRIDES, PAGE (+3 more)

### Community 53 - "icon"
Cohesion: 0.15
Nodes (17): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+9 more)

### Community 54 - "types.ts"
Cohesion: 0.18
Nodes (14): linkedom, check(), checkThrows(), describe(), PAGE, runParseSelftest(), SelftestCase, ParserId (+6 more)

### Community 55 - "piazza.ts"
Cohesion: 0.07
Nodes (37): VERIFY — the two captures this is still missing, CLASS_LIST_MAX_AGE_MS, classesToPoll(), ClassPage, currentTermKey(), decodeEntities(), describePiazza(), FEED_LIMIT (+29 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "diagnostics.ts"
Cohesion: 0.16
Nodes (15): I17 · Health-aware popup empty state; no green dot before success, #status: errors only, hidden otherwise, buildDiagnostics(), hoursSince(), scrubError(), SourceDiagnostics, defaultStatus(), emptyGcal() (+7 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 61 - "setup.ts"
Cohesion: 0.22
Nodes (14): UX plan phases A–G (2026-09-12), agendaRows(), SOURCE_HINT, clampTitle(), loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES (+6 more)

### Community 62 - "author.ts"
Cohesion: 0.12
Nodes (19): attemptCount(), AuthorOptions, AuthorOutcome, CHARS_PER_TOKEN, COLUMN_FIELDS, FILTER_FIELDS, MODEL_SELECTORS, ModelOutcome (+11 more)

### Community 63 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "gcal-auth.ts"
Cohesion: 0.19
Nodes (14): ALL_GCAL_STATES, describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+6 more)

### Community 66 - "needs_login detection"
Cohesion: 0.14
Nodes (18): Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), smartPhysics as a fifth source (+10 more)

### Community 67 - "manual.ts"
Cohesion: 0.26
Nodes (15): ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+7 more)

### Community 68 - "gcal-config.ts"
Cohesion: 0.20
Nodes (9): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+1 more)

### Community 69 - "The design"
Cohesion: 0.18
Nodes (12): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+4 more)

### Community 71 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+15 more)

### Community 74 - "suggest.ts"
Cohesion: 0.14
Nodes (24): earlier(), resolveMentions(), itemId(), text(), extractCourseCode(), normalizeTitle(), alreadySuggested(), AUTO_MOVE_CONFIDENCE (+16 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.09
Nodes (33): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 4: manual deadline entry, aggregator or planner, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4 (+25 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.27
Nodes (19): selectorForTable(), ancestry(), cellsOf(), clip(), DATE_SHAPED, describe(), directItems(), DROPPED (+11 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.16
Nodes (17): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, Export .ics moved to the bar, Develop: build, watch, typecheck, test, reload, npm run preview — the real popup over canned data, README — illini-dash (+9 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.17
Nodes (7): What the student is told, availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

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

### Community 84 - "Item"
Cohesion: 0.15
Nodes (13): AttentionGroup, PlacedItem, DedupeOptions, RetentionResult, Section, DATE_FLAGS, QualityFlag, SOFT_FLAGS (+5 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.18
Nodes (19): The colour layer, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+11 more)

### Community 87 - "openDraftEditor"
Cohesion: 0.24
Nodes (13): clearDraft(), clockAt(), draftHours(), draftLabel(), minutesOfClock(), mountDayGrid(), openDraftEditor(), pad2() (+5 more)

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

### Community 97 - "gcalPush"
Cohesion: 0.24
Nodes (8): Decisions worth not re-litigating, gcalClientId(), gcalEventFor(), gcalPush(), Identity, noteGcal(), classifyAuthFailure(), nextGcalState()

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.test.ts"
Cohesion: 0.22
Nodes (5): backoffMinutes(), fetchPage(), fixture(), PAGES, runAdapter()

### Community 100 - "Campuswire — findings"
Cohesion: 0.20
Nodes (9): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Why this is an observer and not a source, describeEmpty() (+1 more)

### Community 101 - "announce-real.test.ts"
Cohesion: 0.22
Nodes (8): EmptyReason, ReadMention, PostPayload, EMPTY, Expected, HTML, mentionsOf(), POSTS

### Community 102 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 104 - "sourcesToRecheck"
Cohesion: 0.47
Nodes (6): Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: signing in changed nothing until Sync was pressed, tabs.onUpdated as the sign-in signal, Popup-triggered sync debounce, RECHECK_AFTER_MS, sourcesToRecheck()

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.11
Nodes (17): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), The feed's shapes, as captured, The fixture's scrub was broken, and is repaired, What the snippet stage actually reads — and what it does not, What the term rule is, and why `status` is not it, What was captured (the parser is written against these) (+9 more)

### Community 106 - "courseLabel"
Cohesion: 0.50
Nodes (4): Course rename override (overrides.courseNames), POPUP_STATE_FIELDS, courseLabel(), renameCourse()

### Community 107 - "Sushi's time is the scarce resource"
Cohesion: 0.50
Nodes (4): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light or dark is a setting (is-dark class)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **511 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+506 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 628 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `health.ts`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `messages.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `loadStore`, `author.test.ts`, `ics.ts`, `gradescope.ts`, `overrides.ts`, `detect.ts`, `compat.ts`, `gcal.ts`, `health.test.ts`, `announce.test.ts`, `gcal-client.ts`, `ParseError`, `gate0.ts`, `campuswire.test.ts`, `icon`, `types.ts`, `piazza.ts`, `scrub.ts`, `diagnostics.ts`, `tokens.test.ts`, `setup.ts`, `gcal-auth.ts`, `manual.ts`, `suggest.ts`, `Item`, `sync.test.ts`, `announce-real.test.ts`, `courseLabel`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `messages.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `loadStore`, `announce.ts`, `gradescope.ts`, `core/campuswire.ts`, `vitest`, `announce.test.ts`, `campuswire.test.ts`, `types.ts`, `piazza.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `sync.test.ts`, `ground`, `Piazza — what the live client actually does (2026-09-18)`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `validateAdapter()` connect `validateAdapter` to `background.ts`, `vitest`, `store.ts`, `Adapter registry (bundled + daily GitHub refresh)`, `detect.ts`, `schedule.ts`, `site.ts`, `author.test.ts`, `author.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 4 INFERRED edges - model-reasoned connections that need verification._