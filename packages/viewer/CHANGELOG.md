# @toolpath/viewer

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
