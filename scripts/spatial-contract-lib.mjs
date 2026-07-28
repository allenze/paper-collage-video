import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {deriveSceneTimeline} from '../src/sceneTimeline.mjs';
import {resolveParallaxState} from '../src/parallax.mjs';
import {
  resolveWorldStripFrame,
  resolveWorldStripSpeedFactor,
} from '../src/worldStrip.mjs';
import {resolveSequenceState} from './state-sequence-lib.mjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const distance = (left, right) =>
  Math.hypot(left.x - right.x, left.y - right.y);

const multiply = (left, right) => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];
const identity = () => [1, 0, 0, 1, 0, 0];
const translate = (x, y) => [1, 0, 0, 1, x, y];
const scale = (x, y = x) => [x, 0, 0, y, 0, 0];
const rotate = (degrees) => {
  const radians = degrees * Math.PI / 180;
  return [
    Math.cos(radians),
    Math.sin(radians),
    -Math.sin(radians),
    Math.cos(radians),
    0,
    0,
  ];
};
const applyMatrix = (matrix, point) => ({
  x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
  y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
});

const ease = (value, name = 'ease-in-out') => {
  const t = clamp01(value);
  if (name === 'ease-in') return t * t;
  if (name === 'ease-out') return 1 - (1 - t) * (1 - t);
  if (name === 'ease-in-out') {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }
  if (name === 'hold') return 0;
  return t;
};

const motionStateAt = (node, progress) => {
  const frames = [...(node.motion?.keyframes ?? [])].sort(
    (left, right) => left.at - right.at,
  );
  const defaults = {x: 0, y: 0, scale: 1, rotation: 0};
  const valueFor = (frame, property, fallback) =>
    frame[
      property === 'x'
        ? 'offsetX'
        : property === 'y'
          ? 'offsetY'
          : property
    ] ?? fallback;
  const stateFor = (frame) =>
    Object.fromEntries(
      Object.entries(defaults).map(([property, fallback]) => [
        property,
        valueFor(frame, property, fallback),
      ]),
    );
  if (frames.length === 0) return defaults;
  if (progress <= frames[0].at) return stateFor(frames[0]);
  if (progress >= frames.at(-1).at) return stateFor(frames.at(-1));
  const rightIndex = frames.findIndex(({at}) => at >= progress);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const amount = ease(
    (progress - left.at) / Math.max(1e-9, right.at - left.at),
    right.ease,
  );
  return Object.fromEntries(
    Object.entries(defaults).map(([property, fallback]) => [
      property,
      valueFor(left, property, fallback) +
        (valueFor(right, property, fallback) -
          valueFor(left, property, fallback)) *
          amount,
    ]),
  );
};

