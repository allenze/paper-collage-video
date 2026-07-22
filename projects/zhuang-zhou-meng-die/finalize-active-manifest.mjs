import fs from 'node:fs/promises';
import path from 'node:path';

const file = path.join(import.meta.dirname, 'assets-manifest.json');
const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
const supersededAssetIds = new Set([
  'zhuang-butterfly-style-master',
  'butterfly-flight-sheet-v2',
]);

manifest.assets = manifest.assets
  .filter(({assetId}) => !supersededAssetIds.has(assetId))
  .map((asset) => {
    if (asset.assetId !== 'butterfly-flight-sheet-v3') return asset;
    const references = asset.semanticBinding?.generationFamily?.referenceAssetIds ?? [];
    const activeReferences = references.filter((assetId) => !supersededAssetIds.has(assetId));
    const requestReferences = asset.request?.semanticBinding?.generationFamily?.referenceAssetIds ?? [];
    const activeRequestReferences = requestReferences.filter((assetId) => !supersededAssetIds.has(assetId));
    const updated = structuredClone(asset);
    delete updated.stateSheetRecoveryBinding;
    if (updated.request) delete updated.request.stateSheetRecoveryBinding;
    if (updated.semanticBinding?.generationFamily) {
      updated.semanticBinding.generationFamily.referenceAssetIds = activeReferences;
    }
    if (updated.request?.semanticBinding?.generationFamily) {
      updated.request.semanticBinding.generationFamily.referenceAssetIds = activeRequestReferences;
    }
    return updated;
  });

await fs.writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`active-manifest: removed ${[...supersededAssetIds].join(', ')}`);
