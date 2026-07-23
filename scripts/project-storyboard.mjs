#!/usr/bin/env node
import fs from 'node:fs/promises';
import {resolveWorkspacePath} from './provider-lib.mjs';
import {loadProject, writeJson} from './project-lib.mjs';
import {loadProduction} from './production-state.mjs';
import {
  compileStoryboardDirecting,
  storyboardFileFor,
  summarizeStoryboard,
  validateStoryboard,
} from './storyboard-lib.mjs';
import {materializeSceneTransitionRecipes} from '../src/sceneTimeline.mjs';

const args = process.argv.slice(2);
const slug = args.find((arg) => !arg.startsWith('--'));
const input = args.find((arg) => arg.startsWith('--input='))?.slice('--input='.length);

try {
  if (!slug || !input) throw new Error('用法：project:storyboard -- <slug> --input=<storyboard.json>');
  const {state} = await loadProduction(slug);
  if (!['capability-review', 'brief', 'concept-review'].includes(state.stage)) {
    throw new Error(`project:storyboard 只能在 capability-review、brief 或 concept-review 阶段运行；当前为 ${state.stage}。`);
  }
  const {project, paths} = await loadProject(slug);
  if (project.plan?.status !== 'resolved') throw new Error('请先运行 project:plan，再编排故事板。');
  const supplied = JSON.parse(
    await fs.readFile(resolveWorkspacePath(input, 'storyboard 输入路径'), 'utf8'),
  );
  const authored = {
    ...supplied,
    $schema: '../../schemas/storyboard.schema.json',
    schemaVersion: 9,
    slug,
    status: 'ready',
    sceneTransitions: materializeSceneTransitionRecipes(supplied.sceneTransitions),
    updatedAt: new Date().toISOString(),
  };
  const storyboard = compileStoryboardDirecting(authored, {plan: project.plan});
  const issues = validateStoryboard(storyboard, {slug, plan: project.plan});
  if (issues.length > 0) {
    throw new Error(issues.map(({location, message}) => `${location}: ${message}`).join('\n'));
  }
  await writeJson(storyboardFileFor(slug), storyboard);
  await writeJson(paths.projectFile, {...project, editorial: storyboard.editorial});
  const summary = summarizeStoryboard(storyboard);
  console.log(`✓ 故事板已锁定：${summary.sceneCount} 个镜头`);
  for (const scene of summary.scenes) {
    console.log(`  ${scene.id}: ${scene.blueprint} · ${scene.treatmentCount} treatments · risk ${scene.riskScore} · ${scene.proofCount} proofs`);
  }
  console.log(`  motion budget: ${summary.directing.estimatedPoseSheetCalls} pose-sheet calls · ${summary.directing.avoidedIsolatedStateCalls} isolated calls avoided`);
} catch (error) {
  console.error(`project:storyboard failed: ${error.message}`);
  process.exitCode = 1;
}
