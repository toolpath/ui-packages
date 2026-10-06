import { describe, expect, it } from 'vitest'
import {
  CRITICAL_COLOR,
  RULE_COLORS,
  WARNING_COLOR,
  breaks,
  compareColors,
  describeRule,
  formatMeasured,
  fromField,
  makeRule,
  metricInfo,
  parseRules,
  toField,
  upperOf,
  withMetric,
  withOp,
  withSubject,
  type DfmRule,
} from '../../src/model/dfm-rules.js'

const rule = (over: Partial<DfmRule> = {}): DfmRule => ({
  id: 'r1',
  subject: 'hole',
  metric: 'ld',
  op: 'gte',
  value: 8,
  color: WARNING_COLOR,
  ...over,
})

describe('breaks: one measured figure against a rule', () => {
  it('reads ≥ > ≤ < at the boundary', () => {
    expect(breaks(rule({ op: 'gte', value: 8 }), 'ratio', 8)).toBe(true)
    expect(breaks(rule({ op: 'gt', value: 8 }), 'ratio', 8)).toBe(false)
    expect(breaks(rule({ op: 'lte', value: 8 }), 'ratio', 8)).toBe(true)
    expect(breaks(rule({ op: 'lt', value: 8 }), 'ratio', 8)).toBe(false)
  })

  it('counts equal as within half a percent, and not equal as outside it', () => {
    expect(breaks(rule({ op: 'eq', value: 100 }), 'length', 100.4)).toBe(true)
    expect(breaks(rule({ op: 'eq', value: 100 }), 'length', 100.6)).toBe(false)
    expect(breaks(rule({ op: 'ne', value: 100 }), 'length', 100.6)).toBe(true)
    // At zero the band is a hair, not nothing.
    expect(breaks(rule({ op: 'eq', value: 0 }), 'length', 1e-7)).toBe(true)
  })

  it('holds a range at ≤ and < by default, and moves either end', () => {
    const band = rule({ op: 'between', value: 4, max: 8 })
    expect(breaks(band, 'ratio', 4)).toBe(true)
    expect(breaks(band, 'ratio', 8)).toBe(false)
    expect(breaks({ ...band, lowOp: 'gt' }, 'ratio', 4)).toBe(false)
    expect(breaks({ ...band, highOp: 'lte' }, 'ratio', 8)).toBe(true)
  })

  it('fires a yes/no only on yes, and a presence rule always', () => {
    expect(breaks(rule({ metric: 'sharpCorner' }), 'flag', 0)).toBe(false)
    expect(breaks(rule({ metric: 'sharpCorner' }), 'flag', 1)).toBe(true)
    expect(breaks(rule({ metric: 'present' }), 'presence', 0)).toBe(true)
  })
})

describe('editing a rule word by word', () => {
  it('gives a range a high end as far again above its low one, at least 1', () => {
    expect(upperOf(rule({ value: 4 }))).toBe(8)
    expect(upperOf(rule({ value: 0.2 }))).toBe(1.2)
    expect(upperOf(rule({ value: 4, max: 6 }))).toBe(6)
  })

  it('gains the range fields on between and loses them on a one-sided op', () => {
    const ranged = withOp(rule(), 'between')
    expect(ranged).toMatchObject({ op: 'between', max: 16, lowOp: 'gte', highOp: 'lt' })
    const back = withOp(ranged, 'lte')
    expect(back.op).toBe('lte')
    expect('max' in back || 'lowOp' in back || 'highOp' in back).toBe(false)
  })

  it('resets op and value to the new metric’s own, dropping any range', () => {
    const moved = withMetric(rule({ op: 'between', max: 10 }), 'maxTool', 'mm')
    expect(moved).toMatchObject({ metric: 'maxTool', op: 'lte', value: 3 })
    expect('max' in moved).toBe(false)
    expect(withMetric(rule(), 'no-such-metric', 'mm')).toEqual(rule())
  })

  it('keeps the metric on a new subject that reports it, else takes the subject’s first', () => {
    expect(withSubject(rule({ metric: 'ld' }), 'pocket', 'mm').metric).toBe('ld')
    // A hole-only measure on a subject whose kinds never report it.
    const moved = withSubject(rule({ metric: 'diameter', op: 'lte', value: 1.5 }), 'pocket', 'mm')
    expect(moved.subject).toBe('pocket')
    expect(moved.metric).not.toBe('diameter')
  })

  it('starts a new rule at the metric’s round number in each unit', () => {
    expect(makeRule('any', 'depthBelowTop', 'mm').value).toBe(50)
    expect(makeRule('any', 'depthBelowTop', 'inch').value).toBe(50.8)
    expect(makeRule('any', 'no-such-metric', 'mm').metric).toBe('ld')
  })
})

