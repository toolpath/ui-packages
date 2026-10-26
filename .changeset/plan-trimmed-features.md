---
'@toolpath/plan': minor
---

Read the trimmed features Toolpath serves with a plan: what is left of a part's feature once ignored
faces (from Engine API 1.30.0) or a pinned feature sharing its faces (from the Engine release that
plans with tp-kernel 0.29) keep some of its faces away. A plan's tags can name them, a draft can pin
them, and the part's report does not list them.

- `EnginePlan` has `trimmedFeatures`, a list of `TrimmedFeature`. Read an Engine's null or absent
  field as `[]` when parsing a plan.
- `planFeaturesOf(reportFeatures, plan, pinned?)` joins plan tags to features: the report's, then
  the trimmed ones shaped like them, each with `trimmed` and `fromFeatureTag`, less any whose tag
  the report lists. Pass it to `classifyFaces` and `groupFaces` so a trimmed feature's faces read
  as its own; in the constraints view pass the pins, so only pinned trimmed features show.
- `planView` and `resultsView` mark a trimmed row `trimmed` and label it `Pocket (trimmed)`, from
  the feature it was trimmed from or its own type (`trimmedFeatureLabel`).
- `draftView` takes the latest plan as an optional third argument, and labels a pinned trimmed tag
  the same way.

`trimmedFeatures` is required on `EnginePlan`: an app that builds one sets it, `[]` for an older
Engine.
