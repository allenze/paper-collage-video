import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  assertAssetManifest,
  createAssetRecordId,
} from './asset-manifest-lib.mjs';
import {removeChromaKey} from './chroma-key-lib.mjs';
import {hashCompositionValue} from './composition-lib.mjs';
import {resolveWorldStripTileGeometry} from '../src/worldStrip.mjs';

export const LOOPING_STRIP_RECOVERY_POLICY = {
  strategy: 'preserve-complete-strip-context',
  localDeterministicFixFirst: true,
  isolatedEdgeGeneration: 'forbidden',
  providerRepair: 'masked-complete-strip-edit',
  fallback: 'full-strip-regeneration',
};

const PROFILES = ['16:9', '9:16', '1:1'];
const ROLES = ['far', 'mid', 'ground', 'near'];
const STRATEGIES = ['exact', 'overlap-crop', 'mirror-crop'];
const GROUND_MINIMUM_EDGE_ALPHA_COVERAGE = 0.05;
const MIRROR_CROP_RENDER_TOLERANCE = {
  rgbMean: 0.01,
  rgbMaximum: 0.2,
  alphaMean: 0.002,
  alphaMaximum: 0.2,
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};
const sameValue = (left, right) =>
  JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sha256File = async (file) => sha256(await fs.readFile(file));
const posixRelative = (root, file) => path.relative(root, file).split(path.sep).join('/');

