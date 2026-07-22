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
const sceneById = (document, id) => document.scenes.find((scene) => scene.id === id);
const nodeById = (scene, id) => {
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.kind === 'group') {
        const nested = visit(node.children);
        if (nested) return nested;
      }
    }
    return null;
  };
  return visit(scene.composition.nodes);
};
const stateTreatment = ({id, stateId, visualChange, proofTimeId}) => ({
  id,
  targetId: 'dream-butterfly',
  importance: 'hero',
  necessity: 'required',
  changeClass: 'pose-change',
  motion: {
    kind: 'state-sequence',
    poseFamilyId: 'butterfly-flight-states',
    stateId,
    visualChange,
    playback: 'loop',
    transition: 'cut',
  },
  composition: {pattern: 'free'},
  graphic: null,
  semanticRisk: 'topology',
  proofTimeId,
  rationale: '复用同一张注册姿态表，以连续切图形成传统纸偶展翅，不用缩放或重叠透明图层代替翅态。',
});

for (const scene of project.scenes) {
  scene.appearance ??= {};
  scene.appearance.chapter = {visible: true, variant: 'paper-tab'};
}

const s1 = sceneById(project, 'scene-01');
nodeById(s1, 'sleeping-tableau').support.layering = 'subject-front';

const s2Story = sceneById(storyboard, 'scene-02');
const s2BeatTimes = [0, 0.25, 0.5, 0.75];
for (const [index, beat] of s2Story.beats.entries()) {
  beat.at = s2BeatTimes[index];
  for (const treatment of beat.treatments.filter(({motion}) => motion.kind === 'state-sequence')) {
    treatment.motion.playback = 'loop';
    treatment.motion.transition = 'cut';
  }
}
s2Story.proofTimes = [
  {id: 's2-proof-folded', at: 0.01, label: '收翅节拍', kind: 'establish', assertions: ['收翅切图轮廓完整', '传统宣纸蝴蝶身份稳定'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-folded'}]},
  {id: 's2-proof-open', at: 0.33, label: '展翅节拍', kind: 'action', assertions: ['展开双翅的切图清晰', '飞行位移与切图循环同时成立'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-open'}]},
  {id: 's2-proof-up', at: 0.65, label: '上举节拍', kind: 'peak', assertions: ['双翅上举形成明确振翅峰值', '翅缘和触角没有跳位'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-up'}]},
  {id: 's2-proof-final', at: 0.825, label: '平展节拍', kind: 'final', assertions: ['平展切图属于持续循环而非长时间静止', '画面留白仍足以承接下一幕'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'hover-level'}]},
];
const s2 = sceneById(project, 'scene-02');
s2.motion.proofTimes = structuredClone(s2Story.proofTimes);
const s2Sequence = nodeById(s2, 'dream-butterfly');
s2Sequence.states = [
  {id: 'wings-folded', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-folded.png', at: 0},
  {id: 'wings-open', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-open.png', at: 0.25},
  {id: 'wings-up', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-up.png', at: 0.5},
  {id: 'hover-level', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-hover-level.png', at: 0.75},
];
s2Sequence.playback = {mode: 'loop', cycles: 7};
s2Sequence.transition = {type: 'cut', durationSeconds: 0};
for (const [index, event] of s2.events.entries()) {
  event.at = s2BeatTimes[index];
  event.visual.durationSeconds = [2, 1.4, 2.3, 1.2][index];
}

const s3Story = sceneById(storyboard, 'scene-03');
const [s3Glide, s3Settle, s3Forget] = s3Story.beats;
const glideState = s3Glide.treatments.find(({motion}) => motion.kind === 'state-sequence');
Object.assign(glideState, stateTreatment({id: 's3-state-folded-flight', stateId: 'wings-folded', visualChange: '收翅切图进入花间飞行循环', proofTimeId: 's3-proof-folded-flight'}));
s3Glide.proofTimeId = 's3-proof-folded-flight';
s3Glide.at = 0;
s3Glide.visual = '蝴蝶以四个注册翅态循环飞过花间，移动与展翅同时发生';
for (const treatment of s3Glide.treatments) treatment.proofTimeId = 's3-proof-folded-flight';
const openBeat = {
  id: 's3-flight-open', at: 0.18, purpose: '证明飞行循环的展开翅态', visual: '蝴蝶展开双翅继续向花枝移动', audioCue: null, proofTimeId: 's3-proof-open-flight',
  treatments: [stateTreatment({id: 's3-state-open-flight', stateId: 'wings-open', visualChange: '飞行循环进入展开翅态', proofTimeId: 's3-proof-open-flight'})],
};
const upBeat = {
  id: 's3-flight-up', at: 0.36, purpose: '证明飞行循环的上举翅态', visual: '蝴蝶双翅上举，保持同一注册中心', audioCue: null, proofTimeId: 's3-proof-up-flight',
  treatments: [stateTreatment({id: 's3-state-up-flight', stateId: 'wings-up', visualChange: '飞行循环进入上举翅态', proofTimeId: 's3-proof-up-flight'})],
};
const levelBeat = {
  id: 's3-flight-level', at: 0.54, purpose: '证明落花前的平展翅态', visual: '蝴蝶平展双翅接近纸花', audioCue: null, proofTimeId: 's3-proof-level-flight',
  treatments: [stateTreatment({id: 's3-state-level-flight', stateId: 'hover-level', visualChange: '落花前循环进入平展翅态', proofTimeId: 's3-proof-level-flight'})],
};
s3Settle.at = 0.56;
s3Settle.treatments = s3Settle.treatments.filter(({motion}) => motion.kind !== 'state-sequence');
s3Forget.at = 0.86;
s3Story.beats = [s3Glide, openBeat, upBeat, levelBeat, s3Settle, s3Forget];
s3Story.proofTimes = [
  {id: 's3-proof-folded-flight', at: 0.13, label: '收翅飞行', kind: 'establish', assertions: ['飞行中的收翅状态完整可辨', '蝴蝶位于所有花层之上'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-folded'}]},
  {id: 's3-proof-open-flight', at: 0.25, label: '展翅飞行', kind: 'action', assertions: ['展开翅态与位移同步', '翅膀未被花瓣遮挡'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-open'}]},
  {id: 's3-proof-up-flight', at: 0.381, label: '上举飞行', kind: 'action', assertions: ['上举翅态保持身份一致', '注册中心没有跳动'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-up'}]},
  {id: 's3-proof-level-flight', at: 0.55, label: '落花前平展', kind: 'peak', assertions: ['平展翅态在落花前可见', '主体轮廓始终位于花层上方'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'hover-level'}]},
  {id: 's3-proof-settle', at: 0.62, label: '落花定格', kind: 'peak', assertions: ['蝴蝶足部与花面形成可信接触', '落花后固定为收翅切图且不再循环'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-folded'}]},
  {id: 's3-proof-final', at: 0.91, label: '梦中忘我', kind: 'final', assertions: ['蝴蝶仍稳定停在花上', '结尾主体没有被花瓣遮挡'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-folded'}]},
];
const s3 = sceneById(project, 'scene-03');
s3.motion.proofTimes = structuredClone(s3Story.proofTimes);
const s3Group = nodeById(s3, 'flower-landing-rig');
s3Group.support.layering = 'subject-front';
const s3Sequence = nodeById(s3, 'dream-butterfly');
s3Sequence.states = [
  {id: 'wings-folded', src: 'projects/zhuang-zhou-meng-die/assets/registered/butterfly-flower-wings-folded.png', at: 0},
  {id: 'wings-open', src: 'projects/zhuang-zhou-meng-die/assets/registered/butterfly-flower-wings-open.png', at: 0.18},
  {id: 'wings-up', src: 'projects/zhuang-zhou-meng-die/assets/registered/butterfly-flower-wings-up.png', at: 0.36},
  {id: 'hover-level', src: 'projects/zhuang-zhou-meng-die/assets/registered/butterfly-flower-hover-level.png', at: 0.54},
];
s3Sequence.playback = {mode: 'loop', cycles: 5, activeUntil: 0.56, holdStateId: 'wings-folded'};
s3Sequence.transition = {type: 'cut', durationSeconds: 0};
const petalsIndex = s3.composition.nodes.findIndex(({id}) => id === 'foreground-petals');
const [petals] = s3.composition.nodes.splice(petalsIndex, 1);
petals.z = -15;
s3Group.children.push(petals);
s3.events = [
  {id: 's3-event-folded-flight', beatId: 's3-glide-through-flowers', at: 0, targetId: 'scene', visual: {kind: 'hold', durationSeconds: 2.2}, proofTimeId: 's3-proof-folded-flight'},
  {id: 's3-event-open-flight', beatId: 's3-flight-open', at: 0.18, targetId: 'dream-butterfly', visual: {kind: 'emphasis', action: 'lift', durationSeconds: 1.2, intensity: 0.18}, proofTimeId: 's3-proof-open-flight'},
  {id: 's3-event-up-flight', beatId: 's3-flight-up', at: 0.36, targetId: 'dream-butterfly', visual: {kind: 'emphasis', action: 'lift', durationSeconds: 0.6, intensity: 0.16}, proofTimeId: 's3-proof-up-flight'},
  {id: 's3-event-level-flight', beatId: 's3-flight-level', at: 0.54, targetId: 'dream-butterfly', visual: {kind: 'emphasis', action: 'settle', durationSeconds: 0.4, intensity: 0.12}, proofTimeId: 's3-proof-level-flight'},
  {id: 's3-event-settle', beatId: 's3-settle-on-flower', at: 0.56, targetId: 'dream-butterfly', visual: {kind: 'emphasis', action: 'settle', durationSeconds: 1.1, intensity: 0.35}, proofTimeId: 's3-proof-settle'},
  {id: 's3-event-forget', beatId: 's3-forget-zhuang', at: 0.86, targetId: 'scene', visual: {kind: 'hold', durationSeconds: 0.9}, proofTimeId: 's3-proof-final'},
];

const s5Story = sceneById(storyboard, 'scene-05');
const [s5Tableau, s5Circle, s5Question, s5Final] = s5Story.beats;
const questionTreatment = s5Question.treatments.find(({graphic}) => graphic?.kind === 'text');
s5Tableau.at = 0;
s5Tableau.proofTimeId = 's5-proof-establish';
questionTreatment.proofTimeId = 's5-proof-establish';
s5Tableau.treatments.push(questionTreatment, stateTreatment({id: 's5-state-folded', stateId: 'wings-folded', visualChange: '结尾蝴蝶循环从收翅切图开始', proofTimeId: 's5-proof-establish'}));
s5Circle.at = 0.25;
s5Circle.treatments.push(stateTreatment({id: 's5-state-open', stateId: 'wings-open', visualChange: '结尾蝴蝶循环进入展翅切图', proofTimeId: 's5-proof-circle'}));
Object.assign(s5Question, {
  id: 's5-butterfly-wings-up', at: 0.5, purpose: '保持结尾蝴蝶持续展翅', visual: '蝴蝶双翅上举，文字仍从开场持续可读', proofTimeId: 's5-proof-question',
  treatments: [stateTreatment({id: 's5-state-up', stateId: 'wings-up', visualChange: '结尾蝴蝶循环进入上举切图', proofTimeId: 's5-proof-question'})],
});
s5Final.at = 0.75;
s5Final.treatments.push(stateTreatment({id: 's5-state-level', stateId: 'hover-level', visualChange: '结尾蝴蝶循环进入平展切图', proofTimeId: 's5-proof-final'}));
s5Story.beats = [s5Tableau, s5Circle, s5Question, s5Final];
s5Story.proofTimes = [
  {id: 's5-proof-establish', at: 0.13, label: '庄蝶与提问同现', kind: 'establish', assertions: ['提问文字从第五幕开场即清晰可读', '庄周与蝴蝶各自完整可辨'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-folded'}]},
  {id: 's5-proof-circle', at: 0.285, label: '墨圆呼吸与展翅', kind: 'action', assertions: ['墨圆持续呼吸但不遮断主体', '蝴蝶展开双翅并保持传统宣纸风格'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-open'}]},
  {id: 's5-proof-question', at: 0.57, label: '开放之问持续可读', kind: 'peak', assertions: ['提问文字持续准确可读', '蝴蝶上举翅态属于循环动画'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'wings-up'}]},
  {id: 's5-proof-final', at: 0.845, label: '物化余韵', kind: 'final', assertions: ['最终构图稳定完整且没有长时间圆圈独显', '开放问题没有被替换成单一教训'], stateAssertions: [{nodeId: 'dream-butterfly', stateId: 'hover-level'}]},
];
const s5 = sceneById(project, 'scene-05');
s5.motion.proofTimes = structuredClone(s5Story.proofTimes);
const finalGroup = nodeById(s5, 'final-lockup');
const butterflyIndex = finalGroup.children.findIndex(({id}) => id === 'dream-butterfly');
finalGroup.children[butterflyIndex] = {
  id: 'dream-butterfly', kind: 'state-sequence', assetRole: 'character', poseFamilyId: 'butterfly-flight-states',
  registration: {id: 'butterfly-flight-registration', sourceMasterAssetId: 'butterfly-flight-master', canvas: {width: 1024, height: 1024}, origin: 'top-left'},
  states: [
    {id: 'wings-folded', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-folded.png', at: 0},
    {id: 'wings-open', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-open.png', at: 0.25},
    {id: 'wings-up', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-wings-up.png', at: 0.5},
    {id: 'hover-level', src: 'projects/zhuang-zhou-meng-die/assets/characters/butterfly-flight-states-hover-level.png', at: 0.75},
  ],
  playback: {mode: 'loop', cycles: 8}, transition: {type: 'cut', durationSeconds: 0}, z: 1,
  transform: {x: 0.82, y: 0.49, width: 0.27, anchorX: 0.5, anchorY: 0.5},
  motion: {keyframes: [{at: 0, y: 0}, {at: 1, y: 0}]},
};
const circle = nodeById(s5, 'transformation-circle');
circle.motion = {
  keyframes: [{at: 0, opacity: 0.62}, {at: 1, opacity: 0.62}],
  idle: {preset: 'breathe', intensity: 0.22, cycleSeconds: 2.8},
};
const question = nodeById(s5, 'open-question-text');
question.motion = {keyframes: [{at: 0, y: 0, opacity: 1}, {at: 0.08, y: -0.006, opacity: 1, ease: 'ease-out'}, {at: 1, y: 0, opacity: 1, ease: 'ease-in-out'}]};
s5.events = [
  {id: 's5-event-establish', beatId: 's5-zhuang-butterfly-tableau', at: 0, targetId: 'scene', visual: {kind: 'hold', durationSeconds: 2}, proofTimeId: 's5-proof-establish'},
  {id: 's5-event-question', beatId: 's5-zhuang-butterfly-tableau', at: 0, targetId: 'open-question-text', visual: {kind: 'emphasis', action: 'settle', durationSeconds: 2, intensity: 0.16}, proofTimeId: 's5-proof-establish'},
  {id: 's5-event-circle', beatId: 's5-ink-circle-draw', at: 0.25, targetId: 'transformation-circle', visual: {kind: 'emphasis', action: 'pulse', durationSeconds: 1.2, intensity: 0.18}, proofTimeId: 's5-proof-circle'},
  {id: 's5-event-wings-up', beatId: 's5-butterfly-wings-up', at: 0.5, targetId: 'dream-butterfly', visual: {kind: 'emphasis', action: 'lift', durationSeconds: 1.2, intensity: 0.14}, proofTimeId: 's5-proof-question'},
  {id: 's5-event-final', beatId: 's5-quiet-hold', at: 0.75, targetId: 'scene', visual: {kind: 'hold', durationSeconds: 1.5}, proofTimeId: 's5-proof-final'},
];

const authoring = {
  ...storyboard,
  scenes: storyboard.scenes.map(({compositionPlan, directing, ...scene}) => scene),
  directingSummary: undefined,
  updatedAt: new Date().toISOString(),
};
const compiled = compileStoryboardDirecting(authoring, {plan: project.plan});
for (const scene of project.scenes) {
  const approved = sceneById(compiled, scene.id);
  scene.motion.proofTimes = structuredClone(approved.proofTimes);
}
await writeJson(storyboardFile, compiled);
await writeJson(projectFile, project);
console.log('preview-revision: updated storyboard directing and project execution tree');
