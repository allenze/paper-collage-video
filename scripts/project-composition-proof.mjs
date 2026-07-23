#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  collectCompositionAssets,
  collectStateSequences,
  deriveEventTimeline,
} from './composition-lib.mjs';
import {
  assetEvidenceIsCurrent,
  buildAssetEvidence,
} from './asset-evidence-lib.mjs';
import {
  ROOT,
  deriveTimeline,
  formatValidation,
  loadProject,
  projectPaths,
  resolvePublicFile,
  resolveRenderConcurrency,
  runCommand,
  validateProject,
  fileExists,
  readJson,
  writeJson,
} from './project-lib.mjs';
import {
  collectCompositeQualityTargets,
  compositionProofReportPath,
} from './quality-lib.mjs';
import {createSceneProofFingerprint} from './render-cache-lib.mjs';
import {createRuntimeBuildFingerprint} from './runtime-build-lib.mjs';
import {
  activeManifestAssets,
  assertAssetManifest,
} from './asset-manifest-lib.mjs';
import {buildLayerStackProof} from './layer-stack-proof-lib.mjs';
import {applyResponsiveDirectingPlan} from '../src/editorialPrimitives.mjs';

const args = process.argv.slice(2);
const [slug] = args.filter((argument) => !argument.startsWith('--'));
const force = args.includes('--force');

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const findTargetBounds = ({scene, nodeId, video}) => {
  let result = null;
  const visit = (nodes, parentRect, parentGroup = null) => {
    for (const node of nodes ?? []) {
      const transform = node.transform ?? {};
      const width = Number(transform.width ?? 1) * parentRect.width;
      const height = node.kind === 'group'
        ? (transform.height === undefined
            ? width * node.coordinateSpace.height / node.coordinateSpace.width
            : Number(transform.height) * parentRect.height)
        : node.kind === 'state-sequence' && transform.height === undefined
          ? width * node.registration.canvas.height / node.registration.canvas.width
        : Number(transform.height ?? 1) * parentRect.height;
      const rect = {
        left: parentRect.left + Number(transform.x ?? 0) * parentRect.width - Number(transform.anchorX ?? 0) * width,
        top: parentRect.top + Number(transform.y ?? 0) * parentRect.height - Number(transform.anchorY ?? 0) * height,
        width,
        height,
      };
      if (node.id === nodeId) result = node.kind === 'group' ? rect : parentGroup ?? rect;
      if (node.kind === 'group') visit(node.children, rect, rect);
    }
  };
  visit(scene.composition?.nodes, {left: 0, top: 0, width: video.width, height: video.height});
  const rect = result ?? {left: 0, top: 0, width: video.width, height: video.height};
  const padding = Math.max(16, Math.round(Math.max(rect.width, rect.height) * 0.08));
  const left = clamp(Math.floor(rect.left - padding), 0, video.width - 1);
  const top = clamp(Math.floor(rect.top - padding), 0, video.height - 1);
  return {
    left,
    top,
    width: clamp(Math.ceil(rect.width + padding * 2), 1, video.width - left),
    height: clamp(Math.ceil(rect.height + padding * 2), 1, video.height - top),
  };
};

const findNodeRenderSize = ({scene, nodeId, video}) => {
  let result = null;
  const visit = (nodes, parentRect) => {
    for (const node of nodes ?? []) {
      const transform = node.transform ?? {};
      const width = Number(transform.width ?? 1) * parentRect.width;
      const height = node.kind === 'group'
        ? (transform.height === undefined
            ? width * node.coordinateSpace.height / node.coordinateSpace.width
            : Number(transform.height) * parentRect.height)
        : node.kind === 'state-sequence' && transform.height === undefined
          ? width * node.registration.canvas.height / node.registration.canvas.width
          : Number(transform.height ?? 1) * parentRect.height;
      const rect = {
        left: parentRect.left + Number(transform.x ?? 0) * parentRect.width -
          Number(transform.anchorX ?? 0) * width,
        top: parentRect.top + Number(transform.y ?? 0) * parentRect.height -
          Number(transform.anchorY ?? 0) * height,
        width,
        height,
      };
      if (node.id === nodeId) result = {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      };
      if (node.kind === 'group') visit(node.children, rect);
    }
  };
  visit(
    scene.composition?.nodes,
    {left: 0, top: 0, width: video.width, height: video.height},
  );
  return result;
};

