import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SCENE_TRANSITION_TYPES,
  TRANSITION_RECIPES,
  deriveSceneTimeline,
  deriveTransitionProofSamples,
  materializeSceneTransitionRecipes,
  resolveSceneTransitionPresentation,
  summarizeSceneTransitions,
  validateSceneTransitionSequence,
} from '../src/sceneTimeline.mjs';
import {
  resolveVisibilityState,
  validateVisibilityLifecycle,
} from '../src/visibilityLifecycle.mjs';

const visibilityEvent = ({id, at, action, transition = 'fade-rise', durationSeconds = 1}) => ({
  id,
  beatId: id,
  at,
  targetId: 'subject',
  visual: {kind: 'visibility', action, transition, durationSeconds},
});

test('visibility lifecycle stays hidden before show and visible after it completes', () => {
  const events = [visibilityEvent({id: 'show', at: 0.2, action: 'show'})];
  assert.equal(resolveVisibilityState({events, targetId: 'subject', initial: 'hidden', progress: 0, durationSeconds: 10}).opacity, 0);
  assert.equal(resolveVisibilityState({events, targetId: 'subject', initial: 'hidden', progress: 0.2, durationSeconds: 10}).opacity, 0);
  const during = resolveVisibilityState({events, targetId: 'subject', initial: 'hidden', progress: 0.25, durationSeconds: 10});
  assert.ok(during.opacity > 0 && during.opacity < 1);
  assert.ok(during.y > 0);
  assert.equal(resolveVisibilityState({events, targetId: 'subject', initial: 'hidden', progress: 0.31, durationSeconds: 10}).opacity, 1);
  assert.equal(resolveVisibilityState({events, targetId: 'subject', initial: 'hidden', progress: 0.95, durationSeconds: 10}).opacity, 1);
});

test('visibility lifecycle supports deterministic hide and later show without transient reset', () => {
  const events = [
    visibilityEvent({id: 'hide', at: 0.2, action: 'hide', transition: 'cut', durationSeconds: 0}),
    visibilityEvent({id: 'show', at: 0.6, action: 'show', transition: 'fade-scale', durationSeconds: 0.5}),
  ];
  assert.equal(resolveVisibilityState({events, targetId: 'subject', progress: 0.1, durationSeconds: 5}).opacity, 1);
  assert.equal(resolveVisibilityState({events, targetId: 'subject', progress: 0.3, durationSeconds: 5}).opacity, 0);
  const during = resolveVisibilityState({events, targetId: 'subject', progress: 0.65, durationSeconds: 5});
  assert.ok(during.opacity > 0 && during.opacity < 1);
  assert.ok(during.scale > 0.92 && during.scale < 1);
  assert.equal(resolveVisibilityState({events, targetId: 'subject', progress: 0.8, durationSeconds: 5}).opacity, 1);
});

test('visibility lifecycle rejects overlapping, simultaneous, and overflowing state changes', () => {
  const issues = validateVisibilityLifecycle({
    events: [
      visibilityEvent({id: 'hide', at: 0.2, action: 'hide', durationSeconds: 2}),
      visibilityEvent({id: 'show', at: 0.3, action: 'show', durationSeconds: 1}),
      visibilityEvent({id: 'hide-again', at: 0.3, action: 'hide', durationSeconds: 4}),
    ],
    targetInitialStates: {subject: 'visible'},
    durationSeconds: 5,
  });
  assert.ok(issues.some(({code}) => code === 'scene-event-visibility-overlap'));
  assert.ok(issues.some(({code}) => code === 'scene-event-visibility-overflow'));
});

const scene = (id, {tailSeconds = 0.6, narrationStart = 0.6, narrationDuration = 2} = {}) => ({
  id,
  tailSeconds,
  narration: {startSeconds: narrationStart, durationSeconds: narrationDuration},
});

