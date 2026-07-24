# Motion Directing and Effect Routing

Read this while deciding how a story beat should move. The goal is not to maximize animation. The goal is to choose the smallest truthful mechanism that makes the approved meaning visible and reviewable.

## Start From the Visible Change

Do not begin with a renderer preset. For each beat, name what visibly changes:

| Change class | Required route | Typical examples |
|---|---|---|
| `static-hold` | `motion.kind=static` | readable tableau, deliberate ending hold |
| `ambient-motion` | `continuous-transform` | breathing, paper drift, floating question mark |
| `camera-change` | `continuous-transform` on `scene-camera` | push, pull, pan |
| `depth-parallax` | `continuous-transform` with `parallax-camera` on `scene-camera` | camera-coupled paper planes at authored depth |
| `depth-layer-separation` | `registered-depth-stack` with `bounded-relative` | complete rear plate, complete subject, and complete front overlay move within reviewed reveal envelopes; a full-silhouette subject may additionally use a proved `subjectTravelEnvelope` |
| `world-travel` | `looping-environment` with `scroll-world-x` | tracked vehicle remains readable while seamless mountains, trees, road, and near vegetation cross multiple horizontal wraps |
| `pose-change` | `state-sequence` | hand moves from chest to pointing at a board |
| `prop-state-change` | `state-sequence` | page turns, cards change, book lowers |
| `contact-change` | `supported-subject` | person stands on a boat, book remains in hand |
| `shared-boundary` | `registered-environment` | elephant crosses a waterline, object passes behind a desk edge |
| `graphic-emphasis` | editable `text` or `shape` node plus `continuous-transform` | question marks, circles, arrows, highlights |
| `mechanism-state` | proof-bound treatment with `mechanism` or `diagram` risk | scale balance, force path, causal diagram |
| `visibility-change` | `visibility-transition` plus node `visibility.initial` | a question mark first appears, a card is removed, a label remains after entering |
| `decorative-field` | `motion.kind=motif-field` | bounded petals, dots, fragments, confetti, diagram accents |

A treatment has orthogonal dimensions. Motion (`static`, continuous transform,
state sequence, persistent visibility transition, or deterministic motif
field), composition (`free`, supported subject, registered depth stack, or
registered environment), graphic mechanism, and semantic risk can coexist. A
pointing child standing on a boat is both a state sequence and a supported
subject; do not collapse it into one exclusive effect label.

`depth-parallax` is not generic drift. It targets `scene-camera`, uses
`parallax-camera`, and requires visible camera movement plus at least two
distinct runtime `depth` values in `-1..1`. `0` is the focal plane. A rigid
coupled group owns one depth; its registered children must not repeat the
world-space parallax path. A `registered-depth-stack` is the only coupled
pattern whose rear/subject/front children own separate ordered depths and
bounded local motion. It is legal only after the compiler has locked the three
complete layer roles, shared canvas, source strategy, and 16:9/9:16/1:1 reveal
envelopes. A free group may add deliberate local depth only when that nested
separation is part of the approved design.

`motif-field` is decorative only. Author one target with preset (`drift`, `fall-drift`, `rise-drift`, `burst`, or `orbit`), distribution (`scattered`, `grid`, or `edge`), bounded `count<=64`, cycles, normalized placement `bounds`, and explicit rectangle/ellipse `exclusionZones` around titles, faces, labels, and explanatory data. `rise-drift` is the deterministic physical bubble primitive: every instance begins just below the field, moves monotonically upward, expands slightly, and hides its top/bottom respawn. Keep all fields in one scene at or below 192 instances. Runtime supplies a fixed integer seed, 1–8 reviewed motif sources, base size, and bounded scale/rotation/opacity variation. Placement uses deterministic bounded rejection with motif-footprint clearance; loop presets either close geometrically or hide the respawn edge. The renderer expands the instances deterministically; do not author a large array of individual asset nodes.

