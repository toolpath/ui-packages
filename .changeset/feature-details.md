---
'@toolpath/viewer': minor
---

`<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
`usePartContext()`.

`featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
plain arrays.

`<ToolMarks>` draws cutting tools on the part to scale — flat, bull nose or ball — with a dimension and
a label each, in the measure tool's style.
