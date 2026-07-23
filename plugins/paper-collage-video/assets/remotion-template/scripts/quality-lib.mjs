import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  collectCompositionAssets,
  collectCompositionVisualSources,
  collectCompositionGroups,
  collectMotifFields,
  collectStateSequences,
  deriveEventTimeline,
  flattenCompositionNodes,
  hashCompositionValue,
  pointInPolygon,
} from './composition-lib.mjs';
import {
  ROOT,
  deriveTimeline,
  fileExists,
  inspectCharacterPng,
  loadProject,
  readJson,
  resolvePublicFile,
  writeJson,
} from './project-lib.mjs';
import {
  loadSemanticContracts,
  requiredChecksForSemanticBinding,
  validateSemanticEvidenceTargets,
} from './semantic-contract-lib.mjs';
import {createRuntimeBuildFingerprint} from './runtime-build-lib.mjs';
import {
  activeManifestAssets,
  assertAssetManifest,
} from './asset-manifest-lib.mjs';
import {
  MAX_MOTIF_INSTANCES_PER_FIELD,
  resolveMotifFieldInstances,
  verifyMotifFieldLoop,
} from '../src/motifField.mjs';
import {
  fitEditorialTypography,
  resolveAnnotationRoute,
  validateDataGraphicNode,
} from '../src/editorialPrimitives.mjs';
import {
  derivationRegionsFromBinding,
  inspectAlphaBands,
} from './alpha-band-lib.mjs';
import {assertRegisteredFamilyRecords} from './registered-family-lib.mjs';

export const ASSET_QUALITY_CHECKS = [
  'no-text',
  'no-watermark',
  'no-people',
  'safe-area-clear',
  'style-consistent',
  'subject-complete',
  'identity-consistent',
  'identity-distinct-within-frame',
  'identity-family-consistent',
  'cross-scene-identity-continuity',
  'cell-separation',
  'untargeted-cells-unchanged',
  'background-uniform',
  'edge-clean',
  'silhouette-fidelity',
  'negative-space-clean',
  'background-leak-free',
  'mechanism-complete',
  'load-path-readable',
  'physical-plausibility',
  'reference-conformant',
  'diagram-edge-clean',
  'small-text-legible',
  'no-procedural-noise-on-semantic-lines',
];

export const COMPOSITE_QUALITY_CHECKS = [
  'support-contact',
  'inside-or-on-readable',
  'front-occlusion',
  'subject-front-clear',
  'shared-motion',
  'identity-continuity',
  'motion-isolation-clean',
  'registration-aligned',
  'boundary-respected',
  'no-semantic-duplication',
  'depth-readable',
  'final-composition-readable',
  'visual-event-visible',
  'sound-event-bound',
  'proof-time-bound',
  'final-state-preserved',
  'state-order-correct',
  'pose-registration-stable',
  'state-identity-consistent',
  'transition-clean',
  'depth-order-readable',
  'camera-coupling-clean',
  'registered-groups-stable',
  'field-density-readable',
  'field-bounds-clean',
  'field-exclusions-clean',
  'field-motion-clean',
  'field-loop-clean',
  'typography-fit-clean',
  'typography-timing-bound',
  'annotation-routing-clean',
  'annotation-exclusions-clean',
  'data-mapping-valid',
  'data-reveal-bound',
  'editorial-transition-continuity',
  'responsive-directing-bounded',
];

export const QUALITY_CHECKS = [
  ...ASSET_QUALITY_CHECKS,
  ...COMPOSITE_QUALITY_CHECKS,
];

const QUALITY_PROFILES = {
  background: ['no-text', 'no-watermark', 'no-people', 'safe-area-clear', 'style-consistent'],
  environment: ['no-text', 'no-watermark', 'subject-complete', 'style-consistent'],
  character: ['subject-complete', 'identity-consistent', 'edge-clean', 'style-consistent'],
  prop: ['subject-complete', 'edge-clean', 'style-consistent'],
  decorative: ['no-watermark', 'subject-complete', 'style-consistent'],
  'character-sheet': ['no-text', 'no-watermark', 'subject-complete', 'identity-consistent', 'cell-separation', 'background-uniform', 'style-consistent'],
  'style-sample': ['no-text', 'no-watermark', 'subject-complete', 'style-consistent'],
  mechanism: ['no-watermark', 'subject-complete', 'edge-clean', 'mechanism-complete', 'load-path-readable', 'physical-plausibility', 'reference-conformant', 'style-consistent'],
  diagram: ['subject-complete', 'diagram-edge-clean', 'small-text-legible', 'no-procedural-noise-on-semantic-lines', 'style-consistent'],
  image: ['no-watermark', 'subject-complete', 'style-consistent'],
};

const COMPOSITE_PROFILES = {
  'supported-subject': ['support-contact', 'inside-or-on-readable', 'front-occlusion', 'shared-motion', 'identity-continuity', 'motion-isolation-clean'],
  'registered-environment': ['registration-aligned', 'boundary-respected', 'no-semantic-duplication', 'depth-readable', 'final-composition-readable'],
  event: ['visual-event-visible', 'sound-event-bound', 'proof-time-bound', 'final-state-preserved'],
  'state-sequence': ['state-order-correct', 'pose-registration-stable', 'state-identity-consistent', 'transition-clean', 'proof-time-bound'],
  'parallax-rig': ['depth-order-readable', 'camera-coupling-clean', 'registered-groups-stable', 'final-composition-readable'],
  'motif-field': ['field-density-readable', 'field-bounds-clean', 'field-exclusions-clean', 'field-motion-clean', 'field-loop-clean', 'final-composition-readable'],
  typography: ['typography-fit-clean', 'typography-timing-bound', 'final-composition-readable'],
  annotation: ['annotation-routing-clean', 'annotation-exclusions-clean', 'proof-time-bound'],
  'data-graphic': ['data-mapping-valid', 'data-reveal-bound', 'proof-time-bound'],
  'editorial-transition': ['editorial-transition-continuity', 'proof-time-bound'],
  'responsive-directing': ['responsive-directing-bounded', 'final-composition-readable'],
};

const requiredChecksForGroup = (group) => {
  if (group.pattern !== 'supported-subject' || group.support?.layering !== 'subject-front') {
    return COMPOSITE_PROFILES[group.pattern];
  }
  return COMPOSITE_PROFILES['supported-subject'].map((check) =>
    check === 'front-occlusion' ? 'subject-front-clear' : check,
  );
};

const qualityReportPath = (slug) => path.join(ROOT, 'projects', slug, 'quality-report.json');
export const compositionProofReportPath = (slug) => path.join(ROOT, 'dist', slug, 'composition-proof', 'report.json');

const TOPOLOGY_ASSET_CHECKS = ['silhouette-fidelity', 'negative-space-clean', 'background-leak-free'];
const EVIDENCE_REQUIRED_CHECKS = new Set([
  ...TOPOLOGY_ASSET_CHECKS,
  'motion-isolation-clean',
  'identity-distinct-within-frame',
  'identity-family-consistent',
  'cross-scene-identity-continuity',
  'untargeted-cells-unchanged',
  'mechanism-complete',
  'load-path-readable',
  'physical-plausibility',
  'reference-conformant',
  'diagram-edge-clean',
  'small-text-legible',
  'no-procedural-noise-on-semantic-lines',
]);

const hashFile = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const runtimeAssetId = (file) => `runtime-${createHash('sha256').update(file).digest('hex').slice(0, 12)}`;

const inferManifestKind = (record) => {
  if (record.request?.quality?.kind) return record.request.quality.kind;
  const normalized = record.file.toLowerCase();
  if (normalized.includes('/characters/source/') || record.request?.settings?.layout) return 'character-sheet';
  if (normalized.includes('/style/')) return 'style-sample';
  if (normalized.includes('/plates/')) return 'background';
  return 'image';
};

const assertWorkspaceFile = (file) => {
  const resolved = path.resolve(ROOT, file);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error(`质量检查路径越过工作区：${file}`);
  return resolved;
};

