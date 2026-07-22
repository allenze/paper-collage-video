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

## Schema-v3 Image Requests and Reuse

Every new image request uses schema v4 and requires both `compositionBinding` and `semanticBinding`. A free asset names its scene/node/role/canvas. A coupled asset also names the common registration and source master. Critical content binds a ready project semantic contract. Older request schemas are rejected rather than migrated.

```json
{
  "$schema": "../../../schemas/asset-request.schema.json",
  "schemaVersion": 4,
  "projectSlug": "example",
  "assetId": "boat-front",
  "capability": "image",
  "output": "public/projects/example/assets/boat/front.png",
  "prompt": "Extract the front gunwale from the approved registered master",
  "compositionBinding": {
    "sceneId": "scene-01",
    "nodeId": "boat-front",
    "pattern": "supported-subject",
    "registrationId": "boat-family-01",
    "sourceMasterAssetId": "boat-master",
    "outputRole": "support-front",
    "canvas": {"width": 1600, "height": 900},
    "derivation": {"method": "alpha-extraction", "parentAssetId": "boat-master"}
  },
  "semanticBinding": {"riskClass": "topology-critical", "contractIds": ["boat-topology"]}
}
```

For a coupled family:

1. request/generate/import the complete master;
2. derive rear/subject/front, upper/lower bands, and masks from that master;
3. keep each derivative on the identical canvas and origin;
4. record every output so manifest v3 computes one family fingerprint.

Do not make independent text-to-image calls for registered members. For two or more poses/states of one identity, prefer one `stateSheetBinding` request with an explicit grid and `regenerate-failed-cell-only`, then run `assets:process-state-sheet`. This converts one provider image into registered local state files without trimming their shared cell canvas. The processor records each derivative and a family fingerprint; those local crops do not consume more generation attempts. Do not put unrelated identities in one sheet merely to reduce cost.

Reuse requires the whole composition binding to match, so an unrelated water image cannot enter a registered river family merely because it looks similar.

```bash
npm run provider:reuse -- --request=projects/<slug>/requests/<asset>.json
npm run provider:attempt -- reserve --request=projects/<slug>/requests/<asset>.json --provider=<id> --json
npm run provider:run -- --request=projects/<slug>/requests/<asset>.json --provider=<id>
npm run provider:record -- --request=projects/<slug>/requests/<asset>.json --provider=<id> --model=<model> --attempt-id=<attemptId>
```

Try exact reuse before reserving an attempt. `provider:run` reserves automatically; a host tool call must use the explicit reserve command first. If a host result is abandoned instead of recorded, close it with `provider:attempt close` and state whether quota was consumed. Never delete or rewrite `generation-attempts.jsonl`.

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