const phaseFor = (id, seed) => {
  let value = Number(seed ?? 0) >>> 0;
  for (const character of id ?? '') {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  return (value >>> 0) / 0xffffffff * Math.PI * 2;
};

const idleStateAt = ({node, frame, fps, seed}) => {
  const idle = node.motion?.idle;
  const defaults = {x: 0, y: 0, scale: 1, rotation: 0};
  if (!idle || idle.preset === 'still' || idle.intensity === 0) return defaults;
  const cycleFrames = Math.max(1, idle.cycleSeconds * fps);
  const phase = idle.phase ?? phaseFor(node.id, seed);
  const wave = Math.sin(frame / cycleFrames * Math.PI * 2 + phase);
  const intensity = idle.intensity;
  if (idle.preset === 'breathe') {
    return {...defaults, scale: 1 + wave * 0.008 * intensity};
  }
  if (idle.preset === 'float') {
    return {...defaults, y: wave * 0.006 * intensity};
  }
  if (idle.preset === 'drift') {
    return {
      ...defaults,
      x: wave * 0.005 * intensity,
      y: Math.cos(frame / cycleFrames * Math.PI * 2) * 0.003 * intensity,
    };
  }
  if (idle.preset === 'sway') {
    return {
      ...defaults,
      x: wave * 0.004 * intensity,
      rotation: wave * 2.8 * intensity,
    };
  }
  if (idle.preset === 'grind') {
    return {
      ...defaults,
      x: wave * 0.008 * intensity,
      rotation: wave * 0.55 * intensity,
    };
  }
  return defaults;
};

const emphasisStateAt = ({scene, node, progress, durationSeconds}) => {
  const result = {x: 0, y: 0, scale: 1, rotation: 0};
  for (const event of (scene.events ?? []).filter(
    (candidate) =>
      candidate.targetId === node.id &&
      candidate.visual?.kind === 'emphasis',
  )) {
    const visual = event.visual;
    const duration =
      Math.max(0.08, visual.durationSeconds) / Math.max(0.08, durationSeconds);
    const eventProgress = (progress - event.at) / duration;
    if (eventProgress < 0 || eventProgress > 1) continue;
    const envelope =
      Math.sin(eventProgress * Math.PI) * visual.intensity;
    if (visual.action === 'pulse') result.scale *= 1 + envelope * 0.055;
    if (visual.action === 'stamp') {
      result.scale *= 1 + envelope * 0.09;
      result.rotation += (1 - eventProgress) * 2.2 * visual.intensity;
    }
    if (visual.action === 'shake') {
      result.x +=
        Math.sin(eventProgress * Math.PI * 8) * envelope * 0.008;
      result.rotation +=
        Math.sin(eventProgress * Math.PI * 6) * envelope * 0.8;
    }
    if (visual.action === 'lift') result.y -= envelope * 0.025;
    if (visual.action === 'settle') {
      result.y += envelope * 0.014;
      result.rotation -= envelope * 0.65;
    }
    if (visual.action === 'drop-impact') {
      result.y += eventProgress < 0.62
        ? eventProgress * 0.08 * visual.intensity
        : (1 - eventProgress) * 0.018 * visual.intensity;
      result.rotation += envelope * 4.5;
      result.scale *= 1 + Math.max(0, envelope) * 0.025;
    }
    if (visual.action === 'carve') {
      result.x +=
        Math.sin(eventProgress * Math.PI * 10) * envelope * 0.004;
      result.rotation +=
        Math.sin(eventProgress * Math.PI * 8) * envelope * 1.2;
    }
  }
  return result;
};

const cameraFrames = (camera = {}) => {
  if (Array.isArray(camera.keyframes) && camera.keyframes.length >= 2) {
    return [...camera.keyframes].sort((left, right) => left.at - right.at);
  }
  const intensity = Math.max(0.6, Number(camera.intensity ?? 1));
  if (camera.preset === 'pull') {
    return [
      {at: 0, x: -10 * intensity, y: 0, zoom: 1.035},
      {at: 1, x: 12 * intensity, y: 0, zoom: 1.01},
    ];
  }
  if (camera.preset === 'pan-left') {
    return [
      {at: 0, x: 24 * intensity, y: 0, zoom: 1.018},
      {at: 1, x: -24 * intensity, y: 0, zoom: 1.022},
    ];
  }
  if (camera.preset === 'pan-right') {
    return [
      {at: 0, x: -24 * intensity, y: 0, zoom: 1.018},
      {at: 1, x: 24 * intensity, y: 0, zoom: 1.022},
    ];
  }
  if (camera.preset === 'static') {
    return [
      {at: 0, x: 0, y: 0, zoom: 1.01},
      {at: 1, x: 0, y: 0, zoom: 1.01},
    ];
  }
  return [
    {at: 0, x: -10 * intensity, y: 0, zoom: 1.01},
    {at: 1, x: 18 * intensity, y: 0, zoom: 1.028},
  ];
};

const cameraValueAt = (camera, progress, property, fallback) => {
  const frames = cameraFrames(camera);
  if (progress <= frames[0].at) return frames[0][property] ?? fallback;
  if (progress >= frames.at(-1).at) {
    return frames.at(-1)[property] ?? fallback;
  }
  const rightIndex = frames.findIndex(({at}) => at >= progress);
  const left = frames[rightIndex - 1];
  const right = frames[rightIndex];
  const amount =
    (progress - left.at) / Math.max(1e-9, right.at - left.at);
  return (
    (left[property] ?? fallback) +
    ((right[property] ?? fallback) - (left[property] ?? fallback)) * amount
  );
};

const cameraStateAt = (scene, progress) => ({
  x: cameraValueAt(scene.camera, progress, 'x', 0),
  y: cameraValueAt(scene.camera, progress, 'y', 0),
  zoom: cameraValueAt(scene.camera, progress, 'zoom', 1),
});

const cameraMatrixAt = ({scene, progress, video}) => {
  const camera = cameraStateAt(scene, progress);
  const origin = {x: video.width * 0.5, y: video.height * 0.54};
  return multiply(
    translate(origin.x + camera.x, origin.y + camera.y),
    multiply(scale(camera.zoom), translate(-origin.x, -origin.y)),
  );
};

const nodeHeight = ({node, width, parentHeight}) => {
  if (node.transform?.height !== undefined) {
    return Number(node.transform.height) * parentHeight;
  }
  if (node.kind === 'group') {
    return width * node.coordinateSpace.height / node.coordinateSpace.width;
  }
  if (node.kind === 'state-sequence') {
    return width * node.registration.canvas.height / node.registration.canvas.width;
  }
  return width;
};

const slotOrder = (node, layering = 'between-supports') => {
  if (!['asset', 'state-sequence'].includes(node.kind)) return node.z;
  const order = layering === 'subject-front'
    ? {
        'support-rear': -30,
        'contact-shadow': -20,
        'support-front': -10,
        subject: 0,
      }
    : {
        'support-rear': -30,
        'contact-shadow': -20,
        subject: -10,
        'support-front': 0,
      };
  return order[node.slot] ?? node.z;
};

const renderOrder = (node, parent) =>
  parent &&
  ['supported-subject', 'registered-depth-stack'].includes(parent.pattern)
    ? slotOrder(node, parent.support?.layering)
    : node.z;

const worldOffsetFor = ({parent, node, progress, parentWidth}) => {
  if (
    parent?.pattern !== 'looping-environment' ||
    parent.loopingEnvironment?.subjectBindings?.find(
      ({nodeId}) => nodeId === node.id,
    )?.anchorMode !== 'world'
  ) {
    return 0;
  }
  const ground = parent.children.find(
    (candidate) =>
      candidate.kind === 'world-strip' &&
      candidate.id === parent.loopingEnvironment.groundStripId,
  );
  if (!ground) return 0;
  const speedFactor = resolveWorldStripSpeedFactor({
    depth: ground.depth,
    far: parent.loopingEnvironment.speedRange.far,
    near: parent.loopingEnvironment.speedRange.near,
  });
  const travel = parent.loopingEnvironment.travel;
  return resolveWorldStripFrame({
    progress: travel.frozen === true ? 0 : progress,
    viewportWidth: parentWidth,
    tileWidth: parentWidth,
    direction: travel.direction,
    distanceViewports: travel.distanceViewports,
    speedFactor,
    startPhase: travel.startPhase,
    activeFrom: travel.activeFrom ?? 0,
    activeUntil: travel.activeUntil ?? 1,
    easing: travel.easing,
    overscanPx: parent.loopingEnvironment.overscanPx,
  }).cameraCompensatedDisplacement;
};

const resolveSceneNodes = ({scene, video, progress}) => {
  const timeline = deriveSceneTimeline({
    video,
    scenes: [scene],
    sceneTransitions: [],
  });
  const normalizedScene = timeline.scenes[0];
  const fps = video.fps;
  const frame = Math.round(
    progress * Math.max(0, normalizedScene.durationInFrames - 1),
  );
  const durationSeconds = normalizedScene.durationInFrames / fps;
  const camera = cameraStateAt(scene, progress);
  const cameraMatrix = cameraMatrixAt({scene, progress, video});
  const entries = new Map();
  const visit = ({
    nodes,
    parent = null,
    parentMatrix = identity(),
    parentWidth,
    parentHeight,
    path = [],
  }) => {
    for (const [index, node] of (nodes ?? []).entries()) {
      if (node.kind === 'group' && node.renderParticipation === 'derivation-only') {
        continue;
      }
      const transform = node.transform ?? {};
      const width = Number(transform.width ?? 1) * parentWidth;
      const height = nodeHeight({node, width, parentHeight});
      const authored = motionStateAt(node, progress);
      const idle = idleStateAt({
        node,
        frame,
        fps,
        seed: scene.motion?.seed,
      });
      const emphasis = emphasisStateAt({
        scene,
        node,
        progress,
        durationSeconds,
      });
      const parallax = resolveParallaxState({
        depth: node.depth ?? 0,
        cameraX: camera.x,
        cameraY: camera.y,
        cameraZoom: camera.zoom,
        parallax: scene.camera?.parallax,
      });
      const position = {
        x:
          Number(transform.x ?? 0) * parentWidth +
          (authored.x + idle.x + emphasis.x) * parentWidth +
          parallax.x +
          worldOffsetFor({
            parent,
            node,
            progress,
            parentWidth,
          }),
        y:
          Number(transform.y ?? 0) * parentHeight +
          (authored.y + idle.y + emphasis.y) * parentHeight +
          parallax.y,
      };
      const anchor = {
        x: Number(transform.anchorX ?? 0),
        y: Number(transform.anchorY ?? 0),
      };
      const pivot = {
        x: Number(node.motion?.pivot?.x ?? anchor.x),
        y: Number(node.motion?.pivot?.y ?? anchor.y),
      };
      const resolvedScale =
        Number(transform.scale ?? 1) *
        authored.scale *
        idle.scale *
        emphasis.scale *
        parallax.scale;
      const resolvedRotation =
        Number(transform.rotation ?? 0) +
        authored.rotation +
        idle.rotation +
        emphasis.rotation;
      const localMatrix = multiply(
        translate(position.x - anchor.x * width, position.y - anchor.y * height),
        multiply(
          translate(pivot.x * width, pivot.y * height),
          multiply(
            rotate(resolvedRotation),
            multiply(
              scale(resolvedScale),
              translate(-pivot.x * width, -pivot.y * height),
            ),
          ),
        ),
      );
      const matrix = multiply(parentMatrix, localMatrix);
      const renderPath = [
        ...path,
        {
          node,
          index,
          order: renderOrder(node, parent),
        },
      ];
      const corners = [
        applyMatrix(matrix, {x: 0, y: 0}),
        applyMatrix(matrix, {x: width, y: 0}),
        applyMatrix(matrix, {x: width, y: height}),
        applyMatrix(matrix, {x: 0, y: height}),
      ].map((point) => applyMatrix(cameraMatrix, point));
      entries.set(node.id, {
        node,
        parent,
        matrix: multiply(cameraMatrix, matrix),
        localMatrix: matrix,
        width,
        height,
        corners,
        bounds: {
          left: Math.min(...corners.map(({x}) => x)),
          top: Math.min(...corners.map(({y}) => y)),
          right: Math.max(...corners.map(({x}) => x)),
          bottom: Math.max(...corners.map(({y}) => y)),
        },
        renderPath,
      });
      if (node.kind === 'group') {
        visit({
          nodes: node.children,
          parent: node,
          parentMatrix: matrix,
          parentWidth: width,
          parentHeight: height,
          path: renderPath,
        });
      }
    }
  };
  visit({
    nodes: scene.composition?.nodes,
    parentWidth: video.width,
    parentHeight: video.height,
  });
  return {
    entries,
    frame,
    durationSeconds,
    camera,
  };
};

const proofFor = (scene, proofTimeId) =>
  (scene.motion?.proofTimes ?? []).find(({id}) => id === proofTimeId) ?? null;

const resolveAnchor = ({entry, contract, progress}) => {
  if (contract.subjectAnchor.mode === 'normalized') {
    return applyMatrix(entry.matrix, {
      x: contract.subjectAnchor.x * entry.width,
      y: contract.subjectAnchor.y * entry.height,
    });
  }
  if (entry.node.kind !== 'state-sequence') return null;
  const state = resolveSequenceState({node: entry.node, progress});
  const anchor = state?.anchors?.find(
    ({id}) => id === contract.subjectAnchor.name,
  );
  return anchor
    ? applyMatrix(entry.matrix, {
        x: anchor.x * entry.width,
        y: anchor.y * entry.height,
      })
    : null;
};

const surfacePoints = ({entry, contract}) =>
  contract.supportSurface.points.map((point) =>
    applyMatrix(entry.matrix, {
      x: point.x * entry.width,
      y: point.y * entry.height,
    }),
  );

const nearestPointOnSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  const amount = denominator <= 1e-9
    ? 0
    : clamp01(
        ((point.x - start.x) * dx + (point.y - start.y) * dy) /
          denominator,
      );
  return {
    x: start.x + amount * dx,
    y: start.y + amount * dy,
  };
};

