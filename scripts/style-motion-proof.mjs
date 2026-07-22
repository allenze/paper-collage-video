#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {collectCompositionGroups, collectStateSequences, flattenCompositionNodes} from './composition-lib.mjs';
import {
  buildAssetEvidence,
  padEvidenceBounds,
  safeEvidenceId,
} from './asset-evidence-lib.mjs';
import {collectCompositeQualityTargets} from './quality-lib.mjs';
import {
  styleFingerprintForTarget,
  styleProofReportPath,
} from './style-proof-lib.mjs';

sharp.cache(false);
sharp.concurrency(1);
import {
  ROOT,
  assertSlug,
  loadProject,
  probeMedia,
  projectPaths,
  resolvePublicFile,
  resolveRenderConcurrency,
  runCommand,
  writeJson,
} from './project-lib.mjs';

const args = process.argv.slice(2);
const slug = args.find((argument) => !argument.startsWith('--'));
const valueFor = (name) => args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
const durationSeconds = Number(valueFor('--duration') ?? 5);

const debugOverlay = ({width, height, bounds, label}) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="#ff3b30" stroke-width="6"/>
    <rect x="${bounds.left}" y="${Math.max(0, bounds.top - 44)}" width="${Math.min(bounds.width, 720)}" height="44" fill="rgba(255,59,48,.9)"/>
    <text x="${bounds.left + 12}" y="${Math.max(30, bounds.top - 12)}" fill="white" font-size="24" font-family="sans-serif">${label.replace(/[<>&]/g, '')}</text>
  </svg>
