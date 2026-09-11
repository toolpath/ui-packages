/**
 * Whether the whole stack reaches, not just the cutter.
 *
 * `fit.ts` answers "could this cutter cut this feature". This answers the one a
 * shop acts on — **is there a way to hold it that reaches** — and the two differ
 * often enough to matter.
 *
 * The rule that runs through every case: what the datasheet did not state is not
 * checked and not claimed. An absent stickout, an absent reach and an absent
 * curve each mean "nobody has said", never "zero".
 */

import { describe, expect, it } from 'vitest'

import {
  NOT_MODELLED,
  assemblyAgainst,
  type AssemblyFit,
  type FeatureDemand,
  type Holder,
  type ReachCurve,
  type SweptAssembly,
} from '../src/index.js'

const holder: Holder = {
  clamping: 'collet',
  colletSeries: 'ER16',
  colletProtrusion: 2,
  noseDiameter: 27,
  noseLength: 12,
  bodyDiameter: 42,
  bodyLength: 20,
  projection: 60,
  flangeDiameter: 46,
  gaugeLength: null,
}

const tool = { form: 'flat end mill', geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6 } }

/** A 12 mm wall standing 2 mm out from the cut, rising to 30 mm past 8 mm out. */
const curve: ReachCurve = { horizontalOffset: [2, 8], verticalOffset: [12, 30] }

const held = (stickout: number | null): SweptAssembly => ({
  tool,
  holder,
  collet: null,
  stickout,
})

const reasons = (failures: ReadonlyArray<{ reason: string }>) => failures.map((each) => each.reason)

describe('the cutter’s own checks still run', () => {
  it('cannot be rescued by the way the tool is held', () => {
    // An assembly does not make a tool narrower.
    const wide: FeatureDemand = { featureTag: 'slot-1', maxToolDiameter: 4 }
    expect(reasons(assemblyAgainst(held(19), wide))).toEqual([
      '⌀6 mm is wider than the 4 mm this feature admits',
    ])
  })

  it('passes a stack that meets everything asked of it', () => {
    expect(assemblyAgainst(held(40), { featureTag: 'pocket-1', reachCurve: curve })).toEqual([])
  })
})

describe('whether the stickout reaches', () => {
  const deep: FeatureDemand = { featureTag: 'pocket-1', reachBelowTop: 30 }

  it('refuses a stack that cannot get down there, and says by how much', () => {
    // The holder nose cannot go below the top of the part, so the stickout has
    // to cover the whole distance to the bottom of the feature.
    expect(reasons(assemblyAgainst(held(19), deep))).toEqual([
      '19.0 mm of stickout does not clear 30.0 mm below the part top',
    ])
  })

  it('passes a stack stood out far enough', () => {
    expect(assemblyAgainst(held(30), deep)).toEqual([])
  })

  it('does not check a stickout nobody set', () => {
    // REGO-FIX's powRgrip collets publish no grip length, so those assemblies
    // carry no stickout. Unchecked, rather than guessed and refused.
    expect(assemblyAgainst(held(null), deep)).toEqual([])
  })

  it('does not check a reach the datasheet did not state', () => {
    expect(assemblyAgainst(held(1), { featureTag: 'pocket-1' })).toEqual([])
  })
})

describe('what the stack meets on the way in', () => {
  const walled: FeatureDemand = { featureTag: 'pocket-1', reachCurve: curve }

  it('names each part that collides, as its own reason', () => {
    // Stood out 5 mm into a 30 mm wall: the collet, the nose and the body are
    // all in the material. The flange is above it and is not named.
    const failures = assemblyAgainst(held(5), walled)
    expect(failures).toHaveLength(3)
    expect(failures.every((each) => each.featureTag === 'pocket-1')).toBe(true)
    expect(reasons(failures).join(' ')).toContain('the collet')
    expect(reasons(failures).join(' ')).toContain('the holder nose')
    expect(reasons(failures).join(' ')).toContain('the holder body')
    expect(reasons(failures).join(' ')).not.toContain('the flange')
  })

  it('sweeps nothing where the report carries no curve', () => {
    // An older report is not checked rather than guessed — the same stack, the
    // same stickout, and nothing to sweep it against.
    expect(assemblyAgainst(held(5), { featureTag: 'pocket-1' })).toEqual([])
  })

  it('reports the reach and the collisions together', () => {
    const both = assemblyAgainst(held(5), {
      featureTag: 'pocket-1',
      reachBelowTop: 30,
      reachCurve: curve,
    })
    expect(
      reasons(both).filter((reason) => reason.includes('stickout does not clear')),
    ).toHaveLength(1)
    expect(
      reasons(both).filter((reason) => reason.includes('collides with material')),
    ).toHaveLength(3)
  })
})

describe('what a pass is not a claim about', () => {
  it('names every gap, so nobody reads a pass as more than it is', () => {
    // Each of these is a real hole in the check, stated rather than left for
    // somebody to discover.
    expect([...NOT_MODELLED]).toEqual([
      'holder collision without a reach curve',
      'deflection',
      'bore holder grip',
      'reach without a published collet grip',
    ])
  })
})

describe('a caller’s own assembly comes back intact', () => {
  it('is generic, so a catalog record is not projected onto the contract', () => {
    // The guid and the catalog number are the caller's, and a result that
    // dropped them would send them back to their own list to find the row.
    const record = { ...held(40), guid: 'asm-1', holderCatalog: 'BT30-ER16-60M' }
    const failures = assemblyAgainst(record, { featureTag: 'pocket-1', reachCurve: curve })
    const fit: AssemblyFit<typeof record> = {
      assembly: record,
      fits: failures.length === 0,
      failures,
    }

    expect(fit.fits).toBe(true)
    expect(fit.assembly.holderCatalog).toBe('BT30-ER16-60M')
  })
})
