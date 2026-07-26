import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {
  collectRuntimeVisibleCompositionSources,
  validateCompositionStructure,
} from '../scripts/composition-lib.mjs';
import {
  prepareQualityReport,
} from '../scripts/quality-lib.mjs';
import {
  createCompositionProofProject,
  createSceneProofFingerprint,
} from '../scripts/render-cache-lib.mjs';
import {
  createRuntimeBuildManifest,
  createRuntimeSurfaceFingerprint,
  RUNTIME_BUILD_INPUTS,
  RUNTIME_SURFACE_INPUTS,
} from '../scripts/runtime-build-lib.mjs';
import {collectParallaxDepths} from '../src/parallax.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256File = async (file) =>
  createHash('sha256').update(await fs.readFile(file)).digest('hex');

test('composition-proof runtime surface excludes subtitle-only implementation changes', async () => {
  assert.ok(
    !RUNTIME_SURFACE_INPUTS['composition-proof'].includes(
      'src/SubtitleOverlay.tsx',
    ),
  );
  assert.ok(
    RUNTIME_SURFACE_INPUTS['composition-proof'].includes(
      'src/ReplicaChapterScene.tsx',
    ),
  );
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'paper-collage-runtime-surface-'),
  );
  try {
    for (const relative of RUNTIME_BUILD_INPUTS) {
      const target = path.join(directory, relative);
      await fs.mkdir(path.dirname(target), {recursive: true});
      await fs.copyFile(path.join(ROOT, relative), target);
    }
    const beforeBuild = await createRuntimeBuildManifest({root: directory});
    const beforeSurface = await createRuntimeSurfaceFingerprint(
      'composition-proof',
      {root: directory},
    );
    await fs.appendFile(
      path.join(directory, 'src/SubtitleOverlay.tsx'),
      '\n// subtitle-only fixture change\n',
      'utf8',
    );
    const afterSubtitleBuild = await createRuntimeBuildManifest({
      root: directory,
    });
    const afterSubtitleSurface = await createRuntimeSurfaceFingerprint(
      'composition-proof',
      {root: directory},
    );
    assert.notEqual(afterSubtitleBuild.fingerprint, beforeBuild.fingerprint);
    assert.equal(afterSubtitleSurface, beforeSurface);

    await fs.appendFile(
      path.join(directory, 'src/ReplicaChapterScene.tsx'),
      '\n// shared composition fixture change\n',
      'utf8',
    );
    const afterCompositionSurface = await createRuntimeSurfaceFingerprint(
      'composition-proof',
      {root: directory},
    );
    assert.notEqual(afterCompositionSurface, beforeSurface);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('composition proof input and fingerprints exclude subtitle-only data', async () => {
  const project = {
    video: {width: 1920, height: 1080, fps: 30},
    theme: {texture: null, fontFile: null},
    scenes: [{
      id: 'scene',
      narration: {startSeconds: 0, durationSeconds: 1, text: '原旁白'},
      events: [],
      composition: {coordinateSpace: {width: 1920, height: 1080}, nodes: []},
      subtitles: [{from: 0, to: 30, text: '不会进入构图证明'}],
      appearance: {
        background: '#ffffff',
        subtitles: {variant: 'paper-card', color: '#111111'},
      },
    }],
  };
  const proof = createCompositionProofProject(project);
  assert.deepEqual(proof.scenes[0].subtitles, []);
  assert.deepEqual(proof.scenes[0].appearance.subtitles, {variant: 'hidden'});
  assert.equal(project.scenes[0].subtitles.length, 1);
  assert.equal(project.scenes[0].appearance.subtitles.variant, 'paper-card');
  const changed = structuredClone(project);
  changed.scenes[0].narration.text = '修改后的旁白';
  changed.scenes[0].subtitles[0].text = '修改后的字幕';
  changed.scenes[0].appearance.subtitles.color = '#ff0000';
  const proofInput = {
    proof: {id: 'final', at: 0.9},
    absoluteFrame: 27,
  };
  const beforeComposition = await createSceneProofFingerprint({
    project,
    scene: project.scenes[0],
    ...proofInput,
    surface: 'composition-proof',
  });
  const afterComposition = await createSceneProofFingerprint({
    project: changed,
    scene: changed.scenes[0],
    ...proofInput,
    surface: 'composition-proof',
  });
  const beforeFinal = await createSceneProofFingerprint({
    project,
    scene: project.scenes[0],
    ...proofInput,
  });
  const afterFinal = await createSceneProofFingerprint({
    project: changed,
    scene: changed.scenes[0],
    ...proofInput,
  });
  assert.equal(afterComposition, beforeComposition);
  assert.notEqual(afterFinal, beforeFinal);
});

test('derivation-only registered family passes deterministic checks without human review items', async () => {
  const slug = `derivation-only-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const publicDirectory = path.join(ROOT, 'public', 'projects', slug);
  const roles = ['support-rear', 'subject', 'support-front'];
  const familyFingerprint = 'f'.repeat(64);
  const recoveryPolicy = {
    strategy: 'preserve-family-context',
    localDeterministicFixFirst: true,
    isolatedMemberGeneration: 'forbidden',
    providerRepair: 'masked-complete-source-edit',
    fallback: 'full-source-regeneration',
  };
  const nodeFor = (role) => ({
    id: role,
    kind: 'asset',
    assetRole: role === 'subject' ? 'character' : 'prop',
    src: `projects/${slug}/${role}.png`,
    z: roles.indexOf(role),
    slot: role,
    registrationId: 'technical-family',
    transform: {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      anchorX: 0,
      anchorY: 0,
    },
    motion: {keyframes: [{at: 0, x: 0}, {at: 1, x: 0}]},
  });
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    await fs.mkdir(publicDirectory, {recursive: true});
    const records = [];
    for (const [index, role] of roles.entries()) {
      const file = path.join(publicDirectory, `${role}.png`);
      const block = await sharp({
        create: {
          width: 40,
          height: 30,
          channels: 4,
          background: {r: 60 + index * 50, g: 90, b: 130, alpha: 1},
        },
      }).png().toBuffer();
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: {r: 0, g: 0, b: 0, alpha: 0},
        },
      }).composite([{input: block, left: 30, top: 55}]).png().toFile(file);
      records.push({
        recordId: String(index + 1).padStart(64, '0'),
        assetId: role,
        capability: 'image',
        adapter: 'registered-family-member',
        file: path.relative(ROOT, file),
        sha256: await sha256File(file),
        media: {width: 100, height: 100, format: 'png', hasAlpha: true},
        lifecycle: {
          status: 'active',
          changedAt: '2026-01-01T00:00:00.000Z',
          reason: 'fixture',
          supersededBy: null,
        },
        familyFingerprint,
        registeredFamilyBinding: {
          schemaVersion: 2,
          familyId: 'technical-family-members',
          pattern: 'supported-subject',
          motionCapability: 'bounded-relative',
          sourcePackageId: 'technical-source-package',
          sourceStrategy: 'registered-layer-sheet',
          revealEnvelope: {
            '16:9': {x: 0.02, y: 0.02, scale: 0.04, rotationDegrees: 1},
            '9:16': {x: 0.02, y: 0.02, scale: 0.04, rotationDegrees: 1},
            '1:1': {x: 0.02, y: 0.02, scale: 0.04, rotationDegrees: 1},
          },
          registrationId: 'technical-family',
          sourceMasterAssetId: 'technical-master',
          canvas: {width: 100, height: 100},
          origin: 'top-left',
          role,
          slot: role,
          completeness: {
            'support-rear': 'clean-plate',
            subject: 'full-silhouette',
            'support-front': 'full-overlay',
          }[role],
          nodeId: role,
          source: {
            kind: 'registered-layer-sheet',
            assetId: 'technical-sheet',
            stateId: null,
            sourceSheetAssetId: null,
            sourceFamilyFingerprint: null,
            sha256: 'a'.repeat(64),
          },
          derivation: {
            placement: {left: 0, top: 0, width: 100, height: 100},
            sourceRect: null,
            sourceSurface: null,
            keying: null,
            keyingMetadataSha256: null,
            maskAssetId: null,
            maskSha256: null,
            maskChannel: null,
            invertMask: false,
            clip: null,
            trimmed: false,
            outputCanvasPreserved: true,
          },
          recoveryPolicy,
          familyFingerprint,
        },
      });
    }
    const project = {
      schemaVersion: 10,
      slug,
      video: {width: 100, height: 100, fps: 30},
      quality: {minimumAssetScale: 1},
      scenes: [{
        id: 'scene',
        durationInFrames: 30,
        narration: {startSeconds: 0, durationSeconds: 1, text: ''},
        tailSeconds: 0,
        motion: {
          proofTimes: [
            {id: 'establish', at: 0.08},
            {id: 'action', at: 0.5},
            {id: 'final', at: 0.9},
          ],
        },
        composition: {
          coordinateSpace: {width: 100, height: 100},
          nodes: [{
            id: 'technical-rig',
            kind: 'group',
            pattern: 'supported-subject',
            renderParticipation: 'derivation-only',
            z: 0,
            coordinateSpace: {width: 100, height: 100},
            transform: {
              x: 0,
              y: 0,
              width: 1,
              height: 1,
              anchorX: 0,
              anchorY: 0,
            },
            motion: {keyframes: [{at: 0, x: 0}, {at: 1, x: 0}]},
            registration: {
              id: 'technical-family',
              sourceMasterAssetId: 'technical-master',
              canvas: {width: 100, height: 100},
              origin: 'top-left',
            },
            support: {
              subjectId: 'subject',
              contactAnchor: {x: 0.5, y: 0.7},
              contactZone: [[0.2, 0.4], [0.8, 0.4], [0.8, 0.9], [0.2, 0.9]],
              occlusionZone: [[0.2, 0.4], [0.8, 0.4], [0.8, 0.9], [0.2, 0.9]],
            },
            children: roles.map(nodeFor),
          }],
        },
        events: [],
      }],
      sceneTransitions: [],
    };
    assert.deepEqual(
      collectRuntimeVisibleCompositionSources(
        project.scenes[0].composition,
      ),
      [],
    );
    assert.deepEqual(
      collectParallaxDepths(project.scenes[0].composition.nodes),
      [],
    );
    const opacityHidden = structuredClone(project.scenes[0].composition);
    delete opacityHidden.nodes[0].renderParticipation;
    opacityHidden.nodes[0].transform.opacity = 0;
    const hiddenIssues = validateCompositionStructure({
      composition: opacityHidden,
      video: project.video,
      proofTimes: project.scenes[0].motion.proofTimes,
      durationSeconds: 1,
      location: 'scene.composition',
    }).issues;
    assert.ok(
      hiddenIssues.some(
        ({code}) => code === 'composition-zero-opacity-source',
      ),
    );
    await fs.writeFile(
      path.join(projectDirectory, 'project.json'),
      `${JSON.stringify(project, null, 2)}\n`,
      'utf8',
    );
    await fs.writeFile(
      path.join(projectDirectory, 'assets-manifest.json'),
      `${JSON.stringify({
        schemaVersion: 4,
        projectSlug: slug,
        assets: records,
      }, null, 2)}\n`,
      'utf8',
    );

    const status = await prepareQualityReport(slug);
    assert.equal(status.ready, true);
    assert.equal(status.pending, 0);
    assert.equal(status.report.assets.length, 3);
    assert.ok(
      status.report.assets.every(
        ({reviewScope, requiredChecks, status: entryStatus}) =>
          reviewScope === 'derivation-only' &&
          requiredChecks.length === 0 &&
          entryStatus === 'passed',
      ),
    );
    assert.equal(status.report.composites.length, 1);
    assert.equal(
      status.report.composites[0].reviewScope,
      'derivation-only',
    );
    assert.deepEqual(status.report.composites[0].requiredChecks, []);
    assert.deepEqual(status.report.composites[0].proofFrames, []);
    assert.ok(
      status.report.composites[0].technical.checks.every(
        ({passed}) => passed,
      ),
    );
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
    await fs.rm(publicDirectory, {recursive: true, force: true});
    await fs.rm(path.join(ROOT, 'dist', slug), {recursive: true, force: true});
  }
});
