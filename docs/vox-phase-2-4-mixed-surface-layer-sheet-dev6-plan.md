# VOX Phase 2.4 mixed-surface registered sheet — dev.6

Status: implemented for `0.16.0-dev.6`; no provider call is part of this
engineering slice.

## Pilot evidence

The first controlled submarine sheet attempt returned a provider-native
1254×1254 RGB image. Its two cutout cells contained a baked checkerboard and
blue ocean pixels inside the submarine windows and periscope opening. A
project-local threshold script could create an RGBA file, but it could not
distinguish semantic negative space from dark subject detail, created light
edge residue, and recorded the normalized derivative as if it were the provider
root.

That is a reusable architecture gap, not a one-project prompt issue.

## Contract

Registered 2×2 provider roots use `outputSurface.mode=layer-sheet`.

- `reference` and `support-rear` cells declare `opaque`.
- `subject` and `support-front` cells declare `alpha` or `chroma-key`.
- Host models without reliable native alpha default to one flat declared key
  color that is absent from every cutout.
- `sheetLayout.providerSource` may authorize provider-native dimensions and
  requires explicit post-generation source rectangles.
- The provider file is recorded unchanged. Resizing, separator removal, and
  alpha extraction never masquerade as provider output.

Registered-family derivation records and fingerprints:

- the provider source SHA and actual media dimensions;
- each member's source rectangle and destination placement;
- its per-cell source surface;
- exact chroma thresholds, feathering, erosion, and edge padding;
- the adjacent key metadata SHA;
- the shared registration/source package/recovery contract;
- three local derivatives and three avoided isolated calls.

## Runtime and proof

`provider:record` accepts a declared provider-native source canvas only when it
meets the minimum dimensions and every chroma cell contains the declared key
plane. Fake checkerboards and unrelated colors fail before family derivation.

`assets:derive-registered-family` uses the repository chroma-key processor,
writes full-canvas members plus `.key.json`, and includes all source/keying
parameters in the family fingerprint. Quality checks the metadata hash,
transparent coverage, key-colored partial-alpha residue, rectangular alpha
bands, and the existing topology evidence. Composition proof remains
family-level: neutral reconstruction, reference comparison, exploded members,
and both reveal extremes at 16:9, 9:16, and 1:1.

The deterministic F035 fixture now uses a gapped provider-native RGB 2×2 sheet
with magenta subject/front backgrounds, then proves three local full-canvas
derivatives with zero provider calls.

## Pilot resume rule

The first attempt remains consumed and is retained as rejected evidence. The
second approved attempt must not run until source, packaged copy, installed
cache, and fresh workspace all report the dev.6 version and the same
runtime-build fingerprint. The recovery request will use a flat magenta
background in both transparent cells and preserve the complete 2×2 context.
