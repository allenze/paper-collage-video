---
name: make-paper-collage-video
description: Initialize, create, resume, revise, or productize editable Remotion paper-collage videos with pre-provider layer-complete planning, registered depth stacks and subject families, responsive reveal envelopes, actual-audio edit points, editorial typography and data SVG, limited-animation state sheets, camera parallax, deterministic motif fields, semantic identity/topology/mechanism/diagram contracts, proof-time and continuity validation, exact human-approved provider budgets, dual-scope quality review, and local final delivery. Use for paper-cutout stories, hand-drawn explainers, historical collage, layered or parallax illustration, functional diagrams, recurring characters, and interrupted projects with production.json.
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
- Any rear/subject/front separation, relative layer motion, source package, or reveal envelope: [references/layer-complete-assets.md](references/layer-complete-assets.md)
- Narration resync, scene tails, intentional quiet holds, pacing, or dead-air failures: [references/timing-continuity.md](references/timing-continuity.md)
- Concept/style/preview decisions, rights, or external action: [references/approval-gates.md](references/approval-gates.md)
- Image review, depth, motion, subtitles, or delivery tuning: [references/quality-motion.md](references/quality-motion.md)
- Recurring identities, functional mechanisms, topology-sensitive subjects, or explanatory diagrams: [references/semantic-contracts.md](references/semantic-contracts.md)
- Editing project/state files or diagnosing validation: [references/project-contract.md](references/project-contract.md)
- Audio edit points, typography, annotations, data SVG, responsive directing, or advanced transitions: [references/editorial-system-v9.md](references/editorial-system-v9.md)
- Tool-only image generation, recovery, or an `auto-continue` blocker: [references/execution-control.md](references/execution-control.md)

Do not load every reference up front.

## Apply Reversible Defaults

- Use 1920×1080, 30 fps, a general Chinese-language audience, layered paper collage, and the configured fictional narrator unless the brief requires otherwise.
- Preserve user-specified duration and scene count independently; infer only missing values.
- Default to the `balanced` production profile. Treat its generated-image budget as a planning ceiling, not the project's spend authorization. The combined concept decision must also name an exact `budgetDecision.imageAttemptLimit` no greater than that ceiling and no lower than the compiled expected calls; this narrower human-approved cap is what the attempt ledger enforces. Whenever the human can revise the plan, show `draft`, `balanced`, and `full-depth` as direct structured choices with the current scene count's exact profile ceiling, pose-sheet capacity, and one-line final-film effect; do not hide them behind a generic free-text “modify” option.
- Do not clone a real person, use unclear third-party rights, publish, upload, or send externally without separate authorization.
- Ask only for missing information that materially changes the subject, factual position, rights boundary, delivery format, or material cost.

## New Project: One Concept and Provider Decision

At `capability-review`, use the current host model only to prepare a provisional brief and concept; do not call an unconfirmed external or paid provider.

