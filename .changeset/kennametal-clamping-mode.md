---
'@toolpath/tool-scraper': major
---

Kennametal's shrink-fit and hydraulic holders now report `clamping: 'shrink'` and
`clamping: 'hydraulic'` instead of `clamping: 'bore'`.

135 families and 989 parts change value: 78 shrink-fit families (650 parts) and 57
hydraulic families (339 parts). `bore` is no longer declared by any Kennametal family.

Previously `clamping` was derived from the variant table — a `D1` bore with no collet
series — while MariTool derived it from the vendor's leaf category. A consumer holding
both catalogs saw two meanings of the axis, and filtering on `clamping === 'hydraulic'`
returned MariTool's chucks and none of Kennametal's. Kennametal states the mode in the
family breadcrumb, which these families' `style` facts already cited.

Fit behavior is unchanged: all three modes are in `BORE_CLAMPINGS`, so a shank-gripping
holder still publishes a bore and no collet series. Consumers matching `clamping === 'bore'`
to mean "grips a shank" must use `BORE_CLAMPINGS` instead.
