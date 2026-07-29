import assert from 'node:assert/strict';
import test from 'node:test';
import {collectCompositeQualityTargets} from '../scripts/quality-lib.mjs';
import {
  inspectSpatialContract,
  validateStoryboardSpatialContracts,
} from '../scripts/spatial-contract-lib.mjs';

const still = {
  keyframes: [
    {at: 0, offsetX: 0, offsetY: 0},
    {at: 1, offsetX: 0, offsetY: 0},
  ],
};

const transform = ({
  x = 0,
  y = 0,
  width = 1,
  height = 1,
  anchorX = 0,
  anchorY = 0,
} = {}) => ({x, y, width, height, anchorX, anchorY});

const asset = ({
  id,
  x = 0,
  y = 0,
  width = 1,
  height = 1,
  z = 0,
  registrationId,
  motion = still,
}) => ({
  id,
  kind: 'asset',
  assetRole: 'environment',
  src: `fixtures/spatial/${id}.png`,
  ...(registrationId ? {registrationId} : {}),
  z,
  transform: transform({x, y, width, height}),
  motion,
});

const gaitNode = ({
  id = 'runner',
  playback = {mode: 'loop', cycles: 8},
  motion = still,
  x = 0.3,
  y = 0.4,
}) => ({
  id,
  kind: 'state-sequence',
  assetRole: 'character',
  poseFamilyId: 'rabbit-run',
  registration: {
    id: 'rabbit-run-registration',
    sourceMasterAssetId: 'rabbit-run-sheet',
    canvas: {width: 1000, height: 1000},
    origin: 'top-left',
  },
  anchorPolicy: {
    requiredAnchorIds: ['ground-contact'],
    maximumDrift: 0.01,
  },
  states: [
    {
      id: 'run-a',
      src: 'fixtures/spatial/run-a.png',
      at: 0,
      facing: 'right',
      anchors: [{id: 'ground-contact', x: 0.5, y: 1}],
      identityReferenceAssetId: 'rabbit-master',
      identityReferenceSha256: 'a'.repeat(64),
    },
    {
      id: 'run-b',
      src: 'fixtures/spatial/run-b.png',
      at: 0.5,
      facing: 'right',
      anchors: [{id: 'ground-contact', x: 0.5, y: 1}],
      identityReferenceAssetId: 'rabbit-master',
      identityReferenceSha256: 'a'.repeat(64),
    },
  ],
  playback,
  transition: {type: 'cut', durationSeconds: 0},
  z: 2,
  transform: transform({x, y, width: 0.2, height: 0.3}),
  motion,
});

const proofTimes = [
  {id: 'start', at: 0.1, kind: 'establish', label: 'start', assertions: []},
  {id: 'middle', at: 0.5, kind: 'action', label: 'middle', assertions: []},
  {id: 'end', at: 0.9, kind: 'final', label: 'end', assertions: []},
];

const scene = ({
  id,
  nodes,
  proofs = proofTimes,
  camera = {
    preset: 'static',
    intensity: 1,
    parallax: {enabled: false, strength: 0, focalDepth: 0},
  },
}) => ({
  id,
  label: id,
  eyebrow: id,
  tailSeconds: 0,
  motion: {blueprint: 'chapter-tableau', intensity: 1, seed: 7, proofTimes: proofs},
  composition: {
    coordinateSpace: {width: 1000, height: 1000},
    nodes,
  },
  camera,
  narration: {
    src: `fixtures/spatial/${id}.wav`,
    startSeconds: 0,
    durationSeconds: 4,
    text: id,
  },
  subtitles: [],
  events: [],
});

const baseProject = (scenes, spatialContracts = []) => ({
  slug: 'spatial-test',
  video: {width: 1000, height: 1000, fps: 30},
  scenes,
  sceneTransitions: scenes.slice(1).map((candidate, index) => ({
    id: `transition-${index}`,
    fromSceneId: scenes[index].id,
    toSceneId: candidate.id,
    intent: 'continuity',
    rationale: 'continuous action',
    treatment: {
      type: 'cut',
      motivation: 'rhythmic',
      durationSeconds: 0,
      beatId: 'beat',
    },
  })),
  editorial: {
    activeProfile: '1:1',
    responsiveProfiles: [{
      id: '1:1',
      width: 1000,
      height: 1000,
      safeArea: {x: 0.05, y: 0.05, width: 0.9, height: 0.9},
      densityBudget: 10,
      typographyScale: 1,
      parallaxScale: 1,
      exclusionZones: [{
        id: 'subtitle',
        role: 'subtitle',
        x: 0.08,
        y: 0.88,
        width: 0.84,
        height: 0.08,
        padding: 0.01,
      }],
    }],
    transitionPlans: [],
    responsivePlans: [],
  },
  spatialContracts,
});

