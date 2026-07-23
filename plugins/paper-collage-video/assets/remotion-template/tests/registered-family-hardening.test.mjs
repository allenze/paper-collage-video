import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {prepareRegisteredFamilyProof} from '../scripts/asset-hardening-proof-lib.mjs';
import {
  DEFAULT_ALPHA_BAND_THRESHOLDS,
  inspectAlphaBands,
} from '../scripts/alpha-band-lib.mjs';
import {
  REGISTERED_FAMILY_RECOVERY_POLICY,
  applyRegisteredFamilyToProject,
  assertRegisteredFamilyRecords,
  deriveRegisteredFamily,
  sha256File,
  validateRegisteredFamilySpec,
} from '../scripts/registered-family-lib.mjs';

const writeImageRecord = async ({
  root,
  assetId,
  file,
  adapter = 'manual',
  compositionBinding = null,
  extra = {},
  index,
}) => {
  const absolute = path.join(root, file);
  const metadata = await sharp(absolute).metadata();
  return {
    recordId: String(index).padStart(64, '0'),
    assetId,
    capability: 'image',
    file,
    provider: adapter === 'host' ? 'fixture-provider' : 'local',
    adapter,
    tool: 'fixture',
    model: null,
    externalId: null,
    attemptId: null,
    requestFingerprint: String(index + 100).padStart(64, '0'),
    reusedFrom: null,
    sha256: await sha256File(absolute),
    sizeBytes: (await fs.stat(absolute)).size,
    media: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha === true,
    },
    recordedAt: '2026-07-23T00:00:00.000Z',
    request: {},
    compositionBinding,
    lifecycle: {
      status: 'active',
      changedAt: '2026-07-23T00:00:00.000Z',
      reason: 'fixture',
      supersededBy: null,
    },
    ...extra,
  };
};

