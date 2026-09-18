# Graph Report - illini-due  (2026-09-18)

## Corpus Check
- 157 files · ~461,549 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 1786 nodes · 4532 edges · 97 communities (92 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 236 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fab2e841`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- store.ts
- health.ts
- Canvas — what the API actually returns
- popup.ts
- calendar.ts
- package.json
- dedupe.ts
- prairielearn.ts
- schedule.ts
- grouping.ts
- manifest.json
- messages.ts
- options.ts
- PROGRESS.md — what is done, which gate, what is blocked
- ParseError
- theme-panel.ts
- UX plan for the store release
- prairietest.ts
- canvas.ts
- needs_login detection
- site.ts
- background.ts
- StoreV1
- author.ts
- Chrome Web Store listing draft (§9 G5)
- ics.ts
- validateAdapter
- announce.ts
- Course-site adapters and runner (§4.5)
- smartphysics.ts
- Tier 1: highest value after the beta, no spec change
- options.html: Settings page
- Options page (§8.2)
- core/registry.ts
- overrides.test.ts
- openRowMenu
- I08 · Local Done check-off, separate from Hide
- Tier 0a: make what exists trustworthy
- detect.ts
- compilerOptions
- compat.ts
- preview-data.ts
- sync.ts
- popup.html: the popup and full view document
- shots.mjs
- types.ts
- Canvas source (§4.1, REST API)
- Roadmap ideas (88 ranked gaps)
- site.mjs
- Review outcome — PrairieLearn (12 findings, all survived)
- RawItem
- markers.ts
- gate0.ts
- icon
- capture.ts
- render
- scrub.ts
- icons.mjs
- What You Must Do When Invoked
- tokens.test.ts
- smartPhysics fixtures provenance
- Source
- manual.ts
- dates.ts
- Gradescope fixtures provenance
- package.mjs
- runSync
- diagnostics.ts
- cellByHeader
- courseLabel
- Adapter registry (bundled + daily GitHub refresh)
- offscreen.html: DOMParser host for the service worker
- Repo layout: worker is wiring, decisions live in core/
- ref_vitest_config
- normalize.ts
- announce.test.ts
- skeleton.ts
- Auto-merge rule (§5.3)
- language-model.d.ts
- illini-dash
- graphify reference: extra exports and benchmark
- Ponytail
- Verifying the popup
- Triaging a beta report
- Adding a course-site adapter (§4.5)
- Tracing a symptom along a runtime path
- Asking Sushi for a browser action
- Popup UI (§8.1)
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- PrairieLearn fixtures
- ref_node_fs
- graphify reference: GitHub clone and cross-repo merge
- CLAUDE.md
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 60 edges
2. `vitest` - 39 edges
3. `RawItem` - 33 edges
4. `Item` - 31 edges
5. `runAdapter()` - 29 edges
6. `Source` - 28 edges
7. `UX plan for the store release` - 28 edges
8. `dedupe()` - 25 edges
9. `PROGRESS.md — what is done, which gate, what is blocked` - 25 edges
10. `parseHome()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `Capturing a fixture (the usual ask)` --references--> `isAllowedCaptureUrl()`  [INFERRED]
  .claude/skills/capture-ask/SKILL.md → src/capture.ts
- `One entry per assignment across Gradescope and Canvas` --references--> `buildItem()`  [INFERRED]
  docs/store/description.txt → src/core/dedupe.ts
- `Trap: §5.1 cannot read 'Physics 214'` --references--> `buildItem()`  [INFERRED]
  fixtures/smartphysics/README.md → src/core/dedupe.ts
- `What is stored: deadlines, courses, settings, corrections in chrome.storage.local` --references--> `applyRetention()`  [INFERRED]
  docs/store/privacy-policy.md → src/core/dedupe.ts

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

## Communities (97 total, 5 thin omitted)

### Community 0 - "store.ts"
Cohesion: 0.09
Nodes (29): guessCourseCode(), ALL_SOURCES, BACKOFF_MINUTES, backoffMinutes(), emptyStore(), FETCHED_SOURCES, isRecord(), isUsableItem() (+21 more)

### Community 1 - "health.ts"
Cohesion: 0.09
Nodes (43): Worker rule 2: a green dot must mean 'I fetched, and it was fine', Worker rule 7: live data is a source of truth the fixtures are not, Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: 'couldn't be read' for both parse and network failures, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, The first live run (2026-09-10): four defects, none caught by 382 tests, The one source with no login page (course sites), Tier 0a (2026-09-10, 13 items) (+35 more)

### Community 2 - "Canvas — what the API actually returns"
Cohesion: 0.06
Nodes (59): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+51 more)

