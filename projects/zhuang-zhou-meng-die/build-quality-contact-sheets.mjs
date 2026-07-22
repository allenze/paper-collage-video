import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const scaffoldName = process.argv[2] ?? 'quality-review-scaffold.json';
const scaffold = JSON.parse(await fs.readFile(path.join(import.meta.dirname, scaffoldName), 'utf8'));
const outputDirectory = path.join(root, `dist/zhuang-zhou-meng-die/quality-contact-sheets-${path.basename(scaffoldName, '.json')}`);
await fs.mkdir(outputDirectory, {recursive: true});

const columns = 4;
const rows = 4;
const tileWidth = 480;
const tileHeight = 300;
const imageWidth = 456;
const imageHeight = 238;

const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const selectEvidence = (review) => {
  if (review.assetId) return review.evidenceFiles[0];
  return review.evidenceFiles.find((file) => file.includes('/frames/'))
    ?? review.evidenceFiles.find((file) => file.includes('/crops/'))
    ?? review.evidenceFiles[0];
};

for (let offset = 0; offset < scaffold.reviews.length; offset += columns * rows) {
  const reviews = scaffold.reviews.slice(offset, offset + columns * rows);
  const canvas = sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: '#ded8c8',
    },
  });
  const composites = [];
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index];
    const evidence = selectEvidence(review);
    const label = review.assetId ?? review.compositeId;
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const thumbnail = await sharp(path.join(root, evidence))
      .resize(imageWidth, imageHeight, {fit: 'contain', background: '#f3ebd8'})
      .png()
      .toBuffer();
    const caption = Buffer.from(`<svg width="${tileWidth}" height="54" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#182d31"/>
      <text x="12" y="22" fill="#f3ebd8" font-size="15" font-family="sans-serif">${escapeXml(label.slice(0, 55))}</text>
      <text x="12" y="43" fill="#b9c6c4" font-size="12" font-family="sans-serif">${escapeXml(path.basename(evidence).slice(0, 70))}</text>
    </svg>`);
    composites.push({input: thumbnail, left: left + 12, top: top + 6});
    composites.push({input: caption, left, top: top + 246});
  }
  const sheetNumber = Math.floor(offset / (columns * rows)) + 1;
  await canvas.composite(composites).png().toFile(path.join(outputDirectory, `sheet-${sheetNumber}.png`));
}

const allEvidence = [...new Set(scaffold.reviews.flatMap(({evidenceFiles}) => evidenceFiles))];
for (let offset = 0; offset < allEvidence.length; offset += columns * rows) {
  const evidenceFiles = allEvidence.slice(offset, offset + columns * rows);
  const canvas = sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: '#ded8c8',
    },
  });
  const composites = [];
  for (let index = 0; index < evidenceFiles.length; index += 1) {
    const evidence = evidenceFiles[index];
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const thumbnail = await sharp(path.join(root, evidence))
      .resize(imageWidth, imageHeight, {fit: 'contain', background: '#f3ebd8'})
      .png()
      .toBuffer();
    const caption = Buffer.from(`<svg width="${tileWidth}" height="54" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#182d31"/>
      <text x="12" y="22" fill="#f3ebd8" font-size="15" font-family="sans-serif">${escapeXml(path.basename(evidence).slice(0, 58))}</text>
      <text x="12" y="43" fill="#b9c6c4" font-size="12" font-family="sans-serif">${escapeXml(path.dirname(evidence).slice(-70))}</text>
    </svg>`);
    composites.push({input: thumbnail, left: left + 12, top: top + 6});
    composites.push({input: caption, left, top: top + 246});
  }
  const sheetNumber = Math.floor(offset / (columns * rows)) + 1;
  await canvas.composite(composites).png().toFile(path.join(outputDirectory, `evidence-${sheetNumber}.png`));
}

console.log(`quality-contact-sheets: ${Math.ceil(scaffold.reviews.length / (columns * rows))} review sheets, ${Math.ceil(allEvidence.length / (columns * rows))} evidence sheets`);
