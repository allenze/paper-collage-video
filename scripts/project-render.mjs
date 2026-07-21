#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ROOT,
  fileExists,
  formatValidation,
  loadProject,
  projectPaths,
  resolveRenderConcurrency,
  validateProject,
  writeValidationReport,
} from './project-lib.mjs';
import {assertRenderAllowed, recordRender} from './production-state.mjs';
import {assertQualityReady, formatQualityStatus} from './quality-lib.mjs';
import {
  classifyRenderCache,
  createRenderFingerprints,
  readRenderCache,
  updateRenderCache,
} from './render-cache-lib.mjs';

const [mode, slug] = process.argv.slice(2);

const runInherited = (command, args, {captureOutput = false} = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    if (captureOutput) {
      child.stdout.on('data', (chunk) => {
        process.stdout.write(chunk);
        stdout = `${stdout}${chunk}`.slice(-64 * 1024);
      });
      child.stderr.on('data', (chunk) => {
        process.stderr.write(chunk);
        stderr = `${stderr}${chunk}`.slice(-64 * 1024);
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else {
        const error = new Error(`${command} exited with ${code ?? signal}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });

const friendlyRenderError = (error) => {
  const evidence = `${error.message}\n${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  if (
    /MachPortRendezvous|Failed to launch the browser process|Permission denied|Operation not permitted|zygote_host/i.test(
      evidence,
    )
  ) {
    return new Error(
      'Remotion 浏览器启动被当前环境权限阻止。请在允许启动 Chromium 子进程的环境中重试同一条 project:preview/project:render 命令；项目状态和已有素材均已保留。',
    );
  }
  return error;
};

try {
  if (!['preview', 'render'].includes(mode)) {
    throw new Error('用法：project-render.mjs <preview|render> <slug>');
  }
  await assertRenderAllowed(slug, mode);
  await runInherited(process.execPath, ['scripts/project-sync.mjs', slug]);
  await runInherited(process.execPath, [
    'scripts/project-audio-preflight.mjs',
    slug,
    '--strict',
  ]);
  const quality = await assertQualityReady(slug);
  console.log(formatQualityStatus(quality));
  const {project} = await loadProject(slug);
  const report = await validateProject(project);
  await writeValidationReport(slug, report);
  console.log(formatValidation(report));
  if (!report.passed) {
    throw new Error('项目校验未通过，已停止渲染。');
  }

  const paths = projectPaths(slug);
  await fs.mkdir(paths.distDirectory, {recursive: true});
  const output = path.join(
    paths.distDirectory,
    mode === 'preview' ? 'preview.mp4' : 'final.mp4',
  );
  const args = [
    'render',
    'src/index.ts',
    'Paper-Collage',
    output,
    `--props=${path.relative(ROOT, paths.projectFile)}`,
    `--concurrency=${resolveRenderConcurrency()}`,
  ];
  if (mode === 'preview') {
    args.push(
      '--scale=0.5',
      '--crf=28',
      '--audio-bitrate=96k',
    );
  }
  const remotion = path.join(ROOT, 'node_modules', '.bin', 'remotion');
  const fingerprints = await createRenderFingerprints(project, mode);
  let cache = await readRenderCache(slug);
  const cacheState = await classifyRenderCache({
    cache,
    mode,
    artifact: output,
    fingerprints,
  });
  if (cacheState === 'exact') {
    console.log(`✓ render cache: ${mode} 视觉与音频均未变化，复用 ${path.relative(ROOT, output)}`);
  } else if (cacheState === 'visual-only') {
    const audioMix = path.join(paths.distDirectory, 'audio-preflight.wav');
    if (!(await fileExists(audioMix))) throw new Error('缺少 audio-preflight.wav，不能执行音频-only 修订。');
    const temporary = path.join(paths.distDirectory, `.${mode}-audio-refresh.mp4`);
    await runInherited('ffmpeg', [
      '-v',
      'error',
      '-i',
      output,
      '-i',
      audioMix,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      mode === 'preview' ? '96k' : '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      '-y',
      temporary,
    ]);
    await fs.rename(temporary, output);
    console.log(`✓ render cache: 视觉未变化，仅重新混音/封装 ${path.relative(ROOT, output)}`);
  } else {
    await runInherited(remotion, ['browser', 'ensure'], {captureOutput: true}).catch(
      (error) => {
        throw friendlyRenderError(error);
      },
    );
    await runInherited(remotion, args, {captureOutput: true}).catch((error) => {
      throw friendlyRenderError(error);
    });
  }
  cache = await updateRenderCache({
    slug,
    cache,
    mode,
    artifact: output,
    fingerprints,
  });
  await runInherited(process.execPath, [
    'scripts/project-report.mjs',
    slug,
    `--artifact=${output}`,
    `--validation-report=${paths.validationReport}`,
    `--quality-report=${path.join(ROOT, 'projects', slug, 'quality-report.json')}`,
  ]);
  const production = await recordRender(slug, mode);
  console.log(`✓ 生产状态：${production.stage}`);
} catch (error) {
  console.error(`project:${mode ?? 'render'} failed: ${error.message}`);
  process.exitCode = 1;
}
