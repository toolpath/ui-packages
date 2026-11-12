/** Records the suites draw: a stated base, and only what a case changes. */

import {
  measuredHolder,
  parametricHolder,
  type Cone,
  type Holder,
  type ProfilePoint,
  type RotatingToolAssembly,
  type Tool,
} from '@toolpath/tool-support'

/** A layer of one diameter, mm, as a stack states a plain shank or neck. */
export const cylinder = (diameter: number, thickness: number): Cone => ({
  thickness,
  bottomDiameter: diameter,
  topDiameter: diameter,
})

/** A 6 mm flat end mill: 13 mm of flute, 57 overall, on a 6 mm shank, every number the vendor's. */
export const tool = (over: Partial<Tool> = {}): Tool => ({
  type: 'solid',
  kind: 'FlatEndmill',
  name: 'TDMX0600',
  diameter: 6,
  fluteLength: 13,
  shaft: [cylinder(6, 44)],
  provenance: {
    diameter: 'vendor-stated',
    fluteLength: 'vendor-stated',
    shaft: 'vendor-stated',
  },
  ...over,
})

/** A holder its CAD model measures: `[z, r]` from the gage line toward the nose, kept whole. */
export const measured = (
  points: ReadonlyArray<ProfilePoint>,
  facts: Omit<Holder, 'layers' | 'gaugeLength'> = {},
): Holder => measuredHolder({ points, datum: 'gage-line' }, facts)

/**
 * A BT30 ER16 holder and a ⌀3 end mill, from the committed sample's proportions
 * — the only dataset with toolholding in it, and an invented assembly has
 * proportions no real holder has.
 */
export const bt30: RotatingToolAssembly = {
  tool: tool({
    name: 'TDMX0300',
    diameter: 3,
    fluteLength: 8,
    shaft: [cylinder(6, 42)],
    cornerRadius: 0,
    fluteCount: 4,
    provenance: {},
  }),
  holder: parametricHolder(
    {
      noseDiameter: 34,
      noseLength: 8,
      bodyDiameter: 42,
      bodyLength: 3,
      projection: 11.6,
      flangeDiameter: 46,
      gaugeLength: 60,
    },
    { colletSeries: 'ER16', colletProtrusion: 2 },
  ),
  collet: null,
  stickout: 25,
}
