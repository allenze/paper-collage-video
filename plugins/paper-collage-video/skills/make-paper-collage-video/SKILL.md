---
name: make-paper-collage-video
description: Initialize, create, resume, revise, or productize editable Remotion paper-collage videos with rhythmic storyboards, persistent visibility events, intent-routed opaque scene transitions, registered limited-animation state sequences, batched pose-sheet generation, semantic identity/mechanism/diagram contracts, layered keyframe motion, audiovisual events, proof-time validation, dead-air continuity checks, budgeted providers, dual-scope quality review, and local final delivery. Use for paper-cutout, hand-drawn explainer, historical collage, layered illustration, parallax explainer, functional-object diagrams, recurring-character stories, or an interrupted project that has production.json.
---

# Make Paper Collage Video

Build an editable video while keeping the human in charge of concept, style/voice, preview judgment, rights, and external publication. Use `production.json` as the resume source of truth.

## Start With One Small State Read

1. Treat the current directory as a workspace only when `package.json` exposes `project:new`, `project:resume`, `project:preview`, and `project:render`. Otherwise read [references/setup.md](references/setup.md), bootstrap a writable workspace, and run its doctor. If this Skill was injected from a versioned plugin-cache path that no longer exists, stop and report a stale task snapshot. Do not scan for or silently select the highest cached version; start a new Codex task so the loader formally exposes the installed version.
2. Inspect `git status --short` in Git workspaces and preserve unrelated changes.
3. For an existing slug, run only:

   ```bash
   npm run project:resume -- <slug>
   ```

   Continue from `control.mode` and the remaining work items. Do not repeat recorded approvals or read full history unless diagnosing state.
4. For a new project, derive a lowercase hyphenated slug and run `project:new`.

## Load Only the Current Stage Reference

- Workspace creation or doctor failure: [references/setup.md](references/setup.md)
- Provider discovery, confirmation, change, or output recording: [references/providers.md](references/providers.md)
- Duration, scenes, rhythmic storyboard, or production-profile planning: [references/story-planning.md](references/story-planning.md)
- Per-beat animation choice, effect routing, pose families, graphics, or directing budget: [references/motion-directing.md](references/motion-directing.md)
- Narration resync, scene tails, intentional quiet holds, pacing, or dead-air failures: [references/timing-continuity.md](references/timing-continuity.md)
- Concept/style/preview decisions, rights, or external action: [references/approval-gates.md](references/approval-gates.md)
- Image review, depth, motion, subtitles, or delivery tuning: [references/quality-motion.md](references/quality-motion.md)
- Recurring identities, functional mechanisms, topology-sensitive subjects, or explanatory diagrams: [references/semantic-contracts.md](references/semantic-contracts.md)
- Editing project/state files or diagnosing validation: [references/project-contract.md](references/project-contract.md)
- Tool-only image generation, recovery, or an `auto-continue` blocker: [references/execution-control.md](references/execution-control.md)

Do not load every reference up front.

## Apply Reversible Defaults

- Use 1920×1080, 30 fps, a general Chinese-language audience, layered paper collage, and the configured fictional narrator unless the brief requires otherwise.
- Preserve user-specified duration and scene count independently; infer only missing values.
- Default to the `balanced` production profile. Treat the plan's generated-image and motion budgets as ceilings unless the human approves a profile change. Whenever the human can revise the plan, show `draft`, `balanced`, and `full-depth` as direct structured choices with the current scene count's exact attempt ceiling, pose-sheet capacity, and one-line final-film effect; do not hide them behind a generic free-text “modify” option.
- Do not clone a real person, use unclear third-party rights, publish, upload, or send externally without separate authorization.
- Ask only for missing information that materially changes the subject, factual position, rights boundary, delivery format, or material cost.

## New Project: One Concept and Provider Decision

At `capability-review`, use the current host model only to prepare a provisional brief and concept; do not call an unconfirmed external or paid provider.

1. Read `providers.md`, `story-planning.md`, `motion-directing.md`, and `approval-gates.md`.
2. Run `provider:status -- <slug> --compact-json` once and inspect actual callable host tools.
3. Fill `brief.md`. Run `project:plan` with resolved duration, scenes, narration estimate, rationale, `--profile=draft|balanced|full-depth`, and `--json`. Use `decision.profileOptions` and `decision.durationAuthority` as the structured confirmation source instead of recalculating labels or budgets in prose.
4. Author one schema-v6 storyboard input with a whole-film arc, shared visual language, one scene record per planned scene, and exactly one `sceneTransitions[]` boundary for every adjacent pair. For each boundary, declare an editorial `intent` and concrete `rationale`; normally omit execution fields so `project:storyboard` deterministically routes `continuity`, `location-change`, `time-passage`, `focus-reveal`, or `chapter-reset` to a registered animated paper transition. `impact-cut` is the only intent allowed to compile to `cut`. Override the registered recipe only when the approved visual language motivates another legal type. Classify each beat's visible change and author orthogonal `treatments` for motion, persistent visibility, composition relationship, graphic mechanism, semantic risk, importance, and necessity. Do **not** hand-author `compositionPlan`, directing summaries, fingerprints, or sheet grids; `project:storyboard` compiles those deterministically, checks the selected production profile's motion budget, and rejects cheap-transform substitutions for real pose changes. Every scene still needs at least three ordered beats and three proof moments including a final state after `at=0.82`; every proof declares `stateAssertions`, and every beat declares `proofTimeId` or `null`.
5. Present one compact decision containing:
   - narration position, scene outline, facts, style, reusable asset plan, and each scene's blueprint/beat rhythm;
   - requested versus inferred duration/scenes;
   - production profile, generated-image budget, pose-sheet/continuous-motion budget, and compiled calls avoided;
   - proposed text/image/voice providers, model/voice identity, and material cost.
   - identity-, topology-, mechanism-, and diagram-critical risks that will require reusable semantic contracts before generation.
