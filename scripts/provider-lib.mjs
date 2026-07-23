import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  assertAssetManifest,
  createAssetRecordId,
} from './asset-manifest-lib.mjs';
import {ROOT, SLUG_PATTERN, fileExists, probeMedia, readJson, writeJson} from './project-lib.mjs';
import {
  SEMANTIC_RISK_CLASSES,
  assertRequestSemanticContracts,
  requiredChecksForSemanticBinding,
} from './semantic-contract-lib.mjs';
import {
  assertRecoverableGenerationAttempt,
  assertReservedGenerationAttempt,
  closeGenerationAttempt,
  generationAttemptsPath,
  isQuotaConsumingImageRequest,
} from './generation-attempt-lib.mjs';

export const PROVIDER_CAPABILITIES = ['text', 'image', 'voice'];
export const PROVIDER_ADAPTERS = ['host', 'command', 'manual'];
export const PROVIDER_SCOPES = ['project', 'workspace'];
const IMAGE_QUALITY_KINDS = [
  'background',
  'environment',
  'character',
  'prop',
  'decorative',
  'character-sheet',
  'style-sample',
  'mechanism',
  'diagram',
  'image',
];
const IMAGE_QUALITY_CHECKS = [
  'no-text',
  'no-watermark',
  'no-people',
  'safe-area-clear',
  'style-consistent',
  'subject-complete',
  'identity-consistent',
  'identity-distinct-within-frame',
  'identity-family-consistent',
  'cross-scene-identity-continuity',
  'cell-separation',
  'untargeted-cells-unchanged',
  'background-uniform',
  'edge-clean',
  'silhouette-fidelity',
  'negative-space-clean',
  'background-leak-free',
  'mechanism-complete',
  'load-path-readable',
  'physical-plausibility',
  'reference-conformant',
  'diagram-edge-clean',
  'small-text-legible',
  'no-procedural-noise-on-semantic-lines',
];
const PROVIDER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
};

export const createRequestFingerprint = ({request, providerId, model}) => {
  const reusableRequest = {
    capability: request.capability,
    prompt: request.prompt ?? null,
    text: request.text ?? null,
    voiceId: request.voiceId ?? null,
    model: model ?? request.model ?? null,
    settings: request.settings ?? {},
    quality: request.quality ?? null,
    compositionBinding: request.compositionBinding ?? null,
    stateBinding: request.stateBinding ?? null,
    stateSheetBinding: request.stateSheetBinding ?? null,
    stateSheetRecoveryBinding: request.stateSheetRecoveryBinding ?? null,
    layerPackageBinding: request.layerPackageBinding ?? null,
    semanticBinding: request.semanticBinding ?? null,
    timingBinding: request.timingBinding ?? null,
    outputSurface: request.outputSurface ?? null,
    providerId,
  };
  return createHash('sha256')
    .update(JSON.stringify(stableValue(reusableRequest)))
    .digest('hex');
};

export const deepMerge = (base, overlay) => {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const merged = {...base};
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(base[key])
        ? deepMerge(base[key], value)
        : value;
  }
  return merged;
};

const readOptionalJson = async (file) =>
  (await fileExists(file)) ? readJson(file) : null;

export const validateProviderConfig = (config) => {
  const issues = [];
  const add = (level, code, message, location) =>
    issues.push({level, code, message, location});

  if (config?.schemaVersion !== 1) {
    add('error', 'schema-version', 'provider schemaVersion 必须为 1。', 'schemaVersion');
  }
  for (const capability of PROVIDER_CAPABILITIES) {
    const definition = config?.capabilities?.[capability];
    if (!definition) {
      add('error', 'capability-missing', `缺少 ${capability} provider 配置。`, `capabilities.${capability}`);
      continue;
    }
    const providers = definition.providers;
    if (!isPlainObject(providers) || Object.keys(providers).length === 0) {
      add('error', 'providers-empty', `${capability} 至少需要一个 provider。`, `capabilities.${capability}.providers`);
      continue;
    }
    if (!providers[definition.defaultProvider]) {
      add(
        'error',
        'default-provider-missing',
        `${capability} 默认 provider ${definition.defaultProvider ?? '(empty)'} 不存在。`,
        `capabilities.${capability}.defaultProvider`,
      );
    }
    const selection = definition.selection;
    if (selection !== undefined) {
      const location = `capabilities.${capability}.selection`;
      if (
        selection?.status !== 'confirmed' ||
        !selection.provider ||
        typeof selection.confirmedAt !== 'string' ||
        !PROVIDER_SCOPES.includes(selection.scope) ||
        !selection.note
      ) {
        add(
          'error',
          'provider-selection',
          'selection 必须记录 confirmed 状态、provider、时间、scope 和人的决定。',
          location,
        );
      } else if (!providers[selection.provider]) {
        add(
          'error',
          'selected-provider-missing',
          `已确认的 provider 不存在：${selection.provider}。`,
          `${location}.provider`,
        );
      } else if (selection.provider !== definition.defaultProvider) {
        add(
          'error',
          'selected-provider-mismatch',
          `selection.provider ${selection.provider} 与 defaultProvider ${definition.defaultProvider} 不一致。`,
          location,
        );
      }
    }
    for (const [providerId, provider] of Object.entries(providers)) {
      const location = `capabilities.${capability}.providers.${providerId}`;
      const secretFields = Object.keys(provider ?? {}).filter((key) =>
        /api.?key|token|secret|password|authorization/i.test(key),
      );
      if (secretFields.length) {
        add(
          'error',
          'provider-secret',
          `不要在 JSON 保存密钥字段：${secretFields.join(', ')}；请改用 requiredEnv。`,
          location,
        );
      }
      if (!provider?.label || typeof provider.label !== 'string') {
        add('error', 'provider-label', 'provider 必须有 label。', `${location}.label`);
      }
      if (!PROVIDER_ADAPTERS.includes(provider?.adapter)) {
        add('error', 'provider-adapter', `未知 adapter：${provider?.adapter}`, `${location}.adapter`);
      }
      if (
        provider?.requiredEnv !== undefined &&
        (!Array.isArray(provider.requiredEnv) ||
          provider.requiredEnv.some(
            (name) => typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name),
          ))
      ) {
        add('error', 'provider-env', 'requiredEnv 只能包含环境变量名。', `${location}.requiredEnv`);
      }
      if (provider?.invocation !== undefined) {
        const invocation = provider.invocation;
        if (
          !isPlainObject(invocation) ||
          ['providerValue', 'modelValue'].some(
            (key) => invocation[key] !== undefined &&
              (typeof invocation[key] !== 'string' || !invocation[key].trim()),
          ) ||
          (invocation.reportedModelAliases !== undefined &&
            (!Array.isArray(invocation.reportedModelAliases) ||
              invocation.reportedModelAliases.some(
                (alias) => typeof alias !== 'string' || !alias.trim(),
              )))
        ) {
          add(
            'error',
            'provider-invocation',
            'invocation 的 provider/model 映射和 reportedModelAliases 必须是非空字符串。',
            `${location}.invocation`,
          );
        }
      }
      if (provider?.adapter === 'command') {
        if (!provider.command?.executable || !Array.isArray(provider.command?.args)) {
          add(
            'error',
            'provider-command',
            'command adapter 必须配置 command.executable 和 command.args。',
            `${location}.command`,
          );
        }
      }
    }
  }
  return issues;
};

