# Provider Selection and Provenance

Read this only when discovering, confirming, changing, invoking, or recording a text/image/voice provider.

## Discover and Confirm Once

Run `npm run provider:status -- <slug> --compact-json`, then verify recorded host tool ids against the current registry. `agent-check-required` is expected for a callable host provider; `error` is a real configuration problem. Do not probe availability with a paid call.

Collect text/image/voice selections with the combined concept decision and run `project:confirm-concept`. Use project scope unless the human explicitly asks to remember a workspace-wide choice. Never request or store secrets; command providers name environment variables in `requiredEnv`.

Use `provider:select` only for an isolated change or fallback. A provider switch or generated-image budget increase returns to the existing human decision; deterministic derivatives within an approved source family do not.

## Adapter Types

| Adapter | Use | Execution |
|---|---|---|
| `host` | Current Codex tool, skill, model, or app | Invoke, write local output, then `provider:record` |
| `command` | User CLI/wrapper/private adapter | `provider:run` executes without a shell and records success |
| `manual` | Authorized supplied or deterministic local asset | Copy/derive output, then `provider:record` |

## Schema-v7 Image Requests and Reuse

Every new image request uses schema v7 and requires `compositionBinding`,
`semanticBinding`, and an explicit `outputSurface`. Use `alpha` only when the
file must contain real transparent pixels, `chroma-key` with a declared edge
key color, or `opaque` for a fully opaque plate. Registration rejects baked
checkerboards, false alpha, unexpected transparency, and unreliable chroma
boundaries. A free asset names its scene/node/role/canvas. Critical content
binds a ready project semantic contract. Older request schemas are rejected
rather than migrated.

Before authoring any rear/subject/front request, compile the storyboard source
package and read [layer-complete-assets.md](layer-complete-assets.md). A
`registered-depth-stack` request also carries the exact compiler-owned
`layerPackageBinding`. It identifies one stable source package, registration,
source strategy, all three complete members, shared canvas, reveal envelopes,
and context-preserving recovery policy.

```json
{
  "$schema": "../../../schemas/asset-request.schema.json",
  "schemaVersion": 7,
  "projectSlug": "example",
  "assetId": "boat-layer-sheet",
  "capability": "image",
  "output": "public/projects/example/assets/boat/layer-sheet.png",
  "prompt": "Create one registered 2x2 sheet: flat reference, clean rear plate, complete boat silhouette, complete front wave overlay",
  "outputSurface": {"mode": "alpha"},
  "compositionBinding": {
    "sceneId": "scene-01",
    "nodeId": "boat-depth-stack",
    "pattern": "registered-depth-stack",
    "registrationId": "boat-family-01",
    "sourceMasterAssetId": "boat-master",
    "canvas": {"width": 2048, "height": 2048},
    "derivation": {
      "method": "provider-generation",
      "parentAssetId": "boat-master"
    }
  },
  "layerPackageBinding": {
    "sourcePackageId": "scene-01-boat-depth-stack",
    "pattern": "registered-depth-stack",
    "motionCapability": "bounded-relative",
    "sourceStrategy": "registered-layer-sheet",
    "packageRole": "registered-sheet",
    "registrationId": "boat-family-01",
    "sourceMasterAssetId": "boat-master",
    "canvas": {"width": 1024, "height": 1024},
    "completeness": null,
    "memberAssetIds": ["boat-rear", "boat-subject", "boat-front"],
    "referenceAssetIds": ["boat-master"],
    "sheetLayout": {
      "columns": 2,
      "rows": 2,
      "cells": [
        {"packageRole": "reference", "row": 0, "column": 0},
        {"packageRole": "support-rear", "row": 0, "column": 1},
        {"packageRole": "subject", "row": 1, "column": 0},
        {"packageRole": "support-front", "row": 1, "column": 1}
      ]
    },
    "recoveryPolicy": {
      "completeSourceContext": true,
      "localDeterministicFixFirst": true,
      "isolatedMemberGeneration": "forbidden",
      "providerRepair": "masked-complete-source-edit",
      "fallback": "full-source-regeneration"
    }
  },
  "semanticBinding": {"riskClass": "topology-critical", "contractIds": ["boat-topology"]}
}
```

For a layer-complete family, use exactly one of these source strategies:

1. `registered-layer-sheet`: one 2x2 source containing a flat reference, a
   clean rear plate, a complete subject silhouette, and a complete front
   overlay; split the three layer cells deterministically;
2. `context-preserving-layer-edits`: one complete reference plus three edits,
   each made with the full reference in provider context and each returning one
   complete full-canvas layer.

The manifest records the provider roots and local derivatives, then computes
one family fingerprint. A composed flat reference is comparison evidence, not
a valid pixel source for independently moving layers. Masking its visible
pixels cannot reconstruct hidden rear or subject content.

