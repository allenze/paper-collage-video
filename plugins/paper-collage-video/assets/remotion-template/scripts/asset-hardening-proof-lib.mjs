import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  PHASE2_REGISTERED_FAMILY,
} from '../fixtures/phase2-proof-fixture.mjs';
import {
  alphaBandOverlaySvg,
  inspectAlphaBands,
} from './alpha-band-lib.mjs';
import {buildAssetEvidence} from './asset-evidence-lib.mjs';
import {
  REGISTERED_FAMILY_RECOVERY_POLICY,
  assertRegisteredFamilyRecords,
  deriveRegisteredFamily,
  sha256File,
} from './registered-family-lib.mjs';
import {ROOT, writeJson} from './project-lib.mjs';

export const ASSET_HARDENING_PROOF_DIR = path.join(
  ROOT,
  'dist',
  'vox-phase2-proof',
  'asset-hardening',
);
export const ASSET_HARDENING_PUBLIC_DIR = path.join(
  ROOT,
  'public',
  'fixtures',
  'vox-phase2-proof',
  'registered-family',
);

const fixedAt = '2026-07-23T00:00:00.000Z';

const manualImageRecord = async ({
  assetId,
  file,
  index,
  compositionBinding = null,
}) => {
  const metadata = await sharp(file).metadata();
  const relative = path.relative(ROOT, file);
  return {
    recordId: String(index).padStart(64, '0'),
    assetId,
    capability: 'image',
    file: relative,
    provider: 'local-deterministic-fixture',
    adapter: 'manual',
    tool: 'asset-hardening-proof',
    model: null,
    externalId: null,
    attemptId: null,
    requestFingerprint: String(100 + index).padStart(64, '0'),
    reusedFrom: null,
    sha256: await sha256File(file),
    sizeBytes: (await fs.stat(file)).size,
    media: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format ?? null,
      hasAlpha: metadata.hasAlpha === true,
    },
    recordedAt: fixedAt,
    request: {},
    compositionBinding,
    stateBinding: null,
    stateSheetBinding: null,
    stateSheetRecoveryBinding: null,
    sourceSheetAssetId: null,
    registeredFamilyBinding: null,
    semanticBinding: null,
    familyFingerprint: null,
    lifecycle: {
      status: 'active',
      changedAt: fixedAt,
      reason: 'deterministic-local-proof-fixture',
      supersededBy: null,
    },
  };
};

const writeMask = async ({file, shape}) => {
  const {width, height} = PHASE2_REGISTERED_FAMILY.registration.canvas;
  await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="transparent"/>${shape}</svg>`,
  )).png().toFile(file);
};

const prepareRegisteredSource = async () => {
  await fs.mkdir(ASSET_HARDENING_PUBLIC_DIR, {recursive: true});
  const {width, height} = PHASE2_REGISTERED_FAMILY.registration.canvas;
  const masterFile = path.join(ASSET_HARDENING_PUBLIC_DIR, 'source-master.png');
  const masterSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#00000000"/>
      <path d="M30 186 Q240 128 450 186 L432 284 H48 Z" fill="#94704c"/>
      <path d="M72 222 Q240 174 408 222 L390 274 H90 Z" fill="#c69a62"/>
      <ellipse cx="240" cy="126" rx="52" ry="82" fill="#d85f4b"/>
      <circle cx="240" cy="64" r="38" fill="#e6bb78"/>
      <path d="M184 222 Q240 184 296 222 V266 H184 Z" fill="#6c4931"/>
      <path d="M30 238 Q240 190 450 238 V294 H30 Z" fill="#b98551"/>
    </svg>
  `);
  await sharp(masterSvg).png().toFile(masterFile);
  const masks = {
    'phase2-mask-rear': path.join(ASSET_HARDENING_PUBLIC_DIR, 'mask-rear.png'),
    'phase2-mask-subject': path.join(ASSET_HARDENING_PUBLIC_DIR, 'mask-subject.png'),
    'phase2-mask-front': path.join(ASSET_HARDENING_PUBLIC_DIR, 'mask-front.png'),
  };
  await writeMask({
    file: masks['phase2-mask-rear'],
    shape: '<defs><mask id="rear"><path d="M30 176 Q240 118 450 176 L432 286 H48 Z" fill="white"/><circle cx="240" cy="64" r="42" fill="black"/><ellipse cx="240" cy="145" rx="62" ry="96" fill="black"/><path d="M24 230 Q240 182 456 230 V300 H24 Z" fill="black"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#rear)"/>',
  });
  await writeMask({
    file: masks['phase2-mask-subject'],
    shape: '<defs><mask id="subject"><circle cx="240" cy="64" r="40" fill="white"/><ellipse cx="240" cy="145" rx="58" ry="92" fill="white"/><path d="M24 230 Q240 182 456 230 V300 H24 Z" fill="black"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#subject)"/>',
  });
  await writeMask({
    file: masks['phase2-mask-front'],
    shape: '<path d="M24 230 Q240 182 456 230 V300 H24 Z" fill="white"/>',
  });
  return {masterFile, masks};
};

