---
'@toolpath/plan': minor
---

Clicks on the part follow the mouse button. A left click in an open folder pins a feature, and a
left click on a feature in the folder leaves it there; a right click takes it out. `ignoreClick`
takes `remove` for a right click and answers null where a click has nothing to do; it no longer
takes `region`. `chooseReading` and the `choosePinReading` action take a new `'add'` target and no
longer take the readings a click read. `machines` says whether a Results setup machines a feature.
