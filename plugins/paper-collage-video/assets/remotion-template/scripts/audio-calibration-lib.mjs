import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  collectProjectAudioEvents,
  runAudioPreflight,
} from './audio-preflight-lib.mjs';
import {
  ROOT,
  projectPaths,
  readJson,
  resolvePublicFile,
  writeJson,
} from './project-lib.mjs';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
};

export const audioCalibrationPath = (slug) =>
  path.join(ROOT, 'projects', slug, 'audio-calibration.json');

export const validateAudioCalibration = (calibration, expectedSlug) => {
  const errors = [];
  if (calibration?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  if (calibration?.projectSlug !== expectedSlug) errors.push(`projectSlug 必须为 ${expectedSlug}`);
  if (!['proposed', 'accepted', 'not-required'].includes(calibration?.status)) {
    errors.push('status 必须为 proposed、accepted 或 not-required');
  }
  if (!/^[0-9a-f]{64}$/.test(calibration?.sourceFingerprint ?? '')) {
    errors.push('sourceFingerprint 必须是 sha256');
  }
  for (const key of ['currentNarrationVolume', 'recommendedNarrationVolume']) {
    if (!Number.isFinite(calibration?.[key]) || calibration[key] <= 0) {
      errors.push(`${key} 必须是正数`);
    }
  }
  if (
    calibration?.status === 'accepted' &&
    (!Number.isFinite(calibration.acceptedNarrationVolume) ||
      calibration.acceptedNarrationVolume <= 0 ||
      !calibration.acceptanceNote?.trim())
  ) {
    errors.push('accepted calibration 必须记录 acceptedNarrationVolume 和确认说明');
  }
  if (errors.length) throw new Error(`audio-calibration.json 无效：${errors.join('；')}`);
  return calibration;
};

export const createAudioCalibrationSourceFingerprint = async (project) => {
  const {timeline, events} = collectProjectAudioEvents(project);
  const sources = [];
  for (const src of [...new Set(events.map(({src}) => src))].sort()) {
    const file = resolvePublicFile(src);
    const bytes = await fs.readFile(file);
    sources.push({
      src,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  const contract = {
    projectSlug: project.slug,
    fps: project.video.fps,
    durationSeconds: timeline.durationSeconds,
    mastering: project.audio.mastering,
    events: events.map(({kind, id, sceneId = null, src, startSeconds, volume}) => ({
      kind,
      id,
      sceneId,
      src,
      startSeconds,
      volume: kind === 'narration' ? null : volume,
    })),
    sources,
  };
  return createHash('sha256')
    .update(JSON.stringify(stableValue(contract)))
    .digest('hex');
};

export const writeAudioCalibrationProposal = async ({
  project,
  report,
  at = new Date().toISOString(),
  previousAcceptance = null,
}) => {
  const sourceFingerprint = await createAudioCalibrationSourceFingerprint(project);
  const status = report.passed ? 'not-required' : 'proposed';
  const proposal = {
    $schema: '../../schemas/audio-calibration.schema.json',
    schemaVersion: 1,
    projectSlug: project.slug,
    status,
    sourceFingerprint,
    currentNarrationVolume: project.audio.narration.volume,
    recommendedNarrationVolume: report.recommendedNarrationVolume,
    generatedAt: at,
    acceptedAt: status === 'not-required' ? at : null,
    acceptanceNote: status === 'not-required'
      ? '当前预检已经通过，无需调节。'
      : '',
    previousAcceptance,
    preflight: report,
  };
  await writeJson(audioCalibrationPath(project.slug), proposal);
  return proposal;
};

export const loadAudioCalibration = async (slug) =>
  validateAudioCalibration(await readJson(audioCalibrationPath(slug)), slug);

export const ensureAudioCalibrationReady = async ({project}) => {
  const paths = projectPaths(project.slug);
  await fs.mkdir(paths.distDirectory, {recursive: true});
  const report = await runAudioPreflight({
    project,
    output: path.join(paths.distDirectory, 'audio-preflight.wav'),
  });
  const sourceFingerprint = await createAudioCalibrationSourceFingerprint(project);
  let existing = null;
  try {
    existing = await loadAudioCalibration(project.slug);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (
    report.passed &&
    existing?.status === 'accepted' &&
    existing.sourceFingerprint === sourceFingerprint &&
    existing.acceptedNarrationVolume === project.audio.narration.volume
  ) {
    existing.preflight = report;
    existing.verifiedAt = new Date().toISOString();
    await writeJson(audioCalibrationPath(project.slug), existing);
    return {ready: true, calibration: existing, report};
  }
  const calibration = await writeAudioCalibrationProposal({project, report});
  return {ready: report.passed, calibration, report};
};

export const acceptAudioCalibration = async ({project, fingerprint, note}) => {
  const decision = await loadAudioCalibration(project.slug);
  if (decision.status !== 'proposed') {
    throw new Error(`当前 audio calibration 状态是 ${decision.status}，没有待确认草案。`);
  }
  if (!fingerprint || fingerprint !== decision.sourceFingerprint) {
    throw new Error('确认指纹与当前 audio calibration 草案不一致，请重新 propose。');
  }
  if (!(note ?? '').trim()) {
    throw new Error('接受响度草案必须提供 --note=<人的明确确认>。');
  }
  const currentFingerprint = await createAudioCalibrationSourceFingerprint(project);
  if (
    currentFingerprint !== decision.sourceFingerprint ||
    project.audio.narration.volume !== decision.currentNarrationVolume
  ) {
    throw new Error('旁白素材、时间线或音量已变化，请重新 propose。');
  }
  const previousVolume = project.audio.narration.volume;
  project.audio.narration.volume = decision.recommendedNarrationVolume;
  const paths = projectPaths(project.slug);
  await writeJson(paths.projectFile, project);
  const report = await runAudioPreflight({
    project,
    output: path.join(paths.distDirectory, 'audio-preflight.wav'),
  });
  if (!report.passed) {
    return {
      ready: false,
      calibration: await writeAudioCalibrationProposal({
        project,
        report,
        previousAcceptance: {
          sourceFingerprint: decision.sourceFingerprint,
          previousVolume,
          acceptedVolume: project.audio.narration.volume,
          acceptedAt: new Date().toISOString(),
          note: note.trim(),
        },
      }),
      report,
    };
  }
  const accepted = {
    ...decision,
    status: 'accepted',
    acceptedNarrationVolume: project.audio.narration.volume,
    acceptedAt: new Date().toISOString(),
    acceptanceNote: note.trim(),
    verifiedAt: new Date().toISOString(),
    preflight: report,
  };
  await writeJson(audioCalibrationPath(project.slug), accepted);
  return {ready: true, calibration: accepted, report};
};
