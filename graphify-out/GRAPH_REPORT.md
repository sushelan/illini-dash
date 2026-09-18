# Graph Report - illini-due  (2026-09-18)

## Corpus Check
- 130 files · ~418,219 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 1489 nodes · 3952 edges · 74 communities (72 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.89)
- Token cost: 495,744 input · 0 output

## Community Hubs (Navigation)
- Store & sync loop
- Health & source names
- Source findings & amendments
- Popup shell & refresh
- Calendar core & done rules
- Build scripts & tooling
- Dedupe & merge rules
- PrairieLearn parser & dates
- Notification scheduling
- Grouping & diagnostics
- Manifest
- Messages & offscreen client
- Options page
- Spec, gates & build order
- Gradescope parser & parsing primitives
- Themes
- UX plan for the store
- PrairieTest parser
- Canvas API & course codes
- Login detection & sign-in signal
- Site adapter runner
- Worker wiring & store queue
- Data model & sync spec
- Beta install & dev loop
- Store listing & permissions
- Calendar export (ics)
- Adapter schema & self-serve add
- Colour layer & preview harness
- Registry refresh & assumed times
- smartPhysics parser
- Roadmap Tier 1 ideas
- Options page sections & tools
- Background: adapters & term
- Origins & registry constants
- Overrides & row menu actions
- Row menu & floating panels
- Roadmap Tier 0b
- Roadmap Tier 0a
- Adapter proposer (detect)
- TypeScript config
- Worker/page compat
- Preview data stub
- Day view rendering
- Popup document & header
- Screenshot script
- Source types & roundtrip
- Canvas findings & course filter
- Roadmap Tier 2 & decisions
- Site generator
- PL/PT spec & review outcomes
- Row quality flags
- Capture markers
- Gate 0 & scaffold tests
- Icons & components
- Page capture
- Popup views & tabs
- Fixture scrubbing
- Icon script
- Week & exams views
- Token contrast tests
- smartPhysics fixtures
- Dark mode & Sushi's time
- Privacy policy
- Report & permissions form
- Gradescope/PrairieTest fixtures
- Package script
- Parser house rules & reviews
- Done tick & reminder ideas
- Store description
- Course labels & rename
- Preview script
- Offscreen document
- Store queue
- Vitest config

## God Nodes (most connected - your core abstractions)
1. `ParseError` - 50 edges
2. `vitest` - 35 edges
3. `RawItem` - 29 edges
4. `Source` - 28 edges
5. `Item` - 28 edges
6. `UX plan for the store release` - 27 edges
7. `dedupe()` - 25 edges
8. `parseHome()` - 24 edges
9. `renderRow()` - 23 edges
10. `runAdapter()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `sameOriginHttpsUrl()` --semantically_similar_to--> `Rendering security rules`  [INFERRED] [semantically similar]
  src/core/parsing.ts → SPEC.md
- `One entry per assignment across Gradescope and Canvas` --references--> `buildItem()`  [INFERRED]
  docs/store/description.txt → src/core/dedupe.ts
- `Trap: §5.1 cannot read 'Physics 214'` --references--> `buildItem()`  [INFERRED]
  fixtures/smartphysics/README.md → src/core/dedupe.ts
- `What is stored: deadlines, courses, settings, corrections in chrome.storage.local` --references--> `applyRetention()`  [INFERRED]
  docs/store/privacy-policy.md → src/core/dedupe.ts
- `#page-sub: version, last check, sources answered` --references--> `healthPill`  [AMBIGUOUS]
  public/options.html → src/core/health.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **§0 decisions that are not up for debate in v1** — spec_decision_no_backend, spec_decision_no_credential_handling, spec_decision_parsers_fail_loudly, spec_decision_declarative_adapters_only, spec_decision_chrome_only, spec_decision_ship_ugly [EXTRACTED 1.00]
