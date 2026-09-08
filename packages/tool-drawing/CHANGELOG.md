# @toolpath/tool-drawing

## 0.3.1

### Patch Changes

- Updated dependencies [15254fb]
  - @toolpath/tool-support@0.2.0

## 0.3.0

### Minor Changes

- a4b5204: Take the input contract from `@toolpath/tool-support` instead of declaring it.

  `Provenance`, `ViewerTool`, `ViewerHolder` and `ViewerHolderProfile` are now
  aliases of the shared domain types, and `isHolderProfile` is re-exported from it.
  Every name stays exported from `.` and `/geometry` with the same shape, so no
  adapter and no import moves — but a consumer's own `Tool` and this package's
  `ViewerTool` are now the same type rather than two identical declarations that
  were free to drift apart. They had: the stickout a details table printed and the
  one the dimension line drew disagreed by a factor of two on an ordinary tool.

  `ViewerAssembly` stays this package's own shape. `@toolpath/tool-support`'s
  `Assembly` also carries the collet, which a drawing reads only through the
  holder's series and protrusion.

  **`@toolpath/tool-support` is a new runtime dependency.** It is the reason this is
  a minor rather than a patch: it takes no dependencies and no peers of its own and
  imports no React and no DOM, but it is install cost a consumer inherits.
  `/geometry` is still free of React and of the DOM, and `tests/subpaths.test.ts`
  now asserts that from the import graph rather than leaving it to inspection.

- a4b5204: Fix the dimension lines on an assembly with a holder.
  - An extension line now starts at the solid it measures. It started at the
    widest radius anywhere in the stack, which on an assembly is the holder
    flange — twenty millimetres out from the shank being dimensioned — so every
    line began in the margin and pointed at nothing.
  - Two lengths that are the same span are drawn as one line rather than as two
    identical ladders on opposite flanks — the stickout against the below-holder
    length, and against the flute length on a tool stood out to its flutes. The
    first code named keeps the line and the others light it, so
    `highlight="stickout"` still works; `LengthDimension` gains an optional
    `aliases` for the other codes a line answers to.
  - The lanes no longer reserve room for arrowheads that never reach the edge of
    the drawing. A width dimensioned well inside the silhouette — a shank inside
    a flange — cost an arrow's length of margin on both flanks, paid for out of
    the drawing's scale.
  - A shank width is placed clear of the seated collet rather than under it.
  - A below-holder length that ends inside the holder is no longer dimensioned.
    `LBH` is the tool's number and `assembly.stickout` is the caller's; where the
    tool is stood out less than the clamping rule assumed, the line ran past the
    nose and into the holder body.

- a4b5204: The drawing no longer letters its dimensions. `<ToolDrawing dimensions>` draws
  the linework — extension lines, dimension lines, arrowheads, and a drill point's
  two flanks run out with an arc between them — and writes no numbers on the
  sheet.

  Which line is which is now said by pointing at it. `highlight` names the
  dimension or dimensions to draw in the sheet's accent by ISO 13399 code, and
  `onDimensionHover` reports the code under the pointer and `null` when it leaves,
  so a consumer's own table of numbers and the drawing can light each other.

  Removed, and a `0.x` minor is the channel that carries it — a `^0.2.0` range
  does not accept `0.3.0`, so nobody takes this without asking for it:
  - `formatLength` is gone from `ToolDrawingProps`. Nothing on the drawing is
    written out, so there is nothing to format. `@toolpath/tool-drawing/clearance`
    keeps its own `formatLength` — its readouts are still lettered.
  - The figure and band layout is gone with it: `dimensionLayout`, `stackLabels`,
    `dimensionLabel`, `formatMillimetres`, `bandOffset`, `bandRoom`, `figureType`,
    `figureHeight`, and the types `DimensionFigure`, `DimensionLayout`, `LabelBox`,
    `BandRoom` and `FormatLength` are no longer exported. `laneOffset` now takes a
    lane number and a `LaneRoom` rather than a band table; `laneLayout` and
    `laneRoom` replace what the rest of them did.
  - `Sheet` gains an `accent` colour. A hand-written sheet object needs the field.

- a4b5204: Retire the arithmetic that was written twice.

  Four functions had two copies each, in packages that could not import one
  another, and each copy carried a note saying it must agree with its twin. Only
  one of the four had a test comparing them, and nothing enforced the rest.

  `@toolpath/tool-support` now publishes all four:
  - **`hasNeck`** — whether the section between the flutes and the shank is a neck
    to draw and to sweep. One copy drew the picture and the other decided the
    verdict: _"If the rule ever changes, it changes in both places or the picture
    and the verdict disagree about the same tool."_
  - **`shankOf`** and **`Shank`** — whether the shank behind the flutes is reduced
    against the cut. A different question from `hasNeck`, and both are needed: a
    relief wider than the cut is a neck to draw and not a reduced shank.
  - **`heightAt`** — the tallest material within an offset of the cut. The
    clearance verdict and the drawn staircase both read it, and neither could
    depend on the other.
  - **`belowGageLine`** — the measured silhouette from the spindle face out, with
    the crossing interpolated rather than snapped to the nearest vertex.

  `@toolpath/tool-drawing` takes `hasNeck` and `heightAt` from there. `ReachCurve`
  is now the shared type — still declared structurally, so a curve off a report
  still satisfies it with no adapter and the overlay still pulls in no Toolpath
  schema. `heightAt`, `ReachCurve`, `wallFaceAt`, `Margins` and `NO_MARGINS` all
  stay exported from `/clearance` unchanged.

  `@toolpath/tool-scraper` takes `ProfileDatum` and `ProfilePoint` from there.
  `HolderProfile`, `ProfilesDocument` and `PROFILES_VERSION` do not move: a
  measurement record carries the gauge lengths and the taper class a scrape
  resolved, and its version tracks that document's shape rather than the shape of
  one silhouette.

  A new test in `@toolpath/tool-drawing` asserts the remaining half of the
  gage-line pair — that trimming a silhouette at the spindle face and splitting it
  there interpolate the same crossing. That was a note in both files and is now a
  check, in the only package that can see both sides.

### Patch Changes

- Updated dependencies [a4b5204]
- Updated dependencies [a4b5204]
- Updated dependencies [a4b5204]
- Updated dependencies [a4b5204]
- Updated dependencies [a4b5204]
  - @toolpath/tool-support@0.1.0

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