const nearestPointOnSurface = (point, points) => {
  const candidates = points.slice(1).map((end, index) =>
    nearestPointOnSegment(point, points[index], end),
  );
  return candidates.sort(
    (left, right) => distance(point, left) - distance(point, right),
  )[0] ?? null;
};

const comparePaintOrder = (leftEntry, rightEntry) => {
  const leftPath = leftEntry?.renderPath ?? [];
  const rightPath = rightEntry?.renderPath ?? [];
  let index = 0;
  while (
    index < leftPath.length &&
    index < rightPath.length &&
    leftPath[index].node.id === rightPath[index].node.id
  ) {
    index += 1;
  }
  if (index >= leftPath.length || index >= rightPath.length) {
    return 0;
  }
  const left = leftPath[index];
  const right = rightPath[index];
  if (left.order !== right.order) return left.order - right.order;
  return left.index - right.index;
};

const activeProfile = (project) =>
  project.editorial?.responsiveProfiles?.find(
    ({id}) => id === project.editorial.activeProfile,
  ) ?? null;

const subtitleZones = (project) =>
  (activeProfile(project)?.exclusionZones ?? [])
    .filter(({role}) => role === 'subtitle')
    .map(({x, y, width, height, padding = 0}) => ({
      left: (x - padding) * project.video.width,
      top: (y - padding) * project.video.height,
      right: (x + width + padding) * project.video.width,
      bottom: (y + height + padding) * project.video.height,
    }));