export const inspectUntargetedSheetCells = async ({
  currentFile,
  sourceFile,
  stateSheetBinding,
  recoveryBinding,
}) => {
  if (recoveryBinding?.mode !== 'masked-sheet-edit') {
    return {passed: true, sampledPixels: 0, changedPixels: 0, changedPixelRatio: 0, meanChannelDelta: 0};
  }
  try {
    const [current, source] = await Promise.all([
      sharp(currentFile).ensureAlpha().raw().toBuffer({resolveWithObject: true}),
      sharp(sourceFile).ensureAlpha().raw().toBuffer({resolveWithObject: true}),
    ]);
    if (current.info.width !== source.info.width || current.info.height !== source.info.height || current.info.channels !== source.info.channels) {
      return {
        passed: false,
        reason: 'dimensions-changed',
        current: `${current.info.width}x${current.info.height}x${current.info.channels}`,
        source: `${source.info.width}x${source.info.height}x${source.info.channels}`,
      };
    }
    const width = current.info.width;
    const height = current.info.height;
    const channels = current.info.channels;
    const columns = stateSheetBinding.layout.columns;
    const rows = stateSheetBinding.layout.rows;
    const targeted = new Set(recoveryBinding.targetStateIds);
    const contextStates = stateSheetBinding.states.filter(({stateId}) => !targeted.has(stateId));
    let sampledPixels = 0;
    let changedPixels = 0;
    let totalChannelDelta = 0;
    for (const state of contextStates) {
      const left = Math.round(state.column * width / columns);
      const right = Math.round((state.column + 1) * width / columns);
      const top = Math.round(state.row * height / rows);
      const bottom = Math.round((state.row + 1) * height / rows);
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const offset = (y * width + x) * channels;
          let pixelChanged = false;
          for (let channel = 0; channel < channels; channel += 1) {
            const delta = Math.abs(current.data[offset + channel] - source.data[offset + channel]);
            totalChannelDelta += delta;
            if (delta > 3) pixelChanged = true;
          }
          sampledPixels += 1;
          if (pixelChanged) changedPixels += 1;
        }
      }
    }
    const changedPixelRatio = sampledPixels === 0 ? 1 : changedPixels / sampledPixels;
    const meanChannelDelta = sampledPixels === 0 ? 255 : totalChannelDelta / (sampledPixels * channels);
    return {
      passed: sampledPixels > 0 && changedPixelRatio <= 0.001 && meanChannelDelta <= 0.5,
      sampledPixels,
      changedPixels,
      changedPixelRatio,
      meanChannelDelta,
    };
  } catch (error) {
    return {passed: false, reason: error.message};
  }
};

const readManifest = async (project) => {
  const file = path.join(ROOT, 'projects', project.slug, 'assets-manifest.json');
  const manifest = (await fileExists(file))
    ? await readJson(file)
    : {schemaVersion: 4, projectSlug: project.slug, assets: []};
  return assertAssetManifest(manifest, project.slug);
};

const collectQualityAssets = async (project, manifest, semanticContracts) => {
  const byFile = new Map();
  const add = ({
    assetId,
    file,
    kind,
    source,
    requiredChecks,
    semanticBinding = null,
    registeredFamilyBinding = null,
    stateSheetBinding = null,
    stateSheetRecoveryBinding = null,
    recoverySourceFile = null,
    recoverySourceSha256 = null,
    recoveryEvidenceFiles = [],
  }) => {
    const relativeFile = path.relative(ROOT, file);
    const existing = byFile.get(relativeFile);
    if (existing) {
      existing.sources = [...new Set([...existing.sources, source])];
      if (['background', 'environment', 'character', 'prop', 'mechanism', 'diagram'].includes(kind)) existing.kind = kind;
      if (requiredChecks?.length) existing.requiredChecks = [...new Set([...(existing.requiredChecks ?? []), ...requiredChecks])];
      if (assetId) existing.assetId = assetId;
      if (semanticBinding) existing.semanticBinding = semanticBinding;
      if (registeredFamilyBinding) {
        existing.registeredFamilyBinding = registeredFamilyBinding;
      }
      if (stateSheetBinding) existing.stateSheetBinding = stateSheetBinding;
      if (stateSheetRecoveryBinding) existing.stateSheetRecoveryBinding = stateSheetRecoveryBinding;
      if (recoverySourceFile) existing.recoverySourceFile = recoverySourceFile;
      if (recoverySourceSha256) existing.recoverySourceSha256 = recoverySourceSha256;
      if (recoveryEvidenceFiles.length) existing.recoveryEvidenceFiles = recoveryEvidenceFiles;
      return;
    }
    byFile.set(relativeFile, {
      assetId: assetId || runtimeAssetId(relativeFile),
      file: relativeFile,
      kind,
      sources: [source],
      semanticBinding,
      registeredFamilyBinding,
      stateSheetBinding,
      stateSheetRecoveryBinding,
      recoverySourceFile,
      recoverySourceSha256,
      recoveryEvidenceFiles,
      ...(requiredChecks?.length ? {requiredChecks} : {}),
    });
  };

  for (const scene of project.scenes ?? []) {
    for (const {node, parent} of collectCompositionAssets(scene.composition)) {
      const topologyChecks = parent && ['supported-subject', 'registered-environment'].includes(parent.pattern)
        ? [...(QUALITY_PROFILES[node.assetRole] ?? QUALITY_PROFILES.image), ...TOPOLOGY_ASSET_CHECKS]
        : null;
      add({file: resolvePublicFile(node.src), kind: node.assetRole, source: `scene:${scene.id}:node:${node.id}`, requiredChecks: topologyChecks});
    }
    for (const {node, parent} of collectStateSequences(scene.composition)) {
      const topologyChecks = parent && ['supported-subject', 'registered-environment'].includes(parent.pattern)
        ? [...(QUALITY_PROFILES[node.assetRole] ?? QUALITY_PROFILES.image), ...TOPOLOGY_ASSET_CHECKS]
        : null;
      for (const state of node.states) {
        add({
          assetId: `${node.poseFamilyId}:${state.id}`,
          file: resolvePublicFile(state.src),
          kind: node.assetRole,
          source: `scene:${scene.id}:node:${node.id}`,
          requiredChecks: topologyChecks,
        });
      }
    }
    for (const {node} of collectCompositionGroups(scene.composition)) {
      for (const boundary of node.boundaries ?? []) {
        for (const maskSrc of [boundary.upperMaskSrc, boundary.lowerMaskSrc].filter(Boolean)) {
          add({file: resolvePublicFile(maskSrc), kind: 'environment', source: `scene:${scene.id}:boundary:${boundary.id}`});
        }
      }
    }
  }

  const recordsByAssetId = new Map((manifest.assets ?? []).map((record) => [record.assetId, record]));
  for (const record of activeManifestAssets(manifest)) {
    if (record.capability !== 'image') continue;
    const semanticBinding = record.semanticBinding ?? record.request?.semanticBinding ?? null;
    const registeredFamilyBinding = record.registeredFamilyBinding ?? null;
    const boundContracts = (semanticBinding?.contractIds ?? [])
      .map((id) => semanticContracts.contracts.get(id))
      .filter(Boolean);
    const semanticChecks = requiredChecksForSemanticBinding(semanticBinding, boundContracts);
    const stateSheetRecoveryBinding = record.stateSheetRecoveryBinding ?? record.request?.stateSheetRecoveryBinding ?? null;
    const stateSheetBinding = record.stateSheetBinding ?? record.request?.stateSheetBinding ?? null;
    const recoverySource = stateSheetRecoveryBinding
      ? recordsByAssetId.get(stateSheetRecoveryBinding.sourceSheetAssetId) ?? null
      : null;
    const recoveryMask = stateSheetRecoveryBinding?.maskAssetId
      ? recordsByAssetId.get(stateSheetRecoveryBinding.maskAssetId) ?? null
      : null;
    add({
      assetId: record.assetId,
      file: assertWorkspaceFile(record.file),
      kind: inferManifestKind(record),
      source: `manifest:${record.assetId}`,
      requiredChecks: [...new Set([...(record.request?.quality?.requiredChecks ?? []), ...semanticChecks])],
      semanticBinding,
      registeredFamilyBinding,
      stateSheetBinding,
      stateSheetRecoveryBinding,
      recoverySourceFile: recoverySource?.file ?? null,
      recoverySourceSha256: recoverySource?.sha256 ?? null,
      recoveryEvidenceFiles: [record.file, recoverySource?.file, recoveryMask?.file].filter(Boolean),
    });
  }

  const usedIds = new Set();
  return [...byFile.values()].map((asset) => {
    let assetId = asset.assetId;
    if (usedIds.has(assetId)) assetId = `${assetId}-${runtimeAssetId(asset.file).slice(-6)}`;
    usedIds.add(assetId);
    const semanticContractFingerprints = Object.fromEntries(
      (asset.semanticBinding?.contractIds ?? [])
        .map((id) => [id, semanticContracts.fingerprints.get(id) ?? null]),
    );
    return {...asset, assetId, semanticContractFingerprints};
  });
};

