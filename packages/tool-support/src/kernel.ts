/**
 * Records from the kernel's own description of a tool it planned with.
 *
 * The package does not depend on tp-kernel: {@link KernelToolSummary} mirrors
 * its `ToolSummary` (0.33.0) structurally, so a kernel summary is accepted
 * as is.
 *
 * The kernel's `ToolHeadTag` has no `SpotDrill`: a spot drill is a `DrillBit`
 * with `is_spot_drill` on the kernel's `Tool`, which its `ToolSummary` does not
 * carry yet. The record keeps it as a kind of its own, `SpotDrill`, and reads
 * {@link KernelToolSummary.isSpotDrill} where a summary supplies it.
 */

import { cylinder } from './cones.js'
import { isInsertKind, type KernelToolKind } from './kinds.js'
import type { Cone, InsertTool, RotatingToolAssembly, Tool } from './model.js'
import { optional } from './optional.js'

/** tp-kernel's `ToolSummary`. Lengths mm, angles degrees. */
export interface KernelToolSummary {
  readonly name: string
  /** The kernel's content key; meaningful only within one plan. */
  readonly key: string
  readonly kind: KernelToolKind
  /** The swept (cutting) diameter: for a face mill, what its inserts sweep. */
  readonly diameter: number
  readonly fluteLength: number
  /** How far the tool reaches below its holder. */
  readonly stickout: number
  readonly fluteCount: number
  readonly cornerRadius?: number
  readonly roundingRadius?: number
  readonly tipAngleDeg?: number
  readonly threadPitch?: number
  readonly threadHandedness?: 'Right' | 'Left'
  readonly threadProfileDeg?: number
  readonly threadTaperDeg?: number
  readonly undercutReach?: number
  /**
   * A `DrillBit` that only spots and chamfers, never drilling to depth. The
   * shape the kernel is asked to supply: its summary does not carry it yet, so
   * a kernel-made spot drill reads as a `DrillBit` until it does.
   */
  readonly isSpotDrill?: boolean
}

const HANDEDNESS = { Right: 'right', Left: 'left' } as const

const threadOf = (summary: KernelToolSummary): Tool['thread'] | undefined => {
  if (summary.threadPitch === undefined || !(summary.threadPitch > 0)) {
    return undefined
  }
  return {
    pitch: summary.threadPitch,
    ...optional(
      'handedness',
      summary.threadHandedness === undefined ? undefined : HANDEDNESS[summary.threadHandedness],
    ),
    ...optional('profileDeg', summary.threadProfileDeg),
    ...optional('taperDeg', summary.threadTaperDeg),
  }
}

/**
 * What stands out above the flutes: the summary states one diameter, so the
 * record carries it as the shank, from the flutes to the stickout. None where
 * the flutes reach the stickout.
 */
const shaftOf = (summary: KernelToolSummary): Array<Cone> | undefined => {
  const height = summary.stickout - summary.fluteLength
  return height > 0 ? [cylinder(summary.diameter, height)] : undefined
}

/** Both of the shaft's readings, which the kernel does not state. */
const ASSUMED_SHAFT = { shank: 'assumed', overallLength: 'assumed' } as const

/**
 * The record of a tool the kernel planned with.
 *
 * The kernel states only the diameter a face mill's inserts sweep, and no lead
 * angle, so its record carries that as the body's diameter with no lead angle
 * stated: its `cuttingDiameter` is the kernel's diameter, and the nominal
 * diameter at the insert seats is not known. The kernel's flute count of zero
 * means it was not stated, and is left out. The summary states one diameter,
 * which the record carries as the shank too: a shaft of that diameter from the
 * flutes to the stickout. The kernel states its cutting diameter and its
 * stickout, not a shank or the end of the tool, so that shaft's `shank` and
 * `overallLength` are both `assumed`: nothing holds it by that shank, and no
 * exporter writes either. A `DrillBit` whose summary states `isSpotDrill` is a
 * `SpotDrill`; tp-kernel's summary does not state it yet, so until it does a
 * kernel-made spot drill reads as a `DrillBit`.
 */
export const toolFromSummary = (summary: KernelToolSummary): Tool | InsertTool => {
  const fluteCount = summary.fluteCount > 0 ? summary.fluteCount : undefined
  const shaft = shaftOf(summary)
  const kind =
    summary.kind === 'DrillBit' && summary.isSpotDrill === true ? 'SpotDrill' : summary.kind
  if (isInsertKind(summary.kind)) {
    return {
      type: 'insert',
      kind: summary.kind,
      name: summary.name,
      body: {
        diameter: summary.diameter,
        fluteLength: summary.fluteLength,
        ...optional('pockets', fluteCount),
      },
      ...optional('shaft', shaft),
      ...optional('provenance', shaft === undefined ? undefined : ASSUMED_SHAFT),
      insert: {},
    }
  }
  return {
    type: 'solid',
    kind,
    name: summary.name,
    diameter: summary.diameter,
    fluteLength: summary.fluteLength,
    ...optional('fluteCount', fluteCount),
    ...optional('shaft', shaft),
    ...optional('provenance', shaft === undefined ? undefined : ASSUMED_SHAFT),
    ...optional('cornerRadius', summary.cornerRadius),
    ...optional('roundingRadius', summary.roundingRadius),
    ...optional('tipAngleDeg', summary.tipAngleDeg),
    ...optional('undercutReach', summary.undercutReach),
    ...optional('thread', threadOf(summary)),
  }
}

/** The assembly a kernel summary describes: the tool at its stickout, holder and collet unknown. */
export const assemblyFromSummary = (summary: KernelToolSummary): RotatingToolAssembly => ({
  tool: toolFromSummary(summary),
  holder: null,
  collet: null,
  stickout: summary.stickout,
})
