import type {
  DerivedSceneTimeline,
  NormalizedProject,
  PaperCollageProject,
  SceneBoundaryTransition,
} from './project';

export const SCENE_TRANSITION_TYPES: readonly SceneBoundaryTransition['type'][];
export const PAPER_WIPE_DIRECTIONS: readonly NonNullable<SceneBoundaryTransition['direction']>[];

export function validateSceneTransitionSequence(input: {
  scenes?: PaperCollageProject['scenes'];
  sceneTransitions?: PaperCollageProject['sceneTransitions'];
}): Array<{code: string; message: string; location: string}>;

export function deriveSceneTimeline(project: PaperCollageProject): DerivedSceneTimeline;

export function resolveSceneTransitionPresentation(input: {
  transition: NormalizedProject['transitions'][number] | null;
  frame: number;
}): {
  progress: number;
  incomingVisible: boolean;
  incomingClipPath: string;
  paperOpacity: number;
  wipeEdgeProgress: number | null;
};

export function deriveTransitionProofSamples(input: {
  timeline: NormalizedProject;
  fps: number;
  durationSeconds: number;
}): Array<{
  time: number;
  label: string;
  transitionId: string;
  progress: number;
}>;
