# Asset, Composite, Motion, and Delivery Quality

Read this before style sampling, bulk images, v10 composition/v9 editorial
authoring, proof review, or delivery tuning.

## Two Quality Scopes

`quality-report.json` v6 contains `eventTimeline`, current `assets`,
`composites`, non-current `assetHistory`, per-entry `reviewScope`, and one
`reviewSurfaceFingerprint` over the exact review targets, technical results, and
evidence hashes. A visible consumer uses `runtime-visible`; an active provider or
source asset not yet in the execution tree uses `source-asset`. A top-level
coupled source family declared `renderParticipation=derivation-only` is never
rendered and receives only deterministic source completeness, provenance, and
registered-derivation checks—no human composition, occlusion, depth, or
responsive review. If the same file also reaches a visible consumer,
`runtime-visible` wins. Manifest records marked `superseded`, `rejected`, or
`recovery-source` stay auditable but do not enter the current pass denominator
unless the execution tree still reaches that file. A passing file does not prove
that a person is inside a boat or trees remain above water. Both current quality
scopes must pass.

Run `project:quality <slug> prepare` after files exist. Then generate a fillable review batch with `project:quality <slug> scaffold --output=projects/<slug>/quality-review-scaffold.json --reviewer=<reviewer>`. The scaffold lists required/pending checks and current evidence paths but never pre-populates `passedChecks`; inspect original-resolution assets in small same-type batches, make real decisions, and record the edited file. SHA-256 changes invalidate affected file reviews; changing a bound semantic contract or generation family also invalidates them.

The schema-v2 scaffold binds both the complete report fingerprint and every target fingerprint. `record-batch` rejects the whole input atomically when either has changed, so an old scaffold cannot approve removed targets or miss new ones. Generate a current bound review surface with `project:quality <slug> contact-sheet --input=projects/<slug>/quality-review-scaffold.json`; its index records the report fingerprint, source evidence hashes, and generated page hashes. Never display an older unbound contact sheet as current.

Generating a non-empty scaffold starts one quality-review metric session and persists the scaffold's current evidence paths and hashes in the report; a successful `record-batch` closes it. If reviews remain, the command writes `quality-review-scaffold.pending.json`, reports the exact remaining IDs, and starts the next review session. The edited batch normally submits reviewer, pass/fail checks, and note. Omit `evidenceFiles` to inherit the current fingerprint-bound set, or provide it explicitly only to override that set. Keep those operations adjacent to the actual inspection so the session remains useful. The window intentionally includes host vision/tool orchestration and must not be described as raw model inference latency.

Registered members add topology-sensitive asset checks: `silhouette-fidelity`, `negative-space-clean`, and `background-leak-free`. A `supported-subject` composite also requires `motion-isolation-clean`. Passing any of those checks requires `evidenceFiles` from the current proof bundle. `key-edge-clean` only detects matte/color contamination; hard 0/255 alpha can pass that check while still deleting a limb or carrying background pixels.

Every transparent foreground also receives `rectangular-alpha-band-free`. The detector scans horizontal and vertical runs whose alpha is 4–96, requires at least 24 pixels and 42% of the relevant axis, merges adjacent scan lines, and treats a band as thin at no more than 2.5% of the cross-axis. It correlates candidates within 1.2% of canvas edges, crop edges, or registered placement/rectangular clip edges; four compatible sides form an explicit rectangular-residue error. Broad soft transitions remain informational so ordinary paper shadows do not fail, while an unusually long uncorrelated straight band is a warning. Diagnostics name scale, orientation, exact coordinates, span, correlation, classification, and severity.

The same inspection runs once at original resolution and again after Lanczos
scaling to the asset's actual proof/render dimensions. Proof bundles contain
`*-alpha-bands.json` and `*-alpha-bands.png`; quality requires current passing
scale evidence for all three `supported-subject` and
`registered-depth-stack` members. These deterministic artifacts do not replace
visual inspection of the alpha mask, checkerboard, tight crop, or family proof.
`key-edge-clean` is a different chroma/matte test and cannot be used as a proxy
for rectangular crop residue.

