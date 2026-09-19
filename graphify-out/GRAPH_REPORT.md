# Graph Report - illini-due  (2026-09-19)

## Corpus Check
- 259 files · ~912,639 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: .css 16, (none) 5, .woff2 2)

## Summary
- 3173 nodes · 8507 edges · 163 communities (152 shown, 11 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 839 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c9923de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- smartphysics.ts
- Canvas — what the API actually returns
- Installing Illini Dash (beta)
- calendar.ts
- scripts
- dedupe.ts
- prairielearn.ts
- schedule.ts
- grouping.ts
- manifest.json
- types.ts
- options.ts
- Course-site adapters and runner (§4.5)
- popup.ts
- theme.test.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- Review outcome — PrairieLearn (12 findings, all survived)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- 2. Findings without an F-number
- validateAdapter
- announce.ts
- piazza.test.ts
- loadStore
- piazzaRun
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
- linkedom
- health.ts
- ref_node_path
- screens/editor.ts
- diagnostics.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- ParseError
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
- gcal-config.ts
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- classifyPiazzaResponse
- Mutation check
- Campuswire fixtures
- describeEmpty
- suggest.ts
- ref_vitest_config
- rows
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
- Tier 1: highest value after the beta, no spec change
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- Popup feature inventory
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
- parsePostBody
- graphify reference: extra exports and benchmark
- Sync loop runSync (§6)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- supportedDateFormats
- Triaging a beta report
- announce-real.test.ts
- core/setup.ts
- detect
- Tracing a symptom along a runtime path
- theme-panel.ts
- healthPill
- ui-acceptance.mjs
- markers.ts
- The colour layer
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
- Build order (§10)
- Piazza — what the live client actually does (2026-09-18)
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- ui-acceptance.test.mjs
- icons.mjs
- ref_node_fs
- Popup redesign brief — "soft card direction"
- extractCourseCode
- ui-browser.mjs
- The design
- emptyStore
- UI acceptance reference contract
- preview-acceptance.test.ts
- Google Stitch prompt — Illini Dash popup
- download.ts
- 9. UI
- Mutation check
- Defect: a Gradescope course labelled stat_425_120248_268442
- Review R2 — new classes of defect in the redesigned popup
- 4. Measurements
- local-adapters.test.ts
- actionOutcome

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 81 edges
2. `Item` - 64 edges
3. `Z. Test files that pin popup behaviour` - 61 edges
4. `vitest` - 60 edges
5. `RawItem` - 45 edges
6. `Source` - 44 edges
7. `icon()` - 37 edges
8. `runAdapter()` - 33 edges
9. `piazzaRun()` - 32 edges
10. `renderRow()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can` --references--> `applyOverride()`  [INFERRED]
  docs/design/review-r3.md → src/background.ts
- `M6 — PROGRESS's "redundant" classification for `dayList`'s title tie-break is wrong; the case is *untested*` --references--> `dayList()`  [INFERRED]
  docs/design/review-r3.md → src/core/calendar.ts
- `No date — listed somewhere, dated nowhere` --references--> `attentionGroups()`  [INFERRED]
  DESIGN.md → src/core/calendar.ts
- `L7 — The No date tab's badge tooltip contradicts D3 and its own comment.` --references--> `noDateCount()`  [INFERRED]
  docs/design/review-r2.md → src/core/calendar.ts

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

## Communities (163 total, 11 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.12
Nodes (30): 8. Storage, isOlderThan(), ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast(), isObserverHealth() (+22 more)

### Community 1 - "smartphysics.ts"
Cohesion: 0.15
Nodes (26): House rules for parsers, Shared parser primitives (src/core/parsing.ts), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), nonEmpty(), parseField() (+18 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (58): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+50 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.13
Nodes (24): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+16 more)

### Community 4 - "calendar.ts"
Cohesion: 0.05
Nodes (98): Month — two drawings of one month, M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, agendaRows() (+90 more)

### Community 5 - "scripts"
Cohesion: 0.05
Nodes (42): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, R. First-run setup screen (+34 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (35): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+27 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (39): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+31 more)