- **Gates G0–G5, in order; do not proceed past a failed gate** — spec_gate_g0_auth_fetch, spec_gate_g1_fixtures_parsers, spec_gate_g2_recall, spec_gate_g3_dedupe, spec_gate_g4_beta, spec_gate_g5_store [EXTRACTED 1.00]
- **Spec amendments forced by real data (parser rule 9: the capture beats the spec)** — claude_parser_rule_9_capture_beats_spec, progress_amendment_canvas_course_code_slug, progress_amendment_no_while1_prefix, progress_amendment_prairielearn_credit_table, progress_amendment_prairietest_links_json_dates, progress_amendment_gradescope_button_row, progress_amendment_assumed_time_last_resort, progress_amendment_badge_token_merge, progress_amendment_hide_keyed_by_memberkeys [EXTRACTED 1.00]
- **Stable sourceId amendment across the four sources** — docs_sourceid_decision_memberkey_stability, docs_sourceid_decision_gradescope_key, docs_sourceid_decision_prairielearn_badge_key, docs_sourceid_decision_prairietest_title_hash_key, docs_gradescope_findings_row_control_changes_on_submit, docs_prairielearn_findings_assessment_instance_link, docs_prairietest_findings_reservation_id_not_exam [EXTRACTED 1.00]
- **validateAdapter trust-boundary rules** — docs_adapters_url_https_illinois_edu, docs_adapters_hostpattern_exact_match, docs_adapters_dateformat_closed_set, docs_adapters_bad_entry_dropped_file_kept, docs_adapters_splittitle [EXTRACTED 1.00]
- **UX plan phases A-G** — docs_ux_plan_phase_a, docs_ux_plan_phase_b_primitives, docs_ux_plan_phase_c_popup_ia, docs_ux_plan_phase_d_settings, docs_ux_plan_phase_e_first_run, docs_ux_plan_phase_f_notifications, docs_ux_plan_phase_g_store [EXTRACTED 1.00]
- **timeAssumed honesty across popup, sort, calendar and reminders** — docs_roadmap_ideas_i06, docs_roadmap_ideas_i22, docs_roadmap_ideas_i41, docs_roadmap_ideas_i49, src_core_dedupe_builditem, src_core_schedule_plannotifications, src_core_ics_event [EXTRACTED 1.00]
- **Health that never lies: dots, status line, badge, per-adapter state** — docs_roadmap_ideas_i17, docs_roadmap_ideas_i16, docs_roadmap_ideas_i03, docs_roadmap_ideas_i47, docs_roadmap_ideas_i46, src_core_store_defaultstatus [EXTRACTED 1.00]
- **Never-signed-in 200 responses need a positive signed-out marker** — fixtures_gradescope_readme_signed_out_html, fixtures_gradescope_readme_js_loginbutton_marker, fixtures_prairietest_readme_signed_out_html, fixtures_prairietest_readme_pl_auth_handoff_marker, src_core_parsing_looksloggedout [EXTRACTED 1.00]

## Communities (74 total, 2 thin omitted)

### Community 0 - "Store & sync loop"
Cohesion: 0.05
Nodes (64): Worker rule 6: a mutation check proves a test is load-bearing, not that it pins the right requirement, I17 · Health-aware popup empty state; no green dot before success, I54 · Versioned store migrations with memberKey remapping, Defect: source Off but its rows still on the calendar, Defect: the sync took the sum of its sources, Defect: site: ok (0 items) was a lie, #status: errors only, hidden otherwise, Per-source backoff (+56 more)

### Community 1 - "Health & source names"
Cohesion: 0.06
Nodes (64): The popup is measured by Chrome, not sized by you, Worker rule 2: a green dot must mean 'I fetched, and it was fine', Defect: the debounce asked 'how long' instead of 'has anything happened', Defect: a failed fetch was reported as parse_error, Defect: 'couldn't be read' for both parse and network failures, Defect: the popup opened at 800×600 with the list in its left half, Defect: enabling a course site stayed 'Checking…' and wrote state ok by hand, The one source with no login page (course sites) (+56 more)

### Community 2 - "Source findings & amendments"
Cohesion: 0.06
Nodes (60): Canvas — what the API actually returns, Amendment: §5.1 regex runs on Canvas name, not course_code, Amendment: §5.3 courseLabel never uses course_code, Concluded-course filter not implementable from course fields, Canvas course_code is an opaque slug (cs_357_120268_263847), Current-term rule: keep courses in a term that brackets now; set aside unbounded ones, Empty planner is correct: 67 assignments, 0 with due_at, Fail open when no term is current (+52 more)

