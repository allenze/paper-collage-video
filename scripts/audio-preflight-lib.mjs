import path from 'node:path';
import {
  ROOT,
  deriveTimeline,
  resolvePublicFile,
  runCommand,
} from './project-lib.mjs';

const parseLoudness = (stderr) => {
  const match = stderr
    .match(/\{\s*"input_i"[\s\S]*?"target_offset"\s*:\s*"[^"]+"\s*\}/g)
    ?.at(-1);
  if (!match) {
    return {
      integratedLufs: null,
      truePeakDbtp: null,
      loudnessRangeLu: null,
    };
  }
  const parsed = JSON.parse(match);
  const numberOrNull = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  return {
    integratedLufs: numberOrNull(parsed.input_i),
    truePeakDbtp: numberOrNull(parsed.input_tp),
    loudnessRangeLu: numberOrNull(parsed.input_lra),
  };
};

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

export const AUDIO_DELIVERY_PROFILES = Object.freeze([
  {mode: 'preview', bitrate: '96k'},
  {mode: 'render', bitrate: '192k'},
]);

export const deliveryAudioFileForMode = (mixOutput, mode) => {
  const profile = AUDIO_DELIVERY_PROFILES.find((entry) => entry.mode === mode);
  if (!profile) throw new Error(`未知音频交付模式：${mode}`);
  const extension = path.extname(mixOutput);
  const base = extension.length > 0 ? mixOutput.slice(0, -extension.length) : mixOutput;
  return `${base}-${profile.mode}.m4a`;
};

export const collectProjectAudioEvents = (project) => {
  const timeline = deriveTimeline(project);
  const fps = project.video.fps;
  const events = [];
  if (project.audio.music) {
    events.push({
      kind: 'music',
      id: 'music',
      src: project.audio.music.src,
      startSeconds: 0,
      volume: project.audio.music.volume,
    });
  }
  for (const scene of timeline.scenes) {
    events.push({
      kind: 'narration',
      id: `narration:${scene.id}`,
      sceneId: scene.id,
      src: scene.narration.src,
      startSeconds: (scene.from + scene.narrationStartFrame) / fps,
      volume: project.audio.narration.volume,
    });
    for (const event of scene.events ?? []) {
      if (!event.sound) continue;
      events.push({
        kind: 'event',
        id: `event:${scene.id}:${event.id}`,
        sceneId: scene.id,
        src: event.sound.src,
        startSeconds:
          (scene.from + Math.min(
            scene.durationInFrames - 1,
            Math.round(event.at * scene.durationInFrames),
          )) / fps,
        volume: event.sound.volume,
      });
    }
  }
  return {timeline, events};
};

export const renderProjectAudioMix = async ({project, output}) => {
  const {timeline, events} = collectProjectAudioEvents(project);
  if (events.length === 0) throw new Error('项目没有可用于响度预检的音频事件。');
  const durationSeconds = timeline.durationSeconds;
  const args = ['-v', 'error'];
  for (const event of events) args.push('-i', resolvePublicFile(event.src));
  const filters = events.map((event, index) => {
    const delay = Math.max(0, Math.round(event.startSeconds * 1000));
    return (
      `[${index}:a]aformat=sample_rates=48000:channel_layouts=stereo,` +
      `volume=${event.volume},adelay=${delay}:all=1,` +
      `apad=pad_dur=${durationSeconds.toFixed(6)},` +
      `atrim=duration=${durationSeconds.toFixed(6)}[a${index}]`
    );
  });
  filters.push(
    `${events.map((_, index) => `[a${index}]`).join('')}amix=inputs=${events.length}:duration=longest:normalize=0,` +
      `atrim=duration=${durationSeconds.toFixed(6)},asetpts=N/SR/TB[mix]`,
  );
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[mix]',
    '-c:a',
    'pcm_s16le',
    '-y',
    output,
  );
  await runCommand('ffmpeg', args);
  return {output, durationSeconds, events};
};