const debugOverlay = ({width, height, bounds, label}) => Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="#ff3b30" stroke-width="6"/>
    <rect x="${bounds.left}" y="${Math.max(0, bounds.top - 44)}" width="${Math.min(bounds.width, 760)}" height="44" fill="rgba(255,59,48,.9)"/>
    <text x="${bounds.left + 12}" y="${Math.max(30, bounds.top - 12)}" fill="white" font-size="24" font-family="sans-serif">${label.replace(/[<>&]/g, '')}</text>
  </svg>
`);

try {
  if (!slug) throw new Error('用法：project:composition-proof -- <slug>');
  await runCommand(process.execPath, ['scripts/project-sync.mjs', slug]);
  const {project} = await loadProject(slug);
  const validation = await validateProject(project);
  console.log(formatValidation(validation));
  if (!validation.passed) throw new Error('v10 组合结构未通过，不能生成证明帧。');

  const timeline = deriveTimeline(project);
  const paths = projectPaths(slug);
  const outputDirectory = path.dirname(compositionProofReportPath(slug));
  const frameDirectory = path.join(outputDirectory, 'frames');
  const cropDirectory = path.join(outputDirectory, 'crops');
  const debugDirectory = path.join(outputDirectory, 'debug');
  const responsiveInputDirectory = path.join(
    outputDirectory,
    'responsive-inputs',
  );
  await fs.mkdir(frameDirectory, {recursive: true});
  await fs.mkdir(cropDirectory, {recursive: true});
  await fs.mkdir(debugDirectory, {recursive: true});
  await fs.mkdir(responsiveInputDirectory, {recursive: true});
  const evidenceDirectory = path.join(outputDirectory, 'evidence');
  await fs.mkdir(evidenceDirectory, {recursive: true});
  const runtimeBuildFingerprint = await createRuntimeBuildFingerprint();

  const reportFile = compositionProofReportPath(slug);
  const previous = (await fileExists(reportFile))
    ? await readJson(reportFile).catch(() => null)
    : null;
  const previousFrames = new Map(
    (previous?.frames ?? []).map((frame) => [
      `${frame.profileId ?? 'active'}:${frame.sceneId}:${frame.proofTimeId}`,
      frame,
    ]),
  );
  const previousComposites = new Map(
    (previous?.composites ?? []).map((entry) => [entry.compositeId, entry]),
  );
  const previousEvidence = new Map(
    (previous?.assetEvidence ?? []).map((entry) => [
      `${entry.sceneId ?? ''}:${entry.nodeId}:${entry.source}`,
      entry,
    ]),
  );
  const manifestFile = path.join(
    ROOT,
    'projects',
    slug,
    'assets-manifest.json',
  );
  const manifest = (await fileExists(manifestFile))
    ? assertAssetManifest(await readJson(manifestFile), slug)
    : {schemaVersion: 4, projectSlug: slug, assets: []};
  const recordsByFile = new Map(
    activeManifestAssets(manifest).map((record) => [
      path.normalize(record.file),
      record,
    ]),
  );
  const recordsByAssetId = new Map(
    activeManifestAssets(manifest).map((record) => [
      record.assetId,
      record,
    ]),
  );

  const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
  const rendered = new Map();
  const frames = [];
  let browserReady = false;
  let reusedFrames = 0;
  let renderedFrames = 0;
  for (const scene of timeline.scenes) {
    for (const proof of scene.motion?.proofTimes ?? []) {
      const absoluteFrame = scene.from + Math.round(proof.at * Math.max(0, scene.durationInFrames - 1));
      const key = `${scene.id}:${proof.id}`;
      const file = path.join(frameDirectory, `${scene.id}-${proof.id}.png`);
      const fingerprint = await createSceneProofFingerprint({
        project,
        scene,
        proof,
        absoluteFrame,
      });
      const cached = previousFrames.get(`active:${key}`);
      const reusable =
        !force &&
        cached?.fingerprint === fingerprint &&
        cached.absoluteFrame === absoluteFrame &&
        await fileExists(file);
      if (reusable) {
        reusedFrames += 1;
      } else {
        if (!browserReady) {
          await runCommand(remotion, ['browser', 'ensure']);
          browserReady = true;
        }
        await runCommand(remotion, [
          'still',
          'src/index.ts',
          'Paper-Collage',
          file,
          `--props=${path.relative(ROOT, paths.projectFile)}`,
          `--frame=${absoluteFrame}`,
          `--concurrency=${resolveRenderConcurrency()}`,
        ]);
        renderedFrames += 1;
      }
      const entry = {
        sceneId: scene.id,
        proofTimeId: proof.id,
        absoluteFrame,
        fingerprint,
        file: path.relative(ROOT, file),
      };
      frames.push(entry);
      rendered.set(key, {
        file,
        absoluteFrame,
        fingerprint,
        width: project.video.width,
        height: project.video.height,
      });
    }
  }

  const sceneById = new Map(timeline.scenes.map((scene) => [scene.id, scene]));
  const targets = await collectCompositeQualityTargets(project);
  const coupledNodes = new Map();
  for (const scene of project.scenes ?? []) {
    for (const {node, parent} of collectCompositionAssets(scene.composition)) {
      if (
        !parent ||
        ![
          'supported-subject',
          'registered-environment',
          'registered-depth-stack',
        ].includes(parent.pattern)
      ) continue;
      coupledNodes.set(`${scene.id}:${node.id}:${node.src}`, {
        sceneId: scene.id,
        node,
        renderSize: findNodeRenderSize({
          scene,
          nodeId: node.id,
          video: project.video,
        }),
      });
    }
    for (const {node} of collectStateSequences(scene.composition)) {
      for (const state of node.states) {
        coupledNodes.set(`${scene.id}:${node.id}:${state.src}`, {
          sceneId: scene.id,
          stateId: state.id,
          node: {...node, kind: 'asset', src: state.src},
          renderSize: findNodeRenderSize({
            scene,
            nodeId: node.id,
            video: project.video,
          }),
        });
      }
    }
  }
  const assetEvidence = [];
  let reusedEvidence = 0;
  let generatedEvidence = 0;
  for (const {
    sceneId,
    node,
    stateId = null,
    renderSize,
  } of coupledNodes.values()) {
    const record = recordsByFile.get(
      path.normalize(path.join('public', node.src)),
    ) ?? null;
    const registeredFamilyBinding = record?.registeredFamilyBinding ?? null;
    const cached = previousEvidence.get(`${sceneId}:${node.id}:${node.src}`);
    if (!force && await assetEvidenceIsCurrent(cached, node, {
      renderSize,
      registeredFamilyBinding,
    })) {
      assetEvidence.push(cached);
      reusedEvidence += 1;
    } else {
      assetEvidence.push({
        ...await buildAssetEvidence({
          node,
          directory: evidenceDirectory,
          evidenceId: `${sceneId}-${node.id}${stateId ? `-${stateId}` : ''}`,
          renderSize,
          registeredFamilyBinding,
        }),
        sceneId,
      });
      generatedEvidence += 1;
    }
  }
  const responsiveVariants = new Map();
  const responsiveRendered = new Map();
  const responsiveVariantFor = async (target) => {
    const profileId = target.responsive.profileId;
    const cached = responsiveVariants.get(profileId);
    if (cached) return cached;
    const responsiveProject = applyResponsiveDirectingPlan({
      ...structuredClone(project),
      video: {
        ...project.video,
        width: target.responsive.width,
        height: target.responsive.height,
      },
      editorial: {
        ...structuredClone(project.editorial),
        activeProfile: profileId,
      },
    });
    const responsiveTimeline = deriveTimeline(responsiveProject);
    const inputFile = path.join(
      responsiveInputDirectory,
      `project-${profileId.replace(':', 'x')}.json`,
    );
    await writeJson(inputFile, responsiveProject);
    const variant = {
      project: responsiveProject,
      timeline: responsiveTimeline,
      inputFile,
    };
    responsiveVariants.set(profileId, variant);
    return variant;
  };
  const renderResponsiveProof = async ({target, sceneId, proofTimeId}) => {
    const profileId = target.responsive.profileId;
    const key = `${profileId}:${sceneId}:${proofTimeId}`;
    const existing = responsiveRendered.get(key);
    if (existing) return existing;
    const variant = await responsiveVariantFor(target);
    const scene = variant.timeline.scenes.find(({id}) => id === sceneId);
    const proof = scene?.motion?.proofTimes?.find(
      ({id}) => id === proofTimeId,
    );
    if (!scene || !proof) {
      throw new Error(
        `${target.compositeId} 缺少响应式证明时刻 ${sceneId}/${proofTimeId}。`,
      );
    }
    const absoluteFrame =
      scene.from +
      Math.round(
        proof.at * Math.max(0, scene.durationInFrames - 1),
      );
    const safeProfile = profileId.replace(':', 'x');
    const file = path.join(
      frameDirectory,
      `responsive-${safeProfile}-${sceneId}-${proofTimeId}.png`,
    );
    const fingerprint = await createSceneProofFingerprint({
      project: variant.project,
      scene,
      proof,
      absoluteFrame,
    });
    const cached = previousFrames.get(key);
    const reusable =
      !force &&
      cached?.fingerprint === fingerprint &&
      cached.absoluteFrame === absoluteFrame &&
      await fileExists(file);
    if (reusable) {
      reusedFrames += 1;
    } else {
      if (!browserReady) {
        await runCommand(remotion, ['browser', 'ensure']);
        browserReady = true;
      }
      await runCommand(remotion, [
        'still',
        'src/index.ts',
        'Paper-Collage',
        file,
        `--props=${path.relative(ROOT, variant.inputFile)}`,
        `--frame=${absoluteFrame}`,
        `--concurrency=${resolveRenderConcurrency()}`,
      ]);
      renderedFrames += 1;
    }
    const entry = {
      profileId,
      sceneId,
      proofTimeId,
      absoluteFrame,
      fingerprint,
      file: path.relative(ROOT, file),
    };
    frames.push(entry);
    const renderedEntry = {
      file,
      absoluteFrame,
      fingerprint,
      width: target.responsive.width,
      height: target.responsive.height,
    };
    responsiveRendered.set(key, renderedEntry);
    return renderedEntry;
  };
  const composites = [];
  let reusedComposites = 0;
  let generatedComposites = 0;
  for (const target of targets) {
    const cached = previousComposites.get(target.compositeId);
    const proofShots = target.proofShots ?? [{
      sceneId: target.sceneId,
      nodeId: target.nodeId,
      proofTimeIds: target.proofTimeIds,
    }];
    const expectedProofs = proofShots.flatMap((shot) =>
      shot.proofTimeIds.map((proofTimeId) => ({sceneId: shot.sceneId, proofTimeId})),
    );
    if (target.pattern === 'responsive-directing') {
      for (const expected of expectedProofs) {
        await renderResponsiveProof({target, ...expected});
      }
    }
    const renderedProofFor = ({sceneId, proofTimeId}) =>
      target.pattern === 'responsive-directing'
        ? responsiveRendered.get(
            `${target.responsive.profileId}:${sceneId}:${proofTimeId}`,
          )
        : rendered.get(`${sceneId}:${proofTimeId}`);
    const reusableComposite =
      !force &&
      cached?.fingerprint === target.fingerprint &&
      cached.proofFrames?.length === expectedProofs.length &&
      (await Promise.all(expectedProofs.map(async ({sceneId, proofTimeId}) => {
        const renderedProof = renderedProofFor({sceneId, proofTimeId});
        const cachedFrame = cached.proofFrames.find((entry) =>
          entry.sceneId === sceneId && entry.proofTimeId === proofTimeId,
        );
        return Boolean(
          renderedProof &&
          cachedFrame?.frameFingerprint === renderedProof.fingerprint &&
          await fileExists(path.resolve(ROOT, cachedFrame.fullFrame ?? '')) &&
          await fileExists(path.resolve(ROOT, cachedFrame.crop ?? '')) &&
          await fileExists(path.resolve(ROOT, cachedFrame.debugFrame ?? '')),
        );
      }))).every(Boolean) &&
      (
        target.pattern !== 'registered-depth-stack' ||
        (
          cached.layerStackProof?.passed === true &&
          (
            await Promise.all([
              cached.layerStackProof.artifacts?.neutralReconstruction,
              cached.layerStackProof.artifacts?.referenceComparison,
              cached.layerStackProof.artifacts?.explodedView,
              ...(cached.layerStackProof.artifacts?.envelopeExtremes ?? [])
                .map(({file}) => file),
            ].map((file) =>
              file
                ? fileExists(path.resolve(ROOT, file))
                : false,
            ))
          ).every(Boolean)
        )
      );
    if (reusableComposite) {
      composites.push(cached);
      reusedComposites += 1;
      continue;
    }
    const proofFrames = [];
    for (const shot of proofShots) {
      const scene = sceneById.get(shot.sceneId);
      if (!scene) continue;
      for (const proofTimeId of shot.proofTimeIds) {
        const renderedProof = renderedProofFor({
          sceneId: shot.sceneId,
          proofTimeId,
        });
        if (!renderedProof) continue;
        const bounds =
          target.pattern === 'responsive-directing'
            ? {
                left: 0,
                top: 0,
                width: renderedProof.width,
                height: renderedProof.height,
              }
            : findTargetBounds({
                scene,
                nodeId: shot.nodeId,
                video: project.video,
              });
        const safeId = target.compositeId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
        const cropFile = path.join(cropDirectory, `${safeId}-${shot.sceneId}-${proofTimeId}.png`);
        const debugFile = path.join(debugDirectory, `${safeId}-${shot.sceneId}-${proofTimeId}.png`);
        await sharp(renderedProof.file).extract(bounds).png().toFile(cropFile);
        await sharp(renderedProof.file)
          .composite([{
            input: debugOverlay({
              width: renderedProof.width,
              height: renderedProof.height,
              bounds,
              label: `${target.compositeId} · ${shot.sceneId} · ${proofTimeId}`,
            }),
          }])
          .png()
          .toFile(debugFile);
        proofFrames.push({
          ...(target.pattern === 'responsive-directing'
            ? {profileId: target.responsive.profileId}
            : {}),
          sceneId: shot.sceneId,
          proofTimeId,
          absoluteFrame: renderedProof.absoluteFrame,
          frameFingerprint: renderedProof.fingerprint,
          fullFrame: path.relative(ROOT, renderedProof.file),
          crop: path.relative(ROOT, cropFile),
          debugFrame: path.relative(ROOT, debugFile),
          bounds,
        });
      }
    }
    let layerStackProof = null;
    if (target.pattern === 'registered-depth-stack') {
      const memberFiles = new Map(
        target.group.children
          .filter(({kind}) => kind === 'asset')
          .map((node) => [node.id, resolvePublicFile(node.src)]),
      );
      const referenceRecord = recordsByAssetId.get(
        target.group.registration.sourceMasterAssetId,
      );
      const built = await buildLayerStackProof({
        group: target.group,
        memberFiles,
        referenceFile: referenceRecord?.file
          ? path.resolve(ROOT, referenceRecord.file)
          : null,
        directory: evidenceDirectory,
        evidenceId: `${target.sceneId}-${target.nodeId}-layer-stack`,
      });
      layerStackProof = {
        ...built,
        artifacts: {
          neutralReconstruction: path.relative(
            ROOT,
            built.artifacts.neutralReconstruction,
          ),
          referenceComparison: path.relative(
            ROOT,
            built.artifacts.referenceComparison,
          ),
          explodedView: path.relative(
            ROOT,
            built.artifacts.explodedView,
          ),
          envelopeExtremes:
            built.artifacts.envelopeExtremes.map((entry) => ({
              ...entry,
              file: path.relative(ROOT, entry.file),
            })),
        },
        artifactHashes: Object.fromEntries(
          Object.entries(built.artifactHashes).map(
            ([file, hash]) => [path.relative(ROOT, file), hash],
          ),
        ),
      };
    }
    composites.push({
      compositeId: target.compositeId,
      sceneId: target.sceneId,
      pattern: target.pattern,
      fingerprint: target.fingerprint,
      proofFrames,
      layerStackProof,
    });
    generatedComposites += 1;
  }

  const report = {
    schemaVersion: 4,
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    scope: 'project',
    runtimeBuildFingerprint,
    frames,
    composites,
    assetEvidence,
    eventTimeline: timeline.scenes.flatMap((scene) => deriveEventTimeline({scene, sceneFrom: scene.from, fps: project.video.fps})),
    cache: {
      forced: force,
      reusedFrames,
      renderedFrames,
      reusedComposites,
      generatedComposites,
      reusedEvidence,
      generatedEvidence,
    },
  };
  await writeJson(reportFile, report);
  console.log(`✓ composition proof: ${path.relative(ROOT, reportFile)} (${composites.length} composites)`);
  console.log(`✓ proof cache: frames ${reusedFrames} reused / ${renderedFrames} rendered; composites ${reusedComposites} reused / ${generatedComposites} generated; evidence ${reusedEvidence} reused / ${generatedEvidence} generated`);
} catch (error) {
  console.error(`project:composition-proof failed: ${error.message}`);
  process.exitCode = 1;
}
