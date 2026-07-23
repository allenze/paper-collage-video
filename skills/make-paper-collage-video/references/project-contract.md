# Project Contract

Read this only when creating/changing project files or diagnosing validation/state.

## Sources of Truth

| File | Purpose |
|---|---|
| `brief.md` | Human intent, audience, facts, format, style, rights, prohibitions |
| `production.json` | State, approvals, coarse work batches, artifacts, event history |
| `production-metrics.json` | Versioned wall-clock segments and observation-window summaries for production monitoring |
| `storyboard.json` | Approved schema-v9 beat treatments, editorial authoring, intent-routed scene boundaries, and compiler-owned edit/directing/proof plans and fingerprints |
| `project.json` | Creative Plan v2 budgets and v9 Remotion execution tree |
| `requests/*.json` | Per-output generation/import request plus composition binding |
| `semantic-contracts.json` | Reusable identity, topology, mechanism, diagram, and evidence-target invariants |
| `generation-attempts.jsonl` | Append-only quota reservation and real provider-attempt outcomes |
| `assets-manifest.json` | Provider provenance, source families, fingerprints, hashes, and active/superseded/rejected/recovery-source lifecycle |
| `quality-report.json` | Hash-bound current asset/composite quality plus non-current asset history |
| `review.md` | Generated approval summary plus natural-language revision history |

Never ask the human to edit machine JSON. Paths in `project.json` are relative to `public/`; production artifacts are relative to the workspace root.

`production-metrics.json` records wrapped command time, quality-review sessions, and image-attempt windows. Its `summary.aiReview.percentOfObservation` is the comparison field for AI-review share. Review sessions include host-model inspection, tool orchestration, and any pause before `record-batch`; image attempts likewise include the full reserve-to-close window. The runtime does not estimate provider-only inference time or tokens when the host does not expose them. `summary.unattributedMs` is deliberately unlabeled because it can contain human waits, agent work, or uninstrumented operations. A lazily created file for an older project reports partial coverage.

## Normal State Path

| Stage | Successful action | Next |
|---|---|---|
| `capability-review` | `project:confirm-concept` | `style-review` via provider/brief/concept records |
| `style-review` | `approve-style-voice` | `asset-production` |
| `asset-production` | `project:assets-ready` | `preview` |
| `preview` | successful `project:preview` | `human-review` |
| `human-review` | `approve-preview` | `final-render` |
| `final-render` | successful `project:render` | `complete` |

The combined confirmation is the normal path. Composition proof is machine evidence inside the existing style or asset stage, not a fourth human gate.

After `request-preview-revision`, a directing-only change uses `project:revise-preview-directing`. It preserves approved concept/style semantics, recompiles the edited authoring fields against the existing motion budget, records `directing-revision.json`, invalidates old render/proof artifacts, and creates execution-sync work items. Concept, factual, provider, or production-profile changes still require their owning approval path.

`approve-style-voice` requires a current schema-v6 `style-motion-proof.json` with `scope=style`, bound to the compiler-owned multidimensional `styleProofPlan` fingerprint and its complete target list. The plan covers the highest semantic-risk classes, every concrete coupled relationship, and state-sequence behavior while minimizing distinct source families. Every selected target, including `free`, must have at least one structured composite with current full-resolution frame/crop/debug evidence. Registered or semantic targets additionally bind member hashes, timing/proof inputs, runtime build, and source family; per-member alpha/checkerboard/tight/motion-stress evidence must exist, and participating asset/composite semantic checks must already be recorded. This is an executable precondition inside `style-review`, not another approval state.

## v9 Editorial, Composition, and Boundary Tree

Schema v9 is the only supported Project, Storyboard Authoring, and Compiled Storyboard contract. A scene has `composition.nodes`; nodes are recursive `asset`, `state-sequence`, `typography`, `shape`, `annotation`, `data-graphic`, `editorial-switch`, `motif-field`, or `group` records. All transforms and keyframe deltas are normalized to the immediate parent. Older projects are not parsed or migrated; regenerate their equivalent output from the latest contract when needed. There is no v8 loader, dual schema, deprecated field, compatibility adapter, or version-conditioned renderer branch.

`theme.canvas` is a required opaque six-digit hex color. The renderer places it beneath every scene-specific background and uses it as the dip cover, so even a translucent scene treatment cannot expose pixels from the outgoing scene.

`state-sequence` is the first-class limited-animation primitive. It owns one `poseFamilyId`, a shared registration canvas, ordered states, playback (`once`, `loop`, `ping-pong`), and a `cut` or bounded `crossfade`. A loop that must stop on contact may additionally declare `activeUntil` and `holdStateId`; the cycles are distributed across the active interval and the named registered state is held afterward. Continuous transform/emphasis motion applies once to the node while the renderer selects registered visual states internally. Never replace this with overlapping assets and hand-authored opacity toggles.

