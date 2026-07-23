import {flattenCompositionNodes, hashCompositionValue} from './composition-lib.mjs';

export const TREATMENT_IMPORTANCE = ['hero', 'supporting', 'ambient'];
export const TREATMENT_NECESSITY = ['required', 'enhancement'];
export const CHANGE_CLASSES = [
  'ambient-motion',
  'camera-change',
  'pose-change',
  'prop-state-change',
  'contact-change',
  'shared-boundary',
  'graphic-emphasis',
  'mechanism-state',
  'static-hold',
  'visibility-change',
];
export const MOTION_KINDS = ['static', 'continuous-transform', 'state-sequence', 'visibility-transition'];
export const CONTINUOUS_PRESETS = ['breathe', 'float', 'drift', 'bounce', 'pulse', 'camera', 'settle'];
export const COMPOSITION_PATTERNS = ['free', 'supported-subject', 'registered-environment'];
export const GRAPHIC_KINDS = ['text', 'shape'];
export const GRAPHIC_ANIMATIONS = ['pulse', 'bounce', 'draw', 'stamp'];
export const SEMANTIC_RISKS = ['decorative', 'identity', 'topology', 'mechanism', 'diagram'];
export const RELATIONSHIP_PREDICATES = [
  'inside',
  'on',
  'held-by',
  'worn-by',
  'above-boundary',
  'below-boundary',
];

const RISK_SCORE = {
  decorative: 1,
  identity: 3,
  topology: 4,
  mechanism: 5,
  diagram: 5,
};

const STYLE_SEMANTIC_SEVERITY = {
  decorative: 0,
  identity: 1,
  topology: 2,
  mechanism: 3,
  diagram: 3,
};

const IMPORTANCE_SCORE = {ambient: 0, supporting: 1, hero: 2};
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizedTime = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const requiredPatternForPredicate = (predicate) =>
  ['inside', 'on', 'held-by', 'worn-by'].includes(predicate)
    ? 'supported-subject'
    : 'registered-environment';

const routeForChangeClass = {
  'ambient-motion': {motion: 'continuous-transform'},
  'camera-change': {motion: 'continuous-transform'},
  'pose-change': {motion: 'state-sequence'},
  'prop-state-change': {motion: 'state-sequence'},
  'contact-change': {composition: 'supported-subject'},
  'shared-boundary': {composition: 'registered-environment'},
  'graphic-emphasis': {graphic: true, motion: 'continuous-transform'},
  'mechanism-state': {proof: true},
  'static-hold': {motion: 'static'},
  'visibility-change': {motion: 'visibility-transition'},
};

const addIssue = (issues, code, message, location) =>
  issues.push({code, message, location});

export const treatmentRiskScore = (treatment) =>
  (RISK_SCORE[treatment?.semanticRisk] ?? 0) * 10 +
  (treatment?.motion?.kind === 'state-sequence' ? 5 : 0) +
  (treatment?.composition?.pattern === 'registered-environment' ? 4 : 0) +
  (treatment?.composition?.pattern === 'supported-subject' ? 3 : 0) +
  (IMPORTANCE_SCORE[treatment?.importance] ?? 0) +
  (treatment?.necessity === 'required' ? 1 : 0);

const styleSourceFamilyKey = (treatment) =>
  treatment?.motion?.kind === 'state-sequence'
    ? `pose-family:${treatment.motion.poseFamilyId}`
    : `target:${treatment?.targetId}`;

const styleCoverageForTreatment = (treatment, highestSemanticSeverity) => {
  const coverage = [];
  if ((STYLE_SEMANTIC_SEVERITY[treatment.semanticRisk] ?? 0) === highestSemanticSeverity && highestSemanticSeverity > 0) {
    coverage.push(`semantic:${treatment.semanticRisk}`);
  }
  if (['supported-subject', 'registered-environment'].includes(treatment.composition?.pattern)) {
    coverage.push(`relationship:${treatment.composition.pattern}`);
  }
  if (treatment.motion?.kind === 'state-sequence') coverage.push('motion:state-sequence');
  return coverage;
};

