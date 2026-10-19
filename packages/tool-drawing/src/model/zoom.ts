import type { Extent } from './frame.js'
import { radiusAt, type Outline } from './outline.js'
import type { ViewerAssembly } from './types.js'

/**
 * How much of the stack the sheet is framed to: all of it, or the working end.
 *
 * **A choice of extent, not a transform.** Everything downstream — the
 * silhouette, the joins, the dimension ladder, the clearance overlay — is
 * already written against {@link Frame}, and a frame is built from an
 * {@link Extent}. So a zoom is one smaller extent handed to `frameFor` and
 * nothing else changes: the scale comes out bigger because the content is
 * shorter and narrower.
 *
 * **What is above the cut is still drawn, and the sheet's edge cuts it.** It
 * is not trimmed, because a trimmed silhouette closes: the holder would gain a
 * flat face across the top at a height its vendor never published, which is
 * exactly the invented shape `outline.ts` refuses everywhere else. A body cut
 * by the edge of a sheet is how a drawing says "and it carries on".
 */
export type Zoom = 'assembly' | 'tool'

/**
 * How much holder the zoom keeps above the tool, as a share of the exposed
 * length.
 *
 * A share rather than a fixed length, because the point of the sliver is to
 * show *what the tool is held in* — the nose face, the collet standing proud
 * of it — and that reads at the same size relative to the tool whether the
 * tool is a 20 mm drill or a 150 mm end mill. A fixed number of millimetres
 * would be most of the sheet on one and invisible on the other.
 */
export const HOLDER_HEADROOM = 0.15

/** Below this two heights are the same height. */
const EPSILON = 1e-6

/**
 * How much tool is below the holder **on this drawing**.
 *
 * The stickout wherever a holder is drawn, because that is where the nose face
 * was placed: the length below the holder and the stickout are the same span
 * measured by the tool and by the shop, and where the two disagree it is the
 * shop's that the picture was drawn to. Cutting at the tool's own `LBH` with a
 * holder set further back would frame a sheet with no holder on it at all —
 * the one thing the view is meant to show — and the dimension model already
 * refuses to *letter* `LBH` in that case, for the same reason.
 *
 * `LBH` where no holder is drawn, which is the only number that says where one
 * would sit. Null where neither is stated, and there is then nothing to zoom
 * to.
 */
const exposedLength = (assembly: ViewerAssembly): number | null => {
  const { stickout, holder } = assembly
  const stated = stickout !== null && stickout > 0 ? stickout : null
  if (holder !== null && stated !== null) {
    return stated
  }
  const { LBH } = assembly.tool.geometry
  return LBH !== undefined && LBH > 0 ? LBH : stated
}

/**
 * The widest the drawing reaches anywhere below a height.
 *
 * **Framing on the stack's widest point is what costs a zoom its scale.** A
 * ⌀6 end mill in a ⌀46 flange is drawn across 46 mm of sheet whatever the
 * panel's shape, and the flange is thirty millimetres above the cut; measured
 * below it the sheet is as wide as the nose, and the across axis stops binding
 * at a diameter the view does not contain. Every vertex below the cut, plus
 * the edge exactly at it, so a body sliced part-way up counts at the radius it
 * really has there.
 */
const widestBelow = (outline: Outline, top: number): number =>
  Math.max(
    radiusAt(outline, top),
    ...outline.segments.flatMap((segment) =>
      segment.points.filter((point) => point.z <= top + EPSILON).map((point) => point.r),
    ),
  )

/**
 * What to frame this assembly against, at this zoom.
 *
 * The outline's own extent for `assembly`. For `tool`, the exposed length and
 * a sliver of holder above it — {@link HOLDER_HEADROOM} — and the widest
 * radius below that cut.
 *
 * **It answers the whole extent where it cannot zoom**, rather than refusing:
 * a tool that states neither a below-holder length nor a stickout has no
 * working end to frame to, and one already shorter than the cut is already the
 * view being asked for. Both draw what they always drew, which is what a
 * caller that hands the same prop to every drawing in a list needs.
 */
export const extentFor = (
  outline: Outline,
  assembly: ViewerAssembly,
  zoom: Zoom = 'assembly',
): Extent => {
  if (zoom === 'assembly') {
    return outline
  }
  const exposed = exposedLength(assembly)
  if (exposed === null) {
    return outline
  }
  const top = exposed * (1 + HOLDER_HEADROOM)
  if (top >= outline.height - EPSILON) {
    return outline
  }
  return { height: top, radius: widestBelow(outline, top) }
}
