import {
  FEATURE_METRICS,
  FEATURE_SUBJECTS,
  LD_METRIC,
  metricInfo,
  metricsForSubject,
  subjectInfo,
  type DfmMetric,
  type DfmOp,
  type DfmQuantity,
} from './dfm-metrics.js'
import { MM_PER_INCH } from '@toolpath/tool-support'
import { LENGTH_PLACES, type Units } from './units.js'

export { FEATURE_METRICS, FEATURE_SUBJECTS, metricInfo, metricsForSubject }
export type { DfmMetric, DfmOp, DfmQuantity }

/**
 * DFM rules: what a shop wants called out on a part before it quotes it — a
 * hole deeper than eight times its bore, a corner no cutter can make.
 *
 * Taken from the quoting app (quoting-ui `src/common/dfm-rules.ts`), so a
 * rule means the same thing in both, cut down to its feature rules: every
 * one is answered from the part's geometry, with no plan to wait for. What
 * a rule can test is `dfm-metrics.ts`: every figure the feature datasheet
 * reports, for the features that report it. One rule is one sentence,
 * *{subject} with {metric} {≥ | > | ≤ | < | = | ≠} {value}*, a range
 * *{subject} with {value} {≤ | <} {metric} {< | ≤} {max}* — or *{subject},
 * any size* — and wears a colour of its own, which is what the features that
 * break it are painted on the part. A range starts at ≤ and <, so *4 ≤ L/D
 * < 8* and *L/D ≥ 8* meet without overlapping.
 *
 * Where a feature breaks more than one rule, the colour earliest in
 * {@link RULE_COLORS} shows, so what the part looks like never hangs on the
 * rules' order.
 *
 * The quoting app's severity, note, materials and time adjustment are left
 * out: here the colour says how much a rule matters. Values are canonical —
 * millimetres and plain ratios — and shown in the reader's units.
 */

/** How near a measured figure must be to count as equal: half a percent of the rule's value. */
const EQUAL_TOLERANCE = 0.005

export const OPS: readonly DfmOp[] = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne', 'between']

const OP_SYMBOLS: Record<DfmOp, string> = {
  gte: '≥',
  gt: '>',
  lte: '≤',
  lt: '<',
  eq: '=',
  ne: '≠',
  between: 'range',
}

/** How a range holds its low end: at or above it, or above it. */
export type RangeLow = 'gte' | 'gt'
/** How a range holds its high end: below it, or at or below it. */
export type RangeHigh = 'lt' | 'lte'

export const RANGE_LOWS: readonly RangeLow[] = ['gte', 'gt']
export const RANGE_HIGHS: readonly RangeHigh[] = ['lt', 'lte']

export const opSymbol = (op: DfmOp): string => OP_SYMBOLS[op]

export interface DfmRule {
  /** Stable, so a list can key its rows and a feature can name the rule it broke. */
  id: string
  /** Which features: a value from {@link FEATURE_SUBJECTS}. */
  subject: string
  /** What is measured: a key from {@link FEATURE_METRICS}. */
  metric: string
  op: DfmOp
  /** Canonical — mm or a ratio. Ignored by a yes/no metric. The low end of a range. */
  value: number
  /** A range's high end. Only a `between` rule has one. */
  max?: number
  /** How a range holds its low end; ≥ where unsaid. Only a `between` rule has one. */
  lowOp?: RangeLow
  /** How a range holds its high end; < where unsaid. Only a `between` rule has one. */
  highOp?: RangeHigh
  /** `#rrggbb`: what the features that break it are painted. */
  color: string
}

/**
 * The colours a rule can wear: vivid, and far enough apart in hue and
 * lightness to tell apart on the part at a glance (no two closer than ΔE 37,
 * and none within 50 of the selection's blue). Warm first, since most
 * rules call out trouble; then cool ones for a rule that marks something
 * good.
 */
