import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '../..');
const outputDirectory = path.join(root, 'public/projects/last-red-leaf/assets/style');
const width = 1920;
const height = 1080;
const boundaryY = 610;

await fs.mkdir(outputDirectory, {recursive: true});

const masterSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="1920" height="1080" fill="#b9c9c6"/>
  <path d="M0 0H1920V350C1640 305 1420 330 1170 270C870 200 540 250 0 180Z" fill="#d4ddd5"/>
  <circle cx="1580" cy="210" r="104" fill="#e8c878"/>
  <circle cx="1580" cy="210" r="78" fill="#f3dc9b" opacity=".76"/>
  <path d="M0 470C250 350 480 402 680 365C920 322 1170 385 1400 332C1615 284 1790 320 1920 292V610H0Z" fill="#8a5943"/>
  <path d="M0 520C250 435 500 472 760 422C990 377 1240 455 1510 392C1680 352 1815 370 1920 344V610H0Z" fill="#b57b59"/>
  <path d="M0 558C260 505 510 536 760 494C1040 447 1285 522 1540 462C1702 424 1828 430 1920 412V610H0Z" fill="#d0a06f"/>
  <g fill="none" stroke="#6c4438" stroke-width="13" stroke-linecap="round" opacity=".82">
    <path d="M110 612L92 430M110 505L62 455M108 545L155 492"/>
    <path d="M318 612L330 420M326 495L374 448M325 538L281 485"/>
    <path d="M1740 612L1725 422M1732 490L1686 452M1732 535L1778 482"/>
    <path d="M1850 612L1872 462M1864 517L1903 486"/>
  </g>
  <g fill="#c4774f">
    <path d="M66 455L94 420L111 468Z"/><path d="M148 493L171 457L183 505Z"/>
    <path d="M372 448L397 412L405 461Z"/><path d="M277 486L253 448L245 500Z"/>
    <path d="M1685 452L1658 417L1654 468Z"/><path d="M1780 482L1808 449L1811 500Z"/>
  </g>
  <path d="M0 610C260 574 454 632 710 598C970 563 1180 628 1450 590C1630 565 1780 590 1920 566V1080H0Z" fill="#789da4"/>
  <path d="M0 686C260 644 490 701 730 668C1030 627 1250 700 1510 654C1680 624 1810 647 1920 632V1080H0Z" fill="#668d98" opacity=".78"/>
  <path d="M0 610C260 574 454 632 710 598C970 563 1180 628 1450 590C1630 565 1780 590 1920 566" fill="none" stroke="#f3e0b2" stroke-width="20" stroke-linecap="round"/>
  <path d="M1220 636C1420 630 1600 650 1810 624L1920 1080H1310C1408 946 1340 800 1220 636Z" fill="#d8b86f" opacity=".42"/>
  <g fill="none" stroke-linecap="round">
    <path d="M150 722C360 690 530 744 730 711" stroke="#adc3bf" stroke-width="12"/>
    <path d="M1040 756C1220 720 1400 770 1570 740" stroke="#a8c0bd" stroke-width="10"/>
    <path d="M230 886C510 836 760 914 1030 872" stroke="#597e8a" stroke-width="15" opacity=".78"/>
    <path d="M1150 955C1360 916 1570 970 1775 934" stroke="#587c87" stroke-width="14" opacity=".7"/>
  </g>
  <g opacity=".18" fill="#fff7df">
    <circle cx="230" cy="150" r="3"/><circle cx="410" cy="285" r="4"/><circle cx="980" cy="160" r="3"/>
    <circle cx="1460" cy="330" r="4"/><circle cx="1780" cy="116" r="3"/><circle cx="880" cy="820" r="4"/>
    <circle cx="320" cy="940" r="3"/><circle cx="1550" cy="840" r="4"/>
  </g>
  <rect width="1920" height="1080" fill="none" stroke="#4f3028" stroke-width="18" opacity=".22"/>
</svg>`);

const master = await sharp(masterSvg).png().toBuffer();
await fs.writeFile(path.join(outputDirectory, 'puddle-environment-master.png'), master);

const upperMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${boundaryY}" fill="white"/><rect y="${boundaryY}" width="${width}" height="${height - boundaryY}" fill="black"/></svg>`);
const lowerMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${boundaryY}" fill="black"/><rect y="${boundaryY}" width="${width}" height="${height - boundaryY}" fill="white"/></svg>`);

for (const [name, mask] of [['bank-upper.png', upperMask], ['water-lower.png', lowerMask]]) {
  const alpha = await sharp(mask).greyscale().png().toBuffer();
  await sharp(master).ensureAlpha().joinChannel(alpha).png().toFile(path.join(outputDirectory, name));
}

const windLinesSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <g fill="none" stroke="#f4ead4" stroke-linecap="round" opacity=".72">
    <path d="M210 260C440 190 690 238 860 176" stroke-width="18"/>
    <path d="M640 330C890 250 1130 300 1370 222" stroke-width="12"/>
    <path d="M1090 415C1315 345 1510 375 1730 305" stroke-width="15"/>
  </g>
  <g fill="none" stroke="#a84b3b" stroke-linecap="round" opacity=".62">
    <path d="M320 300L420 262" stroke-width="8"/>
    <path d="M920 350L1030 310" stroke-width="7"/>
    <path d="M1460 420L1575 378" stroke-width="8"/>
  </g>
</svg>`);
await sharp(windLinesSvg).png().toFile(path.join(outputDirectory, 'wind-lines.png'));

console.log(`derived registered environment at ${outputDirectory}`);