test('scene boundary validation requires one adjacent contract and enough opaque-transition budget', () => {
  const scenes = [scene('one'), scene('two')];
  const transition = {
    id: 'one-to-two',
    fromSceneId: 'one',
    toSceneId: 'two',
    intent: 'chapter-reset',
    rationale: 'Close one chapter before revealing the next.',
    type: 'dip-to-paper',
    durationSeconds: 0.6,
  };
  assert.deepEqual(validateSceneTransitionSequence({scenes, sceneTransitions: [transition]}), []);
  const invalid = validateSceneTransitionSequence({
    scenes: [scene('one', {tailSeconds: 0.2}), scene('two', {narrationStart: 0.2})],
    sceneTransitions: [{...transition, toSceneId: 'wrong'}],
  });
  assert.ok(invalid.some(({code}) => code === 'scene-transition-adjacency'));
  assert.ok(invalid.some(({code}) => code === 'scene-transition-tail-budget'));
  assert.ok(invalid.some(({code}) => code === 'scene-transition-narration-lead'));
});

test('scene boundary routing reserves cut for an authored impact and requires rationale', () => {
  const scenes = [scene('one'), scene('two')];
  const impactCut = {
    id: 'one-to-two',
    fromSceneId: 'one',
    toSceneId: 'two',
    intent: 'impact-cut',
    rationale: 'The sudden discovery needs one deliberate visual shock.',
    type: 'cut',
    durationSeconds: 0,
  };
  assert.deepEqual(validateSceneTransitionSequence({scenes, sceneTransitions: [impactCut]}), []);
  assert.ok(validateSceneTransitionSequence({
    scenes,
    sceneTransitions: [{...impactCut, intent: 'continuity'}],
  }).some(({code}) => code === 'scene-transition-intent-type'));
  assert.ok(validateSceneTransitionSequence({
    scenes,
    sceneTransitions: [{...impactCut, rationale: ''}],
  }).some(({code}) => code === 'scene-transition-rationale'));
});

test('every editorial intent has a valid deterministic default recipe and only impact defaults to cut', () => {
  const scenes = [scene('one', {tailSeconds: 1}), scene('two', {narrationStart: 1})];
  const entries = Object.entries(TRANSITION_RECIPES);
  assert.equal(entries.length, 6);
  for (const [intent, recipe] of entries) {
    const transition = {
      id: 'one-to-two',
      fromSceneId: 'one',
      toSceneId: 'two',
      intent,
      rationale: `Use the registered ${intent} recipe.`,
      ...recipe,
    };
    assert.deepEqual(validateSceneTransitionSequence({scenes, sceneTransitions: [transition]}), []);
    assert.equal(recipe.type === 'cut', intent === 'impact-cut');
  }
  assert.deepEqual(SCENE_TRANSITION_TYPES, [
    'cut',
    'paper-wipe',
    'dip-to-paper',
    'paper-slide',
    'torn-wipe',
    'paper-iris',
    'page-turn',
    'paper-shutters',
  ]);
});

test('intent-only storyboard boundaries materialize a recipe while explicit execution stays unchanged', () => {
  const intentOnly = {
    id: 'one-to-two',
    fromSceneId: 'one',
    toSceneId: 'two',
    intent: 'time-passage',
    rationale: 'Turn the paper page to express elapsed time.',
  };
  assert.deepEqual(materializeSceneTransitionRecipes([intentOnly]), [{
    ...intentOnly,
    type: 'page-turn',
    durationSeconds: 0.7,
    direction: 'right-to-left',
  }]);
  const explicit = {...intentOnly, type: 'torn-wipe', durationSeconds: 0.5, direction: 'bottom-to-top'};
  assert.equal(materializeSceneTransitionRecipes([explicit])[0], explicit);
});

test('transition reporting exposes animated coverage, cut ratio, types, and intents', () => {
  assert.deepEqual(summarizeSceneTransitions([
    {intent: 'continuity', type: 'paper-slide'},
    {intent: 'continuity', type: 'paper-slide'},
    {intent: 'impact-cut', type: 'cut'},
  ]), {
    total: 3,
    animatedCount: 2,
    cutCount: 1,
    cutRatio: 1 / 3,
    typeCounts: {cut: 1, 'paper-slide': 2},
    intentCounts: {continuity: 2, 'impact-cut': 1},
  });
});