For a registered member derived from a chroma-key sheet cell, quality also
requires `keying-provenance-current`: the adjacent `.key.json` must exist and
its SHA-256 must match the registered-family binding. Inspect internal negative
spaces as well as the outer silhouette; a clean outer edge does not excuse
ocean/background pixels trapped inside a window, handle, propeller, or foliage
hole.

When the source uses a provider-native observed plane, quality additionally
requires `observed-key-plane-current`. The `.key.json`, registered-family
binding, and source observation must agree on observed key color, policy
fingerprint, and source-bound observation fingerprint. This deterministic
check proves provenance freshness, not semantic cutout correctness; the
checkerboard, tight crop, negative spaces, reconstruction, and motion-stress
evidence still require human review.

Semantic risk adds evidence-backed checks:

- identity: `identity-family-consistent`, `identity-distinct-within-frame`, `cross-scene-identity-continuity`;
- mechanism: `mechanism-complete`, `load-path-readable`, `physical-plausibility`, `reference-conformant`;
- diagram: `diagram-edge-clean`, `small-text-legible`, `no-procedural-noise-on-semantic-lines`.

The runtime deterministically rejects `feTurbulence`, `feDisplacementMap`, and `feBlend` in diagram-critical SVG files. Raster diagrams and physical correctness still require original-resolution semantic evidence.

For the style gate, run:

```bash
npm run style:proof -- <slug> --duration=4
npm run project:quality -- <slug> prepare
```

The schema-v6 style report uses `scope=style`, binds the complete
`styleProofPlan`, and emits a structured composite for every selected directing
target, including `free` targets. Its current composite can satisfy the matching
quality target directly; a separate full-project composition proof is not
required merely to approve style. Inspect
`dist/<slug>/style-proof/evidence/` at useful resolution: alpha masks,
checkerboard isolates, tight crops, and before/shifted motion-stress sheets
where applicable. For a `registered-depth-stack`, inspect the family as a
whole: neutral reconstruction, reference comparison, checkerboard exploded
view, and both reveal-envelope extremes for 16:9, 9:16, and 1:1. These six
family artifacts must be current and show zero transparent output pixels;
isolated member motion stress cannot prove hidden content. Record participating
assets and the representative composite with those paths.

```json
{
  "reviews": [
    {
      "assetId": "traveler-subject",
      "reviewer": "host-vision",
      "passedChecks": ["subject-complete", "edge-clean", "silhouette-fidelity", "negative-space-clean", "background-leak-free"],
      "failedChecks": [],
      "evidenceFiles": [
        "dist/story/style-proof/evidence/traveler-subject-alpha.png",
        "dist/story/style-proof/evidence/traveler-subject-checkerboard.png",
        "dist/story/style-proof/evidence/traveler-subject-tight.png",
        "dist/story/style-proof/evidence/traveler-subject-motion-stress.jpg"
      ]
    }
  ]
}
```

After final local audio, actual timing data, and real v10 composition/v9
editorial groups/state sequences exist, run (the proof command synchronizes
measured narration duration first and reuses only project-, asset-, and
runtime-fingerprint-current frames/targets):

```bash
npm run project:composition-proof -- <slug>
npm run project:quality -- <slug> prepare
```

To deliberately bypass every proof cache layer, append `--force`. The generated report must say `cache.forced=true` and show zero reused frames, composites, and asset evidence.

It also creates `composition-proof/evidence/` alpha masks, checkerboard
isolates, tight crops, and motion-stress sheets for ordinary coupled assets
introduced after style approval. Depth stacks receive the six family artifacts
described above. Inspect full proof frames, relationship crops, debug frames,
and these post-style family sheets. Record composite reviews in the same atomic
batch file, using `compositeId` instead of `assetId`:

```json
{
  "reviews": [
    {
      "compositeId": "group:scene-01:boat-rig",
      "reviewer": "host-vision",
      "passedChecks": ["support-contact", "inside-or-on-readable", "front-occlusion", "shared-motion", "identity-continuity"],
      "failedChecks": [],
      "evidenceFiles": ["dist/story/composition-proof/crops/group-scene-01-boat-rig-final.png"],
      "note": "Establish, action, and final crops inspected at useful resolution"
    }
  ]
}
```

