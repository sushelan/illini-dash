# Graph Report - illini-due  (2026-09-27)

## Corpus Check
- 287 files · ~1,209,824 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3670 nodes · 9851 edges · 171 communities (158 shown, 13 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 905 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `586a234f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- smartphysics.ts
- PrairieTest — what the fetched HTML actually contains
- Installing Illini Dash (beta)
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- course-sites.ts
- manifest.json
- types.ts
- options.ts
- ParseError
- The colour layer
- Settings
- background.ts
- prairietest.ts
- canvas.ts
- PrairieTest source (§4.4, HTML)
- site.ts
- support.js
- screens/editor.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- sync.ts
- UX plan for the store release
- announce.ts
- piazza.ts
- needs_login detection
- devDependencies
- options.html: Settings page
- theme-panel.ts
- renderOptions
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- scrub-file.mjs
- detect.ts
- compilerOptions
- deadline.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- health.ts
- ref_node_path
- ui/editor.ts
- suggest.test.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gcal.ts
- announce-real.test.ts
- queue.ts
- grouping.ts
- shell.ts
- manual.ts
- Canvas — what the API actually returns
- scrub.ts
- core/registry.ts
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- Classical Calendar — previous alignment measurements (2026-09-19)
- author.ts
- compat.ts
- linkedom
- focus.ts
- ics.ts
- Tier 0b: beta prerequisites that need Sushi
- renderThemePanel
- normalize.ts
- Campuswire fixtures
- Mutation check
- suggest.ts
- diagnostics.ts
- flows.ts
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
- The design
- sync.test.ts
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- provenance.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Gradescope fixtures provenance
- vitest
- CS 341 (fa26) — course site findings
- gcal-lane.ts
- popup-clearance.test.ts
- popup.ts
- row-order.test.ts
- Course-site adapters and runner (§4.5)
- graphify reference: extra exports and benchmark
- StoreV1
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- StoreV1Plus
- ECE 411 (FA 2026) — what the pages actually say
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- Campuswire — findings
- markers.ts
- ui-acceptance.mjs
- propose.mjs
- Asking Sushi for a browser action
- SyncDeps
- .query
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- options-dom.test.ts
- Asking Sushi for a browser action
- `fixtures/sites/` — the course pages the §4.5 runner is tested against
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- Mutation check
- isItemDone
- shots.mjs
- ui-acceptance.test.mjs
- site.mjs
- focusOrOpen
- page-url.ts
- core/campuswire.ts
- sync-gate.ts
- icons.mjs
- Piazza fixtures
- build.mjs
- view
- package.json
- Sync loop runSync (§6)
- Tier 0a (2026-09-10, 13 items)
- manifest.test.ts
- editor-kind.test.ts
- Google Stitch prompt — Illini Dash popup
- settle
- 2. Findings without an F-number
- applyStoredTheme
- /graphify
- /graphify
- graphify reference: transcribe video and audio
- Auto-merge rule (§5.3)
- 4. Measurements
- offscreen.html: DOMParser host for the service worker
- ui-browser.mjs
- Issue tracker: GitHub
- piazza-real.test.ts
- gate0.ts
- Domain Docs
- Illini Dash — design as built
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 83 edges
2. `vitest` - 69 edges
3. `Item` - 65 edges
4. `Z. Test files that pin popup behaviour` - 60 edges
5. `RawItem` - 47 edges
6. `runAdapter()` - 46 edges
7. `Source` - 46 edges
8. `renderRow()` - 38 edges
9. `icon()` - 37 edges
10. `renderOptions()` - 35 edges

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
- 4-file cycle: `src/core/overrides.ts -> src/core/post-link.ts -> src/core/piazza.ts -> src/core/store.ts -> src/core/overrides.ts`
- 5-file cycle: `src/core/overrides.ts -> src/core/post-link.ts -> src/core/piazza.ts -> src/core/sync.ts -> src/core/store.ts -> src/core/overrides.ts`

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

## Communities (171 total, 13 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.10
Nodes (32): 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, TITLE_NAME_MAX, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth() (+24 more)

### Community 1 - "smartphysics.ts"
Cohesion: 0.13
Nodes (29): House rules for parsers, Shared parser primitives (src/core/parsing.ts), monthIndex(), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), nonEmpty() (+21 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.09
Nodes (37): Per-course time_zone: America/Chicago, Gradescope — what the fetched HTML actually contains, Hidden Due Date column is state-dependent; parse <time datetime>, Row control changes on submit: <a href> vs button data-assignment-id, Rows: tr containing th.table--primaryLink, Status from div.submissionStatus--text, ignore colour modifiers, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Trap: shortnames may be opaque slugs; cross-listings yield two codes (+29 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (22): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time, Dev loop gotchas (+14 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (72): Month — two drawings of one month, 3. Mutation table, 4. Timezone results, 6. The one standing check worth adding, L9 — `countdown` says "1d late" for something two hours late, M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, Review R3 — the core wave and the worker wiring the redesign added, N. Attention view and suggestions (+64 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.20
Nodes (16): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified(), dedupe(), DedupeOptions (+8 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.07
Nodes (48): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 5: typeof x === 'string' is not validation, A survivor has three meanings — decide which before acting, RFC-3339, I37 · A partial PrairieLearn score is not 'done', smartPhysics `/Course/Calendar` — findings, 2026-09-21 (+40 more)

### Community 8 - "schedule.ts"
Cohesion: 0.08
Nodes (53): I27 · 'Can reminders reach you?' check and test-reminder button, I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, fireNotification(), refreshBadge(), reschedule(), ALARM_BUDGET, alarmName() (+45 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.07
Nodes (32): Course rename override (overrides.courseNames), POPUP_STATE_FIELDS, displayCourseLabel(), renameCourse(), CourseGroup, courseGroupsForYou(), courseKeysOf(), emptyCourseGroup() (+24 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.07
Nodes (44): 2. Data model, Proposal, RetentionResult, Candidate, ManualInput, ask(), detectInOffscreen(), ensureOffscreenDocument() (+36 more)

### Community 12 - "options.ts"
Cohesion: 0.06
Nodes (45): showMoreLabel(), shownCandidates(), downloadFile(), downloadIcs(), itemsToExport(), addSiteButton, addSiteUrl, captureButton (+37 more)

### Community 13 - "ParseError"
Cohesion: 0.16
Nodes (18): Dashboard: courseList--term, coursesForTerm, current term first, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], isOlderThan(), parseGradescopeDateTime(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes() (+10 more)

### Community 14 - "The colour layer"
Cohesion: 0.16
Nodes (22): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+14 more)

### Community 15 - "Settings"
Cohesion: 0.16
Nodes (14): Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Chrome Web Store submission (draft, not submitted), Defect: cs124.org could not be added at all, Open full view reuses one tab, smartPhysics as a fifth source, The store documents, aligned and published, Options page (§8.2) (+6 more)

### Community 16 - "background.ts"
Cohesion: 0.09
Nodes (42): Decisions worth not re-litigating, applyObserver(), applySettings(), asJson(), deps, ensureObservers(), gcalClientId(), gcalEventFor() (+34 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.11
Nodes (20): parseDateAttribute(), parseDateRangeAttribute(), shortHash(), SOURCE_ORIGIN, sourceForUrl(), PRAIRIELEARN_ORIGIN, cardFor(), EMPTY_CARD (+12 more)

### Community 18 - "canvas.ts"
Cohesion: 0.13
Nodes (26): Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API), Canvas while(1); prefix, extractCourseCodes(), isInstant() (+18 more)

### Community 19 - "PrairieTest source (§4.4, HTML)"
Cohesion: 0.23
Nodes (14): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Export .ics moved to the bar, VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Calendar export (§8.3), §0.1 No backend, Open questions (§12), Out of scope for v1 (+6 more)

### Community 20 - "site.ts"
Cohesion: 0.06
Nodes (67): House rules for mutation checks, A survivor sometimes indicts the design, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, example-course-schedule.html synthetic fixture, The lectures page, and why it is a fixture and not an entry, What `clauses` reads, on both pages, 1. Counts (+59 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "screens/editor.ts"
Cohesion: 0.07
Nodes (57): The row menu bug — found and fixed 2026-09-18, 4. Cross-worker seam checks, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 5. R1's ten, re-checked, 7. The single cheapest standing check, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape). (+49 more)

### Community 23 - "icon"
Cohesion: 0.12
Nodes (27): M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., Y. Every DOM id and class the popup writes, startOfDay(), ExamPlacement, reservationVerified(), bookMark(), icon(), ICON_PATHS (+19 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (47): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+39 more)

### Community 25 - "sync.ts"
Cohesion: 0.10
Nodes (30): House rules for the worker and the loop, Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, Per-source backoff, Fetch rules for all sources (+22 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.17
Nodes (23): Header health dots: grey/green/yellow/red, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+15 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (60): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+52 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (94): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): which feed field says a post was edited, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured (+86 more)

### Community 29 - "needs_login detection"
Cohesion: 0.15
Nodes (21): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — Gradescope (12 findings, 11 fixed) (+13 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (29): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+21 more)

### Community 32 - "theme-panel.ts"
Cohesion: 0.15
Nodes (27): menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName() (+19 more)

### Community 33 - "renderOptions"
Cohesion: 0.15
Nodes (29): isSourceState(), el(), stateChip(), gcalSection(), observerRow(), refreshOptions(), renderGcal(), renderOptions() (+21 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.20
Nodes (23): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+15 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.22
Nodes (12): ALL_GCAL_STATES, describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState(), when() (+4 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): esbuild, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "detect.ts"
Cohesion: 0.05
Nodes (67): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, ref_node_fs, ref_vitest_config (+59 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "deadline.ts"
Cohesion: 0.08
Nodes (71): 6. Checked and clean, L8 — `openedFrom` survives a screen the tab change discarded., L. Month view, courseColours(), coursesIn(), dayList(), itemTone, examDetail() (+63 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (22): adapters, courses, dataset, gcalState, item(), items, listeners, manualRaw (+14 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "health.ts"
Cohesion: 0.04
Nodes (120): 9.3 The four screens, Structural decisions, Notes on items classified PRESERVED that moved, M8 — The setup screen's "Connected" chip outranks the source's current state., 2. Findings, ranked, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can (+112 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "ui/editor.ts"
Cohesion: 0.13
Nodes (16): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EDITOR_TITLE_ID, EditorOptions, ERROR_FIELD, fieldFor() (+8 more)

### Community 46 - "suggest.test.ts"
Cohesion: 0.21
Nodes (13): AUTO_MOVE_CONFIDENCE, describePost(), ObservedPost, demoPost(), fixture(), input(), item(), items() (+5 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.12
Nodes (26): Decision 4: manual deadline entry, aggregator or planner, I02 · Exam-day card on PrairieTest rows (room, duration, format), I03 · Toolbar badge: today's count, red ! when a source is broken, I04 · Late / reduced-credit window stays live after dueAt, I05 · First-run onboarding page, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I16 · Honest status line and stale-data banner (+18 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.14
Nodes (25): isGoogleAccount(), accountOf(), call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), fetchAccount() (+17 more)

### Community 49 - "gcal.ts"
Cohesion: 0.15
Nodes (19): calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID (+11 more)

### Community 50 - "announce-real.test.ts"
Cohesion: 0.12
Nodes (15): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+7 more)

### Community 51 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 52 - "grouping.ts"
Cohesion: 0.16
Nodes (17): clockOf(), creditPercentFor(), creditWindowText(), dayOf(), daysAway(), DueText, dueTextFor(), endOfWeek() (+9 more)

### Community 53 - "shell.ts"
Cohesion: 0.07
Nodes (49): A. Document shell and load-time behaviour, F. Course filter chips, K. Week view, weekCardStatus(), weekContents(), ANNOUNCE_ID, announced, MENU_TAB_SELECTOR (+41 more)

### Community 54 - "manual.ts"
Cohesion: 0.22
Nodes (19): The inventory sketches one row's insides, ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS, ManualItemError (+11 more)

### Community 55 - "Canvas — what the API actually returns"
Cohesion: 0.15
Nodes (21): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+13 more)

### Community 56 - "scrub.ts"
Cohesion: 0.17
Nodes (11): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport (+3 more)

### Community 57 - "core/registry.ts"
Cohesion: 0.06
Nodes (38): 4. The date grammar, 4. The date grammar, I57 · Term rollover: term dates in the registry, Expired section, allAdapters(), enabledAdapters(), BUILD_ID, EXTENSION_VERSION, guessCourseCode() (+30 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.13
Nodes (15): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2.5 - Video and audio (only if video files detected), Step 2 - Detect files, Step 3 - Extract entities and relationships (+7 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.08
Nodes (14): announced(), document, entryNamed(), globals, items, keydown(), menuOpen(), now (+6 more)

### Community 61 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.07
Nodes (26): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, 1. Tokens, 2. Shell, 3. Today, 4. Week (+18 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (72): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The manifest needs no new permission, The schema requires what the validator will demand (+64 more)

### Community 63 - "compat.ts"
Cohesion: 0.05
Nodes (49): Evidence first, Honest completion, Illini UI acceptance, Six-stage execution, UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Baseline and candidate evidence, Chrome-only work still requiring Sushi (+41 more)

### Community 64 - "linkedom"
Cohesion: 0.26
Nodes (13): linkedom, columnOf(), directCells(), formTableGrid(), GridCache, rowGroups(), rowIndex(), spanValue() (+5 more)

### Community 65 - "focus.ts"
Cohesion: 0.09
Nodes (33): 3. Every non-PRESERVED item, BROKEN (1), DEGRADED (4), REPLACED-RECORDED (49), H. The row, ControlRegion, ControlRequest, controlRequestFor() (+25 more)

### Community 66 - "ics.ts"
Cohesion: 0.21
Nodes (14): #sec-data: Download .ics, Export JSON, Reset, buildIcs(), escapeIcsText(), event(), ExportLeg, exportLegs(), foldIcsLine(), icsDate() (+6 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "renderThemePanel"
Cohesion: 0.25
Nodes (11): W. What lives in Options, not the popup, notificationsBlocked(), read(), remember(), renderModePanel(), renderThemePanel(), renderTweakPanel(), storedMode() (+3 more)

### Community 69 - "normalize.ts"
Cohesion: 0.16
Nodes (16): applyRetention(), badgesOf(), courseCodesOf(), datesCompatible(), opensAt(), sameCourse(), shouldMerge(), sortItems() (+8 more)

### Community 71 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 72 - "suggest.ts"
Cohesion: 0.13
Nodes (27): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, itemOfManual(), describeEmpty(), maskMarkup() (+19 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.31
Nodes (8): buildDiagnostics(), DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, input(), NOW, raw()

### Community 74 - "flows.ts"
Cohesion: 0.20
Nodes (13): actionOutcome, UNEXPLAINED_REFUSAL, Request, Response, applyChange(), ChangeUi, messageOf(), Answer (+5 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.09
Nodes (30): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm (+22 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (56): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+48 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.15
Nodes (17): HANDOFF 2026-09-13: the row menu receives no mouse events, The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes (+9 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.17
Nodes (6): availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "illini-dash"
Cohesion: 0.10
Nodes (20): Agent skills, Also open, Check it in the mode Sushi actually uses, Development loop, Domain docs, graphify, HANDOFF — 2026-09-13, updated 2026-09-18, House rules for the UI, and for diagnosing it (+12 more)

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
Cohesion: 0.17
Nodes (25): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload (+17 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The design"
Cohesion: 0.20
Nodes (10): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+2 more)

### Community 87 - "sync.test.ts"
Cohesion: 0.10
Nodes (23): I59 · Lift backoff and resync immediately on extension update, Defect: source Off but its rows still on the calendar, backoffMinutes(), emptyGcal(), emptyStore(), nextAttemptAt(), sourcesToRetryAfterUpdate(), adapterPrefix() (+15 more)

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
Cohesion: 0.40
Nodes (4): `assessments-cs357.html` — a real capture, `assessments-partial-scores.html` — **constructed, not a capture**, PrairieLearn fixtures, The home page fixtures — **constructed, not captures**

### Community 93 - "provenance.ts"
Cohesion: 0.19
Nodes (16): STUDENT_POST_ID, dateOrigin, HEADING, isStudentsOwn(), movedHeading(), movedRange(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY (+8 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.13
Nodes (15): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2.5 - Video and audio (only if video files detected), Step 2 - Detect files, Step 3 - Extract entities and relationships (+7 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "vitest"
Cohesion: 0.12
Nodes (10): vitest, BLOCKS, CLASSICAL, POPUP, UI, USED, html, visible (+2 more)

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.18
Nodes (15): 4.4 Tokens, allRules(), beats(), contrast(), declared(), over(), resolve(), rgb() (+7 more)

### Community 103 - "popup.ts"
Cohesion: 0.06
Nodes (72): House rules from the ZIP acceptance pass, 2026-09-19, setup(), R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., 5. Checked and clean, Important files to resume from, Interaction review: four product findings and one harness gap, The focus mechanism, as built (+64 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.09
Nodes (15): ref_node_crypto, referenceItems(), globals, popup, document, globals, items, now (+7 more)

### Community 105 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.30
Nodes (12): Open: course sites split across pages, Parser rule 3: never index cells positionally, Worker rule 3: a value this code invented is not a value the source stated, Adapter.columns — header-driven column lookup, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0b (4 of 7 done) (+4 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "StoreV1"
Cohesion: 0.29
Nodes (11): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Gradescope datetime attribute format, Item, memberKey = source:sourceId, Overrides, parseLocalDate(parts, zone) helper, RawItem (+3 more)

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
Cohesion: 0.06
Nodes (53): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), How the date is read out of the located text (+45 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "StoreV1Plus"
Cohesion: 0.46
Nodes (4): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult

### Community 114 - "ECE 411 (FA 2026) — what the pages actually say"
Cohesion: 0.29
Nodes (6): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 118 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 122 - "SyncDeps"
Cohesion: 0.17
Nodes (14): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), fetchChecked(), pooled(), SourceEmpty (+6 more)

### Community 123 - ".query"
Cohesion: 0.22
Nodes (7): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal, Interpreter guard for subcommands, Interpreter guard for subcommands

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
Cohesion: 0.11
Nodes (15): Actions, COURSE_KEYS, Entry, Flows, globals, Mod, nameOf(), NOTHING (+7 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 134 - "isItemDone"
Cohesion: 0.23
Nodes (15): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, isFinished(), isPast(), visibleItems(), contradictsDone(), isItemDone() (+7 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "focusOrOpen"
Cohesion: 0.26
Nodes (8): L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., focusOrOpen(), OpenOutcome, pageKey(), PickedTab, pickTab(), TabLike, TabsApi

### Community 139 - "page-url.ts"
Cohesion: 0.24
Nodes (11): isDevHash(), normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, applyDevVisibility() (+3 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.10
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext (+24 more)

### Community 141 - "sync-gate.ts"
Cohesion: 0.26
Nodes (7): createSyncGate(), FOLLOW_UP_STRENGTH, Pending, SyncGate, SyncGateOptions, SyncTrigger, Harness

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "Piazza fixtures"
Cohesion: 0.33
Nodes (5): class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures, post.json — `POST https://piazza.com/logic/api?method=content.get`, post-running.json — `POST …?method=content.get`, a note that states a deadline

### Community 144 - "build.mjs"
Cohesion: 0.29
Nodes (7): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), watch, ref_node_fs_promises

