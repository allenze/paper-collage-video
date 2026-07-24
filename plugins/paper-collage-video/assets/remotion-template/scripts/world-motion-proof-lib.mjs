import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {flattenCompositionNodes, hashCompositionValue} from './composition-lib.mjs';
import {fileExists, resolvePublicFile} from './project-lib.mjs';
import {resolveParallaxState} from '../src/parallax.mjs';
import {
  inspectWorldStripCoverage,
  resolveWorldStripCopies,
  resolveWorldStripFrame,
  resolveWorldStripSpeedFactor,
  resolveWorldStripTileGeometry,
} from '../src/worldStrip.mjs';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const clamp01 = (value) => clamp(value, 0, 1);
const cleanNumber = (value) => Number(value.toFixed(6));

const ease = (value, name = 'ease-in-out') => {
  const t = clamp01(value);
  if (name === 'linear') return t;
  if (name === 'ease-in') return t * t;
  if (name === 'ease-out') return 1 - (1 - t) ** 2;
  if (name === 'hold') return 0;
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
};

const resolveKeyframeValue = (keyframes, progress, property, fallback) => {
  const sorted = [...(keyframes ?? [])].sort((left, right) => left.at - right.at);
  if (sorted.length === 0) return fallback;
  if (progress <= sorted[0].at) return sorted[0][property] ?? fallback;
  if (progress >= sorted.at(-1).at) return sorted.at(-1)[property] ?? fallback;
  const rightIndex = sorted.findIndex(({at}) => at >= progress);
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];
  const amount = ease(
    (progress - left.at) / Math.max(1e-9, right.at - left.at),
    right.ease,
  );
  return (left[property] ?? fallback) +
    ((right[property] ?? fallback) - (left[property] ?? fallback)) * amount;
};

const cameraFrames = (scene) =>
  scene.camera?.keyframes?.length >= 2
    ? [...scene.camera.keyframes].sort((left, right) => left.at - right.at)
    : scene.camera?.preset === 'static'
      ? [{at: 0, x: 0, y: 0, zoom: 1}, {at: 1, x: 0, y: 0, zoom: 1}]
      : [{at: 0, x: -10, y: 0, zoom: 1.01}, {at: 1, x: 18, y: 0, zoom: 1.028}];

const cameraAt = (scene, progress) => {
  const frames = cameraFrames(scene);
  return {
    x: resolveKeyframeValue(frames, progress, 'x', 0),
    y: resolveKeyframeValue(frames, progress, 'y', 0),
    zoom: resolveKeyframeValue(frames, progress, 'zoom', 1),
  };
};

const nodeEntry = (scene, nodeId, video) => {
  let result = null;
  const visit = (nodes, parentRect) => {
    for (const node of nodes ?? []) {
      const transform = node.transform ?? {};
      const width = Number(transform.width ?? 1) * parentRect.width;
      const height = node.kind === 'group'
        ? (
            transform.height === undefined
              ? width * node.coordinateSpace.height / node.coordinateSpace.width
              : Number(transform.height) * parentRect.height
          )
        : node.kind === 'state-sequence' && transform.height === undefined
          ? width * node.registration.canvas.height / node.registration.canvas.width
          : Number(transform.height ?? 1) * parentRect.height;
      const rect = {
        left:
          parentRect.left +
          Number(transform.x ?? 0) * parentRect.width -
          Number(transform.anchorX ?? 0) * width,
        top:
          parentRect.top +
          Number(transform.y ?? 0) * parentRect.height -
          Number(transform.anchorY ?? 0) * height,
        width,
        height,
      };
      if (node.id === nodeId) result = {node, parentRect, rect};
      if (node.kind === 'group') visit(node.children, rect);
    }
  };
  visit(scene.composition?.nodes, {left: 0, top: 0, width: video.width, height: video.height});
  return result;
};

const alphaBoundsForSource = async (source) => {
  const file = resolvePublicFile(source);
  if (!(await fileExists(file))) return null;
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  const alpha = info.channels - 1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + alpha] <= 8) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    return {x: 0, y: 0, width: 0, height: 0};
  }
  return {
    x: left / info.width,
    y: top / info.height,
    width: (right - left + 1) / info.width,
    height: (bottom - top + 1) / info.height,
  };
};

