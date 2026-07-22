import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  collectSequenceProofCoverage,
  resolveSequencePhase,
  resolveSequenceState,
} from './state-sequence-lib.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const schema = JSON.parse(
  await fs.readFile(path.join(ROOT, 'schemas', 'composition.schema.json'), 'utf8'),
);

export const COMPOSITION_PATTERNS = schema.$defs.pattern.enum;
export const EMPHASIS_ACTIONS = schema.$defs.emphasisAction.enum;
export const MOTION_EASES = schema.$defs.motionEase.enum;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const hashCompositionValue = (value) =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

export const flattenCompositionNodes = (nodes = [], parent = null) =>
  nodes.flatMap((node) => [
    {node, parent},
    ...(node.kind === 'group'
      ? flattenCompositionNodes(node.children ?? [], node)
      : []),
  ]);

export const collectCompositionGroups = (composition) =>
  flattenCompositionNodes(composition?.nodes).filter(({node}) => node.kind === 'group');

export const collectCompositionAssets = (composition) =>
  flattenCompositionNodes(composition?.nodes).filter(({node}) => node.kind === 'asset');

export const collectStateSequences = (composition) =>
  flattenCompositionNodes(composition?.nodes).filter(({node}) => node.kind === 'state-sequence');

export const collectCompositionVisualSources = (composition) => [
  ...collectCompositionAssets(composition).map(({node}) => node.src),
  ...collectStateSequences(composition).flatMap(({node}) => node.states.map(({src}) => src)),
];

export const pointInPolygon = ([x, y], polygon = []) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentX, currentY] = polygon[index] ?? [];
    const [previousX, previousY] = polygon[previous] ?? [];
    if (![currentX, currentY, previousX, previousY].every(finite)) return false;
    const crosses =
      currentY > y !== previousY > y &&
      x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY || 1e-9) + currentX;
    if (crosses) inside = !inside;
  }
  return inside;
};

const resolveAxisAt = (keyframes, progress, property) => {
  const sorted = [...(keyframes ?? [])].sort((left, right) => left.at - right.at);
  if (sorted.length === 0) return property === 'scale' || property === 'opacity' ? 1 : 0;
  const fallback = property === 'scale' || property === 'opacity' ? 1 : 0;
  if (progress <= sorted[0].at) return sorted[0][property] ?? fallback;
  if (progress >= sorted.at(-1).at) return sorted.at(-1)[property] ?? fallback;
  const rightIndex = sorted.findIndex(({at}) => at >= progress);
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];
  const amount = (progress - left.at) / Math.max(1e-9, right.at - left.at);
  return (left[property] ?? fallback) + ((right[property] ?? fallback) - (left[property] ?? fallback)) * amount;
};

export const validateMotionKeyframes = (keyframes, location, add) => {
  if (!Array.isArray(keyframes) || keyframes.length < 2) {
    add('error', 'motion-keyframes-required', '组合节点必须包含至少两个关键帧。', location);
    return;
  }
  let previousAt = -1;
  let authoredValues = 0;
  for (const [index, keyframe] of keyframes.entries()) {
    const keyframeLocation = `${location}[${index}]`;
    if (!finite(keyframe.at) || keyframe.at < 0 || keyframe.at > 1 || keyframe.at <= previousAt) {
      add('error', 'motion-keyframe-at', '关键帧 at 必须位于 0..1 且严格递增。', `${keyframeLocation}.at`);
    }
    previousAt = keyframe.at;
    for (const property of ['x', 'y', 'scale', 'rotation', 'opacity']) {
      if (keyframe[property] !== undefined) {
        authoredValues += 1;
        if (!finite(keyframe[property])) add('error', 'motion-keyframe-value', `${property} 必须是有限数字。`, `${keyframeLocation}.${property}`);
      }
    }
    if (keyframe.scale !== undefined && keyframe.scale <= 0) add('error', 'motion-keyframe-scale', 'scale 必须大于 0。', `${keyframeLocation}.scale`);
    if (keyframe.opacity !== undefined && (keyframe.opacity < 0 || keyframe.opacity > 1)) add('error', 'motion-keyframe-opacity', 'opacity 必须位于 0..1。', `${keyframeLocation}.opacity`);
    if (keyframe.ease !== undefined && !MOTION_EASES.includes(keyframe.ease)) add('error', 'motion-keyframe-ease', `未知 ease：${keyframe.ease}`, `${keyframeLocation}.ease`);
  }
  if (keyframes[0]?.at !== 0 || keyframes.at(-1)?.at !== 1) add('error', 'motion-keyframe-boundaries', '关键帧必须从 at=0 覆盖到 at=1。', location);
  if (authoredValues === 0) add('error', 'motion-keyframe-empty', '关键帧必须显式编排至少一个属性。', location);
};

