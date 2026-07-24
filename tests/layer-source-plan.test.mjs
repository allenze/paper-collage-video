import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  compileLayerStackPlan,
  sourcePackageDecisionFor,
  summarizeLayerSourcePackages,
  validateLayerCompositionIntent,
} from '../scripts/layer-source-plan-lib.mjs';
import {
  deriveAssetBudget,
} from '../scripts/creative-plan-lib.mjs';
import {validateAssetRequest} from '../scripts/provider-lib.mjs';
import {buildLayerStackProof} from '../scripts/layer-stack-proof-lib.mjs';

const revealEnvelope = {
  '16:9': {x: 0.04, y: 0.03, scale: 0.05, rotationDegrees: 2},
  '9:16': {x: 0.02, y: 0.04, scale: 0.04, rotationDegrees: 1},
  '1:1': {x: 0.03, y: 0.03, scale: 0.04, rotationDegrees: 1.5},
};

const subjectTravelEnvelope = {
  '16:9': {x: 0.58, y: 0.32, scale: 0.3, rotationDegrees: 12},
  '9:16': {x: 0.42, y: 0.4, scale: 0.28, rotationDegrees: 10},
  '1:1': {x: 0.48, y: 0.36, scale: 0.28, rotationDegrees: 10},
};

const layers = [
  {
    id: 'rear',
    role: 'support-rear',
    completeness: 'clean-plate',
    depth: -0.7,
  },
  {
    id: 'boat',
    role: 'subject',
    completeness: 'full-silhouette',
    depth: 0,
  },
  {
    id: 'front',
    role: 'support-front',
    completeness: 'full-overlay',
    depth: 0.65,
  },
];

const validComposition = {
  pattern: 'registered-depth-stack',
  motionCapability: 'bounded-relative',
  sourcePackageId: 'boat-waves-package',
  sourceStrategy: 'registered-layer-sheet',
  layers,
  revealEnvelope,
};

test('bounded relative depth requires complete layers and forbids flat-master extraction', () => {
  const issues = validateLayerCompositionIntent({
    ...validComposition,
    sourceStrategy: 'rigid-master',
  });
  assert.ok(
    issues.some(({code}) => code === 'layer-relative-flat-source'),
  );

  const incomplete = structuredClone(validComposition);
  incomplete.layers[1].completeness = 'visible-fragment';
  assert.ok(
    validateLayerCompositionIntent(incomplete).some(
      ({code}) => code === 'layer-completeness',
    ),
  );
});

test('source package compiler exposes exact calls, derivatives, avoided calls and approval decision', () => {
  assert.deepEqual(validateLayerCompositionIntent(validComposition), []);
  const plan = compileLayerStackPlan({
    sceneId: 'scene-01',
    treatment: {
      id: 'boat-depth',
      targetId: 'boat-stack',
      proofTimeId: 'proof-motion',
      composition: validComposition,
    },
  });
  assert.equal(plan.id, 'boat-waves-package');
  assert.equal(plan.treatmentId, 'boat-depth');
  assert.equal(plan.providerImageCalls, 1);
  assert.equal(plan.localDerivatives, 3);
  assert.equal(plan.avoidedCalls, 3);
  assert.equal(plan.subjectTravelEnvelope, null);
  assert.deepEqual(
    plan.layers.map(({completeness}) => completeness),
    ['clean-plate', 'full-silhouette', 'full-overlay'],
  );

  const generationBudget = summarizeLayerSourcePackages(
    [{compositionPlan: {layerStacks: [plan]}}],
    {poseSheetCalls: 1, hardCeiling: 8},
  );
  assert.equal(generationBudget.requiredProviderImageCalls, 2);
  assert.equal(generationBudget.localDerivatives, 3);
  assert.equal(generationBudget.avoidedCalls, 3);
  assert.deepEqual(
    sourcePackageDecisionFor({generationBudget}),
    {
      requiredProviderImageCalls: 2,
      expectedProviderImageCalls: 2,
      hardCeiling: 8,
      sourcePackagePlans: [plan],
    },
  );
});

