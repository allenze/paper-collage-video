import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  ASPECT_RATIOS,
  confirmIntake,
  intakeDecisionFingerprint,
  validateIntake,
} from '../scripts/intake-lib.mjs';
import {
  assertPlanningScenariosReady,
  assertStoryboardMatchesScenario,
  buildCreativePlanFromScenario,
  buildPlanningScenarios,
  deriveProfilePromise,
  scenarioDecisionFor,
} from '../scripts/planning-scenario-lib.mjs';
import {validateCreativePlan} from '../scripts/creative-plan-lib.mjs';
import {
  summarizeProfileFulfillment,
} from '../scripts/motion-treatment-lib.mjs';
import {loadStyleCatalog} from '../scripts/style-catalog-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-07-25T00:00:00.000Z';

const makeScene = ({
  profile,
  index,
  stateFamily = null,
  layered = false,
  parallax = false,
  ambient = false,
  localMotionCount = 1,
}) => ({
  id: `${profile}-scene-${String(index + 1).padStart(2, '0')}`,
  label: `第 ${index + 1} 幕`,
  beat: `共同故事节拍 ${index + 1}`,
  characterActions: ['角色执行清晰可见的叙事动作'],
  stateFamilies: stateFamily ? [stateFamily] : [],
  layers: {
    rear: layered ? ['远景森林'] : [],
    mid: ['角色与跑道'],
    front: layered ? ['近处草丛'] : [],
    near: profile === 'full-depth' ? ['掠过镜头的叶片'] : [],
  },
  sourcePackages: [
    {
      id: `${profile}-source-${index + 1}`,
      strategy: layered ? 'registered-layer-sheet' : 'single-background',
      providerCalls: 1,
      localDerivatives: layered ? 3 : 0,
      avoidedCalls: layered ? 2 : 0,
    },
  ],
  parallax,
  ambientElements: ambient ? ['风中的叶片'] : [],
  localMotionTargets: Array.from(
    {length: localMotionCount},
    (_, motionIndex) => ({
      targetId: `target-${index + 1}-${motionIndex + 1}`,
      preset: motionIndex === 0 ? 'translate' : 'breathe',
    }),
  ),
});

const makeOption = ({
  id,
  storyScope,
  sceneCount,
  stateFamilies,
  layeredScenes,
  parallaxScenes,
  ambientScenes,
  localMotionCount,
  durationSeconds,
}) => {
  const scenes = Array.from({length: sceneCount}, (_, index) =>
    makeScene({
      profile: id,
      index,
      stateFamily: stateFamilies[index] ?? null,
      layered: index < layeredScenes,
      parallax: index < parallaxScenes,
      ambient: index < ambientScenes,
      localMotionCount,
    }),
  );
  const familyCount = new Set(
    scenes.flatMap(({stateFamilies: families}) =>
      families.map(({id: familyId}) => familyId),
    ),
  ).size;
  const expected = 1 + sceneCount + familyCount;
  return {
    id,
    storyScope,
    durationSeconds,
    sceneCount,
    estimatedNarrationSeconds: durationSeconds - 6,
    rationale: `${storyScope} 范围与 ${id} 制作深度相匹配`,
    scenes,
    proposedImageAttemptLimit: expected + 2,
    providerRecommendation: {
      text: 'current-host-model',
      image: 'user-confirmed-image-provider',
      voice: 'user-confirmed-voice-provider',
    },
    costNote: '按预计图片调用数计；具体金额以确认时 provider 报价为准。',
    factsAndRightsRisks: [],
    finalEffect: `${id} 的可见成片承诺`,
  };
};

const stateFamilies = (count, necessity, statesPerFamily) =>
  Array.from({length: count}, (_, index) => ({
    id: `${necessity}-family-${index + 1}`,
    necessity,
    states: Array.from(
      {length: statesPerFamily},
      (_, stateIndex) => `state-${stateIndex + 1}`,
    ),
  }));