const rectangleIntersection = (left, right) => {
  const width = Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.left, right.left),
  );
  const height = Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top),
  );
  return {width, height, area: width * height};
};

const alphaBoundsCache = new Map();
const assetFileFor = (source) =>
  path.isAbsolute(source) ? source : path.join(ROOT, 'public', source);

const alphaBoundsFor = async (source) => {
  const file = assetFileFor(source);
  const cached = alphaBoundsCache.get(file);
  if (cached) return cached;
  const pending = (async () => {
    const {data, info} = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({resolveWithObject: true});
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * info.channels + 3] <= 16) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) {
      return {left: 0, top: 0, right: 0, bottom: 0, empty: true};
    }
    return {
      left: left / info.width,
      top: top / info.height,
      right: (right + 1) / info.width,
      bottom: (bottom + 1) / info.height,
      empty: false,
    };
  })();
  alphaBoundsCache.set(file, pending);
  return pending;
};

const sourceForEntry = (entry, progress) => {
  if (entry.node.kind === 'asset' || entry.node.kind === 'world-strip') {
    return entry.node.src;
  }
  if (entry.node.kind === 'state-sequence') {
    return resolveSequenceState({node: entry.node, progress})?.src ?? null;
  }
  return null;
};

const visibleBoundsFor = async (entry, progress) => {
  const source = sourceForEntry(entry, progress);
  if (!source) return entry.bounds;
  let alpha;
  try {
    alpha = await alphaBoundsFor(source);
  } catch {
    return entry.bounds;
  }
  if (alpha.empty) return entry.bounds;
  const corners = [
    {x: alpha.left, y: alpha.top},
    {x: alpha.right, y: alpha.top},
    {x: alpha.right, y: alpha.bottom},
    {x: alpha.left, y: alpha.bottom},
  ].map(({x, y}) =>
    applyMatrix(entry.matrix, {
      x: x * entry.width,
      y: y * entry.height,
    }),
  );
  return {
    left: Math.min(...corners.map(({x}) => x)),
    top: Math.min(...corners.map(({y}) => y)),
    right: Math.max(...corners.map(({x}) => x)),
    bottom: Math.max(...corners.map(({y}) => y)),
  };
};

const visualFamily = (node) => {
  if (node.kind === 'state-sequence') return `pose:${node.poseFamilyId}`;
  if (node.kind === 'group' && node.layerStack?.sourcePackageId) {
    return `layer:${node.layerStack.sourcePackageId}`;
  }
  if (node.kind === 'group' && node.registration?.sourceMasterAssetId) {
    return `registration:${node.registration.sourceMasterAssetId}`;
  }
  if (node.kind === 'group' && node.pattern === 'looping-environment') {
    return `world:${(node.children ?? [])
      .filter(({kind}) => kind === 'world-strip')
      .map(
        ({role, loopingStripBinding}) =>
          `${role}:${loopingStripBinding?.sourceAssetId ?? 'missing'}`,
      )
      .sort()
      .join('|')}`;
  }
  if (node.kind === 'asset' && node.registrationId) {
    return `registration:${node.registrationId}`;
  }
  if ('src' in node) return `source:${node.src}`;
  return `node:${node.id}`;
};