### Community 3 - "popup.ts"
Cohesion: 0.06
Nodes (47): AgendaRow, agendaRows(), AttentionName, bookings(), END_OF_DAY_HEADING, hourRange(), minutesInto(), UNTIMED_HEADING (+39 more)

### Community 4 - "calendar.ts"
Cohesion: 0.10
Nodes (35): allTimed(), Anchor, ATTENTION_ACTIONABLE, ATTENTION_ORDER, AttentionGroup, COURSE_COLOURS, courseColours(), dayContents (+27 more)

### Community 5 - "package.json"
Cohesion: 0.05
Nodes (36): buildId, copyStatic(), options, setup(), watch, devDependencies, esbuild, linkedom (+28 more)

### Community 6 - "dedupe.ts"
Cohesion: 0.15
Nodes (24): applyRetention(), buildItem(), byPrecedence(), canonicalCourseLabel(), canonicalStatus(), carryNotified(), contradictsDone(), courseCodesOf() (+16 more)

### Community 7 - "prairielearn.ts"
Cohesion: 0.17
Nodes (18): isNoEndMarker(), parsePrairieLearnScheduleDate(), courseInstanceIdFrom(), CreditCell, creditStillOpen(), CreditTier, deadlinesFromSchedule(), mapStatus() (+10 more)

### Community 8 - "schedule.ts"
Cohesion: 0.13
Nodes (27): I13 · Reminder toasts with Open / Snooze / Done buttons, I41 · Morning toast instead of 2h lead for runner-invented times, store-toast.png is a composite, not a screenshot, examDetail(), alarmName(), BOOKING_HOUR, clampTitle(), collapseOverdue() (+19 more)

### Community 9 - "grouping.ts"
Cohesion: 0.11
Nodes (35): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, anchorOf(), attentionGroups(), bookingWindowEnd(), examBoard, isFinished() (+27 more)

### Community 10 - "manifest.json"
Cohesion: 0.06
Nodes (31): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+23 more)

### Community 11 - "messages.ts"
Cohesion: 0.12
Nodes (25): ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen(), CourseSummary (+17 more)

### Community 12 - "options.ts"
Cohesion: 0.09
Nodes (28): I57 · Term rollover: term dates in the registry, Expired section, BUILD_ID, currentTermCode(), addSiteUrl, buildAdapter(), captureButton, captureUrl, copyButton (+20 more)

### Community 13 - "PROGRESS.md — what is done, which gate, what is blocked"
Cohesion: 0.21
Nodes (17): Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Fixtures captured, PROGRESS.md — what is done, which gate, what is blocked, Develop: build, watch, typecheck, test, reload, README — illini-dash, Build order (§10) (+9 more)

### Community 14 - "ParseError"
Cohesion: 0.19
Nodes (15): Parser rule 1: a bad value costs its field, a missing hook throws, Dashboard: courseList--term, coursesForTerm, current term first, isOlderThan(), parseGradescopeDateTime(), assignmentIdFor(), courseIdFrom(), currentTermCourses(), dueTimes() (+7 more)

### Community 15 - "theme-panel.ts"
Cohesion: 0.14
Nodes (33): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Light/dark is the is-dark class, not a media query, Light or dark is a setting (is-dark class), allThemeClasses(), DARK_CLASS (+25 more)

### Community 16 - "UX plan for the store release"
Cohesion: 0.06
Nodes (68): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+60 more)

### Community 17 - "prairietest.ts"
Cohesion: 0.14
Nodes (16): parseDateAttribute(), parseDateRangeAttribute(), shortHash(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+8 more)

### Community 18 - "canvas.ts"
Cohesion: 0.18
Nodes (20): Decision: Canvas concluded-course filter via include[]=term, extractCourseCodes(), isInstant(), CANVAS_ORIGIN, CanvasCourse, courseMap(), coursesUrl(), currentTermCourses() (+12 more)

### Community 19 - "needs_login detection"
Cohesion: 0.17
Nodes (16): Parser rule 2: silent empty is the worst outcome, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after, Review outcome — Gradescope (12 findings, 11 fixed), Content-script fetch fallback, Cookie-authenticated fetch (Gate 0 assumption), §0.2 No credential handling, §0.3 Parsers fail loudly (+8 more)

