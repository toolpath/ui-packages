---
'@toolpath/viewer': minor
---

Add `<SectionTool>`, an opt-in way to cut a part open from inside the viewport. Mounted beside
`<PartMesh>` with nothing wired, it previews a cut on the face under the pointer and places one on
a click, offers three global planes behind the part to sweep along an axis, draws the cutting plane
as an outlined sheet once there is a cut, and clears it on Escape.

While the tool is mounted, `<PartMesh>` reports no hovers or picks and paints no hover;
unmounting it hands the pointer back.

The cut it places is held by `<Viewer>` itself. `<PartMesh>` follows that cut, and shows the drag
handle for it, whenever it is given no `section` prop of its own; a `section` prop is unchanged and
still takes precedence. `ViewerHandle.setSection(options | null)` sets or clears it from outside
the canvas, and `useSectionStore()` reads it from inside.

The section cap is now hatched and outlined rather than a flat fill, in screen space so it reads
the same at any zoom. `ViewerTheme` gains `sectionHatch` for the hatch lines; `sectionOutline`,
previously declared but unused, now colours the tool's sheet and preview.

`onSectionChange` now also reports a cut going away, once, as a state with `enabled: false`.
`DISABLED_SECTION` is that state. `SectionOptions` and `SectionState` are unchanged and still
exported from the root.
