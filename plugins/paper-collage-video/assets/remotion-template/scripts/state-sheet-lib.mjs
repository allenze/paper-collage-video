import {createHash} from 'node:crypto';

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

const validRect = (rect) =>
  Number.isInteger(rect?.left) && rect.left >= 0 &&
  Number.isInteger(rect?.top) && rect.top >= 0 &&
  Number.isInteger(rect?.width) && rect.width >= 2 &&
  Number.isInteger(rect?.height) && rect.height >= 2;

const rectsOverlap = (left, right) =>
  left.left < right.left + right.width &&
  right.left < left.left + left.width &&
  left.top < right.top + right.height &&
  right.top < left.top + left.height;

export const validateStateSheetSpec = (spec) => {
  const errors = [];
  if (spec?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  for (const field of ['projectSlug', 'sceneId', 'nodeId', 'poseFamilyId', 'sourceAssetId', 'input', 'outputDirectory']) {
    if (!nonEmpty(spec?.[field])) errors.push(`${field} 不能为空`);
  }
  const {columns, rows} = spec?.layout ?? {};
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) errors.push('layout 必须声明正整数 columns/rows');
  if (!nonEmpty(spec?.registration?.id) || !nonEmpty(spec?.registration?.sourceMasterAssetId)) errors.push('registration 不完整');
  if (!Array.isArray(spec?.states) || spec.states.length < 2) errors.push('states 至少需要两个状态');
  const ids = new Set();
  const cells = new Set();
  for (const [index, state] of (spec?.states ?? []).entries()) {
    const expectedRow = Math.floor(index / Math.max(1, columns));
    const expectedColumn = index % Math.max(1, columns);
    if (!nonEmpty(state.id) || ids.has(state.id)) errors.push('state id 缺失或重复');
    if (state.row !== expectedRow || state.column !== expectedColumn) errors.push(`state ${state.id ?? index} 必须按行优先连续排布在 ${expectedRow}:${expectedColumn}`);
    if (state.row >= rows || state.column >= columns) errors.push(`state ${state.id ?? index} 格位越界`);
    const cell = `${state.row}:${state.column}`;
    if (cells.has(cell)) errors.push(`格位 ${cell} 重复`);
    ids.add(state.id);
    cells.add(cell);
  }
  if (spec?.states?.length > columns * rows) errors.push('states 数量超过 sheet 容量');
  if (!nonEmpty(spec?.keying?.keyColor) || !Number.isInteger(spec?.keying?.matteErode) || spec.keying.matteErode < 0 || spec.keying.matteErode > 8) errors.push('keying 无效');
  if (spec?.extraction !== undefined) {
    const extraction = spec.extraction;
    if (extraction?.mode !== 'explicit-source-rects') errors.push('extraction.mode 必须为 explicit-source-rects');
    if (!Number.isInteger(extraction?.canvas?.width) || extraction.canvas.width < 2 || !Number.isInteger(extraction?.canvas?.height) || extraction.canvas.height < 2) {
      errors.push('extraction.canvas 必须声明正整数 width/height');
    }
    if (!Array.isArray(extraction?.cells) || extraction.cells.length !== (spec.states?.length ?? 0)) {
      errors.push('extraction.cells 必须与 states 一一对应');
    } else {
      const stateIds = new Set((spec.states ?? []).map(({id}) => id));
      const extractionIds = new Set();
      for (const cell of extraction.cells) {
        const stateId = cell?.stateId ?? 'unknown';
        const placement = cell?.placement;
        const sourceRect = cell?.sourceRect;
        if (!stateIds.has(cell?.stateId) || extractionIds.has(cell?.stateId)) errors.push(`extraction cell ${stateId} 必须唯一对应一个 state`);
        extractionIds.add(cell?.stateId);
        if (!validRect(sourceRect)) errors.push(`extraction cell ${stateId} sourceRect 无效`);
        if (!Number.isInteger(placement?.left) || placement.left < 0 || !Number.isInteger(placement?.top) || placement.top < 0) {
          errors.push(`extraction cell ${stateId} placement 无效`);
        } else if (
          validRect(sourceRect) &&
          (
            placement.left + sourceRect.width > extraction.canvas?.width ||
            placement.top + sourceRect.height > extraction.canvas?.height
          )
        ) {
          errors.push(`extraction cell ${stateId} 必须完全落在统一注册画布内`);
        }
      }
      for (let index = 0; index < extraction.cells.length; index += 1) {
        for (let other = index + 1; other < extraction.cells.length; other += 1) {
          if (validRect(extraction.cells[index].sourceRect) && validRect(extraction.cells[other].sourceRect) && rectsOverlap(extraction.cells[index].sourceRect, extraction.cells[other].sourceRect)) {
            errors.push('extraction.sourceRect 不得重叠，以免把相邻姿态混入同一派生状态');
          }
        }
      }
    }
  }
  return errors;
};

