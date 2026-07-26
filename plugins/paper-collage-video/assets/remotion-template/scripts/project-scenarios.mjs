#!/usr/bin/env node
import fs from 'node:fs/promises';
import {assertIntakeConfirmed} from './intake-lib.mjs';
import {
  assertPlanningScenariosReady,
  buildPlanningScenarios,
  scenarioDecisionFor,
} from './planning-scenario-lib.mjs';
import {loadProject, projectPaths, readJson, writeJson} from './project-lib.mjs';
import {resolveWorkspacePath} from './provider-lib.mjs';
import {loadProduction} from './production-state.mjs';

const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith('--'));
const json = args.includes('--json');
const valueFor = (name) =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);

const printScenarios = (scenarios) => {
  const decisions = scenarios.options.map(({id}) =>
    scenarioDecisionFor(scenarios, id),
  );
  if (json) {
    console.log(JSON.stringify({scenarios, decisions}, null, 2));
    return;
  }
  console.log(`✓ 三档规划：共同故事骨架 ${scenarios.commonStory.beats.length} 个节拍`);
  for (const option of scenarios.options) {
    const estimate = option.providerEstimate;
    console.log(
      `  ${option.label}: ${option.durationSeconds}s · ${option.sceneCount} 幕 · expected ${estimate.expectedImageCalls} / proposed cap ${estimate.proposedImageAttemptLimit} / hard ceiling ${estimate.hardCeiling} · local ${estimate.localDerivatives} · avoided ${estimate.avoidedCalls}`,
    );
    console.log(`    ${option.finalEffect}`);
  }
};

try {
  if (!slug) throw new Error('用法：project:scenarios -- <slug> [--input=<scenarios.json>|--json]');
  const {state} = await loadProduction(slug);
  if (state.stage !== 'capability-review') {
    throw new Error(`project:scenarios 只能在 capability-review 阶段运行；当前为 ${state.stage}。`);
  }
  const {project} = await loadProject(slug);
  assertIntakeConfirmed(project.intake);
  const paths = projectPaths(slug);
  const input = valueFor('--input');
  let scenarios;
  if (input) {
    if (project.plan?.status === 'resolved') {
      throw new Error('Creative Plan 已锁定；改变 scenario 会使审批失效，请新建项目。');
    }
    const supplied = JSON.parse(
      await fs.readFile(resolveWorkspacePath(input, 'scenario 输入路径'), 'utf8'),
    );
    scenarios = buildPlanningScenarios({
      slug,
      intake: project.intake,
      input: supplied,
    });
    await writeJson(paths.planningScenariosFile, scenarios);
  } else {
    scenarios = assertPlanningScenariosReady(
      await readJson(paths.planningScenariosFile),
      {slug, intake: project.intake},
    );
  }
  printScenarios(scenarios);
} catch (error) {
  console.error(`project:scenarios failed: ${error.message}`);
  process.exitCode = 1;
}
