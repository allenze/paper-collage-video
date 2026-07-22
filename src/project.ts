import {deriveSceneTimeline} from './sceneTimeline.mjs';

export type SceneBlueprint =
  | 'layered-reveal'
  | 'map-journey'
  | 'archive-stack'
  | 'character-procession'
  | 'discovery-wipe'
  | 'transformation-tableau'
  | 'chapter-tableau'
  | 'quiet-lockup';

export type MotionEase = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';

export type MotionKeyframe = {
  at: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  ease?: MotionEase;
};

export type IdleMotion = {
  preset: 'float' | 'breathe' | 'grind' | 'drift' | 'still';
  intensity: number;
  cycleSeconds: number;
  phase?: number;
};

export type NodeMotion = {
  keyframes: MotionKeyframe[];
  idle?: IdleMotion;
};

export type NodeVisibility = {
  initial: 'visible' | 'hidden';
};

export type NodeTransform = {
  x: number;
  y: number;
  width: number;
  height?: number;
  anchorX: number;
  anchorY: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
};

export type CoordinateSpace = {width: number; height: number};

export type CompositionRegistration = {
  id: string;
  sourceMasterAssetId: string;
  canvas: CoordinateSpace;
  origin: 'top-left';
};

export type CompositionAssetNode = {
  id: string;
  kind: 'asset';
  assetRole: 'background' | 'environment' | 'character' | 'prop' | 'decorative';
  src: string;
  z: number;
  slot?: string;
  registrationId?: string;
  semanticCoverage?: string[];
  depth?: number;
  transform: NodeTransform;
  motion: NodeMotion;
  visibility?: NodeVisibility;
  clip?: {boundaryId: string; side: 'upper' | 'lower'};
};

export type SequenceState = {
  id: string;
  src: string;
  at: number;
};

export type CompositionStateSequenceNode = {
  id: string;
  kind: 'state-sequence';
  assetRole: 'character' | 'prop' | 'decorative';
  poseFamilyId: string;
  registration: CompositionRegistration;
  states: SequenceState[];
  playback: {mode: 'once' | 'loop' | 'ping-pong'; cycles: number};
  transition: {type: 'cut' | 'crossfade'; durationSeconds: number};
  z: number;
  slot?: string;
  semanticCoverage?: string[];
  depth?: number;
  transform: NodeTransform;
  motion: NodeMotion;
  visibility?: NodeVisibility;
  clip?: {boundaryId: string; side: 'upper' | 'lower'};
};

export type CompositionTextNode = {
  id: string;
  kind: 'text';
  text: string;
  style: {
    color: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    align: 'left' | 'center' | 'right';
    letterSpacing?: number;
    fontFamily?: string;
  };
  z: number;
  transform: NodeTransform;
  motion: NodeMotion;
  visibility?: NodeVisibility;
};

export type CompositionShapeNode = {
  id: string;
  kind: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line';
  style: {fill: string; stroke: string; strokeWidth: number; radius: number};
  z: number;
  transform: NodeTransform;
  motion: NodeMotion;
  visibility?: NodeVisibility;
};

export type CompositionBoundary = {
  id: string;
  normalizedY?: number;
  upperMaskSrc?: string;
  lowerMaskSrc?: string;
  upperSemantic: string;
  lowerSemantic: string;
};

export type CompositionGroupNode = {
  id: string;
  kind: 'group';
  pattern: 'free' | 'supported-subject' | 'registered-environment';
  z: number;
  coordinateSpace: CoordinateSpace;
  transform: NodeTransform;
  motion: NodeMotion;
  visibility?: NodeVisibility;
  registration?: CompositionRegistration;
  support?: {
    subjectId: string;
    contactAnchor: {x: number; y: number};
    contactZone: Array<[number, number]>;
    occlusionZone: Array<[number, number]>;
    detachProofTimeIds?: string[];
  };
  boundaries?: CompositionBoundary[];
  children: CompositionNode[];
};

export type CompositionNode =
  | CompositionAssetNode
  | CompositionStateSequenceNode
  | CompositionTextNode
  | CompositionShapeNode
  | CompositionGroupNode;

export type SceneComposition = {
  coordinateSpace: CoordinateSpace;
  nodes: CompositionNode[];
};

export type SubtitleCue = {fromSeconds: number; toSeconds: number; text: string};
export type NormalizedSubtitleCue = {from: number; to: number; text: string};

export type CameraKeyframe = {at: number; x?: number; y?: number; zoom?: number};
export type SceneCamera = {
  preset: 'push' | 'pull' | 'pan-left' | 'pan-right' | 'static';
  intensity: number;
  keyframes?: CameraKeyframe[];
};

export type EmphasisAction =
  | 'pulse'
  | 'stamp'
  | 'shake'
  | 'lift'
  | 'settle'
  | 'drop-impact'
  | 'carve';

export type VisibilityTransition = 'cut' | 'fade-rise' | 'fade-scale';

export type EventVisual =
  | {
      kind: 'visibility';
      action: 'show' | 'hide';
      transition: VisibilityTransition;
      durationSeconds: number;
    }
  | {
      kind: 'emphasis';
      action: EmphasisAction;
      durationSeconds: number;
      intensity: number;
    }
  | {
      kind: 'hold';
      durationSeconds: number;
    };

