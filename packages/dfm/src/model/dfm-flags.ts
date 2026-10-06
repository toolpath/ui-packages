import { TYPE_SUBJECT } from './dfm-metrics.js'
import {
  breaks,
  compareColors,
  metricInfo,
  worseUpward,
  type DfmMetric,
  type DfmRule,
} from './dfm-rules.js'
import type { FeatureSheet, FeatureSheets } from './feature-sheet.js'
import { featureLd, isDrilled, partTop, type DfmFeature } from './geometry.js'

/*
 * Taken from the quoting app (quoting-ui `src/plan/dfm-flags.ts`), cut down
 * to its feature checks, which read the features' datasheets and nothing
 * from a plan — and widened to every figure a datasheet reports
 * (`dfm-metrics.ts`), read from the datasheet as the API sent it.
 */

/** What the checks read of the part, beyond its features. */
export interface DfmSources {
  /** Each feature's measurements, cut down (`feature-sheet.ts`), by lower-cased tag. */
  sheets: FeatureSheets
  /** Each feature's datasheet as the API sent it, by lower-cased tag. */
  datasheets: Readonly<Record<string, unknown>>
  /** Each face's area, mm², by region index. */
  regionAreas: ReadonlyMap<number, number>
}

/** One rule a feature broke, with the figure that broke it. */
export interface DfmHit {
  rule: DfmRule
  metric: DfmMetric
  /** What was measured, canonical. */
  value: number
  /** For an L/D: against a drill's bore rather than the widest cutter. */
  drilling?: boolean
}

/**
 * Whether a feature is drilled and whether it is milled: a pointed hole is
 * drilled, and anything else — a flat-bottomed hole too — milled. See `isDrilled`.
 */
const howCut = (sheet: FeatureSheet | undefined): { drilled: boolean; milled: boolean } => {
  const drilled = isDrilled(sheet)
  return { drilled, milled: !drilled }
}

/** Whether a feature is one a rule's subject names. */
const featureIs = (
  subject: string,
  featureType: string,
  sheet: FeatureSheet | undefined,
): boolean => {
  const type = featureType.toLowerCase()
  const kind = sheet?.kind?.toLowerCase() ?? ''
  // One feature type exactly, as the report names it.
  if (subject.startsWith(TYPE_SUBJECT)) return type === subject.slice(TYPE_SUBJECT.length)
  switch (subject) {
    case 'any':
      return true
    case 'milled':
      return howCut(sheet).milled
    case 'drilled':
      return howCut(sheet).drilled
    case 'hole':
      return type.includes('hole') || kind === 'hole'
    case 'threadedHole':
      return sheet?.threading !== undefined
    case 'pocket':
      return type.includes('pocket') || kind === 'pocket'
    case 'slot':
      return type.includes('slot') || kind === 'tslot'
    case 'undercut':
      return kind === 'tslot' || type.includes('undercut') || type.includes('tslot')
    case 'contour':
      // Toolpath's `contour_surface`: freeform 3D surfacing, cut with a ball or bull nose.
      return type.includes('contour') || kind.includes('contour')
    case 'wall':
      return type.includes('wall') || kind === 'wall'
    case 'face':
      return type === 'face' || kind === 'face'
    case 'fillet':
      // By word: a filleted pocket, hole or boss is not a fillet.
      return type.split('_').includes('fillet') || kind.includes('fillet')
    case 'chamfer':
      return type.includes('chamfer') || kind === 'chamfer'
    case 'boss':
      return type.includes('boss') || kind === 'boss'
    case 'countersink':
      return type === 'sink'
    case 'profile':
      return type === 'profile' || kind === 'profile'
    default:
      return false
  }
}

/** A value at a dotted path in a record, or undefined. */
const at = (record: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      record,
    )

/**
 * A datasheet field as a figure: a number as it is, yes/no as 1 or 0, and
 * present as 1 for a field whose being there is the answer (a thread, a
 * countersink). An infinity (sent as a string) or a field left out is not a
 * figure, and no rule is broken by it.
 */
