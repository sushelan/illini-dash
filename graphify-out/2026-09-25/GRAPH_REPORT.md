# Graph Report - illini-due  (2026-09-25)

## Corpus Check
- 279 files · ~1,153,558 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3467 nodes · 9171 edges · 160 communities (146 shown, 14 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 881 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3c310509`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- ParseError
- Canvas — what the API actually returns
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
- renderOptions
- The colour layer
- Adapter (declarative course-site adapter)
- background.ts
- prairietest.ts
- canvas.ts
- Gradescope source (§4.2, HTML)
- site.ts
- support.js
- suggest.test.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- names.ts
- UX plan for the store release
- announce.ts
- piazza.ts
- Course-site adapters and runner (§4.5)
- devDependencies
- options.html: Settings page
- theme.test.ts
- compat.ts
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- scrub-file.mjs
- detect.ts
- compilerOptions
- screens/editor.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- health.ts
- ref_node_path
- ui/editor.ts
- piazza-real.test.ts
- Tier 0a: make what exists trustworthy
- gcal.ts
- Tier 1: highest value after the beta, no spec change
- normalize.ts
- vitest
- ui-acceptance.test.mjs
- shell.ts
- manual.ts
- announce-real.test.ts
- scrub.ts
- supportedDateFormats
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- illini-ui-acceptance/SKILL.md
- author.ts
- sources.ts
- table-grid.ts
- deadline.ts
- gate0.ts
- syncCanvas
- theme-panel.ts
- Asking Sushi for a browser action
- Campuswire fixtures
- Mutation check
- suggest.ts
- diagnostics.ts
- resolveMentions
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
- Piazza fixtures
- core/setup.ts
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- provenance.test.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Gradescope fixtures provenance
- view
- CS 341 (fa26) — course site findings
- ui-browser.mjs
- popup-clearance.test.ts
- Z. Test files that pin popup behaviour
- row-order.test.ts
- Tier 0a (2026-09-10, 13 items)
- graphify reference: extra exports and benchmark
- Sync loop runSync (§6)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- editor-kind.test.ts
- settle
- validateRegistry
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- Campuswire — findings
- Calendar export (§8.3)
- ui-acceptance.mjs
- propose.mjs
- actionOutcome
- Popup feature inventory
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
- gcal-lane.ts
- shots.mjs
- local-adapters.test.ts
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- icons.mjs
- build.mjs
- package.json
- Adapter registry (bundled + daily GitHub refresh)
- sync.ts
- core/registry.ts
- Google Stitch prompt — Illini Dash popup
- Review R1 — does every old popup feature exist in the new one?
- graphify reference: transcribe video and audio
- Issue tracker: GitHub
- Piazza — what the live client actually does (2026-09-18)
- capture.ts
- Domain Docs
- offscreen.html: DOMParser host for the service worker
- 9. UI
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 82 edges
2. `vitest` - 67 edges
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

## Communities (160 total, 14 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.12
Nodes (30): 8. Storage, isOlderThan(), isGcalState(), ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast() (+22 more)

### Community 1 - "ParseError"
Cohesion: 0.09
Nodes (48): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), Shared parser primitives (src/core/parsing.ts), parseGradescopeDateTime() (+40 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.13
Nodes (24): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+16 more)

### Community 4 - "calendar.ts"
Cohesion: 0.04
Nodes (94): 4. Timezone results, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L9 — `countdown` says "1d late" for something two hours late, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, agendaRows(), Anchor (+86 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (34): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Title normalization (§5.2), applyRetention(), BADGE_TOKEN, badgesOf() (+26 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.08
Nodes (44): A survivor has three meanings — decide which before acting, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo), Mutation rule 2: a survivor is untested, unreachable, or redundant (+36 more)

### Community 8 - "schedule.ts"
Cohesion: 0.11
Nodes (32): I13 · Reminder toasts with Open / Snooze / Done buttons, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I41 · Morning toast instead of 2h lead for runner-invented times, Defect: an exam already sat counted as Overdue, Review outcome — steps 9–12 (16 findings, 13 code defects), UX plan phases A–G (2026-09-12), Quiet hours, describeSources() (+24 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.08
Nodes (29): CourseGroup, courseGroupsForYou(), courseKeysOf(), emptyCourseGroup(), finishGroup(), groupHasCourse(), Response, AdapterEntry (+21 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.09
Nodes (36): 2. Data model, ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen() (+28 more)

### Community 12 - "options.ts"
Cohesion: 0.06
Nodes (34): I57 · Term rollover: term dates in the registry, Expired section, currentTermCode(), MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, downloadFile(), downloadIcs(), itemsToExport() (+26 more)

### Community 13 - "renderOptions"
Cohesion: 0.27
Nodes (19): send(), clearRemoval(), el(), stateChip(), gcalSection(), observerRow(), pendingUndo(), plainRow() (+11 more)

### Community 14 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

### Community 15 - "Adapter (declarative course-site adapter)"
Cohesion: 0.25
Nodes (8): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Adapter.columns — header-driven column lookup, smartPhysics as a fifth source, Tier 0b (4 of 7 done), Adapter (declarative course-site adapter)

### Community 16 - "background.ts"
Cohesion: 0.08
Nodes (49): House rules for the worker and the loop, Decisions worth not re-litigating, W. What lives in Options, not the popup, allAdapters(), applyObserver(), applySettings(), deps, enabledAdapters() (+41 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow(), isLoginResponse() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.19
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), isInstant(), CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "Gradescope source (§4.2, HTML)"
Cohesion: 0.11
Nodes (28): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Never-signed-in detection for Gradescope and PrairieTest (+20 more)

### Community 20 - "site.ts"
Cohesion: 0.06
Nodes (65): House rules for mutation checks, A survivor sometimes indicts the design, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, escapeRegex(), compareVersions(), matchesHostPattern(), cellAt() (+57 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "suggest.test.ts"
Cohesion: 0.17
Nodes (16): AUTO_MOVE_CONFIDENCE, describePost(), IngestInput, IngestResult, ObservedPost, Suggestion, demoPost(), fixture() (+8 more)

### Community 23 - "icon"
Cohesion: 0.11
Nodes (32): 10. Permissions, Y. Every DOM id and class the popup writes, END_OF_DAY_HEADING, LATE_HEADING, todaySchedule, reservationVerified(), icon(), ICON_PATHS (+24 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (43): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+35 more)

### Community 25 - "names.ts"
Cohesion: 0.29
Nodes (10): fullStamp(), LOGIN_URL, SOURCE_CODE, SOURCE_HINT, SOURCE_HOME, SOURCE_NAME, SOURCE_TITLE, STATE_PHRASE (+2 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (53): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+45 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (85): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The feed's shapes, as captured, The signed-out page, and the positive marker it made possible, The two re-read lines now count the same thing, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), piazzaClasses(), piazzaRun() (+77 more)

### Community 29 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.28
Nodes (13): Parser rule 8: login detection needs the HTTP status, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Canonical field precedence for merged items, Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption) (+5 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (31): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+23 more)

### Community 32 - "theme.test.ts"
Cohesion: 0.16
Nodes (20): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName(), isThemeName(), MODE_KEY (+12 more)

### Community 33 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.16
Nodes (25): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+17 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.20
Nodes (13): ALL_GCAL_STATES, describeGcal(), GcalAction, GcalDescription, GcalEvent, GcalFacts, GcalState, when() (+5 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "detect.ts"
Cohesion: 0.06
Nodes (64): Rules this feature is held to, Running it without a browser, What a student is told now, The lectures page, and why it is a fixture and not an entry, What `clauses` reads, on both pages, adapterFromCandidate(), AdapterIdentity, byRank() (+56 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "screens/editor.ts"
Cohesion: 0.06
Nodes (76): The row menu bug — found and fixed 2026-09-18, 2. Findings without an F-number, 4. Cross-worker seam checks, R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, R-4 — DEGRADED. A refusal about **Ends** or **Link** lands inside a closed `<details>`, R-5 — The committed captures are stale, and one is a 404 page (+68 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (22): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+14 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "health.ts"
Cohesion: 0.09
Nodes (33): L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: signing in changed nothing until Sync was pressed, tabs.onUpdated as the sign-in signal, SourceDiagnostics, AlertsInput, Badge, compactAgo() (+25 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "ui/editor.ts"
Cohesion: 0.14
Nodes (15): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+7 more)

### Community 46 - "piazza-real.test.ts"
Cohesion: 0.08
Nodes (33): Evidence and completion, Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited (+25 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.11
Nodes (27): Decision 4: manual deadline entry, aggregator or planner, I02 · Exam-day card on PrairieTest rows (room, duration, format), I03 · Toolbar badge: today's count, red ! when a source is broken, I04 · Late / reduced-credit window stays live after dueAt, I05 · First-run onboarding page, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I16 · Honest status line and stale-data banner (+19 more)

### Community 48 - "gcal.ts"
Cohesion: 0.06
Nodes (59): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs (+51 more)

### Community 49 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.20
Nodes (12): Decision 5: campus rows without a course, I01 · Deadline moved / new markers, notification, reminder re-arm, I19 · Per-sync change log strip, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I28 · Keep reminders working past Chrome's 500-alarm cap, I37 · A partial PrairieLearn score is not 'done', I40 · CBTF reservation-window escalation and missed-reservation notice (+4 more)

### Community 50 - "normalize.ts"
Cohesion: 0.18
Nodes (10): Mention, SUBJECT_WORDS, UnreadableMention, FILLER, NUMBERED_PREFIX, SYNONYMS, FIXTURES, only() (+2 more)

### Community 51 - "vitest"
Cohesion: 0.09
Nodes (12): linkedom, ref_node_fs, vitest, ref_vitest_config, QueueOptions, SLOW_HOLD_MS, StoreQueue, html (+4 more)

### Community 52 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 53 - "shell.ts"
Cohesion: 0.05
Nodes (96): House rules from the ZIP acceptance pass, 2026-09-19, Month — two drawings of one month, BROKEN (1), M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, The focus mechanism, as built, allTimed(), dayKey(), dayList() (+88 more)

### Community 54 - "manual.ts"
Cohesion: 0.22
Nodes (20): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput (+12 more)

### Community 55 - "announce-real.test.ts"
Cohesion: 0.22
Nodes (8): EmptyReason, ReadMention, PostPayload, EMPTY, Expected, HTML, mentionsOf(), POSTS

### Community 56 - "scrub.ts"
Cohesion: 0.18
Nodes (10): BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+2 more)

### Community 57 - "supportedDateFormats"
Cohesion: 0.31
Nodes (9): 4. The date grammar, 4. The date grammar, formatFor(), formatsFor(), probe(), probeFragment(), statedTimeInText(), supportedDateFormats() (+1 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.10
Nodes (10): answer(), document, globals, items, now, page, popup, root (+2 more)

### Community 61 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.09
Nodes (19): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Evidence first, Honest completion, Illini UI acceptance, Illini Dash UI acceptance (+11 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (78): House rules for the on-device model, A selector the page has not got is refused before the runner, And the deterministic proposer reads the whole page itself, Checking the three lines without a model, Every group now says how much of it is dated, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window (+70 more)

### Community 63 - "sources.ts"
Cohesion: 0.09
Nodes (32): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Illini Dash ZIP UI acceptance handoff, Important files to resume from, Independent review results, Interaction review: four product findings and one harness gap, Objective and authority (+24 more)

### Community 64 - "table-grid.ts"
Cohesion: 0.20
Nodes (17): isDataRow(), isFreeRow(), locatorEvidence, precedingTag(), columnOf(), directCells(), formTableGrid(), GridCache (+9 more)

### Community 65 - "deadline.ts"
Cohesion: 0.09
Nodes (51): REPLACED-RECORDED (49), L2 — Opening a screen moves focus nowhere., L8 — `openedFrom` survives a screen the tab change discarded., N. Attention view and suggestions, courseColours(), coursesIn(), noDateCount(), noDateGroups() (+43 more)

### Community 66 - "gate0.ts"
Cohesion: 0.32
Nodes (7): checkOne(), collapse(), GATE0_TARGETS, Gate0Result, Gate0Target, LOGIN_URL_MARKERS, runGate0()

### Community 67 - "syncCanvas"
Cohesion: 0.15
Nodes (17): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+9 more)

### Community 68 - "theme-panel.ts"
Cohesion: 0.19
Nodes (23): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), menu, allThemeClasses(), normalizeTweaks(), resolveDark() (+15 more)

### Community 69 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 71 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 72 - "suggest.ts"
Cohesion: 0.16
Nodes (23): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, describeEmpty(), maskMarkup(), extractCourseCode() (+15 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.33
Nodes (8): buildDiagnostics(), Diagnostics, hoursSince(), scrubError(), Settings, input(), NOW, raw()

### Community 74 - "resolveMentions"
Cohesion: 0.33
Nodes (7): cleanTitle(), courseMatches(), earlier(), isGenericSubject(), itemCodes(), resolveMentions(), titleFor()

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.14
Nodes (18): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I08 · Local Done check-off, separate from Hide, I42 · Google Calendar sync via chrome.identity (+10 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.11
Nodes (45): PLACEHOLDER, rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector(), bestDated(), bestShare() (+37 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.19
Nodes (14): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold (+6 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.18
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
Cohesion: 0.14
Nodes (31): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Chrome Web Store submission (draft, not submitted), Defect: cs124.org could not be added at all, Fixtures captured (+23 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "Piazza fixtures"
Cohesion: 0.33
Nodes (5): class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures, post.json — `POST https://piazza.com/logic/api?method=content.get`, post-running.json — `POST …?method=content.get`, a note that states a deadline

### Community 87 - "core/setup.ts"
Cohesion: 0.20
Nodes (13): loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES, setupProgress, setupRows(), setupSummary(), defaultStatus() (+5 more)

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

### Community 93 - "provenance.test.ts"
Cohesion: 0.14
Nodes (25): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+17 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "view"
Cohesion: 0.40
Nodes (6): bands(), gridHues(), hueOf(), legendHues(), rowOf(), view()

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.31
Nodes (8): allRules(), beats(), Rule, rulesIn(), setsBottomMargin(), sheets(), specificity(), winner()

### Community 103 - "Z. Test files that pin popup behaviour"
Cohesion: 0.05
Nodes (67): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report, Worker rule 2: a green dot must mean 'I fetched, and it was fine' (+59 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.09
Nodes (14): referenceItems(), globals, popup, document, globals, items, now, opened (+6 more)

### Community 105 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.15
Nodes (14): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: a Gradescope course labelled stat_425_120248_268442, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items), Canvas plannable_type → Kind mapping (+6 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Sync loop runSync (§6)"
Cohesion: 0.20
Nodes (18): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Repo layout: worker is wiring, decisions live in core/, §0.5 Chrome only, §0.3 Parsers fail loudly, Item, memberKey = source:sourceId, Notifications (§7) (+10 more)

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
Nodes (48): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), How the date is read out of the located text (+40 more)

### Community 113 - "settle"
Cohesion: 0.40
Nodes (5): onMonth(), settle(), showDay(), showMonth(), withTimedToday()

### Community 114 - "validateRegistry"
Cohesion: 0.20
Nodes (10): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Remote code: No (+2 more)

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 118 - "Calendar export (§8.3)"
Cohesion: 0.83
Nodes (4): Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.25
Nodes (15): ref_node_crypto, capture(), compare(), escape(), filesIn(), gallery(), init(), read() (+7 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 122 - "Popup feature inventory"
Cohesion: 0.08
Nodes (26): L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, Agenda (popup), Contents, D. Banners, Day grid (full view), Drag-to-add, E. Tabs and view state (+18 more)

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
Nodes (11): COURSE_KEYS, Entry, globals, Mod, nameOf(), NOTHING, page, REGISTRY (+3 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 134 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "local-adapters.test.ts"
Cohesion: 0.10
Nodes (17): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status, 3. Sources (+9 more)

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
Cohesion: 0.06
Nodes (51): Six-stage execution, Icons, Implementation completed in candidate 1, Piazza and Campuswire on the front, Popup and five reference views, Preview and acceptance truthfulness, Settings, Shared visual system (+43 more)

### Community 141 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.33
Nodes (5): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is established, What is not established, and is blocking a parser, Why this page exists to be parsed at all

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.16
Nodes (18): Check it in the mode Sushi actually uses (dark), Parallelism policy, Trace the path, not just the file, Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 5: log both branches of any decision the user will have to debug (+10 more)

### Community 148 - "sync.ts"
Cohesion: 0.06
Nodes (59): Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, 6. The sync loop, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, Per-source backoff, Fetch rules for all sources (+51 more)

### Community 149 - "core/registry.ts"
Cohesion: 0.08
Nodes (26): BUILD_ID, EXTENSION_VERSION, SOURCE_ORIGIN, sourceForUrl(), ADAPTER_KINDS, AdapterStanding, coursePagesLayout, FIELDS_ADDED_IN_1_1 (+18 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 153 - "Review R1 — does every old popup feature exist in the new one?"
Cohesion: 0.13
Nodes (12): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked (+4 more)

### Community 165 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, Issue tracker: GitHub, PROGRESS.md is the source of truth, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 166 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.22
Nodes (8): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass

### Community 168 - "capture.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), countOccurrences() (+8 more)

### Community 170 - "Domain Docs"
Cohesion: 0.29
Nodes (6): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, In this repo, until a CONTEXT.md exists, Use the glossary's vocabulary

### Community 176 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 180 - "9. UI"
Cohesion: 0.13
Nodes (16): 9.1 The shell, 9.2 The five tabs, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.8 Interaction, 9.9 Appearance (+8 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **896 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+891 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1087 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `ParseError`, `store.ts`, `calendar.ts`, `dedupe.ts`, `gcal-lane.ts`, `local-adapters.test.ts`, `prairielearn.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `types.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `site.ts`, `core/registry.ts`, `suggest.test.ts`, `icon`, `sync.ts`, `names.ts`, `piazza.ts`, `theme.test.ts`, `compat.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `capture.ts`, `health.ts`, `piazza-real.test.ts`, `gcal.ts`, `normalize.ts`, `9. UI`, `shell.ts`, `manual.ts`, `announce-real.test.ts`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `table-grid.ts`, `deadline.ts`, `diagnostics.ts`, `skeleton.ts`, `core/setup.ts`, `provenance.test.ts`, `popup-clearance.test.ts`, `row-order.test.ts`, `editor-kind.test.ts`, `actionOutcome`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `local-adapters.test.ts`, `types.ts`, `core/campuswire.ts`, `background.ts`, `prairietest.ts`, `canvas.ts`, `sync.ts`, `site.ts`, `suggest.test.ts`, `announce.ts`, `piazza.ts`, `detect.ts`, `piazza-real.test.ts`, `normalize.ts`, `author.ts`, `suggest.ts`, `skeleton.ts`, `Sync loop runSync (§6)`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `Item` connect `calendar.ts` to `store.ts`, `ParseError`, `dedupe.ts`, `prairielearn.ts`, `local-adapters.test.ts`, `schedule.ts`, `types.ts`, `options.ts`, `core/campuswire.ts`, `background.ts`, `suggest.test.ts`, `icon`, `announce.ts`, `piazza.ts`, `overrides.test.ts`, `screens/editor.ts`, `health.ts`, `piazza-real.test.ts`, `gcal.ts`, `normalize.ts`, `9. UI`, `shell.ts`, `announce-real.test.ts`, `popup-draw.test.ts`, `sources.ts`, `deadline.ts`, `suggest.ts`, `provenance.test.ts`, `row-order.test.ts`, `Sync loop runSync (§6)`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._