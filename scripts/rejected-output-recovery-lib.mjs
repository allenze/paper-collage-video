import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  createAssetRecordId,
  assertAssetManifest,
} from './asset-manifest-lib.mjs';
import {
  generationRequestFingerprint,
  reduceGenerationAttempts,
} from './generation-attempt-lib.mjs';
import {
  assertObservedKeyPlaneSet,
  DEFAULT_OBSERVED_KEY_PLANE_POLICY,
  inspectObservedKeyPlaneFile,
  OBSERVED_KEY_PLANE_MODE,
  OBSERVED_KEY_PLANE_POLICY_ID,
  observedKeyPlanePolicyFingerprint,
  validateObservedKeyPlaneDeclaration,
} from './observed-key-plane-lib.mjs';
import {createRequestFingerprint} from './provider-lib.mjs';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
};

const sha256Value = (value) =>
  createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const sha256File = async (file) =>
  createHash('sha256').update(await fs.readFile(file)).digest('hex');

const workspacePath = (root, input, label) => {
  const resolved = path.resolve(root, input);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label}越过工作区：${input}`);
  }
  return resolved;
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const readLedger = async (file) => {
  const events = (await fs.readFile(file, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {events, sha256: await sha256File(file)};
};

export const validateRejectedOutputRecoverySpec = (spec) => {
  const errors = [];
  if (spec?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  if (!SLUG_PATTERN.test(spec?.projectSlug ?? '')) errors.push('projectSlug 无效');
  if (!spec?.attemptId) errors.push('attemptId 不能为空');
  if (typeof spec?.historicalRequest !== 'string') errors.push('historicalRequest 不能为空');
  if (!SLUG_PATTERN.test(spec?.recoveryAssetId ?? '')) errors.push('recoveryAssetId 无效');
  if (!spec?.reason?.trim()) errors.push('reason 不能为空');
  if (
    typeof spec?.source?.file !== 'string' ||
    !/^[a-f0-9]{64}$/.test(spec?.source?.sha256 ?? '')
  ) {
    errors.push('source 必须声明 file 与 sha256');
  }
  const cells = spec?.cells ?? [];
  const roles = new Set(cells.map(({packageRole}) => packageRole));
  const isStandaloneImage = cells.length === 1 && roles.has('image');
  const isLayerSheet =
    cells.length === 2 &&
    roles.size === 2 &&
    roles.has('subject') &&
    roles.has('support-front');
  if (!isStandaloneImage && !isLayerSheet) {
    errors.push('cells 必须是单个 image，或恰好包含 subject 与 support-front');
  }
  for (const cell of cells) {
    try {
      validateObservedKeyPlaneDeclaration(cell.keyPlane);
    } catch (error) {
      errors.push(`${cell.packageRole ?? 'unknown'} ${error.message}`);
    }
    if (
      !Number.isInteger(cell.sourceRect?.left) ||
      !Number.isInteger(cell.sourceRect?.top) ||
      !Number.isInteger(cell.sourceRect?.width) ||
      !Number.isInteger(cell.sourceRect?.height) ||
      cell.sourceRect.left < 0 ||
      cell.sourceRect.top < 0 ||
      cell.sourceRect.width < 2 ||
      cell.sourceRect.height < 2
    ) {
      errors.push(`${cell.packageRole ?? 'unknown'} sourceRect 无效`);
    }
  }
  if (errors.length) {
    throw new Error(`rejected-output recovery spec 无效：${errors.join('；')}`);
  }
  return spec;
};

export const inspectRejectedOutputRecovery = async ({
  root,
  spec,
  provider,
  now = new Date().toISOString(),
}) => {
  validateRejectedOutputRecoverySpec(spec);
  const projectDirectory = path.join(root, 'projects', spec.projectSlug);
  const ledgerFile = path.join(projectDirectory, 'generation-attempts.jsonl');
  const manifestFile = path.join(projectDirectory, 'assets-manifest.json');
  const historicalRequestFile = workspacePath(
    root,
    spec.historicalRequest,
    'historicalRequest',
  );
  const sourceFile = workspacePath(root, spec.source.file, 'source');
  const [ledger, request, manifestInput, sourceSha256, sourceStat, media] =
    await Promise.all([
      readLedger(ledgerFile),
      readJson(historicalRequestFile),
      readJson(manifestFile),
      sha256File(sourceFile),
      fs.stat(sourceFile),
      sharp(sourceFile).metadata(),
    ]);
  const manifest = assertAssetManifest(
    structuredClone(manifestInput),
    spec.projectSlug,
  );
  const attempt = reduceGenerationAttempts(ledger.events).get(spec.attemptId);
  if (!attempt) throw new Error(`rejected attempt 不存在：${spec.attemptId}`);
  if (attempt.status !== 'rejected' || attempt.quotaConsumed !== true) {
    throw new Error(
      `${spec.attemptId} 必须保持 rejected 且 quotaConsumed=true`,
    );
  }
  if (
    attempt.requestFingerprint !== generationRequestFingerprint(request) ||
    attempt.assetId !== request.assetId ||
    attempt.provider !== provider.id
  ) {
    throw new Error('rejected attempt 与历史 request/provider 指纹不一致');
  }
  if (
    spec.projectSlug !== request.projectSlug ||
    spec.recoveryAssetId !== request.assetId
  ) {
    throw new Error('recovery spec 必须复用历史 request 的 projectSlug/assetId');
  }
  if (
    attempt.output !== spec.source.file ||
    request.output !== spec.source.file
  ) {
    throw new Error('recovery source 路径与 rejected attempt/request 不一致');
  }
  if (sourceSha256 !== spec.source.sha256) {
    throw new Error(
      `recovery source hash 漂移：expected ${spec.source.sha256}, actual ${sourceSha256}`,
    );
  }
  if (attempt.outputSha256 && attempt.outputSha256 !== sourceSha256) {
    throw new Error('recovery source hash 与 rejected ledger 已记录 hash 不一致');
  }
  if (!media.width || !media.height) {
    throw new Error('recovery source 图像尺寸不可读');
  }
  if (
    manifest.assets.some(
      (record) =>
        record.attemptId === spec.attemptId &&
        record.lifecycle?.status === 'recovery-source',
    )
  ) {
    throw new Error(`${spec.attemptId} 已存在 recovery-source 登记`);
  }
  const layoutCells = request.layerPackageBinding?.sheetLayout?.cells ?? [];
  const observations = [];
  for (const recoveryCell of spec.cells) {
    const requestSurface = recoveryCell.packageRole === 'image'
      ? request.outputSurface
      : layoutCells.find(
        ({packageRole}) => packageRole === recoveryCell.packageRole,
      )?.outputSurface;
    if (
      requestSurface?.mode !== 'chroma-key' ||
      !requestSurface.keyColor
    ) {
      throw new Error(
        `${recoveryCell.packageRole} 必须对应历史 request 的 chroma-key 格`,
      );
    }
    if (
      recoveryCell.packageRole === 'image' &&
      (
        recoveryCell.sourceRect.left !== 0 ||
        recoveryCell.sourceRect.top !== 0 ||
        recoveryCell.sourceRect.width !== media.width ||
        recoveryCell.sourceRect.height !== media.height
      )
    ) {
      throw new Error('standalone image recovery 必须观测完整 provider 输出画布');
    }
    const observation = await inspectObservedKeyPlaneFile({
      file: sourceFile,
      rect: recoveryCell.sourceRect,
      requestedKeyColor: requestSurface.keyColor,
    });
    observations.push({
      packageRole: recoveryCell.packageRole,
      ...observation,
    });
  }
  assertObservedKeyPlaneSet({observations});
  const policyFingerprint = observedKeyPlanePolicyFingerprint();
  const providerObservation = {
    schemaVersion: 1,
    mode: OBSERVED_KEY_PLANE_MODE,
    policyId: OBSERVED_KEY_PLANE_POLICY_ID,
    policyFingerprint,
    observationFingerprint: sha256Value({
      policyFingerprint,
      sourceSha256,
      observations,
    }),
    sourceAttempt: {
      attemptId: attempt.attemptId,
      status: attempt.status,
      quotaConsumed: attempt.quotaConsumed,
      requestFingerprint: attempt.requestFingerprint,
      output: attempt.output,
    },
    cells: observations,
  };
  const requestFingerprint = createRequestFingerprint({
    request,
    providerId: provider.id,
    model: attempt.model,
  });
  const record = {
    recordId: createAssetRecordId({
      assetId: spec.recoveryAssetId,
      requestFingerprint,
      sha256: sourceSha256,
      recordedAt: now,
    }),
    assetId: spec.recoveryAssetId,
    capability: 'image',
    file: spec.source.file,
    provider: provider.id,
    adapter: provider.adapter,
    tool: provider.tool ?? null,
    model: attempt.model ?? request.model ?? provider.model ?? null,
    externalId: null,
    attemptId: spec.attemptId,
    recoveredFromClosedAttempt: false,
    recoveredFromRejectedAttempt: true,
    requestFingerprint,
    reusedFrom: null,
    sha256: sourceSha256,
    sizeBytes: sourceStat.size,
    media: {
      width: media.width,
      height: media.height,
      format: media.format ?? null,
      hasAlpha: media.hasAlpha === true,
    },
    recordedAt: now,
    request,
    compositionBinding: request.compositionBinding ?? null,
    stateBinding: request.stateBinding ?? null,
    stateSheetBinding: request.stateSheetBinding ?? null,
    stateSheetRecoveryBinding: request.stateSheetRecoveryBinding ?? null,
    semanticBinding: request.semanticBinding ?? null,
    providerObservation,
    familyFingerprint: null,
    lifecycle: {
      status: 'recovery-source',
      changedAt: now,
      reason: spec.reason,
      supersededBy: null,
    },
  };
  manifest.assets.push(record);
  assertAssetManifest(manifest, spec.projectSlug);
  return {
    ledgerFile,
    ledgerSha256Before: ledger.sha256,
    manifestFile,
    manifest,
    record,
    providerObservation,
    recovery: {
      passed: true,
      providerCalls: 0,
      ledgerMutation: false,
      sourceSha256,
      observedKeyColors: Object.fromEntries(
        observations.map(({packageRole, observedKeyColor}) => [
          packageRole,
          observedKeyColor,
        ]),
      ),
    },
  };
};

export const writeRejectedOutputRecovery = async (result) => {
  await fs.writeFile(
    result.manifestFile,
    `${JSON.stringify(result.manifest, null, 2)}\n`,
    'utf8',
  );
  const ledgerSha256After = await sha256File(result.ledgerFile);
  if (ledgerSha256After !== result.ledgerSha256Before) {
    throw new Error('recovery-source 写入期间 rejected ledger 发生变化');
  }
  return {...result, ledgerSha256After};
};

export const observedRecoveryPolicy = () => ({
  mode: OBSERVED_KEY_PLANE_MODE,
  policyId: OBSERVED_KEY_PLANE_POLICY_ID,
  thresholds: DEFAULT_OBSERVED_KEY_PLANE_POLICY,
  policyFingerprint: observedKeyPlanePolicyFingerprint(),
});