### Community 3 - "Popup shell & refresh"
Cohesion: 0.08
Nodes (47): UI rule 2: every send() from a page needs a .catch, bookings(), coursesIn(), NavigatedAt, SourceAction, SYNC_SPINNER_CAP_MS, send(), actionButton() (+39 more)

### Community 4 - "Calendar core & done rules"
Cohesion: 0.09
Nodes (43): Defect: finished work with a late window open appeared nowhere, Defect: an exam already sat counted as Overdue, Audit: 'hiding an event doesn't work on the calendar' — not found, AgendaRow, allTimed(), Anchor, anchorOf(), ATTENTION_ACTIONABLE (+35 more)

### Community 5 - "Build scripts & tooling"
Cohesion: 0.05
Nodes (36): buildId, copyStatic(), options, setup(), watch, devDependencies, esbuild, linkedom (+28 more)

### Community 6 - "Dedupe & merge rules"
Cohesion: 0.12
Nodes (30): Amendment §5.3 (step 7): a single badge token can satisfy the subset rule, Auto-merge rule (§5.3), Title normalization (§5.2), Transitive union-find merge with overrides, BADGE_TOKEN, badgesOf(), buildItem(), byPrecedence() (+22 more)

### Community 7 - "PrairieLearn parser & dates"
Cohesion: 0.12
Nodes (28): Mutation rule 2: a survivor is untested, unreachable, or redundant, RFC-3339, DAYS_IN_MONTH, inferYear(), isNoEndMarker(), isOlderThan(), isRealWallClock(), MONTHS (+20 more)

### Community 8 - "Notification scheduling"
Cohesion: 0.11
Nodes (30): I28 · Keep reminders working past Chrome's 500-alarm cap, I38 · Coalesce catch-up reminder bursts, word by real remaining time, I40 · CBTF reservation-window escalation and missed-reservation notice, Daily reminder for CBTF exams open for booking, Review outcome — steps 9–12 (16 findings, 13 code defects), Quiet hours, examDetail(), alarmName() (+22 more)

### Community 9 - "Grouping & diagnostics"
Cohesion: 0.11
Nodes (26): opensAt(), buildDiagnostics(), Diagnostics, DiagnosticsInput, hoursSince(), scrubError(), clockOf(), dayOf() (+18 more)

### Community 10 - "Manifest"
Cohesion: 0.06
Nodes (31): action, default_icon, default_popup, default_title, background, service_worker, type, commands (+23 more)

### Community 11 - "Messages & offscreen client"
Cohesion: 0.11
Nodes (26): Candidate, ask(), detectInOffscreen(), ensureOffscreenDocument(), parseGradescopeDashboard(), parseHtml(), parseSmartPhysicsCourses(), runAdapterInOffscreen() (+18 more)

### Community 12 - "Options page"
Cohesion: 0.11
Nodes (26): addSiteUrl, buildAdapter(), captureButton, captureUrl, copyButton, dataStatus(), devBuild, el() (+18 more)

### Community 13 - "Spec, gates & build order"
Cohesion: 0.16
Nodes (29): When live data contradicts a document: rewrite the claim, Development loop (dist/ as unpacked extension), Parser rule 9: the capture beats the spec, CLAUDE.md project instructions and house rules, Review policy, Chrome Web Store submission (draft, not submitted), Defect: cs124.org could not be added at all, Fixtures captured (+21 more)

### Community 14 - "Gradescope parser & parsing primitives"
Cohesion: 0.16
Nodes (21): Shared parser primitives (src/core/parsing.ts), parseGradescopeDateTime(), FieldResult, KeyGuard, LoggedOutOptions, looksLoggedOut(), parseField(), assignmentIdFor() (+13 more)

### Community 15 - "Themes"
Cohesion: 0.19
Nodes (25): Theme choice in localStorage (illini-dash.theme / illini-dash.mode), allThemeClasses(), DARK_CLASS, DEFAULT_MODE, DEFAULT_THEME, isModeName(), isThemeName(), MODE_KEY (+17 more)

