import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const RUNTIME_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

export const RUNTIME_BUILD_INPUTS = [
  'package.json',
  'remotion.config.ts',
  'schemas/composition.schema.json',
  'schemas/project.schema.json',
  'schemas/quality-report.schema.json',
  'scripts/composition-lib.mjs',
  'scripts/motion-treatment-lib.mjs',
  'scripts/project-composition-proof.mjs',
  'scripts/project-lib.mjs',
  'scripts/quality-lib.mjs',
  'scripts/render-cache-lib.mjs',
  'scripts/runtime-build-lib.mjs',
  'scripts/state-sequence-lib.mjs',
  'scripts/style-motion-proof.mjs',
  'scripts/style-proof-lib.mjs',
  'src/MainVideo.tsx',
  'src/ReplicaChapterScene.tsx',
  'src/SceneTransitionOverlay.tsx',
  'src/motion.ts',
  'src/project.ts',
  'src/roleMotion.ts',
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
