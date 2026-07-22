import type {
  DerivedSceneTimeline,
  NormalizedProject,
  PaperCollageProject,
  SceneBoundaryTransition,
} from './project';

export const SCENE_TRANSITION_TYPES: readonly SceneBoundaryTransition['type'][];
export const SCENE_TRANSITION_INTENTS: readonly SceneBoundaryTransition['intent'][];
export const PAPER_MOTION_DIRECTIONS: readonly NonNullable<SceneBoundaryTransition['direction']>[];
export const TRANSITION_RECIPES: Readonly<Record<SceneBoundaryTransition['intent'], Partial<SceneBoundaryTransition>>>;
export function materializeSceneTransitionRecipes(
  sceneTransitions?: Array<Partial<SceneBoundaryTransition>>,
): Array<Partial<SceneBoundaryTransition>>;
export function summarizeSceneTransitions(
  sceneTransitions?: Array<Partial<SceneBoundaryTransition>>,
): {
  total: number;
  animatedCount: number;
  cutCount: number;
  cutRatio: number;
  typeCounts: Record<string, number>;
  intentCounts: Record<string, number>;
};

export function validateSceneTransitionSequence(input: {
  scenes?: PaperCollageProject['scenes'];
  sceneTransitions?: PaperCollageProject['sceneTransitions'];
}): Array<{code: string; message: string; location: string}>;

export function deriveSceneTimeline(project: PaperCollageProject): DerivedSceneTimeline;

export type SceneTransitionPresentation = {
  rawProgress: number;
  progress: number;
  incomingVisible: boolean;
  incomingClipPath: string;
  incomingTransform: string;
  incomingTransformOrigin: string;
  paperOpacity: number;
  edgeProgress: number | null;
  tornEdgePoints: Array<{x: number; y: number}> | null;
  irisRadius: number | null;
  shutterClosure: number | null;
  pageTurnFold: number | null;
};

export function resolveSceneTransitionPresentation(input: {
  transition: NormalizedProject['transitions'][number] | null;
  frame: number;
}): SceneTransitionPresentation;

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
