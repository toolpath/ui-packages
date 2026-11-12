# Toolpath Tool Drawing

`@toolpath/tool-drawing` draws a cutting tool, and the holder it is clamped in,
as a 2D elevation: one silhouette turned about the tool axis, dimensioned, on
its own sheet. It is SVG and arithmetic — no runtime dependencies, React only as
a peer.

It is deliberately not `@toolpath/viewer`. That package shows a customer's part
in 3D; this one draws a catalog tool in 2D.

## Install

```sh
npm install @toolpath/tool-drawing react react-dom
```

Its one runtime dependency is [`@toolpath/tool-support`](../tool-support), the
shared cutting-tool domain. What it draws is that package's record — a
`CuttingTool` on its own, or a `RotatingToolAssembly` — so a consumer needs no
adapter between the two.

## Exports

| Entry point                        | What it is                                              |
| ---------------------------------- | ------------------------------------------------------- |
| `@toolpath/tool-drawing`           | The component, the input contract, the framing options  |
| `@toolpath/tool-drawing/geometry`  | `assemblyOutline` and the profile generators — no React |
| `@toolpath/tool-drawing/clearance` | The optional clearance overlay                          |

`/geometry` is pure and server-safe: it touches no DOM and imports no React, so
a Node server can measure an assembly without paying for a renderer.
`tests/subpaths.test.ts` asserts that from the import graph.

## Geometry

```ts
import { assemblyOutline } from '@toolpath/tool-drawing/geometry'

const outline = assemblyOutline({
  type: 'solid',
  kind: 'FlatEndmill',
  name: 'TDMX0600',
  diameter: 6,
  fluteLength: 13,
  shaft: [{ thickness: 44, bottomDiameter: 6, topDiameter: 6 }],
})
```

A bare tool is drawn alone, its whole `shaft` above its flutes; an assembly is
drawn at its stickout, in its holder, the shaft cut there. **Every number in a generated profile
comes off a stated field.** There is no default taper angle, no assumed neck,
no invented lead chamfer. Where a number has to be assumed to draw at all — a
drill point angle the vendor never published — the segment says so in its
`provenance`, which `<ToolDrawing>` puts on the element as `data-provenance`.

Every kind has a tip. A kind no generator was written for — a thread mill, a
dovetail, a lollipop, the circle segments and the rest `TIPS` marks
`borrowed` — is drawn on the nearest generator, and its tip is `assumed`.
`assemblyOutline` returns `null` only where the numbers describe no shape: a
point angle that makes no cone.

## The holder

A holder is tool-support's cone stack, nose first, and its gauge length: a
published holder made with `parametricHolder`, a measured one with
`measuredHolder`. It is drawn as stated, vertex for vertex, with its nose face
at the stickout: the first layer is the `nose`, the rest `body` up to the
spindle face at the gauge length, and anything the stack carries above that
face `flange`, shaded as the spindle connection. The seated collet is drawn
from `colletSeries` and `colletProtrusion`.

## Drawing

```tsx
import { ToolDrawing } from '@toolpath/tool-drawing'
;<ToolDrawing assembly={assembly} theme="dark" />
```

The component measures its own panel, frames the assembly to fill it, and draws
along the panel's long axis — no orientation prop and no pan. `theme` is a prop
rather than a hook because a package cannot reach the application's theme; it
defaults to `'dark'`.

A tool whose numbers describe no shape is **stated in words and named**, not
drawn as a plausible cylinder.

## Zooming to the tool

```tsx
<ToolDrawing assembly={assembly} zoom="tool" />
```

An assembly is drawn tip to spindle connection, and the holder is most of it.
`zoom="tool"` frames the working end instead: the length of tool below the
holder — the stickout this assembly was drawn at, with or without a holder — and
a sliver of holder above it, so the reader can see what
the tool is held in.

The holder above the cut is **drawn and cut by the edge of the sheet**, not
trimmed: a trimmed silhouette closes across a face the vendor never published,
which is the invented shape this package refuses everywhere else. A dimension
measuring to a face above the cut is dropped rather than left pointing off the
edge.