const readPath = (datasheet: unknown, metric: DfmMetric): number | null => {
  for (const path of metric.path ?? []) {
    const value = at(datasheet, path)
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') return value ? 1 : 0
    if (metric.quantity === 'flag') return 1
    if (typeof value === 'number' && Number.isFinite(value)) return value
    return null
  }
  // A yes/no the datasheet leaves out is a no: no thread, no countersink.
  return metric.quantity === 'flag' && metric.path ? 0 : null
}

const TILT = 1e-6

/** Whether a direction is none of the six square ones: a 5-axis setup. */
const isTilted = ({ x, y, z }: DfmFeature['machiningDirection']): boolean =>
  [x, y, z].filter((each) => Math.abs(each) > TILT).length > 1

/** The figure a feature has for a metric, or null where nothing says. */
const featureMeasure = (
  metric: DfmMetric,
  features: readonly DfmFeature[],
  feature: DfmFeature,
  { sheets, datasheets, regionAreas }: DfmSources,
): { value: number; drilling?: boolean } | null => {
  const tag = feature.tag.toLowerCase()
  const sheet = sheets[tag]
  const datasheet = datasheets[tag]
  const positive = (value: number | undefined): { value: number } | null =>
    value !== undefined && value > 0 ? { value } : null
  switch (metric.key) {
    case 'present':
      return { value: 1 }
    case 'tilted':
      return { value: isTilted(feature.machiningDirection) ? 1 : 0 }
    case 'faceCount':
      return { value: new Set(feature.regionIdxs).size }
    case 'ld': {
      const ld = featureLd(features, feature, sheets)
      return ld ? { value: ld.ratio, drilling: ld.drilling } : null
    }
    case 'featureLd': {
      const ld = featureLd(features, feature, sheets)
      return ld?.featureRatio !== undefined
        ? { value: ld.featureRatio, drilling: ld.drilling }
        : null
    }
    case 'depthBelowTop': {
      const top = partTop(features, sheets, feature.machiningDirection)
      return top !== null && sheet?.zMin !== undefined ? { value: top - sheet.zMin } : null
    }
    case 'featureDepth':
      return sheet?.zMax !== undefined && sheet.zMin !== undefined
        ? { value: sheet.zMax - sheet.zMin }
        : null
    // Zero is no measure at all for these: no bore, no tool, a sharp floor rather than a tiny fillet.
    case 'diameter':
      return positive(sheet?.diameter)
    // Zero is a measure here: a sharp corner, which a "radius ≤" rule is most of all about.
    case 'cornerRadius':
      return sheet?.cornerRadius === undefined ? null : { value: sheet.cornerRadius }
    case 'maxTool':
      return positive(sheet?.maxTool)
    case 'floorFillet':
      return positive(sheet?.filletRadius)
    case 'sharpCorner':
      return sheet ? { value: sheet.sharpCorners ? 1 : 0 } : null
    case 'noToolFits':
      return sheet ? { value: sheet.noToolFits ? 1 : 0 } : null
    case 'pinchPoints': {
      const points = at(datasheet, 'pinchPoints')
      return Array.isArray(points) ? { value: points.length } : null
    }
    // A disc under a hundredth is a sharp corner, which `sharpCorner` is for: see `pinchDiameter`.
    case 'pinchDiameter':
      return positive(sheet?.pinchDiameter)
    case 'reachHeight': {
      const heights = at(datasheet, 'reachCurve.verticalOffset')
      const numbers = Array.isArray(heights)
        ? heights.filter(
            (each): each is number => typeof each === 'number' && Number.isFinite(each),
          )
        : []
      return numbers.length > 0 ? { value: Math.max(...numbers) } : null
    }
    case 'surfaceArea': {
      const areas = at(datasheet, 'areas')
      if (typeof areas === 'object' && areas !== null) {
        const parts = Object.values(areas).filter(
          (each): each is number => typeof each === 'number' && Number.isFinite(each),
        )
        if (parts.length > 0) return { value: parts.reduce((sum, each) => sum + each, 0) }
      }
      const faces = [...new Set(feature.regionIdxs)].flatMap(
        (region) => regionAreas.get(region) ?? [],
      )
      return faces.length > 0 ? { value: faces.reduce((sum, each) => sum + each, 0) } : null
    }
    default: {
      if (!datasheet) return null
      const value = readPath(datasheet, metric)
      return value === null ? null : { value }
    }
  }
}

