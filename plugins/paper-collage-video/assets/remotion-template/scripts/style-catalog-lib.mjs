import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const STYLE_IDS = [
  'childrens-picture-book-paper',
  'hand-drawn-cutout-explainer',
  'archival-collage',
];

export const loadStyleCatalog = async ({root = DEFAULT_ROOT} = {}) => {
  const catalogFile = path.join(root, 'public', 'style-catalog', 'catalog.json');
  const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
  if (catalog.schemaVersion !== 1) {
    throw new Error('style catalog schemaVersion 必须为 1。');
  }
  if (
    !Array.isArray(catalog.styles) ||
    catalog.styles.length !== STYLE_IDS.length ||
    JSON.stringify(catalog.styles.map(({id}) => id).sort()) !==
      JSON.stringify([...STYLE_IDS].sort())
  ) {
    throw new Error('style catalog 必须恰好包含三个正式视觉风格。');
  }
  const images = {};
  for (const style of catalog.styles) {
    const absolutePath = path.join(root, 'public', style.image);
    const source = await fs.readFile(absolutePath);
    images[style.image] = sha256(source);
    style.absolutePath = absolutePath;
  }
  const fingerprint = sha256(
    JSON.stringify({
      schemaVersion: catalog.schemaVersion,
      version: catalog.version,
      canonicalSubject: catalog.canonicalSubject,
      styles: catalog.styles.map(({absolutePath, ...style}) => style),
      images,
    }),
  );
  return {...catalog, fingerprint, catalogFile};
};

export const styleCatalogDecision = (catalog) => ({
  version: catalog.version,
  fingerprint: catalog.fingerprint,
  styles: catalog.styles.map(({id, label, summary, image, absolutePath}) => ({
    id,
    label,
    summary,
    image,
    absolutePath,
  })),
});