### Community 20 - "site.ts"
Cohesion: 0.09
Nodes (30): 4. The date grammar, AdapterDate, CLOCK_LABELLED, CLOCK_ONE, CLOCK_RANGE, clockFromText(), DATE_FORMATS, DueLabelMatch (+22 more)

### Community 21 - "background.ts"
Cohesion: 0.16
Nodes (24): House rules for the worker and the loop, I03 · Toolbar badge: today's count, red ! when a source is broken, allAdapters(), applySettings(), deps, enabledAdapters(), fireNotification(), keptCourseIds (+16 more)

### Community 22 - "StoreV1"
Cohesion: 0.33
Nodes (10): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Gradescope datetime attribute format, Item, memberKey = source:sourceId, Overrides, RawItem, Retention and purge (§5.4) (+2 more)

### Community 23 - "author.ts"
Cohesion: 0.11
Nodes (27): The context window, The manifest needs no new permission, The shape, When nothing is proposed: the on-device model, authorAdapter(), AuthorOptions, AuthorOutcome, buildPrompt() (+19 more)

### Community 24 - "Chrome Web Store listing draft (§9 G5)"
Cohesion: 0.06
Nodes (44): Store description (plain text), Daily reminder for CBTF exams open for booking, Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted (+36 more)

### Community 25 - "ics.ts"
Cohesion: 0.19
Nodes (20): I22 · Honest .ics / calendar link (all-day for invented times), Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1, buildIcs(), escapeIcsText(), event() (+12 more)

### Community 26 - "validateAdapter"
Cohesion: 0.16
Nodes (21): Rules this feature is held to, Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, dateFormat chosen from a closed set (+13 more)

### Community 27 - "announce.ts"
Cohesion: 0.08
Nodes (29): Announcement fixtures, addDays(), ASSUMED_CLOCK, BADGE, CAL_MONTH, CAL_NUM, CAL_REL, CAP3 (+21 more)

### Community 28 - "Course-site adapters and runner (§4.5)"
Cohesion: 0.40
Nodes (10): Open: course sites split across pages, Worker rule 3: a value this code invented is not a value the source stated, Amendment §5.3: an assumed time is the last resort, not the first, Defect: every ECE 391 deadline landed six hours late, Defect: an invented 23:59 outranked a real Canvas deadline, Adapter (declarative course-site adapter), Canonical field precedence for merged items, Course-site adapters and runner (§4.5) (+2 more)

### Community 29 - "smartphysics.ts"
Cohesion: 0.17
Nodes (25): House rules for parsers, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), splitTitle literal separator (never regex), Shared parser primitives (src/core/parsing.ts), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut() (+17 more)

### Community 30 - "Tier 1: highest value after the beta, no spec change"
Cohesion: 0.20
Nodes (12): Decision 5: campus rows without a course, I01 · Deadline moved / new markers, notification, reminder re-arm, I19 · Per-sync change log strip, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer, I28 · Keep reminders working past Chrome's 500-alarm cap, I37 · A partial PrairieLearn score is not 'done', I40 · CBTF reservation-window escalation and missed-reservation notice (+4 more)

### Community 31 - "options.html: Settings page"
Cohesion: 0.15
Nodes (16): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I61 · Right-click 'Report this page to Illini Dash', #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script, options.html: Settings page (+8 more)

### Community 32 - "Options page (§8.2)"
Cohesion: 0.22
Nodes (13): Open: Coursera for the online CS courses, Parser rule 13: a per-student URL means a source, not an adapter, Chrome Web Store submission (draft, not submitted), Open full view reuses one tab, smartPhysics as a fifth source, The store documents, aligned and published, Gate G5 — Store, Options page (§8.2) (+5 more)

### Community 33 - "core/registry.ts"
Cohesion: 0.18
Nodes (12): SOURCE_ORIGIN, sourceForUrl(), GRANTED_HOSTS, matchesHostPattern(), REGISTRY_REFRESH_MS, REGISTRY_URL, ValidationResult, PRAIRIELEARN_ORIGIN (+4 more)

### Community 34 - "overrides.test.ts"
Cohesion: 0.30
Nodes (14): Row menu (⋯), applyOverride(), courseSummaries(), hideItem(), markDone(), markNotDone(), memberKeysOf(), mergeItems() (+6 more)

