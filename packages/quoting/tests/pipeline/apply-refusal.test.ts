import { describe, expect, it } from 'vitest'
import { applyRefusal, type ApplyFacts } from '../../src/pipeline'

const up = { x: 0, y: 0, z: 1 }
const box = {
  mode: 'fixedBox',
  dimensions: { x: 100, y: 60, z: 30 },
  position: 'modelCentered',
} as const
const facts = (over: Partial<ApplyFacts> = {}): ApplyFacts => ({
  open: true,
  stage: 'setup',
  savedVersion: 3,
  version: 3,
  stock: null,
  first: null,
  ...over,
})

describe('Apply', () => {
  it('saves the plan in Plan Part, from the version saved last', () => {
    expect(applyRefusal(facts())).toBeNull()
    expect(applyRefusal(facts({ stock: box, first: up }))).toBeNull()
  })

  it('refuses a closed revision first: it keeps the plan it was quoted with', () => {
    expect(applyRefusal(facts({ open: false, stage: 'quote', version: 1 }))).toBe('locked')
  })

  it('refuses a part past Plan Part: it is moved back to change it', () => {
    for (const stage of ['review', 'estimate', 'quote'] as const) {
      expect(applyRefusal(facts({ stage, version: 1 }))).toBe('not_in_plan')
    }
  })

  it('refuses a save from an older copy, a first save naming no version as 0', () => {
    expect(applyRefusal(facts({ version: 2 }))).toBe('stale')
    expect(applyRefusal(facts({ savedVersion: 0, version: undefined }))).toBeNull()
    expect(applyRefusal(facts({ savedVersion: 0, version: '0' }))).toBeNull()
    expect(applyRefusal(facts({ savedVersion: 1, version: '1' }))).toBe('stale')
  })

  it('says the first of its reasons: closed, then past Plan Part, then stale, then the stock', () => {
    const all = { open: false, stage: 'review', version: 1, stock: box } as const
    expect(applyRefusal(facts(all))).toBe('locked')
    expect(applyRefusal(facts({ ...all, open: true }))).toBe('not_in_plan')
    expect(applyRefusal(facts({ ...all, open: true, stage: 'setup' }))).toBe('stale')
    expect(applyRefusal(facts({ ...all, open: true, stage: 'setup', version: 3 }))).toMatchObject({
      refused: 'unsendable_stock',
    })
  })

  it('refuses a fixed box with no first folder to turn it into, about the stock', () => {
    expect(applyRefusal(facts({ stock: box }))).toEqual({
      refused: 'unsendable_stock',
      message: expect.any(String),
      field: 'stock',
    })
  })
})