export const stateOutputName = ({poseFamilyId, stateId}) => `${poseFamilyId}-${stateId}.png`;

export const createStateFamilyFingerprint = ({sourceSha256, spec, members}) =>
  createHash('sha256')
    .update(JSON.stringify({
      sourceSha256,
      poseFamilyId: spec.poseFamilyId,
      registration: spec.registration,
      layout: spec.layout,
      states: spec.states,
      extraction: spec.extraction ?? null,
      keying: spec.keying,
      members: members
        .map(({stateId, sha256, file = null}) => ({stateId, sha256, file}))
        .sort((left, right) => left.stateId.localeCompare(right.stateId)),
    }))
    .digest('hex');

export const summarizeActualPoseSheets = (manifest) => {
  const assets = (manifest?.assets ?? []).filter(({lifecycle}) =>
    !lifecycle || ['active', 'recovery-source'].includes(lifecycle.status));
  const assetsById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const families = new Map();
  for (const asset of assets.filter(({stateBinding, lifecycle}) =>
    Boolean(stateBinding) && lifecycle?.status !== 'recovery-source')) {
    const poseFamilyId = asset.stateBinding.poseFamilyId;
    const family = families.get(poseFamilyId) ?? {
      poseFamilyId,
      stateIds: new Set(),
      sourceAssetIds: new Set(),
    };
    family.stateIds.add(asset.stateBinding.stateId);
    for (const sourceAssetId of [
      asset.sourceSheetAssetId,
      asset.stateSheetRecoveryBinding?.sourceSheetAssetId,
      asset.request?.compositionBinding?.derivation?.parentAssetId,
      asset.compositionBinding?.derivation?.parentAssetId,
    ].filter(Boolean)) family.sourceAssetIds.add(sourceAssetId);
    families.set(poseFamilyId, family);
  }
  const entries = [...families.values()].map((family) => {
    const providerCalls = [...family.sourceAssetIds]
      .map((assetId) => assetsById.get(assetId))
      .filter((asset) => ['host', 'command'].includes(asset?.adapter) && !asset.reusedFrom)
      .length;
    return {
      poseFamilyId: family.poseFamilyId,
      stateIds: [...family.stateIds].sort(),
      sourceAssetIds: [...family.sourceAssetIds].sort(),
      providerCalls,
      deterministicDerivatives: family.stateIds.size,
      providerCallsAvoidedByBatching: providerCalls > 0
        ? Math.max(0, family.stateIds.size - providerCalls)
        : 0,
    };
  }).sort((left, right) => left.poseFamilyId.localeCompare(right.poseFamilyId));
  return {
    families: entries,
    providerCalls: entries.reduce((sum, entry) => sum + entry.providerCalls, 0),
    deterministicDerivatives: entries.reduce((sum, entry) => sum + entry.deterministicDerivatives, 0),
    providerCallsAvoidedByBatching: entries.reduce((sum, entry) => sum + entry.providerCallsAvoidedByBatching, 0),
  };
};
