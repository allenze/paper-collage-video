import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {
  classifyQualityReviewer,
  createProductionMetrics,
  finishMetricSegment,
  productionMetricsPath,
  refreshProductionMetrics,
  startMetricSegment,
} from '../scripts/production-metrics-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const productionState = ({slug, createdAt, updatedAt}) => ({
  $schema: '../../schemas/production.schema.json',
  schemaVersion: 1,
  slug,
  stage: 'asset-production',
  createdAt,
  updatedAt,
  approvals: {
    concept: {status: 'approved', decidedAt: createdAt, note: 'test'},
    styleAndVoice: {status: 'approved', decidedAt: createdAt, note: 'test'},
    preview: {status: 'pending', decidedAt: null, note: ''},
    publish: {status: 'pending', decidedAt: null, note: ''},
  },
  workItems: [],
  artifacts: {},
  history: [{at: createdAt, action: 'project-created', stage: 'capability-review', note: ''}],
});

const writeJson = (file, value) =>
  fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

test('production metrics union overlapping intervals and expose AI review share', async () => {
  const slug = `production-metrics-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const createdAt = '2026-07-22T00:00:00.000Z';
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    await writeJson(
      path.join(projectDirectory, 'production.json'),
      productionState({slug, createdAt, updatedAt: '2026-07-22T00:00:10.000Z'}),
    );
    await writeJson(
      productionMetricsPath(slug),
      createProductionMetrics({slug, createdAt}),
    );
    await fs.writeFile(
      path.join(projectDirectory, 'generation-attempts.jsonl'),
      [
        {
          schemaVersion: 1,
          attemptId: 'img-11111111-1111-1111-1111-111111111111',
          event: 'reserved',
          status: 'reserved',
          projectSlug: slug,
          assetId: 'test-image',
          provider: 'test-provider',
          model: 'test-model',
          requestFingerprint: 'a'.repeat(64),
          quotaConsumed: false,
          at: '2026-07-22T00:00:01.000Z',
        },
        {
          schemaVersion: 1,
          attemptId: 'img-11111111-1111-1111-1111-111111111111',
          event: 'closed',
          status: 'succeeded',
          projectSlug: slug,
          assetId: 'test-image',
          provider: 'test-provider',
          model: 'test-model',
          requestFingerprint: 'a'.repeat(64),
          quotaConsumed: true,
          at: '2026-07-22T00:00:03.000Z',
        },
      ].map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf8',
    );
    const deterministic = await startMetricSegment({
      slug,
      category: 'deterministic-check',
      operation: 'test-check',
      measurement: 'command-wall-clock',
      at: '2026-07-22T00:00:02.500Z',
    });
    await finishMetricSegment({
      slug,
      segmentId: deterministic.id,
      at: '2026-07-22T00:00:03.500Z',
    });
    const review = await startMetricSegment({
      slug,
      category: 'ai-review',
      operation: 'quality-review',
      measurement: 'review-session-window',
      at: '2026-07-22T00:00:04.000Z',
    });
    await finishMetricSegment({
      slug,
      segmentId: review.id,
      at: '2026-07-22T00:00:06.000Z',
    });

    const metrics = await refreshProductionMetrics(slug);
    assert.equal(metrics.summary.observation.durationMs, 10_000);
    assert.equal(metrics.summary.byCategory['ai-generation'].durationMs, 2_000);
    assert.equal(metrics.summary.aiReview.durationMs, 2_000);
    assert.equal(metrics.summary.aiReview.percentOfObservation, 20);
    assert.equal(metrics.summary.byCategory['deterministic-check'].durationMs, 1_000);
    assert.equal(metrics.summary.measuredUnionMs, 4_500);
    assert.equal(metrics.summary.unattributedMs, 5_500);
    assert.equal(metrics.summary.coverage.status, 'full');
    assert.match(metrics.measurementNotes.reviewSessionWindow, /not provider-only inference time/);
    assert.match(metrics.measurementNotes.tokenTelemetry, /does not estimate token usage/);
    assert.match(metrics.measurementNotes.categoryOverlap, /de-duplicates all overlaps/);
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
  }
});

test('lazy metrics creation marks old projects as partial coverage', async () => {
  const slug = `production-metrics-legacy-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const createdAt = '2026-01-01T00:00:00.000Z';
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    await writeJson(
      path.join(projectDirectory, 'production.json'),
      productionState({slug, createdAt, updatedAt: '2026-01-01T00:00:05.000Z'}),
    );
    const metrics = await refreshProductionMetrics(slug);
    assert.equal(metrics.summary.coverage.status, 'partial');
    assert.equal(metrics.summary.observation.durationMs, 5_000);
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
  }
});

test('reviewer classification distinguishes the default host AI reviewer', () => {
  assert.equal(classifyQualityReviewer('host-vision'), 'ai-review');
  assert.equal(classifyQualityReviewer('codex:vision'), 'ai-review');
  assert.equal(classifyQualityReviewer('human:editor'), 'human-review');
});

