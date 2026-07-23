import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {
  analyzeAudioLoudness,
  assessAudioPreflight,
  collectProjectAudioEvents,
} from '../scripts/audio-preflight-lib.mjs';
import {
  createAudioCalibrationSourceFingerprint,
  validateAudioCalibration,
} from '../scripts/audio-calibration-lib.mjs';
import {createRenderFingerprints} from '../scripts/render-cache-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const makeProject = (slug) => ({
  schemaVersion: 8,
  slug,
  title: 'Cache Test',
  video: {width: 1920, height: 1080, fps: 30},
  theme: {
    canvas: '#000',
    sceneBackground: '#000',
    accent: '#fff',
    ink: '#fff',
    subtitle: '#fff',
    subtitleBackground: '#000',
    paperEdge: '#fff',
    foreground: '#fff',
    texture: `projects/${slug}/texture.png`,
  },
  audio: {
    narration: {volume: 1},
    music: null,
    mastering: {targetLufs: -16, toleranceLufs: 3, truePeakDbtp: -1},
  },
  scenes: [{
    id: 'scene-01',
    label: 'Scene',
    eyebrow: '',
    tailSeconds: 0.2,
    motion: {blueprint: 'layered-reveal', intensity: 1, seed: 1, proofTimes: []},
    camera: {preset: 'push', intensity: 1},
    narration: {
      src: `projects/${slug}/narration.wav`,
      startSeconds: 0.1,
      durationSeconds: 1,
      text: 'test',
    },
    subtitles: [{fromSeconds: 0.1, toSeconds: 0.9, text: 'test'}],
    events: [],
    composition: {
      coordinateSpace: {width: 1920, height: 1080},
      nodes: [{
        id: 'background',
        kind: 'asset',
        assetRole: 'background',
        src: `projects/${slug}/visual.png`,
        z: 0,
        transform: {x: 0, y: 0, width: 1, height: 1, anchorX: 0, anchorY: 0},
        motion: {keyframes: [{at: 0, scale: 1}, {at: 1, scale: 1.01}]},
      }],
    },
  }],
  sceneTransitions: [],
});

test('render fingerprints separate visual changes from audio-only changes', async () => {
  const slug = `render-cache-test-${process.pid}`;
  const directory = path.join(ROOT, 'public', 'projects', slug);
  try {
    await fs.mkdir(directory, {recursive: true});
    await sharp({create: {width: 64, height: 64, channels: 4, background: '#884422'}})
      .png()
      .toFile(path.join(directory, 'visual.png'));
    await sharp({create: {width: 32, height: 32, channels: 4, background: '#ffffff'}})
      .png()
      .toFile(path.join(directory, 'texture.png'));
    const audio = spawnSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
      '-t', '1', '-y', path.join(directory, 'narration.wav'),
    ], {encoding: 'utf8'});
    assert.equal(audio.status, 0, audio.stderr);

    const project = makeProject(slug);
    const original = await createRenderFingerprints(project, 'preview');
    const audioOnly = structuredClone(project);
    audioOnly.audio.narration.volume = 1.5;
    const changedAudio = await createRenderFingerprints(audioOnly, 'preview');
    assert.equal(changedAudio.visual, original.visual);
    assert.notEqual(changedAudio.audio, original.audio);
    assert.equal(
      await createAudioCalibrationSourceFingerprint(audioOnly),
      await createAudioCalibrationSourceFingerprint(project),
    );

    const visualOnly = structuredClone(project);
    visualOnly.scenes[0].camera.intensity = 1.5;
    const changedVisual = await createRenderFingerprints(visualOnly, 'preview');
    assert.notEqual(changedVisual.visual, original.visual);
    assert.equal(changedVisual.audio, original.audio);
    const retimed = structuredClone(project);
    retimed.scenes[0].narration.startSeconds = 0.2;
    assert.notEqual(
      await createAudioCalibrationSourceFingerprint(retimed),
      await createAudioCalibrationSourceFingerprint(project),
    );

    const {events, timeline} = collectProjectAudioEvents(project);
    assert.equal(events.length, 1);
    assert.equal(events[0].startSeconds, 0.1);
    assert.equal(timeline.durationSeconds, 1.3);

    const strictPeakAnalysis = await analyzeAudioLoudness({
      file: path.join(directory, 'narration.wav'),
      mastering: {targetLufs: -24, toleranceLufs: 3, truePeakDbtp: -18},
    });
    assert.notEqual(strictPeakAnalysis.integratedLufs, null);
    assert.notEqual(strictPeakAnalysis.truePeakDbtp, null);
  } finally {
    await fs.rm(directory, {recursive: true, force: true});
  }
});

test('audio preflight recommends bounded narration gain without replacing final validation', () => {
  const project = makeProject('audio-assessment');
  const low = assessAudioPreflight({
    project,
    loudness: {integratedLufs: -22, truePeakDbtp: -8, loudnessRangeLu: 4},
  });
  assert.equal(low.passed, false);
  assert.ok(low.recommendedNarrationVolume > 1);
  assert.ok(low.recommendedNarrationVolume <= 4);
  assert.equal(low.recommendationIsApproximate, true);

  const passing = assessAudioPreflight({
    project,
    loudness: {integratedLufs: -16.2, truePeakDbtp: -2, loudnessRangeLu: 4},
  });
  assert.equal(passing.passed, true);
});

test('accepted audio calibration requires a source fingerprint, applied gain, and human note', () => {
  const calibration = {
    schemaVersion: 1,
    projectSlug: 'audio-assessment',
    status: 'accepted',
    sourceFingerprint: 'a'.repeat(64),
    currentNarrationVolume: 1,
    recommendedNarrationVolume: 2,
    acceptedNarrationVolume: 2,
    acceptanceNote: 'Approved after narration sync.',
  };
  assert.equal(
    validateAudioCalibration(calibration, 'audio-assessment'),
    calibration,
  );
  assert.throws(
    () => validateAudioCalibration({...calibration, acceptanceNote: ''}, 'audio-assessment'),
    /确认说明/,
  );
});
