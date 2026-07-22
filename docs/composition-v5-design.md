# Composition v5: registered limited animation

Composition v5 adds a first-class limited-animation model for the small pose changes common in hand-drawn explainers: a page turns, symbols bounce, a hand points, a card changes, or a character puts a book down. It replaces the opacity-node workaround with one semantic node whose state schedule is deterministic and reviewable.

## Contract boundary

- `project.json` supports schema v6 only; v5 state sequences remain the limited-animation primitive inside it.
- `storyboard.json` supports schema v5 only; authors declare treatments and scene boundaries while the compiler derives composition/state/visibility plans.
- image requests support schema v5 only.
- old files are not migrated or dual-parsed. Equivalent old outputs can be authored again with current primitives.

## State sequence

A `state-sequence` node contains:

- `poseFamilyId`: stable semantic identity for the pose/prop family;
- `registration`: source master, common canvas and top-left origin;
- ordered `states[]`: state id, public source and normalized activation time;
- `playback`: `once`, `loop`, or `ping-pong`, plus cycle count;
- `transition`: deterministic `cut` or bounded `crossfade`;
- one transform/motion/event path applied to the whole family.

The renderer selects state layers internally. Authors must not create one asset node per state and toggle opacity. Proof moments use `stateAssertions[]`, and validation rejects missing coverage, unknown states, or a proof whose expected state disagrees with the resolved schedule.

## Cost-aware registered state sheets

Multiple states of one identity should normally be generated in one dense sheet (2×2, 3×2, and similar layouts) through a single schema-v5 request with `stateSheetBinding`. The binding declares every state/cell and a `preserve-sheet-context` recovery policy. Multi-state families cannot use an independent provider request for one replacement state.

Recovery is ordered and executable:

1. rerun deterministic local splitting/keying when the defect is local processing;
2. use `stateSheetRecoveryBinding.mode=masked-sheet-edit` with the complete recorded source sheet, a full-canvas mask, and only the failed state ids;
3. if the provider cannot keep untargeted cells unchanged, use `full-sheet-regeneration` for every state in the family.

Masked repair requests must bind the source sheet as both `derivation.parentAssetId` and a generation-family reference. Quality preparation compares every untargeted cell against the source pixels and fails when changed-pixel ratio or mean channel drift exceeds the contract. The repaired target still requires identity-family and reference-conformance review.

`npm run assets:process-state-sheet -- <state-sheet.json>` then:

1. verifies the sheet was already recorded as one provider output;
2. splits row-major cells while preserving every cell's full canvas;
3. removes the uniform key locally;
4. verifies identical output dimensions;
5. records each state as a deterministic derivative with one family fingerprint;
6. writes a report containing provider calls, derived states, and avoided individual calls.

Preserving the full cell canvas is mandatory: trimming each silhouette independently destroys registration and creates visible jumps. Unrelated identities must not be packed together merely to fill the grid. If one cell fails review, provider repair may target only that cell's mask but must receive the complete original sheet as context and prove accepted cells unchanged; otherwise regenerate the complete sheet. Never splice an independently generated replacement cell into the family.

## Dynamic graphics

v5 also exposes generic `text` and `shape` nodes. Cards, labels, questions, circles, highlights, and simple dark/light interface panels remain live React/CSS graphics instead of baked full-frame imagery. These nodes share the same transform, keyframe, event, grouping, proof, and fingerprint system as image assets.

## Evidence and invalidation

- visual fingerprints include every state source plus schedule, playback, transition and registration;
- each state is an asset-quality target;
- each sequence is a composite-quality target;
- required sequence checks cover state order, pose registration, identity, transition cleanliness and proof binding;
- composition proof renders every asserted state and fingerprints the result;
- state-sheet derivatives retain source sheet provenance and do not consume additional generation attempts.

## Authoring rule

Storyboard v5 classifies the visible change before production. Use continuous transforms for movement of the same drawing, persistent visibility events for show/hide lifecycle, and `state-sequence` when the drawing itself changes. Combine them with `supported-subject`, `registered-environment`, editable graphics, or continuous motion when those relationships coexist. The compiler derives and fingerprints the v6 execution plan from orthogonal treatments. Extend the reusable schema/runtime if neither model expresses the approved visual language; do not introduce project-specific renderer branches.
