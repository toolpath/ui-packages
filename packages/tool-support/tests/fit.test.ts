import { describe, expect, it } from 'vitest'

import {
  DRILLING_KINDS,
  ToolSchema,
  fitAgainst,
  fitTools,
  type FeatureDemand,
} from '../src/index.js'
import { solid } from './tools.js'

const endmill = solid({ cornerRadius: 0 })
const drill = solid({ kind: 'DrillBit', fluteLength: 30 })

const pocket: FeatureDemand = { featureTag: 'pocket-3', maxToolDiameter: 8, depth: 10 }

describe('whether a tool cuts a feature', () => {
  it('passes a tool the demand admits', () => {
    expect(fitAgainst(endmill, pocket)).toEqual([])
  })

  it('does not check what the datasheet did not state', () => {
    // The difference between a shop trusting a tool list and a shop checking
    // every row of it by hand. Absent is not zero and not "no limit".
    expect(fitAgainst(endmill, { featureTag: 'pocket-3' })).toEqual([])
    expect(fitAgainst(solid(), { featureTag: 'pocket-3', floorRadius: 1 })).toEqual([])
  })

  it('cannot be handed a tool with no cutting diameter or flute length', () => {
    // The record states both or is not a tool: what a tool without them would
    // pass unchecked here is refused where the record is read.
    const { diameter: _d, ...noDiameter } = solid()
    const { fluteLength: _l, ...noFlutes } = solid()
    expect(ToolSchema.safeParse(noDiameter).success).toBe(false)
    expect(ToolSchema.safeParse(noFlutes).success).toBe(false)
  })

  it('refuses a cutter wider than the feature admits', () => {
    const [failure] = fitAgainst({ ...endmill, diameter: 10 }, pocket)
    expect(failure?.featureTag).toBe('pocket-3')
    expect(failure?.reason).toContain('wider than')
  })

  it('refuses flutes that do not reach the bottom', () => {
    const [failure] = fitAgainst({ ...endmill, fluteLength: 5 }, pocket)
    expect(failure?.reason).toContain('does not reach')
  })

  it('refuses a corner larger than the floor fillet', () => {
    // A sharp tool in a filleted corner is fine — it just leaves the fillet to
    // something else. The refusal is one-directional.
    const filleted: FeatureDemand = { featureTag: 'pocket-3', floorRadius: 1 }
    expect(fitAgainst({ ...endmill, cornerRadius: 2 }, filleted)).toHaveLength(1)
    expect(fitAgainst({ ...endmill, cornerRadius: 0.5 }, filleted)).toEqual([])
  })

  it('reports every reason a feature ruled a tool out', () => {
    const failures = fitAgainst(solid({ diameter: 10, fluteLength: 5, cornerRadius: 2 }), {
      featureTag: 'pocket-3',
      maxToolDiameter: 8,
      depth: 10,
      floorRadius: 1,
    })
    expect(failures).toHaveLength(3)
    expect(new Set(failures.map((f) => f.featureTag))).toEqual(new Set(['pocket-3']))
  })
})

describe('a hole’s two limits, and which applies', () => {
  const hole: FeatureDemand = {
    featureTag: 'hole-1',
    maxDrillDiameter: 6,
    maxEndmillDiameter: 4,
    holeDiameter: 6,
  }

  it('bounds a drill by the bore and an endmill by what can helix', () => {
    expect(fitAgainst(drill, hole)).toEqual([])
    expect(fitAgainst(endmill, hole)).toHaveLength(1)
    expect(fitAgainst({ ...endmill, diameter: 4 }, hole)).toEqual([])
  })

  it('falls back to the bore, then to the feature’s own limit', () => {
    const bare: FeatureDemand = { featureTag: 'hole-1', holeDiameter: 6 }
    expect(fitAgainst(drill, bare)).toEqual([])
    expect(fitAgainst({ ...drill, diameter: 7 }, bare)).toHaveLength(1)

    const generic: FeatureDemand = { featureTag: 'hole-1', maxToolDiameter: 5 }
    expect(fitAgainst(drill, generic)).toHaveLength(1)
    expect(fitAgainst(endmill, generic)).toHaveLength(1)
  })

  it('knows a centre drill and a spot drill go in bore-first too', () => {
    // The refinement a coarse tool type could not express: it had one word,
    // `drill`, for all three, so a stated spot drill could not be recognised.
    for (const kind of ['DrillBit', 'CenterDrill', 'SpotDrill', 'Reamer'] as const) {
      expect(DRILLING_KINDS.has(kind), kind).toBe(true)
      expect(fitAgainst(solid({ kind }), hole), kind).toEqual([])
    }
  })

  it('treats a mill as a mill, whatever it is called', () => {
    for (const kind of ['FlatEndmill', 'BallEndmill', 'ThreadMill', 'LollipopMill'] as const) {
      expect(DRILLING_KINDS.has(kind), kind).toBe(false)
    }
  })
})

describe('which tools cut every demand', () => {
  it('keeps a near miss and says which feature ruled it out', () => {
    // A tool that clears four of five features is not an answer, but knowing
    // which one stopped it is.
    const fits = fitTools(
      [endmill, { ...endmill, diameter: 10 }],
      [pocket, { featureTag: 'slot-2', maxToolDiameter: 6 }],
    )
    expect(fits[0]?.fits).toBe(true)
    expect(fits[1]?.fits).toBe(false)
    expect(fits[1]?.failures.map((f) => f.featureTag)).toEqual(['pocket-3', 'slot-2'])
  })

  it('passes everything where nothing has been asked', () => {
    expect(fitTools([endmill, drill], []).every((fit) => fit.fits)).toBe(true)
  })

  it('hands a caller its own records back', () => {
    // Generic in the tool, so a catalog record survives the round trip rather
    // than coming back as a projection of itself.
    const record = { ...endmill, guid: '2f0c…', productId: 'TDMX0600', bin: 'B7' }
    expect(fitTools([record], [pocket])[0]?.tool.bin).toBe('B7')
  })
})
