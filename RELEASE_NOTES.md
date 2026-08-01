# Paper Collage Video 0.19.0-dev.2

Paper Collage Video 0.19.0-dev.2 adds first-class two-dimensional path
locomotion for registered limited-animation subjects.

- Storyboard v12 now compiles `path-travel` into an explicit
  `path-locomotion` plan, separate from the subject's looping
  `state-sequence`.
- Runtime cubic Bézier travel uses physical-pixel arc length, tangent
  auto-orientation, angle unwrapping, smoothing, and bounded turn rate across
  16:9, 9:16, and 1:1.
- Optional `camera.follow` consumes the same path and stays clamped inside one
  declared coherent world surface; duplicated camera paths and background
  swaps are rejected.
- The new `path-locomotion` spatial contract proves travel, direction sectors,
  heading error, turn continuity, gait cadence, camera binding, and viewport
  coverage with start/turn/end evidence.
- A zero-provider three-profile Remotion fixture and final encode provide
  executable visual proof, while provider guidance reuses one registered
  locomotion sheet at every heading.

# Paper Collage Video 0.19.0-dev.1

Paper Collage Video 0.19.0-dev.1 removes the paper-only runtime assumption and
turns visual style into a dynamic executable catalog.

- Project/Storyboard v12 and Style Profile v2 replace fixed style ids, paper
  texture, cutout edge/shadow, and paper-prefixed transition types with dynamic
  ids, a neutral surface contract, and Profile-selected `paper-story` or
  `clean-video` transition recipes.
- Comic-inspired videos remain ordinary shot-based videos. The runtime does not
  simulate vertically scrolling a long comic canvas.
- Dialogue, narration, and exposition remain audio plus subtitles. Sparse
  `role=visual-sfx` typography is reserved for discrete impact or motion sounds
  and must bind a real sound cue, explicit show/emphasis/hide lifecycle,
  Profile density/duration limits, proof coverage, and human quality checks.
- Runtime fingerprints and packaged-copy tests discover every catalog card
  dynamically. Adding a valid official style no longer requires a code enum.
- The existing three paper/collage Profiles preserve their visual output by
  explicitly opting into paper texture, outline, shadow, and `paper-story`.

# Paper Collage Video 0.18.0-dev.1

Paper Collage Video 0.18.0-dev.1 turns whole-film motion direction into an
executable, attributable, and reviewable production contract.

- Project and Storyboard v11 replace descriptive `style.motionLanguage` prose
  with structured `motionDirection` and per-beat `performanceRole`.
- The storyboard compiler owns `motionContract`, with separate human approval
  and exact execution fingerprints.
- The existing style/fictional-voice gate now shows
  `motion-language-card.json`; `approve-style-voice` records the human note and
  exact bindings in `motion-approval.json` without adding a new gate.
- Style proof v7 binds both motion fingerprints. Quality report v7 adds one
  `motion-contract:whole-film` target for grammar, cadence, camera, transition,
  ambient, and event/proof synchronization.
- Runtime validation requires every approved performance phrase to exist as an
  event and proof moment. Assets-ready, render cache, delivery seals, reports,
  runtime fingerprints, tests, templates, and packaged plugin all share the
  same contract.

# Paper Collage Video 0.16.0

Paper Collage Video 0.16.0 turns the repository into a stricter, evidence-bound
production system for editable Remotion paper-collage films. It closes the
highest-priority failures found during real story production without weakening
human approval, provider budget, rights, preview, or publication gates.

## Production planning and budget control

- New projects first choose aspect ratio, one of three bundled visual directions,
  and a parallax preference, then compare complete draft, balanced, and
  full-depth production scenarios.
- Each scenario states story scope, motion language, depth plan, state families,
  provider recommendation, expected image calls, proposed approved cap, local
  derivatives, avoided calls, and final-film tradeoffs.
- A production profile is only a planning ceiling. Provider attempts are
  enforced against the smaller exact cap approved by the human.
- Story-critical semantic actions must resolve to actual registered states,
  local-motion targets, or layer source packages before they count as covered.

## Layer-complete assets and registered animation

- Project and Storyboard schema v10 plan complete rear, subject, and front source
  packages before any layer-aware provider request.
- Registered depth stacks preserve one coordinate system, stable depth order,
  complete hidden content, and explicit reveal envelopes for 16:9, 9:16, and
  1:1.
- Identity-bound state sheets carry one active identity reference plus per-state
  facing and anchor declarations. Deterministic processing retains a shared
  canvas and produces fingerprinted anchor overlays for quality review.
