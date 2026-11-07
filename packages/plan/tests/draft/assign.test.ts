import { describe, expect, it } from 'vitest'
import { unassignFeature, type DraftSetup } from '../../src/draft/constraints'
import {
  chooseReading,
  toggleAssignment,
  assignEdit,
  takeBack,
  replacedBy,
  unmarkAssigned,
  withAssignment,
  type AssignContext,
} from '../../src/draft/assign'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

// 'p' is assigned in Top; 'q' in Bottom, a group of its own.
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['p'], groups: [] },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['q'], groups: [] },
]

describe('replacedBy', () => {
  // 'p' (Top) and 'q' (Bottom) are assigned; 'x' reads p's faces and more from another way; 'w'
  // shares only one of q's faces.
  const regions: Record<string, Array<number>> = {
    p: [1, 2],
    q: [3, 4],
    x: [1, 2, 5],
    w: [4, 6],
  }
  const regionsOf = (tag: string) => regions[tag] ?? []

  it('names the assignments whose every face the new assignment covers, wherever they are', () => {
    expect(replacedBy(setups, 'x', regionsOf)).toEqual([{ setupId: 'top', tag: 'p' }])
  })

  it('keeps an assignment it only overlaps, and never names the feature itself', () => {
    expect(replacedBy(setups, 'w', regionsOf)).toEqual([])
    expect(replacedBy(setups, 'p', regionsOf)).toEqual([])
  })
})

describe('assignEdit', () => {
  const side = { x: 1, y: 0, z: 0 }
  const top = (features: Array<string> = []): DraftSetup => ({
    id: 'top',
    name: 'Top',
    direction: up,
    features,
    groups: [],
  })
  const regions: Record<string, Array<number>> = { a: [1, 2], b: [1, 2, 3], c: [3, 4] }
  const context: AssignContext = { regionsOf: (tag) => regions[tag] ?? [], kernel: 'k1' }

  it('assigns into the group facing its way, its done faces no longer done', () => {
    const result = assignEdit(
      { setups: [top()], done: [1, 7], doneKernel: 'k1' },
      'a',
      { direction: up, newId: 'n' },
      context,
    )
    expect(result).toEqual({
      intent: { setups: [top(['a'])], done: [7], doneKernel: 'k1' },
      setupId: 'top',
      added: false,
      unassigned: false,
      replaced: [],
      unmarked: [1],
    })
  })

  it('adds a group for a direction none faces', () => {
    const result = assignEdit(
      { setups: [top()], done: [], doneKernel: null },
      'a',
      { direction: side, newId: 'n' },
      context,
    )
    expect(result).toEqual({
      intent: {
        setups: [top(), { id: 'n', name: 'Group 1', direction: side, features: ['a'], groups: [] }],
        done: [],
        doneKernel: null,
      },
      setupId: 'n',
      added: true,
      unassigned: false,
      replaced: [],
      unmarked: [],
    })
  })

  it('replaces the assignments it covers, keeps one it only overlaps, and unassigns an assignment assigned again', () => {
    const plan = { setups: [top(['a', 'c'])], done: [], doneKernel: null }
    const result = assignEdit(plan, 'b', { groupId: 'top' }, context)
    expect(result).toEqual({
      intent: { setups: [top(['c', 'b'])], done: [], doneKernel: null },
      setupId: 'top',
      added: false,
      unassigned: false,
      replaced: ['a'],
      unmarked: [],
    })
    const again = assignEdit(plan, 'a', { groupId: 'top' }, context)
    expect(again).toEqual({
      intent: { setups: [top(['c'])], done: [], doneKernel: null },
      setupId: 'top',
      added: false,
      unassigned: true,
      replaced: [],
      unmarked: [],
    })
  })
})

describe('withAssignment', () => {
  it('ends an assignment made by a drop as assignEdit does: covered assignments replaced, its faces unmarked', () => {
    const plan = {
      setups: [{ id: 'top', name: 'Top', direction: up, features: ['a'], groups: [] }],
      done: [1, 7],
      doneKernel: 'k1',
    }
    const dropped = [{ ...plan.setups[0]!, features: ['a', 'b'] }]
    const context: AssignContext = {
      regionsOf: (tag) => ({ a: [1, 2], b: [1, 2, 3] })[tag] ?? [],
      kernel: 'k1',
    }
    expect(withAssignment(plan, 'b', dropped, context)).toEqual({
      intent: {
        setups: [{ ...plan.setups[0]!, features: ['b'] }],
        done: [7],
        doneKernel: 'k1',
      },
      replaced: ['a'],
      unmarked: [1],
    })
  })
})