### Community 16 - "UX plan for the store"
Cohesion: 0.15
Nodes (25): Rows say 'time not given' rather than inventing a time, UX plan for the store release, B1: a sat exam is not Overdue, B2: primary button invisible in dark (--brand on brand page), B3: white on accent fails AA; --accent-ink #1a0d04, Button system: btn-primary/secondary/quiet/icon, Computed WCAG contrast table, Copy guide: names, states, verbs; nothing from a spec reaches the screen (+17 more)

### Community 17 - "PrairieTest parser"
Cohesion: 0.14
Nodes (17): parseDateAttribute(), parseDateRangeAttribute(), textOf(), cardFor(), EMPTY_CARD, examKey(), isEmptyCard(), isEmptyRow() (+9 more)

### Community 18 - "Canvas API & course codes"
Cohesion: 0.16
Nodes (21): extractCourseCode(), extractCourseCodes(), FILLER, SYNONYMS, isInstant(), CANVAS_ORIGIN, CanvasCourse, courseMap() (+13 more)

### Community 19 - "Login detection & sign-in signal"
Cohesion: 0.12
Nodes (24): Open: Coursera for the online CS courses, Parser rule 11: never signed in is not session expired, and both are needs_login, Parser rule 12: a signed-out marker must be absent from the healthy page, Parser rule 13: a per-student URL means a source, not an adapter, Parser rule 2: silent empty is the worst outcome, Parser rule 6: match markers exactly and scope them to the smallest element, Parser rule 8: login detection needs the HTTP status, Amendment §4.2/§3.1: Gradescope row is a button before submission and an a after (+16 more)

### Community 20 - "Site adapter runner"
Cohesion: 0.16
Nodes (19): Mutation rule 3: a survivor sometimes indicts the design, linkedom, sameOriginHttpsUrl(), AdapterDate, cellByHeader(), DATE_FORMATS, hashTitleAndDate(), headerExists() (+11 more)

### Community 21 - "Worker wiring & store queue"
Cohesion: 0.19
Nodes (23): Worker rule 1: the service worker is the file the suite cannot reach, so keep it empty, Worker rule 4: every store writer goes through the queue, and the queue is re-entrant, Defect: the store queue deadlocked, applySettings(), fireNotification(), maybeRefreshRegistry(), mutate(), notificationsBlocked() (+15 more)

### Community 22 - "Data model & sync spec"
Cohesion: 0.15
Nodes (22): Parser rule 7: RawItem.url is https on the source origin or the fallback, Amendment §3: hides and done ticks are keyed by memberKeys, not Item.id, Repo layout: worker is wiring, decisions live in core/, Daily booking nag, §0.5 Chrome only, Gradescope datetime attribute format, Item, memberKey = source:sourceId (+14 more)

### Community 23 - "Beta install & dev loop"
Cohesion: 0.15
Nodes (22): Installing Illini Dash (beta), Copy diagnostics (Settings > Data), First-run screen: choose sources, open all sign-in pages, Header health dots: grey/green/yellow/red, No server: everything stored locally, uninstall deletes all, Report this page to Illini Dash (right-click, scrubbed file), Row menu: Split / Hide / Mark done, smartPhysics off by default (PHYS 211-214 only, 8:00 AM deadlines) (+14 more)

### Community 24 - "Store listing & permissions"
Cohesion: 0.12
Nodes (22): Chrome Web Store listing draft (§9 G5), Category: Workflow & Planning, Data disclosure form: website content read locally, never transmitted, Store icon: navy tile, one orange bar, white tick, alarms permission justification, commands permission justification, host_permissions for the five sites, notifications permission justification (+14 more)

### Community 25 - "Calendar export (ics)"
Cohesion: 0.20
Nodes (19): Export .ics moved to the bar, Calendar export (§8.3), §0.1 No backend, Out of scope for v1, buildIcs(), escapeIcsText(), event(), foldIcsLine() (+11 more)

### Community 26 - "Adapter schema & self-serve add"
Cohesion: 0.17
Nodes (21): Course-site adapters (§4.5), Adapter JSON schema (id, url, hostPattern, rows, title, due, link, dateFormat, timezone, filter, minExtensionVersion), Adapters are data, not code, Add a course site: preview proposes, student decides, One bad entry dropped, rest applied; non-registry file rejected whole and old copy kept, columns: name the header, do not count to it, cs424-fa26 adapter (rowspan grid, td:not(.auto-style6), 401 in place), dateFormat chosen from a closed set (+13 more)