describe('typing and reading values', () => {
  it('converts inches to canonical millimetres, and areas by the square', () => {
    expect(fromField(metricInfo('depthBelowTop')!, '2', 'inch')).toBeCloseTo(50.8)
    expect(fromField(metricInfo('surfaceArea')!, '1', 'inch')).toBeCloseTo(645.16)
    expect(fromField(metricInfo('ld')!, '8', 'inch')).toBe(8)
  })

  it('refuses nonsense and negatives, except on a signed metric', () => {
    expect(fromField(metricInfo('ld')!, 'abc', 'mm')).toBeNull()
    expect(fromField(metricInfo('ld')!, '', 'mm')).toBeNull()
    expect(fromField(metricInfo('ld')!, '-1', 'mm')).toBeNull()
    expect(fromField(metricInfo('zMin')!, '-12.5', 'mm')).toBe(-12.5)
  })

  it('takes a count in whole numbers only', () => {
    expect(fromField(metricInfo('faceCount')!, '2.5', 'mm')).toBeNull()
    expect(fromField(metricInfo('faceCount')!, '3', 'inch')).toBe(3)
  })

  it('shows canonical values in the reader’s units, trimmed', () => {
    expect(toField('length', 50.8, 'inch')).toBe('2')
    expect(toField('length', 25.4, 'mm')).toBe('25.4')
    expect(toField('count', 3.0, 'mm')).toBe('3')
  })

  it('writes a length to the same places in a field and in a measured figure', () => {
    // 0.0125" is the rule; 0.0124" is the part. Three places would show both as 0.012".
    expect(toField('length', 0.3175, 'inch')).toBe('0.0125')
    expect(formatMeasured('length', 0.31496, 'inch')).toBe('0.0124"')
    expect(formatMeasured('length', 0.31496, 'mm')).toBe('0.315 mm')
  })

  it('writes a rule as one sentence', () => {
    expect(describeRule(rule(), 'mm')).toBe('Holes with L/D to top of part ≥ 8')
    expect(describeRule(rule({ op: 'between', value: 4, max: 8, subject: 'milled' }), 'mm')).toBe(
      'Milled features with 4 ≤ L/D to top of part < 8',
    )
    expect(describeRule(rule({ metric: 'present', subject: 'undercut' }), 'mm')).toBe(
      'Undercuts, any size',
    )
    expect(describeRule(rule({ metric: 'sharpCorner', subject: 'milled' }), 'mm')).toBe(
      'Milled features with a sharp inside corner',
    )
    expect(describeRule(rule({ metric: 'depthBelowTop', value: 50.8 }), 'inch')).toBe(
      'Holes with depth below top ≥ 2 in',
    )
  })
})

describe('reading stored rules', () => {
  it('keeps good rules and drops the rest, one by one', () => {
    const stored = [
      rule(),
      { ...rule({ id: 'bad-subject' }), subject: 'spaceship' },
      { ...rule({ id: 'bad-metric' }), metric: 'warp' },
      { ...rule({ id: 'bad-op' }), op: 'around' },
      { ...rule({ id: 'bad-value' }), value: -1 },
      { ...rule({ id: 'half-count', metric: 'faceCount' }), value: 2.5 },
      { ...rule({ id: 'half-max', metric: 'faceCount', op: 'between', value: 2 }), max: 4.5 },
      { ...rule({ id: 'bad-colour' }), color: 'red' },
      { ...rule({ id: 'no-max', op: 'between' }) },
      'not even an object',
    ]
    expect(parseRules(stored)?.map((each) => each.id)).toEqual(['r1'])
  })

  it('keeps a count rule whose values are whole', () => {
    const kept = parseRules([rule({ metric: 'faceCount', op: 'between', value: 2, max: 4 })])
    expect(kept).toHaveLength(1)
  })

  it('answers null, not an empty list, when the store is not a list', () => {
    expect(parseRules({ rules: [] })).toBeNull()
    expect(parseRules(undefined)).toBeNull()
    expect(parseRules([])).toEqual([])
  })

  it('moves retired colours onto the current palette and lower-cases hex', () => {
    expect(parseRules([rule({ color: '#dc2626' })])?.[0]?.color).toBe(CRITICAL_COLOR)
    expect(parseRules([rule({ color: '#FFD60A' })])?.[0]?.color).toBe(WARNING_COLOR)
  })

  it('keeps a range’s ends only when they are valid', () => {
    const kept = parseRules([
      rule({ op: 'between', value: 4, max: 8, lowOp: 'gt', highOp: 'lte' }),
    ])?.[0]
    expect(kept).toMatchObject({ max: 8, lowOp: 'gt', highOp: 'lte' })
    const loose = parseRules([
      { ...rule({ op: 'between', value: 4, max: 8 }), lowOp: 'sideways' },
    ])?.[0]
    expect(loose !== undefined && 'lowOp' in loose).toBe(false)
  })
})

describe('colour precedence', () => {
  it('ranks the palette in order, then anything else after it', () => {
    const [red = '', orange = '', yellow = ''] = RULE_COLORS.map((each) => each.value)
    expect(compareColors(red, yellow)).toBeLessThan(0)
    expect(compareColors(yellow, orange)).toBeGreaterThan(0)
    expect(compareColors('#123456', yellow)).toBeGreaterThan(0)
    expect(compareColors('#123456', '#abcdef')).toBeLessThan(0)
    expect(compareColors(red, red)).toBe(0)
  })
})
