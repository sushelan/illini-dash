# Graph Report - illini-due  (2026-09-21)

## Corpus Check
- 269 files · ~1,013,694 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: .css 13, (none) 5, .woff2 2)

## Summary
- 3390 nodes · 9057 edges · 169 communities (158 shown, 11 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 880 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2369ecec`
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
- course-sites.ts
- manifest.json
- messages.ts
- options.ts
- month.ts
- popup.ts
- theme-panel.ts
- Adapter registry (bundled + daily GitHub refresh)
- prairietest.ts
- canvas.ts
- Gradescope source (§4.2, HTML)
- site.ts
- support.js
- observer-ui.ts
- icon
- Chrome Web Store listing draft (§9 G5)
- piazza.test.ts
- gcalPush
- announce.ts
- piazza.ts
- makeRowsNavigable
- deadline.ts
- options.html: Settings page
- background.ts
- core/registry.ts
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- grouping.ts
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- locateDue
- health.ts
- ref_node_path
- screens/editor.ts
- linkedom
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gradescope.ts
- Piazza fixtures
- capture.ts
- gcal.ts
- shell.ts
- RawItem
- renderOptions
- scrub.ts
- devDependencies
- What You Must Do When Invoked
- tokens.test.ts
- popup-draw.test.ts
- Installing Illini Dash (beta)
- author.ts
- Illini Dash ZIP UI acceptance handoff
- ics.ts
- piazza-real.test.ts
- needs_login detection
- Tier 0b: beta prerequisites that need Sushi
- theme.ts
- cellByHeader
- Campuswire fixtures
- Campuswire — findings
- suggest.ts
- diagnostics.ts
- syncSites
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
- The colour layer
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- 3. Findings, ranked
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md
- What You Must Do When Invoked
- Gradescope fixtures provenance
- sync.ts
- isItemDone
- SyncDeps
- piazzaRun
- 2. Findings, ranked
- row-order.test.ts
- StoreV1Plus
- graphify reference: extra exports and benchmark
- Sync loop runSync (§6)
- Ponytail
- Verifying the popup
- smartPhysics fixtures provenance
- validateAdapter
- Triaging a beta report
- announce.test.ts
- detect.test.ts
- graphify reference: transcribe video and audio
- Tracing a symptom along a runtime path
- types.ts
- popup.html: the popup and full view document
- ui-acceptance.mjs
- propose.mjs
- suggest.test.ts
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
- Auto-merge rule (§5.3)
- Piazza — what the live client actually does (2026-09-18)
- shots.mjs
- Illini Dash — design as built
- site.mjs
- Classical Calendar — previous alignment measurements (2026-09-19)
- page-url.ts
- core/campuswire.ts
- ui-acceptance.test.mjs
- icons.mjs
- What the two stages read, and the scorecard over the real feed
- build.mjs
- vitest
- package.json
- UI acceptance reference contract
- 3. Mutation table
- scrub-file.mjs
- preview-acceptance.test.ts
- Google Stitch prompt — Illini Dash popup
- createStoreQueue
- 9.2 The five tabs
- Amendment (2026-09-18, evening): the fetch plan after the trace
- I08 · Local Done check-off, separate from Hide
- 4. Measurements
- graphify reference: transcribe video and audio
- local-adapters.test.ts
- piazzaClasses
- course-colour.test.ts
- offscreen.html: DOMParser host for the service worker
- Sushi's time is the scarce resource
- ui-browser.mjs
- exams-verified.test.ts
- J. Day view

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 82 edges
2. `Item` - 65 edges
3. `vitest` - 63 edges
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

## Communities (169 total, 11 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.10
Nodes (32): 8. Storage, Amendment (2026-09-19): the announcement is not the row's name, I54 · Versioned store migrations with memberKey remapping, ALL_OBSERVERS, ALL_SOURCES, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast() (+24 more)

### Community 1 - "ParseError"
Cohesion: 0.11
Nodes (38): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 5: typeof x === 'string' is not validation, The signed-out page, and the positive marker it made possible, Shared parser primitives (src/core/parsing.ts), FieldResult, isInstant(), KeyGuard (+30 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (58): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+50 more)

### Community 3 - "UX plan for the store release"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (42): AgendaRow, agendaRows(), allTimed(), Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, attentionCount(), AttentionGroup (+34 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.11
Nodes (34): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified() (+26 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.10
Nodes (39): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+31 more)

### Community 8 - "schedule.ts"
Cohesion: 0.10
Nodes (33): I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, store-toast.png is a composite, not a screenshot, Defect: an exam already sat counted as Overdue, Review outcome — steps 9–12 (16 findings, 13 code defects), UX plan phases A–G (2026-09-12) (+25 more)

### Community 9 - "course-sites.ts"
Cohesion: 0.08
Nodes (29): displayCourseLabel(), CourseGroup, courseGroupsForYou(), courseKeysOf(), emptyCourseGroup(), finishGroup(), groupHasCourse(), Response (+21 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "messages.ts"
Cohesion: 0.12
Nodes (24): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+16 more)

### Community 12 - "options.ts"
Cohesion: 0.07
Nodes (35): What a student is told now, saveProposedAdapter(), adapterFromCandidate(), candidateNotes(), locatorDescription(), quote(), showMoreLabel(), shownCandidates() (+27 more)

### Community 13 - "month.ts"
Cohesion: 0.13
Nodes (31): BROKEN (1), G. Date navigator, L. Month view, dayKey(), startOfDay(), weekContents(), quietState, navFor() (+23 more)

### Community 14 - "popup.ts"
Cohesion: 0.08
Nodes (52): House rules from the ZIP acceptance pass, 2026-09-19, Structural decisions, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., The focus mechanism, as built, B. Header bar, E. Tabs and view state (+44 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.17
Nodes (24): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, menu, allThemeClasses(), ModeName, normalizeTweaks(), themeClass() (+16 more)

### Community 16 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.12
Nodes (26): Open: course sites split across pages, Open: Coursera for the online CS courses, Parallelism policy, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Trace the path, not just the file, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 5: log both branches of any decision the user will have to debug (+18 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.11
Nodes (22): Credit schedule in data-bs-content popover, second DOMParser pass, data-format-date JSON (ISO UTC + IANA tz) is the primary time source, parseDateAttribute(), parseDateRangeAttribute(), SOURCE_ORIGIN, sourceForUrl(), textOf(), cardFor() (+14 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "Gradescope source (§4.2, HTML)"
Cohesion: 0.13
Nodes (26): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 6: match markers exactly and scope them to the smallest element, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Never-signed-in detection for Gradescope and PrairieTest, Review outcome — Gradescope (12 findings, 11 fixed) (+18 more)

### Community 20 - "site.ts"
Cohesion: 0.06
Nodes (58): 3. Where the date comes from, How the date is read out of the located text, 3. Where the date comes from, How the date is read out of the located text, The lectures page, and why it is a fixture and not an entry, What `clauses` reads, on both pages, AdapterDate, ClauseDate (+50 more)

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
Cohesion: 0.07
Nodes (41): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Before-submitting checklist (G5) (+33 more)

### Community 25 - "piazza.test.ts"
Cohesion: 0.10
Nodes (26): bodyBatch, currentTermKey(), highestNr(), MAX_BODIES_PER_SYNC, ObservedPost, PIAZZA_LOGIN_GRACE, PIAZZA_MATCH, PIAZZA_READER_VERSION (+18 more)

### Community 26 - "gcalPush"
Cohesion: 0.16
Nodes (15): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Decisions worth not re-litigating, Google Calendar sync, Looking at it without a Google account, The design, What it costs (+7 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (62): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+54 more)

### Community 28 - "piazza.ts"
Cohesion: 0.08
Nodes (28): Amendment (2026-09-18): three ways one field cost a whole class, CAMPUSWIRE_ORIGIN, ANY_TAG, BLOCK_TAG, BodyAttempt, CLASS_LIST_MAX_AGE_MS, ClassPage, ClassPageKind (+20 more)

### Community 29 - "makeRowsNavigable"
Cohesion: 0.09
Nodes (23): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item (+15 more)

### Community 30 - "deadline.ts"
Cohesion: 0.09
Nodes (52): 6. Checked and clean, L8 — `openedFrom` survives a screen the tab change discarded., Important files to resume from, Interaction review: four product findings and one harness gap, The repair batch: 1–7 done, 8–10 running, N. Attention view and suggestions, courseColours(), coursesIn() (+44 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.15
Nodes (16): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script, options.html: Settings page (+8 more)

### Community 32 - "background.ts"
Cohesion: 0.11
Nodes (34): House rules for the worker and the loop, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, W. What lives in Options, not the popup, Defect: the store queue deadlocked, applyObserver(), applySettings(), deps, ensureObservers() (+26 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.05
Nodes (44): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Remote code: No (+36 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.14
Nodes (29): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, Row menu (⋯), applyOverride(), acceptSuggestion(), applyDueOverride() (+21 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.12
Nodes (22): ALL_GCAL_STATES, classifyAuthFailure(), describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState() (+14 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "grouping.ts"
Cohesion: 0.14
Nodes (20): 7. Health, notifications, calendar, 4. Timezone results, clockOf(), countdown(), creditPercentFor(), creditWindowText(), dayOf(), daysAway() (+12 more)

### Community 38 - "detect.ts"
Cohesion: 0.08
Nodes (43): AdapterIdentity, byRank(), candidatesFoundLine(), cellOf(), CLAUSE_SEPARATORS, clocksIn(), Column, dedupe() (+35 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.08
Nodes (22): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+14 more)

### Community 42 - "locateDue"
Cohesion: 0.15
Nodes (25): A selector the page has not got is refused before the runner, And the deterministic proposer reads the whole page itself, Checking the three lines without a model, Every group now says how much of it is dated, One session per attempt, and what `kErrorUnknown` meant, Running it without a browser, The attempt line says what the model emitted, The context window (+17 more)

### Community 43 - "health.ts"
Cohesion: 0.06
Nodes (80): 9.3 The four screens, Notes on items classified PRESERVED that moved, M8 — The setup screen's "Connected" chip outranks the source's current state., B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover, P. Empty and error states, Z. Test files that pin popup behaviour (+72 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "screens/editor.ts"
Cohesion: 0.12
Nodes (38): 4. Cross-worker seam checks, L5 — Two round trips with no popup-side log line, and one with no caption., Contents, D. Banners, I. The row menu, K. Week view, M. Exams view, O. The editor (manual items) (+30 more)

### Community 46 - "linkedom"
Cohesion: 0.16
Nodes (21): linkedom, isDataRow(), isFreeRow(), locatorEvidence, precedingTag(), cellAt(), columnOf(), directCells() (+13 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.16
Nodes (19): Decision 6: snooze amends §7's daily booking nag, I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I13 · Reminder toasts with Open / Snooze / Done buttons, I19 · Per-sync change log strip (+11 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.15
Nodes (22): call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), FetchLike, GcalError, GcalFailure (+14 more)

### Community 49 - "gradescope.ts"
Cohesion: 0.11
Nodes (22): isOlderThan(), parseGradescopeDateTime(), shortHash(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN (+14 more)

### Community 50 - "Piazza fixtures"
Cohesion: 0.33
Nodes (5): class-page-signed-out.html — `GET https://piazza.com/class/<nid>` (signed OUT), feed.json — `POST https://piazza.com/logic/api?method=network.get_my_feed`, Piazza fixtures, post.json — `POST https://piazza.com/logic/api?method=content.get`, post-running.json — `POST …?method=content.get`, a note that states a deadline

### Community 51 - "capture.ts"
Cohesion: 0.18
Nodes (16): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), countOccurrences() (+8 more)