### Community 8 - "schedule.ts"
Cohesion: 0.11
Nodes (29): I02 · Exam-day card on PrairieTest rows (room, duration, format), I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, alarmName(), BOOKING_HOUR (+21 more)

### Community 9 - "grouping.ts"
Cohesion: 0.08
Nodes (34): 3. Every non-PRESERVED item, BROKEN (1), DEGRADED (4), REPLACED-RECORDED (49), 1. Counts, 2. Findings, ranked, 4. Timezone results, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can (+26 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.10
Nodes (34): 2. Data model, Candidate, ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses() (+26 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (28): BUILD_ID, saveProposedAdapter(), currentTermCode(), Response, AdapterEntry, adapterPagePath(), addSiteUrl, buildAdapter() (+20 more)

### Community 13 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.27
Nodes (13): Open: course sites split across pages, Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, smartPhysics as a fifth source (+5 more)

### Community 14 - "popup.ts"
Cohesion: 0.07
Nodes (58): House rules from the ZIP acceptance pass, 2026-09-19, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., The focus mechanism, as built, B. Header bar, P. Empty and error states (+50 more)

### Community 15 - "theme.test.ts"
Cohesion: 0.16
Nodes (19): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, isModeName(), isThemeName(), MODE_KEY, ModeName (+11 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), shortHash(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.17
Nodes (20): Parser rule 5: typeof x === 'string' is not validation, extractCourseCodes(), isInstant(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses() (+12 more)

### Community 19 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.14
Nodes (22): Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), VERIFY: does PrairieTest render the available card for a student with no CBTF courses? (+14 more)

### Community 20 - "site.ts"
Cohesion: 0.09
Nodes (37): House rules for mutation checks, A survivor sometimes indicts the design, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex), matchesHostPattern(), AdapterDate (+29 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "observer-ui.ts"
Cohesion: 0.18
Nodes (16): Evidence first, Honest completion, Illini UI acceptance, Six-stage execution, Piazza and Campuswire on the front, describeObserver(), observerRows(), describePiazza() (+8 more)

### Community 23 - "icon"
Cohesion: 0.09
Nodes (35): Y. Every DOM id and class the popup writes, ExamPlacement, reservationVerified(), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EditorOptions (+27 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (42): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+34 more)

### Community 25 - "2. Findings without an F-number"
Cohesion: 0.20
Nodes (10): 1. Counts, 2. Findings without an F-number, 5. The ten fixes worth making, ranked, 6. One structural note, R-1 — BROKEN. A stray merge marker in `public/popup-screens.css` kills the Needs-you screen's shell rule, R-2 — `src/ui/popup/suggestions.ts` is dead, and is a second copy of F108–F111, R-4 — DEGRADED. A refusal about **Ends** or **Link** lands inside a closed `<details>`, R-5 — The committed captures are stale, and one is a 404 page (+2 more)

### Community 26 - "validateAdapter"
Cohesion: 0.20
Nodes (18): 4. Course-site adapters, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, dateFormat chosen from a closed set (+10 more)

### Community 27 - "announce.ts"
Cohesion: 0.05
Nodes (55): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+47 more)

### Community 28 - "piazza.test.ts"
Cohesion: 0.10
Nodes (25): bodyBatch, highestNr(), MAX_BODIES_PER_SYNC, ObservedPost, PIAZZA_LOGIN_GRACE, PIAZZA_MATCH, PIAZZA_READER_VERSION, PiazzaFacts (+17 more)

### Community 29 - "loadStore"
Cohesion: 0.18
Nodes (25): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, I03 · Toolbar badge: today's count, red ! when a source is broken, Defect: the store queue deadlocked, applySettings(), fireNotification(), gcalPushAfter() (+17 more)

### Community 30 - "piazzaRun"
Cohesion: 0.13
Nodes (23): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, The two re-read lines now count the same thing, piazzaRun(), piazzaToken(), piazzaTrigger(), pool(), cappedLastNr() (+15 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.12
Nodes (20): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Reporting a broken page uploads nothing, PII and authentication not collected, #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0) (+12 more)

### Community 32 - "background.ts"
Cohesion: 0.10
Nodes (24): Decisions worth not re-litigating, W. What lives in Options, not the popup, allAdapters(), applyObserver(), deps, enabledAdapters(), ensureObservers(), gcalClientId() (+16 more)

### Community 33 - "vitest"
Cohesion: 0.10
Nodes (15): vitest, SOURCE_ORIGIN, sourceForUrl(), ADAPTER_KINDS, GRANTED_HOSTS, isPlainString(), REGISTRY_REFRESH_MS, REGISTRY_URL (+7 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.14
Nodes (28): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+20 more)

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
Cohesion: 0.13
Nodes (26): Rules this feature is held to, What a student is told now, adapterFromCandidate(), bestGroupSentence(), candidatesFoundLine(), dataRows(), detectCandidates(), DetectedRow (+18 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (20): adapters, courses, dataset, gcalState, item(), items, listeners, manualRaw (+12 more)

### Community 42 - "linkedom"
Cohesion: 0.40
Nodes (3): linkedom, { document, window }, globals

### Community 43 - "health.ts"
Cohesion: 0.06
Nodes (67): 9.3 The four screens, Structural decisions, Notes on items classified PRESERVED that moved, 3. Mutation table, 6. The one standing check worth adding, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover (+59 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.16
Nodes (28): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., O. The editor (manual items), send(), EditorValues, markScreen(), clearUndo(), closeEditor() (+20 more)

### Community 46 - "diagnostics.ts"
Cohesion: 0.26
Nodes (10): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, Settings, input() (+2 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.18
Nodes (18): I01 · Deadline moved / new markers, notification, reminder re-arm, I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows (+10 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (21): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+13 more)

### Community 49 - "ParseError"
Cohesion: 0.11
Nodes (22): Dashboard: courseList--term, coursesForTerm, current term first, Trap: .courseBox includes the add-course button; use a.courseBox[href^=/courses/], parseGradescopeDateTime(), sourcesToRetryAfterUpdate(), POPUP_DEBOUNCE_MS, assignmentIdFor(), courseIdFrom(), currentTermCourses() (+14 more)

### Community 50 - "renderOptions"
Cohesion: 0.21
Nodes (22): displayCourseLabel(), adapterGroup(), adapterPageName(), adapterRow(), clearRemoval(), dataStatus(), el(), gcalSection() (+14 more)

### Community 51 - "gate0.ts"
Cohesion: 0.16
Nodes (18): Capturing a fixture (the usual ask), Capturing a fixture (the usual ask), ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern() (+10 more)

### Community 52 - "gcal.ts"
Cohesion: 0.16
Nodes (20): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), describeSources(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+12 more)

### Community 53 - "shell.ts"
Cohesion: 0.07
Nodes (60): M8 — The setup screen's "Connected" chip outranks the source's current state., B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, Important files to resume from, Interaction review: four product findings and one harness gap, The repair batch: 1–7 done, 8–10 running, E. Tabs and view state, OverrideAction, appMark() (+52 more)

### Community 54 - "manual.ts"
Cohesion: 0.23
Nodes (19): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput (+11 more)

### Community 55 - "piazza.ts"
Cohesion: 0.08
Nodes (30): Discovery: the class list is in the class page, not in the JWT, ANY_TAG, applyPiazzaResult(), BLOCK_TAG, BodyAttempt, CLASS_LIST_MAX_AGE_MS, ClassPage, ClassPageKind (+22 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "deadline.ts"
Cohesion: 0.07
Nodes (69): The row menu bug — found and fixed 2026-09-18, 3. Findings, ranked, 6. Checked and clean, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand., L2 — Opening a screen moves focus nowhere., L4 — The deadline screen's ⋯ does not toggle., L6 — The Appearance panel is a `role="dialog"` the keyboard cannot enter. (+61 more)

### Community 58 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.09
Nodes (20): answer(), bands(), document, globals, gridHues(), hueOf(), items, legendHues() (+12 more)

### Community 61 - "gcal-config.ts"
Cohesion: 0.13
Nodes (14): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, What Sushi has to do before this can run, GCAL_API_ORIGIN, GCAL_CALENDAR_COLOR, GCAL_CALENDAR_DESCRIPTION, GCAL_CALENDAR_NAME (+6 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (57): House rules for the on-device model, One session per attempt, and what `kErrorUnknown` meant, The context window, What the student is told, attemptCount(), AttemptInfo, attemptLogLine(), authorAdapter() (+49 more)

### Community 63 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 64 - "ics.ts"
Cohesion: 0.27
Nodes (12): buildIcs(), escapeIcsText(), event(), foldIcsLine(), googleCalendarUrl(), icsDate(), icsDayAfter(), icsTimestamp() (+4 more)

### Community 65 - "piazza-real.test.ts"
Cohesion: 0.10
Nodes (19): Evidence and completion, Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages, PostBody, PostPayload (+11 more)

### Community 66 - "needs_login detection"
Cohesion: 0.11
Nodes (27): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Defect: signing in changed nothing until Sync was pressed, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — Gradescope (12 findings, 11 fixed) (+19 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.14
Nodes (17): I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+9 more)

### Community 68 - "classifyPiazzaResponse"
Cohesion: 0.18
Nodes (14): The signed-out page, and the positive marker it made possible, class-page.html — `GET https://piazza.com/class/<nid>` (signed in), asJson(), piazzaBody(), piazzaClasses(), bodyFailureKind, classifyClassPage(), classifyPiazzaResponse() (+6 more)

### Community 69 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 71 - "describeEmpty"
Cohesion: 0.12
Nodes (15): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+7 more)

### Community 72 - "suggest.ts"
Cohesion: 0.12
Nodes (30): Amendment (2026-09-18): what the first seven live suggestions said, alreadySuggested(), AUTO_MOVE_CONFIDENCE, courseOf(), describePost(), IngestInput, IngestOptions, ingestPost() (+22 more)

### Community 74 - "rows"
Cohesion: 0.16
Nodes (20): A selector the page has not got is refused before the runner, And the deterministic proposer reads the list itself, Checking the three lines without a model, Every group now says how much of it is dated, The attempt line says what the model emitted, The inventory says which groups carry dates, and the search reads lists, The manifest needs no new permission, The retry names the groups that do carry dates (+12 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.14
Nodes (19): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons (+11 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.14
Nodes (36): rowSelectorForList(), ancestry(), anchorSelector(), answerableSelector(), cellsOf(), clip(), DATE_SHAPED, datedPhrase() (+28 more)

### Community 77 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.14
Nodes (20): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold (+12 more)

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
Cohesion: 0.16
Nodes (17): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured (+9 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "provenance.test.ts"
Cohesion: 0.26
Nodes (11): assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedRange(), OWN_TIME_NOTE, OWN_TIME_NOTE_ALL_DAY, SOURCE_TIME_NOTE (+3 more)

### Community 87 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.17
Nodes (13): Decision 5: campus rows without a course, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I28 · Keep reminders working past Chrome's 500-alarm cap, I37 · A partial PrairieLearn score is not 'done', I47 · Per-adapter health state and N->0 guard per course site, I51 · In-options adapter workbench with 'Propose this adapter', I57 · Term rollover: term dates in the registry, Expired section (+5 more)

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
Cohesion: 0.12
Nodes (17): L3 — A row with no URL can never be focused, so back-from-a-screen loses focus on it., A. Document shell and load-time behaviour, Contents, D. Banners, F. Course filter chips, G. Date navigator, H. The row, K. Week view (+9 more)

### Community 97 - "/graphify"
Cohesion: 0.20
Nodes (9): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Usage (+1 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.06
Nodes (50): Worker rule 2: a green dot must mean 'I fetched, and it was fine', 6. The sync loop, Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, Defect: source Off but its rows still on the calendar, Defect: a failed fetch was reported as parse_error (+42 more)

### Community 100 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.27
Nodes (10): Parallelism policy, Trace the path, not just the file, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Defect: bundled registry was never read, Defect: a failing registry refresh retried on every sync, Defect: set-adapter-enabled wrote the store outside the queue, The first live run (2026-09-10): four defects, none caught by 382 tests (+2 more)

### Community 101 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 102 - "exams-verified.test.ts"
Cohesion: 0.28
Nodes (8): 9.2 The five tabs, Exams — everything you have to turn up to, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards, booked(), exam(), member()

### Community 103 - "What You Must Do When Invoked"
Cohesion: 0.20
Nodes (10): Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2 - Detect files, Step 4.5 - Graph health check (read-only integrity gate), Step 4 - Build graph, cluster, analyze, generate outputs, Step 5 - Label communities, Step 6 - Generate Obsidian vault (opt-in) + HTML, Step 9 - Save manifest, update cost tracker, clean up, and report (+2 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.11
Nodes (12): document, globals, items, now, opened, popup, Rule, shape() (+4 more)

### Community 105 - "parsePostBody"
Cohesion: 0.17
Nodes (16): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): three ways one field cost a whole class, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed (+8 more)

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Sync loop runSync (§6)"
Cohesion: 0.19
Nodes (21): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — dedupe + sync (16 findings, 7 code defects), Repo layout: worker is wiring, decisions live in core/, Auto-merge rule (§5.3), §0.5 Chrome only, Item (+13 more)

### Community 108 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 109 - "Verifying the popup"
Cohesion: 0.22
Nodes (8): Build the real documents, Dark mode first, Height is the recurring bug, Other pages the preview builds, Pressing things, The query switches, Two more, when the UI is quiet, Verifying the popup

### Community 110 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 111 - "supportedDateFormats"
Cohesion: 0.10
Nodes (20): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. The three page shapes, 4. The date grammar, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5) (+12 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "announce-real.test.ts"
Cohesion: 0.12
Nodes (15): EmptyReason, Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, PostPayload, EMPTY, Expected (+7 more)

### Community 114 - "core/setup.ts"
Cohesion: 0.39
Nodes (7): loginsToOpen(), needsSetup(), opensOnInstall(), SETUP_SOURCES, setupProgress, setupRows(), setupSummary()

### Community 115 - "detect"
Cohesion: 0.28
Nodes (7): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), detect()

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "theme-panel.ts"
Cohesion: 0.13
Nodes (30): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, Light or dark is a setting (is-dark class), menu (+22 more)

### Community 118 - "healthPill"
Cohesion: 0.12
Nodes (20): Decision 4: manual deadline entry, aggregator or planner, I16 · Honest status line and stale-data banner, I21 · Manual deadlines as a sixth 'manual' source, Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #page-sub: version, last check, sources answered, #actions: three header controls on the right (+12 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "markers.ts"
Cohesion: 0.32
Nodes (7): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult

### Community 121 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

### Community 122 - "Asking Sushi for a browser action"
Cohesion: 0.33
Nodes (5): Asking Sushi for a browser action, Before you ask, Template, The rules of the ask, What I must never ask you to do for me

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
Cohesion: 0.33
Nodes (5): Asking Sushi for a browser action, Before you ask, Template, The rules of the ask, What I must never ask you to do for me

### Community 133 - "Build order (§10)"
Cohesion: 0.13
Nodes (26): When live data contradicts a document: rewrite the claim, Parser rule 3: never index cells positionally, Review policy, Chrome Web Store submission (draft, not submitted), Adapter.columns — header-driven column lookup, Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Defect: cs124.org could not be added at all (+18 more)

### Community 134 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.18
Nodes (10): Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass (+2 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.15
Nodes (12): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+4 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 139 - "page-url.ts"
Cohesion: 0.29
Nodes (9): normalizePageUrl(), notAWebAddress(), PageUrlResult, quoted(), schemeOf(), RFC-3986, reasonFor(), RFC-3986 (+1 more)

### Community 140 - "core/campuswire.ts"
Cohesion: 0.10
Nodes (32): ASSUMED_HOUR, CAMPUSWIRE_MATCH, CAMPUSWIRE_ORIGIN, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts, PageContext (+24 more)

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "ref_node_fs"
Cohesion: 0.20
Nodes (7): ref_node_fs, BLOCKS, CLASSICAL, POPUP, UI, USED, V1

### Community 144 - "Popup redesign brief — "soft card direction""
Cohesion: 0.25
Nodes (5): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification

### Community 145 - "extractCourseCode"
Cohesion: 0.28
Nodes (9): Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, The fixture's scrub was broken, and is repaired, itemOfManual(), courseColour(), courseGroup(), courseNumber(), courseDepartment() (+1 more)

### Community 146 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 147 - "The design"
Cohesion: 0.29
Nodes (7): Google Calendar sync, Looking at it without a Google account, The design, What it costs, pushEvents(), diffEvents(), diffSize()

### Community 148 - "emptyStore"
Cohesion: 0.25
Nodes (8): I17 · Health-aware popup empty state; no green dot before success, #status: errors only, hidden otherwise, defaultStatus(), emptyGcal(), emptyStore(), storeWith(), resting(), storeWith()

### Community 149 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 150 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, referenceItems(), globals, popup

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "download.ts"
Cohesion: 0.32
Nodes (7): downloadFile(), downloadIcs(), itemsToExport(), render(), renderCapture(), row(), suggestFilename()

### Community 153 - "9. UI"
Cohesion: 0.29
Nodes (7): 9.1 The shell, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.9 Appearance, 9. UI

### Community 154 - "Mutation check"
Cohesion: 0.29
Nodes (6): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo)

### Community 156 - "Defect: a Gradescope course labelled stat_425_120248_268442"
Cohesion: 0.47
Nodes (6): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, Course code extraction (§5.1)

### Community 159 - "Review R2 — new classes of defect in the redesigned popup"
Cohesion: 0.33
Nodes (6): 9.8 Interaction, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 7. The single cheapest standing check, Review R2 — new classes of defect in the redesigned popup, click()

### Community 160 - "4. Measurements"
Cohesion: 0.33
Nodes (6): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.4 Tokens, 4.5 The sizing invariants, 4. Measurements

### Community 161 - "local-adapters.test.ts"
Cohesion: 0.33
Nodes (4): guessCourseCode(), withLocalAdapter(), withoutLocalAdapter(), VALID

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **781 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+776 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 959 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `vitest` to `smartphysics.ts`, `calendar.ts`, `scripts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `page-url.ts`, `core/campuswire.ts`, `types.ts`, `popup.ts`, `ref_node_fs`, `theme.test.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `observer-ui.ts`, `icon`, `preview-acceptance.test.ts`, `piazza.test.ts`, `local-adapters.test.ts`, `overrides.test.ts`, `gcal-auth.ts`, `actionOutcome`, `detect.ts`, `compat.ts`, `linkedom`, `health.ts`, `diagnostics.ts`, `gcal-client.ts`, `ParseError`, `gate0.ts`, `gcal.ts`, `manual.ts`, `scrub.ts`, `deadline.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `piazza-real.test.ts`, `suggest.ts`, `skeleton.ts`, `provenance.test.ts`, `sync.ts`, `exams-verified.test.ts`, `row-order.test.ts`, `announce-real.test.ts`, `core/setup.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `smartphysics.ts`, `Piazza — what the live client actually does (2026-09-18)`, `prairielearn.ts`, `Illini Dash — design as built`, `types.ts`, `core/campuswire.ts`, `prairietest.ts`, `canvas.ts`, `Review outcome — PrairieLearn (12 findings, all survived)`, `site.ts`, `announce.ts`, `piazza.test.ts`, `loadStore`, `piazzaRun`, `detect.ts`, `gate0.ts`, `piazza.ts`, `author.ts`, `needs_login detection`, `classifyPiazzaResponse`, `suggest.ts`, `skeleton.ts`, `sync.ts`, `parsePostBody`, `announce-real.test.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `detect()` connect `detect` to `detect.ts`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._