import { describe, expect, it } from 'vitest'

import { DRILLING_FORMS, fitAgainst, fitTools, type FeatureDemand } from '../src/index.js'

const endmill = { form: 'flat end mill', geometry: { DC: 6, LCF: 13, RE: 0 } }
const drill = { form: 'drill', geometry: { DC: 6, LCF: 30 } }

const pocket: FeatureDemand = { featureTag: 'pocket-3', maxToolDiameter: 8, depth: 10 }

describe('whether a tool cuts a feature', () => {
  it('passes a tool the demand admits', () => {
    expect(fitAgainst(endmill, pocket)).toEqual([])
  })

  it('does not check what the datasheet did not state', () => {
    // The difference between a shop trusting a tool list and a shop checking
    // every row of it by hand. Absent is not zero and not "no limit".
    expect(fitAgainst(endmill, { featureTag: 'pocket-3' })).toEqual([])
    expect(fitAgainst({ form: 'flat end mill', geometry: {} }, pocket)).toEqual([])
  })

  it('refuses a cutter wider than the feature admits', () => {
    const [failure] = fitAgainst({ ...endmill, geometry: { DC: 10 } }, pocket)
    expect(failure?.featureTag).toBe('pocket-3')
    expect(failure?.reason).toContain('wider than')
  })

  it('refuses flutes that do not reach the bottom', () => {
    const [failure] = fitAgainst({ ...endmill, geometry: { DC: 6, LCF: 5 } }, pocket)
    expect(failure?.reason).toContain('does not reach')
  })

  it('refuses a corner larger than the floor fillet', () => {
    // A sharp tool in a filleted corner is fine — it just leaves the fillet to
    // something else. The refusal is one-directional.
    const filleted: FeatureDemand = { featureTag: 'pocket-3', floorRadius: 1 }
    expect(fitAgainst({ ...endmill, geometry: { RE: 2 } }, filleted)).toHaveLength(1)
    expect(fitAgainst({ ...endmill, geometry: { RE: 0.5 } }, filleted)).toEqual([])
  })

  it('reports every reason a feature ruled a tool out', () => {
    const failures = fitAgainst(
      { form: 'flat end mill', geometry: { DC: 10, LCF: 5, RE: 2 } },
      { featureTag: 'pocket-3', maxToolDiameter: 8, depth: 10, floorRadius: 1 },
    )
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
    expect(fitAgainst({ ...drill, geometry: { DC: 6 } }, hole)).toEqual([])
    expect(fitAgainst({ ...endmill, geometry: { DC: 6 } }, hole)).toHaveLength(1)
    expect(fitAgainst({ ...endmill, geometry: { DC: 4 } }, hole)).toEqual([])
  })

  it('falls back to the bore, then to the feature’s own limit', () => {
    const bare: FeatureDemand = { featureTag: 'hole-1', holeDiameter: 6 }
    expect(fitAgainst({ ...drill, geometry: { DC: 6 } }, bare)).toEqual([])
    expect(fitAgainst({ ...drill, geometry: { DC: 7 } }, bare)).toHaveLength(1)

    const generic: FeatureDemand = { featureTag: 'hole-1', maxToolDiameter: 5 }
    expect(fitAgainst({ ...drill, geometry: { DC: 6 } }, generic)).toHaveLength(1)
    expect(fitAgainst({ ...endmill, geometry: { DC: 6 } }, generic)).toHaveLength(1)
  })

  it('knows a centre drill and a spot drill go in bore-first too', () => {
    // The refinement a coarse tool type could not express: it had one word,
    // `drill`, for all three, so a stated spot drill could not be recognised.
    for (const form of ['drill', 'center drill', 'spot drill', 'reamer']) {
      expect(DRILLING_FORMS.has(form as never), form).toBe(true)
      expect(fitAgainst({ form, geometry: { DC: 6 } }, hole), form).toEqual([])
    }
  })

  it('treats a mill as a mill, whatever it is called', () => {
    for (const form of ['flat end mill', 'ball end mill', 'thread mill', 'other']) {
      expect(DRILLING_FORMS.has(form as never), form).toBe(false)
    }
  })
})

