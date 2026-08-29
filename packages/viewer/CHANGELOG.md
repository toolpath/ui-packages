# @toolpath/viewer

## 1.0.0

### Major Changes

- 1a5daaf: **`<Viewer>` now opens orthographic.** `projection` defaults to `"orthographic"` where it defaulted
  to `"perspective"`, so every consumer who has never passed the prop gets a different camera — and
  nothing about the call site changes, which is exactly what makes it easy to miss. Pass
  `projection="perspective"` to keep what you had.

  It is what a machinist reads a part in: parallel edges stay parallel, so a wall that looks square is
  square, and two features the same size measure the same size wherever they sit. Perspective stays
  available and stays the better answer for reading a deep pocket as depth.

  The default moved last rather than first. The orthographic path had never been switched on by a
  consumer, and turning it on found an unbounded wheel in both directions and in both projections;
  that is fixed, the pivot can no longer walk off the part, and the gestures that re-aim it — a double
  click on a face, `showOrbitTarget` to see where it is — landed before this flipped.

  Two things that do **not** change: the opening view direction under orthographic is its own, already
  distinct from the perspective one, and every named view, the section handle, the scene aids and
  feature framing behave the same under both cameras.

- 1a5daaf: **Double-clicking the part now orbits about what was clicked, and it is on by default.** A consumer
  who upgrades and passes nothing gets a double left click that moves the camera where one previously
  did nothing to the view. `<Viewer retargetOnDoubleClick={false}>` turns it off. Double **middle**
  click still re-frames.

  The point moves to the middle of the view at the same size and from the same angle, and stays the
  pivot until something else moves it — which is what makes an orthographic viewport navigable, since
  the wheel there scales a frustum rather than travelling toward anything.

  The move is immediate rather than eased. The damping these controls ship with settles a transition
  inside one frame, so nothing about the gesture announces itself; turn on `showOrbitTarget` if the
  pivot moving needs to be visible.

  **`PartPick` gains `doubled`, a required `boolean`.** Reading it is safe, but anything that
  _constructs_ a `PartPick` — a fixture, a mock, a test double — stops compiling until the field is
  supplied. It is true on the click that completed a double click. The gesture does not withhold that
  pick: what a second click on a face means belongs to the app — a list that walks through a face's
  readings and an editor that puts a face in and takes it out again both want something different, and
  only the app knows which it is showing. Reported rather than interpreted, the same bargain
  `modifiers` makes.

  A double click also no longer pairs across a trip away from the part. Clicking a face, pressing
  something in a panel and clicking the same face again is three gestures, and it lands well inside
  the pairing window; `DoubleTapTracker.reset()` is how a caller says the pair was broken by something
  the clock cannot see.

### Minor Changes

- 340ed33: Make `frameBox` reach the framing it was asked for.

  The wheel clamps land on the scene's fitted framing, and a view of something
  much smaller than the part is nowhere near it — framing a 3 mm hole in a 100 mm
  plate needs about 37× and the ceiling is 10×. Both cameras refused it, in
  opposite directions. Under an orthographic camera `zoomTo` clamped to `maxZoom`,
  so the feature was framed at roughly a quarter of the size requested and the
  call reported success. Under a perspective one `setLookAt` writes the distance
  without consulting `minDistance` while the wheel's own dolly enforces it, so a
  close framing stood until the first notch of the wheel and then jumped
  _outward_, against the gesture.

  `frameBox` now re-derives the clamps about the framing before reaching for it.

  `cameraLimits` takes an optional fifth argument for this: the bounds the view is
  framed on, when that is not the whole scene. The band is widened to take in both
  rather than moved onto the framing — reaching further in must not cost the reach
  back out, or framing a hole would put the part that contains it beyond the
  wheel. Called without it the function is unchanged, and a framing the size of
  the scene gives the scene's own band back.

  The orbit target's boundary still comes from the scene, so panning off a framed
  feature still works.

  The widening survives a resize. The clamps are re-derived whenever the viewport
  changes — a window drag, a panel opening, a sidebar toggle — and that
  re-derivation used to fall back to the scene's own band, undoing the framing.
  Nothing moved at the time, because `camera-controls` clamps at its call sites
  rather than in `update`, so the symptom arrived on the next wheel notch as
  exactly the two failures above.

