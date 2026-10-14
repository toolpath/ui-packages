---
'@toolpath/viewer': minor
---

`PartMesh`'s `focusFeature` also takes `{ tag, request }`, framed once per `request`, so the same feature can be framed again by counting `request` up; a bare tag still frames only when it changes. `FeatureFocus` and `FeatureFocusRequest` are exported.
