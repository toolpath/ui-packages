import { describe, expect, it } from 'vitest'

import {
  ASSEMBLY_PARTS,
  NO_MARGINS,
  SILHOUETTE_PARTS,
  clearance,
  describeCollision,
  holderSilhouette,
  materialProfile,
  toolCollisions,
  toolSilhouette,
  type Holder,
  type ReachCurve,
  type SweptAssembly,
} from '../src/index.js'

const bare: Holder = {
  noseDiameter: null,
  noseLength: null,
  bodyDiameter: null,
  bodyLength: null,
  projection: null,
  flangeDiameter: null,
  gaugeLength: null,
  colletSeries: null,
  colletProtrusion: null,
}

const holder: Holder = {
  ...bare,
  clamping: 'collet',
  colletSeries: 'ER16',
  colletProtrusion: 2,
  noseDiameter: 27,
  noseLength: 12,
  bodyDiameter: 42,
  bodyLength: 20,
  projection: 60,
  flangeDiameter: 46,
}

const tool = { form: 'flat end mill', geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6 } }

/** A 12 mm wall standing 2 mm out from the cut, rising to 30 mm past 8 mm out. */
const curve: ReachCurve = { horizontalOffset: [2, 8], verticalOffset: [12, 30] }

describe('the part vocabulary', () => {
  it('sweeps everything but the cutting end', () => {
    // The tip and the flutes are the cut: material at the cutting radius is
    // what the tool is there to remove.
    expect([...SILHOUETTE_PARTS]).toEqual(
      ASSEMBLY_PARTS.filter((part) => part !== 'tip' && part !== 'flutes'),
    )
    expect(SILHOUETTE_PARTS).not.toContain('tip')
    expect(ASSEMBLY_PARTS).toContain('tip')
  })

  it('is derived, so a part added is swept unless it is excluded', () => {
    expect(SILHOUETTE_PARTS.length).toBe(ASSEMBLY_PARTS.length - 2)
  })
})

describe('the tool’s own profile', () => {
  it('is a neck where the relief is narrower than the shank', () => {
    const necked = {
      geometry: { DC: 6, LCF: 13, SFDM: 6, 'shoulder-length': 25, 'shoulder-diameter': 5 },
    }
    expect(toolSilhouette(necked).map((step) => step.part)).toEqual(['neck', 'shank'])
  })

  it('is plain shank where the relief is as wide as the shank', () => {
    const relieved = {
      geometry: { DC: 6, LCF: 13, SFDM: 6, 'shoulder-length': 25, 'shoulder-diameter': 6 },
    }
    expect(toolSilhouette(relieved).map((step) => step.part)).toEqual(['shank', 'shank'])
  })

  it('has nothing to check without a cut or a flute length', () => {
    expect(toolSilhouette({ geometry: { SFDM: 6 } })).toEqual([])
  })
})

describe('the holder’s profile above the tool', () => {
  const assembly: SweptAssembly = { tool, holder, collet: null, stickout: 19 }

  it('carries the last stated diameter up to the flange', () => {
    // A radius from a height upward, not a band: nothing is invented for the
    // shape between the body and the flange, and no cone is swept for metal
    // that is not there.
    const steps = holderSilhouette(assembly, 19)
    expect(steps.map((step) => step.part)).toEqual(['collet', 'nose', 'body', 'flange'])
    expect(steps.find((step) => step.part === 'collet')?.fromHeight).toBe(17)
    expect(steps.find((step) => step.part === 'flange')?.fromHeight).toBe(79)
  })

  it('sweeps nothing for a holder whose nose nobody stated', () => {
    expect(holderSilhouette({ ...assembly, holder: bare }, 19)).toEqual([])
  })
})

