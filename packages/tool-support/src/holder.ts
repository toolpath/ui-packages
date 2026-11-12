/**
 * A holder's cone stack, from the two things a catalog can have instead of one.
 *
 * A {@link Holder} is a revolved outline, nose first, and its gauge length. A
 * vendor publishes either a handful of numbers off a DIN 4000 sheet — a nose, a
 * body, a flange — or a CAD model whose silhouette is measured. Both become the
 * one stack here, so a sweep, a drawing and an exporter read one shape rather
 * than each keeping a branch for the other form.
 */

import { cylinder, profileToCones } from './cones.js'
import type { Cone, Holder } from './model.js'
import type { MeasuredProfile, ProfilePoint } from './profile.js'

/** What a holder states besides its shape: who makes it, how it grips, where each number came from. */
export type HolderFacts = Omit<Holder, 'layers' | 'gaugeLength'>

/** A holder as a vendor's table publishes it, in millimetres; `null` is unstated. */
export interface HolderDimensions {
  /** The nose, where a holder fouls the part before the tool runs out of reach. */
  readonly noseDiameter: number | null
  readonly noseLength: number | null
  /** The body behind the nose, where the vendor states it step by step. */
  readonly bodyDiameter: number | null
  readonly bodyLength: number | null
  /** Nose face to flange face. */
  readonly projection: number | null
  readonly flangeDiameter: number | null
  /** Nose to the spindle gauge line. */
  readonly gaugeLength: number | null
}

/**
 * A published holder as cylinders, nose first.
 *
 * The nose for its stated length, the body behind it where both its numbers
 * are stated, the last stated diameter carried up to the flange face at
 * `projection`, and the flange from there to the gauge line where the gauge
 * line stands above it. **Cylinders, not cones** (Paul, 2026-08-31): each layer
 * at its widest, no credit for a taper, and nothing invented between the body
 * and the flange wider than what the vendor states. A flange whose height is
 * not stated is not drawn.
 *
 * A nose with no stated length and no body behind it stands up to the flange
 * face, else the gauge line: a dataset that predates the nose-length column
 * still sweeps the nose diameter it states rather than nothing at all. With a
 * body stated the body starts at the nose face instead, which is no narrower a
 * guess than the base of a nose of unknown length.
 *
 * A vendor that publishes no nose diameter has published no shape, and the
 * stack is empty.
 */
export const parametricHolder = (dims: HolderDimensions, facts: HolderFacts = {}): Holder => {
  const { noseDiameter, bodyDiameter, bodyLength, projection, flangeDiameter, gaugeLength } = dims
  const layers: Array<Cone> = []
  // A layer of no height is no layer: a stack never carries one.
  const layer = (diameter: number, thickness: number): void => {
    if (thickness > 0) {
      layers.push(cylinder(diameter, thickness))
    }
  }
  if (noseDiameter !== null) {
    const hasBody = bodyDiameter !== null && bodyLength !== null
    let top = dims.noseLength ?? (hasBody ? 0 : (projection ?? gaugeLength ?? 0))
    let carried = noseDiameter
    layer(noseDiameter, top)
    if (hasBody) {
      layer(bodyDiameter, bodyLength)
      top += bodyLength
      carried = bodyDiameter
    }
    if (projection !== null && flangeDiameter !== null) {
      layer(carried, projection - top)
      if (gaugeLength !== null) {
        layer(flangeDiameter, gaugeLength - projection)
      }
    }
  }
  return { ...facts, layers, gaugeLength }
}

/**
 * A measured silhouette as its cone stack, nose first.
 *
 * The profile runs `z` toward the nose, which is its last vertex whichever way
 * it is datumed; a stack runs from the nose, so the profile is walked backwards
 * and every `z` measured back from the nose. **Nothing is cut**: a `gage-line`
 * profile keeps its taper and retention knob above the spindle face, as layers
 * past its gauge length (the nose's `z`), so a drawing can shade the
 * connection. What reads only the part below the face cuts it there with
 * {@link trimToGauge}. A `nose`-datumed profile has no gauge length.
 */
export const measuredHolder = (profile: MeasuredProfile, facts: HolderFacts = {}): Holder => {
  const { points } = profile
  const nose = points.at(-1)
  if (points.length < 2 || nose === undefined) {
    return { ...facts, layers: [], gaugeLength: null }
  }
  const fromNose = [...points].reverse().map(([z, r]): ProfilePoint => [nose[0] - z, r])
  return {
    ...facts,
    layers: profileToCones(fromNose),
    gaugeLength: profile.datum === 'gage-line' ? nose[0] : null,
  }
}

/**
 * The holder below its spindle face: its stack cut at the gauge length, the
 * layer that crosses it ending at the diameter it has there.
 *
 * What stands above the face — a measured taper and retention knob — is inside
 * the spindle, so a sweep or a CAM export that wants the holder as mounted
 * reads this rather than the stack. The crossing is interpolated on the layer,
 * so the cut is the face and not the nearest vertex to it, and it is the same
 * line the drawing shades the connection above.
 *
 * Returned as it is where there is no gauge length, where the stack already
 * ends at or below it, and where the face falls inside the first layer: a
 * holder measured entirely inside the spindle is bad data, and cutting it to a
 * stub would hide that.
 */
export const trimToGauge = (holder: Holder): Holder => {
  const { gaugeLength } = holder
  const [first] = holder.layers
  if (gaugeLength === null || first === undefined || first.thickness > gaugeLength) {
    return holder
  }
  const layers: Array<Cone> = []
  let z = 0
  for (const layer of holder.layers) {
    if (z + layer.thickness <= gaugeLength) {
      layers.push(layer)
      z += layer.thickness
      continue
    }
    const thickness = gaugeLength - z
    if (thickness > 0) {
      const share = thickness / layer.thickness
      layers.push({
        thickness,
        bottomDiameter: layer.bottomDiameter,
        topDiameter: layer.bottomDiameter + share * (layer.topDiameter - layer.bottomDiameter),
      })
    }
    return { ...holder, layers }
  }
  return holder
}