`world-travel` is persistent world geometry, not a larger `traverse` or a
motif loop. Author `axis=x`, direction, distance in viewport widths, strictly
ordered far/near speeds, ground strip, tracked subject, exact start phase,
ordered semantic strip roles, and before/seam/after proof ids. Every
`world-strip` resolves to at least one viewport width at its authored height.
The looping group contains those strips plus exactly one asset/state-sequence
tracked subject; this lets near strips genuinely occlude it without inheriting
world phase. The renderer expands internal copies. Authors never place repeated
asset nodes.

Use continuous preset `traverse` for a subject whose world-relative path must be
materially larger than camera drift; runtime validation requires a normalized
path span of at least `0.45`. Use preset `sway` with
`motion.idle.preset=sway` and a bottom-biased `motion.pivot.y>=0.8` for rooted
foliage. `motion.pivot` changes the transform origin without changing a
registered member's full-canvas placement or top-left registration.

## Author Intent, Compile Execution

Storyboard v10 input owns `beats[].treatments[]`, any layer source-package
intent, plus the v9 editorial authoring intent. It does not own
`compositionPlan`, source-package cost totals, resolved edit points,
responsive/transition plans, `directing`, sheet layouts, style-proof planning,
risk ranking, or fingerprints. `project:storyboard` compiles those fields and
rejects hand-authored derived values. Read `layer-complete-assets.md` before
authoring relative layers and `editorial-system-v9.md` for edit-point bindings
and advanced editorial transitions.

Every treatment declares:

- stable `id` and runtime `targetId`;
- `importance`: `hero`, `supporting`, or `ambient`;
- `necessity`: `required` or `enhancement`;
- one `changeClass`;
- orthogonal `motion`, `composition`, and optional `graphic` intent;
- `semanticRisk` and a proof binding for identity/topology/mechanism/diagram risk;
- a concise rationale describing why this mechanism is truthful.

The compiler turns those declarations into patterns, relationships, state schedules, continuous-motion targets, persistent visibility events, graphic targets, risk scores, sheet plans, and fingerprints. Production implements the compiled plan; it does not reinterpret the prose.

## Allocate Motion Without Sacrificing Hero Actions

Creative Plan v4 gives each production profile two planning ceilings:

- `assetBudget`: quota-consuming image attempts, split into a compiled base and
  an explicit source-recovery reserve;
- `motionBudget`: pose-sheet calls, cells per sheet, and continuous-motion targets.

For a one-scene project the default hard ceilings are draft `4+2=6`, balanced
`4+4=8`, and full-depth `5+6=11` image attempts. The profile ceiling is not
permission to spend automatically: concept approval binds the exact
`sourcePackageDecision` plus `budgetDecision.imageAttemptLimit`. The approved
cap must cover compiled expected calls, cannot exceed the profile ceiling, and
is the limit enforced by reservation and project validation. A
`registered-layer-sheet` source package
normally costs one provider call, yields three deterministic local derivatives,
and avoids three isolated calls. Full-context layer edits cost four calls and
are chosen only when the provider cannot reliably return the registered sheet.

When reducing cost or complexity, remove in this order:

1. ambient enhancement motion;
2. supporting enhancement motion;
3. extra intermediate states inside an enhancement family;
4. enhancement state families.

Never turn a `required` pose or prop change into rotation, scaling, or a static hold merely to fit the profile. If required families exceed the approved profile, the storyboard is invalid: raise the profile or reduce story scope at the existing concept gate.

All related states for one identity/prop family stay on one provider-generated
sheet. The compiler chooses 2×2 for up to four states and 3×2 for five or six
states. Empty cells are preferable to unrelated identities. Layer source
packages and pose sheets have separate compiled accounting but share the same
hard ceiling. Recovery is deterministic local reprocessing, then a masked edit
of the complete original source context, then complete-source regeneration.
Isolated replacement-layer or replacement-cell generation is forbidden.

## Representative Story Routing

For a story such as 《曹冲称象》:

