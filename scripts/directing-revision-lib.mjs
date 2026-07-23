import {hashCompositionValue} from './composition-lib.mjs';
import {transitionDirectingRevision} from './production-state.mjs';
import {
  compileStoryboardDirecting,
  validateStoryboard,
} from './storyboard-lib.mjs';
import {materializeSceneTransitionRecipes} from '../src/sceneTimeline.mjs';

const sceneConcept = (scene) => ({
  id: scene.id,
  title: scene.title,
  narrativeRole: scene.narrativeRole,
  message: scene.message,
  blueprint: scene.blueprint,
  beats: (scene.beats ?? []).map((beat) => ({
    id: beat.id,
    purpose: beat.purpose,
    visual: beat.visual,
    audioCue: beat.audioCue,
  })),
  proofs: (scene.proofTimes ?? []).map((proof) => ({
    id: proof.id,
    label: proof.label,
    kind: proof.kind,
    assertions: proof.assertions,
    stateAssertions: proof.stateAssertions,
  })),
});

export const storyboardConceptFingerprint = (storyboard) =>
  hashCompositionValue({
    arc: storyboard.arc,
    style: storyboard.style,
    scenes: (storyboard.scenes ?? []).map(sceneConcept),
  });

export const storyboardAuthoringFromCompiled = (storyboard) => ({
  ...storyboard,
  editorial: storyboard.editorial
    ? Object.fromEntries(
        Object.entries(storyboard.editorial).filter(
          ([key]) => !['resolvedEditPoints', 'conflicts', 'responsivePlans', 'transitionPlans', 'fingerprint'].includes(key),
        ),
      )
    : storyboard.editorial,
  scenes: (storyboard.scenes ?? []).map(({compositionPlan, directing, ...scene}) => scene),
  directingSummary: undefined,
});

const changedCategories = (before, after) => {
  const categories = [];
  const differs = (left, right) =>
    hashCompositionValue(left) !== hashCompositionValue(right);
  if (before.estimatedDurationSeconds !== after.estimatedDurationSeconds) {
    categories.push('estimated-duration');
  }
  if (differs(before.beats?.map(({at}) => at), after.beats?.map(({at}) => at))) {
    categories.push('beat-timing');
  }
  if (differs(before.beats?.map(({treatments}) => treatments), after.beats?.map(({treatments}) => treatments))) {
    categories.push('treatments');
  }
  if (differs(before.proofTimes?.map(({at}) => at), after.proofTimes?.map(({at}) => at))) {
    categories.push('proof-timing');
  }
  if (differs(before.compositionPlan, after.compositionPlan)) categories.push('compiled-plan');
  if (before.directing?.fingerprint !== after.directing?.fingerprint) {
    categories.push('directing-fingerprint');
  }
  return categories;
};

const styleProofTarget = (storyboard) => {
  const plan = storyboard.directingSummary?.styleProofPlan ?? null;
  return plan ? {fingerprint: plan.fingerprint, targets: plan.targets} : null;
};

export const prepareDirectingRevision = ({
  currentStoryboard,
  suppliedStoryboard,
  plan,
  production,
  reportPath,
  at = new Date().toISOString(),
}) => {
  const authored = storyboardAuthoringFromCompiled(suppliedStoryboard);
  const candidate = compileStoryboardDirecting({
    ...authored,
    $schema: '../../schemas/storyboard.schema.json',
    schemaVersion: 9,
    slug: currentStoryboard.slug,
    status: 'ready',
    sceneTransitions: materializeSceneTransitionRecipes(authored.sceneTransitions),
    updatedAt: at,
  }, {plan});

  const issues = validateStoryboard(candidate, {slug: currentStoryboard.slug, plan});
  if (issues.length > 0) {
    throw new Error(issues.map(({location, message}) => `${location}: ${message}`).join('\n'));
  }
  const beforeConcept = storyboardConceptFingerprint(currentStoryboard);
  const afterConcept = storyboardConceptFingerprint(candidate);
  if (beforeConcept !== afterConcept) {
    throw new Error('导演重编不得改变已批准的故事概念、风格、镜头语义、节拍语义或证明断言。');
  }

  const previousScenes = new Map(currentStoryboard.scenes.map((scene) => [scene.id, scene]));
  const changedScenes = candidate.scenes
    .map((scene) => ({
      sceneId: scene.id,
      categories: changedCategories(previousScenes.get(scene.id), scene),
    }))
    .filter(({categories}) => categories.length > 0);
  const changedSceneIds = new Set(changedScenes.map(({sceneId}) => sceneId));
  const transitionsChanged = hashCompositionValue(currentStoryboard.sceneTransitions) !==
    hashCompositionValue(candidate.sceneTransitions);
  const editorialChanged =
    currentStoryboard.editorial?.fingerprint !== candidate.editorial?.fingerprint;
  if (transitionsChanged) {
    for (const transition of candidate.sceneTransitions ?? []) {
      changedSceneIds.add(transition.fromSceneId);
      changedSceneIds.add(transition.toSceneId);
    }
  }
  if (editorialChanged) {
    for (const scene of candidate.scenes) changedSceneIds.add(scene.id);
  }
  if (changedSceneIds.size === 0) {
    throw new Error('导演重编没有产生任何实际变化。');
  }

  const beforeStyleTarget = styleProofTarget(currentStoryboard);
  const afterStyleTarget = styleProofTarget(candidate);
  const invalidateStyleProof = hashCompositionValue(beforeStyleTarget) !==
    hashCompositionValue(afterStyleTarget);
  const report = {
    schemaVersion: 1,
    slug: currentStoryboard.slug,
    createdAt: at,
    oldDirectingFingerprint: currentStoryboard.directingSummary?.fingerprint ?? null,
    newDirectingFingerprint: candidate.directingSummary?.fingerprint ?? null,
    protectedConceptFingerprint: beforeConcept,
    changedSceneIds: [...changedSceneIds].sort(),
    changedScenes,
    transitionsChanged,
    editorialChanged,
    editPointChanges: {
      before: currentStoryboard.editorial?.resolvedEditPoints ?? [],
      after: candidate.editorial?.resolvedEditPoints ?? [],
    },
    responsivePlanChanges: {
      beforeFingerprint: hashCompositionValue(currentStoryboard.editorial?.responsivePlans ?? []),
      afterFingerprint: hashCompositionValue(candidate.editorial?.responsivePlans ?? []),
    },
    executionSyncRequired: true,
    providerApprovalRequired: false,
    motionBudget: {
      approved: plan.motionBudget ?? null,
      before: currentStoryboard.directingSummary?.budget ?? null,
      after: candidate.directingSummary?.budget ?? null,
    },
    styleProof: {
      before: beforeStyleTarget,
      after: afterStyleTarget,
      invalidated: invalidateStyleProof,
    },
    invalidatedArtifacts: [
      'validationReport',
      'preview',
      'final',
      'report',
      'contactSheet',
      ...(invalidateStyleProof ? ['styleProof'] : []),
    ],
  };
  const nextProduction = transitionDirectingRevision(production, {
    changedSceneIds: report.changedSceneIds,
    invalidateStyleProof,
    reportPath,
    at,
  });
  return {storyboard: candidate, production: nextProduction, report};
};