### Community 52 - "gcal.ts"
Cohesion: 0.14
Nodes (23): B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, calendarDate(), calendarDayAfter(), GCAL_TIMEZONE, describeSources(), diffEvents(), diffSize(), EVENT_MINUTES (+15 more)

### Community 53 - "shell.ts"
Cohesion: 0.06
Nodes (58): M6 — `closeMenus` strips the pill's `aria-expanded` on **every** document click, including when nothing is open., A. Document shell and load-time behaviour, F. Course filter chips, actionOutcome, UNEXPLAINED_REFUSAL, OverrideAction, appMark(), bookMark() (+50 more)

### Community 54 - "RawItem"
Cohesion: 0.20
Nodes (22): The inventory sketches one row's insides, 5. Checked and clean, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput (+14 more)

### Community 55 - "renderOptions"
Cohesion: 0.22
Nodes (19): clearRemoval(), el(), stateChip(), gcalSection(), hasOrigin(), observerRow(), offersValue(), pendingUndo() (+11 more)

### Community 56 - "scrub.ts"
Cohesion: 0.20
Nodes (10): Report this page to Illini Dash (right-click, scrubbed file), escapeRegex(), BASE_RULES, Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult (+2 more)

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
Nodes (21): answer(), bands(), document, globals, gridHues(), hueOf(), items, keydown() (+13 more)

