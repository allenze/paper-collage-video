#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT, fileExists, readJson, writeJson} from './project-lib.mjs';
import {resolvePythonCommand} from './python-runtime.mjs';
import {
  createStateFamilyFingerprint,
  stateOutputName,
  validateStateSheetSpec,
} from './state-sheet-lib.mjs';

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {cwd: ROOT, stdio: 'inherit'});
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? signal}`)));
});

const workspacePath = (input, label) => {
  const resolved = path.resolve(ROOT, input);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`${label}越过工作区：${input}`);
  return resolved;
};

const sha256 = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');

try {
  const [specInput] = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  if (!specInput) throw new Error('用法：process-state-sheet.mjs <state-sheet.json>');
  const specFile = workspacePath(specInput, 'state sheet spec');
  const spec = await readJson(specFile);
  const errors = validateStateSheetSpec(spec);
  if (errors.length) throw new Error(`state sheet 无效：${errors.join('；')}`);

  const input = workspacePath(spec.input, 'state sheet input');
  const outputDirectory = workspacePath(spec.outputDirectory, 'state sheet outputDirectory');
  if (!(await fileExists(input))) throw new Error(`state sheet input 不存在：${spec.input}`);
  const manifestFile = path.join(ROOT, 'projects', spec.projectSlug, 'assets-manifest.json');
  const manifest = await readJson(manifestFile);
  if (manifest.schemaVersion !== 3 || manifest.projectSlug !== spec.projectSlug) throw new Error('assets-manifest.json 与 state sheet 项目不匹配');
  const source = manifest.assets.find(({assetId}) => assetId === spec.sourceAssetId);
  if (!source || path.resolve(ROOT, source.file) !== input) throw new Error('sourceAssetId 必须指向 provider 已登记的 sheet input');
  const sourceBinding = source.stateSheetBinding ?? source.request?.stateSheetBinding;
  if (!sourceBinding || sourceBinding.poseFamilyId !== spec.poseFamilyId || sourceBinding.layout.columns !== spec.layout.columns || sourceBinding.layout.rows !== spec.layout.rows) throw new Error('state sheet spec 必须匹配 source asset 的 stateSheetBinding');
  const sourceStates = sourceBinding.states?.map(({stateId, row, column}) => ({id: stateId, row, column})) ?? [];
  if (JSON.stringify(sourceStates) !== JSON.stringify(spec.states)) throw new Error('state sheet spec 必须覆盖 source asset 的完整有序姿态族，不能只处理或替换单格');
  const recoveryPolicy = sourceBinding.recoveryPolicy;
  if (recoveryPolicy?.strategy !== 'preserve-sheet-context' || recoveryPolicy.localDeterministicFixFirst !== true || recoveryPolicy.isolatedCellGeneration !== 'forbidden' || recoveryPolicy.fallback !== 'full-sheet-regeneration') throw new Error('source state sheet 缺少 preserve-sheet-context 恢复策略');
  const sourceRecovery = source.stateSheetRecoveryBinding ?? source.request?.stateSheetRecoveryBinding ?? null;

  await fs.mkdir(outputDirectory, {recursive: true});
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'paper-collage-state-sheet-'));
  const python = resolvePythonCommand({root: ROOT});
  try {
    await run(python, [
      'scripts/split_sheet.py', input, temporary, spec.poseFamilyId, String(spec.states.length),
      '--columns', String(spec.layout.columns), '--padding', '0', '--suffix', 'registered-key', '--preserve-canvas',
    ]);
    for (const [index, state] of spec.states.entries()) {
      const cell = path.join(temporary, `${spec.poseFamilyId}-${index + 1}-registered-key.png`);
      const output = path.join(outputDirectory, stateOutputName({poseFamilyId: spec.poseFamilyId, stateId: state.id}));
      await run(python, [
        'scripts/remove_chroma_key.py', '--input', cell, '--out', output,
        '--transparent-threshold', '18', '--opaque-threshold', '95', '--edge-feather', '0.6',
        '--key-color', spec.keying.keyColor, '--matte-erode', String(spec.keying.matteErode), '--force',
      ]);
    }
  } finally {
    await fs.rm(temporary, {recursive: true, force: true});
  }

  const sourceSha256 = source.sha256 ?? await sha256(input);
  const members = [];
  for (const state of spec.states) {
    const output = path.join(outputDirectory, stateOutputName({poseFamilyId: spec.poseFamilyId, stateId: state.id}));
    const stat = await fs.stat(output);
    const metadata = await sharp(output).metadata();
    members.push({stateId: state.id, sha256: await sha256(output), file: path.relative(ROOT, output), stat, metadata});
  }
  const dimensions = new Set(members.map(({metadata}) => `${metadata.width}x${metadata.height}`));
  if (dimensions.size !== 1) throw new Error(`注册状态格尺寸不一致：${[...dimensions].join(', ')}`);
  const familyFingerprint = createStateFamilyFingerprint({sourceSha256, spec, members});
  const recordedAt = new Date().toISOString();
  const derived = members.map(({stateId, sha256: memberSha256, file, stat, metadata}) => ({
    assetId: `${spec.poseFamilyId}-${stateId}`,
    capability: 'image',
    file,
    provider: 'local-derivation',
    adapter: 'registered-sheet-cell',
    tool: 'process-state-sheet',
    model: null,
    externalId: null,
    attemptId: source.attemptId ?? null,
    requestFingerprint: createHash('sha256').update(`${source.requestFingerprint}:${stateId}:${familyFingerprint}`).digest('hex'),
    reusedFrom: spec.sourceAssetId,
    sha256: memberSha256,
    sizeBytes: stat.size,
    media: {width: metadata.width, height: metadata.height, format: metadata.format ?? null, hasAlpha: metadata.hasAlpha ?? false},
    recordedAt,
    request: {},
    compositionBinding: {
      sceneId: spec.sceneId,
      nodeId: spec.nodeId,
      pattern: 'state-sequence',
      registrationId: spec.registration.id,
      sourceMasterAssetId: spec.registration.sourceMasterAssetId,
      outputRole: 'registered-state',
      canvas: {width: metadata.width, height: metadata.height},
      derivation: {method: 'crop', parentAssetId: spec.sourceAssetId},
    },
    stateBinding: {poseFamilyId: spec.poseFamilyId, stateId, registrationId: spec.registration.id, sourceMasterAssetId: spec.registration.sourceMasterAssetId},
    stateSheetBinding: null,
    stateSheetRecoveryBinding: sourceRecovery,
    sourceSheetAssetId: spec.sourceAssetId,
    semanticBinding: source.semanticBinding ?? null,
    familyFingerprint,
  }));
  const derivedIds = new Set(derived.map(({assetId}) => assetId));
  manifest.assets = [...manifest.assets.filter(({assetId}) => !derivedIds.has(assetId)), ...derived];
  await writeJson(manifestFile, manifest);
  const providerImageCalls = ['host', 'command'].includes(source.adapter) ? 1 : 0;
  const recoveryTargetCount = sourceRecovery?.targetStateIds?.length ?? derived.length;
  await writeJson(path.join(outputDirectory, `${spec.poseFamilyId}-state-sheet-report.json`), {
    schemaVersion: 2,
    projectSlug: spec.projectSlug,
    poseFamilyId: spec.poseFamilyId,
    sourceAssetId: spec.sourceAssetId,
    sourceSha256,
    familyFingerprint,
    providerImageCalls,
    generationMode: sourceRecovery?.mode ?? 'initial-family-sheet',
    recoverySourceSheetAssetId: sourceRecovery?.sourceSheetAssetId ?? null,
    repairedStateIds: sourceRecovery?.targetStateIds ?? [],
    preservedContextStateCount: sourceRecovery?.mode === 'masked-sheet-edit'
      ? derived.length - recoveryTargetCount
      : 0,
    isolatedCellGenerationUsed: false,
    derivedStateCount: derived.length,
    avoidedIndividualCalls: Math.max(0, (sourceRecovery ? recoveryTargetCount : derived.length) - providerImageCalls),
    members: derived.map(({assetId, file, sha256: hash, stateBinding}) => ({assetId, file, sha256: hash, stateBinding})),
    createdAt: recordedAt,
  });
  console.log(`✓ 完整 sheet 上下文派生 ${derived.length} 个注册状态；独立单格生成：0 次。`);
} catch (error) {
  console.error(`assets:process-state-sheet failed: ${error.message}`);
  process.exitCode = 1;
}
