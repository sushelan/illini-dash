# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 250 files · ~867,751 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 25 file(s) not represented in the graph (top: .css 16, (none) 5, .woff2 4)

## Summary
- 3077 nodes · 8267 edges · 159 communities (148 shown, 11 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 827 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `352740ed`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- smartphysics.ts
- PrairieTest — what the fetched HTML actually contains
- popup.ts
- calendar.ts
- build.mjs
- dedupe.ts
- prairielearn.ts
- schedule.ts
- deadline.ts
- manifest.json
- messages.ts
- options.ts
- Canvas source (§4.1, REST API)
- sync.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- needs-you.ts
- validateAdapter
- announce.ts
- Course-site adapters and runner (§4.5)
- Sync loop runSync (§6)
- core/campuswire.ts
- options.html: Settings page
- background.ts
- manifest.test.ts
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- ECE 411 (FA 2026) — what the pages actually say
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- RawItem
- health.ts
- ref_node_path
- screens/editor.ts
- diagnostics.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- ParseError
- Canvas — what the API actually returns
- gate0.ts
- gcal.ts
- shell.ts
- manual.ts
- piazza.ts
- scrub.ts
- closeMenus
- /graphify
- tokens.test.ts
- popup-draw.test.ts
- today.ts
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
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
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- The colour layer
- applyMode
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- month.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- /graphify
- Gradescope fixtures provenance
- SyncDeps
- loadStore
- What You Must Do When Invoked
- 9. UI
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
- core/setup.ts
- detect
- Tracing a symptom along a runtime path
- Popup redesign brief — "soft card direction"
- site.test.ts
- ui-acceptance.mjs
- package.json
- vitest
- scripts
- graphify reference: query, path, explain
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Step 3 - Extract entities and relationships
- Step 3 - Extract entities and relationships
- J. Day view
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- Build order (§10)
- The design
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- sync.test.ts
- ui-acceptance.test.mjs
- icons.mjs
- names.ts
- When nothing is proposed: the on-device model
- Tier 1: highest value after the beta, no spec change
- ref_node_fs
- illini-ui-acceptance/SKILL.md
- Per-source backoff
- UI acceptance reference contract
- Piazza fixtures
- Google Stitch prompt — Illini Dash popup
- Illini Dash UI acceptance
- HANDOFF — 2026-09-13, updated 2026-09-18
- Independent reviewers
- outcome.ts

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 81 edges
2. `Item` - 61 edges
3. `Z. Test files that pin popup behaviour` - 61 edges
4. `vitest` - 55 edges
5. `RawItem` - 44 edges
6. `Source` - 41 edges
7. `icon()` - 39 edges
8. `runAdapter()` - 33 edges
9. `renderRow()` - 33 edges
10. `piazzaRun()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can` --references--> `applyOverride()`  [INFERRED]
  docs/design/review-r3.md → src/background.ts
- `post.json — `POST https://piazza.com/logic/api?method=content.get`` --references--> `describeEmpty()`  [INFERRED]
  fixtures/piazza/README.md → src/core/announce.ts
- `M6 — PROGRESS's "redundant" classification for `dayList`'s title tie-break is wrong; the case is *untested*` --references--> `dayList()`  [INFERRED]
  docs/design/review-r3.md → src/core/calendar.ts
- `No date — listed somewhere, dated nowhere` --references--> `attentionGroups()`  [INFERRED]
  DESIGN.md → src/core/calendar.ts

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

## Communities (159 total, 11 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.08
Nodes (39): 4. Course-site adapters, 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, Course rename override (overrides.courseNames), POPUP_STATE_FIELDS, guessCourseCode(), isInstant(), ALL_OBSERVERS (+31 more)

### Community 1 - "smartphysics.ts"
Cohesion: 0.11
Nodes (28): House rules for parsers, Parser rule 7: RawItem.url is https on the source origin or the fallback, 3.1 Login detection needs the status, 3. Sources, Shared parser primitives (src/core/parsing.ts), shortHash(), FieldResult, LoggedOutOptions (+20 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.10
Nodes (34): Gradescope — what the fetched HTML actually contains, Hidden Due Date column is state-dependent; parse <time datetime>, Row control changes on submit: <a href> vs button data-assignment-id, Rows: tr containing th.table--primaryLink, Status from div.submissionStatus--text, ignore colour modifiers, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Skip fetching courses stating 0 assignments, PrairieLearn — what the fetched HTML actually contains (+26 more)

### Community 3 - "popup.ts"
Cohesion: 0.09
Nodes (49): House rules from the ZIP acceptance pass, 2026-09-19, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., Important files to resume from, Interaction review: four product findings and one harness gap, The focus mechanism, as built (+41 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (55): N. Attention view and suggestions, Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, Anchor, anchorOf(), ATTENTION_ACTIONABLE (+47 more)

### Community 5 - "build.mjs"
Cohesion: 0.15
Nodes (12): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), watch, esbuild, ref_node_fs_promises (+4 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.12
Nodes (31): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+23 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (39): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+31 more)

### Community 8 - "schedule.ts"
Cohesion: 0.12
Nodes (26): I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Quiet hours, alarmName(), BOOKING_HOUR, clampTitle(), deferPastQuietHours(), inQuietHours() (+18 more)

### Community 9 - "deadline.ts"
Cohesion: 0.07
Nodes (59): L8 — `openedFrom` survives a screen the tab change discarded., 3. Mutation table, 4. Timezone results, AttentionName, noDateCount(), noDateGroups(), clockOf(), countdown() (+51 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.14
Nodes (22): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+14 more)

### Community 12 - "options.ts"
Cohesion: 0.08
Nodes (47): saveProposedAdapter(), staleWorkerNotice(), adapterFromCandidate(), displayCourseLabel(), AdapterEntry, adapterGroup(), adapterPageName(), adapterPagePath() (+39 more)

### Community 13 - "Canvas source (§4.1, REST API)"
Cohesion: 0.18
Nodes (13): When live data contradicts a document: rewrite the claim, Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Defect: a Gradescope course labelled stat_425_120248_268442 (+5 more)

### Community 14 - "sync.ts"
Cohesion: 0.25
Nodes (14): Defect: source Off but its rows still on the calendar, dedupeInput(), nextAttemptAt(), adapterPrefix(), applySync(), fetchSync(), overridesBackoff(), planSync() (+6 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.12
Nodes (37): Theme choice in localStorage (illini-dash.theme / illini-dash.mode), menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, isModeName() (+29 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.16
Nodes (24): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+16 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.12
Nodes (19): parseDateAttribute(), parseDateRangeAttribute(), SOURCE_ORIGIN, sourceForUrl(), textOf(), cardFor(), EMPTY_CARD, examKey() (+11 more)

### Community 18 - "canvas.ts"
Cohesion: 0.17
Nodes (20): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+12 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.12
Nodes (27): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates (+19 more)

### Community 20 - "site.ts"
Cohesion: 0.11
Nodes (27): KeyGuard, AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText(), DATE_FORMATS, DueLabelMatch (+19 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.27
Nodes (11): Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), describePiazza(), PIAZZA_LOGIN_URL, piazzaChipState(), PiazzaHealth (+3 more)

### Community 23 - "icon"
Cohesion: 0.11
Nodes (30): setup(), Y. Every DOM id and class the popup writes, createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD (+22 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (43): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+35 more)

### Community 25 - "needs-you.ts"
Cohesion: 0.09
Nodes (40): 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked, 6. One structural note, DEGRADED (4), Notes on items classified PRESERVED that moved, R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule (+32 more)

### Community 26 - "validateAdapter"
Cohesion: 0.19
Nodes (19): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+11 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (68): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+60 more)

### Community 28 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.27
Nodes (13): Open: course sites split across pages, Parser rule 3: never index cells positionally, Worker rule 3: a value this code invented is not a value the source stated, Adapter.columns — header-driven column lookup, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0b (4 of 7 done) (+5 more)

### Community 29 - "Sync loop runSync (§6)"
Cohesion: 0.19
Nodes (22): Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Review outcome — steps 9–12 (16 findings, 13 code defects), Repo layout: worker is wiring, decisions live in core/, Auto-merge rule (§5.3), Gate G2 — Recall (+14 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.10
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext (+24 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.11
Nodes (22): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Reporting a broken page uploads nothing, PII and authentication not collected, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+14 more)

### Community 32 - "background.ts"
Cohesion: 0.09
Nodes (26): Decisions worth not re-litigating, allAdapters(), applyObserver(), deps, ensureObservers(), gcalClientId(), gcalEventFor(), gcalPush() (+18 more)

### Community 33 - "manifest.test.ts"
Cohesion: 0.10
Nodes (16): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+8 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.13
Nodes (31): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Defect: the row menu opened below the fold in week view, Row menu (⋯), applyOverride(), acceptSuggestion() (+23 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.18
Nodes (16): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState (+8 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "ECE 411 (FA 2026) — what the pages actually say"
Cohesion: 0.33
Nodes (5): ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters

### Community 38 - "detect.ts"
Cohesion: 0.13
Nodes (25): What a student is told now, Amendments to SPEC.md, AuthorOptions, bestGroupSentence(), candidatesFoundLine(), dataRows(), detectCandidates(), detectListCandidates() (+17 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.23
Nodes (13): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+5 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (22): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+14 more)

### Community 42 - "RawItem"
Cohesion: 0.20
Nodes (6): RetentionResult, SourceRow, QualityFlag, SourceOutcome, RawItem, SourceState

### Community 43 - "health.ts"
Cohesion: 0.11
Nodes (40): Worker rule 2: a green dot must mean 'I fetched, and it was fine', 9.3 The four screens, Header health dots: grey/green/yellow/red, Structural decisions, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, Z. Test files that pin popup behaviour, M4: one health pill replaces six dots (+32 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.20
Nodes (23): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., I. The row menu, O. The editor (manual items), send(), EditorValues, clearUndo(), closeEditor() (+15 more)

### Community 46 - "diagnostics.ts"
Cohesion: 0.22
Nodes (12): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, groupItems(), sectionFor() (+4 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.15
Nodes (21): I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button (+13 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "ParseError"
Cohesion: 0.11
Nodes (25): Dashboard: courseList--term, coursesForTerm, current term first, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], isOlderThan(), parseGradescopeDateTime(), ParseRequest, ParseResponse, assignmentIdFor(), courseIdFrom() (+17 more)

### Community 50 - "Canvas — what the API actually returns"
Cohesion: 0.12
Nodes (24): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+16 more)

### Community 51 - "gate0.ts"
Cohesion: 0.07
Nodes (34): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me, Asking Sushi for a browser action, Before you ask (+26 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (21): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+13 more)

### Community 53 - "shell.ts"
Cohesion: 0.06
Nodes (61): 2. Data model, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, E. Tabs and view state, F. Course filter chips, ViewName, EmptyState, HealthSummary, NeedsYouInput (+53 more)

### Community 54 - "manual.ts"
Cohesion: 0.25
Nodes (18): 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+10 more)

### Community 55 - "piazza.ts"
Cohesion: 0.04
Nodes (86): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The signed-out page, and the positive marker it made possible, The two re-read lines now count the same thing, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), asJson(), piazzaBody() (+78 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "closeMenus"
Cohesion: 0.07
Nodes (50): The row menu bug — found and fixed 2026-09-18, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.4 Tokens (+42 more)

### Community 58 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.12
Nodes (13): The query switches, The query switches, answer(), document, globals, items, keydown(), now (+5 more)

### Community 61 - "today.ts"
Cohesion: 0.11
Nodes (24): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago, L15 — a stale comment claims the No date badge counts suggestions (+16 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (67): House rules for the on-device model, A selector the page has not got is refused before the runner, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The inventory sketches one row's insides, The schema requires what the validator will demand, The shape (+59 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 64 - "ics.ts"
Cohesion: 0.25
Nodes (15): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+7 more)

### Community 65 - "piazza-real.test.ts"
Cohesion: 0.09
Nodes (35): Evidence and completion, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed (+27 more)

### Community 66 - "needs_login detection"
Cohesion: 0.12
Nodes (21): Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Review outcome — Gradescope (12 findings, 11 fixed), smartPhysics as a fifth source (+13 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (23): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+15 more)

### Community 69 - "cellByHeader"
Cohesion: 0.13
Nodes (19): House rules for mutation checks, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo) (+11 more)

### Community 71 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 72 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+15 more)

### Community 74 - "suggest.ts"
Cohesion: 0.10
Nodes (39): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, describeEmpty(), earlier(), resolveMentions() (+31 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.14
Nodes (19): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons (+11 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.14
Nodes (38): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip() (+30 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.17
Nodes (16): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold, Export .ics moved to the bar (+8 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.18
Nodes (6): availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "illini-dash"
Cohesion: 0.17
Nodes (12): Check it in the mode Sushi actually uses, graphify, House rules for the UI, and for diagnosing it, illini-dash, Parallelism, Reference-driven UI acceptance, Review policy, Rules (+4 more)

### Community 80 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 81 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 82 - "Verifying the popup"
Cohesion: 0.25
Nodes (7): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, Two more, when the UI is quiet, Verifying the popup

### Community 83 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 84 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.24
Nodes (14): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload, README — illini-dash, Build toolchain (§2.4) (+6 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

### Community 87 - "applyMode"
Cohesion: 0.25
Nodes (9): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, V. Theme and dark mode, Light or dark is a setting (is-dark class), applyMode(), syncSwatchMode() (+1 more)

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

### Community 93 - "month.ts"
Cohesion: 0.14
Nodes (32): Month — two drawings of one month, BROKEN (1), M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, G. Date navigator, allTimed(), dayKey(), dayList(), itemsOn() (+24 more)

### Community 97 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "SyncDeps"
Cohesion: 0.30
Nodes (8): fetchAll(), NeedsLogin, syncCanvas(), SyncDeps, syncGradescope(), syncPrairieLearn(), syncPrairieTest(), syncSmartPhysics()

### Community 100 - "loadStore"
Cohesion: 0.12
Nodes (34): House rules for the worker and the loop, Parallelism policy, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, W. What lives in Options, not the popup (+26 more)

### Community 101 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 102 - "9. UI"
Cohesion: 0.13
Nodes (16): 9.1 The shell, 9.2 The five tabs, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.8 Interaction, 9.9 Appearance (+8 more)

### Community 103 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 104 - "syncSites"
Cohesion: 0.32
Nodes (6): Defect: a failed fetch was reported as parse_error, Defect: site: ok (0 items) was a lie, adapterFailureKind(), HttpStatusError, SourceDisabled, syncSites()

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.18
Nodes (10): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass (+2 more)

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
Cohesion: 0.25
Nodes (7): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.12
Nodes (15): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. The three page shapes, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter? (+7 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 114 - "core/setup.ts"
Cohesion: 0.18
Nodes (15): UX plan phases A–G (2026-09-12), agendaRows(), SOURCE_HINT, loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES, setupProgress (+7 more)

### Community 115 - "detect"
Cohesion: 0.28
Nodes (7): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "Popup redesign brief — "soft card direction""
Cohesion: 0.25
Nodes (5): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification

### Community 118 - "site.test.ts"
Cohesion: 0.13
Nodes (21): 4. The date grammar, 4. The date grammar, Remote code: none — adapters are data, not code, Remote code: No, enabledAdapters(), ADAPTER_KINDS, currentTermCode(), GRANTED_HOSTS (+13 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "package.json"
Cohesion: 0.13
Nodes (14): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest, name (+6 more)

### Community 121 - "vitest"
Cohesion: 0.14
Nodes (8): linkedom, ref_node_crypto, vitest, referenceItems(), { document, window }, globals, globals, popup

### Community 122 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, icons, package, pretest, preview, scrub, shots (+6 more)

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

### Community 128 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 129 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 130 - "J. Day view"
Cohesion: 0.50
Nodes (4): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view

### Community 133 - "Build order (§10)"
Cohesion: 0.29
Nodes (13): Chrome Web Store submission (draft, not submitted), Open full view reuses one tab, The store documents, aligned and published, Build order (§10), Gate G3 — Dedupe, Gate G4 — Beta, Gate G5 — Store, Options page (§8.2) (+5 more)

### Community 134 - "The design"
Cohesion: 0.18
Nodes (12): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+4 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.17
Nodes (11): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 5. Normalize, merge, retain (+3 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.29
Nodes (9): normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, reasonFor(), RFC-3986 (+1 more)

### Community 140 - "sync.test.ts"
Cohesion: 0.20
Nodes (5): POPUP_DEBOUNCE_MS, fetchPage(), fixture(), PAGES, runAdapter()

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "names.ts"
Cohesion: 0.36
Nodes (8): fullStamp(), LOGIN_URL, SOURCE_CODE, SOURCE_HOME, SOURCE_TITLE, STATE_PHRASE, STATE_WORD, ALL_SOURCES

### Community 144 - "When nothing is proposed: the on-device model"
Cohesion: 0.22
Nodes (8): And the deterministic proposer reads the list itself, Checking the three lines without a model, Every group now says how much of it is dated, Rules this feature is held to, The inventory says which groups carry dates, and the search reads lists, The manifest needs no new permission, The retry names the groups that do carry dates, When nothing is proposed: the on-device model

### Community 145 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.25
Nodes (9): Decision 5: campus rows without a course, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I37 · A partial PrairieLearn score is not 'done', I47 · Per-adapter health state and N->0 guard per course site, I51 · In-options adapter workbench with 'Propose this adapter', I57 · Term rollover: term dates in the registry, Expired section, Tier 1: highest value after the beta, no spec change (+1 more)

### Community 146 - "ref_node_fs"
Cohesion: 0.25
Nodes (6): ref_node_fs, ref_node_http, ref_node_os, openBrowser(), sleep(), V1

### Community 147 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.36
Nodes (3): Evidence first, Honest completion, Illini UI acceptance

### Community 148 - "Per-source backoff"
Cohesion: 0.32
Nodes (8): Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, backoffMinutes(), inBackoff(), MAX_CONCURRENT_PER_HOST, PLANS, REQUEST_TIMEOUT_MS

### Community 149 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 150 - "Piazza fixtures"
Cohesion: 0.33
Nodes (5): class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures, post.json — `POST https://piazza.com/logic/api?method=content.get`, post-running.json — `POST …?method=content.get`, a note that states a deadline

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "Illini Dash UI acceptance"
Cohesion: 0.40
Nodes (5): Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages

### Community 153 - "HANDOFF — 2026-09-13, updated 2026-09-18"
Cohesion: 0.50
Nodes (4): Also open, Development loop, HANDOFF — 2026-09-13, updated 2026-09-18, The store submission

### Community 154 - "Independent reviewers"
Cohesion: 0.50
Nodes (4): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **756 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+751 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 918 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `smartphysics.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `deadline.ts`, `page-url.ts`, `sync.test.ts`, `names.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `ref_node_fs`, `observer-ui.ts`, `icon`, `announce.ts`, `outcome.ts`, `core/campuswire.ts`, `manifest.test.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `RawItem`, `health.ts`, `diagnostics.ts`, `gcal-client.ts`, `ParseError`, `gate0.ts`, `gcal.ts`, `shell.ts`, `manual.ts`, `piazza.ts`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.ts`, `skeleton.ts`, `9. UI`, `queue.ts`, `core/setup.ts`, `site.test.ts`, `package.json`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `smartphysics.ts`, `prairielearn.ts`, `Illini Dash — design as built`, `messages.ts`, `sync.test.ts`, `sync.ts`, `prairietest.ts`, `canvas.ts`, `Review outcome — PrairieLearn (12 findings, all survived)`, `site.ts`, `announce.ts`, `core/campuswire.ts`, `detect.ts`, `gate0.ts`, `shell.ts`, `piazza.ts`, `author.ts`, `piazza-real.test.ts`, `needs_login detection`, `suggest.ts`, `skeleton.ts`, `SyncDeps`, `loadStore`, `syncSites`, `Piazza — what the live client actually does (2026-09-18)`, `site.test.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `PROGRESS.md — what is done, which gate, what is blocked` connect `PROGRESS.md — what is done, which gate, what is blocked` to `PrairieTest — what the fetched HTML actually contains`, `Build order (§10)`, `Installing Illini Dash (beta)`, `Roadmap ideas (88 ranked gaps)`, `UX plan for the store release`, `Canvas — what the API actually returns`, `illini-ui-acceptance/SKILL.md`, `Chrome Web Store listing draft (§9 G5)`, `validateAdapter`, `Sync loop runSync (§6)`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._