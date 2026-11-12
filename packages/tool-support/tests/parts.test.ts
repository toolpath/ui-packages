import { describe, expect, it } from 'vitest'

import {
  ASSEMBLY_PARTS,
  NO_MARGINS,
  SILHOUETTE_PARTS,
  clearance,
  describeCollision,
  extensionSilhouette,
  holderSilhouette,
  materialProfile,
  toolCollisions,
  measuredHolder,
  parametricHolder,
  toolSilhouette,
  type Extension,
  type Holder,
  type ReachCurve,
  type RotatingToolAssembly,
} from '../src/index.js'
import { cylinder } from '../src/cones.js'
import { shaft, solid } from './tools.js'

const bare: Holder = { layers: [], gaugeLength: null }

/** A collet chuck as its vendor publishes it, up to its gauge line 80 mm above the nose. */
const holder: Holder = parametricHolder(
  {
    noseDiameter: 27,
    noseLength: 12,
    bodyDiameter: 42,
    bodyLength: 20,
    projection: 60,
    flangeDiameter: 46,
    gaugeLength: 80,
  },
  { clamping: 'collet', colletSeries: 'ER16', colletProtrusion: 2 },
)

const tool = solid({ shaft: shaft({ shank: 6, overallLength: 57 }) })

/** A tool with a section of this diameter running this far past its 13 mm of flutes, then a ⌀6 shank. */
const sectioned = (diameter: number, length: number, shank = 6) =>
  solid({ shaft: shaft({ shank, overallLength: 57, neck: { diameter, length } }) })
const stack = (stickout: number): RotatingToolAssembly => ({
  tool,
  holder,
  collet: null,
  stickout,
})

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
    const necked = sectioned(5, 12)
    expect(toolSilhouette(necked).map((step) => step.part)).toEqual(['neck', 'shank'])
  })

  it('starts the shank where the neck ends, measured from the top of the flutes', () => {
    const necked = sectioned(5, 12)
    expect(toolSilhouette(necked)).toEqual([
      { part: 'neck', radius: 2.5, fromHeight: 13 },
      { part: 'shank', radius: 3, fromHeight: 25 },
    ])
  })

  it('is plain shank where the relief is as wide as the shank', () => {
    const relieved = sectioned(6, 12)
    expect(toolSilhouette(relieved).map((step) => step.part)).toEqual(['shank', 'shank'])
  })

  it('sweeps a stated shoulder wider than the shank at its own radius', () => {
    // A ⌀20 cutter on a ⌀16 shank with a ⌀19 shoulder to 50 mm: the shoulder
    // stands 9.5 out from the axis from the top of the flutes.
    const shouldered = solid({
      diameter: 20,
      fluteLength: 20,
      shaft: shaft({
        shank: 16,
        overallLength: 100,
        fluteLength: 20,
        neck: { diameter: 19, length: 30 },
      }),
    })
    expect(toolSilhouette(shouldered)[0]).toEqual({ part: 'shank', radius: 9.5, fromHeight: 20 })
  })

  it('sweeps a plain shank from the flutes', () => {
    expect(toolSilhouette(tool)).toEqual([{ part: 'shank', radius: 3, fromHeight: 13 }])
  })

  it('has nothing above the flutes where no shaft is stated', () => {
    expect(toolSilhouette(solid())).toEqual([])
  })
})

describe('the holder’s profile above the tool', () => {
  const assembly = stack(19)

  it('carries the last stated diameter up to the flange', () => {
    // A radius from a height upward, not a band: nothing is invented for the
    // shape between the body and the flange, and no cone is swept for metal
    // that is not there. Past the nose, every layer is body.
    const steps = holderSilhouette(assembly, 19)
    expect(steps.map((step) => step.part)).toEqual(['collet', 'nose', 'body', 'body', 'body'])
    expect(steps.find((step) => step.part === 'collet')?.fromHeight).toBe(17)
    // The body's ⌀42 carried from 51 up to the flange face, and the ⌀46 flange
    // from the projection, 60 above the nose.
    expect(steps.slice(-2)).toEqual([
      { part: 'body', radius: 21, fromHeight: 51 },
      { part: 'body', radius: 23, fromHeight: 79 },
    ])
  })

  it('sweeps a measured holder only below its spindle face', () => {
    // The taper and retention knob above the face are inside the spindle.
    const measured = measuredHolder({
      points: [
        [-30, 8],
        [0, 23],
        [48, 21],
        [60, 13.5],
      ],
      datum: 'gage-line',
    })
    const steps = holderSilhouette({ holder: measured }, 19)
    expect(steps).toEqual([
      { part: 'nose', radius: 21, fromHeight: 19 },
      { part: 'body', radius: 23, fromHeight: 31 },
    ])
  })

  it('sweeps nothing for a holder that states no shape', () => {
    expect(holderSilhouette({ ...assembly, holder: bare }, 19)).toEqual([])
    expect(holderSilhouette({ ...assembly, holder: null }, 19)).toEqual([])
  })
})