- 1a5daaf: `<Viewer showOrbitTarget>` puts a small marker — a dot inside a ring — at the point the view turns
  and zooms about. It is up while a gesture is running, flashes when the pivot moves on its own (a
  cursor zoom walking it, a double click re-aiming it, a Fit putting it back), and fades. **Off by
  default**, because it is an aid rather than furniture and a viewer that grew a dot in the middle of
  every screenshot would be a surprise.

  It answers "why did the part swing that way", which nothing else on screen does, and it makes a
  wheel that has carried the pivot off the part legible while it is happening rather than afterwards.
  Sized in CSS pixels through the same `screenLength` the section handle uses, so it holds its size
  under both cameras.

- 1a5daaf: Bound how far the viewer's wheel may travel, so it can no longer leave the
  viewport empty.

  Both cameras could do it. An orthographic `camera.zoom` reached 1e30 in sixty
  notches and a perspective camera dived inside the part in eight, because
  `minDistance` defaulted to `Number.EPSILON` and `maxZoom` to `Infinity`. Fit
  recovers from either, but Fit is a double middle click that nothing on screen
  advertises.

  One rule now covers both: the wheel may take the part from a quarter of its
  fitted size to ten times it. Under an orthographic camera that scale is the
  frustum, so it lands on `zoom`; under a perspective camera apparent size is the
  inverse of distance, so it lands on `distance`.
  - New `cameraLimits(projection, size, bounds, margin?)` and `targetBoundary(bounds, into, margin?)`
    in `render/camera.ts`, both pure and derived from the scene bounds, plus the
    `CameraLimits` type and the `MIN_FRAME_RATIO` / `MAX_FRAME_RATIO` constants.
  - New `ExtendedCameraControls#applyLimits(limits, boundary?)`. `Viewer` calls it
    wherever the scene is re-measured or the viewport resized, so a second part
    does not inherit the first one's idea of far.
  - The orbit target is confined to a boundary. Zoom-to-cursor moves the target
    and went on moving it after the zoom clamp bit — forty notches walked the
    target of a 50 mm part out to (2124, −2697), which no zoom clamp can catch.
  - `dollySpeed` 1.15 and `restThreshold` 0.005, matching the legacy viewer. The
    wheel step is only tolerable alongside the clamps, so the two land together.

### Patch Changes

- 340ed33: Declare the supported Node version. Both packages now carry `engines.node: ">=20"`, matching
  `@toolpath/api` and `@toolpath/tool-scraper` and the ES2022 output they already build.
- 340ed33: `useTapGuard` now shares one tracker per canvas.

  Each call used to attach its own capture-phase `pointerdown` listener to the canvas and record the
  same point from it, and the viewer makes two calls — one in the scene to judge a middle-button
  gesture, one on the part to judge a click on a face. A consumer calling the hook inside `<Viewer>`
  made a third. They all answered identically, so this changes no verdict; it is one listener per
  press instead of one per caller.

  Called outside a `<Viewer>` the hook still owns a tracker of its own, so using it in a scene of your
  own is unchanged.

  `screenLength` moves from `render/section.ts` to `render/camera.ts`. It is a camera and viewport
  utility rather than a section-view one, and both the section handle and the orbit target marker size
  themselves with it. It is exported from the package root exactly as before — same name, same
  signature — and the package has no deep import paths, so nothing downstream moves.

- 1a5daaf: Fixed the opening view arriving rolled off `CAD_CAMERA_UP`.

  Every part opened turned about 51° about the view axis, in both projections.
  Nothing else was wrong — camera position, orbit target, distance, zoom and the
  clipping planes were all exactly the fitted start pose — which is why it read as
  "the part is oriented oddly" rather than as a camera fault, and why only a
  click-on-the-part test caught it.

  Two causes, both about `up` being inherited rather than stated:
  - **The camera limits were applied before the pose they belong to.** `measure()`
    applied them, so `frame()` ran a `setBoundary` at the top — and `setBoundary`
    marks the controls for update, while an update under free orbit re-derives the
    up vector from wherever the camera is looking _now_. Ahead of the look-at that
    is the outgoing pose. The `Viewer` resize effect did the same at mount, with
    `defaultBounds()`: a unit sphere at the origin, so a part sitting anywhere else
    was handed a target boundary a few millimetres wide around a point it does not
    contain. `measure()` is now a measurement only, `frame()` applies the limits
    after the look-at, and the resize effect waits for the opening frame before
    applying them. The clamps themselves are unchanged and still re-derive
    wherever the scene is re-measured.
  - **A reset did not square the up vector.** `resetContent` — which is the opening
    frame, the Reset control and the reframe on a projection switch — passed no
    `up`, so a roll had no way back. It now passes `CAD_CAMERA_UP`, which is what
    the legacy viewer does at the same point. Fit and Zoom to still keep the
    orientation they were given, deliberately.

  Also exported `adaptedUp(view, up, into)` from `render/camera.ts`, the pure
  re-squaring the controls run on every update. It is a projection and therefore
  path-dependent — a camera carries the roll of every pose it has passed through —
  which is the reason a canonical pose has to state its own `up`. `ExtendedCameraControls`
  now calls it, so the property is pinned by a test rather than by a comment.