export const compileStyleProofPlan = (scenes) => {
  const candidates = scenes.flatMap((scene) =>
    scene.beats.flatMap((beat) => beat.treatments.map((treatment) => ({
      sceneId: scene.id,
      treatmentId: treatment.id,
      targetId: treatment.targetId,
      proofTimeId: treatment.proofTimeId ?? null,
      riskScore: treatmentRiskScore(treatment),
      directingFingerprint: scene.directing.fingerprint,
      sourceFamilyKey: styleSourceFamilyKey(treatment),
      semanticRisk: treatment.semanticRisk,
      compositionPattern: treatment.composition.pattern,
      motionKind: treatment.motion.kind,
      treatment,
    }))),
  );
  if (candidates.length === 0) {
    return {
      requiredCoverage: [],
      targets: [],
      sourceFamilyKeys: [],
      fingerprint: hashCompositionValue({requiredCoverage: [], targets: []}),
    };
  }
  const highestSemanticSeverity = Math.max(
    ...candidates.map(({semanticRisk}) => STYLE_SEMANTIC_SEVERITY[semanticRisk] ?? 0),
  );
  const requiredCoverage = new Set();
  for (const candidate of candidates) {
    for (const coverage of styleCoverageForTreatment(candidate.treatment, highestSemanticSeverity)) {
      requiredCoverage.add(coverage);
    }
  }
  if (candidates.some(({compositionPattern}) => ['supported-subject', 'registered-environment'].includes(compositionPattern))) {
    requiredCoverage.add('relationship:coupled');
  }
  const representative = [...candidates].sort((left, right) =>
    right.riskScore - left.riskScore ||
    left.sceneId.localeCompare(right.sceneId) ||
    left.treatmentId.localeCompare(right.treatmentId),
  )[0];
  if (requiredCoverage.size === 0) {
    requiredCoverage.add('baseline:representative');
  }
  const enriched = candidates.map(({treatment, ...candidate}) => {
    const coverage = styleCoverageForTreatment(treatment, highestSemanticSeverity);
    if (coverage.some((entry) => entry.startsWith('relationship:'))) coverage.push('relationship:coupled');
    if (
      requiredCoverage.has('baseline:representative') &&
      candidate.sceneId === representative.sceneId &&
      candidate.treatmentId === representative.treatmentId
    ) {
      coverage.push('baseline:representative');
    }
    return {...candidate, coverage: [...new Set(coverage)].sort()};
  });
  const uncovered = new Set(requiredCoverage);
  const selected = [];
  const selectedFamilies = new Set();
  while (uncovered.size > 0) {
    const ranked = enriched
      .filter((candidate) => !selected.some(({sceneId, treatmentId}) => sceneId === candidate.sceneId && treatmentId === candidate.treatmentId))
      .map((candidate) => ({
        candidate,
        newlyCovered: candidate.coverage.filter((entry) => uncovered.has(entry)),
        newFamilyCost: selectedFamilies.has(candidate.sourceFamilyKey) ? 0 : 1,
      }))
      .filter(({newlyCovered}) => newlyCovered.length > 0)
      .sort((left, right) =>
        right.newlyCovered.length - left.newlyCovered.length ||
        left.newFamilyCost - right.newFamilyCost ||
        right.candidate.riskScore - left.candidate.riskScore ||
        left.candidate.sceneId.localeCompare(right.candidate.sceneId) ||
        left.candidate.treatmentId.localeCompare(right.candidate.treatmentId),
      );
    const next = ranked[0]?.candidate;
    if (!next) break;
    selected.push(next);
    selectedFamilies.add(next.sourceFamilyKey);
    for (const entry of next.coverage) uncovered.delete(entry);
  }
  const targets = selected.map((candidate) => ({
    sceneId: candidate.sceneId,
    treatmentId: candidate.treatmentId,
    targetId: candidate.targetId,
    proofTimeId: candidate.proofTimeId,
    riskScore: candidate.riskScore,
    directingFingerprint: candidate.directingFingerprint,
    sourceFamilyKey: candidate.sourceFamilyKey,
    coverage: candidate.coverage,
  }));
  const plan = {
    requiredCoverage: [...requiredCoverage].sort(),
    targets,
    sourceFamilyKeys: [...selectedFamilies].sort(),
  };
  return {...plan, fingerprint: hashCompositionValue(plan)};
};