export const loadProviderConfig = async (slug = null) => {
  const files = {
    base: path.join(ROOT, 'providers.json'),
    local: path.join(ROOT, 'providers.local.json'),
    project: slug ? path.join(ROOT, 'projects', slug, 'providers.json') : null,
  };
  const base = await readJson(files.base);
  const local = await readOptionalJson(files.local);
  const project = files.project ? await readOptionalJson(files.project) : null;
  const config = [local, project].filter(Boolean).reduce(deepMerge, base);
  const issues = validateProviderConfig(config);
  return {
    config,
    issues,
    sources: [
      {kind: 'base', file: files.base, loaded: true},
      {kind: 'local', file: files.local, loaded: Boolean(local)},
      ...(files.project
        ? [{kind: 'project', file: files.project, loaded: Boolean(project)}]
        : []),
    ],
  };
};

export const resolveProvider = (config, capability, providerId = 'auto') => {
  if (!PROVIDER_CAPABILITIES.includes(capability)) {
    throw new Error(`未知 provider capability：${capability}`);
  }
  const definition = config.capabilities?.[capability];
  const selectedId = !providerId || providerId === 'auto' ? definition?.defaultProvider : providerId;
  const provider = definition?.providers?.[selectedId];
  if (!provider) {
    throw new Error(`${capability} provider 不存在：${selectedId ?? '(empty)'}`);
  }
  return {...provider, id: selectedId, capability};
};

export const summarizeProviderSelections = (config) =>
  Object.fromEntries(
    PROVIDER_CAPABILITIES.map((capability) => {
      const definition = config.capabilities?.[capability];
      const selection = definition?.selection ?? null;
      const confirmed = Boolean(
        selection?.status === 'confirmed' &&
          selection.provider === definition?.defaultProvider &&
          definition?.providers?.[selection.provider],
      );
      return [
        capability,
        {
          confirmed,
          needsConfirmation: !confirmed,
          selection,
        },
      ];
    }),
  );

export const resolveConfirmedProvider = (
  config,
  capability,
  providerId = 'auto',
) => {
  const selection = summarizeProviderSelections(config)[capability];
  if (!selection?.confirmed) {
    throw new Error(`${capability} provider 尚未获得用户确认。`);
  }
  const provider = resolveProvider(config, capability, providerId);
  if (provider.id !== selection.selection.provider) {
    throw new Error(
      `${capability} provider ${provider.id} 未获授权；用户确认的是 ${selection.selection.provider}。`,
    );
  }
  return provider;
};

export const buildProviderInvocation = ({request, provider, attemptId = null, model = null}) => {
  const actualModel =
    model ?? request.model ?? provider.invocation?.modelValue ?? provider.model ?? null;
  const invocation = {
    adapter: provider.adapter,
    tool: provider.tool ?? null,
    provider: provider.invocation?.providerValue ?? provider.id,
    model: actualModel,
    capability: request.capability,
    prompt: request.prompt ?? null,
    text: request.text ?? null,
    voiceId: request.voiceId ?? null,
    settings: request.settings ?? {},
    outputSurface: request.outputSurface ?? null,
    attemptId,
  };
  return {
    ...invocation,
    fingerprint: createHash('sha256')
      .update(JSON.stringify(stableValue(invocation)))
      .digest('hex'),
  };
};

export const normalizeReportedModel = ({provider, model}) => {
  const aliases = new Set(provider.invocation?.reportedModelAliases ?? []);
  const configured = provider.invocation?.modelValue ?? provider.model ?? null;
  if (!configured) return model ?? null;
  if (!model || model === configured || aliases.has(model)) return configured ?? model ?? null;
  throw new Error(
    `provider 回报的 model ${model} 未映射到已确认配置 ${configured ?? '(none)'}。`,
  );
};

export const assertProviderSelections = (loaded) => {
  assertProviderConfig(loaded);
  const selections = summarizeProviderSelections(loaded.config);
  const missing = Object.entries(selections)
    .filter(([, status]) => !status.confirmed)
    .map(([capability]) => capability);
  if (missing.length) {
    throw new Error(`以下能力尚未获得用户确认：${missing.join(', ')}`);
  }
  return {...loaded, selections};
};

const executableCandidates = (executable) => {
  if (executable.includes('/') || executable.includes('\\')) {
    return [path.isAbsolute(executable) ? executable : path.resolve(ROOT, executable)];
  }
  const suffixes =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')
      : [''];
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) => suffixes.map((suffix) => path.join(directory, `${executable}${suffix}`)));
};

export const findExecutable = async (executable) => {
  for (const candidate of executableCandidates(executable)) {
    try {
      await fs.access(candidate, process.platform === 'win32' ? undefined : 1);
      return candidate;
    } catch {
      // Try the next PATH entry.
    }
  }
  return null;
};

export const inspectProviderReadiness = async (provider) => {
  const missingEnv = (provider.requiredEnv ?? []).filter((name) => !process.env[name]);
  if (provider.adapter === 'host') {
    return {
      status: missingEnv.length ? 'error' : 'agent-check-required',
      message: missingEnv.length
        ? `缺少环境变量：${missingEnv.join(', ')}`
        : provider.toolHint || '需要宿主环境选择并调用对应工具。',
      missingEnv,
    };
  }
  if (provider.adapter === 'manual') {
    return {
      status: missingEnv.length ? 'error' : 'ready',
      message: missingEnv.length
        ? `缺少环境变量：${missingEnv.join(', ')}`
        : provider.toolHint || '可导入本地素材。',
      missingEnv,
    };
  }
  const executable = provider.command?.executable
    ? await findExecutable(provider.command.executable)
    : null;
  const errors = [
    ...(missingEnv.length ? [`缺少环境变量：${missingEnv.join(', ')}`] : []),
    ...(!executable ? [`找不到命令：${provider.command?.executable ?? '(empty)'}`] : []),
  ];
  return {
    status: errors.length ? 'error' : 'ready',
    message: errors.join('；') || `命令适配器可用：${executable}`,
    missingEnv,
    executable,
  };
};

export const assertSelectedProvidersReady = async (slug) => {
  const loaded = assertProviderSelections(await loadProviderConfig(slug));
  for (const capability of PROVIDER_CAPABILITIES) {
    const provider = resolveProvider(loaded.config, capability);
    const readiness = await inspectProviderReadiness(provider);
    if (readiness.status === 'error') {
      throw new Error(`${capability} provider ${provider.id} 不可用：${readiness.message}`);
    }
  }
  return loaded;
};

