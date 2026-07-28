# Skill Evolution Backlog

This is the auditable intake for production issues that reveal a reusable
paper-collage Skill or runtime gap. It is not a substitute for implementation:
an item stays open until its contract, renderer, validation, proof, tests,
documentation, and packaged-plugin copy are updated together.

## 2026-07-28 — Delivery-equivalent audio and immutable review evidence

- **Origin:** `shou-zhu-dai-tu-film` / 《守株待兔》 F010, F017, F025,
  F034–F040, F042–F043, F054, and F055.
- **Observed failure:** an audio-only WAV preflight could pass before AAC
  encoding changed true peak; a current review scaffold could attach an older
  same-id proof; small detached alpha residue and an opaque rectangular crop
  could escape the low-alpha-band detector; node keyframe `x`/`y` was easy to
  confuse with absolute placement or camera pixels; and render preflight could
  spend sync/audio/quality work before reporting a stale production seal.
- **Required capability:** encode and measure both delivery AAC profiles before
  rendering and mux those exact streams; bind scaffold evidence by current
  composite fingerprint and file SHA; add connected-component/derivation-edge
  alpha topology checks; name local motion `offsetX`/`offsetY`; run the
  production gate first. Project/fixture command identity, retryable attempt
  closure, and help must also be truthful and side-effect free.
- **Acceptance evidence:** audio tests compare preflight and muxed artifact
  loudness exactly; scaffold schema-v3 rejects changed evidence; alpha fixtures
  cover a natural silhouette, detached fragment, and hard registered
  rectangle; composition, trajectory, spatial, VOX, state, and renderer tests
  use the new offset contract; source-order coverage keeps render gating first;
  CLI tests cover idempotent close, fixture-only proof rejection, and pure help.
  Storyboard tests reject removed `audioCue`, require explicit event-only
  `soundCue`, and reject numbered camera aliases; package tests expose only
  `project:style-proof`.
- **Status:** implemented and verified on 2026-07-28. The source suite passes
  231/231; the packaged runtime suite passes 216/216 from a fresh workspace.
  Source, packaged plugin, and installed cache share runtime fingerprint
  `e73687f7fe02608ca5ebd53c94c1c4856621f5d959531dd93b5ef5a35d2c0cde`.
  The fresh workspace also passes doctor, type checking, Schema v11, both
  deterministic family proofs, delivery-equivalent 96k/192k AAC preflight, and
  side-effect-free CLI help.

## 2026-07-28 — Executable spatial truth, gait, and causal continuity

- **Origin:** `shou-zhu-dai-tu-film` / 《守株待兔》 F044–F057.
- **Observed failure:** composition could satisfy a coarse visual review while
  the farmer or rabbit floated above the ground, a support/field strip occupied
  the sky, an internal foreground could not actually paint over a top-level
  subject, a seated subject drifted, the rabbit's gait froze before the scene
  ended, or the stump/world/grounding changed across one cause-and-effect cut.
  Moving the heroes upward to avoid subtitles merely traded occlusion for
  floating, and duplicate semi-transparent foreground nodes could create an
  unexplained drifting wheat layer.
- **Required capability:** authoring must declare reusable `spatialContracts[]`
  rather than rely on visually plausible coordinates. A grounding contract
  binds a subject anchor to an authored support polyline and legal screen band,
  optional true front occlusion, subtitle clearance, and locked relative
  contact. A continuity contract binds adjacent scene world/subject/prop/support
  pairs, camera tolerances, and grounding evidence. A gait contract measures
  actual state changes through the entire action window. Composition validation
  must also reject an exact duplicate visible asset instance.
- **Acceptance evidence:** schema, storyboard authoring, project compilation,
  runtime proof, debug overlays, quality targets, motion fingerprints, type
  definitions, tests, documentation, and packaged plugin all carry the same
  contract. Deterministic tests reject floating contact, support geometry in a
  declared sky band, false foreground stacking, locked-contact drift, subtitle
  collision, adjacent-scene world/framing/grounding drift, early gait freeze,
  and duplicate visible assets.
- **Status:** implemented and verified on 2026-07-28. The full suite passes
  224/224; source, packaged plugin, and installed cache share runtime fingerprint
  `59ebf378fa7e2819e26c63a96a8c6ae0bd07078eb9ceec4cc66045857113d6a3`.
  A workspace bootstrapped from that cache passes doctor, type checking, Schema
  v11, and 19 focused spatial/composition tests. This catches executable
  geometry and topology errors; interpreting an opaque illustration as a
  semantically impossible floating wheat field remains a required human
  composite review rather than an invented pixel-semantic detector.

## 2026-07-28 — Work-item closure must gate preview and final delivery

- **Origin:** `shou-zhu-dai-tu-film` / 《守株待兔》 F061.
- **Observed failure:** a preview-directing revision created a pending
  `directing-revision-scene-02` work item. A later current preview, preview
  approval, and final render all succeeded while resume continued to report
  that item as unfinished.