export const analyzeAudioLoudness = async ({file, mastering}) => {
  // loudnorm's target parameters are part of its analysis configuration, not
  // the acceptance thresholds. Keep them inside FFmpeg's legal ranges while
  // assessAudioPreflight still evaluates the measured values against the
  // project's exact mastering contract (which may intentionally be stricter).
  const analysisTargetLufs = clamp(mastering.targetLufs, -70, -5);
  const analysisTruePeakDbtp = clamp(mastering.truePeakDbtp, -9, 0);
  const {stderr} = await runCommand('ffmpeg', [
    '-i',
    file,
    '-af',
    `loudnorm=I=${analysisTargetLufs}:TP=${analysisTruePeakDbtp}:LRA=11:print_format=json`,
    '-f',
    'null',
    '-',
  ]);
  return parseLoudness(stderr);
};

export const assessAudioPreflight = ({project, loudness}) => {
  const mastering = project.audio.mastering;
  const loudnessDelta =
    loudness.integratedLufs === null
      ? null
      : mastering.targetLufs - loudness.integratedLufs;
  const currentNarrationVolume = project.audio.narration.volume;
  const loudnessGain = loudnessDelta === null ? 0 : loudnessDelta;
  const peakHeadroom =
    loudness.truePeakDbtp === null
      ? loudnessGain
      : mastering.truePeakDbtp - loudness.truePeakDbtp;
  const safeGainDb = loudnessGain > 0
    ? Math.min(loudnessGain, peakHeadroom)
    : loudnessGain;
  const recommendedNarrationVolume = clamp(
    currentNarrationVolume * 10 ** (safeGainDb / 20),
    0.01,
    4,
  );
  const loudnessPassed =
    loudness.integratedLufs !== null &&
    Math.abs(loudness.integratedLufs - mastering.targetLufs) <=
      mastering.toleranceLufs;
  const truePeakPassed =
    loudness.truePeakDbtp !== null &&
    loudness.truePeakDbtp <= mastering.truePeakDbtp;
  return {
    passed: loudnessPassed && truePeakPassed,
    mastering,
    loudness,
    loudnessPassed,
    truePeakPassed,
    currentNarrationVolume,
    recommendedNarrationVolume,
    recommendationIsApproximate: true,
  };
};

export const encodeAudioDeliveryProbe = async ({
  input,
  output,
  bitrate,
}) => {
  await runCommand('ffmpeg', [
    '-v',
    'error',
    '-i',
    input,
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    bitrate,
    '-ar',
    '48000',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    '-y',
    output,
  ]);
  return output;
};

export const muxAuthoritativeAudio = async ({
  video,
  audio,
  output,
}) => {
  await runCommand('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-i',
    audio,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'copy',
    '-shortest',
    '-movflags',
    '+faststart',
    '-y',
    output,
  ]);
  return output;
};

export const runAudioPreflight = async ({project, output}) => {
  const mixed = await renderProjectAudioMix({project, output});
  const probes = [];
  for (const profile of AUDIO_DELIVERY_PROFILES) {
    const probeFile = deliveryAudioFileForMode(mixed.output, profile.mode);
    await encodeAudioDeliveryProbe({
      input: mixed.output,
      output: probeFile,
      bitrate: profile.bitrate,
    });
    const loudness = await analyzeAudioLoudness({
      file: probeFile,
      mastering: project.audio.mastering,
    });
    probes.push({
      mode: profile.mode,
      bitrate: profile.bitrate,
      file: path.relative(ROOT, probeFile),
      ...assessAudioPreflight({project, loudness}),
    });
  }
  const limitingProbe =
    probes.find((probe) => !probe.passed) ??
    probes.find((probe) => probe.mode === 'render') ??
    probes[0];
  return {
    ...limitingProbe,
    passed: probes.every((probe) => probe.passed),
    deliveryEquivalent: true,
    analysisSurface: 'delivery-encoded-aac',
    probes,
    mix: {
      file: path.relative(ROOT, mixed.output),
      durationSeconds: mixed.durationSeconds,
      eventCount: mixed.events.length,
      events: mixed.events,
    },
  };
};