const makeScenarioInput = () => ({
  requested: {durationSeconds: null, sceneCount: null},
  commonStory: {
    logline: '兔子轻敌睡着，乌龟坚持前进并赢得比赛。',
    audience: '6–10 岁儿童与家庭观众',
    theme: '稳定坚持胜过骄傲轻敌',
    ending: '兔子承认错误，乌龟与伙伴一起庆祝。',
    beats: ['提出比赛', '兔子领先并休息', '乌龟持续前进', '乌龟获胜'],
  },
  options: [
    makeOption({
      id: 'draft',
      storyScope: 'concise',
      sceneCount: 4,
      stateFamilies: [],
      layeredScenes: 0,
      parallaxScenes: 0,
      ambientScenes: 0,
      localMotionCount: 1,
      durationSeconds: 32,
    }),
    makeOption({
      id: 'balanced',
      storyScope: 'standard',
      sceneCount: 6,
      stateFamilies: [
        ...stateFamilies(2, 'required', 3),
      ],
      layeredScenes: 3,
      parallaxScenes: 2,
      ambientScenes: 2,
      localMotionCount: 2,
      durationSeconds: 54,
    }),
    makeOption({
      id: 'full-depth',
      storyScope: 'expanded',
      sceneCount: 8,
      stateFamilies: [
        ...stateFamilies(4, 'required', 4),
        ...stateFamilies(3, 'enhancement', 4),
      ],
      layeredScenes: 8,
      parallaxScenes: 6,
      ambientScenes: 4,
      localMotionCount: 3,
      durationSeconds: 82,
    }),
  ],
});

test('built-in style catalog contains three fingerprinted cards for one canonical subject', async () => {
  const catalog = await loadStyleCatalog({root: ROOT});
  assert.equal(catalog.styles.length, 3);
  assert.match(catalog.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(new Set(catalog.styles.map(({image}) => image)).size, 3);
  const dimensions = new Set();
  for (const style of catalog.styles) {
    assert.equal((await fs.stat(style.absolutePath)).isFile(), true);
    const metadata = await sharp(style.absolutePath).metadata();
    assert.equal(metadata.format, 'png');
    assert.ok(metadata.width >= 1200);
    assert.ok(metadata.height >= 675);
    assert.ok(Math.abs(metadata.width / metadata.height - 16 / 9) < 0.01);
    dimensions.add(`${metadata.width}x${metadata.height}`);
  }
  assert.equal(dimensions.size, 1);
  const provenance = JSON.parse(
    await fs.readFile(
      path.join(ROOT, 'public', 'style-catalog', 'generation-provenance.json'),
      'utf8',
    ),
  );
  assert.equal(provenance.generator, 'Codex built-in image_gen');
  assert.equal(provenance.generationCount, 3);
  assert.deepEqual(
    provenance.images.map(({id}) => id),
    catalog.styles.map(({id}) => id),
  );
  for (const image of provenance.images) {
    const source = await fs.readFile(
      path.join(ROOT, 'public', 'style-catalog', image.file),
    );
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      image.sha256,
    );
  }
  const validator = new Ajv2020({
    strict: false,
    formats: {'date-time': true},
  }).compile(
    JSON.parse(
      await fs.readFile(
        path.join(ROOT, 'schemas', 'style-catalog.schema.json'),
        'utf8',
      ),
    ),
  );
  const persisted = JSON.parse(
    await fs.readFile(
      path.join(ROOT, 'public', 'style-catalog', 'catalog.json'),
      'utf8',
    ),
  );
  assert.equal(validator(persisted), true, JSON.stringify(validator.errors));
});

test('intake locks the two supported aspect ratios and separates parallax from visual style', async () => {
  const catalog = await loadStyleCatalog({root: ROOT});
  const intake = confirmIntake({
    selection: {
      aspectRatio: '9:16',
      visualStylePreset: 'childrens-picture-book-paper',
      parallaxPreference: 'auto',
      note: '用户通过初始 Ask Question 确认',
    },
    catalog,
    at,
  });
  assert.deepEqual(validateIntake(intake), []);
  assert.deepEqual(ASPECT_RATIOS[intake.aspectRatio], {
    width: 1080,
    height: 1920,
    label: '竖屏 9:16',
  });
  assert.equal(intake.visualStylePreset.includes('parallax'), false);
  assert.match(intakeDecisionFingerprint(intake), /^[a-f0-9]{64}$/);
});

