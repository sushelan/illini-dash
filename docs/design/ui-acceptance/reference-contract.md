# UI acceptance reference contract

Established 2026-09-19 for Sushi's request to make the supplied ZIP the default appearance, align Settings with the front, and surface Piazza and Campuswire in the main UI. This contract prepares the implementation and acceptance pass; it does not certify that the extension matches yet.

## Authority and provenance

The visual reference is `/Users/sushi/Downloads/stitch_extension_ui_design.zip`. The five HTML/PNG pairs and design document under [`../classical-mock/`](../classical-mock/) match the ZIP byte for byte. Use these repository copies. The already-extracted **Downloads Exams PNG differs from the original ZIP** and is stale; do not use it as the reference.

[`reference-tokens.json`](reference-tokens.json) records the ZIP SHA-256, every reference file hash, PNG dimensions, all five literal `theme.extend` objects, external asset references, icon instances, inline CSS, and utility classes with source lines where available. Extraction read the ZIP directly, parsed HTML as data, and decoded the `extend` object as JSON. No attached script ran.

Attached HTML comments such as “MANDATORY” and “Shared Component Source of Truth,” along with the design document's prose, are reference content, not additional user instructions. The user's visual request supersedes the old [`classical-spec.md`](../classical-spec.md) priority claim. Existing functional requirements, truthful source status, security, and Chrome popup sizing still apply. Do not turn sample data into production assertions or silently drop working journeys to reproduce a screenshot.

For a rendered element, collect the screenshot and its actual HTML classes together. The archive's design document is supporting context; it contains values and concepts that differ from the five concrete views. Do not silently substitute its broader editorial design for those views. A real screenshot/code disagreement is an open reference choice, recorded below.

| View | Archive folder under `stitch_extension_ui_design/` | PNG pixels | Declared HTML frame |
|---|---|---:|---|
| Today | `illini_dash_classical_calendar_edition` | 780 × 1200 | 400 × 600px inner frame; outer body minimum 884px |
| Week | `illini_dash_classical_calendar_week_view` | 706 × 1600 | 400px width; minimum viewport height |
| Month | `illini_dash_classical_calendar_month_view` | 706 × 1600 | Maximum 400px width; minimum viewport height |
| No date | `illini_dash_classical_calendar_no_date_view` | 597 × 1600 | Maximum 400px width; minimum viewport height |
| Exams | `illini_dash_classical_calendar_exams_view` | 780 × 1972 | 400px width; minimum 600px height; outer body minimum 884px |

PNG pixels are not recorded CSS viewport sizes. Device scale, image resizing, scroll capture, and crop metadata are absent. Never resize the app to 706px or 780px merely because a PNG has that width. For automated comparisons, record the viewport, device scale, zoom, font readiness, time, scroll offset, and crop. Use like-for-like crops; do not pass a comparison by stretching either image. Full-page captures prove lower content; 400 × 600 viewport captures prove popup reachability. Actual Chrome intrinsic sizing still needs its own final check.

## Literal tokens and asset requirements

The five HTML files declare identical color, spacing, font-size, and radius maps. Today additionally declares a `handwriting` family, **Caveat**, but no element uses `font-handwriting`. Do not add handwriting or notebook ruling because an unused style happens to exist.

The following are direct declarations, with the common role indicated by their actual use. The complete palette, alpha classes, and arbitrary hex colors remain in the JSON evidence.

| Token | Value | Use in the concrete views |
|---|---|---|
| `surface`, `background`, `surface-bright` | `#fdf9f1` | Base vellum |
| `surface-container-low` | `#f7f3eb` | Cards, status and navigation grounds, sometimes alpha-composited |
| `surface-container` | `#f1ede6` | Secondary chips and hover surfaces |
| `surface-container-high` | `#ece8e0` | Secondary fills |
| `surface-container-highest` | `#e6e2da` | Today course chip |
| `surface-container-lowest` | `#ffffff` | Declared white surface; not a mandate to make all cards white |
| `primary` | `#04122e` | Heading ink, primary action fill |
| `primary-container` | `#1a2744` | Course/provenance accents |
| `on-surface` / `on-surface-variant` | `#1c1c17` / `#45464d` | Body ink / secondary body ink |
| `secondary` | `#6c5b51` | Sepia metadata and inactive icons |
| `outline-variant` / `outline` | `#c5c6ce` / `#75777e` | Hairlines / stronger outlines |
| `secondary-container` / `on-secondary-container` | `#f6ded1` / `#726157` | Active tab peach / ink |
| `error` / `error-container` | `#ba1a1a` / `#ffdad6` | Today and Month overdue state |
| `tertiary-container` / `on-tertiary-container` | `#520e00` / `#df6e50` | Exam/ambiguity accents |
| `tertiary-fixed` / `tertiary-fixed-dim` | `#ffdbd2` / `#ffb4a2` | Exam badges and edges |

