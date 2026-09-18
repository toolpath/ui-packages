---
'@toolpath/viewer': minor
---

`<MeasureTool>` mounted beside a `<SectionTool>` that has no cut yet offers no snap and places no
point until a cut is chosen or the section tool is unmounted, so the click that picks a cut is not
also the first point of a measurement. `SectionStore` gains `isPicking` and `setPicking`, which the
section tool raises while it offers a cut.
