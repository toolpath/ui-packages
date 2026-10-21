---
'@toolpath/viewer': minor
---

`<PartMesh>` and `<EnginePart>` now draw threads in the holes they are cut in, with the new
`threads` prop: each `ThreadMark`'s pitch (negative for a left-hand thread) as a helix of light and
shade over the hole's bore. The Engine cuts a modeled internal thread out of the mesh, so a tapped
hole otherwise shows as a plain bore. `threadMark(feature, datasheet)` from
`@toolpath/viewer/engine` reads the mark from a hole's Engine datasheet, and
`ViewerToolbar.ThreadsButton` toggles it through the new `threads` toolbar control.
