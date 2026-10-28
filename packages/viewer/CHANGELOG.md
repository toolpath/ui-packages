# @toolpath/viewer

## 3.0.0

### Major Changes

- f3b6381: `MeasureTool` measures by what is clicked, and it measures a cut part as the cut leaves it.

  **Breaking.** `MeasureTool` now mounts inside `PartMesh` or `EnginePart`, as their child, not
  beside them in `Viewer`. Mounted outside one it throws when it renders, which a type check does
  not catch. It has no `mode` and no `showDeltas`. `measurements` and `onChange` are
  `readonly MeasureGroup[]`, each one pick or two, not `Measurement[]`. Labels have
  `data-measure-label` `face` or `delta`; `distance`, `angle`, `live` and `data-measurement-id` are
  gone. It has no `theme` prop: its colours are its own, one per measurement for the readouts and a
  fixed blue for the hover tint and snap ring. The `measure` theme colour now colours only
  `ToolMarks`, and the `measureSnap` theme colour is unused and deprecated. A `ViewCube` that is not
  at its default place is named by the new `viewCube` prop (`alignment` and `margin`, or `null` for
  no cube), so the tool leaves its clicks alone.

  A click on a face takes the whole face, and on a hole the whole hole. With Alt (Option) held, a
  click places a point, snapped to a corner, the middle of a straight edge, or an edge. A second pick
  is read with the first where the two make a dimension: point to point, point to plane, plane to
  plane (gap or angle), and a hole's centre line to a plane. Shift keeps what is on screen; Delete
  drops the last pick; a click off the part clears them all. Before a click, the face under the
  pointer is tinted, and a caption with class `toolpath-measure-hint` (`MEASURE_HINT_CLASS`) says
  what a click there takes. Each measurement has its own colour, set on its labels as
  `--measure-color`. A click on a label copies its number and marks the label `data-copied`.

  On a section cut, the cut face is solid to the tool: an Alt point lands on it and snaps to the
  corners of its outline, and the faces and corners behind it are not offered.

  `MeasureGroup`, `MeasurePick`, `MeasuredFace` and `MeasuredPoint` are exported.
  `MEASURE_LABEL_CLASS` and `MeasureLabelKind` are still exported from the root. The old tool's
  helpers (`snapAt`, `measurementFromPoints`, `measurementLabel`, `Measurement`, `MeasureMode` and the
  rest of `render/measure.ts`) are still exported, unchanged, for custom tools.

## 2.8.0

### Minor Changes

- 6120f6c: `ToolDock` is a toolbar for more tools than fit on a bar, in one of two layouts: `spread`, with the
  pinned tools on the bar and every tool under All tools; or `grouped`, with the pinned tools beside a
  menu for each group. A tool can be pinned from All tools or its menu, and both layouts share the
  pins. `defaultLayout` picks the layout an app opens in, and `ToolDock.LayoutToggle` lets people
  switch. Every menu and panel opens 4px above the bar, and `ToolDock.useBarPopout` puts an app's own
  popup there too. The dock and its menus are dark in either theme, and `ToolDock.Tooltip` gives an
  app's own control the dock's tooltip. `viewerToolGroups` in `@toolpath/viewer` gives the viewer's
  toolbar controls in groups, with labels, notes and icons, ready for the dock; an app can rename a
  tool or replace its note. `Toggle` takes an `aria-label`.

## 2.7.0

### Minor Changes

- e35f7bb: `KnownFeatureType` includes `circular_wall`, which Engine API 1.34.0 reports for the outside of a
  whole cylinder standing along its machining direction: a stud, a round boss or a turned part's
  outline. `FEATURE_TYPE_RANKS` ranks it with the bosses, so a click on a face it shares with a
  chamfer, fillet or wall selects the circular wall. Unranked, it went after chamfers and fillets.

## 2.6.0

### Minor Changes

- de43e9e: Add `ExplodedPart` and its primitive input and picking types. Applications supply
  surface groups, stable IDs, translation vectors, colors, and explosion amount;
  the viewer renders and picks those groups without choosing features or machining
  directions. Includes batched rendering, source highlights, shader preparation, and
  buffer reuse across visibility and theme changes. Accepts `ViewerTheme` overrides
  for source geometry, outlines, selection/hover tints, and the selected piece's source
  surfaces (`picked`). Accepts `activeDirection` to rank picks for one machining direction, as
  `PartMesh` does. Prepares each piece from
  surface geometry directly, without copying feature models. Grouping rules, animation controls, and
  application metadata remain with the consumer.

  Accept multiple selected or hovered group IDs (`ExplodeGroupIds`) so applications can treat render chunks as one
  logical piece, including its complete source highlight. Redraw after shader preparation when
  layouts change in a demand-driven canvas.

  Support per-region colors (`ExplodeRegionColors`) within each application-defined explosion group, preserving whole-piece
  selection and picking without separate surface groups. Add `createExplodeAmount` for imperative
  animation updates that automatically redraw demand-driven canvases while keeping playback
  timing application-owned.

