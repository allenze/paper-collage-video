import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareDirectingRevision} from '../scripts/directing-revision-lib.mjs';
import {compileStoryboardDirecting} from '../scripts/storyboard-lib.mjs';
import {
  directingRevisionAuthoring,
  directingRevisionPlan,
  directingRevisionProduction,
} from '../fixtures/directing-revision-fixture.mjs';

const loadFixture = async () => {
  const storyboard = compileStoryboardDirecting(structuredClone(directingRevisionAuthoring), {
    plan: directingRevisionPlan,
  });
  return {
    storyboard,
    project: {plan: structuredClone(directingRevisionPlan)},
    production: structuredClone(directingRevisionProduction),
  };
};

test('preview directing revision preserves approvals and invalidates derived artifacts', async () => {
  const {storyboard, project, production} = await loadFixture();
  const supplied = structuredClone(storyboard);
  supplied.scenes[0].beats[1].treatments[0].rationale += ' 修改入场速度以回应预览反馈。';
  const result = prepareDirectingRevision({
    currentStoryboard: storyboard,
    suppliedStoryboard: supplied,
    plan: project.plan,
    production,
    reportPath: 'projects/directing-revision-fixture/directing-revision.json',
    at: '2026-07-23T01:00:00.000Z',
  });
  assert.deepEqual(result.report.changedSceneIds, ['scene-01']);
  assert.ok(result.report.changedScenes[0].categories.includes('directing-fingerprint'));
  assert.equal(result.report.providerApprovalRequired, false);
  assert.equal(result.production.approvals.concept.status, 'approved');
  assert.equal(result.production.approvals.styleAndVoice.status, 'approved');
  assert.equal(result.production.artifacts.preview, null);
  assert.equal(result.production.artifacts.final, null);
  assert.equal(result.production.artifacts.directingRevision, 'projects/directing-revision-fixture/directing-revision.json');
  assert.equal(result.production.workItems.some(({id}) => id === 'directing-revision-scene-01'), true);
});

test('preview directing revision rejects protected concept changes and no-op input', async () => {
  const {storyboard, project, production} = await loadFixture();
  const conceptChange = structuredClone(storyboard);
  conceptChange.scenes[0].message = '改变已经批准的镜头含义';
  assert.throws(() => prepareDirectingRevision({
    currentStoryboard: storyboard,
    suppliedStoryboard: conceptChange,
    plan: project.plan,
    production,
    reportPath: 'projects/example/directing-revision.json',
  }), /不得改变已批准/);
  assert.throws(() => prepareDirectingRevision({
    currentStoryboard: storyboard,
    suppliedStoryboard: structuredClone(storyboard),
    plan: project.plan,
    production,
    reportPath: 'projects/example/directing-revision.json',
  }), /没有产生任何实际变化/);
});

test('preview directing revision requires the recorded human return gate', async () => {
  const {storyboard, project, production} = await loadFixture();
  const supplied = structuredClone(storyboard);
  supplied.scenes[0].beats[1].treatments[0].rationale += ' 调整。';
  production.approvals.preview.status = 'pending';
  assert.throws(() => prepareDirectingRevision({
    currentStoryboard: storyboard,
    suppliedStoryboard: supplied,
    plan: project.plan,
    production,
    reportPath: 'projects/example/directing-revision.json',
  }), /只能响应已记录/);
});