const sourceForNode = (node, progress) => {
  if (node.kind === 'asset') return node.src;
  if (node.kind !== 'state-sequence') return null;
  const states = [...node.states].sort((left, right) => left.at - right.at);
  return [...states].reverse().find(({at}) => at <= progress)?.src ?? states[0]?.src ?? null;
};

export const resolveTargetViewportSnapshot = async ({
  scene,
  nodeId,
  progress,
  video,
}) => {
  const entry = nodeEntry(scene, nodeId, video);
  if (!entry) throw new Error(`worldMotionProof target 不存在：${nodeId}`);
  const source = sourceForNode(entry.node, progress);
  if (!source) throw new Error(`worldMotionProof target ${nodeId} 没有可隔离的视觉来源。`);
  const alpha = await alphaBoundsForSource(source);
  if (!alpha) throw new Error(`worldMotionProof target ${nodeId} 来源不存在：${source}`);
  const authored = {
    x: resolveKeyframeValue(entry.node.motion?.keyframes, progress, 'x', 0),
    y: resolveKeyframeValue(entry.node.motion?.keyframes, progress, 'y', 0),
    scale: resolveKeyframeValue(entry.node.motion?.keyframes, progress, 'scale', 1),
  };
  const camera = cameraAt(scene, progress);
  const parallax = resolveParallaxState({
    depth: entry.node.depth ?? 0,
    cameraX: camera.x,
    cameraY: camera.y,
    cameraZoom: camera.zoom,
    parallax: scene.camera?.parallax,
  });
  const scale = Number(entry.node.transform?.scale ?? 1) * authored.scale * parallax.scale;
  const nodeRect = {
    left: entry.rect.left + authored.x * entry.parentRect.width + parallax.x,
    top: entry.rect.top + authored.y * entry.parentRect.height + parallax.y,
    width: entry.rect.width * scale,
    height: entry.rect.height * scale,
  };
  const isolated = {
    left: nodeRect.left + alpha.x * nodeRect.width,
    top: nodeRect.top + alpha.y * nodeRect.height,
    width: alpha.width * nodeRect.width,
    height: alpha.height * nodeRect.height,
  };
  const origin = {x: video.width * 0.5, y: video.height * 0.54};
  const cameraRect = {
    left: (isolated.left - origin.x) * camera.zoom + origin.x + camera.x,
    top: (isolated.top - origin.y) * camera.zoom + origin.y + camera.y,
    width: isolated.width * camera.zoom,
    height: isolated.height * camera.zoom,
  };
  const visible = {
    left: clamp(cameraRect.left, 0, video.width),
    top: clamp(cameraRect.top, 0, video.height),
    right: clamp(cameraRect.left + cameraRect.width, 0, video.width),
    bottom: clamp(cameraRect.top + cameraRect.height, 0, video.height),
  };
  const area = Math.max(0, cameraRect.width * cameraRect.height);
  const visibleArea = Math.max(0, visible.right - visible.left) * Math.max(0, visible.bottom - visible.top);
  return {
    progress,
    source,
    alphaBounds: alpha,
    viewportBounds: Object.fromEntries(Object.entries(cameraRect).map(([key, value]) => [key, cleanNumber(value)])),
    centroid: {
      x: cleanNumber((cameraRect.left + cameraRect.width / 2) / video.width),
      y: cleanNumber((cameraRect.top + cameraRect.height / 2) / video.height),
    },
    visibleAreaRatio: cleanNumber(area === 0 ? 0 : visibleArea / area),
    screenOccupancy: cleanNumber(visibleArea / (video.width * video.height)),
    camera: Object.fromEntries(Object.entries(camera).map(([key, value]) => [key, cleanNumber(value)])),
    authoredDisplacement: {
      x: cleanNumber(authored.x * entry.parentRect.width),
      y: cleanNumber(authored.y * entry.parentRect.height),
    },
  };
};

