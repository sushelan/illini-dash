# Graph Report - integrate  (2026-10-01)

## Corpus Check
- 290 files · ~1,231,917 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3725 nodes · 10156 edges · 160 communities (149 shown, 11 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 902 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `acf507b3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- canvas.ts
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
- health.ts
- The colour layer
- popup.html: the popup and full view document
- background.ts
- dates.ts
- validateAdapter
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- support.js
- Canvas — what the API actually returns
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
- runAdapter
- compilerOptions
- announce-real.test.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- Roadmap ideas (88 ranked gaps)
- ref_node_path
- 2. Findings, ranked
- suggest.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gcal.ts
- core/registry.ts
- popup.ts
- Adapter
- shell.ts
- manual.ts
- tokens.test.ts
- scrub.ts
- Gradescope fixtures provenance
- What You Must Do When Invoked
- deadline.ts
- popup-draw.test.ts
- /graphify
- author.ts
- observer-ui.ts
- vitest
- /graphify
- ics.ts
- Tier 0b: beta prerequisites that need Sushi
- applyStoredTheme
- .query
- Campuswire fixtures
- parseAdapterDateParts
- detect.ts
- emptyStore
- flows.ts
- Tracing a symptom along a runtime path
- skeleton.ts
- Popup UI (§8.1)
- language-model.d.ts
- preview-acceptance.test.ts
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- gate0.ts
- Tracing a symptom along a runtime path
- The design
- ParseError
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
- queue.ts
- CS 341 (fa26) — course site findings
- gcal-lane.ts
- popup-clearance.test.ts
- screens/editor.ts
- row-order.test.ts
- Tier 0a (2026-09-10, 13 items)
- graphify reference: extra exports and benchmark
- Illini Dash — design as built
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- site.test.ts
- Triaging a beta report
- StoreV1Plus
- detect.test.ts
- graphify reference: transcribe video and audio
- What the two stages read, and the scorecard over the real feed
- describeEmpty
- Asking Sushi for a browser action
- ui-acceptance.mjs
- propose.mjs
- graphify reference: query, path, explain
- SyncDeps
- Worker rule 5: log both branches of any decision the user will have to debug
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- options-dom.test.ts
- Asking Sushi for a browser action
- `fixtures/sites/` — the course pages the §4.5 runner is tested against
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- 4. Measurements
- shots.mjs
- ui-acceptance.test.mjs
- site.mjs
- compat.ts
- page-url.ts
- core/campuswire.ts
- sync-gate.ts
- icons.mjs
- build.mjs
- package.json
- Auto-merge rule (§5.3)
- Canvas source (§4.1, REST API)
- Google Stitch prompt — Illini Dash popup
- 9. UI
- 2. Findings without an F-number
- Sync loop runSync (§6)
- graphify reference: transcribe video and audio
- Adapter (declarative course-site adapter)
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- illini-dash
- ui-browser.mjs
- piazza-real.test.ts
- capture.ts

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 83 edges
2. `vitest` - 75 edges
3. `Item` - 65 edges
4. `runAdapter()` - 61 edges
5. `Z. Test files that pin popup behaviour` - 59 edges
6. `RawItem` - 48 edges
7. `Source` - 46 edges
8. `validateAdapter()` - 44 edges
9. `renderRow()` - 38 edges
10. `icon()` - 37 edges

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

## Communities (160 total, 11 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.09
Nodes (35): 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, TITLE_NAME_MAX, PiazzaHealth, ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast() (+27 more)

### Community 1 - "canvas.ts"
Cohesion: 0.09
Nodes (42): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, The signed-out page, and the positive marker it made possible, Decision: Canvas concluded-course filter via include[]=term, Review outcome — PrairieTest (12 findings, all survived), Shared parser primitives (src/core/parsing.ts) (+34 more)

### Community 2 - "PrairieTest — what the fetched HTML actually contains"
Cohesion: 0.10
Nodes (35): Gradescope — what the fetched HTML actually contains, Hidden Due Date column is state-dependent; parse <time datetime>, Row control changes on submit: <a href> vs button data-assignment-id, Rows: tr containing th.table--primaryLink, Status from div.submissionStatus--text, ignore colour modifiers, <time class=submissionTimeChart--dueDate> discriminated by aria-label prefix, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], Skip fetching courses stating 0 assignments (+27 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (22): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+14 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (100): 3. Mutation table, 4. Timezone results, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L9 — `countdown` says "1d late" for something two hours late, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow (+92 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.10
Nodes (37): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, Amendment (2026-09-18): a cross-listed class matched none of the student's rows, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus() (+29 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.14
Nodes (26): isNoEndMarker(), parsePrairieLearnScheduleDate(), textOf(), courseInstanceIdFrom(), COURSES_HEADINGS, creditCeiling(), CreditCell, CreditTier (+18 more)

### Community 8 - "schedule.ts"
Cohesion: 0.09
Nodes (43): ALARM_BUDGET, alarmName(), applySnooze(), BOOKING_HOUR, BOOKING_LAST_HOUR, buttonAction, clampTitle(), dayWord() (+35 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.08
Nodes (28): CourseGroup, courseGroupsForYou(), courseKeysOf(), emptyCourseGroup(), finishGroup(), groupHasCourse(), AdapterEntry, adapterPageName() (+20 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.10
Nodes (32): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parsePrairieLearnHome(), parseSmartPhysicsCourses(), runAdapterInOffscreen() (+24 more)

### Community 12 - "options.ts"
Cohesion: 0.06
Nodes (44): B. Header bar, I57 · Term rollover: term dates in the registry, Expired section, currentTermCode(), downloadFile(), downloadIcs(), itemsToExport(), addSiteButton, addSiteUrl (+36 more)

### Community 13 - "health.ts"
Cohesion: 0.06
Nodes (82): 2. Data model, 9.3 The four screens, Structural decisions, Notes on items classified PRESERVED that moved, C. Health pill and source popover, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: an exam already sat counted as Overdue, The one source with no login page (course sites) (+74 more)

### Community 14 - "The colour layer"
Cohesion: 0.23
Nodes (15): The colour layer, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Preview harness: preview-popup.html, preview-options.html, components.html, shot.html, Rule 1b: both ends of the range carry the hue; tokens.test.ts checks AA, Rule 1: a course is a label, being late is a meaning (+7 more)

### Community 15 - "popup.html: the popup and full view document"
Cohesion: 0.11
Nodes (23): Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Generated store screenshots (npm run shots) (+15 more)

### Community 16 - "background.ts"
Cohesion: 0.08
Nodes (48): House rules for the worker and the loop, Decisions worth not re-litigating, Defect: bundled registry was never read, allAdapters(), applyObserver(), applySettings(), deps, enabledAdapters() (+40 more)

### Community 17 - "dates.ts"
Cohesion: 0.11
Nodes (20): RFC-3339, DAYS_IN_MONTH, MONTHS, parseDateAttribute(), parseDateRangeAttribute(), WEEKDAYS, ZONE_OFFSETS, cardFor() (+12 more)

### Community 18 - "validateAdapter"
Cohesion: 0.07
Nodes (44): Rules this feature is held to, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place) (+36 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.18
Nodes (18): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Daily booking nag, Gradescope datetime attribute format, Open questions (§12), parseLocalDate(parts, zone) helper (+10 more)

### Community 20 - "site.ts"
Cohesion: 0.05
Nodes (77): House rules for mutation checks, A survivor sometimes indicts the design, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, escapeRegex(), cellAt(), columnOf(), directCells() (+69 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "Canvas — what the API actually returns"
Cohesion: 0.12
Nodes (24): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+16 more)

### Community 23 - "icon"
Cohesion: 0.06
Nodes (48): Y. Every DOM id and class the popup writes, END_OF_DAY_HEADING, LATE_HEADING, ExamPlacement, reservationVerified(), createEditor(), Editor, EDITOR_CLASS (+40 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (44): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+36 more)

### Community 25 - "sync.ts"
Cohesion: 0.09
Nodes (32): 5. Normalize, merge, retain, I59 · Lift backoff and resync immediately on extension update, Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Fetch rules for all sources, QualityFlag, inBackoff(), AdapterOutcome (+24 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.12
Nodes (30): Rows say 'time not given' rather than inventing a time, --accent-ink is never white, #filters scroll-container exemption in the width check, Popup document must never exceed 400px, --primary / --primary-ink for the one filled button, Tab strip min-width: 0 guard, icon and label on all five tabs, UX plan for the store release, B1: a sat exam is not Overdue (+22 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (58): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+50 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (93): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): which feed field says a post was edited, The feed's shapes, as captured, The two re-read lines now count the same thing, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), asJson() (+85 more)

### Community 29 - "needs_login detection"
Cohesion: 0.14
Nodes (21): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest (+13 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.11
Nodes (22): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Reporting a broken page uploads nothing, PII and authentication not collected, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets) (+14 more)

### Community 32 - "theme-panel.ts"
Cohesion: 0.18
Nodes (23): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName(), isThemeName(), MODE_KEY (+15 more)

### Community 33 - "renderOptions"
Cohesion: 0.15
Nodes (32): send(), isSourceState(), el(), stateChip(), gcalSection(), observerRow(), readCourseSite(), refreshOptions() (+24 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.14
Nodes (30): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), CAMPUSWIRE_ORIGIN, acceptSuggestion() (+22 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.13
Nodes (19): gcalClientId(), gcalEventFor(), gcalPushUnqueued(), Identity, noteGcal(), ALL_GCAL_STATES, classifyAuthFailure(), describeGcal() (+11 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "runAdapter"
Cohesion: 0.16
Nodes (19): monthIndex(), shortHash(), KeyGuard, guardSlotHitRate(), runAdapter(), courseCodesFor(), courseUrl(), DUE (+11 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "announce-real.test.ts"
Cohesion: 0.12
Nodes (15): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (23): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+15 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (22): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer (+14 more)

### Community 44 - "ref_node_path"
Cohesion: 0.13
Nodes (13): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+5 more)

### Community 45 - "2. Findings, ranked"
Cohesion: 0.11
Nodes (22): 6. Checked and clean, 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships (+14 more)

### Community 46 - "suggest.ts"
Cohesion: 0.11
Nodes (34): Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, RetentionResult, alreadySuggested(), AUTO_MOVE_CONFIDENCE, courseOf(), describePost() (+26 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.11
Nodes (27): Decision 6: snooze amends §7's daily booking nag, I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons (+19 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.12
Nodes (25): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+17 more)

### Community 49 - "gcal.ts"
Cohesion: 0.17
Nodes (18): calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent(), ILLINI_DASH_ID (+10 more)

### Community 50 - "core/registry.ts"
Cohesion: 0.07
Nodes (29): BUILD_ID, EXTENSION_VERSION, GCAL_API_ORIGIN, GCAL_CLIENT_ID_PLACEHOLDER, GCAL_SCOPE, SOURCE_ORIGIN, sourceForUrl(), ADAPTER_KINDS (+21 more)

### Community 51 - "popup.ts"
Cohesion: 0.08
Nodes (50): Month — two drawings of one month, BROKEN (1), dayKey(), MonthDotCell, startOfDay(), ViewName, weekContents(), weekDays() (+42 more)

### Community 52 - "Adapter"
Cohesion: 0.16
Nodes (13): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, ValidationResult, adapterFailureKind(), hostOf(), HttpStatusError (+5 more)

### Community 53 - "shell.ts"
Cohesion: 0.03
Nodes (110): House rules from the ZIP acceptance pass, 2026-09-19, M8 — The setup screen's "Connected" chip outranks the source's current state., L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, Important files to resume from, Interaction review: four product findings and one harness gap, The focus mechanism, as built, The repair batch: 1–7 done, 8–10 running, A. Document shell and load-time behaviour (+102 more)

### Community 54 - "manual.ts"
Cohesion: 0.23
Nodes (20): 5. Checked and clean, ASSUMED_TIME, dedupeInput(), editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput (+12 more)

### Community 55 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 56 - "scrub.ts"
Cohesion: 0.17
Nodes (11): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport (+3 more)

### Community 57 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.13
Nodes (15): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2.5 - Video and audio (only if video files detected), Step 2 - Detect files, Step 3 - Extract entities and relationships (+7 more)

### Community 59 - "deadline.ts"
Cohesion: 0.06
Nodes (69): L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., L8 — `openedFrom` survives a screen the tab change discarded., Course rename override (overrides.courseNames), AttentionName, coursesIn(), itemTone, examDetail(), movedText() (+61 more)

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.07
Nodes (28): announced(), bands(), document, entryNamed(), escape(), globals, gridHues(), hueOf() (+20 more)

### Community 61 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 62 - "author.ts"
Cohesion: 0.05
Nodes (75): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The inventory sketches one row's insides, The manifest needs no new permission (+67 more)

### Community 63 - "observer-ui.ts"
Cohesion: 0.21
Nodes (15): Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), observerShownState(), observerStatus(), observerWord(), describePiazza() (+7 more)

### Community 64 - "vitest"
Cohesion: 0.09
Nodes (14): linkedom, ref_node_fs, vitest, ref_vitest_config, BLOCKS, CLASSICAL, POPUP, UI (+6 more)

### Community 65 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 66 - "ics.ts"
Cohesion: 0.22
Nodes (16): buildIcs(), escapeIcsText(), event(), eventSummary(), ExportLeg, exportLegs(), foldIcsLine(), googleCalendarUrl() (+8 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.14
Nodes (17): I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+9 more)

### Community 68 - "applyStoredTheme"
Cohesion: 0.17
Nodes (19): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, menu, allThemeClasses(), themeClass(), applyMode(), applyStoredTheme() (+11 more)

### Community 69 - ".query"
Cohesion: 0.22
Nodes (7): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal, Interpreter guard for subcommands, Interpreter guard for subcommands

### Community 71 - "parseAdapterDateParts"
Cohesion: 0.10
Nodes (28): A survivor has three meanings — decide which before acting, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo), Mutation rule 2: a survivor is untested, unreachable, or redundant (+20 more)

### Community 72 - "detect.ts"
Cohesion: 0.07
Nodes (65): What a student is told now, AdapterIdentity, byRank(), candidateNotes(), candidatesFoundLine(), cellOf(), CLAUSE_SEPARATORS, clocksIn() (+57 more)

### Community 73 - "emptyStore"
Cohesion: 0.28
Nodes (8): emptyGcal(), emptyStore(), input(), NOW, raw(), storeWith(), resting(), storeWith()

### Community 74 - "flows.ts"
Cohesion: 0.16
Nodes (16): actionOutcome, UNEXPLAINED_REFUSAL, Request, Response, applyChange(), ChangeUi, messageOf(), Answer (+8 more)

### Community 75 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 76 - "skeleton.ts"
Cohesion: 0.08
Nodes (60): AuthorOptions, PLACEHOLDER, rowSelectorForList(), selectorForList(), ancestry(), anchorSelector(), answerableSelector(), bestDated() (+52 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.12
Nodes (23): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half (+15 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.17
Nodes (6): availability(), LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, referenceItems(), globals, popup

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

### Community 84 - "gate0.ts"
Cohesion: 0.32
Nodes (7): checkOne(), collapse(), GATE0_TARGETS, Gate0Result, Gate0Target, LOGIN_URL_MARKERS, runGate0()

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "The design"
Cohesion: 0.18
Nodes (12): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+4 more)

### Community 87 - "ParseError"
Cohesion: 0.11
Nodes (22): Dashboard: courseList--term, coursesForTerm, current term first, isOlderThan(), parseGradescopeDateTime(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN (+14 more)

### Community 88 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.17
Nodes (26): When live data contradicts a document: rewrite the claim, CLAUDE.md project instructions and house rules, Review policy, Chrome Web Store submission (draft, not submitted), Defect: cs124.org could not be added at all, Fixtures captured, Open full view reuses one tab, PROGRESS.md — what is done, which gate, what is blocked (+18 more)

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
Cohesion: 0.23
Nodes (13): dateOrigin, HEADING, isStudentsOwn(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY, POST_TIME_NOTE, POST_TIME_NOTE_ALL_DAY, SOURCE_TIME_NOTE (+5 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.13
Nodes (15): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2.5 - Video and audio (only if video files detected), Step 2 - Detect files, Step 3 - Extract entities and relationships (+7 more)

### Community 98 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 99 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.18
Nodes (15): 4.4 Tokens, allRules(), beats(), contrast(), declared(), over(), resolve(), rgb() (+7 more)

### Community 103 - "screens/editor.ts"
Cohesion: 0.04
Nodes (87): Also open, Development loop, HANDOFF — 2026-09-13, updated 2026-09-18, The row menu bug — found and fixed 2026-09-18, The store submission, 9.8 Interaction, Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable) (+79 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.11
Nodes (12): document, globals, items, now, opened, popup, Rule, shape() (+4 more)

### Community 105 - "Tier 0a (2026-09-10, 13 items)"
Cohesion: 0.50
Nodes (8): Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Tier 0a (2026-09-10, 13 items), Per-source backoff, Canonical field precedence for merged items, SOURCE_RANK

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Illini Dash — design as built"
Cohesion: 0.15
Nodes (12): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+4 more)

### Community 108 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 109 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "site.test.ts"
Cohesion: 0.05
Nodes (51): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 4. The date grammar, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5) (+43 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "StoreV1Plus"
Cohesion: 0.19
Nodes (12): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, StoreV1Plus, QueuedSyncIo (+4 more)

### Community 114 - "detect.test.ts"
Cohesion: 0.06
Nodes (34): 4. Course-site adapters, And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say (+26 more)

### Community 116 - "What the two stages read, and the scorecard over the real feed"
Cohesion: 0.13
Nodes (15): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18) (+7 more)

### Community 117 - "describeEmpty"
Cohesion: 0.12
Nodes (15): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+7 more)

### Community 118 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 122 - "SyncDeps"
Cohesion: 0.17
Nodes (14): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), fetchChecked(), pooled(), SourceEmpty (+6 more)

### Community 123 - "Worker rule 5: log both branches of any decision the user will have to debug"
Cohesion: 0.40
Nodes (5): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Worker rule 5: log both branches of any decision the user will have to debug, Light or dark is a setting (is-dark class)

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
Cohesion: 0.10
Nodes (15): Actions, COURSE_KEYS, Entry, Flows, globals, Mod, nameOf(), NOTHING (+7 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` is read for its exams and nothing else, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "4. Measurements"
Cohesion: 0.40
Nodes (5): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.5 The sizing invariants, 4. Measurements

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState() (+7 more)

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
Cohesion: 0.24
Nodes (9): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, R. First-run setup screen (+1 more)

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "Auto-merge rule (§5.3)"
Cohesion: 0.24
Nodes (15): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Item, memberKey = source:sourceId, Overrides (+7 more)

### Community 148 - "Canvas source (§4.1, REST API)"
Cohesion: 0.22
Nodes (11): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: a Gradescope course labelled stat_425_120248_268442, Canvas plannable_type → Kind mapping, Canvas planner items endpoint (+3 more)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "9. UI"
Cohesion: 0.14
Nodes (15): 9.1 The shell, 9.2 The five tabs, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.9 Appearance, 9. UI (+7 more)

### Community 153 - "2. Findings without an F-number"
Cohesion: 0.15
Nodes (14): 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item, 5. The ten fixes worth making, ranked, 6. One structural note, DEGRADED (4), R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111 (+6 more)

### Community 154 - "Sync loop runSync (§6)"
Cohesion: 0.17
Nodes (22): Parallelism policy, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Worker rule 7: live data is a source of truth the fixtures are not, Defect: a failing registry refresh retried on every sync, Defect: the store queue deadlocked, Defect: set-adapter-enabled wrote the store outside the queue (+14 more)

### Community 161 - "Adapter (declarative course-site adapter)"
Cohesion: 0.25
Nodes (8): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Adapter.columns — header-driven column lookup, smartPhysics as a fifth source, Tier 0b (4 of 7 done), Adapter (declarative course-site adapter)

### Community 162 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.33
Nodes (5): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is established, What is not established, and is blocking a parser, Why this page exists to be parsed at all

### Community 163 - "illini-dash"
Cohesion: 0.04
Nodes (43): Check it in the mode Sushi actually uses, graphify, House rules for the UI, and for diagnosing it, illini-dash, Parallelism, Reference-driven UI acceptance, Review policy, Rules (+35 more)

### Community 164 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 166 - "piazza-real.test.ts"
Cohesion: 0.16
Nodes (12): PostBody, PostPayload, EXPECTED, FEED, ingest(), NO_OVERRIDES, PAGE, REGISTRATION (+4 more)

### Community 168 - "capture.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), countOccurrences() (+8 more)

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **936 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+931 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1141 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `canvas.ts`, `store.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `compat.ts`, `page-url.ts`, `core/campuswire.ts`, `health.ts`, `types.ts`, `sync-gate.ts`, `dates.ts`, `package.json`, `validateAdapter`, `site.ts`, `icon`, `9. UI`, `piazza.ts`, `theme-panel.ts`, `overrides.test.ts`, `gcal-auth.ts`, `piazza-real.test.ts`, `runAdapter`, `announce-real.test.ts`, `capture.ts`, `ref_node_path`, `suggest.ts`, `gcal-client.ts`, `gcal.ts`, `core/registry.ts`, `popup.ts`, `shell.ts`, `manual.ts`, `tokens.test.ts`, `scrub.ts`, `deadline.ts`, `popup-draw.test.ts`, `author.ts`, `observer-ui.ts`, `ics.ts`, `emptyStore`, `flows.ts`, `skeleton.ts`, `preview-acceptance.test.ts`, `ParseError`, `provenance.ts`, `queue.ts`, `gcal-lane.ts`, `popup-clearance.test.ts`, `row-order.test.ts`, `site.test.ts`, `detect.test.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `canvas.ts`, `prairielearn.ts`, `types.ts`, `core/campuswire.ts`, `background.ts`, `dates.ts`, `site.ts`, `sync.ts`, `announce.ts`, `piazza.ts`, `needs_login detection`, `runAdapter`, `announce-real.test.ts`, `suggest.ts`, `Adapter`, `author.ts`, `vitest`, `parseAdapterDateParts`, `detect.ts`, `skeleton.ts`, `Illini Dash — design as built`, `site.test.ts`, `What the two stages read, and the scorecard over the real feed`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Item` connect `calendar.ts` to `store.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `types.ts`, `options.ts`, `health.ts`, `core/campuswire.ts`, `background.ts`, `Auto-merge rule (§5.3)`, `icon`, `9. UI`, `sync.ts`, `announce.ts`, `piazza.ts`, `overrides.test.ts`, `piazza-real.test.ts`, `announce-real.test.ts`, `suggest.ts`, `gcal-client.ts`, `gcal.ts`, `popup.ts`, `shell.ts`, `deadline.ts`, `popup-draw.test.ts`, `ics.ts`, `preview-acceptance.test.ts`, `provenance.ts`, `screens/editor.ts`, `row-order.test.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._