const selectionTarget = (slug, scope) =>
  scope === 'workspace'
    ? path.join(ROOT, 'providers.local.json')
    : path.join(ROOT, 'projects', slug, 'providers.json');

export const writeProviderSelections = async ({
  slug,
  selections,
  scope = 'project',
  note,
  at = new Date().toISOString(),
}) => {
  if (!SLUG_PATTERN.test(slug ?? '')) throw new Error('项目 slug 格式无效。');
  if (!(await fileExists(path.join(ROOT, 'projects', slug, 'production.json')))) {
    throw new Error(`项目不存在：${slug}；请先运行 project:new。`);
  }
  if (!PROVIDER_SCOPES.includes(scope)) {
    throw new Error(`scope 必须是：${PROVIDER_SCOPES.join(', ')}。`);
  }
  if (!(note ?? '').trim()) throw new Error('provider 选择必须记录人的明确决定。');
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('selections 必须包含至少一个 provider 选择。');
  }
  const capabilities = selections.map(({capability}) => capability);
  if (new Set(capabilities).size !== capabilities.length) {
    throw new Error('同一个 capability 不能在一次确认中重复。');
  }

  const loaded = assertProviderConfig(await loadProviderConfig(slug));
  const target = selectionTarget(slug, scope);
  const overlay = (await fileExists(target))
    ? await readJson(target)
    : {
        $schema:
          scope === 'workspace'
            ? './schemas/providers.schema.json'
            : '../../schemas/providers.schema.json',
        schemaVersion: 1,
      };
  overlay.schemaVersion = 1;
  overlay.capabilities ??= {};
  const projectOverlay =
    scope === 'workspace'
      ? await readOptionalJson(path.join(ROOT, 'projects', slug, 'providers.json'))
      : null;
  let prospectiveConfig = loaded.config;
  const results = [];
  for (const input of selections) {
    const {
      capability,
      providerId,
      label = null,
      adapter = null,
      tool = null,
      model = null,
    } = input;
    if (!PROVIDER_CAPABILITIES.includes(capability)) {
      throw new Error(`capability 必须是：${PROVIDER_CAPABILITIES.join(', ')}。`);
    }
    if (!PROVIDER_ID_PATTERN.test(providerId ?? '')) {
      throw new Error('provider id 只能包含小写字母、数字和单个连字符。');
    }
    const existing =
      prospectiveConfig.capabilities[capability].providers[providerId] ?? null;
    const selectedAdapter = adapter ?? existing?.adapter;
    if (!PROVIDER_ADAPTERS.includes(selectedAdapter)) {
      throw new Error(`新 provider 必须指定 adapter：${PROVIDER_ADAPTERS.join(', ')}。`);
    }
    if (!existing && !label) throw new Error('新 provider 必须指定 label。');
    if (!existing && selectedAdapter === 'command') {
      throw new Error('新的 command provider 请先在 providers.local.json 配置 command，再选择它。');
    }
    const provider = {
      ...(existing ?? {}),
      ...(label ? {label} : {}),
      adapter: selectedAdapter,
      ...(tool ? {tool} : {}),
      ...(model ? {model} : {}),
    };
    if (provider.adapter === 'host' && capability !== 'text' && !provider.tool) {
      throw new Error('host image/voice provider 必须记录已发现的可调用 tool。');
    }
    if (scope === 'workspace') {
      const projectCapability = projectOverlay?.capabilities?.[capability];
      if (projectCapability?.defaultProvider || projectCapability?.selection) {
        throw new Error(
          `${capability} 已有项目级选择；项目配置优先于 workspace。请保留 project scope，或先显式移除该项目覆盖。`,
        );
      }
    }
    const selection = {
      status: 'confirmed',
      provider: providerId,
      confirmedAt: at,
      scope,
      note: (input.note ?? note).trim(),
    };
    overlay.capabilities[capability] ??= {};
    const targetCapability = overlay.capabilities[capability];
    targetCapability.defaultProvider = providerId;
    if (!existing || label || adapter || tool || model) {
      targetCapability.providers ??= {};
      targetCapability.providers[providerId] = provider;
    }
    targetCapability.selection = selection;
    prospectiveConfig = deepMerge(prospectiveConfig, {
      capabilities: {
        [capability]: {
          defaultProvider: providerId,
          providers: {[providerId]: provider},
          selection,
        },
      },
    });
    assertProviderConfig({
      config: prospectiveConfig,
      issues: validateProviderConfig(prospectiveConfig),
    });
    results.push({
      provider: {...provider, id: providerId, capability},
      selection,
    });
  }
  await writeJson(target, overlay);
  return {
    target,
    selections: results,
    loaded: assertProviderConfig(await loadProviderConfig(slug)),
  };
};

export const writeProviderSelection = async (input) => {
  const result = await writeProviderSelections({
    slug: input.slug,
    selections: [input],
    scope: input.scope,
    note: input.note,
    at: input.at,
  });
  return {
    target: result.target,
    provider: result.selections[0].provider,
    selection: result.selections[0].selection,
    loaded: result.loaded,
  };
};

export const assertProviderConfig = (loaded) => {
  const errors = loaded.issues.filter(({level}) => level === 'error');
  if (errors.length) {
    throw new Error(errors.map(({location, message}) => `${location}: ${message}`).join('\n'));
  }
  return loaded;
};

export const resolveWorkspacePath = (input, label = '路径') => {
  if (!input || typeof input !== 'string') throw new Error(`${label}不能为空。`);
  const resolved = path.resolve(ROOT, input);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`${label}越过工作区：${input}`);
  }
  return resolved;
};

const CONTEXT_PRESERVING_RECOVERY_POLICY = {
  strategy: 'preserve-sheet-context',
  localDeterministicFixFirst: true,
  isolatedCellGeneration: 'forbidden',
  fallback: 'full-sheet-regeneration',
};

const sameMembers = (left, right) =>
  Array.isArray(left) &&
  Array.isArray(right) &&
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

const validRecoveryPolicy = (policy) =>
  isPlainObject(policy) &&
  Object.entries(CONTEXT_PRESERVING_RECOVERY_POLICY)
    .every(([key, value]) => policy[key] === value) &&
  Object.keys(policy).length === Object.keys(CONTEXT_PRESERVING_RECOVERY_POLICY).length;