export const buildTargetWorldMotionProof = async ({
  scene,
  nodeId,
  proofTimes,
  video,
  minimumVisibleAreaRatio = 0.35,
  minimumScreenOccupancy = 0.002,
  maximumScreenOccupancy = 0.85,
  minimumDisplacementRatio = 0.1,
  requireMotion = true,
}) => {
  const snapshots = [];
  for (const proof of proofTimes) {
    snapshots.push({
      proofTimeId: proof.id,
      ...await resolveTargetViewportSnapshot({
        scene,
        nodeId,
        progress: proof.at,
        video,
      }),
    });
  }
  const first = snapshots[0];
  const last = snapshots.at(-1);
  const displacement = first && last ? {
    x: cleanNumber(
      (last.centroid.x - first.centroid.x) * video.width -
      (last.camera.x - first.camera.x),
    ),
    y: cleanNumber(
      (last.centroid.y - first.centroid.y) * video.height -
      (last.camera.y - first.camera.y),
    ),
  } : {x: 0, y: 0};
  const readabilityPassed = snapshots.every(
    ({visibleAreaRatio, screenOccupancy}) =>
      visibleAreaRatio >= minimumVisibleAreaRatio &&
      screenOccupancy >= minimumScreenOccupancy &&
      screenOccupancy <= maximumScreenOccupancy,
  );
  const displacementPixels = Math.hypot(displacement.x, displacement.y);
  const motionResolvable =
    displacementPixels >=
    Math.min(video.width, video.height) * minimumDisplacementRatio;
  return {
    schemaVersion: 1,
    targetId: nodeId,
    thresholds: {
      minimumVisibleAreaRatio,
      minimumScreenOccupancy,
      maximumScreenOccupancy,
      minimumDisplacementRatio,
      requireMotion,
    },
    snapshots,
    cameraCompensatedDisplacement: displacement,
    displacementPixels: cleanNumber(displacementPixels),
    readabilityPassed,
    motionResolvable,
    passed: readabilityPassed && (!requireMotion || motionResolvable),
  };
};

const defaultProfiles = (video) => [
  {profile: '16:9', width: video.width, height: video.height},
  {profile: '9:16', width: 1080, height: 1920},
  {profile: '1:1', width: 1080, height: 1080},
];

