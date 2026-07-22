# Composition v5: registered limited animation

Composition v5 adds a first-class limited-animation model for the small pose changes common in hand-drawn explainers: a page turns, symbols bounce, a hand points, a card changes, or a character puts a book down. It replaces the opacity-node workaround with one semantic node whose state schedule is deterministic and reviewable.

## Contract boundary

- `project.json` supports schema v5 only.
- `storyboard.json` supports schema v3 only.
- image requests support schema v5 only.
- old files are not migrated or dual-parsed. Equivalent old outputs can be authored again with v5 primitives.

## State sequence

A `state-sequence` node contains:

- `poseFamilyId`: stable semantic identity for the pose/prop family;
- `registration`: source master, common canvas and top-left origin;
- ordered `states[]`: state id, public source and normalized activation time;
- `playback`: `once`, `loop`, or `ping-pong`, plus cycle count;
- `transition`: deterministic `cut` or bounded `crossfade`;
- one transform/motion/cue path applied to the whole family.

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

Preserving the full cell canvas is mandatory: trimming each silhouette independently destroys registration and creates visible jumps. Unrelated identities must not be packed together merely to fill the grid. If one cell fails review, only that cell may be regenerated; a good family must not be thrown away wholesale.

## Dynamic graphics

v5 also exposes generic `text` and `shape` nodes. Cards, labels, questions, circles, highlights, and simple dark/light interface panels remain live React/CSS graphics instead of baked full-frame imagery. These nodes share the same transform, keyframe, cue, grouping, proof, and fingerprint system as image assets.

## Evidence and invalidation

- visual fingerprints include every state source plus schedule, playback, transition and registration;
- each state is an asset-quality target;
- each sequence is a composite-quality target;
- required sequence checks cover state order, pose registration, identity, transition cleanliness and proof binding;
- composition proof renders every asserted state and fingerprints the result;
- state-sheet derivatives retain source sheet provenance and do not consume additional generation attempts.

## Authoring rule

Use continuous transforms for movement of the same drawing. Use `state-sequence` when the drawing itself changes. Combine them when a registered pose change and a small bounce/translation happen together. Extend the reusable schema/runtime if neither model expresses the approved visual language; do not introduce project-specific renderer branches.