Semantic targets use ids such as `semantic:recurring-cast:cast-comparison`. When a target spans scenes, inspect every generated crop together before passing continuity. When a mechanism target is reviewed, explicitly compare its crop with the declared parts, connections, load paths, degrees of freedom, forbidden forms, and reference evidence.

```bash
npm run project:quality -- <slug> record-batch --input=<reviews.json> --quiet
```

Never pass a semantic check merely to unblock production. Changing a member, mask, group transform, boundary, anchor, keyframe, event, scene transition, or proof time changes the composite fingerprint and invalidates that review.
Replacing or editing a recorded evidence file also invalidates its review. At the style gate, each member review must reference that proof bundle's alpha mask, checkerboard, tight crop, and motion-stress sheet; the composite review must reference its full/crop/debug proof frames and member motion-stress sheets. An unrelated screenshot cannot satisfy the gate.

Composition-proof fingerprints use the `composition-proof` runtime surface
rather than the complete package identity. That surface excludes subtitle-only
renderer and subtitle-contract files, and the proof command renders a dedicated
project input with subtitles removed. A subtitle-only change therefore
invalidates final visual/subtitle evidence while preserving current asset and
composition reviews. Changes to composition, proof, quality, schema, or shared
renderer inputs still invalidate the affected proof targets.

## Pattern-Specific Review

- `supported-subject`: support contact, readable inside/on relation, shared carrier motion, identity continuity, and clean subject isolation under relative motion. The default `between-supports` layering also requires visible front occlusion; an explicitly authored `subject-front` relationship instead requires the complete subject to remain clearly above all support members.
- `registered-depth-stack`: exact clean rear/full subject/full front members,
  common registration/full canvas, strict rear-to-front depth, neutral
  reconstruction/reference conformity, no transparent exposure at either
  extreme of every responsive reveal envelope, and clean bounded relative
  motion. When `subjectTravelEnvelope` is authored, also inspect all three
  responsive lower-left/upper-right subject-only travel pairs and confirm the
  subject crosses the world while rear/front remain locally stable.
- `registered-environment`: registration alignment, boundary respected, no duplicated semantic band, readable depth, readable final composition.
- `looping-environment`: every active strip binding matches its manifest derivative; RGB and alpha seams pass at source and render scale; every semantic surface has visible full-span source support; a ground strip has real alpha support at both repeat edges; three-tile stitches are clean; 16:9, 9:16, and 1:1 have zero uncovered pixels at worst phase; far-to-near speed is strictly ordered; measured ground displacement has the authored sign and crosses a real seam; every tracked/participant subject follows its screen/world anchor contract; and requested near-strip occlusion has real higher-z and vertical overlap.
- `state-sequence`: state order correct, canvas and declared anchors stable within `anchorPolicy.maximumDrift`, every state has reviewable facing metadata, every derived state carries a current anchor-overlay proof, every identity-reference SHA matches an active manifest asset, identity is visually consistent, transitions are clean, and every state is bound to a current proof frame.
- `parallax-rig`: depth order readable, camera coupling clean, registered groups stable, final composition readable.
- `motif-field`: density readable, bounds clean, exclusion zones clean, motion clean, loop clean, final composition readable. For `rise-drift`, verify monotonic bottom-to-top travel, slight expansion, and invisible respawn.
- `typography`: fit/overflow, font loading, reveal/emphasis edit-point binding, mixed-script legibility, and safe-area/exclusion compliance.
- `annotation`: semantic anchors, route validity, title/subtitle/motif exclusion clearance, lifecycle binding, and counter state.
- `data-graphic`: data/domain/format/geometry mapping, focus/reveal states, edit-point binding, and deterministic SVG output.
- `editorial-transition`: declared shape/position/scale/color/value continuity, hard-cut enforcement for match types, fallback policy, and before/at/after frames.
- `responsive-directing`: three explicit plans, bounded placements/crop/focus/exclusions, and density budget.
- bound event: visual event visible, sound event bound when required, proof time bound, final state preserved.
- semantic contract: every requested check is visible in its exact target shots; cross-scene checks compare all bound scenes rather than one attractive frame.

