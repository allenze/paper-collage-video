# Story and Production Planning

Read this while resolving duration, scene count, or production profile. Duration and scene count are independent optional user constraints.

## Resolve Story Shape

| User supplied | Preserve | Infer |
|---|---|---|
| Neither | — | Duration and scene count |
| Duration only | Requested duration | Scene count |
| Scene count only | Requested scenes | Duration |
| Both | Both values | Pacing and allocation only |

Draft minimum coherent beats and estimate spoken duration before resolving the plan. For Chinese narration, roughly 3.5–4.5 Han characters/second is a planning aid. Reserve time for openings, subtitles, bounded pauses, and transition overlap. Treat an inferred duration as a provisional estimate, never as a quota that must be filled with static tails. Ask only when two explicit constraints are materially incompatible.

## Choose a Production Profile

| Profile | Final-film effect | Cost shape |
|---|---|---|
| `draft` | Flatter paper motion for testing story, narration, and rhythm | Heavy reuse; few environment layers and poses |
| `balanced` (default) | Clear foreground/midground/background in hero scenes | Moderate independent layers and character variation |
| `full-depth` | Maximum environment parallax and pose variety | Most environment layers, poses, evidence work, and generation attempts |

`project:plan` derives a provider-generation attempt ceiling from the profile and scene count. Count the style sample, unique generated backgrounds, environment layers, character sheets, rejected results, and abandoned results when quota was consumed. Exact reuse and deterministic alpha extractions do not consume a new attempt.

```bash
npm run project:plan -- <slug> \
  [--requested-duration=<seconds>] [--requested-scenes=<count>] \
  --duration=<resolved-seconds> --scenes=<resolved-count> \
  [--narration-seconds=<estimate>] --profile=<draft|balanced|full-depth> \
  --rationale="<story and pacing basis>"
```

Use `project:plan --json` as the decision source. It returns `decision.durationAuthority` plus all three `decision.profileOptions`, including exact scene-count-specific attempt ceilings and final-film effects. For an already resolved plan, `npm run project:plan -- <slug> --json` is read-only and re-displays the same options without needing the original write arguments. Show those options as direct structured choices in the combined concept/provider decision and again if the human selects “modify”; never require them to guess an enum in free text. Change the profile only through concept revision or another explicit budget decision. Copy the approved `productionProfile`, `durationSeconds`, `sceneCount`, and `durationAuthority` into `planDecision` for `project:confirm-concept`; the command rejects stale or mismatched confirmation data.

## Lock the Rhythmic Storyboard

After `project:plan`, create a storyboard input and run:

```bash
npm run project:storyboard -- <slug> --input=<storyboard.json>
```

The storyboard is not another human gate. It is part of the existing combined concept decision and becomes the execution contract for production.

- Give the whole film one explicit arc and one shared visual/motion language.
- Give each planned scene a narrative role, single message, blueprint, estimated duration, and at least three ordered beats.
- Add `compositionPlan.patterns`, named relationships, and `stateSequences` (an explicit empty array when none). Use `supported-subject` for persistent contact (`inside`, `on`, `held-by`, `worn-by`), `registered-environment` for a shared shoreline/horizon/tabletop/wall edge, and `free` only when no persistent contact or semantic boundary exists. Plan a state sequence whenever visible action is best expressed as discrete registered poses rather than transform motion.
- Use normalized beat time (`at=0..1`) so rhythm survives narration resync.
- Choose one of the bounded blueprints: `layered-reveal`, `map-journey`, `archive-stack`, `character-procession`, `discovery-wipe`, `transformation-tableau`, `chapter-tableau`, or `quiet-lockup`.
- Define at least three proof moments per scene: an establishing state, an action/peak state, and a `final` state at or after `0.82`. Every proof needs a stable id, visible relationship assertions, and a `stateAssertions` array. Cover every planned sequence state at least once so its schedule can be verified deterministically.
- Keep proof moments outside the scene's fade-in/fade-out interval so every sampled frame clearly proves the intended composition.
- In schema v3, every beat declares `proofTimeId` as an approved proof id or `null`. If a beat names an `audioCue`, it must bind an event-level proof and production must attach a real sound asset to the matching cue using that same proof id.

The sum of scene estimates must stay within 8% of the resolved duration. Scene count must match exactly.

After real narration exists, `project:assets-ready` synchronizes exact media duration. When duration was inferred, the measured narration plus bounded tails and transitions becomes the execution duration, even when it is shorter than the estimate. When duration was explicit, a content deficit blocks validation; add narration or meaningful visual beats, add an approved audio passage, or revise the target instead of padding. Read `timing-continuity.md` before authoring scene tails.
