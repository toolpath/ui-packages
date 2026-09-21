# `@toolpath/viewer`

Show a machined part in 3D in your React app. Users can spin it, zoom in, click a surface to see
which features own it, cut it open with a section plane, and jump between standard views with a
view cube.

It is built on [React Three Fiber](https://r3f.docs.pmnd.rs) and draws parts analyzed by the
Toolpath Engine. You can also give it your own geometry.

- [Install](#install)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Components](#components)
- [Recipes](#recipes)
- [Errors](#errors)
- [Working with the Toolpath API](#working-with-the-toolpath-api)
- [Using it without the Engine](#using-it-without-the-engine)
- [Reference](#reference)

## Install

```bash
npm install @toolpath/viewer react react-dom three @react-three/fiber @react-three/drei
```

## Quick start

Pass a part report from the Toolpath API to `<EnginePart>`:

```tsx
'use client'

import { Suspense, useState } from 'react'
import { Axes, Grid, ViewCube, Viewer } from '@toolpath/viewer'
import { EnginePart } from '@toolpath/viewer/engine'
import type { PartResponse } from '@toolpath/api'

export function PartViewer({ report }: { report: PartResponse }) {
  const [selection, setSelection] = useState<string[]>([])

  return (
    <ErrorBoundary fallback={<p>This part could not be displayed.</p>}>
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

This renders the part with a grid, axes, and a view cube. Clicking a surface selects its most
likely feature and paints it orange. Clicking empty space clears the selection.

What each wrapper is for:

- **`<Suspense>`**: `EnginePart` downloads the part's mesh and shows the fallback until it
  arrives.
- **Error boundary**: an expired mesh URL or a bad report is thrown as an error, not shown as an
  empty viewer. Use any error boundary you like, such as
  [`react-error-boundary`](https://github.com/bvaughn/react-error-boundary). See [Errors](#errors).
- **Height**: `<Viewer>` fills its parent, so give it or its parent a height.

## How it works

```text
<Viewer>                  canvas, camera, lights, mouse controls
 ├─ <EnginePart>          validates the report, loads the mesh, then renders <PartMesh>
 │   └─ <PartMesh>        draws the part and handles hover, click, colours, section cuts
 ├─ <DirectionArrows>     arrows for the directions the part can be machined from
 ├─ <Stock> <BoxStock>    translucent stock, included when fitting the camera
 ├─ <SectionTool>         optional: click a face or a plane to cut the part open
 ├─ <MeasureTool>         optional: click two points for a distance, three for an angle
 ├─ <Grid> <Axes>         reference geometry, sized to the part
 └─ <ViewCube>            the clickable orientation cube in the corner
```

1. **`<Viewer>`** sets up the 3D scene. Put everything else inside it. It frames the camera on
   whatever you put inside once that content appears. It only redraws when something changes, so
   a viewer that isn't being used costs nothing.
2. **`<EnginePart>`** checks the report, downloads the mesh (GLB first, STL if there is no GLB),
   and makes sure the mesh matches the report. Meshes are cached, so showing the same part twice
   downloads it once.
3. **`<PartMesh>`** draws the part as one mesh. The Engine splits the part's surface into
   **regions** (faces) and groups regions into **features** (holes, pockets, walls, and so on).
   When the pointer is over the part, `PartMesh` works out which region it is on and which
   features own that region.
4. **You own the state.** The viewer tells you what was clicked (`onPick`), and you tell it what to
   highlight (`selection`, `highlights`, …). It never changes your selection by itself.

### Focus the current selection

Pass `focus` to make selected features solid while the remainder of the part becomes translucent.
The default outside opacity is 15%; set `opacity` for a different X-ray strength. With no selected
features, the part stays fully opaque.

```tsx
<EnginePart report={report} selection={selection} focus={{ opacity: 0.12 }} />
```

Parts are in **millimetres** with **Z pointing up**. The camera uses the same convention.

### A click usually matches several features

The same face is usually owned by **5–8 features at once**, even on a plain cube: it can be a
`face` when cut from one direction, a `wall` when cut from another, and part of every `profile`
around it. So a click gives you every match, and you decide which to use:

| Field            | What it contains                                                      |
| ---------------- | --------------------------------------------------------------------- |
| `pick.best`      | The most likely feature, or `null`                                    |
| `pick.ranked`    | Every matching feature, most likely first                             |
| `pick.owners`    | Every matching feature, in report order                               |
| `pick.region`    | The index of the face that was clicked                                |
| `pick.point`     | Where the click hit, as `[x, y, z]`                                   |
| `pick.normal`    | The direction the clicked surface faces, as `[x, y, z]`               |
| `pick.pointer`   | Browser coordinates for an application-owned hover card, when present |
| `pick.modifiers` | `{ alt, ctrl, meta, shift, secondary }`: keys held, and right-click   |
| `pick.doubled`   | `true` if this click was the second half of a double-click            |

The ranking puts specific features first: holes, then pockets and bosses, then chamfers and
fillets, then walls and faces, then profiles. Among features of the same kind, the one whose
machining direction points most toward the camera wins.

`onHover` receives the same `PartPick` shape. Use the optional `pointer` location yourself, or
wrap application content in `<HoverCard pick={hoverPick}>`; it follows the cursor while that
region remains hovered. The viewer intentionally leaves card content and actions to the application.
Hover feedback is on by default; pass `hover={false}` to disable both face feedback and `onHover`
callbacks while preserving clicks. That makes an application toolbar's feature-hover toggle
unambiguous.

The normalized model contains feature identity, type, directions, face shape, and analytic area.
An Engine DFM card can join `pick.best` to the part's detailed feature data and render its own
depth, clearance-diameter, or L/D rows inside `HoverCard`; setup labels remain application or plan
context rather than a fact of the part surface.

## Components

### Stock and display controls

Use `<BoxStock>` for an axis-aligned blank around a part, or `<Stock geometry={stockGeometry} />`
for an actual stock mesh, including cylindrical or irregular blanks. Stock and part coordinates
must use the same millimetre, Z-up frame. Both components include stock in Fit and Reset while
keeping section tools, measurements, the grid, and direction arrows sized to the finished part.
Stock does not intercept clicks or get clipped by the part's section plane.

```tsx
import { useMemo, useRef, useState } from 'react'
import {
  Axes,
  BoxStock,
  DirectionArrows,
  PartMesh,
  Viewer,
  directionHighlights,
} from '@toolpath/viewer'
import type { PartModel, ViewerHandle } from '@toolpath/viewer'
import type { BufferGeometry } from 'three'

export function StockPreview({ model, geometry }: { model: PartModel; geometry: BufferGeometry }) {
  const viewer = useRef<ViewerHandle>(null)
  const [stock, setStock] = useState(false)
  const [axes, setAxes] = useState(true)
  const [directions, setDirections] = useState(false)
  const [direction, setDirection] = useState<number | null>(null)
  const [wireframe, setWireframe] = useState(false)
  const colors = useMemo(
    () => (directions ? directionHighlights(model, direction) : []),
    [model, direction, directions],
  )

  return (
    <>
      <Viewer ref={viewer} style={{ height: 500 }}>
        <PartMesh
          model={model}
          geometry={geometry}
          display={wireframe ? 'wireframe' : 'solid'}
          regionHighlights={colors}
          activeDirection={directions ? direction : null}
        />
        {stock && <BoxStock partGeometry={geometry} allowance={{ wall: 3, floor: 3 }} />}
        {axes && <Axes />}
        <DirectionArrows
          directions={model.candidateDirections}
          visible={directions}
          shownDirection={direction}
          onPickDirection={(index) => setDirection((held) => (held === index ? null : index))}
        />
      </Viewer>
      <button aria-pressed={stock} onClick={() => setStock(!stock)}>
        Stock
      </button>
      <button aria-pressed={axes} onClick={() => setAxes(!axes)}>
        Axes
      </button>
      <button aria-pressed={directions} onClick={() => setDirections(!directions)}>
        By direction
      </button>
      <button aria-pressed={wireframe} onClick={() => setWireframe(!wireframe)}>
        Wireframe
      </button>
      <button onClick={() => viewer.current?.fit()}>Fit</button>
    </>
  )
}
```

`BoxStock.allowance` is padding **per side**, in millimetres. The preferred form is
`{ wall, floor }`: wall stock expands X/Y and floor stock expands Z, matching the wall/floor
roughing-stock distinction used by machining settings. A number or `{ x, y, z }` remains accepted
for uniform or axis-specific padding. It defaults to zero. `offset` translates the stock from the
part's bounding-box centre. `boxStockBounds(geometry, allowance, offset)` returns the same `Box3`
for displaying dimensions.

For fixed-box stock, pass `dimensions={{ x, y, z }}` instead. `position` accepts
`model_centered`, `offset_from_top`, or `offset_from_bottom`, and `positionOffset` is the distance
from the selected top or bottom bound. All fixed-box values use millimetres and the part's Z-up
coordinate frame.
Negative/non-finite allowances, non-finite coordinates, and empty or non-positive stock dimensions
throw `RangeError`. The 3 mm allowance above is an example, not an automatic stock recommendation.

`Stock` accepts `color`, `opacity` (default `0.2`), `edgeColor`, `edgeOpacity`, and `showEdges`.
`BoxStock` accepts the same appearance props. Caller-provided geometry is never disposed; the
components dispose their own materials and outlines. Conditionally mount stock to toggle it.
Toggling stock preserves the camera; Fit/Reset then frames the visible stock together with the part.

`directionHighlights(model, activeDirection?)` returns region colors in the same palette as
`DirectionArrows`. For a face with several owners, the most specific feature wins, followed by
candidate-direction order and feature tag. Unmatched directions are left unpainted. Hover and
selection still paint over this wash. Scoping by direction filters ownership; it does not hide
the rest of the model or claim that an unpainted face cannot be manufactured.

Wireframe keeps the existing semantic edges, including rear edges, and keeps faces available for
picking, measuring, and section placement. Highlighted faces and section caps remain visible.
`showEdges` controls solid-mode outlines; wireframe always shows them. The example's bottom toolbar
makes wireframe and direction coloring mutually exclusive and includes a direction legend and
contextual Section/Measure controls.

### `<ViewerToolbar>`

`ViewerToolbar` is the standard controlled toolbar for the viewer's camera, stock, display, section,
and measurement controls. Import its stylesheet alongside your application stylesheet:

```tsx
import '@toolpath/viewer/toolbar.css'
import { ViewerToolbar } from '@toolpath/viewer'
```

The toolbar owns no application state; pass the current values and callbacks from the host app. Its
`children` are rendered above the standard controls for app-specific options. `BananaButton` is
also exported for applications that want the bundled banana-for-scale control elsewhere.

### `<Viewer>`

The canvas that holds everything. Import it from `@toolpath/viewer`.

| Prop                    | Default          | What it does                                                                                                |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `projection`            | `'orthographic'` | `'orthographic'` keeps parallel lines parallel. `'perspective'` gives depth, which helps with deep pockets. |
| `controls`              | `'toolpath'`     | CAD navigation preset. See [CAD controls](#cad-controls).                                                   |
| `zoomTo`                | `'cursor'`       | Zoom toward the pointer, or toward `'centre'` (often easier on a trackpad).                                 |
| `freeOrbit`             | `true`           | Let the view keep rotating past straight-up and straight-down.                                              |
| `retargetOnDoubleClick` | `true`           | Double-click the part to rotate around that point.                                                          |
| `recentreOnDoubleClick` | `true`           | Double-click the middle mouse button to fit the whole part again.                                           |
| `showOrbitTarget`       | `false`          | Show a small marker at the point the view rotates around.                                                   |
| `theme`                 | —                | Override lighting and colours. See [Theming](#theming).                                                     |
| `onPointerMissed`       | —                | Called when a left-click hits nothing. Clear your selection here.                                           |
| `className`, `style`    | —                | Applied to the wrapping `<div>`. It fills its parent by default.                                            |
| `ref`                   | —                | A `ViewerHandle` for moving the camera. See [Camera buttons](#camera-buttons).                              |

Changing `projection` rebuilds the canvas and returns the camera to its starting view.

The canvas is transparent. To set a background colour, style the wrapper or its parent.

#### CAD controls

`controls` changes only the navigation gestures. It does not choose a projection: the viewer stays
orthographic by default, and `projection="perspective"` remains an independent opt-in.

| Value          | Label      | Rotate                                | Pan                                       | Zoom                                |
| -------------- | ---------- | ------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `'toolpath'`   | Toolpath   | Left-drag                             | Right-drag                                | Scroll wheel                        |
| `'fusion'`     | Fusion     | Shift + middle-drag or Shift + scroll | Middle-drag, scroll, or two-finger scroll | Trackpad pinch                      |
| `'alias'`      | Alias      | Left-drag                             | Middle-drag                               | Scroll wheel                        |
| `'inventor'`   | Inventor   | Shift + middle-drag or Shift + scroll | Middle-drag, scroll, or two-finger scroll | Trackpad pinch                      |
| `'solidworks'` | SolidWorks | Middle-drag                           | Ctrl + middle-drag                        | Shift + middle-drag or scroll wheel |
| `'tinkercad'`  | Tinkercad  | Right-drag                            | Shift + right-drag                        | Scroll wheel                        |
| `'powermill'`  | PowerMill  | Middle-drag                           | Shift + middle-drag                       | Scroll wheel                        |
| `'onshape'`    | Onshape    | Right-drag                            | Middle-drag                               | Scroll wheel                        |

Fusion and Inventor treat a two-finger scroll as pan, Shift + two-finger scroll as orbit, and a
pinch (a wheel event with Ctrl set by the browser) as zoom. Other schemes use one-finger rotate,
two-finger pinch-and-pan, and three-finger pan on touch screens.

All schemes support double-clicking the part to rotate around that point and double-clicking the
middle mouse button to fit the whole part. Dragging never selects anything; a click only counts if
the pointer barely moved.

The package exports `CONTROL_SCHEME_OPTIONS`, `ControlScheme`, and `ControlSchemeOption` for a host
application's settings UI. It deliberately stores no preferences: pass the selected `controls`,
`freeOrbit`, and `zoomTo` values to `<Viewer>` from your own state or persistence layer.

`'toolpath'`, `freeOrbit={true}`, and `zoomTo="cursor"` are the defaults.

### `<EnginePart>`

Draws a Toolpath Engine part report. Import it from `@toolpath/viewer/engine`.

It takes one prop of its own, `report`: the `PartResponse` from `@toolpath/api`, unchanged. All
other props are the same as `<PartMesh>`'s, except `model` and `geometry`, which it creates for
you.

Mesh URLs in a report expire **15 minutes** after the report was created. If a part may be shown
later than that, fetch a fresh report first. Don't save the URLs.

### `<PartMesh>`

Draws the part and handles clicks. You only use it directly when you
[don't use the Engine](#using-it-without-the-engine). All of these props also work on
`<EnginePart>`.

**Colours**

| Prop                | Type                                 | What it does                                                                                          |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `selection`         | `string[]`                           | Feature tags to highlight as selected (orange).                                                       |
| `highlights`        | `FeatureHighlight[]`                 | Your own colour per feature, e.g. difficulty or setup.                                                |
| `regionHighlights`  | `RegionHighlight[]`                  | Your own colour per face.                                                                             |
| `candidates`        | `string[]`                           | Other possible matches, faintly tinted by machining direction.                                        |
| `pickedRegions`     | `number[]`                           | Faces to mark as just clicked.                                                                        |
| `hoveredFeatureIds` | `string[]`                           | Features to show as hovered, e.g. when hovering a list row.                                           |
| `showEdges`         | `boolean` (`true`)                   | Draw outlines between faces.                                                                          |
| `display`           | `'solid' \| 'wireframe'` (`'solid'`) | Wireframe draws face boundaries without triangle diagonals. Painted and hovered faces remain visible. |
| `theme`             | `Partial<ViewerTheme>`               | Override the part's colours.                                                                          |

**Interaction**

| Prop              | Type                               | What it does                                                                                    |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `onPick`          | `(pick: PartPick) => void`         | Left- or right-click on the part.                                                               |
| `onHover`         | `(pick: PartPick \| null) => void` | The pointer moved onto a different face, or off the part (`null`).                              |
| `hover`           | `boolean` (`true`)                 | Paint and report faces under the pointer. `false` leaves click picking on and clears any hover. |
| `activeDirection` | `number \| null`                   | Only match features machined from this direction (an index into `candidateDirections`).         |
| `focusFeature`    | `string \| null`                   | Zoom to this feature. The camera moves each time the value changes.                             |
| `section`         | `SectionOptions`                   | Cut the part open. Omit it to follow the viewer's own cut. See [Section view](#section-view).   |
| `onSectionChange` | `(state: SectionState) => void`    | Called when the cut moves or goes away. With `section`, passing it also shows the drag handle.  |
| `onAdjacency`     | `(map) => void`                    | Called once per mesh with which faces touch which.                                              |

Hovering over the part is handled for you. You only need `onHover` if you want to show the hovered
feature elsewhere in your UI.

### `<ViewCube>`

The orientation cube in the corner. It has 26 clickable areas: 6 faces, 12 edges, and 8 corners,
so you can get an isometric view with one click.

```tsx
<ViewCube alignment="bottom-right" margin={[60, 60]} onViewChange={(view) => track(view)} />
```

| Prop           | Default       |                                                                |
| -------------- | ------------- | -------------------------------------------------------------- |
| `alignment`    | `'top-right'` | `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'` |
| `margin`       | `[80, 80]`    | Distance from the corner, in pixels                            |
| `onViewChange` | —             | Called with the view name, e.g. `'top-front-right'`            |
| `theme`        | —             | Cube colours                                                   |

### `<DirectionArrows>`

An arrow for each direction the part can be machined from. Each direction has its own colour, and
features machined from that direction use the same colour. The arrows point **at** the part,
because that is the direction the tool comes from.

```tsx
<DirectionArrows
  directions={model.candidateDirections}
  activeDirection={direction}
  onPickDirection={(index) => setDirection(index === direction ? null : index)}
/>
```

| Prop               | What it does                                                                         |
| ------------------ | ------------------------------------------------------------------------------------ |
| `directions`       | The report's `candidateDirections`.                                                  |
| `activeDirection`  | Show only this arrow.                                                                |
| `shownDirection`   | Which arrows to show: `null` for all, an index, a list of indices, or `-1` for none. |
| `previewDirection` | An extra arrow drawn on top of the part, e.g. while the user aims a new direction.   |
| `namedDirections`  | Extra directions that aren't candidates, each with its own colour.                   |
| `onPickDirection`  | Called with an arrow's index when it is clicked.                                     |
| `visible`          | Hide all arrows.                                                                     |

Clicking an arrow does not trigger `onPointerMissed`, so it won't clear your selection.

With the Engine, get the directions from the model:
`const model = useMemo(() => normalizePartReport(report), [report])`.

### `<SectionTool>`

Cut the part open from inside the viewport. Optional: mount it next to the part when the user
enters section mode, and unmount it when they leave.

```tsx
{
  sectioning ? <SectionTool /> : null
}
```

While it is up, hovering the part previews a cut through the face under the pointer and a click
places it; three coloured planes behind the part cut along an axis instead. Once there is a cut,
the part's own arrow drags it, an outlined sheet shows the cutting plane, and Escape clears it.

| Prop    | What it does                                                           |
| ------- | ---------------------------------------------------------------------- |
| `theme` | Override its colours — `sectionOutline` for the sheet and the preview. |

The cut it places is the viewer's own, and `<PartMesh>` follows it when given no `section` prop.
While the tool is mounted the part reports no hovers or picks. Details and the controlled
alternative are under [Section view](#section-view).

### `<MeasureTool>`

Measure the part from inside the viewport. Optional: mount it next to the part when the user
enters measure mode, and unmount it when they leave.

```tsx
{
  measuring ? <MeasureTool mode="distance" onChange={setMeasurements} /> : null
}
```

The pointer snaps to what is under it — a corner first, then an edge's midpoint, then the edge,
then the face — and a marker shows where the click will land. Two clicks measure a distance, three
an angle (one arm's end, the vertex, the other arm's end), with a live readout between clicks.
Finished measurements stay drawn over the part, each with a label, until Delete removes the last
one or the tool is unmounted. Escape drops the points of one in progress, and Shift holds the next
point to an axis through the last.

| Prop             | What it does                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `mode`           | `'distance'` (default) or `'angle'`. Changing it drops any points already placed.             |
| `measurements`   | Own the list. Omit it and the tool keeps its own.                                             |
| `onChange`       | The list changed: a measurement finished, or Delete removed the last one.                     |
| `showDeltas`     | Show a distance's X, Y and Z parts as dashed legs in the axis colours. On by default.         |
| `format`         | Write a length. Millimetres to two places by default; pass your own to show inches.           |
| `labelClassName` | Added to every label, beside `toolpath-measure-label`.                                        |
| `theme`          | Override its colours — `measure` for lines and markers, `measureSnap` for the snap indicator. |

Labels are DOM elements laid over the canvas and come **unstyled**: the tool is headless, and
what a label looks like is your stylesheet's, through the `toolpath-measure-label` class and the
data attributes on each one — see [Measuring](#measuring) for a starting point. While the tool is
mounted the part reports no hovers or picks, as with `<SectionTool>`.

### `<Grid>` and `<Axes>`

Reference geometry. The camera ignores both when it frames the part.

- **`<Grid>`** sits under the part and sizes itself to it: 5 mm squares under a 50 mm cube, 50 mm
  squares under a 900 mm plate. Props: `step` (square size in mm), `extent`, `color`,
  `opacity` (default `0.35`).
- **`<Axes>`** draws X (red), Y (green), and Z (blue) from the origin. Prop: `size` (default `25`).

## Recipes

### Camera buttons

Use a ref to move the camera from buttons outside the viewer:

```tsx
import { useRef } from 'react'
import { Viewer, type ViewerHandle } from '@toolpath/viewer'

const viewer = useRef<ViewerHandle>(null)

<button onClick={() => viewer.current?.fit()}>Fit</button>
<button onClick={() => viewer.current?.reset()}>Reset</button>
<button onClick={() => viewer.current?.setView('top')}>Top</button>
<button onClick={() => viewer.current?.setView('isometric')}>Iso</button>

<Viewer ref={viewer}>…</Viewer>
```

| Method                      | What it does                                                                   |
| --------------------------- | ------------------------------------------------------------------------------ |
| `fit()`                     | Fit the whole part, keeping the current angle.                                 |
| `reset()`                   | Go back to the starting view.                                                  |
| `setView(name)`             | `'top'`, `'bottom'`, `'front'`, `'back'`, `'left'`, `'right'`, `'isometric'`   |
| `setViewDirection({x,y,z})` | Look at the part from any direction (a vector pointing toward the camera).     |
| `frameBox(box)`             | Zoom to a `THREE.Box3`, keeping the current angle.                             |
| `setSection(options)`       | Set or clear (`null`) the viewer's own cut. See [Section view](#section-view). |

Components rendered **inside** `<Viewer>` can get the same methods with `useViewerControls()`.

### Selecting from a list

Keep the selection in your own state and share it between a feature list and the part. Hovering a
list row highlights the feature on the part, and clicking the row zooms to it:

```tsx
const [selected, setSelected] = useState<string | null>(null)
const [hovered, setHovered] = useState<string | null>(null)

<ul>
  {model.features.map((feature) => (
    <li
      key={feature.tag}
      onMouseEnter={() => setHovered(feature.tag)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => setSelected(feature.tag)}
    >
      {feature.featureType}
    </li>
  ))}
</ul>

<Viewer onPointerMissed={() => setSelected(null)}>
  <EnginePart
    report={report}
    selection={selected ? [selected] : []}
    hoveredFeatureIds={hovered ? [hovered] : []}
    focusFeature={selected}
    onPick={(pick) => setSelected(pick.best)}
  />
</Viewer>
```

`feature.tag` is the feature's ID. Always use it to refer to a feature, never the feature's
position in the array.

### Clicking the same face again to go through its matches

Clicking the same face repeatedly can step through its matching features, like most CAD tools do.
`focusForPick` handles this:

```tsx
const [focused, setFocused] = useState<string | null>(null)
const [lastRegion, setLastRegion] = useState<number | null>(null)

<EnginePart
  report={report}
  selection={focused ? [focused] : []}
  onPick={(pick) => {
    setFocused(focusForPick(pick, lastRegion, focused))
    setLastRegion(pick.region)
  }}
/>
```

A click on a different face starts again from that face's best match. To show the other matches
faintly, pass `pick.ranked` as `candidates`.

### Selecting several features with a modifier key

The viewer tells you which keys were held and leaves the behaviour to you:

```tsx
onPick={(pick) => {
  const tag = pick.best
  if (!tag) return
  if (pick.modifiers.shift) setSelection((current) => [...current, tag])
  else setSelection([tag])
}}
```

A double-click on the part also re-centres the view. The second click still calls `onPick`, with
`pick.doubled` set to `true`. Ignore those clicks if a double-click shouldn't change your selection.

### Showing only one machining direction

Pass the same index to the arrows and the part. Clicks then only match features machined from that
direction. A face that can't be reached from that direction gives `pick.best === null`.

```tsx
<EnginePart report={report} activeDirection={direction} onPick={onPick} />
<DirectionArrows
  directions={model.candidateDirections}
  activeDirection={direction}
  onPickDirection={setDirection}
/>
```

To list features by direction, use `groupByDirection(model)`. To label a direction, use
`directionLabel(direction)`, which gives `+Z`, `−X`, or `0.707, 0, 0.707`. To colour a direction
the same way as its arrow, use `directionColor(index)`.

### Custom colours

Use `highlights` for colours that mean something in your app, such as difficulty, setup, or cost.
Colours are hex numbers:

```tsx
const DIFFICULTY = { easy: 0x22c55e, medium: 0xeab308, hard: 0xef4444 }

<EnginePart
  report={report}
  highlights={features.map((f) => ({ tag: f.tag, color: DIFFICULTY[f.difficulty] }))}
  selection={selection}
/>
```

A face shows only one colour. When several layers apply, the one lower in this list wins:

1. `highlights` (your colours, per feature)
2. `regionHighlights` (your colours, per face)
3. `candidates` (faint, per direction)
4. `selection` (orange)
5. `pickedRegions`
6. `hoveredFeatureIds`
7. the face under the pointer

`weight` (`0`–`1`, default `0.7`) sets how strongly a highlight covers the part.

Changing colours is fast, even when every feature on a large part is highlighted.

### Section view

The quickest way is `<SectionTool>`. Put it inside `<Viewer>` next to the part and give `PartMesh`
no `section` prop:

```tsx
<Viewer ref={viewer}>
  <EnginePart report={report} />
  {sectioning ? <SectionTool /> : null}
</Viewer>
```

Hovering the part previews a cut through the face under the pointer; clicking places it. Three
coloured planes stand behind the part — click one to cut along that axis, in from your side. Once
there is a cut, a framed plane and two-way normal-axis handle show exactly what will move; drag the
handle to move it. Keep the canvas clear by presenting `sectionMeasurement(state)` beside the host
application's section slider; it reports the depth from a picked surface, or the distance swept
through the part bounds. Escape clears it.
The cut belongs to the viewer: `viewer.current.setSection(null)` clears it from a button outside
the canvas, `setSection({ enabled: true, normal, offset })` sets one, and `onSectionChange` on
`PartMesh` still reports every move.

While the tool is mounted, the part reports no hovers or picks — clicking a face cuts through it
without also selecting it. Unmount the tool, as above, and they come back.

To drive the cut yourself instead, pass `section`. `normal` points toward the half you keep.
`offset` goes from `0` (whole part) to `1` (fully cut away).

```tsx
const [cutting, setCutting] = useState(false)
const [offset, setOffset] = useState(0.5)

<input type="checkbox" checked={cutting} onChange={(e) => setCutting(e.target.checked)} />
<input type="range" min={0} max={1} step={0.01} value={offset}
       onChange={(e) => setOffset(Number(e.target.value))} />

<EnginePart
  report={report}
  section={{ enabled: cutting, normal: { x: 0, y: 0, z: 1 }, offset }}
  onSectionChange={(state) => setOffset(state.offset)}
/>
```

The cut surface is filled in with a hatch and outlined, so the part doesn't look hollow and the cut
reads as a cut. Passing `onSectionChange` also shows the draggable plane-frame gizmo. The handler is
called on every drag and only when the cut actually changes, so it's safe to store the value in
state; a cut going away is reported once, with `enabled: false`.

**Cutting at a clicked surface.** `sectionFromPick` places the cut at the surface the user clicked.
`depth` moves it into the part, in millimetres:

```tsx
const [plane, setPlane] = useState<SectionPlacement | null>(null)

<EnginePart
  report={report}
  section={{ enabled: plane !== null, plane, depth: 1 }}
  onPick={({ point: [x, y, z], normal: [nx, ny, nz] }) =>
    setPlane(sectionFromPick({ point: { x, y, z }, normal: { x: nx, y: ny, z: nz } }))
  }
/>
```

### Measuring

Mount `<MeasureTool>` next to the part. It needs nothing else:

```tsx
const [measuring, setMeasuring] = useState(false)
const [mode, setMode] = useState<MeasureMode>('distance')
const [measurements, setMeasurements] = useState<readonly Measurement[]>([])

<Viewer>
  <EnginePart report={report} />
  {measuring ? <MeasureTool mode={mode} onChange={setMeasurements} /> : null}
</Viewer>
```

Hover the part and a marker shows where a click will land: a corner, an edge's midpoint, a point
on an edge, or a point on the face, in that order of preference. It snaps to the edges the part
draws — the boundaries between analytic surfaces — so a corner is a corner of the part, not of a
mesh triangle. Click twice for a distance or three times for an angle. The line follows the pointer
between clicks with a live readout.

A distance is labelled with its length and, unless it already runs along an axis, broken into its
X, Y and Z parts as dashed legs in the axis colours with a label each. `showDeltas={false}` turns
the legs off. An angle draws its two arms and an arc, labelled in degrees.

`onChange` reports the list whenever it changes. Each entry is a `Measurement`: `kind`, an `id`,
and its `points` — two for a distance, three for an angle with the vertex in the middle. To own the
list, pass `measurements` too; to clear it, unmount the tool or pass `[]`. `measurementLabel(m)`
writes an entry the way the tool does, and `distanceBetween`, `deltaBetween` and `angleAt` are the
arithmetic behind it.

**Styling the labels.** Every label is a `<div class="toolpath-measure-label">` with
`data-measure-label` set to `distance`, `angle`, `delta` (one leg of a distance's X, Y, Z breakdown,
with `data-axis`) or `live` (the readout that follows the pointer), and `data-measurement-id` on
anything belonging to a finished measurement. Nothing else is set: no font, no colour, no
background. `labelClassName` adds your own class, for Tailwind or a CSS module. A stylesheet to
start from, which is what the example uses:

```css
.toolpath-measure-label {
  white-space: nowrap;
  font:
    600 12px/1.2 system-ui,
    sans-serif;
  color: #fff;
  background: rgba(20, 23, 33, 0.85);
  border: 1px solid #4f8ef7;
  border-radius: 4px;
  padding: 2px 6px;
  transform: translateY(-16px);
}
.toolpath-measure-label[data-measure-label='delta'] {
  font-size: 11px;
  transform: translateY(14px);
}
.toolpath-measure-label[data-axis='x'] {
  border-color: #ff6b6b;
}
```

Labels take no pointer events, so one lying over the part never takes a click meant for the face
under it. The lines, markers and arc are drawn on the canvas and themed through `measure`.

Lengths are written in millimetres by default. The part is in millimetres and the viewer does not
convert, so pass `format` to show anything else:

```tsx
<MeasureTool format={(mm) => `${(mm / MM_PER_INCH).toFixed(3)} in`} />
```

**Measuring a cut part.** Mount the measure tool with a section cut in place, or beside
`<SectionTool>`, and it measures what is on screen: the half a cut has removed is not there to snap
to, the part's edges stop at the plane, the outline where the plane passes through solid material
is an edge with corners of its own, and the capped face is a surface a point can land on. The
sample follows the cut — drag the handle or set a depth and the next pointer move sees the new cut.
It reads the plane off the part's own material, so a controlled `section` prop works the same way.
Beside a `<SectionTool>` that has no cut yet, the measure tool waits: it offers no snap and places
no point until a cut is chosen or the section tool is unmounted, so the click that picks the cut is
not also the first point of a measurement. Measurements already made stay up meanwhile.

Hold Shift to hold the next point to the X, Y or Z line through the last one — whichever axis the
pointer is furthest along — so a length along an edge is measured square rather than slightly across
it. The line wears that axis's colour while it is held, and the finished distance has no legs to
show. Delete or Backspace removes the last measurement, unless focus is in a field. Escape drops the
points of a measurement in progress. While the tool is mounted the part reports no hovers or picks;
unmounting it hands the pointer back.

### Theming

```tsx
<Viewer theme={{ ambientIntensity: 1.5 }}>
  <EnginePart report={report} theme={{ part: 0xe5e7eb, highlight: 0x2563eb, hover: 0x93c5fd }} />
  <ViewCube theme={{ cube: 0x1f2937, cubeLabel: 0xffffff }} />
</Viewer>
```

Colours are hex numbers. Lighting goes on `<Viewer>`, part colours go on the part, and cube colours
go on the cube. See `DEFAULT_THEME` for every key. The default part colours are tuned for the
default lighting, so if you change one, check the other.

The section cut is themed on the part too: `sectionCap` and `sectionHatch` are the cap's fill and
hatch lines, `sectionHandle` overrides the drag arrow's colour, and `sectionOutline` the
cutting-plane sheet and preview that `<SectionTool>` draws. Without a `sectionHandle` override, the
drag arrow uses the cutting plane's direction colour. `measure` and `measureSnap` are
`<MeasureTool>`'s lines and its snap indicator; a distance's X, Y, Z legs take `AXIS_COLORS`, the
same hues as the section tool's global planes.

`HIGHLIGHT_COLORS` has the standard selection colours (`default`, `toolIssue`, `geometryIssue`).
`DIRECTION_COLORS` has the 9 direction colours, which repeat for parts with more than 9 directions.

### Drawing your own objects in the scene

Anything React Three Fiber can draw can go inside `<Viewer>`, and the camera includes it when it
frames the scene. To leave an object out of framing, as `<Grid>` does, set
`userData={{ [EXCLUDE_FROM_FRAME]: true }}`.

Use `useContentBox()` inside the viewer to get the part's bounding box, for example to size your own
object.

## Errors

These are all thrown, so an error boundary catches them.

| Error                           | Import from               | When                                                                                                             |
| ------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PartReportFormatError`         | `@toolpath/viewer`        | The report is malformed. `error.issues` lists every problem.                                                     |
| `UnsupportedKernelVersionError` | `@toolpath/viewer`        | The report is from an Engine kernel older than `0.3.0`. Re-analyze the part.                                     |
| `PartMeshError`                 | `@toolpath/viewer/engine` | The mesh download failed (usually an expired URL: fetch the report again), or the mesh doesn't match the report. |
| `AggregateError`                | —                         | Both the GLB and the STL failed. `error.errors` has one error per file.                                          |

```tsx
import { PartReportFormatError, UnsupportedKernelVersionError } from '@toolpath/viewer'

function PartError({ error }: { error: Error }) {
  if (error instanceof UnsupportedKernelVersionError) return <p>Re-analyze this part to view it.</p>
  if (error instanceof PartReportFormatError)
    return <p>Invalid report: {error.issues.join(', ')}</p>
  return <p>Could not load this part. Refresh to try again.</p>
}
```

The viewer does not read STEP files. The Engine analyzes STEP files and produces the mesh the
viewer displays.

## Working with the Toolpath API

Use [`@toolpath/api`](https://www.npmjs.com/package/@toolpath/api) to get parts. Call it **from your
server**, so your API key stays private, and pass the result to the browser.

The API can give you two things to show:

- **An analyzed part** (`getPart`): faces and features. Use it with `<EnginePart>`.
- **A display mesh** (`getPartMesh`): faces only, but much faster, because the part isn't
  analyzed. Use it with `<PartMesh>`.

Both need a part whose CAD file is already uploaded. Their mesh URLs expire after 15 minutes, so
don't cache the responses.

### Analyzed part

```ts
// server
import { createToolpathClient } from '@toolpath/api'

const api = createToolpathClient({ apiKey: process.env.TOOLPATH_API_KEY! })

export const getReport = (partId: string) => api.parts.getPart({ id: partId })
```

```tsx
// browser
<Viewer>
  <EnginePart report={report} />
</Viewer>
```

### Display mesh

On the server, start a mesh job, wait for it, then get the mesh:

```ts
// server
export async function getMesh(partId: string) {
  const { jobId } = await api.parts.createPartMesh({ id: partId })

  let job = await api.jobs.getJob({ id: jobId })
  while (job.status === 'queued' || job.status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    job = await api.jobs.getJob({ id: jobId })
  }
  if (job.status === 'failed') throw new Error(job.error ?? 'Meshing failed')

  return api.parts.getPartMesh({ id: partId, jobId })
}
```

If the part already has a display mesh, skip the job and call `api.parts.getPartMesh({ id })`.

In the browser, turn the response into a model. `faceTriangleCounts` says how many triangles each
face has, so each count becomes one face:

```tsx
// browser
import { useEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'
import type { PartMeshResponse } from '@toolpath/api'
import { PartMesh, Viewer, buildRegionIndex, type PartModel } from '@toolpath/viewer'
import { loadPartMesh } from '@toolpath/viewer/engine'

function toModel(mesh: PartMeshResponse): PartModel {
  let start = 0
  const regions = (mesh.faceTriangleCounts ?? [mesh.meshTriangleCount]).map((count, idx) => {
    const triangles = { start, end: start + count }
    start += count
    return { idx, splitOrigin: idx, shapeKind: 'Unknown', area: 0, triangles }
  })
  const triangleCount = mesh.meshTriangleCount

  return {
    partId: mesh.partId,
    kernelVersion: '',
    features: [],
    regions,
    candidateDirections: [],
    mesh: {
      pointCount: mesh.meshPointCount,
      triangleCount,
      glbUrl: mesh.meshGlbUrl,
      stlUrl: null,
      thumbnailUrl: null,
    },
    regionIndex: buildRegionIndex({ regions, features: [], triangleCount }),
    warnings: [],
  }
}

export function MeshViewer({ mesh }: { mesh: PartMeshResponse }) {
  const model = useMemo(() => toModel(mesh), [mesh])
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)

  useEffect(() => {
    loadPartMesh(model.mesh).then(setGeometry)
  }, [model])

  if (!geometry) return <p>Loading…</p>

  return (
    <Viewer style={{ height: 500 }}>
      <PartMesh model={model} geometry={geometry} onPick={(pick) => console.log(pick.region)} />
    </Viewer>
  )
}
```

In a real app, also handle a failed download and call `geometry.dispose()` when you're done.

A display mesh has no features, so a click gives you only the face (`pick.region`), and
`pick.best` is always `null`. Use `pickedRegions` and `regionHighlights` to colour faces. Don't pass
a display mesh to `<EnginePart>`: its faces are numbered differently from an analyzed part's.

## Using it without the Engine

`<PartMesh>` takes a `PartModel` (the part's faces and features) and a three.js `BufferGeometry`
(the mesh). Use it to show a local file, a test fixture, or geometry you created yourself.

```tsx
import * as THREE from 'three'
import { PartMesh, Viewer, buildRegionIndex, type PartModel } from '@toolpath/viewer'

// A 20 mm cube. Each face is a region made of 2 triangles.
const geometry = new THREE.BoxGeometry(20, 20, 20).toNonIndexed()

const regions = [0, 1, 2, 3, 4, 5].map((idx) => ({
  idx,
  splitOrigin: idx,
  shapeKind: 'Plane',
  area: 400,
  triangles: { start: idx * 2, end: idx * 2 + 2 }, // [start, end)
}))

const features = [
  {
    tag: 'top',
    featureType: 'face',
    machiningDirection: { x: 0, y: 0, z: 1 },
    axis: null,
    regionIdxs: [4],
  },
  {
    tag: 'sides',
    featureType: 'wall',
    machiningDirection: { x: 0, y: 0, z: 1 },
    axis: null,
    regionIdxs: [0, 1, 2, 3],
  },
]

const model: PartModel = {
  partId: 'cube',
  kernelVersion: '0.3.0',
  features,
  regions,
  candidateDirections: [{ x: 0, y: 0, z: 1 }],
  mesh: { pointCount: 36, triangleCount: 12, glbUrl: null, stlUrl: null, thumbnailUrl: null },
  regionIndex: buildRegionIndex({ regions, features, triangleCount: 12 }),
  warnings: [],
}

export const Cube = () => (
  <Viewer style={{ height: 400 }}>
    <PartMesh model={model} geometry={geometry} onPick={(pick) => console.log(pick.ranked)} />
  </Viewer>
)
```

Requirements:

- **The mesh must be non-indexed** (call `.toNonIndexed()`). Each vertex can belong to only one
  face.
- **Regions must cover every triangle, with no gaps or overlaps.** `buildRegionIndex` throws if
  they don't.
- **Create the geometry once** (with `useMemo` or at module level). `PartMesh` doesn't dispose of
  it, so you're responsible for that.

If you have a report and want to load the mesh yourself, for example through your own backend,
use the functions in `@toolpath/viewer/engine`:

```ts
import { loadPartMesh, normalizePartReport, smoothRegionNormals } from '@toolpath/viewer/engine'

const model = normalizePartReport(report) // throws on a bad report
const geometry = await loadPartMesh(model.mesh, { fetch: myFetch, signal })
smoothRegionNormals(geometry, model.regions) // curved faces look smooth, edges stay sharp
```

[`examples/react-viewer`](https://github.com/toolpath/ui-packages/tree/main/examples/react-viewer)
is a complete app built this way, with no API key needed.

## Reference

### Entry points

| Import                    | Contents                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@toolpath/viewer`        | All components, hooks, types, and helpers. Also re-exports `EnginePart`, `normalizePartReport`, and `smoothRegionNormals`.                                                                           |
| `@toolpath/viewer/engine` | Loading Engine reports and meshes: `EnginePart`, `loadPartMesh`, `loadPartGeometry`, `parsePartGeometry`, `PartMeshError`, `engineGeometryCache`, `createEngineGeometryCache`, `MIN_KERNEL_VERSION`. |

### Hooks

| Hook                  | Use inside `<Viewer>` to…                                                        |
| --------------------- | -------------------------------------------------------------------------------- |
| `useViewerControls()` | Get `fit`, `reset`, `setView`, `setViewDirection`, `frameBox`, and `setSection`. |
| `useSectionStore()`   | Read, set, or subscribe to the viewer's own cut.                                 |
| `useContentBox()`     | Get the part's bounding box (a `THREE.Box3`, empty until loaded).                |
| `useTapGuard()`       | Check whether a pointer event was a click and not a drag.                        |

### Helpers

| Helper                                                   | What it does                                                |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `normalizePartReport(report)`                            | Checks an API report and converts it to a `PartModel`.      |
| `buildRegionIndex({ regions, features, triangleCount })` | Builds the lookups between triangles, faces, and features.  |
| `model.regionIndex.featuresForRegion(i)`                 | The features that own a face.                               |
| `model.regionIndex.regionsForFeature(tag)`               | The faces that make up a feature.                           |
| `focusForPick(pick, lastRegion, lastFocus)`              | Steps through a face's matches on repeated clicks.          |
| `rankOwners` / `bestOwner`                               | The ranking `onPick` uses, if you want to run it yourself.  |
| `groupByDirection(model)`                                | Features grouped by machining direction.                    |
| `directionLabel(v)` / `directionColor(i)`                | A direction's label and colour.                             |
| `sectionFromPick({ point, normal })`                     | Turns a clicked surface into a section plane.               |
| `measurementLabel(measurement, format?)`                 | Writes a measurement the way `<MeasureTool>` labels it.     |
| `snapAt(hit, edges, camera, viewport)`                   | Where a point on the part snaps to, for a tool of your own. |
| `engineGeometryCache.clear()`                            | Frees every cached mesh.                                    |

The package also exports lower-level geometry, camera, and view-cube functions that the components
use. They're listed in `dist/index.d.ts`.

### Types

`ViewerProps`, `ViewerHandle`, `ViewerView`, `Projection`, `ControlScheme`, `EnginePartProps`,
`PartMeshProps`, `PartPick`, `PickModifiers`, `PartModel`, `PartModelFeature`, `PartModelRegion`,
`FeatureTag`, `FeatureType`, `Vec3`, `FeatureHighlight`, `RegionHighlight`, `FocusOptions`, `SectionOptions`,
`SectionState`, `SectionPlacement`, `SectionToolProps`, `SectionStore`, `MeasureToolProps`,
`MeasureMode`, `Measurement`, `DistanceMeasurement`, `AngleMeasurement`, `Snap`, `SnapKind`,
`ViewerTheme`, `ViewName`, `DirectionArrowsProps`, `NamedDirection`, `GridProps`, `AxesProps`,
`ViewCubeProps`, `ViewerToolbarProps`, `BananaButtonProps`.

`FeatureType` and `ShapeKind` accept any string, because newer Engine versions add new values.
Handle values you don't recognize.
