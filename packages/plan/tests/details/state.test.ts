import { describe, expect, it } from 'vitest'
import { readingOf, stateOf, type PlanReading } from '../../src/details/state'
import type { Coverage, CoverageKind, Face } from '../../src/faces/coverage'
import type { PlanSetupView } from '../../src/results/plan-view'

describe('stateOf', () => {
  const names: Record<string, string> = {
    g1: 'Group 1',
    g2: 'Group 2',
    g3: 'Group 3',
    g4: 'Group 4',
  }
  const view = (id: string, tags: Array<string> = []): PlanSetupView =>
    ({
      id,
      name: names[id],
      orientations: [{ features: tags.map((tag) => ({ tag, label: tag.toUpperCase() })) }],
    }) as unknown as PlanSetupView
  const ref = (id: string) => ({ id, name: names[id] })
  // a and b read faces 1–2 from two ways; pocket holds floor; w shares face 2.
  const regions: Record<string, Array<number>> = {
    a: [1, 2],
    b: [1, 2],
    w: [2],
    c: [3],
    pocket: [4, 5, 6],
    floor: [5],
  }
  const regionsOf = (tag: string) => regions[tag] ?? []
  const reading = (
    groups: Array<PlanSetupView>,
    kinds: Record<number, CoverageKind> = {},
  ): PlanReading => ({ groups, kindOf: (region) => kinds[region] ?? 'open' })

  it('reads a feature’s kind, and the groups it is assigned in', () => {
    expect(stateOf('c', reading([view('g1')]), regionsOf)).toEqual({ kind: 'open', groups: [] })
    expect(stateOf('c', reading([view('g1')], { 3: 'done' }), regionsOf)).toEqual({
      kind: 'done',
      groups: [],
    })
    expect(
      stateOf('c', reading([view('g1'), view('g2', ['c'])], { 3: 'assigned' }), regionsOf),
    ).toEqual({ kind: 'assigned', groups: [ref('g2')] })
  })

  it('reads the same faces read another way as assigned where those are', () => {
    const plan = reading([view('g1'), view('g2', ['b'])], { 1: 'assigned', 2: 'assigned' })
    expect(stateOf('a', plan, regionsOf)).toEqual({ kind: 'assigned', groups: [ref('g2')] })
  })

  it('reads a feature inside another as part of it, with every group that holds it', () => {
    const plan = reading([view('g1'), view('g2', ['pocket']), view('g3', ['pocket'])], {
      5: 'assigned',
    })
    expect(stateOf('floor', plan, regionsOf)).toEqual({
      kind: 'partOf',
      whole: { tag: 'pocket', label: 'POCKET' },
      groups: [ref('g2'), ref('g3')],
    })
  })

  it('names no group for faces only shared with a row there, where they are open', () => {
    // w, in Group 2, shares only face 2 of a's.
    const plan = reading([view('g1'), view('g2', ['w'])])
    expect(stateOf('a', plan, regionsOf)).toEqual({ kind: 'open', groups: [] })
  })

  it('names the groups sharing a face, where the faces are assigned', () => {
    const plan = reading([view('g1'), view('g2', ['w'])], { 2: 'assigned' })
    expect(stateOf('a', plan, regionsOf)).toEqual({ kind: 'assigned', groups: [ref('g2')] })
  })
})

describe('readingOf', () => {
  it('reads each face’s kind from the coverage, and open where it has none', () => {
    const face = (region: number) => ({ region }) as unknown as Face
    const coverage: Coverage = {
      total: 2,
      faces: { assigned: [face(1)], done: [face(2)], open: [], machined: [], notMachined: [] },
    }
    const groups: Array<PlanSetupView> = []
    const plan = readingOf(groups, coverage)
    expect([1, 2, 3].map(plan.kindOf)).toEqual(['assigned', 'done', 'open'])
    expect(plan.groups).toBe(groups)
    expect(readingOf(groups, null).kindOf(1)).toBe('open')
  })
})
