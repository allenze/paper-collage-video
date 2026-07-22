import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  COMPOSITION_PATTERNS,
  RELATIONSHIP_PREDICATES,
  compileStoryboardDirecting,
  validateCompiledDirecting,
} from './motion-treatment-lib.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const STORY_BLUEPRINTS = [
  'layered-reveal',
  'map-journey',
  'archive-stack',
  'character-procession',
  'discovery-wipe',
  'transformation-tableau',
  'chapter-tableau',
  'quiet-lockup',
];

export const PROOF_KINDS = ['establish', 'action', 'peak', 'final'];
export {COMPOSITION_PATTERNS, RELATIONSHIP_PREDICATES, compileStoryboardDirecting};

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizedTime = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export const storyboardFileFor = (slug) => {
  if (!SLUG_PATTERN.test(slug ?? '')) throw new Error(`无效项目 slug：${slug}`);
  return path.join(ROOT, 'projects', slug, 'storyboard.json');
};

export const validateStoryboard = (storyboard, {slug, plan} = {}) => {
  const issues = [];
  const add = (code, message, location) => issues.push({code, message, location});
  if (storyboard?.schemaVersion !== 4) {
    add('storyboard-schema-version', 'storyboard.schemaVersion 必须为 4。', 'schemaVersion');
  }
  if (storyboard?.slug !== slug) {
    add('storyboard-slug', `storyboard.slug 必须为 ${slug}。`, 'slug');
  }
  if (!['pending', 'ready'].includes(storyboard?.status)) {
    add('storyboard-status', 'storyboard.status 必须为 pending 或 ready。', 'status');
  }
  if (storyboard?.status !== 'ready') return issues;

  if (!nonEmpty(storyboard.arc)) add('storyboard-arc', '故事板必须写明全片叙事弧。', 'arc');
  const style = storyboard.style;
  if (!style || typeof style !== 'object') {
    add('storyboard-style', '故事板必须包含 style。', 'style');
  } else {
    for (const key of ['visualThesis', 'layerStrategy']) {
      if (!nonEmpty(style[key])) add(`storyboard-style-${key}`, `style.${key} 不能为空。`, `style.${key}`);
    }
    for (const key of ['compositionRules', 'motionLanguage']) {
      if (!Array.isArray(style[key]) || style[key].length === 0 || style[key].some((item) => !nonEmpty(item))) {
        add(`storyboard-style-${key}`, `style.${key} 必须包含至少一条明确规则。`, `style.${key}`);
      }
    }
  }

  const scenes = storyboard.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    add('storyboard-scenes', 'ready 故事板至少需要一个镜头。', 'scenes');
    return issues;
  }
  if (plan?.status === 'resolved' && scenes.length !== plan.resolved?.sceneCount) {
    add(
      'storyboard-scene-count',
      `故事板需要 ${plan.resolved?.sceneCount} 个镜头，当前为 ${scenes.length} 个。`,
      'scenes',
    );
  }
  const sceneIds = new Set();
  let estimatedDuration = 0;
  for (const [sceneIndex, scene] of scenes.entries()) {
    const location = `scenes[${sceneIndex}]`;
    if (!nonEmpty(scene.id) || sceneIds.has(scene.id)) {
      add('storyboard-scene-id', '镜头 id 缺失或重复。', `${location}.id`);
    }
    sceneIds.add(scene.id);
    for (const key of ['title', 'narrativeRole', 'message']) {
      if (!nonEmpty(scene[key])) add(`storyboard-scene-${key}`, `${key} 不能为空。`, `${location}.${key}`);
    }
    if (!STORY_BLUEPRINTS.includes(scene.blueprint)) {
      add('storyboard-blueprint', `未知镜头蓝图：${scene.blueprint}`, `${location}.blueprint`);
    }
    if (!(typeof scene.estimatedDurationSeconds === 'number' && scene.estimatedDurationSeconds > 0)) {
      add('storyboard-duration', 'estimatedDurationSeconds 必须大于 0。', `${location}.estimatedDurationSeconds`);
    } else {
      estimatedDuration += scene.estimatedDurationSeconds;
    }
    const compositionPlan = scene.compositionPlan;
    if (!compositionPlan || typeof compositionPlan !== 'object') {
      add('storyboard-composition-plan', '每个镜头必须声明 compositionPlan。', `${location}.compositionPlan`);
    } else {
      if (
        !Array.isArray(compositionPlan.patterns) ||
        compositionPlan.patterns.length === 0 ||
        compositionPlan.patterns.some((pattern) => !COMPOSITION_PATTERNS.includes(pattern))
      ) {
        add('storyboard-composition-pattern', 'compositionPlan.patterns 必须使用受支持的组合模式。', `${location}.compositionPlan.patterns`);
      }
      if (!Array.isArray(compositionPlan.relationships)) {
        add('storyboard-composition-relationships', 'compositionPlan.relationships 必须是数组。', `${location}.compositionPlan.relationships`);
      }
      const relationshipIds = new Set();
      for (const [relationshipIndex, relationship] of (compositionPlan.relationships ?? []).entries()) {
        const relationshipLocation = `${location}.compositionPlan.relationships[${relationshipIndex}]`;
        if (!nonEmpty(relationship.id) || relationshipIds.has(relationship.id)) {
          add('storyboard-relationship-id', '关系 id 缺失或重复。', `${relationshipLocation}.id`);
        }
        relationshipIds.add(relationship.id);
        for (const key of ['subject', 'object', 'proof']) {
          if (!nonEmpty(relationship[key])) add(`storyboard-relationship-${key}`, `关系 ${key} 不能为空。`, `${relationshipLocation}.${key}`);
        }
        if (!RELATIONSHIP_PREDICATES.includes(relationship.predicate)) {
          add('storyboard-relationship-predicate', `未知关系 predicate：${relationship.predicate}`, `${relationshipLocation}.predicate`);
        }
        const requiredPattern = ['inside', 'on', 'held-by', 'worn-by'].includes(relationship.predicate)
          ? 'supported-subject'
          : 'registered-environment';
        if (!(compositionPlan.patterns ?? []).includes(requiredPattern)) {
          add('storyboard-relationship-pattern', `关系 ${relationship.id} 必须声明模式 ${requiredPattern}。`, `${location}.compositionPlan.patterns`);
        }
      }
      if (!Array.isArray(compositionPlan.stateSequences)) {
        add('storyboard-state-sequences', 'compositionPlan.stateSequences 必须是数组。', `${location}.compositionPlan.stateSequences`);
      }
      const sequenceIds = new Set();
      for (const [sequenceIndex, sequence] of (compositionPlan.stateSequences ?? []).entries()) {
        const sequenceLocation = `${location}.compositionPlan.stateSequences[${sequenceIndex}]`;
        if (!nonEmpty(sequence.nodeId) || sequenceIds.has(sequence.nodeId)) add('storyboard-sequence-node-id', '状态序列 nodeId 缺失或重复。', `${sequenceLocation}.nodeId`);
        sequenceIds.add(sequence.nodeId);
        if (!nonEmpty(sequence.poseFamilyId)) add('storyboard-sequence-family', '状态序列必须声明 poseFamilyId。', `${sequenceLocation}.poseFamilyId`);
        if (!['once', 'loop', 'ping-pong'].includes(sequence.playback)) add('storyboard-sequence-playback', '状态序列 playback 无效。', `${sequenceLocation}.playback`);
        if (!['cut', 'crossfade'].includes(sequence.transition)) add('storyboard-sequence-transition', '状态序列 transition 无效。', `${sequenceLocation}.transition`);
        const stateIds = new Set();
        let previousStateAt = -1;
        if (!Array.isArray(sequence.states) || sequence.states.length < 2) add('storyboard-sequence-states', '状态序列至少需要两个状态。', `${sequenceLocation}.states`);
        for (const [stateIndex, state] of (sequence.states ?? []).entries()) {
          const stateLocation = `${sequenceLocation}.states[${stateIndex}]`;
          if (!nonEmpty(state.id) || stateIds.has(state.id)) add('storyboard-sequence-state-id', '状态 id 缺失或重复。', `${stateLocation}.id`);
          stateIds.add(state.id);
          if (!normalizedTime(state.at) || state.at <= previousStateAt) add('storyboard-sequence-state-at', '状态 at 必须位于 0..1 且严格递增。', `${stateLocation}.at`);
          previousStateAt = state.at;
          if (!nonEmpty(state.visualChange)) add('storyboard-sequence-visual-change', '状态必须描述可见变化。', `${stateLocation}.visualChange`);
        }
        if (sequence.states?.[0]?.at !== 0) add('storyboard-sequence-start', '状态序列必须从 at=0 开始。', `${sequenceLocation}.states[0].at`);
      }
      if (!Array.isArray(compositionPlan.continuousMotions)) {
        add('storyboard-continuous-motions', 'compositionPlan.continuousMotions 必须是数组。', `${location}.compositionPlan.continuousMotions`);
      }
      if (!Array.isArray(compositionPlan.graphics)) {
        add('storyboard-graphics', 'compositionPlan.graphics 必须是数组。', `${location}.compositionPlan.graphics`);
      }
    }
    if (!Array.isArray(scene.beats) || scene.beats.length < 3) {
      add('storyboard-beats', '每个镜头至少需要 3 个节拍。', `${location}.beats`);
    }
    const beatIds = new Set();
    const beatEvidenceBindings = [];
    let previousBeat = -1;
    for (const [beatIndex, beat] of (scene.beats ?? []).entries()) {
      const beatLocation = `${location}.beats[${beatIndex}]`;
      if (!nonEmpty(beat.id) || beatIds.has(beat.id)) add('storyboard-beat-id', '节拍 id 缺失或重复。', `${beatLocation}.id`);
      beatIds.add(beat.id);
      if (!normalizedTime(beat.at) || beat.at <= previousBeat) {
        add('storyboard-beat-time', '节拍 at 必须位于 0..1 且严格递增。', `${beatLocation}.at`);
      }
      previousBeat = beat.at;
      for (const key of ['purpose', 'visual']) {
        if (!nonEmpty(beat[key])) add(`storyboard-beat-${key}`, `${key} 不能为空。`, `${beatLocation}.${key}`);
      }
      if (!Array.isArray(beat.treatments) || beat.treatments.length === 0) {
        add('storyboard-beat-treatments', '每个节拍至少需要一个导演 treatment。', `${beatLocation}.treatments`);
      }
      if (beat.audioCue !== null && beat.audioCue !== undefined && !nonEmpty(beat.audioCue)) {
        add('storyboard-beat-audio', 'audioCue 必须为非空字符串或 null。', `${beatLocation}.audioCue`);
      }
      if (!Object.hasOwn(beat, 'proofTimeId')) {
        add('storyboard-beat-proof-field', 'v4 节拍必须显式声明 proofTimeId（字符串或 null）。', `${beatLocation}.proofTimeId`);
      }
      if (beat.proofTimeId !== null && beat.proofTimeId !== undefined && !nonEmpty(beat.proofTimeId)) {
        add('storyboard-beat-proof-id', 'proofTimeId 必须为非空字符串或 null。', `${beatLocation}.proofTimeId`);
      }
      if (beat.audioCue && !nonEmpty(beat.proofTimeId)) {
        add('storyboard-audio-proof-required', '带 audioCue 的节拍必须绑定事件级 proofTimeId。', `${beatLocation}.proofTimeId`);
      }
      if (nonEmpty(beat.proofTimeId)) {
        beatEvidenceBindings.push({proofTimeId: beat.proofTimeId, location: beatLocation});
      }
    }
    if (!Array.isArray(scene.proofTimes) || scene.proofTimes.length < 3) {
      add('storyboard-proof-times', '每个镜头至少需要 3 个证明时刻。', `${location}.proofTimes`);
    }
    let previousProof = -1;
    let hasFinal = false;
    const proofIds = new Set();
    for (const [proofIndex, proof] of (scene.proofTimes ?? []).entries()) {
      const proofLocation = `${location}.proofTimes[${proofIndex}]`;
      if (!nonEmpty(proof.id) || proofIds.has(proof.id)) {
        add('storyboard-proof-id', '证明时刻 id 缺失或重复。', `${proofLocation}.id`);
      }
      proofIds.add(proof.id);
      if (!normalizedTime(proof.at) || proof.at <= previousProof) {
        add('storyboard-proof-time', '证明时刻 at 必须位于 0..1 且严格递增。', `${proofLocation}.at`);
      }
      previousProof = proof.at;
      if (!nonEmpty(proof.label)) add('storyboard-proof-label', '证明时刻必须有 label。', `${proofLocation}.label`);
      if (!PROOF_KINDS.includes(proof.kind)) add('storyboard-proof-kind', `未知证明类型：${proof.kind}`, `${proofLocation}.kind`);
      if (!Array.isArray(proof.assertions) || proof.assertions.length === 0 || proof.assertions.some((item) => !nonEmpty(item))) {
        add('storyboard-proof-assertions', '证明时刻必须声明至少一项可见关系断言。', `${proofLocation}.assertions`);
      }
      if (!Array.isArray(proof.stateAssertions)) add('storyboard-proof-state-assertions', 'v4 proofTime 必须显式声明 stateAssertions 数组。', `${proofLocation}.stateAssertions`);
      if (proof.kind === 'final' && proof.at >= 0.82) hasFinal = true;
    }
    for (const sequence of compositionPlan?.stateSequences ?? []) {
      const plannedStates = new Set(sequence.states.map(({id}) => id));
      const assertedStates = new Set((scene.proofTimes ?? []).flatMap((proof) =>
        (proof.stateAssertions ?? []).filter(({nodeId}) => nodeId === sequence.nodeId).map(({stateId}) => stateId),
      ));
      for (const stateId of assertedStates) {
        if (!plannedStates.has(stateId)) add('storyboard-proof-state-unknown', `状态证明引用了未知状态 ${stateId}。`, `${location}.proofTimes`);
      }
      for (const stateId of plannedStates) {
        if (!assertedStates.has(stateId)) add('storyboard-proof-state-coverage', `状态 ${sequence.nodeId}/${stateId} 缺少证明时刻。`, `${location}.proofTimes`);
      }
    }
    for (const binding of beatEvidenceBindings) {
      if (!proofIds.has(binding.proofTimeId)) {
        add(
          'storyboard-beat-proof-missing',
          `节拍绑定的证明时刻不存在：${binding.proofTimeId}。`,
          `${binding.location}.proofTimeId`,
        );
      }
    }
    if (!hasFinal) add('storyboard-final-proof', '每个镜头必须在 0.82 之后设置 final 证明时刻。', `${location}.proofTimes`);
  }

  const plannedDuration = plan?.status === 'resolved' ? plan.resolved?.durationSeconds : null;
  if (plannedDuration && Math.abs(estimatedDuration - plannedDuration) > Math.max(1, plannedDuration * 0.08)) {
    add(
      'storyboard-duration-total',
      `镜头预计总时长 ${estimatedDuration.toFixed(2)}s 与计划 ${plannedDuration.toFixed(2)}s 相差超过 8%。`,
      'scenes',
    );
  }
  issues.push(...validateCompiledDirecting(storyboard, {plan}));
  return issues;
};

