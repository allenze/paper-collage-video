import {loadProject} from './scripts/project-lib.mjs';
import {loadStoryboard} from './scripts/storyboard-lib.mjs';
import {summarizeConceptDecision} from './scripts/creative-plan-lib.mjs';
import {sourcePackageDecisionFor} from './scripts/layer-source-plan-lib.mjs';
import {assertPlanningScenariosReady} from './scripts/planning-scenario-lib.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadProduction} from './scripts/production-state.mjs';
const slug = 'dog-guilt-truth';
const {project} = await loadProject(slug);
const storyboard = await loadStoryboard(slug);
const planDecision = summarizeConceptDecision(project.plan);
const sourcePackageDecision = sourcePackageDecisionFor(storyboard.directingSummary);
const {paths} = await loadProduction(slug);
const scenarios = project.plan.scenarioBinding
  ? assertPlanningScenariosReady(await fs.readFile(paths.planningScenariosFile,'utf8').then(JSON.parse), {slug, intake: project.intake})
  : null;
const scenarioOption = scenarios?.options?.find(o => o.id === project.plan.productionProfile) ?? null;
const scenarioDecision = scenarioOption
  ? {productionProfile: scenarioOption.id, accepted: true, expectedProviderImageCalls: scenarioOption.expectedProviderImageCalls, note: 'accepted'}
  : null;
const budgetDecision = {
  imageAttemptLimit: scenarioOption?.proposedImageAttemptLimit ?? sourcePackageDecision.expectedProviderImageCalls ?? 109,
};
const selections = {
  text: {provider: 'manual', config: {voice: null}, override: false},
  image: {provider: 'manual', config: {generator: null}, override: false},
  voice: {provider: 'manual', config: {voice: null}, override: false},
};
const payload = {
  note: '现代奇幻装饰插画风 · 四层纸雕灯分层 · C-02 风格样张确认。',
  planDecision,
  scenarioDecision,
  sourcePackageDecision,
  budgetDecision,
  selections,
  scope: 'project',
};
const out = path.resolve('projects/dog-guilt-truth/confirm-concept-selection.json');
await fs.writeFile(out, JSON.stringify(payload,null,2));
console.log('wrote', out);