test('registered depth stacks compile a separate subject-only large travel envelope', () => {
  const composition = {
    ...validComposition,
    subjectTravelEnvelope,
  };
  assert.deepEqual(validateLayerCompositionIntent(composition), []);
  const plan = compileLayerStackPlan({
    sceneId: 'scene-01',
    treatment: {
      id: 'boat-traverse',
      targetId: 'boat-stack',
      proofTimeId: 'proof-motion',
      composition,
    },
  });
  assert.deepEqual(plan.subjectTravelEnvelope, subjectTravelEnvelope);

  const invalid = structuredClone(composition);
  invalid.subjectTravelEnvelope['16:9'].x = 0.76;
  assert.ok(
    validateLayerCompositionIntent(invalid).some(
      ({code}) => code === 'subject-travel-value',
    ),
  );
});

test('v3 production profiles reserve explicit layer-package attempts without auto-spending them', () => {
  assert.deepEqual(
    [
      deriveAssetBudget('draft', 1),
      deriveAssetBudget('balanced', 1),
      deriveAssetBudget('full-depth', 1),
    ].map(
      ({
        baseImageAttempts,
        layerPackageAttemptReserve,
        maxGeneratedImages,
      }) => ({
        baseImageAttempts,
        layerPackageAttemptReserve,
        maxGeneratedImages,
      }),
    ),
    [
      {
        baseImageAttempts: 4,
        layerPackageAttemptReserve: 2,
        maxGeneratedImages: 6,
      },
      {
        baseImageAttempts: 4,
        layerPackageAttemptReserve: 4,
        maxGeneratedImages: 8,
      },
      {
        baseImageAttempts: 5,
        layerPackageAttemptReserve: 6,
        maxGeneratedImages: 11,
      },
    ],
  );
});

test('schema-v7 rejects isolated depth members and accepts one complete 2x2 layer sheet request', () => {
  const recoveryPolicy = {
    completeSourceContext: true,
    localDeterministicFixFirst: true,
    isolatedMemberGeneration: 'forbidden',
    providerRepair: 'masked-complete-source-edit',
    fallback: 'full-source-regeneration',
  };
  const request = {
    schemaVersion: 7,
    projectSlug: 'layer-request',
    assetId: 'boat-layer-sheet',
    capability: 'image',
    output: 'public/projects/layer-request/boat-layer-sheet.png',
    prompt: 'Reference plus complete rear, subject, and front layers.',
    outputSurface: {mode: 'layer-sheet'},
    compositionBinding: {
      sceneId: 'scene-01',
      nodeId: 'boat-stack',
      pattern: 'registered-depth-stack',
      registrationId: 'boat-registration',
      sourceMasterAssetId: 'boat-reference',
      outputRole: 'registered-layer-sheet',
      canvas: {width: 2048, height: 2048},
      derivation: {
        method: 'provider-generation',
        parentAssetId: 'boat-reference',
      },
    },
    layerPackageBinding: {
      sourcePackageId: 'boat-waves-package',
      pattern: 'registered-depth-stack',
      motionCapability: 'bounded-relative',
      sourceStrategy: 'registered-layer-sheet',
      registrationId: 'boat-registration',
      sourceMasterAssetId: 'boat-reference',
      canvas: {width: 1024, height: 1024},
      packageRole: 'registered-sheet',
      completeness: null,
      memberAssetIds: ['boat-rear', 'boat-subject', 'boat-front'],
      referenceAssetIds: ['boat-reference'],
      sheetLayout: {
        columns: 2,
        rows: 2,
        cells: [
          {packageRole: 'reference', row: 0, column: 0, outputSurface: {mode: 'opaque'}},
          {packageRole: 'support-rear', row: 0, column: 1, outputSurface: {mode: 'opaque'}},
          {packageRole: 'subject', row: 1, column: 0, outputSurface: {mode: 'chroma-key', keyColor: '#ff00ff', tolerance: 24}},
          {packageRole: 'support-front', row: 1, column: 1, outputSurface: {mode: 'chroma-key', keyColor: '#ff00ff', tolerance: 24}},
        ],
      },
      recoveryPolicy,
    },
    semanticBinding: {
      riskClass: 'topology-critical',
      contractIds: ['boat-layer-topology'],
    },
  };
  assert.equal(validateAssetRequest(request), request);
  const providerNative = structuredClone(request);
  providerNative.layerPackageBinding.sheetLayout.providerSource = {
    canvasMode: 'provider-native',
    minimumWidth: 1024,
    minimumHeight: 1024,
    cellExtraction: 'explicit-rects',
  };
  assert.throws(
    () => validateAssetRequest(providerNative),
    /provider-native-observed keyPlane/,
  );
  for (const cell of providerNative.layerPackageBinding.sheetLayout.cells) {
    if (cell.outputSurface.mode === 'chroma-key') {
      cell.outputSurface.keyPlane = {
        mode: 'provider-native-observed',
        policyId: 'flat-v1',
      };
    }
  }
  assert.equal(validateAssetRequest(providerNative), providerNative);

  const isolated = structuredClone(request);
  isolated.assetId = 'boat-subject';
  isolated.compositionBinding.outputRole = 'subject';
  isolated.compositionBinding.canvas = {width: 1024, height: 1024};
  isolated.layerPackageBinding.packageRole = 'subject';
  isolated.layerPackageBinding.completeness = 'full-silhouette';
  isolated.layerPackageBinding.sheetLayout = null;
  assert.throws(
    () => validateAssetRequest(isolated),
    /唯一 provider request 必须生成完整 registered sheet/,
  );
});