### Community 35 - "openRowMenu"
Cohesion: 0.15
Nodes (23): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view (+15 more)

### Community 36 - "I08 · Local Done check-off, separate from Hide"
Cohesion: 0.12
Nodes (20): I08 · Local Done check-off, separate from Hide, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+12 more)

### Community 37 - "Tier 0a: make what exists trustworthy"
Cohesion: 0.17
Nodes (16): I02 · Exam-day card on PrairieTest rows (room, duration, format), I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I54 · Versioned store migrations with memberKey remapping (+8 more)

### Community 38 - "detect.ts"
Cohesion: 0.16
Nodes (14): graphify reference: transcribe video and audio, Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2.5 - Video and audio (only if video files detected), Candidate, dataRows(), detectCandidates(), DetectedRow, hasLink() (+6 more)

### Community 39 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "compat.ts"
Cohesion: 0.26
Nodes (11): Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState(), normalizePopupState() (+3 more)

### Community 41 - "preview-data.ts"
Cohesion: 0.14
Nodes (12): adapters, courses, item(), items, listeners, member(), now, query (+4 more)

### Community 42 - "sync.ts"
Cohesion: 0.18
Nodes (17): Defect: a failed fetch was reported as parse_error, Defect: site: ok (0 items) was a lie, adapterFailureKind(), fetchAll(), FetchedPage, HttpStatusError, NeedsLogin, SourceDisabled (+9 more)

### Community 43 - "popup.html: the popup and full view document"
Cohesion: 0.09
Nodes (25): Decision 4: manual deadline entry, aggregator or planner, I05 · First-run onboarding page, I16 · Honest status line and stale-data banner, I17 · Health-aware popup empty state; no green dot before success, I21 · Manual deadlines as a sixth 'manual' source, I47 · Per-adapter health state and N->0 guard per course site, Theme: health is honest only inside the popup, Promo tile 440x280 from ui.css tokens (+17 more)

### Community 44 - "shots.mjs"
Cohesion: 0.14
Nodes (10): ref_node_http, ref_node_util, chrome, CHROME_CANDIDATES, dist, filter, outDir, run (+2 more)

### Community 45 - "types.ts"
Cohesion: 0.13
Nodes (12): linkedom, vitest, PARSERS, parseRoundtrip(), ROUNDTRIP_PARSER_ID, courseUrl(), PageCtx, ParseFn (+4 more)

### Community 46 - "Canvas source (§4.1, REST API)"
Cohesion: 0.18
Nodes (13): When live data contradicts a document: rewrite the claim, Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Defect: cs124.org could not be added at all, Defect: a Gradescope course labelled stat_425_120248_268442 (+5 more)

### Community 47 - "Roadmap ideas (88 ranked gaps)"
Cohesion: 0.20
Nodes (14): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, Decision 6: snooze amends §7's daily booking nag, G5: store submission after G4, I42 · Google Calendar sync via chrome.identity, I52 · Point-and-click selector picker on the live course page (+6 more)

### Community 48 - "site.mjs"
Cohesion: 0.21
Nodes (12): ref_node_url, escape(), ESCAPES, inline(), manifest, out, page(), policy (+4 more)

### Community 49 - "Review outcome — PrairieLearn (12 findings, all survived)"
Cohesion: 0.11
Nodes (27): Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 3: never index cells positionally, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Parser rule 6: match markers exactly and scope them to the smallest element, Adapter.columns — header-driven column lookup, Amendment §4.3: credit table has a header row and no tbody (+19 more)

### Community 50 - "RawItem"
Cohesion: 0.18
Nodes (13): attentionCount(), isActionable(), movedText(), DATE_FLAGS, QualityFlag, qualityFlags(), SOFT_FLAGS, unreadableDeadline() (+5 more)

### Community 51 - "markers.ts"
Cohesion: 0.20
Nodes (11): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult, render() (+3 more)

### Community 52 - "gate0.ts"
Cohesion: 0.33
Nodes (7): checkOne(), collapse(), GATE0_TARGETS, Gate0Target, LOGIN_URL_MARKERS, looksLikeLoginUrl(), runGate0()

### Community 53 - "icon"
Cohesion: 0.36
Nodes (8): menu, icon(), ICON_PATHS, iconButton(), IconName, Banner, renderPinCard(), NAMES

