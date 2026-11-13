import { describe, expect, it } from 'vitest'
import {
  actionsFor,
  applyDraftAction,
  DRAFT_ACTION_KINDS,
  type ActionTarget,
  type DraftAction,
  type DraftActionKind,
  type DraftFacts,
  type DraftResult,
} from '../../src/draft/actions'
import { markDoneEdit, takeBackDone } from '../../src/draft/done'
import {
  chooseReading,
  toggleAssignment,
  assignEdit,
  unmarkAssigned,
  withAssignment,
} from '../../src/draft/assign'
import {
  addGroup,
  currentFor,
  findPlaced,
  groupsFromPlan,
  MAX_DEPTH,
  MAX_SETUPS,
  moveFeature,
  moveGroup,
  moveWithin,
  assignedIn,
  planFromResults,
  removeGroup,
  removeGroups,
  setOrientation,
  unassignFeature,
  type Constraints,
  type DraftSetup,
  sameDirection,
  type PlannedSetup,
  type PlanRules,
} from '../../src/draft/constraints'
import type { PlanDirection } from '../../src/results/plan'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

// Top holds two groups: Pockets (assigned 'p') and Holes (assigned 'h'). Bottom is assigned 'q'.
const setups: Array<DraftSetup> = [
  {
    id: 'top',
    name: 'Top',
    direction: up,
    features: [],
    groups: [
      { id: 'pockets', name: 'Pockets', features: ['p'], groups: [] },
      { id: 'holes', name: 'Holes', features: ['h'], groups: [] },
    ],
  },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['q'], groups: [] },
]

const regions: Record<string, Array<number>> = { p: [1, 2], h: [3], q: [4], x: [1, 2, 5], s: [6] }
const rules: PlanRules = { regionsOf: (tag) => regions[tag] ?? [], kernel: 'k1' }

/** A draft with something of its own beside the constraints, which every action keeps. */
const draft = { setups, done: [] as Array<number>, doneKernel: null, inputs: 'kept' }
type Draft = Constraints & { inputs: string }

const apply = (action: DraftAction, from: Draft = draft, saved: Constraints = draft) =>
  applyDraftAction(from, action, rules, saved)

const NO_FACTS: DraftFacts = {
  replaced: [],
  unmarked: [],
  unassigned: [],
  added: false,
}

const made = <T extends Constraints>(result: DraftResult<T>): T => {
  if ('refused' in result) {
    throw new Error(`refused: ${result.refused.kind}`)
  }
  return result.draft
}

/** Setup S with groups nested to the deepest a group may sit; the last is `f${MAX_DEPTH}`. */
const deepest = (): Array<DraftSetup> => {
  let deep: Array<DraftSetup> = [{ id: 's', name: 'S', direction: up, features: [], groups: [] }]
  let parent = 's'
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    deep = addGroup(deep, { parentId: parent, id: `f${depth}`, workId: `w${depth}` })
    parent = `f${depth}`
  }
  return deep
}

/** Sample actions of a kind for a target, with new ids: what a page might send. */
const samplesOf = (
  kind: DraftActionKind,
  target: ActionTarget,
  from: Draft,
): Array<DraftAction> => {
  const group = 'group' in target ? target.group : 'top'
  const feature = 'feature' in target ? target : { feature: 'x', direction: up }
  const facing = (direction: PlanDirection) =>
    from.setups.find((setup) => sameDirection(setup.direction, direction))?.id ?? 'top'
  switch (kind) {
    case 'addGroup':
      return [{ kind, parentId: group, id: 'new', workId: 'work' }]
    case 'renameGroup':
      return [{ kind, id: group, name: 'Renamed' }]
    case 'remove':
      return [{ kind, groups: 'part' in target ? from.setups.map((setup) => setup.id) : [group] }]
    case 'moveGroup':
      return [
        { kind, id: group, to: { parentId: null, index: from.setups.length - 1 } },
        ...from.setups
          .flatMap((setup) => [setup, ...setup.groups])
          .map((each): DraftAction => ({
            kind,
            id: group,
            to: { parentId: each.id, index: 0 },
          })),
      ]
    case 'moveWithin':
      return [
        { kind, id: group, by: 1 },
        { kind, id: group, by: -1 },
      ]
    case 'addSetup':
      return [{ kind, direction: { x: 0, y: 1, z: 0 }, id: 'new' }]
    case 'setProcess':
      return [{ kind, setupId: group, process: '3+1' }]
    case 'setOrientation':
      return [
        { kind, groupId: group, direction: side },
        { kind, groupId: group, direction: null },
      ]
    case 'assignInto':
      return [
        {
          kind,
          tag: feature.feature,
          direction: feature.direction,
          groupId: facing(feature.direction),
        },
      ]
    case 'assignFrom':
      return [{ kind, tag: feature.feature, direction: feature.direction, newId: 'new' }]
    case 'moveFeature':
      return [
        {
          kind,
          tag: feature.feature,
          direction: feature.direction,
          groupId: 'holes',
        },
      ]
    case 'unassign':
      return [{ kind, tag: feature.feature }]
    case 'markDone':
    case 'unmarkDone':
      return [{ kind, regions: 'faces' in target ? target.faces : [] }]
    // Offered by the page after a click, or where Toolpath's plan is there to start from.
    case 'chooseAssignReading':
    case 'chooseDoneReading':
    case 'fromPlan':
      return []
  }
}

