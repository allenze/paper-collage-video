# Paper Collage Video 0.15.0-dev.1

This development release closes the reusable VOX-style editorial primitive
slice without requiring a text-to-video provider. It upgrades the current
project and storyboard contract to v8 and binds authoring, compilation,
runtime, validation, proof, packaging, and documentation to the same behavior.

## Highlights

- One intent-routed scene boundary protocol with authored rhythmic and impact
  cuts, while normal narrative boundaries keep deterministic opaque animation.
- Camera-coupled parallax that applies the global camera once and separates
  authored depth planes without breaking registered relationships.
- First-class deterministic `motif-field` nodes with explicit bounds,
  title/face/data exclusion zones, footprint clearance, 64 instances per field,
  and a 192-instance aggregate scene ceiling.
- Seamless drift/orbit loops and invisible respawn edges for fall/burst fields;
  `cycles` now controls every preset.
- A six-second, no-provider VOX engineering sample plus
  `npm run sample:vox:verify`, which produces a fixed-frame contact sheet and a
  fingerprinted proof report.
- Source and packaged plugin validation share the same runtime-build identity.

## Compatibility

- New projects use project and storyboard schema v8. Older projects are
  intentionally not migrated or silently downgraded.
- A v8 motif field must declare `bounds` and `exclusionZones`; the compiler and
  runtime must match preset, distribution, count, cycles, bounds, and zones.
- Start a new Codex task after upgrading so the new Skill snapshot is loaded.

This release contains reusable source, the packaged Plugin, and technical test
fixtures only. The generated VOX MP4 and proof artifacts remain local build
outputs and are not bundled as production media.

## Install

Give Codex the repository URL, or run:

```bash
codex plugin marketplace add cyberlesterr/paper-collage-video
codex plugin add paper-collage-video@paper-collage-video
```

Start a new Codex task and invoke `$make-paper-collage-video`. The Plugin will
create a writable workspace outside its installation cache and run environment
diagnostics before production begins.

## Requirements and Support

- Node.js 20 or newer
- FFmpeg and ffprobe
- Python 3.11 or newer for image processing and proof generation
- macOS and Ubuntu are validated; Windows support is currently best effort

Image and voice generation require capabilities or provider accounts selected
by the user. The project does not publish generated media automatically.

## Licensing

The software is MIT-licensed. Bundled showcase and fixture media is excluded
from MIT and is limited to repository demonstration, testing, and evaluation;
see `ASSET_LICENSES.md`. Remotion and other dependencies retain their own
licenses, including Remotion's Company License requirements in some commercial
use cases; see `THIRD_PARTY_NOTICES.md`.
