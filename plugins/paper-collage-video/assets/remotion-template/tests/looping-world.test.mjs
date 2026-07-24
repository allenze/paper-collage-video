import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {validateCompositionStructure} from '../scripts/composition-lib.mjs';
import {
  deriveLoopingStrip,
  LOOPING_STRIP_RECOVERY_POLICY,
} from '../scripts/looping-strip-lib.mjs';
import {validateTreatment} from '../scripts/motion-treatment-lib.mjs';
import {
  inspectWorldStripCoverage,
  resolveWorldStripCopies,
  resolveWorldStripFrame,
  resolveWorldStripSpeedFactor,
  resolveWorldStripTileGeometry,
} from '../src/worldStrip.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const still = {keyframes: [{at: 0, x: 0}, {at: 1, x: 0}]};
const transform = (height = 1) => ({
  x: 0,
  y: 0,
  width: 1,
  height,
  anchorX: 0,
  anchorY: 0,
});

const binding = (id, role, width = 400, height = 100) => ({
  schemaVersion: 1,
  stripId: id,
  role,
  sourceAssetId: `${id}-source`,
  axis: 'x',
  seamStrategy: 'exact',
  source: {
    sha256: 'a'.repeat(64),
    width,
    height,
    provider: 'fixture',
    adapter: 'manual',
    recordId: 'b'.repeat(64),
  },
  canonicalTile: {left: 0, top: 0, width, height},
  output: {width, height, hasAlpha: false},
  minimumViewportSpan: 2,
  edgeBandPixels: 4,
  derivationFingerprint: 'c'.repeat(64),
});

test('world-strip phase wraps deterministically with gap-free internal copies', () => {
  const geometry = resolveWorldStripTileGeometry({
    viewportWidth: 1920,
    viewportHeight: 1080,
    renderHeight: 720,
    sourceWidth: 3840,
    sourceHeight: 720,
    overscanPx: 2,
  });
  assert.equal(geometry.viewportSpan, 2);
  const speed = resolveWorldStripSpeedFactor({depth: 0.5, far: 0.2, near: 1.2});
  assert.equal(speed, 0.95);
  const start = resolveWorldStripFrame({
    progress: 0,
    viewportWidth: 1920,
    tileWidth: geometry.tileWidth,
    direction: 'left',
    distanceViewports: 18,
    speedFactor: speed,
    startPhase: 0.1,
  });
  const end = resolveWorldStripFrame({
    progress: 1,
    viewportWidth: 1920,
    tileWidth: geometry.tileWidth,
    direction: 'left',
    distanceViewports: 18,
    speedFactor: speed,
    startPhase: 0.1,
  });
  assert.ok(end.wraps >= 8);
  assert.ok(end.cameraCompensatedDisplacement < start.cameraCompensatedDisplacement);
  for (let index = 0; index <= 100; index += 1) {
    const frame = resolveWorldStripFrame({
      progress: index / 100,
      viewportWidth: 1920,
      tileWidth: geometry.tileWidth,
      direction: 'left',
      distanceViewports: 18,
      speedFactor: speed,
      startPhase: 0.1,
    });
    const coverage = inspectWorldStripCoverage({
      copies: resolveWorldStripCopies({
        firstCopyX: frame.firstCopyX,
        tileWidth: geometry.tileWidth,
        copyCount: geometry.copyCount,
      }),
      viewportWidth: 1920,
    });
    assert.equal(coverage.uncoveredPixels, 0);
    for (const cameraOffset of [-64, -16, 0, 16, 64]) {
      const cameraFrame = resolveWorldStripFrame({
        progress: index / 100,
        viewportWidth: 1920,
        tileWidth: geometry.tileWidth,
        direction: 'left',
        distanceViewports: 18,
        speedFactor: speed,
        startPhase: 0.1,
        phaseOffsetPx: cameraOffset,
      });
      const cameraCoverage = inspectWorldStripCoverage({
        copies: resolveWorldStripCopies({
          firstCopyX: cameraFrame.firstCopyX,
          tileWidth: geometry.tileWidth,
          copyCount: geometry.copyCount,
        }),
        viewportWidth: 1920,
      });
      assert.equal(cameraCoverage.uncoveredPixels, 0);
    }
  }
});

