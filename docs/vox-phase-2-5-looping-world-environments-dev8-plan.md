# VOX Phase 2.5 looping world environments and world-motion proof — dev.8 plan

Status: implemented for `0.16.0-dev.8`. Engineering provider budget and actual
provider usage were both zero.

## 1. Decision

The current composition model can place a generic node wider than its parent:
`transform.width` has no upper bound and the renderer multiplies it by the
parent width. That low-level capability is not the production abstraction
needed for a vehicle travelling through a persistent world.

Current registered environment families are still viewport-oriented:

- `registered-environment` keeps a semantic boundary fixed on one shared
  registered canvas;
- `registered-depth-stack` keeps rear, subject, and front on one shared canvas
  and allows only proof-bounded relative motion;
- `subjectTravelEnvelope` lets the complete subject cross that finite world
  while rear and front remain locally stable;
- none of those patterns owns seamless horizontal tiling, tile phase, repeated
  coverage, or depth-relative world velocity.

A car travelling along a road therefore exposes an architectural gap. Phase
2.5 adds a separate first-class `looping-environment` relationship whose
children are semantic `world-strip` nodes plus exactly one tracked
asset/state-sequence subject that does not inherit world phase. It does not enlarge
`registered-depth-stack` reveal envelopes or hand-author repeated asset nodes.

## 2. Visible behavior

The primitive must directly express this scene:

- a tracked car remains near the focal corridor while the world moves past it;
- a far mountain strip, middle tree strip, road strip, and near vegetation
  strip move horizontally at depth-dependent speeds;
- every strip has a canonical left/right seamless join;
- the renderer repeats enough copies to cover the viewport before, during, and
  after a wrap;
- foreground strips may contain alpha, but their RGB and alpha seams must both
  close;
- a camera may still push, pull, or pan, but world travel remains independently
  measurable after camera compensation;
- the scene may cross any number of strip boundaries without exposing empty
  pixels or producing a visible jump.

Phase 2.5 initially supports horizontal travel only. Vertical infinite worlds,
curved paths, perspective road deformation, procedural 3D terrain, and runtime
crossfade seam hiding are out of scope.

## 3. Viewport, tile, and world size

The contract must distinguish three sizes:

1. **Video viewport** — for example 1920×1080.
2. **Canonical tile** — one finite environment strip with a proved horizontal
   seam.
3. **Logical world** — unbounded because the renderer repeats the canonical
   tile.

Raw source pixels do not by themselves decide whether a tile is large enough.
The relevant measure is the tile's resolved width after it has been scaled to
its authored render height:

```text
resolvedTileWidth =
  sourceWidth / sourceHeight * resolvedRenderHeight

tileSpanViewports =
  resolvedTileWidth / viewportWidth
```

Phase 2.5 rules:

- an environment `world-strip` must resolve to at least `1.0` viewport width;
- the default production target is at least `1.5` viewport widths;
- a `full-depth` hero environment should target about `2.0` viewport widths
  when provider resolution and visual detail permit;
- small repeated accents that do not meet this environment minimum remain
  `motif-field`, not `world-strip`;
- the logical world is still infinite even when one canonical tile is only one
  viewport wide;
- no author manually adds duplicate strip nodes merely to fill the frame.

This makes “the environment is larger than the video” a world-space invariant
without requiring every provider file to have a literal pixel width greater
than 1920.

## 4. Authoring and compiled contract

Storyboard authoring adds a visible-change route:

```text
changeClass = world-travel
composition.pattern = looping-environment
motion.preset = scroll-world-x
```

The author declares:

- stable environment/package id;
- horizontal direction;
- scene travel measured in viewport widths;
- far and near speed bounds;
- ordered semantic strip roles;
- which strip is the ground/contact reference;
- whether exact scene-loop closure is required;
- one proof time before a seam, one across a seam, and one after it.

The compiler owns:

- concrete speed factors derived from strip depth;
- tile copy counts;
- normalized phase schedules;
- wrap points;
- proof targets;
- provider/local-derivative accounting;
- fingerprints.

Conceptual compiled shape:

