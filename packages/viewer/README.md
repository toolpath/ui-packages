# Toolpath Viewer

Display CAD meshes in a React application — on the web, or in a React Native app
through Expo — with feature picking, camera controls, stock, section cuts, and
measurements. Use `EnginePart` for an analyzed Toolpath
report, or `PartMesh` for geometry and region/feature data you supply yourself.
The viewer does not read STEP files, run analysis, or require an API key to render
local geometry.

- [Install](#install)
- [Quick start: Engine report](#quick-start)
- [Use your own geometry](#using-it-without-the-engine)
- [Selection and hover](#selection-and-hover)
- [Components and camera controls](#components)
- [Toolbar, stock, section, and measurement recipes](#recipes)
- [React Native (Expo)](#react-native-expo)
- [Engine loading, caching, and errors](#working-with-the-toolpath-api)
- [Reference](#reference)
- [Work on the package](#working-on-this-package)

## Install

```sh
npm install @toolpath/viewer
```

Your application must provide compatible peers:

| Dependency           | Declared range | Needed for                                           |
| -------------------- | -------------- | ---------------------------------------------------- |
| `react`              | `^19.0.0`      | Both                                                 |
| `react-dom`          | `^19.0.0`      | The web (optional peer)                              |
| `three`              | `>=0.159.0`    | Both                                                 |
| `@react-three/fiber` | `^9.7.0`       | Both                                                 |
| `@react-three/drei`  | `^10.7.8`      | Both                                                 |
| `react-native`       | `>=0.78`       | React Native (optional peer)                         |
| `expo-asset`         | `>=8.4`        | React Native, where it is required: imported at load |
| `expo-gl`            | `>=11.0`       | React Native: the GL context (optional peer)         |

A web application installs `react-dom` itself; it is optional only so a React
Native app does not need it. The React Native peers are optional only so a web
application does not need them: `dist/native` imports `expo-asset` and
`expo-gl` as it loads. For React Native, see
[React Native (Expo)](#react-native-expo).

For a new application, this is the combination used by the repository's example:

```sh
npm install @toolpath/viewer react@19.2.0 react-dom@19.2.0 three@0.185.1 @react-three/fiber@9.7.0 @react-three/drei@10.7.8
```

TypeScript applications also need React and three.js types, for example
`@types/react`, `@types/react-dom`, and `@types/three`. Match the three.js types to
your installed three.js release. Keep one compatible copy of each renderer/peer
in your application; React Three Fiber 9 uses React 19.

This is an ESM package with included TypeScript declarations. Its declared Node
floor is 20; the tested three.js release needs a browser with WebGL2 support. Use your framework's
client component boundary for interactive React code and its normal bundler setup.
See the [React Three Fiber installation guide](https://r3f.docs.pmnd.rs/getting-started/installation)
for framework-specific setup.

**Current packaging limitation:** direct, unbundled Node ESM imports of both
JavaScript entries fail with `CameraControls.install is not a function`. Use an
application bundler; for SSR, verify the framework's server dependency bundling
as well as its client component boundary. The declared Node floor does not make
these entries standalone Node utilities.

### Styles

The canvas does not need Tailwind or `@toolpath/ui`. Give the viewer a nonzero
height. It fills its wrapper, and its transparent canvas shows the background you
set on the wrapper or parent.

For the optional toolbar, import its plain CSS through your application's CSS
entry point or client entry:

```css
@import '@toolpath/viewer/toolbar.css';
```

Measurement labels and hover-card content need your own styling; the toolbar
stylesheet does not style them. See [Measuring](#measuring) and [Theming](#theming).

## Quick start

Pass a completed analysis report to `EnginePart`. It validates the report, loads
its mesh, and renders the result. It accepts `unknown`, so the viewer does not
require an SDK dependency just to display a report.

This example uses [react-error-boundary](https://github.com/bvaughn/react-error-boundary):

```sh
npm install react-error-boundary
```

```tsx
'use client'

import { Suspense, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Axes, Grid, ViewCube, Viewer, type FeatureTag } from '@toolpath/viewer'
import { EnginePart } from '@toolpath/viewer/engine'

export const PartViewer = ({ report }: { report: unknown }) => {
  const [selection, setSelection] = useState<Array<FeatureTag>>([])

  return (
    <ErrorBoundary
      fallback={<p role="alert">This part could not be displayed.</p>}
      resetKeys={[report]}
    >
      <Suspense fallback={<p>Loading part…</p>}>
        <Viewer style={{ height: 500 }} onPointerMissed={() => setSelection([])}>
          <EnginePart
            report={report}
            selection={selection}
            onPick={(pick) => setSelection(pick.best ? [pick.best] : [])}
          />
          <Grid />
          <Axes />
          <ViewCube />
        </Viewer>
      </Suspense>
    </ErrorBoundary>
  )
}
```

Suspense supplies loading UI; the error boundary handles invalid report data.
An accepted analysis job is not a report: finish the API workflow
before passing its result here. When changing parts/results, key `PartViewer` by
analysis-result identity to reset selection, the camera, and one-time overlay
bounds. Refreshing URLs for the same artifact does not require a new key.

## How it works

- Geometry and tool dimensions are **millimetres**, with **Z up**. Vectors and
  stock must use the same coordinate frame; converting display units does not
  change mesh coordinates.
- Regions identify surfaces and cover half-open triangle ranges `[start, end)`.
  A feature refers to one or more regions. Several direction-dependent features
  can share one surface, so a click can have several valid owners.
- `PartMesh` emits picks and hover information. Your application owns selection,
  filtering, DFM rules, annotations, and persistence.
- The viewer frames its content when it first appears and renders on demand.
  It still renders during interaction and transitions; this is not a zero-cost
  guarantee for an idle mounted scene. Call `fit()` after later content changes
  when you want to reframe, or remount the viewer to start a new view.

## Using it without the Engine

Supply a `PartModel` and a **non-indexed** three.js `BufferGeometry`. Region ranges
must cover every triangle without gaps or overlaps; `buildRegionIndex` validates
that mapping. Preserve triangle order when preparing geometry.

This complete example renders a 20 mm cube and disposes the caller-owned geometry
on unmount:

```tsx
import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'
import { PartMesh, Viewer, ViewCube, buildRegionIndex, type PartModel } from '@toolpath/viewer'

export const Cube = () => {
  const { model, geometry } = useMemo(() => {
    const indexed = new BoxGeometry(20, 20, 20)
    const geometry = indexed.toNonIndexed()
    indexed.dispose()
    const regions = Array.from({ length: 6 }, (_, idx) => ({
      idx,
      splitOrigin: idx,
      shapeKind: 'Plane',
      area: 400,
      triangles: { start: idx * 2, end: idx * 2 + 2 },
    }))
    const features = [
      {
        tag: 'top',
        featureType: 'face',
        machiningDirection: { x: 0, y: 0, z: 1 },
        axis: null,
        regionIdxs: [4],
      },
    ]
    const model: PartModel = {
      partId: 'local-cube',
      kernelVersion: '',
      regions,
      features,
      candidateDirections: [{ x: 0, y: 0, z: 1 }],
      mesh: { pointCount: 36, triangleCount: 12, glbUrl: null, stlUrl: null, thumbnailUrl: null },
      regionIndex: buildRegionIndex({ regions, features, triangleCount: 12 }),
      warnings: [],
    }
    return { model, geometry }
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <Viewer style={{ height: 400 }}>
      <PartMesh model={model} geometry={geometry} selection={['top']} />
      <ViewCube />
    </Viewer>
  )
}
```

The feature covers only the top face; surfaces without a feature remain drawable
and pickable, but have no `pick.best`. An application-supplied model does not go
through the Engine kernel-version gate. Keep geometry/model references stable
between renders. `PartMesh` manages its rendering resources, but never disposes
the input geometry; the caller owns that lifetime.

## Selection and hover

Viewer identity is `FeatureTag` (`model.features[i].tag`, sourced from an Engine
report's `featureTag`). Do not replace it with an array index or an API
`featureId`. Region indices are local to their report and cannot join unrelated
results. `FeatureType` and `ShapeKind` allow unknown strings for newer data.

| `PartPick` field          | Meaning                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `best`                    | Highest-ranked feature tag, or `null`.                                              |
| `ranked`                  | Owners ranked for the camera and active direction.                                  |
| `owners`                  | All owners in report order, before active-direction filtering.                      |
| `region`, `triangleIndex` | Surface index and triangle hit.                                                     |
| `point`, `normal`         | Hit position and outward normal; three-number tuples. The normal is in world space. |
| `pointer`                 | Optional browser `clientX`/`clientY` for DOM overlays.                              |
| `modifiers`               | `alt`, `ctrl`, `meta`, `shift`, and `secondary` (right button).                     |
| `doubled`                 | This pick completed a double-click.                                                 |
| `sharpCorner`             | Optional corner hit when sharp-corner visualization is enabled.                     |

`onPick` reports primary and secondary clicks. Decide whether secondary clicks,
double-clicks, or modifier keys should change selection. Double-click retargeting
still works independently. `onHover` receives a pick or `null`; `hover={false}`
disables hover feedback and callbacks while leaving click picking enabled.

This inspector shares selection between a list and the mesh, cycles overlapping
owners on repeated clicks, and draws application-owned hover text:

```tsx
import { useState } from 'react'
import type { BufferGeometry } from 'three'
import {
  HoverCard,
  PartMesh,
  Viewer,
  focusForPick,
  type PartModel,
  type PartPick,
} from '@toolpath/viewer'

export const FeatureInspector = ({
  model,
  geometry,
}: {
  model: PartModel
  geometry: BufferGeometry
}) => {
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [pick, setPick] = useState<PartPick | null>(null)
  const [lastRegion, setLastRegion] = useState<number | null>(null)

  return (
    <>
      <ul>
        {model.features.map((feature) => (
          <li key={feature.tag}>
            <button
              type="button"
              onClick={() => setSelected(feature.tag)}
              onMouseEnter={() => setHovered(feature.tag)}
              onMouseLeave={() => setHovered(null)}
            >
              {feature.featureType}: {feature.tag}
            </button>
          </li>
        ))}
      </ul>
      <Viewer style={{ height: 400 }} onPointerMissed={() => setSelected(null)}>
        <PartMesh
          model={model}
          geometry={geometry}
          selection={selected ? [selected] : []}
          hoveredFeatureIds={hovered ? [hovered] : []}
          focusFeature={selected}
          onHover={setPick}
          onPick={(next) => {
            if (next.modifiers.secondary || next.doubled) {
              return
            }
            setSelected(focusForPick(next, lastRegion, selected))
            setLastRegion(next.region)
          }}
        />
      </Viewer>
      <HoverCard pick={pick}>
        {(current) => <span>{current.best ?? `Region ${current.region}`}</span>}
      </HoverCard>
    </>
  )
}
```

`HoverCard` is a DOM element; keep it outside the canvas and style its contents.
`focusFeature` frames the feature when its value changes. The `focus` prop is
different: `focus={{ opacity: 0.12 }}` makes regions outside `selection`
translucent. Its default outside opacity is 0.15, and an empty selection leaves
the part opaque. For multiselection, update your own tag array and avoid duplicates.

## Components

| Component                    | Purpose                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `Viewer`                     | Canvas, camera, lighting, controls, initial framing, and viewer-owned section state. |
| `EnginePart`                 | Validated Engine report plus cached mesh loading; imports from `/engine`.            |
| `PartMesh`                   | Your normalized model and prepared geometry; selection, paint, picking, sections.    |
| `ViewCube`                   | 26 orientation targets: faces, edges, and corners.                                   |
| `Grid`, `Axes`               | Reference geometry excluded from camera framing.                                     |
| `DirectionArrows`            | Candidate and optional named/preview machining directions.                           |
| `Stock`                      | Geometry, GLB bytes, box, or cylinder stock.                                         |
| `SectionTool`, `SectionView` | Interactive section placement or a supplied section visualization.                   |
| `MeasureTool`                | Distance/angle picking and labels.                                                   |
| `ToolMarks`                  | Supplied cutter/profile geometry and labels; no datasheet inference.                 |
| `Banana`                     | Optional bundled 154 mm scale reference; loads its GLB on mount and suspends.        |
| `CadCameraControls`          | Lower-level camera controls for custom R3F scenes. `Viewer` already installs them.   |
| `ViewerToolbar`              | DOM controls configured through `ViewerToolbarProvider`.                             |
| `HoverCard`                  | Cursor-following DOM content for a pick.                                             |

### `<Viewer>`

| Prop                    | Default           | Behavior                                                                              |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `projection`            | `orthographic`    | `perspective` is also supported. Changing it remounts the canvas and resets the view. |
| `controls`              | `toolpath`        | Navigation preset, independent of projection.                                         |
| `zoomTo`                | `cursor`          | Zoom toward the pointer or `centre`.                                                  |
| `freeOrbit`             | `true`            | Allow rotation through the poles.                                                     |
| `retargetOnDoubleClick` | `true`            | Double-click a part to move the orbit target there.                                   |
| `recentreOnDoubleClick` | `true`            | Double middle-click to fit content.                                                   |
| `showOrbitTarget`       | `false`           | Show the pivot marker.                                                                |
| `theme`                 | Default lighting  | Override lighting; part/cube/tool colors have their own theme props.                  |
| `onPointerMissed`       | —                 | Empty-space primary click, with drag guarding; use it to clear selection.             |
| `webglUnavailable`      | Default message   | Content of the alert shown instead of the canvas when WebGL is unavailable.           |
| `style`, `className`    | Full-size wrapper | Set dimensions and background on the wrapper or parent.                               |
| `ref`                   | —                 | `ViewerHandle` for controls outside the canvas.                                       |

`ViewerHandle` exposes `fit()`, `reset()`, `setView(name)`,
`setViewDirection({ x, y, z })`, `frameBox(box)`, and `setSection(options | null)`.
`fit` and `frameBox` preserve view direction; `reset` returns to the opening view.
Named views are `top`, `bottom`, `front`, `back`, `left`, `right`, and `isometric`.
Direction vectors point from the part toward the camera.

`Viewer` checks for WebGL2 once per page, on the client. If the browser will not create a context
(hardware acceleration off or the GPU blocklisted), it renders a `role="alert"`
element (`viewer-webgl-unavailable`, `data-viewer-webgl-unavailable="true"`) in
place of the canvas, asking the user to turn on graphics acceleration; children are
not rendered. Pass `webglUnavailable` to replace that message. Server rendering assumes
WebGL is available; the check runs on the client after hydration.

#### CAD controls

| Preset               | Rotate                                          | Pan                             | Zoom                        |
| -------------------- | ----------------------------------------------- | ------------------------------- | --------------------------- |
| `toolpath`           | Left-drag                                       | Right-drag                      | Wheel                       |
| `fusion`, `inventor` | Shift + middle-drag / Shift + two-finger scroll | Middle-drag / two-finger scroll | Trackpad pinch              |
| `alias`              | Left-drag                                       | Middle-drag                     | Wheel                       |
| `solidworks`         | Middle-drag                                     | Ctrl + middle-drag              | Shift + middle-drag / wheel |
| `tinkercad`          | Right-drag                                      | Shift + right-drag              | Wheel                       |
| `powermill`          | Middle-drag                                     | Shift + middle-drag             | Wheel                       |
| `onshape`            | Right-drag                                      | Middle-drag                     | Wheel                       |

`CONTROL_SCHEME_OPTIONS` supplies labels/values for a settings UI. Preferences are
application-owned.

On a touch screen, one finger orbits, two fingers pinch to zoom and move together
to pan, and three fingers pan. The pinch zooms an orthographic camera and dollies
a perspective one, as the wheel does. Fusion/Inventor use their CAD scroll
behavior for two fingers. `ExtendedCameraControls` exposes the same moves as
`orbitBy(dx, dy, viewportMin)`, `zoomAt(scale, at, viewport)` and
`panBy(dx, dy, viewport)`, in canvas pixels, for an application driving the camera
itself; constructed without an element, the controls listen to nothing and move
only through these.

### `<EnginePart>`

`report` is its only additional prop. It inherits `PartMeshProps` except `model`
and `geometry`, which it creates. Mesh loading prefers GLB and tries STL if GLB
fails or is absent. It does not fetch a report or start an Engine job.

### `<PartMesh>`

| Props                                | Behavior                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `model`, `geometry`                  | Required normalized data and non-indexed geometry.                                                                    |
| `selection`, `candidates`            | Selected feature tags and secondary candidates.                                                                       |
| `highlights`, `regionHighlights`     | Feature/region colors. Hover and selection overlay the direction wash.                                                |
| `pickedRegions`, `hoveredFeatureIds` | Application-driven region/feature feedback.                                                                           |
| `hover`, `onHover`, `onPick`         | Hover enablement and interaction callbacks.                                                                           |
| `focus`, `focusFeature`              | Selection X-ray rendering versus camera framing.                                                                      |
| `activeDirection`                    | Candidate-direction index; `null`/omitted means all directions.                                                       |
| `display`, `showEdges`               | `solid` or `wireframe`; outlines default on. Wireframe always shows semantic face boundaries, not triangle diagonals. |
| `sharpCorners`                       | `{ features: tags }` for externally flagged features, or `null`.                                                      |
| `threads`                            | `{ threads: marks }` to draw threads in their holes, or `null`. See "Showing threads".                                |
| `section`, `onSectionChange`         | Controlled section options and change reporting. Omit `section` to follow the viewer's section store.                 |
| `onAdjacency`                        | Receive touching-region sets for the prepared mesh.                                                                   |
| `theme`                              | Partial `ViewerTheme` for the part.                                                                                   |
| `children`                           | R3F overlays that can read `usePartContext()`.                                                                        |

With an active direction, picking ranks only reachable owners; a face with none
has `best === null`. `owners` still carries all owners. `directionHighlights(model,
index)` produces region paint matching `DirectionArrows`; it does not hide geometry
or establish that an unpainted face is impossible to machine.

### `<ViewCube>`, `<Grid>`, and `<Axes>`

`ViewCube` defaults to `alignment="top-right"` and `margin={[80, 80]}` (pixels).
`onViewChange` receives a `ViewName`, including diagonal names. Its theme controls
cube colors. Grid chooses a step from part size unless you supply `step`/`extent`;
it accepts `color` and `opacity` (default 0.35). Axes has a `size` in millimetres
(default 25). These controls/reference objects do not enlarge normal part framing.

## Recipes

### Toolbar and camera buttons

This scene uses caller-owned geometry. The provider supplies actions; it does not
implement toggling, persistence, measurement state, or stock creation for you.
The containing DOM element is positioned so the toolbar sits over this viewer.

```tsx
import { useRef, useState } from 'react'
import type { BufferGeometry } from 'three'
import {
  Axes,
  Grid,
  MeasureTool,
  PartMesh,
  SectionTool,
  Stock,
  ViewCube,
  Viewer,
  ViewerToolbar,
  ViewerToolbarProvider,
  type Measurement,
  type PartModel,
  type ViewerHandle,
} from '@toolpath/viewer'
import '@toolpath/viewer/toolbar.css'

export const Workbench = ({ model, geometry }: { model: PartModel; geometry: BufferGeometry }) => {
  const viewer = useRef<ViewerHandle>(null)
  const [stock, setStock] = useState(false)
  const [mode, setMode] = useState<'section' | 'measure' | null>(null)
  const [measurements, setMeasurements] = useState<readonly Measurement[]>([])
  const toggle = (next: 'section' | 'measure') =>
    setMode((current) => (current === next ? null : next))

  return (
    <ViewerToolbarProvider
      controls={{
        stock: { pressed: stock, onClick: () => setStock((shown) => !shown) },
        section: { pressed: mode === 'section', onClick: () => toggle('section') },
        measure: { pressed: mode === 'measure', onClick: () => toggle('measure') },
        fit: { onClick: () => viewer.current?.fit() },
        reset: { onClick: () => viewer.current?.reset() },
        top: { onClick: () => viewer.current?.setView('top') },
      }}
    >
      <div style={{ position: 'relative', height: 500 }}>
        <Viewer ref={viewer}>
          <PartMesh model={model} geometry={geometry} />
          {stock && <Stock box={{ partGeometry: geometry, allowance: { wall: 3, floor: 3 } }} />}
          {mode === 'section' && <SectionTool />}
          {mode === 'measure' && (
            <MeasureTool measurements={measurements} onChange={setMeasurements} />
          )}
          <Grid />
          <Axes />
          <ViewCube />
        </Viewer>
        <ViewerToolbar />
      </div>
    </ViewerToolbarProvider>
  )
}
```

Call Fit after toggling stock if you want to frame the blank. When switching from
Section to Measure, the viewer's existing cut remains until cleared with Escape
while the section tool is active or `viewer.current?.setSection(null)`. The example
retains measurements in React state when the tool is unmounted.

With no children, `ViewerToolbar` renders configured controls in standard order.
For custom composition use `ViewerToolbar.Controls`, `ViewerToolbar.Divider`, and
its `*Button` components. A button without a matching provider control throws.
The supported action names are `stock`, `axes`, `grid`, `banana`, `tools`,
`directions`, `dfm`, `sharpCorners`, `threads`, `hover`, `focus`, `wireframe`, `section`,
`measure`, `fit`, `reset`, and `top`; button names capitalize the action, such as
`ViewerToolbar.SharpCornersButton`. `useViewerToolbar()` reads those controls.

### Stock and display controls

`Stock` takes exactly one source. Stock stays in part coordinates, is included in
Fit/Reset, and does not intercept part picks or follow its section cut.

| Source              | Input                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `geometry`          | A caller-owned `BufferGeometry`; dispose it yourself after use.                                                       |
| `glb`               | An `ArrayBuffer` of GLB bytes you fetched. Keep the buffer reference stable. Stock decodes/disposes its own geometry. |
| `box` preview       | `{ partGeometry, allowance, offset? }` or `{ partGeometry, dimensions, position?, positionOffset?, offset? }`.        |
| `box` resolved      | `{ lower, upper, frame? }`.                                                                                           |
| `cylinder` preview  | `{ partGeometry, diameter, length, position?, positionOffset? }`.                                                     |
| `cylinder` resolved | `{ origin, axis, diameter, length }`; origin is the base center, axis points along its length.                        |

Allowances are **per side**: `{ wall, floor }` expands X/Y and Z respectively;
a number or `{ x, y, z }` is also accepted. The Workbench's 3 mm allowance is an
example, not a stock recommendation. Fixed preview `dimensions` are `{ x, y, z }`.
Positions are `model_centered`, `offset_from_top`, and `offset_from_bottom`, with
`positionOffset` in millimetres. Preview options and resolved figures are mutually
exclusive. Use `boxStockBounds` / `fixedBoxStockBounds` for corresponding dimensions.

Centered stock is centered on the part's bounds. For top positioning its upper Z
is `part.max.z + positionOffset`; for bottom positioning its lower Z is
`part.min.z - positionOffset`. These rules also position cylinder previews along Z.

A box's optional frame has `location`, `axis`, and `refDirection`. Its local point
maps to `location + x·refDirection + y·(axis × refDirection) + z·axis`; the axis is
normalized and the reference direction projected perpendicular and normalized.
Without a frame, corners are already in part coordinates. A cylinder preview is
Z-aligned and centered on the part's bounding box. Treat previews as visualization;
prefer the operation's resolved stock when the selected API contract supplies it.

Negative/non-finite allowances, invalid coordinates, degenerate frames/axes, and
non-positive dimensions throw `RangeError`. GLB node transforms are applied without
centering, rescaling, or axis conversion. Stock does not fetch, cache, decompress
HTTP responses itself, or need an analysis report; the browser handles HTTP gzip.

Appearance props are `color`, `emissive`, `flatShading`, `opacity` (default 0.2),
`edgeColor`, `edgeOpacity`, and `showEdges`. `renderStyle="legacy-workpiece"` selects
the legacy two-pass material/edge appearance. With `showEdges={false}`, outlines
are not built until needed. `retainPrevious` applies to GLB playback: keep the
previous decode visible until the replacement is ready. Key the stock subtree by
part/calculation identity to prevent carrying geometry into a different run.
Without it, changing GLB bytes hides the previous geometry during decoding.

**Migration from 1.x:** replace removed `BoxStock` with `Stock`'s `box` source.
`StockProps` is a union; use an intersection type rather than extending it with an
interface. `StockAppearanceProps` describes just the shared appearance options.

### Direction coloring

Keep the same candidate index in `PartMesh.activeDirection` and the arrows. Use
`shownDirection={null}` for all arrows, an index/list to choose arrows, or `-1`
for none. `activeDirection` also scopes arrows when `shownDirection` is omitted.
`previewDirection` and `namedDirections` add non-candidate directions.

```tsx
import { useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import {
  DirectionArrows,
  PartMesh,
  Viewer,
  directionHighlights,
  type PartModel,
} from '@toolpath/viewer'

export const DirectionViewer = ({
  model,
  geometry,
}: {
  model: PartModel
  geometry: BufferGeometry
}) => {
  const [direction, setDirection] = useState<number | null>(null)
  const colors = useMemo(() => directionHighlights(model, direction), [model, direction])
  return (
    <Viewer style={{ height: 400 }}>
      <PartMesh
        model={model}
        geometry={geometry}
        activeDirection={direction}
        regionHighlights={colors}
      />
      <DirectionArrows
        directions={model.candidateDirections}
        shownDirection={direction}
        onPickDirection={(index) => setDirection((current) => (current === index ? null : index))}
      />
    </Viewer>
  )
}
```

Arrows point toward the part. Picking an arrow does not clear selection through
`onPointerMissed`. Use `groupByDirection`, `directionLabel`, and `directionColor`
for a matching list/legend. Wireframe and direction coloring are independent props;
any mutual exclusion in the example app is application behavior.

### Section view

Mount `SectionTool` inside `Viewer` beside a part with no explicit `section` prop.
It previews the surface under the pointer, places a cut on click, and offers X/Y/Z
planes. A drag handle moves the cut; Escape clears it while the tool is mounted.
It writes the viewer-owned section store and suppresses normal part hover/picks
while active. Unmounting the tool restores part interactions, not the uncut solid.

For application-controlled cuts, supply `section` directly. Here `normal` points
toward the retained half; `offset` ranges from 0 (whole part) to 1 (cut away).

```tsx
import { useState } from 'react'
import type { BufferGeometry } from 'three'
import { PartMesh, Viewer, type PartModel } from '@toolpath/viewer'

export const SectionViewer = ({
  model,
  geometry,
}: {
  model: PartModel
  geometry: BufferGeometry
}) => {
  const [offset, setOffset] = useState(0.5)
  return (
    <>
      <label>
        Section offset
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={offset}
          onChange={(event) => setOffset(Number(event.target.value))}
        />
      </label>
      <Viewer style={{ height: 400 }}>
        <PartMesh
          model={model}
          geometry={geometry}
          section={{ enabled: true, normal: { x: 0, y: 0, z: 1 }, offset }}
          onSectionChange={(state) => setOffset(state.offset)}
        />
      </Viewer>
    </>
  )
}
```

Passing `onSectionChange` also enables the controlled cut's drag handle. The callback
reports `SectionState`, including `enabled`, `normal`, `offset`, `plane`, `depth`,
`constant`, and depth bounds. Use `sectionFromPick({ point, normal })` to create a
surface placement, then `{ enabled: true, plane, depth }` to cut inward by a depth
in millimetres. Pick tuples must be converted to `{ x, y, z }` for that helper.
`sectionMeasurement(state)` supplies a readout for your own slider or label.

### Measuring

`MeasureTool` mounts inside `Viewer`. Two clicks measure distance; three measure an
angle, with the vertex as the middle point. Snapping prefers corners, edge
midpoints, edges, then faces. `mode` is `distance` or `angle`; `showDeltas={false}`
hides a distance's X/Y/Z legs. `onChange` reports `readonly Measurement[]`; pass
`measurements` too to control and retain the list, as the Workbench does.

Shift constrains the next point to an axis. Escape cancels points in progress;
Delete/Backspace removes the last measurement unless focus is in a form field.
Normal part hover/picks are suppressed while measuring. Without controlled state,
unmounting the tool drops its measurements.

The tool measures the visible sectioned geometry, including the cap and clipped
edges. If a mounted SectionTool has no cut yet, measuring waits so its first
placement click is not also a measurement. Existing measurements remain visible.

Labels are unstyled DOM overlays with class `toolpath-measure-label`; add CSS such as:

```css
.toolpath-measure-label {
  white-space: nowrap;
  font:
    600 12px/1.2 system-ui,
    sans-serif;
  color: white;
  background: #141721dd;
  border: 1px solid #4f8ef7;
  border-radius: 4px;
  padding: 2px 6px;
}
.toolpath-measure-label[data-measure-label='delta'] {
  font-size: 11px;
}
```

`data-measure-label` identifies `distance`, `angle`, `delta`, `live`, or tool labels;
axis legs also have `data-axis`, and finished labels have `data-measurement-id`.
`labelClassName` adds a class. Labels do not take pointer events. Lengths default to
millimetres; the `format(mm)` callback changes their displayed string, not geometry
units or angles (which remain degrees).

### Showing threads

The Engine cuts a modeled internal thread out of the mesh, so a tapped hole arrives as a
plain bore. Pass `threads={{ threads: marks }}` to draw each thread back in as shading
over its hole's cylinders, at its pitch and hand. Build a mark from a hole's Engine
datasheet with `threadMark(feature, datasheet)` from `@toolpath/viewer/engine`; it is
`null` unless the datasheet carries a thread, so only threads the Engine reports are
drawn. A `ThreadMark` is `{ regions, pitch, majorDiameter }`: `pitch` is in mm and
negative for a left-hand thread, and cylinders wider than `majorDiameter` (a counterbore)
stay plain. The axis is fitted from the mesh, so marks need no coordinates. The datasheet
gives no thread length, so a tap-drill section of the same bore below the thread is
drawn threaded too.

### Showing sharp corners and tool marks

DFM decisions belong to the application. Pass flagged feature tags as
`sharpCorners={{ features: tags }}`; the viewer draws qualifying inside corners
along those features' machining directions. It does not flag features or guess
missing manufacturing data. Use a closed mesh with report region boundaries;
`findSharpCorners`/`sharpCornerPositions` operate on `surfaceCreases` for custom
inspection. A hovered corner appears as `pick.sharpCorner` with its feature,
endpoints, length, and angle. Feature tag matching for these flags is case-insensitive.

Mount `ToolMarks` under a part to illustrate supplied cutters or profiles. For
example, this is a 6 mm bull-nose cutter standing along +Z:

```ts
import type { ToolMark } from '@toolpath/viewer'

export const toolMarks: Array<ToolMark> = [
  {
    base: { x: 12, y: 4, z: -8 },
    axis: { x: 0, y: 0, z: 1 },
    diameter: 6,
    height: 8,
    cornerRadius: 0.5,
    label: '⌀ 6 mm',
    note: 'Bull nose R 0.5',
  },
]
```

Use `ToolMarks`'s `marks` prop for that array. A `ToolMark` can instead supply a
rotational `profile` of `{ r, z }` points. `visible` toggles display;
`labelClassName` styles labels. Marks use the measure-label CSS hook with
`data-measure-label="tool"`, optional value/note spans, take no pointer events,
and are excluded from camera framing. They do not read datasheets themselves.

### Labels in the scene

`SceneLabel` pins a text label to a point in the scene. On the web it is an
unstyled DOM element over the canvas with the `MEASURE_LABEL_CLASS` class plus
`className`, `data-measure-label={kind}`, and optional `data-axis` and
`data-measurement-id`; its `text` is in a `data-measure-value` span and its `note`
in a `data-measure-note` one. `color` sets `--measure-color`, `layer` its z-index
layer, and it takes no pointer events. `ToolMarks` draws its labels with it.

```tsx
<SceneLabel kind="note" position={[0, 0, 25]} text="Datum A" className="part-note" />
```

### Theming

Colors in `ViewerTheme` are numeric hex values. Set lighting on `Viewer`, part
colors on `PartMesh`/`EnginePart`, and overlay colors on their components; passing
part colors only to `Viewer` does not theme its children automatically.
`DEFAULT_THEME` lists the keys. Selection palettes are `HIGHLIGHT_COLORS`; direction
colors cycle through `DIRECTION_COLORS`.

Part keys include `part`, `partEmissive`, `hover`, `highlight`, `picked`, `edge`,
`edgeOpacity`, and `sharpCorner`. Section keys include `sectionCap`, `sectionHatch`,
`sectionOutline`, `sectionHandle`, and `sectionHandleOutline`. Measurement tools
use `measure`/`measureSnap`; cube keys are `cube`, `cubeEdge`, and `cubeLabel`.
The canvas background comes from the wrapper/parent, independently of those colors.
`labels` (optional, CSS colour strings) styles scene labels on React Native, where
there is no DOM to style; see [React Native (Expo)](#react-native-expo).

Stable DOM classes include `viewer-root`, `viewer-webgl-unavailable`,
`viewer-canvas-container`, `viewer-canvas-frame`, `viewer-canvas`, `viewer-hover-card`,
`viewer-toolbar-stack`, `viewer-toolbar`, `viewer-toolbar-button`, `viewer-toolbar-icon`,
`viewer-toolbar-tooltip`, and `viewer-toolbar-divider`. Caller `className` values
append to the component's hook. Corresponding `data-viewer-*` attributes identify
the DOM boundaries; `data-viewer-toolbar-action` contains the control's action name.
Style the hover card yourself; it is a pointer-events-free fixed-position shell.

Custom R3F objects can go inside `Viewer` and participate in framing. Set
`userData={{ [EXCLUDE_FROM_FRAME]: true }}` to exclude an object. Use the exported
`EXCLUDE_FROM_FRAME` constant, not a guessed string.

## React Native (Expo)

The package runs under React Native through Metro: React Three Fiber's native
build (`@react-three/fiber/native`) on expo-gl. Import it exactly as on the web.
Its `react-native` export condition gives Metro a native build of both
`@toolpath/viewer` and `@toolpath/viewer/engine`, in which a few web-only files
are swapped for native ones.

| Export                                                                                                                                                        | Web | React Native                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------- |
| `Viewer`, `PartMesh`, `EnginePart`, `Stock`, `DirectionArrows`, `SectionView`, `SectionTool`, `ToolMarks`, `Axes`, `Grid`, `ViewCube`, `Banana`, `SceneLabel` | yes | yes                                                                                                 |
| Every pure function, constant and type from the models, rendering helpers and Engine adapter                                                                  | yes | yes                                                                                                 |
| `MeasureTool`, `HoverCard`, `ViewerToolbar`, `labelTexture`                                                                                                   | yes | throw `Error('@toolpath/viewer: <Name> is not available on React Native.')` when called or rendered |
| `ViewerToolbarProvider`, `useViewerToolbar`                                                                                                                   | yes | yes (the context has no DOM)                                                                        |

On React Native, one finger orbits, two fingers pinch to zoom and pan, and a tap
picks, as on the web; double tap re-targets. A tap on a face with `SectionTool`
up cuts, and the handle drags the cut. `Viewer`'s `style` goes to the `View` that
holds the canvas. There's no WebGL check on React Native, where expo-gl always
creates a context, so `webglUnavailable` is never shown.

A finger doesn't hover, so on React Native `PartMesh` lights no face under a
moving finger, and `onHover` isn't called. Its picks go through a bounding volume
hierarchy ([`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh)),
built once per geometry and kept with it, so a large part stays smooth to touch
under Hermes.

### App setup

1. Install the native modules with Expo, and three.js, React Three Fiber 9.7 or
   later, and drei:

   ```sh
   npx expo install expo-gl expo-asset expo-file-system
   npm install @toolpath/viewer three @react-three/fiber @react-three/drei
   ```

2. In `metro.config.js`, give the app one copy of three.js and let Metro bundle
   GLB models. Fiber's native build `require`s three, which would otherwise
   resolve to `three.cjs` beside the `three.module.js` that ESM imports get, and
   `instanceof` checks between the two copies fail:

   ```js
   const path = require('node:path')
   const { getDefaultConfig } = require('expo/metro-config')

   const config = getDefaultConfig(__dirname)
   config.resolver.assetExts.push('glb')

   const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js')
   config.resolver.resolveRequest = (context, moduleName, platform) => {
     if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule }
     return context.resolveRequest(context, moduleName, platform)
   }

   module.exports = config
   ```

3. In `package.json`, let Expo autolink the three.js packages:

   ```json
   {
     "expo": { "autolinking": { "include": ["three", "@react-three/fiber", "@react-three/drei"] } }
   }
   ```

**Don't pass `gl={{ context }}`** to a canvas of your own on expo-gl
([expo#51543](https://github.com/expo/expo/issues/51543)). `Viewer` creates its
context itself.

### Labels on React Native

`SceneLabel` has no DOM to draw into, so a `Viewer` draws its labels as views over
the canvas, centred on their points, and hides one behind the camera or well
outside the view. `className` and `layer` do nothing there; `onPress` makes a
label pressable. Style them with the theme's `labels` key, which takes CSS colour
strings:

```tsx
<Viewer
  theme={{
    labels: {
      text: '#1f2330',
      background: 'rgba(255,255,255,0.92)',
      border: '#4f8ef7',
      axis: { x: '#ff6b6b', y: '#6fe08a', z: '#6f9bff' },
      fontSize: 12,
    },
  }}
>
```

Those are the defaults. A label's own `color` replaces `border`, and a label with
an `axis` takes that axis's colour.

Each label view has the `testID` `scene-label-<kind>`, from its `kind`, for an
app's tests to find it by. A pressable label is announced as a button.

## Working with the Toolpath API

Keep analysis/job orchestration outside the viewer. A server-side
[`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api) integration can fetch a
completed report and pass it to the browser. Deliberate browser API access needs
an appropriately scoped, allowed-origin key; a browser-delivered key is observable
and is not made secret by CORS. See the [authentication guide](https://developers.toolpath.com/authentication).
The viewer's mesh loader does not attach an Engine API key to artifact requests.

### Analyzed part versus display mesh

A completed analysis report includes features and regions for `EnginePart`.
A display-mesh response has geometry and face counts without analysis features;
it is not an `EnginePart` report. Use `PartMesh` with a model whose region ranges
come from that display mesh's `faceTriangleCounts`. Without them, a single region
can cover all triangles. Such a model has no feature owners, so `pick.best` is
`null`; use `pickedRegions` and `regionHighlights` for face feedback. Its face
indices do not identify analysis-report regions, and synthetic area values do not
establish analytic measurements or DFM results.

### Mesh loading and ownership

For custom fetching, backend proxies, or local files, use `/engine` loaders and
render `PartMesh`. `EnginePart` itself has no custom-fetch prop.
`loadPartMesh(mesh, { fetch?, signal? })` tries GLB then STL;
`loadPartGeometry(url, counts, { format?, fetch?, signal? })` loads one artifact;
`parsePartGeometry(bytes, counts, format?)` parses bytes without fetching.
All produce caller-owned, non-indexed geometry, preserve triangle ordering and
coordinates, and validate counts against the supplied expectation. Call
`smoothRegionNormals(geometry, model.regions)` to smooth curved regions while
preserving their boundaries.

The counts argument is `{ pointCount, triangleCount }`, as in `model.mesh`; raw
API fields named `meshPointCount`/`meshTriangleCount` must be mapped deliberately.

This loader handles cancellation, failures, changed reports, and owned geometry:

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import { PartMesh, Viewer, type PartModel } from '@toolpath/viewer'
import {
  loadPartMesh,
  normalizePartReport,
  smoothRegionNormals,
  type FetchLike,
} from '@toolpath/viewer/engine'

type Loaded = { model: PartModel; request: FetchLike | undefined; geometry: BufferGeometry }
type Failure = { model: PartModel; request: FetchLike | undefined; error: Error }

export const ManagedPart = ({ report, request }: { report: unknown; request?: FetchLike }) => {
  const model = useMemo(() => normalizePartReport(report), [report])
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let owned: BufferGeometry | undefined
    const load = async () => {
      const geometry = await loadPartMesh(model.mesh, { fetch: request, signal: controller.signal })
      if (!active) {
        geometry.dispose()
        return
      }
      try {
        smoothRegionNormals(geometry, model.regions)
      } catch (error) {
        geometry.dispose()
        throw error
      }
      owned = geometry
      setLoaded({ model, request, geometry })
    }
    void load().catch((error: unknown) => {
      if (active) {
        setFailure({
          model,
          request,
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    })
    return () => {
      active = false
      controller.abort()
      owned?.dispose()
    }
  }, [model, request])

  if (failure?.model === model && failure.request === request) throw failure.error
  if (loaded?.model !== model || loaded.request !== request) return <p>Loading mesh…</p>
  return (
    <Viewer style={{ height: 400 }}>
      <PartMesh model={model} geometry={loaded.geometry} />
    </Viewer>
  )
}
```

Use an error boundary around `ManagedPart`, as in the quick start. Keep an injected
`request` function stable; changing it starts a new load. The component hides the
previous model while the replacement loads, aborts on cleanup, and disposes a
late result if the loader completed after cancellation. It does not use the shared
Engine geometry cache.

### Expiring URLs and cache

Artifact URLs are short-lived. Fetch promptly and obtain fresh URLs through the
owning API when needed; do not store them as durable identifiers or log them. URL
expiry belongs to the signed URL, not the age of the immutable analysis result.
An error-boundary reset alone cannot renew an expired URL. Browser artifact fetches
also need the artifact host's CORS permission, independently of API-key origins.

`EnginePart` uses a shared reference-aware geometry cache with a default capacity
of eight entries. Mounted parts retain their resources; released entries are
LRU-evicted/disposed when capacity is exceeded. The key uses GLB/STL URLs without query strings so renewed signatures reuse geometry. Proxy paths therefore
need distinct artifact identities; putting all identities only in query parameters
can collide. Keep the report's region mapping compatible with the cached artifact.
Use `engineGeometryCache.clear()` only after consumers have unmounted: it disposes
cached geometry, including retained resources.

## Errors

| Error                           | Export    | Handling                                                                                             |
| ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `PartReportFormatError`         | Root      | Inspect `issues`; reject malformed reports or mismatched region/triangle mappings.                   |
| `UnsupportedKernelVersionError` | Root      | `kernelVersion` is below `MIN_KERNEL_VERSION` (currently `0.3.0`); request compatible analysis data. |
| `PartMeshError`                 | `/engine` | No artifact, HTTP failure, unreadable mesh, or count/shape mismatch.                                 |
| `AggregateError`                | Built-in  | All available GLB/STL attempts failed; inspect `errors` for individual causes.                       |
| `RangeError`                    | Built-in  | Invalid stock dimensions, frames, axes, or coordinates.                                              |

Wrap `EnginePart` in Suspense and an error boundary. A custom async loader must
catch a rejected promise or rethrow it during render, as `ManagedPart` does; React
boundaries do not catch arbitrary async callback errors. Recover by correcting
input or fetching a fresh report/URL as appropriate, then reset the boundary.
Do not disable validation to render an unrelated mesh against a report's regions.

## Reference

### Entry points

| Import                         | Contents                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@toolpath/viewer`             | Components, hooks, models, geometry/camera/selection helpers, and types. Also re-exports `EnginePart`, `normalizePartReport`, and `smoothRegionNormals`. |
| `@toolpath/viewer/engine`      | Engine loading/normalization, geometry cache, `PartMeshError`, and adapter types.                                                                        |
| `@toolpath/viewer/toolbar.css` | Optional toolbar stylesheet.                                                                                                                             |

Both JavaScript entries carry a `react-native` condition, which Metro picks; see
[React Native (Expo)](#react-native-expo).

Other source/dist subpaths are not public imports. The complete signatures for an
installed version are in its `dist/index.d.ts`, `dist/engine/index.d.ts`, and
referenced declaration chunks. The public source export lists are
[root](https://github.com/toolpath/ui-packages/blob/main/packages/viewer/src/index.ts)
and [Engine adapter](https://github.com/toolpath/ui-packages/blob/main/packages/viewer/src/engine/index.ts).

### Hooks

| Hook                | Required context                 | Use                                                                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `useViewerControls` | Inside `Viewer`                  | Camera controls and `setSection`.                                                                    |
| `useViewerToolbar`  | Inside `ViewerToolbarProvider`   | Configured host actions/state.                                                                       |
| `useSectionStore`   | Inside `Viewer`                  | Read, set, or subscribe to viewer-owned section state.                                               |
| `useContentBox`     | Inside the scene                 | Finished-part bounds, excluding stock/furniture; empty until found and measured once per hook mount. |
| `usePartContext`    | Child of `PartMesh`/`EnginePart` | Part model and prepared input geometry.                                                              |
| `useRetarget`       | Inside viewer scene              | Retarget callback, or `null` when disabled/outside context.                                          |
| `useTapGuard`       | Inside viewer scene              | Distinguish taps from drags.                                                                         |

### Helpers and types

Common model/selection helpers include `buildRegionIndex`, `focusForPick`,
`rankOwners`, `bestOwner`, `groupByDirection`, `directionLabel`, `directionColor`,
`directionHighlights`, `regionAdjacency`, and `featureTriangles`. The region index
provides `featuresForRegion(idx)` and `regionsForFeature(tag)`.

For custom tools, section helpers include `sectionFromPick`, `sectionMeasurement`,
`resolveSectionPlane`, and `createSectionStore`; measurement helpers include
`distanceBetween`, `deltaBetween`, `angleAt`, `measurementLabel`, and `snapAt`.
Lower-level camera, view-cube, painting, and geometry functions are also exported;
consult their declarations rather than importing implementation files.

Start with `ViewerProps`, `ViewerHandle`, `PartMeshProps`, `EnginePartProps`,
`PartModel`, `PartModelRegion`, `PartModelFeature`, `FeatureTag`, `PartPick`,
`FeatureHighlight`, `RegionHighlight`, `FocusOptions`, `ViewerTheme`, `StockProps`,
`SectionOptions`, `SectionState`, `Measurement`, `MeasureMode`, and `ToolMark`.
`EnginePartProps` and the loader/cache types come from `/engine`; scene/model
types come from the root. Use the types belonging to your installed version; a newer source checkout does
not add exports to a published package.

## Working on this package

The [React viewer example](https://github.com/toolpath/ui-packages/tree/main/examples/react-viewer)
loads procedural parts without credentials. It also opens local report/mesh files;
its [README](https://github.com/toolpath/ui-packages/blob/main/examples/react-viewer/README.md)
describes the controls and browser tests.

From the repository root with its pinned toolchain:

```sh
pnpm --filter @toolpath/viewer build
pnpm --filter @toolpath/viewer check-types
pnpm --filter @toolpath/viewer test
pnpm --filter @toolpath/example-react-viewer... build
pnpm --filter @toolpath/example-react-viewer test
```

The example imports built packages. `build:watch` on `@toolpath/viewer` refreshes
that output during development. Browser tests need Chromium installed. When
changing exports/assets, pack the viewer and test that artifact in a clean consumer;
check both JS entries, declarations, toolbar CSS, and the bundled banana asset.
Fixture URLs are redacted test data, not working download links. Keep retained
fixtures unchanged and use a fixture copy when adapting URLs for a local test.

See the [contributor guide](https://github.com/toolpath/ui-packages/blob/main/AGENTS.md)
and [changelog](https://github.com/toolpath/ui-packages/blob/main/packages/viewer/CHANGELOG.md)
for repo workflows and published changes.

## License

[MIT](https://github.com/toolpath/ui-packages/blob/main/packages/viewer/LICENSE).