export const RULE_COLORS: readonly { name: string; value: string }[] = [
  { name: 'Red', value: '#e5484d' },
  { name: 'Orange', value: '#f76b15' },
  { name: 'Yellow', value: '#ffd60a' },
  { name: 'Purple', value: '#8e4ec6' },
  { name: 'Green', value: '#30a46c' },
  { name: 'Cyan', value: '#00a2c7' },
]

/**
 * Which colour shows where a feature breaks rules of two: the one earliest in
 * the palette, so red over yellow. Colours from outside it come after, in an
 * order of their own, so a tie never falls back on the list.
 */
export const compareColors = (a: string, b: string): number => {
  const rank = (color: string): number => {
    const at = RULE_COLORS.findIndex((each) => each.value === color)
    return at === -1 ? RULE_COLORS.length : at
  }
  return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0)
}

/** The quoting app's two severities, as the colours a rule starts in. */
export const CRITICAL_COLOR = '#e5484d'
export const WARNING_COLOR = '#ffd60a'

/** Colours of earlier palettes, as this one says them, so rules saved before it move over. */
const RETIRED_COLORS: Record<string, string> = {
  // Taken out of this palette.
  '#e93d82': CRITICAL_COLOR,
  '#99d52a': '#30a46c',
  // The first palette.
  '#dc2626': CRITICAL_COLOR,
  '#f97316': '#f76b15',
  '#eab308': WARNING_COLOR,
  '#16a34a': '#30a46c',
  '#0d9488': '#00a2c7',
  '#2563eb': '#00a2c7',
  '#9333ea': '#8e4ec6',
  '#db2777': CRITICAL_COLOR,
  // The Toolpath tokens.
  '#ba5b4b': CRITICAL_COLOR,
  '#843e32': CRITICAL_COLOR,
  '#e07a48': '#f76b15',
  '#d6632a': '#f76b15',
  '#cd8e04': WARNING_COLOR,
  '#ffe066': WARNING_COLOR,
  '#68b688': '#30a46c',
  '#6bb0b3': '#00a2c7',
}

export const subjectLabel = (value: string): string => subjectInfo(value)?.label ?? value

/* ---------- Typing and reading values ---------- */

/** A number to at most `places` decimals, trailing zeros dropped. */
const trim = (value: number, places: number): string => String(Number(value.toFixed(places)))

const SQUARE_MM_PER_SQUARE_INCH = MM_PER_INCH ** 2

/** The unit a value is typed in, beside its field. */
export const quantityUnit = (quantity: DfmQuantity, units: Units): string => {
  switch (quantity) {
    case 'length':
      return units === 'inch' ? 'in' : 'mm'
    case 'area':
      return units === 'inch' ? 'in²' : 'mm²'
    case 'angle':
      return '°'
    case 'percent':
      return '%'
    default:
      return ''
  }
}

/** A unit after a number: `12 mm`, but `45°` and `75%`. */
const withUnit = (value: string, unit: string): string =>
  unit === '' ? value : unit === '°' || unit === '%' ? `${value}${unit}` : `${value} ${unit}`

/** A canonical value in the reader's units. */
const toUnits = (quantity: DfmQuantity, value: number, units: Units): number =>
  units !== 'inch'
    ? value
    : quantity === 'length'
      ? value / MM_PER_INCH
      : quantity === 'area'
        ? value / SQUARE_MM_PER_SQUARE_INCH
        : value

/** A canonical value as its field shows it. */
export const toField = (quantity: DfmQuantity, value: number, units: Units): string => {
  const shown = toUnits(quantity, value, units)
  return quantity === 'length'
    ? trim(shown, LENGTH_PLACES[units])
    : quantity === 'count'
      ? trim(shown, 0)
      : trim(shown, 3)
}

/**
 * What a field says, back to canonical — or null when it is not a number,
 * is below zero where the measure cannot be, or is a fraction of a count.
 */
export const fromField = (metric: DfmMetric, text: string, units: Units): number | null => {
  const parsed = Number(text.trim())
  if (text.trim() === '' || !Number.isFinite(parsed) || (parsed < 0 && !metric.signed)) return null
  if (metric.quantity === 'count' && !Number.isInteger(parsed)) return null
  if (units !== 'inch') return parsed
  return metric.quantity === 'length'
    ? parsed * MM_PER_INCH
    : metric.quantity === 'area'
      ? parsed * SQUARE_MM_PER_SQUARE_INCH
      : parsed
}

