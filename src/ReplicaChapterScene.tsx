import type {CSSProperties} from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  CompositionAssetNode,
  CompositionBoundary,
  CompositionGroupNode,
  CompositionNode,
  CompositionShapeNode,
  CompositionStateSequenceNode,
  CompositionTextNode,
  CoordinateSpace,
  NormalizedProjectScene,
  NormalizedSubtitleCue,
  ProjectEvent,
  ProjectTheme,
  SceneAppearance,
} from './project';
import {resolveEmphasisState, resolveIdleState, resolveMotionState, resolveVisibilityState} from './motion';
import {resolveSceneTransitionPresentation} from './sceneTimeline.mjs';
import {resolveSequenceLayers} from './stateSequence';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

const phaseFor = (id: string, seed: number) => {
  let value = seed >>> 0;
  for (const character of id) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0) / 0xffffffff * Math.PI * 2;
};

const slotOrder = (node: CompositionNode) => {
  if (node.kind !== 'asset' && node.kind !== 'state-sequence') return node.z;
  const fixed = {
    'support-rear': -30,
    'contact-shadow': -20,
    subject: -10,
    'support-front': 0,
  } as Record<string, number>;
  return fixed[node.slot ?? ''] ?? node.z;
};

const composeNodeTransform = ({
  node,
  parent,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
}: {
  node: CompositionNode;
  parent: CoordinateSpace;
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
}) => {
  const authored = resolveMotionState(node.motion.keyframes, progress);
  const idle = resolveIdleState({
    idle: node.motion.idle,
    frame,
    fps,
    phase: phaseFor(node.id, seed),
  });
  const emphasis = resolveEmphasisState({events, targetId: node.id, progress, durationSeconds});
  const visibility = resolveVisibilityState({
    events,
    targetId: node.id,
    initial: node.visibility?.initial,
    progress,
    durationSeconds,
  });
  const transform = node.transform;
  const width = transform.width * parent.width;
  const height = transform.height === undefined ? undefined : transform.height * parent.height;
  return {
    left: transform.x * parent.width,
    top: transform.y * parent.height,
    width,
    height,
    opacity: (transform.opacity ?? 1) * authored.opacity * idle.opacity * emphasis.opacity * visibility.opacity,
    css: `translate(${-transform.anchorX * 100}%, ${-transform.anchorY * 100}%) translate3d(${(authored.x + idle.x + emphasis.x + visibility.x) * parent.width}px, ${(authored.y + idle.y + emphasis.y + visibility.y) * parent.height}px, 0) scale(${(transform.scale ?? 1) * authored.scale * idle.scale * emphasis.scale * visibility.scale}) rotate(${(transform.rotation ?? 0) + authored.rotation + idle.rotation + emphasis.rotation + visibility.rotation}deg)`,
  };
};

const clipStyle = ({
  node,
  boundaries,
}: {
  node: CompositionAssetNode | CompositionStateSequenceNode;
  boundaries: CompositionBoundary[];
}): CSSProperties => {
  if (!node.clip) return {};
  const boundary = boundaries.find(({id}) => id === node.clip?.boundaryId);
  if (!boundary) return {};
  const maskSrc = node.clip.side === 'upper' ? boundary.upperMaskSrc : boundary.lowerMaskSrc;
  if (maskSrc) {
    const url = `url(${staticFile(maskSrc)})`;
    return {
      maskImage: url,
      WebkitMaskImage: url,
      maskSize: '100% 100%',
      WebkitMaskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
    };
  }
  const y = boundary.normalizedY ?? 0.5;
  return node.clip.side === 'upper'
    ? {clipPath: `inset(0 0 ${(1 - y) * 100}% 0)`}
    : {clipPath: `inset(${y * 100}% 0 0 0)`};
};

