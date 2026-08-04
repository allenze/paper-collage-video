# 2026-08 Code Review Findings

Status: complete — all 112 files in `scripts/` read in full; 6 findings (F1-F6) recorded below.

## Purpose

Full-repo review of `scripts/` (the make-paper-collage-video Skill's implementation,
~41,310 lines across ~112 files), looking for correctness bugs, dead/inconsistent
code, and simplification/speed opportunities that do not lower the quality bar.
This document is a handoff artifact: each finding is scoped so another agent can
act on it without re-deriving the investigation.

Method: read every file in full (not sampled), cross-checked against
[SKILL.md](../skills/make-paper-collage-video/SKILL.md)'s documented behavior and
against [AGENTS.md](../AGENTS.md)'s stated architecture policy. A finding is only
listed here if it was confirmed by reading the actual implementation, not inferred.

## Coverage

| Area | Files | Status |
|---|---|---|
| State machine backbone | `production-state.mjs`, `project-advance.mjs`, `project-lib.mjs` | ✅ reviewed |
| Intake & scenario planning | `project-intake.mjs`, `intake-lib.mjs`, `project-scenarios.mjs`, `planning-scenario-lib.mjs`, `creative-plan-lib.mjs`, `style-catalog-lib.mjs`, `project-new.mjs`, `project-plan.mjs` | ✅ reviewed |
| Storyboard & motion contract | `project-storyboard.mjs`, `storyboard-lib.mjs`, `motion-treatment-lib.mjs`, `motion-contract-lib.mjs`, `motion-approval-lib.mjs`, `editorial-system-lib.mjs`, `semantic-contract-lib.mjs`, `spatial-contract-lib.mjs` | ✅ reviewed |
| Provider dispatch | `provider-lib.mjs`, `provider-request/record/run/reuse/select/status/recover-record/recover-rejected-source.mjs`, `generation-attempt-lib.mjs`, `provider-attempt.mjs`, `rejected-output-recovery-lib.mjs` | ✅ reviewed |
| Layer/container asset derivation | `layer-source-plan-lib.mjs`, `container-source-plan-lib.mjs`, `registered-family-lib.mjs`, `canonical-container-lib.mjs` | ✅ reviewed |
| Layer/container asset derivation (remainder) | `derive-registered-family.mjs`, `derive-canonical-container.mjs`, `state-sheet-lib.mjs`, `process-state-sheet.mjs`, `process-character-sheet.mjs`, `state-sequence-lib.mjs`, `chroma-key-lib.mjs`, `observed-key-plane-lib.mjs`, `asset-manifest-lib.mjs`, `asset-evidence-lib.mjs`, `asset-hardening-proof-lib.mjs` | ✅ reviewed |
| Looping world / parallax / motif / composition | `looping-strip-lib.mjs`, `derive-looping-strip.mjs`, `world-trajectory-lib.mjs`, `world-motion-proof-lib.mjs`, `layer-stack-proof-lib.mjs`, `composition-lib.mjs` | ✅ reviewed |
| Quality & composition proof gate | `quality-lib.mjs` (3183 lines, largest file in repo), `project-quality.mjs`, `project-composition-proof.mjs`, `alpha-band-lib.mjs` | ✅ reviewed |
| Audio/subtitle/timeline | `audio-preflight-lib.mjs`, `audio-calibration-lib.mjs`, `project-audio-*.mjs`, `subtitle-lib.mjs`, `subtitle-contract-lib.mjs`, `project-subtitles.mjs`, `timeline-continuity-lib.mjs`, `project-stitch-narration.mjs` | ✅ reviewed |
| Assets-ready seal, render, render status | `assets-ready-seal-lib.mjs`, `project-assets-ready.mjs`, `project-render.mjs`, `render-cache-lib.mjs`, `render-status-lib.mjs`, `project-render-status.mjs`, `project-scene-preview.mjs` | ✅ reviewed |
| Revision paths | `directing-revision-lib.mjs`, `project-revise-preview-directing.mjs`, `project-revise-preview-semantic.mjs` | ✅ reviewed |
| Misc/support scripts | `project-status.mjs`, `project-checkpoint.mjs`, `project-handoff-check.mjs`, `project-review-sync.mjs`, `project-asset-lifecycle.mjs`, `project-validate.mjs`, `project-budget.mjs`, `project-metrics(-run).mjs`, `production-metrics-lib.mjs`, `project-doctor.mjs`, `project-sync.mjs`, `project-report.mjs`, `schema-v12.mjs`, `runtime-build-lib.mjs`, `rasterize-assets.mjs` | ✅ reviewed (found F5) |
| Style/VOX/phase2/looping-world proof harness | `style-motion-proof.mjs`, `style-proof-lib.mjs`, `prepare/render/verify-phase2-proof.mjs`, `verify-vox-sample.mjs`, `vox-sample-proof-lib.mjs`, `prepare/render/verify-looping-world-proof.mjs`, `prove-alpha-bands/registered-family/canonical-container.mjs`, `world-motion-proof-lib.mjs`, `world-trajectory-lib.mjs`, `phase2-proof-lib.mjs` | ✅ reviewed (found F6) |
| Python helpers | `python-runtime.mjs`, `split_sheet.py`, `remove_chroma_key.py`, `validate_v12_schemas.py` | ✅ reviewed |
| `sync-plugin-package.mjs` (plugin packaging) | reviewed in an earlier pass (session preceding this doc) | ✅ reviewed |

