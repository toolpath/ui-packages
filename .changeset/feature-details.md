---
'@toolpath/viewer': minor
'@toolpath/dfm': minor
---

`<PartMesh>` and `<EnginePart>` take `children`, drawn on the part, which read its model and mesh with
`usePartContext()`.

`featureTriangles(model, geometry, tag)` reads a feature's triangles and outward normals out of the mesh as
plain arrays.

`<ToolMarks>` draws cutting tools on the part to scale — flat, bull nose or ball — with a dimension and
a label each, in the measure tool's style.

`@toolpath/dfm/model` adds `brokenRules` and the neutral `BrokenRule` row a feature's details list, `featureColor`
for the colour a feature is painted, and the `FeatureRecord` type for a feature's raw report entry and datasheet.

`pinchMark` and `pinchLabel` read the pinch discs a feature's widest tool stands in, and `placePinchTool` finds
the datasheet's tool frame against the feature's faces and places that tool on the part, as plain vectors for
`<ToolMarks>`.

`FoldStore` and `storageFolds(storage, prefix)` keep which of the feature panel's sections are open, in a storage
and under a key prefix the app chooses.

`<FeatureDetails>` shows one feature as the Engine read it: its name and machining direction, the rules it breaks,
its measurements and milling considerations with how each was measured, and its reach. It takes loading and
failed reads with a Retry, slots for the app's own buttons and status, an optional REQUIRED pill and "Show this
feature", a `pinchPoints` toggle on the widest tool's row, and a `look`. `featureMeasurements` takes `inchMark`
to write inches as `0.46"`.

It also lists every field of the feature's datasheet and shows its raw API record, with a copy button.

With `PopOut`, the app's own window component, the reach, the datasheet fields and the raw record pop out, larger,
into it.

`<CandidateList>` lists the features a clicked face could mean, with each one's colour, rule count, REQUIRED pill
and the app's detail, note and action, chosen by click or by `candidateListKeys`.

`<ComparisonTable>` sets the features several faces were read as side by side, marking the rows where they differ.
