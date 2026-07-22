import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {createRequestFingerprint, validateAssetRequest} from '../scripts/provider-lib.mjs';
import {resolvePythonCommand} from '../scripts/python-runtime.mjs';
import {
  createStateFamilyFingerprint,
  stateOutputName,
  validateStateSheetSpec,
} from '../scripts/state-sheet-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sheetRequest = () => ({
  schemaVersion: 4,
  projectSlug: 'fixture-project',
  assetId: 'reader-state-sheet',
  capability: 'image',
  output: 'public/projects/fixture-project/assets/reader-state-sheet.png',
  prompt: 'A registered 2x2 pose sheet on a uniform chroma background.',
  compositionBinding: {
    sceneId: 'scene-1',
    nodeId: 'reader',
    pattern: 'state-sequence',
    registrationId: 'reader-registration',
    sourceMasterAssetId: 'reader-master',
    outputRole: 'registered-state-sheet',
    canvas: {width: 2048, height: 2048},
    derivation: {method: 'provider-generation'},
  },
  stateSheetBinding: {
    poseFamilyId: 'reader-poses',
    registrationId: 'reader-registration',
    sourceMasterAssetId: 'reader-master',
    layout: {columns: 2, rows: 2},
    states: [
      {stateId: 'reading', row: 0, column: 0},
      {stateId: 'turning', row: 0, column: 1},
      {stateId: 'pointing', row: 1, column: 0},
      {stateId: 'book-down', row: 1, column: 1},
    ],
    recoveryPolicy: 'regenerate-failed-cell-only',
  },
  semanticBinding: {
    riskClass: 'identity-critical',
    contractIds: ['reader-identity'],
    generationFamily: {
      familyId: 'reader-poses',
      memberIds: ['reading', 'turning', 'pointing', 'book-down'],
      referenceAssetIds: ['reader-master'],
    },
  },
});

test('a single provider request can contractually cover a registered pose sheet', () => {
  const request = sheetRequest();
  assert.equal(validateAssetRequest(request), request);
  const changed = structuredClone(request);
  changed.stateSheetBinding.states[3].column = 0;
  assert.throws(() => validateAssetRequest(changed), /重复或越界/);
  const familyDrift = structuredClone(request);
  familyDrift.semanticBinding.generationFamily.memberIds.pop();
  assert.throws(() => validateAssetRequest(familyDrift), /同一 family 和成员集合/);
  const fingerprint = createRequestFingerprint({request, providerId: 'host-image', model: 'fixture'});
  const changedFingerprint = createRequestFingerprint({request: changed, providerId: 'host-image', model: 'fixture'});
  assert.notEqual(fingerprint, changedFingerprint);
});

test('registered sheet processing preserves row-major cells and produces stable family fingerprints', () => {
  const spec = {
    schemaVersion: 1,
    projectSlug: 'fixture-project',
    sceneId: 'scene-1',
    nodeId: 'reader',
    poseFamilyId: 'reader-poses',
    sourceAssetId: 'reader-state-sheet',
    input: 'public/projects/fixture-project/assets/reader-state-sheet.png',
    outputDirectory: 'public/projects/fixture-project/assets/reader-poses',
    registration: {id: 'reader-registration', sourceMasterAssetId: 'reader-master'},
    layout: {columns: 2, rows: 2},
    states: [
      {id: 'reading', row: 0, column: 0},
      {id: 'turning', row: 0, column: 1},
      {id: 'pointing', row: 1, column: 0},
      {id: 'book-down', row: 1, column: 1},
    ],
    keying: {keyColor: 'auto', matteErode: 1},
  };
  assert.deepEqual(validateStateSheetSpec(spec), []);
  assert.equal(stateOutputName({poseFamilyId: spec.poseFamilyId, stateId: 'book-down'}), 'reader-poses-book-down.png');
  const members = spec.states.map(({id}) => ({stateId: id, sha256: id}));
  const first = createStateFamilyFingerprint({sourceSha256: 'source', spec, members});
  const second = createStateFamilyFingerprint({sourceSha256: 'source', spec, members: [...members].reverse()});
  assert.equal(first, second);
  assert.equal(first, createStateFamilyFingerprint({sourceSha256: 'source', spec, members: members.map((member) => ({...member, stat: {mtimeMs: Date.now()}}))}));
  const invalid = structuredClone(spec);
  invalid.states[2].column = 1;
  assert.ok(validateStateSheetSpec(invalid).length > 0);
});