### Community 27 - "Colour layer & preview harness"
Cohesion: 0.17
Nodes (21): The colour layer, --accent-ink is never white, Adding a theme: THEMES entry + .theme-<name> and .is-dark blocks, Course colour pairs --course-N / --course-N-bg, #filters scroll-container exemption in the width check, Meaning tokens: --err, --warn, --ok are spoken for, --pill-fill: dark Illini row wash instead of course washes, Popup document must never exceed 400px (+13 more)

### Community 28 - "Registry refresh & assumed times"
Cohesion: 0.17
Nodes (20): Open: course sites split across pages, Parallelism policy, Trace the path, not just the file, Worker rule 3: a value this code invented is not a value the source stated, Worker rule 5: log both branches of any decision the user will have to debug, Worker rule 7: live data is a source of truth the fixtures are not, Amendment §5.3: an assumed time is the last resort, not the first, Defect: bundled registry was never read (+12 more)

### Community 29 - "smartPhysics parser"
Cohesion: 0.19
Nodes (16): monthIndex(), shortHash(), nonEmpty(), courseCodesFor(), courseUrl(), DUE, isActiveEnrollment(), isLoginResponse() (+8 more)

### Community 30 - "Roadmap Tier 1 ideas"
Cohesion: 0.14
Nodes (18): Decision 5: campus rows without a course, Decision 4: manual deadline entry, aggregator or planner, I02 · Exam-day card on PrairieTest rows (room, duration, format), I03 · Toolbar badge: today's count, red ! when a source is broken, I16 · Honest status line and stale-data banner, I21 · Manual deadlines as a sixth 'manual' source, I24 · Registrar deadlines as shipped campus rows, I25 · Final exam time and room from Course Explorer (+10 more)

### Community 31 - "Options page sections & tools"
Cohesion: 0.13
Nodes (18): I30 · One-click scrubbed diagnostics bundle, I43 · Split Options into Settings and a hidden Developer panel, I51 · In-options adapter workbench with 'Propose this adapter', I61 · Right-click 'Report this page to Illini Dash', #build-info warning slot, hidden unless wrong, Fixture capture (#run-capture, #capture-presets), Gate 0 cookie-authenticated fetch check (#run-gate0), options.js module script (+10 more)

### Community 32 - "Background: adapters & term"
Cohesion: 0.14
Nodes (13): I57 · Term rollover: term dates in the registry, Expired section, Open full view reuses one tab, allAdapters(), deps, enabledAdapters(), keptCourseIds, lastSetAsideCourses, notificationTargets (+5 more)

### Community 33 - "Origins & registry constants"
Cohesion: 0.16
Nodes (13): ref_node_fs, SOURCE_ORIGIN, sourceForUrl(), GRANTED_HOSTS, matchesHostPattern(), REGISTRY_REFRESH_MS, REGISTRY_URL, ValidationResult (+5 more)

### Community 34 - "Overrides & row menu actions"
Cohesion: 0.27
Nodes (15): Row menu (⋯), applyOverride(), courseSummaries(), hideItem(), markDone(), markNotDone(), memberKeysOf(), mergeItems() (+7 more)

### Community 35 - "Row menu & floating panels"
Cohesion: 0.22
Nodes (17): HANDOFF 2026-09-13: the row menu receives no mouse events, UI rule 3: a status line at the bottom of the document is not a channel, UI rule 4: when a control does something asynchronous, say so on the control, UI rule 5: a synthetic .click() is not a press, UI rule 6: the preview pane's coordinates are not the page's, UI rule 7: a class selector matches whole tokens, UI rule 8: height is the popup's recurring bug in different costumes, Defect: the row menu opened below the fold in week view (+9 more)

### Community 36 - "Roadmap Tier 0b"
Cohesion: 0.14
Nodes (17): I05 · First-run onboarding page, I44 · Canvas 'No date' section with LTI-shell explanation, I45 · Canvas concluded-course filter via include[]=term, I46 · 'Not used by you' source state for PrairieLearn / PrairieTest, I49 · Adapter date grammar matching real fa26 pages, I55 · Beta install kit: zip, install guide, unlisted-store decision, I82 · Publisher-tool deadlines: name the host first, Theme: growth is gated on logged-in captures (+9 more)

