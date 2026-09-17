---
'@toolpath/viewer': minor
---

`<MeasureTool>` measures a cut part as it is seen. While it is mounted it re-samples the part
whenever a clipping plane moves: the half a cut has removed is not offered for snapping, the part's
edges stop at the plane, the outline where the plane passes through solid material is an edge with
corners of its own, and the capped face is a surface a point can land on. The plane is read off the
part material's clipping planes, so the viewer's own cut and a controlled `section` prop work the
same way, and the sample is keyed on the plane so a dragged handle or a set depth is re-sampled on
the next pointer move.

`sectionContour`, `clipSegments`, `pointInContour`, `capHit` and `sampleSection` are the pure
functions behind it, exported from the root with the `SectionSample` type.
