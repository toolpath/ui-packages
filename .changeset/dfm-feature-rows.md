---
'@toolpath/dfm': minor
---

Add `featureRows` to `@toolpath/dfm/model`: a feature list with one row per set of faces within a machining direction, shown as its most specific reading with every reading in `tags`, `profile`s left out, sorted a direction at a time, then by type rank and area, each with a label and a short measurement (`⌀10 mm × 15 deep`, `40 × 40 mm, 15 deep`). The direction index and type rank are passed in (`directionIndexOf` and `featureTypeRank` from `@toolpath/viewer`), as are region areas, datasheets and a plan-size measure (`FeatureExtent`).