/** Every rule one feature breaks, in the rules' own order. */
const featureHits = (
  features: readonly DfmFeature[],
  feature: DfmFeature,
  sources: DfmSources,
  rules: readonly DfmRule[],
): DfmHit[] => {
  const sheet = sources.sheets[feature.tag.toLowerCase()]
  return rules.flatMap((rule) => {
    const info = metricInfo(rule.metric)
    if (!info || !featureIs(rule.subject, feature.featureType, sheet)) return []
    const measured = featureMeasure(info, features, feature, sources)
    if (!measured || !breaks(rule, info.quantity, measured.value)) return []
    return [{ rule, metric: info, ...measured }]
  })
}

/**
 * The features a plan cannot do without, lower-cased: each owns at least one
 * region that no other feature does, so nothing else machines that face.
 *
 * Most faces are owned by several features at once — the same surface is a
 * floor from one side, a wall from another, and part of a profile — and any
 * of those readings would machine it. A face with only one owner has only one
 * way to be made, and that feature is required.
 */
export const requiredTags = (features: readonly DfmFeature[]): Set<string> => {
  const owners = new Map<number, number>()
  for (const feature of features) {
    for (const region of new Set(feature.regionIdxs))
      owners.set(region, (owners.get(region) ?? 0) + 1)
  }
  return new Set(
    features
      .filter((feature) => feature.regionIdxs.some((region) => owners.get(region) === 1))
      .map((feature) => feature.tag.toLowerCase()),
  )
}

/** One rule and the features that break it. */
export interface RuleResult {
  rule: DfmRule
  /** The required features' tags, as the report spells them: the worst first, the furthest past the rule. */
  tags: string[]
  /**
   * The other readings that break it, worst first: features some other
   * reading could stand in for, so they are not counted or painted, but a
   * reader opening the rule should see everything it caught.
   */
  otherTags: string[]
}

/** The part checked against the rules. */
export interface DfmCheck {
  /** Lower-cased tag → the rules the feature breaks, in the rules' order. Every feature, required or not. */
  hitsByTag: ReadonlyMap<string, DfmHit[]>
  /** Lower-cased tags of the features a plan cannot do without. */
  required: ReadonlySet<string>
  /** Each rule in order, with the required features that break it. */
  byRule: RuleResult[]
  /**
   * Region → the colour a face is painted alone, and the reading it is painted for. See
   * {@link unavoidableFaces}, and {@link withSurroundedFaces} for the faces painted with their surroundings.
   */
  paintedFaces: ReadonlyMap<number, { tag: string; color: string }>
  /** Lower-cased tag → a contour surface painted whole in its own worst colour. See {@link unavoidableFaces}. */
  paintedWhole: ReadonlyMap<string, { tag: string; color: string }>
}

/** The words in a feature type that make it more than the plain feature it is built on. */
const QUALIFIERS = ['undercut', 'filleted', 'tslot', 'dovetail'] as const

/** Feature types that are an edge of something else rather than a shape of their own. */
const EDGE_TYPES = ['fillet', 'chamfer', 'sink'] as const

/**
 * How far a reading is from a plain feature: one for an edge feature (a lone
 * fillet or chamfer), and one for each qualifier its type carries. `pocket` 0,
 * `outer_fillet` and `filleted_pocket` 1, `undercut_filleted_tslot` 3. Where
 * several readings could paint one face, the plainest is the one shown.
 */
export const featureComplexity = (featureType: string): number => {
  const words = featureType.toLowerCase().split('_')
  const edge = EDGE_TYPES.some((type) => words.includes(type)) ? 1 : 0
  return edge + QUALIFIERS.filter((word) => words.includes(word)).length
}