export const buildLoopingWorldProof = async ({
  root,
  projectSlug,
  scene,
  group,
  video,
  runtimeBuildFingerprint,
  profiles = defaultProfiles(video),
}) => {
  const environment = group.loopingEnvironment;
  const frozen = environment.travel.frozen === true;
  const proofById = new Map((scene.motion?.proofTimes ?? []).map((proof) => [proof.id, proof]));
  const seamProofs = ['before', 'seam', 'after'].map((key) => proofById.get(environment.seamProofTimeIds[key]));
  const strips = [];
  const coverage = [];
  for (const strip of group.children.filter(({kind}) => kind === 'world-strip')) {
    const speedFactor = resolveWorldStripSpeedFactor({
      depth: strip.depth,
      far: environment.speedRange.far,
      near: environment.speedRange.near,
    });
    const activeGeometry = resolveWorldStripTileGeometry({
      viewportWidth: group.coordinateSpace.width,
      viewportHeight: group.coordinateSpace.height,
      renderHeight: strip.transform.height * group.coordinateSpace.height,
      sourceWidth: strip.loopingStripBinding.output.width,
      sourceHeight: strip.loopingStripBinding.output.height,
      overscanPx: environment.overscanPx,
    });
    const snapshots = seamProofs.map((proof) => {
      const frame = resolveWorldStripFrame({
        progress: frozen ? 0 : proof.at,
        viewportWidth: group.coordinateSpace.width,
        tileWidth: activeGeometry.tileWidth,
        direction: environment.travel.direction,
        distanceViewports: environment.travel.distanceViewports,
        speedFactor,
        startPhase: environment.travel.startPhase,
        activeFrom: environment.travel.activeFrom ?? 0,
        overscanPx: environment.overscanPx,
      });
      const proofCoverage = inspectWorldStripCoverage({
        copies: resolveWorldStripCopies({
          firstCopyX: frame.firstCopyX,
          tileWidth: activeGeometry.tileWidth,
          copyCount: activeGeometry.copyCount,
        }),
        viewportWidth: group.coordinateSpace.width,
      });
      return {
        proofTimeId: proof.id,
        at: proof.at,
        travelProgress: cleanNumber(frame.travelProgress),
        phase: cleanNumber(frame.phaseNormalized),
        unwrappedPeriod: cleanNumber(frame.unwrappedPhase / activeGeometry.tileWidth),
        cameraCompensatedDisplacement: cleanNumber(frame.cameraCompensatedDisplacement),
        uncoveredPixels: cleanNumber(proofCoverage.uncoveredPixels),
      };
    });
    const derivationReportFile = path.join(
      root,
      'dist',
      projectSlug,
      'looping-strip',
      `${strip.loopingStripBinding.stripId}-report.json`,
    );
    const derivationReport = (await fileExists(derivationReportFile))
      ? JSON.parse(await fs.readFile(derivationReportFile, 'utf8'))
      : null;
    const seamPassed =
      derivationReport?.passed === true &&
      derivationReport.derivationFingerprint === strip.loopingStripBinding.derivationFingerprint;
    strips.push({
      nodeId: strip.id,
      role: strip.role,
      depth: strip.depth,
      speedFactor: cleanNumber(speedFactor),
      tileWidth: cleanNumber(activeGeometry.tileWidth),
      viewportSpan: cleanNumber(activeGeometry.viewportSpan),
      copyCount: activeGeometry.copyCount,
      wrapCount: Math.floor(
        (frozen ? 0 : environment.travel.distanceViewports) *
        group.coordinateSpace.width *
        speedFactor /
        activeGeometry.tileWidth,
      ),
      seamPassed,
      derivationReport: derivationReport ? path.relative(root, derivationReportFile) : null,
      snapshots,
    });
    for (const profile of profiles) {
      const renderHeight = strip.transform.height * profile.height;
      const geometry = resolveWorldStripTileGeometry({
        viewportWidth: profile.width,
        viewportHeight: profile.height,
        renderHeight,
        sourceWidth: strip.loopingStripBinding.output.width,
        sourceHeight: strip.loopingStripBinding.output.height,
        overscanPx: environment.overscanPx,
      });
      let worstUncovered = 0;
      for (let index = 0; index <= 64; index += 1) {
        const phase = index / 64;
        const copies = resolveWorldStripCopies({
          firstCopyX: phase * geometry.tileWidth - geometry.tileWidth - environment.overscanPx,
          tileWidth: geometry.tileWidth,
          copyCount: geometry.copyCount,
        });
        worstUncovered = Math.max(
          worstUncovered,
          inspectWorldStripCoverage({copies, viewportWidth: profile.width}).uncoveredPixels,
        );
      }
      coverage.push({
        nodeId: strip.id,
        profile: profile.profile,
        viewportSpan: cleanNumber(geometry.viewportSpan),
        copyCount: geometry.copyCount,
        uncoveredPixels: cleanNumber(worstUncovered),
      });
    }
  }
  const speedOrdered = strips.every(
    (strip, index) => index === 0 || strip.speedFactor > strips[index - 1].speedFactor,
  );
  const ground = strips.find(({nodeId}) => nodeId === environment.groundStripId);
  const groundCrossedSeam = ground
    ? Math.floor(ground.snapshots[0].unwrappedPeriod) !==
      Math.floor(ground.snapshots.at(-1).unwrappedPeriod)
    : false;
  const worldLockClean = frozen && strips.every(({snapshots}) =>
    snapshots.every(({travelProgress, cameraCompensatedDisplacement}) =>
      travelProgress === 0 && cameraCompensatedDisplacement === 0,
    ),
  );
  const trackedSubjectProof = await buildTargetWorldMotionProof({
    scene,
    nodeId: environment.trackedSubjectId,
    proofTimes: seamProofs,
    video,
    minimumVisibleAreaRatio: 0.55,
    minimumScreenOccupancy: 0.008,
    maximumScreenOccupancy: 0.45,
    requireMotion: false,
  });
  const trackedSubject = group.children.find(
    ({id}) => id === environment.trackedSubjectId,
  );
  const nearStrip = group.children.find(
    ({kind, role}) => kind === 'world-strip' && role === 'near',
  );
  const trackedAlpha = trackedSubject
    ? await alphaBoundsForSource(sourceForNode(trackedSubject, seamProofs[1].at))
    : null;
  const nearAlpha = nearStrip
    ? await alphaBoundsForSource(nearStrip.src)
    : null;
  const trackedTop =
    (trackedSubject?.transform?.y ?? 0) -
    (trackedSubject?.transform?.anchorY ?? 0) *
      (trackedSubject?.transform?.height ?? 1) +
    (trackedAlpha?.y ?? 0) * (trackedSubject?.transform?.height ?? 1);
  const trackedBottom =
    trackedTop +
    (trackedAlpha?.height ?? 0) *
      (trackedSubject?.transform?.height ?? 1);
  const nearTop =
    (nearStrip?.transform?.y ?? 0) +
    (nearAlpha?.y ?? 0) * (nearStrip?.transform?.height ?? 1);
  const nearBottom =
    nearTop +
    (nearAlpha?.height ?? 0) * (nearStrip?.transform?.height ?? 1);
  const verticalOverlap = Math.max(
    0,
    Math.min(trackedBottom, nearBottom) - Math.max(trackedTop, nearTop),
  );
  const foregroundOcclusion = {
    trackedSubjectZ: trackedSubject?.z ?? null,
    nearStripZ: nearStrip?.z ?? null,
    trackedSubjectVerticalBand: {
      top: cleanNumber(trackedTop),
      bottom: cleanNumber(trackedBottom),
    },
    nearStripVerticalBand: {
      top: cleanNumber(nearTop),
      bottom: cleanNumber(nearBottom),
    },
    verticalOverlap: cleanNumber(verticalOverlap),
    passed:
      Boolean(trackedAlpha && nearAlpha) &&
      nearStrip.z > trackedSubject.z &&
      verticalOverlap >= 0.02,
  };
  const groundWorldDisplacement = ground
    ? Math.abs(ground.snapshots.at(-1).cameraCompensatedDisplacement - ground.snapshots[0].cameraCompensatedDisplacement)
    : 0;
  const groundTotalWorldDisplacement = ground
    ? Math.abs(
        (frozen ? 0 : environment.travel.distanceViewports) *
        group.coordinateSpace.width *
        ground.speedFactor,
      )
    : 0;
  const proof = {
    schemaVersion: 1,
    groupId: group.id,
    trackedSubjectId: environment.trackedSubjectId,
    activeFrom: environment.travel.activeFrom ?? 0,
    frozen,
    runtimeBuildFingerprint,
    strips,
    coverage,
    speedOrdered,
    groundCrossedSeam,
    worldLockClean,
    groundWorldDisplacement: cleanNumber(groundWorldDisplacement),
    groundTotalWorldDisplacement: cleanNumber(groundTotalWorldDisplacement),
    trackedSubjectProof,
    foregroundOcclusion,
  };
  proof.fingerprint = hashCompositionValue({
    runtimeBuildFingerprint,
    group,
    camera: scene.camera,
    proofTimes: seamProofs,
    stripBindings: strips.map(({nodeId, seamPassed, derivationReport}) => ({nodeId, seamPassed, derivationReport})),
  });
  proof.passed =
    strips.length >= 2 &&
    strips.every(({seamPassed}) => seamPassed) &&
    speedOrdered &&
    (frozen
      ? worldLockClean
      : groundCrossedSeam && groundTotalWorldDisplacement >= video.width) &&
    coverage.every(({uncoveredPixels, viewportSpan}) =>
      uncoveredPixels === 0 && viewportSpan >= 1,
    ) &&
    trackedSubjectProof.passed &&
    foregroundOcclusion.passed;
  return proof;
};

export const buildTraverseWorldMotionProofs = async ({
  project,
  scene,
  storyboardScene,
}) => {
  const proofs = [];
  for (const planned of storyboardScene?.compositionPlan?.continuousMotions ?? []) {
    if (planned.preset !== 'traverse') continue;
    const bound = (scene.motion?.proofTimes ?? []).filter(
      (proof) => proof.id === planned.proofTimeId || ['establish', 'final'].includes(proof.kind),
    );
    if (bound.length < 2) continue;
    proofs.push(await buildTargetWorldMotionProof({
      scene,
      nodeId: planned.nodeId,
      proofTimes: bound.sort((left, right) => left.at - right.at),
      video: project.video,
    }));
  }
  return proofs;
};
