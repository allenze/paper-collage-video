import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROLE_ORDER = ['support-rear', 'subject', 'support-front'];
const PROFILE_SIZES = {
  '16:9': {width: 640, height: 360},
  '9:16': {width: 360, height: 640},
  '1:1': {width: 480, height: 480},
};

const sha256File = async (file) =>
  createHash('sha256').update(await fs.readFile(file)).digest('hex');

const checkerboard = ({width, height, cell = 20}) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <pattern id="checker" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse">
        <rect width="${cell * 2}" height="${cell * 2}" fill="#f3f0e8"/>
        <rect width="${cell}" height="${cell}" fill="#c8c4ba"/>
        <rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="#c8c4ba"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#checker)"/>
  </svg>
`);

const dataUrlFor = async (file) =>
  `data:image/png;base64,${(
    await sharp(file).ensureAlpha().png().toBuffer()
  ).toString('base64')}`;

const safeText = (value) =>
  String(value).replace(/[<>&"]/g, '');

const layerSvg = async ({
  members,
  width,
  height,
  limit,
  direction,
}) => {
  const images = [];
  for (const member of members) {
    const metadata = await sharp(member.file).metadata();
    const inputWidth = metadata.width;
    const inputHeight = metadata.height;
    const cover = Math.max(width / inputWidth, height / inputHeight);
    const baseWidth = inputWidth * cover;
    const baseHeight = inputHeight * cover;
    const depth = member.depth;
    const scale = 1 + Math.abs(depth) * limit.scale;
    const translateX = direction * depth * limit.x * width;
    const translateY = direction * depth * limit.y * height;
    const rotation =
      direction * depth * limit.rotationDegrees;
    const left = (width - baseWidth) / 2;
    const top = (height - baseHeight) / 2;
    images.push(`
      <image
        href="${await dataUrlFor(member.file)}"
        x="${left}"
        y="${top}"
        width="${baseWidth}"
        height="${baseHeight}"
        preserveAspectRatio="none"
        transform="translate(${translateX} ${translateY}) rotate(${rotation} ${width / 2} ${height / 2}) translate(${width / 2} ${height / 2}) scale(${scale}) translate(${-width / 2} ${-height / 2})"
      />
    `);
  }
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${images.join('\n')}
    </svg>
  `);
};

const writeEnvelopePair = async ({
  members,
  profile,
  limit,
  file,
}) => {
  const {width, height} = PROFILE_SIZES[profile];
  const negative = await layerSvg({
    members,
    width,
    height,
    limit,
    direction: -1,
  });
  const positive = await layerSvg({
    members,
    width,
    height,
    limit,
    direction: 1,
  });
  const left = await sharp(negative).ensureAlpha().png().toBuffer();
  const right = await sharp(positive).ensureAlpha().png().toBuffer();
  await sharp({
    create: {
      width: width * 2,
      height,
      channels: 4,
      background: '#00000000',
    },
  })
    .composite([
      {input: left, left: 0, top: 0},
      {input: right, left: width, top: 0},
    ])
    .png()
    .toFile(file);
  const {data, info} = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  let transparentPixels = 0;
  for (
    let offset = info.channels - 1;
    offset < data.length;
    offset += info.channels
  ) {
    if (data[offset] < 255) transparentPixels += 1;
  }
  return {
    profile,
    file,
    width: info.width,
    height: info.height,
    transparentPixels,
    passed: transparentPixels === 0,
  };
};

export const buildLayerStackProof = async ({
  group,
  memberFiles,
  referenceFile,
  directory,
  evidenceId,
}) => {
  const members = ROLE_ORDER.map((role) => {
    const node = group.children.find(
      (candidate) =>
        candidate.kind === 'asset' && candidate.slot === role,
    );
    const file = memberFiles.get(node?.id);
    if (!node || !file) {
      throw new Error(
        `registered-depth-stack ${group.id} 缺少 ${role} 证明来源`,
      );
    }
    return {role, nodeId: node.id, depth: node.depth, file};
  });
  await fs.mkdir(directory, {recursive: true});
  const safeId = evidenceId
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase();
  const canvas = group.registration.canvas;
  const neutralFile = path.join(
    directory,
    `${safeId}-neutral-reconstruction.png`,
  );
  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: '#00000000',
    },
  })
    .composite(
      members.map(({file}) => ({input: file, left: 0, top: 0})),
    )
    .png()
    .toFile(neutralFile);

  const comparisonFile = path.join(
    directory,
    `${safeId}-reference-comparison.png`,
  );
  const reference = referenceFile ?? neutralFile;
  await sharp({
    create: {
      width: canvas.width * 2,
      height: canvas.height,
      channels: 4,
      background: '#00000000',
    },
  })
    .composite([
      {input: reference, left: 0, top: 0},
      {input: neutralFile, left: canvas.width, top: 0},
    ])
    .png()
    .toFile(comparisonFile);

  const tileWidth = Math.min(480, canvas.width);
  const tileHeight = Math.max(
    1,
    Math.round((tileWidth * canvas.height) / canvas.width),
  );
  const explodedFile = path.join(
    directory,
    `${safeId}-exploded-view.png`,
  );
  const explodedLayers = [];
  for (const [index, member] of members.entries()) {
    const layer = await sharp(member.file)
      .resize(tileWidth, tileHeight, {fit: 'fill'})
      .png()
      .toBuffer();
    explodedLayers.push(
      {input: checkerboard({width: tileWidth, height: tileHeight}), left: index * tileWidth, top: 0},
      {input: layer, left: index * tileWidth, top: 0},
      {
        input: Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="42">
            <rect width="100%" height="42" fill="rgba(15,23,42,.82)"/>
            <text x="12" y="28" fill="white" font-size="20" font-family="sans-serif">${safeText(member.role)} · ${safeText(member.nodeId)}</text>
          </svg>
        `),
        left: index * tileWidth,
        top: tileHeight,
      },
    );
  }
  await sharp({
    create: {
      width: tileWidth * 3,
      height: tileHeight + 42,
      channels: 4,
      background: '#f3f0e8',
    },
  })
    .composite(explodedLayers)
    .png()
    .toFile(explodedFile);

  const envelopeExtremes = [];
  for (const profile of Object.keys(PROFILE_SIZES)) {
    const file = path.join(
      directory,
      `${safeId}-envelope-${profile.replace(':', 'x')}.png`,
    );
    envelopeExtremes.push(
      await writeEnvelopePair({
        members,
        profile,
        limit: group.layerStack.revealEnvelope[profile],
        file,
      }),
    );
  }
  const artifacts = {
    neutralReconstruction: neutralFile,
    referenceComparison: comparisonFile,
    explodedView: explodedFile,
    envelopeExtremes,
  };
  return {
    members: members.map(({role, nodeId, depth}) => ({
      role,
      nodeId,
      depth,
    })),
    artifacts,
    artifactHashes: Object.fromEntries(
      (
        await Promise.all([
          neutralFile,
          comparisonFile,
          explodedFile,
          ...envelopeExtremes.map(({file}) => file),
        ].map(async (file) => [file, await sha256File(file)]))
      ),
    ),
    passed: envelopeExtremes.every(({passed}) => passed),
  };
};
