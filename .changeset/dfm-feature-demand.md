---
'@toolpath/dfm': minor
---

Add `featureDemand` to `@toolpath/dfm/model`: a feature's tool demand (`FeatureDemand` from `@toolpath/tool-support`) read off its sheet, in line with the catalog's `demandOf`, to filter a tool library with `fitTools`. Add `formsFor` (with its `FeatureFormFacts` input): the tool forms that may cut a feature type, from the catalog's feature defaults. `FeatureSheet` now carries a hole's `maxDrill` and `maxEndmill`.
