---
'@toolpath/viewer': major
---

`MeasureTool` measures by what is clicked, and it measures a cut part as the cut leaves it.

**Breaking.** `MeasureTool` now mounts inside `PartMesh` or `EnginePart`, as their child, not
beside them in `Viewer`. Mounted outside one it throws when it renders, which a type check does
not catch. It has no `mode` and no `showDeltas`. `measurements` and `onChange` are
`readonly MeasureGroup[]`, each one pick or two, not `Measurement[]`. Labels have
`data-measure-label` `face` or `delta`; `distance`, `angle`, `live` and `data-measurement-id` are
gone. The `measureSnap` theme colour is unused and deprecated.

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
