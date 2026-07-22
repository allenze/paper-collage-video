# Workspace Setup

Read this only when the current directory is not already a valid paper-collage workspace or doctor fails.

A valid workspace exposes `project:new`, `project:resume`, `project:preview`, and `project:render` in `package.json`. Never generate projects inside the immutable plugin cache.

Rendering chooses a CPU-aware concurrency automatically, capped at eight pages. If a full Chrome executable is required and becomes unresponsive under multipage rendering, retry the unchanged command with `PAPER_COLLAGE_RENDER_CONCURRENCY=1`. This is a supported execution control only; it does not change project content, frame rate, or output quality.

If the Skill path injected into the current task names a cache version that is missing or differs from the installed plugin registry, do not search for the newest directory and continue implicitly. The task snapshot is stale: report both versions and start a new Codex task so Skill instructions and packaged runtime are loaded from one version. A bootstrapped workspace doctor also compares its marker version with its package version.

`runtime-build.json` is the executable identity for proof and render behavior. Version strings alone are insufficient: source, packaged template, and installed cache must agree on both `packageVersion` and `fingerprint`. After Skill/runtime changes, run `npm run plugin:sync`, install that packaged version, compare the installed manifest, and bootstrap a fresh workspace before claiming the upgrade is active.

If no workspace exists, resolve the plugin root two directories above this Skill and run:

```bash
node <plugin-root>/scripts/bootstrap-workspace.mjs \
  --target=<absolute-writable-workspace> --install
```

Then work from that target and run:

```bash
npm run doctor -- --ready
npm run provider:status -- --compact-json
```

The bootstrap owns npm installation and `.venv`; do not ask the human to activate Python manually.

If setup fails, preserve the target and report the failed check, workspace path, safe resume command, and one required permission/dependency/provider action. Do not proceed to generation until required local checks pass.
