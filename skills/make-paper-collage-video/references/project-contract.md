# Project Contract

Read this only when creating/changing project files or diagnosing validation/state.

## Sources of Truth

| File | Purpose |
|---|---|
| `brief.md` | Human intent, audience, facts, format, style, rights, prohibitions |
| `production.json` | State, approvals, coarse work batches, artifacts, event history |
| `production-metrics.json` | Versioned wall-clock segments and observation-window summaries for production monitoring |
| `storyboard.json` | Approved schema-v10 beat treatments, editorial authoring, intent-routed scene boundaries, layer source packages, and compiler-owned edit/directing/proof plans and fingerprints |
| `project.json` | Creative Plan v4 profile ceilings, human-approved image-attempt cap, exact source-package decision, and v10 Remotion execution tree |
| `requests/*.json` | Per-output generation/import request plus composition binding |
| `semantic-contracts.json` | Reusable identity, topology, mechanism, diagram, and evidence-target invariants |
| `generation-attempts.jsonl` | Append-only quota reservation and real provider-attempt outcomes |
| `assets-manifest.json` | Provider provenance, source families, fingerprints, hashes, and active/superseded/rejected/recovery-source lifecycle |
| `quality-report.json` | Hash-bound current asset/composite quality plus non-current asset history |
| `dist/<slug>/assets-ready-seal.json` | Current project, runtime, storyboard, validation, quality, audio, and subtitle delivery fingerprints required by preview/final rendering |
| `review.md` | Generated approval summary plus natural-language revision history |

Never ask the human to edit machine JSON. Paths in `project.json` are relative to `public/`; production artifacts are relative to the workspace root.

`production-metrics.json` records wrapped command time, quality-review sessions, and image-attempt windows. Its `summary.aiReview.percentOfObservation` is the comparison field for AI-review share. Review sessions include host-model inspection, tool orchestration, and any pause before `record-batch`; image attempts likewise include the full reserve-to-close window. The runtime does not estimate provider-only inference time or tokens when the host does not expose them. `summary.unattributedMs` is deliberately unlabeled because it can contain human waits, agent work, or uninstrumented operations. A lazily created file for an older project reports partial coverage.

## Normal State Path

| Stage | Successful action | Next |
|---|---|---|
| `capability-review` | `project:intake`, `project:scenarios`, then `project:confirm-concept` | `style-review` after intake and combined scenario/profile/budget/provider approval |
| `style-review` | `approve-style-voice` | `asset-production` |
| `asset-production` | `project:assets-ready` | `preview` |
| `preview` | successful `project:preview` | `human-review` |
| `human-review` | `approve-preview` | `final-render` |
| `final-render` | successful `project:render` | `complete` |

The combined confirmation is the normal path. Composition proof is machine evidence inside the existing style or asset stage, not a fourth human gate.

After `request-preview-revision`, a directing-only change uses `project:revise-preview-directing`. It preserves approved concept/style semantics, recompiles the edited authoring fields against the existing motion budget, records `directing-revision.json`, invalidates old render/proof artifacts, and creates execution-sync work items. Concept, factual, provider, or production-profile changes still require their owning approval path.

`approve-style-voice` requires a current schema-v6
`style-motion-proof.json` with `scope=style`, bound to the compiler-owned
multidimensional `styleProofPlan` fingerprint and its complete target list. The
plan covers the highest semantic-risk classes, every concrete coupled
relationship, and state-sequence behavior while minimizing distinct source
families. Every selected target, including `free`, must have at least one
structured composite with current full-resolution frame/crop/debug evidence.
Registered or semantic targets additionally bind member hashes, timing/proof
inputs, runtime build, and source family. Ordinary coupled families require
per-member alpha/checkerboard/tight/motion-stress evidence. A
`registered-depth-stack` instead adds neutral reconstruction, reference
comparison, checkerboard exploded members, and both extremes of all three
responsive reveal envelopes. A stack with `subjectTravelEnvelope` additionally
proves both subject-only lower-left/upper-right extremes in all three profiles.
Participating asset/composite semantic checks must
already be recorded. This is an executable precondition inside `style-review`,
not another approval state.

A mixed-surface registered sheet records the untouched provider-native RGB/RGBA
file as the provider root. `assets:derive-registered-family` is the only formal
path for explicit cell rectangles, separator removal, chroma-key-to-alpha,
registration-canvas scaling, key metadata, and the three local member records.
A resized/keyed project copy must never be recorded as though it were the raw
provider result.

