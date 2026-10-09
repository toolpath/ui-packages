import { clearanceFit, readPinch, type ClearanceFit } from './pinch.js'

/**
 * The few numbers of a feature's datasheet that the DFM rules and the
 * feature details read. All millimetres, as the Engine reports them. Each is
 * left out where this kind of feature does not report it, rather than sent as
 * a zero that reads as measured.
 *
 * From the quoting app (quoting-ui `server/lib/engine.ts`). A datasheet is
 * large, so the worker cuts each one down to this before it sends it.
 */
export interface FeatureSheet {
  /** The Engine's family for it: `Hole`, `Pocket`, … */
  kind?: string
  /** Along the machining direction, the feature's own bottom and top. */
  zMin?: number
  zMax?: number
  /** Its top extended to the stock, which the highest of stands in for the part's top. */
  extendedZMax?: number
  /** The widest cutter that still reaches the tightest corner. */
  maxTool?: number
  diameter?: number
  /** For a hole: the full angle of the cone at its bottom, degrees; 180 for a flat bottom. */
  tipAngle?: number
  filletRadius?: number
  chamferAngle?: number
  /**
   * For a milled feature with walls: the radius of its tightest inside corner
   * between walls, as the geometry has it rather than as a tool reaches it —
   * zero for a sharp one. Half its minimum clearance: see {@link insideCornerRadius}.
   */
  cornerRadius?: number
  /**
   * The Engine measured the clearance at one tolerance only, so neither
   * `cornerRadius` nor `pinchDiameter` could be run back to none: each is as
   * a tool reads it at that tolerance, the most the clearance can be.
   */
  cornerRadiusUnresolved?: true
  /** What the clearance was worked out from, so a reader can follow it. See {@link ClearanceFit}. */
  clearance?: ClearanceFit
  /**
   * A vertical inside corner between its walls with no radius, which no end
   * mill makes; and where, in the datasheet's tool frame (x, y across the
   * tool; its `zMin`..`zMax` along it).
   */
  sharpCorners?: readonly { x: number; y: number }[]
  /**
   * For a contour surface: the largest tool its shape admits (`facts.toolFit`)
   * — its diameter, and the radius on its corner, no larger than the
   * surface's tightest concave curve; half the diameter for a ball.
   */
  fitToolDiameter?: number
  fitCornerRadius?: number
  /** Where the tool fit was read: `facts.toolFit` or `facts.three.toolFit`. */
  toolFitPath?: string
  /** For a contour surface: only a ball end mill can finish it, not a bull nose. */
  ballOnly?: true
  /**
   * The feature's minimum clearance: the smallest of its pinch discs
   * (`pinchPoints`), the tolerance taken out, leaving out the zero-wide ones
   * a sharp corner reports. The widest tool that fits where it is tightest,
   * and what a milled feature's L/D is taken over.
   */
  pinchDiameter?: number
  /** How many places are that tight: the pinch discs counted in `pinchDiameter`. */
  pinchPlaces?: number
  /** No cutter fits anywhere in the feature. */
  noToolFits?: true
  /** For a hole the model threads: its thread. */
  threading?: FeatureThreading
  /** For an undercut — a T-slot or a dovetail: what its cutter is held to. */
  undercut?: FeatureUndercut
}

/**
 * An undercut's own figures, from its `facts`: a T-slot's or a dovetail's.
 * Millimetres and degrees. Each is left out where the Engine did not measure
 * it, or where nothing limits it.
 */
export interface FeatureUndercut {
  /** T-slot: how far the groove runs back from its opening, radially (`facts.undercutDepth`). */
  undercutDepth?: number
  /**
   * T-slot: the widest tool that comes down through the opening above it
   * (`facts.maxEntryCd`), which holds the cutter's shaft. Left out where
   * nothing above limits it; zero where nothing fits.
   */
  maxEntry?: number
  /** Dovetail: between the overhanging wall and the tool axis, degrees (`facts.taperDeg`). */
  taperDeg?: number
  /** Dovetail: the widest clearance over the floor, the width the groove cuts at. */
  floorWidth?: number
  /** Dovetail: the clearance through the opening at the top of the groove. */
  topOpeningWidth?: number
  /** Dovetail: the groove's widths vary from place to place — it runs out somewhere. */
  isExternal?: true
  /** T-slot: its walls close on themselves in plan view, so a cutter's head comes down through its opening. */
  isClosed?: true
  /**
   * The Engine could not measure it (`facts.isInvalidGeometry` or
   * `facts.cd.measurementFailed`), so its figures offer no cutter.
   */
  unmeasured?: true
}

/** A modelled thread, from a hole's `facts.threading`. Millimetres. */
export interface FeatureThreading {
  basicDiameter: number
  threadPitch: number
}

