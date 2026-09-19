# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 255 files · ~905,998 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 16, (none) 5, .woff2 2)

## Summary
- 3163 nodes · 8454 edges · 159 communities (147 shown, 12 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 838 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e60f4c4e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
- Canvas — what the API actually returns
- Popup feature inventory
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- Item
- manifest.json
- messages.ts
- options.ts
- Canvas source (§4.1, REST API)
- popup.ts
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- PrairieTest source (§4.4, HTML)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- Review R2 — new classes of defect in the redesigned popup
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
- classical_vellum_journal/DESIGN.md
- validateRegistry
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- types.ts
- health.ts
- ref_node_path
- screens/editor.ts
- emptyStore
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- sync.test.ts
- renderOptions
- gate0.ts
- gcal.ts
- shell.ts
- manual.ts
- piazza.ts
- scrub.ts
- deadline.ts
- /graphify
- tokens.test.ts
- popup-draw.test.ts
- 2. Findings, ranked
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- isItemDone
- cellByHeader
- Campuswire fixtures
- Campuswire — findings
- suggest.test.ts
- ref_vitest_config
- suggest.ts
- Roadmap ideas (88 ranked gaps)
- skeleton.ts
- Popup UI (§8.1)
- When nothing is proposed: the on-device model
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- PROGRESS.md — what is done, which gate, what is blocked
- Tracing a symptom along a runtime path
- provenance.test.ts
- today.ts
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
- sync.ts
- Adapter registry (bundled + daily GitHub refresh)
- What You Must Do When Invoked
- exams-verified.test.ts
- What You Must Do When Invoked
- row-order.test.ts
- Piazza — what the live client actually does (2026-09-18)
- graphify reference: extra exports and benchmark
- StoreV1
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- rows
- Triaging a beta report
- announce.test.ts
- Source
- detect
- Tracing a symptom along a runtime path
- gcal-config.ts
- currentTermCode
- ui-acceptance.mjs
- markers.ts
- preview-acceptance.test.ts
- Asking Sushi for a browser action
- graphify reference: query, path, explain
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Step 3 - Extract entities and relationships
- Step 3 - Extract entities and relationships
- Asking Sushi for a browser action
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- Gate G4 — Beta
- The design
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- local-adapters.test.ts
- ui-acceptance.test.mjs
- icons.mjs
- alerts.ts
- 9. UI
- offscreen.html: DOMParser host for the service worker
- ui-browser.mjs
- illini-ui-acceptance/SKILL.md
- Illini UI acceptance
- UI acceptance reference contract
- Calendar export (§8.3)
- Google Stitch prompt — Illini Dash popup
- Illini Dash UI acceptance
- click
- store.test.ts
- actionOutcome

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 81 edges
2. `Item` - 63 edges
3. `Z. Test files that pin popup behaviour` - 61 edges
4. `vitest` - 59 edges
5. `RawItem` - 45 edges
6. `Source` - 44 edges
7. `icon()` - 36 edges
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

## Communities (159 total, 12 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.12
Nodes (31): 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, isInstant(), ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth() (+23 more)

### Community 1 - "ParseError"
Cohesion: 0.17
Nodes (24): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), shortHash(), KeyGuard (+16 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Popup feature inventory"
Cohesion: 0.09
Nodes (38): setup(), R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 6. Checked and clean, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., B. Header bar, Contents, E. Tabs and view state (+30 more)

### Community 4 - "calendar.ts"
Cohesion: 0.06
Nodes (52): M6 — PROGRESS's "redundant" classification for `dayList`'s title tie-break is wrong; the case is *untested*, M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, AgendaRow, allTimed(), Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, attentionCount() (+44 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (40): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), watch, devDependencies, esbuild (+32 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.12
Nodes (31): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+23 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (38): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+30 more)

### Community 8 - "schedule.ts"
Cohesion: 0.12
Nodes (29): I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, alarmName(), BOOKING_HOUR, clampTitle() (+21 more)

### Community 9 - "Item"
Cohesion: 0.10
Nodes (28): 3. Every non-PRESERVED item, DEGRADED (4), Notes on items classified PRESERVED that moved, REPLACED-RECORDED (49), 4. Timezone results, AttentionGroup, PlacedItem, DedupeOptions (+20 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.11
Nodes (25): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+17 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (32): BUILD_ID, describeObserver(), downloadFile(), downloadIcs(), itemsToExport(), AdapterEntry, addSiteUrl, captureButton (+24 more)

### Community 13 - "Canvas source (§4.1, REST API)"
Cohesion: 0.18
Nodes (13): When live data contradicts a document: rewrite the claim, Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Defect: a Gradescope course labelled stat_425_120248_268442 (+5 more)

### Community 14 - "popup.ts"
Cohesion: 0.11
Nodes (28): House rules from the ZIP acceptance pass, 2026-09-19, The focus mechanism, as built, ViewName, applyFocusRequest(), applyScrollRequest(), currentPlace(), findFocusTarget(), FocusRequest (+20 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.09
Nodes (49): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), A. Document shell and load-time behaviour, V. Theme and dark mode, Light or dark is a setting (is-dark class) (+41 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.06
Nodes (69): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+61 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.11
Nodes (24): Shared parser primitives (src/core/parsing.ts), parseDateAttribute(), parseDateRangeAttribute(), FieldResult, LoggedOutOptions, looksLoggedOut(), sameOriginHttpsUrl(), textOf() (+16 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "PrairieTest source (§4.4, HTML)"
Cohesion: 0.26
Nodes (13): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Daily booking nag, Open questions (§12), PrairieLearn access-details credit schedule, PrairieLearn credit cell text (fallback), PrairieLearn source (§4.3, HTML) (+5 more)

### Community 20 - "site.ts"
Cohesion: 0.11
Nodes (30): 4. The date grammar, 4. The date grammar, matchesHostPattern(), AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText() (+22 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.32
Nodes (6): CAMPUSWIRE_ORIGIN, PIAZZA_LOGIN_URL, PiazzaHealth, ObserverId, ObserverState, now

### Community 23 - "icon"
Cohesion: 0.14
Nodes (24): 10. Permissions, Y. Every DOM id and class the popup writes, ExamPlacement, reservationVerified(), icon(), ICON_PATHS, IconName, MATERIAL_SYMBOLS (+16 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (41): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+33 more)

### Community 25 - "Review R2 — new classes of defect in the redesigned popup"
Cohesion: 0.07
Nodes (27): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. Findings without an F-number, 5. The ten fixes worth making, ranked (+19 more)

### Community 26 - "validateAdapter"
Cohesion: 0.17
Nodes (21): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+13 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (60): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+52 more)

### Community 28 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.27
Nodes (13): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, smartPhysics as a fifth source (+5 more)

### Community 29 - "Sync loop runSync (§6)"
Cohesion: 0.24
Nodes (17): Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Repo layout: worker is wiring, decisions live in core/, Auto-merge rule (§5.3), Build order (§10), §0.5 Chrome only, Gate G2 — Recall (+9 more)

### Community 30 - "core/campuswire.ts"
Cohesion: 0.09
Nodes (37): EmptyReason, ReadMention, ASSUMED_HOUR, CAMPUSWIRE_MATCH, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts (+29 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (30): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+22 more)

### Community 32 - "background.ts"
Cohesion: 0.09
Nodes (48): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Decisions worth not re-litigating, W. What lives in Options, not the popup, Defect: the store queue deadlocked, allAdapters(), applyObserver() (+40 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.11
Nodes (15): SOURCE_ORIGIN, sourceForUrl(), ADAPTER_KINDS, GRANTED_HOSTS, REGISTRY_REFRESH_MS, REGISTRY_URL, ValidationResult, PRAIRIETEST_ORIGIN (+7 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.17
Nodes (24): Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride(), courseSummaries(), dismissSuggestion(), hideItem(), markDone() (+16 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.22
Nodes (12): ALL_GCAL_STATES, describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState(), when() (+4 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 38 - "detect.ts"
Cohesion: 0.11
Nodes (29): And the deterministic proposer reads the list itself, Every group now says how much of it is dated, The inventory says which groups carry dates, and the search reads lists, The retry names the groups that do carry dates, The shape, What a student is told now, Proposal, validateProposal() (+21 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (21): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+13 more)

### Community 42 - "types.ts"
Cohesion: 0.12
Nodes (16): linkedom, ref_node_fs, vitest, PARSERS, parseRoundtrip(), ROUNDTRIP_PARSER_ID, courseUrl(), PageCtx (+8 more)

### Community 43 - "health.ts"
Cohesion: 0.09
Nodes (46): 9.3 The four screens, Structural decisions, 3. Mutation table, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover, Z. Test files that pin popup behaviour (+38 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.10
Nodes (38): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., D. Banners, O. The editor (manual items), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR (+30 more)

### Community 46 - "emptyStore"
Cohesion: 0.28
Nodes (8): emptyGcal(), emptyStore(), input(), NOW, raw(), storeWith(), resting(), storeWith()

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.10
Nodes (30): Decision 4: manual deadline entry, aggregator or planner, I02 · Exam-day card on PrairieTest rows (room, duration, format), I03 · Toolbar badge: today's count, red ! when a source is broken, I04 · Late / reduced-credit window stays live after dueAt, I05 · First-run onboarding page, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I16 · Honest status line and stale-data banner (+22 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "sync.test.ts"
Cohesion: 0.10
Nodes (21): isOlderThan(), parseGradescopeDateTime(), parseField(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN (+13 more)

### Community 50 - "renderOptions"
Cohesion: 0.21
Nodes (23): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterPagePath(), adapterRow(), clearRemoval(), el(), gcalSection() (+15 more)

### Community 51 - "gate0.ts"
Cohesion: 0.20
Nodes (15): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+7 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (21): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime (+13 more)

### Community 53 - "shell.ts"
Cohesion: 0.08
Nodes (49): M8 — The setup screen's "Connected" chip outranks the source's current state., WeekMode, observerRows(), appMark(), renderObserverRows(), ELSEWHERE, GROUPS, renderElsewhere() (+41 more)

### Community 54 - "manual.ts"
Cohesion: 0.25
Nodes (18): 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+10 more)

### Community 55 - "piazza.ts"
Cohesion: 0.04
Nodes (89): Piazza and Campuswire on the front, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The signed-out page, and the positive marker it made possible, The two re-read lines now count the same thing, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), piazzaClasses(), piazzaRun() (+81 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "deadline.ts"
Cohesion: 0.11
Nodes (43): 3. Findings, ranked, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand., L2 — Opening a screen moves focus nowhere., L4 — The deadline screen's ⋯ does not toggle., L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter., L7 — The No date tab's badge tooltip contradicts D3 and its own comment., L8 — `openedFrom` survives a screen the tab change discarded. (+35 more)

### Community 58 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.09
Nodes (20): answer(), bands(), document, globals, gridHues(), hueOf(), items, legendHues() (+12 more)

### Community 61 - "2. Findings, ranked"
Cohesion: 0.15
Nodes (13): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago, L15 — a stale comment claims the No date badge counts suggestions (+5 more)

### Community 62 - "author.ts"
Cohesion: 0.07
Nodes (49): House rules for the on-device model, A selector the page has not got is refused before the runner, attemptCount(), AttemptInfo, attemptLogLine(), authorAdapter(), AuthorOptions, AuthorPage (+41 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 64 - "ics.ts"
Cohesion: 0.27
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 65 - "piazza-real.test.ts"
Cohesion: 0.08
Nodes (33): Evidence and completion, Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited (+25 more)

### Community 66 - "needs_login detection"
Cohesion: 0.14
Nodes (21): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest (+13 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "isItemDone"
Cohesion: 0.21
Nodes (20): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups(), bookingWindowEnd(), dayContents, examBoard (+12 more)

### Community 69 - "cellByHeader"
Cohesion: 0.11
Nodes (23): House rules for mutation checks, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo) (+15 more)

### Community 71 - "Campuswire — findings"
Cohesion: 0.13
Nodes (12): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source, class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT) (+4 more)

### Community 72 - "suggest.test.ts"
Cohesion: 0.17
Nodes (16): RetentionResult, AUTO_MOVE_CONFIDENCE, describePost(), IngestInput, ObservedPost, Overrides, demoPost(), fixture() (+8 more)

### Community 74 - "suggest.ts"
Cohesion: 0.15
Nodes (23): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, describeEmpty(), maskMarkup(), courseCodesOf() (+15 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.09
Nodes (30): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm (+22 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.13
Nodes (41): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+33 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.14
Nodes (18): HANDOFF 2026-09-13: the row menu receives no mouse events, The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes (+10 more)

### Community 78 - "When nothing is proposed: the on-device model"
Cohesion: 0.10
Nodes (19): Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The context window, The manifest needs no new permission, What the student is told, When nothing is proposed: the on-device model, AuthorOutcome, ModelOutcome (+11 more)

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

### Community 86 - "provenance.test.ts"
Cohesion: 0.21
Nodes (15): movedText(), STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), movedRange() (+7 more)

### Community 87 - "today.ts"
Cohesion: 0.20
Nodes (16): Important files to resume from, Interaction review: four product findings and one harness gap, The repair batch: 1–7 done, 8–10 running, END_OF_DAY_HEADING, LATE_HEADING, ensureHostPermission(), emptyNote(), markBusy() (+8 more)

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
Cohesion: 0.12
Nodes (28): BROKEN (1), L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., G. Date navigator, H. The row, K. Week view, dayKey(), MonthDotCell, iconButton() (+20 more)

### Community 97 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.06
Nodes (49): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures (+41 more)

### Community 100 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.27
Nodes (10): Parallelism policy, Trace the path, not just the file, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Defect: bundled registry was never read, Defect: a failing registry refresh retried on every sync, Defect: set-adapter-enabled wrote the store outside the queue, The first live run (2026-09-10): four defects, none caught by 382 tests (+2 more)

### Community 101 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 102 - "exams-verified.test.ts"
Cohesion: 0.24
Nodes (9): 9.2 The five tabs, Exams — everything you have to turn up to, Month — two drawings of one month, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards, booked(), exam() (+1 more)

### Community 103 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.12
Nodes (10): document, globals, items, now, popup, Rule, SHEETS, SOURCES (+2 more)

### Community 105 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.18
Nodes (10): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass (+2 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "StoreV1"
Cohesion: 0.26
Nodes (12): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Gradescope datetime attribute format, Item, memberKey = source:sourceId, Overrides, parseLocalDate(parts, zone) helper, RawItem (+4 more)

### Community 108 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 109 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "rows"
Cohesion: 0.09
Nodes (21): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. The three page shapes, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter? (+13 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 114 - "Source"
Cohesion: 0.11
Nodes (29): 2. Data model, UX plan phases A–G (2026-09-12), agendaRows(), buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError() (+21 more)

### Community 115 - "detect"
Cohesion: 0.28
Nodes (7): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "gcal-config.ts"
Cohesion: 0.20
Nodes (9): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+1 more)

### Community 118 - "currentTermCode"
Cohesion: 0.40
Nodes (5): Rules this feature is held to, I57 · Term rollover: term dates in the registry, Expired section, adapterFromCandidate(), currentTermCode(), buildAdapter()

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 121 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, referenceItems(), globals, popup

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

### Community 128 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 129 - "Step 3 - Extract entities and relationships"
Cohesion: 0.50
Nodes (4): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 3 - Extract entities and relationships

### Community 130 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 133 - "Gate G4 — Beta"
Cohesion: 0.31
Nodes (11): Chrome Web Store submission (draft, not submitted), Open full view reuses one tab, The store documents, aligned and published, Gate G4 — Beta, Gate G5 — Store, Options page (§8.2), Permissions model (§2.3), Privacy policy (Appendix B) (+3 more)

### Community 134 - "The design"
Cohesion: 0.20
Nodes (11): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+3 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.15
Nodes (12): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status, 3. Sources (+4 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.29
Nodes (9): normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, reasonFor(), RFC-3986 (+1 more)

### Community 140 - "local-adapters.test.ts"
Cohesion: 0.29
Nodes (5): 4. Course-site adapters, guessCourseCode(), withLocalAdapter(), withoutLocalAdapter(), VALID

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "alerts.ts"
Cohesion: 0.09
Nodes (41): courseColours(), noDateCount(), noDateGroups(), examDetail(), courseLabel(), fullStamp(), LOGIN_URL, SOURCE_CODE (+33 more)

### Community 144 - "9. UI"
Cohesion: 0.29
Nodes (7): 9.1 The shell, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.9 Appearance, 9. UI

### Community 145 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 146 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 147 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.31
Nodes (4): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt

### Community 148 - "Illini UI acceptance"
Cohesion: 0.50
Nodes (4): Evidence first, Honest completion, Illini UI acceptance, Six-stage execution

### Community 149 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 150 - "Calendar export (§8.3)"
Cohesion: 0.83
Nodes (4): Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "Illini Dash UI acceptance"
Cohesion: 0.40
Nodes (5): Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages

### Community 153 - "click"
Cohesion: 0.29
Nodes (7): Also open, Development loop, HANDOFF — 2026-09-13, updated 2026-09-18, The row menu bug — found and fixed 2026-09-18, The store submission, 9.8 Interaction, click()

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **780 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+775 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 957 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `types.ts` to `calendar.ts`, `scripts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `Item`, `messages.ts`, `local-adapters.test.ts`, `page-url.ts`, `popup.ts`, `alerts.ts`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `observer-ui.ts`, `icon`, `store.test.ts`, `actionOutcome`, `core/campuswire.ts`, `core/registry.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `health.ts`, `emptyStore`, `gcal-client.ts`, `sync.test.ts`, `gate0.ts`, `gcal.ts`, `manual.ts`, `piazza.ts`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.test.ts`, `skeleton.ts`, `provenance.test.ts`, `sync.ts`, `exams-verified.test.ts`, `row-order.test.ts`, `announce.test.ts`, `Source`, `preview-acceptance.test.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `Illini Dash — design as built`, `messages.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `announce.ts`, `core/campuswire.ts`, `background.ts`, `detect.ts`, `types.ts`, `sync.test.ts`, `piazza.ts`, `author.ts`, `piazza-real.test.ts`, `needs_login detection`, `suggest.test.ts`, `suggest.ts`, `skeleton.ts`, `sync.ts`, `Piazza — what the live client actually does (2026-09-18)`, `announce.test.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `validateAdapter()` connect `validateAdapter` to `background.ts`, `core/registry.ts`, `store.ts`, `Adapter registry (bundled + daily GitHub refresh)`, `validateRegistry`, `detect.ts`, `schedule.ts`, `local-adapters.test.ts`, `Canvas source (§4.1, REST API)`, `rows`, `site.ts`, `currentTermCode`, `author.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._