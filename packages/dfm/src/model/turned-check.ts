import { TYPE_SUBJECT, subjectInfo } from './dfm-metrics.js'
import { ruleResults, worstColor, type DfmCheck, type DfmHit } from './dfm-flags.js'
import {
  breaks,
  compareColors,
  metricInfo,
  worseUpward,
  type DfmMetric,
  type DfmRule,
} from './dfm-rules.js'
import { dfmFeatures, type DfmFeature } from './geometry.js'
import { ID_KINDS, TURNING_RULES } from './turning-metrics.js'

/*
 * A turned part checked against turning rules (`turning-metrics.ts`). The
 * Engine reports a stretch both ends of the part can reach as two features,
 * one per end, with the same type and faces; here they are one stretch again,
 * counted once against each rule. A stretch breaks a rule only where it
 * breaks it from every end it is cut from: one clean way to cut it is a way
 * to cut it.
 *
 * Turning is experimental in the API, so every field is read with a guard: a
 * datasheet shaped other than expected yields no figure, never an error.
 */

/** The end of the part a turned feature is cut from: the end the axis points toward, or the other. */
type TurnedApproach = 'PlusZ' | 'MinusZ'

/**
 * A turned feature as the Engine's report gives it, cut down to what the
 * rules read. `@toolpath/api`'s `TurnedFeature` is one, so the package takes
 * no dependency on the SDK for a type.
 */
export interface TurnedReportFeature {
  readonly featureTag: string
  /** Snake case, open-ended: `od_groove`. */
  readonly featureType: string
  /** The end it is cut from; null or absent on older reports, and for an `unknown` feature. */
  readonly approach?: TurnedApproach | null
  readonly regionIdxs: readonly number[]
  /** Its turning datasheet as the API sent it, or null where it was not measured. */
  readonly datasheet: unknown
}

/**
 * One stretch of a turned part: its per-end copies as one feature, named by
 * the first copy's tag. Its machining direction is along the axis toward the
 * end it is cut from — `+Z` or `−Z` — and zero where it is cut from both or
 * neither; it is there to make a stretch a `DfmFeature`, not to be read.
 */
export interface TurnedStretch extends DfmFeature {
  /** The report's features it was merged from, in the report's order. */
  readonly copies: readonly TurnedReportFeature[]
  /** The ends it is cut from, in the order its copies give them. */
  readonly approaches: readonly TurnedApproach[]
}

/** A feature's faces, or none where the report sends something else. */
const regionsOf = (feature: TurnedReportFeature): readonly number[] =>
  Array.isArray(feature.regionIdxs) ? feature.regionIdxs : []

/** Which copies are one stretch: the same type over the same faces. A copy with no faces stands alone. */
const stretchKey = (feature: TurnedReportFeature): string => {
  const regions = regionsOf(feature)
  return regions.length === 0
    ? `tag:${feature.featureTag}`
    : `${feature.featureType}:${[...regions].sort((a, b) => a - b).join(',')}`
}

const isApproach = (value: unknown): value is TurnedApproach =>
  value === 'PlusZ' || value === 'MinusZ'

/** The report's turned features with each stretch's per-end copies merged, in the order each first comes. */
export const turnedStretches = (features: readonly TurnedReportFeature[]): TurnedStretch[] => {
  const groups = new Map<string, TurnedReportFeature[]>()
  for (const feature of features) {
    const key = stretchKey(feature)
    groups.set(key, [...(groups.get(key) ?? []), feature])
  }
  const merged = [...groups.values()].flatMap((copies) => {
    const [first] = copies
    if (!first) return []
    const approaches = [...new Set(copies.map((each) => each.approach).filter(isApproach))]
    const only = approaches.length === 1 ? approaches[0] : undefined
    const z = only === 'PlusZ' ? 1 : only === 'MinusZ' ? -1 : 0
    return [{ first, copies, approaches, machiningDirection: { x: 0, y: 0, z } }]
  })
  // Numbered as a milled part's features are, a direction at a time.
  const numbered = dfmFeatures(
    merged.map(({ first, machiningDirection }) => ({
      featureTag: first.featureTag,
      featureType: first.featureType,
      machiningDirection,
      regionIdxs: regionsOf(first),
    })),
  )
  return merged.flatMap(({ copies, approaches }, at) => {
    const feature = numbered[at]
    return feature ? [{ ...feature, copies, approaches }] : []
  })
}

/* ---------- Reading a datasheet ---------- */

type Fields = Readonly<Record<string, unknown>>

const record = (value: unknown): Fields | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Fields)
    : undefined

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** A quotient, or null where either side is no figure or it would divide by nothing. */
const ratio = (top: number | null, bottom: number | null): number | null =>
  top !== null && bottom !== null && bottom > 0 ? top / bottom : null