### Community 61 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (23): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Dev loop gotchas (+15 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (52): House rules for the on-device model, What the student is told, attemptCount(), AttemptInfo, attemptLogLine(), AuthorOptions, AuthorOutcome, AuthorPage (+44 more)

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
Cohesion: 0.14
Nodes (16): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: signing in changed nothing until Sync was pressed, Defect: a Gradescope course labelled stat_425_120248_268442, The one source with no login page (course sites) (+8 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.15
Nodes (15): I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I60 · Page-aware popup: this course first, focus tab, auto-resync, I62 · Practice / not-for-credit tagging and demotion (+7 more)

### Community 68 - "theme.ts"
Cohesion: 0.18
Nodes (19): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName(), isThemeName(), MODE_KEY (+11 more)

### Community 69 - "cellByHeader"
Cohesion: 0.13
Nodes (19): House rules for mutation checks, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo) (+11 more)

### Community 71 - "Campuswire — findings"
Cohesion: 0.25
Nodes (7): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source

### Community 72 - "suggest.ts"
Cohesion: 0.17
Nodes (22): What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), Amendment (2026-09-18): a cross-listed class matched none of the student's rows, Amendment (2026-09-18): "EOD" in front of a calendar date read as nothing at all, Amendment (2026-09-18): what the first seven live suggestions said, The fixture's scrub was broken, and is repaired, describeEmpty(), extractCourseCode(), alreadySuggested() (+14 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.17
Nodes (15): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, emptyGcal(), emptyStore() (+7 more)

### Community 74 - "syncSites"
Cohesion: 0.20
Nodes (13): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, I17 · Health-aware popup empty state; no green dot before success, Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, #status: errors only, hidden otherwise, defaultStatus() (+5 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.12
Nodes (23): Roadmap ideas (88 ranked gaps), Decision 5: campus rows without a course, Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 4: manual deadline entry, aggregator or planner, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I21 · Manual deadlines as a sixth 'manual' source (+15 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.10
Nodes (50): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+42 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.16
Nodes (17): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold (+9 more)

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
Cohesion: 0.23
Nodes (13): STUDENT_POST_ID, assumedTimeNote(), dateOrigin, HEADING, isStudentsOwn(), movedHeading(), movedRange(), OWN_TIME_NOTE (+5 more)

### Community 87 - "The colour layer"
Cohesion: 0.18
Nodes (20): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+12 more)

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

### Community 93 - "3. Findings, ranked"
Cohesion: 0.09
Nodes (29): The row menu bug — found and fixed 2026-09-18, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 7. The single cheapest standing check, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape)., L1 — `needs-you.ts:108` writes `".menu-surface"` out by hand., L2 — Opening a screen moves focus nowhere. (+21 more)