- 340ed33: Fix four gesture defects in the orthographic viewer work.

  A double click built its pick **after** re-aiming the orbit. `retarget` calls
  `setLookAt`, which writes the controls' _end_ target, and the pick reads that
  same end value back — so the pick's view direction came out as
  `camera.position - hitPoint` rather than `camera.position - orbitTarget`. On a
  face near the edge of a framed part that is degrees away from the direction
  the eye is looking along, and a double click could rank a different owner than
  a single click on the very same face. The pick is now built first.

  The middle-button re-centre had no drag guard, and the middle button is TRUCK:
  every pan ends in the `auxclick` the gesture is assembled from, so two pans
  released near enough to each other paired into a double, called Fit and threw
  away the pan just made. It now takes the same tap guard the left button has.

  `retarget` paired `camera.position` — where the camera has got to so far —
  with the controls' _end_ target. While an earlier transition was still easing,
  the camera-to-target offset it exists to preserve was wrong by whatever was
  left of that move and the view shifted instead of holding the angle and
  distance it had. Both halves of the pose now come from the controls.

  An orbit released over the part left its double-click pair pending. The click
  guard swallows that release, and it returned before the pairing tracker was
  touched, so a click, an orbit, and a click within the double-tap window of the
  _first_ one paired those two and re-aimed the view with a whole drag in
  between. The pointer leaving the mesh already broke the pair, but an orbit over
  a part that fills the viewport never leaves it. A swallowed release now breaks
  the pair too.

## 0.4.0

### Minor Changes

- 5a79ced: Report which faces touch which, zoom to the cursor, and re-frame on a double click.

  `regionAdjacency` reads the mesh and returns, for every region, the regions sharing
  an edge with it — enough to draw a feature by clicking one face and letting it
  follow the surface. `PartMesh` takes an `onAdjacency` callback and computes it once
  per mesh rather than per query.

  `Viewer` gains `zoomTo`, which chooses whether the wheel zooms toward the cursor or
  the centre, and `recentreOnDoubleClick`, which re-frames the part on a double
  **middle** click — the way back from having zoomed into a corner, which zooming to
  the cursor makes easy to do. On the middle button because double left click is where
  a viewer usually puts "orbit about this from now on", which is still to come. It is
  paired from single presses by `trackDoubleTaps`, also exported, because `dblclick`
  fires for the primary button only and there is no middle-button equivalent.

  `DirectionArrows` accepts a list for `shownDirection` as well as a single index, so
  more than one way up can be shown at once.

  Two behaviour changes worth knowing about, neither an API break:
  - **A part rebuilt on the same geometry used to blank the new one.** A consumer
    whose report changes identity — a feature added, a re-fetch — rebuilds against the
    same cached mesh, and React builds the new part during render before disposing the
    old. The old part's `dispose` deleted the region attribute unconditionally,
    including the one the new part had just set, so every vertex fell back to texel 0:
    the whole part in one flat colour with hover, selection and every wash gone.
    `dispose` now removes the attribute only if it is still the one that part set.
  - Five of the nine `DIRECTION_COLORS` are retuned so neighbouring directions stay
    apart when the part is washed by direction. Same export, same length, same type —
    but anything hard-coding a hex or screenshot-testing the part will see it.

- 9949a51: Square the view when a view cube panel or a named view is chosen. The camera's
  up vector was never set, so with free orbit re-deriving it from the pose being
  left, the roll built up by dragging survived the jump and the part arrived at
  the right angle but tilted. Adds `squaredUp`, which picks whichever of a view's
  four square rolls is nearest the camera's current one, so a view is reached
  without the part spinning on the way to it.

### Patch Changes

- 2dc3546: Update published package repository links after the repository rename.

## 0.3.1

### Patch Changes

- 4cd6dca: Update the Engine response type referenced in viewer documentation.

## 0.3.0

### Minor Changes

- 881679a: Use Engine split-origin metadata to remove analysis-only seams from edges and shading without expanding feature highlights beyond their owned regions.
