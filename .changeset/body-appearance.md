---
'@toolpath/viewer': minor
---

`PartMesh` takes `opacity` to draw a part see-through, after the solid parts and without hiding them, and `depthLayer` to settle which of two parts is drawn where their surfaces coincide; `PartCollection` gives each item its position in the list. `visible={false}` hides a part without unmounting it, and lets the pointer through to the parts behind. `bodyColors` with `BODY_PALETTE` gives each body of a file a colour of its own. `usePartCollection` also accepts a keyed model builder, called only when its key changes, and lists in `waiting` the bodies whose newest model is still loading.