Provider-native chroma cells use an observed key-plane contract. The request
declares `provider-native-observed/flat-v1`; the manifest records the requested
color separately from the accepted observed color and binds the observation
statistics to the source SHA. A historical rejected output can enter derivation
only as a `recovery-source` record produced by
`provider:recover-rejected-source`, never by hand-editing the manifest or
ledger. Its original attempt stays rejected and consumed.

## v10 Project, v9 Editorial, Composition, and Boundary Tree

Schema v10 is the only supported Project, Storyboard Authoring, and Compiled
Storyboard contract. Creative Plan v4 owns the approved profile, its planning
ceiling, and `approvedImageBudget`: the narrower exact attempt cap authorized by
the human. The storyboard compiler owns
`directingSummary.generationBudget`, including exact structural source-package
calls, pose-sheet calls, reserve, local derivatives, and avoided calls. Concept
approval copies the compiled `sourcePackageDecision` exactly and requires
`budgetDecision.imageAttemptLimit`; it records expected calls and the profile
ceiling at approval time. Provider requests cannot silently add or change a
layer package afterward, and storyboard call-count drift invalidates the budget
approval. A scene has
`composition.nodes`; nodes are recursive `asset`, `state-sequence`,
`typography`, `shape`, `annotation`, `data-graphic`, `editorial-switch`,
`motif-field`, `world-strip`, or `group` records. All transforms and keyframe deltas are
normalized to the immediate parent. Older projects are not parsed or migrated;
regenerate their equivalent output from the latest contract when needed. There
is no legacy loader, dual schema, deprecated field, compatibility adapter, or
version-conditioned renderer branch.

A top-level `supported-subject` or `registered-depth-stack` group may explicitly
declare `renderParticipation=derivation-only` when it exists only to bind a
registered technical source family. The renderer omits that complete subtree;
it cannot satisfy profile/directing promises, receive events or proof
assertions, or act as semantic/style evidence. Do not use `opacity=0` as this
contract. Visible derived consumers own composition, occlusion, depth,
responsive, and semantic review; the derivation-only family owns deterministic
completeness, provenance, and derivation integrity.

`theme.canvas` is a required opaque six-digit hex color. The renderer places it beneath every scene-specific background and uses it as the dip cover, so even a translucent scene treatment cannot expose pixels from the outgoing scene.

`state-sequence` is the first-class limited-animation primitive. It owns one `poseFamilyId`, a shared registration canvas, ordered states, playback (`once`, `loop`, `ping-pong`), and a `cut` or bounded `crossfade`. A loop may declare `activeFrom` and ordered `activeStateIds` to keep authored prelude poses until the selected registered gait starts; it may additionally declare `activeUntil` and `holdStateId` so the active window ends on one registered state. The cycles are distributed only across that active window. Continuous transform/emphasis motion applies once to the node while the renderer selects registered visual states internally. Never replace this with overlapping assets and hand-authored opacity toggles.

One `poseFamilyId` denotes one registered provider state sheet even when a continuous scene uses multiple temporal node instances of that family (for example, a sleeping identity and its later chase). `directingSummary.poseSheetPlans.targetIds` must expose every reuse target, while provider demand, state-sheet calls, and the state-capacity ceiling count the shared family only once. This preserves truthful provider cost evidence without forcing a project-specific animation workaround.

Camera-coupled parallax is a first-class rig. Set
`camera.parallax={enabled:true,strength,focalDepth}` and assign relevant nodes
`depth=-1..1`; the renderer composes the global camera once and then adds a
deterministic depth-relative offset/scale to each carrier. A valid rig has
visible camera translation or zoom and at least two distinct depth levels.
Coupled `supported-subject` and `registered-environment` children must not
declare their own depth: assign depth to the group so contact, registration, and
masks remain stable. A `registered-depth-stack` is the deliberate exception:
its exact rear/subject/front children own strictly increasing depth and may have
bounded relative motion because their complete source package has been proven
against responsive reveal envelopes.

`motif-field` is a first-class decorative node. It owns reviewed motif sources, fixed seed, bounded count, distribution, internal motion preset/cycles, base size, variation ranges, required normalized `bounds`, and explicit rectangle/ellipse `exclusionZones`. Runtime placement uses bounded deterministic rejection with motif-footprint clearance, so title, face, and explanatory-data zones are reproducibly protected. One field expands at most 64 instances; all fields in one scene may total at most 192. `fall-drift`, `rise-drift`, and `burst` hide their wrap point, while `drift` and `orbit` close geometrically; `cycles` affects every preset. `rise-drift` computes a deterministic monotonically upward bottom-to-top lifecycle with slight expansion. Configuration, exclusions, source files, and loop proof are fingerprinted. A motif field is not a semantic crowd, identity family, or substitute for generated pose states.