/**
 * The faces that cannot be cut without breaking a rule: every feature that
 * could cut one breaks a rule. Those are the problems on the part; a face
 * some reading cuts clean is not, whichever feature it belongs to, so a
 * required feature is not painted whole, only its faces no other reading
 * reaches clean. A face only one feature owns has only that reading, so it is
 * painted if that feature breaks a rule.
 *
 * Each face is painted for the plainest reading of it
 * ({@link featureComplexity}): a pocket before a lone fillet, and either
 * before an undercut filleted T-slot, a reading of last resort. Of readings
 * as plain, the best case, the one whose worst rule is the least, since a
 * plan would take that one; then the one with the most surface. It is said
 * to be painted for that reading.
 *
 * A contour surface is no clean reading of a face that a milled feature also
 * reads: it is the face surfaced in 3D, which is no way round a rule the
 * milled feature breaks. Only where contour surfaces are a face's only
 * readings does a clean one leave it unpainted.
 *
 * Contour surfaces are also painted differently: the Engine splits one surface into
 * many readings and many faces, and painting them face by face makes a patchwork
 * of one surface. Where a contour surface is among a face's readings and
 * every reading, it included, breaks a rule, the
 * largest of them — the most continuous surface the Engine sees — is painted
 * whole instead, in its own worst rule's colour.
 */
/** Toolpath's freeform 3D surfacing reading. */
const CONTOUR = 'contour_surface'

const unavoidableFaces = (
  features: readonly DfmFeature[],
  hitsByTag: ReadonlyMap<string, DfmHit[]>,
  regionAreas: ReadonlyMap<number, number>,
): Pick<DfmCheck, 'paintedFaces' | 'paintedWhole'> => {
  const worstColor = (feature: DfmFeature): string | undefined =>
    hitsByTag
      .get(feature.tag.toLowerCase())
      ?.map((hit) => hit.rule.color)
      .sort(compareColors)[0]
  const areaOf = (feature: DfmFeature): number =>
    [...new Set(feature.regionIdxs)].reduce(
      (sum, region) => sum + (regionAreas.get(region) ?? 0),
      0,
    )
  const owners = new Map<number, DfmFeature[]>()
  for (const feature of features) {
    for (const region of new Set(feature.regionIdxs)) {
      owners.set(region, [...(owners.get(region) ?? []), feature])
    }
  }
  const faces = new Map<number, { tag: string; color: string }>()
  const whole = new Map<string, { tag: string; color: string }>()
  for (const [region, candidates] of owners) {
    const colored = candidates.map((feature) => ({
      feature,
      color: worstColor(feature),
      area: areaOf(feature),
    }))
    const isContour = ({ feature }: (typeof colored)[number]): boolean =>
      feature.featureType === CONTOUR
    // A contour reading is no way out for a face a milled feature also reads:
    // surfacing a wall to dodge a rule is no easier than the rule.
    const machined = colored.filter((each) => !isContour(each))
    const pool = machined.length > 0 ? machined : colored
    // Some reading cuts it clean: not painted.
    if (pool.some(({ color }) => color === undefined)) continue
    const contour = colored
      .filter(isContour)
      .reduce<
        (typeof colored)[number] | undefined
      >((kept, each) => (kept === undefined || each.area > kept.area ? each : kept), undefined)
    // Every reading breaks a rule, the contour's too: the surface is painted whole.
    if (contour?.color && colored.every(({ color }) => color !== undefined)) {
      whole.set(contour.feature.tag.toLowerCase(), {
        tag: contour.feature.tag,
        color: contour.color,
      })
      continue
    }
    const best = pool.reduce((kept, each) => {
      const plainer =
        featureComplexity(kept.feature.featureType) - featureComplexity(each.feature.featureType)
      if (plainer !== 0) return plainer > 0 ? each : kept
      const milder = compareColors(each.color ?? '', kept.color ?? '')
      return milder > 0 || (milder === 0 && each.area > kept.area) ? each : kept
    })
    if (best.color) faces.set(region, { tag: best.feature.tag, color: best.color })
  }
  return { paintedFaces: faces, paintedWhole: whole }
}