const inspectGrounding = async (project, contract, {includeAlpha = false} = {}) => {
  const scene = (project.scenes ?? []).find(({id}) => id === contract.sceneId);
  const checks = [];
  const measurements = [];
  if (!scene) {
    return {
      passed: false,
      checks: [{
        id: 'grounding-scene-exists',
        passed: false,
        expected: contract.sceneId,
        actual: null,
      }],
      measurements,
    };
  }
  const zones = subtitleZones(project);
  for (const proofTimeId of contract.proofTimeIds) {
    const proof = proofFor(scene, proofTimeId);
    if (!proof) {
      checks.push({
        id: `proof-exists:${proofTimeId}`,
        passed: false,
        expected: proofTimeId,
        actual: null,
      });
      continue;
    }
    const resolved = resolveSceneNodes({
      scene,
      video: project.video,
      progress: proof.at,
    });
    const subject = resolved.entries.get(contract.subjectNodeId);
    const support = resolved.entries.get(contract.supportNodeId);
    if (!subject || !support) {
      checks.push({
        id: `nodes-exist:${proofTimeId}`,
        passed: false,
        expected: [contract.subjectNodeId, contract.supportNodeId],
        actual: [
          subject?.node.id ?? null,
          support?.node.id ?? null,
        ],
      });
      continue;
    }
    const anchor = resolveAnchor({
      entry: subject,
      contract,
      progress: proof.at,
    });
    const surface = surfacePoints({entry: support, contract});
    const nearest = anchor ? nearestPointOnSurface(anchor, surface) : null;
    if (!anchor || !nearest) {
      checks.push({
        id: `anchor-resolves:${proofTimeId}`,
        passed: false,
        expected: contract.subjectAnchor,
        actual: null,
      });
      continue;
    }
    const signedGap = (nearest.y - anchor.y) / project.video.height;
    const normalizedSupportY = nearest.y / project.video.height;
    const contactPassed =
      signedGap <= contract.maxGap + 1e-9 &&
      signedGap >= -contract.maxPenetration - 1e-9;
    checks.push({
      id: `support-contact:${proofTimeId}`,
      passed: contactPassed,
      expected: {
        maximumGap: contract.maxGap,
        maximumPenetration: contract.maxPenetration,
      },
      actual: {signedGap},
    });
    checks.push({
      id: `support-screen-band:${proofTimeId}`,
      passed:
        contract.supportScreenBand?.minY <= contract.supportScreenBand?.maxY &&
        normalizedSupportY + 1e-9 >= contract.supportScreenBand.minY &&
        normalizedSupportY <= contract.supportScreenBand.maxY + 1e-9,
      expected: contract.supportScreenBand,
      actual: {y: normalizedSupportY},
    });
    const measurement = {
      sceneId: scene.id,
      proofTimeId,
      progress: proof.at,
      anchor,
      nearestSurfacePoint: nearest,
      supportSurface: surface,
      signedGap,
      normalizedSupportY,
      subjectBounds: subject.bounds,
      supportBounds: support.bounds,
    };
    if (contract.frontOcclusion) {
      const front = resolved.entries.get(contract.frontOcclusion.nodeId);
      const paintComparison = front
        ? comparePaintOrder(front, subject)
        : 0;
      const expectedFront =
        contract.frontOcclusion.relation === 'in-front-of-subject';
      const paintPassed =
        Boolean(front) &&
        (expectedFront ? paintComparison > 0 : paintComparison < 0);
      checks.push({
        id: `paint-order:${proofTimeId}`,
        passed: paintPassed,
        expected: contract.frontOcclusion.relation,
        actual: front
          ? paintComparison > 0
            ? 'in-front-of-subject'
            : paintComparison < 0
              ? 'behind-subject'
              : 'same-stacking-context'
          : 'missing',
      });
      if (includeAlpha && front) {
        const frontBounds = await visibleBoundsFor(front, proof.at);
        const subjectBounds = await visibleBoundsFor(subject, proof.at);
        const intersection = rectangleIntersection(frontBounds, subjectBounds);
        const subjectArea = Math.max(
          1,
          (subjectBounds.right - subjectBounds.left) *
            (subjectBounds.bottom - subjectBounds.top),
        );
        const overlap = intersection.area / subjectArea;
        const minimum = contract.frontOcclusion.minimumAlphaOverlap ?? 0;
        checks.push({
          id: `front-alpha-overlap:${proofTimeId}`,
          passed: overlap + 1e-9 >= minimum,
          expected: {minimum},
          actual: {overlap},
        });
        measurement.frontVisibleBounds = frontBounds;
        measurement.frontAlphaOverlap = overlap;
      }
    }
    if (contract.subtitleClearance) {
      if (zones.length === 0) {
        checks.push({
          id: `subtitle-zone:${proofTimeId}`,
          passed: false,
          expected: 'active responsive profile subtitle exclusion zone',
          actual: null,
        });
      } else {
        const subjectBounds = includeAlpha
          ? await visibleBoundsFor(subject, proof.at)
          : subject.bounds;
        const gap = Math.min(
          ...zones.map((zone) => (zone.top - subjectBounds.bottom) / project.video.height),
        );
        const overlap = zones.some(
          (zone) => rectangleIntersection(subjectBounds, zone).area > 0,
        );
        checks.push({
          id: `subtitle-clearance:${proofTimeId}`,
          passed:
            !overlap &&
            gap + 1e-9 >= contract.subtitleClearance.minimumGap,
          expected: {
            minimumGap: contract.subtitleClearance.minimumGap,
            overlap: false,
          },
          actual: {gap, overlap},
        });
        measurement.subjectVisibleBounds = subjectBounds;
        measurement.subtitleZones = zones;
        measurement.subtitleGap = gap;
      }
    }
    measurements.push(measurement);
  }
  if (contract.mode === 'locked-contact' && measurements.length >= 2) {
    const first = measurements[0];
    const firstVector = {
      x:
        (first.anchor.x - first.nearestSurfacePoint.x) /
        project.video.width,
      y:
        (first.anchor.y - first.nearestSurfacePoint.y) /
        project.video.height,
    };
    const maximumDrift = Math.max(
      ...measurements.map((measurement) =>
        distance(firstVector, {
          x:
            (measurement.anchor.x - measurement.nearestSurfacePoint.x) /
            project.video.width,
          y:
            (measurement.anchor.y - measurement.nearestSurfacePoint.y) /
            project.video.height,
        }),
      ),
    );
    checks.push({
      id: 'relative-contact-stable',
      passed: maximumDrift <= contract.maxRelativeDrift + 1e-9,
      expected: {maximum: contract.maxRelativeDrift},
      actual: {maximumDrift},
    });
  }
  return {
    passed: checks.length > 0 && checks.every(({passed}) => passed),
    checks,
    measurements,
  };
};