describe('a feature drawn with sharp inside corners', () => {
  // The Engine's 40 × 40 pocket with square corners: its tightest clearance is
  // the tolerance's reading of a corner with no room in it.
  const sharp: FeatureDemand = {
    featureTag: 'pocket-sharp',
    maxToolDiameter: 0.0123,
    sharpCorners: true,
    maxToolSomewhere: 40,
    depth: 15,
  }

  it('rules every end mill out for the corners, with the radius it leaves', () => {
    expect(fitAgainst({ ...endmill, geometry: { DC: 6.35, LCF: 20 } }, sharp)).toEqual([
      {
        featureTag: 'pocket-sharp',
        reason: '⌀6.35 mm leaves R3.175 mm in corners drawn sharp, which no end mill finishes',
        kind: 'sharp-corner',
        leavesCornerRadius: 3.175,
      },
    ])
  })

  it('says so even where the corner limit reads zero and is left out', () => {
    const { maxToolDiameter: _, ...unstated } = sharp
    const [failure] = fitAgainst({ ...endmill, geometry: { DC: 3, LCF: 20 } }, unstated)
    expect(failure?.kind).toBe('sharp-corner')
    expect(failure?.leavesCornerRadius).toBe(1.5)
  })

  it('still bounds the tool by the room the feature has, and checks the rest', () => {
    const [wide, ...none] = fitAgainst({ ...endmill, geometry: { DC: 50, LCF: 60 } }, sharp)
    expect(none).toEqual([])
    expect(wide?.kind).toBeUndefined()
    expect(wide?.reason).toBe('⌀50 mm is wider than the 40 mm this feature has room for anywhere')

    const short = fitAgainst({ ...endmill, geometry: { DC: 6, LCF: 10 } }, sharp)
    expect(short.map((f) => f.kind)).toEqual(['sharp-corner', undefined])
  })

  it('leaves a narrow feature with no sharp corners as it was', () => {
    const slot: FeatureDemand = { featureTag: 'slot-1', maxToolDiameter: 4, maxToolSomewhere: 4 }
    expect(fitAgainst({ ...endmill, geometry: { DC: 4 } }, slot)).toEqual([])
    const [failure] = fitAgainst({ ...endmill, geometry: { DC: 6 } }, slot)
    expect(failure?.kind).toBeUndefined()
    expect(failure?.reason).toContain('wider than')
  })
})

describe('the lengths a reason states', () => {
  it('rounds them to the micron, as a unit conversion leaves noise in them', () => {
    // 0.590551 in read back to millimetres, and a depth that is not quite 15.
    const failures = fitAgainst(
      { form: 'flat end mill', geometry: { DC: 14.99999999999989, LCF: 9.9999996, RE: 1.23456 } },
      { featureTag: 'p', maxToolDiameter: 12.7000001, depth: 15.0000004, floorRadius: 0.5 },
    )
    expect(failures.map((f) => f.reason)).toEqual([
      '⌀15 mm is wider than the 12.7 mm this feature admits',
      '10 mm of flute does not reach 15 mm deep',
      'a 1.235 mm corner does not fit a 0.5 mm floor fillet',
    ])
  })

  it('rounds the room and the radius a sharp corner leaves', () => {
    const sharp: FeatureDemand = {
      featureTag: 'p',
      sharpCorners: true,
      maxToolSomewhere: 19.99999999,
    }
    expect(fitAgainst({ ...endmill, geometry: { DC: 6.3500000001 } }, sharp)[0]?.reason).toBe(
      '⌀6.35 mm leaves R3.175 mm in corners drawn sharp, which no end mill finishes',
    )
    expect(fitAgainst({ ...endmill, geometry: { DC: 25.00000002 } }, sharp)[0]?.reason).toBe(
      '⌀25 mm is wider than the 20 mm this feature has room for anywhere',
    )
  })

  it('compares the value as stated, not as rounded', () => {
    // Rounded, 6.0000001 reads as the 6 it is checked against; it is still wider.
    const [failure] = fitAgainst(
      { ...endmill, geometry: { DC: 6.0000001 } },
      { featureTag: 'p', maxToolDiameter: 6 },
    )
    expect(failure?.reason).toBe('⌀6 mm is wider than the 6 mm this feature admits')
  })
})

describe('which tools cut every demand', () => {
  it('keeps a near miss and says which feature ruled it out', () => {
    // A tool that clears four of five features is not an answer, but knowing
    // which one stopped it is.
    const fits = fitTools(
      [endmill, { ...endmill, geometry: { DC: 10, LCF: 13 } }],
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
    const record = { ...endmill, guid: '2f0c…', catalogNumber: 'TDMX0600' }
    expect(fitTools([record], [pocket])[0]?.tool.catalogNumber).toBe('TDMX0600')
  })
})
