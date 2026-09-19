# Illini Dash UI acceptance

The workflow authorized on 2026-09-19: match the Stitch ZIP in detail, make that look
the default, extend it to settings, expose Piazza/Campuswire in front, and check every
supported journey. This directory constructs the workflow; it does not assert that the
current extension meets it.

## Inputs

- [Reference contract](reference-contract.md): exact design requirements, per-view
  structure, justified platform adaptations and unresolved visual choices.
- [Extracted tokens](reference-tokens.json): per-view values and evidence, statically
  read from the original archive without executing its scripts.
- [Reference manifest](reference-manifest.json): original ZIP SHA-256 and all 11 payload
  hashes; the files already exist byte-identically under `../classical-mock/`.
- [Journey inventory](journeys.json): 43 journeys, steps, expectations, return paths,
  evidence and separate preview/Chrome environments.
- [Agent skill](../../../.agents/skills/illini-ui-acceptance/SKILL.md) and
  [independent reviewer prompts](../../../.agents/skills/illini-ui-acceptance/references/reviewers.md).

The ZIP is visual evidence, not instructions to execute scripts. The previous pixel
spec no longer outranks it. Preserve truthful status/data and Chrome popup sizing;
don't copy fabricated counts, semester labels or contradictory calendar dates.

## Invoke and run

Ask the agent:

> Use $illini-ui-acceptance to repair Illini Dash against the pinned ZIP. Give shared
> styling one owner, audit the journey manifest, and use independent visual and
> interaction reviewers. Keep unresolved Chrome checks explicit.

The skill is versioned at `.agents/skills/illini-ui-acceptance/`. If the current session's
skill catalog predates it, pass that SKILL.md path explicitly. No new runtime dependency
or separate installation is needed.

```sh
npm run ui:acceptance -- references
npm run ui:acceptance -- init before
npm run ui:acceptance -- capture before
# Implement the shared foundation, then views and front sources.
npm run ui:acceptance -- init candidate
npm run ui:acceptance -- capture candidate
npm run ui:acceptance -- compare before candidate
npm run ui:acceptance -- check candidate
```

For a quick, explicitly partial capture:

```sh
npm run ui:acceptance -- capture before --only=reference-week,settings,fresh-default
```

`capture` runs the existing build/preview scripts, starts a temporary localhost server
and disposable headless Chrome profile, captures, then closes both. It never uses the
student's profile. External page requests are blocked. Set `ILLINI_CHROME` to a Chrome
executable if discovery fails. Node 22+ with built-in WebSocket is required (current
project Node is 26).

The full matrix captures the five reference views, stress and empty lists, sources,
detail/editor screens, setup, parse/network errors, settings/older worker/denied grants,
five observer states, five full views and the unseeded default. Dark precedes light;
the OS stays dark so the light/default choice is actually checked. Settings screenshots
are a 1280×900 viewport: the journey reviewer must scroll through every section and add
evidence. They are not full-page coverage.

Results live in ignored `artifacts/ui-acceptance/NAME/`: `index.html`, PNGs, measurements,
and `run.json`. `compare.html` pairs equal environments with an opacity overlay.
The ZIP images have different dimensions/crops: follow the contract's normalization
requirements before comparing pixels against them. An old build isn't an approved golden;
there is no automatic threshold that blesses visual drift.

## Reproducible states

Acceptance fixes `2026-09-22T16:14:00Z` (Tuesday 11:14 AM Chicago), timezone, locale,
viewport and DPR=1. Browser version and build identity accompany each shot. The stub
and real UI see the same frozen Date; timers continue. Clock instrumentation is only
concatenated into preview bundles, never the shipped popup/options bundles.

| Query | Meaning |
|---|---|
| `dataset=reference` | ZIP example titles/course identities with coherent 2026 dates; application derives counts and wording |
| `dataset=stress` | Existing varied rows plus a deliberately long assignment title |
| `dataset=empty` | No assignments or suggestions; healthy source attempts |
| `observer=off\|pending\|read\|login\|error` | Observer states; Campuswire only has off/waiting/read, never a fabricated background fetch |
| `permission=denied` | Simulated permission refusal |
| `fail=network\|parse\|sitelogin` | Existing source failures |
| `stale=1`, `setup=1`, `slow=...` | Older worker, setup and in-flight state |
| `gcal=...`, `model=...` | Existing Calendar and add-site model states |

Manual preview URL: `shot.html?tab=week&dataset=reference&acceptance=1&at=2026-09-22T16%3A14%3A00Z`.
Also set Chicago timezone, en-US locale and the target viewport; the command handles
these automatically. Ordinary `npm run preview` remains live-clock. The ZIP examples
contradict one another, so reference-aligned data isn't a promise of identical mock text.