const containerStyle = ({
  node,
  resolved,
  renderZ,
}: {
  node: CompositionNode;
  resolved: ReturnType<typeof composeNodeTransform>;
  renderZ: number;
}): CSSProperties => ({
  position: 'absolute',
  left: resolved.left,
  top: resolved.top,
  width: resolved.width,
  ...(resolved.height === undefined ? {} : {height: resolved.height}),
  zIndex: renderZ,
  opacity: resolved.opacity,
  transform: resolved.css,
  transformOrigin: `${node.transform.anchorX * 100}% ${node.transform.anchorY * 100}%`,
});

const AssetView = ({
  node,
  parent,
  boundaries,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ,
  paperEdge,
}: {
  node: CompositionAssetNode;
  parent: CoordinateSpace;
  boundaries: CompositionBoundary[];
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ: number;
  paperEdge: string;
}) => {
  const resolved = composeNodeTransform({node, parent, progress, frame, fps, events, durationSeconds, seed});
  const cutout = ['character', 'prop'].includes(node.assetRole) || node.slot?.startsWith('support');
  return (
    <div
      data-composition-node={node.id}
      data-composition-kind="asset"
      style={{
        ...containerStyle({node, resolved, renderZ}),
        filter: cutout
          ? `drop-shadow(3px 0 ${paperEdge}) drop-shadow(-3px 0 ${paperEdge}) drop-shadow(0 10px 7px rgba(20,15,12,.28))`
          : undefined,
        ...clipStyle({node, boundaries}),
      }}
    >
      <Img
        alt=""
        src={staticFile(node.src)}
        style={{display: 'block', width: '100%', height: resolved.height === undefined ? 'auto' : '100%', objectFit: 'contain'}}
      />
    </div>
  );
};

const StateSequenceView = ({
  node,
  parent,
  boundaries,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ,
  paperEdge,
}: {
  node: CompositionStateSequenceNode;
  parent: CoordinateSpace;
  boundaries: CompositionBoundary[];
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ: number;
  paperEdge: string;
}) => {
  const resolved = composeNodeTransform({node, parent, progress, frame, fps, events, durationSeconds, seed});
  const layers = resolveSequenceLayers({node, progress, durationSeconds});
  const registeredHeight = resolved.height ?? resolved.width * node.registration.canvas.height / node.registration.canvas.width;
  return (
    <div
      data-composition-node={node.id}
      data-composition-kind="state-sequence"
      data-pose-family={node.poseFamilyId}
      data-active-state={layers.at(-1)?.id}
      style={{
        ...containerStyle({node, resolved, renderZ}),
        height: registeredHeight,
        filter: `drop-shadow(3px 0 ${paperEdge}) drop-shadow(-3px 0 ${paperEdge}) drop-shadow(0 10px 7px rgba(20,15,12,.28))`,
        ...clipStyle({node, boundaries}),
      }}
    >
      {layers.map((layer) => (
        <Img
          key={layer.id}
          alt=""
          src={staticFile(layer.src)}
          data-sequence-state={layer.id}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: layer.opacity,
          }}
        />
      ))}
    </div>
  );
};

const TextView = ({
  node,
  parent,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ,
}: {
  node: CompositionTextNode;
  parent: CoordinateSpace;
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ: number;
}) => {
  const resolved = composeNodeTransform({node, parent, progress, frame, fps, events, durationSeconds, seed});
  return (
    <div
      data-composition-node={node.id}
      data-composition-kind="text"
      style={{
        ...containerStyle({node, resolved, renderZ}),
        color: node.style.color,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeight,
        textAlign: node.style.align,
        letterSpacing: node.style.letterSpacing,
        fontFamily: node.style.fontFamily,
        whiteSpace: 'pre-wrap',
      }}
    >
      {node.text}
    </div>
  );
};

