# Paper Collage Video 0.16.0-dev.5

This development release separates a production profile's planning ceiling from
the exact image-attempt cap a human approved for one project. Creative Plan v4
adds `approvedImageBudget`; combined concept confirmation requires an explicit
`budgetDecision.imageAttemptLimit`, records the expected calls and profile
ceiling at approval time, and refuses a cap below the compiled storyboard need
or above the selected profile.

The append-only attempt ledger now reserves against the human-approved cap,
not the larger profile ceiling. Read-only attempt summaries and project
validation expose the profile ceiling, approved cap, expected calls, usage,
reservations, and remaining capacity. Storyboard drift invalidates the approval.
This fixes the generic budget-control gap found while preparing the VOX Phase
2.4 single-scene registered-depth-stack pilot. The engineering change itself
uses no image, voice, or video provider.

## Inherited 0.16.0-dev.4 layer-complete assets

This development release moves rear/subject/front completeness planning before
provider approval and generation. It fixes the production-design error exposed
by the stopped 《纸舟穿浪》 pilot: a flattened image contains only visible
pixels and therefore cannot be masked into independently moving layers with
complete hidden content.

## Layer-complete production contract

- Project and Storyboard schema v10 compile a stable source package before any
  layer-aware provider request can be reserved.
- `registered-depth-stack` requires exactly one clean rear plate, one complete
  subject silhouette, and one complete front overlay on a shared registration
  canvas with strict depth order.
- Every stack declares 16:9, 9:16, and 1:1 reveal envelopes; runtime validation
  rejects local transforms outside those envelopes.
- Asset-request schema v7 accepts either one registered 2x2
  reference/rear/subject/front sheet or one complete reference plus three
  context-preserving layer edits. Isolated member generation and flat-master
  extraction are invalid.

## Budget, provenance, and proof

- Creative Plan v3 separates base attempts from a layer-package recovery
  reserve. One-scene hard ceilings are draft 6, balanced 8, and full-depth 11.
- Concept approval binds the exact compiler-owned `sourcePackageDecision`;
  provider calls, local derivatives, and avoided calls remain auditable.
- Registered-family schema v2 carries source-package strategy, completeness,
  shared canvas, lifecycle, and responsive reveal provenance.
- Family-aware proof adds neutral reconstruction, reference comparison,
  checkerboard exploded members, and both extremes of all three responsive
  reveal envelopes, alongside source/render-scale alpha-band diagnostics.

No image, voice, or video provider call is required by this engineering
release. The stopped pilot remains negative evidence and is not resumed or
published.

## Inherited 0.16.0-dev.3 hardening

This development release completes VOX Phase 2.2 asset-family and transparent
edge production hardening. It does not include a final reference film and its
acceptance fixtures make no image, voice, or video provider calls.

## Registered supported-subject families

- Adds strict registered-family authoring and manifest-binding schemas plus
  `assets:derive-registered-family`.
- Deterministically derives `support-rear`, `subject`, and `support-front` from
  a registered complete master, registered sheet cell, or formally processed
  sheet member while retaining one canvas, origin, registration, source master,
  family fingerprint, and context-preserving recovery policy.
- Automatically records manifest provenance and active/superseded lifecycle,
  optionally patches matching supported-subject nodes, rejects unplaced tight
  images, and reports provider image calls, local derivatives, and calls
  avoided.

## Rectangular alpha residue

- Adds deterministic low-alpha horizontal/vertical band detection at source
  resolution and actual proof/render scale.
- Correlates diagnostics with canvas, crop, placement, and rectangular clip
  boundaries; separates thin rectangular residue from broad paper shadows and
  normal curved silhouettes.
- Integrates independent failures into project validation, quality reports,
  composition/style proof JSON and overlays. Checkerboard, tight-crop, and
  motion-stress evidence remain required for human semantic review;
  `key-edge-clean` is not a substitute.

## Proof and packaging

- The no-provider Phase 2 fixture now includes a locally derived registered
  supported-subject family in all three Chromium renders.
- Adds positive, negative, and extreme alpha fixtures and formal F035/F037
  proof commands.
- Bumps executable identity and packages all schemas, CLIs, proof helpers,
  tests, Skill guidance, and fixture assets together.

## Previous Phase 2.1 audit fix

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