export const inspectStateSheetRecoveryMask = async ({maskFile, stateSheetBinding, recoveryBinding}) => {
  try {
    const mask = await sharp(maskFile).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const {width, height, channels} = mask.info;
    const targeted = new Set(recoveryBinding.targetStateIds);
    const targetCells = new Set(
      stateSheetBinding.states
        .filter(({stateId}) => targeted.has(stateId))
        .map(({row, column}) => `${row}:${column}`),
    );
    let activePixels = 0;
    let activeOutsideTarget = 0;
    for (let y = 0; y < height; y += 1) {
      const row = Math.min(stateSheetBinding.layout.rows - 1, Math.floor(y * stateSheetBinding.layout.rows / height));
      for (let x = 0; x < width; x += 1) {
        const column = Math.min(stateSheetBinding.layout.columns - 1, Math.floor(x * stateSheetBinding.layout.columns / width));
        const offset = (y * width + x) * channels;
        const luminance = (mask.data[offset] + mask.data[offset + 1] + mask.data[offset + 2]) / 3;
        const alpha = mask.data[offset + channels - 1];
        if (alpha <= 16 || luminance <= 127) continue;
        activePixels += 1;
        if (!targetCells.has(`${row}:${column}`)) activeOutsideTarget += 1;
      }
    }
    return {
      passed: activePixels > 0 && activeOutsideTarget === 0,
      activePixels,
      activeOutsideTarget,
      width,
      height,
    };
  } catch (error) {
    return {passed: false, reason: error.message};
  }
};

