import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const styleDirectory = path.join(root, 'public/projects/last-red-leaf/assets/style');
const originalSourceFile = path.join(styleDirectory, 'work/style-leaf-snail-source-original.png');
const keyedFile = path.join(styleDirectory, 'work/style-leaf-snail-keyed.png');
const {data, info} = await sharp(keyedFile).ensureAlpha().raw().toBuffer({resolveWithObject: true});

const subjectAlpha = Buffer.alloc(info.width * info.height);
const rearAlpha = Buffer.alloc(info.width * info.height);
const frontAlpha = Buffer.alloc(info.width * info.height);

const keepLargestComponent = (alpha, width, height) => {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const sizes = [0];
  let label = 0;
  for (let start = 0; start < alpha.length; start += 1) {
    if (alpha[start] <= 8 || labels[start] !== 0) continue;
    label += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    let size = 0;
    while (head < tail) {
      const current = queue[head++];
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (alpha[next] <= 8 || labels[next] !== 0) continue;
          labels[next] = label;
          queue[tail++] = next;
        }
      }
    }
    sizes[label] = size;
  }
  let largest = 0;
  for (let index = 1; index < sizes.length; index += 1) {
    if ((sizes[index] ?? 0) > (sizes[largest] ?? 0)) largest = index;
  }
  const result = Buffer.alloc(alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    if (labels[index] === largest) result[index] = alpha[index];
  }
  return result;
};

const removeDetachedRowFibers = (alpha, width, height) => {
  const result = Buffer.from(alpha);
  for (let y = 0; y < height; y += 1) {
    if (y < 540) continue;
    const runs = [];
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const visible = x < width && alpha[y * width + x] > 8;
      if (visible && start < 0) start = x;
      if (!visible && start >= 0) {
        runs.push({start, end: x - 1, length: x - start});
        start = -1;
      }
    }
    const structuralRuns = runs.filter(({length}) => length >= 80);
    if (structuralRuns.length === 0) continue;
    for (const run of runs) {
      if (run.length >= 50) continue;
      const distance = Math.min(...structuralRuns.map((structural) =>
        run.end < structural.start
          ? structural.start - run.end
          : run.start > structural.end
            ? run.start - structural.end
            : 0,
      ));
      if (distance === 0) continue;
      for (let x = run.start; x <= run.end; x += 1) result[y * width + x] = 0;
    }
  }
  return result;
};

for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const pixel = y * info.width + x;
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha === 0) continue;

    const maximum = Math.max(red, green, blue) / 255;
    const minimum = Math.min(red, green, blue) / 255;
    const delta = maximum - minimum;
    let hue = 0;
    if (delta > 0) {
      if (maximum === red / 255) hue = 60 * (((green - blue) / 255 / delta) % 6);
      else if (maximum === green / 255) hue = 60 * ((blue - red) / 255 / delta + 2);
      else hue = 60 * ((red - green) / 255 / delta + 4);
    }
    if (hue < 0) hue += 360;
    const saturation = maximum === 0 ? 0 : delta / maximum;
    const saturatedLeafRed =
      red > 80 && saturation > 0.34 && (hue <= 18 || hue >= 342);
    const localLeafRed =
      red > 80 && saturation > 0.34 && (hue <= 30 || hue >= 342);
    const inSnailEnvelope = x >= 510 && x <= 1055 && y >= 345 && y <= 655;
    const inShellCore =
      ((x - 730) / 150) ** 2 + ((y - 500) / 120) ** 2 <= 1 &&
      (x >= 650 || y < 535);
    const beigeFootColor =
      green / Math.max(1, red) > 0.62 &&
      blue / Math.max(1, red) > 0.45;
    const lowerEnvelopeLeft = 590 - Math.max(0, y - 580) * 2.3;
    const lowerEnvelopeRight = 1022 - Math.max(0, y - 580) * 0.45;
    const belongsToSubject = inSnailEnvelope &&
      !(x < 650 && y > 535 && y < 590 && localLeafRed) && (
      inShellCore ||
      y < 535 ||
      (y < 580 && !saturatedLeafRed) ||
      (
        y >= 580 &&
        x >= lowerEnvelopeLeft &&
        x <= lowerEnvelopeRight &&
        !saturatedLeafRed &&
        (y < 605 || beigeFootColor)
      )
    );

    if (belongsToSubject) {
      subjectAlpha[pixel] = alpha;
    } else if (y >= 535) {
      rearAlpha[pixel] = alpha;
    }

    const isCoralFrontRim =
      rearAlpha[pixel] > 0 &&
      saturatedLeafRed &&
      y >= 575 &&
      y <= 682 &&
      red >= 145 &&
      green >= 38 &&
      green / Math.max(1, red) >= 0.2 &&
      blue / Math.max(1, red) >= 0.15;
    if (isCoralFrontRim) frontAlpha[pixel] = alpha;
  }
}

const cleanedSubjectAlpha = removeDetachedRowFibers(
  keepLargestComponent(subjectAlpha, info.width, info.height),
  info.width,
  info.height,
);
for (let y = 558; y <= 565; y += 1) {
  for (let x = 590; x <= 615; x += 1) {
    cleanedSubjectAlpha[y * info.width + x] = 0;
  }
}
for (let pixel = 0; pixel < subjectAlpha.length; pixel += 1) {
  if (subjectAlpha[pixel] > 0 && cleanedSubjectAlpha[pixel] === 0) {
    const y = Math.floor(pixel / info.width);
    if (y >= 535) rearAlpha[pixel] = data[pixel * info.channels + 3];
  }
}
const cleanedRearAlpha = keepLargestComponent(rearAlpha, info.width, info.height);

const transparentCanvas = {r: 0, g: 0, b: 0, alpha: 0};
const resizeToCanvas = async (input) =>
  sharp(input)
    .resize(1920, 1080, {fit: 'contain', background: transparentCanvas})
    .png()
    .toBuffer();

const rgbaWithAlpha = async (alpha) => {
  const rgb = await sharp(data, {raw: info}).removeAlpha().png().toBuffer();
  const mask = await sharp(alpha, {raw: {width: info.width, height: info.height, channels: 1}}).png().toBuffer();
  return sharp(rgb).joinChannel(mask).png().toBuffer();
};

const master = await resizeToCanvas(await sharp(data, {raw: info}).png().toBuffer());
const normalizedSource = await sharp(originalSourceFile)
  .resize(1920, 1080, {fit: 'contain', background: {r: 5, g: 248, b: 14}})
  .png()
  .toBuffer();
const subject = await resizeToCanvas(await rgbaWithAlpha(cleanedSubjectAlpha));
const rear = await resizeToCanvas(await rgbaWithAlpha(cleanedRearAlpha));
const front = await resizeToCanvas(await rgbaWithAlpha(frontAlpha));

await fs.writeFile(path.join(styleDirectory, 'style-leaf-snail-source.png'), normalizedSource);
await fs.writeFile(path.join(styleDirectory, 'style-leaf-snail-master.png'), master);
await fs.writeFile(path.join(styleDirectory, 'snail-subject.png'), subject);
await fs.writeFile(path.join(styleDirectory, 'leaf-boat-rear.png'), rear);
await fs.writeFile(path.join(styleDirectory, 'leaf-boat-front.png'), front);

console.log(`derived supported-subject family at ${styleDirectory}`);