```json
{
  "id": "road-world",
  "kind": "group",
  "pattern": "looping-environment",
  "axis": "x",
  "travel": {
    "direction": "left",
    "distanceViewports": 4.5,
    "easing": "linear",
    "closedLoop": false
  },
  "speedRange": {
    "far": 0.12,
    "near": 1.15
  },
  "children": [
    {
      "id": "mountain-strip",
      "kind": "world-strip",
      "role": "far",
      "depth": -0.85,
      "src": "projects/car-road/assets/world/mountains.png",
      "tileBindingId": "mountain-loop"
    },
    {
      "id": "tree-strip",
      "kind": "world-strip",
      "role": "mid",
      "depth": -0.25,
      "src": "projects/car-road/assets/world/trees.png",
      "tileBindingId": "tree-loop"
    },
    {
      "id": "road-strip",
      "kind": "world-strip",
      "role": "ground",
      "depth": 0.35,
      "src": "projects/car-road/assets/world/road.png",
      "tileBindingId": "road-loop"
    },
    {
      "id": "grass-strip",
      "kind": "world-strip",
      "role": "near",
      "depth": 0.9,
      "src": "projects/car-road/assets/world/grass.png",
      "tileBindingId": "grass-loop"
    }
  ]
}
```

The exact field names may change during implementation. The behavioral
boundary may not.

## 5. Runtime behavior

`world-strip` is one semantic node, not an array of copied assets.

For every frame the renderer:

1. resolves the canonical tile width at the authored strip height;
2. derives strip speed from group travel and strip depth;
3. computes a deterministic phase modulo the canonical tile width;
4. places one tile immediately before the viewport;
5. renders
   `ceil((viewportWidth + 2 * overscan) / tileWidth) + 2` copies;
6. clips the copies to the scene viewport;
7. composes camera motion after world travel without rewriting strip phase.

The renderer must not:

- crossfade the right edge into the left edge;
- stretch only the last copy to hide a gap;
- reset phase visibly;
- expose one-frame subpixel cracks between copies;
- duplicate authored timing across every rendered copy;
- add project-slug conditionals.

Use stable pixel snapping or deliberate fractional overlap no greater than the
proved renderer tolerance to avoid CSS rasterization cracks. The tile seam
itself must already be valid before rendering.

## 6. Tile asset and provenance contract

Add a `loopingStripBinding` and an
`assets:derive-looping-strip` entrypoint.

The binding records:

- strip family and semantic role;
- source asset, source SHA, and provider provenance;
- canonical tile rectangle;
- axis `x`;
- seam strategy;
- source and output dimensions;
- resolved minimum viewport span;
- alpha behavior;
- edge-band width and edge metrics;
- derivation fingerprint;
- lifecycle and recovery policy.

Initial seam strategies:

1. `exact` — left and right edge bands already match within the strict
   source/render-scale thresholds.
2. `overlap-crop` — the provider source contains a declared repeated overlap;
   the derivation CLI selects one canonical period and crops it
   deterministically.
3. `mirror-crop` — a complete, textured source crop has usable continuous
   interior coverage but transparent presentation margins. The derivation
   concatenates that declared crop with its horizontal mirror, so both repeat
   seams reuse the same source-edge pixels. This is a deterministic full-crop
   transformation, not runtime edge painting or a provider repair. It is
   especially suitable for a paper road whose provider canvas contains a
   centered, ragged-edged strip.

Runtime crossfade, clone-brush repair, and unrecorded manual edge painting are
not formal seam strategies.

A provider request uses an explicit output surface such as
`seamless-strip-x`. Related depth bands may share one provider source only when
the effective pixels per strip remain above the quality minimum. Do not pack
far, mid, road, and near bands into a dense sheet when that would make foliage,
road markings, or paper edges unreadable.

Recovery order:

1. deterministic period/crop/keying correction;
2. masked edit against the complete original strip context with both edge
   neighborhoods visible;
3. complete strip regeneration.

An isolated replacement edge is invalid because it cannot prove the opposite
edge remains continuous.

## 7. Seam, coverage, and motion proof

Every strip proof produces:

- source-resolution left/right edge comparison;
- actual render-scale left/right edge comparison;
- a three-tile stitch sheet with both seams centered;
- RGB difference heatmap;
- alpha difference heatmap for transparent strips;
- before/seam/after frames at a real runtime wrap;
- 16:9, 9:16, and 1:1 worst-offset coverage frames;
- a report containing tile width, viewport span, copy count, phase, wrap frame,
  edge thresholds, uncovered pixels, and pass/fail results.

Deterministic requirements:

- zero uncovered pixels for required opaque coverage;
- no transparent one-pixel crack at either stitch;
- edge metrics pass at source and actual render scale;
- wrap phase is monotonic in the authored direction;
- absolute strip speed is monotonic with depth unless an explicit proof-backed
  exception exists;
- a required world-travel beat moves at least one environment strip by one
  viewport width after camera compensation;
- a declared closed loop returns to its exact initial strip phase.