### Community 37 - "Roadmap Tier 0a"
Cohesion: 0.20
Nodes (16): I01 · Deadline moved / new markers, notification, reminder re-arm, I04 · Late / reduced-credit window stays live after dueAt, I06 · Show runner-assumed 23:59 times as assumed, I07 · Reduced-credit ladder shown before the deadline passes, I19 · Per-sync change log strip, I22 · Honest .ics / calendar link (all-day for invented times), I27 · 'Can reminders reach you?' check and test-reminder button, I31 · Surface parser data-quality flags instead of dropping rows (+8 more)

### Community 38 - "Adapter proposer (detect)"
Cohesion: 0.24
Nodes (12): dataRows(), detectCandidates(), DetectedRow, hasLink(), noCandidateReason(), pickTitleColumn(), selectorForTable(), SITE_TIMEZONE (+4 more)

### Community 39 - "TypeScript config"
Cohesion: 0.12
Nodes (15): compilerOptions, exactOptionalPropertyTypes, isolatedModules, lib, module, moduleResolution, noEmit, noImplicitOverride (+7 more)

### Community 40 - "Worker/page compat"
Cohesion: 0.25
Nodes (12): Worker rule 8: a message from the worker is data from another build, not a typed object, Defect: a worker on an older build killed the settings page, FieldKind, fill(), isRecord(), NormalizedOptionsState, normalizeOptionsState(), normalizePopupState() (+4 more)

### Community 41 - "Preview data stub"
Cohesion: 0.14
Nodes (12): adapters, courses, item(), items, listeners, member(), now, query (+4 more)

### Community 42 - "Day view rendering"
Cohesion: 0.17
Nodes (15): agendaRows(), hourRange(), minutesInto(), clockOf(), emptyNote(), hourLabel(), renderAgenda(), renderAgendaRow() (+7 more)

### Community 43 - "Popup document & header"
Cohesion: 0.14
Nodes (14): Promo tile 440x280 from ui.css tokens, Generated store screenshots (npm run shots), #back plain link to popup.html?view=full, #page-sub: version, last check, sources answered, #actions: three header controls on the right, popup.css stylesheet, #filters, #health: the health pill (+6 more)

### Community 44 - "Screenshot script"
Cohesion: 0.14
Nodes (10): ref_node_http, ref_node_util, chrome, CHROME_CANDIDATES, dist, filter, outDir, run (+2 more)

### Community 45 - "Source types & roundtrip"
Cohesion: 0.23
Nodes (9): getParser(), PARSERS, parseRoundtrip(), ROUNDTRIP_PARSER_ID, Kind, PageCtx, ParseFn, Status (+1 more)

### Community 46 - "Canvas findings & course filter"
Cohesion: 0.17
Nodes (13): Mutation rule 1: verify the mutation applied, Parser rule 10: a test that passes against a wrong implementation is not a test, Adapter.columns — header-driven column lookup, Amendment §4.1/§5.3: Canvas course_code is an opaque slug, Amendment §4.1: no while(1); prefix on this deployment, Decision: Canvas concluded-course filter via include[]=term, Defect: a Gradescope course labelled stat_425_120248_268442, Tier 0b (4 of 7 done) (+5 more)

### Community 47 - "Roadmap Tier 2 & decisions"
Cohesion: 0.22
Nodes (13): Roadmap ideas (88 ranked gaps), Decision 3: content scripts on host pages, yes or no, Decision 1: Google Calendar OAuth sync now or v1.1, Decision 2: is §0 decision 1 negotiable in wording, G5: store submission after G4, I42 · Google Calendar sync via chrome.identity, I52 · Point-and-click selector picker on the live course page, I53 · Sync settings and overrides via storage.sync (+5 more)

### Community 48 - "Site generator"
Cohesion: 0.21
Nodes (12): ref_node_url, escape(), ESCAPES, inline(), manifest, out, page(), policy (+4 more)

