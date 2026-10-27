---
'@toolpath/viewer': minor
---

`<ExplodedPart>` now covers what each application rebuilt around it: placement, motion, paint
and picking. Everything added is optional; existing layouts and controllers keep working.

- `explodeLayout(model, geometry, assignments)` places pieces along their approaches, clear of
  the part and of each other. `explodeFits` and `EXPLODE_LIMITS` (4096 pieces, one million
  copied triangles) say whether a layout draws; past them `<ExplodedPart>` draws nothing.
- `createExplodeMotion` is an explode amount that animates itself: easing, real elapsed time, a
  pause while the tab is hidden, reduced motion, and moves that wait until the pieces they
  drive have warmed their shaders. `ExplodeAmount` gains an optional `hold`.
- Inside `<PartMesh>` or `<EnginePart>`, `<ExplodedPart>` reads the part's model and mesh.
  `<PartMesh visible={false}>` hides the part from drawing, framing and picking, keeping it
  mounted, and `<VisibilityGroup>` does the same for what an application draws beside it.
- Groups take optional `featureTags` and `direction`. Picks on such a group rank only its
  features and report `explodeDirection`. `selectedFeatures`, `hoveredFeatures` and `hover`
  select and hover pieces by feature tag, and `highlights`/`regionHighlights` paint them as
  `<PartMesh>` paints the assembled part.
- Picking matches `<PartMesh>`: ranked from the orbit target, right-click on release, double
  click reported and re-aiming the orbit, hover reported once per piece and face, no picks
  while a `<SectionTool>` holds the pointer, and a pick that finds nothing passes through.
- `ViewerToolbar` gains an `explode` control and `ExplodeButton`, and every control a
  `disabled` flag.
- `applyHighlightLayers` takes a `PaintTarget`, now exported: the part's `model` and its paint
  methods. A `PartObject` still fits.

Changed defaults:

- Without a theme, pieces use the part's edge color and opacity and tint toward the viewer's
  selection and hover colors (toward blue where the pieces' own colors are mostly warm), rather
  than toward white. The piece under the pointer is tinted when `hovered` is not given. Pass
  `theme` or `hovered` to keep the earlier look.
- The ghost of the assembled part is outlined in `DEFAULT_THEME.edge` (black) rather than pale
  blue `0xa5b7d1`. `theme.edge` sets it, and the piece edges with it: `theme={{ edge: 0xa5b7d1 }}`
  brings the pale outline back, on the pieces too.
- `<PartMesh>` puts the part, and its section, inside one more `<group>`, which hides them. Code
  that walks the scene graph and expects the part's mesh as a direct child of where `<PartMesh>`
  is placed should search its descendants instead, for example with `traverse`.
