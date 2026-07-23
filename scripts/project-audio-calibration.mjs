#!/usr/bin/env node
import {
  acceptAudioCalibration,
  ensureAudioCalibrationReady,
} from './audio-calibration-lib.mjs';
import {loadProject} from './project-lib.mjs';

const args = process.argv.slice(2);
const slug = args.find((argument) => !argument.startsWith('--'));
const action = args.find((argument, index) =>
  index > args.indexOf(slug) && !argument.startsWith('--')) ?? 'propose';
const valueFor = (name) =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);

try {
  if (!slug) {
    throw new Error(
      '用法：project:audio-calibration -- <slug> <propose|accept> [--fingerprint=<sha256>] [--note=<确认>]',
    );
  }
  const {project} = await loadProject(slug);
  const result = action === 'accept'
    ? await acceptAudioCalibration({
        project,
        fingerprint: valueFor('--fingerprint'),
        note: valueFor('--note'),
      })
    : action === 'propose'
      ? await ensureAudioCalibrationReady({project})
      : (() => {
          throw new Error(`未知 action：${action}`);
        })();
  const calibration = result.calibration;
  if (args.includes('--json')) {
    console.log(JSON.stringify({
      ready: result.ready,
      status: calibration.status,
      sourceFingerprint: calibration.sourceFingerprint,
      currentNarrationVolume: calibration.currentNarrationVolume,
      recommendedNarrationVolume: calibration.recommendedNarrationVolume,
      preflight: result.report,
    }, null, 2));
  } else {
    console.log(
      `${result.ready ? '✓' : '◇'} audio calibration: ${calibration.status}`,
    );
    console.log(`  source fingerprint: ${calibration.sourceFingerprint}`);
    console.log(
      `  narration volume: ${calibration.currentNarrationVolume} → ${calibration.recommendedNarrationVolume.toFixed(3)}`,
    );
    console.log(
      `  preflight: ${result.report.loudness.integratedLufs} LUFS / ${result.report.loudness.truePeakDbtp} dBTP`,
    );
    if (!result.ready) {
      console.log(
        `  接受草案：npm run project:audio-calibration -- ${slug} accept --fingerprint=${calibration.sourceFingerprint} --note="<人的明确确认>"`,
      );
      console.log('  最终成片 report 的实测响度仍是权威结果。');
    }
  }
  if (!result.ready) process.exitCode = 2;
} catch (error) {
  console.error(`project:audio-calibration failed: ${error.message}`);
  process.exitCode = 1;
}