- **Required capability:** the canonical assets-ready seal must be the only
  automatic completion authority for pending/in-progress directing-revision
  sync items. Unrelated unfinished work and every blocked item must stop
  assets-ready; preview approval, preview rendering, and final rendering must
  reject any unresolved item.
- **Acceptance evidence:** production-state tests prove automatic
  directing-revision settlement only at assets-ready, rejection of unrelated
  and blocked work, and rejection at preview approval/final render. Resume no
  longer exposes a stale directing item after the canonical seal. Skill,
  project-contract, execution-control, source, and packaged plugin agree.
- **Status:** implemented and verified on 2026-07-28. Targeted state-machine
  tests pass, the full suite passes 215/215, source/package/installed-cache
  runtime identities agree, and a fresh installed-cache workspace passes
  doctor plus the packaged production-state tests.

## 2026-07-24 — Cue-gated looping-world travel

- **Origin:** `projects/gui-tu-sai-pao` / 《龟兔赛跑》 preview revision.
- **Observed failure:** a looping environment starts scrolling at scene frame
  zero even when its tracked subject is deliberately held in a standing or
  sleeping pose. This makes a still tableau appear to move and contradicts the
  narrated action.
- **Required capability:** an optional normalized `activeFrom` cue on
  `loopingEnvironment.travel`. The world phase must remain exactly held before
  the cue; from the cue to the scene end it must complete the authored distance
  with the same deterministic seams, parallax ordering, and proof coverage.
- **Acceptance evidence:** schema + authoring compiler + renderer + execution
  validation + world-motion proof all preserve the cue; a unit test proves a
  pre-cue hold, mid-travel progress, and full end distance; the packaged Skill
  documents the behavior and is synchronized.
- **Status:** implemented and verified in the active worktree: schema,
  authoring compiler, renderer, execution validator, world-motion proof, unit
  coverage, packaged documentation, and a fresh project proof now agree on the
  cue behavior. Retain as a regression criterion until the reviewed Skill
  update lands.

## 2026-07-24 — Integer evidence crop bounds

- **Origin:** `projects/gui-tu-sai-pao` composition proof.
- **Observed failure:** fractional normalized layout bounds reached Sharp crop
  calls as fractional pixels, which rejected otherwise valid proof generation.
- **Required capability:** evidence padding must produce an enclosing integer
  crop rectangle without trimming any declared source bound.
- **Acceptance evidence:** source and packaged test cover fractional bounds;
  style proof and composition proof complete successfully.
- **Status:** fixed and verified in the active worktree; retain as a regression
  criterion until it lands in a reviewed Skill update.

## 2026-07-24 — Limited-animation review rule

- **Origin:** `projects/gui-tu-sai-pao` director review.
- **Observed failure:** a runner using one static pose plus background motion
  reads as sliding rather than running; equal apparent turtle/rabbit speed also
  weakens the story logic.
- **Required capability:** authoring and quality guidance must require at least
  two registered alternating action states for a sustained run, and review
  timing must visibly demonstrate distinct subject speed semantics.
- **Acceptance evidence:** state-sequence proof samples show both poses in
  order, while scene assertions identify the intended relative speed and
  off-screen departure.
- **Status:** implemented and verified in the active worktree: storyboard
  authoring now compiles `cycles`, `activeFrom`, and ordered
  `activeStateIds` into the state-family plan; runtime execution rejects pose,
  timing, or playback drift; the Skill requires two alternating registered
  gait states for sustained runs. Generic relative-speed and ordered-race
  semantic assertions remain tracked below rather than being inferred from a
  pose sheet alone.

## 2026-07-24 — Scene-world composition continuity and route grounding

- **Origin:** `projects/gui-tu-sai-pao` director review of the first, fourth,
  and fifth scenes.
- **Observed failure:** individual scenes can omit the established background,
  foreground, trees, grass, and route treatment. A bare start/finish line also
  reads as an unrelated overlay rather than an object in the paper world, while
  the racers can appear to stand beside or float above the route.
- **Required capability:** the composition contract and quality scaffold must
  identify persistent world layers, a subject-safe route band, and in-world
  race markers. A marker such as a red paper flag labelled `起点` or `终点`
  must be assessed as part of the same collage language, with a post/base and
  deliberate scene-relative placement—not merely as text or a line.
- **Acceptance evidence:** every story scene proves its required world layers
  and one grounded racer pose; scene contacts show the start and finish marker
  in the declared visual language and outside the runners' safe staging area.