`);

const findTargetBounds = ({scene, nodeId, video}) => {
  let result = null;
  const visit = (nodes, parentRect) => {
    for (const node of nodes ?? []) {
      const transform = node.transform ?? {};
      const width = Number(transform.width ?? 1) * parentRect.width;
      const height = transform.height !== undefined
        ? Number(transform.height) * parentRect.height
        : node.kind === 'group'
          ? width * node.coordinateSpace.height / node.coordinateSpace.width
          : node.kind === 'state-sequence'
            ? width * node.registration.canvas.height / node.registration.canvas.width
            : parentRect.height;
      const rect = {
        left: parentRect.left + Number(transform.x ?? 0) * parentRect.width - Number(transform.anchorX ?? 0) * width,
        top: parentRect.top + Number(transform.y ?? 0) * parentRect.height - Number(transform.anchorY ?? 0) * height,
        width,
        height,
      };
      if (node.id === nodeId) result = rect;
      if (node.kind === 'group') visit(node.children, rect);
    }
  };
  visit(scene.composition?.nodes, {left: 0, top: 0, width: video.width, height: video.height});
  return padEvidenceBounds(result ?? {left: 0, top: 0, width: video.width, height: video.height}, video, 32);
};

const makeProofTone = ({sampleRate = 48000, seconds = 1} = {}) => {
  const sampleCount = sampleRate * seconds;
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(sample / sampleRate * Math.PI * 2 * 220) * 220), 44 + sample * 2);
  }
  return buffer;
};

try {
  assertSlug(slug);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 3 || durationSeconds > 5) throw new Error('--duration 必须位于 3..5 秒。');
  const {project} = await loadProject(slug);
  const selected = project.scenes.find((scene) =>
    collectCompositionGroups(scene.composition).some(({node}) => ['supported-subject', 'registered-environment'].includes(node.pattern)) ||
    collectStateSequences(scene.composition).length > 0,
  );
  if (!selected) throw new Error('项目没有可用于真实运动样片的 state-sequence、supported-subject 或 registered-environment 组合。');

  const paths = projectPaths(slug);
  const proofDirectory = path.join(paths.distDirectory, 'style-proof');
  const propsFile = path.join(proofDirectory, 'project.json');
  const output = path.join(paths.distDirectory, 'style-motion-proof.mp4');
  const reportFile = styleProofReportPath(slug);
  const contactSheet = path.join(paths.distDirectory, 'style-motion-proof-contact-sheet.jpg');
  const toneSrc = `projects/${slug}/audio/style-proof-tone.wav`;
  const toneFile = resolvePublicFile(toneSrc);
  await fs.mkdir(path.dirname(toneFile), {recursive: true});
  await fs.writeFile(toneFile, makeProofTone());

  const proofProject = {
    ...project,
    plan: {
      ...project.plan,
      requested: {durationSeconds, sceneCount: 1},
      resolved: {...project.plan.resolved, durationSeconds, sceneCount: 1},
    },
    audio: {...project.audio, narration: {volume: 0.01}, music: null},
    scenes: [{
      ...selected,
      tailSeconds: durationSeconds - 1,
      transition: {type: 'none', durationSeconds: 0},
      narration: {src: toneSrc, startSeconds: 0, durationSeconds: 1, text: ''},
      subtitles: [],
    }],
  };
  await writeJson(propsFile, proofProject);

  const frameCount = Math.round(durationSeconds * project.video.fps);
  const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
  await runCommand(remotion, [
    'render', 'src/index.ts', 'Paper-Collage', output,
    `--props=${path.relative(ROOT, propsFile)}`,
    `--frames=0-${Math.max(1, frameCount - 1)}`,
    `--concurrency=${resolveRenderConcurrency()}`,
    '--scale=0.5', '--crf=24', '--audio-bitrate=96k',
  ]);

  const proofs = selected.motion.proofTimes.length <= 3
    ? selected.motion.proofTimes
    : [selected.motion.proofTimes[0], selected.motion.proofTimes[Math.floor(selected.motion.proofTimes.length / 2)], selected.motion.proofTimes.at(-1)];
  const frameDirectory = path.join(proofDirectory, 'frames');
  const cropDirectory = path.join(proofDirectory, 'crops');
  const debugDirectory = path.join(proofDirectory, 'debug');
  const evidenceDirectory = path.join(proofDirectory, 'evidence');
  await Promise.all([frameDirectory, cropDirectory, debugDirectory, evidenceDirectory].map((directory) => fs.mkdir(directory, {recursive: true})));
  const renderedFrames = new Map();
  const panels = await Promise.all(proofs.map(async (proof, index) => {
    const frameFile = path.join(frameDirectory, `proof-${index + 1}-${proof.id}.png`);
    const frame = Math.round(proof.at * Math.max(1, frameCount - 1));
    await runCommand(remotion, [
      'still', 'src/index.ts', 'Paper-Collage', frameFile,
      `--props=${path.relative(ROOT, propsFile)}`,
      `--frame=${frame}`,
      `--concurrency=${resolveRenderConcurrency()}`,
    ]);
    renderedFrames.set(proof.id, frameFile);
    return sharp(frameFile).resize(640, 360, {fit: 'cover'}).jpeg().toBuffer();
  }));
  await sharp({create: {width: panels.length * 640, height: 360, channels: 3, background: '#160f0d'}})
    .composite(panels.map((input, index) => ({input, left: index * 640, top: 0})))
    .jpeg({quality: 90})
    .toFile(contactSheet);

  const coupledGroups = collectCompositionGroups(selected.composition).filter(({node}) => ['supported-subject', 'registered-environment'].includes(node.pattern));
  const stateSequences = collectStateSequences(selected.composition);
  const memberNodes = new Map();
  for (const {node: group} of coupledGroups) {
    for (const {node} of flattenCompositionNodes(group.children)) {
      if (node.kind === 'asset') memberNodes.set(`${node.id}:${node.src}`, {node, evidenceId: node.id});
      if (node.kind === 'state-sequence') {
        for (const state of node.states) memberNodes.set(`${node.id}:${state.src}`, {
          node: {...node, kind: 'asset', src: state.src},
          evidenceId: `${node.id}-${state.id}`,
        });
      }
    }
  }
  for (const {node} of stateSequences) {
    for (const state of node.states) memberNodes.set(`${node.id}:${state.src}`, {
      node: {...node, kind: 'asset', src: state.src},
      evidenceId: `${node.id}-${state.id}`,
    });
  }
  const assetEvidence = [];
  for (const {node, evidenceId} of memberNodes.values()) {
    assetEvidence.push(await buildAssetEvidence({node, directory: evidenceDirectory, evidenceId}));
  }
  const targets = (await collectCompositeQualityTargets(project)).filter(({sceneId, pattern}) => sceneId === selected.id && ['state-sequence', 'supported-subject', 'registered-environment'].includes(pattern));
  const composites = [];
  for (const target of targets) {
    const bounds = findTargetBounds({scene: selected, nodeId: target.nodeId, video: project.video});
    const proofFrames = [];
    for (const proofTimeId of target.proofTimeIds) {
      const fullFrame = renderedFrames.get(proofTimeId);
      if (!fullFrame) continue;
      const id = `${safeEvidenceId(target.compositeId)}-${safeEvidenceId(proofTimeId)}`;
      const cropFile = path.join(cropDirectory, `${id}.png`);
      const debugFile = path.join(debugDirectory, `${id}.png`);
      await sharp(fullFrame).extract(bounds).png().toFile(cropFile);
      await sharp(fullFrame)
        .composite([{input: debugOverlay({width: project.video.width, height: project.video.height, bounds, label: `${target.compositeId} · ${proofTimeId}`})}])
        .png()
        .toFile(debugFile);
      proofFrames.push({
        proofTimeId,
        fullFrame: path.relative(ROOT, fullFrame),
        crop: path.relative(ROOT, cropFile),
        debugFrame: path.relative(ROOT, debugFile),
        bounds,
      });
    }
    composites.push({
      compositeId: target.compositeId,
      styleFingerprint: styleFingerprintForTarget(target),
      proofFrames,
    });
  }

  const probe = await probeMedia(output);
  const groups = [
    ...coupledGroups.map(({node}) => ({id: node.id, pattern: node.pattern, registrationId: node.registration?.id ?? null, sourceMasterAssetId: node.registration?.sourceMasterAssetId ?? null})),
    ...stateSequences.map(({node}) => ({id: node.id, pattern: 'state-sequence', registrationId: node.registration.id, sourceMasterAssetId: node.registration.sourceMasterAssetId})),
  ];
  await writeJson(reportFile, {
    schemaVersion: 3,
    slug,
    generatedAt: new Date().toISOString(),
    sceneId: selected.id,
    output: path.relative(ROOT, output),
    contactSheet: path.relative(ROOT, contactSheet),
    proofProject: path.relative(ROOT, propsFile),
    method: 'real v5 project composition, registered derivatives and state sequences, authored keyframes and cue runtime',
    groups,
    composites,
    assetEvidence,
    durationSeconds: Number(probe.format?.duration ?? durationSeconds),
    proofFrameCount: panels.length,
  });
  console.log(`✓ v5 真实拓扑运动证明：${path.relative(ROOT, output)}`);
  console.log(`✓ 组合证明联系表：${path.relative(ROOT, contactSheet)}`);
  console.log(`✓ 运动报告：${path.relative(ROOT, reportFile)}`);
} catch (error) {
  console.error(`style:proof failed: ${error.message}`);
  process.exitCode = 1;
}
