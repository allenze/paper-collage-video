const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const resolveSequencePhase = ({progress, mode, cycles}) => {
  const scaled = clamp01(progress) * cycles;
  if (mode === 'once') return clamp01(progress);
  if (progress >= 1) return mode === 'ping-pong' ? 0 : 1;
  const cycle = scaled - Math.floor(scaled);
  if (mode === 'loop') return cycle;
  return cycle <= 0.5 ? cycle * 2 : (1 - cycle) * 2;
};

export const resolveSequenceState = ({node, progress}) => {
  const phase = resolveSequencePhase({...node.playback, progress});
  const states = [...(node.states ?? [])].sort((left, right) => left.at - right.at);
  let active = states[0] ?? null;
  for (const state of states) {
    if (state.at > phase) break;
    active = state;
  }
  return active;
};

export const collectSequenceProofCoverage = ({node, proofTimes = []}) => {
  const covered = new Set();
  for (const proof of proofTimes) {
    const assertion = (proof.stateAssertions ?? []).find(({nodeId}) => nodeId === node.id);
    if (assertion) covered.add(assertion.stateId);
  }
  return covered;
};