/** Feature tag, lower-cased → its sheet. */
export type FeatureSheets = Record<string, FeatureSheet>

/** Narrower than this, the largest tool that fits is no tool at all. */
export const SHARP_MM = 0.1

/** Under this, mm, an inside corner has no radius at all: it is sharp. */
const SHARP_RADIUS_MM = 0.01
/** Narrower than this, mm, a pinch disc is a sharp corner, which no tool fits: not a pinch tool. */
export const PINCH_TOOL_MM = 0.01

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/** Only the fields that are set: one left out reads as not reported, never as a zero. */
const definedOnly = <T extends object>(fields: { [K in keyof T]: T[K] | undefined }): T =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T

/**
 * A T-slot's or a dovetail's own figures. An unmeasured figure may come as
 * an infinity, which JSON sends as a string or not at all: either way it is
 * left out.
 */
const undercutOf = (facts: Record<string, unknown>): FeatureUndercut | undefined => {
  const unmeasured =
    facts.isInvalidGeometry === true || recordOf(facts.cd).measurementFailed === true
      ? (true as const)
      : undefined
  if (facts.kind === 'Tslot')
    return definedOnly<FeatureUndercut>({
      undercutDepth: asNumber(facts.undercutDepth),
      maxEntry: asNumber(facts.maxEntryCd),
      isClosed: facts.isClosed === true ? true : undefined,
      unmeasured,
    })
  if (facts.kind === 'Dovetail')
    return definedOnly<FeatureUndercut>({
      taperDeg: asNumber(facts.taperDeg),
      floorWidth: asNumber(facts.floorWidth),
      topOpeningWidth: asNumber(facts.topOpeningWidth),
      isExternal: facts.isExternal === true ? true : undefined,
      unmeasured,
    })
  return undefined
}

/** A hole's thread, where the model has one. */
const threadingOf = (facts: Record<string, unknown>): FeatureThreading | undefined => {
  const spec = recordOf(recordOf(facts.threading).spec)
  const basicDiameter = asNumber(spec.basicDiameter)
  const threadPitch = asNumber(spec.threadPitch)
  if (basicDiameter === undefined || threadPitch === undefined || threadPitch <= 0) return undefined
  return { basicDiameter, threadPitch }
}

/**
 * Whether a cutter band says no tool fits anywhere in the feature: its `max`,
 * the largest tool that fits somewhere, is next to nothing.
 *
 * Not its `min`, the largest tool that reaches every point: that is zero for
 * any wall meeting another in a square inside corner, which is machined like
 * any wall and leaves the tool's radius in the corner. Infinities are the
 * band's sentinels, and JSON cannot carry them, so they may come as strings.
 */
const noToolFits = (band: Record<string, unknown>): boolean => {
  const { max } = band
  if (typeof max === 'string') return /^-inf/i.test(max.trim())
  return (
    typeof max === 'number' &&
    (max === Number.NEGATIVE_INFINITY || (Number.isFinite(max) && max < SHARP_MM))
  )
}

/**
 * The radius of a feature's tightest inside corner between walls: half its
 * minimum clearance, the widest tool that reaches every point (a band's
 * `min`) with the tolerance it was measured to taken out ({@link clearanceFit}).
 *
 * The band only sees across the tool, so only corners between walls — never
 * a floor's fillet.
 */
const insideCornerRadius = (fit: ClearanceFit): number => Math.max((fit.strict - fit.slack) / 2, 0)

/** The places a feature is at its tightest (`pinchPoints`), across the tool. */
const pinchCentres = (points: unknown): { x: number; y: number }[] =>
  Array.isArray(points)
    ? points.flatMap((point) => {
        const centre = recordOf(recordOf(point).center)
        const x = asNumber(centre.x)
        const y = asNumber(centre.y)
        return x === undefined || y === undefined ? [] : [{ x, y }]
      })
    : []

/** Under this, mm, a cutter band's figure is zero: what the raw view shows as 0, to its four places. */
const ZERO_MM = 5e-5

/**
 * A T-slot the Engine found no cutter for: every figure in its cutter band
 * (`facts.cd`) is zero, whether sent as a number or a string. Nothing can
 * machine it, so it is no reading of its faces at all, and the analysis
 * leaves it out. One figure that is not zero, and it stays.
 */
export const isCutterlessTslot = (datasheet: unknown): boolean => {
  const facts = recordOf(recordOf(datasheet).facts)
  if (facts.kind !== 'Tslot') return false
  const leaves = (value: unknown): unknown[] =>
    typeof value === 'object' && value !== null ? Object.values(value).flatMap(leaves) : [value]
  const band = leaves(facts.cd)
  return (
    band.length > 0 &&
    band.every((each) => {
      const value = typeof each === 'string' && each.trim() !== '' ? Number(each) : each
      return typeof value === 'number' && Math.abs(value) < ZERO_MM
    })
  )
}

