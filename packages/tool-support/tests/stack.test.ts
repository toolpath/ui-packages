/**
 * A tool's shank, length and necks, read off its one cone stack.
 *
 * The record states what stands above the flutes as `shaft` and nothing beside
 * it; these are the readings every consumer takes of it.
 */

import { describe, expect, it } from 'vitest'

import { cylinder } from '../src/cones.js'
import {
  extensionLength,
  extensionShank,
  hasNeck,
  neckOf,
  overallLengthOf,
  reachNeckOf,
  shankOf,
  minStickout,
  shaftParts,
  sliceAt,
  stackHeight,
  statedOverallLength,
  statedShank,
  stickoutRange,
  toolFromSummary,
  unclampableLength,
  type Cone,
  type Extension,
  type InsertTool,
} from '../src/index.js'
import { shaft, solid } from './tools.js'

/** A 6 mm tool, 13 mm of flute, with a relief of this diameter running this far past the flutes, then a shank. */
const relieved = (diameter: number, length: number, shank = 6) =>
  solid({ shaft: shaft({ shank, overallLength: 60, neck: { diameter, length } }) })

describe('a stack’s height and slice', () => {
  const layers = [cylinder(4, 10), { thickness: 10, bottomDiameter: 4, topDiameter: 8 }]

  it('sums its layers', () => {
    expect(stackHeight(layers)).toBe(20)
    expect(stackHeight([])).toBe(0)
  })

  it('cuts a straddling layer in proportion', () => {
    expect(sliceAt(layers, 15)).toEqual([
      cylinder(4, 10),
      { thickness: 5, bottomDiameter: 4, topDiameter: 6 },
    ])
  })

  it('cuts a tapered layer away from its middle in proportion', () => {
    const taper: Cone = { thickness: 8, bottomDiameter: 4, topDiameter: 12 }
    expect(sliceAt([taper], 2)).toEqual([{ thickness: 2, bottomDiameter: 4, topDiameter: 6 }])
    expect(sliceAt([cylinder(4, 10), taper], 16)).toEqual([
      cylinder(4, 10),
      { thickness: 6, bottomDiameter: 4, topDiameter: 10 },
    ])
  })

  it('keeps a layer of no height below the cut, and none at it', () => {
    const step: Cone = { thickness: 0, bottomDiameter: 4, topDiameter: 8 }
    const stepped = [cylinder(4, 10), step, cylinder(8, 10)]
    expect(sliceAt(stepped, 15)).toEqual([cylinder(4, 10), step, cylinder(8, 5)])
    expect(sliceAt(stepped, 10)).toEqual([cylinder(4, 10)])
    expect(sliceAt([step, cylinder(8, 10)], 0)).toEqual([])
  })

  it('keeps whole layers below the cut and drops those above it', () => {
    expect(sliceAt(layers, 10)).toEqual([cylinder(4, 10)])
    expect(sliceAt(layers, 99)).toEqual(layers)
    expect(sliceAt(layers, 0)).toEqual([])
  })
})

describe('the shank and the overall length', () => {
  it('reads the shank off the top of the stack', () => {
    expect(shankOf(relieved(5, 12, 8))).toBe(8)
  })

  it('states neither where the tool states no shaft', () => {
    expect(shankOf(solid())).toBeNull()
    expect(shankOf(solid({ shaft: [] }))).toBeNull()
    expect(overallLengthOf(solid())).toBeNull()
  })

  it('is the flutes and the stack', () => {
    expect(overallLengthOf(relieved(5, 12))).toBe(60)
  })

  it('reads an insert tool’s arbor alike', () => {
    const face: InsertTool = {
      type: 'insert',
      kind: 'FaceEndmill',
      name: 'face',
      body: { diameter: 50, fluteLength: 5 },
      insert: {},
      shaft: [cylinder(22, 35)],
    }
    expect(shankOf(face)).toBe(22)
    expect(overallLengthOf(face)).toBe(40)
  })
})