/** A hole's narrowest step, mm: what it is drilled at. */
const narrowestStep = (facts: Fields): number | null => {
  const steps = Array.isArray(facts.steps) ? facts.steps : []
  const diameters = steps
    .map((step) => finite(record(step)?.diameter))
    .filter((each): each is number => each !== null && each > 0)
  return diameters.length > 0 ? Math.min(...diameters) : null
}

/** A catalog thread's field: on a thread's own facts, or on a hole's thread. */
const threadSpec = (facts: Fields, field: string): number | null =>
  finite(record(facts.threadSpec)?.[field]) ??
  finite(record(record(facts.thread)?.threadSpec)?.[field])

/** The part's two ends along the axis, from every stretch's extent. */
interface PartEnds {
  low: number
  high: number
}

const partEnds = (stretches: readonly TurnedStretch[]): PartEnds | null => {
  const zs = stretches.flatMap((stretch) =>
    stretch.copies.flatMap((copy) => {
      const sheet = record(copy.datasheet)
      return [finite(sheet?.zMin), finite(sheet?.zMax)].filter(
        (each): each is number => each !== null,
      )
    }),
  )
  return zs.length > 0 ? { low: Math.min(...zs), high: Math.max(...zs) } : null
}

/**
 * L/D from the end it is cut from. A hole: its depth over its narrowest step.
 * Inside work: from the end of the part it is cut from to the feature's far
 * end, over the narrowest bore a bar passes on its way in (its own smallest
 * where nothing narrower stands between). The `+Z` end is the high one.
 */
const turnedLd = (
  sheet: Fields,
  facts: Fields,
  kind: string | undefined,
  approach: TurnedApproach | null,
  ends: PartEnds | null,
): number | null => {
  if (kind === 'AxialHole') return ratio(finite(facts.depth), narrowestStep(facts))
  const inside: readonly string[] = ID_KINDS
  if (!kind || !inside.includes(kind) || !ends || !approach) return null
  const zMin = finite(sheet.zMin)
  const zMax = finite(sheet.zMax)
  const reach =
    approach === 'PlusZ'
      ? zMin === null
        ? null
        : ends.high - zMin
      : zMax === null
        ? null
        : zMax - ends.low
  const rMin = finite(sheet.rMin)
  const bore = finite(sheet.entryDiameter) ?? (rMin === null ? null : 2 * rMin)
  return ratio(reach, bore)
}

/** Below this a length is no length, and a corner radius is a sharp corner, mm. */
const HAIR = 0.001

/** A cone this near a straight angle is a flat bottom, degrees. */
const FLAT_CONE = 179.5

/**
 * What one copy measures for a metric, or null where it has no figure: no
 * datasheet, a kind that does not report it, or a field missing or malformed.
 */
const copyMeasure = (
  metric: DfmMetric,
  copy: TurnedReportFeature,
  ends: PartEnds | null,
): number | null => {
  const sheet = record(copy.datasheet)
  if (!sheet) return null
  const facts = record(sheet.facts) ?? {}
  // The datasheet's kind, or the copy's type read as one where the datasheet leaves it out.
  const kind = typeof facts.kind === 'string' ? facts.kind : kindOfType(copy.featureType)
  // `facts.depth` is a groove's, a thread's or a hole's depth by kind: never read across kinds.
  const kinds: readonly string[] | undefined = metric.kinds
  if (kinds && !(kind && kinds.includes(kind))) return null
  const doubled = (value: unknown): number | null => {
    const radius = finite(value)
    return radius === null ? null : 2 * radius
  }
  switch (metric.key) {
    case 'maxDiameter':
      return doubled(sheet.rMax)
    case 'minDiameter':
      return doubled(sheet.rMin)
    case 'length': {
      const zMin = finite(sheet.zMin)
      const zMax = finite(sheet.zMax)
      return zMin === null || zMax === null || zMax - zMin < HAIR ? null : zMax - zMin
    }
    case 'ld':
      return turnedLd(sheet, facts, kind, copy.approach ?? null, ends)
    case 'grooveWidth':
      return finite(facts.width)
    case 'grooveDepth':
    case 'threadDepth':
    case 'holeDepth':
      return finite(facts.depth)
    case 'grooveAspect':
      return ratio(finite(facts.depth), finite(facts.width))
    case 'threadPitch':
      return finite(facts.pitch) ?? threadSpec(facts, 'threadPitch')
    case 'threadDiameter':
      return threadSpec(facts, 'basicDiameter')
    case 'holeDiameter':
      return narrowestStep(facts)
    case 'holeSteps':
      return Array.isArray(facts.steps) ? facts.steps.length : null
    case 'flatBottom': {
      // A through hole has no bottom, so no flat one.
      if (facts.bottom === undefined) return 0
      const cone = finite(record(facts.bottom)?.coneDeg)
      return cone === null ? null : cone >= FLAT_CONE ? 1 : 0
    }
    // Zero is a figure here: a sharp corner, which a "radius ≤" rule is most of all about.
    case 'cornerRadius':
      return finite(sheet.minConcaveRadius)
    case 'sharpCorner': {
      const radius = finite(sheet.minConcaveRadius)
      return radius === null ? 0 : radius <= HAIR ? 1 : 0
    }
    // Absent where nothing stands between the feature and its end: nothing to pass, so clean.
    case 'entryDiameter':
      return finite(sheet.entryDiameter)
    case 'axialTool':
      return typeof sheet.mounting === 'string' ? (sheet.mounting === 'Axial' ? 1 : 0) : null
    case 'tolerance':
      return finite(record(sheet.toleranceBand)?.atolMax)
    default:
      return null
  }
}

