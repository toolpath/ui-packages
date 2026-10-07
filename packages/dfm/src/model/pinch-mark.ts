import { MM_PER_INCH } from '@toolpath/tool-support'
import { isSurfaceType } from './feature-details.js'
import { PINCH_TOOL_MM, type FeatureSheet } from './feature-sheet.js'
import { readPinch, type FeaturePinch } from './pinch.js'
import { lengthValue, unitLabel, type Units } from './units.js'

/**
 * The widest tool worth drawing, mm: three inches. Wider, the feature is open
 * enough that the tool says nothing, and a cylinder that size hides the part.
 */
export const MAX_DRAWN_TOOL_MM = 3 * MM_PER_INCH

/**
 * A feature's pinch discs as the widest tool that fits stands in them: the
 * datasheet's discs a tool can stand in, in its tool frame, mm, with how deep
 * the feature runs and the corner the tool has.
 */
export interface PinchMark extends FeaturePinch {
  /**
   * The radius on the tool's corner, mm: a filleted pocket's floor fillet,
   * which a bull nose of that radius cuts. Absent for a flat-bottomed tool.
   */
  readonly corner?: number
}

/**
 * The pinch discs worth drawing a tool in: none for a feature with no discs,
 * only a sharp corner's (no tool at all), or tools wider than
 * {@link MAX_DRAWN_TOOL_MM}. A walled feature's floor fillet rounds the tool's
 * corner; a surface's fillet radius is its own shape, and does not.
 */
export const pinchMark = (
  datasheet: unknown,
  sheet: FeatureSheet | undefined,
  featureType: string,
): PinchMark | null => {
  const pinch = readPinch(datasheet)
  const discs =
    pinch?.discs.filter(
      (disc) => disc.diameter >= PINCH_TOOL_MM && disc.diameter <= MAX_DRAWN_TOOL_MM,
    ) ?? []
  if (!pinch || discs.length === 0) return null
  const fillet = sheet?.filletRadius
  const corner =
    !isSurfaceType(featureType) && fillet !== undefined && fillet > 0 ? fillet : undefined
  return { ...pinch, discs, ...(corner !== undefined ? { corner } : {}) }
}

/**
 * What a pinch mark's tool is labelled: its diameter at the tightest disc —
 * "≤" where the clearance was measured at one tolerance only — and, quieter,
 * the kind of tool and how many places are that tight.
 */
export const pinchLabel = (mark: PinchMark, units: Units): { label: string; note: string } => {
  const length = (mm: number): string => `${lengthValue(mm, units)} ${unitLabel(units)}`
  const tightest = Math.min(...mark.discs.map((disc) => disc.diameter))
  const tool = mark.corner !== undefined ? `bull nose R ${length(mark.corner)}` : 'widest tool'
  const places = mark.discs.length
  return {
    label: `${mark.unresolved ? '≤ ' : ''}⌀ ${length(tightest)}`,
    note: places > 1 ? `${tool} · ${places} places` : tool,
  }
}