## 2.5.0

### Minor Changes

- accd9e9: `<PartMesh>` and `<EnginePart>` now draw threads in the holes they are cut in, with the new
  `threads` prop: each `ThreadMark`'s pitch (negative for a left-hand thread) as a helix of light and
  shade over the hole's bore. The Engine cuts a modeled internal thread out of the mesh, so a tapped
  hole otherwise shows as a plain bore. `threadMark(feature, datasheet)` from
  `@toolpath/viewer/engine` reads the mark from a hole's Engine datasheet, and
  `ViewerToolbar.ThreadsButton` toggles it through the new `threads` toolbar control.

## 2.4.0

### Minor Changes

- 051dea1: `<Viewer>` now shows an alert asking the user to turn on graphics acceleration when the browser
  cannot create a WebGL context, instead of throwing and leaving a blank viewer. Replace the message
  with the new `webglUnavailable` prop; the alert carries the `viewer-webgl-unavailable` class.

## 2.3.3

### Patch Changes

- 2cd3d9f: Stop failed mesh downloads from repeatedly restarting under Suspense. Preserve
  the failure for the error boundary, allow refreshed signed URLs to retry, and
  continue sharing successfully loaded geometry by artifact path.

## 2.3.2

### Patch Changes

- 66217e4: Document viewer setup, complete integration examples, selection identity, geometry
  ownership, toolbar and tool controls, stock sources, and Engine loading/recovery.

## 2.3.1

### Patch Changes

- 6c7d5b6: Build a large stock mesh's outline in slices between frames, so showing in-process stock no longer freezes the page. `<Stock>` used to build its 15° outline with one `EdgesGeometry` call the first time a mesh was shown; stock cut by a fine tool holds hundreds of thousands of triangles, and that call blocked the main thread for 450–600 ms each time a new action's stock appeared. Meshes over 20,000 triangles now build the same lines — `EdgesGeometry`'s own walk, keys and output order — in 4 ms slices, and the outline joins the stock once built; smaller meshes build at once as before. A disposed stock stops its build. `createStock` takes an optional `onEdges` callback, called when a sliced outline is added, which `<Stock>` uses to redraw.

## 2.3.0

### Minor Changes

- 5ecda52: Add sharp corners: `sharpCorners` on `<PartMesh>` and `<EnginePart>` draws the sharp corners of the features the DFM rules flag (`featureSheet(datasheet).sharpCorners` from `@toolpath/dfm/model`) as red bands painted on the faces either side, strong in view and faint through the part. The rules decide which corners; the mesh only locates each flagged feature's inside corners along its machining direction. `ViewerToolbar.SharpCornersButton` turns them on and off from a new `sharpCorners` toolbar control. With hover on, the corner under the pointer takes the hover colour and is reported on the pick as `pick.sharpCorner` — its feature, ends, length and the angle between its faces — for a hover card to describe. Adds the `sharpCorner` theme colour, and exports `surfaceCreases`, `findSharpCorners` and `sharpCornerPositions`.

## 2.2.1

### Patch Changes

- e3366b3: Draw direction arrows and the section handle as single, softly shaded meshes — a straight cone head, slim shaft and rounded tail — instead of flat-coloured cones on cylinders.

## 2.2.0

### Minor Changes

- cb8c5f2: `ViewerToolbar.DfmButton` shows or hides an application's DFM flags on the part, from a `dfm`
  toolbar control: "Show DFM flags" / "Hide DFM flags", with a warning-octagon icon. The standard
  toolbar places it after the direction highlight button when a `dfm` control is given.

## 2.1.0

### Minor Changes