export const validateAssetRequest = (request) => {
  const errors = [];
  if (request?.schemaVersion !== 7) errors.push('schemaVersion 必须为 7');
  if (!SLUG_PATTERN.test(request?.projectSlug ?? '')) errors.push('projectSlug 格式无效');
  if (!SLUG_PATTERN.test(request?.assetId ?? '')) errors.push('assetId 格式无效');
  if (!PROVIDER_CAPABILITIES.includes(request?.capability)) errors.push('capability 必须是 text、image 或 voice');
  if (!request?.output || typeof request.output !== 'string') errors.push('output 不能为空');
  if (request?.capability === 'text' && !request.prompt) errors.push('text request 缺少 prompt');
  if (request?.capability === 'image' && !request.prompt) errors.push('image request 缺少 prompt');
  if (request?.capability === 'image' && !isPlainObject(request.compositionBinding)) {
    errors.push('image request 缺少 compositionBinding');
  }
  if (request?.capability === 'image' && !isPlainObject(request.semanticBinding)) {
    errors.push('schema-v7 image request 缺少 semanticBinding');
  }
  if (request?.capability === 'image') {
    const surface = request.outputSurface;
    if (!isPlainObject(surface) || !['alpha', 'chroma-key', 'opaque'].includes(surface.mode)) {
      errors.push('schema-v7 image request 缺少有效 outputSurface');
    } else {
      if (
        surface.mode === 'chroma-key' &&
        (typeof surface.keyColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(surface.keyColor))
      ) {
        errors.push('chroma-key outputSurface 必须声明 #RRGGBB keyColor');
      }
      if (
        surface.tolerance !== undefined &&
        (!Number.isInteger(surface.tolerance) || surface.tolerance < 0 || surface.tolerance > 255)
      ) {
        errors.push('outputSurface.tolerance 必须是 0–255 的整数');
      }
    }
  }
  if (request?.capability === 'voice' && !request.text) errors.push('voice request 缺少 text');
  if (request?.timingBinding !== undefined) {
    if (request.capability !== 'voice') errors.push('只有 voice request 可以声明 timingBinding');
    const binding = request.timingBinding;
    if (!isPlainObject(binding) || !binding.sceneId || typeof binding.sceneId !== 'string') {
      errors.push('timingBinding 必须声明 sceneId');
    } else {
      const minimum = binding.minDurationSeconds;
      const maximum = binding.maxDurationSeconds;
      const validBound = (value) => value === undefined || (Number.isFinite(value) && value > 0);
      if (!validBound(minimum) || !validBound(maximum)) {
        errors.push('timingBinding 的时长边界必须是正数');
      }
      if (minimum === undefined && maximum === undefined) {
        errors.push('timingBinding 至少需要 minDurationSeconds 或 maxDurationSeconds');
      }
      if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
        errors.push('timingBinding.minDurationSeconds 不能大于 maxDurationSeconds');
      }
    }
  }
  if (request?.quality !== undefined) {
    if (request.capability !== 'image') {
      errors.push('只有 image request 可以声明 quality');
    }
    if (
      request.quality.kind !== undefined &&
      !IMAGE_QUALITY_KINDS.includes(request.quality.kind)
    ) {
      errors.push('quality.kind 无效');
    }
    if (
      request.quality.requiredChecks !== undefined &&
      (!Array.isArray(request.quality.requiredChecks) ||
        request.quality.requiredChecks.length === 0 ||
        request.quality.requiredChecks.some(
          (check) => !IMAGE_QUALITY_CHECKS.includes(check),
        ))
    ) {
      errors.push('quality.requiredChecks 含未知检查或为空');
    }
  }
  if (request?.compositionBinding !== undefined) {
    if (request.capability !== 'image') errors.push('只有 image request 可以声明 compositionBinding');
    const binding = request.compositionBinding;
    if (!binding.sceneId || !binding.nodeId || !binding.outputRole) errors.push('compositionBinding 缺少 sceneId、nodeId 或 outputRole');
    if (!['free', 'supported-subject', 'registered-environment', 'registered-depth-stack', 'state-sequence'].includes(binding.pattern)) errors.push('compositionBinding.pattern 无效');
    if (!Number.isInteger(binding.canvas?.width) || binding.canvas.width < 1 || !Number.isInteger(binding.canvas?.height) || binding.canvas.height < 1) errors.push('compositionBinding.canvas 无效');
    if (!['provider-generation', 'provider-edit', 'alpha-extraction', 'crop', 'mask-application', 'manual-import'].includes(binding.derivation?.method)) errors.push('compositionBinding.derivation.method 无效');
    if (binding.pattern !== 'state-sequence' && (request.stateBinding || request.stateSheetBinding || request.stateSheetRecoveryBinding)) errors.push('stateBinding/stateSheetBinding/stateSheetRecoveryBinding 只能用于 state-sequence');
    if (['supported-subject', 'registered-environment', 'registered-depth-stack', 'state-sequence'].includes(binding.pattern) && (!binding.registrationId || !binding.sourceMasterAssetId)) errors.push('耦合素材必须声明 registrationId 和 sourceMasterAssetId');
    if (
      binding.pattern === 'registered-depth-stack' &&
      !isPlainObject(request.layerPackageBinding)
    ) {
      errors.push('registered-depth-stack 图像必须声明 layerPackageBinding');
    }
    if (binding.pattern === 'state-sequence') {
      const state = request.stateBinding;
      const sheet = request.stateSheetBinding;
      const recovery = request.stateSheetRecoveryBinding;
      if (Boolean(state) === Boolean(sheet)) errors.push('state-sequence 图像必须且只能声明 stateBinding 或 stateSheetBinding 之一');
      if (state && (!isPlainObject(state) || !state.poseFamilyId || !state.stateId || !state.registrationId || !state.sourceMasterAssetId)) errors.push('stateBinding 不完整');
      const generationFamily = request.semanticBinding?.generationFamily;
      if (!isPlainObject(generationFamily)) errors.push('state-sequence 图像必须声明 semanticBinding.generationFamily');
      if (state && generationFamily && (
        generationFamily.familyId !== state.poseFamilyId ||
        !generationFamily.memberIds?.includes(state.stateId)
      )) errors.push('stateBinding 必须属于 semanticBinding.generationFamily');
      if (state && generationFamily?.memberIds?.length > 1 && ['provider-generation', 'provider-edit'].includes(binding.derivation?.method)) {
        errors.push('多状态姿态族禁止独立单格 provider 生成；请使用完整 stateSheetBinding 或带整表上下文的 stateSheetRecoveryBinding');
      }
      if (state && recovery) errors.push('独立 stateBinding 不得声明 stateSheetRecoveryBinding');
      if (sheet) {
        if (!isPlainObject(sheet) || !sheet.poseFamilyId || !sheet.registrationId || !sheet.sourceMasterAssetId || !Number.isInteger(sheet.layout?.columns) || !Number.isInteger(sheet.layout?.rows) || !Array.isArray(sheet.states) || sheet.states.length < 2 || !validRecoveryPolicy(sheet.recoveryPolicy)) errors.push('stateSheetBinding 必须声明完整的 preserve-sheet-context 恢复策略');
        if (sheet.registrationId !== binding.registrationId || sheet.sourceMasterAssetId !== binding.sourceMasterAssetId) errors.push('stateSheetBinding 必须与 compositionBinding 使用同一注册族');
        const cells = new Set();
        const stateIds = new Set();
        for (const member of sheet.states ?? []) {
          const cell = `${member.row}:${member.column}`;
          if (!member.stateId || stateIds.has(member.stateId) || cells.has(cell) || member.row < 0 || member.row >= sheet.layout.rows || member.column < 0 || member.column >= sheet.layout.columns) errors.push('stateSheetBinding 状态 id/格位重复或越界');
          stateIds.add(member.stateId);
          cells.add(cell);
        }
        if (generationFamily && (
          generationFamily.familyId !== sheet.poseFamilyId ||
          !sameMembers(generationFamily.memberIds, sheet.states.map(({stateId}) => stateId))
        )) errors.push('stateSheetBinding 必须与 semanticBinding.generationFamily 使用同一 family 和成员集合');
        if (recovery) {
          const allStateIds = sheet.states.map(({stateId}) => stateId);
          const targetStateIds = recovery.targetStateIds ?? [];
          if (!isPlainObject(recovery) || !['masked-sheet-edit', 'full-sheet-regeneration'].includes(recovery.mode) || !recovery.sourceSheetAssetId || !Array.isArray(recovery.targetStateIds) || recovery.targetStateIds.length === 0 || new Set(recovery.targetStateIds).size !== recovery.targetStateIds.length || recovery.targetStateIds.some((stateId) => !stateIds.has(stateId))) {
            errors.push('stateSheetRecoveryBinding 模式、来源或目标状态无效');
          }
          if (binding.derivation?.parentAssetId !== recovery.sourceSheetAssetId) errors.push('恢复请求必须把完整原状态表声明为 derivation.parentAssetId');
          if (!generationFamily?.referenceAssetIds?.includes(recovery.sourceSheetAssetId)) errors.push('恢复请求必须把完整原状态表加入 generationFamily.referenceAssetIds');
          const recoveryChecks = request.quality?.requiredChecks ?? [];
          for (const check of ['identity-family-consistent', 'cell-separation', 'reference-conformant']) {
            if (!recoveryChecks.includes(check)) errors.push(`状态表恢复请求必须包含质量检查 ${check}`);
          }
          if (recovery.mode === 'masked-sheet-edit') {
            if (!recovery.maskAssetId || recovery.maskPolarity !== 'white-is-editable' || binding.derivation?.method !== 'provider-edit') errors.push('masked-sheet-edit 必须声明 white-is-editable maskAssetId 并使用 provider-edit');
            if (sameMembers(targetStateIds, allStateIds)) errors.push('所有格都需要重做时必须使用 full-sheet-regeneration');
            if (!recoveryChecks.includes('untargeted-cells-unchanged')) errors.push('masked-sheet-edit 必须检查 untargeted-cells-unchanged');
          }
          if (recovery.mode === 'full-sheet-regeneration') {
            if (binding.derivation?.method !== 'provider-generation') errors.push('full-sheet-regeneration 必须使用 provider-generation');
            if (!sameMembers(targetStateIds, allStateIds)) errors.push('full-sheet-regeneration 必须覆盖姿态族的全部状态');
            if (recovery.maskAssetId || recovery.maskPolarity) errors.push('full-sheet-regeneration 不得声明局部 mask');
          }
        }
      }
    }
  }
  if (request?.layerPackageBinding !== undefined) {
    const binding = request.layerPackageBinding;
    const roleCompleteness = {
      'support-rear': 'clean-plate',
      subject: 'full-silhouette',
      'support-front': 'full-overlay',
    };
    if (request.capability !== 'image' || !isPlainObject(binding)) {
      errors.push('layerPackageBinding 只能用于 image request');
    } else {
      if (
        !SLUG_PATTERN.test(binding.sourcePackageId ?? '') ||
        !['supported-subject', 'registered-depth-stack'].includes(
          binding.pattern,
        ) ||
        binding.motionCapability !== 'bounded-relative' ||
        ![
          'registered-layer-sheet',
          'context-preserving-layer-edits',
        ].includes(binding.sourceStrategy)
      ) {
        errors.push('layerPackageBinding 的 id、pattern、motionCapability 或 sourceStrategy 无效');
      }
      if (
        binding.registrationId !==
          request.compositionBinding?.registrationId ||
        binding.sourceMasterAssetId !==
          request.compositionBinding?.sourceMasterAssetId ||
        binding.pattern !== request.compositionBinding?.pattern
      ) {
        errors.push('layerPackageBinding 必须与 compositionBinding 使用同一 pattern、registration 和 source master');
      }
      const sheetOutput =
        binding.sourceStrategy === 'registered-layer-sheet';
      const expectedCompositionCanvas = sheetOutput
        ? {
            width: binding.canvas?.width * 2,
            height: binding.canvas?.height * 2,
          }
        : binding.canvas;
      if (
        expectedCompositionCanvas?.width !==
          request.compositionBinding?.canvas?.width ||
        expectedCompositionCanvas?.height !==
          request.compositionBinding?.canvas?.height
      ) {
        errors.push(
          sheetOutput
            ? 'registered-layer-sheet 输出画布必须是成员注册画布的 2x2'
            : 'layerPackageBinding.canvas 必须与 compositionBinding.canvas 一致',
        );
      }
      if (
        !Array.isArray(binding.memberAssetIds) ||
        binding.memberAssetIds.length !== 3 ||
        new Set(binding.memberAssetIds).size !== 3 ||
        binding.memberAssetIds.some(
          (assetId) => !SLUG_PATTERN.test(assetId),
        )
      ) {
        errors.push('layerPackageBinding.memberAssetIds 必须恰好列出三个唯一层成员');
      }
      if (
        !Array.isArray(binding.referenceAssetIds) ||
        binding.referenceAssetIds.length === 0 ||
        !binding.referenceAssetIds.includes(
          binding.sourceMasterAssetId,
        )
      ) {
        errors.push('layerPackageBinding.referenceAssetIds 必须包含完整 source master');
      }
      const expectedRecovery = {
        completeSourceContext: true,
        localDeterministicFixFirst: true,
        isolatedMemberGeneration: 'forbidden',
        providerRepair: 'masked-complete-source-edit',
        fallback: 'full-source-regeneration',
      };
      if (
        JSON.stringify(stableValue(binding.recoveryPolicy)) !==
        JSON.stringify(stableValue(expectedRecovery))
      ) {
        errors.push('layerPackageBinding.recoveryPolicy 必须禁止 isolated member generation 并保留完整 source context');
      }
      const layerRole = roleCompleteness[binding.packageRole];
      if (layerRole) {
        if (
          binding.completeness !== layerRole ||
          request.compositionBinding?.outputRole !==
            binding.packageRole ||
          !binding.memberAssetIds.includes(request.assetId)
        ) {
          errors.push('层成员 request 的 role、completeness、outputRole 与 memberAssetIds 必须一致');
        }
      } else if (
        !['reference', 'registered-sheet'].includes(
          binding.packageRole,
        ) ||
        binding.completeness !== null
      ) {
        errors.push('非层成员 packageRole 必须是 reference 或 registered-sheet，且 completeness 为 null');
      }
      if (
        binding.sourceStrategy === 'registered-layer-sheet' &&
        binding.packageRole !== 'registered-sheet'
      ) {
        errors.push('registered-layer-sheet 的唯一 provider request 必须生成完整 registered sheet');
      }
      if (binding.sourceStrategy === 'registered-layer-sheet') {
        const layout = binding.sheetLayout;
        const cells = layout?.cells ?? [];
        const expectedRoles = [
          'reference',
          'support-rear',
          'subject',
          'support-front',
        ];
        if (
          layout?.columns !== 2 ||
          layout?.rows !== 2 ||
          cells.length !== 4 ||
          new Set(cells.map(({packageRole}) => packageRole)).size !== 4 ||
          expectedRoles.some(
            (role) =>
              !cells.some(({packageRole}) => packageRole === role),
          ) ||
          new Set(
            cells.map(({row, column}) => `${row}:${column}`),
          ).size !== 4 ||
          cells.some(
            ({row, column}) =>
              ![0, 1].includes(row) || ![0, 1].includes(column),
          )
        ) {
          errors.push('registered-layer-sheet 必须声明 reference + 三层的完整 2x2 sheetLayout');
        }
      } else if (binding.sheetLayout !== null) {
        errors.push('context-preserving-layer-edits 的 sheetLayout 必须为 null');
      }
      if (
        binding.sourceStrategy ===
        'context-preserving-layer-edits'
      ) {
        if (
          binding.packageRole === 'registered-sheet' ||
          (binding.packageRole === 'reference' &&
            request.compositionBinding?.derivation?.method !==
              'provider-generation') ||
          (layerRole &&
            request.compositionBinding?.derivation?.method !==
              'provider-edit')
        ) {
          errors.push('context-preserving-layer-edits 必须由一张 reference generation 和三个完整上下文 provider edits 组成');
        }
        if (
          layerRole &&
          !binding.referenceAssetIds.includes(
            request.compositionBinding?.derivation?.parentAssetId,
          )
        ) {
          errors.push('分层 provider edit 必须把完整 reference 声明为 derivation.parentAssetId');
        }
      }
    }
  }
  if (request?.semanticBinding !== undefined) {
    if (request.capability !== 'image') errors.push('只有 image request 可以声明 semanticBinding');
    const binding = request.semanticBinding;
    if (!SEMANTIC_RISK_CLASSES.includes(binding.riskClass)) errors.push('semanticBinding.riskClass 无效');
    if (!Array.isArray(binding.contractIds)) errors.push('semanticBinding.contractIds 必须是数组');
    if (binding.riskClass === 'decorative' && binding.contractIds?.length > 0) {
      errors.push('decorative 图像不得绑定关键 semantic contract');
    }
    if (binding.riskClass !== 'decorative' && binding.contractIds?.length === 0) {
      errors.push('高风险图像必须绑定至少一个 semantic contract');
    }
    if (binding.riskClass === 'identity-critical') {
      if (!isPlainObject(binding.generationFamily)) {
        errors.push('identity-critical 必须声明独立的 generationFamily');
      } else if (
        !binding.generationFamily.familyId ||
        !Array.isArray(binding.generationFamily.memberIds) ||
        binding.generationFamily.memberIds.length === 0 ||
        !Array.isArray(binding.generationFamily.referenceAssetIds)
      ) {
        errors.push('generationFamily 必须声明 familyId、memberIds 和 referenceAssetIds');
      }
    }
    const requiredSemanticChecks = requiredChecksForSemanticBinding(binding);
    if (
      request.quality?.requiredChecks &&
      requiredSemanticChecks.some((check) => !request.quality.requiredChecks.includes(check))
    ) {
      errors.push('quality.requiredChecks 不得省略 riskClass 要求的语义检查');
    }
  }
  if (errors.length) throw new Error(`资产请求无效：${errors.join('；')}`);
  return request;
};