### Community 97 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 98 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 99 - "sync.ts"
Cohesion: 0.11
Nodes (28): Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, dedupeInput(), backoffMinutes(), inBackoff(), nextAttemptAt() (+20 more)

### Community 100 - "isItemDone"
Cohesion: 0.22
Nodes (20): Defect: finished work with a late window open appeared nowhere, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups(), bandInstant(), dayContents, isFinished(), isPast() (+12 more)

### Community 101 - "SyncDeps"
Cohesion: 0.25
Nodes (8): fetchAll(), NeedsLogin, syncCanvas(), SyncDeps, syncGradescope(), syncPrairieLearn(), syncPrairieTest(), syncSmartPhysics()

### Community 102 - "piazzaRun"
Cohesion: 0.16
Nodes (18): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, The two re-read lines now count the same thing, asJson(), piazzaBody(), piazzaRun(), piazzaToken(), piazzaTrigger(), pool() (+10 more)

### Community 103 - "2. Findings, ranked"
Cohesion: 0.12
Nodes (16): 1. Counts, 2. Findings, ranked, 6. The one standing check worth adding, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, L14 — the suite pins no timezone, and one test defeats itself outside Chicago (+8 more)

### Community 104 - "row-order.test.ts"
Cohesion: 0.11
Nodes (12): document, globals, items, now, opened, popup, Rule, shape() (+4 more)