test('timeline overlaps only the declared boundary window and never fades whole scenes', () => {
  const project = {
    video: {fps: 10},
    scenes: [scene('one'), scene('two')],
    sceneTransitions: [{
      id: 'one-to-two',
      fromSceneId: 'one',
      toSceneId: 'two',
      intent: 'location-change',
      rationale: 'A paper edge pushes the story into the next location.',
      type: 'paper-wipe',
      durationSeconds: 0.6,
      direction: 'left-to-right',
    }],
  };
  const timeline = deriveSceneTimeline(project);
  assert.equal(timeline.scenes[0].exitTransitionFrames, 6);
  assert.equal(timeline.scenes[1].enterTransitionFrames, 6);
  assert.equal(timeline.scenes[1].from, timeline.scenes[0].durationInFrames - 6);
  const mid = resolveSceneTransitionPresentation({transition: timeline.transitions[0], frame: 3});
  assert.equal(mid.incomingVisible, true);
  assert.equal(mid.paperOpacity, 0);
  assert.match(mid.incomingClipPath, /^inset\(/);
  const samples = deriveTransitionProofSamples({timeline, fps: 10, durationSeconds: timeline.durationSeconds});
  assert.deepEqual(samples.map(({progress}) => progress), [0.25, 0.5, 0.75]);
});

test('spatial paper transitions reveal opaque incoming scenes without semantic alpha blending', () => {
  const slideStart = resolveSceneTransitionPresentation({
    transition: {type: 'paper-slide', direction: 'right-to-left', durationInFrames: 21},
    frame: 0,
  });
  const slideEnd = resolveSceneTransitionPresentation({
    transition: {type: 'paper-slide', direction: 'right-to-left', durationInFrames: 21},
    frame: 20,
  });
  assert.equal(slideStart.incomingTransform, 'translate3d(100%, 0, 0)');
  assert.equal(slideEnd.incomingTransform, 'translate3d(0%, 0, 0)');
  assert.equal(slideStart.paperOpacity, 0);

  const torn = resolveSceneTransitionPresentation({
    transition: {type: 'torn-wipe', direction: 'left-to-right', durationInFrames: 21},
    frame: 10,
  });
  assert.match(torn.incomingClipPath, /^polygon\(/);
  assert.equal(torn.tornEdgePoints.length, 9);
  assert.equal(torn.paperOpacity, 0);

  const irisStart = resolveSceneTransitionPresentation({transition: {type: 'paper-iris', durationInFrames: 21}, frame: 0});
  const irisEnd = resolveSceneTransitionPresentation({transition: {type: 'paper-iris', durationInFrames: 21}, frame: 20});
  assert.equal(irisStart.incomingClipPath, 'circle(0% at 50% 50%)');
  assert.equal(irisEnd.incomingClipPath, 'circle(72% at 50% 50%)');

  const pageMiddle = resolveSceneTransitionPresentation({
    transition: {type: 'page-turn', direction: 'right-to-left', durationInFrames: 21},
    frame: 10,
  });
  assert.equal(pageMiddle.incomingClipPath, 'inset(0 0 0 50%)');
  assert.ok(pageMiddle.pageTurnFold > 0.99);
});

test('cover transitions swap semantic scenes during a guaranteed opaque plateau', () => {
  for (const type of ['dip-to-paper', 'paper-shutters']) {
    const transition = {type, durationInFrames: 21};
    const before = resolveSceneTransitionPresentation({transition, frame: 8});
    const covered = resolveSceneTransitionPresentation({transition, frame: 10});
    const after = resolveSceneTransitionPresentation({transition, frame: 12});
    const cover = (state) => type === 'dip-to-paper' ? state.paperOpacity : state.shutterClosure;
    assert.equal(before.incomingVisible, false);
    assert.equal(covered.incomingVisible, true);
    assert.equal(cover(covered), 1);
    assert.equal(after.incomingVisible, true);
    assert.ok(cover(after) < 1);
  }
});
