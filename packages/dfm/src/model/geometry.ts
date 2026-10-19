import type { FeatureSheet, FeatureSheets } from './feature-sheet.js'

type Direction = { readonly x: number; readonly y: number; readonly z: number }

/**
 * A feature as the Engine's report gives it, cut down to the fields the rules
 * read. `@toolpath/api`'s `PartFeature` is one, so the package takes no
 * dependency on the SDK for a type.
 */
export interface ReportFeature {
  readonly featureTag: string
  readonly featureType: string
  readonly machiningDirection: Direction
  readonly regionIdxs: readonly number[]
}

/** A feature as the DFM rules read it: which it is, what kind, the way it is machined, and its faces. */
export interface DfmFeature {
  readonly tag: string
  readonly featureType: string
  readonly machiningDirection: Direction
  readonly regionIdxs: readonly number[]
  /**
   * What the panels call it, after its type: 1, 2, 3… across the part,
   * numbered a machining direction at a time, so the features cut one way
   * run together. Arbitrary otherwise, but steady for one analysis.
   */
  readonly number: number
}

/** The report's features, cut down to what the rules read, and numbered by direction. */
export const dfmFeatures = (features: readonly ReportFeature[]): DfmFeature[] => {
  const read = features.map(
    ({ featureTag, featureType, machiningDirection: { x, y, z }, regionIdxs }) => ({
      tag: featureTag,
      featureType,
      machiningDirection: { x, y, z },
      regionIdxs,
    }),
  )
  // The directions in the order the report first gives them; within each, the report's order.
  const directions: Direction[] = []
  read.forEach(({ machiningDirection }) => {
    if (!directions.some((each) => sameDirection(each, machiningDirection)))
      directions.push(machiningDirection)
  })
  const numbered = directions.flatMap((direction) =>
    read.filter((feature) => sameDirection(feature.machiningDirection, direction)),
  )
  const numberOf = new Map(numbered.map((feature, index) => [feature, index + 1]))
  return read.map((feature) => ({ ...feature, number: numberOf.get(feature) ?? 0 }))
}

const TOLERANCE = 1e-6

/** Two unit directions the same, to the report's own rounding. */
const sameDirection = (a: Direction, b: Direction): boolean =>
  Math.abs(a.x - b.x) < TOLERANCE &&
  Math.abs(a.y - b.y) < TOLERANCE &&
  Math.abs(a.z - b.z) < TOLERANCE

/** `through_hole` as `Through hole`. The Engine's feature types are open-ended snake case. */
export const featureTypeLabel = (featureType: string): string => {
  const words = featureType.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The top of the part along one machining direction: the highest
 * `extendedZMax` of everything cut that way up. The report carries no part
 * top, and this is what makes "how far down does the tool reach" answerable.
 */
export const partTop = (
  features: readonly DfmFeature[],
  sheets: FeatureSheets,
  direction: Direction,
): number | null => {
  let top: number | null = null
  for (const other of features) {
    const zMax = sheets[other.tag.toLowerCase()]?.extendedZMax
    if (zMax !== undefined && sameDirection(other.machiningDirection, direction)) {
      top = top === null ? zMax : Math.max(top, zMax)
    }
  }
  return top
}

/** Within this of 180°, degrees, a hole's bottom is flat. */
const FLAT_TIP_DEG = 0.5

/**
 * Whether a feature is drilled: it has a bore, and a point at its bottom. A
 * flat-bottomed hole (a 180° tip) is no drill's shape — an end mill cuts it —
 * so it is milled, though it is a hole. With no plan to say which tools cut
 * it, this is the whole of the answer.
 */
export const isDrilled = (sheet: FeatureSheet | undefined): boolean =>
  sheet?.diameter !== undefined &&
  sheet.diameter > 0 &&
  !(sheet.tipAngle !== undefined && sheet.tipAngle >= 180 - FLAT_TIP_DEG)

/** What an L/D is taken over: a hole's bore, the minimum clearance at the pinch point, or twice the corner radius. */
export type LdBasis = 'bore' | 'pinch' | 'radius'

/**
 * How far a tool has to reach for this feature against how wide it can be:
 * the depth below the top of the part over a hole's bore, drilled or milled;
 * else over its minimum clearance where it is tightest (its pinch point);
 * else, for a feature the Engine gives no pinch points for, over twice its
 * inside corner radius, the widest end mill that matches it. Null
 * when the datasheet lacks the figures, and for a sharp corner with no pinch
 * tool, which no end mill matches. `atLeast` where the clearance is only a
 * bound on the modelled one, which makes the ratio a bound too.
 */
export const featureLd = (
  features: readonly DfmFeature[],
  feature: DfmFeature,
  sheets: FeatureSheets,
): {
  /** Depth below the top of the part over `across`: how far down the tool reaches. */
  ratio: number
  /** The feature's own depth (`zMax − zMin`) over `across`: what its walls ask of the cutter. Absent without a `zMax`. */
  featureRatio?: number
  drilling: boolean
  atLeast: boolean
  basis: LdBasis
  across: number
} | null => {
  const sheet = sheets[feature.tag.toLowerCase()]
  const top = sheet ? partTop(features, sheets, feature.machiningDirection) : null
  const bottom = sheet?.zMin
  if (!sheet || top === null || bottom === undefined) return null
  const drilling = isDrilled(sheet)
  // A hole's clearance is its bore, drilled or milled.
  const [basis, across]: [LdBasis, number | undefined] =
    sheet.diameter !== undefined
      ? ['bore', sheet.diameter]
      : sheet.pinchDiameter !== undefined
        ? ['pinch', sheet.pinchDiameter]
        : [
            'radius',
            sheet.sharpCorners || sheet.cornerRadius === undefined
              ? undefined
              : 2 * sheet.cornerRadius,
          ]
  if (across === undefined || across <= 0) return null
  // A clearance the Engine could only bound makes the ratio a bound too; a bore is exact.
  const atLeast = basis !== 'bore' && sheet.cornerRadiusUnresolved === true
  return {
    ratio: (top - bottom) / across,
    ...(sheet.zMax !== undefined ? { featureRatio: (sheet.zMax - bottom) / across } : {}),
    drilling,
    atLeast,
    basis,
    across,
  }
}