test('looping-environment validates semantic strips, tracked subject, seam proofs, and monotonic depth speed', () => {
  const strips = [
    {id: 'mountains', role: 'far', depth: -0.8, z: 0},
    {id: 'trees', role: 'mid', depth: -0.1, z: 1},
    {id: 'road', role: 'ground', depth: 0.55, z: 2},
  ].map((strip) => ({
    ...strip,
    kind: 'world-strip',
    src: `${strip.id}.png`,
    loopingStripBinding: binding(strip.id, strip.role),
    transform: transform(),
    motion: still,
  }));
  const composition = {
    coordinateSpace: {width: 200, height: 100},
    nodes: [
      {
        id: 'road-world',
        kind: 'group',
        pattern: 'looping-environment',
        z: 0,
        coordinateSpace: {width: 200, height: 100},
        transform: transform(),
        motion: still,
        loopingEnvironment: {
          axis: 'x',
          groundStripId: 'road',
          trackedSubjectId: 'car',
          seamProofTimeIds: {before: 'before', seam: 'seam', after: 'after'},
          travel: {
            direction: 'left',
            distanceViewports: 8,
            easing: 'linear',
            closedLoop: false,
            startPhase: 0.1,
          },
          speedRange: {far: 0.2, near: 1.2},
          overscanPx: 2,
        },
        children: [
          ...strips,
          {
            id: 'car',
            kind: 'asset',
            assetRole: 'character',
            src: 'car.png',
            z: 4,
            depth: 0.25,
            transform: {x: 0.5, y: 0.72, width: 0.3, height: 0.2, anchorX: 0.5, anchorY: 1},
            motion: still,
          },
        ],
      },
    ],
  };
  const result = validateCompositionStructure({
    composition,
    video: {width: 200, height: 100},
    proofTimes: [
      {id: 'before', at: 0.2, stateAssertions: []},
      {id: 'seam', at: 0.5, stateAssertions: []},
      {id: 'after', at: 0.8, stateAssertions: []},
    ],
  });
  assert.deepEqual(result.issues.filter(({level}) => level === 'error'), []);
  const invalid = structuredClone(composition);
  invalid.nodes[0].children[2].depth = -0.2;
  const invalidResult = validateCompositionStructure({
    composition: invalid,
    video: {width: 200, height: 100},
    proofTimes: [
      {id: 'before', at: 0.2, stateAssertions: []},
      {id: 'seam', at: 0.5, stateAssertions: []},
      {id: 'after', at: 0.8, stateAssertions: []},
    ],
  });
  assert.ok(
    invalidResult.issues.some(({code}) => code === 'composition-looping-depth-order'),
  );
});

test('world-travel authoring compiles only through looping-environment and scroll-world-x', () => {
  const treatment = {
    id: 'road-travel',
    targetId: 'road-world',
    importance: 'hero',
    necessity: 'required',
    changeClass: 'world-travel',
    motion: {kind: 'continuous-transform', preset: 'scroll-world-x'},
    composition: {
      pattern: 'looping-environment',
      world: {
        axis: 'x',
        direction: 'left',
        distanceViewports: 8,
        speedRange: {far: 0.2, near: 1.2},
        groundStripId: 'road',
        trackedSubjectId: 'car',
        seamProofTimeIds: {before: 'proof-before', seam: 'proof-seam', after: 'proof-after'},
        closedLoop: false,
        startPhase: 0.1,
        strips: [
          {id: 'mountains', role: 'far', depth: -0.8},
          {id: 'trees', role: 'mid', depth: -0.1},
          {id: 'road', role: 'ground', depth: 0.55},
        ],
      },
    },
    graphic: null,
    semanticRisk: 'decorative',
    proofTimeId: 'proof-seam',
    rationale: 'The tracked car stays readable while a proved world passes behind it.',
  };
  assert.deepEqual(validateTreatment(treatment, {beatAt: 0.5}), []);
  const wrong = structuredClone(treatment);
  wrong.motion.preset = 'drift';
  assert.ok(
    validateTreatment(wrong, {beatAt: 0.5})
      .some(({code}) => code === 'treatment-looping-preset'),
  );
});

