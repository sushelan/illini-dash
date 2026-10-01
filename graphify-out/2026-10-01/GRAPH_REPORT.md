# Graph Report - illini-due  (2026-10-01)

## Corpus Check
- 288 files · ~1,220,094 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 21 file(s) not represented in the graph (top: .css 13, (none) 6, .woff2 2)

## Summary
- 3689 nodes · 9931 edges · 171 communities (159 shown, 12 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 913 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cba0e289`
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
- core/registry.ts
- manifest.json
- types.ts
- options.ts
- health.ts
- The colour layer
- Tier 1: highest value after the beta, no spec change
- background.ts
- prairietest.ts
- canvas.ts
- sourcesToRecheck
- site.ts
- support.js
- screens/editor.ts
- popup/rows.ts
- Chrome Web Store listing draft (§9 G5)
- sync.ts
- UX plan for the store release
- announce.ts
- piazza.ts
- needs_login detection
- devDependencies
- options.html: Settings page
- theme.test.ts
- renderOptions
- overrides.test.ts
- gcal-auth.ts
- classical_vellum_journal/DESIGN.md
- scrub-file.mjs
- detect.ts
- compilerOptions
- announce-real.test.ts
- preview-data.ts
- CS/ECE 374 A (FA 2026) — what the pages actually say
- screens/setup.ts
- ref_node_path
- 3. Mutation table
- suggest.ts
- Tier 0a: make what exists trustworthy
- gcal-client.ts
- gcal.ts
- normalize.ts
- queue.ts
- Item
- shell.ts
- manual.ts
- 9. UI
- scrub.ts
- Gradescope fixtures provenance
- What You Must Do When Invoked
- Source
- popup-draw.test.ts
- Classical Calendar — previous alignment measurements (2026-09-19)
- author.ts
- observer-ui.ts
- course-colour.test.ts
- focus.ts
- ics.ts
- Tier 0b: beta prerequisites that need Sushi
- theme-panel.ts
- popup.ts
- Campuswire fixtures
- Mutation check
- detect.test.ts
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
- Auto-merge rule (§5.3)
- Tracing a symptom along a runtime path
- The design
- sync.test.ts
- compat.ts
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
- 9.2 The five tabs
- CS 341 (fa26) — course site findings
- gcal-lane.ts
- popup-clearance.test.ts
- deadline.ts
- vitest
- store.test.ts
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
- describeEmpty
- ui-acceptance.mjs
- propose.mjs
- SyncDeps
- local-adapters.test.ts
- held-press.mjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- options-dom.test.ts
- Asking Sushi for a browser action
- `fixtures/sites/` — the course pages the §4.5 runner is tested against
- graphify reference: GitHub clone and cross-repo merge
- .agents/skills/graphify/references/extraction-spec.md
- syncSites
- Z. Test files that pin popup behaviour
- shots.mjs
- ui-acceptance.test.mjs
- site.mjs
- alerts.ts
- page-url.ts
- core/campuswire.ts
- sync-gate.ts
- icons.mjs
- build.mjs
- package.json
- Sync loop runSync (§6)
- Defect: a Gradescope course labelled stat_425_120248_268442
- Sushi's time is the scarce resource
- Google Stitch prompt — Illini Dash popup
- exams-verified.test.ts
- makeRowsNavigable
- Adapter registry (bundled + daily GitHub refresh)
- graphify reference: transcribe video and audio
- UX plan phases A–G (2026-09-12)
- smartPhysics `/Course/Calendar` — findings, 2026-09-21
- PROGRESS.md — what is done, which gate, what is blocked
- ui-browser.mjs
- Issue tracker: GitHub
- piazza-real.test.ts
- capture.ts
- tokens.test.ts
- Domain Docs
- .query
- /graphify
- /graphify
- UI acceptance reference contract
- graphify reference: query, path, explain
- Per-source backoff
- 4. Measurements
- offscreen.html: DOMParser host for the service worker
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
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `No date — listed somewhere, dated nowhere` --references--> `attentionGroups()`  [INFERRED]
  DESIGN.md → src/core/calendar.ts
- `Deliberately replaced (must be listed in PROGRESS.md and the inventory)` --references--> `examCount()`  [INFERRED]
  docs/design/brief.md → src/core/calendar.ts

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

## Communities (171 total, 12 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.14
Nodes (29): 8. Storage, isOlderThan(), TITLE_NAME_MAX, isInstant(), ALL_OBSERVERS, BACKOFF_MINUTES, FETCHED_SOURCES, foundAlreadyPast() (+21 more)

### Community 1 - "ParseError"
Cohesion: 0.11
Nodes (36): House rules for parsers, Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived), Shared parser primitives (src/core/parsing.ts), FieldResult (+28 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Installing Illini Dash (beta)"
Cohesion: 0.14
Nodes (22): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, No server: everything stored locally, uninstall deletes all, Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines), Rows say 'time not given' rather than inventing a time, Dev loop gotchas (+14 more)

### Community 4 - "calendar.ts"
Cohesion: 0.07
Nodes (51): M8 — every student-typed date is built in `SITE_TIMEZONE`; every view buckets it in the browser's zone, K. Week view, AgendaRow, allTimed(), Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, AttentionName (+43 more)

### Community 5 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, icons, package, pretest, preview, propose, scrub (+7 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.12
Nodes (28): M5 — a `set-due` outranks every later source date, for ever, with nothing on screen to say the source now disagrees, I40 · CBTF reservation-window escalation and missed-reservation notice, applyRetention(), badgesOf(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus() (+20 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.09
Nodes (41): A survivor has three meanings — decide which before acting, Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDateBody(), DAYS_IN_MONTH, inferYear(), isNoEndMarker() (+33 more)

### Community 8 - "schedule.ts"
Cohesion: 0.08
Nodes (50): I38 · Coalesce catch-up reminder bursts, word by real remaining time, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, ALARM_BUDGET, alarmName(), applySnooze(), armable(), BOOKING_HOUR (+42 more)

### Community 9 - "core/registry.ts"
Cohesion: 0.06
Nodes (45): I57 · Term rollover: term dates in the registry, Expired section, ADAPTER_KINDS, AdapterStanding, CourseGroup, courseGroupsForYou(), courseKeysOf(), coursePagesLayout, currentTermCode() (+37 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+27 more)

### Community 11 - "types.ts"
Cohesion: 0.09
Nodes (37): Proposal, Candidate, ManualInput, ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml() (+29 more)

### Community 12 - "options.ts"
Cohesion: 0.05
Nodes (47): MAX_POLL_MINUTES, MIN_POLL_MINUTES, STORAGE_KEY, downloadFile(), downloadIcs(), itemsToExport(), addSiteButton, addSiteUrl (+39 more)

### Community 13 - "health.ts"
Cohesion: 0.07
Nodes (63): 9.3 The four screens, Structural decisions, M8 — The setup screen's "Connected" chip outranks the source's current state., 6. The one standing check worth adding, B1 — `footerLine` has no caller. The footer that ships is a second copy, and it paints green over sources that were never read, B2 — `needsYouPill` says "All clear", in green, while three of four sources have never been read, L12 — `compactAgo` is dead, and D10's "synced 2m ago" is not what ships, C. Health pill and source popover (+55 more)

### Community 14 - "The colour layer"
Cohesion: 0.16
Nodes (22): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+14 more)

### Community 15 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.13
Nodes (19): Decision 5: campus rows without a course, Decision 4: manual deadline entry, aggregator or planner, I03 · Toolbar badge: today's count, red ! when a source is broken, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I24 · Registrar deadlines as shipped campus rows (+11 more)

### Community 16 - "background.ts"
Cohesion: 0.07
Nodes (58): House rules for the worker and the loop, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Decisions worth not re-litigating, W. What lives in Options, not the popup, I27 · 'Can reminders reach you?' check and test-reminder button, Defect: the store queue deadlocked, allAdapters() (+50 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.12
Nodes (20): parseDateAttribute(), parseDateRangeAttribute(), SOURCE_ORIGIN, sourceForUrl(), textOf(), cardFor(), EMPTY_CARD, examKey() (+12 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (19): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses(), isLoginResponse() (+11 more)

### Community 19 - "sourcesToRecheck"
Cohesion: 0.12
Nodes (27): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: signing in changed nothing until Sync was pressed, Export .ics moved to the bar, Never-signed-in detection for Gradescope and PrairieTest (+19 more)

### Community 20 - "site.ts"
Cohesion: 0.05
Nodes (84): House rules for mutation checks, A survivor sometimes indicts the design, 4. The date grammar, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, 4. The date grammar, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex) (+76 more)

### Community 21 - "support.js"
Cohesion: 0.06
Nodes (75): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+67 more)

### Community 22 - "screens/editor.ts"
Cohesion: 0.08
Nodes (43): L5 — Two round trips with no popup-side log line, and one with no caption., D. Banners, O. The editor (manual items), createEditor(), Editor, EDITOR_CLASS, EDITOR_SELECTOR, EDITOR_TITLE_ID (+35 more)

### Community 23 - "popup/rows.ts"
Cohesion: 0.07
Nodes (59): setup(), Y. Every DOM id and class the popup writes, startOfDay(), examDetail(), movedText(), assumedTimeNote(), DATE_FLAGS, qualityFlags() (+51 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.07
Nodes (39): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+31 more)

### Community 25 - "sync.ts"
Cohesion: 0.12
Nodes (23): I59 · Lift backoff and resync immediately on extension update, Defect: source Off but its rows still on the calendar, dedupeInput(), inBackoff(), AdapterOutcome, adapterPrefix(), applySync(), FetchedPage (+15 more)

### Community 26 - "UX plan for the store release"
Cohesion: 0.16
Nodes (24): Header health dots: grey/green/yellow/red, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+16 more)

### Community 27 - "announce.ts"
Cohesion: 0.04
Nodes (60): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, BADGE_WORD, badgeIn(), BOUNDARY, CAL_MONTH (+52 more)

### Community 28 - "piazza.ts"
Cohesion: 0.04
Nodes (94): Amendment (2026-09-18, corrected 2026-09-19): the reader version, and posts read at their snippets, Amendment (2026-09-18, evening): the fetch plan after the trace, Amendment (2026-09-18): which feed field says a post was edited, Amendment (2026-09-19): the announcement is not the row's name, Authentication: the session cookie, echoed as a header, Discovery: the class list is in the class page, not in the JWT, Piazza — what the live client actually does (2026-09-18), Policy: classmate-written pinned notes are ignored (Sushi, 2026-09-19) (+86 more)

### Community 29 - "needs_login detection"
Cohesion: 0.17
Nodes (15): Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption), §0.2 No credential handling (+7 more)

### Community 30 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, esbuild, linkedom, @types/chrome, @types/node, typescript, vitest

### Community 31 - "options.html: Settings page"
Cohesion: 0.08
Nodes (31): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), Reporting a broken page uploads nothing, PII and authentication not collected, #back plain link to popup.html?view=full (+23 more)

### Community 32 - "theme.test.ts"
Cohesion: 0.18
Nodes (19): DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, DEFAULT_TWEAKS, DESIGN, isModeName(), isThemeName(), MODE_KEY (+11 more)

### Community 33 - "renderOptions"
Cohesion: 0.14
Nodes (31): isSourceState(), el(), stateChip(), gcalSection(), observerRow(), readCourseSite(), refreshOptions(), renderCandidates() (+23 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.11
Nodes (37): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, 2. Data model, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Defect: the row menu opened below the fold in week view, memberKey = source:sourceId (+29 more)

### Community 35 - "gcal-auth.ts"
Cohesion: 0.20
Nodes (13): ALL_GCAL_STATES, describeGcal(), GcalDescription, GcalEvent, GcalFacts, GcalState, isGcalState(), isGoogleAccount() (+5 more)

### Community 36 - "classical_vellum_journal/DESIGN.md"
Cohesion: 0.07
Nodes (27): 1. Buttons, 1. The Parchment Plate Hierarchy, 2. Cards & Folio Panes, 2. Debossed Rules & Inset Engravings, 3. Notebook Lines & Inputs, 3. Tactile Hardware Accents, 4. Checkboxes & Task Trackers, 5. Chips & Marginalia Tags (+19 more)

### Community 37 - "scrub-file.mjs"
Cohesion: 0.29
Nodes (5): esbuild, blockers, counts, { html, report }, [input, output, ...rest]

### Community 38 - "detect.ts"
Cohesion: 0.07
Nodes (58): AdapterIdentity, byRank(), cellOf(), CLAUSE_SEPARATORS, clocksIn(), Column, dedupe(), DetectedRow (+50 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "announce-real.test.ts"
Cohesion: 0.22
Nodes (8): EmptyReason, ReadMention, PostPayload, EMPTY, Expected, HTML, mentionsOf(), POSTS

### Community 41 - "preview-data.ts"
Cohesion: 0.07
Nodes (24): adapters, courses, dataset, gcalState, item(), itemOfManual(), items, listeners (+16 more)

### Community 42 - "CS/ECE 374 A (FA 2026) — what the pages actually say"
Cohesion: 0.20
Nodes (9): Amendments to SPEC.md, CS/ECE 374 A (FA 2026) — what the pages actually say, One defect this page found, The clock is stated once, in prose, above the list, The page shape: the date is the row's previous sibling, Three pages, two adapters, `titleBefore` and the link, What the entries do **not** read (+1 more)

### Community 43 - "screens/setup.ts"
Cohesion: 0.09
Nodes (43): toneOf(), fullStamp(), LOGIN_URL, nameList(), SOURCE_CODE, SOURCE_HINT, SOURCE_HOME, SOURCE_NAME (+35 more)

### Community 44 - "ref_node_path"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 45 - "3. Mutation table"
Cohesion: 0.13
Nodes (21): REPLACED-RECORDED (49), L7 — The No date tab's badge tooltip contradicts D3 and its own comment., 2. Findings, ranked, 3. Mutation table, 4. Timezone results, L10 — `applyOverride` logs the two counters a `set-due` cannot change, and not the one it can, L11 — `"attention"` survives in the popup's view table, with a comment asserting it still has a tab, L14 — the suite pins no timezone, and one test defeats itself outside Chicago (+13 more)

### Community 46 - "suggest.ts"
Cohesion: 0.12
Nodes (29): Amendment (2026-09-18): what the first seven live suggestions said, normalizeTitle(), alreadySuggested(), AUTO_MOVE_CONFIDENCE, courseOf(), describePost(), IngestOptions, ingestPost() (+21 more)

### Community 47 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.15
Nodes (21): I01 · Deadline moved / new markers, notification, reminder re-arm, I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I31 · Surface parser data-quality flags instead of dropping rows (+13 more)

### Community 48 - "gcal-client.ts"
Cohesion: 0.11
Nodes (27): accountOf(), call(), classifyStatus(), createCalendar(), deleteCalendar(), deleteEvent(), fetchAccount(), FetchLike (+19 more)

### Community 49 - "gcal.ts"
Cohesion: 0.16
Nodes (20): calendarDate(), calendarDayAfter(), describeSources(), diffSize(), EVENT_MINUTES, EventDiff, EventTime, hashEvent() (+12 more)

### Community 50 - "normalize.ts"
Cohesion: 0.18
Nodes (10): Mention, SUBJECT_WORDS, UnreadableMention, FILLER, NUMBERED_PREFIX, SYNONYMS, FIXTURES, only() (+2 more)

### Community 51 - "queue.ts"
Cohesion: 0.33
Nodes (3): QueueOptions, SLOW_HOLD_MS, StoreQueue

### Community 52 - "Item"
Cohesion: 0.11
Nodes (29): L13 — two of PROGRESS's four "survivors" are equivalent mutants, which is a different fact, AttentionGroup, PlacedItem, DedupeOptions, opensAt(), clockOf(), creditPercentFor(), creditWindowText() (+21 more)

### Community 53 - "shell.ts"
Cohesion: 0.06
Nodes (46): E. Tabs and view state, F. Course filter chips, OverrideAction, IconName, FocusRequest, ANNOUNCE_ID, announced, Banner (+38 more)

### Community 54 - "manual.ts"
Cohesion: 0.21
Nodes (21): The inventory sketches one row's insides, 5. Checked and clean, B3 — "Give it a date" accepts any year the regex allows; a wrong one removes the row from every tab, and the Undo is only reachable from the row, ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS (+13 more)

### Community 55 - "9. UI"
Cohesion: 0.25
Nodes (8): 9.1 The shell, 9.4 A row, 9.5 The options page, 9.6 The 600px ceiling, 9.7 A message is data from another build, 9.8 Interaction, 9.9 Appearance, 9. UI

### Community 56 - "scrub.ts"
Cohesion: 0.17
Nodes (11): Report this page to Illini Dash (right-click, scrubbed file), BASE_RULES, MAPPED_RULES, MappedRule, Rule, scrubHtml(), ScrubOptions, ScrubReport (+3 more)

### Community 57 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.13
Nodes (15): Part A - Structural extraction for code files, Part B - Semantic extraction (parallel subagents), Part C - Merge AST + semantic into final extraction, Step 0 - GitHub repos and multi-path merge (only if a URL or several paths), Step 1 - Ensure graphify is installed, Step 2.5 - Video and audio (only if video files detected), Step 2 - Detect files, Step 3 - Extract entities and relationships (+7 more)

### Community 59 - "Source"
Cohesion: 0.22
Nodes (12): SourceRow, SourceOutcome, checkOne(), collapse(), GATE0_TARGETS, Gate0Result, Gate0Target, LOGIN_URL_MARKERS (+4 more)

### Community 60 - "popup-draw.test.ts"
Cohesion: 0.07
Nodes (28): announced(), bands(), document, entryNamed(), escape(), globals, gridHues(), hueOf() (+20 more)

### Community 61 - "Classical Calendar — previous alignment measurements (2026-09-19)"
Cohesion: 0.18
Nodes (10): 1. Tokens, 2. Shell, 3. Today, 4. Week, 5. Month, 6. No date, 7. Exams, Classical Calendar — previous alignment measurements (2026-09-19) (+2 more)

### Community 62 - "author.ts"
Cohesion: 0.06
Nodes (70): House rules for the on-device model, A selector the page has not got is refused before the runner, Checking the three lines without a model, One session per attempt, and what `kErrorUnknown` meant, The attempt line says what the model emitted, The context window, The manifest needs no new permission, The schema requires what the validator will demand (+62 more)

### Community 63 - "observer-ui.ts"
Cohesion: 0.13
Nodes (21): Evidence first, Honest completion, Illini UI acceptance, Six-stage execution, Piazza and Campuswire on the front, CAMPUSWIRE_ORIGIN, describeObserver(), observerRows() (+13 more)

### Community 64 - "course-colour.test.ts"
Cohesion: 0.29
Nodes (6): COURSE_COLOURS, BLOCKS, CLASSICAL, POPUP, UI, USED

### Community 65 - "focus.ts"
Cohesion: 0.12
Nodes (24): ControlRegion, ControlRequest, controlRequestFor(), DATE_NAV_CLASS, DATE_NAV_SELECTOR, DateNavControl, findControl(), findFocusTarget() (+16 more)

### Community 66 - "ics.ts"
Cohesion: 0.24
Nodes (14): buildIcs(), escapeIcsText(), event(), eventSummary(), ExportLeg, foldIcsLine(), googleCalendarUrl(), icsDate() (+6 more)

### Community 67 - "Tier 0b: beta prerequisites that need Sushi"
Cohesion: 0.16
Nodes (15): I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures, Tier 0b: beta prerequisites that need Sushi, Canvas fixtures provenance (+7 more)

### Community 68 - "theme-panel.ts"
Cohesion: 0.17
Nodes (24): Light/dark is the is-dark class, not a media query, Theme choice in localStorage (illini-dash.theme / illini-dash.mode), V. Theme and dark mode, menu, allThemeClasses(), ModeName, normalizeTweaks(), themeClass() (+16 more)

### Community 69 - "popup.ts"
Cohesion: 0.07
Nodes (57): House rules from the ZIP acceptance pass, 2026-09-19, R-3 — DEGRADED. A tweak changed in the Appearance panel does not repaint the list until the panel is dismissed, 5. R1's ten, re-checked, M3 — Pressing a tab while the editor screen is open is a dead control that silently rewrites the remembered tab., Important files to resume from, Interaction review: four product findings and one harness gap, The focus mechanism, as built, The repair batch: 1–7 done, 8–10 running (+49 more)

### Community 71 - "Mutation check"
Cohesion: 0.13
Nodes (12): Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code, Worked example (this repo), Always assert the match count, Mutation check (+4 more)

### Community 72 - "detect.test.ts"
Cohesion: 0.08
Nodes (33): And the deterministic proposer reads the whole page itself, Every group now says how much of it is dated, Running it without a browser, The inventory says which groups carry dates, and the search reads them, The retry names the groups that do carry dates, What a student is told now, adapterFromCandidate(), candidateNotes() (+25 more)

### Community 73 - "diagnostics.ts"
Cohesion: 0.16
Nodes (15): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), SourceDiagnostics, defaultStatus(), emptyGcal() (+7 more)

### Community 74 - "flows.ts"
Cohesion: 0.21
Nodes (10): Request, Response, applyChange(), ChangeUi, messageOf(), Answer, FlowUi, runFlow() (+2 more)

### Community 75 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.14
Nodes (19): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons (+11 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.09
Nodes (54): The summary has to show a list, not mention one, isHeaderRowOutsideTbody(), rowSelectorForList(), rowSelectorForTable(), selectorForTable(), ancestry(), anchorSelector(), answerableSelector() (+46 more)

### Community 77 - "Popup UI (§8.1)"
Cohesion: 0.21
Nodes (13): The popup is measured by Chrome, not sized by you, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the popup opened at 800×600 with the list in its left half, Defect: the sources panel was clipped, Defect: three dead redraw guards and a status line below the fold, npm run preview — the real popup over canned data (+5 more)

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

### Community 84 - "Auto-merge rule (§5.3)"
Cohesion: 0.35
Nodes (12): Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Build order (§10), Gate G2 — Recall, Gate G3 — Dedupe, Gate G4 — Beta (+4 more)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.12
Nodes (15): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path, 1. State the symptom as an observation (+7 more)

### Community 86 - "The design"
Cohesion: 0.17
Nodes (14): 1. The extension key → `public/manifest.json`, 2. The OAuth client → `oauth2.client_id`, 3. Then, in the browser, Google Calendar sync, Looking at it without a Google account, The design, What it costs, What Sushi has to do before this can run (+6 more)

### Community 87 - "sync.test.ts"
Cohesion: 0.10
Nodes (21): parseGradescopeDateTime(), shortHash(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes(), GRADESCOPE_ORIGIN, isLoginResponse() (+13 more)

### Community 88 - "compat.ts"
Cohesion: 0.20
Nodes (15): UI rule 2: every send() from a page needs a .catch, Worker rule 8: a message from the worker is data from another build, not a typed object, Course rename override (overrides.courseNames), Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState (+7 more)

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

### Community 98 - "Illini Dash ZIP UI acceptance handoff"
Cohesion: 0.11
Nodes (17): Baseline and candidate evidence, Chrome-only work still requiring Sushi, Definition of done for this request, Icons, Illini Dash ZIP UI acceptance handoff, Implementation completed in candidate 1, Independent review results, Objective and authority (+9 more)

### Community 99 - "9.2 The five tabs"
Cohesion: 0.40
Nodes (5): 9.2 The five tabs, Month — two drawings of one month, No date — listed somewhere, dated nowhere, Today — a schedule for the day, Week — seven day cards

### Community 100 - "CS 341 (fa26) — course site findings"
Cohesion: 0.33
Nodes (5): CS 341 (fa26) — course site findings, The trap on `/assignments`, The week prefix, What the search proposes, and why the registry entry is hand-written, What the site offers

### Community 101 - "gcal-lane.ts"
Cohesion: 0.29
Nodes (4): pool(), createGcalLane(), GcalLane, GcalOp

### Community 102 - "popup-clearance.test.ts"
Cohesion: 0.18
Nodes (15): 4.4 Tokens, allRules(), beats(), contrast(), declared(), over(), resolve(), rgb() (+7 more)

### Community 103 - "deadline.ts"
Cohesion: 0.09
Nodes (57): The row menu bug — found and fixed 2026-09-18, 4. Cross-worker seam checks, 1. Counts, 2. The new class: **a guard that asks another listener whether its own work is still undone**, 3. Findings, ranked, 6. Checked and clean, 7. The single cheapest standing check, L10 — `SUGGESTION_SOURCE[suggestion.source]` is unguarded (worker rule 8's shape). (+49 more)

### Community 104 - "vitest"
Cohesion: 0.04
Nodes (31): linkedom, ref_node_crypto, ref_node_fs, vitest, ref_vitest_config, referenceItems(), REGISTRY_URL, quick() (+23 more)

### Community 105 - "store.test.ts"
Cohesion: 0.40
Nodes (3): ALL_SOURCES, settleInterruptedPush(), V1

### Community 106 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 107 - "Illini Dash — design as built"
Cohesion: 0.14
Nodes (13): 10. Permissions, 11. Build and test, 12. Invariants, 13. Known open design questions, 1.1 Why an offscreen document, 1.2 Where decisions are allowed to live, 1. The shape of the thing, 3.1 Login detection needs the status (+5 more)

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
Nodes (49): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. Where the date comes from, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5), How the date is read out of the located text (+41 more)

### Community 112 - "Triaging a beta report"
Cohesion: 0.25
Nodes (7): 1. Quote the report verbatim, first, 2. Separate symptom from cause, and do not stop at the first cause, 3. Check the fixtures can even reach the state — they usually cannot, 4. Decide which log line would have answered it — and add it, 5. Gate failure, or ordinary fix?, 6. The PROGRESS.md entry, Triaging a beta report

### Community 113 - "StoreV1Plus"
Cohesion: 0.46
Nodes (4): StoreV1Plus, QueuedSyncIo, syncOnce(), SyncResult

### Community 114 - "validateRegistry"
Cohesion: 0.18
Nodes (11): Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Remote code: none — adapters are data, not code, Daily cookieless fetch of one public file on raw.githubusercontent.com (+3 more)

### Community 117 - "describeEmpty"
Cohesion: 0.10
Nodes (18): Amendments to the fixture README (house rule 9), Campuswire — findings, The like count is glued to the date, The noon assumption, What is read, and what is not, What the feed taught the grammar (found here, fixed the same night in `core/announce.ts`), What the first live sync taught the grammar (2026-09-18, Piazza — same module), Why this is an observer and not a source (+10 more)

### Community 119 - "ui-acceptance.mjs"
Cohesion: 0.28
Nodes (14): capture(), compare(), escape(), filesIn(), gallery(), init(), read(), root (+6 more)

### Community 120 - "propose.mjs"
Cohesion: 0.18
Nodes (10): args, { candidates, nearest }, { document }, FIELDS, input, manifest, reference, ROOT (+2 more)

### Community 122 - "SyncDeps"
Cohesion: 0.17
Nodes (14): Agenda (popup), Day grid (full view), Drag-to-add, J. Day view, fetchAll(), fetchChecked(), pooled(), SourceEmpty (+6 more)

### Community 123 - "local-adapters.test.ts"
Cohesion: 0.33
Nodes (4): 4. Course-site adapters, withLocalAdapter(), withoutLocalAdapter(), VALID

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
Nodes (16): Actions, COURSE_KEYS, Entry, Flows, globals, Mod, nameOf(), NOTHING (+8 more)

### Community 129 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 130 - "`fixtures/sites/` — the course pages the §4.5 runner is tested against"
Cohesion: 0.20
Nodes (9): Adding one, `cs374a-fa2026-calendar.html` is read for its exams and nothing else, `cs374a-fa2026-homeworks-adversarial.html`, `cs425-fa2026-assignments-adversarial.html`, `ece411-fa2026-assignments-dated.html`, `fixtures/sites/` — the course pages the §4.5 runner is tested against, The captures, The derived files, and every row that is invented in them (+1 more)

### Community 133 - "syncSites"
Cohesion: 0.17
Nodes (13): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: site: ok (0 items) was a lie, adapterFailureKind(), hostOf(), HttpStatusError, NeedsLogin (+5 more)

### Community 134 - "Z. Test files that pin popup behaviour"
Cohesion: 0.15
Nodes (28): N. Attention view and suggestions, Z. Test files that pin popup behaviour, Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, agendaRows(), anchorOf(), attentionCount() (+20 more)

### Community 135 - "shots.mjs"
Cohesion: 0.15
Nodes (9): ref_node_util, chrome, CHROME_CANDIDATES, designArg, dist, filter, run, SHOTS (+1 more)

### Community 136 - "ui-acceptance.test.mjs"
Cohesion: 0.27
Nodes (9): ref_node_assert_strict, ref_node_test, ref_node_url, ref_node_vm, captureMatrix(), checkRun(), evidenceExists(), STATES (+1 more)

### Community 137 - "site.mjs"
Cohesion: 0.23
Nodes (11): escape(), ESCAPES, inline(), manifest, out, page(), policy, render() (+3 more)

### Community 138 - "alerts.ts"
Cohesion: 0.14
Nodes (23): courseColours(), coursesIn(), postUrl(), timeNoteFor(), chromeTabs(), focusOrOpen(), OpenOutcome, pageKey() (+15 more)

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
Cohesion: 0.29
Nodes (7): buildId, copyStatic(), observerOptions, options, refuseConflictMarkers(), watch, ref_node_fs_promises

### Community 146 - "package.json"
Cohesion: 0.25
Nodes (7): name, private, type, version, @types/chrome, @types/node, typescript

### Community 147 - "Sync loop runSync (§6)"
Cohesion: 0.16
Nodes (19): Parser rule 7: RawItem.url is https on the source origin or the fallback, Tier 0a (2026-09-10, 13 items), Repo layout: worker is wiring, decisions live in core/, §0.5 Chrome only, §0.3 Parsers fail loudly, Per-source health indicator, Item, Notifications (§7) (+11 more)

### Community 148 - "Defect: a Gradescope course labelled stat_425_120248_268442"
Cohesion: 0.38
Nodes (7): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Defect: a Gradescope course labelled stat_425_120248_268442, The one source with no login page (course sites), Course code extraction (§5.1)

### Community 150 - "Sushi's time is the scarce resource"
Cohesion: 0.50
Nodes (4): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light or dark is a setting (is-dark class)

### Community 151 - "Google Stitch prompt — Illini Dash popup"
Cohesion: 0.40
Nodes (4): Google Stitch prompt — Illini Dash popup, If it drifts, The brief, What to bring back

### Community 152 - "exams-verified.test.ts"
Cohesion: 0.36
Nodes (6): Exams — everything you have to turn up to, ExamPlacement, reservationVerified(), booked(), exam(), member()

### Community 153 - "makeRowsNavigable"
Cohesion: 0.08
Nodes (23): Deliberately replaced (must be listed in PROGRESS.md and the inventory), Fixed constraints (from CLAUDE.md, none negotiable), Module plan, Popup redesign brief — "soft card direction", Verification, 1. Counts, 2. Findings without an F-number, 3. Every non-PRESERVED item (+15 more)

### Community 154 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.12
Nodes (26): Open: course sites split across pages, Open: Coursera for the online CS courses, Parallelism policy, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 3: never index cells positionally, Trace the path, not just the file, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 5: log both branches of any decision the user will have to debug (+18 more)

### Community 161 - "UX plan phases A–G (2026-09-12)"
Cohesion: 0.17
Nodes (16): When live data contradicts a document: rewrite the claim, Chrome Web Store submission (draft, not submitted), Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Open full view reuses one tab, The store documents, aligned and published, UX plan phases A–G (2026-09-12), Canvas plannable_type → Kind mapping (+8 more)

### Community 162 - "smartPhysics `/Course/Calendar` — findings, 2026-09-21"
Cohesion: 0.33
Nodes (5): smartPhysics `/Course/Calendar` — findings, 2026-09-21, The trap — read before writing a selector, What is established, What is not established, and is blocking a parser, Why this page exists to be parsed at all

### Community 163 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.16
Nodes (17): Independent reviewers, Integrator (main agent), Interaction reviewer prompt, Visual reviewer prompt, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured (+9 more)

### Community 164 - "ui-browser.mjs"
Cohesion: 0.50
Nodes (4): ref_node_http, ref_node_os, openBrowser(), sleep()

### Community 165 - "Issue tracker: GitHub"
Cohesion: 0.25
Nodes (7): Conventions, Issue tracker: GitHub, PROGRESS.md is the source of truth, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 166 - "piazza-real.test.ts"
Cohesion: 0.07
Nodes (35): Evidence and completion, Illini Dash UI acceptance, Inputs, Invoke and run, Reproducible states, Six stages, Amendment (2026-09-18): a cross-listed class keeps both codes all the way down, Amendment (2026-09-18): a weekday in brackets between the date and the clock (+27 more)

### Community 168 - "capture.ts"
Cohesion: 0.12
Nodes (21): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me, ALLOWED_HOSTS, capture() (+13 more)

### Community 169 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 170 - "Domain Docs"
Cohesion: 0.29
Nodes (6): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, In this repo, until a CONTEXT.md exists, Use the glossary's vocabulary

### Community 171 - ".query"
Cohesion: 0.22
Nodes (7): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal, Interpreter guard for subcommands, Interpreter guard for subcommands

### Community 172 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 173 - "/graphify"
Cohesion: 0.22
Nodes (8): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Usage, What graphify is for

### Community 176 - "UI acceptance reference contract"
Cohesion: 0.29
Nodes (7): Authority and provenance, Functional and platform exceptions (already justified), Literal tokens and asset requirements, Structure to preserve by view, UI acceptance reference contract, Unresolved visual choices and bounded decisions, Visual acceptance evidence

### Community 177 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 179 - "Per-source backoff"
Cohesion: 0.32
Nodes (8): Defect: the sync took the sum of its sources, Per-source backoff, Fetch rules for all sources, backoffMinutes(), nextAttemptAt(), MAX_CONCURRENT_PER_HOST, PLANS, REQUEST_TIMEOUT_MS

### Community 180 - "4. Measurements"
Cohesion: 0.40
Nodes (5): 4.1 Width — the invariant holds everywhere, 4.2 Height — floating panels against the 600px ceiling, 4.3 Contrast, dark — nothing under 4.5:1, 4.5 The sizing invariants, 4. Measurements

### Community 181 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

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
- **Why does `vitest` connect `vitest` to `options-dom.test.ts`, `ParseError`, `calendar.ts`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `alerts.ts`, `page-url.ts`, `core/campuswire.ts`, `health.ts`, `types.ts`, `sync-gate.ts`, `prairietest.ts`, `package.json`, `canvas.ts`, `site.ts`, `popup/rows.ts`, `exams-verified.test.ts`, `piazza.ts`, `theme.test.ts`, `overrides.test.ts`, `gcal-auth.ts`, `piazza-real.test.ts`, `detect.ts`, `announce-real.test.ts`, `capture.ts`, `tokens.test.ts`, `screens/setup.ts`, `suggest.ts`, `gcal-client.ts`, `gcal.ts`, `normalize.ts`, `queue.ts`, `Item`, `manual.ts`, `scrub.ts`, `Source`, `popup-draw.test.ts`, `author.ts`, `observer-ui.ts`, `course-colour.test.ts`, `focus.ts`, `ics.ts`, `popup.ts`, `detect.test.ts`, `diagnostics.ts`, `skeleton.ts`, `sync.test.ts`, `compat.ts`, `provenance.ts`, `gcal-lane.ts`, `popup-clearance.test.ts`, `store.test.ts`, `local-adapters.test.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `syncSites`, `prairielearn.ts`, `types.ts`, `core/campuswire.ts`, `background.ts`, `prairietest.ts`, `canvas.ts`, `Sync loop runSync (§6)`, `site.ts`, `sync.ts`, `announce.ts`, `piazza.ts`, `piazza-real.test.ts`, `detect.ts`, `suggest.ts`, `normalize.ts`, `Source`, `author.ts`, `skeleton.ts`, `sync.test.ts`, `Illini Dash — design as built`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `Item` connect `Item` to `store.ts`, `calendar.ts`, `Z. Test files that pin popup behaviour`, `dedupe.ts`, `schedule.ts`, `prairielearn.ts`, `alerts.ts`, `types.ts`, `options.ts`, `health.ts`, `core/campuswire.ts`, `background.ts`, `Sync loop runSync (§6)`, `screens/editor.ts`, `popup/rows.ts`, `exams-verified.test.ts`, `announce.ts`, `piazza.ts`, `overrides.test.ts`, `piazza-real.test.ts`, `announce-real.test.ts`, `suggest.ts`, `gcal-client.ts`, `gcal.ts`, `normalize.ts`, `shell.ts`, `9. UI`, `popup-draw.test.ts`, `ics.ts`, `popup.ts`, `provenance.ts`, `deadline.ts`, `vitest`, `Illini Dash — design as built`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 7 INFERRED edges - model-reasoned connections that need verification._