Camera-coupled parallax is a first-class rig. Set `camera.parallax={enabled:true,strength,focalDepth}` and assign relevant nodes `depth=-1..1`; the renderer composes the global camera once and then adds a deterministic depth-relative offset/scale to each carrier. A valid rig has visible camera translation or zoom and at least two distinct depth levels. Coupled `supported-subject` and `registered-environment` children must not declare their own depth: assign depth to the group so contact, registration, and masks remain stable.

`motif-field` is a first-class decorative node. It owns reviewed motif sources, fixed seed, bounded count, distribution, internal motion preset/cycles, base size, variation ranges, required normalized `bounds`, and explicit rectangle/ellipse `exclusionZones`. Runtime placement uses bounded deterministic rejection with motif-footprint clearance, so title, face, and explanatory-data zones are reproducibly protected. One field expands at most 64 instances; all fields in one scene may total at most 192. `fall-drift` and `burst` hide their wrap point, while `drift` and `orbit` close geometrically; `cycles` affects every preset. Configuration, exclusions, source files, and loop proof are fingerprinted. A motif field is not a semantic crowd, identity family, or substitute for generated pose states.

The v9 `editorial` contract is also first class. It binds final local audio and timing evidence to cue/edit-point/binding plans, declares reusable typography/annotation/data/switch nodes, compiles three responsive directing plans, and compiles dimension-specific advanced transitions. Read `editorial-system-v9.md` for timing, layout, anchor, descriptor, quality, and proof requirements. Project validation compares the compiled editorial fingerprint with the Storyboard, verifies audio SHA/duration/timing data, checks actual transition targets against match descriptors, and rejects hidden renderer-only aspect-ratio behavior.

When a family needs multiple generated states, create one registered state sheet where practical and run `assets:process-state-sheet`. Every cell keeps the same full canvas; trimming individual silhouettes would destroy registration and cause visible jumping. The derived records share a family fingerprint and do not count as additional provider calls. A failed cell is first reprocessed locally. Provider repair must be a masked edit of the complete original sheet and quality proof must show untargeted cells remained unchanged. If that cannot be guaranteed, regenerate the complete sheet. Independent replacement-cell generation is invalid for a multi-state family.

A `supported-subject` raster family is authored with `registered-family.schema.json` and materialized by `assets:derive-registered-family`. Its three active manifest records carry a strict `registeredFamilyBinding`: family/registration/source-master ids, common canvas/origin, role/slot/node id, source lineage and hash, placement/mask/clip details, `trimmed=false`, `outputCanvasPreserved=true`, context-preserving recovery policy, and one family fingerprint. The CLI owns manifest registration and optional group-node patching; do not manually assemble the binding. Re-derivation supersedes earlier active records without deleting provenance. Project validation and the supported-subject quality target reject missing, mixed, tight-cropped, or role-mismatched families.

Use only these patterns:

| Pattern | Intended relationship | Required structure |
|---|---|---|
| `free` | independent label, bird, leaf, stamp, or cutout | no persistent support/shared boundary |
| `supported-subject` | person in boat, object on table, hand holding prop | rear support, subject, front support, shared registration, contact and occlusion zones |
| `registered-environment` | land/water, sky/ground, wall/floor, tabletop edge | shared master canvas, registration, fixed boundary, upper/lower clipped members |

Groups own carrier motion; children own only local motion. Do not repeat the group's world path on attached children. Local z-order is deterministic. The default `between-supports` order is support rear, optional contact shadow, subject, support front. Use `support.layering=subject-front` only when the approved visual language requires the complete subject silhouette to remain above every support member; quality review then proves `subject-front-clear` instead of front occlusion. Registered environment members use the complete master canvas with top-left origin; textures may move within a fixed clip, but the boundary must not move across semantic content.

Paper-edge drop shadows belong to character and prop cutouts. Never apply them automatically to full-canvas support members: an opaque rear plate would expose its rectangular canvas boundary as a false paper frame.

Coupled members share `registration.id`, `sourceMasterAssetId`, canvas dimensions, origin, and source-family provenance. Generate/import one complete master and derive members from it. Independent generation calls for the two sides of one contact or boundary are invalid. Source and proof-scale alpha-band diagnostics are fingerprinted with the registered derivation, so a changed mask, clip, placement, or render size invalidates cached evidence.

Derivation method is part of correctness. Complex silhouettes and negative spaces require capable segmentation/matting or careful manual tracing; a coarse enclosing polygon is invalid even when it has clean hard alpha. When extraction quality cannot be proved, keep the complete master rigid and use whole-family/camera motion instead of fabricating independent parts.