export const validateTreatment = (treatment, {location = 'treatment', beatAt = null} = {}) => {
  const issues = [];
  if (!treatment || typeof treatment !== 'object' || Array.isArray(treatment)) {
    addIssue(issues, 'treatment-object', 'treatment 必须是对象。', location);
    return issues;
  }
  for (const key of ['id', 'targetId', 'changeClass', 'semanticRisk', 'rationale']) {
    if (!nonEmpty(treatment[key])) addIssue(issues, `treatment-${key}`, `${key} 不能为空。`, `${location}.${key}`);
  }
  if (!TREATMENT_IMPORTANCE.includes(treatment.importance)) {
    addIssue(issues, 'treatment-importance', 'importance 必须是 hero、supporting 或 ambient。', `${location}.importance`);
  }
  if (!TREATMENT_NECESSITY.includes(treatment.necessity)) {
    addIssue(issues, 'treatment-necessity', 'necessity 必须是 required 或 enhancement。', `${location}.necessity`);
  }
  if (!CHANGE_CLASSES.includes(treatment.changeClass)) {
    addIssue(issues, 'treatment-change-class', `未知 changeClass：${treatment.changeClass}`, `${location}.changeClass`);
  }
  if (!SEMANTIC_RISKS.includes(treatment.semanticRisk)) {
    addIssue(issues, 'treatment-semantic-risk', `未知 semanticRisk：${treatment.semanticRisk}`, `${location}.semanticRisk`);
  }
  if (treatment.proofTimeId !== null && treatment.proofTimeId !== undefined && !nonEmpty(treatment.proofTimeId)) {
    addIssue(issues, 'treatment-proof-id', 'proofTimeId 必须为非空字符串或 null。', `${location}.proofTimeId`);
  }
  if (!Object.hasOwn(treatment, 'proofTimeId')) {
    addIssue(issues, 'treatment-proof-field', 'treatment 必须显式声明 proofTimeId（字符串或 null）。', `${location}.proofTimeId`);
  }
  if (!Object.hasOwn(treatment, 'graphic')) {
    addIssue(issues, 'treatment-graphic-field', 'treatment 必须显式声明 graphic（对象或 null）。', `${location}.graphic`);
  }

  const motion = treatment.motion;
  if (!motion || typeof motion !== 'object' || !MOTION_KINDS.includes(motion.kind)) {
    addIssue(issues, 'treatment-motion-kind', 'motion.kind 必须是 static、continuous-transform 或 state-sequence。', `${location}.motion.kind`);
  } else if (motion.kind === 'continuous-transform') {
    if (!CONTINUOUS_PRESETS.includes(motion.preset)) {
      addIssue(issues, 'treatment-motion-preset', `未知 continuous preset：${motion.preset}`, `${location}.motion.preset`);
    }
    if (['poseFamilyId', 'stateId', 'visualChange', 'playback', 'transition'].some((key) => motion[key] !== undefined)) {
      addIssue(issues, 'treatment-motion-mixed', 'continuous-transform 不得夹带 state-sequence 字段。', `${location}.motion`);
    }
  } else if (motion.kind === 'state-sequence') {
    for (const key of ['poseFamilyId', 'stateId', 'visualChange']) {
      if (!nonEmpty(motion[key])) addIssue(issues, `treatment-state-${key}`, `${key} 不能为空。`, `${location}.motion.${key}`);
    }
    if (!['once', 'loop', 'ping-pong'].includes(motion.playback)) {
      addIssue(issues, 'treatment-state-playback', 'state-sequence playback 无效。', `${location}.motion.playback`);
    }
    if (!['cut', 'crossfade'].includes(motion.transition)) {
      addIssue(issues, 'treatment-state-transition', 'state-sequence transition 无效。', `${location}.motion.transition`);
    }
    if (!normalizedTime(beatAt)) {
      addIssue(issues, 'treatment-state-time', '状态 treatment 必须绑定有效 beat.at。', location);
    }
    if (motion.preset !== undefined) {
      addIssue(issues, 'treatment-motion-mixed', 'state-sequence 不得声明 continuous preset。', `${location}.motion.preset`);
    }
  } else if (motion.kind === 'visibility-transition') {
    if (!['show', 'hide'].includes(motion.action)) {
      addIssue(issues, 'treatment-visibility-action', 'visibility-transition.action 必须是 show 或 hide。', `${location}.motion.action`);
    }
    if (!['cut', 'fade-rise', 'fade-scale'].includes(motion.transition)) {
      addIssue(issues, 'treatment-visibility-transition', 'visibility-transition.transition 无效。', `${location}.motion.transition`);
    }
    if (motion.transition === 'cut' ? motion.durationSeconds !== 0 : !(Number.isFinite(motion.durationSeconds) && motion.durationSeconds > 0)) {
      addIssue(issues, 'treatment-visibility-duration', 'cut 时长必须为 0，其他 visibility-transition 时长必须大于 0。', `${location}.motion.durationSeconds`);
    }
    if (['preset', 'poseFamilyId', 'stateId', 'visualChange', 'playback'].some((key) => motion[key] !== undefined)) {
      addIssue(issues, 'treatment-motion-mixed', 'visibility-transition 不得夹带连续或状态序列字段。', `${location}.motion`);
    }
  } else if (motion && Object.keys(motion).some((key) => key !== 'kind')) {
    addIssue(issues, 'treatment-static-fields', 'static motion 只能声明 kind。', `${location}.motion`);
  }

  const composition = treatment.composition;
  if (!composition || typeof composition !== 'object' || !COMPOSITION_PATTERNS.includes(composition.pattern)) {
    addIssue(issues, 'treatment-composition-pattern', 'composition.pattern 必须使用受支持的组合模式。', `${location}.composition.pattern`);
  } else if (composition.pattern !== 'free') {
    const relationship = composition.relationship;
    if (!relationship || typeof relationship !== 'object') {
      addIssue(issues, 'treatment-relationship', '耦合组合必须声明 relationship。', `${location}.composition.relationship`);
    } else {
      for (const key of ['id', 'object', 'proof']) {
        if (!nonEmpty(relationship[key])) addIssue(issues, `treatment-relationship-${key}`, `relationship.${key} 不能为空。`, `${location}.composition.relationship.${key}`);
      }
      if (!RELATIONSHIP_PREDICATES.includes(relationship.predicate)) {
        addIssue(issues, 'treatment-relationship-predicate', `未知 relationship predicate：${relationship.predicate}`, `${location}.composition.relationship.predicate`);
      } else if (requiredPatternForPredicate(relationship.predicate) !== composition.pattern) {
        addIssue(issues, 'treatment-relationship-pattern', `predicate ${relationship.predicate} 必须使用 ${requiredPatternForPredicate(relationship.predicate)}。`, `${location}.composition.pattern`);
      }
    }
  } else if (composition.relationship !== undefined) {
    addIssue(issues, 'treatment-free-relationship', 'free 组合不得声明 relationship。', `${location}.composition.relationship`);
  }

  if (treatment.graphic !== null && treatment.graphic !== undefined) {
    if (!GRAPHIC_KINDS.includes(treatment.graphic?.kind)) {
      addIssue(issues, 'treatment-graphic-kind', 'graphic.kind 必须是 text 或 shape。', `${location}.graphic.kind`);
    }
    if (!GRAPHIC_ANIMATIONS.includes(treatment.graphic?.animation)) {
      addIssue(issues, 'treatment-graphic-animation', 'graphic.animation 无效。', `${location}.graphic.animation`);
    }
  }

  const route = routeForChangeClass[treatment.changeClass];
  if (route?.motion && motion?.kind !== route.motion) {
    addIssue(issues, 'treatment-routing-motion', `${treatment.changeClass} 必须路由为 ${route.motion}。`, `${location}.motion.kind`);
  }
  if (route?.composition && composition?.pattern !== route.composition) {
    addIssue(issues, 'treatment-routing-composition', `${treatment.changeClass} 必须路由为 ${route.composition}。`, `${location}.composition.pattern`);
  }
  if (route?.graphic && !treatment.graphic) {
    addIssue(issues, 'treatment-routing-graphic', `${treatment.changeClass} 必须声明 graphic。`, `${location}.graphic`);
  }
  if (route?.proof && !nonEmpty(treatment.proofTimeId)) {
    addIssue(issues, 'treatment-routing-proof', `${treatment.changeClass} 必须绑定 proofTimeId。`, `${location}.proofTimeId`);
  }
  if (['identity', 'topology', 'mechanism', 'diagram'].includes(treatment.semanticRisk) && !nonEmpty(treatment.proofTimeId)) {
    addIssue(issues, 'treatment-risk-proof', `semanticRisk=${treatment.semanticRisk} 必须绑定 proofTimeId。`, `${location}.proofTimeId`);
  }
  return issues;
};