/**
 * The check with the faces its paint surrounds painted too. A face some
 * reading cuts clean is left unpainted, but where that face is one of the
 * feature that paints most of its painted neighbours, it is part of that
 * feature, cut with it: a through hole in a flagged pocket's wall, say, read
 * clean as a hole drilled from a floor far below that no plan would drill it
 * from. Leaving it bare punches a hole in the feature's paint, so it takes
 * the feature's colour. Where two features paint as many neighbours, the
 * face takes the worse colour of those it is one of.
 *
 * One pass, over the paint as the check left it, so paint never spreads
 * from a face that was itself only surrounded.
 */
export const withSurroundedFaces = (
  check: DfmCheck,
  features: readonly DfmFeature[],
  adjacency: ReadonlyMap<number, ReadonlySet<number>>,
): DfmCheck => {
  // What each painted face is painted for: alone, or as part of a surface painted whole.
  const paintedFor = new Map(check.paintedFaces)
  const regionsOf = new Map<string, ReadonlySet<number>>()
  for (const feature of features) {
    const key = feature.tag.toLowerCase()
    regionsOf.set(key, new Set(feature.regionIdxs))
    const whole = check.paintedWhole.get(key)
    if (whole)
      for (const region of feature.regionIdxs)
        if (!paintedFor.has(region)) paintedFor.set(region, whole)
  }
  const surrounded = new Map<number, { tag: string; color: string }>()
  for (const [region, neighbours] of adjacency) {
    if (paintedFor.has(region)) continue
    const counts = new Map<string, { paint: { tag: string; color: string }; count: number }>()
    for (const neighbour of neighbours) {
      const paint = neighbour === region ? undefined : paintedFor.get(neighbour)
      if (!paint) continue
      const key = paint.tag.toLowerCase()
      counts.set(key, { paint, count: (counts.get(key)?.count ?? 0) + 1 })
    }
    const most = Math.max(0, ...[...counts.values()].map(({ count }) => count))
    const [paint] = [...counts]
      .filter(([key, { count }]) => count === most && regionsOf.get(key)?.has(region))
      .map(([, { paint }]) => paint)
      .sort((a, b) => compareColors(a.color, b.color))
    if (paint) surrounded.set(region, paint)
  }
  if (surrounded.size === 0) return check
  return { ...check, paintedFaces: new Map([...check.paintedFaces, ...surrounded]) }
}

/**
 * Checks every feature against every rule. Only the required features count
 * against a rule: a feature some other reading could stand in for may never
 * be cut, so flagging it would bury the ones that will be.
 */
export const checkPart = (
  features: readonly DfmFeature[],
  sources: DfmSources,
  rules: readonly DfmRule[],
): DfmCheck => {
  const required = requiredTags(features)
  const hitsByTag = new Map(
    features.map((feature) => [
      feature.tag.toLowerCase(),
      featureHits(features, feature, sources, rules),
    ]),
  )
  const byRule = rules.map((rule) => {
    const hits = features.flatMap((feature) => {
      const tag = feature.tag.toLowerCase()
      const hit = hitsByTag.get(tag)?.find((each) => each.rule.id === rule.id)
      return hit
        ? [{ tag: feature.tag, value: hit.value, metric: hit.metric, required: required.has(tag) }]
        : []
    })
    const [first] = hits
    // A yes/no has no figure to rank by; the sort is stable, so those keep the report's order.
    const up = first ? worseUpward(rule, first.metric) : true
    hits.sort((a, b) => (up ? b.value - a.value : a.value - b.value))
    return {
      rule,
      tags: hits.filter((hit) => hit.required).map((hit) => hit.tag),
      otherTags: hits.filter((hit) => !hit.required).map((hit) => hit.tag),
    }
  })
  return {
    hitsByTag,
    required,
    byRule,
    ...unavoidableFaces(features, hitsByTag, sources.regionAreas),
  }
}