/** A measured value, as a row says it: `7.5`, `1.25"`, `3.2 mm`, `1,200 mm²`. */
export const formatMeasured = (quantity: DfmQuantity, value: number, units: Units): string => {
  const shown = toUnits(quantity, value, units)
  switch (quantity) {
    case 'length':
      return units === 'inch'
        ? `${trim(shown, LENGTH_PLACES.inch)}"`
        : `${trim(shown, LENGTH_PLACES.mm)} mm`
    case 'area':
      return `${Number(shown.toFixed(3)).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${quantityUnit('area', units)}`
    case 'angle':
      return `${trim(shown, 3)}°`
    case 'percent':
      return `${trim(shown, 3)}%`
    case 'count':
      return trim(shown, 0)
    case 'flag':
    case 'presence':
      return ''
    default:
      return trim(shown, 3)
  }
}

/**
 * A rule as one plain line: "Holes with L/D ≥ 8", "Holes with 4 ≤ L/D < 8",
 * "Any feature with a sharp inside corner", "Undercut T-slots, any size".
 */
export const describeRule = (rule: DfmRule, units: Units): string => {
  const info = metricInfo(rule.metric)
  const subject = subjectLabel(rule.subject)
  if (!info) return subject
  if (info.quantity === 'presence') return `${subject}, ${info.label}`
  if (info.quantity === 'flag') return `${subject} with ${info.label}`
  const unit = quantityUnit(info.quantity, units)
  const shown = (value: number): string => withUnit(toField(info.quantity, value, units), unit)
  return rule.op === 'between'
    ? `${subject} with ${shown(rule.value)} ${lowOf(rule) === 'gt' ? '<' : '≤'} ${info.label} ${opSymbol(highOf(rule))} ${shown(upperOf(rule))}`
    : `${subject} with ${info.label} ${opSymbol(rule.op)} ${shown(rule.value)}`
}

/* ---------- Making rules ---------- */

/** A fresh id for a rule: unique enough within the list. */
export const newRuleId = (): string => Math.random().toString(36).slice(2, 10)

/** A new rule for a subject and metric, at the metric's own starting value in the reader's units. */
export const makeRule = (
  subject: string,
  metricKey: string,
  units: Units,
  color = WARNING_COLOR,
): DfmRule => {
  const info = metricInfo(metricKey) ?? LD_METRIC
  return {
    id: newRuleId(),
    subject,
    metric: info.key,
    op: info.op,
    value: info.start[units],
    color,
  }
}

/** A range's high end: its own, or as far again above its low one (at least 1) where it has none yet. */
export const upperOf = (rule: DfmRule): number =>
  rule.max ?? rule.value + Math.max(Math.abs(rule.value), 1)

/** How a range holds its low end. */
export const lowOf = (rule: DfmRule): RangeLow => rule.lowOp ?? 'gte'
/** How a range holds its high end. */
export const highOf = (rule: DfmRule): RangeHigh => rule.highOp ?? 'lt'

/** A rule without a range's high end and the ways it holds its ends. */
const withoutRange = ({ max: _max, lowOp: _low, highOp: _high, ...rest }: DfmRule): DfmRule => rest

/** A rule with its metric moved: the metric's own way and starting value, since the old ones meant something else. */
export const withMetric = (rule: DfmRule, metricKey: string, units: Units): DfmRule => {
  const info = metricInfo(metricKey)
  if (!info) return rule
  return { ...withoutRange(rule), metric: info.key, op: info.op, value: info.start[units] }
}

/** A rule with its comparison changed: a range gets a high end, and anything else loses it. */
export const withOp = (rule: DfmRule, op: DfmOp): DfmRule =>
  op === 'between'
    ? { ...rule, op, max: upperOf(rule), lowOp: lowOf(rule), highOp: highOf(rule) }
    : { ...withoutRange(rule), op }

