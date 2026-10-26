---
'@toolpath/viewer': minor
---

Touch, labels and camera calls for apps that drive the viewer themselves:

- One-finger touch orbit now works.
- A pinch now zooms the orthographic camera; it dollies a perspective one, as before.
- `SceneLabel` (and `SceneLabelProps`) pins a text label to a point in the scene. `ToolMarks` draws
  its labels with it, with the same markup.
- `ExtendedCameraControls` gains `orbitBy`, `zoomAt` and `panBy`, and its element argument is now
  optional: without one, the app moves the camera through those three.
- The section handle now lights in a lighter shade of its own colour under the pointer or a
  finger (a darker one when it is too light to lighten), rather than in the theme's `hover` colour,
  which turned a red or green handle blue. `ViewerTheme.hover` no longer affects the handle.
- A dragged section handle captures the pointer, so it stays lit for the whole drag, even once the
  pointer leaves the arrow, and goes back to its own colour after the release.
- `VIEW_CUBE_HALF_PX` is the view cube's half-extent on screen, in CSS pixels, for an app that
  judges whether a tap landed on the cube.
- `TapTracker.isTap` and `DoubleTapTracker.isDouble` accept any pointer-like event (the new
  `PointerLike` type), React Native's included. Code written against `TapPoint` and
  `DoubleTapPoint` still compiles, and `useTapGuard`'s guard still takes a `TapPoint`.