- opening paper texture and slow parallax: `depth-parallax` on the scene camera with authored background/focal/foreground depths;
- Cao Chong changes from holding a book to pointing: one `cao-actions` state family;
- question marks and a bouncing circle: editable shape/text nodes with continuous motion, not new character poses;
- elephant boards the boat: an elephant state family plus `supported-subject` contact;
- the waterline or marked displacement line: `registered-environment` plus an editable shape;
- stones accumulate and the scale balances: mechanism-risk states with proof moments;
- a quiet conclusion: static hold with only restrained ambient motion.

This is a per-beat decision. One film can intentionally use all mechanisms; a simple title film may use only free layers and continuous transforms.

## Direct Scene Boundaries Separately

Scene boundaries are whole-film editorial decisions, not node reveal effects. Declare exactly one top-level boundary per adjacent pair with an editorial `intent` and a concrete `rationale`. Prefer intent-only authoring and let `project:storyboard` materialize the default recipe:

| Intent | Default recipe | Use |
| --- | --- | --- |
| `continuity` | `paper-slide`, 0.45s | Same action or thought continues |
| `location-change` | `paper-wipe`, 0.5s | The paper edge carries the viewer to a new place |
| `time-passage` | `page-turn`, 0.7s | A later moment or summarized interval begins |
| `focus-reveal` | `paper-iris`, 0.55s | Attention narrows onto a newly important subject |
| `chapter-reset` | `paper-shutters`, 0.65s | A chapter or tonal unit closes before the next opens |
| `impact` | `cut` with `motivation=impact`, 0s | A deliberately abrupt shock, reveal, or comic hit |

Narrative intent and execution treatment are separate. Legal paper overrides are `paper-slide`, `paper-wipe`, or `torn-wipe` for spatial movement; `page-turn`, `torn-wipe`, or `paper-wipe` for elapsed time; `paper-iris` for focus; and `paper-shutters`, `dip-to-paper`, or `page-turn` for a chapter reset. Any ordinary intent may instead use `type=cut`, `motivation=rhythmic`, `durationSeconds=0`, and a `beatId` that resolves to the outgoing final 20% or incoming first 20%. Impact cuts use the `impact` intent and `motivation=impact`; do not mislabel a rhythmic edit as semantic impact. Spatial types reveal a fully opaque incoming scene through a hard clip or translation; cover types swap scenes only during a guaranteed fully opaque plateau. Never alpha-crossfade semantic scenes: it can combine an outgoing foreground with an incoming background into a false image. Budget the complete animated duration in both the outgoing tail and incoming narration lead.

## Proof and Review

The compiler ranks treatments by semantic risk, discrete-state complexity,
composition coupling, importance, and necessity, then compiles a
`styleProofPlan`. The plan requires coverage for the highest semantic-risk
classes, each concrete coupled relationship, state-sequence behavior, and
motif-field behavior, and greedily reuses one source family where it can prove
multiple facets. Looping worlds additionally require source/render-scale RGB
and alpha seam proof, three-ratio worst-phase coverage, depth-speed ordering,
camera-compensated world displacement, tracked-subject readability, and a real
near-layer occlusion band. If a film has no such high-risk facet, the highest-ranked
treatment becomes one `baseline:representative` target so the style gate never
becomes empty. `style:proof` renders every selected target and binds the report
to the plan fingerprint. A depth stack is proven as one family through neutral
reconstruction, reference comparison, exploded checkerboard, and both extremes
of every responsive reveal envelope; isolated-member motion stress is not
sufficient. Parallax rigs and motif fields also become fingerprinted composite
quality targets. A changed treatment, source package, reveal envelope, camera
rig, depth map, seed, field source, density, bounds, exclusions, or runtime
implementation invalidates the relevant evidence.

Final reports state the number of pose-sheet provider calls, deterministic state derivatives, and isolated calls avoided. Savings count only when provenance proves that one provider result produced multiple local derivatives.
