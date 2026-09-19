# Graph Report - illini-due  (2026-09-18)

## Corpus Check
- 182 files · ~622,047 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 2333 nodes · 6134 edges · 107 communities (102 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 367 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be96c77e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
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
- Gate G4 — Beta
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- loadStore
- Sync loop runSync (§6)
- piazza-real.test.ts
- Chrome Web Store listing draft (§9 G5)
- ics.ts
- validateAdapter
- announce.ts
- Worker rule 3: a value this code invented is not a value the source stated
- Auto-merge rule (§5.3)
- core/campuswire.ts
- options.html: Settings page
- background.ts
- manifest.test.ts
- overrides.ts
- renderOptions
- Adapter registry (bundled + daily GitHub refresh)
- ECE 411 (FA 2026) — what the pages actually say
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- gcal.ts
- health.ts
- shots.mjs
- announce.test.ts
- Canvas source (§4.1, REST API)
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gradescope.ts
- wallClockToIso
- gate0.ts
- send
- icon
- types.ts
- piazza.ts
- scrub.ts
- Item
- What You Must Do When Invoked
- tokens.test.ts
- sync.test.ts
- gcal-client.test.ts
- author.ts
- piazzaRun
- Asking Sushi for a browser action
- Adapter (declarative course-site adapter)
- needs_login detection
- I08 · Local Done check-off, separate from Hide
- popup.html: the popup and full view document
- What Sushi has to do before this can run
- Campuswire fixtures
- Campuswire — findings
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
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- The colour layer
- download.ts
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- smartPhysics fixtures provenance
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- Adding a course-site adapter (§4.5)
- Gradescope fixtures provenance
- markers.ts
- Store description (plain text)
- authorAdapter
- cellByHeader
- groundProposal
- queue.ts
- Piazza — what the live client actually does (2026-09-18)
- offscreen.html: DOMParser host for the service worker

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 78 edges
2. `vitest` - 47 edges
3. `Item` - 41 edges
4. `RawItem` - 39 edges
5. `piazzaRun()` - 31 edges
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

## Communities (107 total, 5 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.05
Nodes (61): Settings, isOlderThan(), guessCourseCode(), buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError() (+53 more)

### Community 1 - "ParseError"
Cohesion: 0.15
Nodes (31): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex), Shared parser primitives (src/core/parsing.ts), FieldResult, KeyGuard, LoggedOutOptions (+23 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "popup.ts"
Cohesion: 0.07
Nodes (53): agendaRows(), dayKey(), hourRange(), minutesInto(), spanMinutes(), EditorValues, anchorDate(), ATTENTION_NOTE (+45 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (58): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, allTimed(), Anchor, anchorOf(), ATTENTION_ACTIONABLE (+50 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (38): buildId, copyStatic(), observerOptions, options, setup(), watch, devDependencies, esbuild (+30 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.10
Nodes (35): earlier(), resolveMentions(), applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus() (+27 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.13
Nodes (24): RFC-3339, DAYS_IN_MONTH, isNoEndMarker(), MONTHS, parsePrairieLearnScheduleDate(), WEEKDAYS, ZONE_OFFSETS, courseInstanceIdFrom() (+16 more)

### Community 8 - "schedule.ts"
Cohesion: 0.13
Nodes (27): I13 · Reminder toasts with Open / Snooze / Done buttons, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I41 · Morning toast instead of 2h lead for runner-invented times, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, alarmName(), BOOKING_HOUR, clampTitle() (+19 more)

### Community 9 - "grouping.ts"
Cohesion: 0.09
Nodes (34): bookings(), opensAt(), clockOf(), dayOf(), daysAway(), DueText, dueTextFor(), endOfWeek() (+26 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.09
Nodes (28): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+20 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (28): BUILD_ID, piazzaChipState(), MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, AdapterEntry, adapterPagePath(), addSiteUrl (+20 more)

### Community 13 - "Gate G4 — Beta"
Cohesion: 0.31
Nodes (11): Chrome Web Store submission (draft, not submitted), Open full view reuses one tab, The store documents, aligned and published, Gate G4 — Beta, Gate G5 — Store, Options page (§8.2), Permissions model (§2.3), Privacy policy (Appendix B) (+3 more)

### Community 14 - "sync.ts"
Cohesion: 0.07
Nodes (47): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, Defect: a Gradescope course labelled stat_425_120248_268442 (+39 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.16
Nodes (30): Light/dark is the is-dark class, not a media query, Light or dark is a setting (is-dark class), menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, isModeName() (+22 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.13
Nodes (29): #filters scroll-container exemption in the width check, Popup document must never exceed 400px, Preview harness: preview-popup.html, preview-options.html, components.html, shot.html, Tab strip min-width: 0 guard, icon and label on all five tabs, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04 (+21 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), textOf(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.20
Nodes (16): Decision: Canvas concluded-course filter via include[]=term, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), linkHeaderNext(), mapKind(), mapStatus() (+8 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.19
Nodes (15): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Gradescope datetime attribute format, Open questions (§12), parseLocalDate(parts, zone) helper, PrairieLearn access-details credit schedule (+7 more)

### Community 20 - "site.ts"
Cohesion: 0.08
Nodes (32): 3. The three page shapes, 4. The date grammar, matchesHostPattern(), AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText() (+24 more)

### Community 21 - "loadStore"
Cohesion: 0.15
Nodes (29): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, I03 · Toolbar badge: today's count, red ! when a source is broken, Defect: the store queue deadlocked, applySettings(), fireNotification(), gcalPushAfter() (+21 more)

### Community 22 - "Sync loop runSync (§6)"
Cohesion: 0.26
Nodes (12): Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieTest (12 findings, all survived), Repo layout: worker is wiring, decisions live in core/, Daily booking nag, §0.5 Chrome only, Notifications (§7), Offscreen document (DOM_PARSER) (+4 more)

### Community 23 - "piazza-real.test.ts"
Cohesion: 0.08
Nodes (34): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): the reader version, and posts read at their snippets, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited (+26 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (38): Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5), Store icon: navy tile, one orange bar, white tick, alarms permission justification, commands permission justification, contextMenus permission justification (+30 more)

### Community 25 - "ics.ts"
Cohesion: 0.33
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 26 - "validateAdapter"
Cohesion: 0.14
Nodes (23): Rules this feature is held to, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, dateFormat chosen from a closed set (+15 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (51): Announcement fixtures, ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+43 more)

### Community 28 - "Worker rule 3: a value this code invented is not a value the source stated"
Cohesion: 0.80
Nodes (6): Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Canonical field precedence for merged items, SOURCE_RANK

### Community 29 - "Auto-merge rule (§5.3)"
Cohesion: 0.25
Nodes (14): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Item, memberKey = source:sourceId, Overrides (+6 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.11
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), describeObserver(), isClassFeed(), ObservedPost, ObserverFacts (+24 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (20): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I51 · In-options adapter workbench with 'Propose this adapter', I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0) (+12 more)

### Community 32 - "background.ts"
Cohesion: 0.10
Nodes (25): Decisions worth not re-litigating, I57 · Term rollover: term dates in the registry, Expired section, allAdapters(), applyObserver(), deps, enabledAdapters(), ensureObservers(), gcalClientId() (+17 more)

### Community 33 - "manifest.test.ts"
Cohesion: 0.11
Nodes (19): GCAL_API_ORIGIN, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_SCOPE, SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS (+11 more)

### Community 34 - "overrides.ts"
Cohesion: 0.24
Nodes (18): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+10 more)

### Community 35 - "renderOptions"
Cohesion: 0.29
Nodes (17): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterRow(), clearRemoval(), el(), gcalSection(), noteRemoval() (+9 more)

### Community 36 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.17
Nodes (15): Check it in the mode Sushi actually uses (dark), Parallelism policy, Trace the path, not just the file, Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Defect: bundled registry was never read (+7 more)

### Community 37 - "ECE 411 (FA 2026) — what the pages actually say"
Cohesion: 0.29
Nodes (6): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters

### Community 38 - "detect.ts"
Cohesion: 0.15
Nodes (18): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), dataRows(), detectCandidates(), DetectedRow, hasLink(), noCandidateReason() (+10 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.16
Nodes (18): Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+10 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (36): adapters, courses, gcalState, item(), itemOfManual(), items, listeners, manualRaw (+28 more)

### Community 42 - "gcal.ts"
Cohesion: 0.16
Nodes (20): calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID (+12 more)

### Community 43 - "health.ts"
Cohesion: 0.06
Nodes (65): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Header health dots: grey/green/yellow/red, M4: one health pill replaces six dots, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: 'couldn't be read' for both parse and network failures, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, Defect: signing in changed nothing until Sync was pressed, tabs.onUpdated as the sign-in signal (+57 more)

### Community 44 - "shots.mjs"
Cohesion: 0.05
Nodes (40): ref_node_child_process, ref_node_http, ref_node_path, ref_node_url, ref_node_util, all, args, candidates (+32 more)

### Community 45 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 46 - "Canvas source (§4.1, REST API)"
Cohesion: 0.22
Nodes (9): When live data contradicts a document: rewrite the claim, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API), Course code extraction (§5.1) (+1 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.18
Nodes (16): I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I54 · Versioned store migrations with memberKey remapping (+8 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.13
Nodes (26): Looking at it without a Google account, The design, What it costs, call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent() (+18 more)

### Community 49 - "gradescope.ts"
Cohesion: 0.20
Nodes (14): parseGradescopeDateTime(), shortHash(), extractCourseCodes(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), isLoginResponse() (+6 more)

### Community 50 - "wallClockToIso"
Cohesion: 0.25
Nodes (15): Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, addDays(), nextWeekday(), readClock(), readDateBody(), inferYear(), isRealWallClock() (+7 more)

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "send"
Cohesion: 0.08
Nodes (56): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 2: every send() from a page needs a .catch, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes (+48 more)

### Community 53 - "icon"
Cohesion: 0.15
Nodes (17): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+9 more)

### Community 54 - "types.ts"
Cohesion: 0.11
Nodes (17): linkedom, ref_node_fs, vitest, QualityFlag, PARSERS, parseRoundtrip(), ROUNDTRIP_PARSER_ID, courseUrl() (+9 more)

### Community 55 - "piazza.ts"
Cohesion: 0.05
Nodes (61): Amendment (2026-09-18, evening): the fetch plan after the trace, The feed's shapes, as captured, ANY_TAG, applyPiazzaResult(), BLOCK_TAG, BodyAttempt, bodyBatch, cappedLastNr() (+53 more)

### Community 56 - "scrub.ts"
Cohesion: 0.20
Nodes (10): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+2 more)

### Community 57 - "Item"
Cohesion: 0.14
Nodes (13): EmptyReason, ReadMention, AttentionGroup, PlacedItem, PostPayload, DedupeOptions, Section, Item (+5 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "sync.test.ts"
Cohesion: 0.20
Nodes (6): deps(), fetchPage(), fixture(), gatedDeps(), PAGES, runAdapter()

### Community 61 - "gcal-client.test.ts"
Cohesion: 0.22
Nodes (6): PushResult, retryDelay(), withRetry(), RemoteEvent, Call, ok()

### Community 62 - "author.ts"
Cohesion: 0.07
Nodes (42): What the student is told, attemptCount(), AttemptInfo, attemptLogLine(), AuthorOptions, AuthorOutcome, AuthorPage, CHARS_PER_TOKEN (+34 more)

### Community 63 - "piazzaRun"
Cohesion: 0.14
Nodes (19): asJson(), piazzaBody(), piazzaClasses(), piazzaRun(), piazzaToken(), piazzaTrigger(), pool(), bodyFailureKind (+11 more)

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "Adapter (declarative course-site adapter)"
Cohesion: 0.25
Nodes (8): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Adapter.columns — header-driven column lookup, smartPhysics as a fifth source, Tier 0b (4 of 7 done), Adapter (declarative course-site adapter)

### Community 66 - "needs_login detection"
Cohesion: 0.15
Nodes (19): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — Gradescope (12 findings, 11 fixed) (+11 more)

### Community 67 - "I08 · Local Done check-off, separate from Hide"
Cohesion: 0.12
Nodes (20): I08 · Local Done check-off, separate from Hide, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+12 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (22): Decision 4: manual deadline entry, aggregator or planner, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+14 more)

### Community 69 - "What Sushi has to do before this can run"
Cohesion: 0.33
Nodes (5): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, What Sushi has to do before this can run

### Community 71 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.15
Nodes (21): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time, Dev loop gotchas (+13 more)

### Community 74 - "suggest.ts"
Cohesion: 0.09
Nodes (39): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures (+31 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (24): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm (+16 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.21
Nodes (26): The summary has to show a list, not mention one, proposalSchema(), isHeaderRowOutsideTbody(), ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip() (+18 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.38
Nodes (7): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, npm run preview — the real popup over canned data, §0.6 Ship ugly, Popup-triggered sync debounce, Popup UI (§8.1), Rendering security rules

### Community 78 - "language-model.d.ts"
Cohesion: 0.18
Nodes (6): availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

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
Cohesion: 0.24
Nodes (17): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload, README — illini-dash (+9 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.22
Nodes (16): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, --primary / --primary-ink for the one filled button (+8 more)

### Community 87 - "download.ts"
Cohesion: 0.39
Nodes (7): Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1, downloadFile(), downloadIcs(), itemsToExport()

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

### Community 97 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.29
Nodes (6): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 100 - "Store description (plain text)"
Cohesion: 0.29
Nodes (7): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Description field is plain text: paste description.txt, Runs entirely in the browser; never sees a password

### Community 101 - "authorAdapter"
Cohesion: 0.20
Nodes (16): A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The context window, The manifest needs no new permission, The shape, The three shapes it may propose, When nothing is proposed: the on-device model (+8 more)

### Community 102 - "cellByHeader"
Cohesion: 0.23
Nodes (12): House rules for mutation checks, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code (+4 more)

### Community 103 - "groundProposal"
Cohesion: 0.43
Nodes (7): groundProposal(), inventorySentence(), notASelector(), reachesFromRow(), selectorPart(), selectorParts(), ungrounded()

### Community 104 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.15
Nodes (14): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), The signed-out page, and the positive marker it made possible, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), class-page.html — `GET https://piazza.com/class/<nid>` (signed in), classifyClassPage() (+6 more)

### Community 106 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **535 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+530 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 652 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `messages.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `loadStore`, `piazza-real.test.ts`, `announce.ts`, `core/campuswire.ts`, `announce.test.ts`, `gradescope.ts`, `wallClockToIso`, `types.ts`, `piazza.ts`, `sync.test.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `vitest` connect `types.ts` to `store.ts`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `messages.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza-real.test.ts`, `ics.ts`, `core/campuswire.ts`, `manifest.test.ts`, `overrides.ts`, `detect.ts`, `compat.ts`, `preview-data.ts`, `gcal.ts`, `health.ts`, `announce.test.ts`, `gradescope.ts`, `gate0.ts`, `icon`, `piazza.ts`, `scrub.ts`, `Item`, `tokens.test.ts`, `sync.test.ts`, `gcal-client.test.ts`, `author.ts`, `suggest.ts`, `queue.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `watch`, `buildId`, `options` to the rest of the system?**
  _535 weakly-connected nodes found - possible documentation gaps or missing edges._