- Provider-native mixed-surface sheets support opaque reference/rear cells and
  alpha or observed chroma-key subject/front cells without rewriting the
  provider root.
- Quota-consuming calls remain distinct from deterministic crops, keying,
  registration, masks, looping derivatives, and other local work.

## Persistent worlds and causal motion

- `looping-environment` provides far, mid, walkable-ground, and near strips with
  seamless source/render proof and real visible-surface validation.
- Scenes can bind one tracked subject and multiple participants using explicit
  screen- or world-space anchoring and near-layer occlusion relationships.
- Ground displacement is shared by world-anchored subjects, so markers and
  participants stay attached to the travelling world.
- Signed trajectory contracts prove forward travel, relative order, overtaking,
  state changes, offscreen exits, finish order, and final stops instead of
  relying on prose or unsigned distance.

## Editorial, timing, and revision contracts

- Editorial v9 binds narration words, phrases, sentences, emphasis, SFX phases,
  music beats, and manual cues to actual local media timing.
- Editable typography, annotations, counters, charts, tables, maps, diagrams,
  responsive directing, and semantic paper transitions remain React/SVG
  primitives rather than baked raster UI.
- `motionPolicy=locked-static` protects deliberate still scenes from profile
  motion floors.
- A human-authorized semantic revision can change listed scenes while preserving
  the approved provider cap and invalidating all dependent style, proof, preview,
  and final evidence.

## Evidence-bound quality and delivery

- Composition, asset, subtitle, transition, relationship, and semantic-contract
  review surfaces have independent fingerprints and lifecycle rules.
- Quality contact sheets bind the exact scaffold, targets, evidence files, and
  report hash; stale or cross-surface approvals are rejected.
- State identity, anchor drift, facing, alpha bands, chroma-key residue, depth
  reconstruction, visible world surfaces, actor grounding, occlusion, and signed
  world direction are deterministic quality checks.
- `project:assets-ready` creates one seal over current assets, audio, subtitles,
  timeline, quality, and proof state. Preview and final rendering reject a stale
  seal.
- Subtitle delivery is verified from encoded frames independently of the
  subtitle-free composition review surface.

## Dependency maintenance

- `remotion` and `@remotion/cli` are pinned together at 4.0.499.
- PostCSS is updated to the compatible 8.5.23 patch.
- `fast-uri` remains on the patched 3.1.4 line used by the current dependency
  graph.
- These unified updates supersede the older automated dependency PRs that
  proposed partial or stale versions.

## Compatibility

- 0.16.0 supports only the latest project, storyboard, asset, evidence, and
  production contracts.
- Old projects are intentionally not migrated or loaded through compatibility
  adapters. Rebuild an older production as a fresh latest-contract project when
  it needs revision.
- The output capability remains: editable layered collage stories, recurring
  identities, registered limited animation, persistent travelling worlds,
  functional diagrams, actual-audio editing, responsive typography, subtitles,
  preview review, and locally accepted final delivery.

## Release validation

- Source workspace: 204/204 tests passed.
- Fresh packaged workspace: 189/189 tests passed.
- TypeScript, doctor, Remotion bundle, schema-v10, and npm moderate-level audit
  passed; the audit reported zero vulnerabilities.
- Registered-family and alpha-band proofs passed with zero provider calls.
- The looping-world proof rendered and verified 16:9, 9:16, and 1:1 previews
  plus a 16:9 final artifact under Remotion 4.0.499.
- A separately installed packaged workspace reached doctor READY and rendered
  the sealed starter preview with current validation, quality, audio, subtitle,
  contact-sheet, and encoded-frame evidence.

## Provider and publication boundary

No image, voice, or video provider call is required to build or validate this
release. The release contains reusable source, deterministic fixtures, and the
packaged Codex Plugin. It does not publish user projects, credentials, private
prompts, or generated production media, and this release intentionally carries
no media attachment.

## Install

```bash
codex plugin marketplace add cyberlesterr/paper-collage-video
codex plugin add paper-collage-video@paper-collage-video
```

Start a new Codex task after installation so the versioned Skill snapshot and
packaged runtime come from the same release.

## Requirements and licensing

- Node.js 20 or newer
- FFmpeg and ffprobe
- Python 3.11 or newer
- macOS and Ubuntu are validated; Windows support remains best effort

The software is MIT-licensed. Bundled fixture and style-catalog media use the
repository-demo-only terms in `ASSET_LICENSES.md`. Remotion and other
dependencies retain their own licenses as described in
`THIRD_PARTY_NOTICES.md`.
