# VOX Phase 2.3 · Layer-complete assets and registered depth stacks

Status: implemented and locally verified for `0.16.0-dev.4` on 2026-07-23

## 1. Decision

Stop the 《纸舟穿浪》 production pilot. Preserve its recorded provider attempt and
flat source image as negative production evidence, but do not register the
candidate masks or resume the film.

The failure occurred before masking. Storyboard v9 can name a coupled relationship
and motion treatment, but it does not compile:

- the complete visual planes required by that motion;
- which transforms are shared versus relative;
- the hidden pixels that may become visible;
- the reveal envelope for each responsive output;
- the provider source-package strategy and exact attempt demand.

As a result, a schema-v6 request could validly ask for one opaque flattened
composition even though the intended motion needed a clean rear plate, a complete
subject silhouette, and a complete foreground overlay.

`0.16.0-dev.4` must move this decision before provider approval and generation.

## 2. Supported production primitives

### 2.1 Rigid composite

Use one flattened complete master only when all visual members share one carrier
and no member-relative transform can expose hidden content. Whole-master and
camera movement are allowed. Member-level parallax or local reveal is forbidden.

### 2.2 Supported subject

Use for persistent contact such as a person in a boat or an object on a table.
The group owns world-space motion. A subject may have bounded local motion only
when the source package proves a complete subject silhouette and clean support
coverage throughout the authored reveal envelope.

### 2.3 Registered depth stack

Add a first-class `registered-depth-stack` composition pattern for rear, subject,
and front planes that intentionally move at different depths or with bounded
relative transforms. Every member remains on one logical canvas and carries:

- a common registration and source-package identity;
- a semantic role and deterministic z-order;
- a completeness role (`clean-plate`, `full-silhouette`, or `full-overlay`);
- a responsive reveal envelope;
- source-package provenance and lifecycle;
- current exploded-motion and reconstruction proof.

Do not emulate this primitive with three unrelated images, a flattened master, or
project-specific opacity/keyframe branches.

## 3. Storyboard authoring and compilation

Upgrade Project and Storyboard to schema v10. Old v9 projects are intentionally
not migrated.

A coupled treatment that can expose hidden content authors `composition.layers`:

```json
{
  "pattern": "registered-depth-stack",
  "motionCapability": "bounded-relative",
  "sourceStrategy": "registered-layer-sheet",
  "layers": [
    {"id": "wave-rear", "role": "support-rear", "completeness": "clean-plate", "depth": -0.7},
    {"id": "boat", "role": "subject", "completeness": "full-silhouette", "depth": 0},
    {"id": "wave-front", "role": "support-front", "completeness": "full-overlay", "depth": 0.7}
  ],
  "revealEnvelope": {
    "16:9": {"x": 0.03, "y": 0.03, "scale": 0.025, "rotationDegrees": 1.5},
    "9:16": {"x": 0.05, "y": 0.04, "scale": 0.035, "rotationDegrees": 2},
    "1:1": {"x": 0.04, "y": 0.035, "scale": 0.03, "rotationDegrees": 1.5}
  }
}
```

The compiler owns `compositionPlan.layerStacks` and
`directingSummary.sourcePackagePlans`. It must:

1. normalize one plan per scene/target;
2. reject conflicting definitions across beats;
3. require all three roles exactly once;
4. require increasing rear/subject/front depth;
5. require complete responsive reveal envelopes;
6. distinguish `rigid-locked` from `bounded-relative`;
7. calculate the source strategy's expected and maximum provider attempts;
8. include the plan in directing and style-proof fingerprints.

## 4. Provider source packages and budget

Upgrade image requests to schema v7 with an optional `layerPackageBinding`.
`registered-depth-stack` and bounded-relative `supported-subject` requests require
that binding.

Supported strategies:

| Strategy | Use | Expected calls |
| --- | --- | ---: |
| `rigid-master` | Flattened source; carrier/camera motion only | 1 |
| `registered-layer-sheet` | One registered sheet containing assembly reference, rear clean plate, complete subject, and front overlay | 1 |
| `context-preserving-layer-edits` | One assembly reference plus full-context provider edits for the three complete members | 4 |