6. Ask once to approve the concept, storyboard, budget, and all unresolved providers. If the human chooses to revise, present each bounded cost/output enum—especially production profile—as its own structured selector with its exact numeric effect. On approval, write one selection JSON containing `planDecision` copied from the selected plan decision plus provider selections, then run:

   ```bash
   npm run project:confirm-concept -- <slug> --input=<selection.json>
   ```

   This records all providers plus `capabilities-ready`, `brief-ready`, and `approve-concept`; do not ask for concept approval again.

If a custom provider or incompatible explicit duration/scenes cannot be resolved in the combined decision, remain at the gate and ask one concise question.

## Style and Fictional Voice Gate

At `style-review`, create one representative image and only enough fictional speech to judge the voice. Run `style:proof`; it must select the storyboard compiler's highest-risk treatment instead of whichever scene happens to appear first, bind the proof to that directing fingerprint, and render 3–5 seconds through real v7 nodes. For a coupled proof, inspect its full-resolution relationship crops, alpha masks, checkerboard isolates, tight crops, and motion-stress sheets, then record the required asset and composite semantic checks with those evidence files. Show provider/model, voice identity, sample artifacts, and known cost. After explicit approval, run:

Before any style image call, classify its semantic risk. If it is not decorative, author and lock `semantic-contracts.json` as described in `semantic-contracts.md`; do not treat the prompt as the contract. Use schema-v5 image requests and reserve quota-consuming attempts before invoking a host image provider.

```bash
npm run project:advance -- <slug> approve-style-voice --note="<explicit decision>"
```

`approve-style-voice` refuses coupled projects whose style-proof fingerprint is missing/stale, whose evidence bundle is incomplete, or whose participating assets/composite have pending semantic checks. This strengthens the existing gate; it does not add another human wait. After revisions, remain at this gate.

Never substitute a real-person clone. Treat cloning as a separate opt-in requiring licensed audio and transcript authorization.

## Produce in Batches

At `asset-production`:

1. Group checkpoints by recoverable batch or location, not by every file. Keep provider provenance per asset.
2. Classify every image as `decorative`, `identity-critical`, `topology-critical`, `mechanism-critical`, or `diagram-critical`. Bind every critical request to a ready reusable semantic contract and its evidence targets. Keep recurring-character `generationFamily` separate from composition mask/source families.
3. Route relationships before generation: persistent `inside`/`on`/`held-by`/`worn-by` contact uses `supported-subject`; a shared shoreline/horizon/edge uses `registered-environment`; only independent elements use `free`. If no pattern represents the approved meaning, extend the reusable contract before bulk generation.
4. For every coupled group, generate or import one complete master, derive all registered members and masks from it, and record the same `registrationId` and `sourceMasterAssetId`. Never generate coupled members independently or repair the relationship with arbitrary z-index offsets.
   - Do not use a coarse polygon matte for an articulated or internally open subject such as a person, animal, vehicle, chair, tree, rope, or bicycle. Use a capable segmentation/matting path or a carefully reviewed manual matte.
   - If reliable extraction is unavailable, preserve the approved complete master as one rigid visual family and limit motion to whole-master/camera movement. Less local motion is preferable to a damaged silhouette.