/** A rule with its subject moved, and its metric too when the new subject has no such measure. */
export const withSubject = (rule: DfmRule, subject: string, units: Units): DfmRule => {
  const metrics = metricsForSubject(subject)
  const moved = { ...rule, subject }
  return metrics.some((each) => each.key === rule.metric)
    ? moved
    : withMetric(moved, (metrics[0] ?? LD_METRIC).key, units)
}

/* ---------- Checking ---------- */

/** Whether a measured value breaks a rule. */
export const breaks = (rule: DfmRule, quantity: DfmQuantity, value: number): boolean => {
  if (quantity === 'presence') return true
  if (quantity === 'flag') return value > 0
  if (rule.op === 'gte') return value >= rule.value
  if (rule.op === 'gt') return value > rule.value
  if (rule.op === 'lte') return value <= rule.value
  if (rule.op === 'lt') return value < rule.value
  if (rule.op === 'between') {
    const high = upperOf(rule)
    const aboveLow = lowOf(rule) === 'gt' ? value > rule.value : value >= rule.value
    const belowHigh = highOf(rule) === 'lte' ? value <= high : value < high
    return aboveLow && belowHigh
  }
  // Measured figures carry noise: equal is within half a percent (or a hair, at zero), and not equal is outside it.
  const equal =
    Math.abs(value - rule.value) <= Math.max(Math.abs(rule.value) * EQUAL_TOLERANCE, 1e-6)
  return rule.op === 'ne' ? !equal : equal
}

/**
 * Which way a measured figure is worse against a rule: up for ≥ and >, down
 * for ≤ and <, and for a range or an equality the measure's own way — L/D up,
 * a tool's width down.
 */
export const worseUpward = (rule: DfmRule, metric: DfmMetric): boolean =>
  rule.op === 'gte' || rule.op === 'gt'
    ? true
    : rule.op === 'lte' || rule.op === 'lt'
      ? false
      : metric.op !== 'lte' && metric.op !== 'lt'

/* ---------- Reading stored rules ---------- */

const COLOR = /^#[0-9a-f]{6}$/i

/** A value a metric can take: not below zero unless it is signed, and whole if it is a count. */
const isValue = (value: unknown, metric: DfmMetric | undefined): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  (value >= 0 || metric?.signed === true) &&
  (metric?.quantity !== 'count' || Number.isInteger(value))

/** One stored rule, checked: a known subject and metric, values it can take, a colour. Null if not. */
const parseRule = (raw: unknown): DfmRule | null => {
  if (!raw || typeof raw !== 'object') return null
  const {
    id,
    subject,
    metric: key,
    op,
    value,
    max,
    lowOp,
    highOp,
    color,
  } = raw as Record<string, unknown>
  const info = typeof key === 'string' ? metricInfo(key) : undefined
  const valid =
    typeof id === 'string' &&
    typeof subject === 'string' &&
    subjectInfo(subject) !== undefined &&
    typeof key === 'string' &&
    info !== undefined &&
    OPS.includes(op as DfmOp) &&
    isValue(value, info) &&
    (op !== 'between' || isValue(max, info)) &&
    typeof color === 'string' &&
    COLOR.test(color)
  if (!valid) return null
  const hex = color.toLowerCase()
  return {
    id,
    subject,
    metric: key,
    op: op as DfmOp,
    value,
    ...(op === 'between'
      ? {
          max: max as number,
          ...(RANGE_LOWS.includes(lowOp as RangeLow) ? { lowOp: lowOp as RangeLow } : {}),
          ...(RANGE_HIGHS.includes(highOp as RangeHigh) ? { highOp: highOp as RangeHigh } : {}),
        }
      : {}),
    color: RETIRED_COLORS[hex] ?? hex,
  }
}

/** Stored rules, the ones that read; null when what is stored is not a list at all. */
export const parseRules = (raw: unknown): DfmRule[] | null =>
  Array.isArray(raw) ? raw.flatMap((each) => parseRule(each) ?? []) : null