const inspectTechnicalQuality = async ({asset, project}) => {
  const file = assertWorkspaceFile(asset.file);
  if (!(await fileExists(file))) return {passed: false, checks: [{id: 'file-exists', passed: false, actual: 'missing'}]};
  const stat = await fs.stat(file);
  const metadata = await sharp(file).metadata();
  const checks = [
    {id: 'file-exists', passed: stat.size > 0, actual: stat.size},
    {id: 'dimensions-readable', passed: Boolean(metadata.width && metadata.height), actual: `${metadata.width ?? 0}x${metadata.height ?? 0}`},
  ];
  if (asset.kind === 'background') {
    const scale = project.quality?.minimumAssetScale ?? 1;
    const minimumWidth = Math.round(project.video.width * scale);
    const minimumHeight = Math.round(project.video.height * scale);
    checks.push({id: 'minimum-resolution', passed: Number(metadata.width ?? 0) >= minimumWidth && Number(metadata.height ?? 0) >= minimumHeight, expected: `${minimumWidth}x${minimumHeight}`, actual: `${metadata.width ?? 0}x${metadata.height ?? 0}`});
  }
  if (['character', 'prop'].includes(asset.kind)) {
    const inspection = await inspectCharacterPng(file);
    checks.push(
      {id: 'alpha-present', passed: inspection.hasAlpha && inspection.transparentPixels > 0, actual: inspection.hasAlpha},
      {id: 'key-edge-clean', passed: inspection.keyEdgeRatio <= 0.12, expected: '<= 0.12', actual: inspection.keyEdgeRatio},
    );
  }
  if (metadata.hasAlpha === true) {
    const inspection = await inspectAlphaBands({
      file,
      derivationRegions: derivationRegionsFromBinding(
        asset.registeredFamilyBinding,
      ),
    });
    checks.push({
      id: 'rectangular-alpha-band-free',
      passed: inspection.passed,
      expected: 'no error-severity low-alpha rectangular band',
      actual: inspection,
    });
  }
  if (asset.semanticBinding?.riskClass === 'diagram-critical' && path.extname(file).toLowerCase() === '.svg') {
    const svg = await fs.readFile(file, 'utf8');
    for (const feature of ['feTurbulence', 'feDisplacementMap', 'feBlend']) {
      const present = new RegExp(`<${feature}\\b`, 'i').test(svg);
      checks.push({
        id: `diagram-filter-${feature}`,
        passed: !present,
        expected: 'absent',
        actual: present ? 'present' : 'absent',
      });
    }
  }
  if (asset.stateSheetRecoveryBinding?.mode === 'masked-sheet-edit') {
    const comparison = asset.recoverySourceFile
      ? await inspectUntargetedSheetCells({
          currentFile: file,
          sourceFile: assertWorkspaceFile(asset.recoverySourceFile),
          stateSheetBinding: asset.stateSheetBinding,
          recoveryBinding: asset.stateSheetRecoveryBinding,
        })
      : {passed: false, reason: 'source-sheet-missing'};
    checks.push({
      id: 'untargeted-cells-unchanged',
      passed: comparison.passed,
      expected: 'changedPixelRatio <= 0.001 and meanChannelDelta <= 0.5',
      actual: comparison,
    });
  }
  return {passed: checks.every(({passed}) => passed), checks};
};

const descendants = (group) => flattenCompositionNodes(group.children ?? []).map(({node}) => node);

const visualSourcesForNode = (node) => {
  if (!node) return [];
  if (node.kind === 'asset') return [node.src];
  if (node.kind === 'state-sequence') return node.states.map(({src}) => src);
  if (node.kind === 'motif-field') return node.motifs.map(({src}) => src);
  if (node.kind === 'group') return descendants(node).flatMap(visualSourcesForNode);
  return [];
};

const hashReferencedFiles = async (sources) => {
  const hashes = {};
  for (const source of [...new Set(sources.filter(Boolean))].sort()) {
    const file = resolvePublicFile(source);
    hashes[source] = (await fileExists(file)) ? await hashFile(file) : null;
  }
  return hashes;
};

const findNode = (scene, id) => flattenCompositionNodes(scene.composition?.nodes).find(({node}) => node.id === id)?.node ?? null;

