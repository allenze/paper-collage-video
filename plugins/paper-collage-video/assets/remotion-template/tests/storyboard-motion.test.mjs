import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORY_BLUEPRINTS,
  compileStoryboardDirecting,
  summarizeStoryboard,
  validateStoryboard,
} from '../scripts/storyboard-lib.mjs';
import {buildCreativePlan} from '../scripts/creative-plan-lib.mjs';
import {selectStyleProofTarget, validateDirectingExecution} from '../scripts/motion-treatment-lib.mjs';
import {proofOverlapsTransition} from '../scripts/project-lib.mjs';

const plan = (profile = 'balanced') => buildCreativePlan({
  slug: 'rhythm-test',
  durationSeconds: 6,
  sceneCount: 1,
  productionProfile: profile,
  rationale: 'test',
  at: '2026-07-20T00:00:00.000Z',
});

const staticTreatment = ({id, targetId = 'subject', proofTimeId = null}) => ({
  id,
  targetId,
  importance: 'supporting',
  necessity: 'required',
  changeClass: 'static-hold',
  motion: {kind: 'static'},
  composition: {pattern: 'free'},
  graphic: null,
  semanticRisk: 'decorative',
  proofTimeId,
  rationale: 'A still hold keeps this beat readable.',
});

const authoredStoryboard = () => ({
  schemaVersion: 4,
  slug: 'rhythm-test',
  status: 'ready',
  arc: 'A clear setup, action, and resolution.',
  style: {
    visualThesis: 'Paper depth makes causality visible.',
    compositionRules: ['Keep the focal subject readable.'],
    motionLanguage: ['Establish, trigger, settle.'],
    layerStrategy: 'Separate environment, subject, and foreground paper.',
  },
  scenes: [
    {
      id: 'scene-01',
      title: 'The reveal',
      narrativeRole: 'setup',
      message: 'A subject enters a layered world.',
      blueprint: 'layered-reveal',
      estimatedDurationSeconds: 6,
      beats: [
        {
          id: 'establish', at: 0, purpose: 'place', visual: 'Empty paper world', audioCue: null, proofTimeId: null,
          treatments: [staticTreatment({id: 'hold-stage', targetId: 'stage'})],
        },
        {
          id: 'action', at: 0.48, purpose: 'act', visual: 'Subject lands on stage', audioCue: 'paper lift', proofTimeId: 'proof-action',
          treatments: [{
            id: 'land-on-stage',
            targetId: 'subject',
            importance: 'hero',
            necessity: 'required',
            changeClass: 'contact-change',
            motion: {kind: 'static'},
            composition: {
              pattern: 'supported-subject',
              relationship: {id: 'subject-on-stage', predicate: 'on', object: 'stage', proof: 'The subject visibly contacts the stage'},
            },
            graphic: null,
            semanticRisk: 'topology',
            proofTimeId: 'proof-action',
            rationale: 'Contact must remain intact while the stage moves.',
          }],
        },
        {
          id: 'settle', at: 0.9, purpose: 'resolve', visual: 'Composition locks', audioCue: null, proofTimeId: null,
          treatments: [staticTreatment({id: 'hold-final'})],
        },
      ],
      proofTimes: [
        {id: 'proof-establish', at: 0.08, label: 'World established', kind: 'establish', assertions: ['The stage is readable'], stateAssertions: []},
        {id: 'proof-action', at: 0.5, label: 'Action peaks', kind: 'peak', assertions: ['The subject contacts the stage'], stateAssertions: []},
        {id: 'proof-final', at: 0.9, label: 'Composition resolves', kind: 'final', assertions: ['The final relationship is stable'], stateAssertions: []},
      ],
    },
  ],
  updatedAt: '2026-07-20T00:00:00.000Z',
});

const readyStoryboard = (profile = 'balanced') =>
  compileStoryboardDirecting(authoredStoryboard(), {plan: plan(profile)});

test('storyboard blueprints form a bounded authoring vocabulary', () => {
  assert.deepEqual(STORY_BLUEPRINTS, [
    'layered-reveal',
    'map-journey',
    'archive-stack',
    'character-procession',
    'discovery-wipe',
    'transformation-tableau',
    'chapter-tableau',
    'quiet-lockup',
  ]);
});

