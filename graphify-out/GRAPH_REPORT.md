# Graph Report - illini-due  (2026-10-01)

## Corpus Check
- 288 files · ~1,222,261 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3694 nodes · 9955 edges · 162 communities (150 shown, 12 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 913 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1221e925`
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
- health.ts
- The colour layer
- popup.html: the popup and full view document
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
- table-grid.ts
- compilerOptions
- announce-real.test.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- Source
- ref_node_path
- 2. Findings, ranked
- suggest.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gcal.ts
- core/registry.ts
- month.ts
- grouping.ts
- shell.ts
- manual.ts
- Popup feature inventory
- scrub.ts
- Gradescope fixtures provenance
- What You Must Do When Invoked
- popup/rows.ts
- popup-draw.test.ts
- Classical Calendar — previous alignment measurements (2026-09-19)
- author.ts
- observer-ui.ts
- vitest
- focus.ts
- ics.ts
- Tier 0b: beta prerequisites that need Sushi
- applyStoredTheme
- focusOrOpen
- Campuswire fixtures
- dates.ts
- detect.ts
- diagnostics.ts
- flows.ts
- Z. Test files that pin popup behaviour
- skeleton.ts
- Popup UI (§8.1)
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- attentionGroups
- Tracing a symptom along a runtime path
- The design
- sync.test.ts
- PROGRESS.md — what is done, which gate, what is blocked
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- provenance.ts
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Illini Dash ZIP UI acceptance handoff
- Item
- CS 341 (fa26) — course site findings
- gcal-lane.ts
- popup-clearance.test.ts
- deadline.ts
- row-order.test.ts
- sources.ts
- graphify reference: extra exports and benchmark
- Illini Dash — design as built
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- StoreV1Plus
- validateRegistry
- graphify reference: transcribe video and audio
- Piazza — what the live client actually does (2026-09-18)
- describeEmpty
- Asking Sushi for a browser action
- ui-acceptance.mjs
- propose.mjs
- gcal-config.ts
- SyncDeps
- markers.ts
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- options-dom.test.ts
- Asking Sushi for a browser action
- `fixtures/sites/` — the course pages the §4.5 runner is tested against
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- shots.mjs
- ui-acceptance.test.mjs
- site.mjs
- popup.ts
- page-url.ts
- core/campuswire.ts
- sync-gate.ts
- icons.mjs
- build.mjs
- package.json
- Sync loop runSync (§6)
- Worker rule 3: a value this code invented is not a value the source stated
- Google Stitch prompt — Illini Dash popup
- exams-verified.test.ts
- makeRowsNavigable
- Defect: the store queue deadlocked
- graphify reference: transcribe video and audio
- Adapter registry (bundled + daily GitHub refresh)
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- illini-ui-acceptance/SKILL.md
- ui-browser.mjs
- Issue tracker: GitHub
- piazza-real.test.ts
- gate0.ts
- Domain Docs
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 83 edges
2. `vitest` - 70 edges
3. `Item` - 65 edges
4. `Z. Test files that pin popup behaviour` - 60 edges
5. `runAdapter()` - 49 edges
6. `RawItem` - 47 edges
7. `Source` - 46 edges
8. `renderRow()` - 38 edges
9. `icon()` - 37 edges
10. `validateAdapter()` - 35 edges

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

## Communities (162 total, 12 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.08
Nodes (43): 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, isOlderThan(), TITLE_NAME_MAX, PiazzaHealth, ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES (+35 more)

### Community 1 - "ParseError"
Cohesion: 0.10
Nodes (41): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), Shared parser primitives (src/core/parsing.ts), FieldResult (+33 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+15 more)

### Community 4 - "calendar.ts"
Cohesion: 0.06
Nodes (47): 3. Mutation table, N. Attention view and suggestions, itemOfManual(), AgendaRow, Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, attentionCount() (+39 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (35): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+27 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.16
Nodes (20): isNoEndMarker(), parsePrairieLearnScheduleDate(), courseInstanceIdFrom(), COURSES_HEADINGS, creditCeiling(), CreditCell, CreditTier, deadlinesFromSchedule() (+12 more)

### Community 8 - "schedule.ts"
Cohesion: 0.08
Nodes (50): W. What lives in Options, not the popup, fireNotification(), notificationsBlocked(), ALARM_BUDGET, alarmName(), applySnooze(), BOOKING_HOUR, BOOKING_LAST_HOUR (+42 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.08
Nodes (29): CourseGroup, courseGroupsForYou(), courseKeysOf(), groupHasCourse(), pageKey(), readingKey(), readsExams(), AdapterEntry (+21 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.09
Nodes (35): linkedom, ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parsePrairieLearnHome(), parseSmartPhysicsCourses() (+27 more)

### Community 12 - "options.ts"
Cohesion: 0.05
Nodes (47): I57 · Term rollover: term dates in the registry, Expired section, currentTermCode(), MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, downloadFile(), downloadIcs(), itemsToExport() (+39 more)

### Community 13 - "health.ts"
Cohesion: 0.08
Nodes (41): 2. Data model, M8 — The setup screen's "Connected" chip outranks the source's current state., B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: an exam already sat counted as Overdue (+33 more)

### Community 14 - "The colour layer"
Cohesion: 0.23
Nodes (15): The colour layer, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Preview harness: preview-popup.html, preview-options.html, components.html, shot.html, Rule 1b: both ends of the range carry the hue; tokens.test.ts checks AA, Rule 1: a course is a label, being late is a meaning (+7 more)

### Community 15 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (22): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+14 more)

### Community 16 - "background.ts"
Cohesion: 0.08
Nodes (48): House rules for the worker and the loop, Decisions worth not re-litigating, I28 · Keep reminders working past Chrome's 500-alarm cap, allAdapters(), applyObserver(), applySettings(), deps, enabledAdapters() (+40 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (17): parseDateAttribute(), parseDateRangeAttribute(), textOf(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+9 more)

### Community 18 - "canvas.ts"
Cohesion: 0.15
Nodes (22): Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Canvas plannable_type → Kind mapping, Canvas planner items endpoint, Canvas source (§4.1, REST API), Canvas while(1); prefix, extractCourseCodes(), CANVAS_ORIGIN (+14 more)

### Community 19 - "PrairieTest source (§4.4, HTML)"
Cohesion: 0.19
Nodes (17): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Export .ics moved to the bar, VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Daily booking nag, Calendar export (§8.3), §0.1 No backend, Open questions (§12) (+9 more)

### Community 20 - "site.ts"
Cohesion: 0.06
Nodes (62): 4. The date grammar, 4. The date grammar, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex), escapeRegex(), AdapterDate, cellBySlot(), ClauseDate (+54 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "screens/editor.ts"
Cohesion: 0.07
Nodes (45): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., O. The editor (manual items), send(), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR (+37 more)

### Community 23 - "icon"
Cohesion: 0.14
Nodes (25): 10. Permissions, A. Document shell and load-time behaviour, Y. Every DOM id and class the popup writes, icon(), ICON_PATHS, IconName, MATERIAL_SYMBOLS, bookingWindowText() (+17 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (46): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+38 more)

### Community 25 - "sync.ts"
Cohesion: 0.08
Nodes (42): Worker rule 2: a green dot must mean 'I fetched, and it was fine', I59 · Lift backoff and resync immediately on extension update, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, Per-source backoff (+34 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.12
Nodes (30): Rows say 'time not given' rather than inventing a time, --accent-ink is never white, #filters scroll-container exemption in the width check, Popup document must never exceed 400px, --primary / --primary-ink for the one filled button, Tab strip min-width: 0 guard, icon and label on all five tabs, UX plan for the store release, B1: a sat exam is not Overdue (+22 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (58): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+50 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (99): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it" (+91 more)

### Community 29 - "needs_login detection"
Cohesion: 0.12
Nodes (23): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest (+15 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (19): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script (+11 more)

### Community 32 - "theme-panel.ts"
Cohesion: 0.13
Nodes (35): menu, allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName() (+27 more)

### Community 33 - "renderOptions"
Cohesion: 0.15
Nodes (31): clearRemoval(), el(), stateChip(), gcalSection(), observerRow(), pendingUndo(), refreshOptions(), renderCandidates() (+23 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.13
Nodes (30): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Defect: the row menu opened below the fold in week view, Row menu (⋯), applyOverride(), CAMPUSWIRE_ORIGIN (+22 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.21
Nodes (14): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+6 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "table-grid.ts"
Cohesion: 0.21
Nodes (21): cellOf(), examTrialFor(), namedBySeparator(), pickDueWordColumn(), pickTitleColumn(), textOf(), trialFor(), cellAt() (+13 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "announce-real.test.ts"
Cohesion: 0.13
Nodes (14): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+6 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (22): adapters, courses, dataset, gcalState, item(), items, listeners, manualRaw (+14 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "Source"
Cohesion: 0.14
Nodes (24): SourceDiagnostics, EmptyState, HealthSummary, NeedsYouInput, SourceRow, toneOf(), STATE_WORD, ATTEMPTING_KEY (+16 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "2. Findings, ranked"
Cohesion: 0.14
Nodes (13): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago, L15 — a stale comment claims the No date badge counts suggestions (+5 more)

### Community 46 - "suggest.ts"
Cohesion: 0.11
Nodes (33): Amendment (2026-09-18): what the first seven live suggestions said, RetentionResult, alreadySuggested(), AUTO_MOVE_CONFIDENCE, courseOf(), describePost(), IngestInput, IngestOptions (+25 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.06
Nodes (48): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I01 · Deadline moved / new markers, notification, reminder re-arm (+40 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (23): isGoogleAccount(), accountOf(), call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), fetchAccount() (+15 more)

### Community 49 - "gcal.ts"
Cohesion: 0.16
Nodes (19): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+11 more)

### Community 50 - "core/registry.ts"
Cohesion: 0.06
Nodes (35): BUILD_ID, EXTENSION_VERSION, readClock(), SOURCE_ORIGIN, sourceForUrl(), ADAPTER_KINDS, AdapterStanding, compareVersions() (+27 more)

### Community 51 - "month.ts"
Cohesion: 0.15
Nodes (29): Month — two drawings of one month, BROKEN (1), M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, allTimed(), dayKey(), dayList(), itemsOn(), monthCells() (+21 more)

### Community 52 - "grouping.ts"
Cohesion: 0.13
Nodes (25): 3. Every non-PRESERVED item, REPLACED-RECORDED (49), 4. Timezone results, L9 — `countdown` says "1d late" for something two hours late, weekStatus(), clockOf(), countdown(), creditPercentFor() (+17 more)

### Community 53 - "shell.ts"
Cohesion: 0.05
Nodes (66): E. Tabs and view state, F. Course filter chips, SOURCE_NAME, actionOutcome, UNEXPLAINED_REFUSAL, OverrideAction, appMark(), FocusRequest (+58 more)

### Community 54 - "manual.ts"
Cohesion: 0.21
Nodes (21): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS (+13 more)

### Community 55 - "Popup feature inventory"
Cohesion: 0.11
Nodes (28): R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., M7 — `recheckLogins` has exactly the silent early return worker rule 5 was written for, under a comment claiming it does not., B. Header bar, Contents, D. Banners, G. Date navigator (+20 more)

### Community 56 - "scrub.ts"
Cohesion: 0.18
Nodes (10): BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+2 more)

### Community 57 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 59 - "popup/rows.ts"
Cohesion: 0.17
Nodes (18): itemTone, examDetail(), missedDeadline(), DATE_FLAGS, QualityFlag, qualityFlags(), SOFT_FLAGS, unreadableDeadline() (+10 more)

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.05
Nodes (43): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+35 more)

### Community 61 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (77): House rules for the on-device model, A selector the page has not got is refused before the runner, And the deterministic proposer reads the whole page itself, Checking the three lines without a model, Every group now says how much of it is dated, One session per attempt, and what `kErrorUnknown` meant, Running it without a browser, The attempt line says what the model emitted (+69 more)

### Community 63 - "observer-ui.ts"
Cohesion: 0.21
Nodes (15): Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), observerShownState(), observerStatus(), observerWord(), describePiazza() (+7 more)

### Community 64 - "vitest"
Cohesion: 0.07
Nodes (22): ref_node_fs, vitest, ref_vitest_config, Candidate, guessCourseCode(), MAX_SHOWN, newSiblingsToEnable(), withoutLocalAdapter() (+14 more)

### Community 65 - "focus.ts"
Cohesion: 0.11
Nodes (27): The focus mechanism, as built, applyFocusRequest(), ControlRegion, ControlRequest, controlRequestFor(), DATE_NAV_CLASS, DATE_NAV_SELECTOR, DateNavControl (+19 more)

### Community 66 - "ics.ts"
Cohesion: 0.22
Nodes (16): I22 · Honest .ics / calendar link (all-day for invented times), buildIcs(), escapeIcsText(), event(), eventSummary(), ExportLeg, exportLegs(), foldIcsLine() (+8 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (16): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi (+8 more)

### Community 68 - "applyStoredTheme"
Cohesion: 0.22
Nodes (11): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), applyMode() (+3 more)

### Community 69 - "focusOrOpen"
Cohesion: 0.12
Nodes (27): House rules from the ZIP acceptance pass, 2026-09-19, Important files to resume from, Interaction review: four product findings and one harness gap, The repair batch: 1–7 done, 8–10 running, chromeTabs(), focusOrOpen(), OpenOutcome, pageKey() (+19 more)

### Community 71 - "dates.ts"
Cohesion: 0.09
Nodes (39): House rules for mutation checks, A survivor has three meanings — decide which before acting, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code (+31 more)

### Community 72 - "detect.ts"
Cohesion: 0.06
Nodes (56): What a student is told now, The lectures page, and why it is a fixture and not an entry, What `clauses` reads, on both pages, adapterFromCandidate(), AdapterIdentity, byRank(), candidateNotes(), candidatesFoundLine() (+48 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.39
Nodes (7): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), groupItems(), Settings

### Community 74 - "flows.ts"
Cohesion: 0.21
Nodes (10): Request, Response, applyChange(), ChangeUi, messageOf(), Answer, FlowUi, runFlow() (+2 more)

### Community 75 - "Z. Test files that pin popup behaviour"
Cohesion: 0.20
Nodes (20): Structural decisions, Z. Test files that pin popup behaviour, UX plan phases A–G (2026-09-12), agendaRows(), badgeFor(), emptyStateFor(), failureClauses(), fullStamp() (+12 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (56): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+48 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.23
Nodes (12): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold, npm run preview — the real popup over canned data (+4 more)

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

### Community 84 - "attentionGroups"
Cohesion: 0.15
Nodes (21): 9.2 The five tabs, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups() (+13 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.12
Nodes (15): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path, 1. State the symptom as an observation (+7 more)

### Community 86 - "The design"
Cohesion: 0.18
Nodes (12): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+4 more)

### Community 87 - "sync.test.ts"
Cohesion: 0.10
Nodes (21): parseGradescopeDateTime(), shortHash(), coursesUrl(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN (+13 more)

### Community 88 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.19
Nodes (20): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Defect: cs124.org could not be added at all, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked (+12 more)

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
Cohesion: 0.17
Nodes (19): movedText(), STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), movedRange() (+11 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 99 - "Item"
Cohesion: 0.21
Nodes (15): AttentionGroup, END_OF_DAY_HEADING, LATE_HEADING, PlacedItem, todaySchedule, Section, Item, clockOf() (+7 more)

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.06
Nodes (38): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal, For /graphify explain, For /graphify path, graphify reference: query, path, explain (+30 more)

### Community 103 - "deadline.ts"
Cohesion: 0.10
Nodes (51): The row menu bug — found and fixed 2026-09-18, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 6. Checked and clean, 7. The single cheapest standing check, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand. (+43 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.08
Nodes (17): referenceItems(), sentences(), sources(), globals, popup, document, globals, items (+9 more)

### Community 105 - "sources.ts"
Cohesion: 0.25
Nodes (14): 9.3 The four screens, Notes on items classified PRESERVED that moved, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items), Per-source health indicator, SourceStatus, actionFor(), healthPill (+6 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Illini Dash — design as built"
Cohesion: 0.09
Nodes (21): 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status, 3. Sources (+13 more)

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
Nodes (51): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), How the date is read out of the located text (+43 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "StoreV1Plus"
Cohesion: 0.18
Nodes (8): QueueOptions, SLOW_HOLD_MS, StoreQueue, StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult, StoreV1

### Community 114 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 116 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.18
Nodes (10): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass (+2 more)

### Community 117 - "describeEmpty"
Cohesion: 0.10
Nodes (18): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+10 more)

### Community 118 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.25
Nodes (15): ref_node_crypto, capture(), compare(), escape(), filesIn(), gallery(), init(), read() (+7 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "gcal-config.ts"
Cohesion: 0.22
Nodes (8): GCAL_API_ORIGIN, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_KEY_PLACEHOLDER, GCAL_MATCH, GCAL_SCOPE, GCAL_TIMEZONE

### Community 122 - "SyncDeps"
Cohesion: 0.13
Nodes (16): 6. The sync loop, Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), fetchChecked(), HttpStatusError (+8 more)

### Community 123 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

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
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` is read for its exams and nothing else, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "popup.ts"
Cohesion: 0.11
Nodes (32): 5. R1's ten, re-checked, AttentionName, courseColours(), coursesIn(), ViewName, staleWorkerNotice(), suggestionDueText(), timeNoteFor() (+24 more)

### Community 139 - "page-url.ts"
Cohesion: 0.24
Nodes (11): isDevHash(), normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, applyDevVisibility() (+3 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.11
Nodes (30): ASSUMED_HOUR, CAMPUSWIRE_MATCH, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext, parseFeed() (+22 more)

### Community 141 - "sync-gate.ts"
Cohesion: 0.26
Nodes (7): createSyncGate(), FOLLOW_UP_STRENGTH, Pending, SyncGate, SyncGateOptions, SyncTrigger, Harness

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "Sync loop runSync (§6)"
Cohesion: 0.19
Nodes (21): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Repo layout: worker is wiring, decisions live in core/, Auto-merge rule (§5.3), §0.5 Chrome only, Item (+13 more)

### Community 148 - "Worker rule 3: a value this code invented is not a value the source stated"
Cohesion: 0.30
Nodes (12): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §5.3: an assumed time is the last resort, not the first, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline (+4 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "exams-verified.test.ts"
Cohesion: 0.36
Nodes (6): Exams — everything you have to turn up to, ExamPlacement, reservationVerified(), booked(), exam(), member()

### Community 153 - "makeRowsNavigable"
Cohesion: 0.09
Nodes (21): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. Findings without an F-number, 5. The ten fixes worth making, ranked (+13 more)

### Community 154 - "Defect: the store queue deadlocked"
Cohesion: 0.20
Nodes (14): Parallelism policy, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failing registry refresh retried on every sync, Defect: the store queue deadlocked, Defect: set-adapter-enabled wrote the store outside the queue (+6 more)

### Community 161 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.12
Nodes (27): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Chrome Web Store submission (draft, not submitted), Worker rule 5: log both branches of any decision the user will have to debug, Adapter.columns — header-driven column lookup, Defect: bundled registry was never read (+19 more)

### Community 162 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.33
Nodes (5): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is established, What is not established, and is blocking a parser, Why this page exists to be parsed at all

### Community 163 - "illini-ui-acceptance/SKILL.md"
Cohesion: 0.09
Nodes (21): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Evidence first, Honest completion, Illini UI acceptance, Evidence and completion (+13 more)

### Community 164 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 165 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, Issue tracker: GitHub, PROGRESS.md is the source of truth, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 166 - "piazza-real.test.ts"
Cohesion: 0.16
Nodes (12): PostBody, PostPayload, EXPECTED, FEED, ingest(), NO_OVERRIDES, PAGE, REGISTRATION (+4 more)

### Community 168 - "gate0.ts"
Cohesion: 0.20
Nodes (15): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), checkOne() (+7 more)

### Community 170 - "Domain Docs"
Cohesion: 0.29
Nodes (6): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, In this repo, until a CONTEXT.md exists, Use the glossary's vocabulary

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **942 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+937 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `store.ts`, `options-dom.test.ts`, `ParseError`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `popup.ts`, `page-url.ts`, `core/campuswire.ts`, `health.ts`, `types.ts`, `sync-gate.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `screens/editor.ts`, `icon`, `exams-verified.test.ts`, `piazza.ts`, `theme-panel.ts`, `overrides.test.ts`, `gcal-auth.ts`, `piazza-real.test.ts`, `table-grid.ts`, `announce-real.test.ts`, `gate0.ts`, `Source`, `suggest.ts`, `gcal-client.ts`, `gcal.ts`, `core/registry.ts`, `grouping.ts`, `shell.ts`, `manual.ts`, `scrub.ts`, `popup/rows.ts`, `popup-draw.test.ts`, `author.ts`, `observer-ui.ts`, `focus.ts`, `ics.ts`, `focusOrOpen`, `detect.ts`, `Z. Test files that pin popup behaviour`, `skeleton.ts`, `sync.test.ts`, `provenance.ts`, `gcal-lane.ts`, `popup-clearance.test.ts`, `row-order.test.ts`, `StoreV1Plus`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `prairielearn.ts`, `types.ts`, `core/campuswire.ts`, `background.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `sync.ts`, `announce.ts`, `piazza.ts`, `needs_login detection`, `announce-real.test.ts`, `suggest.ts`, `core/registry.ts`, `author.ts`, `dates.ts`, `detect.ts`, `skeleton.ts`, `sync.test.ts`, `Illini Dash — design as built`, `Piazza — what the live client actually does (2026-09-18)`, `SyncDeps`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `focusOrOpen()` connect `focusOrOpen` to `renderOptions`, `deadline.ts`, `popup.ts`, `options.ts`, `background.ts`, `shell.ts`, `icon`, `popup/rows.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._