export const collectCompositeQualityTargets = async (project, {manifest = null} = {}) => {
  const runtimeBuildFingerprint = await createRuntimeBuildFingerprint();
  const assetManifest = manifest ?? await readManifest(project);
  const recordsByFile = new Map((assetManifest.assets ?? []).map((record) => [path.normalize(record.file), record]));
  const targets = [];
  for (const scene of project.scenes ?? []) {
    const sceneTransitions = (project.sceneTransitions ?? []).filter(
      ({fromSceneId, toSceneId}) => fromSceneId === scene.id || toSceneId === scene.id,
    );
    if (scene.camera?.parallax?.enabled) {
      const nodes = flattenCompositionNodes(scene.composition?.nodes).map(({node}) => node);
      const memberHashes = await hashReferencedFiles(collectCompositionVisualSources(scene.composition));
      const proofTimes = scene.motion?.proofTimes ?? [];
      const depthMap = nodes.map(({id, kind, depth = 0}) => ({id, kind, depth}));
      const fingerprint = hashCompositionValue({
        runtimeBuildFingerprint,
        sceneId: scene.id,
        parallax: scene.camera.parallax,
        camera: scene.camera,
        depthMap,
        proofTimes,
        timing: {narration: scene.narration, tailSeconds: scene.tailSeconds, sceneTransitions},
        memberHashes,
      });
      targets.push({
        compositeId: `parallax-rig:${scene.id}`,
        sceneId: scene.id,
        pattern: 'parallax-rig',
        nodeId: 'scene-camera',
        memberNodeIds: nodes.map(({id}) => id),
        memberHashes,
        compositionHash: hashCompositionValue({camera: scene.camera, depthMap}),
        fingerprint,
        proofTimeIds: proofTimes.map(({id}) => id),
        requiredChecks: COMPOSITE_PROFILES['parallax-rig'],
        parallax: scene.camera.parallax,
        depthMap,
      });
    }
    for (const {node} of collectMotifFields(scene.composition)) {
      const proofTimes = scene.motion?.proofTimes ?? [];
      const memberHashes = await hashReferencedFiles(node.motifs.map(({src}) => src));
      const fingerprint = hashCompositionValue({
        runtimeBuildFingerprint,
        sceneId: scene.id,
        node,
        proofTimes,
        timing: {narration: scene.narration, tailSeconds: scene.tailSeconds, sceneTransitions},
        camera: scene.camera,
        affectingEvents: (scene.events ?? []).filter(({targetId}) => targetId === node.id),
        memberHashes,
      });
      targets.push({
        compositeId: `motif-field:${scene.id}:${node.id}`,
        sceneId: scene.id,
        pattern: 'motif-field',
        nodeId: node.id,
        memberNodeIds: [node.id],
        memberHashes,
        compositionHash: hashCompositionValue(node),
        fingerprint,
        proofTimeIds: proofTimes.map(({id}) => id),
        requiredChecks: COMPOSITE_PROFILES['motif-field'],
        motifField: node,
      });
    }
    for (const {node} of flattenCompositionNodes(scene.composition?.nodes).filter(
      ({node: candidate}) => ['typography', 'annotation', 'data-graphic'].includes(candidate.kind),
    )) {
      const pattern = node.kind;
      const proofTimes = scene.motion?.proofTimes ?? [];
      const fingerprint = hashCompositionValue({
        runtimeBuildFingerprint,
        sceneId: scene.id,
        node,
        editorialFingerprint: project.editorial?.fingerprint ?? null,
        responsivePlans: project.editorial?.responsivePlans ?? [],
        proofTimes,
      });
      targets.push({
        compositeId: `${pattern}:${scene.id}:${node.id}`,
        sceneId: scene.id,
        pattern,
        nodeId: node.id,
        memberNodeIds: [node.id],
        memberHashes: [],
        compositionHash: hashCompositionValue(node),
        fingerprint,
        proofTimeIds: proofTimes.map(({id}) => id),
        requiredChecks: COMPOSITE_PROFILES[pattern],
        editorialNode: node,
        sceneNodes: scene.composition?.nodes ?? [],
        video: project.video,
        editorial: project.editorial,
        exclusionZones: project.editorial?.responsiveProfiles?.find(
          ({id}) => id === project.editorial.activeProfile,
        )?.exclusionZones ?? [],
      });
    }
    for (const {node} of collectStateSequences(scene.composition)) {
      const proofTimes = (scene.motion?.proofTimes ?? []).filter((proof) =>
        (proof.stateAssertions ?? []).some(({nodeId}) => nodeId === node.id),
      );
      const memberHashes = await hashReferencedFiles(node.states.map(({src}) => src));
      const stateRecords = node.states.map((state) => recordsByFile.get(path.normalize(path.relative(ROOT, resolvePublicFile(state.src)))) ?? null);
      const familyProvenance = stateRecords.map((record) => record ? {
        assetId: record.assetId,
        compositionBinding: record.compositionBinding ?? record.request?.compositionBinding ?? null,
        stateBinding: record.stateBinding ?? record.request?.stateBinding ?? null,
        familyFingerprint: record.familyFingerprint ?? null,
      } : null);
      const fingerprint = hashCompositionValue({
        runtimeBuildFingerprint,
        sceneId: scene.id,
        node,
        proofTimes,
        timing: {narration: scene.narration, tailSeconds: scene.tailSeconds, sceneTransitions},
        camera: scene.camera,
        affectingEvents: (scene.events ?? []).filter(({targetId}) => targetId === node.id),
        memberHashes,
        familyProvenance,
      });
      targets.push({
        compositeId: `state-sequence:${scene.id}:${node.id}`,
        sceneId: scene.id,
        pattern: 'state-sequence',
        nodeId: node.id,
        memberNodeIds: [node.id],
        memberHashes,
        compositionHash: hashCompositionValue(node),
        fingerprint,
        proofTimeIds: proofTimes.map(({id}) => id),
        requiredChecks: COMPOSITE_PROFILES['state-sequence'],
        sequence: node,
        stateRecords,
      });
    }
    for (const {node: group} of collectCompositionGroups(scene.composition)) {
      if (!['supported-subject', 'registered-environment'].includes(group.pattern)) continue;
      const members = descendants(group).filter((node) => ['asset', 'state-sequence'].includes(node.kind));
      const sources = [
        ...members.flatMap((member) => member.kind === 'asset' ? [member.src] : member.states.map(({src}) => src)),
        ...(group.boundaries ?? []).flatMap(({upperMaskSrc, lowerMaskSrc}) => [upperMaskSrc, lowerMaskSrc]),
      ];
      const memberHashes = await hashReferencedFiles(sources);
      const familyRecords = members.flatMap((member) =>
        (member.kind === 'asset' ? [member.src] : member.states.map(({src}) => src))
          .map((source) => recordsByFile.get(path.normalize(path.relative(ROOT, resolvePublicFile(source)))) ?? null),
      );
      const familyProvenance = familyRecords.map((record) => record ? {
        assetId: record.assetId,
        compositionBinding: record.compositionBinding ?? record.request?.compositionBinding ?? null,
        registeredFamilyBinding: record.registeredFamilyBinding ?? null,
        familyFingerprint: record.familyFingerprint ?? null,
      } : null);
      const fingerprint = hashCompositionValue({
        runtimeBuildFingerprint,
        sceneId: scene.id,
        group,
        proofTimes: scene.motion?.proofTimes ?? [],
        timing: {narration: scene.narration, tailSeconds: scene.tailSeconds, sceneTransitions},
        camera: scene.camera,
        affectingEvents: (scene.events ?? []).filter(({targetId}) => targetId === group.id),
        memberHashes,
        familyProvenance,
      });
      targets.push({
        compositeId: `group:${scene.id}:${group.id}`,
        sceneId: scene.id,
        pattern: group.pattern,
        nodeId: group.id,
        memberNodeIds: members.map(({id}) => id),
        memberHashes,
        compositionHash: hashCompositionValue(group),
        fingerprint,
        proofTimeIds: (scene.motion?.proofTimes ?? []).map(({id}) => id),
        requiredChecks: requiredChecksForGroup(group),
        group,
        familyRecords,
      });
    }
    for (const event of scene.events ?? []) {
      if (!event.proofTimeId && !event.sound) continue;
      const targetNode = findNode(scene, event.targetId);
      const targetSources = targetNode
        ? targetNode.kind === 'state-sequence'
          ? targetNode.states.map(({src}) => src)
          : visualSourcesForNode(targetNode)
        : collectCompositionVisualSources(scene.composition);
      const memberHashes = await hashReferencedFiles(targetSources);
      const proof = (scene.motion?.proofTimes ?? []).find(({id}) => id === event.proofTimeId) ?? null;
      const fingerprint = hashCompositionValue({runtimeBuildFingerprint, sceneId: scene.id, event, proof, targetNode, timing: {narration: scene.narration, tailSeconds: scene.tailSeconds, sceneTransitions}, camera: scene.camera, memberHashes});
      targets.push({
        compositeId: `event:${scene.id}:${event.id}`,
        sceneId: scene.id,
        pattern: 'event',
        nodeId: event.targetId,
        memberNodeIds: targetNode ? [targetNode.id] : [],
        memberHashes,
        compositionHash: hashCompositionValue({event, proof, targetNode}),
        fingerprint,
        proofTimeIds: event.proofTimeId ? [event.proofTimeId] : [],
        requiredChecks: COMPOSITE_PROFILES.event,
        event,
      });
    }
  }
  for (const transition of project.editorial?.transitionPlans ?? []) {
    targets.push({
      compositeId: `editorial-transition:${transition.id}`,
      sceneId: transition.sceneId,
      pattern: 'editorial-transition',
      nodeId: transition.sourceAnchor?.targetId ?? transition.id,
      memberNodeIds: [
        transition.sourceAnchor?.targetId,
        transition.destinationAnchor?.targetId,
      ].filter(Boolean),
      memberHashes: [],
      compositionHash: hashCompositionValue(transition),
      fingerprint: hashCompositionValue({
        runtimeBuildFingerprint,
        editorialFingerprint: project.editorial.fingerprint,
        transition,
      }),
      proofTimeIds: transition.proofFrameIds,
      requiredChecks: COMPOSITE_PROFILES['editorial-transition'],
      editorialTransition: transition,
    });
  }
  for (const responsive of (project.editorial?.responsivePlans ?? []).filter(
    (plan) => plan.scenes.some(({placements}) => placements.length > 0),
  )) {
    targets.push({
      compositeId: `responsive-directing:${responsive.profileId}`,
      sceneId: project.scenes?.[0]?.id ?? 'project',
      pattern: 'responsive-directing',
      nodeId: responsive.profileId,
      memberNodeIds: responsive.scenes.flatMap(({placements}) => placements.map(({targetId}) => targetId)),
      memberHashes: [],
      compositionHash: hashCompositionValue(responsive),
      fingerprint: hashCompositionValue({
        runtimeBuildFingerprint,
        editorialFingerprint: project.editorial.fingerprint,
        responsive,
      }),
      proofTimeIds: [],
      requiredChecks: COMPOSITE_PROFILES['responsive-directing'],
      responsive,
    });
  }
  const semanticContracts = await loadSemanticContracts(project.slug);
  if (semanticContracts.document?.status === 'ready' && semanticContracts.issues.length === 0) {
    const targetIssues = validateSemanticEvidenceTargets(semanticContracts.document, project);
    if (targetIssues.length) throw new Error(targetIssues.join('\n'));
    const sceneById = new Map((project.scenes ?? []).map((scene) => [scene.id, scene]));
    for (const contract of semanticContracts.document.contracts) {
      for (const evidenceTarget of contract.evidenceTargets) {
        const proofShots = evidenceTarget.shots.map((shot) => ({
          sceneId: shot.sceneId,
          nodeId: shot.nodeId ?? 'scene',
          proofTimeIds: shot.proofTimeIds,
        }));
        const sources = [];
        const memberNodeIds = [];
        const sceneEvidence = [];
        for (const shot of proofShots) {
          const scene = sceneById.get(shot.sceneId);
          if (!scene) throw new Error(`${contract.id}/${evidenceTarget.id} 引用了未知场景 ${shot.sceneId}。`);
          const targetNode = shot.nodeId === 'scene' ? null : findNode(scene, shot.nodeId);
          if (shot.nodeId !== 'scene' && !targetNode) {
            throw new Error(`${contract.id}/${evidenceTarget.id} 引用了未知节点 ${shot.nodeId}。`);
          }
          const nodes = targetNode
            ? (['asset', 'state-sequence'].includes(targetNode.kind) ? [targetNode] : descendants(targetNode).filter(({kind}) => ['asset', 'state-sequence'].includes(kind)))
            : flattenCompositionNodes(scene.composition?.nodes).map(({node}) => node).filter(({kind}) => ['asset', 'state-sequence'].includes(kind));
          sources.push(...nodes.flatMap((node) => node.kind === 'asset' ? [node.src] : node.states.map(({src}) => src)));
          memberNodeIds.push(...nodes.map(({id}) => id));
          sceneEvidence.push({
            sceneId: scene.id,
            nodeId: shot.nodeId,
            proofTimes: (scene.motion?.proofTimes ?? []).filter(({id}) => shot.proofTimeIds.includes(id)),
            camera: scene.camera,
            events: scene.events,
          });
        }
        const memberHashes = await hashReferencedFiles(sources);
        const fingerprint = hashCompositionValue({
          runtimeBuildFingerprint,
          contract,
          evidenceTarget,
          contractFingerprint: semanticContracts.fingerprints.get(contract.id),
          sceneEvidence,
          memberHashes,
        });
        targets.push({
          compositeId: `semantic:${contract.id}:${evidenceTarget.id}`,
          sceneId: proofShots[0].sceneId,
          pattern: 'semantic-contract',
          nodeId: proofShots[0].nodeId,
          memberNodeIds: [...new Set(memberNodeIds)],
          memberHashes,
          compositionHash: hashCompositionValue({contract, evidenceTarget}),
          fingerprint,
          proofTimeIds: [...new Set(proofShots.flatMap(({proofTimeIds}) => proofTimeIds))],
          proofShots,
          requiredChecks: evidenceTarget.checks,
          contractId: contract.id,
          contractKind: contract.kind,
        });
      }
    }
  }
  return targets;
};