### Community 105 - "StoreV1Plus"
Cohesion: 0.46
Nodes (4): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (22): Parser rule 4: guard duplicate sourceIds on one page, Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Review outcome — PrairieTest (12 findings, all survived), Tier 0a (2026-09-10, 13 items), Repo layout: worker is wiring, decisions live in core/, Daily booking nag, §0.5 Chrome only (+14 more)

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
Cohesion: 0.05
Nodes (55): 0. Is it even an adapter?, 1. The capture, 2. The schema, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), 0. Is it even an adapter?, 1. The capture (+47 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "announce.test.ts"
Cohesion: 0.24
Nodes (7): Mention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read(), unreadable()

### Community 114 - "detect.test.ts"
Cohesion: 0.20
Nodes (11): 4. The date grammar, 4. The date grammar, noCandidateReason(), proposeCandidates(), statedTimeInText(), supportedDateFormats(), timeLikeTail(), pairsOf() (+3 more)

### Community 116 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 117 - "types.ts"
Cohesion: 0.21
Nodes (11): 2. Data model, checkOne(), collapse(), GATE0_TARGETS, Gate0Result, Gate0Target, LOGIN_URL_MARKERS, runGate0() (+3 more)

### Community 118 - "popup.html: the popup and full view document"
Cohesion: 0.12
Nodes (20): I03 · Toolbar badge: today's count, red ! when a source is broken, I16 · Honest status line and stale-data banner, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #page-sub: version, last check, sources answered (+12 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 121 - "suggest.test.ts"
Cohesion: 0.23
Nodes (12): AUTO_MOVE_CONFIDENCE, ObservedPost, demoPost(), fixture(), input(), item(), items(), member() (+4 more)

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
Nodes (11): COURSE_KEYS, Entry, globals, Mod, nameOf(), NOTHING, page, REGISTRY (+3 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` has no entry on purpose, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "Auto-merge rule (§5.3)"
Cohesion: 0.13
Nodes (29): When live data contradicts a document: rewrite the claim, Review policy, Chrome Web Store submission (draft, not submitted), Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Open full view reuses one tab, Review outcome — dedupe + sync (16 findings, 7 code defects) (+21 more)

### Community 134 - "Piazza — what the live client actually does (2026-09-18)"
Cohesion: 0.18
Nodes (10): Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19), The feed's shapes, as captured, What the term rule is, and why `status` is not it, What was captured (the parser is written against these), PiazzaClass (+2 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "Illini Dash — design as built"
Cohesion: 0.10
Nodes (20): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+12 more)

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
Cohesion: 0.09
Nodes (37): EmptyReason, ReadMention, ASSUMED_HOUR, CAMPUSWIRE_MATCH, classCodeFromPath(), isClassFeed(), ObservedPost, ObserverFacts (+29 more)

### Community 141 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 142 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 143 - "What the two stages read, and the scorecard over the real feed"
Cohesion: 0.22
Nodes (11): Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock, Amendment (2026-09-18): `lastNr` may not run past a post nobody read, Amendment (2026-09-18): the anchor is the version that was read, Amendment (2026-09-18): `type: "note"` is not "staff wrote it", Amendment (2026-09-18): which feed field says a post was edited, What the two stages read, and the scorecard over the real feed, editedSinceSeen() (+3 more)

### Community 144 - "build.mjs"
Cohesion: 0.28
Nodes (8): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), setup(), watch, esbuild

### Community 145 - "vitest"
Cohesion: 0.18
Nodes (5): vitest, html, visible, { document, window }, globals

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 148 - "3. Mutation table"
Cohesion: 0.27
Nodes (10): 3. Mutation table, M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, doneLast(), monthCells(), monthDots(), noDateCount(), noDateGroups(), overdueItems() (+2 more)

### Community 149 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): ref_node_fs_promises, blockers, counts, { html, report }, [input, output, ...rest]

### Community 150 - "preview-acceptance.test.ts"
Cohesion: 0.29
Nodes (4): ref_node_crypto, referenceItems(), globals, popup

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "createStoreQueue"
Cohesion: 0.24
Nodes (6): Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, createStoreQueue(), QueueOptions, SLOW_HOLD_MS, StoreQueue, io()

### Community 153 - "9.2 The five tabs"
Cohesion: 0.33
Nodes (6): 9.2 The five tabs, Exams — everything you have to turn up to, Month — two drawings of one month, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards

### Community 154 - "Amendment (2026-09-18, evening): the fetch plan after the trace"
Cohesion: 0.25
Nodes (9): Amendment (2026-09-18, evening): the fetch plan after the trace, applyPiazzaResult(), cappedLastNr(), classPageAttempts(), feedSignedOut(), piazzaNeedsRecheck(), PiazzaResult, readClassList() (+1 more)

### Community 156 - "I08 · Local Done check-off, separate from Hide"
Cohesion: 0.22
Nodes (9): I08 · Local Done check-off, separate from Hide, Theme: two sources can never say done, Canvas fixtures provenance, assignments-cs425.json (real, 1 undated row), courses-active.json (real, 2026-09-03, 3 courses), planner-items-empty.json (real, genuinely []), planner-items.json (real, 2026-09-10, one dated row), planner-items-SYNTHETIC.json (hand-written, not a capture) (+1 more)

### Community 159 - "4. Measurements"
Cohesion: 0.33
Nodes (6): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.4 Tokens, 4.5 The sizing invariants, 4. Measurements

### Community 161 - "local-adapters.test.ts"
Cohesion: 0.22
Nodes (7): 4. Course-site adapters, guessCourseCode(), localAdapterId(), withLocalAdapter(), withoutLocalAdapter(), VALID, adapter()

### Community 162 - "piazzaClasses"
Cohesion: 0.33
Nodes (6): class-page.html — `GET https://piazza.com/class/<nid>` (signed in), piazzaClasses(), classifyClassPage(), classPageUrl(), hasLoginForm(), PiazzaNeedsLogin

### Community 163 - "course-colour.test.ts"
Cohesion: 0.29
Nodes (6): COURSE_COLOURS, BLOCKS, CLASSICAL, POPUP, UI, USED

### Community 164 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 165 - "Sushi's time is the scarce resource"
Cohesion: 0.50
Nodes (4): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light or dark is a setting (is-dark class)

### Community 166 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 167 - "exams-verified.test.ts"
Cohesion: 0.83
Nodes (3): booked(), exam(), member()

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
- **862 isolated node(s):** `watch`, `buildId`, `options`, `observerOptions`, `name` (+857 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1043 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `ParseError` connect `ParseError` to `Piazza — what the live client actually does (2026-09-18)`, `prairielearn.ts`, `Illini Dash — design as built`, `messages.ts`, `core/campuswire.ts`, `What the two stages read, and the scorecard over the real feed`, `prairietest.ts`, `canvas.ts`, `site.ts`, `piazza.test.ts`, `Amendment (2026-09-18, evening): the fetch plan after the trace`, `announce.ts`, `piazza.ts`, `background.ts`, `core/registry.ts`, `detect.ts`, `gradescope.ts`, `author.ts`, `needs_login detection`, `suggest.ts`, `syncSites`, `skeleton.ts`, `sync.ts`, `SyncDeps`, `announce.test.ts`, `types.ts`, `suggest.test.ts`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `ParseError`, `store.ts`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `page-url.ts`, `core/campuswire.ts`, `popup.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `observer-ui.ts`, `icon`, `preview-acceptance.test.ts`, `piazza.test.ts`, `createStoreQueue`, `piazza.ts`, `deadline.ts`, `local-adapters.test.ts`, `core/registry.ts`, `course-colour.test.ts`, `gcal-auth.ts`, `grouping.ts`, `overrides.test.ts`, `exams-verified.test.ts`, `compat.ts`, `health.ts`, `linkedom`, `gcal-client.ts`, `gradescope.ts`, `capture.ts`, `gcal.ts`, `shell.ts`, `RawItem`, `scrub.ts`, `tokens.test.ts`, `popup-draw.test.ts`, `author.ts`, `ics.ts`, `piazza-real.test.ts`, `theme.ts`, `diagnostics.ts`, `skeleton.ts`, `provenance.test.ts`, `sync.ts`, `row-order.test.ts`, `announce.test.ts`, `detect.test.ts`, `types.ts`, `suggest.test.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `validateRegistry()` connect `core/registry.ts` to `background.ts`, `Tier 0b: beta prerequisites that need Sushi`, `Roadmap ideas (88 ranked gaps)`, `validateAdapter`, `Adapter registry (bundled + daily GitHub refresh)`, `detect.test.ts`, `Chrome Web Store listing draft (§9 G5)`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._