describe('applyDraftAction', () => {
  it('makes the same edit as the function it names, and keeps the rest of the draft', () => {
    const added = apply({ kind: 'addGroup', parentId: 'top', id: 'new', workId: 'w' })
    expect(added).toEqual({
      draft: { ...draft, setups: addGroup(setups, { parentId: 'top', id: 'new', workId: 'w' }) },
      facts: NO_FACTS,
    })
    expect(made(added).inputs).toBe('kept')
    expect(made(apply({ kind: 'moveWithin', id: 'holes', by: -1 })).setups).toEqual(
      moveWithin(setups, 'holes', -1),
    )
  })

  it('answers a refusal of the function it names as it is', () => {
    const to = { parentId: null, index: 0 }
    expect(apply({ kind: 'moveGroup', id: 'holes', to })).toEqual(
      moveGroup(setups, { id: 'holes', to }),
    )
    expect(apply({ kind: 'moveGroup', id: 'holes', to })).toEqual({
      refused: { kind: 'directionIsSetup', setup: { id: 'top', name: 'Top' } },
    })
  })

  it('refuses where the function it names would quietly change nothing', () => {
    expect(apply({ kind: 'addGroup', parentId: 'gone', id: 'n', workId: 'w' })).toEqual({
      refused: { kind: 'groupGone' },
    })
    expect(apply({ kind: 'addSetup', direction: up, id: 'n' })).toEqual({
      refused: { kind: 'directionTaken', group: { id: 'top', name: 'Top' } },
    })
    expect(apply({ kind: 'renameGroup', id: 'gone', name: 'X' })).toEqual({
      refused: { kind: 'groupGone' },
    })
    expect(apply({ kind: 'setProcess', setupId: 'holes', process: '3+1' })).toEqual({
      refused: { kind: 'holdOnlySetup' },
    })
    expect(apply({ kind: 'moveWithin', id: 'holes', by: 0.5 })).toEqual({
      refused: { kind: 'notWholeMove' },
    })
  })

  it('refuses an id the draft holds already, so no two groups share one', () => {
    const taken = { refused: { kind: 'idTaken' } }
    expect(apply({ kind: 'addGroup', parentId: 'top', id: 'holes', workId: 'w' })).toEqual(taken)
    expect(apply({ kind: 'addGroup', parentId: 'top', id: 'n', workId: 'n' })).toEqual(taken)
    expect(apply({ kind: 'addSetup', direction: side, id: 'bottom' })).toEqual(taken)
    expect(apply({ kind: 'assignFrom', tag: 's', direction: side, newId: 'top' })).toEqual(taken)
  })

  it('assigns into a group holding groups in its own features, its groups as they were', () => {
    const into = made(apply({ kind: 'assignInto', tag: 'n', direction: up, groupId: 'top' }))
    expect(into.setups[0]?.features).toEqual(['n'])
    expect(into.setups[0]?.groups).toEqual(setups[0]!.groups)
  })

  it('refuses a group past the deepest a group may sit', () => {
    const at = { ...draft, setups: deepest() }
    expect(
      apply({ kind: 'addGroup', parentId: `f${MAX_DEPTH}`, id: 'n', workId: 'w' }, at),
    ).toEqual({
      refused: { kind: 'tooDeep', max: MAX_DEPTH },
    })
  })

  it('refuses a setup past the most a plan holds', () => {
    const full: Array<DraftSetup> = Array.from({ length: MAX_SETUPS }, (_, i) => ({
      id: `s${i}`,
      name: `S${i}`,
      direction: { x: i + 1, y: 0, z: 0 },
      features: [],
      groups: [],
    }))
    expect(apply({ kind: 'addSetup', direction: up, id: 'n' }, { ...draft, setups: full })).toEqual(
      {
        refused: { kind: 'tooManySetups', max: MAX_SETUPS },
      },
    )
  })

  it('holds a setup 3+1 and back, and tilts a group in it and back', () => {
    const indexed = made(apply({ kind: 'setProcess', setupId: 'top', process: '3+1' }))
    expect(indexed.setups[0]?.process).toBe('3+1')
    const tilted = made(
      apply({ kind: 'setOrientation', groupId: 'holes', direction: side }, indexed),
    )
    expect(tilted.setups).toEqual(setOrientation(indexed.setups, 'holes', side))
    expect(apply({ kind: 'setProcess', setupId: 'top', process: null }, tilted)).toEqual({
      refused: { kind: 'hasOrientations' },
    })
    const straight = made(
      apply({ kind: 'setOrientation', groupId: 'holes', direction: null }, tilted),
    )
    expect(
      made(apply({ kind: 'setProcess', setupId: 'top', process: null }, straight)).setups,
    ).toEqual(setups)
  })

  it('removes groups and assigned features together, as Delete does, passing over what is gone', () => {
    const result = made(
      apply({
        kind: 'remove',
        groups: ['pockets', 'gone'],
        features: [{ tag: 'q', setupId: 'bottom' }],
      }),
    )
    expect(result.setups).toEqual(removeGroups(unassignFeature(setups, 'bottom', 'q'), ['pockets']))
    expect(made(apply({ kind: 'remove', groups: ['top', 'bottom'] })).setups).toEqual([])
  })

  it('assigns as the demo assigns: covered assignments let go, faces unmarked', () => {
    const done = { ...draft, done: [5], doneKernel: 'k1' }
    const result = apply({ kind: 'assignInto', tag: 'x', direction: up, groupId: 'holes' }, done)
    const expected = assignEdit(done, 'x', { groupId: 'holes' }, rules)
    if ('refused' in expected) {
      throw new Error('expected an assignment')
    }
    expect(result).toEqual({
      draft: { ...done, ...expected.intent },
      facts: { ...NO_FACTS, replaced: ['p'], unmarked: [5] },
    })
    expect(made(result).done).toEqual([])
    expect(expected.replaced).toEqual(['p'])
    expect(expected.unmarked).toEqual([5])
  })

  it('refuses an assignment into a group cut from another direction', () => {
    expect(apply({ kind: 'assignInto', tag: 's', direction: side, groupId: 'holes' })).toEqual({
      refused: { kind: 'otherWay' },
    })
  })

  it('assigns from a direction no group faces into a new setup', () => {
    const result = apply({ kind: 'assignFrom', tag: 's', direction: side, newId: 'n' })
    expect(result).toMatchObject({ facts: { added: true } })
    expect(made(result).setups.at(-1)).toMatchObject({ id: 'n', direction: side, features: ['s'] })
  })

  it('drops a row as the tree does: moved, then assigned as any assignment is', () => {
    const moved = moveFeature(setups, { tag: 'x', direction: up, groupId: 'holes' })
    if (!Array.isArray(moved)) {
      throw new Error('expected a move')
    }
    const result = apply({
      kind: 'moveFeature',
      tag: 'x',
      direction: up,
      groupId: 'holes',
    })
    expect(made(result)).toEqual({ ...draft, ...withAssignment(draft, 'x', moved, rules).intent })
    expect(assignedIn(made(result).setups, 'x')).toBe('holes')
  })

  it('assigns a row dropped where it is assigned already as the tree does: faces unmarked', () => {
    const covering = { ...draft, done: [1], doneKernel: 'k1' }
    const result = apply(
      { kind: 'moveFeature', tag: 'p', direction: up, groupId: 'pockets' },
      covering,
    )
    expect(made(result)).toEqual({
      ...covering,
      ...withAssignment(covering, 'p', setups, rules).intent,
    })
    expect(result).toMatchObject({ facts: { unmarked: [1] } })
  })

  it('unassigns wherever the feature is assigned, and changes nothing for one assigned nowhere', () => {
    expect(made(apply({ kind: 'unassign', tag: 'q' })).setups).toEqual(
      unassignFeature(setups, 'bottom', 'q'),
    )
    expect(apply({ kind: 'unassign', tag: 'nowhere' })).toEqual({ draft, facts: NO_FACTS })
  })

  it('marks done faces as Mark done does, letting go of the assignments they cover, and unmarks them', () => {
    const result = apply({ kind: 'markDone', regions: [3] })
    const done = made(result)
    expect(done).toEqual({ ...draft, ...markDoneEdit(draft, [3], rules).intent })
    expect(result).toMatchObject({ facts: { unassigned: [{ tag: 'h', setupId: 'holes' }] } })
    expect(done.done).toEqual([3])
    expect(done.doneKernel).toBe('k1')
    const back = made(apply({ kind: 'unmarkDone', regions: [3] }, done))
    expect(back.done).toEqual([])
  })

  it('refuses what is not an action instead of throwing', () => {
    const not = { refused: { kind: 'notAnAction' } }
    expect(apply({ kind: 'teleport' } as unknown as DraftAction)).toEqual(not)
    expect(apply({ kind: 'toString' } as unknown as DraftAction)).toEqual(not)
    expect(apply(null as unknown as DraftAction)).toEqual(not)
    expect(apply({ kind: 'markDone' } as unknown as DraftAction)).toEqual(not)
    expect(apply({ kind: 'remove' } as unknown as DraftAction)).toEqual(not)
  })
})

