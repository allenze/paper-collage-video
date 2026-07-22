import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import type {NormalizedSceneBoundaryTransition, ProjectTheme} from './project';
import {resolveSceneTransitionPresentation} from './sceneTimeline.mjs';

const wipeEdgeStyle = (
  direction: NormalizedSceneBoundaryTransition['direction'],
  progress: number,
): React.CSSProperties => {
  const position = `${progress * 100}%`;
  const common: React.CSSProperties = {
    position: 'absolute',
    background: 'currentColor',
    boxShadow: '0 0 18px rgba(25, 16, 11, .24)',
  };
  if (direction === 'top-to-bottom' || direction === 'bottom-to-top') {
    return {
      ...common,
      left: 0,
      right: 0,
      height: 18,
      top: direction === 'top-to-bottom' ? position : undefined,
      bottom: direction === 'bottom-to-top' ? position : undefined,
      transform: 'translateY(-50%)',
    };
  }
  return {
    ...common,
    top: 0,
    bottom: 0,
    width: 18,
    left: direction === 'left-to-right' ? position : undefined,
    right: direction === 'right-to-left' ? position : undefined,
    transform: 'translateX(-50%)',
  };
};

export const SceneTransitionOverlay = ({
  transition,
  theme,
}: {
  transition: NormalizedSceneBoundaryTransition;
  theme: ProjectTheme;
}) => {
  const frame = useCurrentFrame();
  const presentation = resolveSceneTransitionPresentation({transition, frame});
  if (transition.type === 'cut') return null;
  if (transition.type === 'paper-wipe') {
    return (
      <AbsoluteFill style={{zIndex: 1000, pointerEvents: 'none', color: theme.paperEdge}}>
        <div style={wipeEdgeStyle(transition.direction, presentation.wipeEdgeProgress ?? 1)} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill
      style={{
        zIndex: 1000,
        pointerEvents: 'none',
        opacity: presentation.paperOpacity,
        backgroundColor: theme.canvas,
        backgroundImage: `url(${staticFile(theme.texture)})`,
        backgroundSize: 'cover',
      }}
    />
  );
};