const writeMask = async ({file, width, height, shape}) => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="transparent"/>${shape}</svg>`,
  );
  await sharp(svg).png().toFile(file);
};

const makeFamilyFixture = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'registered-family-'));
  const publicDirectory = path.join(root, 'public', 'projects', 'family-proof');
  await fs.mkdir(publicDirectory, {recursive: true});
  const canvas = {width: 240, height: 160};
  const masterFile = path.join(publicDirectory, 'master.png');
  await sharp({
    create: {
      ...canvas,
      channels: 4,
      background: {r: 211, g: 185, b: 134, alpha: 1},
    },
  }).png().toFile(masterFile);
  const masks = {
    rear: path.join(publicDirectory, 'mask-rear.png'),
    subject: path.join(publicDirectory, 'mask-subject.png'),
    front: path.join(publicDirectory, 'mask-front.png'),
  };
  await writeMask({
    file: masks.rear,
    ...canvas,
    shape: '<path d="M18 86 H222 V142 H18 Z" fill="white"/>',
  });
  await writeMask({
    file: masks.subject,
    ...canvas,
    shape: '<ellipse cx="120" cy="72" rx="34" ry="58" fill="white"/>',
  });
  await writeMask({
    file: masks.front,
    ...canvas,
    shape: '<path d="M12 116 Q120 86 228 116 V152 H12 Z" fill="white"/>',
  });
  const relative = (file) => path.relative(root, file);
  const registration = {
    id: 'fixture-registration',
    sourceMasterAssetId: 'fixture-master',
    canvas,
    origin: 'top-left',
  };
  const records = [
    await writeImageRecord({
      root,
      assetId: 'fixture-master',
      file: relative(masterFile),
      adapter: 'host',
      compositionBinding: {
        sceneId: 'scene',
        nodeId: 'rig',
        pattern: 'supported-subject',
        registrationId: registration.id,
        sourceMasterAssetId: registration.sourceMasterAssetId,
        outputRole: 'source-master',
        canvas,
        derivation: {method: 'provider-generation', parentAssetId: null},
      },
      index: 1,
    }),
  ];
  for (const [index, [id, file]] of Object.entries(masks).entries()) {
    records.push(await writeImageRecord({
      root,
      assetId: `fixture-mask-${id}`,
      file: relative(file),
      index: index + 2,
    }));
  }
  const manifest = {
    schemaVersion: 4,
    projectSlug: 'family-proof',
    assets: records,
  };
  const members = [
    ['family-rear', 'rear-node', 'support-rear', 'fixture-mask-rear'],
    ['family-subject', 'subject-node', 'subject', 'fixture-mask-subject'],
    ['family-front', 'front-node', 'support-front', 'fixture-mask-front'],
  ].map(([assetId, nodeId, role, maskAssetId]) => ({
    assetId,
    nodeId,
    role,
    slot: role,
    output: `public/projects/family-proof/${assetId}.png`,
    source: {kind: 'source-master', assetId: 'fixture-master'},
    derivation: {
      maskAssetId,
      maskChannel: 'alpha',
      invertMask: false,
    },
  }));
  const spec = {
    schemaVersion: 1,
    projectSlug: 'family-proof',
    sceneId: 'scene',
    groupId: 'rig',
    familyId: 'fixture-family',
    registration,
    members,
    recoveryPolicy: REGISTERED_FAMILY_RECOVERY_POLICY,
    applyToProject: true,
  };
  return {root, manifest, spec, registration};
};

test('registered family derives three deterministic full-canvas members and lifecycle records', async () => {
  const fixture = await makeFamilyFixture();
  try {
    assert.deepEqual(validateRegisteredFamilySpec(fixture.spec), []);
    const first = await deriveRegisteredFamily({
      root: fixture.root,
      spec: fixture.spec,
      manifest: structuredClone(fixture.manifest),
      now: '2026-07-23T01:00:00.000Z',
    });
    assert.equal(first.records.length, 3);
    assert.equal(first.report.providerImageCalls, 1);
    assert.equal(first.report.localDerivatives, 3);
    assert.equal(first.report.avoidedCalls, 2);
    assert.deepEqual(
      first.records.map(({registeredFamilyBinding}) => registeredFamilyBinding.role).sort(),
      ['subject', 'support-front', 'support-rear'],
    );
    assert.ok(first.records.every((record) =>
      record.media.width === fixture.registration.canvas.width &&
      record.media.height === fixture.registration.canvas.height &&
      record.registeredFamilyBinding.registrationId === fixture.registration.id &&
      record.registeredFamilyBinding.sourceMasterAssetId === fixture.registration.sourceMasterAssetId &&
      record.registeredFamilyBinding.derivation.outputCanvasPreserved === true &&
      record.registeredFamilyBinding.derivation.trimmed === false));
    assert.equal(assertRegisteredFamilyRecords({
      records: first.records,
      registration: fixture.registration,
    }).passed, true);

    const project = {
      scenes: [{
        id: 'scene',
        composition: {
          nodes: [{
            id: 'rig',
            kind: 'group',
            pattern: 'supported-subject',
            coordinateSpace: {width: 1, height: 1},
            registration: fixture.registration,
            children: fixture.spec.members.map((member) => ({
              id: member.nodeId,
              kind: 'asset',
              slot: member.slot,
              src: 'unbound.png',
              registrationId: 'unbound',
            })),
          }],
        },
      }],
    };
    applyRegisteredFamilyToProject({
      project,
      spec: fixture.spec,
      records: first.records,
    });
    assert.deepEqual(
      project.scenes[0].composition.nodes[0].children.map(({registrationId}) => registrationId),
      [fixture.registration.id, fixture.registration.id, fixture.registration.id],
    );

    const second = await deriveRegisteredFamily({
      root: fixture.root,
      spec: fixture.spec,
      manifest: first.manifest,
      now: '2026-07-23T02:00:00.000Z',
    });
    assert.equal(second.familyFingerprint, first.familyFingerprint);
    assert.equal(
      second.manifest.assets.filter(({assetId, lifecycle}) =>
        assetId === 'family-subject' && lifecycle.status === 'superseded').length,
      1,
    );
    assert.equal(
      second.manifest.assets.filter(({assetId, lifecycle}) =>
        assetId === 'family-subject' && lifecycle.status === 'active').length,
      1,
    );
  } finally {
    await fs.rm(fixture.root, {recursive: true, force: true});
  }
});

test('registered family rejects a tight independent image disguised as shared registration canvas', async () => {
  const fixture = await makeFamilyFixture();
  try {
    const tightFile = path.join(
      fixture.root,
      'public',
      'projects',
      'family-proof',
      'tight.png',
    );
    await sharp({
      create: {
        width: 48,
        height: 72,
        channels: 4,
        background: '#74513dff',
      },
    }).png().toFile(tightFile);
    fixture.manifest.assets.push(await writeImageRecord({
      root: fixture.root,
      assetId: 'tight-sheet-member',
      file: path.relative(fixture.root, tightFile),
      index: 10,
      extra: {
        stateBinding: {
          poseFamilyId: 'pose-family',
          stateId: 'subject',
          registrationId: fixture.registration.id,
          sourceMasterAssetId: fixture.registration.sourceMasterAssetId,
        },
        sourceSheetAssetId: 'fixture-master',
        familyFingerprint: 'f'.repeat(64),
      },
    }));
    fixture.spec.members[1] = {
      ...fixture.spec.members[1],
      source: {kind: 'registered-sheet-member', assetId: 'tight-sheet-member'},
      derivation: {},
    };
    await assert.rejects(
      () => deriveRegisteredFamily({
        root: fixture.root,
        spec: fixture.spec,
        manifest: fixture.manifest,
      }),
      /非完整画布来源必须显式声明 placement|不能把裁紧图片伪装/,
    );
  } finally {
    await fs.rm(fixture.root, {recursive: true, force: true});
  }
});

test('registered family derives directly from declared cells of a registered sheet', async () => {
  const fixture = await makeFamilyFixture();
  try {
    const sheetFile = path.join(
      fixture.root,
      'public',
      'projects',
      'family-proof',
      'registered-sheet.png',
    );
    await sharp(Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="720" height="160">
        <rect width="720" height="160" fill="transparent"/>
        <path d="M18 92 H222 V148 H18 Z" fill="#795336"/>
        <ellipse cx="360" cy="78" rx="38" ry="68" fill="#b56b49"/>
        <path d="M492 116 Q600 80 708 116 V152 H492 Z" fill="#c1905d"/>
      </svg>
    `)).png().toFile(sheetFile);
    fixture.manifest.assets.push(await writeImageRecord({
      root: fixture.root,
      assetId: 'fixture-registered-sheet',
      file: path.relative(fixture.root, sheetFile),
      index: 11,
      extra: {
        stateSheetBinding: {
          poseFamilyId: 'fixture-family',
          registrationId: fixture.registration.id,
          sourceMasterAssetId: fixture.registration.sourceMasterAssetId,
          layout: {columns: 3, rows: 1},
          states: [
            {stateId: 'rear', row: 0, column: 0},
            {stateId: 'subject', row: 0, column: 1},
            {stateId: 'front', row: 0, column: 2},
          ],
        },
        familyFingerprint: 'e'.repeat(64),
      },
    }));
    fixture.spec.members = fixture.spec.members.map((member, index) => ({
      ...member,
      source: {
        kind: 'registered-sheet',
        assetId: 'fixture-registered-sheet',
        stateId: ['rear', 'subject', 'front'][index],
      },
      derivation: {},
    }));
    const result = await deriveRegisteredFamily({
      root: fixture.root,
      spec: fixture.spec,
      manifest: fixture.manifest,
    });
    assert.equal(result.records.length, 3);
    assert.ok(result.records.every(({registeredFamilyBinding}) =>
      registeredFamilyBinding.source.kind === 'registered-sheet' &&
      registeredFamilyBinding.source.sourceSheetAssetId === 'fixture-registered-sheet'));
  } finally {
    await fs.rm(fixture.root, {recursive: true, force: true});
  }
});

