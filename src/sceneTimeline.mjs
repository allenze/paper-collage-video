const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const SCENE_TRANSITION_TYPES = Object.freeze([
  'cut',
  'paper-wipe',
  'dip-to-paper',
]);

export const PAPER_WIPE_DIRECTIONS = Object.freeze([
  'left-to-right',
  'right-to-left',
  'top-to-bottom',
  'bottom-to-top',
]);

const durationFramesFor = (transition, fps) =>
  transition?.type === 'cut'
    ? 0
    : Math.max(1, Math.round(Number(transition?.durationSeconds ?? 0) * fps));

export const validateSceneTransitionSequence = ({scenes = [], sceneTransitions = []} = {}) => {
  const issues = [];
  const add = (code, message, location) => issues.push({code, message, location});
  if (!Array.isArray(sceneTransitions)) {
    add('scene-transitions-array', 'sceneTransitions 必须是数组。', 'sceneTransitions');
    return issues;
  }
  const expected = Math.max(0, scenes.length - 1);
  if (sceneTransitions.length !== expected) {
    add(
      'scene-transitions-count',
      `sceneTransitions 必须为每对相邻镜头声明一个边界；需要 ${expected} 个，当前为 ${sceneTransitions.length} 个。`,
      'sceneTransitions',
    );
  }
  const ids = new Set();
  for (const [index, transition] of sceneTransitions.entries()) {
    const location = `sceneTransitions[${index}]`;
    const outgoing = scenes[index];
    const incoming = scenes[index + 1];
    if (!transition?.id || ids.has(transition.id)) {
      add('scene-transition-id', '场景边界 id 缺失或重复。', `${location}.id`);
    }
    ids.add(transition?.id);
    if (transition?.fromSceneId !== outgoing?.id || transition?.toSceneId !== incoming?.id) {
      add(
        'scene-transition-adjacency',
        `场景边界必须连接相邻镜头 ${outgoing?.id ?? 'missing'} → ${incoming?.id ?? 'missing'}。`,
        location,
      );
    }
    if (!SCENE_TRANSITION_TYPES.includes(transition?.type)) {
      add('scene-transition-type', `未知场景转场：${transition?.type}`, `${location}.type`);
      continue;
    }
    if (!finite(transition.durationSeconds) || transition.durationSeconds < 0) {
      add('scene-transition-duration', '场景转场 durationSeconds 必须是非负数。', `${location}.durationSeconds`);
      continue;
    }
    if (transition.type === 'cut') {
      if (transition.durationSeconds !== 0) {
        add('scene-transition-cut-duration', 'cut 的 durationSeconds 必须为 0。', `${location}.durationSeconds`);
      }
      if (transition.direction !== undefined) {
        add('scene-transition-cut-direction', 'cut 不得声明 direction。', `${location}.direction`);
      }
      continue;
    }
    if (transition.durationSeconds < 0.15 || transition.durationSeconds > 1.5) {
      add(
        'scene-transition-duration-bounds',
        '非切换转场必须位于 0.15–1.5 秒，避免难以辨认的闪烁或拖沓遮挡。',
        `${location}.durationSeconds`,
      );
    }
    if (transition.type === 'paper-wipe') {
      if (!PAPER_WIPE_DIRECTIONS.includes(transition.direction)) {
        add('scene-transition-direction', 'paper-wipe 必须声明受支持的 direction。', `${location}.direction`);
      }
    } else if (transition.direction !== undefined) {
      add('scene-transition-dip-direction', 'dip-to-paper 不得声明 direction。', `${location}.direction`);
    }
    if (finite(outgoing?.tailSeconds) && outgoing.tailSeconds + 1e-6 < transition.durationSeconds) {
      add(
        'scene-transition-tail-budget',
        `出场镜头 tailSeconds 必须至少覆盖 ${transition.durationSeconds}s 转场。`,
        `scenes[${index}].tailSeconds`,
      );
    }
    if (
      finite(incoming?.narration?.startSeconds) &&
      incoming.narration.startSeconds + 1e-6 < transition.durationSeconds
    ) {
      add(
        'scene-transition-narration-lead',
        `入场镜头 narration.startSeconds 必须至少为 ${transition.durationSeconds}s，避免旁白在转场完成前开始。`,
        `scenes[${index + 1}].narration.startSeconds`,
      );
    }
  }
  return issues;
};