/* ---------- Subjects ---------- */

/** `od_groove` as its datasheet's kind, `OdGroove`, for a stretch with no datasheet to say. */
const kindOfType = (featureType: string): string =>
  featureType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

/** A stretch's facts: its first measured copy's, which every copy shares. */
const stretchFacts = (stretch: TurnedStretch): Fields | undefined =>
  stretch.copies
    .map((copy) => record(record(copy.datasheet)?.facts))
    .find((each) => each !== undefined)

/** Whether a stretch is one a rule's subject names. */
const stretchIs = (subject: string, stretch: TurnedStretch): boolean => {
  const type = stretch.featureType.toLowerCase()
  if (subject.startsWith(TYPE_SUBJECT)) return type === subject.slice(TYPE_SUBJECT.length)
  const facts = stretchFacts(stretch)
  const kind = typeof facts?.kind === 'string' ? facts.kind : kindOfType(type)
  const hole = kind === 'AxialHole'
  switch (subject) {
    case 'any':
      return true
    case 'thread':
      return (
        kind === 'OdThread' || kind === 'IdThread' || (hole && record(facts?.thread) !== undefined)
      )
    case 'throughHole':
      return hole && facts?.through === true
    case 'blindHole':
      return hole && facts?.through === false
    case 'threadedHole':
      return hole && record(facts?.thread) !== undefined
    default: {
      const kinds: readonly string[] | undefined = subjectInfo(subject, TURNING_RULES)?.kinds
      return kinds !== undefined && kinds.includes(kind)
    }
  }
}

/* ---------- Checking ---------- */

/**
 * The hit a stretch scores against a rule, or null. "Any size" fires on every
 * stretch. Anything else needs every measured copy to break the rule — a copy
 * with no figure for it is clean — and reports the least bad of them: the end
 * a plan would cut it from.
 */
const stretchHit = (
  stretch: TurnedStretch,
  rule: DfmRule,
  metric: DfmMetric,
  ends: PartEnds | null,
): DfmHit | null => {
  if (metric.quantity === 'presence') return { rule, metric, value: 1 }
  const measured = stretch.copies.filter((copy) => record(copy.datasheet) !== undefined)
  if (measured.length === 0) return null
  const values: number[] = []
  for (const copy of measured) {
    const value = copyMeasure(metric, copy, ends)
    if (value === null || !breaks(rule, metric.quantity, value)) return null
    values.push(value)
  }
  const value = worseUpward(rule, metric) ? Math.min(...values) : Math.max(...values)
  return { rule, metric, value }
}

/**
 * Checks every stretch of a turned part against turning rules. Every stretch
 * is required — a turned part has one reading of each face — so `otherTags`
 * is always empty and nothing is painted whole; each broken stretch's faces
 * are painted its worst rule's colour.
 */
export const checkTurnedPart = (
  stretches: readonly TurnedStretch[],
  rules: readonly DfmRule[],
): DfmCheck => {
  const ends = partEnds(stretches)
  const hitsByTag = new Map(
    stretches.map((stretch) => [
      stretch.tag.toLowerCase(),
      rules.flatMap((rule) => {
        const metric = metricInfo(rule.metric, TURNING_RULES)
        if (!metric || !stretchIs(rule.subject, stretch)) return []
        const hit = stretchHit(stretch, rule, metric, ends)
        return hit ? [hit] : []
      }),
    ]),
  )
  const required = new Set(stretches.map((stretch) => stretch.tag.toLowerCase()))
  const paintedFaces = new Map<number, { tag: string; color: string }>()
  for (const stretch of stretches) {
    const color = worstColor(hitsByTag.get(stretch.tag.toLowerCase()))
    if (!color) continue
    for (const region of stretch.regionIdxs) {
      const painted = paintedFaces.get(region)
      if (!painted || compareColors(color, painted.color) < 0)
        paintedFaces.set(region, { tag: stretch.tag, color })
    }
  }
  return {
    hitsByTag,
    required,
    byRule: ruleResults(rules, stretches, hitsByTag, required),
    paintedFaces,
    paintedWhole: new Map(),
  }
}