test('registered-family CLI writes manifest provenance and a proof report without manual field repair', async () => {
  const prepared = await prepareRegisteredFamilyProof();
  const slug = `registered-family-cli-${process.pid}`;
  const root = process.cwd();
  const projectDirectory = path.join(root, 'projects', slug);
  const publicDirectory = path.join(root, 'public', 'projects', slug);
  const distDirectory = path.join(root, 'dist', slug);
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    const manifest = structuredClone(prepared.manifest);
    manifest.projectSlug = slug;
    const spec = {
      ...structuredClone(prepared.spec),
      projectSlug: slug,
      familyId: 'cli-family',
      applyToProject: false,
      members: prepared.spec.members.map((member) => ({
        ...member,
        assetId: `cli-${member.role}`,
        output: `public/projects/${slug}/${member.role}.png`,
      })),
    };
    await Promise.all([
      fs.writeFile(
        path.join(projectDirectory, 'project.json'),
        '{}\n',
        'utf8',
      ),
      fs.writeFile(
        path.join(projectDirectory, 'assets-manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      ),
      fs.writeFile(
        path.join(projectDirectory, 'registered-family.json'),
        `${JSON.stringify(spec, null, 2)}\n`,
        'utf8',
      ),
    ]);
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'scripts', 'derive-registered-family.mjs'),
        path.join('projects', slug, 'registered-family.json'),
      ],
      {cwd: root, encoding: 'utf8'},
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /provider image calls 0，avoided calls 3/);
    const updated = JSON.parse(await fs.readFile(
      path.join(projectDirectory, 'assets-manifest.json'),
      'utf8',
    ));
    const active = updated.assets.filter(
      ({assetId, lifecycle}) =>
        assetId.startsWith('cli-') && lifecycle.status === 'active',
    );
    assert.equal(active.length, 3);
    assert.ok(active.every(
      ({registeredFamilyBinding}) =>
        registeredFamilyBinding?.familyId === 'cli-family',
    ));
    const report = JSON.parse(await fs.readFile(
      path.join(distDirectory, 'registered-family', 'cli-family-report.json'),
      'utf8',
    ));
    assert.deepEqual(
      {
        providerImageCalls: report.providerImageCalls,
        localDerivatives: report.localDerivatives,
        avoidedCalls: report.avoidedCalls,
      },
      {providerImageCalls: 0, localDerivatives: 3, avoidedCalls: 3},
    );
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
    await fs.rm(publicDirectory, {recursive: true, force: true});
    await fs.rm(distDirectory, {recursive: true, force: true});
  }
});