describe('unmarkAssigned', () => {
  const context: AssignContext = {
    regionsOf: (tag) => ({ a: [1, 2], b: [2, 3] })[tag] ?? [],
    kernel: 'k1',
  }

  it('lets go every done face of the features assigned, and names them', () => {
    const plan = { setups, done: [2, 3, 9], doneKernel: 'k1' }
    expect(unmarkAssigned(plan, ['a', 'b'], context)).toEqual({
      intent: { setups, done: [9], doneKernel: 'k1' },
      unmarked: [2, 3],
    })
  })

  it('leaves the plan as it is where none of their faces is done', () => {
    const plan = { setups, done: [9], doneKernel: 'k1' }
    expect(unmarkAssigned(plan, ['a'], context)).toEqual({ intent: plan, unmarked: [] })
  })
})

describe('toggleAssignment and chooseReading', () => {
  const regions: Record<string, Array<number>> = { p: [1, 2], q: [3, 4], r: [1] }
  const context: AssignContext = { regionsOf: (tag) => regions[tag] ?? [], kernel: 'k1' }
  const saved: Parameters<typeof toggleAssignment>[0] = { setups, done: [], doneKernel: null }
  const top = { id: 'top', name: 'Top' }
  const click = (plan: typeof saved, tag: string, inGroup = false) =>
    toggleAssignment(plan, { tag, direction: up, inGroup }, top, context)

  it('assigns what is not in the group, and unassigns what is', () => {
    const { intent, unmarked } = click(saved, 'r')
    expect(unmarked).toEqual([])
    expect(intent.setups[0]?.features).toEqual(['p', 'r'])
    expect(click(intent, 'r', true)).toEqual({ intent: saved, unmarked: [] })
  })

  it('chooses on an assignment’s line: itself changes nothing; another is assigned in its place', () => {
    const top = { id: 'top', direction: up }
    // q, assigned in Bottom as saved, is clicked here: assigned in Top.
    const { intent } = click(saved, 'q')
    const assigned = { tag: 'q', target: 'assign' as const }
    expect(chooseReading(intent, saved, assigned, 'q', top, context)).toEqual({
      intent,
      chosen: ['q'],
    })
    // Another chosen in its place: q goes as a click takes it out — unassigned, in no group.
    const swapped = chooseReading(intent, saved, assigned, 'r', top, context)
    expect(swapped.intent.setups.map((each) => each.features)).toEqual([['p', 'r'], []])
    expect(swapped.chosen).toEqual(['r'])
  })

  it('assigns another beside a feature a click left in the group, as any assignment: replacing what it covers', () => {
    const top = { id: 'top', direction: up }
    // p is in Top; r is inside it, so covers none of p's faces: added beside it.
    const line = { tag: 'p', target: 'add' as const }
    const added = chooseReading(saved, saved, line, 'r', top, context)
    expect(added.intent.setups.map((each) => each.features)).toEqual([['p', 'r'], ['q']])
    expect(added.chosen).toEqual(['r'])
    expect(chooseReading(saved, saved, line, 'p', top, context).intent).toBe(saved)
    // r in Top, p chosen: p covers every face of r's, and replaces it.
    const inner = { ...saved, setups: [{ ...setups[0]!, features: ['r'] }, setups[1]!] }
    const covering = chooseReading(inner, inner, { tag: 'r', target: 'add' }, 'p', top, context)
    expect(covering.intent.setups.map((each) => each.features)).toEqual([['p'], ['q']])
  })

  it('takes another out in place of a feature taken out, putting that one back; never assigns', () => {
    const top = { id: 'top', direction: up }
    // p and r are in Top as saved; p is taken out by a right click.
    const both = {
      setups: [
        { ...setups[0]!, features: ['p', 'r'] },
        { ...setups[1]!, features: ['q'] },
      ],
      done: [],
      doneKernel: null,
    }
    const out = click(both, 'p', true).intent
    expect(out.setups[0]?.features).toEqual(['r'])
    const line = { tag: 'p', target: 'takeOut' as const }
    const instead = chooseReading(out, both, line, 'r', top, context)
    expect(instead.intent.setups.map((each) => each.features)).toEqual([['p'], ['q']])
    expect(instead.chosen).toEqual(['r'])
    // Itself: as it is. One not in the group is not assigned; p is assigned back as any assignment
    // is, replacing r, whose every face it covers.
    expect(chooseReading(out, both, line, 'p', top, context).intent).toBe(out)
    expect(
      chooseReading(out, both, line, 'q', top, context).intent.setups.map((each) => each.features),
    ).toEqual([['p'], ['q']])
  })

  it('names an assignment’s faces no longer done, and puts them back where another is chosen', () => {
    const markingDone = { ...saved, done: [1, 2], doneKernel: 'k1' }
    const { intent, unmarked } = click(markingDone, 'r')
    expect(Object.keys(click(markingDone, 'r')).sort()).toEqual(['intent', 'unmarked'])
    expect(unmarked).toEqual([1])
    expect(intent.done).toEqual([2])
    // q is chosen in r's place: r's face is done again as saved, and q's faces are not done.
    const here = { id: 'top', direction: up }
    const swapped = chooseReading(
      intent,
      markingDone,
      { tag: 'r', target: 'assign' },
      'q',
      here,
      context,
    )
    expect(swapped.intent.done).toEqual([1, 2])
    expect(swapped.intent.setups[0]?.features).toEqual(['p', 'q'])
  })

  it('changes nothing when an assignment’s line chooses the assignment itself', () => {
    const plan = click(saved, 'r').intent
    const here = { id: 'top', direction: up }
    expect(chooseReading(plan, saved, { tag: 'r', target: 'assign' }, 'r', here, context)).toEqual({
      intent: plan,
      chosen: ['r'],
    })
  })
})

