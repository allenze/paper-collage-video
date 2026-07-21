#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  formatQualityStatus,
  buildQualityReviewScaffold,
  prepareQualityReport,
  recordQualityReview,
  recordQualityReviews,
} from './quality-lib.mjs';
import {ROOT} from './project-lib.mjs';

const args = process.argv.slice(2);
const positionals = args.filter((arg) => !arg.startsWith('--'));
const [slug, action = 'status'] = positionals;
const quiet = args.includes('--quiet');
const json = args.includes('--json');
const valueFor = (name) =>
  args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const listFor = (name) =>
  (valueFor(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

try {
  if (!slug || !['prepare', 'status', 'scaffold', 'record', 'record-batch'].includes(action)) {
    throw new Error(
      '用法：project:quality -- <slug> <prepare|status|scaffold|record|record-batch> [--input=<reviews.json>] [--output=<scaffold.json>] [--reviewer=<id>] [--quiet] [--json]',
    );
  }
  let status;
  if (action === 'scaffold') {
    const built = await buildQualityReviewScaffold({
      slug,
      reviewer: valueFor('--reviewer') ?? 'host-vision',
      includePassed: args.includes('--all'),
    });
    status = built.status;
    const output = valueFor('--output') ?? `projects/${slug}/quality-review-scaffold.json`;
    const file = path.resolve(ROOT, output);
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
      throw new Error(`scaffold 路径越过工作区：${output}`);
    }
    if (!args.includes('--force')) {
      const exists = await fs.stat(file).then((stat) => stat.isFile()).catch(() => false);
      if (exists) throw new Error(`scaffold 已存在：${output}；使用 --force 显式覆盖。`);
    }
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, `${JSON.stringify(built.scaffold, null, 2)}\n`, 'utf8');
    console.log(`✓ 质量审核脚手架：${path.relative(ROOT, file)} (${built.scaffold.reviews.length} reviews)`);
  } else if (action === 'record') {
    status = await recordQualityReview({
          slug,
          assetId: valueFor('--asset'),
          compositeId: valueFor('--composite'),
          reviewer: valueFor('--reviewer'),
          passedChecks: listFor('--pass'),
          failedChecks: listFor('--fail'),
          note: valueFor('--note') ?? '',
        });
  } else if (action === 'record-batch') {
    const input = valueFor('--input');
    if (!input) throw new Error('record-batch 必须提供 --input=<reviews.json>。');
    const file = path.resolve(ROOT, input);
    if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
      throw new Error(`reviews 路径越过工作区：${input}`);
    }
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    status = await recordQualityReviews({
      slug,
      reviews: Array.isArray(payload) ? payload : payload.reviews,
    });
  } else {
    status = await prepareQualityReport(slug, {write: action === 'prepare'});
  }
  if (action === 'scaffold') {
    // The scaffold path is the complete output for this action.
  } else if (json) {
    console.log(
      JSON.stringify(
        {
          ready: status.ready,
          total: status.total,
          passed: status.passed,
          pending: status.pending,
          failed: status.failed,
          changedAssets: status.changedAssets ?? [],
          changedComposites: status.changedComposites ?? [],
          report: path.relative(ROOT, status.file),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatQualityStatus(status));
    console.log(`  report: ${path.relative(ROOT, status.file)}`);
  }
  if (action !== 'scaffold' && !quiet && !json) {
    const changedIds = status.changedIds ?? [];
    const entries = [...status.report.assets, ...status.report.composites];
    const visibleEntries = changedIds.length
      ? entries.filter((entry) => changedIds.includes(entry.assetId ?? entry.compositeId))
      : entries.filter(({status: entryStatus}) => entryStatus !== 'passed');
    for (const entry of visibleEntries) {
      const pending = Object.entries(entry.semanticChecks)
        .filter(([, checkStatus]) => checkStatus !== 'passed')
        .map(([check, checkStatus]) => `${check}:${checkStatus}`)
        .join(', ');
      console.log(`  ${entry.status === 'passed' ? '✓' : '•'} ${entry.assetId ?? entry.compositeId}: ${entry.status}${pending ? ` (${pending})` : ''}`);
    }
  }
  if (action === 'status' && !status.ready) process.exitCode = 1;
} catch (error) {
  console.error(`project:quality failed: ${error.message}`);
  process.exitCode = 1;
}
