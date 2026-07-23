#!/usr/bin/env node

import sharp from 'sharp';

const [input, output] = process.argv.slice(2);

if (!input || !output) {
  throw new Error('Usage: normalize-provider-sheet.mjs <provider-raw.png> <normalized.png>');
}

const source = sharp(input);
const metadata = await source.metadata();

if (metadata.width !== 1254 || metadata.height !== 1254 || metadata.channels !== 3) {
  throw new Error(
    `Unexpected provider sheet: ${metadata.width}x${metadata.height} channels=${metadata.channels}`,
  );
}

const cells = {
  reference: {left: 0, top: 0, width: 625, height: 625},
  rear: {left: 629, top: 0, width: 625, height: 625},
  subject: {left: 0, top: 629, width: 625, height: 625},
  front: {left: 629, top: 629, width: 625, height: 625},
};

const opaqueCell = async (extract) =>
  sharp(input)
    .extract(extract)
    .ensureAlpha(1)
    .resize(1024, 1024, {fit: 'fill', kernel: sharp.kernel.lanczos3})
    .png()
    .toBuffer();

const alphaCell = async (extract) => {
  const {data, info} = await sharp(input)
    .extract(extract)
    .raw()
    .toBuffer({resolveWithObject: true});
  const rgba = Buffer.alloc(info.width * info.height * 4);

  for (let index = 0; index < info.width * info.height; index += 1) {
    const sourceOffset = index * info.channels;
    const targetOffset = index * 4;
    const red = data[sourceOffset];
    const green = data[sourceOffset + 1];
    const blue = data[sourceOffset + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const chroma = maximum - minimum;
    const luminance = (red + green + blue) / 3;
    const colorEvidence = Math.max(0, Math.min(1, (chroma - 3) / 25));
    const darkEvidence = Math.max(0, Math.min(1, (228 - luminance) / 32));
    const alpha = Math.max(colorEvidence, darkEvidence);

    rgba[targetOffset] = red;
    rgba[targetOffset + 1] = green;
    rgba[targetOffset + 2] = blue;
    rgba[targetOffset + 3] =
      alpha <= 0.04 ? 0 : alpha >= 0.96 ? 255 : Math.round(alpha * 255);
  }

  return sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .resize(1024, 1024, {fit: 'fill', kernel: sharp.kernel.lanczos3})
    .png()
    .toBuffer();
};

const [reference, rear, subject, front] = await Promise.all([
  opaqueCell(cells.reference),
  opaqueCell(cells.rear),
  alphaCell(cells.subject),
  alphaCell(cells.front),
]);

await sharp({
  create: {
    width: 2048,
    height: 2048,
    channels: 4,
    background: {r: 0, g: 0, b: 0, alpha: 0},
  },
})
  .composite([
    {input: reference, left: 0, top: 0},
    {input: rear, left: 1024, top: 0},
    {input: subject, left: 0, top: 1024},
    {input: front, left: 1024, top: 1024},
  ])
  .png()
  .toFile(output);
