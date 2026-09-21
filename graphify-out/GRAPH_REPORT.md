# Graph Report - illini-due  (2026-09-21)

## Corpus Check
- 266 files · ~1,007,317 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .css 13, (none) 5, .woff2 2)

## Summary
- 3355 nodes · 8994 edges · 156 communities (144 shown, 12 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 875 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ca38a9bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
- Canvas — what the API actually returns
- UX plan for the store release
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- core/registry.ts
- manifest.json
- types.ts
- options.ts
- Adapter registry (bundled + daily GitHub refresh)
- popup.ts
- theme-panel.ts
- Course-site adapters and runner (§4.5)
- prairietest.ts
- canvas.ts
- sourcesToRecheck
- site.ts
- support.js
- observer-ui.ts
- rows.ts
- Chrome Web Store listing draft (§9 G5)
- focus.ts
- The design
- announce.ts
- piazza.ts
- makeRowsNavigable
- shell.ts
- options.html: Settings page
- background.ts
- vitest
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- validateRegistry
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- store.test.ts
- health.ts
- ref_node_path
- screens/editor.ts
- table-grid.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- sync.test.ts
- Piazza fixtures
- gate0.ts
- gcal.ts
- state.ts
- RawItem
- renderOptions
- scrub.ts
- devDependencies
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- gcal-config.ts
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- syncCanvas
- view
- Mutation check
- Campuswire fixtures
- describeEmpty
- suggest.ts
- diagnostics.ts
- Adapter
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
- provenance.test.ts
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- Popup feature inventory
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Gradescope fixtures provenance
- sync.ts
- SyncDeps
- markers.ts
- row-order.test.ts
- StoreV1Plus
- graphify reference: extra exports and benchmark
- Sync loop runSync (§6)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- announce-real.test.ts
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- healthPill
- ui-acceptance.mjs
- propose.mjs
- Asking Sushi for a browser action
- graphify reference: query, path, explain
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- CS/ECE 374 A (FA 2026) — what the pages actually say
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
- ui-acceptance.test.mjs
- icons.mjs
- build.mjs
- Illini Dash UI acceptance
- package.json
- UI acceptance reference contract
- setup.test.ts
- scrub-file.mjs
- preview-acceptance.test.ts
- Google Stitch prompt — Illini Dash popup
- queue.ts
- 9. UI
- Tier 0a (2026-09-10, 13 items)
- graphify reference: transcribe video and audio
- local-adapters.test.ts
- course-colour.test.ts
- ui-browser.mjs
- J. Day view

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 82 edges
2. `Item` - 65 edges
3. `vitest` - 62 edges
4. `Z. Test files that pin popup behaviour` - 61 edges
5. `runAdapter()` - 46 edges
6. `RawItem` - 45 edges
7. `Source` - 44 edges
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

## Communities (156 total, 12 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.13
Nodes (28): 8. Storage, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth(), isRecord(), isUsableClass() (+20 more)

### Community 1 - "ParseError"
Cohesion: 0.12
Nodes (36): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 5: typeof x === 'string' is not validation, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", The signed-out page, and the positive marker it made possible, Shared parser primitives (src/core/parsing.ts), piazzaBody(), FieldResult (+28 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (58): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+50 more)

### Community 3 - "UX plan for the store release"
Cohesion: 0.06
Nodes (69): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time (+61 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (95): 3. Mutation table, 4. Timezone results, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L9 — `countdown` says "1d late" for something two hours late, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, itemOfManual() (+87 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.10
Nodes (36): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, I08 · Local Done check-off, separate from Hide, Theme: two sources can never say done, #sec-tidy: Hidden and Ticked off rows, applyRetention(), badgesOf(), buildItem(), byPrecedence() (+28 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (40): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, Review outcome — PrairieLearn (12 findings, all survived), readDateBody(), DAYS_IN_MONTH, inferYear() (+32 more)

### Community 8 - "schedule.ts"
Cohesion: 0.11
Nodes (32): I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, store-toast.png is a composite, not a screenshot, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, describeSources() (+24 more)

### Community 9 - "core/registry.ts"
Cohesion: 0.11
Nodes (20): BUILD_ID, EXTENSION_VERSION, ADAPTER_KINDS, AdapterStanding, byDepartment(), CourseGroup, courseGroupsForYou(), courseKeysOf() (+12 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.10
Nodes (32): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+24 more)

### Community 12 - "options.ts"
Cohesion: 0.06
Nodes (34): I57 · Term rollover: term dates in the registry, Expired section, currentTermCode(), downloadFile(), downloadIcs(), itemsToExport(), AdapterEntry, adapterPagePath(), addSiteUrl (+26 more)

### Community 13 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.27
Nodes (10): Parallelism policy, Trace the path, not just the file, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Defect: bundled registry was never read, Defect: a failing registry refresh retried on every sync, Defect: set-adapter-enabled wrote the store outside the queue, The first live run (2026-09-10): four defects, none caught by 382 tests (+2 more)

### Community 14 - "popup.ts"
Cohesion: 0.09
Nodes (42): BROKEN (1), AttentionName, courseColours(), coursesIn(), dayKey(), noDateCount(), startOfDay(), ViewName (+34 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.10
Nodes (46): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, V. Theme and dark mode, Light or dark is a setting (is-dark class), menu, allThemeClasses() (+38 more)

### Community 16 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.30
Nodes (12): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, smartPhysics as a fifth source (+4 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.11
Nodes (21): Credit schedule in data-bs-content popover, second DOMParser pass, data-format-date JSON (ISO UTC + IANA tz) is the primary time source, parseDateAttribute(), parseDateRangeAttribute(), looksLoggedOut(), isLoginResponse(), cardFor(), EMPTY_CARD (+13 more)

### Community 18 - "canvas.ts"
Cohesion: 0.19
Nodes (18): extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse(), linkHeaderNext() (+10 more)

### Community 19 - "sourcesToRecheck"
Cohesion: 0.16
Nodes (20): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest, tabs.onUpdated as the sign-in signal (+12 more)

### Community 20 - "site.ts"
Cohesion: 0.05
Nodes (75): House rules for mutation checks, A survivor sometimes indicts the design, 3. Where the date comes from, How the date is read out of the located text, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex) (+67 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.18
Nodes (16): Evidence first, Honest completion, Illini UI acceptance, Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), describePiazza() (+8 more)

### Community 23 - "rows.ts"
Cohesion: 0.07
Nodes (56): 10. Permissions, Y. Every DOM id and class the popup writes, END_OF_DAY_HEADING, LATE_HEADING, MonthDotCell, examDetail(), movedText(), courseLabel() (+48 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (41): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+33 more)

### Community 25 - "focus.ts"
Cohesion: 0.29
Nodes (9): The focus mechanism, as built, applyFocusRequest(), findFocusTarget(), FocusRequest, focusRequestFor(), FocusScope, FOOT_HEALTH_CLASS, ROW_RING_SELECTOR (+1 more)

### Community 26 - "The design"
Cohesion: 0.20
Nodes (11): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+3 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (60): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+52 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (94): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): which feed field says a post was edited (+86 more)

### Community 29 - "makeRowsNavigable"
Cohesion: 0.12
Nodes (20): 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked, 6. One structural note, DEGRADED (4), R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111 (+12 more)

### Community 30 - "shell.ts"
Cohesion: 0.08
Nodes (67): House rules from the ZIP acceptance pass, 2026-09-19, The row menu bug — found and fixed 2026-09-18, 5. R1's ten, re-checked, 6. Checked and clean, L2 — Opening a screen moves focus nowhere., L4 — The deadline screen's ⋯ does not toggle., L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter., L8 — `openedFrom` survives a screen the tab change discarded. (+59 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (20): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Reporting a broken page uploads nothing, PII and authentication not collected, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0) (+12 more)

### Community 32 - "background.ts"
Cohesion: 0.08
Nodes (49): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Decisions worth not re-litigating, W. What lives in Options, not the popup, Defect: the store queue deadlocked, allAdapters(), applyObserver() (+41 more)

### Community 33 - "vitest"
Cohesion: 0.06
Nodes (26): linkedom, ref_node_fs, vitest, ref_vitest_config, SOURCE_ORIGIN, sourceForUrl(), REGISTRY_URL, PRAIRIETEST_ORIGIN (+18 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.13
Nodes (28): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), CAMPUSWIRE_ORIGIN, acceptSuggestion() (+20 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.19
Nodes (14): ALL_GCAL_STATES, describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+6 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 38 - "detect.ts"
Cohesion: 0.06
Nodes (65): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, adapterFromCandidate(), AdapterIdentity (+57 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (21): adapters, courses, dataset, gcalState, item(), items, listeners, manualRaw (+13 more)

### Community 43 - "health.ts"
Cohesion: 0.06
Nodes (71): 9.3 The four screens, Structural decisions, Notes on items classified PRESERVED that moved, 2. Findings, ranked, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships (+63 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.10
Nodes (38): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., D. Banners, O. The editor (manual items), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR (+30 more)

### Community 46 - "table-grid.ts"
Cohesion: 0.29
Nodes (12): columnOf(), directCells(), formTableGrid(), GridCache, rowGroups(), rowIndex(), spanValue(), TableGrid (+4 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.13
Nodes (24): I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button (+16 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "sync.test.ts"
Cohesion: 0.10
Nodes (22): isOlderThan(), parseGradescopeDateTime(), shortHash(), sourcesToRetryAfterUpdate(), POPUP_DEBOUNCE_MS, assignmentIdFor(), courseIdFrom(), currentTermCourses() (+14 more)

### Community 50 - "Piazza fixtures"
Cohesion: 0.29
Nodes (6): class-page.html — `GET https://piazza.com/class/<nid>` (signed in), class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures, post.json — `POST https://piazza.com/logic/api?method=content.get`, post-running.json — `POST …?method=content.get`, a note that states a deadline

### Community 51 - "gate0.ts"
Cohesion: 0.19
Nodes (15): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+7 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (20): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), diffSize(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+12 more)

### Community 53 - "state.ts"
Cohesion: 0.07
Nodes (46): M8 — The setup screen's "Connected" chip outranks the source's current state., L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, E. Tabs and view state, F. Course filter chips, WeekMode, loginsToOpen(), SETUP_SOURCES, setupProgress (+38 more)

### Community 54 - "RawItem"
Cohesion: 0.19
Nodes (23): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS (+15 more)

### Community 55 - "renderOptions"
Cohesion: 0.23
Nodes (22): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterRow(), clearRemoval(), el(), gcalSection(), noteRemoval() (+14 more)

### Community 56 - "scrub.ts"
Cohesion: 0.20
Nodes (9): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

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
Cohesion: 0.09
Nodes (14): answer(), document, globals, items, now, page, popup, root (+6 more)

### Community 61 - "gcal-config.ts"
Cohesion: 0.20
Nodes (9): GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE (+1 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (72): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The manifest needs no new permission, The schema requires what the validator will demand (+64 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 64 - "ics.ts"
Cohesion: 0.27
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 65 - "piazza-real.test.ts"
Cohesion: 0.16
Nodes (12): PostBody, PostPayload, EXPECTED, FEED, ingest(), NO_OVERRIDES, PAGE, REGISTRATION (+4 more)

### Community 66 - "needs_login detection"
Cohesion: 0.17
Nodes (16): Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption), §0.2 No credential handling, §0.3 Parsers fail loudly (+8 more)

### Community 67 - "syncCanvas"
Cohesion: 0.15
Nodes (16): I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Tier 0b: beta prerequisites that need Sushi, Canvas fixtures provenance, assignments-cs357.json (real, 66 rows, none dated) (+8 more)

### Community 68 - "view"
Cohesion: 0.40
Nodes (6): bands(), gridHues(), hueOf(), legendHues(), rowOf(), view()

### Community 69 - "Mutation check"
Cohesion: 0.13
Nodes (12): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo), Always assert the match count, Mutation check (+4 more)

### Community 71 - "describeEmpty"
Cohesion: 0.14
Nodes (13): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+5 more)

### Community 72 - "suggest.ts"
Cohesion: 0.11
Nodes (34): Amendment (2026-09-18): what the first seven live suggestions said, itemId(), RetentionResult, alreadySuggested(), AUTO_MOVE_CONFIDENCE, courseOf(), describePost(), IngestInput (+26 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.31
Nodes (8): buildDiagnostics(), DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, input(), NOW, raw()

### Community 74 - "Adapter"
Cohesion: 0.21
Nodes (11): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, ValidationResult, adapterFailureKind(), HttpStatusError, SourceDisabled (+3 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (23): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I13 · Reminder toasts with Open / Snooze / Done buttons (+15 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (55): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+47 more)

### Community 77 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.12
Nodes (22): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: an exam already sat counted as Overdue, Defect: the sources panel was clipped (+14 more)

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
Cohesion: 0.14
Nodes (20): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured (+12 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "provenance.test.ts"
Cohesion: 0.25
Nodes (12): STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY (+4 more)

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

### Community 93 - "Popup feature inventory"
Cohesion: 0.04
Nodes (60): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked (+52 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.20
Nodes (17): Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, inBackoff(), adapterPrefix(), FetchedPage, fetchSync() (+9 more)

### Community 101 - "SyncDeps"
Cohesion: 0.33
Nodes (7): fetchAll(), NeedsLogin, SyncDeps, syncGradescope(), syncPrairieLearn(), syncPrairieTest(), syncSmartPhysics()

### Community 103 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 104 - "row-order.test.ts"
Cohesion: 0.11
Nodes (13): sentences(), document, globals, items, now, opened, popup, Rule (+5 more)

### Community 105 - "StoreV1Plus"
Cohesion: 0.46
Nodes (4): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Sync loop runSync (§6)"
Cohesion: 0.13
Nodes (31): Parser rule 4: guard duplicate sourceIds on one page, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 7: RawItem.url is https on the source origin or the fallback, Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Review outcome — PrairieTest (12 findings, all survived) (+23 more)

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
Nodes (49): 0. Is it even an adapter?, 1. The capture, 2. The schema, 4. The date grammar, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter? (+41 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "announce-real.test.ts"
Cohesion: 0.13
Nodes (14): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+6 more)

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 118 - "healthPill"
Cohesion: 0.11
Nodes (22): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I16 · Honest status line and stale-data banner, I21 · Manual deadlines as a sixth 'manual' source, Theme: health is honest only inside the popup, Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full (+14 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

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

### Community 128 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "Gate G4 — Beta"
Cohesion: 0.13
Nodes (22): When live data contradicts a document: rewrite the claim, Parser rule 3: never index cells positionally, Chrome Web Store submission (draft, not submitted), Adapter.columns — header-driven column lookup, Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Defect: cs124.org could not be added at all, Open full view reuses one tab (+14 more)

### Community 134 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.17
Nodes (11): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these) (+3 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.13
Nodes (14): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 2. Data model, 3.1 Login detection needs the status (+6 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.24
Nodes (11): isDevHash(), normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, applyDevVisibility() (+3 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.11
Nodes (30): ASSUMED_HOUR, CAMPUSWIRE_MATCH, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext, parseFeed() (+22 more)

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 145 - "Illini Dash UI acceptance"
Cohesion: 0.29
Nodes (7): Evidence and completion, Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages, notes()

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 148 - "setup.test.ts"
Cohesion: 0.20
Nodes (10): I17 · Health-aware popup empty state; no green dot before success, #status: errors only, hidden otherwise, needsSetup(), setupRows(), defaultStatus(), emptyGcal(), emptyStore(), storeWith() (+2 more)

### Community 149 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 150 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, referenceItems(), globals, popup

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 153 - "9. UI"
Cohesion: 0.14
Nodes (14): 9.1 The shell, 9.2 The five tabs, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.8 Interaction, 9.9 Appearance (+6 more)

### Community 156 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.22
Nodes (11): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items), Course code extraction (§5.1) (+3 more)

### Community 161 - "local-adapters.test.ts"
Cohesion: 0.25
Nodes (6): 4. Course-site adapters, guessCourseCode(), withLocalAdapter(), withoutLocalAdapter(), VALID, local()

### Community 163 - "course-colour.test.ts"
Cohesion: 0.33
Nodes (5): BLOCKS, CLASSICAL, POPUP, UI, USED

### Community 166 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 168 - "J. Day view"
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
- **844 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+839 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1023 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `ParseError` connect `ParseError` to `Piazza — what the live client actually does (2026-09-18)`, `prairielearn.ts`, `Illini Dash — design as built`, `types.ts`, `core/campuswire.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `announce.ts`, `piazza.ts`, `background.ts`, `vitest`, `detect.ts`, `sync.test.ts`, `gate0.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `Adapter`, `skeleton.ts`, `sync.ts`, `SyncDeps`, `announce-real.test.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `types.ts`, `popup.ts`, `theme-panel.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `setup.test.ts`, `site.ts`, `observer-ui.ts`, `rows.ts`, `preview-acceptance.test.ts`, `focus.ts`, `queue.ts`, `piazza.ts`, `shell.ts`, `local-adapters.test.ts`, `overrides.test.ts`, `course-colour.test.ts`, `gcal-auth.ts`, `detect.ts`, `compat.ts`, `store.test.ts`, `health.ts`, `table-grid.ts`, `gcal-client.ts`, `sync.test.ts`, `gate0.ts`, `gcal.ts`, `RawItem`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.ts`, `diagnostics.ts`, `skeleton.ts`, `provenance.test.ts`, `row-order.test.ts`, `announce-real.test.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `Item` connect `calendar.ts` to `store.ts`, `ParseError`, `dedupe.ts`, `prairielearn.ts`, `Illini Dash — design as built`, `schedule.ts`, `types.ts`, `options.ts`, `core/campuswire.ts`, `popup.ts`, `preview-acceptance.test.ts`, `rows.ts`, `9. UI`, `announce.ts`, `piazza.ts`, `shell.ts`, `background.ts`, `vitest`, `overrides.test.ts`, `health.ts`, `screens/editor.ts`, `gcal-client.ts`, `gcal.ts`, `state.ts`, `popup-draw.test.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.ts`, `provenance.test.ts`, `row-order.test.ts`, `Sync loop runSync (§6)`, `announce-real.test.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._