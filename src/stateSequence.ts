import type {CompositionStateSequenceNode, SequenceState} from './project';

export type ResolvedSequenceLayer = SequenceState & {opacity: number};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const resolveSequencePhase = ({
  progress,
  mode,
  cycles,
}: {
  progress: number;
  mode: CompositionStateSequenceNode['playback']['mode'];
  cycles: number;
}) => {
  const scaled = clamp01(progress) * cycles;
  if (mode === 'once') return clamp01(progress);
  if (progress >= 1) return mode === 'ping-pong' ? 0 : 1;
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
  const phase = resolveSequencePhase({...node.playback, progress});
  let activeIndex = 0;
  for (const [index, state] of states.entries()) {
    if (state.at > phase) break;
    activeIndex = index;
  }
  const active = states[activeIndex];
  if (node.transition.type === 'cut' || activeIndex === 0) return [{...active, opacity: 1}];
  const cycleDuration = durationSeconds / Math.max(node.playback.cycles, 1e-9);
  const phaseDuration = node.playback.mode === 'ping-pong' ? cycleDuration / 2 : cycleDuration;
  const fadePhase = node.transition.durationSeconds / Math.max(phaseDuration, 1e-9);
  const amount = clamp01((phase - active.at) / Math.max(fadePhase, 1e-9));
  if (amount >= 1) return [{...active, opacity: 1}];
  return [
    {...states[activeIndex - 1], opacity: 1 - amount},
    {...active, opacity: amount},
  ];
};
