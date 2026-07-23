import {createHash} from 'node:crypto';

export const ASSET_LIFECYCLE_STATUSES = [
  'active',
  'superseded',
  'rejected',
  'recovery-source',
];

export const createAssetRecordId = ({assetId, requestFingerprint, sha256, recordedAt}) =>
  createHash('sha256')
    .update(JSON.stringify({assetId, requestFingerprint, sha256, recordedAt}))
    .digest('hex');

export const activeManifestAssets = (manifest) =>
  (manifest.assets ?? []).filter(({lifecycle}) => lifecycle?.status === 'active');

export const assertAssetManifest = (manifest, projectSlug) => {
  if (manifest?.schemaVersion !== 4) {
    throw new Error('assets-manifest.json 必须使用 schemaVersion 4；旧项目不会自动迁移。');
  }
  if (manifest.projectSlug !== projectSlug || !Array.isArray(manifest.assets)) {
    throw new Error('assets-manifest.json 与项目不匹配。');
  }
  const recordIds = new Set();
  const activeIds = new Set();
  for (const record of manifest.assets) {
    if (!record.recordId || recordIds.has(record.recordId)) {
      throw new Error(`资产记录 recordId 缺失或重复：${record.assetId ?? 'unknown'}`);
    }
    recordIds.add(record.recordId);
    if (!ASSET_LIFECYCLE_STATUSES.includes(record.lifecycle?.status)) {
      throw new Error(`资产 ${record.assetId} lifecycle.status 无效。`);
    }
    if (record.lifecycle.status === 'active') {
      if (activeIds.has(record.assetId)) throw new Error(`资产 ${record.assetId} 存在多个 active 记录。`);
      activeIds.add(record.assetId);
    }
    if (record.recoveredFromRejectedAttempt === true) {
      if (
        record.lifecycle.status !== 'recovery-source' ||
        record.providerObservation?.sourceAttempt?.status !== 'rejected' ||
        record.providerObservation?.sourceAttempt?.quotaConsumed !== true ||
        record.providerObservation?.sourceAttempt?.attemptId !== record.attemptId ||
        record.reusedFrom !== null
      ) {
        throw new Error(
          `资产 ${record.assetId} 的 rejected-output recovery-source provenance 不完整。`,
        );
      }
    }
  }
  return manifest;
};

export const transitionAssetLifecycle = (manifest, assetId, status, options = {}) => {
  if (!ASSET_LIFECYCLE_STATUSES.includes(status) || status === 'superseded') {
    throw new Error('显式生命周期状态必须是 active、rejected 或 recovery-source。');
  }
  const reason = (options.reason ?? '').trim();
  if (!reason) throw new Error('资产生命周期变更必须记录具体原因。');
  const records = [...(manifest.assets ?? [])].reverse()
    .filter((record) => record.assetId === assetId);
  const current = status === 'active'
    ? records.find((record) => ['rejected', 'recovery-source'].includes(record.lifecycle?.status))
    : records.find((record) => record.lifecycle?.status === 'active');
  if (!current) {
    throw new Error(status === 'active'
      ? `没有可重新激活的 rejected/recovery-source 资产记录：${assetId}`
      : `没有 active 资产记录：${assetId}`);
  }
  if (status === 'active' && records.some((record) => record.lifecycle?.status === 'active')) {
    throw new Error(`资产 ${assetId} 已有 active 记录，不能同时重新激活历史记录。`);
  }
  current.lifecycle = {
    status,
    changedAt: options.at ?? new Date().toISOString(),
    reason,
    supersededBy: null,
  };
  return current;
};