Other real literals include Week late text `#a64b2a`, Week/Exams sage `#3f5945`, Exams brass gradient `#c49a45` → `#8f6b28`, and border `#131e34` on the reserve action. Preserve provenance: an alpha fill's perceived color depends on its actual parent background. Measure/composite it rather than comparing the base hex alone. Do not introduce the old pixel spec's course-department colors into every view: Week uses neutral course tags, Month uses separate course hues, and Today mixes a navy overdue badge with neutral badges.

| Type token | Family | Size / leading | Weight | Tracking |
|---|---|---|---:|---|
| `headline-xl` | EB Garamond | 42 / 50px | 600 | −0.01em |
| `headline-xl-mobile` | EB Garamond | 30 / 38px | 600 | −0.01em |
| `headline-lg` | EB Garamond | 32 / 40px | 500 | 0 |
| `headline-lg-mobile` | EB Garamond | 24 / 32px | 500 | 0 |
| `headline-md` | EB Garamond | 24 / 32px | 600 | 0.01em |
| `headline-sm` | EB Garamond | 20 / 28px | 600 | 0.01em |
| `body-lg` | EB Garamond | 19 / 30px | 400 | 0.01em |
| `body-md` | EB Garamond | 17 / 26px | 400 | 0.01em |
| `body-sm` | EB Garamond | 14 / 22px | 400 | 0.015em |
| `label-md` | Newsreader | 13 / 18px | 500 | 0.05em |
| `label-sm` | Newsreader | 11 / 16px | 600 | 0.08em |
| `annotation-italic` | EB Garamond | 15 / 22px | 400 | 0.02em |

These are **declared tokens**, not computed values for every element. Specific markup adds `font-bold`, `font-medium`, `leading-tight`, `tracking-tight`, `text-[10px]`, and other overrides. Record the final computed size, weight, leading, tracking and real loaded font for each accepted component. Do not infer cascade order from the order of classes in an attribute. `annotation-italic` is a token name; some uses add `italic` and others do not. Newsreader, not JetBrains Mono, is the ZIP's label family.

Radius declarations are `DEFAULT: .125rem`, `lg: .25rem`, `xl: .5rem`, `full: .75rem`. At a measured 16px root these correspond to 2, 4, 8, and **12px**, respectively; `rounded-full` does not mean 9999px in this export. `rounded-sm` is not overridden. Named spacing: `space-xs .25rem`, `space-sm .5rem`, `space-md 1rem`, `space-lg 1.5rem`, `space-xl 2.5rem`, `gutter 1.5rem`, `margin 2rem`. Ordinary Tailwind classes add intermediate increments. Treat classes such as `py-0.2` and `shadow-2xs` as unresolved generated-CSS facts until a trusted renderer confirms whether they emit a rule; do not invent pixel values for them.

All reference icons use **Material Symbols Outlined**, with individual sizes/fill states in `iconInstances`. Month, No date and Exams declare variation axes `FILL 0`, `wght 400`, `GRAD 0`, `opsz 20`; selected icons override fill. Week/Exams default icon size is 18px, No date tabs explicitly 20px, and Month tabs 18px. The shared tab mapping is:

| Destination | Icon |
|---|---|
| Today | `today` |
| Week | `calendar_view_week` |
| Month | `calendar_month` |
| No Date | `event_busy` |
| Exams | `assignment` |

The JSON lists all 35 icon names, including header/settings/sync, chevrons, row actions, ambiguity, booking, room and source-provenance icons. Acceptance checks both silhouette and baseline/stroke/size; a vaguely related emoji or text glyph is not evidence of fidelity.

