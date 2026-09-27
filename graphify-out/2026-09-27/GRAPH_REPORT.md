# Graph Report - illini-due  (2026-09-27)

## Corpus Check
- 279 files · ~1,157,005 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3478 nodes · 9220 edges · 164 communities (151 shown, 13 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 882 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e1dadba`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- runAdapter
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
- ParseError
- The colour layer
- Options page (§8.2)
- background.ts
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- support.js
- screens/editor.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- syncSites
- UX plan for the store release
- announce.ts
- piazza.ts
- needs_login detection
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
- healthPill
- shell.ts
- RawItem
- exams-verified.test.ts
- scrub.ts
- core/registry.ts
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- illini-ui-acceptance/SKILL.md
- author.ts
- Illini Dash ZIP UI acceptance handoff
- table-grid.ts
- month.ts
- ics.ts
- I08 · Local Done check-off, separate from Hide
- theme-panel.ts
- observer-ui.ts
- Campuswire fixtures
- Mutation check
- suggest.ts
- diagnostics.ts
- 2. Findings, ranked
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
- isGcalConfigured
- sync.test.ts
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
- ref_node_fs
- CS 341 (fa26) — course site findings
- gcal-lane.ts
- popup-clearance.test.ts
- popup.ts
- row-order.test.ts
- Tier 0a (2026-09-10, 13 items)
- graphify reference: extra exports and benchmark
- Auto-merge rule (§5.3)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- Adapter
- ECE 411 (FA 2026) — what the pages actually say
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- Campuswire — findings
- markers.ts
- ui-acceptance.mjs
- propose.mjs
- Asking Sushi for a browser action
- SyncDeps
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
- Mutation check
- Store description (plain text)
- shots.mjs
- preview-acceptance.test.ts
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- icons.mjs
- Piazza fixtures
- build.mjs
- view
- package.json
- Sync loop runSync (§6)
- sync.ts
- vitest
- editor-kind.test.ts
- Google Stitch prompt — Illini Dash popup
- settle
- 9. UI
- graphify reference: transcribe video and audio
- Issue tracker: GitHub
- What the two stages read, and the scorecard over the real feed
- gate0.ts
- Domain Docs
- local-adapters.test.ts
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

## Communities (164 total, 13 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.12
Nodes (30): 8. Storage, isOlderThan(), TITLE_NAME_MAX, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth() (+22 more)

### Community 1 - "runAdapter"
Cohesion: 0.12
Nodes (35): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", The signed-out page, and the positive marker it made possible, Review outcome — PrairieTest (12 findings, all survived) (+27 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.13
Nodes (24): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+16 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (102): 3. Mutation table, 4. Timezone results, L9 — `countdown` says "1d late" for something two hours late, N. Attention view and suggestions, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow (+94 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (34): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+26 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.09
Nodes (40): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, I37 · A partial PrairieLearn score is not 'done', What is established, readDateBody(), DAYS_IN_MONTH (+32 more)

### Community 8 - "schedule.ts"
Cohesion: 0.14
Nodes (27): I13 · Reminder toasts with Open / Snooze / Done buttons, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I41 · Morning toast instead of 2h lead for runner-invented times, alarmName(), BOOKING_HOUR, clampTitle(), deferPastQuietHours(), inQuietHours() (+19 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.10
Nodes (22): CourseGroup, Response, AdapterEntry, adapterPageName(), ALLOW_CLASS, COURSE_HOST_CLASS, COURSE_NAME_CLASS, COURSE_ROW_CLASS (+14 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.09
Nodes (33): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+25 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (48): BUILD_ID, MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, addSiteUrl, captureButton, captureUrl, clearRemoval() (+40 more)

### Community 13 - "ParseError"
Cohesion: 0.18
Nodes (18): parseGradescopeDateTime(), shortHash(), feedRequest(), readUserObject(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes() (+10 more)

### Community 14 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

### Community 15 - "Options page (§8.2)"
Cohesion: 0.14
Nodes (15): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Adapter.columns — header-driven column lookup, Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, smartPhysics as a fifth source, Tier 0b (4 of 7 done) (+7 more)

### Community 16 - "background.ts"
Cohesion: 0.10
Nodes (41): House rules for the worker and the loop, Decisions worth not re-litigating, W. What lives in Options, not the popup, applyObserver(), applySettings(), deps, ensureObservers(), fireNotification() (+33 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.12
Nodes (19): parseDateAttribute(), parseDateRangeAttribute(), looksLoggedOut(), isLoginResponse(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard() (+11 more)

### Community 18 - "canvas.ts"
Cohesion: 0.19
Nodes (18): extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse(), linkHeaderNext() (+10 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.20
Nodes (16): Parser rule 3: never index cells positionally, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Gradescope datetime attribute format, Open questions (§12), parseLocalDate(parts, zone) helper (+8 more)

### Community 20 - "site.ts"
Cohesion: 0.05
Nodes (65): House rules for mutation checks, A survivor sometimes indicts the design, 3. Where the date comes from, How the date is read out of the located text, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, How the date is read out of the located text, The lectures page, and why it is a fixture and not an entry (+57 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "screens/editor.ts"
Cohesion: 0.08
Nodes (51): The row menu bug — found and fixed 2026-09-18, 4. Cross-worker seam checks, 3. Findings, ranked, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand., L4 — The deadline screen's ⋯ does not toggle., L5 — Two round trips with no popup-side log line, and one with no caption., L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter. (+43 more)

### Community 23 - "icon"
Cohesion: 0.12
Nodes (30): setup(), Y. Every DOM id and class the popup writes, END_OF_DAY_HEADING, LATE_HEADING, icon(), ICON_PATHS, IconName, MATERIAL_SYMBOLS (+22 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (41): G5: store submission after G4, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5), Store icon: navy tile, one orange bar, white tick, alarms permission justification, commands permission justification (+33 more)

### Community 25 - "syncSites"
Cohesion: 0.16
Nodes (14): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Worker rule 7: live data is a source of truth the fixtures are not, I57 · Term rollover: term dates in the registry, Expired section, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, adapterFailureKind(), fetchSync() (+6 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (61): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+53 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (91): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): which feed field says a post was edited, The feed's shapes, as captured, The two re-read lines now count the same thing, class-page.html — `GET https://piazza.com/class/<nid>` (signed in) (+83 more)

### Community 29 - "needs_login detection"
Cohesion: 0.13
Nodes (23): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed (+15 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (19): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script (+11 more)

### Community 32 - "theme.test.ts"
Cohesion: 0.16
Nodes (20): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName(), isThemeName(), MODE_KEY (+12 more)

### Community 33 - "compat.ts"
Cohesion: 0.21
Nodes (14): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+6 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.15
Nodes (28): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+20 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.13
Nodes (21): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+13 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): esbuild, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "detect.ts"
Cohesion: 0.06
Nodes (61): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, adapterFromCandidate(), AdapterIdentity (+53 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "deadline.ts"
Cohesion: 0.09
Nodes (53): 6. Checked and clean, L2 — Opening a screen moves focus nowhere., L8 — `openedFrom` survives a screen the tab change discarded., M5 — `placeFloating`'s cap is computed for a border box and applied to a content box, so every downward panel overshoots the ceiling., X. Load-bearing CSS/layout invariants, AttentionName, examDetail(), movedText() (+45 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (24): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+16 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "health.ts"
Cohesion: 0.06
Nodes (75): 9.3 The four screens, Notes on items classified PRESERVED that moved, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand (+67 more)

### Community 44 - "ref_node_path"
Cohesion: 0.13
Nodes (15): ref_node_child_process, ref_node_http, ref_node_os, ref_node_path, bundle, DEV_ONLY, dist, manifest (+7 more)

### Community 45 - "ui/editor.ts"
Cohesion: 0.14
Nodes (15): createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions, ERROR_FIELD, fieldFor(), KIND_OPTIONS (+7 more)

### Community 46 - "suggest.test.ts"
Cohesion: 0.21
Nodes (13): AUTO_MOVE_CONFIDENCE, describePost(), ObservedPost, demoPost(), fixture(), input(), item(), items() (+5 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.18
Nodes (16): I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I54 · Versioned store migrations with memberKey remapping (+8 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.13
Nodes (28): Looking at it without a Google account, The design, What it costs, isGoogleAccount(), accountOf(), call(), classifyStatus(), createCalendar() (+20 more)

### Community 49 - "gcal.ts"
Cohesion: 0.16
Nodes (21): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime (+13 more)

### Community 50 - "announce-real.test.ts"
Cohesion: 0.13
Nodes (14): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+6 more)

### Community 51 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 52 - "healthPill"
Cohesion: 0.11
Nodes (24): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup (+16 more)

### Community 53 - "shell.ts"
Cohesion: 0.05
Nodes (67): M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., M8 — The setup screen's "Connected" chip outranks the source's current state., L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, F. Course filter chips, WeekMode, actionOutcome, UNEXPLAINED_REFUSAL, appMark() (+59 more)

### Community 54 - "RawItem"
Cohesion: 0.21
Nodes (21): 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError (+13 more)

### Community 55 - "exams-verified.test.ts"
Cohesion: 0.36
Nodes (6): Exams — everything you have to turn up to, ExamPlacement, reservationVerified(), booked(), exam(), member()

### Community 56 - "scrub.ts"
Cohesion: 0.18
Nodes (11): escapeRegex(), BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport (+3 more)

### Community 57 - "core/registry.ts"
Cohesion: 0.08
Nodes (39): 4. The date grammar, 4. The date grammar, Remote code: none — adapters are data, not code, Remote code: No, allAdapters(), enabledAdapters(), EXTENSION_VERSION, ADAPTER_KINDS (+31 more)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.10
Nodes (11): answer(), document, globals, items, keydown(), now, page, popup (+3 more)

### Community 61 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.09
Nodes (21): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Evidence first, Honest completion, Illini UI acceptance, Evidence and completion (+13 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (73): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The inventory sketches one row's insides, The manifest needs no new permission (+65 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 64 - "table-grid.ts"
Cohesion: 0.22
Nodes (18): cellOf(), pickDueWordColumn(), pickTitleColumn(), textOf(), trialFor(), columnOf(), directCells(), formTableGrid() (+10 more)

### Community 65 - "month.ts"
Cohesion: 0.14
Nodes (28): Month — two drawings of one month, 3. Every non-PRESERVED item, BROKEN (1), DEGRADED (4), REPLACED-RECORDED (49), L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, H. The row (+20 more)

### Community 66 - "ics.ts"
Cohesion: 0.17
Nodes (19): Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1, buildIcs(), escapeIcsText(), event(), foldIcsLine() (+11 more)

### Community 67 - "I08 · Local Done check-off, separate from Hide"
Cohesion: 0.12
Nodes (20): I08 · Local Done check-off, separate from Hide, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+12 more)

### Community 68 - "theme-panel.ts"
Cohesion: 0.18
Nodes (24): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), menu, allThemeClasses(), normalizeTweaks(), resolveDark() (+16 more)

### Community 69 - "observer-ui.ts"
Cohesion: 0.21
Nodes (14): Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), describePiazza(), PIAZZA_LOGIN_URL, piazzaChipState(), PiazzaHealth (+6 more)

### Community 71 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 72 - "suggest.ts"
Cohesion: 0.09
Nodes (38): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, describeEmpty(), maskMarkup(), itemId() (+30 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.26
Nodes (10): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, Settings, input() (+2 more)

### Community 74 - "2. Findings, ranked"
Cohesion: 0.17
Nodes (11): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago, L15 — a stale comment claims the No date badge counts suggestions, M4 — a date the student typed is headed "Moved by an announcement" (+3 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (24): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, I01 · Deadline moved / new markers, notification, reminder re-arm, I19 · Per-sync change log strip (+16 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (54): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+46 more)

### Community 77 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.14
Nodes (19): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: an exam already sat counted as Overdue, Defect: the sources panel was clipped (+11 more)

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

### Community 86 - "isGcalConfigured"
Cohesion: 0.29
Nodes (6): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, What Sushi has to do before this can run, isGcalConfigured()

### Community 87 - "sync.test.ts"
Cohesion: 0.12
Nodes (13): defaultStatus(), emptyGcal(), emptyStore(), POPUP_DEBOUNCE_MS, storeWith(), fetchPage(), fixture(), gatedDeps() (+5 more)

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
Cohesion: 0.26
Nodes (11): assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedRange(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY, SOURCE_TIME_NOTE (+3 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "ref_node_fs"
Cohesion: 0.14
Nodes (10): ref_node_fs, ref_vitest_config, BLOCKS, CLASSICAL, POPUP, UI, USED, html (+2 more)

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.31
Nodes (8): allRules(), beats(), Rule, rulesIn(), setsBottomMargin(), sheets(), specificity(), winner()

### Community 103 - "popup.ts"
Cohesion: 0.07
Nodes (65): House rules from the ZIP acceptance pass, 2026-09-19, Structural decisions, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., Important files to resume from, Interaction review: four product findings and one harness gap, The focus mechanism, as built (+57 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.06
Nodes (30): 2. The schema, 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5) (+22 more)

### Community 105 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.42
Nodes (9): Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0a (2026-09-10, 13 items), Canonical field precedence for merged items, Per-source health indicator, SourceStatus (+1 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Auto-merge rule (§5.3)"
Cohesion: 0.19
Nodes (18): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Course rename override (overrides.courseNames), Defect: a Gradescope course labelled stat_425_120248_268442, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3) (+10 more)

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
Cohesion: 0.12
Nodes (27): 0. Is it even an adapter?, 1. The capture, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), Rules this feature is held to, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion) (+19 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "Adapter"
Cohesion: 0.22
Nodes (8): 2. Data model, ValidationResult, StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult, Adapter, StoreV1

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
Cohesion: 0.17
Nodes (22): ref_node_assert_strict, ref_node_test, ref_node_url, capture(), captureMatrix(), checkRun(), compare(), escape() (+14 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 122 - "SyncDeps"
Cohesion: 0.21
Nodes (12): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), fetchChecked(), syncCanvas(), SyncDeps (+4 more)

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

### Community 133 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 134 - "Store description (plain text)"
Cohesion: 0.29
Nodes (7): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Description field is plain text: paste description.txt, Runs entirely in the browser; never sees a password

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, ref_node_vm, globals, popup

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
Cohesion: 0.10
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext (+24 more)

### Community 141 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.40
Nodes (4): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is not established, and is blocking a parser, Why this page exists to be parsed at all

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
Cohesion: 0.15
Nodes (25): Check it in the mode Sushi actually uses (dark), Parallelism policy, Trace the path, not just the file, Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 5: log both branches of any decision the user will have to debug (+17 more)

### Community 148 - "sync.ts"
Cohesion: 0.14
Nodes (25): Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, dedupeInput(), backoffMinutes(), inBackoff() (+17 more)

### Community 149 - "vitest"
Cohesion: 0.08
Nodes (19): linkedom, vitest, SOURCE_ORIGIN, sourceForUrl(), REGISTRY_URL, PRAIRIELEARN_ORIGIN, PRAIRIETEST_ORIGIN, courseUrl() (+11 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "settle"
Cohesion: 0.40
Nodes (5): onMonth(), settle(), showDay(), showMonth(), withTimedToday()

### Community 153 - "9. UI"
Cohesion: 0.05
Nodes (38): 9.1 The shell, 9.2 The five tabs, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.8 Interaction, 9.9 Appearance (+30 more)

### Community 165 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, Issue tracker: GitHub, PROGRESS.md is the source of truth, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 166 - "What the two stages read, and the scorecard over the real feed"
Cohesion: 0.15
Nodes (12): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19) (+4 more)

### Community 168 - "gate0.ts"
Cohesion: 0.19
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+8 more)

### Community 170 - "Domain Docs"
Cohesion: 0.29
Nodes (6): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, In this repo, until a CONTEXT.md exists, Use the glossary's vocabulary

### Community 180 - "local-adapters.test.ts"
Cohesion: 0.09
Nodes (19): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+11 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **897 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+892 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1088 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `store.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `preview-acceptance.test.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `ParseError`, `types.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `editor-kind.test.ts`, `icon`, `piazza.ts`, `theme.test.ts`, `compat.ts`, `overrides.test.ts`, `gcal-auth.ts`, `detect.ts`, `gate0.ts`, `deadline.ts`, `health.ts`, `suggest.test.ts`, `gcal-client.ts`, `gcal.ts`, `announce-real.test.ts`, `queue.ts`, `local-adapters.test.ts`, `shell.ts`, `RawItem`, `exams-verified.test.ts`, `scrub.ts`, `core/registry.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `table-grid.ts`, `ics.ts`, `observer-ui.ts`, `suggest.ts`, `diagnostics.ts`, `skeleton.ts`, `sync.test.ts`, `provenance.test.ts`, `ref_node_fs`, `gcal-lane.ts`, `popup-clearance.test.ts`, `popup.ts`, `row-order.test.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `runAdapter`, `prairielearn.ts`, `types.ts`, `core/campuswire.ts`, `background.ts`, `prairietest.ts`, `canvas.ts`, `sync.ts`, `site.ts`, `vitest`, `syncSites`, `announce.ts`, `piazza.ts`, `needs_login detection`, `detect.ts`, `suggest.test.ts`, `announce-real.test.ts`, `local-adapters.test.ts`, `core/registry.ts`, `author.ts`, `suggest.ts`, `skeleton.ts`, `sync.test.ts`, `SyncDeps`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `linkedom` connect `vitest` to `options-dom.test.ts`, `prairielearn.ts`, `preview-acceptance.test.ts`, `types.ts`, `core/campuswire.ts`, `ParseError`, `prairietest.ts`, `package.json`, `editor-kind.test.ts`, `icon`, `theme.test.ts`, `detect.ts`, `announce-real.test.ts`, `shell.ts`, `core/registry.ts`, `popup-draw.test.ts`, `author.ts`, `table-grid.ts`, `skeleton.ts`, `sync.test.ts`, `popup-clearance.test.ts`, `row-order.test.ts`, `propose.mjs`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._