test('v4 compiles treatments into composition plans, risk selection, and cost evidence', () => {
  const storyboard = readyStoryboard();
  assert.deepEqual(validateStoryboard(storyboard, {slug: 'rhythm-test', plan: plan()}), []);
  assert.deepEqual(storyboard.scenes[0].compositionPlan.patterns, ['free', 'supported-subject']);
  assert.equal(storyboard.scenes[0].compositionPlan.relationships[0].predicate, 'on');
  assert.match(storyboard.scenes[0].directing.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(selectStyleProofTarget(storyboard), {
    sceneId: 'scene-01',
    treatmentId: 'land-on-stage',
    targetId: 'subject',
    riskScore: 46,
    directingFingerprint: storyboard.scenes[0].directing.fingerprint,
  });

  const summary = summarizeStoryboard(storyboard);
  assert.equal(summary.sceneCount, 1);
  assert.equal(summary.scenes[0].treatmentCount, 3);
  assert.equal(summary.directing.estimatedPoseSheetCalls, 0);
  assert.equal(summary.directing.styleProofTreatmentId, 'land-on-stage');
});

test('compiled composition plans and fingerprints cannot drift from treatments', () => {
  const storyboard = readyStoryboard();
  storyboard.scenes[0].compositionPlan.patterns = ['free'];
  storyboard.scenes[0].directing.fingerprint = '0'.repeat(64);
  const issues = validateStoryboard(storyboard, {slug: 'rhythm-test', plan: plan()});
  assert.ok(issues.some(({code}) => code === 'storyboard-composition-plan-drift'));
  assert.ok(issues.some(({code}) => code === 'storyboard-directing-drift'));
});

test('routing rejects pose changes that are disguised as cheap transforms', () => {
  const authored = authoredStoryboard();
  authored.scenes[0].beats[1].treatments[0] = {
    ...authored.scenes[0].beats[1].treatments[0],
    changeClass: 'pose-change',
    motion: {kind: 'continuous-transform', preset: 'bounce'},
  };
  assert.throws(
    () => compileStoryboardDirecting(authored, {plan: plan()}),
    /pose-change 必须路由为 state-sequence/,
  );
});

test('question marks and circles route to editable graphics without pose-sheet cost', () => {
  const authored = authoredStoryboard();
  authored.scenes[0].beats[1].treatments = [{
    id: 'bounce-question-mark',
    targetId: 'question-mark',
    importance: 'supporting',
    necessity: 'enhancement',
    changeClass: 'graphic-emphasis',
    motion: {kind: 'continuous-transform', preset: 'bounce'},
    composition: {pattern: 'free'},
    graphic: {kind: 'shape', animation: 'bounce'},
    semanticRisk: 'decorative',
    proofTimeId: 'proof-action',
    rationale: 'A live shape is cheaper and sharper than a new character pose.',
  }];
  const storyboard = compileStoryboardDirecting(authored, {plan: plan()});
  assert.deepEqual(storyboard.scenes[0].compositionPlan.graphics, [{
    id: 'bounce-question-mark',
    nodeId: 'question-mark',
    kind: 'shape',
    animation: 'bounce',
    at: 0.48,
    proofTimeId: 'proof-action',
  }]);
  assert.equal(storyboard.directingSummary.estimatedPoseSheetCalls, 0);
  assert.equal(storyboard.directingSummary.continuousTargets, 1);
  const runtimeScene = {
    camera: {preset: 'static'},
    composition: {nodes: [{
      id: 'question-mark', kind: 'shape',
      motion: {keyframes: [{at: 0, y: 0}, {at: 1, y: -0.04}]},
    }]},
  };
  assert.deepEqual(validateDirectingExecution({
    scene: runtimeScene,
    storyboardScene: storyboard.scenes[0],
  }), []);
  runtimeScene.composition.nodes[0].motion.keyframes[1].y = 0;
  assert.ok(validateDirectingExecution({
    scene: runtimeScene,
    storyboardScene: storyboard.scenes[0],
  }).some(({code}) => code === 'directing-continuous-drift'));
});

test('Cao Chong-style hero actions compile to one context-preserving pose sheet', () => {
  const authored = authoredStoryboard();
  const scene = authored.scenes[0];
  scene.beats[0].proofTimeId = 'proof-establish';
  scene.beats[0].treatments = [{
    id: 'cao-hold-book', targetId: 'cao', importance: 'hero', necessity: 'required',
    changeClass: 'pose-change',
    motion: {kind: 'state-sequence', poseFamilyId: 'cao-actions', stateId: 'holding-book', visualChange: 'Cao holds the open book', playback: 'once', transition: 'cut'},
    composition: {pattern: 'free'}, graphic: null, semanticRisk: 'identity', proofTimeId: 'proof-establish', rationale: 'Start the hero pose family on the common canvas.',
  }];
  scene.beats[1].treatments = [{
    id: 'cao-point-board', targetId: 'cao', importance: 'hero', necessity: 'required',
    changeClass: 'pose-change',
    motion: {kind: 'state-sequence', poseFamilyId: 'cao-actions', stateId: 'pointing-board', visualChange: 'Cao points at the board', playback: 'once', transition: 'cut'},
    composition: {pattern: 'free'}, graphic: null, semanticRisk: 'identity', proofTimeId: 'proof-action', rationale: 'A real limb change needs a registered state, not rotation.',
  }];
  scene.proofTimes[0].stateAssertions = [{nodeId: 'cao', stateId: 'holding-book'}];
  scene.proofTimes[1].stateAssertions = [{nodeId: 'cao', stateId: 'pointing-board'}];
  const storyboard = compileStoryboardDirecting(authored, {plan: plan('draft')});
  assert.equal(storyboard.scenes[0].compositionPlan.stateSequences.length, 1);
  assert.deepEqual(
    storyboard.scenes[0].compositionPlan.stateSequences[0].states.map(({id}) => id),
    ['holding-book', 'pointing-board'],
  );
  assert.equal(storyboard.directingSummary.estimatedPoseSheetCalls, 1);
  assert.equal(storyboard.directingSummary.avoidedIsolatedStateCalls, 1);
  assert.deepEqual(storyboard.directingSummary.poseSheetPlans, [{
    targetId: 'cao',
    poseFamilyId: 'cao-actions',
    necessity: 'required',
    stateIds: ['holding-book', 'pointing-board'],
    grid: {columns: 2, rows: 2},
    providerCalls: 1,
    repairPolicy: 'masked-edit-complete-sheet',
  }]);
  assert.deepEqual(validateStoryboard(storyboard, {slug: 'rhythm-test', plan: plan('draft')}), []);
});

test('required hero state families cannot be silently downgraded to fit draft budget', () => {
  const authored = authoredStoryboard();
  const scene = authored.scenes[0];
  scene.beats[0].proofTimeId = 'proof-establish';
  scene.beats[0].treatments = ['cao', 'elephant'].map((targetId) => ({
    id: `${targetId}-start`, targetId, importance: 'hero', necessity: 'required', changeClass: 'pose-change',
    motion: {kind: 'state-sequence', poseFamilyId: `${targetId}-actions`, stateId: 'start', visualChange: 'Start pose', playback: 'once', transition: 'cut'},
    composition: {pattern: 'free'}, graphic: null, semanticRisk: 'identity', proofTimeId: 'proof-establish', rationale: 'Required opening state.',
  }));
  scene.beats[1].treatments = ['cao', 'elephant'].map((targetId) => ({
    id: `${targetId}-finish`, targetId, importance: 'hero', necessity: 'required', changeClass: 'pose-change',
    motion: {kind: 'state-sequence', poseFamilyId: `${targetId}-actions`, stateId: 'finish', visualChange: 'Finish pose', playback: 'once', transition: 'cut'},
    composition: {pattern: 'free'}, graphic: null, semanticRisk: 'identity', proofTimeId: 'proof-action', rationale: 'Required final state.',
  }));
  scene.proofTimes[0].stateAssertions = ['cao', 'elephant'].map((nodeId) => ({nodeId, stateId: 'start'}));
  scene.proofTimes[1].stateAssertions = ['cao', 'elephant'].map((nodeId) => ({nodeId, stateId: 'finish'}));
  assert.throws(
    () => compileStoryboardDirecting(authored, {plan: plan('draft')}),
    /请提高档位或缩小故事范围/,
  );
});

test('ready storyboards require ordered beats, final proof, and plan alignment', () => {
  const storyboard = readyStoryboard();
  storyboard.scenes[0].beats[1].at = 0;
  storyboard.scenes[0].proofTimes[2] = {
    id: 'proof-final', at: 0.7, label: 'Too early', kind: 'final', assertions: ['Too early'], stateAssertions: [],
  };
  const issues = validateStoryboard(storyboard, {slug: 'rhythm-test', plan: plan()});
  assert.ok(issues.some(({code}) => code === 'storyboard-beat-time'));
  assert.ok(issues.some(({code}) => code === 'storyboard-final-proof'));
});

test('v4 storyboard audio beats require an approved event-level proof', () => {
  const storyboard = readyStoryboard();
  storyboard.scenes[0].beats[1].proofTimeId = null;
  assert.ok(validateStoryboard(storyboard, {slug: 'rhythm-test', plan: plan()})
    .some(({code}) => code === 'storyboard-audio-proof-required'));
});

test('motion proof moments cannot be hidden inside fade transitions', () => {
  assert.equal(proofOverlapsTransition({at: 0.08, transitionFrames: 12, durationInFrames: 300}), false);
  assert.equal(proofOverlapsTransition({at: 0.95, transitionFrames: 30, durationInFrames: 300}), true);
});
