import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const manifestFile = path.join(import.meta.dirname, 'assets-manifest.json');
const publicRoot = path.join(root, 'public/projects/zhuang-zhou-meng-die/assets');

const sha256 = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');

const writeFullCanvasCopy = async (input, output) => {
  await fs.mkdir(path.dirname(output), {recursive: true});
  const {data, info} = await sharp(input).resize(1920, 1080, {fit: 'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  await sharp(data, {raw: info}).png().toFile(output);
};

const writeRegisteredSubject = async ({input, output, width, left, top}) => {
  const subject = await sharp(input).resize({width}).png().toBuffer();
  await fs.mkdir(path.dirname(output), {recursive: true});
  await sharp({create: {width: 1920, height: 1080, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite([{input: subject, left, top}])
    .png()
    .toFile(output);
};

const writeFrontOverlay = async ({input, output, left, top, width, height, mode}) => {
  const {data, info} = await sharp(input).resize(1920, 1080, {fit: 'fill'}).extract({left, top, width, height}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const clamp = (value) => Math.max(0, Math.min(1, value));
      const colorOpacity = mode === 'room'
        ? clamp((145 - luma) / 40)
        : Math.max(clamp((205 - luma) / 55), clamp((chroma - 8) / 38));
      const canvasX = left + x;
      const canvasY = top + y;
      const flowerDistance = Math.sqrt(
        ((canvasX - 1430) / 460) ** 2 +
        ((canvasY - 800) / 255) ** 2,
      );
      const spatialOpacity = mode === 'flower' ? clamp((1 - flowerDistance) / 0.12) : 1;
      const opacity = colorOpacity * spatialOpacity;
      data[index + 3] = opacity < 0.08 ? 0 : Math.round(data[index + 3] * opacity);
    }
  }
  const source = await sharp(data, {raw: info}).png().toBuffer();
  await fs.mkdir(path.dirname(output), {recursive: true});
  await sharp({create: {width: 1920, height: 1080, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}}})
    .composite([{input: source, left, top}])
    .png()
    .toFile(output);
};

const removeResidualMagenta = async (file) => {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    if (alpha === 0) {
      data[index] = 235;
      data[index + 1] = 235;
      data[index + 2] = 235;
      continue;
    }
    const keyStrength = Math.min(red, blue) - green;
    if (red > 60 && blue > 60 && keyStrength > 3) {
      const retention = Math.max(0, Math.min(1, 1 - (keyStrength - 3) / 35));
      data[index] = Math.max(0, red - keyStrength);
      data[index + 2] = Math.max(0, blue - keyStrength);
      data[index + 3] = Math.round(alpha * retention);
    }
    if (alpha > 0 && red - green > 35 && Math.abs(blue - green) < 22) {
      data[index] = Math.min(255, green + 22);
      data[index + 2] = Math.max(0, green - 10);
    }
  }
  await sharp(data, {raw: info}).png().toFile(`${file}.decontaminated.png`);
  await fs.rename(`${file}.decontaminated.png`, file);
};

const inputs = {
  room: path.join(publicRoot, 'plates/reality-room-empty.png'),
  sleeping: path.join(publicRoot, 'characters/zhuang-awakening-states-sleeping.png'),
  recliningAwake: path.join(publicRoot, 'characters/zhuang-awakening-states-reclining-awake.png'),
  sittingHands: path.join(publicRoot, 'characters/zhuang-awakening-states-sitting-hands.png'),
  seatedQuestioning: path.join(publicRoot, 'characters/zhuang-awakening-states-seated-questioning.png'),
  flower: path.join(publicRoot, 'plates/dream-flower-journey.png'),
  butterflyOpen: path.join(publicRoot, 'characters/butterfly-flight-states-wings-open.png'),
  butterflyFolded: path.join(publicRoot, 'characters/butterfly-flight-states-wings-folded.png'),
  butterflyUp: path.join(publicRoot, 'characters/butterfly-flight-states-wings-up.png'),
  butterflyHover: path.join(publicRoot, 'characters/butterfly-flight-states-hover-level.png'),
};

const outputs = {
  roomRear: path.join(publicRoot, 'registered/reality-room-support-rear.png'),
  sleeping: path.join(publicRoot, 'registered/zhuang-sleeping-registered.png'),
  roomFront: path.join(publicRoot, 'registered/reality-room-support-front.png'),
  flowerRear: path.join(publicRoot, 'registered/flower-journey-support-rear.png'),
  butterflyOpen: path.join(publicRoot, 'registered/butterfly-flower-wings-open.png'),
  butterflyFolded: path.join(publicRoot, 'registered/butterfly-flower-wings-folded.png'),
  butterflyUp: path.join(publicRoot, 'registered/butterfly-flower-wings-up.png'),
  butterflyHover: path.join(publicRoot, 'registered/butterfly-flower-hover-level.png'),
  flowerFront: path.join(publicRoot, 'registered/flower-journey-support-front.png'),
};

for (const file of [inputs.sleeping, inputs.recliningAwake, inputs.sittingHands, inputs.seatedQuestioning]) await removeResidualMagenta(file);
await writeFullCanvasCopy(inputs.room, outputs.roomRear);
await writeRegisteredSubject({input: inputs.sleeping, output: outputs.sleeping, width: 922, left: 365, top: 158});
await writeFrontOverlay({input: inputs.room, output: outputs.roomFront, left: 70, top: 700, width: 1280, height: 300, mode: 'room'});
await writeFullCanvasCopy(inputs.flower, outputs.flowerRear);
await writeRegisteredSubject({input: inputs.butterflyOpen, output: outputs.butterflyOpen, width: 460, left: 1114, top: 340});
await writeRegisteredSubject({input: inputs.butterflyFolded, output: outputs.butterflyFolded, width: 460, left: 1114, top: 340});
await writeRegisteredSubject({input: inputs.butterflyUp, output: outputs.butterflyUp, width: 460, left: 1114, top: 340});
await writeRegisteredSubject({input: inputs.butterflyHover, output: outputs.butterflyHover, width: 460, left: 1114, top: 340});
await writeFrontOverlay({input: inputs.flower, output: outputs.flowerFront, left: 850, top: 640, width: 1070, height: 380, mode: 'flower'});

const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const existing = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
const recordedAt = new Date().toISOString();

const zhuangStateIds = ['sleeping', 'reclining-awake', 'sitting-hands', 'seated-questioning'];
const zhuangStateFiles = [inputs.sleeping, inputs.recliningAwake, inputs.sittingHands, inputs.seatedQuestioning];
const zhuangHashes = await Promise.all(zhuangStateFiles.map(sha256));
const zhuangSource = existing.get('zhuang-awakening-sheet');
const zhuangFamilyFingerprint = createHash('sha256').update(JSON.stringify({source: zhuangSource?.sha256 ?? null, members: zhuangStateIds.map((stateId, index) => ({stateId, sha256: zhuangHashes[index]})), postprocess: 'residual-magenta-all-transparent-neutral-rgb-red-fringe-despill-v7'})).digest('hex');
for (let index = 0; index < zhuangStateIds.length; index += 1) {
  const assetId = `zhuang-awakening-states-${zhuangStateIds[index]}`;
  const current = existing.get(assetId);
  const stat = await fs.stat(zhuangStateFiles[index]);
  const metadata = await sharp(zhuangStateFiles[index]).metadata();
  const updated = {
    ...current,
    adapter: 'registered-sheet-cell+local-decontamination',
    tool: 'process-state-sheet + projects/zhuang-zhou-meng-die/build-registered-support.mjs',
    requestFingerprint: createHash('sha256').update(`${zhuangSource?.requestFingerprint ?? 'zhuang-awakening-sheet'}:${zhuangStateIds[index]}:${zhuangFamilyFingerprint}`).digest('hex'),
    sha256: zhuangHashes[index],
    sizeBytes: stat.size,
    media: {width: metadata.width, height: metadata.height, format: metadata.format ?? null, hasAlpha: metadata.hasAlpha ?? false},
    recordedAt,
    familyFingerprint: zhuangFamilyFingerprint,
  };
  existing.set(assetId, updated);
}
manifest.assets = manifest.assets.map((asset) => existing.get(asset.assetId) ?? asset);
const zhuangReportFile = path.join(publicRoot, 'characters/zhuang-awakening-states-state-sheet-report.json');
const zhuangReport = JSON.parse(await fs.readFile(zhuangReportFile, 'utf8'));
zhuangReport.familyFingerprint = zhuangFamilyFingerprint;
zhuangReport.localPostprocess = 'residual-magenta-alpha-v1';
zhuangReport.members = zhuangReport.members.map((member, index) => ({...member, sha256: zhuangHashes[index]}));
await fs.writeFile(zhuangReportFile, `${JSON.stringify(zhuangReport, null, 2)}\n`, 'utf8');

const record = async ({assetId, file, parentAssetId, sceneId, nodeId, registrationId, sourceMasterAssetId, outputRole, derivationMethod, stateId = null}) => {
  const stat = await fs.stat(file);
  const metadata = await sharp(file).metadata();
  const parent = existing.get(parentAssetId);
  const fileHash = await sha256(file);
  const familyFingerprint = stateId
    ? createHash('sha256').update(`butterfly-flower-landing:${stateId}:${fileHash}`).digest('hex')
    : null;
  return {
    assetId,
    capability: 'image',
    file: path.relative(root, file),
    provider: 'local-derivation',
    adapter: 'registered-composite',
    tool: 'projects/zhuang-zhou-meng-die/build-registered-support.mjs',
    model: null,
    externalId: null,
    attemptId: parent?.attemptId ?? null,
    requestFingerprint: createHash('sha256').update(`${parent?.requestFingerprint ?? parentAssetId}:${assetId}:${fileHash}`).digest('hex'),
    reusedFrom: parentAssetId,
    sha256: fileHash,
    sizeBytes: stat.size,
    media: {width: metadata.width, height: metadata.height, format: metadata.format ?? null, hasAlpha: metadata.hasAlpha ?? false},
    recordedAt,
    request: {},
    compositionBinding: {
      sceneId,
      nodeId,
      pattern: 'supported-subject',
      registrationId,
      sourceMasterAssetId,
      outputRole,
      canvas: {width: 1920, height: 1080},
      derivation: {method: derivationMethod, parentAssetId},
    },
    stateBinding: stateId ? {poseFamilyId: 'butterfly-flight-states', stateId, registrationId, sourceMasterAssetId} : null,
    stateSheetBinding: null,
    stateSheetRecoveryBinding: parent?.stateSheetRecoveryBinding ?? null,
    semanticBinding: parent?.semanticBinding ?? null,
    familyFingerprint,
  };
};

const derived = [
  await record({assetId: 'reality-room-support-rear', file: outputs.roomRear, parentAssetId: 'reality-room-empty', sceneId: 'scene-01', nodeId: 'sleeping-tableau', registrationId: 'reality-room-registration', sourceMasterAssetId: 'reality-room-master', outputRole: 'support-rear', derivationMethod: 'crop'}),
  await record({assetId: 'zhuang-sleeping-registered', file: outputs.sleeping, parentAssetId: 'zhuang-awakening-states-sleeping', sceneId: 'scene-01', nodeId: 'zhuang-sleeping', registrationId: 'reality-room-registration', sourceMasterAssetId: 'reality-room-master', outputRole: 'subject', derivationMethod: 'mask-application'}),
  await record({assetId: 'reality-room-support-front', file: outputs.roomFront, parentAssetId: 'reality-room-empty', sceneId: 'scene-01', nodeId: 'sleeping-tableau', registrationId: 'reality-room-registration', sourceMasterAssetId: 'reality-room-master', outputRole: 'support-front', derivationMethod: 'mask-application'}),
  await record({assetId: 'flower-journey-support-rear', file: outputs.flowerRear, parentAssetId: 'dream-flower-journey', sceneId: 'scene-03', nodeId: 'flower-landing-rig', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'support-rear', derivationMethod: 'crop'}),
  await record({assetId: 'butterfly-flower-wings-open', file: outputs.butterflyOpen, parentAssetId: 'butterfly-flight-states-wings-open', sceneId: 'scene-03', nodeId: 'dream-butterfly', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'registered-state', derivationMethod: 'mask-application', stateId: 'wings-open'}),
  await record({assetId: 'butterfly-flower-wings-folded', file: outputs.butterflyFolded, parentAssetId: 'butterfly-flight-states-wings-folded', sceneId: 'scene-03', nodeId: 'dream-butterfly', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'registered-state', derivationMethod: 'mask-application', stateId: 'wings-folded'}),
  await record({assetId: 'butterfly-flower-wings-up', file: outputs.butterflyUp, parentAssetId: 'butterfly-flight-states-wings-up', sceneId: 'scene-03', nodeId: 'dream-butterfly', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'registered-state', derivationMethod: 'mask-application', stateId: 'wings-up'}),
  await record({assetId: 'butterfly-flower-hover-level', file: outputs.butterflyHover, parentAssetId: 'butterfly-flight-states-hover-level', sceneId: 'scene-03', nodeId: 'dream-butterfly', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'registered-state', derivationMethod: 'mask-application', stateId: 'hover-level'}),
  await record({assetId: 'flower-journey-support-front', file: outputs.flowerFront, parentAssetId: 'dream-flower-journey', sceneId: 'scene-03', nodeId: 'flower-landing-rig', registrationId: 'flower-journey-registration', sourceMasterAssetId: 'flower-journey-master', outputRole: 'support-front', derivationMethod: 'mask-application'}),
];

const derivedIds = new Set(derived.map(({assetId}) => assetId));
manifest.assets = [...manifest.assets.filter(({assetId}) => !derivedIds.has(assetId)), ...derived];
await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`registered-support: wrote ${derived.length} deterministic derivatives`);
