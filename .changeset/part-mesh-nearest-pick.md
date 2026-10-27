---
'@toolpath/viewer': minor
---

`PartMesh` now stops pointer moves, clicks, and right-button picks at the nearest part, so a part behind it, or a handler on a parent group, no longer receives them. `SectionView` accepts several meshes for one cut, and `PartCollection` draws a single section cap and handle for all of its items.