describe('the verdict', () => {
  it('says which parts it checked, so a pass is read as exactly that much', () => {
    const verdict = clearance(stack(40), curve)
    expect(verdict.checked).toContain('nose')
    expect(verdict.clears).toBe(true)
  })

  it('names what a stack meets, and how far it would have to stand out', () => {
    const verdict = clearance(stack(5), curve)
    expect(verdict.clears).toBe(false)
    expect(verdict.requiredStickout).toBeGreaterThan(5)
    expect(describeCollision(verdict.collisions[0]!)).toMatch(/collides with material/)
  })

  it('clears at the stickout it just asked for', () => {
    // A stack stood out to exactly what it needs lands a femtometre short
    // after the arithmetic, and once reported a collet colliding at the
    // stickout this same sweep had asked for.
    const needed = clearance(stack(0), curve).requiredStickout!
    expect(clearance(stack(needed), curve).clears).toBe(true)
  })

  it('sweeps the nose of a holder whose nose length is not stated', () => {
    // An older dataset's holder: a ⌀40 nose with no length, a gauge line at 60.
    const older = parametricHolder({
      noseDiameter: 40,
      noseLength: null,
      bodyDiameter: null,
      bodyLength: null,
      projection: null,
      flangeDiameter: null,
      gaugeLength: 60,
    })
    const cutter = solid({ diameter: 10, fluteLength: 20, shaft: [cylinder(10, 40)] })
    const tall: ReachCurve = { horizontalOffset: [100], verticalOffset: [30] }
    const verdict = clearance({ tool: cutter, holder: older, stickout: 25 }, tall)
    expect(verdict.clears).toBe(false)
    expect(verdict.checked).toContain('nose')
    expect(verdict.requiredStickout).toBe(30)
  })

  it('checks only the tool where nothing holds it', () => {
    const verdict = clearance({ tool, holder: null, stickout: 19 }, curve)
    expect(verdict).toEqual({
      clears: true,
      collisions: [],
      requiredStickout: null,
      checked: ['shank'],
    })
  })

  it('honours the room the shop wants kept', () => {
    const tight = clearance(stack(40), curve, {
      radial: 0,
      axial: 30,
    })
    expect(tight.clears).toBe(false)
    expect(NO_MARGINS).toEqual({ radial: 0, axial: 0 })
  })
})