const validateTransform = (transform, location, add) => {
  if (!transform || typeof transform !== 'object') {
    add('error', 'composition-transform', '组合节点必须声明 transform。', location);
    return;
  }
  for (const property of ['x', 'y', 'width', 'anchorX', 'anchorY']) {
    if (!finite(transform[property])) add('error', 'composition-transform-value', `${property} 必须是有限数字。`, `${location}.${property}`);
  }
  if (!(transform.width > 0)) add('error', 'composition-transform-width', 'width 必须大于 0。', `${location}.width`);
  if (transform.height !== undefined && !(finite(transform.height) && transform.height > 0)) add('error', 'composition-transform-height', 'height 必须大于 0。', `${location}.height`);
  for (const property of ['anchorX', 'anchorY']) {
    if (finite(transform[property]) && (transform[property] < 0 || transform[property] > 1)) add('error', 'composition-transform-anchor', `${property} 必须位于 0..1。`, `${location}.${property}`);
  }
};

export const validateCompositionStructure = ({composition, video, proofTimes = [], location = 'composition'}) => {
  const issues = [];
  const add = (level, code, message, issueLocation) => issues.push({level, code, message, location: issueLocation});
  if (!composition || typeof composition !== 'object') {
    add('error', 'composition-required', '每个镜头必须声明 composition。', location);
    return {issues, nodeIds: new Set(), groups: [], assets: [], sequences: [], freeNodes: []};
  }
  if (
    composition.coordinateSpace?.width !== video?.width ||
    composition.coordinateSpace?.height !== video?.height
  ) {
    add('error', 'composition-coordinate-space', '镜头 composition.coordinateSpace 必须与视频画布一致。', `${location}.coordinateSpace`);
  }
  if (!Array.isArray(composition.nodes) || composition.nodes.length === 0) add('error', 'composition-nodes', 'composition.nodes 至少需要一个节点。', `${location}.nodes`);

  const flat = flattenCompositionNodes(composition.nodes);
  const freeNodes = flat.filter(({node, parent}) => parent === null && node.kind !== 'group');
  const nodeIds = new Set();
  const groups = [];
  const assets = [];
  const sequences = [];
  for (const {node, parent} of flat) {
    const nodeLocation = `${location}.nodes#${node?.id ?? 'missing'}`;
    if (!nonEmpty(node?.id) || nodeIds.has(node.id)) add('error', 'composition-node-id', '组合节点 id 缺失或重复。', `${nodeLocation}.id`);
    nodeIds.add(node?.id);
    if (!['asset', 'state-sequence', 'text', 'shape', 'group'].includes(node?.kind)) {
      add('error', 'composition-node-kind', `未知组合节点 kind：${node?.kind}`, `${nodeLocation}.kind`);
      continue;
    }
    if (!Number.isInteger(node.z)) add('error', 'composition-node-z', '节点 z 必须是整数。', `${nodeLocation}.z`);
    validateTransform(node.transform, `${nodeLocation}.transform`, add);
    validateMotionKeyframes(node.motion?.keyframes, `${nodeLocation}.motion.keyframes`, add);
    if (node.visibility !== undefined && !['visible', 'hidden'].includes(node.visibility?.initial)) {
      add('error', 'composition-node-visibility', 'visibility.initial 必须是 visible 或 hidden。', `${nodeLocation}.visibility.initial`);
    }
    if (node.motion?.idle) {
      if (!['float', 'breathe', 'grind', 'drift', 'still'].includes(node.motion.idle.preset)) add('error', 'composition-idle-preset', `未知 idle preset：${node.motion.idle.preset}`, `${nodeLocation}.motion.idle.preset`);
      if (!(finite(node.motion.idle.intensity) && node.motion.idle.intensity >= 0 && node.motion.idle.intensity <= 3)) add('error', 'composition-idle-intensity', 'idle.intensity 必须位于 0..3。', `${nodeLocation}.motion.idle.intensity`);
      if (!(finite(node.motion.idle.cycleSeconds) && node.motion.idle.cycleSeconds > 0)) add('error', 'composition-idle-cycle', 'idle.cycleSeconds 必须大于 0。', `${nodeLocation}.motion.idle.cycleSeconds`);
    }
    if (node.kind === 'asset') {
      assets.push({node, parent});
      if (!nonEmpty(node.src)) add('error', 'composition-asset-src', 'asset 节点必须声明 src。', `${nodeLocation}.src`);
      if (!['background', 'environment', 'character', 'prop', 'decorative'].includes(node.assetRole)) add('error', 'composition-asset-role', `未知 assetRole：${node.assetRole}`, `${nodeLocation}.assetRole`);
      if (node.clip && parent?.pattern !== 'registered-environment') add('error', 'composition-clip-parent', '只有 registered-environment 子资产可以声明 clip。', `${nodeLocation}.clip`);
      continue;
    }

    if (node.kind === 'state-sequence') {
      sequences.push({node, parent});
      if (!['character', 'prop', 'decorative'].includes(node.assetRole)) add('error', 'composition-sequence-role', `未知 state-sequence assetRole：${node.assetRole}`, `${nodeLocation}.assetRole`);
      if (!nonEmpty(node.poseFamilyId)) add('error', 'composition-pose-family', 'state-sequence 必须声明 poseFamilyId。', `${nodeLocation}.poseFamilyId`);
      if (!node.registration || !nonEmpty(node.registration.id) || !nonEmpty(node.registration.sourceMasterAssetId)) add('error', 'composition-sequence-registration', 'state-sequence 必须声明可追溯的 registration。', `${nodeLocation}.registration`);
      if (!(finite(node.registration?.canvas?.width) && node.registration.canvas.width > 0 && finite(node.registration?.canvas?.height) && node.registration.canvas.height > 0)) add('error', 'composition-sequence-canvas', 'state-sequence registration.canvas 必须是有效画布。', `${nodeLocation}.registration.canvas`);
      if (!Array.isArray(node.states) || node.states.length < 2) {
        add('error', 'composition-sequence-states', 'state-sequence 至少需要两个状态。', `${nodeLocation}.states`);
      } else {
        const stateIds = new Set();
        let previousAt = -1;
        for (const [index, state] of node.states.entries()) {
          const stateLocation = `${nodeLocation}.states[${index}]`;
          if (!nonEmpty(state.id) || stateIds.has(state.id)) add('error', 'composition-sequence-state-id', '状态 id 缺失或重复。', `${stateLocation}.id`);
          stateIds.add(state.id);
          if (!nonEmpty(state.src)) add('error', 'composition-sequence-state-src', '状态必须声明 src。', `${stateLocation}.src`);
          if (!finite(state.at) || state.at < 0 || state.at > 1 || state.at <= previousAt) add('error', 'composition-sequence-state-at', '状态 at 必须位于 0..1 且严格递增。', `${stateLocation}.at`);
          previousAt = state.at;
        }
        if (node.states[0]?.at !== 0) add('error', 'composition-sequence-start', '状态序列必须从 at=0 开始。', `${nodeLocation}.states[0].at`);
        const coverage = collectSequenceProofCoverage({node, proofTimes});
        for (const state of node.states) {
          if (!coverage.has(state.id)) add('error', 'composition-sequence-proof-coverage', `状态 ${state.id} 缺少 proofTime.stateAssertions 证明。`, `${nodeLocation}.states`);
        }
      }
      if (!['once', 'loop', 'ping-pong'].includes(node.playback?.mode) || !(Number.isInteger(node.playback?.cycles) && node.playback.cycles > 0)) add('error', 'composition-sequence-playback', 'state-sequence playback 必须声明有效 mode 与正整数 cycles。', `${nodeLocation}.playback`);
      if (node.playback?.mode === 'once' && node.playback.cycles !== 1) add('error', 'composition-sequence-once-cycles', 'once playback 的 cycles 必须为 1。', `${nodeLocation}.playback.cycles`);
      const segmented = node.playback?.activeUntil !== undefined || node.playback?.holdStateId !== undefined;
      if (segmented && !(
        finite(node.playback?.activeUntil) &&
        node.playback.activeUntil > 0 &&
        node.playback.activeUntil < 1 &&
        nonEmpty(node.playback?.holdStateId)
      )) add('error', 'composition-sequence-segmented-playback', '分段状态序列必须同时声明 0..1 之间的 activeUntil 与 holdStateId。', `${nodeLocation}.playback`);
      if (segmented && !node.states.some(({id}) => id === node.playback.holdStateId)) add('error', 'composition-sequence-hold-state', `定格状态 ${node.playback?.holdStateId ?? 'none'} 不存在。`, `${nodeLocation}.playback.holdStateId`);
      if (!['cut', 'crossfade'].includes(node.transition?.type) || !(finite(node.transition?.durationSeconds) && node.transition.durationSeconds >= 0)) add('error', 'composition-sequence-transition', 'state-sequence transition 无效。', `${nodeLocation}.transition`);
      if (node.transition?.type === 'cut' && node.transition.durationSeconds !== 0) add('error', 'composition-sequence-cut-duration', 'cut 的 durationSeconds 必须为 0。', `${nodeLocation}.transition.durationSeconds`);
      if (node.transition?.type === 'crossfade' && !(node.transition.durationSeconds > 0)) add('error', 'composition-sequence-crossfade-duration', 'crossfade 的 durationSeconds 必须大于 0。', `${nodeLocation}.transition.durationSeconds`);
      if (node.clip && parent?.pattern !== 'registered-environment') add('error', 'composition-clip-parent', '只有 registered-environment 子节点可以声明 clip。', `${nodeLocation}.clip`);
      continue;
    }

    if (node.kind === 'text') {
      if (typeof node.text !== 'string') add('error', 'composition-text-value', 'text 节点必须声明字符串内容。', `${nodeLocation}.text`);
      if (!(finite(node.style?.fontSize) && node.style.fontSize > 0 && finite(node.style?.lineHeight) && node.style.lineHeight > 0)) add('error', 'composition-text-style', 'text 节点必须声明有效字号与行高。', `${nodeLocation}.style`);
      if (!finite(node.transform?.height) || node.transform.height <= 0) add('error', 'composition-text-height', 'text 节点必须声明 transform.height。', `${nodeLocation}.transform.height`);
      continue;
    }

    if (node.kind === 'shape') {
      if (!['rectangle', 'ellipse', 'line'].includes(node.shape)) add('error', 'composition-shape-kind', `未知 shape：${node.shape}`, `${nodeLocation}.shape`);
      if (!finite(node.transform?.height) || node.transform.height <= 0) add('error', 'composition-shape-height', 'shape 节点必须声明 transform.height。', `${nodeLocation}.transform.height`);
      continue;
    }

    groups.push({node, parent});
    if (!COMPOSITION_PATTERNS.includes(node.pattern)) add('error', 'composition-pattern', `未知组合模式：${node.pattern}`, `${nodeLocation}.pattern`);
    if (!(finite(node.coordinateSpace?.width) && node.coordinateSpace.width > 0 && finite(node.coordinateSpace?.height) && node.coordinateSpace.height > 0)) add('error', 'composition-group-space', 'group.coordinateSpace 必须是有效画布。', `${nodeLocation}.coordinateSpace`);
    if (!Array.isArray(node.children) || node.children.length === 0) add('error', 'composition-group-children', 'group 至少需要一个 child。', `${nodeLocation}.children`);

    if (node.pattern === 'supported-subject') {
      const slots = new Map((node.children ?? []).filter((child) => ['asset', 'state-sequence'].includes(child.kind)).map((child) => [child.slot, child]));
      for (const slot of ['support-rear', 'subject', 'support-front']) {
        if (!slots.has(slot)) add('error', 'composition-support-slot', `supported-subject 缺少 ${slot}。`, `${nodeLocation}.children`);
      }
      if (!node.registration) add('error', 'composition-registration', 'supported-subject 必须声明 registration。', `${nodeLocation}.registration`);
      if (!node.support) add('error', 'composition-support', 'supported-subject 必须声明 support。', `${nodeLocation}.support`);
      const subject = slots.get('subject');
      if (subject && node.support?.subjectId !== subject.id) add('error', 'composition-support-subject', 'support.subjectId 必须指向 subject slot。', `${nodeLocation}.support.subjectId`);
      if (node.support?.layering !== undefined && !['between-supports', 'subject-front'].includes(node.support.layering)) add('error', 'composition-support-layering', 'support.layering 必须是 between-supports 或 subject-front。', `${nodeLocation}.support.layering`);
      for (const child of (node.children ?? []).filter((item) => ['asset', 'state-sequence'].includes(item.kind))) {
        const registrationId = child.kind === 'asset' ? child.registrationId : child.registration?.id;
        if (registrationId !== node.registration?.id) add('error', 'composition-registration-member', `耦合成员 ${child.id} 必须共享 registrationId。`, `${nodeLocation}.children`);
        const groupHasCarrierMotion = (node.motion?.keyframes ?? []).some((keyframe) =>
          (keyframe.x ?? 0) !== 0 ||
          (keyframe.y ?? 0) !== 0 ||
          (keyframe.scale ?? 1) !== 1 ||
          (keyframe.rotation ?? 0) !== 0,
        );
        if (groupHasCarrierMotion && stableStringify(child.motion?.keyframes) === stableStringify(node.motion?.keyframes)) {
          add('error', 'composition-duplicated-carrier-motion', `附着成员 ${child.id} 重复了父组的承载运动。`, `${nodeLocation}.children`);
        }
      }
      for (const proof of proofTimes) {
        if (node.support?.detachProofTimeIds?.includes(proof.id)) continue;
        const subjectX = node.support?.contactAnchor?.x + resolveAxisAt(subject?.motion?.keyframes, proof.at, 'x');
        const subjectY = node.support?.contactAnchor?.y + resolveAxisAt(subject?.motion?.keyframes, proof.at, 'y');
        if (!pointInPolygon([subjectX, subjectY], node.support?.contactZone)) add('error', 'composition-support-contact', `证明时刻 ${proof.id} 的主体支撑点离开 contactZone。`, `${nodeLocation}.support.contactZone`);
      }
    }

    if (node.pattern === 'registered-environment') {
      if (!node.registration) add('error', 'composition-registration', 'registered-environment 必须声明 registration。', `${nodeLocation}.registration`);
      if (node.registration && (node.registration.canvas.width !== node.coordinateSpace.width || node.registration.canvas.height !== node.coordinateSpace.height)) add('error', 'composition-registration-canvas', 'registration.canvas 必须与 group.coordinateSpace 一致。', `${nodeLocation}.registration.canvas`);
      const boundaries = new Map();
      for (const boundary of node.boundaries ?? []) {
        if (!nonEmpty(boundary.id) || boundaries.has(boundary.id)) add('error', 'composition-boundary-id', '边界 id 缺失或重复。', `${nodeLocation}.boundaries`);
        boundaries.set(boundary.id, boundary);
        const masksComplete = nonEmpty(boundary.upperMaskSrc) && nonEmpty(boundary.lowerMaskSrc);
        if (!(finite(boundary.normalizedY) || masksComplete)) add('error', 'composition-boundary-source', '边界必须声明 normalizedY 或上下两张 mask。', `${nodeLocation}.boundaries`);
      }
      const semantics = new Set();
      for (const child of (node.children ?? []).filter((item) => item.kind === 'asset')) {
        if (child.registrationId !== node.registration?.id) add('error', 'composition-registration-member', `注册环境成员 ${child.id} 必须共享 registrationId。`, `${nodeLocation}.children`);
        const transform = child.transform ?? {};
        if (transform.x !== 0 || transform.y !== 0 || transform.width !== 1 || transform.height !== 1 || transform.anchorX !== 0 || transform.anchorY !== 0) add('error', 'composition-registration-transform', `注册环境成员 ${child.id} 必须使用完整母版坐标。`, `${nodeLocation}.children`);
        if (child.clip && !boundaries.has(child.clip.boundaryId)) add('error', 'composition-boundary-reference', `资产 ${child.id} 引用了不存在的边界。`, `${nodeLocation}.children`);
        for (const semantic of child.semanticCoverage ?? []) {
          if (semantics.has(semantic)) add('error', 'composition-semantic-duplicate', `注册环境重复声明语义区域 ${semantic}。`, `${nodeLocation}.children`);
          semantics.add(semantic);
        }
      }
    }
  }
  for (const proof of proofTimes) {
    for (const assertion of proof.stateAssertions ?? []) {
      const entry = sequences.find(({node}) => node.id === assertion.nodeId);
      if (!entry) {
        add('error', 'composition-sequence-proof-node', `证明 ${proof.id} 引用了不存在的状态序列 ${assertion.nodeId}。`, `${location}.proofTimes#${proof.id}`);
        continue;
      }
      if (!entry.node.states.some(({id}) => id === assertion.stateId)) add('error', 'composition-sequence-proof-state', `证明 ${proof.id} 引用了不存在的状态 ${assertion.stateId}。`, `${location}.proofTimes#${proof.id}`);
      const resolved = resolveSequenceState({node: entry.node, progress: proof.at});
      if (resolved?.id !== assertion.stateId) add('error', 'composition-sequence-proof-mismatch', `证明 ${proof.id} 期望 ${assertion.stateId}，但时间调度解析为 ${resolved?.id ?? 'none'}。`, `${location}.proofTimes#${proof.id}`);
      const phase = resolveSequencePhase({...entry.node.playback, progress: proof.at});
      if (entry.node.transition.type === 'crossfade' && resolved?.at === phase && resolved.at > 0) add('error', 'composition-sequence-proof-transition', `证明 ${proof.id} 落在 ${resolved.id} 交叉淡化的起点，此时新状态尚不可见。`, `${location}.proofTimes#${proof.id}`);
    }
  }
  return {issues, nodeIds, groups, assets, sequences, freeNodes};
};

export const deriveEventTimeline = ({scene, sceneFrom = 0, fps}) =>
  (scene.events ?? []).map((event) => {
    const localFrame = Math.min(scene.durationInFrames - 1, Math.round(event.at * scene.durationInFrames));
    return {
      sceneId: scene.id,
      eventId: event.id,
      beatId: event.beatId,
      targetId: event.targetId,
      visualKind: event.visual?.kind ?? null,
      action: event.visual?.action ?? null,
      localFrame,
      absoluteFrame: sceneFrom + localFrame,
      seconds: (sceneFrom + localFrame) / fps,
      proofTimeId: event.proofTimeId ?? null,
      sound: event.sound?.src ?? null,
    };
  });