/*
  Each action makes the edit Toolpath's quoting app makes for the same click, with the same result.
  The app's own code for each (`src/plan/part-plan.tsx`, `use-assignment-features.ts`,
  `use-markDone-changes.ts`) is copied here as `app…`, and the action is held to it.
*/
describe('the app’s clicks, as actions', () => {
  const placedDirection = (plan: Constraints, groupId: string) =>
    findPlaced(plan.setups, groupId)!.direction

  /** The app’s `pin` (`pinFromList`): `assignEdit`, a refusal leaving the plan as it was. */
  const appAssign = (plan: Constraints, tag: string, at: Parameters<typeof assignEdit>[2]) => {
    const now = assignEdit(plan, tag, at, rules)
    return 'refused' in now ? plan : now.intent
  }

  /** The app's click on the part in an open group (`usePinFeatures.click`). */
  const appGroupClick = (plan: Constraints, tag: string, groupId: string) => {
    const placed = findPlaced(plan.setups, groupId)!
    const inGroup = assignedIn(plan.setups, tag) === groupId
    return toggleAssignment(
      plan,
      { tag, direction: placed.direction, inGroup },
      placed.group,
      rules,
    ).intent
  }

  it('assigns in an open group, and takes out what is assigned there, as a click does', () => {
    const done = { ...draft, done: [5], doneKernel: 'k1' }
    for (const [tag, groupId] of [
      ['x', 'holes'],
      ['h', 'holes'],
      ['p', 'pockets'],
    ] as const) {
      const action = {
        kind: 'assignInto',
        tag,
        direction: up,
        groupId,
      } as const
      expect(made(apply(action, done))).toEqual({
        ...done,
        ...appGroupClick(done, tag, groupId),
      })
    }
    const again = apply({
      kind: 'assignInto',
      tag: 'h',
      direction: up,
      groupId: 'holes',
    })
    expect(assignedIn(made(again).setups, 'h')).toBeNull()
  })

  it('takes an assignment out of a group that faces another way since, as the Feature section does', () => {
    const turned = made(apply({ kind: 'setProcess', setupId: 'top', process: '3+1' }))
    const tilted = made(
      apply({ kind: 'setOrientation', groupId: 'holes', direction: side }, turned),
    )
    const result = apply({ kind: 'assignInto', tag: 'h', direction: up, groupId: 'holes' }, tilted)
    expect(made(result)).toEqual({ ...tilted, ...appAssign(tilted, 'h', { groupId: 'holes' }) })
    expect(assignedIn(made(result).setups, 'h')).toBeNull()
  })

  it('assigns from a direction, or lets go of an assignment made that way, as the Feature section does', () => {
    const done = { ...draft, done: [6], doneKernel: 'k1' }
    for (const [tag, direction] of [
      ['q', down],
      ['s', side],
      ['x', up],
    ] as const) {
      const at = { direction, newId: 'n' }
      expect(made(apply({ kind: 'assignFrom', tag, ...at }, done))).toEqual({
        ...done,
        ...appAssign(done, tag, at),
      })
    }
    const again = apply({ kind: 'assignFrom', tag: 'q', direction: down, newId: 'n' })
    expect(again).toMatchObject({ facts: { added: false } })
    expect(assignedIn(made(again).setups, 'q')).toBeNull()
    expect(
      apply({ kind: 'assignFrom', tag: 's', direction: side, newId: 'n' }, done),
    ).toMatchObject({
      facts: { added: true, unmarked: [6] },
    })
  })

  /**
   * The app's pick among an assignment click's readings (`usePinFeatures.choose`, its `retarget`).
   */
  const appChooseAssign = (
    plan: Constraints,
    saved: Constraints,
    tag: string,
    target: 'assign' | 'add' | 'takeOut',
    reading: string,
    groupId: string,
  ) => {
    const placed = findPlaced(plan.setups, groupId)!
    const assigned = assignedIn(plan.setups, tag) === groupId
    const made =
      target !== 'add' && assigned === (target === 'takeOut')
        ? toggleAssignment(
            plan,
            { tag, direction: placed.direction, inGroup: assigned },
            placed.group,
            rules,
          ).intent
        : plan
    return chooseReading(
      made,
      saved,
      { tag, target },
      reading,
      { id: groupId, direction: placedDirection(plan, groupId) },
      rules,
    ).intent
  }

  it('means another reading of an assignment click, its click standing or undone', () => {
    const clicked = made(apply({ kind: 'assignInto', tag: 'x', direction: up, groupId: 'holes' }))
    const pick = {
      kind: 'chooseAssignReading',
      tag: 'x',
      target: 'assign',
      reading: 'p',
      groupId: 'holes',
    } as const
    for (const plan of [clicked, draft]) {
      expect(made(apply(pick, plan))).toEqual({
        ...plan,
        ...appChooseAssign(plan, draft, 'x', 'assign', 'p', 'holes'),
      })
    }
  })

  it('changes nothing where the group of an assignment click is gone, as the app does', () => {
    const pick = {
      kind: 'chooseAssignReading',
      tag: 'x',
      target: 'assign',
      reading: 'p',
      groupId: 'gone',
    } as const
    expect(apply(pick)).toEqual({ draft, facts: NO_FACTS })
  })

  it('means another reading of a click that took a feature out', () => {
    const out = made(apply({ kind: 'assignInto', tag: 'h', direction: up, groupId: 'holes' }))
    for (const reading of ['x', 'h']) {
      const pick = {
        kind: 'chooseAssignReading',
        tag: 'h',
        target: 'takeOut',
        reading,
        groupId: 'holes',
      } as const
      for (const plan of [out, draft]) {
        expect(made(apply(pick, plan))).toEqual({
          ...plan,
          ...appChooseAssign(plan, draft, 'h', 'takeOut', reading, 'holes'),
        })
      }
    }
  })

  it('means another reading beside a feature a left click left in its group', () => {
    const assignedH = made(apply({ kind: 'assignInto', tag: 'x', direction: up, groupId: 'holes' }))
    for (const reading of ['x', 'h']) {
      const pick = {
        kind: 'chooseAssignReading',
        tag: 'x',
        target: 'add',
        reading,
        groupId: 'holes',
      } as const
      expect(made(apply(pick, assignedH))).toEqual({
        ...assignedH,
        ...appChooseAssign(assignedH, draft, 'x', 'add', reading, 'holes'),
      })
    }
  })

  /** The app's pick among a Mark done click's readings (`useIgnoreChanges.choose`). */
  const appChooseDone = (
    plan: Constraints,
    saved: Constraints,
    tag: string,
    click: { tag: string | null; regions: Array<number> },
  ) => {
    const stands = (each: Constraints) => {
      const done = new Set(currentFor(each.done, each.doneKernel, rules.kernel))
      return click.regions.every((region) => done.has(region))
    }
    if (tag === click.tag && stands(plan)) {
      return plan
    }
    const back = stands(plan) ? takeBackDone(plan, saved, click.regions, rules) : plan
    return markDoneEdit(back, rules.regionsOf(tag), rules).intent
  }

  it('means another reading of a Mark done click, its click standing or undone', () => {
    const click = { tag: 'x', regions: [1, 2, 5] }
    const clicked = made(apply({ kind: 'markDone', regions: click.regions }))
    // A mark done stamped with no kernel counts as the part's own.
    const unstamped = { ...clicked, doneKernel: null }
    const savedMarkingDone = { ...draft, done: [1], doneKernel: 'k1' }
    for (const tag of ['p', 'x']) {
      for (const plan of [clicked, unstamped, draft]) {
        for (const saved of [draft, savedMarkingDone]) {
          const result = apply({ kind: 'chooseDoneReading', tag, click }, plan, saved)
          expect(made(result)).toEqual({ ...plan, ...appChooseDone(plan, saved, tag, click) })
        }
      }
    }
    // The faces it gives back go unsaid, as the app says only what it done.
    expect(made(apply({ kind: 'chooseDoneReading', tag: 'p', click }, clicked)).done).toEqual([
      1, 2,
    ])
    expect(apply({ kind: 'chooseDoneReading', tag: 'p', click }, clicked)).toMatchObject({
      facts: { unmarked: [] },
    })
    expect(made(apply({ kind: 'chooseDoneReading', tag: 'x', click }, clicked))).toBe(clicked)
    expect(apply({ kind: 'chooseDoneReading', tag: 'p', click }, draft)).toMatchObject({
      facts: { unassigned: [{ tag: 'p', setupId: 'pockets' }] },
    })
  })

  it('needs the plan as applied for a pick among readings', () => {
    const pick = {
      kind: 'chooseDoneReading',
      tag: 'p',
      click: { tag: null, regions: [1] },
    } as const
    expect(applyDraftAction(draft, pick, rules)).toEqual({
      refused: { kind: 'needsSaved' },
    })
  })

  const planned: Array<PlannedSetup> = [
    { orientations: [{ direction: up, features: [{ tag: 'p' }] }], rows: [{ tag: 'p' }] },
    { orientations: [{ direction: down }], rows: [{ tag: 'q' }] },
  ]
  /** The ids the app's `crypto.randomUUID()` would make, as the action makes them. */
  const ids = (seed: string) => {
    let count = 0
    return () => `${seed}-${count++}`
  }

  it('starts from Toolpath’s plan as Auto groups and Auto plan do', () => {
    const empty = { ...draft, setups: [], done: [1, 4, 9], doneKernel: 'k1' }
    const groups = apply({ kind: 'fromPlan', planned, assignments: false, idSeed: 'a' }, empty)
    expect(made(groups)).toEqual({ ...empty, setups: groupsFromPlan(planned, ids('a')) })
    const assigned = apply({ kind: 'fromPlan', planned, assignments: true, idSeed: 'a' }, empty)
    const stated = planFromResults(planned, ids('a'))
    expect(made(assigned)).toEqual({
      ...empty,
      ...unmarkAssigned({ ...empty, setups: stated }, ['p', 'q'], rules).intent,
    })
    expect(assigned).toMatchObject({ facts: { unmarked: [1, 4] } })
  })

  it('unmarks nothing for a trimmed feature it assigns: no done face is its own', () => {
    // c' is what marking done face 9 left of a feature; the rules read its faces through
    // `planFeaturesOf`.
    const trimmedRules: PlanRules = {
      regionsOf: (tag) => ({ "c'": [7, 8] })[tag] ?? [],
      kernel: 'k1',
    }
    const empty = { ...draft, setups: [], done: [9], doneKernel: 'k1' }
    const trimmed: Array<PlannedSetup> = [
      { orientations: [{ direction: up, features: [{ tag: "c'" }] }], rows: [{ tag: "c'" }] },
    ]
    const assigned = applyDraftAction(
      empty,
      { kind: 'fromPlan', planned: trimmed, assignments: true, idSeed: 'a' },
      trimmedRules,
    )
    expect(made(assigned)).toMatchObject({ done: [9], setups: [{ features: ["c'"] }] })
    expect(assigned).toMatchObject({ facts: { unmarked: [] } })
  })

  it('starts from Toolpath’s plan only on a plan with no groups', () => {
    expect(apply({ kind: 'fromPlan', planned, assignments: true, idSeed: 'a' })).toEqual({
      refused: { kind: 'notEmpty' },
    })
  })

  it('removes as the tree’s Remove, Remove all, ✕ on assignments and Delete do', () => {
    expect(made(apply({ kind: 'remove', groups: ['holes'] })).setups).toEqual(
      removeGroup(setups, 'holes'),
    )
    expect(made(apply({ kind: 'remove', groups: ['top', 'bottom'] })).setups).toEqual([])
    // A group's ✕ on its assignments (`takeOutFrom`): each unassigned from that group.
    const two = made(apply({ kind: 'assignInto', tag: 's', direction: up, groupId: 'holes' }))
    const out = ['h', 's'].map((tag) => ({ tag, setupId: 'holes' }))
    expect(made(apply({ kind: 'remove', groups: [], features: out }, two)).setups).toEqual(
      ['h', 's'].reduce((all, tag) => unassignFeature(all, 'holes', tag), [...two.setups]),
    )
    // A feature assigned in two groups is taken out of the one named, and stays in the other.
    const twice = {
      ...draft,
      setups: setups.map((setup) =>
        setup.id === 'bottom' ? { ...setup, features: ['q', 'h'] } : setup,
      ),
    }
    const fromBottom = made(
      apply({ kind: 'remove', groups: [], features: [{ tag: 'h', setupId: 'bottom' }] }, twice),
    )
    expect(fromBottom.setups).toEqual(unassignFeature(twice.setups, 'bottom', 'h'))
    expect(assignedIn(fromBottom.setups, 'h')).toBe('holes')
  })
})