const writeAlphaFixture = async ({file, residue = false, extreme = false}) => {
  const width = 240;
  const height = 180;
  const base = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><filter id="shadow"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <ellipse cx="120" cy="98" rx="56" ry="62" fill="#00000030" filter="url(#shadow)"/>
      <path d="M120 26 C82 32 62 70 68 113 C73 147 98 160 120 157 C146 160 171 143 174 108 C177 66 154 32 120 26 Z" fill="#a96f45"/>
      ${residue ? `<rect x="${extreme ? 4 : 48}" y="${extreme ? 4 : 42}" width="${extreme ? 232 : 144}" height="${extreme ? 172 : 116}" fill="none" stroke="#ffffff48" stroke-width="${extreme ? 1 : 2}"/>` : ''}
    </svg>
  `);
  await sharp(base).png().toFile(file);
  return {width, height};
};

test('alpha-band detector distinguishes natural contour/shadow from rectangular residue at both proof scales', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'alpha-band-'));
  try {
    const negativeFile = path.join(root, 'negative.png');
    const positiveFile = path.join(root, 'positive.png');
    const extremeFile = path.join(root, 'extreme.png');
    await writeAlphaFixture({file: negativeFile});
    await writeAlphaFixture({file: positiveFile, residue: true});
    await writeAlphaFixture({file: extremeFile, residue: true, extreme: true});
    const negative = await inspectAlphaBands({
      file: negativeFile,
      renderSize: {width: 120, height: 90},
    });
    const positive = await inspectAlphaBands({
      file: positiveFile,
      renderSize: {width: 120, height: 90},
      derivationRegions: [{
        id: 'fixture-crop',
        kind: 'crop-boundary',
        rect: {left: 48, top: 42, width: 144, height: 116},
      }],
    });
    const extreme = await inspectAlphaBands({
      file: extremeFile,
      renderSize: {width: 96, height: 72},
    });
    assert.equal(negative.passed, true);
    assert.equal(positive.passed, false);
    assert.ok(positive.scales.some(({label}) => label === 'render-scale'));
    assert.ok(positive.failures.some(({diagnostic}) =>
      diagnostic.classification === 'rectangular-alpha-residue' ||
      diagnostic.classification === 'boundary-correlated-alpha-band'));
    assert.equal(extreme.passed, false);
    assert.equal(DEFAULT_ALPHA_BAND_THRESHOLDS.lowAlphaMaximum, 96);
  } finally {
    await fs.rm(root, {recursive: true, force: true});
  }
});
