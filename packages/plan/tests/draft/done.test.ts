import { describe, expect, it } from 'vitest'
import {
  assignedIn,
  type Constraints,
  type DraftSetup,
  type PlanRules,
} from '../../src/draft/constraints'
import { markDoneEdit, takeBackDone, unmarkDoneEdit } from '../../src/draft/done'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

// 'pocket' (1–4) is assigned in Top; 'hole' (5) in Bottom. 'wall' (4) shares a region with the
// pocket; 'slot' is nobody's.
const regions: Record<string, Array<number>> = {
  pocket: [1, 2, 3, 4],
  wall: [4],
  hole: [5],
  slot: [6, 7],
}
const regionsOf = (tag: string) => regions[tag] ?? []
const context: PlanRules = { regionsOf, kernel: 'k1' }
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['pocket'], groups: [] },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['hole'], groups: [] },
]
const plan: Constraints = {
  setups,
  done: [],
  doneKernel: null,
}

describe('markDoneEdit', () => {
  it('marks done regions, leaving an assignment with a region left as it is', () => {
    const { intent: next, unassigned } = markDoneEdit(plan, [4], context)
    expect(next.done).toEqual([4])
    expect(next.doneKernel).toBe('k1')
    expect(unassigned).toEqual([])
    expect(assignedIn(next.setups, 'pocket')).toBe('top')
    expect(assignedIn(next.setups, 'hole')).toBe('bottom')
  })

  it('unassigns a feature whose every region it marks done, plainly: nothing kept out', () => {
    // Regions 1–3 done before; region 4 completes the pocket.
    const before = { ...plan, done: [1, 2, 3], doneKernel: 'k1' }
    const { intent: next, unassigned } = markDoneEdit(before, [4], context)
    expect(unassigned).toEqual([{ tag: 'pocket', setupId: 'top' }])
    expect(next.done).toEqual([1, 2, 3, 4])
    expect(next.setups).toEqual([{ ...setups[0], features: [] }, setups[1]])
    expect(assignedIn(next.setups, 'hole')).toBe('bottom')
  })

  it('unassigns it from every group it is assigned in', () => {
    const twice = { ...plan, setups: [setups[0]!, { ...setups[1]!, features: ['hole', 'pocket'] }] }
    const { intent: next, unassigned } = markDoneEdit(twice, [1, 2, 3, 4], context)
    expect(unassigned).toEqual([
      { tag: 'pocket', setupId: 'top' },
      { tag: 'pocket', setupId: 'bottom' },
    ])
    expect(next.setups.map((each) => each.features)).toEqual([[], ['hole']])
  })

  it('leaves an assignment already done whole alone, when the click is on other regions', () => {
    // The pocket was assigned over regions done before: a statement, not undone by marking done the
    // hole.
    const before = { ...plan, done: [1, 2, 3, 4], doneKernel: 'k1' }
    expect(markDoneEdit(before, [5], context).unassigned).toEqual([
      { tag: 'hole', setupId: 'bottom' },
    ])
  })

  it('adds to what is done, once each, and lets go of regions another analysis numbered', () => {
    expect(
      markDoneEdit({ ...plan, done: [6], doneKernel: 'k1' }, [6, 7], context).intent.done,
    ).toEqual([6, 7])
    expect(
      markDoneEdit({ ...plan, done: [6], doneKernel: 'k0' }, [7], context).intent.done,
    ).toEqual([7])
  })
})

describe('unmarkDoneEdit', () => {
  it('stops marking done regions, letting go of the kernel once none are left', () => {
    expect(unmarkDoneEdit({ ...plan, done: [6, 7], doneKernel: 'k1' }, [6], context)).toMatchObject(
      {
        done: [7],
        doneKernel: 'k1',
      },
    )
    expect(unmarkDoneEdit({ ...plan, done: [6], doneKernel: 'k1' }, [6], context)).toMatchObject({
      done: [],
      doneKernel: null,
    })
  })
})

describe('takeBackDone', () => {
  it('puts the regions back as saved, and nothing else', () => {
    const saved = { ...plan, done: [1], doneKernel: 'k1' }
    const next = markDoneEdit(unmarkDoneEdit(saved, [1], context), [4, 9], context).intent
    expect(takeBackDone(next, saved, [4], context)).toEqual({
      setups,
      done: [9],
      doneKernel: 'k1',
    })
    expect(takeBackDone(next, saved, [1], context).done).toEqual([1, 4, 9])
  })
})
