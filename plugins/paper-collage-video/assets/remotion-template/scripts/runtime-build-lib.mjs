import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const RUNTIME_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

export const RUNTIME_BUILD_INPUTS = [
  'package.json',
  'requirements.txt',
  'remotion.config.ts',
  'schemas/composition.schema.json',
  'schemas/editorial.schema.json',
  'schemas/assets-manifest.schema.json',
  'schemas/asset-request.schema.json',
  'schemas/audio-calibration.schema.json',
  'schemas/production.schema.json',
  'schemas/planning-scenarios.schema.json',
  'schemas/provider-observation.schema.json',
  'schemas/project.schema.json',
  'schemas/quality-report.schema.json',
  'schemas/looping-strip.schema.json',
  'schemas/registered-family.schema.json',
  'schemas/registered-family-binding.schema.json',
  'schemas/rejected-output-recovery.schema.json',
  'schemas/semantic-contracts.schema.json',
  'schemas/storyboard.schema.json',
  'schemas/storyboard-authoring.schema.json',
  'schemas/style-catalog.schema.json',
  'public/style-catalog/catalog.json',
  'public/style-catalog/generation-provenance.json',
  'public/style-catalog/childrens-picture-book-paper.png',
  'public/style-catalog/hand-drawn-cutout-explainer.png',
  'public/style-catalog/archival-collage.png',
  'scripts/composition-lib.mjs',
  'scripts/creative-plan-lib.mjs',
  'scripts/intake-lib.mjs',
  'scripts/planning-scenario-lib.mjs',
  'scripts/style-catalog-lib.mjs',
  'scripts/alpha-band-lib.mjs',
  'scripts/asset-evidence-lib.mjs',
  'scripts/asset-manifest-lib.mjs',
  'scripts/chroma-key-lib.mjs',
  'scripts/asset-hardening-proof-lib.mjs',
  'scripts/audio-calibration-lib.mjs',
  'scripts/audio-preflight-lib.mjs',
  'scripts/directing-revision-lib.mjs',
  'scripts/editorial-system-lib.mjs',
  'scripts/generation-attempt-lib.mjs',
  'scripts/layer-source-plan-lib.mjs',
  'scripts/layer-stack-proof-lib.mjs',
  'scripts/looping-strip-lib.mjs',
  'scripts/motion-treatment-lib.mjs',
  'scripts/observed-key-plane-lib.mjs',
  'scripts/provider-attempt.mjs',
  'scripts/provider-lib.mjs',
  'scripts/provider-recover-rejected-source.mjs',
  'scripts/project-composition-proof.mjs',
  'scripts/project-budget.mjs',
  'scripts/project-confirm-concept.mjs',
  'scripts/project-intake.mjs',
  'scripts/project-doctor.mjs',
  'scripts/project-lib.mjs',
  'scripts/project-plan.mjs',
  'scripts/project-scenarios.mjs',
  'scripts/project-render-status.mjs',
  'scripts/phase2-proof-lib.mjs',
  'scripts/world-motion-proof-lib.mjs',
  'scripts/world-trajectory-lib.mjs',
  'scripts/prepare-phase2-proof.mjs',
  'scripts/prepare-looping-world-proof.mjs',
  'scripts/production-state.mjs',
  'scripts/process-state-sheet.mjs',
  'scripts/derive-registered-family.mjs',
  'scripts/derive-looping-strip.mjs',
  'scripts/registered-family-lib.mjs',
  'scripts/rejected-output-recovery-lib.mjs',
  'scripts/quality-lib.mjs',
  'scripts/render-cache-lib.mjs',
  'scripts/render-status-lib.mjs',
  'scripts/runtime-build-lib.mjs',
  'scripts/semantic-contract-lib.mjs',
  'scripts/remove_chroma_key.py',
  'scripts/state-sequence-lib.mjs',
  'scripts/style-motion-proof.mjs',
  'scripts/project-scene-preview.mjs',
  'scripts/project-stitch-narration.mjs',
  'scripts/style-proof-lib.mjs',
  'scripts/storyboard-lib.mjs',
  'scripts/render-phase2-proof.mjs',
  'scripts/render-looping-world-proof.mjs',
  'scripts/schema-v10.mjs',
  'scripts/validate_v10_schemas.py',
  'scripts/verify-phase2-proof.mjs',
  'scripts/verify-looping-world-proof.mjs',
  'scripts/verify-vox-sample.mjs',
  'scripts/prove-alpha-bands.mjs',
  'scripts/prove-registered-family.mjs',
  'scripts/vox-sample-proof-lib.mjs',
  'fixtures/phase2-proof-fixture.mjs',
  'fixtures/looping-world-fixture.mjs',
  'src/MainVideo.tsx',
  'src/EditorialNodes.tsx',
  'src/ReplicaChapterScene.tsx',
  'src/SceneTransitionOverlay.tsx',
  'src/motion.ts',
  'src/editorialPrimitives.mjs',
  'src/motifField.mjs',
  'src/parallax.mjs',
  'src/worldStrip.mjs',
  'src/project.ts',
  'src/sceneTimeline.mjs',
  'src/stateSequence.ts',
  'src/visibilityLifecycle.mjs',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const createRuntimeBuildManifest = async ({root = RUNTIME_ROOT} = {}) => {
  const files = {};
  for (const relative of RUNTIME_BUILD_INPUTS) {
    if (relative === 'package.json') {
      const packageJson = JSON.parse(await fs.readFile(path.join(root, relative), 'utf8'));
      files[relative] = sha256(JSON.stringify({
        version: packageJson.version,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
      }));
    } else {
      files[relative] = sha256(await fs.readFile(path.join(root, relative)));
    }
  }
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const fingerprint = sha256(
    Object.entries(files).map(([file, digest]) => `${file}\0${digest}`).join('\n'),
  );
  return {
    schemaVersion: 1,
    packageVersion: packageJson.version,
    fingerprint,
    files,
  };
};

export const createRuntimeBuildFingerprint = async (options) =>
  (await createRuntimeBuildManifest(options)).fingerprint;