- ce6b5a3: `<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
  `usePartContext()`.

  `featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
  plain arrays.

  `<ToolMarks>` draws cutting tools on the part to scale — an end mill, flat, bull nose or ball, or any tool by
  its `profile` — with a dimension and a label each, in the measure tool's style. `ViewerToolbar.ToolsButton`, on a `tools` control,
  shows and hides them.

  `@toolpath/dfm/model` adds `brokenRules` and the neutral `BrokenRule` row a feature's details list, `featureColor`
  for the colour a feature is painted, and the `FeatureRecord` type for a feature's raw report entry and datasheet.

  `pinchMark` and `pinchLabel` read the pinch discs a feature's widest tool stands in, and `placePinchTool` finds
  the datasheet's tool frame against the feature's faces and places that tool on the part, as plain vectors for
  `<ToolMarks>`.

  `FoldStore` and `storageFolds(storage, prefix)` keep which of the feature panel's sections are open, in a storage
  and under a key prefix the app chooses.

  `<FeatureDetails>` shows one feature as the Engine read it: its name and machining direction, the rules it breaks,
  its measurements and milling considerations with how each was measured, and its reach. It takes loading and
  failed reads with a Retry, slots for the app's own buttons and status, an optional REQUIRED pill and "Show this
  feature", and a `look`. `featureMeasurements` takes `inchMark`
  to write inches as `0.46"`.

  It also lists every field of the feature's datasheet and shows its raw API record, with a copy button.

  With `PopOut`, the app's own window component, the reach, the datasheet fields and the raw record pop out, larger,
  into it.

  `<CandidateList>` lists the features a clicked face could mean, with each one's colour, rule count, REQUIRED pill
  and the app's detail, note and action, chosen by click or by `candidateListKeys`.

  `<ComparisonTable>` sets the features several faces were read as side by side, marking the rows where they differ.

  `<FeaturePanel>` is the whole card: a clicked face's candidates, several faces compared under letters, and the
  read feature's details, with Escape and the arrow keys. The app places it.

## 2.0.0

### Major Changes

- 6d4a91f: Consolidate stock rendering into `Stock`, accepting exactly one of `geometry`, `glb`, `box`, or `cylinder`. Box and cylinder inputs accept either resolved placement or part-relative preview options, with placement calculated internally. Resolved box figures support optional setup frames; resolved cylinder figures support arbitrary axes. Fetching, caching and artifact storage remain caller-owned. Stock outlines are built only when shown.

  Remove `BoxStock` and `BoxStockProps`. Replace `<BoxStock partGeometry={geometry} allowance={allowance} />` with `<Stock box={{ partGeometry: geometry, allowance }} />`; for explicit dimensions use `<Stock box={{ partGeometry: geometry, dimensions, position, positionOffset, offset }} />`. Preview builders are internal, and inline options do not cause repeated part scans on ordinary renders. Existing `<Stock geometry={geometry} />` usage is unchanged.

  `StockProps` is now a union type alias rather than an interface, so `interface X extends StockProps` no longer compiles; write `type X = StockProps & { … }` instead. Use `StockAppearanceProps` for the shared appearance props alone.

### Minor Changes

- a2fc359: Add optional `Stock` `retainPrevious` behavior to keep the current GLB visible until its replacement finishes decoding. Dispose replaced geometry after the swap, and discard cancelled decode results.
- a2fc359: Add a `legacy-workpiece` render style to `Stock`, reproducing legacy white/emissive shading, 20% opacity, two surface passes and edges drawn before surfaces. Add optional `emissive` and `flatShading` appearance props. Existing overlay defaults and source geometry remain unchanged.

## 1.5.0

### Minor Changes

- 321a9e1: Add a bundled banana-for-scale model while preserving feature hover by default.
- aec1aaa: Support explicit fixed-box dimensions and top/bottom positioning for box stock.
- 233a800: Add translucent stock meshes and allowance-based box stock, a semantic-edge wireframe display, and deterministic machining-direction face highlights. Fit includes stock while part-relative tools and overlays remain sized to the finished part.
- aec1aaa: Support separate wall and floor stock-to-leave values for box stock.
- e3082e3: Add CAD navigation presets for Alias, Fusion, Inventor, Onshape, PowerMill, SolidWorks, and Tinkercad.
- 649db22: Add a cursor-following hover-card primitive, browser pointer coordinates on part picks, and a
  hover toggle that preserves face picking.
- ce60e14: Add a visible section-plane gizmo with direction-coloured handles, a two-way drag handle, and
  physical cut measurement. A custom `sectionHandle` theme colour still overrides the direction
  colour.
- ba19c5e: Add a viewer-scoped, composable toolbar with camera, display, analysis, and banana-for-scale controls.
- ec853b8: Add opt-in selection-driven X-ray focus rendering for part meshes.

### Patch Changes

- d72ab8b: Keep focused feature regions opaque in X-ray rendering and copy the bundled banana asset in watch builds.
- 781178c: Keep far-side focused geometry visible through the faded part.

## 1.4.0

### Minor Changes

- 3766a17: `<MeasureTool>` mounted beside a `<SectionTool>` that has no cut yet offers no snap and places no
  point until a cut is chosen or the section tool is unmounted, so the click that picks a cut is not
  also the first point of a measurement. `SectionStore` gains `isPicking` and `setPicking`, which the
  section tool raises while it offers a cut.

## 1.3.0

### Minor Changes