### Community 49 - "PL/PT spec & review outcomes"
Cohesion: 0.27
Nodes (12): Amendment §4.3: credit table has a header row and no tbody, Amendment §4.4: PrairieTest links and machine-readable dates, Review outcome — dedupe + sync (16 findings, 7 code defects), VERIFY: does PrairieTest render the available card for a student with no CBTF courses?, Open questions (§12), PrairieLearn access-details credit schedule, PrairieLearn credit cell text (fallback), PrairieLearn source (§4.3, HTML) (+4 more)

### Community 50 - "Row quality flags"
Cohesion: 0.26
Nodes (8): movedText(), DATE_FLAGS, QualityFlag, qualityFlags(), SOFT_FLAGS, unreadableDeadline(), unreadableSummary(), renderRow()

### Community 51 - "Capture markers"
Cohesion: 0.20
Nodes (11): countOccurrences(), Marker, MARKER_GROUPS, MarkerGroup, MarkerHit, probeMarkers(), ProbeResult, render() (+3 more)

### Community 52 - "Gate 0 & scaffold tests"
Cohesion: 0.22
Nodes (7): vitest, checkOne(), collapse(), GATE0_TARGETS, Gate0Result, LOGIN_URL_MARKERS, runGate0()

### Community 53 - "Icons & components"
Cohesion: 0.36
Nodes (8): menu, icon(), ICON_PATHS, iconButton(), IconName, Banner, renderPinCard(), NAMES

### Community 54 - "Page capture"
Cohesion: 0.36
Nodes (9): ALLOWED_HOSTS, capture(), CaptureResult, isAllowedCaptureUrl(), isGrantedUpFront(), originPattern(), reportUrlFromHash(), looksLikeLoginUrl() (+1 more)

### Community 55 - "Popup views & tabs"
Cohesion: 0.20
Nodes (11): attentionCount(), courseColours(), examCount(), isActionable(), makeRowsNavigable(), render(), renderAttentionView(), renderDateNav() (+3 more)

### Community 56 - "Fixture scrubbing"
Cohesion: 0.22
Nodes (9): BASE_RULES, escapeRegExp(), Rule, scrubHtml(), ScrubOptions, ScrubReport, ScrubResult, ScrubWarning (+1 more)

### Community 57 - "Icon script"
Cohesion: 0.20
Nodes (8): all, args, candidates, chrome, CHROME_CANDIDATES, named, SIZES, srcDir

### Community 58 - "Week & exams views"
Cohesion: 0.24
Nodes (10): startOfDay(), weekContents(), weekDays(), anchorDate(), bookingWindowText(), examHeading(), examWhen(), navFor() (+2 more)

### Community 59 - "Token contrast tests"
Cohesion: 0.27
Nodes (8): Block, blocks(), channels(), contrast(), CSS, luminance(), palettes(), resolve()

