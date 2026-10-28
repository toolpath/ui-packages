import { describe, expect, it } from 'vitest'
import {
  bodiesByRule,
  combineBodyChecks,
  CRITICAL_COLOR,
  featureSeverities,
  featuresByType,
  metricInfo,
  ruleSeverity,
  WARNING_COLOR,
  type BodyDfmCheck,
  type DfmCheck,
  type DfmFeature,
  type DfmHit,
  type DfmRule,
} from '../../src/index.js'

const rule: DfmRule = {
  id: 'rule',
  subject: 'holes',
  metric: 'diameter',
  op: 'lt',
  value: 5,
  color: '#ff0000',
}
const other: DfmRule = { ...rule, id: 'other', color: WARNING_COLOR }

const feature = (tag: string, featureType = 'through_hole'): DfmFeature => ({
  tag,
  number: 1,
  featureType,
  machiningDirection: { x: 0, y: 0, z: 1 },
  regionIdxs: [0],
})
const hitOf = (of: DfmRule, value = 1): DfmHit => {
  const metric = metricInfo(of.metric)
  if (!metric) {
    throw new Error('no such metric')
  }
  return { rule: of, metric, value }
}
const checkOf = (
  byRule: DfmCheck['byRule'],
  hitsByTag: DfmCheck['hitsByTag'] = new Map(),
  required: ReadonlySet<string> = new Set(byRule.flatMap((result) => result.tags)),
): DfmCheck => ({
  byRule,
  hitsByTag,
  required,
  paintedFaces: new Map(),
  paintedWhole: new Map(),
})
const body = (id: string): BodyDfmCheck => ({
  id,
  label: `Body ${id}`,
  status: 'ready',
  features: [feature('same-tag')],
  check: checkOf([{ rule, tags: ['same-tag'], otherTags: ['alternative'] }]),
})

describe('body DFM aggregation', () => {
  it('counts duplicate local tags separately without counting alternative readings', () => {
    const summary = combineBodyChecks([body('a'), body('b')], [rule])
    expect(summary.violations.map((row) => [row.bodyId, row.feature.tag])).toEqual([
      ['a', 'same-tag'],
      ['b', 'same-tag'],
    ])
    expect(new Set(summary.violations.map((row) => row.id)).size).toBe(2)
    expect(summary.byRule[0]!.count).toBe(2)
  })
  it('distinguishes incomplete and failed checks from passing bodies', () => {
    const summary = combineBodyChecks(
      [body('a'), { ...body('b'), status: 'pending' }, { ...body('c'), status: 'error' }],
      [rule],
    )
    expect([summary.completed, summary.total, summary.failed]).toEqual([1, 3, 1])
    expect(summary.features).toHaveLength(1)
    expect(() => combineBodyChecks([body('a'), body('a')], [rule])).toThrow(/unique/)
  })
  it('attaches the hit that broke the rule, found by lower-cased tag', () => {
    const hit = hitOf(rule, 3)
    const check = checkOf(
      [{ rule, tags: ['Mixed-Tag'], otherTags: [] }],
      new Map([['mixed-tag', [hitOf(other), hit]]]),
    )
    const summary = combineBodyChecks(
      [{ ...body('a'), features: [feature('mixed-tag')], check }],
      [rule],
    )
    expect(summary.violations).toHaveLength(1)
    expect(summary.violations[0]!.hit).toBe(hit)
    expect(summary.violations[0]!.hit!.rule.id).toBe(rule.id)
  })
  it('has no hit where the check has none for the tag', () => {
    expect(combineBodyChecks([body('a')], [rule]).violations[0]!.hit).toBeNull()
  })
  it('makes one violation for each rule a feature breaks', () => {
    const check = checkOf([
      { rule, tags: ['t'], otherTags: [] },
      { rule: other, tags: ['t'], otherTags: [] },
    ])
    const summary = combineBodyChecks(
      [{ ...body('a'), features: [feature('t')], check }],
      [rule, other],
    )
    expect(summary.violations.map((row) => row.rule.id)).toEqual(['rule', 'other'])
    expect(new Set(summary.violations.map((row) => row.id)).size).toBe(2)
    expect(summary.byRule.map((row) => row.count)).toEqual([1, 1])
  })
  it('skips a tag no feature of the body has', () => {
    const check = checkOf([{ rule, tags: ['missing'], otherTags: [] }])
    const summary = combineBodyChecks([{ ...body('a'), check }], [rule])
    expect(summary.violations).toEqual([])
    expect(summary.byRule[0]!.count).toBe(0)
  })
  it('skips a result for a rule that is not in the rules, and uses the rules passed in', () => {
    const check = checkOf([
      { rule: other, tags: ['same-tag'], otherTags: [] },
      { rule: { ...rule }, tags: ['same-tag'], otherTags: [] },
    ])
    const current = { ...rule, value: 9 }
    const summary = combineBodyChecks([{ ...body('a'), check }], [current])
    expect(summary.violations).toHaveLength(1)
    expect(summary.violations[0]!.rule).toBe(current)
    expect(summary.byRule).toEqual([{ rule: current, count: 1 }])
  })
})

