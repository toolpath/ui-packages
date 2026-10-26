import { describe, expect, it } from 'vitest'
import { combineBodyChecks, type BodyDfmCheck, type DfmRule } from '../src/index.js'
const rule: DfmRule = {
  id: 'rule',
  subject: 'holes',
  metric: 'diameter',
  op: 'lt',
  value: 5,
  color: '#ff0000',
}
const body = (id: string): BodyDfmCheck => ({
  id,
  label: `Body ${id}`,
  status: 'ready',
  features: [
    {
      tag: 'same-tag',
      number: 1,
      featureType: 'through_hole',
      machiningDirection: { x: 0, y: 0, z: 1 },
      regionIdxs: [0],
    },
  ],
  check: {
    byRule: [{ rule, tags: ['same-tag'], otherTags: ['alternative'] }],
    hitsByTag: new Map(),
    required: new Set(['same-tag']),
    paintedFaces: new Map(),
    paintedWhole: new Map(),
  },
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
})