const inspectContinuity = (project, contract) => {
  const timeline = deriveSceneTimeline(project);
  const fromScene = timeline.scenes.find(({id}) => id === contract.from.sceneId);
  const toScene = timeline.scenes.find(({id}) => id === contract.to.sceneId);
  const checks = [];
  const measurements = [];
  if (!fromScene || !toScene) {
    return {
      passed: false,
      checks: [{
        id: 'continuity-scenes-exist',
        passed: false,
        expected: [contract.from.sceneId, contract.to.sceneId],
        actual: [fromScene?.id ?? null, toScene?.id ?? null],
      }],
      measurements,
    };
  }
  const fromIndex = timeline.scenes.findIndex(({id}) => id === fromScene.id);
  const toIndex = timeline.scenes.findIndex(({id}) => id === toScene.id);
  checks.push({
    id: 'continuity-scenes-adjacent',
    passed: toIndex === fromIndex + 1,
    expected: fromIndex + 1,
    actual: toIndex,
  });
  const fromProof = proofFor(fromScene, contract.from.proofTimeId);
  const toProof = proofFor(toScene, contract.to.proofTimeId);
  if (!fromProof || !toProof) {
    checks.push({
      id: 'continuity-proofs-exist',
      passed: false,
      expected: [
        contract.from.proofTimeId,
        contract.to.proofTimeId,
      ],
      actual: [fromProof?.id ?? null, toProof?.id ?? null],
    });
    return {passed: false, checks, measurements};
  }
  const fromResolved = resolveSceneNodes({
    scene: fromScene,
    video: project.video,
    progress: fromProof.at,
  });
  const toResolved = resolveSceneNodes({
    scene: toScene,
    video: project.video,
    progress: toProof.at,
  });
  for (const pair of contract.nodePairs) {
    const from = fromResolved.entries.get(pair.fromNodeId);
    const to = toResolved.entries.get(pair.toNodeId);
    if (!from || !to) {
      checks.push({
        id: `continuity-nodes:${pair.role}`,
        passed: false,
        expected: [pair.fromNodeId, pair.toNodeId],
        actual: [from?.node.id ?? null, to?.node.id ?? null],
      });
      continue;
    }
    const fromCenter = {
      x: (from.bounds.left + from.bounds.right) / 2 / project.video.width,
      y: (from.bounds.top + from.bounds.bottom) / 2 / project.video.height,
    };
    const toCenter = {
      x: (to.bounds.left + to.bounds.right) / 2 / project.video.width,
      y: (to.bounds.top + to.bounds.bottom) / 2 / project.video.height,
    };
    const positionDelta = distance(fromCenter, toCenter);
    const fromScale = Math.max(
      (from.bounds.right - from.bounds.left) / project.video.width,
      (from.bounds.bottom - from.bounds.top) / project.video.height,
    );
    const toScale = Math.max(
      (to.bounds.right - to.bounds.left) / project.video.width,
      (to.bounds.bottom - to.bounds.top) / project.video.height,
    );
    const scaleDelta = Math.abs(fromScale - toScale);
    const fromFamily = visualFamily(from.node);
    const toFamily = visualFamily(to.node);
    checks.push(
      {
        id: `continuity-position:${pair.role}`,
        passed: positionDelta <= pair.maxPositionDelta + 1e-9,
        expected: {maximum: pair.maxPositionDelta},
        actual: {positionDelta},
      },
      {
        id: `continuity-scale:${pair.role}`,
        passed: scaleDelta <= pair.maxScaleDelta + 1e-9,
        expected: {maximum: pair.maxScaleDelta},
        actual: {scaleDelta},
      },
      {
        id: `continuity-family:${pair.role}`,
        passed: !pair.requireSameFamily || fromFamily === toFamily,
        expected: pair.requireSameFamily ? fromFamily : 'not-required',
        actual: toFamily,
      },
    );
    measurements.push({
      role: pair.role,
      fromNodeId: pair.fromNodeId,
      toNodeId: pair.toNodeId,
      fromCenter,
      toCenter,
      positionDelta,
      fromScale,
      toScale,
      scaleDelta,
      fromFamily,
      toFamily,
    });
  }
  const fromCamera = cameraStateAt(fromScene, fromProof.at);
  const toCamera = cameraStateAt(toScene, toProof.at);
  const cameraPositionDelta = Math.hypot(
    (fromCamera.x - toCamera.x) / project.video.width,
    (fromCamera.y - toCamera.y) / project.video.height,
  );
  const cameraZoomDelta = Math.abs(fromCamera.zoom - toCamera.zoom);
  checks.push(
    {
      id: 'continuity-camera-position',
      passed:
        cameraPositionDelta <= contract.maxCameraPositionDelta + 1e-9,
      expected: {maximum: contract.maxCameraPositionDelta},
      actual: {cameraPositionDelta},
    },
    {
      id: 'continuity-camera-zoom',
      passed: cameraZoomDelta <= contract.maxCameraZoomDelta + 1e-9,
      expected: {maximum: contract.maxCameraZoomDelta},
      actual: {cameraZoomDelta},
    },
  );
  const contractsById = new Map(
    (project.spatialContracts ?? []).map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
  const grounding = contract.groundingContractIds.map((id) =>
    contractsById.get(id),
  );
  checks.push({
    id: 'continuity-grounding-bound',
    passed:
      grounding.length >= 2 &&
      grounding.every((candidate) => candidate?.kind === 'grounding') &&
      grounding.some((candidate) => candidate?.sceneId === fromScene.id) &&
      grounding.some((candidate) => candidate?.sceneId === toScene.id),
    expected: {
      fromSceneId: fromScene.id,
      toSceneId: toScene.id,
    },
    actual: grounding.map((candidate) => candidate
      ? {id: candidate.id, kind: candidate.kind, sceneId: candidate.sceneId}
      : null),
  });
  return {
    passed: checks.length > 0 && checks.every(({passed}) => passed),
    checks,
    measurements,
  };
};

const inspectGait = (project, contract) => {
  const timeline = deriveSceneTimeline(project);
  const scene = timeline.scenes.find(({id}) => id === contract.sceneId);
  const checks = [];
  if (!scene) {
    return {
      passed: false,
      checks: [{
        id: 'gait-scene-exists',
        passed: false,
        expected: contract.sceneId,
        actual: null,
      }],
      measurements: [],
    };
  }
  const from = proofFor(scene, contract.fromProofTimeId);
  const through = proofFor(scene, contract.throughProofTimeId);
  const entry = resolveSceneNodes({
    scene,
    video: project.video,
    progress: from?.at ?? 0,
  }).entries.get(contract.nodeId);
  if (!from || !through || through.at <= from.at || entry?.node.kind !== 'state-sequence') {
    checks.push({
      id: 'gait-window-resolves',
      passed: false,
      expected: {
        nodeKind: 'state-sequence',
        orderedProofs: [contract.fromProofTimeId, contract.throughProofTimeId],
      },
      actual: {
        nodeKind: entry?.node.kind ?? null,
        from: from?.at ?? null,
        through: through?.at ?? null,
      },
    });
    return {passed: false, checks, measurements: []};
  }
  const node = entry.node;
  const states = new Set(node.states.map(({id}) => id));
  const configuredStatesPassed = contract.stateIds.every((id) => states.has(id));
  checks.push({
    id: 'gait-states-exist',
    passed: configuredStatesPassed,
    expected: contract.stateIds,
    actual: [...states],
  });
  const fromFrame = Math.round(from.at * Math.max(0, scene.durationInFrames - 1));
  const throughFrame = Math.round(
    through.at * Math.max(0, scene.durationInFrames - 1),
  );
  let previous = null;
  let changes = 0;
  let lastChangeFrame = fromFrame;
  const observed = new Set();
  for (let frame = fromFrame; frame <= throughFrame; frame += 1) {
    const progress = frame / Math.max(1, scene.durationInFrames - 1);
    const state = resolveSequenceState({node, progress});
    if (!state) continue;
    observed.add(state.id);
    if (previous !== null && state.id !== previous) {
      changes += 1;
      lastChangeFrame = frame;
    }
    previous = state.id;
  }
  const seconds = Math.max(
    1 / project.video.fps,
    (throughFrame - fromFrame) / project.video.fps,
  );
  const changesPerSecond = changes / seconds;
  const maximumAllowedStillSeconds =
    1.5 / contract.minimumChangesPerSecond;
  const terminalStillSeconds =
    (throughFrame - lastChangeFrame) / project.video.fps;
  checks.push(
    {
      id: 'gait-state-coverage',
      passed: contract.stateIds.every((id) => observed.has(id)),
      expected: contract.stateIds,
      actual: [...observed],
    },
    {
      id: 'gait-cadence',
      passed:
        changesPerSecond + 1e-9 >= contract.minimumChangesPerSecond,
      expected: {minimumChangesPerSecond: contract.minimumChangesPerSecond},
      actual: {changes, seconds, changesPerSecond},
    },
  );
  if (contract.continueThroughWindowEnd) {
    checks.push(
      {
        id: 'gait-active-through-window',
        passed:
          node.playback.activeUntil === undefined ||
          node.playback.activeUntil + 1e-9 >= through.at,
        expected: {activeUntilAtOrAfter: through.at},
        actual: {activeUntil: node.playback.activeUntil ?? 1},
      },
      {
        id: 'gait-no-terminal-freeze',
        passed: terminalStillSeconds <= maximumAllowedStillSeconds + 1e-9,
        expected: {maximumStillSeconds: maximumAllowedStillSeconds},
        actual: {terminalStillSeconds},
      },
    );
  }
  return {
    passed: checks.every(({passed}) => passed),
    checks,
    measurements: [{
      sceneId: scene.id,
      fromProofTimeId: from.id,
      throughProofTimeId: through.id,
      changes,
      seconds,
      changesPerSecond,
      terminalStillSeconds,
      observedStateIds: [...observed],
    }],
  };
};

export const inspectSpatialContract = async (
  project,
  contract,
  options = {},
) => {
  if (contract.kind === 'grounding') {
    return inspectGrounding(project, contract, options);
  }
  if (contract.kind === 'continuity') {
    return inspectContinuity(project, contract);
  }
  if (contract.kind === 'gait') return inspectGait(project, contract);
  return {
    passed: false,
    checks: [{
      id: 'spatial-contract-kind',
      passed: false,
      expected: ['grounding', 'continuity', 'gait'],
      actual: contract.kind ?? null,
    }],
    measurements: [],
  };
};

export const validateSpatialContracts = async (project) => {
  const issues = [];
  if (project.spatialContracts === undefined) return issues;
  if (!Array.isArray(project.spatialContracts)) {
    return [{
      level: 'error',
      code: 'spatial-contracts-type',
      message: 'spatialContracts 必须为数组。',
      location: 'spatialContracts',
    }];
  }
  const ids = new Set();
  for (const [index, contract] of project.spatialContracts.entries()) {
    const location = `spatialContracts[${index}]`;
    if (
      typeof contract?.id !== 'string' ||
      contract.id.length === 0 ||
      ids.has(contract.id)
    ) {
      issues.push({
        level: 'error',
        code: 'spatial-contract-id',
        message: 'spatial contract id 缺失或重复。',
        location: `${location}.id`,
      });
      continue;
    }
    ids.add(contract.id);
    const inspection = await inspectSpatialContract(project, contract);
    for (const check of inspection.checks.filter(({passed}) => !passed)) {
      issues.push({
        level: 'error',
        code: `spatial-${check.id.replace(/:[^:]+$/, '')}`,
        message: `空间契约 ${contract.id} 未通过 ${check.id}：期望 ${JSON.stringify(check.expected)}，实际 ${JSON.stringify(check.actual)}。`,
        location,
      });
    }
  }
  return issues;
};

export const validateStoryboardSpatialContracts = (storyboard) => {
  const issues = [];
  if (storyboard.spatialContracts === undefined) return issues;
  if (!Array.isArray(storyboard.spatialContracts)) {
    return [{
      code: 'storyboard-spatial-contracts-type',
      message: 'spatialContracts 必须为数组。',
      location: 'spatialContracts',
    }];
  }
  const sceneById = new Map(
    (storyboard.scenes ?? []).map((scene, index) => [
      scene.id,
      {scene, index},
    ]),
  );
  const ids = new Set();
  const groundingById = new Map();
  for (const [index, contract] of storyboard.spatialContracts.entries()) {
    const location = `spatialContracts[${index}]`;
    if (
      typeof contract?.id !== 'string' ||
      contract.id.length === 0 ||
      ids.has(contract.id)
    ) {
      issues.push({
        code: 'storyboard-spatial-contract-id',
        message: 'spatial contract id 缺失或重复。',
        location: `${location}.id`,
      });
      continue;
    }
    ids.add(contract.id);
    if (contract.kind === 'grounding') groundingById.set(contract.id, contract);
    if (contract.kind === 'grounding' || contract.kind === 'gait') {
      const scene = sceneById.get(contract.sceneId)?.scene;
      if (!scene) {
        issues.push({
          code: 'storyboard-spatial-scene',
          message: `空间契约 ${contract.id} 引用了未知镜头 ${contract.sceneId}。`,
          location: `${location}.sceneId`,
        });
        continue;
      }
      const proofIds = new Set(
        (scene.proofTimes ?? []).map(({id}) => id),
      );
      const referenced = contract.kind === 'grounding'
        ? contract.proofTimeIds
        : [contract.fromProofTimeId, contract.throughProofTimeId];
      for (const proofTimeId of referenced ?? []) {
        if (!proofIds.has(proofTimeId)) {
          issues.push({
            code: 'storyboard-spatial-proof',
            message: `空间契约 ${contract.id} 引用了未知证明时刻 ${proofTimeId}。`,
            location,
          });
        }
      }
    }
    if (contract.kind === 'continuity') {
      const from = sceneById.get(contract.from?.sceneId);
      const to = sceneById.get(contract.to?.sceneId);
      if (!from || !to || to.index !== from.index + 1) {
        issues.push({
          code: 'storyboard-spatial-continuity-adjacent',
          message: `连续性契约 ${contract.id} 必须绑定相邻的出入镜头。`,
          location,
        });
        continue;
      }
      for (const endpoint of [contract.from, contract.to]) {
        if (
          !(sceneById.get(endpoint.sceneId)?.scene.proofTimes ?? [])
            .some(({id}) => id === endpoint.proofTimeId)
        ) {
          issues.push({
            code: 'storyboard-spatial-continuity-proof',
            message: `连续性契约 ${contract.id} 引用了未知证明时刻 ${endpoint.sceneId}/${endpoint.proofTimeId}。`,
            location,
          });
        }
      }
    }
  }
  for (const [index, contract] of storyboard.spatialContracts.entries()) {
    if (contract.kind !== 'continuity') continue;
    const grounding = (contract.groundingContractIds ?? []).map((id) =>
      groundingById.get(id),
    );
    if (
      grounding.length < 2 ||
      grounding.some((candidate) => !candidate) ||
      !grounding.some(({sceneId}) => sceneId === contract.from.sceneId) ||
      !grounding.some(({sceneId}) => sceneId === contract.to.sceneId)
    ) {
      issues.push({
        code: 'storyboard-spatial-continuity-grounding',
        message: `连续性契约 ${contract.id} 必须绑定出入两幕各自的 grounding 契约。`,
        location: `spatialContracts[${index}].groundingContractIds`,
      });
    }
  }
  return issues;
};

export const buildSpatialContractProof = async (project, contract) => ({
  contractId: contract.id,
  kind: contract.kind,
  ...await inspectSpatialContract(project, contract, {includeAlpha: true}),
});

export const summarizeSpatialContracts = (project) => ({
  total: project.spatialContracts?.length ?? 0,
  grounding:
    project.spatialContracts?.filter(({kind}) => kind === 'grounding').length ??
    0,
  continuity:
    project.spatialContracts?.filter(({kind}) => kind === 'continuity').length ??
    0,
  gait:
    project.spatialContracts?.filter(({kind}) => kind === 'gait').length ?? 0,
});

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character]);

