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
import {
  buildLayerStackProof,
  referenceCellRectForRegisteredSheet,
} from '../scripts/layer-stack-proof-lib.mjs';

const STYLE_REQUEST = {
  styleProfileBinding: {
    schemaVersion: 1,
    id: 'hand-drawn-cutout-explainer',
    catalogVersion: 'fixture',
    profileFingerprint: 'a'.repeat(64),
    directives: ['fixture ink', 'fixture paper', 'Avoid: fixture gloss'],
  },
  quality: {
    requiredChecks: [
      'style-profile-conformant',
      'silhouette-fidelity',
      'negative-space-clean',
      'background-leak-free',
    ],
  },
};

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
        baseImageAttempts: 6,
        layerPackageAttemptReserve: 8,
        maxGeneratedImages: 14,
      },
    ],
  );
});

test('schema-v8 rejects isolated depth members and accepts one complete 2x2 layer sheet request', () => {
  const recoveryPolicy = {
    completeSourceContext: true,
    localDeterministicFixFirst: true,
    isolatedMemberGeneration: 'forbidden',
    providerRepair: 'masked-complete-source-edit',
    fallback: 'full-source-regeneration',
  };
  const request = {
    schemaVersion: 8,
    projectSlug: 'layer-request',
    assetId: 'boat-layer-sheet',
    capability: 'image',
    ...STYLE_REQUEST,
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

test('scene-stacked family proof preserves the authored oversized carrier at envelope extremes', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'scene-carrier-layer-proof-'),
  );
  try {
    const files = new Map();
    for (const [id, svg] of [
      ['rear', '<rect width="160" height="90" fill="#d8c598"/>'],
      ['subject', '<circle cx="80" cy="45" r="18" fill="#8f5f3f"/>'],
      ['front', '<path d="M0 72 Q80 54 160 72 V90 H0 Z" fill="#536f5f"/>'],
    ]) {
      const file = path.join(directory, `${id}.png`);
      await sharp(Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">${svg}</svg>`,
      )).png().toFile(file);
      files.set(id, file);
    }
    const group = {
      id: 'scene-carrier-stack',
      registration: {canvas: {width: 160, height: 90}},
      layerStack: {
        revealEnvelope: {
          '16:9': {x: 0.08, y: 0.06, scale: 0.1, rotationDegrees: 2},
          '9:16': {x: 0.05, y: 0.08, scale: 0.12, rotationDegrees: 2},
          '1:1': {x: 0.06, y: 0.07, scale: 0.11, rotationDegrees: 2},
        },
      },
      children: [
        {id: 'rear', kind: 'asset', slot: 'support-rear', depth: -0.7},
        {id: 'subject', kind: 'asset', slot: 'subject', depth: -0.55},
        {id: 'front', kind: 'asset', slot: 'support-front', depth: 0.9},
      ],
    };
    const viewportProof = await buildLayerStackProof({
      group,
      memberFiles: files,
      referenceFile: files.get('rear'),
      directory: path.join(directory, 'viewport'),
      evidenceId: 'viewport-stack',
    });
    assert.equal(viewportProof.passed, false);

    const sceneCarrierGroup = {
      ...group,
      stackingContext: 'scene',
      transform: {
        x: 0.5,
        y: 0.5,
        width: 3,
        height: 2.5,
        anchorX: 0.5,
        anchorY: 0.5,
      },
    };
    const carrierProof = await buildLayerStackProof({
      group: sceneCarrierGroup,
      memberFiles: files,
      referenceFile: files.get('rear'),
      directory: path.join(directory, 'carrier'),
      evidenceId: 'scene-carrier-stack',
    });
    assert.equal(carrierProof.passed, true);
    assert.equal(carrierProof.artifacts.envelopeExtremes.length, 3);
    assert.ok(
      carrierProof.artifacts.envelopeExtremes.every(
        ({transparentPixels}) => transparentPixels === 0,
      ),
    );
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('registered layer sheet proof resolves the reference cell before comparison', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'layer-sheet-reference-'),
  );
  try {
    const sheet = path.join(directory, 'sheet.png');
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: '#00000000',
      },
    }).composite([
      {
        input: Buffer.from(
          '<svg width="100" height="100"><rect width="100" height="100" fill="#d3b986"/></svg>',
        ),
        left: 0,
        top: 0,
      },
    ]).png().toFile(sheet);
    const record = {
      assetId: 'fixture-sheet',
      request: {
        layerPackageBinding: {
          packageRole: 'registered-sheet',
          sheetLayout: {
            columns: 2,
            rows: 2,
            cells: [
              {packageRole: 'reference', row: 0, column: 0},
              {packageRole: 'support-rear', row: 0, column: 1},
              {packageRole: 'subject', row: 1, column: 0},
              {packageRole: 'support-front', row: 1, column: 1},
            ],
          },
        },
      },
    };
    const referenceRect = await referenceCellRectForRegisteredSheet({
      record,
      file: sheet,
    });
    assert.deepEqual(referenceRect, {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const providerNativeOddSheet = path.join(
      directory,
      'provider-native-odd-sheet.png',
    );
    await sharp({
      create: {
        width: 201,
        height: 203,
        channels: 4,
        background: '#d3b986ff',
      },
    }).png().toFile(providerNativeOddSheet);
    const providerNativeRecord = structuredClone(record);
    providerNativeRecord.request.layerPackageBinding.sheetLayout.providerSource = {
      canvasMode: 'provider-native',
      minimumWidth: 200,
      minimumHeight: 200,
      cellExtraction: 'explicit-rects',
    };
    assert.deepEqual(
      await referenceCellRectForRegisteredSheet({
        record: providerNativeRecord,
        file: providerNativeOddSheet,
      }),
      {
        left: 0,
        top: 0,
        width: 100,
        height: 101,
      },
    );
    await assert.rejects(
      referenceCellRectForRegisteredSheet({
        record,
        file: providerNativeOddSheet,
      }),
      /原生画布无法按 2x2 提取 reference 格位/,
    );
    const memberFiles = new Map();
    for (const [id, color] of [
      ['rear', '#d3b986ff'],
      ['subject', '#8f5f3fff'],
      ['front', '#536f5fff'],
    ]) {
      const file = path.join(directory, `${id}.png`);
      await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: color,
        },
      }).png().toFile(file);
      memberFiles.set(id, file);
    }
    const proof = await buildLayerStackProof({
      group: {
        id: 'fixture-stack',
        registration: {canvas: {width: 100, height: 100}},
        layerStack: {
          revealEnvelope: {
            '16:9': {x: 0, y: 0, scale: 0, rotationDegrees: 0},
            '9:16': {x: 0, y: 0, scale: 0, rotationDegrees: 0},
            '1:1': {x: 0, y: 0, scale: 0, rotationDegrees: 0},
          },
        },
        children: [
          {
            id: 'rear',
            kind: 'asset',
            slot: 'support-rear',
            depth: -0.7,
          },
          {
            id: 'subject',
            kind: 'asset',
            slot: 'subject',
            depth: 0,
          },
          {
            id: 'front',
            kind: 'asset',
            slot: 'support-front',
            depth: 0.7,
          },
        ],
      },
      memberFiles,
      referenceFile: sheet,
      referenceRect,
      directory: path.join(directory, 'evidence'),
      evidenceId: 'fixture-stack',
    });
    assert.equal(proof.passed, true);
    assert.deepEqual(
      await sharp(proof.artifacts.referenceComparison)
        .metadata()
        .then(({width, height}) => ({width, height})),
      {width: 200, height: 100},
    );
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});