const ShapeView = ({
  node,
  parent,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ,
}: {
  node: CompositionShapeNode;
  parent: CoordinateSpace;
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ: number;
}) => {
  const resolved = composeNodeTransform({node, parent, progress, frame, fps, events, durationSeconds, seed});
  const isLine = node.shape === 'line';
  return (
    <div
      data-composition-node={node.id}
      data-composition-kind="shape"
      style={{
        ...containerStyle({node, resolved, renderZ}),
        height: isLine ? Math.max(1, node.style.strokeWidth) : resolved.height,
        background: isLine ? node.style.stroke : node.style.fill,
        border: isLine ? undefined : `${node.style.strokeWidth}px solid ${node.style.stroke}`,
        borderRadius: node.shape === 'ellipse' ? '50%' : node.style.radius,
        boxSizing: 'border-box',
      }}
    />
  );
};

const GroupView = ({
  node,
  parent,
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ,
  paperEdge,
}: {
  node: CompositionGroupNode;
  parent: CoordinateSpace;
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ: number;
  paperEdge: string;
}) => {
  const resolved = composeNodeTransform({node, parent, progress, frame, fps, events, durationSeconds, seed});
  const ratio = node.coordinateSpace.height / node.coordinateSpace.width;
  const height = resolved.height ?? resolved.width * ratio;
  return (
    <div
      data-composition-node={node.id}
      data-composition-kind={node.pattern}
      style={{
        position: 'absolute',
        left: resolved.left,
        top: resolved.top,
        width: resolved.width,
        height,
        zIndex: renderZ,
        opacity: resolved.opacity,
        transform: resolved.css,
        transformOrigin: `${node.transform.anchorX * 100}% ${node.transform.anchorY * 100}%`,
      }}
    >
      {[...node.children]
        .sort((left, right) => slotOrder(left) - slotOrder(right))
        .map((child) => (
          <CompositionNodeView
            key={child.id}
            node={child}
            parent={{width: resolved.width, height}}
            boundaries={node.boundaries ?? []}
            progress={progress}
            frame={frame}
            fps={fps}
            events={events}
            durationSeconds={durationSeconds}
            seed={seed}
            renderZ={node.pattern === 'supported-subject' ? slotOrder(child) : child.z}
            paperEdge={paperEdge}
          />
        ))}
    </div>
  );
};

const CompositionNodeView = ({
  node,
  parent,
  boundaries = [],
  progress,
  frame,
  fps,
  events,
  durationSeconds,
  seed,
  renderZ = node.z,
  paperEdge,
}: {
  node: CompositionNode;
  parent: CoordinateSpace;
  boundaries?: CompositionBoundary[];
  progress: number;
  frame: number;
  fps: number;
  events: ProjectEvent[];
  durationSeconds: number;
  seed: number;
  renderZ?: number;
  paperEdge: string;
}) => {
  if (node.kind === 'group') return <GroupView {...{node, parent, progress, frame, fps, events, durationSeconds, seed, renderZ, paperEdge}} />;
  if (node.kind === 'asset') return <AssetView {...{node, parent, boundaries, progress, frame, fps, events, durationSeconds, seed, renderZ, paperEdge}} />;
  if (node.kind === 'state-sequence') return <StateSequenceView {...{node, parent, boundaries, progress, frame, fps, events, durationSeconds, seed, renderZ, paperEdge}} />;
  if (node.kind === 'text') return <TextView {...{node, parent, progress, frame, fps, events, durationSeconds, seed, renderZ}} />;
  return <ShapeView {...{node, parent, progress, frame, fps, events, durationSeconds, seed, renderZ}} />;
};

