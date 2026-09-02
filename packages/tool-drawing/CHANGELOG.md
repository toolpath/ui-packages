# @toolpath/tool-drawing

## 0.2.0

### Minor Changes

- 2d8e48f: Draw a holder from a measured profile. `ViewerAssembly.holder` accepts a
  `ViewerHolderProfile` — the silhouette as `[z, r]` vertices in millimetres on a
  `gage-line` or `nose` datum — alongside the parametric `ViewerHolder`, and
  `isHolderProfile` narrows the union. The vertices are drawn as measured, nose
  face at the stickout, split at the spindle face so the connection shades as it
  does on a parametric holder.

## 0.1.0

### Minor Changes

- 3e70a64: New package: a cutting tool and its holder drawn in 2D elevation.

  `@toolpath/tool-drawing/geometry` exports `assemblyOutline`, which turns a tool,
  a holder and a stickout into one silhouette of (radius, height) pairs, each
  segment carrying the provenance of the numbers it was drawn from. The root entry
  point exports the input contract — `ViewerTool`, `ViewerHolder`,
  `ViewerAssembly`, `Provenance`.

  Two things are deliberate. `assemblyOutline` returns `null` where there is no
  honest picture — a form with no generator, or a tool that states no cutting
  diameter or flute length — rather than a plausible cylinder. And a slot mill is
  drawn with its corner radius on **both** ends of the cutting disc, which is what
  a keyseat cutter is and what a bull-nose generator cannot say.

  The root entry point also exports `frameFor`, the layout stage: it takes an
  outline's extent and a measured panel and returns the scale, viewBox, type size
  and the two coordinate mappings to draw it with. The scale absorbs the panel's
  shape rather than the frame doing so, type size is derived from a target in
  pixels rather than from the tool's length, and the tool axis runs along the
  panel's long side — `toX` and `toY` are the only place that orientation lives.
  It assumes the `<svg>` keeps the default `preserveAspectRatio="xMidYMid meet"`.

  `<ToolDrawing>` draws the assembly from that frame: the silhouette in one
  stroke, per-section fills, a light dashed line where two sections meet at the
  same radius and a solid edge where the radius really steps, a long-short-long
  centreline, and a note naming everything the drawing had to assume. Its sheet
  is one hard palette per theme, and `theme` is a prop defaulting to `'dark'`.
  A form the geometry cannot draw renders as a sentence naming that form.

  It dimensions a tool on request — every stated length and width, each in its
  own lane, figures in the band outboard of the lane they belong to — with type
  sized from a target in pixels rather than from the tool's length, so a figure
  is legible whatever the tool measures. `formatLength` is the caller's, so the
  package carries no unit system.

  `@toolpath/tool-drawing/clearance` adds the optional overlay: the material
  around a feature drawn beside the tool, hatched and broken at the edge of the
  room it was given, with both clearances dimensioned at their own tightest
  points. It takes the verdict as data — profile, collisions, gaps — and reaches
  none of its own, and it declares the reach-curve shape structurally so no
  Toolpath schema comes with it.

  The overlay is drawn as a child of `<ToolDrawing>`, which publishes the frame,
  the outline and the sheet to its subtree: a child draws in the drawing's own
  coordinates without being able to measure the panel itself, because the panel
  is measured on an `<svg>` the caller never holds. Passing those three
  explicitly overrides the context, for a test framing a fixture. Drawn outside a
  `<ToolDrawing>` with none supplied, the overlay throws rather than inventing a
  frame.

  `/geometry` imports no React and touches no DOM, so a server can use it.