const grounding = ({
  id = 'ground-runner',
  sceneId = 'scene-1',
  subjectNodeId = 'runner',
  supportNodeId = 'ground',
  proofTimeIds: ids = ['start', 'middle', 'end'],
  mode = 'contact',
  frontOcclusion,
  subtitleClearance,
  maxGap = 0.02,
  maxPenetration = 0.02,
  maxRelativeDrift = 0.01,
} = {}) => ({
  id,
  kind: 'grounding',
  sceneId,
  subjectNodeId,
  supportNodeId,
  proofTimeIds: ids,
  subjectAnchor: {mode: 'state-anchor', name: 'ground-contact'},
  supportSurface: {points: [{x: 0.1, y: 0.7}, {x: 0.9, y: 0.7}]},
  supportScreenBand: {minY: 0.6, maxY: 0.95},
  mode,
  maxGap,
  maxPenetration,
  maxRelativeDrift,
  ...(frontOcclusion ? {frontOcclusion} : {}),
  ...(subtitleClearance ? {subtitleClearance} : {}),
});

test('grounding contract rejects a visually floating subject', async () => {
  const ground = asset({id: 'ground', z: 0});
  const runner = gaitNode({});
  const project = baseProject([scene({id: 'scene-1', nodes: [ground, runner]})]);
  const passed = await inspectSpatialContract(project, grounding());
  assert.equal(passed.passed, true);

  const floating = structuredClone(project);
  floating.scenes[0].composition.nodes[1].transform.y = 0.28;
  const failed = await inspectSpatialContract(floating, grounding());
  assert.equal(failed.passed, false);
  assert.ok(
    failed.checks.some(
      ({id, passed: checkPassed}) =>
        id.startsWith('support-contact:') && !checkPassed,
    ),
  );
});

test('spatial proof evaluates the same responsive placement as the renderer', async () => {
  const ground = asset({id: 'ground', z: 0});
  const runner = gaitNode({});
  const project = baseProject([
    scene({id: 'scene-1', nodes: [ground, runner]}),
  ]);
  assert.equal(
    (await inspectSpatialContract(project, grounding())).passed,
    true,
  );
  project.editorial.responsivePlans = [{
    profileId: '1:1',
    width: 1000,
    height: 1000,
    parallaxScale: 1,
    scenes: [{
      sceneId: 'scene-1',
      placements: [{
        targetId: 'runner',
        transform: {
          x: 0.3,
          y: 0.2,
          width: 0.2,
          height: 0.3,
          anchorX: 0,
          anchorY: 0,
        },
      }],
    }],
  }];
  const responsive = await inspectSpatialContract(project, grounding());
  assert.equal(responsive.passed, false);
  assert.ok(
    responsive.checks.some(
      ({id, passed}) => id.startsWith('support-contact:') && !passed,
    ),
  );
});

test('grounding contract rejects a support surface placed in the authored sky band', async () => {
  const ground = asset({id: 'ground'});
  const runner = gaitNode({y: 0.1});
  const project = baseProject([scene({id: 'scene-1', nodes: [ground, runner]})]);
  const contract = {
    ...grounding(),
    supportSurface: {points: [{x: 0.1, y: 0.4}, {x: 0.9, y: 0.4}]},
    maxGap: 0.02,
    maxPenetration: 0.02,
  };
  const result = await inspectSpatialContract(project, contract);
  assert.equal(result.passed, false);
  assert.ok(
    result.checks.some(
      ({id, passed}) => id.startsWith('support-screen-band:') && !passed,
    ),
  );
});

