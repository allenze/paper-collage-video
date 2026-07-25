import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  inspectObservedKeyPlanePixels,
} from '../scripts/observed-key-plane-lib.mjs';
import {
  inspectRejectedOutputRecovery,
  writeRejectedOutputRecovery,
} from '../scripts/rejected-output-recovery-lib.mjs';
import {
  deriveRegisteredFamily,
  sha256File,
} from '../scripts/registered-family-lib.mjs';
import {
  generationRequestFingerprint,
} from '../scripts/generation-attempt-lib.mjs';

const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const inspectRaw = (data, width, height) =>
  inspectObservedKeyPlanePixels({
    data,
    imageWidth: width,
    imageHeight: height,
    channels: 3,
    requestedKeyColor: '#ff00ff',
  });

test('observed key plane accepts a stable provider-native near-key surface', async () => {
  const width = 120;
  const height = 90;
  const raw = await sharp(Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#fa02ce"/>
      <ellipse cx="60" cy="45" rx="24" ry="18" fill="#f5bd20"/>
    </svg>
  `)).removeAlpha().raw().toBuffer();
  const result = inspectRaw(raw, width, height);
  assert.equal(result.passed, true, JSON.stringify(result, null, 2));
  assert.equal(result.observedKeyColor, '#fa02ce');
  assert.ok(result.metrics.requestedToObservedDistance > 40);
  assert.ok(result.metrics.largestComponentShare > 0.99);
});

test('observed key plane rejects gradients, checkerboards and multi-cluster surfaces', () => {
  const width = 80;
  const height = 60;
  const gradient = Buffer.alloc(width * height * 3);
  const checker = Buffer.alloc(width * height * 3);
  const multi = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const colors = [
        [250, 2, 170 + Math.round(x / (width - 1) * 80)],
        (x + y) % 2 === 0 ? [250, 2, 206] : [20, 90, 130],
        x < width / 2 ? [250, 2, 206] : [210, 16, 176],
      ];
      gradient.set(colors[0], offset);
      checker.set(colors[1], offset);
      multi.set(colors[2], offset);
    }
  }
  const gradientResult = inspectRaw(gradient, width, height);
  const checkerResult = inspectRaw(checker, width, height);
  const multiResult = inspectRaw(multi, width, height);
  assert.equal(gradientResult.passed, false);
  assert.ok(
    gradientResult.reasons.some((reason) => reason.startsWith('cluster-')),
  );
  assert.equal(checkerResult.passed, false);
  assert.ok(checkerResult.reasons.includes('largest-component-too-small'));
  assert.equal(multiResult.passed, false);
  assert.ok(multiResult.reasons.some((reason) => reason.startsWith('cluster-')));
});

test('rejected output becomes an auditable recovery source without mutating its ledger', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rejected-recovery-'));
  const slug = 'recovery-proof';
  const projectDirectory = path.join(root, 'projects', slug);
  const sourceRelative =
    `public/projects/${slug}/assets/environment/provider-raw.png`;
  const sourceFile = path.join(root, sourceRelative);
  await fs.mkdir(path.dirname(sourceFile), {recursive: true});
  await sharp(Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <rect width="100" height="100" x="0" y="0" fill="#efe1bf"/>
      <path d="M20 66 Q50 30 80 66 V90 H20 Z" fill="#173f72"/>
      <rect width="100" height="100" x="100" y="0" fill="#efe1bf"/>
      <path d="M100 62 Q150 30 200 62 V100 H100 Z" fill="#173f72"/>
      <rect width="100" height="100" x="0" y="100" fill="#fa02ce"/>
      <ellipse cx="50" cy="150" rx="24" ry="15" fill="#f5bd20"/>
      <rect width="100" height="100" x="100" y="100" fill="#fa03cd"/>
      <path d="M100 180 Q150 125 200 180 V200 H100 Z" fill="#2f733f"/>
    </svg>
  `)).png().toFile(sourceFile);
  const sourceSha256 = await sha256File(sourceFile);
  const requestRelative = `projects/${slug}/requests/layer-sheet.json`;
  const request = {
    schemaVersion: 7,
    projectSlug: slug,
    assetId: 'recovery-layer-sheet',
    capability: 'image',
    output: sourceRelative,
    prompt: 'fixture',
    outputSurface: {mode: 'layer-sheet'},
    compositionBinding: {
      sceneId: 'scene',
      nodeId: 'depth-stack',
      pattern: 'registered-depth-stack',
      registrationId: 'recovery-registration',
      sourceMasterAssetId: 'recovery-reference',
      outputRole: 'registered-layer-sheet',
      canvas: {width: 100, height: 100},
      derivation: {
        method: 'provider-generation',
        parentAssetId: 'recovery-reference',
      },
    },
    semanticBinding: {
      riskClass: 'topology-critical',
      contractIds: ['recovery-topology'],
    },
    layerPackageBinding: {
      sourcePackageId: 'recovery-layer-package',
      pattern: 'registered-depth-stack',
      motionCapability: 'bounded-relative',
      sourceStrategy: 'registered-layer-sheet',
      registrationId: 'recovery-registration',
      sourceMasterAssetId: 'recovery-reference',
      canvas: {width: 100, height: 100},
      packageRole: 'registered-sheet',
      completeness: null,
      memberAssetIds: ['recovery-rear', 'recovery-subject', 'recovery-front'],
      referenceAssetIds: ['recovery-reference'],
      sheetLayout: {
        columns: 2,
        rows: 2,
        providerSource: {
          canvasMode: 'provider-native',
          minimumWidth: 100,
          minimumHeight: 100,
          cellExtraction: 'explicit-rects',
        },
        cells: [
          {packageRole: 'reference', row: 0, column: 0, outputSurface: {mode: 'opaque'}},
          {packageRole: 'support-rear', row: 0, column: 1, outputSurface: {mode: 'opaque'}},
          {packageRole: 'subject', row: 1, column: 0, outputSurface: {mode: 'chroma-key', keyColor: '#ff00ff', tolerance: 24}},
          {packageRole: 'support-front', row: 1, column: 1, outputSurface: {mode: 'chroma-key', keyColor: '#ff00ff', tolerance: 24}},
        ],
      },
      recoveryPolicy: {
        completeSourceContext: true,
        localDeterministicFixFirst: true,
        isolatedMemberGeneration: 'forbidden',
        providerRepair: 'masked-complete-source-edit',
        fallback: 'full-source-regeneration',
      },
    },
  };
  const attemptId = 'img-11111111-1111-4111-8111-111111111111';
  const ledgerEvent = {
    schemaVersion: 1,
    attemptId,
    event: 'closed',
    status: 'rejected',
    projectSlug: slug,
    assetId: request.assetId,
    provider: 'fixture-provider',
    model: 'fixture-model',
    requestFingerprint: generationRequestFingerprint(request),
    quotaConsumed: true,
    output: sourceRelative,
    outputSha256: null,
    note: 'exact requested key did not match provider-native near-key plane',
    at: '2026-07-24T00:00:00.000Z',
  };
  const ledgerFile = path.join(projectDirectory, 'generation-attempts.jsonl');
  await Promise.all([
    writeJson(path.join(root, requestRelative), request),
    writeJson(path.join(projectDirectory, 'assets-manifest.json'), {
      schemaVersion: 4,
      projectSlug: slug,
      assets: [],
    }),
    fs.mkdir(projectDirectory, {recursive: true}).then(() =>
      fs.writeFile(ledgerFile, `${JSON.stringify(ledgerEvent)}\n`, 'utf8')),
  ]);
  const ledgerBefore = await fs.readFile(ledgerFile);
  const recoverySpec = {
    schemaVersion: 1,
    projectSlug: slug,
    attemptId,
    historicalRequest: requestRelative,
    source: {file: sourceRelative, sha256: sourceSha256},
    recoveryAssetId: request.assetId,
    reason: 'fixture-observed-key-plane-recovery',
    cells: [
      {
        packageRole: 'subject',
        sourceRect: {left: 0, top: 100, width: 100, height: 100},
        keyPlane: {
          mode: 'provider-native-observed',
          policyId: 'flat-v1',
        },
      },
      {
        packageRole: 'support-front',
        sourceRect: {left: 100, top: 100, width: 100, height: 100},
        keyPlane: {
          mode: 'provider-native-observed',
          policyId: 'flat-v1',
        },
      },
    ],
  };
  const inspected = await inspectRejectedOutputRecovery({
    root,
    spec: recoverySpec,
    provider: {
      id: 'fixture-provider',
      adapter: 'host',
      tool: 'fixture-image',
      model: 'fixture-model',
    },
    now: '2026-07-24T01:00:00.000Z',
  });
  assert.equal(inspected.record.lifecycle.status, 'recovery-source');
  assert.equal(inspected.record.recoveredFromRejectedAttempt, true);
  assert.equal(inspected.recovery.providerCalls, 0);
  assert.deepEqual(inspected.recovery.observedKeyColors, {
    subject: '#fa02ce',
    'support-front': '#fa03cd',
  });
  const recorded = await writeRejectedOutputRecovery(inspected);
  assert.equal(recorded.ledgerSha256After, recorded.ledgerSha256Before);
  assert.deepEqual(await fs.readFile(ledgerFile), ledgerBefore);

  const observedColors = inspected.recovery.observedKeyColors;
  const roles = [
    ['recovery-rear', 'rear-node', 'support-rear', null],
    ['recovery-subject', 'subject-node', 'subject', observedColors.subject],
    ['recovery-front', 'front-node', 'support-front', observedColors['support-front']],
  ];
  const family = await deriveRegisteredFamily({
    root,
    manifest: inspected.manifest,
    spec: {
      schemaVersion: 2,
      projectSlug: slug,
      sceneId: 'scene',
      groupId: 'depth-stack',
      familyId: 'recovery-family',
      pattern: 'registered-depth-stack',
      motionCapability: 'bounded-relative',
      sourcePackageId: 'recovery-layer-package',
      sourceStrategy: 'registered-layer-sheet',
      revealEnvelope: {
        '16:9': {x: 0.02, y: 0.02, scale: 0.03, rotationDegrees: 1},
        '9:16': {x: 0.015, y: 0.02, scale: 0.03, rotationDegrees: 1},
        '1:1': {x: 0.018, y: 0.018, scale: 0.03, rotationDegrees: 1},
      },
      registration: {
        id: 'recovery-registration',
        sourceMasterAssetId: 'recovery-reference',
        canvas: {width: 100, height: 100},
        origin: 'top-left',
      },
      members: roles.map(([assetId, nodeId, role, keyColor], index) => ({
        assetId,
        nodeId,
        role,
        slot: role,
        completeness: {
          'support-rear': 'clean-plate',
          subject: 'full-silhouette',
          'support-front': 'full-overlay',
        }[role],
        output: `public/projects/${slug}/assets/${assetId}.png`,
        source: {
          kind: 'registered-layer-sheet',
          assetId: request.assetId,
          packageRole: role,
        },
        derivation: {
          sourceRect: {
            left: index === 0 ? 100 : index === 1 ? 0 : 100,
            top: index === 0 ? 0 : 100,
            width: 100,
            height: 100,
          },
          ...(keyColor
            ? {
                keying: {
                  keyColor,
                  transparentThreshold: 12,
                  opaqueThreshold: 70,
                  edgeFeather: 0.6,
                  matteErode: 0,
                  edgePadding: 4,
                },
              }
            : {}),
        },
      })),
      recoveryPolicy: {
        strategy: 'preserve-family-context',
        localDeterministicFixFirst: true,
        isolatedMemberGeneration: 'forbidden',
        providerRepair: 'masked-complete-source-edit',
        fallback: 'full-source-regeneration',
      },
      applyToProject: false,
    },
    now: '2026-07-24T02:00:00.000Z',
  });
  assert.equal(family.report.providerImageCalls, 1);
  assert.equal(family.report.localDerivatives, 3);
  assert.equal(family.report.avoidedCalls, 3);
  assert.ok(family.records.every(({lifecycle}) => lifecycle.status === 'active'));
  const subject = family.records.find(({assetId}) => assetId === 'recovery-subject');
  assert.equal(
    subject.registeredFamilyBinding.derivation.sourceSurface.observedKeyColor,
    '#fa02ce',
  );
  const keyMetadata = JSON.parse(
    await fs.readFile(path.join(root, `${subject.file}.key.json`), 'utf8'),
  );
  assert.equal(
    keyMetadata.providerObservation.observationFingerprint,
    inspected.providerObservation.observationFingerprint,
  );
  assert.deepEqual(await fs.readFile(ledgerFile), ledgerBefore);
  assert.equal(
    createHash('sha256').update(ledgerBefore).digest('hex'),
    recorded.ledgerSha256After,
  );
});