export const loadAssetRequest = async (requestInput) => {
  const file = resolveWorkspacePath(requestInput, 'request 路径');
  const request = validateAssetRequest(await readJson(file));
  await assertRequestSemanticContracts(request);
  if (request.layerPackageBinding) {
    const storyboardFile = path.join(
      ROOT,
      'projects',
      request.projectSlug,
      'storyboard.json',
    );
    if (!(await fileExists(storyboardFile))) {
      throw new Error(
        'layer package provider request 缺少已编译 storyboard，不能在规划前调用 provider',
      );
    }
    const storyboard = await readJson(storyboardFile);
    const plan =
      storyboard.directingSummary?.generationBudget?.sourcePackagePlans?.find(
        ({id}) =>
          id === request.layerPackageBinding.sourcePackageId,
      );
    const binding = request.layerPackageBinding;
    if (
      !plan ||
      plan.pattern !== binding.pattern ||
      plan.motionCapability !== binding.motionCapability ||
      plan.sourceStrategy !== binding.sourceStrategy ||
      plan.targetId !== request.compositionBinding.nodeId
    ) {
      throw new Error(
        'layerPackageBinding 必须与当前 storyboard 编译出的 source package 完全一致',
      );
    }
  }
  if (request.stateSheetRecoveryBinding) {
    const manifestFile = path.join(ROOT, 'projects', request.projectSlug, 'assets-manifest.json');
    if (!(await fileExists(manifestFile))) throw new Error('状态表恢复请求缺少 assets-manifest.json，无法证明完整原表上下文');
    const manifest = assertAssetManifest(await readJson(manifestFile), request.projectSlug);
    const source = manifest.assets?.find(({assetId, lifecycle}) =>
      assetId === request.stateSheetRecoveryBinding.sourceSheetAssetId &&
      ['active', 'recovery-source'].includes(lifecycle?.status));
    const sourceBinding = source?.stateSheetBinding ?? source?.request?.stateSheetBinding ?? null;
    if (
      source?.capability !== 'image' ||
      !sourceBinding ||
      !validRecoveryPolicy(sourceBinding.recoveryPolicy) ||
      sourceBinding.poseFamilyId !== request.stateSheetBinding.poseFamilyId ||
      sourceBinding.registrationId !== request.stateSheetBinding.registrationId ||
      sourceBinding.sourceMasterAssetId !== request.stateSheetBinding.sourceMasterAssetId ||
      sourceBinding.layout?.columns !== request.stateSheetBinding.layout.columns ||
      sourceBinding.layout?.rows !== request.stateSheetBinding.layout.rows ||
      !sameMembers(sourceBinding.states?.map(({stateId}) => stateId) ?? [], request.stateSheetBinding.states.map(({stateId}) => stateId))
    ) {
      throw new Error('状态表恢复来源必须是已登记的同一完整姿态族状态表');
    }
    const sourceFile = resolveWorkspacePath(source.file, '状态表恢复来源');
    if (!(await fileExists(sourceFile))) throw new Error('状态表恢复来源文件不存在');
    if (source.assetId === request.assetId || sourceFile === resolveWorkspacePath(request.output, '状态表恢复输出')) throw new Error('状态表恢复必须写入新资产，不能覆盖用于一致性证明的完整原表');
    if (request.stateSheetRecoveryBinding.mode === 'masked-sheet-edit') {
      const mask = manifest.assets?.find(({assetId, lifecycle}) =>
        assetId === request.stateSheetRecoveryBinding.maskAssetId && lifecycle?.status === 'active');
      const maskFile = mask?.file ? resolveWorkspacePath(mask.file, '状态表恢复遮罩') : null;
      if (!maskFile || mask.capability !== 'image' || !(await fileExists(maskFile))) throw new Error('masked-sheet-edit 必须引用已登记且存在的完整画布遮罩');
      const [sourceMetadata, maskMetadata] = await Promise.all([sharp(sourceFile).metadata(), sharp(maskFile).metadata()]);
      if (!sourceMetadata.width || !sourceMetadata.height || sourceMetadata.width !== maskMetadata.width || sourceMetadata.height !== maskMetadata.height) throw new Error('状态表恢复遮罩必须与完整原表尺寸一致');
      const maskInspection = await inspectStateSheetRecoveryMask({maskFile, stateSheetBinding: request.stateSheetBinding, recoveryBinding: request.stateSheetRecoveryBinding});
      if (!maskInspection.passed) throw new Error(`状态表恢复遮罩越过目标格或为空：${JSON.stringify(maskInspection)}`);
    }
  }
  const output = resolveWorkspacePath(request.output, 'output 路径');
  return {file, request, output};
};