Deterministic checks already block missing slots, mismatched canvases,
non-registered or mixed-provenance families, incomplete layer roles, wrong
depth order, motion outside reveal envelopes, duplicate carrier motion,
off-zone contacts, absent front alpha, rectangular low-alpha crop residue,
incomplete upper/lower clips, duplicate semantic coverage, invalid targets,
missing required sounds, out-of-window proofs, stale style fingerprints, and
missing topology/family evidence. They do not infer whether every semantic part
is intact; that remains evidence-backed semantic review.

## Motion, Visibility, and Event Authoring

The scene camera, camera-coupled depth offset, group transform, child local transform, keyframes, idle motion, transient emphasis, and persistent visibility state compose in that order. A group carries its attached family once. Child keyframes are local deltas and cover normalized `0..1`; narration resync therefore preserves the spatial relationship. `looping-environment` keeps its viewport carrier fixed, folds camera/parallax into the internal strip phase and non-shrinking content scale, and repeats enough copies for gap-free coverage. `motif-field` then expands its fixed-seed instances inside node-local bounds, deterministically rejects protected zones, and proves a closed or invisible loop edge.

Map every approved beat to one or more ordered events. Target the group when the entire registered assembly reacts, or a child for a genuinely local action. `scene.events` schedules both visuals and sound; do not create a second audio event list. A visibility event persists after its window and requires a truthful initial state; an emphasis event is transient. Bind critical events to authored proof ids.

The normal contact sheet and final report reuse the authored proof moments and event timeline. A separate transition contact sheet samples every cut or opaque boundary; inspect it for false foreground/background combinations, edge gaps, uncovered midpoint swaps, spatial-direction errors, and cuts that miss the declared beat. The report must expose transition intent/type/motivation counts and cut ratio; any cut without valid rhythmic or impact motivation is a contract failure. Inspect establish, action/peak, and final states for relationship readability, subtitle safety, depth order, motif density/bounds/exclusions/loop edge, and preserved consequences.

Do not count imperceptible camera drift as story activity. Use `static` when stillness is intentional; non-static presets have a minimum visible movement floor. The rendered continuity report remains authoritative because authored motion can still disappear after compositing or encoding.

## Subtitles and Audio

`project:assets-ready` owns narration synchronization, subtitle derivation, v10
composition/v9 editorial validation, current-proof enforcement, and both
quality gates. Provider or forced-alignment timing wins; actual final-audio
edit-point evidence is authoritative for editorial bindings. Review
reading-speed warnings. Every narration source must have non-empty transcript
text. Narrated scenes must keep subtitles visible, reconstruct that text after
whitespace normalization, use ordered cue ranges inside
the narration window, and cover at least 80% of that window. The renderer uses
duration-aware fades, so a short cue never receives overlapping interpolation
stops, and places the subtitle inside the active responsive safe area.

The final report repeats those machine checks and extracts one frame from the
encoded video for every narrated scene into `subtitle-contact-sheet.jpg`. Treat
that sheet as the human visual proof for legibility, occlusion, clipping, and
font appearance; its existence is not OCR proof that the pixels spell the
expected text.

After narration registration and synchronization, `project:assets-ready` runs `project:audio-calibration propose`, builds an audio-only timeline mix, and measures LUFS/true peak. A passing mix needs no decision. A failing mix writes a source-fingerprinted proposal and stops with an exact `project:audio-calibration accept` command; acceptance requires the matching fingerprint and a human note, updates `audio.narration.volume`, and reruns preflight. Changed source audio or timing invalidates the decision. The final artifact report remains authoritative. When only audio sources/gain change and the cached visual fingerprint is current, preview/final rendering reuses the encoded video stream and remuxes audio instead of rerendering frames.

Reports also intersect detected silence with sampled low-motion ranges. Silence with meaningful animation and a static explanatory image with narration are valid; only their unapproved overlap fails. Read `timing-continuity.md` for thresholds and proof-backed quiet holds. Never add background music solely to hide a continuity failure.
