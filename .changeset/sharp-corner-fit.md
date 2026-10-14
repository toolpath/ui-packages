---
'@toolpath/tool-support': minor
'@toolpath/dfm': minor
---

Say when a feature's sharp inside corners are what rules a tool out. `FeatureDemand` gains `sharpCorners` and `maxToolSomewhere` (the widest cutter that fits anywhere), and `FitFailure` gains an optional `kind: 'sharp-corner'` with `leavesCornerRadius`: in a feature drawn with sharp corners, `fitAgainst` still fits no cutter, as the catalog does, but each failure says the tool leaves `DC / 2` in the corners rather than calling it wider than the tolerance's 0.012 mm reading of them; a tool wider than `maxToolSomewhere` is refused for that. `featureDemand` in `@toolpath/dfm/model` sets both from the sheet's sharp-corner reading, and `FeatureSheet` now carries `maxToolSomewhere` (`cd.ignore.max`).