test('looping strip derivation preserves provenance and proves source/render seams at three ratios', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'looping-strip-test-'));
  try {
    const publicDirectory = path.join(root, 'public');
    await fs.mkdir(publicDirectory, {recursive: true});
    const width = 400;
    const height = 100;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const seamX = x >= width - 4 ? x - (width - 4) : x;
        const offset = (y * width + x) * 4;
        pixels[offset] = (seamX * 7 + y * 3) % 255;
        pixels[offset + 1] = (seamX * 11 + 40) % 255;
        pixels[offset + 2] = (y * 5 + 90) % 255;
        pixels[offset + 3] = 255;
      }
    }
    const sourceFile = path.join(publicDirectory, 'source.png');
    await sharp(pixels, {raw: {width, height, channels: 4}}).png().toFile(sourceFile);
    const sourceBytes = await fs.readFile(sourceFile);
    const sourceSha = hash(sourceBytes);
    const sourceRecord = {
      recordId: 'd'.repeat(64),
      assetId: 'mountain-source',
      capability: 'image',
      file: 'public/source.png',
      provider: 'local-fixture',
      adapter: 'manual',
      tool: null,
      model: null,
      externalId: null,
      attemptId: null,
      requestFingerprint: 'e'.repeat(64),
      reusedFrom: null,
      sha256: sourceSha,
      sizeBytes: sourceBytes.length,
      media: {width, height, format: 'png', hasAlpha: true},
      recordedAt: '2026-07-24T00:00:00.000Z',
      request: {},
      compositionBinding: null,
      familyFingerprint: null,
      lifecycle: {
        status: 'active',
        changedAt: '2026-07-24T00:00:00.000Z',
        reason: 'fixture',
        supersededBy: null,
      },
    };
    const manifest = {
      schemaVersion: 4,
      projectSlug: 'looping-test',
      assets: [sourceRecord],
    };
    const spec = {
      schemaVersion: 1,
      projectSlug: 'looping-test',
      sceneId: 'scene-01',
      groupId: 'road-world',
      nodeId: 'mountains',
      stripId: 'mountains',
      assetId: 'mountains-loop',
      role: 'far',
      sourceAssetId: 'mountain-source',
      output: 'public/mountains-loop.png',
      axis: 'x',
      seamStrategy: 'exact',
      canonicalTile: {left: 0, top: 0, width, height},
      edgeBandPixels: 4,
      thresholds: {
        rgbMean: 0,
        rgbMaximum: 0,
        alphaMean: 0,
        alphaMaximum: 0,
      },
      minimumViewportSpan: 2,
      proofViewports: [
        {profile: '16:9', width: 200, height: 100, renderHeight: 100},
        {profile: '9:16', width: 100, height: 200, renderHeight: 100},
        {profile: '1:1', width: 100, height: 100, renderHeight: 100},
      ],
      recoveryPolicy: LOOPING_STRIP_RECOVERY_POLICY,
      applyToProject: false,
    };
    const result = await deriveLoopingStrip({root, spec, manifest});
    assert.equal(result.report.passed, true);
    assert.equal(result.report.providerImageCalls, 0);
    assert.equal(result.report.localDerivatives, 1);
    assert.equal(result.record.adapter, 'looping-strip-derivative');
    assert.equal(result.binding.source.recordId, sourceRecord.recordId);
    assert.equal(result.binding.minimumViewportSpan, 2);
    assert.ok(await fs.stat(path.join(root, result.report.evidence.stitchFile)));
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
});
