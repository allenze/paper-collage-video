import type {CompositionStateSequenceNode, SequenceState} from './project';

export type ResolvedSequenceLayer = SequenceState & {opacity: number};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const resolveSequencePhase = ({
  progress,
  mode,
  cycles,
  activeFrom,
  activeUntil,
}: {
  progress: number;
  mode: CompositionStateSequenceNode['playback']['mode'];
  cycles: number;
  activeFrom?: number;
  activeUntil?: number;
}) => {
  const start = activeFrom ?? 0;
  const end = activeUntil ?? 1;
  const activeProgress = clamp01((progress - start) / Math.max(end - start, 1e-9));
  const scaled = activeProgress * cycles;
  if (mode === 'once') return activeProgress;
  if (activeProgress >= 1) return mode === 'ping-pong' ? 0 : 1;
  const cycle = scaled - Math.floor(scaled);
  if (mode === 'loop') return cycle;
  return cycle <= 0.5 ? cycle * 2 : (1 - cycle) * 2;
};

const activeStatesFor = (node: CompositionStateSequenceNode) => {
  const states = [...node.states].sort((left, right) => left.at - right.at);
  if (!node.playback.activeStateIds) return states;
  const byId = new Map(states.map((state) => [state.id, state]));
  return node.playback.activeStateIds.flatMap((id) => {
    const state = byId.get(id);
    return state ? [state] : [];
  });
};

const preludeStatesFor = (node: CompositionStateSequenceNode) => {
  const states = [...node.states].sort((left, right) => left.at - right.at);
  if (!node.playback.activeStateIds) return states;
  const activeIds = new Set(node.playback.activeStateIds);
  return states.filter(({id}) => !activeIds.has(id));
};

const exitStatesFor = (node: CompositionStateSequenceNode) => {
  if (node.playback.activeUntil === undefined) return [];
  const hold = node.states.find(
    ({id}) => id === node.playback.holdStateId,
  );
  if (!node.playback.activeStateIds) {
    return hold
      ? [{...hold, at: node.playback.activeUntil}]
      : [];
  }
  const activeIds = new Set(node.playback.activeStateIds);
  const authored = [...node.states]
    .sort((left, right) => left.at - right.at)
    .filter(
      (state) =>
        !activeIds.has(state.id) &&
        state.at >= node.playback.activeUntil!,
    );
  if (authored.length > 0) return authored;
  return hold
    ? [{...hold, at: node.playback.activeUntil}]
    : [];
};

const resolveStateAt = (states: SequenceState[], phase: number) => {
  let active = states[0];
  for (const state of states) {
    if (state.at > phase) break;
    active = state;
  }
  return active;
};

const normalizeActiveStates = (states: SequenceState[], evenlyDistributed = false) => {
  if (evenlyDistributed) return states.map((state, index) => ({...state, phaseAt: index / states.length}));
  return states.map((state) => ({...state, phaseAt: state.at}));
};

export const resolveSequenceLayers = ({
  node,
  progress,
  durationSeconds,
}: {
  node: CompositionStateSequenceNode;
  progress: number;
  durationSeconds: number;
}): ResolvedSequenceLayer[] => {
  const activeFrom = node.playback.activeFrom ?? 0;
  const activeUntil = node.playback.activeUntil ?? 1;
  if (progress < activeFrom) {
    const prelude = resolveStateAt(preludeStatesFor(node), progress);
    return prelude ? [{...prelude, opacity: 1}] : [];
  }
  if (node.playback.activeUntil !== undefined && progress >= node.playback.activeUntil) {
    const exitStates = exitStatesFor(node);
    const active = resolveStateAt(exitStates, progress);
    if (!active) return [];
    if (node.transition.type === 'cut') return [{...active, opacity: 1}];
    const activeIndex = exitStates.findIndex(({id}) => id === active.id);
    if (activeIndex <= 0) return [{...active, opacity: 1}];
    const fadeProgress = clamp01(
      (progress - active.at) /
        Math.max(node.transition.durationSeconds / durationSeconds, 1e-9),
    );
    if (fadeProgress >= 1) return [{...active, opacity: 1}];
    return [
      {...exitStates[activeIndex - 1], opacity: 1 - fadeProgress},
      {...active, opacity: fadeProgress},
    ];
  }
  const states = normalizeActiveStates(activeStatesFor(node), Boolean(node.playback.activeStateIds));
  const phase = resolveSequencePhase({...node.playback, progress});
  let activeIndex = 0;
  for (const [index, state] of states.entries()) {
    if (state.phaseAt > phase) break;
    activeIndex = index;
  }
  const active = states[activeIndex];
  if (node.transition.type === 'cut' || activeIndex === 0) return [{...active, opacity: 1}];
  const activeDurationSeconds = durationSeconds * (activeUntil - activeFrom);
  const cycleDuration = activeDurationSeconds / Math.max(node.playback.cycles, 1e-9);
  const phaseDuration = node.playback.mode === 'ping-pong' ? cycleDuration / 2 : cycleDuration;
  const fadePhase = node.transition.durationSeconds / Math.max(phaseDuration, 1e-9);
  const amount = clamp01((phase - active.phaseAt) / Math.max(fadePhase, 1e-9));
  if (amount >= 1) return [{...active, opacity: 1}];
  return [
    {...states[activeIndex - 1], opacity: 1 - amount},
    {...active, opacity: amount},
  ];
};