Independent text-to-image requests for coupled members remain forbidden.
Context-preserving edits must name the complete reference as their parent and
generation context.

Creative Plan v3 keeps profile ceilings but adds:

- `baseImageAttempts`;
- `layerPackageAttemptReserve`;
- `maxGeneratedImages`.

The storyboard compiler reports:

- `requiredProviderImageCalls`;
- `expectedProviderImageCalls`;
- `localDerivatives`;
- `avoidedCalls`;
- one source-package line item per coupled target.

`project:confirm-concept` must bind this exact compiled budget summary. If the
selected profile cannot cover required source packages, storyboard compilation or
confirmation fails before any attempt can be reserved. The decision presented to
the human states both the expected count and hard ceiling.

Proposed one-scene profile ceilings:

| Profile | Base attempts | Layer-package reserve | Hard ceiling |
| --- | ---: | ---: | ---: |
| `draft` | 4 | 2 | 6 |
| `balanced` | 4 | 4 | 8 |
| `full-depth` | 5 | 6 | 11 |

The reserve is a ceiling, not a target. A one-call reliable registered sheet still
records one provider call and three local member derivatives.

## 5. Registered family and runtime contract

Upgrade registered-family spec/binding to schema v2. Add:

- `pattern`: `supported-subject` or `registered-depth-stack`;
- `motionCapability`: `rigid-locked` or `bounded-relative`;
- `sourcePackageId`;
- `sourceStrategy`;
- `revealEnvelope`;
- per-member `completeness`;
- reconstruction and exploded-proof fingerprints.

For a bounded-relative family:

- rear must be `clean-plate`;
- subject must be `full-silhouette`;
- front must be `full-overlay`;
- members must share the logical canvas, registration, and source package;
- a flattened `source-master` without a layer-package binding is invalid.

Add `registered-depth-stack` to composition schema/types/renderer. The group owns
placement. Member `depth` and bounded local motion are composed inside the group.
The validator rejects any runtime transform exceeding the declared reveal
envelope.

For `supported-subject`, keep existing contact-zone validation. If every child is
rigid-locked, a flat master is permitted. If a child has visible local motion, the
family must be bounded-relative and layer-complete.

## 6. Deterministic proof and quality

Replace the current isolated checkerboard-only motion stress for registered
families with family-aware evidence:

1. member alpha mask;
2. checkerboard isolate;
3. tight crop;
4. neutral reconstruction compared with the approved assembly reference;
5. exploded view showing all complete members simultaneously;
6. positive and negative extremes of every responsive reveal envelope;
7. source- and render-scale alpha-band diagnostics.

Add quality checks:

- `clean-plate-complete`;
- `full-silhouette-complete`;
- `full-overlay-complete`;
- `neutral-reconstruction-match`;
- `reveal-envelope-clean`;
- `relative-motion-occlusion-clean`.

The flat 《纸舟穿浪》 source becomes a negative fixture: it must fail before
provider reservation when authored as bounded-relative, and it must fail family
quality if manually introduced as a member source.

## 7. Vertical implementation slice

Implement and verify in this order:

1. schema v10/v7/v2 contracts and fixture updates;
2. Creative Plan v3 profile ceilings and confirmation binding;
3. storyboard layer topology and source-package compiler;
4. provider request validation and attempt preflight;
5. registered-family v2 provenance and derivation validation;
6. TypeScript runtime types and `registered-depth-stack` rendering;
7. project/runtime validation against reveal envelopes;
8. family-aware proof, quality checks, and invalidation fingerprints;
9. positive/negative automated tests and representative Chromium proof;
10. Skill references and concise `SKILL.md` routing;
11. package version `0.16.0-dev.4`, runtime fingerprint regeneration,
    `npm run plugin:sync`, packaged-copy tests, installed-cache validation, and a
    fresh-workspace smoke test.

No image, voice, or video provider call is required for this engineering slice.

## 8. Completion criteria