describe('actionsFor', () => {
  it('offers a setup its hold, and no orientation while it is 3 axis', () => {
    expect(actionsFor(draft, { group: 'top' }, rules)).toEqual([
      'addGroup',
      'renameGroup',
      'remove',
      'moveGroup',
      'moveWithin',
      'setProcess',
    ])
  })

  it('offers a group in an indexed setup an orientation', () => {
    const indexed = {
      ...draft,
      setups: setups.map((s) => (s.id === 'top' ? { ...s, process: '3+1' as const } : s)),
    }
    expect(actionsFor(draft, { group: 'holes' }, rules)).not.toContain('setOrientation')
    expect(actionsFor(indexed, { group: 'holes' }, rules)).toContain('setOrientation')
  })

  it('offers nothing for a group that is gone', () => {
    expect(actionsFor(draft, { group: 'gone' }, rules)).toEqual([])
  })

  it('offers no new group at the deepest a group may sit', () => {
    const at = { ...draft, setups: deepest() }
    expect(actionsFor(at, { group: `f${MAX_DEPTH}` }, rules)).not.toContain('addGroup')
  })

  it('offers a lone setup no move', () => {
    const lone: DraftSetup = { id: 's', name: 'S', direction: up, features: [], groups: [] }
    expect(actionsFor({ ...draft, setups: [lone] }, { group: 's' }, rules)).toEqual([
      'addGroup',
      'renameGroup',
      'remove',
      'setProcess',
    ])
  })

  it('offers a feature what fits its assignment: elsewhere its way, from its way, or let go', () => {
    expect(actionsFor(draft, { feature: 'p', direction: up }, rules)).toEqual([
      'assignInto',
      'moveFeature',
      'unassign',
    ])
    expect(actionsFor(draft, { feature: 's', direction: side }, rules)).toEqual(['assignFrom'])
    expect(actionsFor(draft, { feature: 'x', direction: up }, rules)).toEqual([
      'assignInto',
      'assignFrom',
      'moveFeature',
    ])
  })

  it('offers a row drop on a parent facing its way, and none where only its own group does', () => {
    // Up is faced by Top, a parent, and Pockets in it: p's own. Dropped on Top, p goes in Top.
    const one: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        groups: [{ id: 'pockets', name: 'Pockets', features: ['p'], groups: [] }],
      },
    ]
    expect(actionsFor({ ...draft, setups: one }, { feature: 'p', direction: up }, rules)).toEqual([
      'assignInto',
      'moveFeature',
      'unassign',
    ])
    const alone = { ...draft, setups: [{ ...one[0]!, features: ['p'], groups: [] }] }
    expect(actionsFor(alone, { feature: 'p', direction: up }, rules)).toEqual(['unassign'])
  })

  it('offers faces mark done or unmark, as they stand', () => {
    const done = { ...draft, done: [3], doneKernel: 'k1' }
    expect(actionsFor(draft, { faces: [3] }, rules)).toEqual(['markDone'])
    expect(actionsFor(done, { faces: [3] }, rules)).toEqual(['unmarkDone'])
    expect(actionsFor(done, { faces: [3, 4] }, rules)).toEqual(['markDone', 'unmarkDone'])
  })

  it('offers the part a setup, and Remove all while there are setups', () => {
    expect(actionsFor(draft, { part: true }, rules)).toEqual(['remove', 'addSetup'])
    expect(actionsFor({ ...draft, setups: [] }, { part: true }, rules)).toEqual(['addSetup'])
  })

  it('offers only what applyDraftAction carries out', () => {
    const indexed = {
      ...draft,
      setups: setups.map((s) => (s.id === 'top' ? { ...s, process: '3+1' as const } : s)),
    }
    const targets: Array<[Draft, ActionTarget]> = [
      [draft, { part: true }],
      [draft, { group: 'top' }],
      [draft, { group: 'holes' }],
      [indexed, { group: 'holes' }],
      [draft, { feature: 'p', direction: up }],
      [draft, { feature: 'x', direction: up }],
      [draft, { feature: 's', direction: side }],
      [{ ...draft, done: [3], doneKernel: 'k1' }, { faces: [3, 4] }],
    ]
    const offered = new Set<DraftActionKind>()
    for (const [from, target] of targets) {
      for (const kind of actionsFor(from, target, rules)) {
        const changes = samplesOf(kind, target, from).some((action) => {
          const result = applyDraftAction(from, action, rules)
          return !('refused' in result) && JSON.stringify(result.draft) !== JSON.stringify(from)
        })
        expect(changes, `${kind} on ${JSON.stringify(target)}`).toBe(true)
        offered.add(kind)
      }
    }
    expect(DRAFT_ACTION_KINDS.filter((kind) => !offered.has(kind))).toEqual([
      'chooseAssignReading',
      'chooseDoneReading',
      'fromPlan',
    ])
  })
})