describe('rule and feature severity', () => {
  it('is critical for the critical colour in any case, and a warning otherwise', () => {
    expect(ruleSeverity({ ...rule, color: CRITICAL_COLOR })).toBe('critical')
    expect(ruleSeverity({ ...rule, color: CRITICAL_COLOR.toUpperCase() })).toBe('critical')
    expect(ruleSeverity({ ...rule, color: WARNING_COLOR })).toBe('warning')
  })
  it('takes the worst rule a feature breaks, whatever the order', () => {
    const critical = { ...rule, id: 'critical', color: CRITICAL_COLOR }
    const check = checkOf(
      [],
      new Map([
        ['a', [hitOf(other), hitOf(critical)]],
        ['b', [hitOf(critical), hitOf(other)]],
        ['c', [hitOf(other)]],
        ['d', []],
        ['e', [hitOf(critical)]],
      ]),
      new Set(['a', 'b', 'c', 'd']),
    )
    expect([...featureSeverities(check)]).toEqual([
      ['a', 'critical'],
      ['b', 'critical'],
      ['c', 'warning'],
    ])
  })
})

describe('featuresByType', () => {
  it('groups by feature type in the order the types first appear', () => {
    const groups = featuresByType([
      feature('a', 'pocket'),
      feature('b', 'through_hole'),
      feature('c', 'pocket'),
    ])
    expect(groups.map((group) => [group.featureType, group.features.map((f) => f.tag)])).toEqual([
      ['pocket', ['a', 'c']],
      ['through_hole', ['b']],
    ])
    expect(featuresByType([])).toEqual([])
  })
})

describe('bodiesByRule', () => {
  it("lists each rule's bodies in the summary order with their violations", () => {
    const two = checkOf([
      { rule, tags: ['t1', 't2'], otherTags: [] },
      { rule: other, tags: ['t1'], otherTags: [] },
    ])
    const summary = combineBodyChecks(
      [
        { ...body('a'), features: [feature('t1'), feature('t2')], check: two },
        { ...body('b'), features: [], check: null },
        { ...body('c') },
      ],
      [rule, other],
    )
    const byRule = bodiesByRule(summary)
    expect(byRule.get('rule')!.map((entry) => [entry.body.id, entry.violations.length])).toEqual([
      ['a', 2],
      ['c', 1],
    ])
    expect(byRule.get('other')!.map((entry) => entry.body.id)).toEqual(['a'])
    expect(
      byRule.get('other')!.every((entry) => entry.violations.every((v) => v.rule === other)),
    ).toBe(true)
    expect(bodiesByRule(combineBodyChecks([], [rule])).size).toBe(0)
  })
})
