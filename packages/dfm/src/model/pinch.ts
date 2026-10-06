/**
 * Where a feature is at its tightest (the datasheet's `pinchPoints`, API
 * 1.12.1): one disc per stretch of the feature that reaches its minimum
 * clearance, tightest first and never more than ten.
 *
 * As the API defines it, a disc fits in the space the clearance was measured
 * in and touches the feature's boundary, so a cylinder of its diameter
 * standing at its centre and spanning the datasheet's `zMin`..`zMax` is
 * exactly the widest tool that reaches the boundary there. That is what makes
 * them drawable: each is the tool the feature allows, standing where the
 * feature stops a larger one.
 *
 * The Engine measures each disc to a tolerance (`toleranceBand.atolIgnore`),
 * which lets it read a little wider than the gap it sits in. The discs here
 * have that slack taken out (see {@link clearanceFit}), so each is the
 * clearance itself: in a 2.5 mm corner, a 5 mm disc.
 *
 * Empty for the kinds whose clearance is not measured off a single medial
 * axis (a hole, a facing pass, the undercut and layered kinds), so empty is
 * "nowhere to point at", never "nowhere is tight".
 *
 * Millimetres, in the datasheet's tool frame: x and y across the tool, z up
 * it.
 */

/** One disc: its centre across the tool, and its diameter. */
export interface PinchDisc {
  x: number
  y: number
  diameter: number
}

/** A feature's pinch discs, and the band along the tool they stand through. */
export interface FeaturePinch {
  discs: readonly PinchDisc[]
  zMin: number
  zMax: number
  /**
   * The Engine measured the clearance at one tolerance only, so the slack
   * could not be taken out: each disc is as measured, the most the clearance
   * can be.
   */
  unresolved?: true
}

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/**
 * The figures a feature's clearance is run back from, as the datasheet has
 * them: the widest tool that reaches every point (`min` of the cutter band,
 * which is also its tightest pinch disc) at the strict tolerance, and at the
 * looser one where the Engine reports it.
 */
export interface ClearanceFit {
  /** `facts.cd`, or `facts.three.cd` for a chamfer. */
  bandPath: string
  strict: number
  loose?: number
  atStrict?: number
  atLoose?: number
  /**
   * How much wider, mm, the tolerance lets the widest tool read than the
   * clearance it fits: what to take off a measured disc. Zero where the
   * Engine measured at one tolerance only (`resolved` false), or where the
   * tool does not grow with tolerance (a gap between walls, not a corner).
   */
  slack: number
  resolved: boolean
}

/**
 * How much the Engine's tolerance widens the widest tool, from the cutter
 * band it reports at two tolerances.
 *
 * A tool of radius `r` in a corner of radius `R` leaves `(r − R)·k` uncut,
 * `k` set by the corner's angle — so the widest tool within a tolerance `t`
 * has `r = R + t/k`, a line. The Engine measures it at two tolerances
 * (`ignore` and `deviate`, to `toleranceBand.atolIgnore` and `atolDeviate`);
 * run back to no tolerance at all, the line meets `R`, and `2R` is the
 * clearance. A sharp corner has `R = 0`: ten times the tolerance, ten times
 * the tool. A fillet has the fillet's radius. A gap between walls, not a
 * corner, has a tool that does not grow with the tolerance, and the gap is
 * its answer. Undefined where the band has no `min`.
 */
export const clearanceFit = (datasheet: unknown): ClearanceFit | undefined => {
  const sheet = recordOf(datasheet)
  const facts = recordOf(sheet.facts)
  // A chamfer keeps its cutter band under the three-axis reading; everything else at the top.
  const chamfer = facts.kind === 'Chamfer'
  const band = recordOf(chamfer ? recordOf(facts.three).cd : facts.cd)
  const tolerance = recordOf(sheet.toleranceBand)
  const strict = asNumber(recordOf(band.ignore).min)
  if (strict === undefined) return undefined
  const bandPath = chamfer ? 'facts.three.cd' : 'facts.cd'
  const loose = asNumber(recordOf(band.deviate).min)
  const atStrict = asNumber(tolerance.atolIgnore)
  const atLoose = asNumber(tolerance.atolDeviate)
  const source = { bandPath, strict, loose, atStrict, atLoose }
  if (loose === undefined || atStrict === undefined || atLoose === undefined || atLoose <= atStrict)
    return { ...source, slack: 0, resolved: false }
  const growth = (loose - strict) / (atLoose - atStrict)
  const slack = growth > 0 ? Math.min(growth * atStrict, strict) : 0
  return { ...source, slack, resolved: true }
}

/** A datasheet's pinch discs, the tolerance taken out of each, or null where it has none to draw. */
export const readPinch = (datasheet: unknown): FeaturePinch | null => {
  const sheet = recordOf(datasheet)
  const zMin = asNumber(sheet.zMin)
  const zMax = asNumber(sheet.zMax)
  if (zMin === undefined || zMax === undefined || !Array.isArray(sheet.pinchPoints)) return null
  const fit = clearanceFit(datasheet)
  const slack = fit?.slack ?? 0
  const discs = sheet.pinchPoints.flatMap((point): PinchDisc[] => {
    const centre = recordOf(recordOf(point).center)
    const x = asNumber(centre.x)
    const y = asNumber(centre.y)
    const diameter = asNumber(recordOf(point).diameter)
    return x === undefined || y === undefined || diameter === undefined || diameter < 0
      ? []
      : [{ x, y, diameter: Math.max(diameter - slack, 0) }]
  })
  if (discs.length === 0) return null
  return { discs, zMin, zMax, ...(fit && !fit.resolved ? { unresolved: true as const } : {}) }
}