test('family-aware proof renders neutral, exploded and three responsive envelope extremes', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'layer-stack-proof-'),
  );
  try {
    const files = new Map();
    const definitions = [
      ['rear', '#e8d7acff'],
      ['boat', '#c65a2eff'],
      ['front', '#247f91ff'],
    ];
    for (const [id, color] of definitions) {
      const file = path.join(directory, `${id}.png`);
      const svg = id === 'rear'
        ? `<rect width="100" height="100" fill="${color}"/>`
        : id === 'boat'
          ? `<ellipse cx="50" cy="50" rx="24" ry="18" fill="${color}"/>`
          : `<path d="M0 72 Q50 54 100 72 V100 H0 Z" fill="${color}"/>`;
      await sharp(Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${svg}</svg>`,
      )).png().toFile(file);
      files.set(id, file);
    }
    const group = {
      id: 'boat-stack',
      registration: {canvas: {width: 100, height: 100}},
      layerStack: {
        revealEnvelope: {
          '16:9': {x: 0.02, y: 0.01, scale: 0.08, rotationDegrees: 0},
          '9:16': {x: 0.01, y: 0.02, scale: 0.08, rotationDegrees: 0},
          '1:1': {x: 0.015, y: 0.015, scale: 0.08, rotationDegrees: 0},
        },
        subjectTravelEnvelope,
      },
      children: [
        {id: 'rear', kind: 'asset', slot: 'support-rear', depth: -0.7},
        {id: 'boat', kind: 'asset', slot: 'subject', depth: 0},
        {id: 'front', kind: 'asset', slot: 'support-front', depth: 0.7},
      ],
    };
    const proof = await buildLayerStackProof({
      group,
      memberFiles: files,
      referenceFile: files.get('rear'),
      directory: path.join(directory, 'evidence'),
      evidenceId: 'boat-stack',
    });
    assert.equal(proof.passed, true);
    assert.equal(proof.artifacts.envelopeExtremes.length, 3);
    assert.equal(proof.artifacts.subjectTravelExtremes.length, 3);
    assert.ok(
      [
        ...proof.artifacts.envelopeExtremes,
        ...proof.artifacts.subjectTravelExtremes,
      ].every(
        ({transparentPixels}) => transparentPixels === 0,
      ),
    );
    for (const file of [
      proof.artifacts.neutralReconstruction,
      proof.artifacts.referenceComparison,
      proof.artifacts.explodedView,
      ...proof.artifacts.envelopeExtremes.map(({file}) => file),
      ...proof.artifacts.subjectTravelExtremes.map(({file}) => file),
    ]) {
      assert.ok((await fs.stat(file)).size > 0);
    }
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});