export type ProjectEvent = {
  id: string;
  beatId: string;
  at: number;
  targetId: string;
  visual: EventVisual | null;
  proofTimeId?: string;
  sound?: ProjectSound;
};

export type SceneBoundaryTransition = {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  type: 'cut' | 'paper-wipe' | 'dip-to-paper';
  durationSeconds: number;
  direction?:
    | 'left-to-right'
    | 'right-to-left'
    | 'top-to-bottom'
    | 'bottom-to-top';
};

export type ProofTime = {
  id: string;
  at: number;
  label: string;
  kind: 'establish' | 'action' | 'peak' | 'final';
  assertions: string[];
  stateAssertions?: Array<{nodeId: string; stateId: string}>;
};

export type SceneMotion = {
  blueprint: SceneBlueprint;
  intensity: number;
  seed: number;
  proofTimes: ProofTime[];
};

export type ProjectTheme = {
  canvas: string;
  sceneBackground: string;
  accent: string;
  ink: string;
  subtitle: string;
  subtitleBackground: string;
  paperEdge: string;
  foreground: string;
  texture: string;
  fontFamily?: string;
  fontFile?: string;
};

export type ProjectSound = {src: string; volume: number};
export type ProjectAudioMastering = {
  targetLufs: number;
  toleranceLufs: number;
  truePeakDbtp: number;
};

export type SceneAppearance = {
  background?: string;
  paperTexture?: {
    visible: boolean;
    opacity: number;
    blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  };
  chapter?: {visible: boolean};
  subtitles?: {
    variant: 'boxed' | 'plain' | 'hidden';
    color?: string;
    background?: string;
    maxWidth?: number;
  };
};

export type ProjectScene = {
  id: string;
  label: string;
  eyebrow: string;
  tailSeconds: number;
  appearance?: SceneAppearance;
  motion: SceneMotion;
  composition: SceneComposition;
  camera: SceneCamera;
  narration: {
    src: string;
    timingSrc?: string;
    startSeconds: number;
    durationSeconds: number;
    text: string;
  };
  subtitles: SubtitleCue[];
  events: ProjectEvent[];
};

export type PaperCollageProject = {
  $schema?: string;
  schemaVersion: 6;
  slug: string;
  title: string;
  plan: {
    schemaVersion: 2;
    slug: string;
    status: 'pending' | 'resolved';
    inputMode: 'none' | 'duration-only' | 'scenes-only' | 'both';
    productionProfile: 'draft' | 'balanced' | 'full-depth';
    assetBudget: {
      backgrounds: number;
      environmentLayers: number;
      characterSheets: number;
      styleSamples: number;
      maxGeneratedImages: number;
    } | null;
    motionBudget: {
      maxPoseSheetCalls: number;
      maxStatesPerSheet: number;
      maxContinuousTargets: number;
    } | null;
    requested: {durationSeconds: number | null; sceneCount: number | null};
    resolved: null | {
      durationSeconds: number;
      sceneCount: number;
      estimatedNarrationSeconds: number | null;
      rationale: string;
      resolvedAt: string;
    };
    updatedAt: string;
  };
  video: {width: number; height: number; fps: number};
  quality: {minimumAssetScale: number};
  theme: ProjectTheme;
  voice: {
    mode: 'fictional' | 'clone';
    provider?: string;
    voiceId?: string;
    profile?: string;
    displayName?: string;
    settings?: Record<string, string | number | boolean>;
  };
  audio: {
    narration: {volume: number};
    music: ProjectSound | null;
    mastering: ProjectAudioMastering;
  };
  scenes: ProjectScene[];
  sceneTransitions: SceneBoundaryTransition[];
};

export type NormalizedSceneBoundaryTransition = SceneBoundaryTransition & {
  from: number;
  durationInFrames: number;
};

export type NormalizedProjectScene = Omit<ProjectScene, 'subtitles'> & {
  from: number;
  durationInFrames: number;
  narrationFrames: number;
  narrationStartFrame: number;
  enterTransitionFrames: number;
  exitTransitionFrames: number;
  enterTransition: NormalizedSceneBoundaryTransition | null;
  subtitles: NormalizedSubtitleCue[];
};

export type DerivedSceneTimeline = {
  durationInFrames: number;
  durationSeconds: number;
  scenes: Array<
    ProjectScene & {
      from: number;
      durationInFrames: number;
      narrationFrames: number;
      narrationStartFrame: number;
      enterTransitionFrames: number;
      exitTransitionFrames: number;
      enterTransition: NormalizedSceneBoundaryTransition | null;
    }
  >;
  transitions: NormalizedSceneBoundaryTransition[];
};

export type NormalizedProject = Omit<PaperCollageProject, 'scenes'> & {
  durationInFrames: number;
  durationSeconds: number;
  scenes: NormalizedProjectScene[];
  transitions: NormalizedSceneBoundaryTransition[];
};

export const normalizeProject = (project: PaperCollageProject): NormalizedProject => {
  const {fps} = project.video;
  const timeline = deriveSceneTimeline(project);
  return {
    ...project,
    ...timeline,
    scenes: timeline.scenes.map((scene) => ({
      ...scene,
      subtitles: scene.subtitles.map((cue) => ({
        from: Math.round(cue.fromSeconds * fps),
        to: Math.round(cue.toSeconds * fps),
        text: cue.text,
      })),
    })),
  };
};
