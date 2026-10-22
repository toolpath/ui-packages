import { describe, expect, it } from 'vitest'
import {
  OP_TITLES,
  comparisonChoices,
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

  it('offers a range’s ends held either way, then the one-sided comparisons', () => {
    const low = labels(rangeLowChoices())
    const high = labels(rangeHighChoices())
    expect(low[0]).toEqual(['Range', ['≤', '<']])
    expect(high[0]).toEqual(['Range', ['<', '≤']])
    expect(low[1]?.[0]).toBe('One-sided')
    expect(high[1]?.[0]).toBe('One-sided')
  })
})