const compileScene = (scene) => {
  const patterns = new Set();
  const relationships = new Map();
  const stateFamilies = new Map();
  const continuousMotions = [];
  const visibilityEvents = [];
  const graphics = [];
  const treatments = [];

  for (const beat of scene.beats ?? []) {
    for (const treatment of beat.treatments ?? []) {
      treatments.push({...treatment, beatId: beat.id, at: beat.at});
      patterns.add(treatment.composition.pattern);
      const relationship = treatment.composition.relationship;
      if (relationship) {
        const compiled = {
          id: relationship.id,
          subject: treatment.targetId,
          predicate: relationship.predicate,
          object: relationship.object,
          proof: relationship.proof,
        };
        const prior = relationships.get(compiled.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(compiled)) {
          throw new Error(`关系 ${compiled.id} 在同一镜头中定义不一致。`);
        }
        relationships.set(compiled.id, compiled);
      }
      if (treatment.motion.kind === 'state-sequence') {
        const key = `${treatment.targetId}::${treatment.motion.poseFamilyId}`;
        const family = stateFamilies.get(key) ?? {
          nodeId: treatment.targetId,
          poseFamilyId: treatment.motion.poseFamilyId,
          states: [],
          playback: treatment.motion.playback,
          transition: treatment.motion.transition,
          necessity: treatment.necessity,
          importance: treatment.importance,
        };
        if (family.playback !== treatment.motion.playback || family.transition !== treatment.motion.transition) {
          throw new Error(`状态家族 ${key} 的 playback/transition 必须保持一致。`);
        }
        family.states.push({
          id: treatment.motion.stateId,
          at: beat.at,
          visualChange: treatment.motion.visualChange,
        });
        if (treatment.necessity === 'required') family.necessity = 'required';
        if (IMPORTANCE_SCORE[treatment.importance] > IMPORTANCE_SCORE[family.importance]) family.importance = treatment.importance;
        stateFamilies.set(key, family);
      }
      if (treatment.motion.kind === 'continuous-transform') {
        continuousMotions.push({
          id: treatment.id,
          nodeId: treatment.targetId,
          preset: treatment.motion.preset,
          at: beat.at,
          proofTimeId: treatment.proofTimeId ?? null,
        });
      }
      if (treatment.motion.kind === 'visibility-transition') {
        visibilityEvents.push({
          id: treatment.id,
          beatId: beat.id,
          nodeId: treatment.targetId,
          action: treatment.motion.action,
          transition: treatment.motion.transition,
          durationSeconds: treatment.motion.durationSeconds,
          at: beat.at,
          proofTimeId: treatment.proofTimeId ?? null,
        });
      }
      if (treatment.graphic) {
        graphics.push({
          id: treatment.id,
          nodeId: treatment.targetId,
          kind: treatment.graphic.kind,
          animation: treatment.graphic.animation,
          at: beat.at,
          proofTimeId: treatment.proofTimeId ?? null,
        });
      }
    }
  }

  const highestRisk = [...treatments].sort((left, right) =>
    treatmentRiskScore(right) - treatmentRiskScore(left) || left.id.localeCompare(right.id),
  )[0] ?? null;
  const compositionPlan = {
    patterns: [...patterns].sort(),
    relationships: [...relationships.values()].sort((left, right) => left.id.localeCompare(right.id)),
    stateSequences: [...stateFamilies.values()]
      .map(({necessity, importance, ...family}) => ({...family, states: [...family.states].sort((left, right) => left.at - right.at)}))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
    continuousMotions: continuousMotions.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)),
    visibilityEvents: visibilityEvents.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)),
    graphics: graphics.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id)),
  };
  const directing = {
    fingerprint: hashCompositionValue({sceneId: scene.id, beats: scene.beats, compositionPlan}),
    treatmentCount: treatments.length,
    riskScore: highestRisk ? treatmentRiskScore(highestRisk) : 0,
    highestRiskTreatmentId: highestRisk?.id ?? null,
  };
  return {...scene, compositionPlan, directing};
};