1. Read `providers.md`, `story-planning.md`, `motion-directing.md`, and `approval-gates.md`.
2. Run `provider:status -- <slug> --compact-json` once and inspect actual callable host tools.
3. Fill `brief.md`. Run `project:plan` with resolved duration, scenes, narration estimate, rationale, `--profile=draft|balanced|full-depth`, and `--json`. Use `decision.profileOptions` and `decision.durationAuthority` as the structured confirmation source instead of recalculating labels or budgets in prose.
4. Author one schema-v10 storyboard input with a whole-film arc, shared visual language, one scene record per planned scene, one v9 `editorial` authoring contract, and exactly one `sceneTransitions[]` boundary for every adjacent pair. Read `editorial-system-v9.md` when the film uses actual-audio edit points, reusable typography, annotations, data SVG, responsive plans, or advanced transitions; never substitute estimated narration or TTS latency for final local-audio timing. For each boundary, declare the narrative `intent` and concrete `rationale`; normally omit `treatment` so `project:storyboard` deterministically routes `continuity`, `location-change`, `time-passage`, `focus-reveal`, or `chapter-reset` to a registered animated paper transition. Use `intent=impact` plus `treatment.motivation=impact` for an impact cut. An ordinary narrative intent may instead use `treatment={type:"cut", motivation:"rhythmic", durationSeconds:0, beatId}` when the beat is in the outgoing final 20% or incoming first 20%. Classify each beat's visible change and author orthogonal `treatments` for motion, persistent visibility, composition relationship, graphic mechanism, semantic risk, importance, and necessity. Before any rear/subject/front source generation, read `layer-complete-assets.md`, choose `rigid-locked` or `bounded-relative`, and author the stable source package, exact complete layer roles, depth order, source strategy, and three responsive reveal envelopes. Use `registered-depth-stack` only for a truly layer-complete family; an opaque flat master is never a source for relative member motion. Use `depth-parallax`/`parallax-camera` for actual camera-coupled depth and `decorative-field`/`motif-field` for bounded repeated decoration. Do **not** hand-author `compositionPlan`, source-package call totals, resolved edit points, responsive/transition plans, directing summaries, fingerprints, style-proof plans, or sheet grids; `project:storyboard` compiles those deterministically and rejects cheap-transform or visible-fragment substitutions. Every scene still needs at least three ordered beats and three proof moments including a final state after `at=0.82`; every proof declares `stateAssertions`, and every beat declares `proofTimeId` or `null`.
5. Present one compact decision containing:
   - narration position, scene outline, facts, style, reusable asset plan, and each scene's blueprint/beat rhythm;
   - requested versus inferred duration/scenes;
   - production profile, base image attempts, layer-package reserve, profile hard ceiling, proposed human-approved image-attempt cap, pose-sheet/continuous-motion budget, and compiled provider calls/local derivatives/calls avoided;
   - proposed text/image/voice providers, model/voice identity, and material cost.
   - identity-, topology-, mechanism-, and diagram-critical risks that will require reusable semantic contracts before generation.
6. Ask once to approve the concept, storyboard, budget, all compiled source packages, and all unresolved providers. If the human chooses to revise, present each bounded cost/output enum—especially production profile and exact image-attempt cap—as its own structured selector with its exact numeric effect. On approval, write one selection JSON containing `planDecision`, `budgetDecision`, `sourcePackageDecision`, and provider selections copied exactly from the decision, then run:

   ```bash
   npm run project:confirm-concept -- <slug> --input=<selection.json>
   ```

   This records all providers plus `capabilities-ready`, `brief-ready`, and `approve-concept`; do not ask for concept approval again.

If a custom provider or incompatible explicit duration/scenes cannot be resolved in the combined decision, remain at the gate and ask one concise question.

## Style and Fictional Voice Gate

At `style-review`, create the fewest representative source families needed by the compiler-owned `styleProofPlan` and only enough fictional speech to judge the voice. Run `style:proof`; it must cover the plan's highest semantic-risk classes, each concrete coupled relationship, and state-sequence behavior instead of mechanically selecting one highest score. A low-risk film with none of those facets still gets one `baseline:representative` target. One source package may cover several risks when the plan records that reuse. Bind every target and the complete plan fingerprint, then render 3–5 seconds through real v10 composition nodes. Every selected target, including a `free` target, must produce a non-empty structured composite with current full-frame/crop/debug evidence. Registered or semantic targets also require their quality-compatible member evidence and recorded checks. Inspect full-resolution relationship crops and the pattern-specific evidence from `quality-motion.md`; a registered depth stack requires family-level reconstruction and responsive envelope extremes. Show provider/model, voice identity, sample artifacts, and known cost. After explicit approval, run:

Before any style image call, classify its semantic risk. If it is not decorative, author and lock `semantic-contracts.json` as described in `semantic-contracts.md`; do not treat the prompt as the contract. Use schema-v7 image requests with an explicit output surface; a layer-aware request must also carry the exact compiled `layerPackageBinding`. Reserve quota-consuming attempts before invoking a host image provider.

```bash
npm run project:advance -- <slug> approve-style-voice --note="<explicit decision>"
```

`approve-style-voice` refuses any selected treatment whose style-proof composite is missing, empty, stale, or incomplete. Registered/semantic targets additionally require their participating assets and composites to have current passed checks. This strengthens the existing gate; it does not add another human wait. After revisions, remain at this gate.

