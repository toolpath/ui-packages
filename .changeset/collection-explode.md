---
'@toolpath/viewer': minor
---

`PartCollection` takes `explode={{ amount, offsets? }}` to pull its bodies apart so each one can be seen. Each item moves as a whole, with its edges, paint, threads and children, by its offset times the amount; picks, hover and the section cap follow it. The amount is a number from 0 to 1 or an `ExplodeAmount`, such as `createExplodeMotion`, read on each frame without a React render. While `explode` is given, the collection's shared bounds hold the bodies both assembled and apart, so the grid and section stay put while they move. Without `explode` nothing changes.

`collectionExplodeOffsets(items, { gap? })` computes the offsets `PartCollection` uses by default: each body moves out from the collection's centre towards its own centre, just far enough that its bounding box clears the others by `gap` (a fraction of the collection's diagonal, 0.05 by default), and bodies centred on the collection's centre stack upwards. `collectionBounds(items, { offsets })` measures the extent the bodies cover from assembled to fully apart, for `ViewerHandle.frameBox`.

`SectionView` takes optional `placements`, the objects drawing each geometry, so its cap follows bodies that have moved. `PartMesh`'s `focusFeature` frames the feature where the part is drawn.