`0.16.0-dev.4` is complete only when:

- a relative-motion treatment cannot reach provider reservation without a current
  layer-complete source-package plan;
- the planned attempt demand fits the explicitly approved ceiling;
- an opaque flat master is accepted only for rigid motion;
- a three-plane registered depth stack renders with distinct depths;
- neutral reconstruction and maximum-motion evidence pass at 16:9, 9:16, and
  1:1;
- the failed flat-source case is deterministically rejected;
- provider calls, local derivatives, and avoided calls remain truthful;
- source, packaged plugin, installed cache, and a fresh workspace report the same
  version and runtime fingerprint.

## 9. Implementation and verification record

The vertical slice is complete in source and in the packaged plugin:

- Project/Storyboard v10, Creative Plan v3, image request v7, and registered
  family v2 carry one compiled layer-source plan from authoring through provider
  preflight, runtime validation, quality, proof, and approval fingerprints.
- `registered-depth-stack` is a first-class composition primitive. Its
  `support-rear`, `subject`, and `support-front` members require
  `clean-plate`, `full-silhouette`, and `full-overlay` respectively, preserve
  one canvas, use strict depth order, and cannot shrink below scale 1.
- A flat master is accepted only as `rigid-locked`. Bounded relative motion
  requires either a registered 2×2 layer sheet or three full-context edits.
  Isolated member generation and legacy member-source substitution are rejected.
- The concept decision binds structural/expected provider calls, deterministic
  derivatives, avoided calls, and the exact profile ceiling. One-scene ceilings
  are `draft=6`, `balanced=8`, and `full-depth=11`; reserve is capacity rather
  than automatic spend.
- Family proof emits neutral reconstruction, reference comparison, an exploded
  checkerboard, per-member source/render-scale alpha evidence, and positive and
  negative extremes for `16:9`, `9:16`, and `1:1`.

Executable identity:

- plugin version: `0.16.0-dev.4`;
- runtime fingerprint:
  `8e6afbffd855da85e58613562bc3e06c0720987d614c2a73dd8510c4272a2d37`;
- source Skill, packaged Skill, and installed-cache Skill have the same SHA-256;
- source, packaged, and installed-cache `runtime-build.json` files have the same
  SHA-256;
- installed cache:
  `/Users/lester/.codex/plugins/cache/paper-collage-video/paper-collage-video/0.16.0-dev.4`.

Fresh-cache acceptance used only the installed dev.4 package:

- workspace:
  `/private/tmp/paper-collage-dev4-fresh.kfpBnG`;
- doctor: `READY`;
- TypeScript check: passed;
- schema-v10 validation: passed;
- packaged-runtime tests: 141/141 passed;
- deterministic Phase 2 proof: passed after rendering 180-frame H.264 previews
  at 960×540, 540×960, and 720×720;
- all nine responsive envelope observations reported zero transparent pixels;
- verifier runtime fingerprint matched dev.4;
- proof provider calls: 0.

The deterministic family fixture records `providerImageCalls=0`,
`localDerivatives=3`, and `avoidedCalls=3` because its registered layer sheet is
a local fixture. Those numbers prove accounting behavior; they are not claims
about real-provider production savings.

## 10. Finding status and remaining production evidence

- F035 and F037 remain historically superseded by the Phase 2.2 vertical slice.
  Dev.4 adds the missing semantic completeness, reconstruction, and reveal
  contract that the stopped pilot exposed; deterministic source, packaged, and
  fresh-cache evidence passes.
- F034 is not closed. The stopped production pilot never reached its first full
  real-project validation, so there is no truthful count of initial validation
  errors, their first stage, or real repair rounds.
- The stopped 《纸舟穿浪》 source and its one historical image-provider attempt
  remain negative evidence only. They were not converted into a registered
  family, resumed, or used as dev.4 proof.
- A later separately approved production pilot still needs to verify provider
  reliability for the 2×2 registered layer sheet, human semantic completeness
  of all three members, and actual provider/local/avoided-call accounting.
- No final reference film was started.
