---
'@toolpath/viewer': minor
---

`@toolpath/viewer` runs under React Native (Expo, `@react-three/fiber/native` on expo-gl). Import it
the same way: the `react-native` export condition gives Metro a native build of both
`@toolpath/viewer` and `@toolpath/viewer/engine`. `MeasureTool`, `HoverCard`, `ViewerToolbar` and
`labelTexture` are web-only and throw when used on React Native. See the README's "React Native
(Expo)" section for the app setup.

On the web:

- One-finger touch orbit now works.
- A pinch now zooms the orthographic camera; it dollies a perspective one, as before.
- `SceneLabel` (and `SceneLabelProps`) pins a text label to a point in the scene. `ToolMarks` draws
  its labels with it, with the same markup.
- `ExtendedCameraControls` gains `orbitBy`, `zoomAt` and `panBy`, and its element argument is now
  optional.
- `ViewerTheme.labels` styles labels drawn without a DOM, on React Native.
- The section handle lights in a lighter shade of its own colour under the pointer or a finger,
  rather than in the theme's `hover` colour, which turned a red or green handle blue.
- `VIEW_CUBE_HALF_PX` is the view cube's half-extent on screen, in CSS pixels, for an app that
  judges whether a tap landed on the cube.

`react-dom` is now an optional peer dependency, alongside the new optional `react-native` and
`expo-asset` peers.
