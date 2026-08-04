# Paper Collage Video 0.19.0

Paper Collage Video 0.19.0 turns visual style, whole-film motion direction,
three-dimensional path locomotion, persistent travelling worlds, and provider
recovery into one evidence-bound Remotion production contract.

## Executable visual and motion direction

- Project and Storyboard v12 use a dynamic Style Catalog and executable Style
  Profile v2. Surface treatment, transition recipes, visual SFX limits, and
  required asset checks are frozen into the same profile used by generation,
  rendering, quality review, and fingerprint invalidation.
- A compiler-owned whole-film Motion Contract replaces descriptive motion
  prose. It binds performance roles, pacing, camera language, transitions,
  ambient motion, final holds, exceptions, events, and proof moments.
- The existing style and fictional-voice review now includes a
  `motion-language-card.json` and records the exact approved motion
  fingerprints without adding another routine human gate.
- Comic-inspired output remains ordinary shot-based video. Dialogue,
  narration, and exposition stay in audio plus subtitles; short editable
  visual SFX are allowed only for a bound discrete impact or motion sound.

## Three-dimensional path locomotion

- Registered limited-animation subjects can follow one cubic Bézier
  `path-locomotion` route through screen space and optical depth.
- Runtime travel uses physical-pixel arc length, tangent auto-orientation,
  angle unwrapping, smoothing, bounded turn rate, projection scale, dynamic
  depth ordering, and velocity-driven planar/toward/away state loops across
  16:9, 9:16, and 1:1.
- Optional `camera.follow` consumes the same resolved path and stays clamped
  inside one declared coherent world surface. Duplicated camera or scale
  keyframes and background swaps are rejected.
- The spatial contract proves screen and depth travel, direction sectors,
  heading error, turn continuity, gait cadence, view-state binding, camera
  binding, world binding, and viewport coverage with start/turn/end evidence.

## Persistent worlds, encounters, and semantic depth

- Looping worlds now have provider-free topology proof before generation,
  source- and render-scale seam evidence, truthful visible surface roles,
  sparse foreground scatter, and camera-compensated world-motion proof.
- Encounter contracts bind one narration cue and one world-anchored target to
  ordered enter, approach, answer, and exit phases. Visibility toggles cannot
  teleport a participant through the lifecycle.
- Semantic depth slices, registered scene families, trajectory contracts, and
  adjacent-scene continuity proofs preserve identity, grounding, occlusion,
  relative order, and causal travel across finite and repeating worlds.

## Provider budget, recovery, and asset integrity

- Provider-native results are recorded unchanged before deterministic canvas
  normalization, source-rectangle extraction, registration, keying, masking,
  or other local derivatives.
- Registered state and layer sheets support observed chroma-key planes,
  bounded baked-checkerboard alpha recovery, full-sheet masked repair, and
  deterministic horizontal mirroring while preserving accepted cells and one
  shared registration canvas.
- A human-approved image-attempt cap remains smaller than or equal to the
  production profile ceiling. Any later increase is an explicit append-only
  old/new/usage audit event; rejected, abandoned, and unused provider results
  still count when quota was consumed.
- Provider reservation, recording, and recovery enforce one canonical
  provider/model identity before provenance is written.

## Runtime identity and lifecycle hardening

- `runtime-build.json` recursively fingerprints the actual local ESM dependency
  closure, schemas, fixtures, Remotion entrypoints, and generated package
  surfaces across source and packaged workspaces.
- The unreachable legacy `publish-approval` stage is removed. `complete`
  remains the local production terminal state; `approve-publish` is an
  optional post-completion audit event for one explicitly authorized
  destination, action, and scope.
- The Remotion build chain pins transitive `fast-uri` to patched version
  `3.1.5`, and source/package tests enforce that minimum against
  CVE-2026-18446.
- The latest release supports only the current project, storyboard, asset,
  proof, and production contracts. Old project files are intentionally not
  migrated through compatibility adapters; rebuild an older production as a
  fresh current-contract project when it needs revision.

## Release validation

- Source workspace: 307/307 tests passed.
- Fresh packaged workspace: 289/289 tests passed; doctor reported READY,
  TypeScript passed, and `starter-demo` validated with 0 errors / 0 warnings.
- The fresh packaged `starter-demo` rendered a real 36-frame H.264/AAC preview,
  passed 7/7 quality checks, and reached the local `complete` state.
- TypeScript, Remotion bundle, schema-v12 validation, and the moderate-level npm
  audit passed; the audit reported zero vulnerabilities.
- Registered-family and alpha-band proofs passed. The path-locomotion proof
  rendered and verified 16:9, 9:16, and 1:1 previews plus a 16:9 final artifact,
  with zero provider calls.
- Source, packaged template, and fresh workspace share runtime fingerprint
  `1ab31994036d26e7bc17c1fa0bcffd3a13fa6629f7effdb099d391ceb0c99594`.

## Provider and publication boundary

No image, voice, or video provider call is required to build or validate this
release. The release contains reusable source, deterministic fixtures, and the
packaged Codex Plugin. It does not publish user projects, credentials, private
prompts, or generated production media, and it carries no new media attachment.

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