const Subtitle = ({cues, theme, appearance}: {cues: NormalizedSubtitleCue[]; theme: ProjectTheme; appearance?: SceneAppearance['subtitles']}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const scale = Math.min(width / 1920, height / 1080);
  const cue = cues.find(({from, to}) => frame >= from && frame < to);
  if (!cue || appearance?.variant === 'hidden') return null;
  const opacity = interpolate(frame, [cue.from, cue.from + 6, cue.to - 6, cue.to], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', zIndex: 100, left: `${(1 - (appearance?.maxWidth ?? 0.78)) * 50}%`, right: `${(1 - (appearance?.maxWidth ?? 0.78)) * 50}%`, bottom: 58 * scale, textAlign: 'center', opacity, color: appearance?.color ?? theme.subtitle, fontFamily: theme.fontFile ? 'PaperCollageProjectFont, serif' : (theme.fontFamily ?? 'STKaiti, KaiTi, "Noto Serif SC", serif'), fontWeight: 700, fontSize: 42 * scale, letterSpacing: 2 * scale, lineHeight: 1.35, textShadow: appearance?.variant === 'plain' ? '0 2px 8px rgba(0,0,0,.72)' : '0 3px 2px rgba(28,15,10,.9), 0 0 14px rgba(28,15,10,.78)'}}>
      <span style={{display: 'inline-block', padding: appearance?.variant === 'plain' ? 0 : `${12 * scale}px ${32 * scale}px ${14 * scale}px`, background: appearance?.variant === 'plain' ? 'transparent' : (appearance?.background ?? theme.subtitleBackground), border: appearance?.variant === 'plain' ? undefined : '1px solid rgba(244, 222, 174, .42)', boxShadow: appearance?.variant === 'plain' ? undefined : '0 8px 24px rgba(40, 16, 10, .22)'}}>{cue.text}</span>
    </div>
  );
};

const ChapterLabel = ({eyebrow, label, theme}: Pick<NormalizedProjectScene, 'eyebrow' | 'label'> & {theme: ProjectTheme}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const scale = Math.min(width / 1920, height / 1080);
  const enter = spring({frame, fps, config: {damping: 20, stiffness: 90}});
  const opacity = interpolate(frame, [0, Math.round(0.4 * fps), Math.round(3 * fps), Math.round(3.93 * fps)], [0, 1, 1, 0], clamp);
  return (
    <div style={{position: 'absolute', zIndex: 70, top: 72 * scale, left: 92 * scale, opacity, transform: `translateX(${(1 - enter) * -42}px)`, color: theme.ink, fontFamily: theme.fontFile ? 'PaperCollageProjectFont, serif' : (theme.fontFamily ?? 'STKaiti, KaiTi, "Noto Serif SC", serif')}}>
      <div style={{fontSize: 22 * scale, letterSpacing: 8 * scale, color: theme.accent}}>{eyebrow}</div>
      <div style={{marginTop: 10 * scale, fontSize: 51 * scale, fontWeight: 700, letterSpacing: 7 * scale}}>{label}</div>
      <div style={{width: 270 * scale * enter, height: 4 * scale, marginTop: 13 * scale, background: `linear-gradient(90deg, ${theme.accent}, transparent)`}} />
    </div>
  );
};

const EventSounds = ({events, durationInFrames}: {events: ProjectEvent[]; durationInFrames: number}) => (
  <>
    {events.map((event) => {
      if (!event.sound) return null;
      const from = Math.min(durationInFrames - 1, Math.round(event.at * durationInFrames));
      return <Sequence key={`event-sound-${event.id}`} from={from} layout="none"><Audio src={staticFile(event.sound.src)} volume={event.sound.volume} /></Sequence>;
    })}
  </>
);

const cameraDefaults = (preset: NormalizedProjectScene['camera']['preset'], intensity: number) => {
  const perceptibleIntensity = Math.max(0.6, intensity);
  switch (preset) {
    case 'pull': return [{at: 0, x: -10 * perceptibleIntensity, y: 0, zoom: 1.035}, {at: 1, x: 12 * perceptibleIntensity, y: 0, zoom: 1.01}];
    case 'pan-left': return [{at: 0, x: 24 * perceptibleIntensity, y: 0, zoom: 1.018}, {at: 1, x: -24 * perceptibleIntensity, y: 0, zoom: 1.022}];
    case 'pan-right': return [{at: 0, x: -24 * perceptibleIntensity, y: 0, zoom: 1.018}, {at: 1, x: 24 * perceptibleIntensity, y: 0, zoom: 1.022}];
    case 'static': return [{at: 0, x: 0, y: 0, zoom: 1.01}, {at: 1, x: 0, y: 0, zoom: 1.01}];
    default: return [{at: 0, x: -10 * perceptibleIntensity, y: 0, zoom: 1.01}, {at: 1, x: 18 * perceptibleIntensity, y: 0, zoom: 1.028}];
  }
};

