import { describe, expect, it } from 'vitest'
import { makeRule, withOp, type DfmRule } from '../../src/model/dfm-rules.js'
import {
  LOW_SYMBOLS,
  ONE_SIDED_CHOICES,
  OP_TITLES,
  comparisonChoices,
  rangeEnd,
  rangeHighChoices,
  rangeLowChoices,
} from '../../src/model/ops.js'

const labels = (choices: ReturnType<typeof comparisonChoices>) =>
  choices.groups.map((group) => [group.heading, group.choices.map((choice) => choice.label)])

describe('the comparison pickers', () => {
  it('offers every comparison by its symbol', () => {
    expect(labels(comparisonChoices())).toEqual([
      [undefined, ['≥', '>', '≤', '<', '=', '≠', 'range']],
    ])
  })

  it('words each choice as the caller asks', () => {
    const titled = comparisonChoices((symbol, op) => `${symbol} ${OP_TITLES[op]}`)
    expect(titled.groups[0]?.choices[0]).toEqual({ value: 'gte', label: '≥ at least' })
  })

  it('words a range’s ends the same way their symbols read', () => {
    const wordy = (symbol: string, _op: string, title: string) => `${symbol} ${title}`
    expect(labels(rangeLowChoices(wordy))[0]).toEqual(['Range', ['≤ at most', '< less than']])
    expect(labels(rangeHighChoices(wordy))[0]).toEqual(['Range', ['< less than', '≤ at most']])
  })

  it('offers a range’s ends held either way, then the one-sided comparisons', () => {
    const low = labels(rangeLowChoices())
    const high = labels(rangeHighChoices())
    expect(low[0]).toEqual(['Range', ['≤', '<']])
    expect(high[0]).toEqual(['Range', ['<', '≤']])
    expect(low[1]?.[0]).toBe('One-sided')
    expect(high[1]?.[0]).toBe('One-sided')
  })
})

describe('leaving a range or holding its end', () => {
  const range: DfmRule = withOp(makeRule('any', 'ld', 'mm'), 'between')

  it('offers every one-sided comparison, marked apart from a range’s ends', () => {
    const values = ONE_SIDED_CHOICES.choices.map((choice) => choice.value)
    expect(values).toHaveLength(6)
    expect(values.every((value) => value.startsWith('one:'))).toBe(true)
    expect(values).not.toContain('one:between')
  })

  it('leaves the range for a one-sided comparison', () => {
    const left = rangeEnd(range, 'one:lte', () => ({}))
    expect(left.op).toBe('lte')
  })

  it('holds an end the new way, and stays a range', () => {
    const held = rangeEnd(range, 'gt', (op) => ({ lowOp: op as 'gt' }))
    expect(held.op).toBe('between')
    expect(held.lowOp).toBe('gt')
  })

  it('reads a low end from the number toward the measure', () => {
    expect(LOW_SYMBOLS).toEqual({ gte: '≤', gt: '<' })
  })
})