export const summarizeDirectingDemand = (scenes, motionBudget) => {
  const treatments = scenes.flatMap((scene) =>
    scene.beats.flatMap((beat) => beat.treatments.map((treatment) => ({
      ...treatment,
      sceneId: scene.id,
    }))),
  );
  const stateFamilyMap = new Map();
  for (const treatment of treatments.filter(({motion}) => motion.kind === 'state-sequence')) {
    const key = `${treatment.targetId}::${treatment.motion.poseFamilyId}`;
    const family = stateFamilyMap.get(key) ?? {
      targetId: treatment.targetId,
      poseFamilyId: treatment.motion.poseFamilyId,
      necessity: 'enhancement',
      stateIds: new Set(),
    };
    family.stateIds.add(treatment.motion.stateId);
    if (treatment.necessity === 'required') family.necessity = 'required';
    stateFamilyMap.set(key, family);
  }
  const families = [...stateFamilyMap.values()];
  const poseSheetPlans = families
    .map((family) => ({
      targetId: family.targetId,
      poseFamilyId: family.poseFamilyId,
      necessity: family.necessity,
      stateIds: [...family.stateIds],
      grid: family.stateIds.size <= 4
        ? {columns: 2, rows: 2}
        : {columns: 3, rows: 2},
      providerCalls: 1,
      repairPolicy: 'masked-edit-complete-sheet',
    }))
    .sort((left, right) => left.poseFamilyId.localeCompare(right.poseFamilyId));
  const uniqueContinuousTargets = new Set(
    treatments.filter(({motion}) => motion.kind === 'continuous-transform').map(({sceneId, targetId}) => `${sceneId}::${targetId}`),
  );
  return {
    requiredStateFamilies: families.filter(({necessity}) => necessity === 'required').length,
    enhancementStateFamilies: families.filter(({necessity}) => necessity === 'enhancement').length,
    totalStateFamilies: families.length,
    totalStates: families.reduce((sum, family) => sum + family.stateIds.size, 0),
    estimatedPoseSheetCalls: families.length,
    maxStatesInFamily: Math.max(0, ...families.map(({stateIds}) => stateIds.size)),
    continuousTargets: uniqueContinuousTargets.size,
    visibilityTargets: new Set(
      treatments.filter(({motion}) => motion.kind === 'visibility-transition').map(({sceneId, targetId}) => `${sceneId}::${targetId}`),
    ).size,
    graphicTreatments: treatments.filter(({graphic}) => Boolean(graphic)).length,
    coupledRelationships: scenes.reduce((sum, scene) => sum + scene.compositionPlan.relationships.length, 0),
    avoidedIsolatedStateCalls: families.reduce((sum, family) => sum + Math.max(0, family.stateIds.size - 1), 0),
    poseSheetPlans,
    budget: motionBudget,
  };
};