### Community 54 - "capture.ts"
Cohesion: 0.40
Nodes (8): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), ensureHostPermission()

### Community 55 - "render"
Cohesion: 0.19
Nodes (21): UI rule 2: every send() from a page needs a .catch, coursesIn(), staleWorkerNotice(), send(), applyOverrideAction(), draw(), endSync(), isSyncing() (+13 more)

### Community 56 - "scrub.ts"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "icons.mjs"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 58 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (23): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+15 more)

### Community 59 - "tokens.test.ts"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "smartPhysics fixtures provenance"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 61 - "Source"
Cohesion: 0.16
Nodes (19): SourceDiagnostics, EmptyState, HealthSummary, SourceRow, staleNotice, loginsToOpen(), needsSetup(), opensOnInstall() (+11 more)

### Community 62 - "manual.ts"
Cohesion: 0.23
Nodes (17): ASSUMED_TIME, editManualItem(), fieldsOf(), instantOf(), KINDS, ManualInput, ManualItemError, newManualItem() (+9 more)

### Community 63 - "dates.ts"
Cohesion: 0.22
Nodes (17): Mutation rule 2: a survivor is untested, unreachable, or redundant, A survivor has three meanings — decide which before acting, RFC-3339, readDatePhrase(), DAYS_IN_MONTH, inferYear(), isRealWallClock(), monthIndex() (+9 more)

### Community 64 - "Gradescope fixtures provenance"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 65 - "package.mjs"
Cohesion: 0.17
Nodes (11): ref_node_child_process, ref_node_path, bundle, DEV_ONLY, dist, manifest, out, dist (+3 more)

### Community 66 - "runSync"
Cohesion: 0.19
Nodes (16): Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Defect: signing in changed nothing until Sync was pressed, Per-source backoff, Fetch rules for all sources, Popup-triggered sync debounce, Sync loop runSync (§6), dedupeInput() (+8 more)

### Community 67 - "diagnostics.ts"
Cohesion: 0.20
Nodes (12): buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), StoreV1Plus, SyncResult, Settings (+4 more)

### Community 68 - "cellByHeader"
Cohesion: 0.22
Nodes (13): House rules for mutation checks, Mutation rule 3: a survivor sometimes indicts the design, A survivor sometimes indicts the design, Always assert the match count, Mutation check, Reporting, The procedure, When the defect was in covered code (+5 more)

### Community 69 - "courseLabel"
Cohesion: 0.53
Nodes (5): Course rename override (overrides.courseNames), POPUP_STATE_FIELDS, courseLabel(), displayCourseLabel(), renameCourse()

### Community 70 - "Adapter registry (bundled + daily GitHub refresh)"
Cohesion: 0.21
Nodes (13): Worker rule 5: log both branches of any decision the user will have to debug, Amendments to SPEC.md, ECE 411 (FA 2026) — what the pages actually say, The exam times are stated somewhere else, The live schedule is in a Google Sheets iframe, and cannot be read, The page shape: `label: value` bullets, not a table, Two pages, so two adapters, Defect: bundled registry was never read (+5 more)

### Community 71 - "offscreen.html: DOMParser host for the service worker"
Cohesion: 0.50
Nodes (5): offscreen permission justification, offscreen justification (form), offscreen.js module script, offscreen.html: DOMParser host for the service worker, Offscreen parser round-trip check (#run-selftest)

### Community 72 - "Repo layout: worker is wiring, decisions live in core/"
Cohesion: 0.19
Nodes (13): Parallelism policy, Trace the path, not just the file, Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Defect: a failing registry refresh retried on every sync, Defect: the store queue deadlocked, Defect: set-adapter-enabled wrote the store outside the queue, Review outcome — steps 9–12 (16 findings, 13 code defects) (+5 more)

### Community 74 - "normalize.ts"
Cohesion: 0.21
Nodes (11): courseMatches(), earlier(), resolveMentions(), badgesOf(), titlesCompatible(), FILLER, isSubsetOf(), jaccard() (+3 more)

### Community 75 - "announce.test.ts"
Cohesion: 0.20
Nodes (9): describeEmpty(), Mention, ReadMention, SUBJECT_WORDS, UnreadableMention, FIXTURES, only(), read() (+1 more)

### Community 76 - "skeleton.ts"
Cohesion: 0.44
Nodes (11): selectorForTable(), ancestry(), cellsOf(), clip(), describe(), DROPPED, droppedAncestor(), renderOutline() (+3 more)

### Community 77 - "Auto-merge rule (§5.3)"
Cohesion: 0.31
Nodes (11): Review policy, Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Review outcome — dedupe + sync (16 findings, 7 code defects), Auto-merge rule (§5.3), Gate G2 — Recall, Gate G3 — Dedupe, Gate G4 — Beta, Settings (+3 more)

### Community 78 - "language-model.d.ts"
Cohesion: 0.18
Nodes (5): LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelInitialPrompt, LanguageModelPromptOptions, LanguageModelSession

### Community 79 - "illini-dash"
Cohesion: 0.20
Nodes (9): Check it in the mode Sushi actually uses, illini-dash, Parallelism, Review policy, Rules, Sushi's time is the scarce resource, The popup is measured by Chrome, not sized by you, Things I have to do (you can't) (+1 more)

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