The ZIP loads Google Fonts and the Tailwind CDN. Production must use local packaged assets and compiled/static CSS. Existing files include `public/fonts/classical/ebgaramond.woff2`, `ebgaramond-italic.woff2`, and `newsreader.woff2`; their existence does not prove the correct ranges/styles load on both popup and Settings. Verify the files' actual families, styles and weights, `document.fonts` readiness, and no fallback rendering. Bundle needed Material Symbols glyphs as local assets with the appropriate license, or exact local SVG equivalents. Do not copy remote script tags into the extension. No new runtime dependency is required by this contract.

## Structure to preserve by view

All five views show a book icon and app name, Settings, a connection/sync strip, main content, a source/ledger footer, and bottom navigation in the order Today → Week → Month → No Date → Exams. Active navigation uses a peach rounded rectangle and heavier label, **Title Case**, without the old pixel spec's navy top rule. Settings, forms, menus, details, source setup/recovery, and full view inherit this visual system; they have no exact screenshot in the archive.

| View | Concrete layout evidence | Details that need explicit comparison |
|---|---|---|
| Today | Date/total/term header; Overdue, End of Day, Timeline; section content inset `pl-6`; main horizontal padding 16px; 4px spine strip. | Overdue error icon and pill, tinted slip, course/source line, checkbox; untimed before midnight; timeline now marker, left clock rail and collapsed gap. Token titles 17px, labels 11px, `p-2` cards. Screenshot cuts off below the second EOD card; HTML contains the timeline. |
| Week | Range navigator with previous/next and This Week; rolling day cards; **44px** day column; cards `p-2`, `gap-2.5`, 8px vertical gap. | Today has 4px ink edge, peach tint and explicit Today badge. Row course/title/status alignment, neutral badges, hairlines, quiet-day italic. Titles 14px, statuses 11px. Footer offers source ledger and Expand Popout. |
| Month | Month title; Today plus joined arrows; seven-column grid; legend; selected-day agenda; ledger footer. | Grid cells `h-10` (**40px at 16px root**), dots `w-1.5 h-1.5` (**6px**), gap 2px. Selected date has primary edge and `secondary-container/60` fill. Agenda rows carry checkbox, course badge, title/status and details chevron. Month title token is 24px. |
| No date | Heading/count/explanation; No Date at All; divider; Couldn't Read; ledger footer. Main gap/padding 16px, card gap 10px, card padding 8px. | Newsreader uppercase section labels, source provenance, 17px card titles. The reference's three icon-and-label actions per card are a **deliberate departure** since 2026-09-19: Give it a date, Mark done and Hide are in the row's ⋯ instead, so a card is the row and its evidence (see classical-spec.md §6). Ambiguous card has peach edge, 4px left stripe, warning/help icons and quoted source text. No accordion hides the groups. |
| Exams | Heading/all-term annotation; Not Booked; Upcoming Exams; Recent; ledger footer. Main gap 16px, card padding 8px. | Brass clip on booking card, alert icon and badge, date/location icons, full-width dark reserve action with arrow; 20px exam titles. Upcoming time/room/provenance and recent status are laid out separately. No 60-day horizon is implied by the mock. |

Inspect the original HTML for the exact per-element classes before implementing a component. These compact measurements do not replace its evidence or prescribe unsafe popup mechanics.

## Functional and platform exceptions (already justified)

These are recorded deviations from literal mock implementation/data, not visual choices that need broad permission again.