export const spatialContractDebugOverlay = ({
  proof,
  sceneId,
  proofTimeId,
  width,
  height,
}) => {
  const measurement = proof.measurements?.find(
    (candidate) =>
      candidate.sceneId === sceneId &&
      candidate.proofTimeId === proofTimeId,
  );
  const checks = proof.checks.filter(({id}) =>
    id.endsWith(`:${proofTimeId}`) || !id.includes(':'),
  );
  const color = checks.every(({passed}) => passed) ? '#30d158' : '#ff453a';
  const surface = measurement?.supportSurface?.map(
    ({x, y}) => `${x},${y}`,
  ).join(' ') ?? '';
  const zones = (measurement?.subtitleZones ?? []).map((zone) =>
    `<rect x="${zone.left}" y="${zone.top}" width="${zone.right - zone.left}" height="${zone.bottom - zone.top}" fill="rgba(255,159,10,.14)" stroke="#ff9f0a" stroke-width="4"/>`,
  ).join('');
  const anchor = measurement?.anchor
    ? `<circle cx="${measurement.anchor.x}" cy="${measurement.anchor.y}" r="11" fill="${color}"/><line x1="${measurement.anchor.x}" y1="${measurement.anchor.y}" x2="${measurement.nearestSurfacePoint.x}" y2="${measurement.nearestSurfacePoint.y}" stroke="${color}" stroke-width="5"/>`
    : '';
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${zones}
      ${surface ? `<polyline points="${surface}" fill="none" stroke="#64d2ff" stroke-width="7"/>` : ''}
      ${anchor}
      <rect x="16" y="16" width="${Math.min(width - 32, 1040)}" height="54" rx="10" fill="rgba(0,0,0,.78)" stroke="${color}" stroke-width="3"/>
      <text x="34" y="52" fill="white" font-size="25" font-family="sans-serif">${escapeXml(`${proof.contractId} · ${proof.kind} · ${proof.passed ? 'PASS' : 'FAIL'}`)}</text>
    </svg>
  `);
};