describe('the length a collet cannot close on', () => {
  it('runs from the flutes to the shank past a neck', () => {
    expect(unclampableLength(relieved(5, 12))).toBe(12)
  })

  it('runs past a shoulder wider than the shank as well', () => {
    expect(unclampableLength(relieved(8, 12))).toBe(12)
  })

  it('is nothing where the relief is as wide as the shank', () => {
    expect(unclampableLength(relieved(6, 12))).toBe(0)
  })

  it('is nothing with no shaft', () => {
    expect(unclampableLength(solid())).toBe(0)
  })
})

describe('whether a tool has a neck', () => {
  it('needs a section past the flutes, narrower than the shank', () => {
    expect(neckOf(relieved(5, 12))).toEqual({ length: 12, diameter: 5 })
    expect(hasNeck(relieved(5, 12))).toBe(true)
  })

  it('is not a neck where the section stops at the flutes', () => {
    // 171 Destiny end mills state a shoulder narrower than the cut whose
    // shoulder length equals the flute length. There is no section to draw or
    // to sweep, so there is no neck: the section is a step of no height.
    const atFlutes = solid({ shaft: [cylinder(5, 0), cylinder(6, 47)] })
    expect(neckOf(atFlutes)).toBeUndefined()
    expect(shaftParts(atFlutes)).toEqual(['neck', 'shank'])
    expect(unclampableLength(atFlutes)).toBe(0)
  })

  it('is not a neck where the relief is as wide as the shank, or wider', () => {
    expect(hasNeck(relieved(6, 12))).toBe(false)
    expect(hasNeck(relieved(8, 12))).toBe(false)
  })

  it('says no where the tool states no shaft', () => {
    expect(hasNeck(solid())).toBe(false)
  })

  it('is not fooled by a conversion’s last bit', () => {
    // 3/8" is 9.525 on one sheet and 9.524999999999999 on another. Strict, a
    // relief and a shank of the same nominal size read as a neck.
    expect(
      hasNeck(
        solid({
          diameter: 9.525,
          shaft: [cylinder(9.524999999999999, 12), cylinder(9.525, 40)],
        }),
      ),
    ).toBe(false)
  })

  it('takes the narrowest of a stepped neck, to its last narrower layer', () => {
    const stepped = solid({ shaft: [cylinder(5, 4), cylinder(4, 6), cylinder(6, 40)] })
    expect(neckOf(stepped)).toEqual({ length: 10, diameter: 4 })
  })
})

describe('the shank run, read down from the top', () => {
  // The reviewer's stacks: what stands below the top run of shank is unclampable,
  // a wider shoulder between two shank-wide layers with it.
  const shouldered = solid({
    fluteLength: 12,
    shaft: [cylinder(6, 8), cylinder(5, 8), cylinder(8, 3), cylinder(6, 49)],
  })

  it('runs past a neck and a shoulder below the top shank', () => {
    expect(unclampableLength(shouldered)).toBe(19)
    expect(neckOf(shouldered)).toEqual({ length: 16, diameter: 5 })
    expect(minStickout(shouldered)).toBe(12 + 19)
  })

  it('labels below the run a neck only where it is narrower than the shank', () => {
    expect(shaftParts(shouldered)).toEqual(['shank', 'neck', 'shank', 'shank'])
  })

  it('labels a slice of the stack as the stack', () => {
    expect(shaftParts(shouldered, sliceAt(shouldered.shaft ?? [], 12))).toEqual(['shank', 'neck'])
  })

  it('starts a collet past a wider shoulder above a reduced section', () => {
    const tool = solid({
      fluteLength: 12,
      shaft: [cylinder(4, 10), cylinder(6, 5), cylinder(8, 3), cylinder(6, 40)],
    })
    expect(minStickout(tool)).toBe(30)
  })

  it('is empty under a tapered top, so the whole shaft is unclampable', () => {
    // A taper is not a shank a collet or a bore clamps.
    const tapered = solid({
      diameter: 5,
      fluteLength: 10,
      shaft: [cylinder(5, 10), { thickness: 40, bottomDiameter: 6, topDiameter: 6.5 }],
    })
    expect(unclampableLength(tapered)).toBe(50)
    expect(minStickout(tapered)).toBe(60)
    expect(shaftParts(tapered)).toEqual(['neck', 'shank'])
  })

  it('reads past a step of no height at the top', () => {
    const capped = solid({
      shaft: [
        cylinder(5, 10),
        cylinder(6, 40),
        { thickness: 0, bottomDiameter: 6, topDiameter: 9 },
      ],
    })
    expect(shankOf(capped)).toBe(6)
    expect(unclampableLength(capped)).toBe(10)
  })
})