test('paint-order proof rejects an internal foreground that cannot cover a top-level subject', async () => {
  const front = asset({id: 'front', z: 999});
  const environment = {
    id: 'environment',
    kind: 'group',
    pattern: 'free',
    z: 0,
    coordinateSpace: {width: 1000, height: 1000},
    transform: transform(),
    motion: still,
    children: [front],
  };
  const ground = asset({id: 'ground', z: 0});
  const runner = gaitNode({});
  const project = baseProject([
    scene({id: 'scene-1', nodes: [environment, ground, runner]}),
  ]);
  const contract = grounding({
    frontOcclusion: {
      nodeId: 'front',
      relation: 'in-front-of-subject',
      minimumAlphaOverlap: 0,
    },
  });
  const result = await inspectSpatialContract(project, contract);
  assert.equal(result.passed, false);
  assert.ok(
    result.checks.some(
      ({id, passed}) => id.startsWith('paint-order:') && !passed,
    ),
  );
});

test('locked-contact catches idle drift even when the wide contact tolerance still passes', async () => {
  const ground = asset({id: 'ground'});
  const runner = gaitNode({
    motion: {
      ...still,
      idle: {preset: 'float', intensity: 2, cycleSeconds: 1},
    },
  });
  const project = baseProject([scene({id: 'scene-1', nodes: [ground, runner]})]);
  const contract = grounding({
    mode: 'locked-contact',
    maxGap: 0.1,
    maxPenetration: 0.1,
    maxRelativeDrift: 0.0001,
  });
  const result = await inspectSpatialContract(project, contract);
  assert.equal(result.passed, false);
  assert.ok(
    result.checks.some(
      ({id, passed}) => id === 'relative-contact-stable' && !passed,
    ),
  );
});

test('subtitle clearance is measured independently from ground contact', async () => {
  const ground = asset({id: 'ground'});
  const runner = gaitNode({y: 0.62});
  const project = baseProject([scene({id: 'scene-1', nodes: [ground, runner]})]);
  const contract = {
    ...grounding({
      maxGap: 0.25,
      maxPenetration: 0.25,
      subtitleClearance: {minimumGap: 0.02},
    }),
    supportSurface: {points: [{x: 0.1, y: 0.92}, {x: 0.9, y: 0.92}]},
  };
  const result = await inspectSpatialContract(project, contract);
  assert.equal(result.passed, false);
  assert.ok(
    result.checks.some(
      ({id, passed}) => id.startsWith('subtitle-clearance:') && !passed,
    ),
  );
});

test('continuity contract locks adjacent world family, framing, and grounding bindings', async () => {
  const first = scene({
    id: 'scene-1',
    nodes: [
      asset({id: 'ground-1'}),
      asset({id: 'world-1', registrationId: 'same-world'}),
      gaitNode({id: 'runner-1'}),
    ],
  });
  const second = scene({
    id: 'scene-2',
    nodes: [
      asset({id: 'ground-2'}),
      asset({id: 'world-2', registrationId: 'same-world'}),
      gaitNode({id: 'runner-2'}),
    ],
  });
  const g1 = grounding({
    id: 'ground-1-contract',
    sceneId: 'scene-1',
    subjectNodeId: 'runner-1',
    supportNodeId: 'ground-1',
  });
  const g2 = grounding({
    id: 'ground-2-contract',
    sceneId: 'scene-2',
    subjectNodeId: 'runner-2',
    supportNodeId: 'ground-2',
  });
  const continuity = {
    id: 'collision-continuity',
    kind: 'continuity',
    from: {sceneId: 'scene-1', proofTimeId: 'end'},
    to: {sceneId: 'scene-2', proofTimeId: 'start'},
    nodePairs: [{
      role: 'world',
      fromNodeId: 'world-1',
      toNodeId: 'world-2',
      requireSameFamily: true,
      maxPositionDelta: 0.05,
      maxScaleDelta: 0.05,
    }],
    groundingContractIds: [g1.id, g2.id],
    maxCameraPositionDelta: 0.05,
    maxCameraZoomDelta: 0.05,
  };
  const project = baseProject([first, second], [g1, g2, continuity]);
  assert.equal((await inspectSpatialContract(project, continuity)).passed, true);

  const changed = structuredClone(project);
  changed.scenes[1].composition.nodes[1].registrationId = 'different-world';
  const failed = await inspectSpatialContract(changed, continuity);
  assert.equal(failed.passed, false);
  assert.ok(
    failed.checks.some(
      ({id, passed}) => id === 'continuity-family:world' && !passed,
    ),
  );

  const missingGrounding = {
    ...continuity,
    groundingContractIds: [g1.id, 'missing-grounding'],
  };
  const missingResult = await inspectSpatialContract(project, missingGrounding);
  assert.equal(missingResult.passed, false);
  assert.ok(
    missingResult.checks.some(
      ({id, passed}) => id === 'continuity-grounding-bound' && !passed,
    ),
  );
});