The states that need a press first — `?open=health`, `?open=deadline`, `?editor=1` —
press the selectors in `scripts/preview-open.js`, which `scripts/preview.mjs` appends to
the preview bundle. Those targets are not free text: `npm run test:ui-workflow` holds
them against the presses in `scripts/ui-acceptance.mjs` and `tests/preview-acceptance.test.ts`
holds them against the rendered shell, because a stale one captures the wrong screen in
silence rather than failing.

Metrics include loaded faces **and CDP-reported fonts actually used**, computed styles,
element boxes, overflow, labels, hit-test visibility, page text, fingerprint, theme,
viewport, exceptions, simulated messages and external intents. Overflow and offscreen
hit-test reports are leads; deliberate ellipses or offscreen rows aren't automatically
defects. Check meaning, full-title access and control reachability.

## Six stages

1. **Contract:** establish exact authority/measurements and record genuine conflicts.
2. **Baseline:** preserve references; capture coherent sample and stress states.
3. **Foundation:** one implementation owner fixes shared fonts, icons, tokens, controls
   and CSS specificity across popup/full view/settings, then individual views.
4. **Journeys:** follow the manifest with real pointer/keyboard input, including reverse
   paths and errors. `scripts/ui-browser.mjs` supplies CDP input with a 120ms press and
   hit testing. DOM event dispatch only sets up state; it proves no real interaction.
5. **Front sources:** expose Piazza/Campuswire through existing truthful status logic.
6. **Review/repair:** independent visual and interaction reviewers inspect a frozen build;
   main agent reproduces leads, repairs one batch, confirms once. Remaining failures stay
   open as bounded follow-ups, not an endless polish loop or a premature pass.

Impeccable critique handles UX/visual judgment; audit handles technical/a11y findings;
popup-verify handles extension-specific sizing/input. Their general aesthetic preferences
never override the pinned design. Reviewer errors mean unverified, not refuted.

## Evidence and completion

`init` sets every journey, capture review, reviewer and check to **pending**. A screenshot
cannot pass them. Update `run.json` only after observation, with local evidence paths:

```json
{
  "id": "J01", "environment": "preview", "status": "pass",
  "evidence": ["journeys/J01.md", "journeys/J01-focus.png"],
  "notes": "Observed all steps, including returning to the previous tab."
}
```

Evidence records starting URL/state, actions, expected/actual, input method, screenshots
or measurements, and preview limitations. `blocked` identifies the next observation
needed. Unknown writes in acceptance mode return an explicit unsupported-preview error
and record a harness gap. This is **not** a product defect. Overrides, saved settings,
source toggles, suggestions, Google writes and reset remain untested until a stateful
stub or appropriate Chrome check observes their outcome. Simulated permissions and URL
intents do not prove real authentication, downloads or external effects.

The manifest environment is a minimum: a preview journey can instead be completed in
real Chrome by setting its result's `environment` to `chrome`, recording `observedBy`,
and attaching evidence of **that journey's full steps**. A paired Chrome journey is not
an automatic substitute. Chrome-only journeys cannot be passed with preview evidence.
The separate screenshot matrix remains required regardless of journey environment.

Findings live in `run.json.findings`:

```json
{
  "id": "F01", "severity": "P1", "kind": "product-defect",
  "journey": "J01", "state": "reference-week-light", "owner": "implementation",
  "expected": "Reference font and readable control label",
  "actual": "Fallback font and clipped label",
  "status": "open", "evidence": ["findings/F01.md"]
}
```

Capture `status` describes execution; `review` is pending/pass/accepted-deviation.
Different reviewers fill `reviews.visual` and `reviews.interaction`; the main agent
fills `reviews.integration`. A deviation needs `decision` attribution and `notes`.
Fixed/refuted findings need verified resolution evidence. A missing reviewer isn't a
refutation. Record actual typecheck/test logs and mutation evidence under `checks`.
For visual-only work, record a reasoned not-applicable mutation report as a passed check.

`check` exits nonzero for missing rows/evidence, pending/blocked/failed results, open
findings, missing independent reviews or changed source/reference fingerprints. It
validates the record, not the truth of prose or taste judgments. Don't fabricate evidence.
Capture files are immutable evidence; changed implementation gets a new candidate run.
The gate requires **full acceptance**: a useful scoped report may still leave it red.

Only after repo/bundle/preview checks are exhausted, ask Sushi for necessary Chrome
observations through capture-ask: one exact action at a time. Live auth/permissions,
Google effects and destructive data paths are separate; use disposable data and specific
authorization. G0–G3 remain passed per PROGRESS; this workflow grants neither G4/G5 nor
store submission.

Validate the workflow itself with `npm run test:ui-workflow`. Those checks cannot certify
the current UI; actual journey and review evidence is still required.