describe('the shank and length a reader assumed', () => {
  const kernel = toolFromSummary({
    name: 'tool',
    key: 'tool',
    kind: 'FlatEndmill',
    diameter: 8,
    fluteLength: 16,
    stickout: 30,
    fluteCount: 4,
  })

  it('reads geometric, and states neither', () => {
    expect(shankOf(kernel)).toBe(8)
    expect(overallLengthOf(kernel)).toBe(30)
    expect(statedShank(kernel)).toBeNull()
    expect(statedOverallLength(kernel)).toBeNull()
  })

  it('states each where only the other is assumed', () => {
    const tool = relieved(5, 12)
    const noEnd = { ...tool, provenance: { overallLength: 'assumed' as const } }
    const noShank = { ...tool, provenance: { shank: 'assumed' as const } }
    expect([statedShank(noEnd), statedOverallLength(noEnd)]).toEqual([6, null])
    expect([statedShank(noShank), statedOverallLength(noShank)]).toEqual([null, 60])
  })

  it('caps no stickout by a length nobody stated', () => {
    expect(stickoutRange(kernel)).toMatchObject({
      setup: 18,
      max: null,
      grip: null,
      gripShort: false,
    })
    const assumed = { ...relieved(5, 12), provenance: { overallLength: 'assumed' as const } }
    expect(stickoutRange(assumed)).toMatchObject({ max: null, grip: null })
    expect(stickoutRange(relieved(5, 12)).max).not.toBeNull()
  })
})

describe('the kernel’s reach neck', () => {
  it('needs a section narrower than the cut, with a length', () => {
    expect(reachNeckOf(relieved(5, 12))).toEqual({ length: 12, diameter: 5 })
    expect(reachNeckOf(relieved(5, 0))).toBeUndefined()
  })

  it('is none where the relief is wider than the cut', () => {
    expect(reachNeckOf(relieved(8, 12, 10))).toBeUndefined()
  })

  it('is the whole shank where the shank is narrower than the cut', () => {
    const reduced = solid({ diameter: 12, fluteLength: 20, shaft: [cylinder(10, 50)] })
    expect(reachNeckOf(reduced)).toEqual({ length: 50, diameter: 10 })
  })

  it('reads past a step of no height at the top of the flutes', () => {
    const stepped = solid({
      diameter: 6,
      shaft: [
        { thickness: 0, bottomDiameter: 6, topDiameter: 5 },
        cylinder(5, 12),
        cylinder(6, 40),
      ],
    })
    expect(reachNeckOf(stepped)).toEqual({ length: 12, diameter: 5 })
  })

  it('is a different question from the clamping neck, and answers differently', () => {
    // A relief wider than the cut but narrower than the shank: a neck to a
    // collet, and none to the kernel. 860 end mills have such a relief and only
    // 245 of them are under the cut.
    const wideRelief = relieved(8, 12, 10)
    expect(hasNeck(wideRelief)).toBe(true)
    expect(reachNeckOf(wideRelief)).toBeUndefined()
  })
})

describe('an extension’s shank and length', () => {
  const extension = (layers: Extension['layers']): Extension => ({ systemSize: 'DL10', layers })

  it('reads them off its layers', () => {
    const stated = extension([cylinder(9, 20), cylinder(16, 80)])
    expect(extensionShank(stated)).toBe(16)
    expect(extensionLength(stated)).toBe(100)
  })

  it('states no shank where it states no shape', () => {
    expect(extensionShank(extension([]))).toBeNull()
    expect(extensionLength(extension([]))).toBe(0)
  })
})