export const collectStyleProofTargets = async (project, directingTarget) => {
  const allTargets = await collectCompositeQualityTargets(project);
  const matchesDirectingTarget = (target) => {
    const shots = target.proofShots ?? [{
      sceneId: target.sceneId,
      nodeId: target.nodeId,
    }];
    return shots.some(({sceneId, nodeId}) =>
      sceneId === directingTarget.sceneId &&
      (nodeId === directingTarget.targetId || (target.memberNodeIds ?? []).includes(directingTarget.targetId)) &&
      (!directingTarget.proofTimeId || (target.proofTimeIds ?? []).includes(directingTarget.proofTimeId)),
    );
  };
  const formalTargets = allTargets.filter(matchesDirectingTarget);
  if (formalTargets.length > 0) return formalTargets;

  const scene = (project.scenes ?? []).find(({id}) => id === directingTarget.sceneId);
  const targetNode = scene && directingTarget.targetId !== 'scene-camera'
    ? findNode(scene, directingTarget.targetId)
    : null;
  const nodes = targetNode
    ? (['asset', 'state-sequence', 'motif-field'].includes(targetNode.kind)
        ? [targetNode]
        : descendants(targetNode).filter(({kind}) => ['asset', 'state-sequence', 'motif-field'].includes(kind)))
    : [];
  const sources = nodes.flatMap(visualSourcesForNode);
  const memberHashes = await hashReferencedFiles(sources);
  const runtimeBuildFingerprint = await createRuntimeBuildFingerprint();
  const proofTimes = scene?.motion?.proofTimes ?? [];
  return [{
    compositeId: `style-target:${directingTarget.sceneId}:${directingTarget.targetId}`,
    sceneId: directingTarget.sceneId,
    pattern: 'style-target',
    nodeId: directingTarget.targetId,
    memberNodeIds: nodes.map(({id}) => id),
    memberHashes,
    compositionHash: hashCompositionValue(targetNode ?? {targetId: directingTarget.targetId}),
    fingerprint: hashCompositionValue({
      runtimeBuildFingerprint,
      directingTarget,
      sceneId: scene?.id,
      targetNode,
      proofTimes,
      camera: scene?.camera,
      memberHashes,
    }),
    proofTimeIds: proofTimes.map(({id}) => id),
    requiredChecks: [],
    styleOnly: true,
  }];
};

const alphaCoverageInPolygon = async (source, polygon) => {
  const file = resolvePublicFile(source);
  if (!(await fileExists(file)) || !Array.isArray(polygon) || polygon.length < 3) return 0;
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let sampled = 0;
  let visible = 0;
  for (let y = 0; y < info.height; y += 2) {
    for (let x = 0; x < info.width; x += 2) {
      if (!pointInPolygon([(x + 0.5) / info.width, (y + 0.5) / info.height], polygon)) continue;
      sampled += 1;
      if (data[(y * info.width + x) * info.channels + 3] > 16) visible += 1;
    }
  }
  return sampled === 0 ? 0 : visible / sampled;
};