Also verified clean via objective tooling: `npm run check` (tsc, 0 errors) and
`npm test` (node --test, 257/257 passing) both pass on the current `main` HEAD.

## Findings

### F1 — Dead `publish-approval` stage contradicts the repo's own anti-legacy-cruft policy

- **File**: [scripts/production-state.mjs](../scripts/production-state.mjs)
- **Severity**: low (dead code, zero runtime risk)
- **What**: `PRODUCTION_STAGES` includes `'publish-approval'` (line 21), with a full
  `stageControlByStage` entry (line 140), a `nextActionByStage` string (line 89:
  literally labeled `"旧版兼容状态"` — "legacy compat state"), and two `assertStage`
  allow-lists that reference it (lines 790, 801). No code path in
  `transitionProduction`'s switch statement, nor in `recordRender`/`transitionRender`,
  ever sets `state.stage = 'publish-approval'`. Confirmed via
  `grep -rn "stage = 'publish-approval'" scripts/` — zero matches. A final render
  transitions `final-render` straight to `complete`, skipping this stage entirely.
- **Why it matters**: [AGENTS.md](../AGENTS.md) Compatibility Policy states: *"Do not
  add migration loaders, dual-schema parsers, deprecated fields, adapters, or
  version-conditioned renderer branches unless the user explicitly requests legacy
  compatibility... A superseded path should normally be removed rather than kept
  beside its replacement."* This stage is exactly that pattern, self-labeled as such
  in its own code comment.
- **Suggested fix**: Remove `'publish-approval'` from `PRODUCTION_STAGES`, its
  `stageControlByStage` and `nextActionByStage` entries, and drop it from the two
  `assertStage` allow-lists (`request-preview-revision`'s and `approve-publish`'s).
  Zero behavior change expected since the stage is unreachable; run the full test
  suite after to confirm (`npm test`).

### F2 — `approve-publish` command exists in code but is undocumented in SKILL.md

- **Files**: [skills/make-paper-collage-video/SKILL.md](../skills/make-paper-collage-video/SKILL.md)
  vs. [scripts/project-advance.mjs](../scripts/project-advance.mjs) and
  [scripts/production-state.mjs](../scripts/production-state.mjs)
- **Severity**: medium (silent gap between documented workflow and actual system capability)
- **What**: `project:advance -- <slug> approve-publish` is fully implemented — it
  requires `final.mp4` + a passing `report.json`, requires `approvals.preview` to
  already be `approved`, and records `approvals.publish = approved`. Confirmed via
  `grep -rn "approve-publish|publish-approval" skills/make-paper-collage-video/` —
  zero matches anywhere in SKILL.md or its `references/*.md`. SKILL.md's "Preview,
  Final, and Publication" section says only: *"If the human later requests upload,
  sharing, or publication, verify content/facts/rights/platform suitability and
  obtain one just-in-time authorization for that external action"* — it never tells
  the agent to persist that authorization via `project:advance approve-publish`.
- **Why it matters**: An agent following SKILL.md literally will verbally/
  conversationally authorize a publish action but never call the command that
  records it in `production.json`. `approvals.publish` stays `pending` forever even
  after a real external-publish authorization happened, which undermines the
  system's own "attributable approval fingerprints" design goal.
- **Suggested fix**: Add one sentence to SKILL.md's "Preview, Final, and
  Publication" section instructing the agent to run
  `project:advance -- <slug> approve-publish --note="<explicit decision>"` after
  obtaining the just-in-time external-publish authorization. Low-risk, additive-only
  change to SKILL.md prose; no code change needed unless F1's stage cleanup also
  touches the `approve-publish` allow-list (it would need to be updated to accept
  only `['complete']` once `publish-approval` is removed).

### F3 — `inspectTravelFacing` recomputes the entire scene composition tree per sampled frame

- **File**: [scripts/spatial-contract-lib.mjs:1204-1363](../scripts/spatial-contract-lib.mjs)
  (specifically the sampling loop at line ~1260)