test('three scenarios bind story scope, exact calls, caps, and quality floors before provider use', async () => {
  const catalog = await loadStyleCatalog({root: ROOT});
  const intake = confirmIntake({
    selection: {
      aspectRatio: '16:9',
      visualStylePreset: 'hand-drawn-cutout-explainer',
      parallaxPreference: 'auto',
    },
    catalog,
    at,
  });
  const scenarios = buildPlanningScenarios({
    slug: 'gui-tu-sai-pao',
    intake,
    input: makeScenarioInput(),
    at,
  });
  assert.doesNotThrow(() =>
    assertPlanningScenariosReady(scenarios, {
      slug: 'gui-tu-sai-pao',
      intake,
    }),
  );
  assert.deepEqual(
    scenarios.options.map(({id, storyScope}) => [id, storyScope]),
    [
      ['draft', 'concise'],
      ['balanced', 'standard'],
      ['full-depth', 'expanded'],
    ],
  );
  assert.deepEqual(
    scenarios.options.map(({providerEstimate}) => [
      providerEstimate.expectedImageCalls,
      providerEstimate.proposedImageAttemptLimit,
      providerEstimate.hardCeiling,
    ]),
    [
      [5, 7, 15],
      [9, 11, 38],
      [16, 18, 81],
    ],
  );
  assert.ok(scenarios.options.every(({plannedFulfillment}) => plannedFulfillment.passed));
  const validator = new Ajv2020({
    strict: false,
    formats: {'date-time': true},
  }).compile(
    JSON.parse(
      await fs.readFile(
        path.join(ROOT, 'schemas', 'planning-scenarios.schema.json'),
        'utf8',
      ),
    ),
  );
  assert.equal(validator(scenarios), true, JSON.stringify(validator.errors));

  const plan = buildCreativePlanFromScenario({
    slug: 'gui-tu-sai-pao',
    scenarios,
    optionId: 'balanced',
    at,
  });
  assert.deepEqual(validateCreativePlan(plan, {slug: 'gui-tu-sai-pao'}), []);
  assert.equal(plan.storyScope, 'standard');
  assert.equal(plan.scenarioBinding.expectedProviderImageCalls, 9);
  assert.deepEqual(
    scenarioDecisionFor(scenarios, 'balanced'),
    {
      scenarioSetFingerprint: scenarios.fingerprint,
      optionId: 'balanced',
      optionFingerprint: scenarios.options[1].fingerprint,
      storyScope: 'standard',
      durationSeconds: 54,
      sceneCount: 6,
      expectedProviderImageCalls: 9,
      proposedImageAttemptLimit: 11,
      profileHardCeiling: 38,
    },
  );
  const balanced = scenarios.options[1];
  const balancedFamilies = balanced.scenes.flatMap(({stateFamilies}) => stateFamilies);
  const balancedSources = balanced.scenes
    .flatMap(({sourcePackages}) => sourcePackages)
    .filter(({strategy}) => strategy !== 'single-background');
  const directingSummary = {
    poseSheetPlans: balancedFamilies.map((family) => ({
      poseFamilyId: family.id,
      necessity: family.necessity,
      stateIds: family.states,
    })),
    generationBudget: {
      expectedProviderImageCalls: 5,
      sourcePackagePlans: balancedSources.map((source) => ({
        id: source.id,
        sourceStrategy: source.strategy,
        providerImageCalls: source.providerCalls,
        localDerivatives: source.localDerivatives,
        avoidedCalls: source.avoidedCalls,
      })),
    },
  };
  assert.deepEqual(
    assertStoryboardMatchesScenario(balanced, directingSummary),
    {
      poseFamilyCount: 2,
      sourcePackageCount: 3,
      structuralProviderImageCalls: 5,
    },
  );
  assert.throws(
    () =>
      assertStoryboardMatchesScenario(balanced, {
        ...directingSummary,
        poseSheetPlans: directingSummary.poseSheetPlans.slice(0, 1),
      }),
    /姿态母版家族/,
  );
});

test('profile fulfillment turns selected production depth into a minimum, not only a ceiling', () => {
  const promise = deriveProfilePromise({
    productionProfile: 'full-depth',
    sceneCount: 2,
    parallaxPreference: 'auto',
  });
  const result = summarizeProfileFulfillment(
    [
      {
        compositionPlan: {layerStacks: [], patterns: []},
        beats: [{treatments: []}],
      },
      {
        compositionPlan: {layerStacks: [], patterns: []},
        beats: [{treatments: []}],
      },
    ],
    {
      requiredStateFamilies: 0,
      enhancementStateFamilies: 0,
      totalStates: 0,
      localMotionTargets: 0,
    },
    promise,
  );
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.startsWith('layeredScenes:')));
  assert.ok(result.issues.some((issue) => issue.startsWith('localMotionTargets:')));
});