### Community 145 - "view"
Cohesion: 0.40
Nodes (6): bands(), gridHues(), hueOf(), legendHues(), rowOf(), view()

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "Sync loop runSync (§6)"
Cohesion: 0.12
Nodes (29): Parallelism policy, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 6: match markers exactly and scope them to the smallest element, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not (+21 more)

### Community 148 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.24
Nodes (10): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items), Course code extraction (§5.1) (+2 more)

### Community 149 - "manifest.test.ts"
Cohesion: 0.12
Nodes (13): GCAL_API_ORIGIN, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE, GCAL_TIMEZONE (+5 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "settle"
Cohesion: 0.25
Nodes (8): escape(), keyWith(), onMonth(), settle(), showDay(), showMonth(), showWeek(), withTimedToday()

### Community 153 - "2. Findings without an F-number"
Cohesion: 0.11
Nodes (15): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. Findings without an F-number, 5. The ten fixes worth making, ranked (+7 more)

### Community 154 - "applyStoredTheme"
Cohesion: 0.22
Nodes (11): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), applyMode() (+3 more)

### Community 156 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 159 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 161 - "Auto-merge rule (§5.3)"
Cohesion: 0.32
Nodes (8): Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), PrairieLearn credit cell text (fallback), Title normalization (§5.2), Transitive union-find merge with overrides, BADGE_TOKEN, normalizeTitle()