Human quality review additionally checks:

- no conspicuous landmark appears twice in the viewport unless intentional;
- paper texture, horizon, tree line, road markings, and shadows remain
  continuous through the join;
- repetition cadence is not distracting;
- far/mid/near velocity differences read as depth rather than sliding stickers;
- the tracked subject remains grounded and compositionally readable.

## 8. General world-motion proof

Phase 2.5 also closes the main gap exposed by the submarine revision.

Current envelope proof can establish registration and pixel coverage while a
subject is almost outside the final camera crop. Add one generalized
`worldMotionProof` for both `traverse` subjects and `looping-environment`
strips.

It records:

- isolated target alpha bounds at every proof time;
- target centroid and visible-area ratio in final viewport coordinates;
- camera transform at the same time;
- camera-compensated target/world displacement;
- direction changes;
- minimum and maximum screen occupancy;
- whether the proof assertion's named motion is visually resolvable.

The first implementation should allow authored visibility floors because some
valid scenes deliberately use foreground occlusion. It must reject a
“large-travel” claim whose target is reduced to an unreadable edge fragment.

## 9. Fingerprints and invalidation

Changing any of these invalidates strip and scene proof:

- source file or canonical tile rectangle;
- seam strategy or thresholds;
- strip height/crop/placement;
- depth or compiled speed factor;
- world distance, direction, easing, or start phase;
- camera schedule;
- responsive profile;
- renderer/runtime build;
- proof time or assertion.

Cached repeated copies are renderer implementation detail. They do not become
independent assets or provider derivatives.

## 10. Engineering fixture

Before any provider call, build one deterministic local fixture:

```text
12-second single scene
tracked paper car
far mountains
mid trees
road/ground
near grass
```

The fixture must demonstrate:

- at least four horizontal strip wraps;
- far < mid < ground < near speed;
- one camera push and one pull without destroying world travel;
- car suspension/bob independent from strip motion;
- one foreground occlusion;
- all three responsive profiles;
- exact strip seam proof and world-motion proof;
- preview and final acceptance reports.

The engineering provider budget is zero. A later provider pilot requires a new
concept/provider/model/attempt-limit approval and must report actual strip
calls, local derivatives, and avoided calls separately.

## 11. Delivery slices

### Phase 2.5 / dev.8 — core world model

- **F061** — `looping-environment` authoring and compiler-owned directing plan.
- **F062** — `world-strip` runtime node with deterministic repeated coverage.
- **F063** — looping-strip asset schema, derivation CLI, manifest provenance,
  lifecycle, and recovery.
- **F064** — seam/coverage/depth-speed proof, quality targets, and three-ratio
  evidence.
- **F065** — generalized camera-compensated world-motion and subject-readability
  proof.

This is one complete vertical slice across storyboard, schemas, runtime,
renderer, validation, fingerprints, proof, quality, fixtures, tests, Skill,
docs, packaged plugin, installed cache, and fresh-workspace validation.

### Phase 2.6 / dev.9 — workflow friction

- **F066** — compile or formally synchronize directing execution so
  `executionSyncRequired` does not require duplicate manual timing edits.
- **F067** — deduplicated per-target quality contact sheets and fingerprinted
  scaffold replacement/archival instead of repeated `--force`.
- **F068** — separate structural source-call requirements from revision-time
  actual provider spend in plans and reports.
- **F069** — rename local delivery approval separately from external publish
  authorization.
- **F070** — add useful active-authoring/proof-inspection segments so production
  metrics do not leave most end-to-end time unattributed.
- **F071** — atomic source/package/installed-cache sync-install-verify command.

Phase 2.6 must not weaken style, quality, preview, rights, or external-action
gates.

## 12. Acceptance boundary

Phase 2.5 is complete only when:

- no project-specific renderer branch exists;
- authors do not place repeated copies manually;
- a strip can cross a seam in all three profiles with zero coverage gaps;
- source and render-scale seam evidence pass;
- depth speed ordering and world displacement are deterministic;
- camera-compensated proof distinguishes world motion from camera-only motion;
- the tracked subject remains readable at bound proof times;
- the no-provider car fixture renders preview and final successfully;
- relevant tests, typecheck, schema checks, plugin sync, packaged tests,
  installed-cache fingerprint checks, and fresh-cache Chromium proof pass;
- the Skill explains when to choose `looping-environment` instead of
  `registered-depth-stack`, `registered-environment`, or `motif-field`.

Provider-generated production footage is a later pilot, not evidence that may
replace the deterministic vertical slice.
