---
'@toolpath/viewer': minor
---

Inside a `PartCollection`, the nearest part now stops pointer moves, clicks, and right-button picks, so the bodies behind it and handlers on the collection's parent groups no longer receive them. A `PartMesh` on its own passes them on as before. `SectionView` accepts several meshes for one cut, and `PartCollection` draws a single section cap and handle for all of its items.