- 0da7780: `<MeasureTool>` measures a cut part as it is seen. While it is mounted it re-samples the part
  whenever a clipping plane moves: the half a cut has removed is not offered for snapping, the part's
  edges stop at the plane, the outline where the plane passes through solid material is an edge with
  corners of its own, and the capped face is a surface a point can land on. The plane is read off the
  part material's clipping planes, so the viewer's own cut and a controlled `section` prop work the
  same way, and the sample is keyed on the plane so a dragged handle or a set depth is re-sampled on
  the next pointer move.

  `sectionContour`, `clipSegments`, `pointInContour`, `capHit` and `sampleSection` are the pure
  functions behind it, exported from the root with the `SectionSample` type.

## 1.2.0

### Minor Changes

- ae738a5: Add `<MeasureTool>`, an opt-in way to measure a part from inside the viewport. Mounted beside
  `<PartMesh>` with nothing wired, it snaps the pointer to the corner, edge midpoint, edge or face
  under it and shows where a click will land; two clicks measure a distance, shown with its X, Y and Z
  parts as dashed legs, and three measure an angle. Finished measurements stay drawn over the part
  with a DOM label each until Delete removes the last one or the tool is unmounted; Escape drops the
  points of one in progress, and Shift holds the next point to the X, Y or Z line through the last.
  `measurements` and `onChange` make the list the consumer's, and `format` writes lengths in something
  other than millimetres. The labels are DOM elements and ship unstyled: each carries
  `MEASURE_LABEL_CLASS`, a `data-measure-label` kind, `data-axis` on a delta leg and
  `data-measurement-id` on a finished measurement, and `labelClassName` adds a class of the consumer's.

  While the tool is mounted, `<PartMesh>` reports no hovers or picks, as it does for `<SectionTool>`.
  The engaged flag both tools set on the section store is now counted, so the two can be mounted
  together and the part waits for the last to leave.

  `ViewerTheme` gains `measure` for a measurement's lines, markers and label border, and
  `measureSnap` for the snap indicator. `AXIS_COLORS`, the three axis hues the section tool's global
  planes already wore, is exported and shared with a distance's delta legs.

  `surfaceUnderRay`, and so the section tool's preview, now skips a surface a section cut has clipped
  away rather than landing on a face nobody can see. `hitUnderRay` is the walk it shares with the
  measure tool, and is exported.

- fe65fc1: Add `<SectionTool>`, an opt-in way to cut a part open from inside the viewport. Mounted beside
  `<PartMesh>` with nothing wired, it previews a cut on the face under the pointer and places one on
  a click, offers three global planes behind the part to sweep along an axis, draws the cutting plane
  as an outlined sheet once there is a cut, and clears it on Escape.

  While the tool is mounted, `<PartMesh>` reports no hovers or picks and paints no hover;
  unmounting it hands the pointer back.

  The cut it places is held by `<Viewer>` itself. `<PartMesh>` follows that cut, and shows the drag
  handle for it, whenever it is given no `section` prop of its own; a `section` prop is unchanged and
  still takes precedence. `ViewerHandle.setSection(options | null)` sets or clears it from outside
  the canvas, and `useSectionStore()` reads it from inside.

  The section cap is now hatched and outlined rather than a flat fill, in screen space so it reads
  the same at any zoom. `ViewerTheme` gains `sectionHatch` for the hatch lines; `sectionOutline`,
  previously declared but unused, now colours the tool's sheet and preview.

  `onSectionChange` now also reports a cut going away, once, as a state with `enabled: false`.
  `DISABLED_SECTION` is that state. `SectionOptions` and `SectionState` are unchanged and still
  exported from the root.

## 1.1.1

### Patch Changes

- a56ebcc: `Grid` draws nothing until the scene has been measured. It is sized from `useContentBox`, which is
  empty on the first frame, and a grid built from an empty box sits on a plane at infinity — three.js
  logged `Computed radius is NaN` on every mount.

## 1.1.0

### Minor Changes

- 022bf37: `ShapeKind` and `KnownShapeKind` are now exported from `@toolpath/viewer`. They type
  `PartModelRegion.shapeKind`, which was already public and whose type a consumer had no way to
  write down — the same gap `FeatureType` and `KnownFeatureType` were already exported to close.

  Everything else here is plumbing that was exported and imported by nothing, found by `pnpm knip`
  and now module-private: the `Context` objects and provider value types behind `@toolpath/ui`'s
  combobox, menu, table, tabs, toggle, breadcrumbs and link, its `ROW_HEIGHT` constants and the
  inner `Table` that `TableRoot` wraps; and `IndexableFeature` in the viewer. Neither package's
  entry point changes shape, but `@toolpath/ui` ships `src`, so the files a consumer receives
  differ. An unused `ThreePoint` alias and an unused `three-stdlib` devDependency are gone.

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