- **Severity**: low risk, clear performance win
- **What**: Inside the per-frame sampling loop (`for (let frame = fromFrame; frame <= throughFrame; frame += 1)`),
  every iteration calls `resolveSceneNodes({scene, video: project.video, progress})`
  (line 1260) to get one node's position. `resolveSceneNodes` internally calls
  `deriveSceneTimeline(...)` again (line 336) and walks the *entire* composition
  node tree, resolving motion/idle/emphasis/parallax/world-offset transforms for
  every node in the scene — not just the one target node — on every single frame.
  For a travel-facing proof window spanning tens to hundreds of frames, this is
  tens to hundreds of full-tree recomputations to extract one point per frame.
- **Why it matters**: Same file's `inspectGait` (lines 1079-1202), which does the
  analogous per-frame sampling for a similar contract kind, gets this right: it
  resolves the node *once* before the loop, then calls the lightweight
  `resolveSequenceState({node, progress})` inside the loop. `inspectTravelFacing`
  is the only one of the four contract inspectors that doesn't follow this pattern.
- **Suggested fix**: Restructure `inspectTravelFacing`'s sampling loop to mirror
  `inspectGait`: resolve `entry` once (already done, at line ~1222, before the
  loop), then inside the loop use a lighter per-frame position lookup instead of a
  fresh `resolveSceneNodes` call — e.g. call `resolveSequenceState({node, progress})`
  for state/facing plus a scoped position computation for just the target node's
  transform chain, rather than re-walking the whole tree. Verify with a
  representative project (e.g. a scene with a `travel-facing` spatial contract) that
  `project:composition-proof` still produces identical measurements before/after.

### F4 — `provider-record.mjs` silently discards an explicit `--model` override when the reserved attempt already has a model

- **File**: [scripts/provider-record.mjs:45-54](../scripts/provider-record.mjs)
- **Severity**: low (narrow repro window, not a budget/security issue, but a
  silently-ignored user input)
- **What**:
  ```js
  const reportedModel = valueFor('--model');
  const inheritedModel = attempt?.model ?? null;
  if (reportedModel && inheritedModel && reportedModel !== inheritedModel) {
    normalizeReportedModel({provider, model: reportedModel});   // return value discarded
  }
  ...
  model: inheritedModel ?? normalizeReportedModel({provider, model: reportedModel}),
  ```
  `normalizeReportedModel` only checks that `reportedModel` is a valid alias of the
  *provider's own configured default model* — it takes no `inheritedModel`
  parameter and never compares against it. So the `if` block at lines 47-49 doesn't
  actually validate consistency between `reportedModel` and `inheritedModel`; it can
  pass (no throw) even when the two genuinely disagree, as long as `reportedModel`
  happens to match the provider's static config. And regardless of what that check
  concludes, the final `model` value recorded into the manifest (line 54) is always
  `inheritedModel` when it's non-null — `reportedModel`'s validated form is never
  actually used.
- **Why it matters**: If an operator passes `--model=X` when recording an
  already-reserved attempt whose ledger says a different model was reserved, the
  ledger's model silently wins with no warning that the explicit flag was ignored,
  and the "validation" that ran doesn't actually check what it appears to check.
- **Suggested fix**: Either (a) remove the dead check at lines 47-49 and document
  that `--model` is ignored once an attempt has an inherited model, or (b) make the
  check meaningful: compare `normalizeReportedModel({provider, model: reportedModel})`
  against `inheritedModel` directly and throw a clear error on mismatch instead of
  silently preferring `inheritedModel`. Option (b) seems more consistent with the
  rest of the codebase's "reject drift, don't silently resolve it" philosophy shown
  everywhere else in `generation-attempt-lib.mjs` and `provider-lib.mjs`.

### F5 — `RUNTIME_BUILD_INPUTS` omits two files that are transitively imported into the tracked render/validation code, so their logic changes silently escape every runtime-build-fingerprint check

- **File**: [scripts/runtime-build-lib.mjs](../scripts/runtime-build-lib.mjs) (the
  `RUNTIME_BUILD_INPUTS` array); missing entries are
  `scripts/state-sheet-lib.mjs` and `scripts/timeline-continuity-lib.mjs`.
- **Severity**: medium (silent proof-currency gap, not a data-corruption bug —
  no user-visible symptom until someone edits one of the two missing files)
