# Paper Collage Video 0.16.0-dev.2

This development release completes the VOX Phase 2.1 production-readiness
audit. It keeps the v9 contracts and renderer behavior from dev.1, while
making the packaged `schema:v9` check self-contained in a newly bootstrapped
workspace.

## Audit fix

- `npm run schema:v9` now deterministically prepares its local v9 proof inputs
  before validating the Storyboard Authoring, Compiled Storyboard, and three
  Project contracts. A fresh installed-cache workspace no longer depends on a
  pre-existing `dist/vox-phase2-proof/inputs` directory.
- The new wrapper is included in the packaged runtime and runtime-build
  fingerprint. It uses only local fixtures and never invokes an image, voice,
  or video provider.

## Inherited Phase 2 system

The complete Phase 2 feature set and compatibility policy below are unchanged
from `0.16.0-dev.1`.

This development release establishes the reusable VOX Phase 2 editorial
system without requiring any image, voice, or video provider. It upgrades the
Project, Storyboard Authoring, and Compiled Storyboard contracts to v9 and
binds authoring, compilation, runtime, validation, proof, packaging, and
documentation to the same behavior.

## Highlights

- Actual-file edit-point compilation for narration words/phrases/sentences,
  emphasis, SFX onset/peak/tail, music beat/bar/accent, and manual cues, with
  authored/detected provenance, priorities, tolerance windows, conflict
  resolution, and deterministic media/scene/render frame mappings.
- Reusable typography, annotation, counter, chart, table, timeline, registered
  map, flow-diagram, and editorial-switch primitives with responsive layout,
  lifecycle and edit-point bindings.
- Explicit 16:9, 9:16, and 1:1 directing plans covering composition,
  typography, framing, parallax, exclusion zones, placement, crop/focus,
  routing, safe areas, and density budgets.
- Eight semantic advanced transitions with source/destination anchors,
  treatments, continuity validation, fallback policy, compiled plans, and
  before/at/after proof frames.
- A six-second, no-provider Phase 2 proof gallery that renders all three
  aspect ratios from synthetic WAV and deterministic SVG fixtures and emits
  fingerprinted reports plus contact sheets.
- Source, packaged plugin, and fresh installed-cache validation share the same
  runtime-build identity.

## Compatibility

- New projects use Project, Storyboard Authoring, and Compiled Storyboard
  schema v9. Older projects are intentionally not migrated or silently
  downgraded.
- There is no v8 loader, dual schema, deprecated field, compatibility adapter,
  or version-conditioned renderer branch.
- Useful v8 output capabilities remain expressible under the v9 contract.
- Start a new Codex task after upgrading so the new Skill snapshot is loaded.

This release contains reusable source, the packaged Plugin, and technical test
fixtures only. The generated VOX Phase 2 MP4s and proof artifacts remain local
build outputs and are not bundled as production media or a final reference
film.

## Install

Give Codex the repository URL, or run:

```bash
codex plugin marketplace add cyberlesterr/paper-collage-video
codex plugin add paper-collage-video@paper-collage-video
```

Start a new Codex task and invoke `$make-paper-collage-video`. The Plugin will
create a writable workspace outside its installation cache and run environment
diagnostics before production begins.

## Requirements and Support

- Node.js 20 or newer
- FFmpeg and ffprobe
- Python 3.11 or newer for image processing and proof generation
- macOS and Ubuntu are validated; Windows support is currently best effort

Image and voice generation require capabilities or provider accounts selected
by the user. The project does not publish generated media automatically.

## Licensing

The software is MIT-licensed. Bundled showcase and fixture media is excluded
from MIT and is limited to repository demonstration, testing, and evaluation;
see `ASSET_LICENSES.md`. Remotion and other dependencies retain their own
licenses, including Remotion's Company License requirements in some commercial
use cases; see `THIRD_PARTY_NOTICES.md`.