export const compileStoryboardDirecting = (storyboard, {plan} = {}) => {
  const issues = [];
  if (storyboard.directingSummary !== undefined) {
    addIssue(issues, 'storyboard-derived-summary', '输入不得手写 directingSummary；它由编译器生成。', 'directingSummary');
  }
  const treatmentIds = new Set();
  for (const [sceneIndex, scene] of (storyboard.scenes ?? []).entries()) {
    if (scene.compositionPlan !== undefined || scene.directing !== undefined) {
      addIssue(issues, 'storyboard-derived-fields', '输入不得手写 compositionPlan 或 directing；它们由编译器生成。', `scenes[${sceneIndex}]`);
    }
    for (const [beatIndex, beat] of (scene.beats ?? []).entries()) {
      const beatLocation = `scenes[${sceneIndex}].beats[${beatIndex}]`;
      if (!Array.isArray(beat.treatments) || beat.treatments.length === 0) {
        addIssue(issues, 'storyboard-beat-treatments', '每个节拍至少需要一个导演 treatment。', `${beatLocation}.treatments`);
      }
      for (const [treatmentIndex, treatment] of (beat.treatments ?? []).entries()) {
        const location = `${beatLocation}.treatments[${treatmentIndex}]`;
        issues.push(...validateTreatment(treatment, {location, beatAt: beat.at}));
        if (treatmentIds.has(treatment.id)) addIssue(issues, 'treatment-id-duplicate', `treatment id 重复：${treatment.id}`, `${location}.id`);
        treatmentIds.add(treatment.id);
        if (treatment.proofTimeId !== null && treatment.proofTimeId !== undefined && treatment.proofTimeId !== beat.proofTimeId) {
          addIssue(issues, 'treatment-proof-drift', 'treatment.proofTimeId 必须与所属 beat.proofTimeId 一致。', `${location}.proofTimeId`);
        }
      }
    }
  }
  if (issues.length > 0) {
    const error = new Error(issues.map(({location, message}) => `${location}: ${message}`).join('\n'));
    error.issues = issues;
    throw error;
  }

  let scenes;
  try {
    scenes = storyboard.scenes.map(compileScene);
  } catch (cause) {
    const error = new Error(cause.message);
    error.issues = [{code: 'storyboard-compile', message: cause.message, location: 'scenes'}];
    throw error;
  }
  const motionBudget = plan?.motionBudget ?? null;
  const demand = summarizeDirectingDemand(scenes, motionBudget);
  const budgetIssues = [];
  if (motionBudget) {
    if (demand.requiredStateFamilies > motionBudget.maxPoseSheetCalls) {
      addIssue(budgetIssues, 'directing-required-state-budget', `必需状态家族 ${demand.requiredStateFamilies} 个，超过 ${plan.productionProfile} 档位的 ${motionBudget.maxPoseSheetCalls} 次姿态母版调用上限；请提高档位或缩小故事范围。`, 'directingSummary.requiredStateFamilies');
    }
    if (demand.totalStateFamilies > motionBudget.maxPoseSheetCalls) {
      addIssue(budgetIssues, 'directing-state-budget', `状态家族共 ${demand.totalStateFamilies} 个，超过 ${motionBudget.maxPoseSheetCalls} 次姿态母版调用上限。先删除 enhancement，不得降级 required 动作。`, 'directingSummary.totalStateFamilies');
    }
    if (demand.maxStatesInFamily > motionBudget.maxStatesPerSheet) {
      addIssue(budgetIssues, 'directing-sheet-capacity', `单个状态家族需要 ${demand.maxStatesInFamily} 格，超过单张母版 ${motionBudget.maxStatesPerSheet} 格上限。`, 'directingSummary.maxStatesInFamily');
    }
    if (demand.continuousTargets > motionBudget.maxContinuousTargets) {
      addIssue(budgetIssues, 'directing-continuous-budget', `连续动效目标 ${demand.continuousTargets} 个，超过档位上限 ${motionBudget.maxContinuousTargets}。`, 'directingSummary.continuousTargets');
    }
  }
  if (budgetIssues.length > 0) {
    const error = new Error(budgetIssues.map(({location, message}) => `${location}: ${message}`).join('\n'));
    error.issues = budgetIssues;
    throw error;
  }
  const styleProofPlan = compileStyleProofPlan(scenes);
  const directingSummary = {
    profile: plan?.productionProfile ?? null,
    ...demand,
    styleProofPlan,
  };
  directingSummary.fingerprint = hashCompositionValue({
    scenes: scenes.map(({id, directing, compositionPlan}) => ({id, directing, compositionPlan})),
    sceneTransitions: storyboard.sceneTransitions,
    demand: {...directingSummary, budget: undefined, fingerprint: undefined},
  });
  return {...storyboard, scenes, directingSummary};
};