export const expandCommandTemplate = (value, context) =>
  String(value).replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, key) =>
    Object.hasOwn(context, key) ? String(context[key] ?? '') : match,
  );

export const makeCommandContext = ({requestFile, request, output}) => ({
  request: requestFile,
  output,
  prompt: request.prompt ?? '',
  text: request.text ?? '',
  voiceId: request.voiceId ?? '',
  model: request.model ?? '',
  settingsJson: JSON.stringify(request.settings ?? {}),
  projectSlug: request.projectSlug,
  projectDir: path.join(ROOT, 'projects', request.projectSlug),
  assetId: request.assetId,
  capability: request.capability,
  workspace: ROOT,
});

export const runProviderCommand = (command, commandArgs, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: options.stdio ?? 'inherit',
      shell: false,
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`provider command 超过 ${options.timeoutSeconds}s`));
    }, options.timeoutSeconds * 1000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });

export const verifyOutputFile = async (file, request = null) => {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size < 1) {
    throw new Error(`provider 未生成有效输出：${path.relative(ROOT, file)}`);
  }
  let metadata = null;
  if (request?.capability === 'image') {
    metadata = await sharp(file).metadata().catch(() => null);
    if (!metadata?.width || !metadata?.height) {
      throw new Error(`provider 图像尺寸不可读：${path.relative(ROOT, file)}`);
    }
    if (request.schemaVersion >= 3) {
      const expected = request.compositionBinding.canvas;
      if (metadata.width !== expected.width || metadata.height !== expected.height) {
        throw new Error(
          `provider 图像尺寸 ${metadata.width}x${metadata.height} 与请求画布 ${expected.width}x${expected.height} 不一致。`,
        );
      }
    }
    const surface = request.outputSurface;
    if (surface?.mode === 'alpha') {
      const pixels = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      const alphaOffset = pixels.info.channels - 1;
      let transparentPixels = 0;
      for (let offset = alphaOffset; offset < pixels.data.length; offset += pixels.info.channels) {
        if (pixels.data[offset] < 250) transparentPixels += 1;
      }
      if (!metadata.hasAlpha || transparentPixels === 0) {
        throw new Error(
          'provider 图像未提供真实透明像素；alpha 输出不能是烘焙棋盘格或全不透明图。',
        );
      }
    } else if (surface?.mode === 'opaque' && metadata.hasAlpha) {
      const pixels = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      const alphaOffset = pixels.info.channels - 1;
      for (let offset = alphaOffset; offset < pixels.data.length; offset += pixels.info.channels) {
        if (pixels.data[offset] !== 255) {
          throw new Error('provider 图像声明 opaque，但输出含透明或半透明像素。');
        }
      }
    } else if (surface?.mode === 'chroma-key') {
      const pixels = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
      const rgb = surface.keyColor.slice(1).match(/.{2}/g).map((part) => Number.parseInt(part, 16));
      const tolerance = surface.tolerance ?? 24;
      const {width, height, channels} = pixels.info;
      const boundary = [];
      for (let x = 0; x < width; x += 1) {
        boundary.push([x, 0], [x, height - 1]);
      }
      for (let y = 1; y < height - 1; y += 1) {
        boundary.push([0, y], [width - 1, y]);
      }
      const matches = boundary.filter(([x, y]) => {
        const offset = (y * width + x) * channels;
        return rgb.every((value, channel) =>
          Math.abs(pixels.data[offset + channel] - value) <= tolerance);
      }).length;
      if (matches / boundary.length < 0.8) {
        throw new Error(
          `provider 图像边界未形成可靠色键面：仅 ${matches}/${boundary.length} 像素匹配 ${surface.keyColor}。`,
        );
      }
    }
  } else if (request?.capability === 'voice') {
    const probe = await probeMedia(file).catch(() => null);
    const audio = probe?.streams?.find(({codec_type: type}) => type === 'audio');
    const durationSeconds = Number(probe?.format?.duration ?? 0);
    if (!audio || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`provider 语音媒体不可读：${path.relative(ROOT, file)}`);
    }
    const minimum = request.timingBinding?.minDurationSeconds;
    const maximum = request.timingBinding?.maxDurationSeconds;
    if (Number.isFinite(minimum) && durationSeconds < minimum) {
      throw new Error(
        `provider 语音 ${durationSeconds.toFixed(3)}s 短于 ${request.timingBinding.sceneId} 允许的最短 ${minimum}s；请补充文案或调整语速后重新生成。`,
      );
    }
    if (Number.isFinite(maximum) && durationSeconds > maximum) {
      throw new Error(
        `provider 语音 ${durationSeconds.toFixed(3)}s 超过 ${request.timingBinding.sceneId} 允许的最长 ${maximum}s；请压缩文案或提高语速后重新生成。`,
      );
    }
    metadata = {
      durationSeconds,
      codec: audio.codec_name ?? null,
      sampleRate: Number(audio.sample_rate ?? 0) || null,
      channels: audio.channels ?? null,
    };
  }
  return {stat, metadata};
};