describe('the verdict', () => {
  it('says which parts it checked, so a pass is read as exactly that much', () => {
    const verdict = clearance({ tool, holder, collet: null, stickout: 40 }, curve)
    expect(verdict.checked).toContain('nose')
    expect(verdict.clears).toBe(true)
  })

  it('names what a stack meets, and how far it would have to stand out', () => {
    const verdict = clearance({ tool, holder, collet: null, stickout: 5 }, curve)
    expect(verdict.clears).toBe(false)
    expect(verdict.requiredStickout).toBeGreaterThan(5)
    expect(describeCollision(verdict.collisions[0]!)).toMatch(/collides with material/)
  })

  it('clears at the stickout it just asked for', () => {
    // A stack stood out to exactly what it needs lands a femtometre short
    // after the arithmetic, and once reported a collet colliding at the
    // stickout this same sweep had asked for.
    const needed = clearance({ tool, holder, collet: null, stickout: 0 }, curve).requiredStickout!
    expect(clearance({ tool, holder, collet: null, stickout: needed }, curve).clears).toBe(true)
  })

  it('checks nothing for a tool that states no cutting diameter', () => {
    const verdict = clearance(
      { tool: { form: 'drill', geometry: {} }, holder, collet: null, stickout: 19 },
      curve,
    )
    expect(verdict).toEqual({ clears: true, collisions: [], requiredStickout: null, checked: [] })
  })

  it('honours the room the shop wants kept', () => {
    const tight = clearance({ tool, holder, collet: null, stickout: 40 }, curve, {
      radial: 0,
      axial: 30,
    })
    expect(tight.clears).toBe(false)
    expect(NO_MARGINS).toEqual({ radial: 0, axial: 0 })
  })
})

describe('the tool’s own body against the part', () => {
  // Short flutes on a wide shank: the shank stands 2 mm past the cutting edge
  // and meets the wall 5 mm above the tip.
  const stubby = { geometry: { DC: 6, LCF: 5, SFDM: 10 } }

  it('meets the wall above the flutes whatever the stickout', () => {
    // No holder and no pull-out moves where the tool's own steps sit above its
    // tip, so this takes no stickout at all: such a tool is not compatible with
    // the feature, and the answer is longer flutes or a reduced shank.
    const met = toolCollisions(stubby, curve)
    expect(met).toHaveLength(1)
    expect(met[0]).toEqual({ part: 'shank', height: 5, needs: 12, offset: 2 })
  })

  it('says nothing about a tool that stays inside its own cut', () => {
    // A shank no wider than the flutes is behind the wall the flutes cut.
    expect(toolCollisions(tool, curve)).toEqual([])
  })

  it('checks nothing for a tool that states no cutting diameter', () => {
    expect(toolCollisions({ geometry: { SFDM: 10 } }, curve)).toEqual([])
  })

  it('is swept with the same margins as the holder', () => {
    // A radial margin pushes the shank further out from the cut, onto a taller
    // part of the staircase; an axial one lifts the material to meet it.
    const roomy = toolCollisions(stubby, curve, { radial: 1, axial: 0 })
    expect(roomy[0]?.offset).toBe(3)
    expect(roomy[0]?.needs).toBe(30)
    expect(toolCollisions(stubby, curve, { radial: 0, axial: 5 })[0]?.needs).toBe(17)
  })

  it('reports the neck rather than the shank where the relief is one', () => {
    const necked = {
      geometry: { DC: 6, LCF: 5, SFDM: 10, 'shoulder-length': 8, 'shoulder-diameter': 9 },
    }
    expect(toolCollisions(necked, curve).map((each) => each.part)).toEqual(['neck', 'shank'])
  })
})

describe('the material as a drawing', () => {
  it('rises at the start of each run, exactly as the sweep reads it', () => {
    // Drawn the other way round, the picture showed a nose clearing material
    // the sweep had already failed it on.
    const points = materialProfile(curve, 3)
    expect(points[0]).toEqual({ r: 3, z: 0 })
    expect(points).toContainEqual({ r: 3, z: 12 })
    expect(points).toContainEqual({ r: 5, z: 12 })
    expect(points).toContainEqual({ r: 11, z: 30 })
  })
})
