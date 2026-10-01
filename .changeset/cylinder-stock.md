---
'@toolpath/viewer': major
---

Consolidate stock rendering into `Stock`, accepting exactly one of `geometry`, `glb`, `box`, or `cylinder`. Box and cylinder inputs accept either resolved placement or part-relative preview options, with placement calculated internally. Resolved box figures support optional setup frames; resolved cylinder figures support arbitrary axes. Fetching, caching and artifact storage remain caller-owned. Stock outlines are built only when shown.

Remove `BoxStock` and `BoxStockProps`. Replace `<BoxStock partGeometry={geometry} allowance={allowance} />` with `<Stock box={{ partGeometry: geometry, allowance }} />`; for explicit dimensions use `<Stock box={{ partGeometry: geometry, dimensions, position, positionOffset, offset }} />`. Preview builders are internal, and inline options do not cause repeated part scans on ordinary renders. Existing `<Stock geometry={geometry} />` usage is unchanged.