export const recordAssetProvenance = async ({
  request,
  output,
  provider,
  model = null,
  externalId = null,
  reusedFrom = null,
  attemptId = null,
  recoverClosedAttempt = false,
}) => {
  const trackedAttempt =
    request.schemaVersion >= 3 &&
    isQuotaConsumingImageRequest(request) &&
    !reusedFrom;
  if (trackedAttempt && !recoverClosedAttempt) {
    await assertReservedGenerationAttempt({request, provider, attemptId});
  }
  let stat;
  let metadata;
  let sha256;
  try {
    ({stat, metadata} = await verifyOutputFile(output, request));
    sha256 = createHash('sha256').update(await fs.readFile(output)).digest('hex');
  } catch (error) {
    if (trackedAttempt && !recoverClosedAttempt) {
      await closeGenerationAttempt({
        slug: request.projectSlug,
        attemptId,
        status: 'rejected',
        quotaConsumed: true,
        output: path.relative(ROOT, output),
        note: error.message,
      });
    }
    throw error;
  }
  const manifestFile = path.join(ROOT, 'projects', request.projectSlug, 'assets-manifest.json');
  let record;
  try {
    const manifest = (await fileExists(manifestFile))
      ? await readJson(manifestFile)
      : {
          $schema: '../../schemas/assets-manifest.schema.json',
          schemaVersion: 4,
          projectSlug: request.projectSlug,
          assets: [],
        };
    assertAssetManifest(manifest, request.projectSlug);
    if (
      recoverClosedAttempt &&
      manifest.assets.some((asset) => asset.attemptId === attemptId)
    ) {
      throw new Error(`生成尝试 ${attemptId} 已经存在资产登记，不能重复恢复。`);
    }
    if (recoverClosedAttempt) {
      await assertRecoverableGenerationAttempt({
        request,
        provider,
        attemptId,
        output: path.relative(ROOT, output),
        outputSha256: sha256,
      });
    }
    const actualModel = model || request.model || provider.model || null;
    const recordedAt = new Date().toISOString();
    const requestFingerprint = createRequestFingerprint({
      request,
      providerId: provider.id,
      model: actualModel,
    });
    record = {
      recordId: createAssetRecordId({
        assetId: request.assetId,
        requestFingerprint,
        sha256,
        recordedAt,
      }),
      assetId: request.assetId,
      capability: request.capability,
      file: path.relative(ROOT, output),
      provider: provider.id,
      adapter: provider.adapter,
      tool: provider.tool ?? null,
      model: actualModel,
      externalId: externalId || null,
      attemptId,
      recoveredFromClosedAttempt: recoverClosedAttempt,
      requestFingerprint,
      reusedFrom,
      sha256,
      sizeBytes: stat.size,
      media: metadata
        ? request.capability === 'image'
          ? {width: metadata.width, height: metadata.height, format: metadata.format ?? null, hasAlpha: metadata.hasAlpha ?? false}
          : metadata
        : null,
      recordedAt,
      request: {...request},
      compositionBinding: request.compositionBinding ?? null,
      stateBinding: request.stateBinding ?? null,
      stateSheetBinding: request.stateSheetBinding ?? null,
      stateSheetRecoveryBinding: request.stateSheetRecoveryBinding ?? null,
      semanticBinding: request.semanticBinding ?? null,
      familyFingerprint: null,
      lifecycle: {
        status: 'active',
        changedAt: recordedAt,
        reason: 'recorded',
        supersededBy: null,
      },
    };
    for (const previous of manifest.assets.filter(({assetId, lifecycle}) =>
      assetId === request.assetId && lifecycle.status === 'active')) {
      previous.lifecycle = {
        status: 'superseded',
        changedAt: recordedAt,
        reason: 'replaced-by-new-record',
        supersededBy: record.recordId,
      };
    }
    manifest.assets.push(record);
    const familyKey = (asset) => {
      const binding = asset.compositionBinding;
      if (!binding) return null;
      return [
        binding.pattern,
        binding.registrationId ?? asset.assetId,
        binding.sourceMasterAssetId ?? asset.assetId,
        binding.canvas?.width,
        binding.canvas?.height,
      ].join(':');
    };
    const activeAssets = manifest.assets.filter(({lifecycle}) => lifecycle.status === 'active');
    const familyKeys = new Set(activeAssets.map(familyKey).filter(Boolean));
    for (const key of familyKeys) {
      const members = activeAssets
        .filter((asset) => familyKey(asset) === key)
        .sort((left, right) => left.assetId.localeCompare(right.assetId));
      const familyFingerprint = createHash('sha256')
        .update(JSON.stringify(stableValue({
          key,
          members: members.map(({assetId, sha256: memberSha256, requestFingerprint, compositionBinding, stateBinding}) => ({assetId, sha256: memberSha256, requestFingerprint, compositionBinding, stateBinding})),
        })))
        .digest('hex');
      for (const member of members) member.familyFingerprint = familyFingerprint;
    }
    await writeJson(manifestFile, manifest);
  } catch (error) {
    if (trackedAttempt && !recoverClosedAttempt) {
      await closeGenerationAttempt({
        slug: request.projectSlug,
        attemptId,
        status: 'abandoned',
        quotaConsumed: true,
        output: path.relative(ROOT, output),
        outputSha256: sha256,
        note: `输出有效但溯源登记失败：${error.message}`,
      });
    }
    throw error;
  }
  if (trackedAttempt && !recoverClosedAttempt) {
    await closeGenerationAttempt({
      slug: request.projectSlug,
      attemptId,
      status: 'succeeded',
      quotaConsumed: true,
      output: path.relative(ROOT, output),
      outputSha256: sha256,
    });
  }
  return {manifestFile, record, attemptId};
};
