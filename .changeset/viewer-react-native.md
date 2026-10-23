---
'@toolpath/viewer': minor
---

`@toolpath/viewer` runs under React Native (Expo, `@react-three/fiber/native` on expo-gl). Import it
the same way: the `react-native` export condition gives Metro a native build of both
`@toolpath/viewer` and `@toolpath/viewer/engine`. See the README's "React Native (Expo)" section for
the app setup.

- `MeasureTool`, `HoverCard`, `ViewerToolbar` and `labelTexture` are web-only and throw when used on
  React Native.
- `SceneLabel`s are drawn as views over the canvas. `ViewerTheme.labels` styles them; each has the
  `testID` `scene-label-<kind>`, and a pressable one is announced as a button, with the new
  `accessibilityHint` saying what pressing it does. A pressable label's touch target is at least 44
  tall.
- `PartMesh` has no hover on React Native, and picks through a bounding volume hierarchy, so a large
  part stays smooth to touch.
- `PartMesh` works out which faces touch which only when `onAdjacency` is passed, and once per mesh
  however often the callback changes: on a phone the walk over every triangle is felt.

`react-dom` is now an optional peer dependency, alongside the new optional `react-native` (0.79 or
later, whose Metro reads the exports map that `@toolpath/viewer/engine` needs),
`expo-asset` and `expo-gl` peers; on React Native, `expo-asset` and `expo-gl` are required.
`three-mesh-bvh` is a new dependency, used only by the React Native build. The package now ships
`THIRD-PARTY-NOTICES`, for the font outlines the native view cube draws its face names with.