/**
 * A fillet reading the Engine itself says has a sharp corner
 * (`facts.hasSharpCorner`): a radius with no radius, which is no way to make
 * its faces. The Engine reads a pocket's short walls, say, as outer fillets
 * from the sides too, and reports the sharp corner between them on each; as
 * readings they would say those faces can be cut clean, when their only
 * machining is the pocket's. Left out like a cutterless T-slot. A filleted
 * pocket or T-slot is not a fillet: it keeps its walls, and its own reading.
 */
export const isSharpCorneredFillet = (featureType: unknown, datasheet: unknown): boolean => {
  if (typeof featureType !== 'string' || !featureType.toLowerCase().split('_').includes('fillet'))
    return false
  const facts = recordOf(recordOf(datasheet).facts)
  return facts.hasSharpCorner === true || recordOf(facts.three).hasSharpCorner === true
}

/** A feature that is no reading of its faces at all, which the analysis leaves out. */
export const isNoReading = (featureType: unknown, datasheet: unknown): boolean =>
  isCutterlessTslot(datasheet) || isSharpCorneredFillet(featureType, datasheet)

/** One datasheet, cut down to what the rules read. Read loosely: kinds report different fields. */
export const featureSheet = (datasheet: unknown): FeatureSheet => {
  const sheet = recordOf(datasheet)
  const facts = recordOf(sheet.facts)
  const kind = typeof facts.kind === 'string' ? facts.kind : undefined
  // A chamfer keeps its cutter band under the three-axis reading; everything else at the top.
  const band = recordOf(kind === 'Chamfer' ? recordOf(facts.three).cd : facts.cd)
  const ignoreBand = recordOf(band.ignore)
  const fit = clearanceFit(datasheet)
  const fields: Partial<Record<keyof FeatureSheet, number | string | undefined>> = {
    kind,
    zMin: asNumber(sheet.zMin),
    zMax: asNumber(sheet.zMax),
    extendedZMax: asNumber(sheet.extendedZMax),
    maxTool: asNumber(ignoreBand.min),
    diameter: kind === 'Hole' ? asNumber(facts.diameter) : undefined,
    tipAngle: kind === 'Hole' ? asNumber(facts.fullConeDeg) : undefined,
    filletRadius: asNumber(facts.filletRadius),
    // A bevel's angle wherever the facts carry one: a chamfer's, and any other kind that bevels.
    chamferAngle: asNumber(recordOf(facts.bevel).angleDeg),
  }
  // A contour surface keeps its tool fit at the top or under the three-axis reading.
  const toolFitPath = facts.toolFit !== undefined ? 'facts.toolFit' : 'facts.three.toolFit'
  const toolFit = recordOf(facts.toolFit ?? recordOf(facts.three).toolFit)
  fields.fitToolDiameter = asNumber(toolFit.toolDiameter)
  fields.fitCornerRadius = asNumber(toolFit.cornerRadius)
  const ballOnly =
    (facts.useOnlyBallToolsForFinish ?? recordOf(facts.three).useOnlyBallToolsForFinish) === true
  const measured = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as FeatureSheet
  const cramped = Object.keys(ignoreBand).length > 0 && noToolFits(ignoreBand)
  // Milled walls only: a hole's band is its bore.
  const walled = kind !== 'Hole' && sheet.hasWall === true
  const clearance = walled ? fit : undefined
  const cornerRadius = clearance ? insideCornerRadius(clearance) : undefined
  const sharp = cornerRadius !== undefined && cornerRadius < SHARP_RADIUS_MM && !cramped
  const threading = kind === 'Hole' ? threadingOf(facts) : undefined
  const undercut = undercutOf(facts)
  const pinched = (readPinch(datasheet)?.discs ?? []).filter(
    (disc) => disc.diameter >= PINCH_TOOL_MM,
  )
  return {
    ...measured,
    ...(pinched.length > 0
      ? {
          pinchDiameter: Math.min(...pinched.map((disc) => disc.diameter)),
          pinchPlaces: pinched.length,
        }
      : {}),
    ...(cornerRadius !== undefined ? { cornerRadius } : {}),
    ...(clearance && !clearance.resolved ? { cornerRadiusUnresolved: true as const } : {}),
    ...(clearance ? { clearance } : {}),
    ...(Object.keys(toolFit).length > 0 ? { toolFitPath } : {}),
    ...(sharp ? { sharpCorners: pinchCentres(sheet.pinchPoints) } : {}),
    ...(cramped ? { noToolFits: true as const } : {}),
    ...(ballOnly ? { ballOnly: true as const } : {}),
    ...(threading ? { threading } : {}),
    ...(undercut ? { undercut } : {}),
  }
}
