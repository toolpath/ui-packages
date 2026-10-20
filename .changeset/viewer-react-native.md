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

`react-dom` is now an optional peer dependency, alongside the new optional `react-native` and
`expo-asset` peers.