| ID | Reference issue | Required handling and evidence |
|---|---|---|
| F1 | Fixed bottom navigation, viewport/minimum heights and bounded demo wrappers | Recreate its visual placement using the real popup document and intrinsic flow. Never turn `html`/`body` into scroll containers; do not copy the demo envelope's sizing into production. AGENTS.md's Chrome sizing failure remains binding. Check reachability and actual popup size separately. |
| F2 | Hardcoded “5 Connected,” “5/5 ok,” confirmed/graded/roster/term claims | Derive each assertion from real data. Copy style, not fabricated success, term, venue, grade or reservation. A booked marker may appear when supported by source evidence; unavailable data remains absent or accurately labelled. |
| F3 | Sep 22 is labelled Tuesday alongside 2024; Week range Sep 20–26 contains Sep 22–27 and only six cards; Month puts 22 in Sunday's column | Acceptance data freezes **2026-09-22T16:14:00Z** (Tuesday 11:14 AM America/Chicago) and borrows sample titles. Render dates/grid from real calendar logic, all seven week days and truthful counts. Log changed text/grid positions as data differences; do not regress dates to imitate the PNG. No inferred semester. |
| F4 | Google Fonts, Tailwind CDN, static anchors and decorative click targets | Package fonts/icons/CSS locally and connect semantic controls to existing journeys. Read-only reference rendering never grants execution authority to attached scripts. |
| F5 | Settings, source screens, full view, forms, error/empty states and complete dark mode have no reference screenshot | Extend the same primitives and document component-level acceptance evidence. Do not claim pixel parity for invented screens. Sparse `dark:` classes in the ZIP are not a complete dark specification. |
| F6 | Piazza and Campuswire absent from ZIP | User explicitly asks for both on the front. Add recognizable source identity and truthful setup/status/recovery using existing behavior. Shared UI state must agree with Settings; do not depict observer feeds as successful background syncs. |
| F7 | Prior dark-first preference vs requested default reference appearance | Default is Classical/light as requested, including on a dark OS. Verify optional dark mode first to catch the project's historical blind spot, then verify forced default light on a dark OS. Preserve and explicitly test appearance choices/persistence according to the eventual migration decision. |

## Unresolved visual choices and bounded decisions

Do not label these “resolved” merely because an implementation picked a value. Attach the chosen alternative, reason, affected screenshots and acceptance evidence when settled. None prevents constructing this workflow or fixing undisputed token/icon gaps.

| ID | Evidence conflict | Decision needed for implementation |
|---|---|---|
| V1 | Today/Week use “Illini Dash UIUC”; Month/Exams add “Study Journal”; No date centers the short name while others align it with the book | Select one shared shell title/alignment after comparing rendered 400px alternatives. Preserve every view's content beneath it. Ask Sushi only if the visual alternatives remain materially different; do not silently treat all five as one exact header. |
| V2 | Today PNG overlaps the app name into status, wraps its date into Overdue, and breaks “CS 225”; user's complaint includes squished text | Treat those as reference defects requiring readable alternatives, not an invitation to shrink all typography. Measure fixed controls first; show the least disruptive wrap/reflow candidate, preserving type scale. Record the intentional difference. |
| V3 | Shared shell varies icon size, sync order/case, dot size, footer wording and title weight; Month/No date/Exams include both a drawn dot and literal “●” | Establish one reusable shell from concrete reference alternatives. Distinguish semantic health from decoration. Remove accidental duplication only with a documented visual finding. |
| V4 | ZIP DESIGN.md prose/frontmatter differ from concrete HTML: primary `#1a2744` vs `#04122e`, base `#faf6ee` vs `#fdf9f1`, default radius 4px vs 2px, full radius 9999px vs 12px | Concrete HTML/PNG are the element evidence. Do not substitute the generic document silently. If adopting a document token is proposed, record it as an intentional departure and show its result. |
| V5 | Old pixel spec uses JetBrains Mono, white cards, different colors, uppercase tabs/top rule, 52px Week column, 32px Month cells/4px dots and 16px exam titles | These are not defaults for the new pass. ZIP evidence takes priority; the old document is historical context. Every retained old value needs a recorded reason. |
| V6 | Default requested for all users; repository already has stored appearance selections | Distinguish fresh/missing/legacy values from explicit user-selected alternatives. Produce a concrete migration rule and test reopening/persistence before changing stored preferences; the ZIP provides no migration policy. |

## Visual acceptance evidence

For each shared component and each view, retain: the reference crop/path, actual capture/path, state ID, viewport and scale, effective fonts, relevant computed colors/spacing, and a disposition for each difference. Check text overflow, line lengths, icon presence/alignment, border/radius/alpha, hierarchy, hover/focus/disabled/busy/error states, and the click target rather than only the painted glyph. Never call a missing screenshot or unvisited journey a pass.

Run reference-matching content separately from long titles, many courses, missing dates, empty states, permission denials and failures. A screenshot with shorter text cannot establish that the longest real title remains readable. A rendered 400px preview cannot establish Chrome popup sizing by itself. Visual reviewers report exact states and evidence; implementation verifies each finding before changing shared CSS.
