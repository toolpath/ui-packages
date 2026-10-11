---
'@toolpath/dfm': minor
---

Add `featureDemand` to `@toolpath/dfm/model`: a feature's tool demand (`FeatureDemand` from `@toolpath/tool-support`) read off its sheet, to filter a tool library with `fitTools`. Add `formsFor` and `FEATURE_TOOL_FORMS`: the tool forms that may cut each feature type. `FeatureSheet` now carries a hole's `maxDrill` and `maxEndmill`.
