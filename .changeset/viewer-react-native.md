---
'@toolpath/viewer': minor
---

`@toolpath/viewer` runs under React Native (Expo, `@react-three/fiber/native` on expo-gl). Import it
the same way: the `react-native` export condition gives Metro a native build of both
`@toolpath/viewer` and `@toolpath/viewer/engine`. See the README's "React Native (Expo)" section for
the app setup.

- On React Native the package exports only what runs there: `HoverCard`, `ViewerToolbar`,
  `viewerToolGroups` and `labelTexture` are web-only and not exported.
- The `react-native` condition carries its own declarations (`dist/native/*.d.ts`), which TypeScript
  reads with `customConditions: ["react-native"]`, as Expo's base tsconfig sets. There `Viewer`'s
  `style` is a `StyleProp<ViewStyle>` and it takes `accessibilityLabel` and `accessibilityHint`, with
  no `className` or `webglUnavailable`.
- New `@toolpath/viewer/banana` exports `Banana`, `BananaProps` and `BANANA_MODEL_URL` on both
  platforms. The web root keeps them; the React Native root does not, so the 760 KB model ships only
  with an app that imports `@toolpath/viewer/banana`.
- New `@toolpath/viewer/metro` (CommonJS) exports `withToolpathViewer(config)` for `metro.config.js`:
  it adds `glb` to the asset extensions and resolves `three` to its ES module build, so the app runs
  one three.js.
- `SceneLabel`s are drawn as views over the canvas. `ViewerTheme.labels` styles them, and
  `DEFAULT_LABELS`, now exported, is its default, to spread when changing one setting. Each has the
  `testID` `scene-label-<kind>`. On React Native, `SceneLabel`'s new `onPress` makes a label
  pressable: it is announced as a button, with the new `accessibilityHint` saying
  what pressing it does, and its touch target is at least 44 tall.
- On React Native, a screen reader announces `Viewer`'s `accessibilityLabel` and
  `accessibilityHint` for the view, as an image.
- `PartMesh` has no hover on React Native, and picks through a bounding volume hierarchy, so a large
  part stays smooth to touch.
- The components React Native runs import drei's modules one by one (`@react-three/drei/core/…`)
  rather than its root, which on React Native loads every drei module as the app starts.
- `PartMesh` works out which faces touch which only when `onAdjacency` is passed, and once per
  mesh: on a phone the walk over every triangle is felt. A new callback is still handed the result.

`MeasureTool` runs on React Native, exported from the native root with `MeasureToolProps`. A tap
measures what a click does on the web. A pinch's lift is not a tap, a tap on the view cube is the
cube's, and a tap off the part clears. With no hover, what was tapped stays painted until the
measurements are cleared. Labels are the native `SceneLabel`s, and picked points are drawn as dots in
the scene.

New optional `MeasureTool` props, on both platforms:

- `points` places points rather than taking faces, as Alt does on the web, where either one does it.
- `keep` keeps what is on screen and starts another measurement, as Shift does.
- `onLabelPress({ text, value })` is called when a label is pressed, with the label as drawn and its
  bare number. On the web it replaces the built-in copy to the clipboard; without it the web copies as
  before. On React Native, labels can be pressed only when it is given.
- `labelHint` tells a screen reader what pressing a label does, on React Native, where a press does
  what the app's `onLabelPress` does. Without it a pressable label is announced as a button with no
  hint. The web ignores it.

`dropLastPick` is exported from both roots, for an app's own Undo: it takes the last pick off a
list of measurements, as Delete does on the web.

A double click (or double tap) while measuring now aims the orbit at the point clicked, as it does
without the tool, and still measures once.

The tool finds the part's edges the first time a point is placed, and keeps them with the part,
rather than finding them each time it opens. It looks up a face's regions in a table kept for each
part, rather than searching every region each time, and tries to join only cylinders of about the
same radius into one hole.

Two picks in quick succession, before the tool redraws, now both count.

`createEngineGeometryCache` now evicts released geometry past its capacity when a part is retained
as well as when one is released, and evicts geometry a part has let go before geometry only read. At
a capacity of 1 (a phone's), a closed part's geometry goes as soon as the next part opens, including
when one part replaces another in the same render.

`react-dom` is now an optional peer dependency, alongside the new optional `react-native` (0.79 or
later, whose Metro reads the exports map that `@toolpath/viewer/engine` needs), `expo-asset` (11.1
or later) and `expo-gl` (15.1 or later) peers, the versions Expo SDK 53 ships with React Native
0.79; on React Native, `expo-asset` and `expo-gl` are required.
`three-mesh-bvh` is a new dependency, used only by the React Native build. The package now ships
`THIRD-PARTY-NOTICES`, for the font outlines the native view cube draws its face names with.
