---
'@toolpath/dfm': minor
---

A face no reading cuts clean is painted for its worst reading, in the worst rule any of its readings breaks, not the mildest: whichever way the face is cut, the shop sees what it may cost. Of readings as bad, the plainest, then the one with the most surface, as before. `featureSheet` counts a corner of no radius as sharp even where no tool fits the feature, so a sharp-corner rule catches it and it has no L/D taken from its radius; before, such a reading broke no rule and left a face it shared unpainted. Adds `sharpCornerFeatures(check, features)`: the features whose sharp corners the rules flag, for `sharpCorners` on `@toolpath/viewer`'s part — those a sharp-corner rule catches, and every reading of a face whose every reading is caught.