test('state sheet processor turns one recorded provider image into registered local states', async (context) => {
  const python = resolvePythonCommand({root: ROOT});
  const dependencies = spawnSync(python, ['-c', 'import numpy; from PIL import Image'], {cwd: ROOT});
  if (dependencies.status !== 0) return context.skip('numpy and Pillow are not installed');
  const slug = `state-sheet-e2e-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const publicDirectory = path.join(ROOT, 'public', 'projects', slug);
  const input = path.join(publicDirectory, 'reader-sheet.png');
  const outputDirectory = path.join(publicDirectory, 'states');
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    await fs.mkdir(publicDirectory, {recursive: true});
    const left = await sharp({create: {width: 100, height: 100, channels: 3, background: '#ff00ff'}})
      .composite([{input: Buffer.from('<svg width="100" height="100"><circle cx="50" cy="54" r="28" fill="#3b7d42"/></svg>')}])
      .png().toBuffer();
    const right = await sharp({create: {width: 100, height: 100, channels: 3, background: '#ff00ff'}})
      .composite([{input: Buffer.from('<svg width="100" height="100"><rect x="24" y="24" width="52" height="60" rx="12" fill="#d48a32"/></svg>')}])
      .png().toBuffer();
    await sharp({create: {width: 200, height: 100, channels: 3, background: '#ff00ff'}})
      .composite([{input: left, left: 0, top: 0}, {input: right, left: 100, top: 0}])
      .png().toFile(input);
    const sourceSha256 = createHash('sha256').update(await fs.readFile(input)).digest('hex');
    const binding = {
      poseFamilyId: 'reader-poses', registrationId: 'reader-registration', sourceMasterAssetId: 'reader-master',
      layout: {columns: 2, rows: 1},
      states: [{stateId: 'reading', row: 0, column: 0}, {stateId: 'pointing', row: 0, column: 1}],
      recoveryPolicy: 'regenerate-failed-cell-only',
    };
    await fs.writeFile(path.join(projectDirectory, 'assets-manifest.json'), `${JSON.stringify({
      schemaVersion: 3,
      projectSlug: slug,
      assets: [{
        assetId: 'reader-sheet', capability: 'image', file: path.relative(ROOT, input), provider: 'fixture', adapter: 'host',
        requestFingerprint: 'a'.repeat(64), reusedFrom: null, sha256: sourceSha256, sizeBytes: (await fs.stat(input)).size,
        recordedAt: '2026-01-01T00:00:00.000Z', request: {stateSheetBinding: binding}, compositionBinding: null,
        stateSheetBinding: binding, familyFingerprint: null,
      }],
    }, null, 2)}\n`);
    const specFile = path.join(projectDirectory, 'reader-state-sheet.json');
    await fs.writeFile(specFile, `${JSON.stringify({
      schemaVersion: 1, projectSlug: slug, sceneId: 'scene-1', nodeId: 'reader', poseFamilyId: 'reader-poses',
      sourceAssetId: 'reader-sheet', input: path.relative(ROOT, input), outputDirectory: path.relative(ROOT, outputDirectory),
      registration: {id: 'reader-registration', sourceMasterAssetId: 'reader-master'},
      layout: {columns: 2, rows: 1}, states: [{id: 'reading', row: 0, column: 0}, {id: 'pointing', row: 0, column: 1}],
      keying: {keyColor: '#ff00ff', matteErode: 1},
    }, null, 2)}\n`);
    const processed = spawnSync(process.execPath, ['scripts/process-state-sheet.mjs', path.relative(ROOT, specFile)], {cwd: ROOT, encoding: 'utf8'});
    assert.equal(processed.status, 0, processed.stderr);
    const report = JSON.parse(await fs.readFile(path.join(outputDirectory, 'reader-poses-state-sheet-report.json'), 'utf8'));
    assert.equal(report.providerImageCalls, 1);
    assert.equal(report.derivedStateCount, 2);
    assert.equal(report.avoidedIndividualCalls, 1);
    const dimensions = await Promise.all(['reading', 'pointing'].map(async (stateId) => {
      const metadata = await sharp(path.join(outputDirectory, `reader-poses-${stateId}.png`)).metadata();
      return `${metadata.width}x${metadata.height}:${metadata.hasAlpha}`;
    }));
    assert.deepEqual(dimensions, ['100x100:true', '100x100:true']);
    const manifest = JSON.parse(await fs.readFile(path.join(projectDirectory, 'assets-manifest.json'), 'utf8'));
    assert.equal(manifest.assets.filter(({adapter}) => adapter === 'registered-sheet-cell').length, 2);
    assert.equal(new Set(manifest.assets.filter(({stateBinding}) => stateBinding).map(({familyFingerprint}) => familyFingerprint)).size, 1);
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
    await fs.rm(publicDirectory, {recursive: true, force: true});
  }
});
