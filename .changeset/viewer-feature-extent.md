---
'@toolpath/viewer': minor
---

Add `featureExtent(model, geometry, tag, direction)`: a feature's size seen down a machining direction, measured off its triangles — `across`, its two spans in the plane square to the direction, largest first, and `along`, its span down it — or `null` for a feature with no triangles. A datasheet states no plan size for a pocket; this is it.
