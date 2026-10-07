---
'@toolpath/viewer': minor
---

`<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
`usePartContext()`.
`featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
plain arrays.
