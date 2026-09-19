# Independent reviewers

Give each reviewer the frozen commit/source digest, reference contract, screenshots,
candidate run directory, applicable journey IDs and current AGENTS.md in full. Use
read-only agents with separate output files. Don't cross-feed findings until both finish.
No reviewer edits the implementation. Surface tool failures as unverified, not refuted.

## Visual reviewer prompt

> Compare the candidate against the reference contract and original classical-mock
> HTML/PNGs. Read AGENTS.md; hunt for new defect classes. Inspect the actual captures and
> metrics: rendered font faces/weights/tracking/leading, course/status inks, icon shapes
> and strokes, spacing, geometry, alignment, borders, tabs, sticky areas and clipped text.
> Inspect settings/full view as extensions of the same design. Separate exact reference
> requirements, inferred unmocked states and unresolved conflicts. Check default light
> on a dark OS and optional dark independently. Save visual-review.md: verified findings
> with severity, capture IDs, expected/actual measurements, evidence paths and unobserved
> states. A taste score cannot replace reference fidelity or evidence.

Use Impeccable critique's independent design/evidence assessments when a full critique
is requested. Load its installed instructions; these prompts do not themselves execute
that skill. Its detector/audit complements browser inspection. Verify false positives;
generic aesthetic preferences never override the user's pinned design.

## Interaction reviewer prompt

> Independently walk journeys.json on the frozen candidate using browser pointer and
> keyboard input. Read AGENTS.md; hunt for new defect classes. Check discoverability,
> wording, number of actions, primary/secondary controls, focus, back/cancel/undo, source
> recovery, local errors, held clicks during sync and reaching bottom controls. Verify
> the element under the pointer before believing a missed click. Use the actual preview
> document, not a fixed-width wrapper. Observe the changed state; a click, log or screenshot
> alone is not success. Unsupported stubs stay untested; record Chrome-only work separately.
> Save interaction-review.md and per-journey evidence. Don't load the extension, log in,
> grant permissions, reset real data or make live Google writes.

## Integrator (main agent)

Reproduce both reviewers' findings against the frozen candidate. Insufficient evidence
means **unverified**, with the next observation required. Classify each as product defect,
harness gap, reference conflict or expected behavior. Preserve both reports. Record issues
in run.json.findings; repair verified defects as one implementation batch and create a
new candidate run. Recheck affected journeys; broaden only when shared changes require it.
Source changes invalidate old pass records. Write integration-review.md with resolutions,
intentional departures, remaining gaps and actual automated-check commands/results. Full
acceptance requires the full manifest, independent reviews and final Chrome observations.
