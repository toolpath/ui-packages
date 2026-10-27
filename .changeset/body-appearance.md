---
'@toolpath/viewer': minor
---

`PartMesh` takes `opacity` to draw a part see-through, after the solid parts and without hiding them, and `bodyColors` with `BODY_PALETTE` gives each body of a file a colour of its own. `usePartCollection` also accepts a keyed model builder, called only when its key changes, and lists in `waiting` the bodies whose newest model is still loading.