### Community 60 - "smartPhysics fixtures"
Cohesion: 0.22
Nodes (9): I81 · smartPhysics prelectures and checkpoints (PHYS 211-214), smartPhysics fixtures provenance, course.html (real, PHYS 214, 29 dated assignments, last year's course), home.html (real, 2026-09-10, signed in, enrolment list), smartPhysics is server-rendered with stable hooks, Trap: a dozen rows titled bare Checkpoint or Homework, Trap: 'Inactive Courses' contains 'active Courses', Trap: §5.1 cannot read 'Physics 214' (+1 more)

### Community 61 - "Dark mode & Sushi's time"
Cohesion: 0.29
Nodes (8): Check it in the mode Sushi actually uses (dark), Sushi's time is the scarce resource, UI rule 1: a popup and the service worker have different consoles, Light/dark is the is-dark class, not a media query, Light or dark is a setting (is-dark class), applyMode(), syncSwatchMode(), systemPrefersDark()

### Community 62 - "Privacy policy"
Cohesion: 0.25
Nodes (8): Before-submitting checklist (G5), Illini Dash privacy policy (2026-09-12), Daily cookieless fetch of one public file on raw.githubusercontent.com, No server, account, analytics, telemetry or error reporting, Notices page loads on permitted sites, not a history, What is stored: deadlines, courses, settings, corrections in chrome.storage.local, What it reads per site (six rows), Web history stays unchecked — a judgment call

### Community 63 - "Report & permissions form"
Cohesion: 0.25
Nodes (8): contextMenus permission justification, optional_host_permissions for course websites, Reporting a broken page uploads nothing, Permissions and why each is needed, contextMenus justification (form), PII and authentication not collected, #report-box: Prepare a report (NetID, name, URL), #sec-sites: course websites, registry refresh, Add a course site

### Community 64 - "Gradescope/PrairieTest fixtures"
Cohesion: 0.36
Nodes (8): Gradescope fixtures provenance, course-1352838.html (real, PHYS435, submitted and unsubmitted rows), dashboard.html (real, 15 courses, 5 terms), js-logInButton as the signed-out marker, not 'Log In', signed-out.html (real, 2026-09-10, no session, trimmed to 16 KB), PrairieTest fixtures provenance, /pl/prairietest/auth handoff link as the signed-out marker, signed-out.html (real, 2026-09-10, no session, 4 KB)

### Community 65 - "Package script"
Cohesion: 0.29
Nodes (6): ref_node_child_process, bundle, DEV_ONLY, dist, manifest, out

### Community 66 - "Parser house rules & reviews"
Cohesion: 0.40
Nodes (6): Parser rule 1: a bad value costs its field, a missing hook throws, Parser rule 3: never index cells positionally, Parser rule 4: guard duplicate sourceIds on one page, Parser rule 5: typeof x === 'string' is not validation, Review outcome — PrairieLearn (12 findings, all survived), Review outcome — PrairieTest (12 findings, all survived)

### Community 67 - "Done tick & reminder ideas"
Cohesion: 0.33
Nodes (6): Decision 6: snooze amends §7's daily booking nag, I08 · Local Done check-off, separate from Hide, I13 · Reminder toasts with Open / Snooze / Done buttons, Theme: two sources can never say done, assignments-cs425.json (real, 1 undated row), #sec-tidy: Hidden and Ticked off rows

### Community 68 - "Store description"
Cohesion: 0.33
Nodes (6): Store description (plain text), Not affiliated with UIUC, Instructure, Gradescope or PrairieLearn, No account, no password, no server, One entry per assignment across Gradescope and Canvas, Description field is plain text: paste description.txt, Runs entirely in the browser; never sees a password

### Community 69 - "Course labels & rename"
Cohesion: 0.53
Nodes (5): Course rename override (overrides.courseNames), POPUP_STATE_FIELDS, courseLabel(), displayCourseLabel(), renameCourse()

### Community 70 - "Preview script"
Cohesion: 0.33
Nodes (5): ref_node_path, dist, stub, stubOut, stubSource

### Community 71 - "Offscreen document"
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
- **273 isolated node(s):** `watch`, `buildId`, `options`, `name`, `version` (+268 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 343 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `healthPill` and `#page-sub: version, last check, sources answered`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `healthPill` and `#health: the health pill`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `--blink-settings=preferredColorScheme, not --force-dark-mode` and `npm run shots headless capture script`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `vitest` connect `Gate 0 & scaffold tests` to `Store & sync loop`, `Health & source names`, `Calendar core & done rules`, `Build scripts & tooling`, `Dedupe & merge rules`, `PrairieLearn parser & dates`, `Notification scheduling`, `Grouping & diagnostics`, `Gradescope parser & parsing primitives`, `Themes`, `PrairieTest parser`, `Canvas API & course codes`, `Site adapter runner`, `Calendar export (ics)`, `smartPhysics parser`, `Origins & registry constants`, `Overrides & row menu actions`, `Adapter proposer (detect)`, `Worker/page compat`, `Source types & roundtrip`, `Row quality flags`, `Icons & components`, `Page capture`, `Fixture scrubbing`, `Token contrast tests`, `Course labels & rename`, `Store queue`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `UX plan for the store release` connect `UX plan for the store` to `Colour layer & preview harness`, `Beta install & dev loop`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `looksLoggedOut()` connect `Gradescope parser & parsing primitives` to `Gradescope/PrairieTest fixtures`, `Store & sync loop`, `PrairieLearn parser & dates`, `PrairieTest parser`, `Canvas API & course codes`, `Login detection & sign-in signal`, `Adapter schema & self-serve add`, `smartPhysics parser`, `Options page sections & tools`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `watch`, `buildId`, `options` to the rest of the system?**
  _273 weakly-connected nodes found - possible documentation gaps or missing edges._