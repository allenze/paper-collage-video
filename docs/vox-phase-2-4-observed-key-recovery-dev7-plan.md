# VOX Phase 2.4 provider-native observed key recovery — dev.7

Status: implemented for `0.16.0-dev.7`. Engineering provider budget is zero.

## Root cause

Host image models can follow the semantic instruction “flat magenta
background” while returning a stable near-magenta plane instead of exact
`#ff00ff`. Exact-RGB validation therefore rejected an otherwise locally
recoverable complete 2×2 source. Blindly widening the key tolerance would mix
validation with extraction and could accept gradients, checkerboards, shadows,
or foreground colors.

## Vertical contract

- Schema-v7 provider-native chroma cells declare
  `provider-native-observed/flat-v1`.
- Runtime measures requested-color distance, coverage, boundary coverage,
  cluster p95/p99, largest connected component, foreground separation, and
  inter-cell observed-color distance.
- Accepted provider records bind requested and observed colors, all metrics,
  the policy fingerprint, source SHA, and observation fingerprint.
- Registered-family derivation keys only from the accepted observed color and
  copies that provenance into the binding and adjacent `.key.json`.
- Quality requires both the key-metadata SHA and the observation fingerprint
  to remain current.
- A rejected historical output may be checked and recorded as
  `recovery-source` only through a schema-v1 recovery spec. The original
  attempt remains rejected and consumed; the append-only ledger is neither
  rewritten nor appended.

## Deterministic proof

Positive proof uses a complete provider-native 2×2 RGB sheet whose keyed cells
are stable `#fa02ce` and `#fa03cd` planes requested as `#ff00ff`. Negative
fixtures cover gradients, checkerboards, and multi-cluster surfaces.
Recovery proof checks the rejected ledger byte-for-byte before and after
manifest registration, derives the three full-canvas members, and reports one
historical provider root, three local derivatives, and three avoided isolated
calls.

## Pilot boundary

This engineering slice does not call image, voice, or video providers, does not
increase the approved attempt limit, and does not start the final reference
sample. Only after source, packaged plugin, installed cache, and a fresh
workspace share the dev.7 runtime identity may the submarine attempt-2 raw file
be evaluated with the read-only recovery command.
