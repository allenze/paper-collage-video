import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  deriveSemanticSlices,
  validateSemanticSlicesSpec,
} from '../scripts/semantic-slices-lib.mjs';
import {assertAssetManifest} from '../scripts/asset-manifest-lib.mjs';

const fixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-slices-'));
  const directory = path.join(root, 'public', 'projects', 'fixture');
  await fs.mkdir(directory, {recursive: true});
  const source = path.join(directory, 'source.png');
  await sharp(Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="50">
      <rect width="80" height="50" fill="transparent"/>
      <rect x="5" y="8" width="12" height="14" fill="#cc8844"/>
      <circle cx="48" cy="25" r="8" fill="#669944"/>
      <rect x="65" y="34" width="8" height="9" fill="#6688aa"/>
    </svg>
  `)).png().toFile(source);
  const buffer = await fs.readFile(source);
  const sha256 = (await import('node:crypto'))
    .createHash('sha256')
    .update(buffer)
    .digest('hex');
  const record = {
    recordId: '1'.repeat(64),
    assetId: 'source',
    capability: 'image',
    file: path.relative(root, source),
    provider: 'local',
    adapter: 'manual',
    tool: 'fixture',
    model: null,
    externalId: null,
    attemptId: null,
    recoveredFromClosedAttempt: false,
    recoveredFromRejectedAttempt: false,
    requestFingerprint: '2'.repeat(64),
    reusedFrom: null,
    sha256,
    sizeBytes: buffer.length,
    media: {width: 80, height: 50, format: 'png', hasAlpha: true},
    recordedAt: '2026-08-02T00:00:00.000Z',
    request: {},
    compositionBinding: null,
    stateBinding: null,
    stateSheetBinding: null,
    stateSheetRecoveryBinding: null,
    sourceSheetAssetId: null,
    registeredFamilyBinding: null,
    containerPackageBinding: null,
    canonicalContainerBinding: null,
    loopingStripBinding: null,
    semanticBinding: null,
    providerObservation: null,
    familyFingerprint: null,
    lifecycle: {
      status: 'active',
      changedAt: '2026-08-02T00:00:00.000Z',
      reason: 'fixture',
      supersededBy: null,
    },
  };
  const manifest = {schemaVersion: 4, projectSlug: 'fixture', assets: [record]};
  const spec = {
    schemaVersion: 1,
    projectSlug: 'fixture',
    sceneId: 'scene',
    topologyId: 'fixture-topology',
    alphaThreshold: 8,
    minimumComponentPixels: 4,
    sources: [{
      assetId: 'source',
      slices: [
        {
          assetId: 'left-object',
          nodeId: 'left-object',
          semanticRole: 'floor-element',
          output: 'public/projects/fixture/left-object.png',
          components: [{left: 5, top: 8, width: 12, height: 14}],
        },
        {
          assetId: 'remaining-objects',
          nodeId: 'remaining-objects',
          semanticRole: 'submerged-plant',
          output: 'public/projects/fixture/remaining-objects.png',
          components: 'remaining',
        },
      ],
    }],
  };
  return {root, manifest, spec};
};

test('semantic slice derivation preserves the canvas and uniquely assigns alpha components', async () => {
  const {root, manifest, spec} = await fixture();
  assert.deepEqual(validateSemanticSlicesSpec(spec), []);
  const result = await deriveSemanticSlices({
    root,
    manifest,
    spec,
    now: '2026-08-02T00:00:01.000Z',
  });
  assert.equal(result.records.length, 2);
  assert.equal(result.report.providerImageCalls, 0);
  assert.equal(
    result.report.sources[0].sourceAlphaPixels,
    result.report.sources[0].assignedAlphaPixels,
  );
  assert.deepEqual(
    result.records.map(({media}) => [media.width, media.height]),
    [[80, 50], [80, 50]],
  );
  assert.ok(
    result.records.every(
      ({semanticSliceBinding}) =>
        semanticSliceBinding.outputCanvasPreserved &&
        semanticSliceBinding.boundaryCutPixels === 0,
    ),
  );
  assert.equal(
    assertAssetManifest(result.manifest, 'fixture'),
    result.manifest,
  );
});

test('semantic slice derivation rejects stale component geometry', async () => {
  const {root, manifest, spec} = await fixture();
  spec.sources[0].slices[0].components[0].left = 6;
  await assert.rejects(
    deriveSemanticSlices({root, manifest, spec}),
    /alpha 拓扑已变化/,
  );
});
