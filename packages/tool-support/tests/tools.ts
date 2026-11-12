/** Records the suites build tools from: a stated base, and only what a case changes. */

import { cylinder } from '../src/cones.js'
import type { Cone, Tool } from '../src/index.js'

/** A solid tool: a 6 mm flat end mill with 13 mm of flute, plus whatever a case states. */
export const solid = (fields: Partial<Tool> = {}): Tool => ({
  type: 'solid',
  kind: 'FlatEndmill',
  name: 'test tool',
  diameter: 6,
  fluteLength: 13,
  ...fields,
})

/**
 * A shaft as a vendor's figures describe one: a section of `neck.length` at
 * `neck.diameter` from the top of `fluteLength` flutes, then shank of `shank`
 * to `overallLength` from the tip.
 */
export const shaft = ({
  shank,
  overallLength,
  fluteLength = 13,
  neck,
}: {
  readonly shank: number
  readonly overallLength: number
  readonly fluteLength?: number
  readonly neck?: { readonly length: number; readonly diameter: number }
}): Array<Cone> => {
  const layers: Array<Cone> = []
  if (neck !== undefined && neck.length > 0) {
    layers.push(cylinder(neck.diameter, neck.length))
  }
  const rest = overallLength - fluteLength - (neck?.length ?? 0)
  if (rest > 0) {
    layers.push(cylinder(shank, rest))
  }
  return layers
}
