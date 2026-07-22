import fs from 'node:fs/promises';
import path from 'node:path';
import {compileStoryboardDirecting} from '../../scripts/motion-treatment-lib.mjs';

const directory = import.meta.dirname;
const projectFile = path.join(directory, 'project.json');
const storyboardFile = path.join(directory, 'storyboard.json');
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const writeJson = async (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const project = await readJson(projectFile);
const storyboard = await readJson(storyboardFile);
const scene = (document, id) => document.scenes.find((item) => item.id === id);
const findNode = (nodes, id) => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === 'group') {
      const child = findNode(node.children, id);
      if (child) return child;
    }
  }
  return null;
};

scene(storyboard, 'scene-02').proofTimes.find(({id}) => id === 's2-proof-folded').at = 0.15;
for (const beat of scene(storyboard, 'scene-03').beats) {
  for (const treatment of beat.treatments) {
    treatment.composition.pattern = 'supported-subject';
    treatment.composition.relationship = treatment.targetId === 'dream-butterfly' ? {
      id: 'butterfly-on-paper-flower',
      predicate: 'on',
      object: 'paper-flower',
      proof: '飞行阶段保持注册关系但允许 detach；落花后足部接触花面，主体按批准要求位于所有花层之上',
    } : {
      id: `registered-${treatment.targetId}-on-paper-flower`,
      predicate: 'on',
      object: 'paper-flower',
      proof: '该局部动效在同一个注册花景组合内运行，不形成独立世界坐标。',
    };
  }
}
const authoring = {
  ...storyboard,
  scenes: storyboard.scenes.map(({compositionPlan, directing, ...item}) => item),
  directingSummary: undefined,
  updatedAt: new Date().toISOString(),
};
const compiled = compileStoryboardDirecting(authoring, {plan: project.plan});
for (const projectScene of project.scenes) {
  projectScene.motion.proofTimes = structuredClone(scene(compiled, projectScene.id).proofTimes);
}
scene(project, 'scene-02').events[0].visual.durationSeconds = 2.2;
findNode(scene(project, 'scene-03').composition.nodes, 'flower-landing-rig').support.detachProofTimeIds = [
  's3-proof-folded-flight',
  's3-proof-open-flight',
  's3-proof-up-flight',
  's3-proof-level-flight',
];
await writeJson(storyboardFile, compiled);
await writeJson(projectFile, project);
console.log('preview-revision: fixed boundary, detach proofs, and truthful group pattern');
