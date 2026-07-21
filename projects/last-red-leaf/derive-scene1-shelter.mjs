import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const sceneDirectory = path.join(root, 'public/projects/last-red-leaf/assets/scene1');
const keyedFile = path.join(sceneDirectory, 'work/scene1-shelter-keyed.png');
const {data, info} = await sharp(keyedFile).ensureAlpha().raw().toBuffer({resolveWithObject: true});

const leafAlpha = Buffer.alloc(info.width * info.height);
const subjectAlpha = Buffer.alloc(info.width * info.height);
const groundAlpha = Buffer.alloc(info.width * info.height);
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
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
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
  const output = Buffer.alloc(alpha.length);
  for (let index = 0; index < alpha.length; index += 1) {
    if (labels[index] === largest) output[index] = alpha[index];
  }
  return output;
};

for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const pixel = y * info.width + x;
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha <= 8) continue;

    const inLeafBand = y < 580;
    if (inLeafBand) {
      leafAlpha[pixel] = alpha;
      continue;
    }

    const inSnailEnvelope = x >= 560 && x <= 1230 && y >= 565 && y <= 850;
    const inShellCore = ((x - 850) / 165) ** 2 + ((y - 700) / 135) ** 2 <= 1;
    const paleBody = red > 185 && green > 170 && blue > 90;
    const inEyeRegion = x >= 1050 && x <= 1190 && y >= 565 && y <= 630;
    const belongsToSnail = inSnailEnvelope && (inShellCore || paleBody || inEyeRegion);
    if (belongsToSnail) {
      subjectAlpha[pixel] = alpha;
      continue;
    }

    if (y >= 700) {
      groundAlpha[pixel] = alpha;
      const frontTop = 812 + Math.round(34 * Math.min(1, Math.abs(x - 950) / 700));
      const isFrontLip = y >= frontTop;
      if (isFrontLip) frontAlpha[pixel] = alpha;
    }
  }
}

const cleanedLeaf = keepLargestComponent(leafAlpha, info.width, info.height);
const cleanedSubject = keepLargestComponent(subjectAlpha, info.width, info.height);
const cleanedGround = keepLargestComponent(groundAlpha, info.width, info.height);
const cleanedFront = keepLargestComponent(frontAlpha, info.width, info.height);

const rgbaWithAlpha = async (alpha) => {
  const rgb = await sharp(data, {raw: info}).removeAlpha().png().toBuffer();
  const mask = await sharp(alpha, {raw: {width: info.width, height: info.height, channels: 1}}).png().toBuffer();
  return sharp(rgb).joinChannel(mask).png().toBuffer();
};

await fs.writeFile(path.join(sceneDirectory, 'scene1-shelter-master.png'), await sharp(data, {raw: info}).png().toBuffer());
await fs.writeFile(path.join(sceneDirectory, 'scene1-red-leaf-free.png'), await rgbaWithAlpha(cleanedLeaf));
await fs.writeFile(path.join(sceneDirectory, 'scene1-ground-rear.png'), await rgbaWithAlpha(cleanedGround));
await fs.writeFile(path.join(sceneDirectory, 'scene1-snail-subject.png'), await rgbaWithAlpha(cleanedSubject));
await fs.writeFile(path.join(sceneDirectory, 'scene1-ground-front.png'), await rgbaWithAlpha(cleanedFront));

console.log(`derived scene 01 registered family at ${sceneDirectory}`);
