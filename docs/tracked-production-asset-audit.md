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

## Resolved Fixture Dependency

The audit found that `fixtures/transition-gallery/project.json` had assigned
every gallery scene this source:

```text
projects/last-red-leaf/audio/style-proof-tone.wav
```

The resolved local file is
`public/projects/last-red-leaf/audio/style-proof-tone.wav`: a deterministic,
mono 48 kHz PCM WAV lasting one second. It is not story narration and has no
reason to remain tied to a personal production.

This has been resolved without changing the historical local project: an
identical, SHA-256-verified 1-second test tone now lives at
`public/fixtures/transition-gallery/style-proof-tone.wav`, and every gallery
scene refers to `fixtures/transition-gallery/style-proof-tone.wav` instead.

## Phase 3 Implementation

The user explicitly approved index-only removal of all six audited historical
productions. The migration stages deletion of 497 tracked project/media files
while keeping every file in the working directory under the Phase 1 ignore
rules. It does not remove a local file, alter a published release attachment,
or rewrite Git history.

The historical `zhuang-zhou-meng-die` friction log remains locally available as
production history. Current reusable behavior is represented by the maintained
Skill documentation, source tests, and the separate evolution backlog rather
than by retaining an entire historical production in the distributable source
tree. Likewise, the current synthetic VOX fixtures are the canonical shared
coverage; the two historical submarine productions remain local reference work.

## Non-Dependencies Confirmed

- The plugin package allowlist copies only its own synthetic
  `projects/starter-demo` and `public/projects/starter-demo`; it does not copy
  root historical projects.
- The README's `tie-chu-mo-zhen` link targets a published release URL rather
  than `public/projects/tie-chu-mo-zhen`.
- `dist/`, `build/`, `node_modules/`, and current personal project directories
  are already ignored or covered by Phase 1's ignore rules. They are not
  candidate uploads.

## Post-Migration Verification

After committing the staged migration, verify that the transition gallery reads
the independent fixture, the test suite passes without a source reference to a
historical project, and the packaged plugin still installs from its own small
starter fixture. Historical blob-size reduction remains a later, separate
decision because it requires an explicit history-rewrite plan.
