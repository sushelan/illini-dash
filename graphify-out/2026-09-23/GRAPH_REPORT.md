# Graph Report - illini-due  (2026-09-23)

## Corpus Check
- 272 files · ~1,144,588 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3426 nodes · 9126 edges · 154 communities (141 shown, 13 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 881 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ee53a2c7`
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
- messages.ts
- options.ts
- popup.ts
- Canvas — what the API actually returns
- makeRowsNavigable
- loadStore
- prairietest.ts
- canvas.ts
- PrairieTest source (§4.4, HTML)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- piazza.test.ts
- SyncDeps
- announce.ts
- piazza.ts
- smartphysics.ts
- Sync loop runSync (§6)
- options.html: Settings page
- sync.test.ts
- core/registry.ts
- background.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- Worker rule 3: a value this code invented is not a value the source stated
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- health.ts
- ref_node_path
- screens/editor.ts
- alerts.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gradescope.ts
- gcalPush
- gate0.ts
- gcal.ts
- shell.ts
- manual.ts
- ingestPost
- scrub.ts
- devDependencies
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- illini-ui-acceptance/SKILL.md
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- Z. Test files that pin popup behaviour
- Gradescope source (§4.2, HTML)
- Tier 0b: beta prerequisites that need Sushi
- theme-panel.ts
- Tier 1: highest value after the beta, no spec change
- Campuswire fixtures
- wallClockToIso
- types.ts
- diagnostics.ts
- Adapter
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
- core/setup.ts
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
- today.ts
- markers.ts
- popup-clearance.test.ts
- 2. Findings, ranked
- row-order.test.ts
- ui-acceptance.test.mjs
- graphify reference: extra exports and benchmark
- Auto-merge rule (§5.3)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- ref_node_fs
- validateRegistry
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- queue.ts
- popup.html: the popup and full view document
- ui-acceptance.mjs
- propose.mjs
- Review R2 — new classes of defect in the redesigned popup
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
- Gate G4 — Beta
- Piazza — what the live client actually does (2026-09-18)
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- icons.mjs
- ui-browser.mjs
- build.mjs
- actionOutcome
- package.json
- scrub-file.mjs
- Google Stitch prompt — Illini Dash popup
- graphify reference: transcribe video and audio
- vitest

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 82 edges
2. `vitest` - 65 edges
3. `Item` - 65 edges
4. `Z. Test files that pin popup behaviour` - 60 edges
5. `runAdapter()` - 46 edges
6. `Source` - 45 edges
7. `RawItem` - 45 edges
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

## Communities (154 total, 13 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.08
Nodes (38): 4. Course-site adapters, 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, guessCourseCode(), localAdapterId(), ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES (+30 more)

### Community 1 - "ParseError"
Cohesion: 0.09
Nodes (42): House rules for parsers, Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited (+34 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.09
Nodes (38): Gradescope — what the fetched HTML actually contains, Dashboard: courseList--term, coursesForTerm, current term first, Hidden Due Date column is state-dependent; parse <time datetime>, Row control changes on submit: <a href> vs button data-assignment-id, Rows: tr containing th.table--primaryLink, Status from div.submissionStatus--text, ignore colour modifiers, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/] (+30 more)

### Community 3 - "UX plan for the store release"
Cohesion: 0.06
Nodes (68): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time (+60 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (77): Month — two drawings of one month, 3. Mutation table, M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, K. Week view, Defect: an exam already sat counted as Overdue, AgendaRow, agendaRows(), allTimed() (+69 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.12
Nodes (31): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+23 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.16
Nodes (21): inferYear(), isNoEndMarker(), parsePrairieLearnScheduleDate(), courseInstanceIdFrom(), creditCeiling(), CreditCell, CreditTier, deadlinesFromSchedule() (+13 more)

### Community 8 - "schedule.ts"
Cohesion: 0.09
Nodes (39): Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, W. What lives in Options, not the popup, I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, store-toast.png is a composite, not a screenshot (+31 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.09
Nodes (27): CourseGroup, courseGroupsForYou(), courseKeysOf(), groupHasCourse(), Response, AdapterEntry, adapterPageName(), ALLOW_CLASS (+19 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.10
Nodes (30): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+22 more)

### Community 12 - "options.ts"
Cohesion: 0.09
Nodes (41): staleWorkerNotice(), emptyCourseGroup(), finishGroup(), addSiteUrl, captureButton, captureUrl, clearRemoval(), copyButton (+33 more)

### Community 13 - "popup.ts"
Cohesion: 0.08
Nodes (56): House rules from the ZIP acceptance pass, 2026-09-19, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., Important files to resume from, The focus mechanism, as built, The repair batch: 1–7 done, 8–10 running (+48 more)

### Community 14 - "Canvas — what the API actually returns"
Cohesion: 0.13
Nodes (23): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+15 more)

### Community 15 - "makeRowsNavigable"
Cohesion: 0.12
Nodes (19): 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked, 6. One structural note, BROKEN (1), DEGRADED (4), R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule (+11 more)

### Community 16 - "loadStore"
Cohesion: 0.25
Nodes (16): I03 · Toolbar badge: today's count, red ! when a source is broken, applySettings(), gcalPushAfter(), maybeRefreshRegistry(), mutate(), refreshBadge(), retryAfterUpdate(), scheduleAlarm() (+8 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.11
Nodes (20): parseDateAttribute(), parseDateRangeAttribute(), SOURCE_ORIGIN, sourceForUrl(), textOf(), cardFor(), EMPTY_CARD, examKey() (+12 more)

### Community 18 - "canvas.ts"
Cohesion: 0.13
Nodes (27): Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Defect: a Gradescope course labelled stat_425_120248_268442, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API), Course code extraction (§5.1) (+19 more)

### Community 19 - "PrairieTest source (§4.4, HTML)"
Cohesion: 0.14
Nodes (22): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Export .ics moved to the bar, Never-signed-in detection for Gradescope and PrairieTest, VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Daily booking nag (+14 more)

### Community 20 - "site.ts"
Cohesion: 0.06
Nodes (72): 3. Where the date comes from, 4. The date grammar, How the date is read out of the located text, 3. Where the date comes from, 4. The date grammar, How the date is read out of the located text, instantsByRow(), coursePagesLayout (+64 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.21
Nodes (14): Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), describePiazza(), PIAZZA_LOGIN_URL, piazzaChipState(), PiazzaHealth (+6 more)

### Community 23 - "icon"
Cohesion: 0.08
Nodes (41): 10. Permissions, A. Document shell and load-time behaviour, Contents, D. Banners, F. Course filter chips, G. Date navigator, L. Month view, M. Exams view (+33 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (42): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+34 more)

### Community 25 - "piazza.test.ts"
Cohesion: 0.06
Nodes (56): House rules for the worker and the loop, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The feed's shapes, as captured, The two re-read lines now count the same thing, piazzaRun(), piazzaToken(), piazzaTrigger() (+48 more)

### Community 26 - "SyncDeps"
Cohesion: 0.21
Nodes (12): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), NeedsLogin, syncCanvas(), SyncDeps (+4 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (69): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+61 more)

### Community 28 - "piazza.ts"
Cohesion: 0.07
Nodes (37): The signed-out page, and the positive marker it made possible, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), piazzaClasses(), CAMPUSWIRE_ORIGIN, ANY_TAG, BLOCK_TAG, BodyAttempt, bodyBatch (+29 more)

### Community 29 - "smartphysics.ts"
Cohesion: 0.13
Nodes (19): Parser rule 8: login detection needs the HTTP status, §0.2 No credential handling, needs_login detection, monthIndex(), looksLoggedOut(), isLoginResponse(), isLoginResponse(), isLoginResponse() (+11 more)

### Community 30 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (20): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Worker rule 5: log both branches of any decision the user will have to debug, Adapter.columns — header-driven column lookup, Defect: bundled registry was never read, smartPhysics as a fifth source (+12 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.11
Nodes (21): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Reporting a broken page uploads nothing, PII and authentication not collected, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+13 more)

### Community 32 - "sync.test.ts"
Cohesion: 0.13
Nodes (14): emptyGcal(), emptyStore(), sourcesToRetryAfterUpdate(), POPUP_DEBOUNCE_MS, currentTermCourses(), storeWith(), deps(), fetchPage() (+6 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.09
Nodes (20): BUILD_ID, EXTENSION_VERSION, GCAL_API_ORIGIN, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_SCOPE, ADAPTER_KINDS, AdapterStanding, FIELDS_ADDED_IN_1_1 (+12 more)

### Community 34 - "background.ts"
Cohesion: 0.08
Nodes (41): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, I57 · Term rollover: term dates in the registry, Expired section, Row menu (⋯), allAdapters(), applyObserver() (+33 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.13
Nodes (20): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+12 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "Worker rule 3: a value this code invented is not a value the source stated"
Cohesion: 0.80
Nodes (6): Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Canonical field precedence for merged items, SOURCE_RANK

### Community 38 - "detect.ts"
Cohesion: 0.05
Nodes (77): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Rules this feature is held to, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, adapterFromCandidate() (+69 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.21
Nodes (14): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (23): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+15 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "health.ts"
Cohesion: 0.07
Nodes (61): 9.3 The four screens, Header health dots: grey/green/yellow/red, Notes on items classified PRESERVED that moved, C. Health pill and source popover, M4: one health pill replaces six dots, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: signing in changed nothing until Sync was pressed, tabs.onUpdated as the sign-in signal (+53 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.09
Nodes (40): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., O. The editor (manual items), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions (+32 more)

### Community 46 - "alerts.ts"
Cohesion: 0.25
Nodes (12): AttentionName, courseColours(), coursesIn(), ATTENTION_NOTE, renderAlertsView(), renderLate(), renderNoDateCard(), renderSuggestions() (+4 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.20
Nodes (16): I01 · Deadline moved / new markers, notification, reminder re-arm, I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows (+8 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.16
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "gradescope.ts"
Cohesion: 0.14
Nodes (18): RFC-3339, DAYS_IN_MONTH, isOlderThan(), MONTHS, pad(), parseGradescopeDateTime(), shortHash(), WEEKDAYS (+10 more)

### Community 50 - "gcalPush"
Cohesion: 0.14
Nodes (17): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Decisions worth not re-litigating, Google Calendar sync, Looking at it without a Google account, The design, What it costs (+9 more)

### Community 51 - "gate0.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (21): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime (+13 more)

### Community 53 - "shell.ts"
Cohesion: 0.06
Nodes (62): E. Tabs and view state, WeekMode, SetupRow, SourceStatus, appMark(), DATE_NAV_CLASS, DATE_NAV_SELECTOR, DateNavControl (+54 more)

### Community 54 - "manual.ts"
Cohesion: 0.21
Nodes (21): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS (+13 more)

### Community 55 - "ingestPost"
Cohesion: 0.13
Nodes (20): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures (+12 more)

### Community 56 - "scrub.ts"
Cohesion: 0.18
Nodes (11): escapeRegex(), BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport (+3 more)

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
Cohesion: 0.08
Nodes (22): answer(), bands(), document, globals, gridHues(), hueOf(), items, keydown() (+14 more)

### Community 61 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.09
Nodes (20): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Evidence first, Honest completion, Illini UI acceptance, Evidence and completion (+12 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (75): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The manifest needs no new permission, The schema requires what the validator will demand (+67 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (18): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Interaction review: four product findings and one harness gap (+10 more)

### Community 64 - "ics.ts"
Cohesion: 0.21
Nodes (15): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+7 more)

### Community 65 - "Z. Test files that pin popup behaviour"
Cohesion: 0.07
Nodes (60): 4. Timezone results, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L9 — `countdown` says "1d late" for something two hours late, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups() (+52 more)

### Community 66 - "Gradescope source (§4.2, HTML)"
Cohesion: 0.13
Nodes (20): Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 2: silent empty is the worst outcome, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), Review outcome — PrairieLearn (12 findings, all survived) (+12 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "theme-panel.ts"
Cohesion: 0.10
Nodes (45): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, V. Theme and dark mode, Light or dark is a setting (is-dark class), allThemeClasses(), DARK_CLASS (+37 more)

### Community 69 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.20
Nodes (12): Decision 5: campus rows without a course, I02 · Exam-day card on PrairieTest rows (room, duration, format), I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I37 · A partial PrairieLearn score is not 'done', I51 · In-options adapter workbench with 'Propose this adapter', I60 · Page-aware popup: this course first, focus tab, auto-resync, I62 · Practice / not-for-credit tagging and demotion (+4 more)

### Community 71 - "wallClockToIso"
Cohesion: 0.09
Nodes (32): House rules for mutation checks, A survivor has three meanings — decide which before acting, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code (+24 more)

### Community 72 - "types.ts"
Cohesion: 0.08
Nodes (43): 2. Data model, 5. Normalize, merge, retain, RetentionResult, PostBody, PostPayload, AUTO_MOVE_CONFIDENCE, IngestInput, IngestOptions (+35 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.26
Nodes (10): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, Settings, input() (+2 more)

### Community 74 - "Adapter"
Cohesion: 0.16
Nodes (14): Worker rule 2: a green dot must mean 'I fetched, and it was fine', B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, Defect: site: ok (0 items) was a lie, statusAfterEnable(), ValidationResult (+6 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.14
Nodes (19): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons (+11 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (52): The summary has to show a list, not mention one, PLACEHOLDER, rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector(), bestDated() (+44 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.19
Nodes (14): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold (+6 more)

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
Cohesion: 0.15
Nodes (25): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parallelism policy, Parser rule 9: the capture beats the spec, Trace the path, not just the file, CLAUDE.md project instructions and house rules, Review policy, Worker rule 7: live data is a source of truth the fixtures are not (+17 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "provenance.test.ts"
Cohesion: 0.25
Nodes (12): STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY (+4 more)

### Community 87 - "core/setup.ts"
Cohesion: 0.33
Nodes (9): UX plan phases A–G (2026-09-12), SOURCE_HINT, loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES, setupProgress, setupRows() (+1 more)

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
Cohesion: 0.09
Nodes (51): The row menu bug — found and fixed 2026-09-18, 3. Findings, ranked, 6. Checked and clean, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand., L2 — Opening a screen moves focus nowhere., L4 — The deadline screen's ⋯ does not toggle., L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter. (+43 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.12
Nodes (26): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, The one source with no login page (course sites), Per-source backoff, Fetch rules for all sources (+18 more)

### Community 100 - "today.ts"
Cohesion: 0.36
Nodes (9): END_OF_DAY_HEADING, LATE_HEADING, emptyNote(), folio(), renderQuiet(), renderTodayView(), row(), section() (+1 more)

### Community 101 - "markers.ts"
Cohesion: 0.20
Nodes (11): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult, render() (+3 more)

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.31
Nodes (8): allRules(), beats(), Rule, rulesIn(), setsBottomMargin(), sheets(), specificity(), winner()

### Community 103 - "2. Findings, ranked"
Cohesion: 0.14
Nodes (17): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, L14 — the suite pins no timezone, and one test defeats itself outside Chicago (+9 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.08
Nodes (17): P. Empty and error states, ref_node_crypto, referenceItems(), sources(), globals, popup, document, globals (+9 more)

### Community 105 - "ui-acceptance.test.mjs"
Cohesion: 0.31
Nodes (8): ref_node_assert_strict, ref_node_test, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES, fixture()

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Auto-merge rule (§5.3)"
Cohesion: 0.24
Nodes (15): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Item, memberKey = source:sourceId, Overrides (+7 more)

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
Nodes (47): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter?, 1. The capture (+39 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "ref_node_fs"
Cohesion: 0.25
Nodes (5): ref_node_fs, ref_vitest_config, html, visible, version

### Community 114 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 118 - "popup.html: the popup and full view document"
Cohesion: 0.10
Nodes (23): Decision 4: manual deadline entry, aggregator or planner, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+15 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "Review R2 — new classes of defect in the redesigned popup"
Cohesion: 0.10
Nodes (18): 9.8 Interaction, Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Structural decisions, Verification, 1. Counts (+10 more)

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
Nodes (11): adapter(), COURSE_KEYS, Entry, globals, Mod, nameOf(), NOTHING, page (+3 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "Gate G4 — Beta"
Cohesion: 0.21
Nodes (15): Chrome Web Store submission (draft, not submitted), Open full view reuses one tab, The store documents, aligned and published, Tier 0a (2026-09-10, 13 items), Gate G4 — Beta, Gate G5 — Store, Per-source health indicator, Options page (§8.2) (+7 more)

### Community 134 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.25
Nodes (7): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.08
Nodes (23): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status, 3. Sources (+15 more)

### Community 137 - "site.mjs"
Cohesion: 0.21
Nodes (12): ref_node_url, escape(), ESCAPES, inline(), manifest, out, page(), policy (+4 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.24
Nodes (11): isDevHash(), normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, applyDevVisibility() (+3 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.09
Nodes (37): EmptyReason, ReadMention, ASSUMED_HOUR, CAMPUSWIRE_MATCH, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts (+29 more)

### Community 141 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.33
Nodes (5): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is established, What is not established, and is blocking a parser, Why this page exists to be parsed at all

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 149 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 163 - "vitest"
Cohesion: 0.14
Nodes (6): linkedom, vitest, quick(), { document, window }, globals, page

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **873 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+868 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1059 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `ParseError` connect `ParseError` to `PrairieTest — what the fetched HTML actually contains`, `prairielearn.ts`, `Illini Dash — design as built`, `messages.ts`, `core/campuswire.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.test.ts`, `SyncDeps`, `announce.ts`, `piazza.ts`, `smartphysics.ts`, `sync.test.ts`, `vitest`, `detect.ts`, `gradescope.ts`, `gate0.ts`, `ingestPost`, `author.ts`, `Gradescope source (§4.2, HTML)`, `wallClockToIso`, `types.ts`, `Adapter`, `skeleton.ts`, `sync.ts`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `store.ts`, `options-dom.test.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `popup.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `actionOutcome`, `site.ts`, `observer-ui.ts`, `icon`, `piazza.test.ts`, `announce.ts`, `piazza.ts`, `smartphysics.ts`, `sync.test.ts`, `core/registry.ts`, `background.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `health.ts`, `gcal-client.ts`, `gradescope.ts`, `gate0.ts`, `gcal.ts`, `shell.ts`, `manual.ts`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `Z. Test files that pin popup behaviour`, `theme-panel.ts`, `types.ts`, `diagnostics.ts`, `skeleton.ts`, `provenance.test.ts`, `core/setup.ts`, `deadline.ts`, `popup-clearance.test.ts`, `row-order.test.ts`, `ref_node_fs`, `queue.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `Item` connect `types.ts` to `store.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `Illini Dash — design as built`, `schedule.ts`, `messages.ts`, `core/campuswire.ts`, `popup.ts`, `icon`, `piazza.test.ts`, `announce.ts`, `background.ts`, `health.ts`, `screens/editor.ts`, `alerts.ts`, `gcal-client.ts`, `gcal.ts`, `shell.ts`, `popup-draw.test.ts`, `ics.ts`, `Z. Test files that pin popup behaviour`, `provenance.test.ts`, `deadline.ts`, `today.ts`, `row-order.test.ts`, `Auto-merge rule (§5.3)`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._