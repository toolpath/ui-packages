---
'@toolpath/dfm': minor
'@toolpath/viewer': minor
'@toolpath/plan': minor
---

Leave out features nothing machines, the same way in every app.

- `@toolpath/dfm`: `featureSheet` marks `invalidGeometry` where the Engine measured a feature and found it is not one of its kind (a T-slot with `facts.isInvalidGeometry`, or an all-zero cutter band from an older kernel), and `unplannable` where Toolpath plans no pass for it whatever the tools (invalid geometry, a failed clearance measurement, or a clearance that admits no tool; never a chamfer). `invalidFeatureTags(sheets)` and `unplannableFeatureTags(sheets)` list them by tag. A dovetail's deprecated `isInvalidGeometry`, a failed measurement, is never read as invalid geometry. `isNoReading` now reads `facts.isInvalidGeometry` and leaves the slot's blend radius out of the zero check, so it finds the invalid T-slots the Engine sends; a T-slot whose measurement failed is not among them. Feature details say "None fits" for an invalid groove and keep "Not measured" for a failed measurement.
- `@toolpath/viewer`: `withoutFeatures(model, tags)`, a `withoutFeatures` option on `normalizePartReport` and a `withoutFeatures` prop on `EnginePart` leave features out of the model and its region index, so picks and the direction wash go to the faces' other owners while every face stays drawn. `EnginePart` reads the list by its tags and keeps the loaded mesh.
- `@toolpath/plan`: an optional `PlanRules.unplannable` refuses a pin that adds a feature Toolpath plans no pass for ("No tool can cut that feature, so a pin machines nothing.") and `actionsFor` stops offering one. A feature pinned already can still be let go or moved. Without it, nothing changes.