`world-strip` is valid only as a direct child of `looping-environment`. One
semantic node binds one active deterministic strip derivative while the
renderer owns its repeated internal copies. The group owns horizontal world
travel, ground reference, tracked subject, seam proof ids, depth-derived speed
range, overscan, and start phase. It contains at least two strips plus exactly
one asset/state-sequence tracked subject. Camera/parallax offsets are folded
into strip phase and safe internal scale; they must never translate or shrink
the viewport-sized carrier into an uncovered edge. An authored-and-compiled
`travel.activeUntil` is the optional terminal cue for a travelling world: the
phase advances only in its `activeFrom..activeUntil` window, applies its
declared easing, then remains at the completed phase. The renderer also stops
camera compensation at that terminal lock. Such a world must pass ordinary
seam/coverage/depth/repetition proof and `world-lock-clean` evidence at every
later proof moment. `travel.frozen=true` is the deliberate exception for a
still tableau that reuses registered strip assets: it locks world phase and
ignores camera offsets while retaining layer order; it must not be used to fake
a moving world. A frozen travel is mutually exclusive with both active-window
cues, and its quality review uses `world-lock-clean` rather than
motion/repetition checks.

A root `worlds[]` contract binds every participating scene to one four-role
source map. Each `far`/`mid`/`ground`/`near` `world-strip` must reuse that
role's declared `loopingStripBinding.sourceAssetId`; matching role names alone
are insufficient to claim a continuous world. Each route traveler declares an
inclusive `fromProofTimeId`/`throughProofTimeId` safe-band window. It is in the
walkable band throughout that window, and may then be proven to leave frame
without falsely failing the route constraint. Use `monotonic-travel` when a
chase must never reverse: it samples every authored x keyframe between its
proofs, permits a final zero-motion hold, and rejects any backward segment.

A continuous `traverse` target must span at least `0.45` in normalized parent
space. A continuous `sway` target must use the `sway` idle primitive and a
bottom-biased motion pivot; the pivot is independent of registration placement.

The v9 `editorial` contract is also first class. It binds final local audio and timing evidence to cue/edit-point/binding plans, declares reusable typography/annotation/data/switch nodes, compiles three responsive directing plans, and compiles dimension-specific advanced transitions. Read `editorial-system-v9.md` for timing, layout, anchor, descriptor, quality, and proof requirements. Project validation compares the compiled editorial fingerprint with the Storyboard, verifies audio SHA/duration/timing data, checks actual transition targets against match descriptors, and rejects hidden renderer-only aspect-ratio behavior.

When a family needs multiple generated states, create one registered state sheet where practical and run `assets:process-state-sheet`. `generationFamily.identityMemberIds` identifies the recurring character(s) governed by identity contracts, while `generationFamily.stateMemberIds` names the complete ordered pose cells; never overload one list for both meanings. Every state keeps the same destination canvas; trimming individual silhouettes would destroy registration and cause visible jumping. If an otherwise usable provider sheet preserves clean gutters but a full silhouette crosses a nominal equal-grid boundary, the processing spec may declare `extraction.mode=explicit-source-rects`: one non-overlapping in-bounds source rectangle per state, a common destination canvas, and a placement for each rectangle. This is a deterministic full-sheet derivative and must not mix neighboring poses or count as a provider call. The derived records share a family fingerprint and do not count as additional provider calls. A failed cell is first reprocessed locally. Provider repair must be a masked edit of the complete original sheet and quality proof must show untargeted cells remained unchanged. If that cannot be guaranteed, regenerate the complete sheet. Independent replacement-cell generation is invalid for a multi-state family.

A `supported-subject` or `registered-depth-stack` raster family is authored with
registered-family schema v2 and materialized by
`assets:derive-registered-family`. Its three active manifest records carry a
strict `registeredFamilyBinding`: family/registration/source-master/source
package ids, common canvas/origin, role/slot/node id, source strategy and
lineage, completeness, reveal envelopes, hash, `trimmed=false`,
`outputCanvasPreserved=true`, context-preserving recovery policy, and one family
fingerprint. The CLI owns manifest registration and optional group-node
patching; do not manually assemble the binding. Re-derivation supersedes earlier
active records without deleting provenance. Project validation and quality
targets reject missing, mixed, tight-cropped, incomplete, or role-mismatched
families.