describe('a modular extension between the head and the holder', () => {
  // A ⌀8 neck 6 long on a ⌀12 shank 60 long, with a ⌀30 collar past that.
  const extension: Extension = {
    systemSize: 'DL06',
    layers: [
      { thickness: 6, bottomDiameter: 8, topDiameter: 8 },
      { thickness: 60, bottomDiameter: 12, topDiameter: 12 },
      { thickness: 10, bottomDiameter: 30, topDiameter: 30 },
    ],
  }
  // The head stands 5 out of the extension: its face is 5 above the tip.
  const modular = (over: Partial<RotatingToolAssembly> = {}): RotatingToolAssembly => ({
    tool,
    holder: null,
    collet: null,
    stickout: 40,
    extension,
    extensionProtrusion: 35,
    ...over,
  })
  /** Material 4 tall within 1 mm of the cut, 20 tall out to 3 mm. */
  const ledge: ReachCurve = { horizontalOffset: [1, 3], verticalOffset: [4, 20] }

  it('sweeps from its head face up to the holder face, and no further', () => {
    // The collar starts at 71, inside a holder whose face is at 40.
    expect(extensionSilhouette(modular(), 40)).toEqual([
      { part: 'extension', radius: 4, fromHeight: 5 },
      { part: 'extension', radius: 6, fromHeight: 11 },
    ])
  })

  it('clears the wall with its neck where its shank meets it', () => {
    const verdict = clearance(modular(), ledge)
    expect(verdict.checked).toEqual(['shank', 'extension'])
    expect(verdict.collisions).toEqual([{ part: 'extension', height: 11, needs: 20, offset: 3 }])
    expect(describeCollision(verdict.collisions[0]!)).toMatch(/^the extension at 11\.0 mm/)
  })

  it('raises the stickout the assembly needs when the extension meets the part', () => {
    // It moves with the holder face, so holder, collet and extension clear as
    // one block. Without it the collet governs: ⌀16, 5 out, 2 below the face,
    // under 20 of material, needs 22. With it the ⌀12 shank, 3 out, starts 29
    // below the face (35 − 6) under 20 of material, and needs 20 + 29 = 49.
    const held = modular({ holder })
    const { extension: _none, extensionProtrusion: _at, ...plain } = held
    expect(clearance(plain, ledge).requiredStickout).toBe(22)
    const verdict = clearance(held, ledge)
    expect(verdict.collisions).toContainEqual({
      part: 'extension',
      height: 11,
      needs: 20,
      offset: 3,
    })
    // Already past the floor, 35 + the 13 of flute = 48.
    expect(verdict.requiredStickout).toBe(49)
    expect(clearance(modular({ holder, stickout: 49 }), ledge).clears).toBe(true)
  })

  it('adds nothing to the stickout the assembly needs where it clears', () => {
    /** Nothing within 3 mm of the cut, 30 tall past it. */
    const low: ReachCurve = { horizontalOffset: [3, 10], verticalOffset: [0, 30] }
    // Its head face 15 below the holder face, both its layers over bare floor;
    // the collet still governs: ⌀16, 5 out, 2 below the face, needs 32, past
    // the floor of 15 + the 13 of flute = 28.
    const held = modular({ holder, extensionProtrusion: 15 })
    const { extension: _none, extensionProtrusion: _at, ...plain } = held
    const verdict = clearance(held, low)
    expect(verdict.clears).toBe(true)
    expect(verdict.checked).toContain('extension')
    expect(verdict.requiredStickout).toBe(32)
    expect(verdict.requiredStickout).toBe(clearance(plain, low).requiredStickout)
  })

  it('never asks for a stickout that puts its head face below the top of the flutes', () => {
    /** Nothing within 3 mm of the cut, 20 tall past it. */
    const shallow: ReachCurve = { horizontalOffset: [3, 5], verticalOffset: [0, 20] }
    // The collet alone needs 20 + 2 = 22 and the extension's neck 0 + 35;
    // its head face 35 below the holder face has to clear the 13 of flute: 48.
    const held = modular({ holder })
    const { extension: _none, extensionProtrusion: _at, ...plain } = held
    expect(clearance(plain, shallow).requiredStickout).toBe(22)
    expect(clearance(held, shallow).requiredStickout).toBe(35 + 13)
    const there = clearance(modular({ holder, stickout: 48 }), shallow)
    expect(there.checked).toContain('extension')
    expect(there.clears).toBe(true)
  })

  it('never lowers the stickout the assembly needs', () => {
    for (const reach of [curve, ledge]) {
      for (const extensionProtrusion of [5, 20, 35]) {
        const held = modular({ holder, extensionProtrusion })
        const { extension: _none, extensionProtrusion: _at, ...plain } = held
        expect(clearance(held, reach).requiredStickout!).toBeGreaterThanOrEqual(
          clearance(plain, reach).requiredStickout!,
        )
      }
    }
  })

  it('sweeps nothing of one whose head face is at the tip or past it', () => {
    // A protrusion of zero, or of the stickout or more, states no place.
    const { extension: _none, extensionProtrusion: _at, ...plain } = modular({ holder })
    for (const extensionProtrusion of [0, 40, 50]) {
      const misplaced = modular({ extensionProtrusion })
      expect(extensionSilhouette(misplaced, 40)).toEqual([])
      expect(clearance(misplaced, ledge).checked).toEqual(['shank'])
      expect(clearance(modular({ holder, extensionProtrusion }), ledge).requiredStickout).toBe(
        clearance(plain, ledge).requiredStickout,
      )
    }
  })

  it('sweeps nothing of one whose place nobody stated, and does not claim to', () => {
    const { extensionProtrusion: _unstated, ...unplaced } = modular()
    expect(extensionSilhouette(unplaced, 40)).toEqual([])
    const verdict = clearance(unplaced, ledge)
    expect(verdict.checked).toEqual(['shank'])
    expect(verdict.clears).toBe(true)
    expect(extensionSilhouette(modular({ extension: { ...extension, layers: [] } }), 40)).toEqual(
      [],
    )
  })
})

