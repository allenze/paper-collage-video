# Motion Directing and Effect Routing

Read this while deciding how a story beat should move. The goal is not to maximize animation. The goal is to choose the smallest truthful mechanism that makes the approved meaning visible and reviewable.

## Start From the Visible Change

Do not begin with a renderer preset. For each beat, name what visibly changes:

| Change class | Required route | Typical examples |
|---|---|---|
| `static-hold` | `motion.kind=static` | readable tableau, deliberate ending hold |
| `ambient-motion` | `continuous-transform` | breathing, paper drift, floating question mark |
| `camera-change` | `continuous-transform` on `scene-camera` | push, pull, pan |
| `pose-change` | `state-sequence` | hand moves from chest to pointing at a board |
| `prop-state-change` | `state-sequence` | page turns, cards change, book lowers |
| `contact-change` | `supported-subject` | person stands on a boat, book remains in hand |
| `shared-boundary` | `registered-environment` | elephant crosses a waterline, object passes behind a desk edge |
| `graphic-emphasis` | editable `text` or `shape` node plus `continuous-transform` | question marks, circles, arrows, highlights |
| `mechanism-state` | proof-bound treatment with `mechanism` or `diagram` risk | scale balance, force path, causal diagram |
| `visibility-change` | `visibility-transition` plus node `visibility.initial` | a question mark first appears, a card is removed, a label remains after entering |

A treatment has orthogonal dimensions. Motion (`static`, continuous transform, state sequence, or persistent visibility transition), composition (`free`, supported subject, or registered environment), graphic mechanism, and semantic risk can coexist. A pointing child standing on a boat is both a state sequence and a supported subject; do not collapse it into one exclusive effect label.

## Author Intent, Compile Execution

Storyboard v7 input owns `beats[].treatments[]`. It does not own `compositionPlan`, `directing`, sheet layouts, style-proof planning, risk ranking, or fingerprints. `project:storyboard` compiles those fields and rejects hand-authored derived values.

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

Creative Plan v2 gives each production profile two ceilings:

- `assetBudget`: quota-consuming image attempts;
- `motionBudget`: pose-sheet calls, cells per sheet, and continuous-motion targets.

When reducing cost or complexity, remove in this order:

1. ambient enhancement motion;
2. supporting enhancement motion;
3. extra intermediate states inside an enhancement family;
4. enhancement state families.

Never turn a `required` pose or prop change into rotation, scaling, or a static hold merely to fit the profile. If required families exceed the approved profile, the storyboard is invalid: raise the profile or reduce story scope at the existing concept gate.

All related states for one identity/prop family stay on one provider-generated sheet. The compiler chooses 2×2 for up to four states and 3×2 for five or six states. Empty cells are preferable to unrelated identities. Recovery is deterministic local reprocessing, then a masked edit of the complete original sheet, then complete-sheet regeneration. Isolated replacement-cell generation is forbidden.

## Representative Story Routing

For a story such as 《曹冲称象》:

- opening paper texture and slow parallax: continuous transforms;
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
| `impact-cut` | `cut`, 0s | A deliberately abrupt shock, reveal, or comic hit |

Legal motivated overrides are `paper-slide`, `paper-wipe`, or `torn-wipe` for spatial movement; `page-turn`, `torn-wipe`, or `paper-wipe` for elapsed time; `paper-iris` for focus; and `paper-shutters`, `dip-to-paper`, or `page-turn` for a chapter reset. `cut` is forbidden outside `impact-cut`. Spatial types reveal a fully opaque incoming scene through a hard clip or translation; cover types swap scenes only during a guaranteed fully opaque plateau. Never alpha-crossfade semantic scenes: it can combine an outgoing foreground with an incoming background into a false image. Budget the complete animated duration in both the outgoing tail and incoming narration lead.

## Proof and Review

The compiler ranks treatments by semantic risk, discrete-state complexity, composition coupling, importance, and necessity, then compiles a `styleProofPlan`. The plan requires coverage for the highest semantic-risk classes, each concrete coupled relationship, and state-sequence behavior, and greedily reuses one source family where it can prove multiple facets. If a film has no such high-risk facet, the highest-ranked treatment becomes one `baseline:representative` target so the style gate never becomes empty. `style:proof` renders every selected target and binds the report to the plan fingerprint. A changed treatment invalidates the plan even if the scene id stays the same.

Final reports state the number of pose-sheet provider calls, deterministic state derivatives, and isolated calls avoided. Savings count only when provenance proves that one provider result produced multiple local derivatives.
