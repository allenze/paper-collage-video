# Skill Evolution Principles

Status: normative repository policy
Date: 2026-07-22

## 1. Purpose

The paper-collage Skill is a production system, not a fixed set of historical
schemas. Its job is to generate editable, reviewable, technically accepted final
videos across the visual languages the product deliberately supports.

When a target output exposes a missing animation or composition primitive, the
default question is not "how can the current contract be tricked into rendering
this once?" The question is "what reusable production abstraction expresses this
behavior cleanly, and what evidence proves it works?"

This policy keeps the system small by allowing obsolete internal formats to be
discarded while preserving and expanding useful output capability.

## 2. Non-negotiable principles

### 2.1 Architecture is allowed to move

The current project schema, composition tree, renderer, templates, and workflow
are implementation choices. They are not permanent constraints.

When an approved visual language does not fit them:

1. identify the real reusable primitive;
2. design the authoring and runtime semantics for that primitive;
3. implement the entire production slice;
4. remove the superseded limitation or abstraction;
5. verify the new behavior on representative output.

Do not preserve an inadequate model by accumulating special cases around it.

### 2.2 Workarounds are evidence, not architecture

A workaround can answer a bounded feasibility question. For example, several
single-source image nodes with manually interlocked opacity keyframes can prove
that pose replacement is renderable. It is not an acceptable reusable limited-
animation model.

Before production, convert repeated behavior into a first-class abstraction with:

- explicit semantics in the contract;
- deterministic runtime behavior;
- authoring and provider guidance;
- input and relationship validation;
- render fingerprints and invalidation;
- visual proof and quality criteria;
- focused fixtures and tests;
- Skill and packaged-plugin documentation.

### 2.3 Preserve output capability, not old projects

The compatibility boundary is the class and quality of final video the system can
produce. It is not the persistence format of an earlier implementation.

The latest version does **not** need to read, resume, migrate, or reuse:

- old `project.json`, `production.json`, or storyboard schemas;
- old asset manifests, request ledgers, or quality reports;
- old directory layouts, filenames, caches, or generated intermediates;
- old renderer node shapes or internal script APIs;
- old project-specific assets.

Breaking these formats is acceptable when it produces a cleaner current system.
Do not pay a permanent complexity cost for projects that have already delivered
their final artifacts.

The required compatibility is that a fresh project using the latest system can
again create the useful kind of final output: for example layered paper-collage
stories, registered subject/environment compositions, functional diagrams,
recurring-character narratives, or hand-drawn limited-animation explainers.

If an earlier production needs a new revision, use its approved content and final
film as references and rebuild it as a fresh latest-version project. Regenerating
or re-importing assets is acceptable.

## 3. Decision framework for a new behavior

Classify every requested behavior before implementation:

1. **First-class support exists.** Use the existing contract and verify the
   output normally.
2. **A workaround can demonstrate feasibility.** Use it only for a bounded proof,
   label it as temporary, and do not claim general Skill support.
3. **The behavior exposes an architectural gap.** Design and implement a reusable
   primitive before relying on it for production.

Choose the third path whenever the workaround would cause node explosion,
duplicated timing, manual alignment, per-project renderer code, untracked state,
or validation that cannot describe the visible result.

## 4. Required vertical slice

A production-grade primitive is incomplete until all relevant layers agree:

1. storyboard/brief language;
2. provider request and generation-family semantics;
3. project/composition schema;
4. TypeScript runtime types;
5. Remotion renderer;
6. deterministic validators;
7. proof-time and contact-sheet coverage;
8. asset/composite fingerprints and invalidation;
9. quality-review checks and evidence files;
10. representative fixtures and automated tests;
11. Skill references and workflow documentation;
12. synchronized packaged-plugin contents.

Avoid implementing a renderer-only feature that the rest of the production system
cannot author, validate, review, or invalidate correctly.

## 5. Current example: hand-drawn limited animation

The analyzed hand-drawn explainer uses two different motion families:

- continuous layer motion: subtle translation, scale, rotation, camera drift, and
  bouncing decorative marks;