export const inspectCompositeTechnical = async ({target, proofReport}) => {
  const proofEntry = proofReport?.composites?.find(({compositeId}) => compositeId === target.compositeId);
  const proofFrames = proofEntry?.proofFrames ?? [];
  const artifactsPresent = proofFrames.length > 0 && (await Promise.all(
    proofFrames.flatMap(({fullFrame, crop}) => [fullFrame, crop]).map(async (file) => {
      if (!file) return false;
      try {
        return await fileExists(assertWorkspaceFile(file));
      } catch {
        return false;
      }
    }),
  )).every(Boolean);
  const checks = [
    {id: 'proof-current', passed: proofEntry?.fingerprint === target.fingerprint, expected: target.fingerprint, actual: proofEntry?.fingerprint ?? null},
    {id: 'proof-artifacts-present', passed: artifactsPresent, actual: proofFrames.length},
  ];
  if (target.pattern === 'supported-subject') {
    const front = target.group.children.find(({kind, slot}) => kind === 'asset' && slot === 'support-front');
    const alphaCoverage = front ? await alphaCoverageInPolygon(front.src, target.group.support?.occlusionZone) : 0;
    const registration = target.group.registration;
    const familyBound = target.familyRecords.every((record) => {
      const binding = record?.compositionBinding ?? record?.request?.compositionBinding;
      return binding?.registrationId === registration?.id && binding?.sourceMasterAssetId === registration?.sourceMasterAssetId;
    });
    const registeredFamily = assertRegisteredFamilyRecords({
      records: target.familyRecords,
      registration,
    });
    const rolesMatchNodes = target.familyRecords.every((record) => {
      const binding = record?.registeredFamilyBinding;
      return target.group.children.some(
        (node) =>
          node.id === binding?.nodeId &&
          node.slot === binding?.slot &&
          binding.role === binding.slot,
      );
    });
    if (target.group.support?.layering === 'subject-front') {
      checks.push({id: 'subject-front-layering', passed: true, expected: 'subject-front', actual: 'subject-front'});
    } else {
      checks.push({id: 'front-alpha-in-occlusion-zone', passed: alphaCoverage > 0.002, expected: '> 0.002', actual: alphaCoverage});
    }
    checks.push(
      {id: 'registered-source-family', passed: familyBound, actual: familyBound},
      {
        id: 'registered-family-derivation',
        passed: registeredFamily.passed && rolesMatchNodes,
        expected: 'three full-canvas registered-family members with matching roles',
        actual: {
          passed: registeredFamily.passed && rolesMatchNodes,
          errors: registeredFamily.errors,
          rolesMatchNodes,
        },
      },
    );
    const alphaEvidence = (proofReport?.assetEvidence ?? []).filter(
      (entry) =>
        entry.sceneId === target.sceneId &&
        target.memberNodeIds.includes(entry.nodeId),
    );
    const alphaEvidenceCurrent =
      alphaEvidence.length === target.memberNodeIds.length &&
      alphaEvidence.every((entry) => {
        const inspection = entry.alphaBandInspection;
        if (!inspection?.passed || !entry.renderSize) return false;
        const renderScaleCovered =
          inspection.scales?.some(({label}) => label === 'render-scale') ||
          (
            inspection.sourceSize?.width === Math.round(entry.renderSize.width) &&
            inspection.sourceSize?.height === Math.round(entry.renderSize.height)
          );
        return renderScaleCovered;
      });
    checks.push({
      id: 'alpha-band-proof-evidence',
      passed: alphaEvidenceCurrent,
      expected: 'all three members pass original and actual proof/render scale alpha-band inspection',
      actual: alphaEvidence.map((entry) => ({
        nodeId: entry.nodeId,
        passed: entry.alphaBandInspection?.passed ?? false,
        renderSize: entry.renderSize ?? null,
        scales: entry.alphaBandInspection?.scales?.map(({label}) => label) ?? [],
      })),
    });
  }
  if (target.pattern === 'registered-environment') {
    const children = target.group.children.filter(({kind}) => kind === 'asset');
    const boundariesCovered = (target.group.boundaries ?? []).every((boundary) => ['upper', 'lower'].every((side) => children.some((child) => child.clip?.boundaryId === boundary.id && child.clip.side === side)));
    const registration = target.group.registration;
    const familyBound = target.familyRecords.every((record) => {
      const binding = record?.compositionBinding ?? record?.request?.compositionBinding;
      return binding?.registrationId === registration?.id && binding?.sourceMasterAssetId === registration?.sourceMasterAssetId;
    });
    checks.push(
      {id: 'boundary-clips-present', passed: boundariesCovered, actual: boundariesCovered},
      {id: 'registered-source-family', passed: familyBound, actual: familyBound},
    );
  }
  if (target.pattern === 'event') {
    checks.push(
      {id: 'event-proof-bound', passed: Boolean(target.event.proofTimeId), actual: target.event.proofTimeId ?? null},
      {id: 'event-sound-valid', passed: !target.event.sound || Boolean(target.event.sound.src), actual: target.event.sound?.src ?? 'not-required'},
    );
  }
  if (target.pattern === 'state-sequence') {
    const proofStateIds = new Set((target.proofTimeIds ?? []).flatMap((proofTimeId) => {
      const proof = proofFrames.find((frame) => frame.proofTimeId === proofTimeId);
      return proof ? [proofTimeId] : [];
    }));
    const registrationsBound = target.stateRecords.every((record) => {
      if (!record) return false;
      const binding = record.stateBinding ?? record.request?.stateBinding;
      return binding?.poseFamilyId === target.sequence.poseFamilyId && binding?.registrationId === target.sequence.registration.id;
    });
    const registeredDimensions = new Set(target.stateRecords.map((record) =>
      record?.media ? `${record.media.width}x${record.media.height}` : 'missing',
    ));
    const expectedDimensions = `${target.sequence.registration.canvas.width}x${target.sequence.registration.canvas.height}`;
    checks.push(
      {id: 'state-proofs-complete', passed: proofStateIds.size === target.proofTimeIds.length, expected: target.proofTimeIds.length, actual: proofStateIds.size},
      {id: 'registered-state-family', passed: registrationsBound, actual: registrationsBound},
      {id: 'registered-state-dimensions', passed: registeredDimensions.size === 1 && registeredDimensions.has(expectedDimensions), expected: expectedDimensions, actual: [...registeredDimensions].join(', ')},
    );
  }
  if (target.pattern === 'parallax-rig') {
    const depthLevels = new Set(target.depthMap.map(({depth}) => depth));
    checks.push(
      {id: 'parallax-enabled', passed: target.parallax?.enabled === true, expected: true, actual: target.parallax?.enabled ?? false},
      {id: 'parallax-depth-levels', passed: depthLevels.size >= 2, expected: '>= 2', actual: depthLevels.size},
    );
  }
  if (target.pattern === 'motif-field') {
    const field = target.motifField;
    const bounds = field.bounds;
    const boundsWithinCanvas =
      bounds?.x >= 0 &&
      bounds?.y >= 0 &&
      bounds?.width > 0 &&
      bounds?.height > 0 &&
      bounds.x + bounds.width <= 1 &&
      bounds.y + bounds.height <= 1;
    const exclusionIds = new Set();
    const exclusionsValid =
      Array.isArray(field.exclusionZones) &&
      field.exclusionZones.length <= 12 &&
      field.exclusionZones.every((zone) => {
        const uniqueId = typeof zone.id === 'string' && zone.id.length > 0 && !exclusionIds.has(zone.id);
        exclusionIds.add(zone.id);
        return (
          uniqueId &&
          ['rectangle', 'ellipse'].includes(zone.shape) &&
          zone.x >= 0 &&
          zone.y >= 0 &&
          zone.width > 0 &&
          zone.height > 0 &&
          zone.x + zone.width <= 1 &&
          zone.y + zone.height <= 1 &&
          (zone.padding === undefined || (zone.padding >= 0 && zone.padding <= 0.25))
        );
      });
    let placementError = null;
    let placedCount = 0;
    try {
      placedCount = resolveMotifFieldInstances(field).length;
    } catch (error) {
      placementError = error.message;
    }
    const loop = verifyMotifFieldLoop(field.fieldMotion);
    checks.push(
      {id: 'motif-count-bounded', passed: Number.isInteger(field.count) && field.count >= 1 && field.count <= MAX_MOTIF_INSTANCES_PER_FIELD, expected: `1..${MAX_MOTIF_INSTANCES_PER_FIELD}`, actual: field.count},
      {id: 'motif-seed-fixed', passed: Number.isInteger(field.seed), expected: 'integer', actual: field.seed},
      {id: 'motif-bounds-contained', passed: boundsWithinCanvas, expected: 'inside 0..1', actual: bounds},
      {id: 'motif-exclusions-valid', passed: exclusionsValid, expected: '<= 12 unique normalized zones', actual: field.exclusionZones},
      {id: 'motif-placement-complete', passed: placementError === null && placedCount === field.count, expected: field.count, actual: placementError ?? placedCount},
      {id: 'motif-loop-continuous', passed: loop.passed, expected: 'continuous transform or invisible respawn', actual: loop},
    );
  }
  if (target.pattern === 'typography') {
    const node = target.editorialNode;
    const layout = fitEditorialTypography({
      text: node.text,
      width: node.transform.width * target.video.width,
      height: (node.transform.height ?? node.transform.width) * target.video.height,
      minFontSize: node.treatment.fit.minFontSize,
      maxFontSize: node.treatment.fit.maxFontSize,
      maxLines: node.treatment.fit.maxLines,
      lineHeight: node.treatment.style.lineHeight,
      letterSpacing: node.treatment.style.letterSpacing ?? 0,
    });
    const pointIds = [
      ...(node.treatment.reveal?.editPointIds ?? []),
      ...(node.treatment.emphasis ?? []).map(({editPointId}) => editPointId),
    ];
    const timingBound = pointIds.every((editPointId) =>
      target.editorial.resolvedEditPoints.some(
        (point) => point.id === editPointId && point.sceneId === target.sceneId,
      ),
    );
    checks.push(
      {id: 'typography-fit', passed: !layout.overflow, expected: 'no overflow', actual: layout},
      {id: 'typography-edit-points', passed: timingBound, expected: pointIds, actual: timingBound},
    );
  }
  if (target.pattern === 'annotation') {
    const route = resolveAnnotationRoute({
      node: target.editorialNode,
      nodes: target.sceneNodes,
      zones: target.exclusionZones,
    });
    checks.push(
      {id: 'annotation-route', passed: route.valid, expected: 'valid', actual: route},
      {id: 'annotation-exclusions', passed: route.valid && !route.directBlocked, expected: 'clear', actual: route.directBlocked},
    );
  }
  if (target.pattern === 'data-graphic') {
    const dataIssues = validateDataGraphicNode(target.editorialNode);
    const timingBound = (target.editorialNode.states ?? []).every(({editPointId}) =>
      target.editorial.resolvedEditPoints.some(
        (point) => point.id === editPointId && point.sceneId === target.sceneId,
      ),
    );
    checks.push(
      {id: 'data-schema', passed: dataIssues.length === 0, expected: [], actual: dataIssues},
      {id: 'data-edit-points', passed: timingBound, expected: true, actual: timingBound},
    );
  }
  if (target.pattern === 'editorial-transition') {
    const invalid = target.editorialTransition.invalidProfiles ?? [];
    checks.push({
      id: 'editorial-transition-continuity',
      passed: invalid.length === 0 || target.editorialTransition.invalidPolicy === 'fallback',
      expected: 'valid or deterministic fallback',
      actual: target.editorialTransition.continuity,
    });
  }
  if (target.pattern === 'responsive-directing') {
    const bounded = target.responsive.scenes.every(
      ({densityUsed}) => densityUsed <= target.responsive.densityBudget,
    );
    checks.push({
      id: 'responsive-density-budget',
      passed: bounded,
      expected: `<= ${target.responsive.densityBudget}`,
      actual: target.responsive.scenes.map(({sceneId, densityUsed}) => ({sceneId, densityUsed})),
    });
  }
  return {passed: checks.every(({passed}) => passed), checks, proofFrames};
};

