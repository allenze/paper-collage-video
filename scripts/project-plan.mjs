#!/usr/bin/env node
import {
  buildCreativePlan,
  PRODUCTION_PROFILES,
  summarizeConceptDecision,
} from './creative-plan-lib.mjs';
import {assertSlug, loadProject, writeJson} from './project-lib.mjs';
import {loadProduction} from './production-state.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const slug = args.find((arg) => !arg.startsWith('--'));
const valueFor = (name) =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);

const optionalNumber = (name, {integer = false} = {}) => {
  const raw = valueFor(name);
  if (raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} 必须是${integer ? '正整数' : '正数'}。`);
  }
  return parsed;
};

const printPlan = ({project, json}) => {
  const decision = summarizeConceptDecision(project.plan);
  if (json) {
    console.log(JSON.stringify({plan: project.plan, decision}, null, 2));
    return;
  }
  console.log(`✓ 创作规格：${project.plan.inputMode}`);
  console.log(`  目标时长：${project.plan.resolved.durationSeconds}s`);
  console.log(
    `  时长权威：${decision.durationAuthority === 'human-target' ? '用户指定目标；实测内容必须满足容差' : '内容推断；旁白生成后以实测内容为准'}`,
  );
  console.log(`  目标幕数：${project.plan.resolved.sceneCount}`);
  console.log(`  制作档位：${project.plan.productionProfile}`);
  console.log(`  生图预算：最多 ${project.plan.assetBudget.maxGeneratedImages} 次计费尝试`);
  console.log('  可选制作档位：');
  for (const option of decision.profileOptions) {
    const selected = option.id === decision.productionProfile ? '（当前）' : '';
    console.log(
      `    ${option.id}${selected}: 最多 ${option.assetBudget.maxGeneratedImages} 次 · ${option.finalImpact}`,
    );
  }
  console.log(`  计算依据：${project.plan.resolved.rationale}`);
};

try {
  assertSlug(slug);
  const durationSeconds = optionalNumber('--duration');
  const sceneCount = optionalNumber('--scenes', {integer: true});
  const {paths, project} = await loadProject(slug);
  if (
    durationSeconds === null &&
    sceneCount === null &&
    project.plan?.status === 'resolved'
  ) {
    printPlan({project, json});
  } else if (durationSeconds === null || sceneCount === null) {
    throw new Error(
      '用法：project:plan -- <slug> --duration=<补全时长秒数> --scenes=<补全幕数> ' +
        '[--requested-duration=<用户指定秒数>] [--requested-scenes=<用户指定幕数>] ' +
        `[--narration-seconds=<预计旁白秒数>] [--profile=${PRODUCTION_PROFILES.join('|')}] ` +
        '--rationale=<计算依据>；已有计划可用 project:plan -- <slug> --json 只读查看。',
    );
  } else {
    const requestedDurationSeconds = optionalNumber('--requested-duration');
    const requestedSceneCount = optionalNumber('--requested-scenes', {integer: true});
    const estimatedNarrationSeconds = optionalNumber('--narration-seconds');
    const rationale = valueFor('--rationale');
    const {state} = await loadProduction(slug);
    if (!['capability-review', 'brief', 'concept-review'].includes(state.stage)) {
      throw new Error(
        `project:plan 只能在 capability-review、brief 或 concept-review 阶段运行；当前为 ${state.stage}。`,
      );
    }
    const productionProfile = valueFor('--profile') ?? 'balanced';
    project.plan = buildCreativePlan({
      slug,
      requestedDurationSeconds,
      requestedSceneCount,
      durationSeconds,
      sceneCount,
      estimatedNarrationSeconds,
      productionProfile,
      rationale,
    });
    await writeJson(paths.projectFile, project);
    printPlan({project, json});
  }
} catch (error) {
  console.error(`project:plan failed: ${error.message}`);
  process.exitCode = 1;
}