test('project:new initializes a full-coverage production metrics file', async () => {
  const slug = `production-metrics-new-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const publicDirectory = path.join(ROOT, 'public', 'projects', slug);
  try {
    const result = spawnSync(
      process.execPath,
      ['scripts/project-new.mjs', slug, '--title=Metrics Test'],
      {cwd: ROOT, encoding: 'utf8'},
    );
    assert.equal(result.status, 0, result.stderr);
    const metrics = JSON.parse(
      await fs.readFile(path.join(projectDirectory, 'production-metrics.json'), 'utf8'),
    );
    assert.equal(metrics.projectSlug, slug);
    assert.equal(metrics.summary.coverage.status, 'full');
    assert.equal(metrics.summary.aiReview.durationMs, 0);
    const measured = spawnSync(
      process.execPath,
      [
        'scripts/project-metrics-run.mjs',
        '--category=deterministic-check',
        '--operation=status-probe',
        '--script=scripts/project-status.mjs',
        '--slug-index=0',
        '--',
        slug,
      ],
      {cwd: ROOT, encoding: 'utf8'},
    );
    assert.equal(measured.status, 0, measured.stderr);
    const updatedMetrics = JSON.parse(
      await fs.readFile(path.join(projectDirectory, 'production-metrics.json'), 'utf8'),
    );
    const segment = updatedMetrics.segments.find(({operation}) => operation === 'status-probe');
    assert.equal(segment.status, 'completed');
    assert.ok(segment.durationMs >= 0);
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
    await fs.rm(publicDirectory, {recursive: true, force: true});
  }
});

test('quality scaffold and record-batch measure one AI review session', async () => {
  const slug = `production-metrics-review-${process.pid}`;
  const projectDirectory = path.join(ROOT, 'projects', slug);
  const publicDirectory = path.join(ROOT, 'public', 'projects', slug);
  const backgroundFile = path.join(publicDirectory, 'assets', 'plates', 'background.png');
  const createdAt = new Date(Date.now() - 2_000).toISOString();
  try {
    await fs.mkdir(projectDirectory, {recursive: true});
    await fs.mkdir(path.dirname(backgroundFile), {recursive: true});
    await sharp({
      create: {width: 640, height: 360, channels: 3, background: '#d8c7a2'},
    }).png().toFile(backgroundFile);
    await writeJson(
      path.join(projectDirectory, 'production.json'),
      productionState({slug, createdAt, updatedAt: createdAt}),
    );
    await writeJson(path.join(projectDirectory, 'project.json'), {
      schemaVersion: 6,
      slug,
      title: 'Metrics review fixture',
      quality: {minimumAssetScale: 0.5},
      video: {width: 640, height: 360, fps: 30},
      theme: {},
      audio: {music: null},
      scenes: [{
        id: 'scene',
        composition: {
          coordinateSpace: {width: 640, height: 360},
          nodes: [{
            id: 'background',
            kind: 'asset',
            assetRole: 'background',
            src: `projects/${slug}/assets/plates/background.png`,
            z: 0,
            transform: {x: 0, y: 0, width: 1, height: 1, anchorX: 0, anchorY: 0},
            motion: {keyframes: [{at: 0, scale: 1}, {at: 1, scale: 1}]},
          }],
        },
      }],
      sceneTransitions: [],
    });
    const scaffoldFile = path.join(projectDirectory, 'quality-review-scaffold.json');
    const scaffoldResult = spawnSync(
      'npm',
      [
        'run',
        'project:quality',
        '--',
        slug,
        'scaffold',
        `--output=${path.relative(ROOT, scaffoldFile)}`,
        '--reviewer=host-vision',
      ],
      {cwd: ROOT, encoding: 'utf8'},
    );
    assert.equal(scaffoldResult.status, 0, scaffoldResult.stderr);
    const scaffold = JSON.parse(await fs.readFile(scaffoldFile, 'utf8'));
    assert.ok(scaffold.reviews.length > 0);
    for (const review of scaffold.reviews) {
      review.passedChecks = review.pendingChecks;
      review.failedChecks = [];
      review.note = 'Inspected test fixture';
    }
    await writeJson(scaffoldFile, scaffold);
    const recordResult = spawnSync(
      'npm',
      [
        'run',
        'project:quality',
        '--',
        slug,
        'record-batch',
        `--input=${path.relative(ROOT, scaffoldFile)}`,
        '--quiet',
      ],
      {cwd: ROOT, encoding: 'utf8'},
    );
    assert.equal(recordResult.status, 0, recordResult.stderr);
    const metrics = JSON.parse(await fs.readFile(productionMetricsPath(slug), 'utf8'));
    const reviewSegment = metrics.segments.find(({operation}) => operation === 'quality-review');
    assert.equal(reviewSegment.category, 'ai-review');
    assert.equal(reviewSegment.status, 'completed');
    assert.ok(reviewSegment.durationMs >= 0);
    assert.equal(metrics.summary.aiReview.segmentCount, 1);
    assert.equal(
      metrics.summary.byCategory['deterministic-check'].segmentCount,
      2,
    );
  } finally {
    await fs.rm(projectDirectory, {recursive: true, force: true});
    await fs.rm(publicDirectory, {recursive: true, force: true});
  }
});
