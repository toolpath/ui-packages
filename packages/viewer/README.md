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

Parts are in **millimetres** with **Z pointing up**. The camera uses the same convention.

### A click usually matches several features

The same face is usually owned by **5–8 features at once**, even on a plain cube: it can be a
`face` when cut from one direction, a `wall` when cut from another, and part of every `profile`
around it. So a click gives you every match, and you decide which to use:

| Field            | What it contains                                                    |
| ---------------- | ------------------------------------------------------------------- |
| `pick.best`      | The most likely feature, or `null`                                  |
| `pick.ranked`    | Every matching feature, most likely first                           |
| `pick.owners`    | Every matching feature, in report order                             |
| `pick.region`    | The index of the face that was clicked                              |
| `pick.point`     | Where the click hit, as `[x, y, z]`                                 |
| `pick.normal`    | The direction the clicked surface faces, as `[x, y, z]`             |
| `pick.modifiers` | `{ alt, ctrl, meta, shift, secondary }`: keys held, and right-click |
| `pick.doubled`   | `true` if this click was the second half of a double-click          |

The ranking puts specific features first: holes, then pockets and bosses, then chamfers and
fillets, then walls and faces, then profiles. Among features of the same kind, the one whose
machining direction points most toward the camera wins.

## Components

### `<Viewer>`

The canvas that holds everything. Import it from `@toolpath/viewer`.

| Prop                    | Default          | What it does                                                                                                |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `projection`            | `'orthographic'` | `'orthographic'` keeps parallel lines parallel. `'perspective'` gives depth, which helps with deep pockets. |
| `controls`              | `'toolpath'`     | Mouse mapping. See [Mouse controls](#mouse-controls).                                                       |
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

#### Mouse controls

| Action                | `controls="toolpath"` (default) | `controls="fusion"` (like Fusion 360)      |
| --------------------- | ------------------------------- | ------------------------------------------ |
| Rotate                | Left-drag                       | Shift + middle-drag, or Shift + scroll     |
| Pan                   | Right-drag or middle-drag       | Middle-drag, or scroll / two-finger scroll |
| Zoom                  | Scroll wheel                    | Trackpad pinch                             |
| Rotate around a point | Double-click the part           | Double-click the part                      |
| Fit whole part        | Double middle-click             | Double middle-click                        |

In `fusion` mode, left-drag doesn't move the camera, and the scroll wheel pans instead of zooming.
On touch screens, one finger rotates and two fingers pinch and pan.

Dragging never selects anything. A click only counts if the pointer barely moved.

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

| Prop                | Type                   | What it does                                                   |
| ------------------- | ---------------------- | -------------------------------------------------------------- |
| `selection`         | `string[]`             | Feature tags to highlight as selected (orange).                |
| `highlights`        | `FeatureHighlight[]`   | Your own colour per feature, e.g. difficulty or setup.         |
| `regionHighlights`  | `RegionHighlight[]`    | Your own colour per face.                                      |
| `candidates`        | `string[]`             | Other possible matches, faintly tinted by machining direction. |
| `pickedRegions`     | `number[]`             | Faces to mark as just clicked.                                 |
| `hoveredFeatureIds` | `string[]`             | Features to show as hovered, e.g. when hovering a list row.    |
| `showEdges`         | `boolean` (`true`)     | Draw outlines between faces.                                   |
| `theme`             | `Partial<ViewerTheme>` | Override the part's colours.                                   |

**Interaction**

| Prop              | Type                               | What it does                                                                                   |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| `onPick`          | `(pick: PartPick) => void`         | Left- or right-click on the part.                                                              |
| `onHover`         | `(pick: PartPick \| null) => void` | The pointer moved onto a different face, or off the part (`null`).                             |
| `activeDirection` | `number \| null`                   | Only match features machined from this direction (an index into `candidateDirections`).        |
| `focusFeature`    | `string \| null`                   | Zoom to this feature. The camera moves each time the value changes.                            |
| `section`         | `SectionOptions`                   | Cut the part open. Omit it to follow the viewer's own cut. See [Section view](#section-view).  |
| `onSectionChange` | `(state: SectionState) => void`    | Called when the cut moves or goes away. With `section`, passing it also shows the drag handle. |
| `onAdjacency`     | `(map) => void`                    | Called once per mesh with which faces touch which.                                             |

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

| Prop             | What it does                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `mode`           | `'distance'` (default) or `'angle'`. Changing it drops any points already placed.                |
| `measurements`   | Own the list. Omit it and the tool keeps its own.                                                |
| `onChange`       | The list changed: a measurement finished, or Delete removed the last one.                        |
| `showDeltas`     | Show a distance's X, Y and Z parts as dashed legs in the axis colours. On by default.            |
| `format`         | Write a length. Millimetres to two places by default; pass your own to show inches.              |
| `labelClassName` | Added to every label, beside `toolpath-measure-label`.                                           |
| `theme`          | Override its colours — `measure` for lines, markers and labels, `measureSnap` for the indicator. |

Labels are DOM elements laid over the canvas, styled inline so they read with no stylesheet.
Restyle them through the `toolpath-measure-label` class, or `labelClassName`. While the tool is
mounted the part reports no hovers or picks, as with `<SectionTool>`. Details are under
[Measuring](#measuring).

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
there is a cut, an arrow drags it, an outlined sheet shows the cutting plane, and Escape clears it.
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
reads as a cut. Passing `onSectionChange` also shows an arrow handle users can drag. The handler is
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

Lengths are written in millimetres by default. The part is in millimetres and the viewer does not
convert, so pass `format` to show anything else:

```tsx
<MeasureTool format={(mm) => `${(mm / MM_PER_INCH).toFixed(3)} in`} />
```

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
hatch lines, `sectionHandle` the drag arrow, and `sectionOutline` the cutting-plane sheet and
preview that `<SectionTool>` draws. `measure` and `measureSnap` are `<MeasureTool>`'s lines and its
snap indicator; a distance's X, Y, Z legs take `AXIS_COLORS`, the same hues as the section tool's
global planes.

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
`FeatureTag`, `FeatureType`, `Vec3`, `FeatureHighlight`, `RegionHighlight`, `SectionOptions`,
`SectionState`, `SectionPlacement`, `SectionToolProps`, `SectionStore`, `MeasureToolProps`,
`MeasureMode`, `Measurement`, `DistanceMeasurement`, `AngleMeasurement`, `Snap`, `SnapKind`,
`ViewerTheme`, `ViewName`, `DirectionArrowsProps`, `NamedDirection`, `GridProps`, `AxesProps`,
`ViewCubeProps`.

`FeatureType` and `ShapeKind` accept any string, because newer Engine versions add new values.
Handle values you don't recognize.