describe('takeBack', () => {
  const regions: Record<string, Array<number>> = { p: [1, 2], x: [1, 2, 5], q: [3, 4] }
  const context = { regionsOf: (tag: string) => regions[tag] ?? [], kernel: 'k1' }
  const saved = { setups, done: [5, 7], doneKernel: 'k1' }

  it('puts back an assignment and the assignments it replaced; other edits, and done faces, stand', () => {
    const assigned = assignEdit(saved, 'x', { groupId: 'bottom' }, context)
    if ('refused' in assigned) {
      throw new Error(assigned.refused.kind)
    }
    // x replaced p in Top; then q was taken out too, and a face done.
    expect(assigned.replaced).toEqual(['p'])
    const later = {
      setups: unassignFeature(assigned.intent.setups, 'bottom', 'q'),
      done: [5, 7, 9],
      doneKernel: 'k1',
    }
    expect(takeBack(later, saved, 'x', context)).toEqual({
      setups: [
        { ...setups[0], features: ['p'] },
        { ...setups[1], features: [] },
      ],
      done: [5, 7, 9],
      doneKernel: 'k1',
    })
  })

  it('puts back the assignments an assignment moved from another group replaced', () => {
    // x, assigned in Bottom as saved, is moved to Top, where it replaces p.
    const moved = assignEdit(
      { ...saved, setups: [setups[0]!, { ...setups[1]!, features: ['x'] }] },
      'x',
      { groupId: 'top' },
      context,
    )
    if ('refused' in moved) {
      throw new Error(moved.refused.kind)
    }
    expect(moved.replaced).toEqual(['p'])
    expect(
      takeBack(
        moved.intent,
        { ...saved, setups: [setups[0]!, { ...setups[1]!, features: ['x'] }] },
        'x',
        context,
      ).setups,
    ).toEqual([setups[0], { ...setups[1], features: ['x'] }])
  })

  it('puts back only a feature taken out, not the assignments its faces cover', () => {
    // x covers p's faces; both are assigned as saved, and both have since been let go.
    const both: Array<DraftSetup> = [
      { ...setups[0]!, features: ['p'] },
      { ...setups[1]!, features: ['x'] },
    ]
    const asSaved = { setups: both, done: [], doneKernel: null }
    const plan = {
      ...asSaved,
      setups: unassignFeature(unassignFeature(both, 'top', 'p'), 'bottom', 'x'),
    }
    expect(takeBack(plan, asSaved, 'x', context).setups.map((each) => each.features)).toEqual([
      [],
      ['x'],
    ])
  })
})
