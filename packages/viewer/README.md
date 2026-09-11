# `@toolpath/viewer`

React Three Fiber components for exploring Toolpath Engine part meshes. The package is client-side:
it can be imported by an SSR application, but render `<Viewer>` from a client component.

```bash
npm install @toolpath/viewer react react-dom three @react-three/fiber @react-three/drei
```

## Toolpath Engine reports

```tsx
import { Axes, DirectionArrows, Grid, ViewCube, Viewer } from '@toolpath/viewer'
import { EnginePart } from '@toolpath/viewer/engine'
;<Suspense fallback={<p>Loading mesh…</p>}>
  <Viewer style={{ height: 500 }}>
    <EnginePart report={report} selection={selection} onPick={(pick) => setPick(pick)} />
    <Grid />
    <Axes />
    <ViewCube />
  </Viewer>
</Suspense>
```

`EnginePart` takes a `PartResponse` exactly as `@toolpath/api` returns it and validates it:
a malformed report throws `PartReportFormatError` carrying every problem it found, and one from a
kernel older than `0.3.0` — before `regions[]` and `featureTag` existed — throws
`UnsupportedKernelVersionError`. It fetches `meshGlbUrl`, falls back to `meshStlUrl`, and refuses a
mesh whose triangle count does not match the report, because region ranges index that buffer
directly and a mismatch would quietly highlight the wrong surface.

Wrap the tree in an error boundary: an expired mesh URL, a malformed report, and an old kernel all
arrive as thrown errors rather than as empty states. The viewer does not parse STEP — the Engine
analyzes STEP and emits tessellated GLB/STL for display.

## A click means several things at once

A region on the mesh is owned by **five to eight features at once** — measured on a cube, not
estimated. The same physical face is a `face` cut from one direction and a `wall` from others, and
every direction's `profile` overlaps the surfaces it traces. Nothing can reduce that to one answer,
so `onPick` hands over the whole set:

```tsx
<Viewer onPointerMissed={clearSelection}>
  <EnginePart
    report={report}
    onPick={(pick) => {
      setCandidates(pick.ranked) // every reading, best first
      setFocused(focusForPick(pick, lastRegion, focused)) // clicking again walks them
      setLastRegion(pick.region)
    }}
  />
</Viewer>
```

Putting the selection down belongs to `<Viewer onPointerMissed>` rather than to
`onPick`: a mesh's own missed event fires whenever _that mesh_ was not hit,
including when the click landed on a direction arrow or a section handle, so
reporting it from the part made pressing an arrow clear the selection.

`ranked` orders the owners by type specificity — a hole beats the wall it is bored through, and a
`profile` never wins the surface it traces — then by which reading faces the camera. `best` is the
first of them. Pass `activeDirection` to scope a pick to one machining direction, which **filters**
rather than reorders: a face that direction cannot reach picks to nothing, which is a real answer
rather than a missed click.

## Colouring the part

A face can only be one colour, so the layers are painted weakest first and each overwrites what is
under it:

| Layer               | Weight | What it says                                  |
| ------------------- | ------ | --------------------------------------------- |
| `highlights`        | 0.7    | your own meaning — a difficulty band, a setup |
| `regionHighlights`  | 0.7    | the same, on named faces rather than features |
| `candidates`        | 0.4    | what a click could have meant, per direction  |
| `selection`         | 1.0    | the features being read                       |
| `hoveredFeatureIds` | 0.85   | a list row under the pointer                  |
| the hovered face    | 0.85   | what the pointer is on, tracked for you       |

Highlighting is a texture write rather than a material change, so lighting every feature of a part
costs one mesh, one material, and one draw call.

## Sectioning

```tsx
<EnginePart
  report={report}
  section={{ enabled: true, normal: { x: 0, y: 0, z: 1 }, offset }}
  onSectionChange={(state) => setOffset(state.offset)}
/>
```

`normal` points into the half that stays and `offset` runs 0 (whole) to 1 (gone). To cut from a
surface instead, turn a pick into a placement with `sectionFromPick(pick)` and pass it as `plane`,
moving it with `depth` in model units. The cut is capped rather than left hollow, and its arrow can
be dragged; `onSectionChange` reports every move, including the drag's.

## Camera and controls

Use a ref or `useViewerControls()` beneath a viewer to call `fit`, `reset`, `setView`, and
`setViewDirection`. The part data is Z-up millimetres and the camera says so.

- `controls="toolpath"` (default) — left-drag orbits, right-drag pans.
- `controls="fusion"` — middle-drag and two-finger scroll pan, shift orbits, pinch zooms.
- `projection` — `"orthographic"` by default, because it is what a machinist reads a part in:
  parallel edges stay parallel, so two features the same size measure the same size wherever they
  sit. `"perspective"` is the better answer for reading a deep pocket as depth.
- `freeOrbit` (default on) — orbiting past a pole keeps going instead of sticking there.
- `retargetOnDoubleClick` (default on) — a double **left** click on the part orbits about what was
  clicked from then on. It moves to the middle of the view at the same size and angle, and the move
  is immediate — the damping these controls ship with settles a transition inside one frame. Turn
  on `showOrbitTarget` if the pivot moving needs to be visible. The click is still a click: its pick
  carries `doubled: true`, so what a second click means to the part is yours to decide. Double
  **middle** click re-frames the whole part, which is the way back.
- `showOrbitTarget` (default **off**) — a dot inside a ring at the point the view turns and zooms
  about. Up while a gesture is running, flashed when the pivot moves on its own, then faded. It is
  what makes zooming to the cursor legible: the pivot moves with it, and nothing else reports that.

`<ViewCube>` offers all 26 standard views: six faces, twelve edge chamfers, and eight corners, so
an isometric is a click rather than a drag. `<Grid>` sizes itself from the part — 5 mm cells under a
50 mm cube, 50 mm under a 900 mm plate — and sits on the part's underside. `<DirectionArrows>`
draws the directions a part can be held in, each in its own colour, aimed inward because a
machining direction is the direction the tool comes from.

## Driving it without the Engine

`PartMesh` takes a `PartModel` and a `BufferGeometry` directly, so the viewer can be driven from a
file, a fixture, or geometry you built yourself — see `examples/react-viewer`. The mesh must be
non-indexed: highlighting is a per-vertex region attribute, and a vertex shared between two regions
has no single value to carry.