Every adjacent scene pair has one top-level `sceneTransitions[]` record with narrative `intent` and `rationale`. An intent-only schema-v9 authoring record compiles to a deterministic default `treatment`; an explicit treatment separately declares type, motivation, duration, optional direction, and optional boundary beat. Runtime types are `paper-slide`, `paper-wipe`, `torn-wipe`, `paper-iris`, `page-turn`, `paper-shutters`, `dip-to-paper`, and `cut`. A `cut` is either `rhythmic` with a `beatId` in the outgoing final 20% or incoming first 20%, or `impact` with narrative intent `impact`. All normal continuity, place, time, focus, and chapter intents still default to animation. Spatial types use a hard clip or opaque incoming-scene translation. Cover types swap only during a fully opaque plateau. Alpha crossfades between semantic scenes are not supported. Animated duration is type-bounded inside `0.2..1.5s`; the outgoing `tailSeconds` and incoming narration lead must both cover it, and the report records intent/type/motivation counts plus transition proof samples. Advanced v9 match transitions are separately declared in `editorial.transitions[]`, bind an actual-audio edit point, and require dimension-specific continuity proof plus before/at/after frames.

## Proof and Event Contract

- Storyboard authors own v9 `treatments`, editorial authoring, and boundary intent; they do not hand-author `compositionPlan`, resolved edit points, responsive/transition plans, `directing`, fingerprints, risk ranking, or pose-sheet grids. `project:storyboard` deterministically compiles those derived fields and default transition recipes, then rejects drift.
- Scene id, blueprint, compiled `compositionPlan`, proof ids/times/assertions/stateAssertions, and beat ids must match the approved storyboard. Beat-bound, treatment-bound, and state-bound proof intent is immutable.
- A compiled continuous target must exist and have visible keyframe/idle motion. `parallax-camera` additionally requires enabled camera parallax and a real depth spread. A compiled `motif-field` target must exist with the exact preset, distribution, count, cycles, bounds, and exclusions. A compiled visibility target must have a matching persistent event and truthful initial state; a compiled graphic target must exist as the declared editable `text` or `shape` node; every compiled state family must exist as one matching `state-sequence` node.
- Each scene has establish, action/peak, and final proof moments; final remains at or after `0.82` and proofs stay outside scene-boundary intervals.
- A final state assertion must resolve to one fully opaque state, remain outside any state crossfade for at least that transition duration, and preserve the asserted state through the scene end.
- Every node keyframe path starts at `0`, ends at `1`, and authors at least one value.
- `scene.events` is the only visual/sound event source. Every storyboard beat has one or more ordered events; event drift is at most `0.035` normalized units.
- A visibility event targets an existing composition node and persists after its window. A first `show` requires `visibility.initial=hidden`; a first `hide` requires an initially visible node. Supported transitions are `cut`, `fade-rise`, and `fade-scale`.
- Emphasis events are transient and use the bounded actions from `schemas/composition.schema.json`, including `drop-impact` and `carve`. They do not control persistent visibility.
- Bind a critical event to `proofTimeId`. Transient emphasis/hold proof remains inside its action window; visibility proof may show the settled persistent state after the action starts and before the same target's next visibility change. If the approved beat names audio, at least one matching event owns both that proof id and the sound.
- Use a `hold` event only for an approved quiet observation beat: target `scene`, bind a proof inside the window, and keep it within the runtime maximum. Never encode an unexplained wait as a long `tailSeconds`.

## Validation and Failure Routing

Run `project:composition-proof` after assembling real groups. It fingerprints scene frames and targets with the current runtime build, reuses current evidence, renders only changed authored proof frames/crops/debug copies, and creates standard alpha/checkerboard/tight/motion-stress plus alpha-band JSON/overlay evidence for every coupled production asset. It never treats a cache entry as current without matching source/config/registered-derivation/render-size/runtime fingerprints and existing evidence files. `--force` disables frame, composite, and asset-evidence reuse and records that decision in the report. `project:assets-ready` rejects missing/stale proof fingerprints, open generation reservations, over-budget attempts, pending/failed asset or composite quality, and audio without either a passing preflight or a fingerprinted, explicitly accepted calibration decision.

Fix a wrong mask, crop, anchor, registration, or derivative without another human decision when the approved meaning and budget remain unchanged. Regenerate `style:proof` or `project:composition-proof` after the fix; member hashes invalidate prior evidence automatically. Return to concept only when the relationship meaning changes. Return to provider/budget approval only for a provider switch or budget increase. Never hide a contract failure with arbitrary z-index, pixel nudges, or a coarse polygon matte.

Use repository scripts rather than reproducing ffprobe, FFmpeg, Remotion, extraction, state-sheet processing, editorial/directing compilation, proof, attempt accounting, or report logic ad hoc. Only the current Creative Plan v2, project/storyboard schema v9, quality-report schema v4, asset-request schema v6, and current style-proof contract are supported; older contracts are intentionally not migrated or executed.