Do not make isolated text-to-image calls for registered members. For two or
more poses/states of one identity, prefer one `stateSheetBinding` request with
an explicit grid and the required `preserve-sheet-context` policy, then run
`assets:process-state-sheet`. This converts one provider image into registered
local state files without trimming their shared cell canvas. The processor
records each derivative and a family fingerprint; those local crops do not
consume more generation attempts. Do not put unrelated identities in one sheet
merely to reduce cost.

For a `supported-subject` or `registered-depth-stack` family, do not hand-fill
three manifest records. Author one schema-v2 file against
`schemas/registered-family.schema.json` and run:

```bash
npm run assets:derive-registered-family -- projects/<slug>/registered-families/<family>.json
```

Its source must be the registered layer sheet or the three full-context
layer-package members from the compiled source strategy. The CLI materializes
exactly `support-rear`, `subject`, and `support-front`, keeps the registration
canvas and top-left origin, validates clean-plate/full-silhouette/full-overlay
completeness, appends `registered-family-member` provenance, supersedes prior
active records for the same asset ids, and optionally patches matching
authoring nodes. It reports actual upstream provider image calls, deterministic
local derivatives, and calls avoided from manifest provenance. A flat composed
master, tight image, isolated member, or role/slot/canvas/source-family mismatch
is rejected.

Its required recovery policy is `preserve-family-context`: rerun deterministic
local processing first; if new pixels are required, edit a mask while retaining
the complete source sheet/reference as provider context; if that is unreliable,
regenerate the complete source. Never generate one replacement member in
isolation.

For recovery, follow this order:

1. rerun local splitting/keying when no new pixels are needed;
2. create a schema-v7 `masked-sheet-edit` request that names the complete recorded sheet as `stateSheetRecoveryBinding.sourceSheetAssetId`, uses the same id as `compositionBinding.derivation.parentAssetId`, includes it in `generationFamily.referenceAssetIds`, supplies a full-canvas `maskAssetId`, and names only the failed `targetStateIds`;
3. if untargeted cells cannot remain unchanged, create a `full-sheet-regeneration` request whose target ids equal every member of the state sheet.

The validator rejects a provider-generation/edit request for one `stateBinding` when its generation family contains multiple states. A masked edit also requires `identity-family-consistent`, `cell-separation`, `reference-conformant`, and `untargeted-cells-unchanged`; quality preparation compares untargeted source and result pixels. This is context-preserving regional repair, not isolated cell generation.

Reuse requires the whole composition binding to match, so an unrelated water image cannot enter a registered river family merely because it looks similar.

```bash
npm run provider:reuse -- --request=projects/<slug>/requests/<asset>.json
npm run provider:request -- validate --request=projects/<slug>/requests/<asset>.json --json
npm run provider:attempt -- reserve --request=projects/<slug>/requests/<asset>.json --provider=<id> --json
npm run provider:attempt -- summary --project=<slug> --json
npm run provider:run -- --request=projects/<slug>/requests/<asset>.json --provider=<id>
npm run provider:record -- --request=projects/<slug>/requests/<asset>.json --attempt-id=<attemptId>
npm run provider:recover-record -- --request=projects/<slug>/requests/<asset>.json --attempt-id=<closedSucceededAttemptId>
```

Try exact reuse before reserving an attempt. Validate the request first. `provider:attempt reserve --json` returns the canonical provider/model invocation mapping plus its fingerprint, so the host handoff does not need to guess connector ids. `provider:record` inherits provider/model from the attempt and rejects conflicting overrides. `provider:run` reserves automatically; a host tool call must use the explicit reserve command first. If a host result is abandoned instead of recorded, close it with `provider:attempt close` and state whether quota was consumed. When the ledger already says `succeeded` but manifest recording was interrupted, `provider:recover-record` verifies request/output identity and creates exactly one provenance record without consuming quota twice. Never delete or rewrite `generation-attempts.jsonl`.

The manifest owns accepted asset provenance. The append-only attempt ledger owns real generation usage, including rejected and abandoned results. Production scheduling stays in `production.json`.

## Preflight Production Narration

Add `timingBinding` to every production (non-audition) voice request. Use the storyboard scene id and a minimum and/or maximum duration derived from the approved scene allocation after reserving narration start, meaningful action, and bounded tail time:

```json
{
  "capability": "voice",
  "timingBinding": {
    "sceneId": "scene-01",
    "minDurationSeconds": 8,
    "maxDurationSeconds": 12.5
  }
}
```

`provider:record` and command adapters probe the real media before provenance is committed. An output outside the bound remains on disk for diagnosis but is rejected from the manifest; revise text or voice speed and generate a fitting take. Style auditions do not need `timingBinding`.
