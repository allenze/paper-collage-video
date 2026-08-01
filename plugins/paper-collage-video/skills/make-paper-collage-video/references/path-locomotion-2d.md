# Two-Dimensional Path Locomotion

Read this when a recurring subject must swim, fly, run, or otherwise travel
through arbitrary two-dimensional directions in one continuous world. This is
the first-class route for curved travel with automatic heading and a bound
limited-animation cycle. It is not a pile of position keyframes and rotated
duplicates.

## Authoring Contract

Author two orthogonal treatments on the same target:

1. one or more `state-sequence` treatments define the registered locomotion
   family, state timing, `playback=loop`, and `cycles`;
2. exactly one `path-locomotion` treatment with
   `changeClass=path-travel` defines the route and camera decision.

The path treatment owns:

- `path.kind=cubic-bezier-2d`;
- `coordinateSpace=parent-normalized`;
- one start point and one or more cubic segments;
- a normalized arc-length `progress` schedule from distance `0` to `1`;
- `orientation.mode=path-tangent`;
- the source artwork's `forwardAngleDegrees`;
- bounded heading smoothing and maximum turn rate;
- `cameraFollow`, explicitly either one follow object or `null`.

The first path progress time equals the containing beat's `at`. Use progress
keyframes to ease or hold distance; do not bake timing into a dense list of
position samples. The runtime builds an arc-length table, so equal distance
progress produces visually even physical speed across segments and aspect
ratios.

The source state family has one canonical forward axis. `forwardAngleDegrees`
maps that axis onto the path tangent. Do not generate up/down/diagonal copies
merely to cover eight directions. Direction-specific states are justified only
when the silhouette or semantics truly change, such as a banking wing,
side-specific prop, or asymmetric face that rotation cannot preserve.

## Runtime Ownership

`node.motion.path` owns additive parent-normalized `x`/`y` and path-derived
rotation. The target keeps its stable base position in `transform.x/y`.
Therefore:

- the path target must be a `state-sequence`;
- its ordinary keyframes must not author `offsetX`, `offsetY`, or `rotation`;
- its static `transform.rotation` remains zero;
- its idle preset may only be `still` or `breathe`;
- one state loop supplies the swimming/flying/running cadence while the path
  independently supplies translation and heading.

Path tangent and arc length are resolved in physical parent pixels, not square
normalized space. This prevents diagonal headings from drifting when the same
route is rendered at 16:9, 9:16, and 1:1. Heading is unwrapped across
`-180/180`, smoothed, and rate-limited before rendering, so a closed path can
turn continuously without a full-circle snap.

## Coherent World and Camera Follow

Use one oversized top-level world node when the camera must follow the subject.
The same path target must also be top-level. `camera.follow` binds:

- `targetNodeId` to the path target;
- `worldNodeId` to that one coherent world surface;
- normalized subject framing;
- optional look-ahead and smoothing;
- fixed zoom;
- normalized `worldBounds`.

The runtime follows the same resolved path used by the subject and clamps the
viewport to `worldBounds`. Do not duplicate the route as camera keyframes, swap
backgrounds during travel, or combine follow with camera keyframes. A finite
two-dimensional pond, sky, room, or map uses this contract; a horizontally
repeating road still uses `looping-environment`.

## Executable Spatial Proof

Every path treatment requires one root `spatialContracts[]` record with
`kind=path-locomotion`. It binds the scene, path node, world node, start/end
proofs, explicit turn proofs, locomotion state ids, minimum cadence, minimum
travel, minimum direction-sector coverage, maximum heading error, maximum turn
rate, and whether camera follow is required.

The deterministic evaluator samples every frame and proves:

- real two-dimensional travel over the requested proof window;
- the required subset of eight direction sectors;
- rendered heading against measured physical movement;
- frame-to-frame turn-rate bounds;
- state-loop cadence and continuation through the window;
- exact path/camera/world binding;
- a camera viewport that stays inside the declared world.

Style proof must include start, every declared turn, and end frames plus the
path/heading debug overlay. Human review then checks
`path-travel-clean`, `path-heading-readable`, `turn-continuity-clean`,
`camera-follow-coverage-clean`, and `locomotion-cycle-bound`. A passing render
alone is not evidence that the route, turn, cycle, and world contracts agree.

## Provider and Cost Rule

Generate the smallest complete registered locomotion family, preferably one
2×2 sheet for a four-phase loop. Keep one shared canvas, anchor, identity
reference, and canonical forward axis for every cell. Reuse that family at all
path headings. Local splitting, registration, and orientation correction are
deterministic derivatives; they do not become extra provider calls. If a cell
needs provider repair, retain the complete original sheet as context according
to the normal state-family recovery policy.