test('gait cadence rejects activeUntil that freezes the runner before the proof window ends', async () => {
  const contract = {
    id: 'rabbit-run',
    kind: 'gait',
    sceneId: 'scene-1',
    nodeId: 'runner',
    fromProofTimeId: 'start',
    throughProofTimeId: 'end',
    stateIds: ['run-a', 'run-b'],
    minimumChangesPerSecond: 3,
    continueThroughWindowEnd: true,
  };
  const running = baseProject([
    scene({id: 'scene-1', nodes: [gaitNode({})]}),
  ], [contract]);
  assert.equal((await inspectSpatialContract(running, contract)).passed, true);

  const frozen = baseProject([
    scene({
      id: 'scene-1',
      nodes: [gaitNode({
        playback: {
          mode: 'loop',
          cycles: 8,
          activeUntil: 0.5,
          holdStateId: 'run-a',
        },
      })],
    }),
  ], [contract]);
  const failed = await inspectSpatialContract(frozen, contract);
  assert.equal(failed.passed, false);
  assert.ok(
    failed.checks.some(
      ({id, passed}) => id === 'gait-active-through-window' && !passed,
    ),
  );
  assert.ok(
    failed.checks.some(
      ({id, passed}) => id === 'gait-no-terminal-freeze' && !passed,
    ),
  );
});

test('travel-facing rejects reverse flight and state metadata that faces away from travel', async () => {
  const contract = {
    id: 'crow-flies-right',
    kind: 'travel-facing',
    sceneId: 'scene-1',
    nodeId: 'runner',
    fromProofTimeId: 'start',
    throughProofTimeId: 'end',
    direction: 'right',
    expectedFacing: 'right',
    minimumTravel: 0.35,
    rationale: 'The crow faces the same direction as its visible flight path.',
  };
  const movingRight = baseProject([
    scene({
      id: 'scene-1',
      nodes: [gaitNode({
        motion: {
          keyframes: [
            {at: 0, offsetX: -0.25, offsetY: 0},
            {at: 1, offsetX: 0.25, offsetY: 0},
          ],
        },
      })],
    }),
  ], [contract]);
  const passing = await inspectSpatialContract(movingRight, contract);
  assert.equal(passing.passed, true);
  assert.ok(
    passing.checks.some(
      ({id, passed}) => id === 'travel-facing-direction' && passed,
    ),
  );

  const wrongFacing = structuredClone(movingRight);
  wrongFacing.scenes[0].composition.nodes[0].states.forEach((state) => {
    state.facing = 'left';
  });
  const facingFailure = await inspectSpatialContract(wrongFacing, contract);
  assert.equal(facingFailure.passed, false);
  assert.ok(
    facingFailure.checks.some(
      ({id, passed}) => id === 'travel-facing-state-metadata' && !passed,
    ),
  );

  const reverseMotion = structuredClone(movingRight);
  reverseMotion.scenes[0].composition.nodes[0].motion.keyframes = [
    {at: 0, offsetX: 0.25, offsetY: 0},
    {at: 1, offsetX: -0.25, offsetY: 0},
  ];
  const directionFailure = await inspectSpatialContract(
    reverseMotion,
    contract,
  );
  assert.equal(directionFailure.passed, false);
  assert.ok(
    directionFailure.checks.some(
      ({id, passed}) => id === 'travel-facing-direction' && !passed,
    ),
  );
});