test('rejected standalone chroma-key output recovers only from one full-canvas observed plane', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'standalone-recovery-'));
  const slug = 'standalone-recovery';
  const sourceRelative = `public/projects/${slug}/assets/grass.png`;
  const sourceFile = path.join(root, sourceRelative);
  await fs.mkdir(path.dirname(sourceFile), {recursive: true});
  await sharp(Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">
      <rect width="100%" height="100%" fill="#f509eb"/>
      <path d="M0 90 Q30 45 58 90 Q92 35 125 90 Q143 48 160 90Z" fill="#4f7a42"/>
    </svg>
  `)).png().toFile(sourceFile);
  const sourceSha256 = await sha256File(sourceFile);
  const requestRelative = `projects/${slug}/requests/grass.json`;
  const request = {
    schemaVersion: 7,
    projectSlug: slug,
    assetId: 'standalone-grass',
    capability: 'image',
    output: sourceRelative,
    prompt: 'fixture',
    outputSurface: {mode: 'chroma-key', keyColor: '#ff00ff', tolerance: 24},
    compositionBinding: {
      sceneId: 'scene', nodeId: 'world', pattern: 'looping-environment',
      outputRole: 'near-foreground-strip-source', canvas: {width: 160, height: 90},
      derivation: {method: 'provider-generation'},
    },
    semanticBinding: {riskClass: 'decorative', contractIds: []},
  };
  const attemptId = 'img-22222222-2222-4222-8222-222222222222';
  const ledgerEvent = {
    schemaVersion: 1, attemptId, event: 'closed', status: 'rejected',
    projectSlug: slug, assetId: request.assetId, provider: 'fixture-provider',
    model: 'fixture-model', requestFingerprint: generationRequestFingerprint(request),
    quotaConsumed: true, output: sourceRelative, outputSha256: null,
    note: 'strict boundary mismatch', at: '2026-07-24T00:00:00.000Z',
  };
  const projectDirectory = path.join(root, 'projects', slug);
  const ledgerFile = path.join(projectDirectory, 'generation-attempts.jsonl');
  await Promise.all([
    writeJson(path.join(root, requestRelative), request),
    writeJson(path.join(projectDirectory, 'assets-manifest.json'), {
      schemaVersion: 4, projectSlug: slug, assets: [],
    }),
    fs.mkdir(projectDirectory, {recursive: true}).then(() =>
      fs.writeFile(ledgerFile, `${JSON.stringify(ledgerEvent)}\n`, 'utf8')),
  ]);
  const spec = {
    schemaVersion: 1, projectSlug: slug, attemptId,
    historicalRequest: requestRelative,
    source: {file: sourceRelative, sha256: sourceSha256},
    recoveryAssetId: request.assetId, reason: 'fixture-standalone-observed-plane',
    cells: [{
      packageRole: 'image', sourceRect: {left: 0, top: 0, width: 160, height: 90},
      keyPlane: {mode: 'provider-native-observed', policyId: 'flat-v1'},
    }],
  };
  const provider = {
    id: 'fixture-provider', adapter: 'host', tool: 'fixture-image', model: 'fixture-model',
  };
  const inspected = await inspectRejectedOutputRecovery({root, spec, provider});
  assert.equal(inspected.record.lifecycle.status, 'recovery-source');
  assert.deepEqual(inspected.recovery.observedKeyColors, {image: '#f509eb'});
  const invalid = structuredClone(spec);
  invalid.cells[0].sourceRect.width = 159;
  await assert.rejects(
    () => inspectRejectedOutputRecovery({root, spec: invalid, provider}),
    /完整 provider 输出画布/,
  );
});