5. Create schema-v5 requests and try `provider:reuse` before paid or slow generation. Follow `storyboard.directingSummary.poseSheetPlans`: every multi-state identity/prop family gets one registered 2×2 or 3×2 `stateSheetBinding` provider request, never one call per state. Process it with `npm run assets:process-state-sheet -- <state-sheet.json>`; the processor preserves one canvas for every cell, keys locally, records each derivative, and the final report exposes provider calls and isolated calls avoided. For a failed cell, first rerun deterministic local processing. If provider repair is necessary, use `masked-sheet-edit` with the complete recorded sheet as context and prove every untargeted cell unchanged; if the provider cannot do that reliably, regenerate the complete sheet. Never generate or splice an isolated replacement cell for a multi-state family. Do not batch unrelated identities merely to fill cells.
6. Before a host provider-generation/edit call, run `provider:attempt reserve`; pass its attempt id to `provider:record`. `provider:run` reserves automatically for command adapters. Close abandoned attempts explicitly; never erase the ledger. Stay within the approved attempt budget. Rejected, abandoned, and unused provider results still count when quota was consumed. Registered sheet crops, masks, alpha extractions, and exact reuse do not consume another slot.
7. Run `project:quality prepare`, inspect original-resolution files plus generated alpha/checkerboard/motion-stress/semantic-target evidence, and record asset reviews in batches with `evidenceFiles` for every evidence-required check. Do not pass a semantic check merely to unblock production. A hard-alpha `key-edge-clean` result proves only that no soft matte contamination was detected; it does not prove silhouette fidelity, identity distinctness, mechanism correctness, or subject completeness.
8. Generate/import one narration file per scene so revisions remain local. Before each production voice call, add `timingBinding` to its request with the storyboard scene id and allowed minimum/maximum media duration; `provider:record` measures and rejects an unfit take before assembly. Implement the compiled plan exactly: continuous treatments need real keyframe/idle motion on the named target, visibility treatments need a node `visibility.initial` plus a matching persistent visibility event, graphic treatments need editable text/shape nodes, coupled patterns need their registered group, and every state family needs one `state-sequence` node. Never emulate state replacement or a visibility lifecycle with overlapping assets and opacity toggles. Copy approved proof ids/times/assertions/stateAssertions exactly. Map every storyboard beat to one or more ordered `scene.events[]` records; keep visual and sound on the same event when they are one beat. Use the storyboard's approved proof id for critical visual/sound events.
9. Run `project:composition-proof`; it synchronizes real narration duration, reuses fingerprint-current frames/targets, renders only changed relationship and semantic-contract evidence, and creates alpha/checkerboard/tight-crop/motion-stress evidence for post-style coupled assets. Then run `project:quality scaffold --output=projects/<slug>/quality-review-scaffold.json --reviewer=<reviewer>`, inspect every suggested evidence file, fill pass/fail decisions and notes, and record the edited scaffold with `record-batch`. Never treat the scaffold as an approval.
10. Read `timing-continuity.md`, then seal the production set with one command:

   ```bash
   npm run project:assets-ready -- <slug>
   ```

   It synchronizes narration, caps padding tails when duration was inferred, derives subtitles, runs an audio-only LUFS/true-peak preflight with a bounded gain recommendation, validates v7 composition/state schedules/events/intent-routed scene-boundary continuity, rejects stale proof fingerprints, enforces both asset and composite quality, and advances to preview. In `preview` or `human-review`, the same command is an idempotent recheck and does not advance again. Explicit duration deficits block here; add real content or revise the approved target instead of padding. This stage cannot claim rendered audiovisual coverage because no artifact exists yet. Do not run separate sync/subtitles/validate commands first.
11. Run `project:preview`. Its post-render report is the first authoritative silence/low-motion union check. The renderer reuses an unchanged artifact, or reuses the existing video stream and performs audio-only remuxing when only audio inputs/gain changed; any visual fingerprint change forces a full render. Repair failures and continue autonomously until it reaches `human-review`.

Normal production commands update `projects/<slug>/production-metrics.json`. Treat AI-review and provider-attempt durations as end-to-end session windows, not provider-only inference time; do not infer token usage. Run `project:metrics -- <slug>` once when comparing completed projects or diagnosing a slowdown, rather than polling it during production.

If a confirmed provider becomes unavailable, preserve the stage and report the exact missing capability. Never invent artifacts or silently switch paid services.

## Preview, Final, and Publication

At `human-review`, show `preview.mp4`, `contact-sheet.jpg`, `transition-contact-sheet.jpg` when the film has scene boundaries, and `report.json`, separating technical results from creative judgment. Confirm `continuityAnalysis.passed`; the report rejects unapproved intervals that are both silent and low-motion. Record revision feedback in `review.md` and `request-preview-revision`; after explicit approval run:

```bash
npm run project:advance -- <slug> approve-preview --note="<explicit decision>"
```

After preview approval, run `project:render`. A successful final render completes the local production task and reports `final.mp4`, the contact sheet, validation report, and technical acceptance result.

Do not ask for a publication approval merely to mark local delivery complete. If the human later requests upload, sharing, or publication, verify content/facts/rights/platform suitability and obtain one just-in-time authorization for that external action.

## Keep Turns Lean and Recoverable

- Run `project:resume` once at the start of a new turn or after an interruption; do not pair it with full status or `project:handoff-check`.
- At `asset-production`, a null `control.nextCommand` means continue `control.workItems.remaining[0]`; when no batch remains, resume returns the concrete `project:assets-ready` command.
- In `auto-continue`, continue to `control.nextCommand` or the next remaining work item. A tool result is not a human gate.
- End normally only at a human gate, completion, or a genuine blocker with one required user action.
- When implementation files change, run `npm run check`, relevant validation/tests, and `npm run plugin:sync` before validating the packaged Skill/runtime.
