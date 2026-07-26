#!/usr/bin/env node
import {prepareRegisteredFamilyProof} from './asset-hardening-proof-lib.mjs';

try {
  const {proof} = await prepareRegisteredFamilyProof();
  console.log(
    `✓ F035 registered-family proof: ${proof.localDerivatives} local derivatives, ` +
    `${proof.providerImageCalls} provider image calls, ${proof.avoidedCalls} avoided calls`,
  );
  console.log(`✓ proof sample: ${proof.proofSample}`);
} catch (error) {
  console.error(`proof:registered-family failed: ${error.message}`);
  process.exitCode = 1;
}