The gain is along the axis and, where the holder flares above the nose, across
it too — a ⌀6 end mill in a ⌀46 flange is drawn across 46 mm of sheet however
tall the panel, and below the nose the widest thing is the nose. A tool that
states neither length, and one already shorter than the cut, is framed on the
whole assembly; the `<svg>` carries `data-zoom="tool"` only where the zoom took.

`extentFor` is the same decision as a pure function, from
`@toolpath/tool-drawing/geometry`, for a caller framing a sheet itself.

## Dimensions

```tsx
<ToolDrawing
  assembly={assembly}
  dimensions
  dimensionSides="both"
  highlight={hovered}
  onDimensionHover={setHovered}
/>
```

Every stated length and width, each in its own lane, nested shortest-innermost
so no two lines cross. Only stated numbers are dimensioned.

**The drawing letters none of them.** The numbers belong in your own table,
where they can be read; six two-line figures fighting for the margin said the
same numbers a second time and worse. Which line is which is answered by
pointing at it instead:

- `highlight` names the dimension or dimensions to draw in the sheet's accent,
  by ISO 13399 code — `DC`, `LCF`, `OAL`, `SFDM`, `stickout`, `SIG`, and
  the two `shoulder-` codes. A code the tool does not dimension highlights
  nothing.
- `onDimensionHover` is told the code under the pointer and `null` when it
  leaves, so your table can be lit from the drawing as well as the other way
  about. Passing it puts hit targets on the lines; leaving it off draws none.

Where two codes are one span the drawing carries one line, not two. A tool
stood out to its flutes states the stickout and the flute length as one number; with nothing lettered, identical lines in two lanes cannot be told
apart. The first code named keeps the line — the tool's own number ahead of the
shop's — and the others light it too. Hover reports the code the line is drawn
under.

**The stickout is yours.** `assembly.stickout` is where the holder nose goes,
and nothing here derives it; tool-support's `setupStickout` is the shop policy's
answer where nobody has chosen one.

A highlighted line is drawn in the accent **and heavier**, so the highlight
survives a reader who cannot tell the two colours apart.

## Clearance overlay

```tsx
import { ClearanceOverlay, tightestGaps, describeGaps } from '@toolpath/tool-drawing/clearance'
;<ToolDrawing assembly={assembly} collisions={collisions} verdict={{ clears, note }}>
  <ClearanceOverlay
    profile={profile}
    gaps={gaps}
    cuttingRadius={cuttingRadius}
    formatLength={formatLength}
  />
</ToolDrawing>
```

The overlay draws in the drawing's own coordinates and is given them: the
frame, the outline and the sheet reach it from the `<ToolDrawing>` around it.
It could not work them out for itself — the panel is measured by a
`ResizeObserver` inside that component, on an `<svg>` you never hold — so
passing them is only for overriding the frame, as a test framing a fixture
does. Drawn outside a `<ToolDrawing>` with none supplied, it throws rather than
inventing one.

**The overlay draws a verdict; it does not reach one.** Whether an assembly
clears a feature is a tool-selection question with callers that never draw
anything, so it stays with them: this takes the material profile, the
collisions and the two tightest gaps as data and owns every line drawn from
them — the wall, the hatch, the interrupted-view breaks, the clearance
dimensions and their readouts, and the paint on a section that is in the metal.

It is optional in three senses: a subpath of its own, so a consumer that never
imports it never pays for it; no Toolpath schema dependency, because the
reach-curve shape is declared structurally here; and omitting the props draws
the tool alone.

## Status

Geometry, layout, the renderer, the dimensions and the clearance overlay are
all in.

## Development checks

`pnpm test` runs the suite with React Compiler transforming source modules, including internal
imports, as CI does. `pnpm test:source` runs the same suite on untransformed source.
Build workspace dependencies first (from services, use Turborepo to order them).
The production build separately fails on compiler skips or missing compiler output.