const createRegisteredFamilySpec = () => ({
  $schema: '../../../../../schemas/registered-family.schema.json',
  schemaVersion: 1,
  projectSlug: 'vox-phase2-proof',
  sceneId: 'phase2-scene-1',
  groupId: PHASE2_REGISTERED_FAMILY.groupId,
  familyId: PHASE2_REGISTERED_FAMILY.familyId,
  registration: PHASE2_REGISTERED_FAMILY.registration,
  members: PHASE2_REGISTERED_FAMILY.members.map((member) => ({
    assetId: member.assetId,
    nodeId: member.nodeId,
    role: member.role,
    slot: member.role,
    output: path.join(
      'public',
      'fixtures',
      'vox-phase2-proof',
      'registered-family',
      path.basename(member.file),
    ),
    source: {
      kind: 'source-master',
      assetId: PHASE2_REGISTERED_FAMILY.registration.sourceMasterAssetId,
    },
    derivation: {
      maskAssetId: member.maskAssetId,
      maskChannel: 'alpha',
      invertMask: false,
    },
  })),
  recoveryPolicy: REGISTERED_FAMILY_RECOVERY_POLICY,
  applyToProject: false,
});

const checkerboard = ({width, height, cell = 24}) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><pattern id="grid" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse">
      <rect width="${cell * 2}" height="${cell * 2}" fill="#f0ece3"/>
      <rect width="${cell}" height="${cell}" fill="#a79d8e"/>
      <rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="#a79d8e"/>
    </pattern></defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
  </svg>
`);

export const prepareRegisteredFamilyProof = async () => {
  const {masterFile, masks} = await prepareRegisteredSource();
  const registration = PHASE2_REGISTERED_FAMILY.registration;
  const sourceBinding = {
    sceneId: 'phase2-scene-1',
    nodeId: PHASE2_REGISTERED_FAMILY.groupId,
    pattern: 'supported-subject',
    registrationId: registration.id,
    sourceMasterAssetId: registration.sourceMasterAssetId,
    outputRole: 'source-master',
    canvas: registration.canvas,
    derivation: {
      method: 'alpha-extraction',
      parentAssetId: registration.sourceMasterAssetId,
    },
  };
  const records = [
    await manualImageRecord({
      assetId: registration.sourceMasterAssetId,
      file: masterFile,
      index: 1,
      compositionBinding: sourceBinding,
    }),
  ];
  let index = 2;
  for (const [assetId, file] of Object.entries(masks)) {
    records.push(await manualImageRecord({assetId, file, index}));
    index += 1;
  }
  const spec = createRegisteredFamilySpec();
  const derived = await deriveRegisteredFamily({
    root: ROOT,
    spec,
    manifest: {
      $schema: '../../schemas/assets-manifest.schema.json',
      schemaVersion: 4,
      projectSlug: 'vox-phase2-proof',
      assets: records,
    },
    now: fixedAt,
  });
  const assertion = assertRegisteredFamilyRecords({
    records: derived.records,
    registration,
  });
  if (!assertion.passed) {
    throw new Error(`registered-family proof 无效：${assertion.errors.join('；')}`);
  }
  const evidenceDirectory = path.join(
    ASSET_HARDENING_PROOF_DIR,
    'registered-family',
    'evidence',
  );
  await fs.mkdir(evidenceDirectory, {recursive: true});
  const assetEvidence = [];
  for (const record of derived.records) {
    assetEvidence.push({
      sceneId: 'phase2-scene-1',
      ...await buildAssetEvidence({
        node: {
          id: record.registeredFamilyBinding.nodeId,
          src: record.file.slice('public/'.length),
        },
        directory: evidenceDirectory,
        evidenceId: record.assetId,
        renderSize: {width: 240, height: 160},
        registeredFamilyBinding: record.registeredFamilyBinding,
      }),
    });
  }
  if (!assetEvidence.every(({alphaBandInspection}) => alphaBandInspection.passed)) {
    throw new Error('registered-family 本地派生产生了异常低 alpha 矩形带');
  }
  const memberFiles = PHASE2_REGISTERED_FAMILY.members.map(
    (member) => path.join(ROOT, 'public', member.file),
  );
  const sampleFile = path.join(
    ASSET_HARDENING_PROOF_DIR,
    'registered-family',
    'proof-sample.png',
  );
  await sharp(checkerboard(registration.canvas))
    .composite(memberFiles.map((input) => ({input})))
    .png()
    .toFile(sampleFile);
  const memberPanels = await Promise.all(memberFiles.map(async (file) => {
    const fullCanvas = await sharp(checkerboard(registration.canvas))
      .composite([{input: file}])
      .png()
      .toBuffer();
    return sharp(fullCanvas).resize(360, 240).png().toBuffer();
  }));
  const contactSheetFile = path.join(
    ASSET_HARDENING_PROOF_DIR,
    'registered-family',
    'member-contact-sheet.png',
  );
  await sharp({
    create: {
      width: 1080,
      height: 240,
      channels: 3,
      background: '#162b35',
    },
  }).composite(memberPanels.map((input, panelIndex) => ({
    input,
    left: panelIndex * 360,
    top: 0,
  }))).png().toFile(contactSheetFile);
  const inputDirectory = path.join(
    ASSET_HARDENING_PROOF_DIR,
    'registered-family',
    'inputs',
  );
  await Promise.all([
    writeJson(path.join(inputDirectory, 'registered-family.json'), spec),
    writeJson(path.join(inputDirectory, 'assets-manifest.json'), derived.manifest),
  ]);
  const proof = {
    ...derived.report,
    passed: true,
    providerImageCalls: 0,
    localDerivatives: 3,
    avoidedCalls: 3,
    assertion,
    runtimeConsumption: {
      pattern: 'supported-subject',
      sceneId: 'phase2-scene-1',
      groupId: PHASE2_REGISTERED_FAMILY.groupId,
      memberNodeIds: PHASE2_REGISTERED_FAMILY.members.map(({nodeId}) => nodeId),
    },
    assetEvidence,
    proofSample: path.relative(ROOT, sampleFile),
    memberContactSheet: path.relative(ROOT, contactSheetFile),
  };
  await writeJson(
    path.join(
      ASSET_HARDENING_PROOF_DIR,
      'registered-family',
      'proof-report.json',
    ),
    proof,
  );
  await writeJson(
    path.join(
      ASSET_HARDENING_PROOF_DIR,
      'registered-family',
      'quality-report.json',
    ),
    {
      schemaVersion: 1,
      passed: assertion.passed &&
        assetEvidence.every(({alphaBandInspection}) => alphaBandInspection.passed),
      checks: [
        {id: 'registered-family-derivation', passed: assertion.passed, errors: assertion.errors},
        {
          id: 'rectangular-alpha-band-free',
          passed: assetEvidence.every(({alphaBandInspection}) => alphaBandInspection.passed),
          members: assetEvidence.map(({nodeId, alphaBandInspection}) => ({
            nodeId,
            passed: alphaBandInspection.passed,
            scales: alphaBandInspection.scales.map(({label}) => label),
          })),
        },
      ],
    },
  );
  return {manifest: derived.manifest, records: derived.records, spec, proof};
};

const alphaFixtureSvg = ({kind, width = 480, height = 320}) => {
  const residue = kind === 'positive'
    ? '<rect x="92" y="58" width="296" height="214" fill="none" stroke="#ffffff48" stroke-width="3"/>'
    : kind === 'extreme'
      ? '<rect x="4" y="4" width="472" height="312" fill="none" stroke="#ffffff38" stroke-width="1"/>'
      : '';
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><filter id="shadow"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <ellipse cx="240" cy="190" rx="106" ry="88" fill="#00000032" filter="url(#shadow)"/>
      <path d="M240 42 C170 48 132 116 142 208 C151 268 202 286 240 280 C286 287 335 254 340 194 C346 108 301 48 240 42 Z" fill="#b87448"/>
      ${residue}
    </svg>
  `);
};