const cameraValue = ({frame, durationInFrames, keyframes, property, fallback}: {frame: number; durationInFrames: number; keyframes: Array<{at: number; x?: number; y?: number; zoom?: number}>; property: 'x' | 'y' | 'zoom'; fallback: number}) =>
  interpolate(frame, keyframes.map(({at}) => at * durationInFrames), keyframes.map((keyframe) => keyframe[property] ?? fallback), clamp);

export const ReplicaChapterScene = ({scene, narrationVolume, theme}: {scene: NormalizedProjectScene; narrationVolume: number; theme: ProjectTheme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, scene.durationInFrames - 1)));
  const durationSeconds = scene.durationInFrames / fps;
  const cameraFrames = scene.camera.keyframes && scene.camera.keyframes.length >= 2 ? [...scene.camera.keyframes].sort((a, b) => a.at - b.at) : cameraDefaults(scene.camera.preset, scene.camera.intensity);
  const cameraZoom = cameraValue({frame, durationInFrames: scene.durationInFrames, keyframes: cameraFrames, property: 'zoom', fallback: 1});
  const cameraX = cameraValue({frame, durationInFrames: scene.durationInFrames, keyframes: cameraFrames, property: 'x', fallback: 0});
  const cameraY = cameraValue({frame, durationInFrames: scene.durationInFrames, keyframes: cameraFrames, property: 'y', fallback: 0});
  const boundary = resolveSceneTransitionPresentation({transition: scene.enterTransition, frame});
  const paperTexture = scene.appearance?.paperTexture ?? {visible: true, opacity: 0.14, blendMode: 'multiply' as const};
  return (
    <AbsoluteFill style={{overflow: 'hidden', visibility: boundary.incomingVisible ? 'visible' : 'hidden', clipPath: boundary.incomingClipPath, background: theme.canvas}}>
      <AbsoluteFill style={{background: scene.appearance?.background ?? theme.sceneBackground}} />
      <AbsoluteFill>
        <AbsoluteFill style={{transform: `translate3d(${cameraX}px, ${cameraY}px, 0) scale(${cameraZoom})`, transformOrigin: '50% 54%'}}>
          {[...scene.composition.nodes].sort((a, b) => a.z - b.z).map((node) => (
            <CompositionNodeView key={node.id} node={node} parent={scene.composition.coordinateSpace} progress={progress} frame={frame} fps={fps} events={scene.events} durationSeconds={durationSeconds} seed={scene.motion.seed} paperEdge={theme.paperEdge} />
          ))}
        </AbsoluteFill>
        {paperTexture.visible ? <AbsoluteFill style={{opacity: paperTexture.opacity, mixBlendMode: paperTexture.blendMode, backgroundImage: `url(${staticFile(theme.texture)})`, backgroundSize: 'cover', zIndex: 60, pointerEvents: 'none'}} /> : null}
      </AbsoluteFill>
      {scene.appearance?.chapter?.visible === false ? null : <ChapterLabel eyebrow={scene.eyebrow} label={scene.label} theme={theme} />}
      <Subtitle cues={scene.subtitles} theme={theme} appearance={scene.appearance?.subtitles} />
      <Sequence from={scene.narrationStartFrame} layout="none"><Audio src={staticFile(scene.narration.src)} volume={narrationVolume} /></Sequence>
      <EventSounds events={scene.events} durationInFrames={scene.durationInFrames} />
    </AbsoluteFill>
  );
};
