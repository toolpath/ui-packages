---
'@toolpath/viewer': minor
---

Add `<MeasureTool>`, an opt-in way to measure a part from inside the viewport. Mounted beside
`<PartMesh>` with nothing wired, it snaps the pointer to the corner, edge midpoint, edge or face
under it and shows where a click will land; two clicks measure a distance, shown with its X, Y and Z
parts as dashed legs, and three measure an angle. Finished measurements stay drawn over the part
with a DOM label each until Delete removes the last one or the tool is unmounted; Escape drops the
points of one in progress, and Shift holds the next point to the X, Y or Z line through the last.
`measurements` and `onChange` make the list the consumer's, `format` writes lengths in something
other than millimetres, and `MEASURE_LABEL_CLASS` is on every label.

While the tool is mounted, `<PartMesh>` reports no hovers or picks, as it does for `<SectionTool>`.
The engaged flag both tools set on the section store is now counted, so the two can be mounted
together and the part waits for the last to leave.

`ViewerTheme` gains `measure` for a measurement's lines, markers and label border, and
`measureSnap` for the snap indicator. `AXIS_COLORS`, the three axis hues the section tool's global
planes already wore, is exported and shared with a distance's delta legs.

`surfaceUnderRay`, and so the section tool's preview, now skips a surface a section cut has clipped
away rather than landing on a face nobody can see. `hitUnderRay` is the walk it shares with the
measure tool, and is exported.