- discrete state replacement: page-turn shapes, whole-character pointing poses,
  hand/card combinations, and held/lowered/placed book poses.

Encoding at 30 or 60 fps does not require every frame to contain a new drawing.
Limited animation intentionally holds a state for several output frames and then
cuts or briefly crossfades to another registered state.

This should be modeled as a first-class sequence, not as unrelated image nodes.
A professional design should cover concepts such as:

- `state-sequence`: ordered visual states with explicit timing;
- `pose-family`: identity-bound poses belonging to the same character;
- `registered-frame`: shared canvas, origin, scale, and anchor across states;
- `cut`, `crossfade`, and, only when truly supported, `morph` transitions;
- `once`, `loop`, and `ping-pong` playback;
- independent continuous transforms composed around the discrete state;
- state-aware proof moments, fingerprints, contact sheets, and quality review.

The exact schema names may change during design. The required behavior and
evidence boundary matter more than preserving a proposed field name.

### 5.1 Asset production

Prefer a reviewed master or character/prop state sheet over independent generation
calls for every pose. Split and extract the states deterministically, retain their
shared registration, and bind them to one identity generation family.

This reduces provider attempts and prevents identity, scale, line-weight, and
background drift. Individual generation calls remain counted whenever the
provider actually consumes quota; deterministic splits and alpha extraction do
not become new generation attempts.

### 5.2 Quality requirements

State-sequence review should be able to prove at least:

- character or prop identity remains stable across states;
- canvas, anchor, and apparent scale do not jump unintentionally;
- silhouettes and internal negative spaces remain intact;
- no state carries leaked background pixels;
- transition order and hold duration match the authored beat;
- required action and final states appear at their proof times;
- an intentional hard cut is not mistaken for a rendering glitch;
- crossfades do not create unacceptable double limbs or ghosted props.

## 6. Data-driven UI and scene styling

Dynamic explanatory UI should normally be rendered as data-driven React/SVG/text
components, not baked into a low-resolution full-frame image. If the current node
model can render only image files, add or replace the node abstraction rather than
forcing all UI through raster assets.

Likewise, mixed light/dark scenes, subtitle treatments, and texture behavior should
have explicit per-scene or component-level semantics when the output requires
them. Avoid growing project-specific conditionals in the main scene component.

## 7. Anti-patterns

Do not use these as the final reusable design:

- dozens of mutually exclusive image nodes controlled by hand-authored opacity;
- project slug checks inside generic renderer code;
- arbitrary z-index repair for a relationship the contract cannot express;
- repeated full-frame AI generations for small pose changes;
- dynamic UI or small text baked into raster backgrounds by default;
- a new feature with no fingerprint or proof invalidation path;
- keeping old parsers and fixtures solely because historical projects once used
  them;
- claiming broad support because one custom video rendered successfully.

## 8. Validation and regression strategy

Regression coverage should protect representative output capability using the
latest contract. It should not protect obsolete persistence formats.

Depending on the change, representative cases may include:

- independent layered paper-collage motion;
- a supported subject with partial occlusion and shared motion;
- a registered environment with a stable semantic boundary;
- recurring-character identity across scenes;
- a functional mechanism or diagram with readable relationships;
- a limited-animation character and prop sequence;
- dynamic explanatory UI, per-scene styling, narration, and subtitles;
- preview/final reports with current audiovisual continuity and quality proof.

Delete or rewrite legacy fixtures when the contract changes. Add migration tests
only when the user explicitly establishes legacy loading as a product requirement.

## 9. Review questions

Before accepting an architectural change, ask:

- Does the abstraction describe the visible behavior directly?
- Can another project use it without renderer code changes?
- Does the production workflow know how to create and review its assets?
- Can validators reject structurally wrong input before rendering?
- Do proof and fingerprints cover every visible source and schedule change?
- Does the visual review expose the failure modes at useful resolution?
- Did the change remove superseded complexity instead of keeping both paths?
- Can the latest system still regenerate the useful output classes that existed
  before the change?

If the answers are incomplete, the feature is not yet a professional production
capability.
