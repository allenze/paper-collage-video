# Layer-Complete Asset Planning

Read this before planning or generating any visual whose rear, subject, and
front planes may move at different speeds, directions, scales, or rotations.

## Decide Motion Capability Before Source Generation

An opaque composed image contains only the pixels visible in that composition.
It does not contain the hidden bottom of a boat, the background behind a
character, or the continuation of a foreground wave. Mask extraction from that
image can recover visible fragments, not complete motion-capable layers.

Choose one capability:

| Capability | Permitted source | Permitted motion |
|---|---|---|
| `rigid-locked` | one approved `rigid-master` | whole-master/group/camera motion only |
| `bounded-relative` | one `registered-layer-sheet` or `context-preserving-layer-edits` package | member-relative motion inside the proved reveal envelope |

Never label a flat opaque master as `bounded-relative`. If a project needs only
carrier motion, retain it as `rigid-locked`; do not create a false registered
family by masking visible fragments.

## Compile the Source Package Before Provider Approval

For every layer-aware treatment, author:

- a stable `sourcePackageId`;
- `pattern=supported-subject` for a contact carrier or
  `pattern=registered-depth-stack` for independent depth planes;
- `motionCapability`;
- `sourceStrategy`;
- exactly three ordered layer intents when capability is
  `bounded-relative`:
  - `support-rear` with `completeness=clean-plate`;
  - `subject` with `completeness=full-silhouette`;
  - `support-front` with `completeness=full-overlay`;
- strict depth order `support-rear < subject < support-front`;
- non-negative maximum x/y/scale/rotation reveal limits for `16:9`, `9:16`,
  and `1:1`.

`project:storyboard` compiles this into
`directingSummary.generationBudget.sourcePackagePlans`. The combined concept
approval must copy `sourcePackageDecision` exactly. It records structural
minimum calls, expected calls, local derivatives, avoided calls, and the
profile hard ceiling. A ceiling is planning capacity, not provider
authorization or automatic spending. Creative Plan v4 separately records
`approvedImageBudget.imageAttemptLimit`; the combined approval's
`budgetDecision.imageAttemptLimit` must cover the expected calls, stay at or
below the profile ceiling, and becomes the only limit the attempt ledger may
reserve against.

One single-scene profile reserves:

| Profile | Base attempts | Layer-package reserve | Hard ceiling |
|---|---:|---:|---:|
| `draft` | 4 | 2 | 6 |
| `balanced` | 4 | 4 | 8 |
| `full-depth` | 5 | 6 | 11 |

The reserve scales with scene count. The compiler rejects a storyboard whose
structural minimum exceeds the ceiling.

## Source Strategies

### Registered layer sheet

Use one schema-v7 image request with:

- `sourceStrategy=registered-layer-sheet`;
- `packageRole=registered-sheet`;
- a 2×2 `sheetLayout` containing `reference`, `support-rear`, `subject`, and
  `support-front` exactly once;
- all three `memberAssetIds`;
- the complete source master in `referenceAssetIds`;
- the formal recovery policy.

This costs one expected provider image call, creates three deterministic local
derivatives, and avoids three calls compared with reference + three
full-context edits.

### Context-preserving layer edits

Use one complete reference generation plus three provider edits. Every member
request lists the same package, all member ids, all reference ids, exact role
and completeness, and uses the complete reference as
`compositionBinding.derivation.parentAssetId`. This costs four expected
provider calls and normally creates three canvas-normalization derivatives.

Never generate one family member without the full source package context. For
repair, try deterministic local processing first. If new pixels are required,
use a mask against the complete original source context; otherwise regenerate
the complete source package.

## Runtime and Provenance

`assets:derive-registered-family` consumes only schema-v2 family specs. Every
member must:

- preserve the entire shared canvas and top-left origin;
- share registration, source master, source package, strategy, recovery
  policy, and family fingerprint;
- record role, completeness, source lineage, hash, lifecycle, and
  `trimmed=false`;
- remain an active `registered-family-member` manifest record.

`registered-depth-stack` has exactly three asset children, one per role. Each
child keeps a full-canvas transform, declares its own depth, and stays within
the smallest authored reveal limit across the three responsive profiles.
Layer scale may stay at `1` or expand above it but may never shrink below `1`;
the envelope's `scale` is reviewed protective overscan expansion, not
permission to reveal outside a clean plate. Camera parallax may use those child
depths only when its zoom/focal-depth combination also keeps every resolved
member scale at or above `1`. Other coupled groups remain one depth carrier.

## Proof

Single-asset motion stress is not sufficient for a layer family. The
composition proof must produce:

- neutral reconstruction;
- reference-versus-reconstruction comparison;
- checkerboard exploded view of all three complete members;
- original and actual render-scale alpha-band evidence per member;
- both reveal-envelope extremes at `16:9`, `9:16`, and `1:1`.

Every responsive envelope extreme must have zero transparent pixels in the
final composite. Human review still decides whether the rear is a credible
clean plate, the subject silhouette is complete behind occluders, the front
overlay is complete, and the reconstructed composition preserves the approved
meaning.