export const validateCompiledDirecting = (storyboard, {plan} = {}) => {
  try {
    const authoring = {
      ...storyboard,
      scenes: (storyboard.scenes ?? []).map(({compositionPlan, directing, ...scene}) => scene),
      directingSummary: undefined,
    };
    const compiled = compileStoryboardDirecting(authoring, {plan});
    const issues = [];
    for (const [index, scene] of compiled.scenes.entries()) {
      const actual = storyboard.scenes[index];
      if (JSON.stringify(actual.compositionPlan) !== JSON.stringify(scene.compositionPlan)) {
        addIssue(issues, 'storyboard-composition-plan-drift', 'compositionPlan 不是当前 treatments 的编译结果。', `scenes[${index}].compositionPlan`);
      }
      if (JSON.stringify(actual.directing) !== JSON.stringify(scene.directing)) {
        addIssue(issues, 'storyboard-directing-drift', 'directing 指纹或风险摘要已过期。', `scenes[${index}].directing`);
      }
    }
    if (JSON.stringify(storyboard.directingSummary) !== JSON.stringify(compiled.directingSummary)) {
      addIssue(issues, 'storyboard-directing-summary-drift', 'directingSummary 已过期。', 'directingSummary');
    }
    return issues;
  } catch (error) {
    return error.issues ?? [{code: 'storyboard-directing-invalid', message: error.message, location: 'scenes'}];
  }
};