Use only these patterns:

| Pattern | Intended relationship | Required structure |
|---|---|---|
| `free` | independent label, bird, leaf, stamp, or cutout | no persistent support/shared boundary |
| `supported-subject` | person in boat, object on table, hand holding prop | rear support, subject, front support, shared registration, contact and occlusion zones |
| `registered-depth-stack` | independently moving rear, subject, and front planes | clean rear plate, full subject silhouette, full front overlay, shared registration, strict depth, responsive reveal envelopes, and optional subject-only travel envelopes |
| `registered-environment` | land/water, sky/ground, wall/floor, tabletop edge | shared master canvas, registration, fixed boundary, upper/lower clipped members |
| `looping-environment` | car/train/boat travelling through a persistent horizontal world | two to four seamless `world-strip` roles, one non-scrolling tracked subject, ground reference, monotonic depth speeds, and before/seam/after proof bindings |

Groups own carrier motion; children own only local motion. Do not repeat the group's world path on attached children. Local z-order is deterministic. The default `between-supports` order is support rear, optional contact shadow, subject, support front. Use `support.layering=subject-front` only when the approved visual language requires the complete subject silhouette to remain above every support member; quality review then proves `subject-front-clear` instead of front occlusion. Registered environment members use the complete master canvas with top-left origin; textures may move within a fixed clip, but the boundary must not move across semantic content.

Paper-edge drop shadows belong to character and prop cutouts. Never apply them automatically to full-canvas support members: an opaque rear plate would expose its rectangular canvas boundary as a false paper frame.

Coupled members share `registration.id`, `sourceMasterAssetId`, canvas
dimensions, origin, and source-family provenance. For rigid contact/boundary
families, use the registered source appropriate to that family and keep member
motion locked. For relative rear/subject/front motion, first compile one
layer-complete source package. Use either one registered 2x2 sheet containing
reference plus all three complete layers or one complete reference plus three
full-context edits. A flat composed master may remain reference evidence but
cannot supply hidden layer pixels. Independent or isolated member generation is
invalid. Source and proof-scale alpha-band diagnostics are fingerprinted with
the registered derivation, so a changed source package, mask, clip, placement,
reveal envelope, or render size invalidates cached evidence.

Derivation method is part of correctness. Complex silhouettes and negative spaces require capable segmentation/matting or careful manual tracing; a coarse enclosing polygon is invalid even when it has clean hard alpha. When extraction quality cannot be proved, keep the complete master rigid and use whole-family/camera motion instead of fabricating independent parts.

Every adjacent scene pair has one top-level `sceneTransitions[]` record with
narrative `intent` and `rationale`. An intent-only schema-v10 authoring record
compiles to a deterministic default `treatment`; an explicit treatment
separately declares type, motivation, duration, optional direction, and optional
boundary beat. Runtime types are `paper-slide`, `paper-wipe`, `torn-wipe`,
`paper-iris`, `page-turn`, `paper-shutters`, `dip-to-paper`, and `cut`. A `cut`
is either `rhythmic` with a `beatId` in the outgoing final 20% or incoming first
20%, or `impact` with narrative intent `impact`. All normal continuity, place,
time, focus, and chapter intents still default to animation. Spatial types use
a hard clip or opaque incoming-scene translation. Cover types swap only during
a fully opaque plateau. Alpha crossfades between semantic scenes are not
supported. Animated duration is type-bounded inside `0.2..1.5s`; the outgoing
`tailSeconds` and incoming narration lead must both cover it, and the report
records intent/type/motivation counts plus transition proof samples. Advanced
v9 match transitions are separately declared in `editorial.transitions[]`,
bind an actual-audio edit point, and require dimension-specific continuity proof
plus before/at/after frames.

## Proof and Event Contract

- Storyboard authors own v10 `treatments`, layer source-package intent,
  editorial authoring, and boundary intent; they do not hand-author
  `compositionPlan`, source-package cost totals, resolved edit points,
  responsive/transition plans, `directing`, fingerprints, risk ranking, or
  pose-sheet grids. `project:storyboard` deterministically compiles those
  derived fields and default transition recipes, then rejects drift.