### Community 84 - "Adding a course-site adapter (§4.5)"
Cohesion: 0.25
Nodes (7): 0. Is it even an adapter?, 1. The capture, 2. The schema, 3. The three page shapes, 5. The fixture test (required before it ships), 6. Delivery, Adding a course-site adapter (§4.5)

### Community 85 - "Tracing a symptom along a runtime path"
Cohesion: 0.25
Nodes (7): 1. State the symptom as an observation, 2. Cut the path into segments, 3. The prompt each agent gets, 4. Findings are leads, not results, 5. Where a fix goes, Trace or review?, Tracing a symptom along a runtime path

### Community 86 - "Asking Sushi for a browser action"
Cohesion: 0.29
Nodes (6): Asking Sushi for a browser action, Before you ask, Capturing a fixture (the usual ask), Template, The rules of the ask, What I must never ask you to do for me

### Community 87 - "Popup UI (§8.1)"
Cohesion: 0.47
Nodes (6): The popup is measured by Chrome, not sized by you, Defect: the popup opened at 800×600 with the list in its left half, npm run preview — the real popup over canned data, §0.6 Ship ugly, Popup UI (§8.1), Rendering security rules

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

## Ambiguous Edges - Review These
- `healthPill` → `#page-sub: version, last check, sources answered`  [AMBIGUOUS]
  public/options.html · relation: references
- `healthPill` → `#health: the health pill`  [AMBIGUOUS]
  public/popup.html · relation: references
- `--blink-settings=preferredColorScheme, not --force-dark-mode` → `npm run shots headless capture script`  [AMBIGUOUS]
  docs/ux-plan.md · relation: references

## Knowledge Gaps
- **405 isolated node(s):** `watch`, `buildId`, `options`, `name`, `version` (+400 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 507 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `types.ts` to `store.ts`, `health.ts`, `calendar.ts`, `package.json`, `dedupe.ts`, `prairielearn.ts`, `schedule.ts`, `grouping.ts`, `ParseError`, `theme-panel.ts`, `prairietest.ts`, `canvas.ts`, `site.ts`, `author.ts`, `ics.ts`, `core/registry.ts`, `overrides.test.ts`, `detect.ts`, `compat.ts`, `RawItem`, `gate0.ts`, `icon`, `capture.ts`, `scrub.ts`, `tokens.test.ts`, `Source`, `manual.ts`, `diagnostics.ts`, `courseLabel`, `Repo layout: worker is wiring, decisions live in core/`, `announce.test.ts`, `ref_node_fs`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `PROGRESS.md — what is done, which gate, what is blocked` connect `PROGRESS.md — what is done, which gate, what is blocked` to `Options page (§8.2)`, `Canvas — what the API actually returns`, `Auto-merge rule (§5.3)`, `Roadmap ideas (88 ranked gaps)`, `UX plan for the store release`, `Chrome Web Store listing draft (§9 G5)`, `validateAdapter`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `ParseError` connect `ParseError` to `store.ts`, `prairielearn.ts`, `sync.ts`, `messages.ts`, `skeleton.ts`, `types.ts`, `announce.test.ts`, `prairietest.ts`, `canvas.ts`, `needs_login detection`, `site.ts`, `background.ts`, `gate0.ts`, `author.ts`, `announce.ts`, `smartphysics.ts`, `dates.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `ParseError` (e.g. with `House rules for parsers` and `House rules for the worker and the loop`) actually correct?**
  _`ParseError` has 3 INFERRED edges - model-reasoned connections that need verification._