const DEFAULT_SOURCE_SURFACE = {mode: 'opaque'};
const validKeyColor = (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const sourceSurfaceFor = (spec) => spec?.sourceSurface ?? DEFAULT_SOURCE_SURFACE;
const sameKeyColor = (left, right) => left?.toLowerCase() === right?.toLowerCase();
const thresholdsForRenderScale = (spec) =>
  spec.seamStrategy === 'mirror-crop'
    ? Object.fromEntries(
      Object.entries(spec.thresholds).map(([key, value]) => [
        key,
        Math.max(value, MIRROR_CROP_RENDER_TOLERANCE[key]),
      ]),
    )
    : spec.thresholds;

const validateChromaKeying = (keying) => {
  if (!isObject(keying)) return '色键 sourceSurface 必须声明 keying';
  if (!validKeyColor(keying.keyColor)) return '色键 keying.keyColor 必须是 #RRGGBB';
  if (!(Number.isFinite(keying.transparentThreshold) && keying.transparentThreshold >= 0 && keying.transparentThreshold <= 255)) {
    return '色键 keying.transparentThreshold 必须位于 0..255';
  }
  if (!(Number.isFinite(keying.opaqueThreshold) && keying.opaqueThreshold > keying.transparentThreshold && keying.opaqueThreshold <= 255)) {
    return '色键 keying.opaqueThreshold 必须大于 transparentThreshold 且不超过 255';
  }
  if (!(Number.isFinite(keying.edgeFeather) && keying.edgeFeather >= 0 && keying.edgeFeather <= 8)) {
    return '色键 keying.edgeFeather 必须位于 0..8';
  }
  if (!(Number.isInteger(keying.matteErode) && keying.matteErode >= 0 && keying.matteErode <= 8)) {
    return '色键 keying.matteErode 必须是 0..8 的整数';
  }
  if (!(Number.isInteger(keying.edgePadding) && keying.edgePadding >= 0 && keying.edgePadding <= 64)) {
    return '色键 keying.edgePadding 必须是 0..64 的整数';
  }
  return null;
};

const validRect = (rect) =>
  isObject(rect) &&
  Number.isInteger(rect.left) &&
  rect.left >= 0 &&
  Number.isInteger(rect.top) &&
  rect.top >= 0 &&
  Number.isInteger(rect.width) &&
  rect.width > 0 &&
  Number.isInteger(rect.height) &&
  rect.height > 0;

const resolveInside = (root, input, label) => {
  const resolved = path.resolve(root, input);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label}越过工作区：${input}`);
  }
  return resolved;
};

export const validateLoopingStripSpec = (spec) => {
  const errors = [];
  if (spec?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  for (const field of ['projectSlug', 'sceneId', 'groupId', 'nodeId', 'stripId', 'assetId', 'sourceAssetId', 'output']) {
    if (!nonEmpty(spec?.[field])) errors.push(`${field} 不能为空`);
  }
  if (!slugPattern.test(spec?.projectSlug ?? '')) errors.push('projectSlug 格式无效');
  if (!ROLES.includes(spec?.role)) errors.push('role 必须是 far、mid、ground 或 near');
  if (spec?.axis !== 'x') errors.push('Phase 2.5 只支持 axis=x');
  if (!STRATEGIES.includes(spec?.seamStrategy)) errors.push('seamStrategy 必须是 exact、overlap-crop 或 mirror-crop');
  if (!validRect(spec?.canonicalTile)) errors.push('canonicalTile 必须是正整数像素矩形');
  if (!(Number.isInteger(spec?.edgeBandPixels) && spec.edgeBandPixels >= 1 && spec.edgeBandPixels <= 128)) {
    errors.push('edgeBandPixels 必须是 1..128 的整数');
  }
  for (const key of ['rgbMean', 'rgbMaximum', 'alphaMean', 'alphaMaximum']) {
    const value = spec?.thresholds?.[key];
    if (!(Number.isFinite(value) && value >= 0 && value <= 1)) errors.push(`thresholds.${key} 必须位于 0..1`);
  }
  if (!(Number.isFinite(spec?.minimumViewportSpan) && spec.minimumViewportSpan >= 1)) {
    errors.push('minimumViewportSpan 必须至少为 1');
  }
  if (
    !Array.isArray(spec?.proofViewports) ||
    spec.proofViewports.length !== 3 ||
    new Set(spec.proofViewports.map(({profile}) => profile)).size !== 3
  ) {
    errors.push('proofViewports 必须恰好覆盖 16:9、9:16、1:1');
  }
  for (const profile of PROFILES) {
    const viewport = spec?.proofViewports?.find((candidate) => candidate.profile === profile);
    if (
      !viewport ||
      ![viewport.width, viewport.height, viewport.renderHeight].every(
        (value) => Number.isInteger(value) && value > 0,
      )
    ) {
      errors.push(`proofViewports 缺少有效 ${profile} 画幅`);
    }
  }
  if (!sameValue(spec?.recoveryPolicy, LOOPING_STRIP_RECOVERY_POLICY)) {
    errors.push('recoveryPolicy 必须保持完整条带上下文，禁止 isolated edge generation');
  }
  const sourceSurface = sourceSurfaceFor(spec);
  if (!isObject(sourceSurface) || !['opaque', 'chroma-key'].includes(sourceSurface.mode)) {
    errors.push('sourceSurface 必须是 opaque 或 chroma-key');
  } else if (sourceSurface.mode === 'chroma-key') {
    if (!validKeyColor(sourceSurface.keyColor)) {
      errors.push('chroma-key sourceSurface 必须声明 #RRGGBB keyColor');
    }
    const keyingError = validateChromaKeying(spec?.keying);
    if (keyingError) errors.push(keyingError);
    if (spec?.keying && !sameKeyColor(sourceSurface.keyColor, spec.keying.keyColor)) {
      errors.push('sourceSurface.keyColor 必须与 keying.keyColor 一致');
    }
  } else if (spec?.keying !== undefined) {
    errors.push('opaque sourceSurface 不能声明 keying');
  }
  if (typeof spec?.applyToProject !== 'boolean') errors.push('applyToProject 必须是 boolean');
  return errors;
};

const rawRgba = async (input) => {
  const {data, info} = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  return {data, width: info.width, height: info.height, channels: info.channels};
};

export const compareHorizontalEdgeBands = async (
  input,
  edgeBandPixels,
  {mirrorRight = false} = {},
) => {
  const {data, width, height, channels} = await rawRgba(input);
  const band = Math.min(edgeBandPixels, Math.floor(width / 2));
  if (band < 1) throw new Error('条带过窄，无法比较左右边缘。');
  let rgbTotal = 0;
  let alphaTotal = 0;
  let rgbMaximum = 0;
  let alphaMaximum = 0;
  const pixelRgbDifferences = new Uint8Array(band * height);
  const pixelAlphaDifferences = new Uint8Array(band * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < band; x += 1) {
      const leftOffset = (y * width + x) * channels;
      // mirror-crop repeats through a reflected edge: the last pixel of the
      // current tile meets the first pixel of the next one. Compare the right
      // edge in that reflected orientation, otherwise a texture gradient is
      // incorrectly reported as a seam even though its rendered join is
      // continuous.
      const rightX = mirrorRight ? width - 1 - x : width - band + x;
      const rightOffset = (y * width + rightX) * channels;
      // Compare premultiplied colour. PNG RGB values in transparent pixels are
      // not visible and must not turn a harmless resampling fringe into a
      // false red/green/blue seam failure.
      const leftAlpha = data[leftOffset + 3] / 255;
      const rightAlpha = data[rightOffset + 3] / 255;
      const red = Math.abs(data[leftOffset] * leftAlpha - data[rightOffset] * rightAlpha);
      const green = Math.abs(data[leftOffset + 1] * leftAlpha - data[rightOffset + 1] * rightAlpha);
      const blue = Math.abs(data[leftOffset + 2] * leftAlpha - data[rightOffset + 2] * rightAlpha);
      const alpha = Math.abs(data[leftOffset + 3] - data[rightOffset + 3]);
      const rgb = Math.max(red, green, blue);
      const pixel = y * band + x;
      pixelRgbDifferences[pixel] = rgb;
      pixelAlphaDifferences[pixel] = alpha;
      rgbTotal += (red + green + blue) / 3;
      alphaTotal += alpha;
      rgbMaximum = Math.max(rgbMaximum, rgb);
      alphaMaximum = Math.max(alphaMaximum, alpha);
    }
  }
  const pixelCount = band * height;
  return {
    width,
    height,
    bandPixels: band,
    rgbMean: rgbTotal / pixelCount / 255,
    rgbMaximum: rgbMaximum / 255,
    alphaMean: alphaTotal / pixelCount / 255,
    alphaMaximum: alphaMaximum / 255,
    pixelRgbDifferences,
    pixelAlphaDifferences,
  };
};

// A strip can have a perfectly matching transparent left/right margin while
// still exposing a large hole whenever tiles repeat. That is harmless for a
// decorative overlay, but it is invalid for the ground that carries a route.
// Measure the actual alpha support at both repeat boundaries rather than only
// comparing the two boundaries to one another.
export const inspectHorizontalEdgeAlphaCoverage = async (input, edgeBandPixels) => {
  const {data, width, height, channels} = await rawRgba(input);
  const band = Math.min(edgeBandPixels, Math.floor(width / 2));
  if (band < 1) throw new Error('条带过窄，无法检查 ground repeat edge。');
  const coverageFor = (left) => {
    let total = 0;
    for (let y = 0; y < height; y += 1) {
      for (let index = 0; index < band; index += 1) {
        const x = left ? index : width - band + index;
        total += data[(y * width + x) * channels + 3] / 255;
      }
    }
    return total / (band * height);
  };
  const left = coverageFor(true);
  const right = coverageFor(false);
  return {
    bandPixels: band,
    left,
    right,
    minimum: Math.min(left, right),
  };
};

const deriveTileBuffer = async ({sourceBuffer, spec}) => {
  const canonical = await sharp(sourceBuffer).extract(spec.canonicalTile).png().toBuffer();
  if (spec.seamStrategy !== 'mirror-crop') return canonical;
  const metadata = await sharp(canonical).metadata();
  const mirrored = await sharp(canonical).flop().png().toBuffer();
  return sharp({
    create: {
      width: metadata.width * 2,
      height: metadata.height,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite([
      {input: canonical, left: 0, top: 0},
      {input: mirrored, left: metadata.width, top: 0},
    ])
    .png()
    .toBuffer();
};

export const edgeMetricsPass = (metrics, thresholds) =>
  metrics.rgbMean <= thresholds.rgbMean + 1e-12 &&
  metrics.rgbMaximum <= thresholds.rgbMaximum + 1e-12 &&
  metrics.alphaMean <= thresholds.alphaMean + 1e-12 &&
  metrics.alphaMaximum <= thresholds.alphaMaximum + 1e-12;

const publicBindingPath = (root, file) => {
  const publicRoot = path.join(root, 'public');
  if (file !== publicRoot && !file.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error(`looping strip output 必须位于 public/：${file}`);
  }
  return posixRelative(publicRoot, file);
};

const writeEvidence = async ({
  tileBuffer,
  sourceMetrics,
  evidenceDirectory,
  stripId,
  mirrorRight = false,
}) => {
  await fs.mkdir(evidenceDirectory, {recursive: true});
  const tile = sharp(tileBuffer);
  const metadata = await tile.metadata();
  const band = sourceMetrics.bandPixels;
  const left = await sharp(tileBuffer).extract({left: 0, top: 0, width: band, height: metadata.height}).png().toBuffer();
  const rightRaw = await sharp(tileBuffer).extract({left: metadata.width - band, top: 0, width: band, height: metadata.height}).png().toBuffer();
  const right = mirrorRight ? await sharp(rightRaw).flop().png().toBuffer() : rightRaw;
  const comparisonFile = path.join(evidenceDirectory, `${stripId}-edge-comparison.png`);
  const stitchFile = path.join(evidenceDirectory, `${stripId}-three-tile-stitch.png`);
  const rgbHeatmapFile = path.join(evidenceDirectory, `${stripId}-rgb-heatmap.png`);
  const alphaHeatmapFile = path.join(evidenceDirectory, `${stripId}-alpha-heatmap.png`);
  const divider = await sharp({
    create: {width: 2, height: metadata.height, channels: 4, background: '#ffcc00'},
  }).png().toBuffer();
  await sharp({
    create: {
      width: band * 2 + 2,
      height: metadata.height,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  }).composite([
    {input: left, left: 0, top: 0},
    {input: divider, left: band, top: 0},
    {input: right, left: band + 2, top: 0},
  ]).png().toFile(comparisonFile);
  await sharp({
    create: {
      width: metadata.width * 3,
      height: metadata.height,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  }).composite([
    {input: tileBuffer, left: 0, top: 0},
    {input: tileBuffer, left: metadata.width, top: 0},
    {input: tileBuffer, left: metadata.width * 2, top: 0},
  ]).png().toFile(stitchFile);
  const heatmap = async (values, color, output) => {
    const rgba = Buffer.alloc(band * metadata.height * 4);
    for (let index = 0; index < values.length; index += 1) {
      const offset = index * 4;
      rgba[offset] = color === 'rgb' ? values[index] : 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = color === 'alpha' ? values[index] : 0;
      rgba[offset + 3] = 255;
    }
    await sharp(rgba, {raw: {width: band, height: metadata.height, channels: 4}})
      .resize({width: Math.max(64, band * 8), height: metadata.height, kernel: 'nearest'})
      .png()
      .toFile(output);
  };
  await Promise.all([
    heatmap(sourceMetrics.pixelRgbDifferences, 'rgb', rgbHeatmapFile),
    heatmap(sourceMetrics.pixelAlphaDifferences, 'alpha', alphaHeatmapFile),
  ]);
  return {comparisonFile, stitchFile, rgbHeatmapFile, alphaHeatmapFile};
};

export const deriveLoopingStrip = async ({
  root,
  spec,
  manifest: manifestInput,
}) => {
  const errors = validateLoopingStripSpec(spec);
  if (errors.length > 0) throw new Error(errors.join('；'));
  const manifest = assertAssetManifest(structuredClone(manifestInput), spec.projectSlug);
  const sourceRecord = manifest.assets.find(
    (record) =>
      record.assetId === spec.sourceAssetId &&
      ['active', 'recovery-source'].includes(record.lifecycle?.status),
  );
  if (!sourceRecord) {
    throw new Error(`找不到 active 或 recovery-source source asset：${spec.sourceAssetId}`);
  }
  const sourceFile = resolveInside(root, sourceRecord.file, 'source asset');
  const outputFile = resolveInside(root, spec.output, 'looping strip output');
  const sourceSurface = sourceSurfaceFor(spec);
  const sourceRequestSurface = sourceRecord.request?.outputSurface ?? null;
  if (
    sourceSurface.mode === 'chroma-key' &&
    (
      sourceRequestSurface?.mode !== 'chroma-key' ||
      !sameKeyColor(sourceRequestSurface.keyColor, sourceSurface.keyColor)
    )
  ) {
    throw new Error(
      `source asset ${spec.sourceAssetId} 必须保留匹配的 provider chroma-key provenance`,
    );
  }
  let sourceBuffer = await fs.readFile(sourceFile);
  let keyingMetadata = null;
  if (sourceSurface.mode === 'chroma-key') {
    ({buffer: sourceBuffer, metadata: keyingMetadata} = await removeChromaKey({
      input: sourceFile,
      ...spec.keying,
    }));
  }
  const sourceMetadata = await sharp(sourceBuffer).metadata();
  if (
    spec.canonicalTile.left + spec.canonicalTile.width > sourceMetadata.width ||
    spec.canonicalTile.top + spec.canonicalTile.height > sourceMetadata.height
  ) {
    throw new Error('canonicalTile 越过 source dimensions。');
  }
  const sourceSha256 = await sha256File(sourceFile);
  if (sourceRecord.sha256 !== sourceSha256) {
    throw new Error(`source asset ${spec.sourceAssetId} SHA 已变化；请先重新登记来源。`);
  }
  const tileBuffer = await deriveTileBuffer({sourceBuffer, spec});
  const tileMetadata = await sharp(tileBuffer).metadata();
  const mirrorRight = spec.seamStrategy === 'mirror-crop';
  const sourceMetrics = await compareHorizontalEdgeBands(
    tileBuffer,
    spec.edgeBandPixels,
    {mirrorRight},
  );
  const sourceEdgeAlphaCoverage = await inspectHorizontalEdgeAlphaCoverage(
    tileBuffer,
    spec.edgeBandPixels,
  );
  const sourcePassed = edgeMetricsPass(sourceMetrics, spec.thresholds);
  const sourceGroundEdgePassed =
    spec.role !== 'ground' ||
    sourceEdgeAlphaCoverage.minimum + 1e-12 >= GROUND_MINIMUM_EDGE_ALPHA_COVERAGE;
  const renderScaleThresholds = thresholdsForRenderScale(spec);
  const renderScale = [];
  for (const viewport of spec.proofViewports) {
    const scaled = await sharp(tileBuffer).resize({height: viewport.renderHeight}).png().toBuffer();
    const scaledBand = Math.max(1, Math.round(spec.edgeBandPixels * viewport.renderHeight / tileMetadata.height));
    const metrics = await compareHorizontalEdgeBands(scaled, scaledBand, {mirrorRight});
    const geometry = resolveWorldStripTileGeometry({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      renderHeight: viewport.renderHeight,
      sourceWidth: tileMetadata.width,
      sourceHeight: tileMetadata.height,
    });
    renderScale.push({
      profile: viewport.profile,
      viewport,
      viewportSpan: geometry.viewportSpan,
      copyCount: geometry.copyCount,
      metrics: {
        rgbMean: metrics.rgbMean,
        rgbMaximum: metrics.rgbMaximum,
        alphaMean: metrics.alphaMean,
        alphaMaximum: metrics.alphaMaximum,
        bandPixels: metrics.bandPixels,
      },
      edgeAlphaCoverage: await inspectHorizontalEdgeAlphaCoverage(scaled, scaledBand),
      thresholds: renderScaleThresholds,
      seamPassed: edgeMetricsPass(metrics, renderScaleThresholds),
      spanPassed: geometry.viewportSpan + 1e-9 >= spec.minimumViewportSpan,
    });
  }
  const derivationFingerprint = hashCompositionValue({
    schemaVersion: 1,
    sourceAssetId: spec.sourceAssetId,
    sourceSha256,
    role: spec.role,
    axis: spec.axis,
    seamStrategy: spec.seamStrategy,
    canonicalTile: spec.canonicalTile,
    edgeBandPixels: spec.edgeBandPixels,
    thresholds: spec.thresholds,
    renderScaleThresholds,
    minimumViewportSpan: spec.minimumViewportSpan,
    proofViewports: spec.proofViewports,
    recoveryPolicy: spec.recoveryPolicy,
    sourceSurface,
    keying: spec.keying ?? null,
  });
  if (
    !sourcePassed ||
    !sourceGroundEdgePassed ||
    renderScale.some(({seamPassed, spanPassed, edgeAlphaCoverage}) =>
      !seamPassed ||
      !spanPassed ||
      (spec.role === 'ground' && edgeAlphaCoverage.minimum + 1e-12 < GROUND_MINIMUM_EDGE_ALPHA_COVERAGE),
    )
  ) {
    const failed = [
      ...(sourcePassed ? [] : ['source-resolution seam']),
      ...(sourceGroundEdgePassed ? [] : ['source-resolution ground edge alpha coverage']),
      ...renderScale.filter(({seamPassed}) => !seamPassed).map(({profile}) => `${profile} render-scale seam`),
      ...renderScale.filter(({spanPassed}) => !spanPassed).map(({profile}) => `${profile} viewport span`),
      ...renderScale
        .filter(({edgeAlphaCoverage}) =>
          spec.role === 'ground' && edgeAlphaCoverage.minimum + 1e-12 < GROUND_MINIMUM_EDGE_ALPHA_COVERAGE,
        )
        .map(({profile}) => `${profile} ground edge alpha coverage`),
    ];
    throw new Error(`looping strip proof 未通过：${failed.join('、')}`);
  }
  await fs.mkdir(path.dirname(outputFile), {recursive: true});
  await fs.writeFile(outputFile, tileBuffer);
  const outputSha256 = await sha256File(outputFile);
  const outputMetadata = await sharp(outputFile).metadata();
  const keyingMetadataFile = sourceSurface.mode === 'chroma-key'
    ? `${outputFile}.key.json`
    : null;
  const keyingRecord = keyingMetadataFile
    ? {
      schemaVersion: 1,
      sourceAssetId: spec.sourceAssetId,
      sourceSha256,
      sourceSurface,
      keying: spec.keying,
      outputSha256,
      ...keyingMetadata,
    }
    : null;
  if (keyingMetadataFile) {
    await fs.writeFile(keyingMetadataFile, `${JSON.stringify(keyingRecord, null, 2)}\n`);
  }
  const keyingMetadataSha256 = keyingRecord
    ? sha256(JSON.stringify(keyingRecord))
    : null;
  const binding = {
    schemaVersion: 1,
    stripId: spec.stripId,
    role: spec.role,
    sourceAssetId: spec.sourceAssetId,
    axis: 'x',
    seamStrategy: spec.seamStrategy,
    source: {
      sha256: sourceSha256,
      width: sourceMetadata.width,
      height: sourceMetadata.height,
      provider: sourceRecord.provider,
      adapter: sourceRecord.adapter,
      recordId: sourceRecord.recordId,
      surface: sourceSurface,
      keying: spec.keying ?? null,
      keyingMetadataSha256,
    },
    canonicalTile: spec.canonicalTile,
    output: {
      width: outputMetadata.width,
      height: outputMetadata.height,
      hasAlpha: Boolean(outputMetadata.hasAlpha),
    },
    minimumViewportSpan: spec.minimumViewportSpan,
    edgeBandPixels: spec.edgeBandPixels,
    derivationFingerprint,
  };
  const recordedAt = new Date().toISOString();
  const record = {
    recordId: createAssetRecordId({
      assetId: spec.assetId,
      requestFingerprint: derivationFingerprint,
      sha256: outputSha256,
      recordedAt,
    }),
    assetId: spec.assetId,
    capability: 'image',
    file: posixRelative(root, outputFile),
    provider: sourceRecord.provider,
    adapter: 'looping-strip-derivative',
    tool: null,
    model: sourceRecord.model ?? null,
    externalId: null,
    attemptId: null,
    recoveredFromClosedAttempt: false,
    recoveredFromRejectedAttempt: false,
    requestFingerprint: derivationFingerprint,
    reusedFrom: sourceRecord.recordId,
    sha256: outputSha256,
    sizeBytes: (await fs.stat(outputFile)).size,
    media: {
      width: outputMetadata.width,
      height: outputMetadata.height,
      format: outputMetadata.format ?? 'png',
      hasAlpha: Boolean(outputMetadata.hasAlpha),
    },
    recordedAt,
    request: {
      capability: 'image',
      derivation: 'looping-strip',
      sourceAssetId: spec.sourceAssetId,
      canonicalTile: spec.canonicalTile,
      seamStrategy: spec.seamStrategy,
      sourceSurface,
      keying: spec.keying ?? null,
    },
    compositionBinding: {
      sceneId: spec.sceneId,
      nodeId: spec.nodeId,
      pattern: 'looping-environment',
      outputRole: spec.role,
      derivation: {method: 'crop', parentAssetId: spec.sourceAssetId},
    },
    loopingStripBinding: binding,
    familyFingerprint: derivationFingerprint,
    lifecycle: {
      status: 'active',
      changedAt: recordedAt,
      reason: 'deterministic looping strip derivation passed seam and viewport-span proof',
      supersededBy: null,
    },
  };
  for (const prior of manifest.assets.filter(
    (candidate) => candidate.assetId === spec.assetId && candidate.lifecycle?.status === 'active',
  )) {
    prior.lifecycle = {
      status: 'superseded',
      changedAt: recordedAt,
      reason: 'replaced by current looping strip derivation',
      supersededBy: record.recordId,
    };
  }
  manifest.assets.push(record);
  const evidenceDirectory = path.join(root, 'dist', spec.projectSlug, 'looping-strip', 'evidence');
  const evidence = await writeEvidence({
    tileBuffer,
    sourceMetrics,
    evidenceDirectory,
    stripId: spec.stripId,
    mirrorRight,
  });
  return {
    manifest,
    record,
    binding,
    report: {
      schemaVersion: 1,
      stripId: spec.stripId,
      assetId: spec.assetId,
      sourceAssetId: spec.sourceAssetId,
      sourceSha256,
      outputSha256,
      providerImageCalls: 0,
      localDerivatives: 1,
      avoidedCalls: 1,
      seamStrategy: spec.seamStrategy,
      sourceSurface,
      keyingMetadataSha256,
      thresholds: spec.thresholds,
      renderScaleThresholds,
      sourceMetrics: {
        rgbMean: sourceMetrics.rgbMean,
        rgbMaximum: sourceMetrics.rgbMaximum,
        alphaMean: sourceMetrics.alphaMean,
        alphaMaximum: sourceMetrics.alphaMaximum,
        bandPixels: sourceMetrics.bandPixels,
      },
      sourceEdgeAlphaCoverage,
      groundMinimumEdgeAlphaCoverage:
        spec.role === 'ground' ? GROUND_MINIMUM_EDGE_ALPHA_COVERAGE : null,
      renderScale,
      evidence: Object.fromEntries(
        Object.entries(evidence).map(([key, file]) => [key, posixRelative(root, file)]),
      ),
      derivationFingerprint,
      passed: true,
    },
    publicSrc: publicBindingPath(root, outputFile),
  };
};

export const applyLoopingStripToProject = ({
  project,
  spec,
  record,
}) => {
  const scene = (project.scenes ?? []).find(({id}) => id === spec.sceneId);
  if (!scene) throw new Error(`project 缺少 scene ${spec.sceneId}`);
  const walk = (nodes = []) => {
    for (const node of nodes) {
      if (node.id === spec.groupId && node.kind === 'group') return node;
      if (node.kind === 'group') {
        const match = walk(node.children ?? []);
        if (match) return match;
      }
    }
    return null;
  };
  const group = walk(scene.composition?.nodes ?? []);
  if (!group || group.pattern !== 'looping-environment') {
    throw new Error(`project 缺少 looping-environment group ${spec.groupId}`);
  }
  const node = (group.children ?? []).find(
    (candidate) => candidate.id === spec.nodeId && candidate.kind === 'world-strip',
  );
  if (!node) throw new Error(`group ${spec.groupId} 缺少 world-strip ${spec.nodeId}`);
  if (node.role !== spec.role) throw new Error(`${spec.nodeId} role 与 derivation spec 不一致`);
  node.src = path.normalize(record.file)
    .slice(`public${path.sep}`.length)
    .split(path.sep)
    .join('/');
  node.loopingStripBinding = record.loopingStripBinding;
  return project;
};