- Scene id, blueprint, compiled `compositionPlan`, proof ids/times/assertions/stateAssertions, and beat ids must match the approved storyboard. Beat-bound, treatment-bound, and state-bound proof intent is immutable.
- A compiled continuous target must exist and have visible keyframe/idle motion. `parallax-camera` additionally requires enabled camera parallax and a real depth spread. `scroll-world-x` instead requires one matching `looping-environment` whose axis, direction, distance, speed bounds, ground/tracked ids, seam proof ids, start phase, optional normalized `activeFrom` cue, optional terminal `activeUntil` lock, or `frozen=true` lock, and ordered strip roles/depths exactly match the compiler-owned plan. Before `activeFrom`, the world phase is held; when `activeUntil` is present the completed phase remains locked thereafter, otherwise the full authored travel completes by scene end. A frozen world holds phase throughout and must provide `world-lock-clean` evidence; a terminally locked travelling world must provide both its ordinary world-motion evidence and `world-lock-clean`. A compiled `motif-field` target must exist with the exact preset, distribution, count, cycles, bounds, and exclusions. A compiled visibility target must have a matching persistent event and truthful initial state; a compiled graphic target must exist as the declared editable `text` or `shape` node; every compiled state family must exist as one matching `state-sequence` node including its resolved playback plan.
- Each scene has establish, action/peak, and final proof moments; final remains at or after `0.82` and proofs stay outside scene-boundary intervals.
- A final state assertion must resolve to one fully opaque state, remain outside any state crossfade for at least that transition duration, and preserve the asserted state through the scene end.
- Every node keyframe path starts at `0`, ends at `1`, and authors at least one value.
- `scene.events` is the only visual/sound event source. Every storyboard beat has one or more ordered events; event drift is at most `0.035` normalized units.
- A visibility event targets an existing composition node and persists after its window. A first `show` requires `visibility.initial=hidden`; a first `hide` requires an initially visible node. Supported transitions are `cut`, `fade-rise`, and `fade-scale`.
- Emphasis events are transient and use the bounded actions from `schemas/composition.schema.json`, including `drop-impact` and `carve`. They do not control persistent visibility.
- Bind a critical event to `proofTimeId`. Transient emphasis/hold proof remains inside its action window; visibility proof may show the settled persistent state after the action starts and before the same target's next visibility change. If the approved beat names audio, at least one matching event owns both that proof id and the sound.
- Use a `hold` event only for an approved quiet observation beat: target `scene`, bind a proof inside the window, and keep it within the runtime maximum. Never encode an unexplained wait as a long `tailSeconds`.

## Validation and Failure Routing

Run `project:composition-proof` after assembling real groups. It fingerprints
scene frames and targets with the current runtime build, reuses current
evidence, and renders only changed authored proof. Normal coupled families use
alpha/checkerboard/tight/motion-stress plus alpha-band evidence. A
`registered-depth-stack` additionally requires neutral reconstruction,
reference comparison, checkerboard exploded members, and both extremes of all
three responsive reveal envelopes. A stack with `subjectTravelEnvelope` also
renders the three subject-only travel extreme pairs; isolated member stress is not proof that
hidden pixels are complete. It never treats a cache entry as current without
matching source/config/registered-derivation/render-size/runtime fingerprints
and existing evidence files. `--force` disables frame, composite, and
asset-evidence reuse and records that decision in the report.
`project:assets-ready` rejects missing/stale proof fingerprints, open generation
reservations, missing or exceeded human-approved attempt caps, pending/failed asset or composite quality,
and audio without either a passing preflight or a fingerprinted, explicitly
accepted calibration decision. It then writes `assets-ready-seal.json`. Low-level
`project:advance ... assets-ready` and both render modes only accept a current
seal; any project, source media, storyboard, quality, subtitle, or runtime change
invalidates it and routes back through the canonical command.

Fix a wrong mask, crop, anchor, registration, or derivative without another human decision when the approved meaning and budget remain unchanged. Regenerate `style:proof` or `project:composition-proof` after the fix; member hashes invalidate prior evidence automatically. Return to concept only when the relationship meaning changes. Return to provider/budget approval only for a provider switch or budget increase. Never hide a contract failure with arbitrary z-index, pixel nudges, or a coarse polygon matte.

Use repository scripts rather than reproducing ffprobe, FFmpeg, Remotion,
extraction, layer/state-sheet processing, editorial/directing compilation,
proof, attempt accounting, or report logic ad hoc. Only the current Creative
Plan v4, project/storyboard schema v10, quality-report schema v6, asset-request
schema v7, registered-family schema v2, and current style-proof contract are
supported; older contracts are intentionally not migrated or executed.
