---
'@toolpath/viewer': minor
---

Add sharp corners: `sharpCorners` on `<PartMesh>` and `<EnginePart>` draws the sharp corners of the features the DFM rules flag (`featureSheet(datasheet).sharpCorners` from `@toolpath/dfm/model`) as red bands painted on the faces either side, strong in view and faint through the part. The rules decide which corners; the mesh only locates each flagged feature's inside corners along its machining direction. `ViewerToolbar.SharpCornersButton` turns them on and off from a new `sharpCorners` toolbar control. With hover on, the corner under the pointer takes the hover colour and is reported on the pick as `pick.sharpCorner` — its feature, ends, length and the angle between its faces — for a hover card to describe. Adds the `sharpCorner` theme colour, and exports `surfaceCreases`, `findSharpCorners` and `sharpCornerPositions`.
