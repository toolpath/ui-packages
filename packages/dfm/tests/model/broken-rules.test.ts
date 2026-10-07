import { describe, expect, it } from 'vitest'
import { brokenRules, featureColor, worstHits } from '../../src/model/broken-rules.js'
import { checkPart, type DfmCheck, type DfmHit } from '../../src/model/dfm-flags.js'
import { describeRule, RULE_COLORS, type DfmRule } from '../../src/model/dfm-rules.js'
import { metricInfo } from '../../src/model/dfm-metrics.js'
import { featureSheet } from '../../src/model/feature-sheet.js'
import type { DfmFeature } from '../../src/model/geometry.js'

const [RED = '', , YELLOW = ''] = RULE_COLORS.map((each) => each.value)

const rule = (over: Partial<DfmRule>): DfmRule => ({
  id: 'r',
  subject: 'any',
  metric: 'ld',
  op: 'gte',
  value: 5,
  color: YELLOW,
  ...over,
})

const hit = (over: Partial<DfmRule>, value = 9): DfmHit => {
  const metric = metricInfo(over.metric ?? 'ld')
  if (!metric) throw new Error('no such metric')
  return { rule: rule(over), metric, value }
}

const emptyCheck = (over: Partial<DfmCheck> = {}): DfmCheck => ({
  hitsByTag: new Map(),
  required: new Set(),
  byRule: [],
  paintedFaces: new Map(),
  paintedWhole: new Map(),
  ...over,
})

describe('worstHits', () => {
  it('keeps one hit a measure, the earliest in the palette, whatever the list order', () => {
    const hits = [
      hit({ id: 'ld8', color: YELLOW, value: 8 }),
      hit({ id: 'ld12', color: RED, value: 12 }),
      hit({ id: 'depth', metric: 'featureDepth', color: YELLOW }),
    ]
    expect(worstHits(hits).map((each) => each.rule.id)).toEqual(['ld12', 'depth'])
  })
})

describe('brokenRules', () => {
  const feature: DfmFeature = {
    tag: 'Hole1',
    featureType: 'blind_hole',
    machiningDirection: { x: 0, y: 0, z: 1 },
    regionIdxs: [0],
    number: 1,
  }
  const datasheet = {
    zMin: -40,
    zMax: 0,
    extendedZMax: 0,
    facts: { kind: 'Hole', diameter: 5, fullConeDeg: 118 },
  }
  const rules = [
    rule({ id: 'deep', subject: 'hole', metric: 'ld', value: 5 }),
    rule({ id: 'any', subject: 'hole', metric: 'present', color: RED }),
  ]
  const check = checkPart(
    [feature],
    {
      sheets: { hole1: featureSheet(datasheet) },
      datasheets: { hole1: datasheet },
      regionAreas: new Map(),
    },
    rules,
  )

  it('writes each rule as its sentence, with the figure that broke it', () => {
    const rows = brokenRules(check, 'HOLE1', 'mm')
    expect(rows).toEqual([
      { key: 'any', color: RED, text: describeRule(rules[1]!, 'mm') },
      { key: 'deep', color: YELLOW, text: describeRule(rules[0]!, 'mm'), figure: '8' },
    ])
  })

  it('writes the sentence in the units asked for', () => {
    const lengthRule = rule({
      id: 'deep',
      subject: 'hole',
      metric: 'featureDepth',
      op: 'gte',
      value: 25.4,
    })
    const inches = checkPart(
      [feature],
      {
        sheets: { hole1: featureSheet(datasheet) },
        datasheets: { hole1: datasheet },
        regionAreas: new Map(),
      },
      [lengthRule],
    )
    expect(brokenRules(inches, 'Hole1', 'inch')[0]?.text).toBe(describeRule(lengthRule, 'inch'))
  })

  it('has no rows for a feature that breaks nothing', () => {
    expect(brokenRules(check, 'other', 'mm')).toEqual([])
  })
})

describe('featureColor', () => {
  const hits = new Map([
    ['a', [hit({ color: YELLOW }), hit({ id: 'x', metric: 'featureDepth', color: RED })]],
  ])

  it('is the colour of a face painted alone for this feature, read from that face', () => {
    const check = emptyCheck({
      hitsByTag: hits,
      paintedFaces: new Map([[3, { tag: 'A', color: YELLOW }]]),
    })
    expect(featureColor(check, 'a', 3)).toBe(YELLOW)
  })

  it("is a whole-painted feature's colour", () => {
    const check = emptyCheck({ paintedWhole: new Map([['a', { tag: 'A', color: RED }]]) })
    expect(featureColor(check, 'A', 7)).toBe(RED)
  })

  it("is a required feature's worst colour, and nothing for one that is not required", () => {
    expect(featureColor(emptyCheck({ hitsByTag: hits, required: new Set(['a']) }), 'A')).toBe(RED)
    expect(featureColor(emptyCheck({ hitsByTag: hits }), 'A')).toBeUndefined()
  })
})
