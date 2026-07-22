import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveSceneTimeline,
  deriveTransitionProofSamples,
  resolveSceneTransitionPresentation,
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

test('timeline overlaps only the declared boundary window and never fades whole scenes', () => {
  const project = {
    video: {fps: 10},
    scenes: [scene('one'), scene('two')],
    sceneTransitions: [{
      id: 'one-to-two',
      fromSceneId: 'one',
      toSceneId: 'two',
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

test('dip-to-paper swaps semantic scenes only while the paper cover is opaque', () => {
  const transition = {type: 'dip-to-paper', durationInFrames: 11};
  const before = resolveSceneTransitionPresentation({transition, frame: 4});
  const covered = resolveSceneTransitionPresentation({transition, frame: 5});
  const after = resolveSceneTransitionPresentation({transition, frame: 6});
  assert.equal(before.incomingVisible, false);
  assert.equal(covered.incomingVisible, false);
  assert.equal(covered.paperOpacity, 1);
  assert.equal(after.incomingVisible, true);
  assert.ok(after.paperOpacity < 1);
});