Never substitute a real-person clone. Treat cloning as a separate opt-in requiring licensed audio and transcript authorization.

## Produce in Batches

At `asset-production`:

1. Group checkpoints by recoverable batch or location, not by every file. Keep provider provenance per asset.
2. Classify every image as `decorative`, `identity-critical`, `topology-critical`, `mechanism-critical`, or `diagram-critical`. Bind every critical request to a ready reusable semantic contract and its evidence targets. Keep recurring-character `generationFamily` separate from composition mask/source families.
3. Route relationships before generation: persistent `inside`/`on`/`held-by`/`worn-by` contact uses `supported-subject`; a shared shoreline/horizon/edge uses `registered-environment`; only independent elements use `free`. If no pattern represents the approved meaning, extend the reusable contract before bulk generation.
4. Execute each compiled layer source package exactly as described in `layer-complete-assets.md`. A `registered-layer-sheet` is one 2×2 provider source containing reference plus three complete layers. `context-preserving-layer-edits` is one complete reference plus three edits that each retain that full reference context. Then author one schema-v2 `registered-family` spec and run `assets:derive-registered-family`; it owns canvas-preserving local derivatives, manifest provenance, completeness, lifecycle, and optional group patching. Never use masks on a flat composed master to claim a hidden clean plate or full silhouette. If only a flat source exists, keep the family `rigid-locked` and limit motion to the whole source/group/camera.
5. Create schema-v7 requests and try `provider:reuse` before paid or slow generation. Follow both `storyboard.directingSummary.generationBudget.sourcePackagePlans` and `poseSheetPlans`. Every multi-state identity/prop family still gets one registered 2×2 or 3×2 `stateSheetBinding` provider request, never one call per state. Process it with `assets:process-state-sheet`; preserve one canvas for every cell. Never generate or splice an isolated replacement layer or state.
6. Validate a request with `provider:request validate` before invoking it. Before a host provider-generation/edit call, run `provider:attempt reserve`; use the returned canonical invocation and pass its attempt id to `provider:record`. The record command inherits provider/model from that attempt. `provider:run` reserves automatically for command adapters. Close abandoned attempts explicitly; never erase the ledger. If a succeeded attempt was closed but manifest writing failed, use `provider:recover-record`; do not reserve or count it again. Use `provider:attempt summary` for read-only auditing; it must show the profile ceiling, human-approved cap, usage, reservations, and remaining capacity. Never invoke against a missing approval or the profile ceiling alone. Rejected, abandoned, and unused provider results still count when quota was consumed. Registered sheet crops, masks, alpha extractions, and exact reuse do not consume another slot.
7. Keep manifest-v4 lifecycle truthful. New records are `active`; replacements preserve the prior record as `superseded`. Mark rejected or context-only sources with `project:asset-lifecycle`. Run `project:quality prepare` and inspect original-resolution evidence. Transparent members receive deterministic alpha-band analysis at source and actual render scale. A `registered-depth-stack` additionally requires neutral reconstruction, reference comparison, checkerboard exploded members, and both extremes of all three responsive reveal envelopes; isolated-asset motion stress is not family proof. Parallax rigs and motif fields remain composite targets. Never pass a semantic check merely to unblock production.
8. Generate/import one narration file per scene so revisions remain local. Before each production voice call, add `timingBinding` to its request with the storyboard scene id and allowed minimum/maximum media duration; `provider:record` measures and rejects an unfit take before assembly. Implement the compiled plan exactly: continuous treatments need real keyframe/idle motion on the named target; `parallax-camera` needs `camera.parallax.enabled=true`, visible camera movement, and at least two distinct node depths; a compiled motif field needs one matching deterministic `motif-field` node with the same preset/distribution/count/cycles/bounds/exclusionZones. Visibility treatments need a node `visibility.initial` plus a matching persistent visibility event, graphic treatments need editable text/shape nodes, coupled patterns need their registered group, and every state family needs one `state-sequence` node. Never emulate state replacement, a visibility lifecycle, depth parallax, or a motif field with overlapping asset piles and opacity toggles. Copy approved proof ids/times/assertions/stateAssertions exactly. Map every storyboard beat to one or more ordered `scene.events[]` records; keep visual and sound on the same event when they are one beat. Use the storyboard's approved proof id for critical visual/sound events.
9. Run `project:composition-proof`; it synchronizes real narration duration, reuses only current fingerprints, renders changed relationship and semantic-contract evidence, creates per-member alpha/checkerboard/tight/alpha-band evidence, and creates the family-aware layer-stack proof described above. Use `--force` only for an intentional complete rerender. Then scaffold, inspect, and record quality reviews. Never treat the scaffold as an approval.
10. Read `timing-continuity.md`, then seal the production set with one command:

   ```bash
   npm run project:assets-ready -- <slug>
   ```

   It synchronizes narration, caps padding tails when duration was inferred, derives subtitles, runs an audio-only LUFS/true-peak preflight with a bounded gain recommendation, validates schema-v10 project/storyboard plus v9 editorial/state schedules/events/scene-boundary continuity, rejects stale proof fingerprints, enforces both asset and composite quality, and advances to preview. In `preview` or `human-review`, the same command is an idempotent recheck and does not advance again. Explicit duration deficits block here; add real content or revise the approved target instead of padding. This stage cannot claim rendered audiovisual coverage because no artifact exists yet. Do not run separate sync/subtitles/validate commands first.