const entryStatus = ({technical, semanticChecks}) => {
  const values = Object.values(semanticChecks);
  if (!technical.passed || values.includes('failed')) return 'needs-revision';
  return values.every((status) => status === 'passed') ? 'passed' : 'pending';
};

const summarizeEntries = (entries) => {
  const failed = entries.filter(({status}) => status === 'needs-revision');
  const pending = entries.filter(({status}) => status === 'pending');
  return {total: entries.length, passed: entries.length - failed.length - pending.length, pending: pending.length, failed: failed.length};
};

export const summarizeQualityReport = (report) => {
  const assets = summarizeEntries(report.assets ?? []);
  const composites = summarizeEntries(report.composites ?? []);
  const total = {total: assets.total + composites.total, passed: assets.passed + composites.passed, pending: assets.pending + composites.pending, failed: assets.failed + composites.failed};
  return {ready: total.pending === 0 && total.failed === 0, actualPassed: total.pending === 0 && total.failed === 0, ...total, scopes: {assets, composites}, report};
};

const evidenceFilesAreCurrent = async (evidenceFiles) => {
  if (!Array.isArray(evidenceFiles) || evidenceFiles.length === 0) return true;
  try {
    const current = await Promise.all(evidenceFiles.map(async (evidence) => {
      if (typeof evidence?.file !== 'string' || typeof evidence?.sha256 !== 'string') return false;
      const absoluteFile = assertWorkspaceFile(evidence.file);
      return (await fileExists(absoluteFile)) && await hashFile(absoluteFile) === evidence.sha256;
    }));
    return current.every(Boolean);
  } catch {
    return false;
  }
};

const preservedReview = async ({previous, fingerprint, requiredChecks}) => {
  const sameTarget = previous?.fingerprint === fingerprint || previous?.sha256 === fingerprint;
  const preserve = sameTarget && await evidenceFilesAreCurrent(previous?.evidenceFiles);
  return {
    semanticChecks: Object.fromEntries(requiredChecks.map((check) => [check, preserve ? previous.semanticChecks?.[check] ?? 'pending' : 'pending'])),
    reviewer: preserve ? previous.reviewer ?? null : null,
    reviewedAt: preserve ? previous.reviewedAt ?? null : null,
    note: preserve ? previous.note ?? '' : '',
    evidenceFiles: preserve ? previous.evidenceFiles ?? [] : [],
  };
};

export const prepareQualityReport = async (slug, {write = true} = {}) => {
  const {project} = await loadProject(slug);
  const file = qualityReportPath(slug);
  const existing = (await fileExists(file)) ? await readJson(file) : null;
  const manifest = await readManifest(project);
  const semanticContracts = await loadSemanticContracts(slug);
  if (semanticContracts.issues.length) {
    throw new Error(
      semanticContracts.issues.map(({location, message}) => `${location}: ${message}`).join('\n'),
    );
  }
  const previousAssets = new Map((existing?.assets ?? []).map((entry) => [entry.assetId, entry]));
  const previousComposites = new Map((existing?.composites ?? []).map((entry) => [entry.compositeId, entry]));
  const assets = await collectQualityAssets(project, manifest, semanticContracts);
  const inspectedAssets = await Promise.all(assets.map(async (asset) => {
    const absoluteFile = assertWorkspaceFile(asset.file);
    const sha256 = (await fileExists(absoluteFile)) ? await hashFile(absoluteFile) : null;
    const requiredChecks = [...new Set(asset.requiredChecks?.length ? asset.requiredChecks : QUALITY_PROFILES[asset.kind] ?? QUALITY_PROFILES.image)];
    const unknownChecks = requiredChecks.filter((check) => !ASSET_QUALITY_CHECKS.includes(check));
    if (unknownChecks.length) throw new Error(`${asset.assetId} 含未知资产质量检查：${unknownChecks.join(', ')}`);
    const fingerprint = asset.semanticBinding ||
      asset.stateSheetRecoveryBinding ||
      asset.registeredFamilyBinding
      ? hashCompositionValue({
          sha256,
          semanticBinding: asset.semanticBinding,
          semanticContractFingerprints: asset.semanticContractFingerprints,
          stateSheetBinding: asset.stateSheetBinding,
          stateSheetRecoveryBinding: asset.stateSheetRecoveryBinding,
          registeredFamilyBinding: asset.registeredFamilyBinding,
          recoverySourceSha256: asset.recoverySourceSha256,
        })
      : sha256;
    const review = await preservedReview({previous: previousAssets.get(asset.assetId), fingerprint, requiredChecks});
    const technical = await inspectTechnicalQuality({asset, project});
    return {...asset, sha256, fingerprint, requiredChecks, technical, ...review, status: entryStatus({technical, semanticChecks: review.semanticChecks})};
  }));

  const proofFile = compositionProofReportPath(slug);
  const styleProofFile = path.join(ROOT, 'dist', slug, 'style-motion-proof.json');
  const proofReports = [];
  if (await fileExists(proofFile)) proofReports.push(await readJson(proofFile));
  if (await fileExists(styleProofFile)) proofReports.push(await readJson(styleProofFile));
  const targets = await collectCompositeQualityTargets(project, {manifest});
  const inspectedComposites = await Promise.all(targets.map(async (target) => {
    const review = await preservedReview({previous: previousComposites.get(target.compositeId), fingerprint: target.fingerprint, requiredChecks: target.requiredChecks});
    const currentProofReport = proofReports.find((report) =>
      report.composites?.some(
        ({compositeId, fingerprint}) =>
          compositeId === target.compositeId &&
          fingerprint === target.fingerprint,
      ));
    const technical = await inspectCompositeTechnical({
      target,
      proofReport: currentProofReport ?? null,
    });
    return {
      compositeId: target.compositeId,
      sceneId: target.sceneId,
      pattern: target.pattern,
      nodeId: target.nodeId,
      memberNodeIds: target.memberNodeIds,
      memberHashes: target.memberHashes,
      compositionHash: target.compositionHash,
      fingerprint: target.fingerprint,
      proofTimeIds: target.proofTimeIds,
      proofFrames: technical.proofFrames,
      requiredChecks: target.requiredChecks,
      technical: {passed: technical.passed, checks: technical.checks},
      ...review,
      status: entryStatus({technical, semanticChecks: review.semanticChecks}),
    };
  }));
  const timeline = deriveTimeline(project);
  const report = {
    $schema: '../../schemas/quality-report.schema.json',
    schemaVersion: 4,
    projectSlug: slug,
    updatedAt: new Date().toISOString(),
    eventTimeline: timeline.scenes.flatMap((scene) => deriveEventTimeline({scene, sceneFrom: scene.from, fps: project.video.fps})),
    assetHistory: (manifest.assets ?? [])
      .filter(({lifecycle}) => lifecycle.status !== 'active')
      .map(({recordId, assetId, file: assetFile, sha256, lifecycle}) => ({
        recordId,
        assetId,
        file: assetFile,
        sha256,
        lifecycle,
      })),
    assets: inspectedAssets,
    composites: inspectedComposites,
  };
  if (write) await writeJson(file, report);
  return {file, ...summarizeQualityReport(report)};
};

