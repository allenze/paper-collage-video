import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const sceneDirectory = path.join(root, 'public/projects/last-red-leaf/assets/scene1');
const workDirectory = path.join(sceneDirectory, 'work');
const original = path.join(workDirectory, 'scene1-shelter-source-original.png');
const normalized = path.join(sceneDirectory, 'scene1-shelter-source.png');

await fs.mkdir(workDirectory, {recursive: true});
await sharp(original)
  .resize(1920, 1080, {fit: 'contain', background: {r: 0, g: 255, b: 0}})
  .png()
  .toFile(normalized);

console.log(`normalized scene 01 source at ${normalized}`);
