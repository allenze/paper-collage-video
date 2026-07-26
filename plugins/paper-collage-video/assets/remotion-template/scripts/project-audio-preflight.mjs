#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {runAudioPreflight} from './audio-preflight-lib.mjs';
import {
  ROOT,
  loadProject,
  projectPaths,
  writeJson,
} from './project-lib.mjs';

const args = process.argv.slice(2);
const slug = args.find((argument) => !argument.startsWith('--'));
const strict = args.includes('--strict');
const json = args.includes('--json');

try {
  if (!slug) {
    throw new Error('用法：project:audio-preflight -- <slug> [--strict] [--json]');
  }
  const {project} = await loadProject(slug);
  const paths = projectPaths(slug);
  await fs.mkdir(paths.distDirectory, {recursive: true});
  const mixFile = path.join(paths.distDirectory, 'audio-preflight.wav');
  const report = await runAudioPreflight({project, output: mixFile});
  const reportFile = path.join(paths.distDirectory, 'audio-preflight.json');
  await writeJson(reportFile, {
    schemaVersion: 1,
    projectSlug: slug,
    generatedAt: new Date().toISOString(),
    ...report,
  });
  if (json) {
    console.log(JSON.stringify({...report, report: path.relative(ROOT, reportFile)}, null, 2));
  } else {
    console.log(
      `${report.passed ? '✓' : '✗'} audio preflight: ${report.loudness.integratedLufs} LUFS / ${report.loudness.truePeakDbtp} dBTP`,
    );
    console.log(
      `  expected: ${report.mastering.targetLufs} ± ${report.mastering.toleranceLufs} LUFS / <= ${report.mastering.truePeakDbtp} dBTP`,
    );
    console.log(`  report: ${path.relative(ROOT, reportFile)}`);
    if (!report.passed) {
      console.log(
        `  建议 audio.narration.volume: ${report.currentNarrationVolume} → ${report.recommendedNarrationVolume.toFixed(3)}（音频-only 估算；最终成片报告仍为权威）`,
      );
    }
  }
  if (strict && !report.passed) process.exitCode = 1;
} catch (error) {
  console.error(`project:audio-preflight failed: ${error.message}`);
  process.exitCode = 1;
}
