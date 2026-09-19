# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 182 files · ~642,797 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 2376 nodes · 6274 edges · 118 communities (111 shown, 7 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 383 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a06442f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- smartphysics.ts
- Canvas — what the API actually returns
- popup.ts
- calendar.ts
- package.json
- dedupe.ts
- prairielearn.ts
- schedule.ts
- RawItem
- manifest.json
- messages.ts
- options.ts
- Build order (§10)
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- setup.ts
- piazza.test.ts
- piazza-real.test.ts
- Chrome Web Store listing draft (§9 G5)
- ics.ts
- validateAdapter
- announce.ts
- Tier 0a (2026-09-10, 13 items)
- StoreV1
- core/campuswire.ts
- options.html: Settings page
- background.ts
- core/registry.ts
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
- diagnostics.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- ParseError
- validateProposal
- capture.ts
- refresh
- icon
- types.ts
- piazza.ts
- vitest
- renderRow
- What You Must Do When Invoked
- tokens.test.ts
- package.mjs
- site.mjs
- author.ts
- icons.mjs
- Asking Sushi for a browser action
- parsePostBody
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- popup.html: the popup and full view document
- The design
- Campuswire fixtures
- describeEmpty
- Installing Illini Dash (beta)
- ref_vitest_config
- suggest.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- UX plan phases A–G (2026-09-12)
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- The colour layer
- sync.test.ts
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- renderMonthView
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- skeleton.test.ts
- Gradescope fixtures provenance
- SyncDeps
- The first live run (2026-09-10): four defects, none caught by 382 tests
- piazzaRun
- Mutation check
- campuswire.test.ts
- Adapter
- Piazza — what the live client actually does (2026-09-18)
- Tier 1: highest value after the beta, no spec change
- StoreV1Plus
- Adapter (declarative course-site adapter)
- announce-real.test.ts
- groundProposal
- Adding a course-site adapter (§4.5)
- resolveMentions
- queue.ts
- Defect: a Gradescope course labelled stat_425_120248_268442
- detect
- ref_node_fs
- ground

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 79 edges
2. `vitest` - 47 edges
3. `Item` - 41 edges
4. `RawItem` - 39 edges
5. `runAdapter()` - 33 edges
6. `piazzaRun()` - 32 edges
7. `Source` - 30 edges
8. `ingestPost()` - 29 edges
9. `UX plan for the store release` - 28 edges
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
- `What is stored: deadlines, courses, settings, corrections in chrome.storage.local` --references--> `applyRetention()`  [INFERRED]
  docs/store/privacy-policy.md → src/core/dedupe.ts

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

## Communities (118 total, 7 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.11
Nodes (33): isOlderThan(), isGcalState(), isInstant(), PiazzaHealth, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast() (+25 more)