describe('features Toolpath plans no pass for', () => {
  // 's' is assigned nowhere and 'p' is assigned in Pockets; Toolpath plans no pass for either.
  const noPass = new Set(['s', 'p'])
  const strict: PlanRules = { ...rules, unplannable: (tag) => noPass.has(tag) }
  const applyStrict = (action: DraftAction, from: Draft = draft) =>
    applyDraftAction(from, action, strict, draft)
  const NO_TOOL = { kind: 'noTool' }

  it('refuses every way of assigning one anew', () => {
    const assignments: Array<DraftAction> = [
      { kind: 'assignInto', tag: 's', direction: up, groupId: 'holes' },
      { kind: 'assignFrom', tag: 's', direction: up, newId: 'n' },
      { kind: 'assignFrom', tag: 's', direction: side, newId: 'n' },
      { kind: 'moveFeature', tag: 's', direction: up, groupId: 'holes' },
    ]
    for (const assignment of assignments) {
      expect(applyStrict(assignment)).toEqual({ refused: NO_TOOL })
      expect('draft' in apply(assignment)).toBe(true)
    }
  })

  it('refuses a pick among a click’s readings that assignments one', () => {
    const clicked = made(apply({ kind: 'assignInto', tag: 'x', direction: up, groupId: 'holes' }))
    const pick = {
      kind: 'chooseAssignReading',
      tag: 'x',
      target: 'assign',
      reading: 's',
      groupId: 'holes',
    } as const
    expect(applyStrict(pick, clicked)).toEqual({ refused: NO_TOOL })
  })

  it('lets one assigned already be taken out, let go or moved', () => {
    const takenOut = made(
      applyStrict({ kind: 'assignInto', tag: 'p', direction: up, groupId: 'pockets' }),
    )
    expect(assignedIn(takenOut.setups, 'p')).toBeNull()
    expect(assignedIn(made(applyStrict({ kind: 'unassign', tag: 'p' })).setups, 'p')).toBeNull()
    const moved = made(
      applyStrict({ kind: 'moveFeature', tag: 'p', direction: up, groupId: 'holes' }),
    )
    expect(assignedIn(moved.setups, 'p')).toBe('holes')
  })

  it('assigns any other feature as it would', () => {
    const assignment: DraftAction = {
      kind: 'assignInto',
      tag: 'x',
      direction: up,
      groupId: 'holes',
    }
    expect(applyStrict(assignment)).toEqual(apply(assignment))
  })

  it('offers no assignment of one assigned nowhere, and the rest as before', () => {
    const at = { feature: 's', direction: up }
    expect(actionsFor(draft, at, strict)).toEqual([])
    expect(actionsFor(draft, at, rules)).not.toEqual([])
    const assigned = { feature: 'p', direction: up }
    expect(actionsFor(draft, assigned, strict)).toEqual(actionsFor(draft, assigned, rules))
  })
})