### Community 162 - "4. Measurements"
Cohesion: 0.40
Nodes (5): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.5 The sizing invariants, 4. Measurements

### Community 163 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 164 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 165 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, Issue tracker: GitHub, PROGRESS.md is the source of truth, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 166 - "piazza-real.test.ts"
Cohesion: 0.09
Nodes (30): Evidence and completion, Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", What the two stages read, and the scorecard over the real feed (+22 more)

### Community 168 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 170 - "Domain Docs"
Cohesion: 0.29
Nodes (6): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, In this repo, until a CONTEXT.md exists, Use the glossary's vocabulary

### Community 180 - "Illini Dash — design as built"
Cohesion: 0.07
Nodes (29): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+21 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **941 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+936 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1143 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `smartphysics.ts`, `store.ts`, `calendar.ts`, `prairielearn.ts`, `schedule.ts`, `course-sites.ts`, `focusOrOpen`, `page-url.ts`, `core/campuswire.ts`, `ParseError`, `types.ts`, `sync-gate.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `manifest.test.ts`, `editor-kind.test.ts`, `icon`, `piazza.ts`, `theme-panel.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `piazza-real.test.ts`, `gate0.ts`, `deadline.ts`, `health.ts`, `suggest.test.ts`, `gcal-client.ts`, `gcal.ts`, `announce-real.test.ts`, `queue.ts`, `Illini Dash — design as built`, `grouping.ts`, `manual.ts`, `scrub.ts`, `core/registry.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `compat.ts`, `linkedom`, `focus.ts`, `ics.ts`, `normalize.ts`, `diagnostics.ts`, `flows.ts`, `skeleton.ts`, `sync.test.ts`, `provenance.ts`, `gcal-lane.ts`, `popup-clearance.test.ts`, `popup.ts`, `row-order.test.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `smartphysics.ts`, `prairielearn.ts`, `types.ts`, `core/campuswire.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `sync.ts`, `announce.ts`, `piazza.ts`, `needs_login detection`, `piazza-real.test.ts`, `detect.ts`, `suggest.test.ts`, `announce-real.test.ts`, `Illini Dash — design as built`, `core/registry.ts`, `author.ts`, `suggest.ts`, `skeleton.ts`, `sync.test.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `Item` connect `calendar.ts` to `store.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `types.ts`, `options.ts`, `core/campuswire.ts`, `background.ts`, `screens/editor.ts`, `icon`, `announce.ts`, `piazza.ts`, `overrides.test.ts`, `piazza-real.test.ts`, `deadline.ts`, `health.ts`, `suggest.test.ts`, `gcal-client.ts`, `gcal.ts`, `announce-real.test.ts`, `Illini Dash — design as built`, `grouping.ts`, `shell.ts`, `popup-draw.test.ts`, `ics.ts`, `normalize.ts`, `suggest.ts`, `provenance.ts`, `popup.ts`, `row-order.test.ts`, `StoreV1`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._