export const recordQualityReviews = async ({slug, reviews}) => {
  if (!Array.isArray(reviews) || reviews.length === 0) throw new Error('批量质量记录必须包含至少一项 review。');
  const prepared = await prepareQualityReport(slug, {write: false});
  const entries = [...prepared.report.assets, ...prepared.report.composites];
  const normalized = [];
  const reviewedIds = new Set();
  for (const review of reviews) {
    const reviewId = review.assetId ?? review.compositeId;
    const entry = entries.find((candidate) => (candidate.assetId ?? candidate.compositeId) === reviewId);
    if (!entry) throw new Error(`未知质量对象：${reviewId}`);
    if (reviewedIds.has(reviewId)) throw new Error(`批量质量记录不能重复包含对象：${reviewId}`);
    reviewedIds.add(reviewId);
    if (!review.reviewer?.trim()) throw new Error(`${reviewId} 的质量记录必须提供 reviewer。`);
    const passedChecks = review.passedChecks ?? [];
    const failedChecks = review.failedChecks ?? [];
    for (const check of [...passedChecks, ...failedChecks]) {
      if (!QUALITY_CHECKS.includes(check)) throw new Error(`未知质量检查：${check}`);
      if (!entry.requiredChecks.includes(check)) throw new Error(`${reviewId} 不需要质量检查 ${check}。`);
    }
    const evidenceFiles = [];
    if (review.evidenceFiles === undefined) {
      for (const evidence of entry.evidenceFiles ?? []) {
        if (await evidenceFilesAreCurrent([evidence])) evidenceFiles.push(evidence);
      }
    } else {
      for (const evidenceFile of review.evidenceFiles) {
        if (typeof evidenceFile !== 'string' || evidenceFile.trim().length === 0) throw new Error(`${reviewId} 的 evidenceFiles 必须是非空路径。`);
        const absoluteFile = assertWorkspaceFile(evidenceFile.trim());
        if (!(await fileExists(absoluteFile))) throw new Error(`${reviewId} 的质量证据不存在：${evidenceFile}`);
        evidenceFiles.push({file: path.relative(ROOT, absoluteFile), sha256: await hashFile(absoluteFile)});
      }
    }
    if (passedChecks.some((check) => EVIDENCE_REQUIRED_CHECKS.has(check)) && evidenceFiles.length === 0) {
      throw new Error(`${reviewId} 的证据型质量检查必须提供 evidenceFiles。`);
    }
    normalized.push({entry, reviewId, reviewer: review.reviewer.trim(), passedChecks, failedChecks, note: (review.note ?? '').trim(), evidenceFiles});
  }
  const changedIds = [];
  for (const item of normalized) {
    for (const check of item.passedChecks) item.entry.semanticChecks[check] = 'passed';
    for (const check of item.failedChecks) item.entry.semanticChecks[check] = 'failed';
    item.entry.status = entryStatus(item.entry);
    item.entry.reviewer = item.reviewer;
    item.entry.reviewedAt = new Date().toISOString();
    item.entry.note = item.note;
    if (item.evidenceFiles.length > 0) item.entry.evidenceFiles = item.evidenceFiles;
    changedIds.push(item.reviewId);
  }
  prepared.report.updatedAt = new Date().toISOString();
  await writeJson(prepared.file, prepared.report);
  return {file: prepared.file, changedIds, changedAssets: changedIds.filter((id) => prepared.report.assets.some(({assetId}) => assetId === id)), changedComposites: changedIds.filter((id) => prepared.report.composites.some(({compositeId}) => compositeId === id)), ...summarizeQualityReport(prepared.report)};
};

export const recordQualityReview = async (review) => recordQualityReviews({slug: review.slug, reviews: [review]});

export const assertQualityReady = async (slug) => {
  const status = await prepareQualityReport(slug);
  if (!status.ready) {
    const unresolved = [...status.report.assets, ...status.report.composites]
      .filter(({status: entryStatusValue}) => entryStatusValue !== 'passed')
      .map((entry) => `${entry.assetId ?? entry.compositeId} (${entry.status})`)
      .join(', ');
    throw new Error(`资产与组合质量门未通过：${unresolved}。运行 project:quality 查看或记录检查。`);
  }
  return status;
};

export const readQualityReportStatus = async (slug) => {
  const file = qualityReportPath(slug);
  const report = await readJson(file);
  return {file, ...summarizeQualityReport(report)};
};

const proofEvidenceFiles = (proofFrame) =>
  [proofFrame?.fullFrame, proofFrame?.crop, proofFrame?.debugFrame].filter(Boolean);

const assetEvidenceFiles = (entry) =>
  [
    entry?.alphaMask,
    entry?.checkerboard,
    entry?.tightCrop,
    entry?.motionStress,
    entry?.alphaBandReport,
    entry?.alphaBandOverlay,
  ]
    .filter(Boolean);

export const createQualityReviewScaffold = ({
  status,
  projectSlug,
  reviewer,
  compositionProof = null,
  styleProof = null,
  includePassed = false,
}) => {
  const proofReports = [compositionProof, styleProof].filter(Boolean);
  const proofComposites = proofReports.flatMap((report) => report.composites ?? []);
  const proofAssets = proofReports.flatMap((report) => report.assetEvidence ?? []);
  const evidenceForAsset = (asset) => {
    const files = [asset.file];
    const normalizedAssetFile = path.normalize(asset.file);
    for (const entry of proofAssets) {
      const sourceFile = entry.source
        ? path.relative(ROOT, resolvePublicFile(entry.source))
        : null;
      if (sourceFile && path.normalize(sourceFile) === normalizedAssetFile) {
        files.push(...assetEvidenceFiles(entry));
      }
    }
    const sourceBindings = (asset.sources ?? [])
      .map((source) => source.match(/^scene:([^:]+):node:(.+)$/))
      .filter(Boolean)
      .map((match) => ({sceneId: match[1], nodeId: match[2]}));
    for (const composite of status.report.composites ?? []) {
      if (!(composite.memberNodeIds ?? []).some((nodeId) =>
        sourceBindings.some((binding) => binding.nodeId === nodeId),
      )) continue;
      const proof = proofComposites.find(({compositeId}) =>
        compositeId === composite.compositeId,
      );
      files.push(...(proof?.proofFrames ?? []).flatMap(proofEvidenceFiles));
    }
    return [...new Set(files.filter(Boolean))];
  };
  const evidenceForComposite = (composite) => {
    const proof = proofComposites.find(({compositeId}) =>
      compositeId === composite.compositeId,
    );
    const files = (proof?.proofFrames ?? []).flatMap(proofEvidenceFiles);
    for (const nodeId of composite.memberNodeIds ?? []) {
      for (const entry of proofAssets.filter((candidate) => candidate.nodeId === nodeId)) {
        files.push(...assetEvidenceFiles(entry));
      }
    }
    return [...new Set(files.filter(Boolean))];
  };
  const entries = [...status.report.assets, ...status.report.composites]
    .filter((entry) => includePassed || entry.status !== 'passed');
  return {
    schemaVersion: 1,
    projectSlug,
    generatedAt: new Date().toISOString(),
    instructions:
      'Inspect every evidence file. Move each pending check into passedChecks or failedChecks and write a concrete note; never pass a check only to unblock production.',
    reviews: entries.map((entry) => {
      const assetId = entry.assetId ?? null;
      const compositeId = entry.compositeId ?? null;
      return {
        ...(assetId ? {assetId} : {compositeId}),
        reviewer,
        requiredChecks: entry.requiredChecks,
        pendingChecks: Object.entries(entry.semanticChecks)
          .filter(([, checkStatus]) => checkStatus !== 'passed')
          .map(([check]) => check),
        passedChecks: [],
        failedChecks: [],
        evidenceFiles: assetId
          ? [...new Set([...evidenceForAsset(entry), ...(entry.recoveryEvidenceFiles ?? [])])]
          : evidenceForComposite(entry),
        note: '',
      };
    }),
  };
};

export const buildQualityReviewScaffold = async ({
  slug,
  reviewer = 'host-vision',
  includePassed = false,
}) => {
  const status = await prepareQualityReport(slug);
  const compositionFile = compositionProofReportPath(slug);
  const styleFile = path.join(ROOT, 'dist', slug, 'style-motion-proof.json');
  const [compositionProof, styleProof] = await Promise.all([
    (await fileExists(compositionFile)) ? readJson(compositionFile) : null,
    (await fileExists(styleFile)) ? readJson(styleFile) : null,
  ]);
  const scaffold = createQualityReviewScaffold({
    status,
    projectSlug: slug,
    reviewer,
    compositionProof,
    styleProof,
    includePassed,
  });
  for (const review of scaffold.reviews) {
    review.evidenceFiles = (
      await Promise.all(review.evidenceFiles.map(async (file) => {
        try {
          return (await fileExists(assertWorkspaceFile(file))) ? file : null;
        } catch {
          return null;
        }
      }))
    ).filter(Boolean);
    const reviewId = review.assetId ?? review.compositeId;
    const entry = [...status.report.assets, ...status.report.composites]
      .find((candidate) => (candidate.assetId ?? candidate.compositeId) === reviewId);
    if (entry) {
      entry.evidenceFiles = await Promise.all(review.evidenceFiles.map(async (file) => ({
        file,
        sha256: await hashFile(assertWorkspaceFile(file)),
      })));
    }
  }
  status.report.updatedAt = new Date().toISOString();
  await writeJson(status.file, status.report);
  return {status, scaffold};
};

export const formatQualityStatus = (status) => `${status.ready ? '✓' : '✗'} quality: ${status.passed}/${status.total} passed, ${status.pending} pending, ${status.failed} failed (assets ${status.scopes.assets.passed}/${status.scopes.assets.total}, composites ${status.scopes.composites.passed}/${status.scopes.composites.total})`;
