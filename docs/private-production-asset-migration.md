# Private Production Asset Migration

## Decision

The repository distributes the reusable `paper-collage-video` Skill and its
small, licensed regression fixtures. Personal video productions remain editable
on the local workstation but are not source-distributed by default.

The root `.gitignore` therefore ignores new `projects/<slug>/` and
`public/projects/<slug>/` directories. It deliberately does **not** ignore
`fixtures/`, `public/fixtures/`, or the plugin template's fixtures; those are
the supported home for small, synthetic, publicly redistributable regression
inputs.

Ignoring a path is not a backup policy. Keep personal productions in normal
local backup/archival storage when they must survive a workstation migration.

## Current Scope: Phase 1

This phase is intentionally non-destructive.

- New local productions, including `gui-tu-sai-pao`, stay on disk and no longer
  appear as untracked Git work.
- Existing tracked historical productions remain exactly where they are.
- No provider source, audio, final video, generated asset, Git history, or
  repository index entry is deleted.
- `dist/`, `build/`, `node_modules/`, and caches remain ignored generated
  output.

## Candidate Content Boundary

Keep in the reusable repository:

- Skills, schemas, runtime source, scripts, tests, lockfiles, licenses, and
  plugin metadata.
- A minimal set of synthetic/lawfully redistributable regression fixtures needed
  for fresh plugin validation.
- Documentation and failure-to-capability records, such as the Skill evolution
  backlog.

Keep local by default:

- `projects/<slug>/` planning, approvals, provider ledgers, prompts, review
  records, and production metrics for a personal film.
- `public/projects/<slug>/` generated images, state sheets, local derivatives,
  narration, audition audio, music, and source media.
- Preview/final renders, contact sheets, proof frames, caches, and temporary
  build artifacts.

If a production uncovers a reusable bug, extract only the smallest anonymized
fixture plus its assertion into `fixtures/`; do not commit a whole film to prove
one behavior.

## Later Migration: Requires Separate Approval

The existing tracked historical project folders were committed before this
policy. A later, reviewable migration can remove them from the Git index while
preserving every local file, then replace only necessary coverage with compact
fixtures. That operation must be performed as its own change set and should:

1. Inventory each tracked production and identify the exact behavior, if any,
   that is still uniquely covered by it.
2. Add an equivalent small fixture/test before removing a production that has
   unique regression value.
3. Use index-only removal (`git rm --cached`) for selected project/configuration
   and media paths; do not remove local working copies.
4. Verify a fresh workspace and installed plugin without those project assets.
5. Decide separately whether historical Git objects merit a coordinated history
   rewrite. A new ignore rule cannot shrink blobs already present in history.

Do not combine this later migration with unrelated Skill/runtime work or delete
local user productions automatically.