11. Run `project:preview`. Its post-render report is the first authoritative silence/low-motion union check. The renderer reuses an unchanged artifact, or reuses the existing video stream and performs audio-only remuxing when only audio inputs/gain changed; any visual fingerprint change forces a full render. Repair failures and continue autonomously until it reaches `human-review`.

Normal production commands update `projects/<slug>/production-metrics.json`. Treat AI-review and provider-attempt durations as end-to-end session windows, not provider-only inference time; do not infer token usage. Run `project:metrics -- <slug>` once when comparing completed projects or diagnosing a slowdown, rather than polling it during production.

If a confirmed provider becomes unavailable, preserve the stage and report the exact missing capability. Never invent artifacts or silently switch paid services.

## Preview, Final, and Publication

At `human-review`, show `preview.mp4`, `contact-sheet.jpg`, `transition-contact-sheet.jpg` when the film has scene boundaries, and `report.json`, separating technical results from creative judgment. Confirm `continuityAnalysis.passed`; the report rejects unapproved intervals that are both silent and low-motion. Record revision feedback in `review.md` and `request-preview-revision`; after explicit approval run:

```bash
npm run project:advance -- <slug> approve-preview --note="<explicit decision>"
```

When the human requests a directing-only revision, export/edit the current compiled storyboard and run `project:revise-preview-directing -- <slug> --input=<storyboard.json>`. The command accepts timing, treatments, proof timing, and legal scene-boundary changes; it rejects changes to the approved arc, style, scene/beat meaning, or proof assertions, recompiles against the approved motion budget, invalidates derived preview/final evidence, and creates one execution-sync work item per affected scene. It does not call a provider or silently change the production profile. A visibility-event proof may show its settled persistent state any time after the event begins and before the same target's next visibility change.

After preview approval, run `project:render`. A successful final render completes the local production task and reports `final.mp4`, the contact sheet, validation report, and technical acceptance result.

Do not ask for a publication approval merely to mark local delivery complete. If the human later requests upload, sharing, or publication, verify content/facts/rights/platform suitability and obtain one just-in-time authorization for that external action.

## Keep Turns Lean and Recoverable

- Run `project:resume` once at the start of a new turn or after an interruption; do not pair it with full status or `project:handoff-check`.
- At `asset-production`, a null `control.nextCommand` means continue `control.workItems.remaining[0]`; when no batch remains, resume returns the concrete `project:assets-ready` command.
- In `auto-continue`, continue to `control.nextCommand` or the next remaining work item. A tool result is not a human gate.
- End normally only at a human gate, completion, or a genuine blocker with one required user action.
- When implementation files change, run `npm run check`, relevant validation/tests, and `npm run plugin:sync` before validating the packaged Skill/runtime.