const hasVisibleNodeMotion = (node) => {
  if (node?.motion?.idle && node.motion.idle.preset !== 'still' && node.motion.idle.intensity > 0) return true;
  const frames = node?.motion?.keyframes ?? [];
  if (frames.length < 2) return false;
  return ['x', 'y', 'scale', 'rotation', 'opacity'].some((property) => {
    const values = frames.map((frame) => frame[property]).filter((value) => value !== undefined);
    return values.length > 0 && new Set(values).size > 1;
  });
};

export const validateDirectingExecution = ({scene, storyboardScene, location = 'scene'}) => {
  const issues = [];
  const nodes = new Map(
    flattenCompositionNodes(scene?.composition?.nodes).map(({node}) => [node.id, node]),
  );
  for (const planned of storyboardScene?.compositionPlan?.continuousMotions ?? []) {
    if (planned.nodeId === 'scene-camera') {
      const cameraMoves = scene?.camera?.preset !== 'static' || (scene?.camera?.keyframes?.length ?? 0) >= 2;
      if (!cameraMoves) {
        addIssue(issues, 'directing-continuous-drift', `导演计划要求镜头运动 ${planned.id}，但 camera 为静止。`, `${location}.camera`);
      }
      continue;
    }
    const node = nodes.get(planned.nodeId);
    if (!node) {
      addIssue(issues, 'directing-target-missing', `导演计划的连续动效目标不存在：${planned.nodeId}。`, `${location}.composition`);
    } else if (!hasVisibleNodeMotion(node)) {
      addIssue(issues, 'directing-continuous-drift', `导演计划要求 ${planned.nodeId} 执行 ${planned.preset}，但节点没有可见关键帧或 idle。`, `${location}.composition.nodes#${planned.nodeId}.motion`);
    }
  }
  for (const planned of storyboardScene?.compositionPlan?.visibilityEvents ?? []) {
    const node = nodes.get(planned.nodeId);
    const event = (scene?.events ?? []).find((candidate) =>
      candidate.targetId === planned.nodeId &&
      candidate.beatId === planned.beatId &&
      Math.abs(candidate.at - planned.at) <= 0.035 &&
      candidate.visual?.kind === 'visibility' &&
      candidate.visual.action === planned.action &&
      candidate.visual.transition === planned.transition &&
      candidate.visual.durationSeconds === planned.durationSeconds,
    );
    if (!node) {
      addIssue(issues, 'directing-visibility-target-missing', `导演计划的可见性目标不存在：${planned.nodeId}。`, `${location}.composition`);
    } else if (!event) {
      addIssue(issues, 'directing-visibility-drift', `导演计划要求 ${planned.nodeId} 执行 ${planned.action}/${planned.transition}，项目没有对应 visibility event。`, `${location}.events`);
    } else if (planned.action === 'show' && node.visibility?.initial !== 'hidden' && !(scene.events ?? []).some((candidate) => candidate.targetId === planned.nodeId && candidate.at < planned.at && candidate.visual?.kind === 'visibility' && candidate.visual.action === 'hide')) {
      addIssue(issues, 'directing-visibility-initial', `首次 show 前 ${planned.nodeId} 必须初始隐藏或先执行 hide。`, `${location}.composition.nodes#${planned.nodeId}.visibility`);
    }
  }
  for (const planned of storyboardScene?.compositionPlan?.graphics ?? []) {
    const node = nodes.get(planned.nodeId);
    if (!node) {
      addIssue(issues, 'directing-graphic-missing', `导演计划的图形目标不存在：${planned.nodeId}。`, `${location}.composition`);
    } else if (node.kind !== planned.kind) {
      addIssue(issues, 'directing-graphic-kind', `图形目标 ${planned.nodeId} 必须实现为 ${planned.kind}，当前为 ${node.kind}。`, `${location}.composition.nodes#${planned.nodeId}.kind`);
    } else if (!hasVisibleNodeMotion(node)) {
      addIssue(issues, 'directing-graphic-motion', `图形目标 ${planned.nodeId} 必须实现 ${planned.animation} 动效。`, `${location}.composition.nodes#${planned.nodeId}.motion`);
    }
  }
  return issues;
};

export const selectStyleProofTarget = (storyboard) => {
  return storyboard?.directingSummary?.styleProofPlan?.targets?.[0] ?? null;
};

export const selectStyleProofTargets = (storyboard) =>
  storyboard?.directingSummary?.styleProofPlan?.targets ?? [];