export const deriveSceneTimeline = (project) => {
  const fps = Number(project.video?.fps ?? 30);
  const transitions = project.sceneTransitions ?? [];
  const normalizedTransitions = [];
  let cursor = 0;
  const scenes = (project.scenes ?? []).map((scene, index) => {
    const narrationFrames = Math.ceil(Number(scene.narration?.durationSeconds ?? 0) * fps);
    const narrationStartFrame = Math.round(Number(scene.narration?.startSeconds ?? 0) * fps);
    const tailFrames = Math.ceil(Number(scene.tailSeconds ?? 0) * fps);
    const durationInFrames = narrationStartFrame + narrationFrames + tailFrames;
    const sourceTransition = index === 0 ? null : transitions[index - 1] ?? null;
    const enterTransitionFrames = durationFramesFor(sourceTransition, fps);
    const from = index === 0 ? 0 : Math.max(0, cursor - enterTransitionFrames);
    const enterTransition = sourceTransition
      ? {...sourceTransition, from, durationInFrames: enterTransitionFrames}
      : null;
    if (enterTransition) normalizedTransitions.push(enterTransition);
    cursor = from + durationInFrames;
    return {
      ...scene,
      from,
      durationInFrames,
      narrationFrames,
      narrationStartFrame,
      enterTransitionFrames,
      exitTransitionFrames: 0,
      enterTransition,
    };
  });
  for (let index = 0; index < scenes.length - 1; index += 1) {
    scenes[index].exitTransitionFrames = scenes[index + 1].enterTransitionFrames;
  }
  return {
    durationInFrames: scenes.length === 0 ? fps : cursor,
    durationSeconds: (scenes.length === 0 ? fps : cursor) / fps,
    scenes,
    transitions: normalizedTransitions,
  };
};

const smoothstep = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const wipeClipPath = (direction, progress) => {
  const hidden = (1 - progress) * 100;
  switch (direction) {
    case 'right-to-left':
      return `inset(0 0 0 ${hidden}%)`;
    case 'top-to-bottom':
      return `inset(0 0 ${hidden}% 0)`;
    case 'bottom-to-top':
      return `inset(${hidden}% 0 0 0)`;
    case 'left-to-right':
    default:
      return `inset(0 ${hidden}% 0 0)`;
  }
};

export const resolveSceneTransitionPresentation = ({transition, frame}) => {
  if (!transition || transition.type === 'cut' || transition.durationInFrames <= 0) {
    return {
      progress: 1,
      incomingVisible: true,
      incomingClipPath: 'none',
      paperOpacity: 0,
      wipeEdgeProgress: null,
    };
  }
  const rawProgress = clamp01(frame / Math.max(1, transition.durationInFrames - 1));
  const progress = smoothstep(rawProgress);
  if (transition.type === 'paper-wipe') {
    return {
      progress,
      incomingVisible: true,
      incomingClipPath: wipeClipPath(transition.direction, progress),
      paperOpacity: 0,
      wipeEdgeProgress: progress,
    };
  }
  const firstHalf = rawProgress <= 0.5;
  const paperOpacity = firstHalf
    ? smoothstep(rawProgress * 2)
    : 1 - smoothstep((rawProgress - 0.5) * 2);
  return {
    progress,
    incomingVisible: !firstHalf,
    incomingClipPath: 'none',
    paperOpacity,
    wipeEdgeProgress: null,
  };
};

export const deriveTransitionProofSamples = ({timeline, fps, durationSeconds}) =>
  (timeline.transitions ?? []).flatMap((transition) => {
    if (transition.type === 'cut') {
      const before = Math.max(0, transition.from - 1);
      const after = Math.min(timeline.durationInFrames - 1, transition.from);
      return [
        {
          time: before / fps,
          label: `${transition.fromSceneId} → ${transition.toSceneId} · cut 前`,
          transitionId: transition.id,
          progress: 0,
        },
        {
          time: after / fps,
          label: `${transition.fromSceneId} → ${transition.toSceneId} · cut 后`,
          transitionId: transition.id,
          progress: 1,
        },
      ];
    }
    return [0.25, 0.5, 0.75].map((progress) => {
      const absoluteFrame = transition.from + Math.round(
        Math.max(0, transition.durationInFrames - 1) * progress,
      );
      return {
        time: Math.max(0, Math.min(durationSeconds - 0.04, absoluteFrame / fps)),
        label: `${transition.fromSceneId} → ${transition.toSceneId} · ${transition.type} ${Math.round(progress * 100)}%`,
        transitionId: transition.id,
        progress,
      };
    });
  });
