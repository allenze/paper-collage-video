# VOX Phase 2.4 Approved Image-Attempt Budget

Status: implemented for `0.16.0-dev.5`; source, packaged copy, installed cache,
and fresh-workspace evidence must pass before the production pilot may reserve
an attempt.

Date: 2026-07-23

## Finding

The Phase 2.4 single-scene pilot selected `profile=draft`. Its compiled
registered layer sheet needs one provider image call, while the human authorized
an expected one call and a maximum of two attempts. The draft profile has a
broader six-attempt planning ceiling.

In dev.4 the combined concept decision copied the profile and source-package
decision, but it had no machine field for the narrower human-approved cap.
`reserveGenerationAttempt` read `plan.assetBudget.maxGeneratedImages`, so it
could reserve attempts three through six even though the human had approved only
two. A note or agent promise would not be a production control.

## Contract

Creative Plan v4 keeps two distinct facts:

- `assetBudget.maxGeneratedImages`: deterministic planning ceiling derived from
  profile and scene count;
- `approvedImageBudget`: the exact human authorization written only by combined
  concept confirmation.

The confirmation input must contain:

```json
{
  "budgetDecision": {
    "imageAttemptLimit": 2
  }
}
```

The command records the approved limit, the storyboard's expected provider image
calls, the profile ceiling, and the approval timestamp. It rejects a limit below
expected calls or above the profile ceiling. A storyboard call-count change
invalidates the approval.

## Enforcement and proof

- `provider:attempt reserve` refuses a missing or zero authorization and
  enforces `approvedImageBudget.imageAttemptLimit`, never the profile ceiling.
- The ledger lock continues to prevent parallel over-reservation.
- `provider:attempt summary --json` reports profile ceiling, approved cap, used,
  reserved, and remaining attempts.
- `project:validate` reports the same budget proof, rejects activity without an
  approval, rejects usage above the approved cap, and rejects storyboard budget
  drift.
- Provider usage, local derivatives, and avoided calls remain separate.

## Vertical slice

The change covers Project schema, TypeScript types, Creative Plan compilation,
combined approval CLI, reservation runtime, project validation/report proof,
focused tests, Skill and references, workflow and release documentation,
runtime-build identity, synchronized Plugin contents, installed cache, and a
fresh workspace.

It changes the formal Creative Plan contract and runtime identity, so the Plugin
version is `0.16.0-dev.5`. It does not call an image, voice, or video provider.
