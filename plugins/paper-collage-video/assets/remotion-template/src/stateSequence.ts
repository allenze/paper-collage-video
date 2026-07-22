import type {CompositionStateSequenceNode, SequenceState} from './project';

export type ResolvedSequenceLayer = SequenceState & {opacity: number};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const resolveSequencePhase = ({
  progress,
  mode,
  cycles,
  activeUntil,
}: {
  progress: number;
  mode: CompositionStateSequenceNode['playback']['mode'];
  cycles: number;
  activeUntil?: number;
}) => {
  const activeProgress = activeUntil === undefined
    ? clamp01(progress)
    : clamp01(progress / activeUntil);
  const scaled = activeProgress * cycles;
  if (mode === 'once') return activeProgress;
  if (activeProgress >= 1) return mode === 'ping-pong' ? 0 : 1;
  const cycle = scaled - Math.floor(scaled);
  if (mode === 'loop') return cycle;
  return cycle <= 0.5 ? cycle * 2 : (1 - cycle) * 2;
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
  const states = [...node.states].sort((left, right) => left.at - right.at);
  if (node.playback.activeUntil !== undefined && progress >= node.playback.activeUntil) {
    const held = states.find(({id}) => id === node.playback.holdStateId);
    return held ? [{...held, opacity: 1}] : [];
  }
  const phase = resolveSequencePhase({...node.playback, progress});
  let activeIndex = 0;
  for (const [index, state] of states.entries()) {
    if (state.at > phase) break;
    activeIndex = index;
  }
  const active = states[activeIndex];
  if (node.transition.type === 'cut' || activeIndex === 0) return [{...active, opacity: 1}];
  const activeDurationSeconds = durationSeconds * (node.playback.activeUntil ?? 1);
  const cycleDuration = activeDurationSeconds / Math.max(node.playback.cycles, 1e-9);
  const phaseDuration = node.playback.mode === 'ping-pong' ? cycleDuration / 2 : cycleDuration;
  const fadePhase = node.transition.durationSeconds / Math.max(phaseDuration, 1e-9);
  const amount = clamp01((phase - active.at) / Math.max(fadePhase, 1e-9));
  if (amount >= 1) return [{...active, opacity: 1}];
  return [
    {...states[activeIndex - 1], opacity: 1 - amount},
    {...active, opacity: amount},
  ];
};
