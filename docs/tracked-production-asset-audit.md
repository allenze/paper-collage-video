# Tracked Production Asset Audit

Date: 2026-07-24

## Scope and Method

This is Phase 2 of the private-production migration described in
[`private-production-asset-migration.md`](private-production-asset-migration.md).
It inventories the historical root `projects/<slug>/` and
`public/projects/<slug>/` entries currently tracked by Git. It does not remove
an index entry, local file, or historical Git object.

The audit checked:

1. tracked-file count and byte size by project slug;
2. references outside the production roots, including tests, scripts,
   documentation, and license records; and
3. the plugin package allowlist in `scripts/sync-plugin-package.mjs`.

The packaged plugin does not include any root historical production. Its
separate `starter-demo` is a small, synthetic bootstrap fixture and remains
part of the package.

## Inventory and Disposition

| Slug | Tracked files | Tracked size | Reusable dependency | Phase 3 disposition |
| --- | ---: | ---: | --- | --- |
| `last-red-leaf` | 77 | 15.40 MiB | **One blocker:** `fixtures/transition-gallery/project.json` uses its 1-second, 94 KiB synthetic proof tone. | First extract that tone as an independent transition-gallery fixture; then remove this personal production from the index while preserving it locally. |
| `san-ge-he-shang` | 116 | 71.31 MiB | No runtime, test, package, or documentation input dependency. | Remove from the index; retain only locally. |
| `tie-chu-mo-zhen` | 120 | 49.79 MiB | README points to an external release video, not local media. `ASSET_LICENSES.md` names its local media path. | Remove local production/media from the index; revise the license record to describe the released demo provenance without claiming a missing repository path. |
| `zhuang-zhou-meng-die` | 94 | 68.10 MiB | No runtime/package dependency. Its friction log contains potentially reusable lessons. | Move only reusable, generalized findings into Skill documentation/backlog; then remove project/media from the index. |
| `vox-depth-stack-pilot-submarine` | 46 | 14.57 MiB | No current runtime/package dependency. It is a historical manual proof of a registered depth stack. | Before removal, confirm the existing synthetic VOX fixtures cover its unique topology/reveal behavior; add a tiny fixture only if coverage is missing. |
| `vox-depth-stack-pilot-submarine-cinematic` | 44 | 11.20 MiB | No runtime/package dependency. | Remove from the index; retain only locally. |

The six historical productions account for approximately **230.37 MiB** of
currently tracked working-tree files. The repository currently carries about
**231 MiB** under `public/`; this is the material source-control bloat, not the
approximately 7.7 MiB packaged Skill.

## Exact Dependency to Break

`fixtures/transition-gallery/project.json` currently assigns every gallery
scene this source:

```text
projects/last-red-leaf/audio/style-proof-tone.wav
```

The resolved local file is
`public/projects/last-red-leaf/audio/style-proof-tone.wav`: a deterministic,
mono 48 kHz PCM WAV lasting one second. It is not story narration and has no
reason to remain tied to a personal production.

Before any index-only project removal, create a small independent fixture such
as `public/fixtures/transition-gallery/style-proof-tone.wav`, point the gallery
fixture to it, and validate the gallery from a fresh workspace. The original
local project copy remains untouched.

## Non-Dependencies Confirmed

- The plugin package allowlist copies only its own synthetic
  `projects/starter-demo` and `public/projects/starter-demo`; it does not copy
  root historical projects.
- The README's `tie-chu-mo-zhen` link targets a published release URL rather
  than `public/projects/tie-chu-mo-zhen`.
- `dist/`, `build/`, `node_modules/`, and current personal project directories
  are already ignored or covered by Phase 1's ignore rules. They are not
  candidate uploads.

## Phase 3 Preconditions

Do not perform index-only removal until all applicable preconditions pass:

1. Extract the transition-gallery tone fixture and validate its consumer.
2. Convert reusable `zhuang-zhou-meng-die` findings into generalized Skill
   guidance rather than retaining a whole film as documentation.
3. Compare the two submarine projects against the current VOX fixture suite;
   add only a minimal synthetic fixture for a still-uncovered behavior.
4. Update `ASSET_LICENSES.md` as part of the `tie-chu-mo-zhen` index migration.
5. Present the exact `git rm --cached` path list for approval. That action must
   preserve local files and must not include any history rewrite.

After Phase 3, a fresh checkout/plugin workspace must validate without root
historical productions. Historical blob-size reduction is a later, separate
decision because it requires an explicit history-rewrite plan.