- **What**: `RUNTIME_BUILD_INPUTS` is a hand-maintained list of every file whose
  content is SHA-256'd into the runtime build fingerprint
  (`createRuntimeBuildFingerprint`/`createRuntimeSurfaceFingerprint`). Every
  proof-harness script (`project-composition-proof.mjs`, `style-proof-lib.mjs`,
  `prepare-phase2-proof.mjs`, `verify-phase2-proof.mjs`,
  `prepare-looping-world-proof.mjs`, `verify-looping-world-proof.mjs`,
  `style-motion-proof.mjs`, `verify-vox-sample.mjs`) stamps its recorded
  evidence with this fingerprint specifically so that a later runtime-code edit
  is detectable as "this proof is stale, re-verify it." `digestRuntimeInput`
  hashes only the literal files named in the list — it does not walk imports —
  so completeness of the list is load-bearing.

  Tracing the actual import graph from `src/index.ts` and from
  `render-cache-lib.mjs` (whose `createVisualFingerprint`/`createAudioFingerprint`
  are exactly what the surface fingerprints gate) shows two files reachable
  that are absent from the list:
  - `scripts/state-sheet-lib.mjs` — imported by `composition-lib.mjs` (already
    listed) and used inside `validateComposition` as
    `inspectStateAnchorRegistration`, which enforces the state-sequence
    anchor-drift tolerance (`anchorPolicy.maximumDrift`). Also imported by
    `quality-lib.mjs` for the same anchor-registration check.
  - `scripts/timeline-continuity-lib.mjs` — imported by `project-lib.mjs`
    (already listed) and used inside `validateProject` as
    `assessTimelineContinuity`, which enforces the scene-tail budget and
    intentional-hold-duration checks.
- **Why it matters**: Both files implement deterministic-check logic — exactly
  the category of code the runtime-build fingerprint exists to protect. If
  someone tunes the anchor-drift tolerance or the tail-budget thresholds in
  either file, every previously-recorded proof (composition proof, style proof,
  phase2 proof, looping-world proof, style-motion proof, VOX-sample proof)
  keeps reporting the *same* `runtimeBuildFingerprint` as current, because
  neither changed file is part of the hashed input set. A proof recorded under
  the old (looser or stricter) thresholds will silently continue to be treated
  as valid evidence against the new code, defeating the anti-drift purpose the
  rest of the codebase applies consistently everywhere else (this is the same
  "recompile → fingerprint → compare" pattern noted throughout this review; here
  the *input list feeding the fingerprint* has the drift, not the comparison
  logic itself).
- **Suggested fix**: Add both files to `RUNTIME_BUILD_INPUTS` in
  `scripts/runtime-build-lib.mjs`. Since they're reachable from `project-lib.mjs`
  and `composition-lib.mjs` (both already in every surface except where
  explicitly excluded), they most likely belong in the same surfaces those two
  files are in — verify against `AUDIO_DELIVERY_ONLY_INPUTS` /
  `SUBTITLE_PRESENTATION_INPUTS` exclusion lists so the per-surface filtering
  stays consistent. As a broader safeguard, consider a build-time or test-time
  check (e.g. a small script comparing `RUNTIME_BUILD_INPUTS` against the
  actual transitive import graph of `src/index.ts` + `render-cache-lib.mjs`)
  so this list can't silently drift out of sync again as new files are added —
  this class of bug (a manually maintained file list falling out of sync with
  the real dependency graph) has no test coverage today.

### F6 — `vox-sample-proof-lib.mjs` check `project-contract-v10` has a stale `expected: 10` label left over from a v10→v12 schema rename

- **File**: [scripts/vox-sample-proof-lib.mjs:43-48](../scripts/vox-sample-proof-lib.mjs)
- **Severity**: low (cosmetic — the pass/fail determination is correct; only the
  reported `expected` value in the evidence artifact is wrong)
- **What**:
  ```js
  {
    id: 'project-contract-v10',
    passed: project.schemaVersion === 12 && storyboard.schemaVersion === 12,
    expected: 10,
    actual: {project: project.schemaVersion, storyboard: storyboard.schemaVersion},
  },
  ```
  The check's `id` and its `expected` field both say `10`, but `passed` is
  computed against `=== 12` — the schema version this codebase has actually
  been on throughout (`storyboard.schemaVersion === 12`,
  `project.schemaVersion === 12` elsewhere across the reviewed code). This is
  a leftover from an earlier v10→v12 rename that updated the comparison logic
  but not the id/label.
- **Why it matters**: `buildVoxSampleProofReport`'s output is a signed proof
  artifact reviewed by whoever approves the VOX sample; the artifact literally
  states "expected 10" next to `actual: {project: 12, storyboard: 12}` for a
  check that in fact passed. Anyone reading the report to confirm what was
  verified is told the wrong target value — misleading evidence, even though
  the verdict itself (`passed`) is correct.
- **Suggested fix**: Rename `id: 'project-contract-v10'` → `'project-contract-v12'`
  and `expected: 10` → `expected: 12`.

## Open questions for the implementing agent

- F1 and the `approve-publish` allow-list interact: if F1's dead-stage removal
  lands, `approve-publish`'s `assertStage(state, ['publish-approval', 'complete'], action)`
  should become `assertStage(state, ['complete'], action)` in the same change.
- F2 is a documentation-only fix; it does not require touching
  `production-state.mjs` or `project-advance.mjs`.