export const prepareAlphaBandProof = async () => {
  const directory = path.join(ASSET_HARDENING_PROOF_DIR, 'alpha-bands');
  await fs.mkdir(directory, {recursive: true});
  const expectations = {
    negative: true,
    positive: false,
    extreme: false,
  };
  const results = [];
  for (const [kind, expectedPassed] of Object.entries(expectations)) {
    const file = path.join(directory, `${kind}.png`);
    await sharp(alphaFixtureSvg({kind})).png().toFile(file);
    const derivationRegions = kind === 'positive'
      ? [{
          id: 'positive-rectangular-derivation',
          kind: 'rectangular-derivation-region',
          rect: {left: 92, top: 58, width: 296, height: 214},
        }]
      : [];
    const inspection = await inspectAlphaBands({
      file,
      renderSize: {width: 240, height: 160},
      derivationRegions,
    });
    const overlay = path.join(directory, `${kind}-diagnostic.png`);
    await sharp(file).composite([{
      input: alphaBandOverlaySvg({
        inspection,
        width: 480,
        height: 320,
      }),
    }]).png().toFile(overlay);
    results.push({
      kind,
      expectedPassed,
      actualPassed: inspection.passed,
      expectationMet: inspection.passed === expectedPassed,
      source: path.relative(ROOT, file),
      diagnostic: path.relative(ROOT, overlay),
      inspection,
    });
  }
  const report = {
    schemaVersion: 1,
    passed: results.every(({expectationMet}) => expectationMet),
    providerCalls: 0,
    requiredHumanEvidence: [
      'checkerboard',
      'tight-crop',
      'motion-stress',
    ],
    keyEdgeSubstitutionAllowed: false,
    results,
  };
  if (!report.passed) {
    throw new Error('alpha-band positive/negative/extreme proof 与预期不符');
  }
  await writeJson(path.join(directory, 'proof-report.json'), report);
  return report;
};