### Community 1 - "smartphysics.ts"
Cohesion: 0.11
Nodes (26): linkedom, nonEmpty(), feedRequest(), postBodyRequest(), readTermKey(), getParser(), PARSERS, parseRoundtrip() (+18 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "popup.ts"
Cohesion: 0.07
Nodes (54): agendaRows(), NavigatedAt, SourceAction, ALL_SOURCES, EditorValues, actionButton(), ATTENTION_NOTE, clearDraft() (+46 more)

### Community 4 - "calendar.ts"
Cohesion: 0.08
Nodes (50): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, Anchor, anchorOf(), ATTENTION_ACTIONABLE, ATTENTION_ORDER (+42 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (38): buildId, copyStatic(), observerOptions, options, setup(), watch, devDependencies, esbuild (+30 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.07
Nodes (45): Amendment (2026-09-18): a cross-listed class matched none of the student's rows, I08 · Local Done check-off, separate from Hide, I40 · CBTF reservation-window escalation and missed-reservation notice, I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), Theme: two sources can never say done, assignments-cs425.json (real, 1 undated row), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course) (+37 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (37): Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readClock(), readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+29 more)

### Community 8 - "schedule.ts"
Cohesion: 0.12
Nodes (30): Decision 6: snooze amends §7's daily booking nag, I13 · Reminder toasts with Open / Snooze / Done buttons, Review outcome — steps 9–12 (16 findings, 13 code defects), Notifications (§7), Quiet hours, examDetail(), alarmName(), BOOKING_HOUR (+22 more)

### Community 9 - "RawItem"
Cohesion: 0.10
Nodes (25): opensAt(), RetentionResult, clockOf(), dayOf(), daysAway(), DueText, dueTextFor(), endOfWeek() (+17 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.09
Nodes (33): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+25 more)

### Community 12 - "options.ts"
Cohesion: 0.08
Nodes (48): I57 · Term rollover: term dates in the registry, Expired section, BUILD_ID, adapterFromCandidate(), displayCourseLabel(), currentTermCode(), MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY (+40 more)

### Community 13 - "Build order (§10)"
Cohesion: 0.18
Nodes (22): When live data contradicts a document: rewrite the claim, Review policy, Chrome Web Store submission (draft, not submitted), Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Defect: cs124.org could not be added at all, Open full view reuses one tab, Review outcome — dedupe + sync (16 findings, 7 code defects), The store documents, aligned and published (+14 more)

### Community 14 - "sync.ts"
Cohesion: 0.19
Nodes (20): Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, dedupeInput(), inBackoff(), nextAttemptAt(), adapterPrefix() (+12 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.16
Nodes (30): Light/dark is the is-dark class, not a media query, Light or dark is a setting (is-dark class), menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, isModeName() (+22 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.12
Nodes (22): Shared parser primitives (src/core/parsing.ts), parseDateAttribute(), parseDateRangeAttribute(), FieldResult, LoggedOutOptions, looksLoggedOut(), sameOriginHttpsUrl(), textOf() (+14 more)

### Community 18 - "canvas.ts"
Cohesion: 0.14
Nodes (24): Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API), Canvas while(1); prefix, extractCourseCodes(), CANVAS_ORIGIN (+16 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.15
Nodes (22): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — PrairieLearn (12 findings, all survived) (+14 more)

### Community 20 - "site.ts"
Cohesion: 0.09
Nodes (40): House rules for mutation checks, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, 3. The three page shapes, 4. The date grammar, matchesHostPattern(), AdapterDate, cellByHeader() (+32 more)

### Community 21 - "setup.ts"
Cohesion: 0.29
Nodes (10): loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES, setupProgress, setupRows(), setupSummary(), isSyncing() (+2 more)

### Community 22 - "piazza.test.ts"
Cohesion: 0.09
Nodes (25): The feed's shapes, as captured, bodyBatch, currentTermKey(), highestNr(), MAX_BODIES_PER_SYNC, ObservedPost, PIAZZA_LOGIN_GRACE, PIAZZA_MATCH (+17 more)

### Community 23 - "piazza-real.test.ts"
Cohesion: 0.13
Nodes (18): PostBody, PostPayload, postsToSend(), EXPECTED, FEED, ingest(), NO_OVERRIDES, notes() (+10 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (42): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+34 more)

### Community 25 - "ics.ts"
Cohesion: 0.25
Nodes (15): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+7 more)

### Community 26 - "validateAdapter"
Cohesion: 0.19
Nodes (19): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+11 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (46): addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH, CAL_NUM (+38 more)

### Community 28 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.36
Nodes (10): Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0a (2026-09-10, 13 items), Canonical field precedence for merged items, Per-source health indicator, SourceStatus (+2 more)

### Community 29 - "StoreV1"
Cohesion: 0.39
Nodes (9): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Item, memberKey = source:sourceId, Overrides, RawItem, Retention and purge (§5.4), StoreV1 (+1 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.16
Nodes (19): CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObserverFacts, PageContext, parseFeed(), PostPayload (+11 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.11
Nodes (21): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, #build-info warning slot, hidden unless wrong (+13 more)

### Community 32 - "background.ts"
Cohesion: 0.09
Nodes (45): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Decisions worth not re-litigating, Defect: the store queue deadlocked, allAdapters(), applyObserver(), applySettings() (+37 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.09
Nodes (17): GCAL_API_ORIGIN, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_SCOPE, SOURCE_ORIGIN, sourceForUrl(), PIAZZA_ORIGIN, ADAPTER_KINDS, GRANTED_HOSTS (+9 more)

### Community 34 - "overrides.ts"
Cohesion: 0.19
Nodes (23): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+15 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.19
Nodes (15): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState (+7 more)

### Community 36 - "Sync loop runSync (§6)"
Cohesion: 0.22
Nodes (15): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 5: log both branches of any decision the user will have to debug, Defect: bundled registry was never read, Repo layout: worker is wiring, decisions live in core/, Adapter registry (bundled + daily GitHub refresh), Auto-merge rule (§5.3) (+7 more)

### Community 37 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 38 - "detect.ts"
Cohesion: 0.15
Nodes (23): bestGroupSentence(), Candidate, candidatesFoundLine(), dataRows(), detectCandidates(), detectListCandidates(), guessCourseCode(), hasLink() (+15 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (20): adapters, courses, gcalState, item(), items, listeners, manualRaw, member() (+12 more)

### Community 42 - "gcal.ts"
Cohesion: 0.16
Nodes (20): calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID (+12 more)

### Community 43 - "health.ts"
Cohesion: 0.10
Nodes (42): Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, The one source with no login page (course sites), SourceDiagnostics, actionFor(), Badge, badgeFor(), displayState() (+34 more)

### Community 44 - "shots.mjs"
Cohesion: 0.14
Nodes (10): ref_node_http, ref_node_util, chrome, CHROME_CANDIDATES, dist, filter, outDir, run (+2 more)

### Community 45 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 46 - "diagnostics.ts"
Cohesion: 0.29
Nodes (9): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), Settings, input(), NOW (+1 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.16
Nodes (18): I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I38 · Coalesce catch-up reminder bursts, word by real remaining time (+10 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.11
Nodes (26): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+18 more)

### Community 49 - "ParseError"
Cohesion: 0.16
Nodes (23): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, parseGradescopeDateTime(), shortHash(), KeyGuard, parseField(), parseClassPage(), parseFeed() (+15 more)

### Community 50 - "validateProposal"
Cohesion: 0.12
Nodes (19): A selector the page has not got is refused before the runner, And the deterministic proposer reads the list itself, Checking the three lines without a model, Every group now says how much of it is dated, Rules this feature is held to, The attempt line says what the model emitted, The inventory says which groups carry dates, and the search reads lists, The inventory sketches one row's insides (+11 more)

### Community 51 - "capture.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), countOccurrences() (+8 more)

### Community 52 - "refresh"
Cohesion: 0.12
Nodes (35): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view (+27 more)

### Community 53 - "icon"
Cohesion: 0.13
Nodes (21): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+13 more)

### Community 54 - "types.ts"
Cohesion: 0.20
Nodes (18): Proposal, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+10 more)

### Community 55 - "piazza.ts"
Cohesion: 0.07
Nodes (35): Amendment (2026-09-18, evening): the fetch plan after the trace, ANY_TAG, applyPiazzaResult(), BLOCK_TAG, BodyAttempt, cappedLastNr(), CLASS_LIST_MAX_AGE_MS, ClassPage (+27 more)

### Community 56 - "vitest"
Cohesion: 0.12
Nodes (14): vitest, BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+6 more)

### Community 57 - "renderRow"
Cohesion: 0.13
Nodes (20): courseColours(), coursesIn(), examCount(), movedText(), courseLabel(), movedByText(), bookingWindowText(), courseChoices() (+12 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "package.mjs"
Cohesion: 0.18
Nodes (10): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+2 more)

### Community 61 - "site.mjs"
Cohesion: 0.21
Nodes (12): ref_node_url, escape(), ESCAPES, inline(), manifest, out, page(), policy (+4 more)

### Community 62 - "author.ts"
Cohesion: 0.07
Nodes (49): One session per attempt, and what `kErrorUnknown` meant, The context window, What the student is told, attemptCount(), AttemptInfo, attemptLogLine(), authorAdapter(), AuthorOptions (+41 more)

### Community 63 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 64 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 65 - "parsePostBody"
Cohesion: 0.15
Nodes (19): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed (+11 more)

### Community 66 - "needs_login detection"
Cohesion: 0.13
Nodes (20): Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Review outcome — Gradescope (12 findings, 11 fixed), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption) (+12 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (22): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+14 more)

### Community 69 - "The design"
Cohesion: 0.16
Nodes (14): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+6 more)

### Community 71 - "describeEmpty"
Cohesion: 0.12
Nodes (15): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+7 more)

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+15 more)

### Community 74 - "suggest.ts"
Cohesion: 0.11
Nodes (33): Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, itemOfManual(), extractCourseCode(), normalizeTitle(), alreadySuggested(), AUTO_MOVE_CONFIDENCE (+25 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.18
Nodes (15): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I42 · Google Calendar sync via chrome.identity, I52 · Point-and-click selector picker on the live course page, I53 · Sync settings and overrides via storage.sync (+7 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.18
Nodes (31): The summary has to show a list, not mention one, PLACEHOLDER, ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip(), DATE_SHAPED (+23 more)

### Community 77 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.22
Nodes (13): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, Export .ics moved to the bar, UX plan phases A–G (2026-09-12), npm run preview — the real popup over canned data, Daily booking nag, Calendar export (§8.3), §0.1 No backend (+5 more)

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
Cohesion: 0.27
Nodes (13): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload, README — illini-dash, Build toolchain (§2.4) (+5 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.16
Nodes (22): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes (+14 more)

### Community 87 - "sync.test.ts"
Cohesion: 0.12
Nodes (13): defaultStatus(), emptyGcal(), emptyStore(), sourcesToRetryAfterUpdate(), POPUP_DEBOUNCE_MS, storeWith(), fetchPage(), fixture() (+5 more)

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

### Community 93 - "renderMonthView"
Cohesion: 0.20
Nodes (18): allTimed(), dayKey(), itemsOn(), monthCells(), quietDay(), sinkDone(), startOfDay(), weekContents() (+10 more)

### Community 97 - "skeleton.test.ts"
Cohesion: 0.24
Nodes (8): buildPrompt(), datedPhrase(), MAX_DATED_NOTE_CHARS, MAX_SKETCH_CHARS, renderStructures(), docFrom(), inventory(), repeated()

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "SyncDeps"
Cohesion: 0.30
Nodes (8): fetchAll(), NeedsLogin, syncCanvas(), SyncDeps, syncGradescope(), syncPrairieLearn(), syncPrairieTest(), syncSmartPhysics()

### Community 100 - "The first live run (2026-09-10): four defects, none caught by 382 tests"
Cohesion: 0.33
Nodes (6): Parallelism policy, Trace the path, not just the file, Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failing registry refresh retried on every sync, Defect: set-adapter-enabled wrote the store outside the queue, The first live run (2026-09-10): four defects, none caught by 382 tests

### Community 101 - "piazzaRun"
Cohesion: 0.19
Nodes (15): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, The two re-read lines now count the same thing, piazzaRun(), piazzaToken(), piazzaTrigger(), pool(), classesToPoll(), classListLine() (+7 more)

### Community 102 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 103 - "campuswire.test.ts"
Cohesion: 0.20
Nodes (14): ASSUMED_HOUR, describeObserver(), ObservedPost, byNumber(), feed(), HTML, ingestAll(), items() (+6 more)

### Community 104 - "Adapter"
Cohesion: 0.21
Nodes (11): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, ValidationResult, adapterFailureKind(), HttpStatusError, SourceDisabled (+3 more)

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.11
Nodes (20): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The signed-out page, and the positive marker it made possible, What the term rule is, and why `status` is not it, What was captured (the parser is written against these) (+12 more)

### Community 106 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.20
Nodes (12): Decision 5: campus rows without a course, I01 · Deadline moved / new markers, notification, reminder re-arm, I19 · Per-sync change log strip, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I28 · Keep reminders working past Chrome's 500-alarm cap, I37 · A partial PrairieLearn score is not 'done', I47 · Per-adapter health state and N->0 guard per course site (+4 more)

### Community 107 - "StoreV1Plus"
Cohesion: 0.39
Nodes (5): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult, StoreV1

### Community 108 - "Adapter (declarative course-site adapter)"
Cohesion: 0.25
Nodes (8): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Adapter.columns — header-driven column lookup, smartPhysics as a fifth source, Tier 0b (4 of 7 done), Adapter (declarative course-site adapter)

### Community 109 - "announce-real.test.ts"
Cohesion: 0.29
Nodes (6): EmptyReason, ReadMention, EMPTY, Expected, HTML, POSTS

### Community 110 - "groundProposal"
Cohesion: 0.36
Nodes (8): groundProposal(), inventorySentence(), notASelector(), reachesFromRow(), selectorPart(), selectorParts(), ungrounded(), isHeaderRowOutsideTbody()

### Community 111 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.29
Nodes (6): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5)

### Community 112 - "resolveMentions"
Cohesion: 0.33
Nodes (7): cleanTitle(), courseMatches(), earlier(), isGenericSubject(), itemCodes(), resolveMentions(), titleFor()

### Community 113 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 114 - "Defect: a Gradescope course labelled stat_425_120248_268442"
Cohesion: 0.47
Nodes (6): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, Course code extraction (§5.1)

### Community 115 - "detect"
Cohesion: 0.50
Nodes (4): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **543 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+538 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 660 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `smartphysics.ts`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `RawItem`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `setup.ts`, `piazza.test.ts`, `piazza-real.test.ts`, `ics.ts`, `core/registry.ts`, `overrides.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `gcal.ts`, `health.ts`, `announce.test.ts`, `diagnostics.ts`, `gcal-client.ts`, `ParseError`, `capture.ts`, `icon`, `types.ts`, `tokens.test.ts`, `author.ts`, `suggest.ts`, `sync.test.ts`, `skeleton.test.ts`, `campuswire.test.ts`, `announce-real.test.ts`, `queue.ts`, `ref_node_fs`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `smartphysics.ts`, `prairielearn.ts`, `messages.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.test.ts`, `announce.ts`, `core/campuswire.ts`, `background.ts`, `detect.ts`, `announce.test.ts`, `types.ts`, `piazza.ts`, `author.ts`, `parsePostBody`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `sync.test.ts`, `skeleton.test.ts`, `SyncDeps`, `campuswire.test.ts`, `Adapter`, `ground`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `validateAdapter()` connect `validateAdapter` to `background.ts`, `core/registry.ts`, `store.ts`, `Sync loop runSync (§6)`, `validateRegistry`, `detect.ts`, `schedule.ts`, `Build order (§10)`, `Adding a course-site adapter (§4.5)`, `validateProposal`, `site.ts`, `author.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 5 INFERRED edges - model-reasoned connections that need verification._