export const loadStoryboard = async (slug) =>
  JSON.parse(await fs.readFile(storyboardFileFor(slug), 'utf8'));

export const assertStoryboardReady = async (slug, plan) => {
  let storyboard;
  try {
    storyboard = await loadStoryboard(slug);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('缺少 storyboard.json；请先运行 project:storyboard。');
    throw error;
  }
  const issues = validateStoryboard(storyboard, {slug, plan});
  if (storyboard.status !== 'ready' || issues.length > 0) {
    const detail = issues.map(({location, message}) => `${location}: ${message}`).join('；');
    throw new Error(`故事板尚未就绪；请先运行 project:storyboard。${detail ? ` ${detail}` : ''}`);
  }
  return storyboard;
};

export const summarizeStoryboard = (storyboard) => ({
  status: storyboard?.status ?? 'missing',
  arc: storyboard?.status === 'ready' ? storyboard.arc : null,
  sceneCount: Array.isArray(storyboard?.scenes) ? storyboard.scenes.length : 0,
  scenes:
    storyboard?.status === 'ready'
      ? storyboard.scenes.map(({id, title, narrativeRole, blueprint, compositionPlan, directing, beats, proofTimes}) => ({
          id,
          title,
          narrativeRole,
          blueprint,
          patterns: compositionPlan.patterns,
          treatmentCount: directing.treatmentCount,
          riskScore: directing.riskScore,
          beatCount: beats.length,
          evidenceBoundBeatCount: beats.filter(({proofTimeId}) => Boolean(proofTimeId)).length,
          proofCount: proofTimes.length,
        }))
      : [],
  directing: storyboard?.status === 'ready'
    ? {
        fingerprint: storyboard.directingSummary?.fingerprint ?? null,
        styleProofSceneId: storyboard.directingSummary?.styleProofSceneId ?? null,
        styleProofTreatmentId: storyboard.directingSummary?.styleProofTreatmentId ?? null,
        estimatedPoseSheetCalls: storyboard.directingSummary?.estimatedPoseSheetCalls ?? 0,
        avoidedIsolatedStateCalls: storyboard.directingSummary?.avoidedIsolatedStateCalls ?? 0,
      }
    : null,
});