test('storyboard validation and quality target collection carry spatial contracts end to end', async () => {
  const contract = {
    id: 'rabbit-run',
    kind: 'gait',
    sceneId: 'scene-1',
    nodeId: 'runner',
    fromProofTimeId: 'start',
    throughProofTimeId: 'end',
    stateIds: ['run-a', 'run-b'],
    minimumChangesPerSecond: 3,
    continueThroughWindowEnd: true,
  };
  const storyboard = {
    scenes: [{
      id: 'scene-1',
      proofTimes,
    }],
    spatialContracts: [contract],
  };
  assert.deepEqual(validateStoryboardSpatialContracts(storyboard), []);
  const project = baseProject([
    scene({id: 'scene-1', nodes: [gaitNode({})]}),
  ], [contract]);
  const targets = await collectCompositeQualityTargets(project, {
    manifest: {assets: []},
  });
  const target = targets.find(
    ({compositeId}) => compositeId === 'spatial-contract:rabbit-run',
  );
  assert.equal(target?.pattern, 'spatial-contract');
  assert.ok(target.requiredChecks.includes('gait-cadence-clean'));
  assert.deepEqual(target.proofTimeIds, ['start', 'end']);
});

test('moving state-sequence directing requires travel-facing authoring and quality evidence', async () => {
  const contract = {
    id: 'crow-flies-right',
    kind: 'travel-facing',
    sceneId: 'scene-1',
    nodeId: 'runner',
    fromProofTimeId: 'start',
    throughProofTimeId: 'end',
    direction: 'right',
    expectedFacing: 'right',
    minimumTravel: 0.35,
    rationale: 'The crow faces the same direction as its visible flight path.',
  };
  const gaitContract = {
    id: 'crow-flight-cadence',
    kind: 'gait',
    sceneId: 'scene-1',
    nodeId: 'runner',
    fromProofTimeId: 'start',
    throughProofTimeId: 'end',
    stateIds: ['run-a', 'run-b'],
    minimumChangesPerSecond: 2.4,
    continueThroughWindowEnd: true,
  };
  const storyboard = {
    scenes: [{
      id: 'scene-1',
      proofTimes,
      compositionPlan: {
        stateSequences: [{
          nodeId: 'runner',
          states: [
            {id: 'run-a', at: 0, facing: 'right'},
            {id: 'run-b', at: 0.5, facing: 'right'},
          ],
        }],
        continuousMotions: [{
          id: 'runner-traverse',
          nodeId: 'runner',
          preset: 'traverse',
          at: 0.5,
          proofTimeId: 'middle',
        }],
      },
    }],
    spatialContracts: [contract, gaitContract],
  };
  assert.deepEqual(validateStoryboardSpatialContracts(storyboard), []);
  const missingCadence = structuredClone(storyboard);
  missingCadence.spatialContracts = [contract];
  assert.ok(
    validateStoryboardSpatialContracts(missingCadence).some(
      ({code}) => code === 'storyboard-travel-facing-gait-required',
    ),
  );
  const missing = structuredClone(storyboard);
  missing.spatialContracts = [];
  assert.ok(
    validateStoryboardSpatialContracts(missing).some(
      ({code}) => code === 'storyboard-travel-facing-required',
    ),
  );
  const inPlaceSettle = structuredClone(missing);
  inPlaceSettle.scenes[0].compositionPlan.continuousMotions[0].preset =
    'settle';
  assert.deepEqual(validateStoryboardSpatialContracts(inPlaceSettle), []);
  const mismatched = structuredClone(storyboard);
  mismatched.spatialContracts[0].expectedFacing = 'left';
  assert.ok(
    validateStoryboardSpatialContracts(mismatched).some(
      ({code}) => code === 'storyboard-travel-facing-state',
    ),
  );

  const project = baseProject([
    scene({
      id: 'scene-1',
      nodes: [gaitNode({
        motion: {
          keyframes: [
            {at: 0, offsetX: -0.25, offsetY: 0},
            {at: 1, offsetX: 0.25, offsetY: 0},
          ],
        },
      })],
    }),
  ], [contract]);
  const targets = await collectCompositeQualityTargets(project, {
    manifest: {assets: []},
  });
  const target = targets.find(
    ({compositeId}) => compositeId === 'spatial-contract:crow-flies-right',
  );
  assert.ok(target.requiredChecks.includes('travel-facing-readable'));
  assert.ok(target.requiredChecks.includes('signed-travel-direction-correct'));
});
