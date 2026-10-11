import { describe, expect, it } from 'vitest'

import {
  fitClass,
  fitTools,
  leavesCornerRadius,
  rankFits,
  type FeatureDemand,
  type ToolFit,
} from '../src/index.js'

interface Named {
  readonly name: string
  readonly form: string
  readonly geometry: { readonly DC?: number; readonly RE?: number; readonly LCF?: number }
}

const tool = (name: string, form: string, DC: number, RE?: number): Named => ({
  name,
  form,
  geometry: RE === undefined ? { DC } : { DC, RE },
})

const names = (fits: readonly ToolFit<Named>[]) => fits.map((fit) => fit.tool.name)

describe('how close a fit came', () => {
  const sharp = { featureTag: 'p', reason: '', kind: 'sharp-corner' as const }

  it('classes a fit, a corner-only miss and a failure', () => {
    expect(fitClass({ fits: true, failures: [] })).toBe('fits')
    expect(fitClass({ fits: false, failures: [{ ...sharp, leavesCornerRadius: 1 }] })).toBe(
      'corner-only',
    )
    expect(
      fitClass({
        fits: false,
        failures: [
          { ...sharp, leavesCornerRadius: 1 },
          { featureTag: 'p', reason: 'too short' },
        ],
      }),
    ).toBe('fails')
    // A failed fit with no failures stated is not a corner miss.
    expect(fitClass({ fits: false, failures: [] })).toBe('fails')
  })

  it('reads the radius a corner-only miss leaves, the largest over its features', () => {
    expect(
      leavesCornerRadius({
        fits: false,
        failures: [
          { ...sharp, leavesCornerRadius: 1 },
          { ...sharp, featureTag: 'q', leavesCornerRadius: 2 },
        ],
      }),
    ).toBe(2)
    expect(leavesCornerRadius({ fits: true, failures: [] })).toBeUndefined()
    expect(
      leavesCornerRadius({ fits: false, failures: [{ featureTag: 'p', reason: 'too wide' }] }),
    ).toBeUndefined()
  })
})

describe('the order a tool list reads in', () => {
  const forms = ['flat end mill', 'bull nose end mill', 'ball end mill']

  it('puts fits first, corner-only misses next and failures last', () => {
    const pocket: FeatureDemand = { featureTag: 'p', maxToolDiameter: 8, depth: 10 }
    const sharp: FeatureDemand = { featureTag: 'p', sharpCorners: true, maxToolSomewhere: 20 }
    const fits = [
      ...fitTools([tool('wide', 'flat end mill', 12)], [pocket]),
      ...fitTools([tool('corner', 'flat end mill', 6)], [sharp]),
      ...fitTools([tool('fit', 'flat end mill', 6)], [pocket]),
    ]
    expect(names(rankFits(fits, forms, {}))).toEqual(['fit', 'corner', 'wide'])
  })

  it('orders fits by form, then largest diameter, keeping input order on a tie', () => {
    const fits = fitTools(
      [
        tool('ball 6', 'ball end mill', 6),
        tool('flat 4', 'flat end mill', 4),
        tool('drill 8', 'drill', 8),
        tool('flat 8', 'flat end mill', 8),
        tool('flat 8 again', 'flat end mill', 8),
      ],
      [],
    )
    expect(names(rankFits(fits, forms, {}))).toEqual([
      'flat 8',
      'flat 8 again',
      'flat 4',
      'ball 6',
      'drill 8',
    ])
  })

  it('ignores form with no form order', () => {
    const fits = fitTools(
      [tool('ball 6', 'ball end mill', 6), tool('flat 8', 'flat end mill', 8)],
      [],
    )
    expect(names(rankFits(fits, null, {}))).toEqual(['flat 8', 'ball 6'])
  })

  it('leads with the corner radius closest under a floor fillet, then those over it', () => {
    const fits = fitTools(
      [
        tool('R2', 'bull nose end mill', 6, 2),
        tool('R0.5', 'bull nose end mill', 6, 0.5),
        tool('sharp', 'bull nose end mill', 10),
        tool('R1', 'bull nose end mill', 6, 1),
        tool('R1.5', 'bull nose end mill', 6, 1.5),
      ],
      [],
    )
    expect(names(rankFits(fits, forms, { floorRadius: 1 }))).toEqual([
      'R1',
      'R0.5',
      'sharp',
      'R1.5',
      'R2',
    ])
    // With no floor fillet stated, the corner radius does not order them.
    expect(names(rankFits(fits, forms, {}))).toEqual(['sharp', 'R2', 'R0.5', 'R1', 'R1.5'])
  })

  it('orders corner-only misses by the radius they leave, smallest first', () => {
    const sharp: FeatureDemand = { featureTag: 'p', sharpCorners: true, maxToolSomewhere: 40 }
    const fits = fitTools(
      [
        tool('ball 4', 'ball end mill', 4),
        tool('flat 8', 'flat end mill', 8),
        tool('flat 4', 'flat end mill', 4),
      ],
      [sharp],
    )
    expect(names(rankFits(fits, forms, {}))).toEqual(['flat 4', 'ball 4', 'flat 8'])
  })

  it('returns a new array and leaves the input as it was', () => {
    const fits = fitTools([tool('a', 'ball end mill', 4), tool('b', 'flat end mill', 4)], [])
    const ranked = rankFits(fits, forms, {})
    expect(ranked).not.toBe(fits)
    expect(names(fits)).toEqual(['a', 'b'])
  })
})