describe('the shaft swept up to the holder face', () => {
  const cone = (thickness: number, bottomDiameter: number, topDiameter = bottomDiameter) => ({
    thickness,
    bottomDiameter,
    topDiameter,
  })
  const wall = (height: number): ReachCurve => ({ horizontalOffset: [2], verticalOffset: [height] })

  it('sweeps a taper wider at the top where a plain shank would clear', () => {
    // ⌀6 cut on a ⌀6 shank: the shank stays inside the cut, and a shaft
    // flaring to ⌀10 above the flutes stands 2 mm past it from 13 mm up.
    const tapered = solid({ shaft: [cone(10, 6, 10), cone(20, 10)] })
    expect(clearance({ tool, holder: null, stickout: 43 }, wall(20)).clears).toBe(true)
    expect(clearance({ tool: tapered, holder: null, stickout: 43 }, wall(20)).collisions).toEqual([
      { part: 'shank', height: 13, needs: 20, offset: 2 },
    ])
  })

  it('is neck where a layer is narrower than the shank', () => {
    const stepped = {
      tool: solid({ shaft: [cone(12, 5), cone(18, 10)] }),
      holder: null,
      stickout: 43,
    }
    expect(toolSilhouette(stepped.tool).map((step) => step.part)).toEqual(['neck', 'shank'])
    expect(clearance(stepped, wall(26)).collisions.map((each) => each.part)).toEqual(['shank'])
    expect(clearance(stepped, wall(30)).checked).toEqual(['neck', 'shank'])
  })

  it('stops at the holder face', () => {
    // Material taller than anything, so every step swept is reported: its
    // offset past the ⌀6 cut is its radius less 3.
    const everywhere: ReachCurve = { horizontalOffset: [100], verticalOffset: [100] }
    const long = solid({ shaft: [cone(10, 8), cone(10, 12), cone(10, 14)] })
    const radii = (stickout: number) =>
      clearance({ tool: long, holder: null, stickout }, everywhere).collisions.map(
        (each) => each.offset + 3,
      )
    expect(radii(23)).toEqual([4])
    expect(radii(24)).toEqual([4, 6])
  })

  it('sweeps an empty shaft as none', () => {
    const none = { holder, collet: null, stickout: 40 }
    expect(clearance({ ...none, tool: solid({ shaft: [] }) }, curve)).toEqual(
      clearance({ ...none, tool: solid() }, curve),
    )
  })
})

describe('the tool’s own body against the part', () => {
  // Short flutes on a wide shank: the shank stands 2 mm past the cutting edge
  // and meets the wall 5 mm above the tip.
  const stubby = solid({ fluteLength: 5, shaft: [cylinder(10, 50)] })

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

  it('checks nothing for a tool that states nothing above its flutes', () => {
    expect(toolCollisions(solid(), curve)).toEqual([])
  })

  it('is swept with the same margins as the holder', () => {
    // A radial margin pushes the shank further out from the cut, onto a taller
    // part of the staircase; an axial one lifts the material to meet it.
    const roomy = toolCollisions(stubby, curve, { radial: 1, axial: 0 })
    expect(roomy[0]?.offset).toBe(3)
    expect(roomy[0]?.needs).toBe(30)
    expect(toolCollisions(stubby, curve, { radial: 0, axial: 5 })[0]?.needs).toBe(17)
  })

  it('lets the neck reach a wall the shank above it would meet', () => {
    // ⌀6 cut, ⌀5 neck for 12 mm above 13 mm of flutes, ⌀10 shank from 25 mm:
    // the shank stands 2 mm past the cut, the neck inside it.
    const necked = sectioned(5, 12, 10)
    const wall = (height: number): ReachCurve => ({
      horizontalOffset: [2],
      verticalOffset: [height],
    })
    expect(toolCollisions(necked, wall(25))).toEqual([])
    expect(toolCollisions(necked, wall(26))).toEqual([
      { part: 'shank', height: 25, needs: 26, offset: 2 },
    ])
  })

  it('reports the neck rather than the shank where the relief is one', () => {
    const necked = solid({
      fluteLength: 5,
      shaft: shaft({
        shank: 10,
        overallLength: 57,
        fluteLength: 5,
        neck: { diameter: 9, length: 3 },
      }),
    })
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