- **Status:** implemented as a reusable contract in this update. `worlds[]`
  requires far/mid/ground/near roles across every bound scene; each
  `composition.world` binds a looping group, route-safe band, travelers and
  grounded marker node ids. Project validation and composition-proof reports
  consume it, and deterministic tests reject a missing depth layer, an
  out-of-band traveler, or a floating marker. The flag's visual craft
  (post/base illustration and typography choice) remains a human composite
  quality judgement rather than a fake pixel-level semantic detector.

## 2026-07-24 — Narrative race-event order and direction proof

- **Origin:** `projects/gui-tu-sai-pao` director review of the sleep and
  finish beats.
- **Observed failure:** an otherwise plausible cut can begin the sleep scene
  with both animals together, or make the rabbit visually drift backwards while
  the turtle crosses. Both contradict the race logic: the rabbit must first
  establish a large lead, sleep mid-route, and then chase forward while the
  turtle crosses and the rabbit stops in a defeated pose.
- **Required capability:** authoring contracts need ordered race-event
  assertions: overtake, separation/off-screen departure, sleep, turtle pass,
  wake/chase, finish, and defeated stop. Screen-direction and subject-state
  proofs must reject a non-narrated backward drift or a finish event in the
  wrong causal order.
- **Acceptance evidence:** timeline samples prove each ordered state; a
  final-scene proof shows the turtle's finish crossing, rabbit forward chase,
  then rabbit stop/low-head state without a reverse displacement.
- **Status:** implemented as a generic `trajectoryContracts[]` validator in
  this update. It verifies proof-bound state, relative order/minimum gap,
  signed travel distance, off-screen exit and non-decreasing film order;
  deterministic tests reject reverse travel, broken lead separation and a
  reversed event sequence. A race author still declares its own participants
  and semantics—there is no rabbit/turtle special case.

## 2026-07-24 — Route windows, strip-source continuity, and a true stopped chase

- **Origin:** `gui-tu-sai-pao-v2` concept planning against the current v10
  contracts; no old project, asset, or render was read.
- **Observed failure:** a route's flat `subjectIds` list required a racer to be
  inside the safe band at every proof, contradicting a later required
  `offscreen-at` exit. Role-only world validation also allowed a different
  far/mid/ground/near source in a later scene, and signed end-point travel
  could not prove a forward chase that ended in a genuine zero-motion stop.
- **Required capability:** proof-windowed route travelers, root-declared
  strip-source reuse across every bound scene, and a keyframe-sampled
  `monotonic-travel` assertion with an allowed zero net displacement.
- **Acceptance evidence:** schema and deterministic validation reject an
  out-of-window/invalid traveler, a later-scene strip-source drift, and an
  intermediate backward keyframe; they allow a legal route window followed by
  an offscreen exit and a forward chase that holds still at the end.

## 2026-07-24 — Revision-safe scene consolidation and narration continuity

- **Origin:** `projects/gui-tu-sai-pao` recut that merged the initial setup
  with the rabbit's solo run, and later merged wake/chase with the finish.
- **Observed failure:** splitting tightly coupled action across separate scenes
  can introduce duplicate establishing beats and makes the intended causal
  transition hard to review. Recutting must not force a new paid voice call
  when the approved narration can be retained and deterministically joined.
- **Required capability:** preview revision guidance should support a
  scene-consolidation plan with explicit visual beats, exact existing narration
  spans, locally derived audio provenance, and retimed proof samples.
- **Acceptance evidence:** the revised project reports the combined scene's
  measured audio duration, source tracks, deterministic derivative, transition
  intent, and post-recut contact sheet; no provider call is attributed to the
  join.
- **Status:** partially implemented in this update. `project:stitch-narration`
  accepts only adjacent source scenes and creates a local WAV derivative plus
  source-scene provenance, SHA-256, combined text and retimed subtitle spans;
  it never calls a provider. The creative replacement scene is deliberately
  still authored and reviewed before it is introduced through director
  revision, because automatically merging two compositions would otherwise
  fabricate visual intent. A fully declarative scene-recut authoring command
  remains an open follow-up.

## 2026-07-24 — Quiet, report-first rendering for long previews

- **Origin:** `projects/gui-tu-sai-pao` preview render.
- **Observed failure:** one progress update per video frame can overwhelm an
  automated caller before a long render finishes, obscuring the actual artifact
  and production state.
- **Required capability:** normal project preview/render execution must keep
  error output while suppressing per-frame progress, then publish the artifact
  path, technical report, contact sheets, and state transition on completion.
- **Acceptance evidence:** a 1,502-frame preview completes without a progress
  flood and records the resulting artifact as `human-review`.
- **Status:** implemented and verified in the active worktree and synchronized
  to the packaged plugin via Remotion `--log=error`; a fresh preview completed
  and its report passed. This update also adds persisted `project:render-status`
  lifecycle records, so callers can query phase/artifact/error without
  re-enabling noisy per-frame logs; it deliberately reports exact percentage
  as unavailable when the underlying quiet CLI provides no authoritative value.
