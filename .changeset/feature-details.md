---
'@toolpath/viewer': minor
'@toolpath/dfm': minor
---

`<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
`usePartContext()`.

`featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
plain arrays.

`<ToolMarks>` draws cutting tools on the part to scale — flat, bull nose or ball — with a dimension and
a label each, in the measure tool's style.

`@toolpath/dfm/model` adds `brokenRules` and the neutral `BrokenRule` row a feature's details list, `featureColor`
for the colour a feature is painted, and the `FeatureRecord` type for a feature's raw report entry and datasheet.

`pinchMark` and `pinchLabel` read the pinch discs a feature's widest tool stands in, and `placePinchTool` finds
the datasheet's tool frame against the feature's faces and places that tool on the part, as plain vectors for
`<ToolMarks>`.
