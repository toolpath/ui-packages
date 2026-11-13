import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addSetup,
  findPlaced,
  groupsFromPlan,
  framesOf,
  planFromResults,
  holdsFor,
  indexedFor,
  type Edited,
  moveFeature,
  moveGroup,
  assignInto,
  assignedGroupByTag,
  assignedIn,
  placedGroups,
  setSetupProcess,
  setOrientation,
  nextGroupName,
  moveSetup,
  moveWithin,
  parseDraftSetups,
  assignFrom,
  assignmentOf,
  assignTargetOf,
  removeGroup,
  renameGroup,
  unassignFeature,
  restoreFeature,
  currentFor,
  type DraftSetup,
  liftLoneGroup,
  removeGroups,
  doneAsSaved,
  withDone,
  withoutDone,
  withGroups,
} from '../../src/draft/constraints'
import { statementOf } from '../../src/draft/statement'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

describe('the statement', () => {
  const setups: Array<DraftSetup> = [
    { id: 'a', name: 'A', direction: up, features: [], groups: [] },
    { id: 'b', name: 'B', direction: down, features: [], groups: [] },
    { id: 'c', name: 'C', direction: side, features: [], groups: [] },
  ]

  it('states every frame in order with its assignments, whatever the groups are named', () => {
    const assigned = setups.map((s) =>
      s.id === 'b' ? { ...s, name: 'Top', features: ['p', 'p'] } : s,
    )
    expect(statementOf(assigned)).toEqual({
      setups: [
        { orientations: [{ direction: up, features: [] }] },
        { orientations: [{ direction: down, features: ['p'] }] },
        { orientations: [{ direction: side, features: [] }] },
      ],
    })
  })

  it('states a frame with nothing assigned: a group is a setup Toolpath is held to', () => {
    expect(statementOf([setups[0]!])).toEqual({
      setups: [{ orientations: [{ direction: up, features: [] }] }],
    })
    expect(
      statementOf(moveSetup(setups, 'c', -2))?.setups.map((s) => s.orientations[0]!.direction),
    ).toEqual([side, up, down])
  })

  it('states nothing once every setup is removed: Toolpath decides', () => {
    expect(statementOf([])).toBeNull()
  })
})

describe('editing setups', () => {
  const setups: Array<DraftSetup> = [
    { id: 'id-1', name: 'Group 1', direction: up, features: [], groups: [] },
    { id: 'id-2', name: 'Group 2', direction: down, features: [], groups: [] },
  ]

  it('adds a setup for a direction no setup faces, and only for one', () => {
    expect(addSetup(setups, side, 'new').map((s) => s.id)).toEqual(['id-1', 'id-2', 'new'])
    expect(addSetup(setups, { ...up }, 'new')).toEqual(setups)
  })

  it('removes, moves within the ends, and renames', () => {
    expect(removeGroup(setups, 'id-1').map((s) => s.id)).toEqual(['id-2'])
    expect(moveSetup(setups, 'id-2', -1).map((s) => s.id)).toEqual(['id-2', 'id-1'])
    expect(moveSetup(setups, 'id-2', 5).map((s) => s.id)).toEqual(['id-1', 'id-2'])
    expect(renameGroup(setups, 'id-1', '  Top  ')[0]!.name).toBe('Top')
    expect(renameGroup(setups, 'id-1', '   ')[0]!.name).toBe('Group 1')
  })

  it('names a new group one past the highest, never twice (FLD1)', () => {
    const one = removeGroup(setups, 'id-1')
    expect(addSetup(one, side, 'new').at(-1)?.name).toBe('Group 3')
    expect(nextGroupName([{ name: 'Top' }])).toBe('Group 1')
  })
})

describe('withGroups', () => {
  it('reads a stored draft as a tree, its groups under `groups` or the `folders` they once were', () => {
    const stored = [
      {
        id: 'a',
        name: 'Top',
        direction: up,
        folders: [{ id: 'c', name: 'Work', features: ['2a'] }],
      },
    ] as unknown as Array<DraftSetup>
    expect(withGroups(stored)).toEqual([
      {
        id: 'a',
        name: 'Top',
        direction: up,
        features: [],
        groups: [{ id: 'c', name: 'Work', features: ['2a'], groups: [] }],
      },
    ])
  })
})

describe('parseDraftSetups', () => {
  const valid = { id: 'a', name: 'Top', direction: up, features: ['1f', '1f'], groups: [] }

  it('keeps a well-formed list, each feature once', () => {
    expect(parseDraftSetups([valid])).toEqual([{ ...valid, features: ['1f'] }])
  })

  it('drops the stamps drafts once carried, without a word', () => {
    expect(
      parseDraftSetups([
        { ...valid, removed: ['2a'], removedOnPlan: 'p/j', addedOnPlan: 'p/j', work: true },
      ]),
    ).toEqual([{ ...valid, features: ['1f'] }])
  })

  it('says what is wrong with one that is not, as a kind', () => {
    const why = (value: unknown) => parseDraftSetups(value)
    expect(why('nope')).toEqual({ invalid: { kind: 'noSetups' } })
    expect(why(Array.from({ length: 65 }, () => valid))).toEqual({
      invalid: { kind: 'tooManySetups', max: 64 },
    })
    expect(why([{ ...valid, direction: { x: 0 } }])).toEqual({
      invalid: { kind: 'setupDirection' },
    })
    expect(why([{ ...valid, process: '5axis' }])).toEqual({ invalid: { kind: 'setupProcess' } })
    expect(why([{ ...valid, name: undefined }])).toEqual({ invalid: { kind: 'groupId' } })
    expect(why([valid, { ...valid, direction: down }])).toEqual({ invalid: { kind: 'groupId' } })
    expect(
      why([
        { ...valid, features: [], groups: [{ id: 'c', name: 'C', direction: 'up', features: [] }] },
      ]),
    ).toEqual({ invalid: { kind: 'groupDirection' } })
    expect(why([{ ...valid, features: ['XYZ'] }])).toEqual({ invalid: { kind: 'notFeatureTags' } })
    expect(why([valid, { ...valid, id: 'b', features: [] }])).toEqual({
      invalid: { kind: 'directionTwice' },
    })
    expect(why([valid, { ...valid, id: 'b', direction: down }])).toEqual({
      invalid: { kind: 'assignedTwice' },
    })
  })

  it('reads a group holding features and groups both', () => {
    const child = { id: 'c', name: 'Work', features: ['2a'], groups: [] }
    expect(parseDraftSetups([{ ...valid, groups: [child] }])).toEqual([
      { ...valid, features: ['1f'], groups: [child] },
    ])
  })

  it('reads a draft stored with its groups under `folders`', () => {
    const child = { id: 'c', name: 'Work', features: ['2a'], folders: [] }
    expect(
      parseDraftSetups([{ ...valid, features: [], groups: undefined, folders: [child] }]),
    ).toEqual([
      { ...valid, features: [], groups: [{ id: 'c', name: 'Work', features: ['2a'], groups: [] }] },
    ])
  })

  it('reads groups inside setups, and a draft stored before they nested', () => {
    const nested = parseDraftSetups([
      {
        ...valid,
        process: '3+2',
        features: [],
        groups: [{ id: 'c', name: 'Tilt', direction: side, features: ['2a'], groups: [] }],
      },
    ])
    expect(nested).toMatchObject([{ process: '3+2', groups: [{ id: 'c', direction: side }] }])
    expect(parseDraftSetups([{ ...valid, groups: undefined }])).toMatchObject([{ groups: [] }])
  })

  it('refuses a group deeper than six, and a tilt another frame is cut from', () => {
    const deep = (depth: number): Record<string, unknown> => ({
      id: `f${depth}`,
      name: 'F',
      features: [],
      groups: depth < 7 ? [deep(depth + 1)] : [],
    })
    expect(parseDraftSetups([{ ...valid, features: [], groups: [deep(1)] }])).toEqual({
      invalid: { kind: 'tooDeep', max: 6 },
    })
    expect(
      parseDraftSetups([
        {
          ...valid,
          process: '3+2',
          features: [],
          groups: [{ id: 'c', name: 'T', direction: down, features: [], groups: [] }],
        },
        { id: 'b', name: 'B', direction: down, features: [], groups: [] },
      ]),
    ).toEqual({ invalid: { kind: 'directionTwice' } })
  })
})

describe('the group tree', () => {
  // A 3+2 setup from above, with a tilt to the side and a grouping of its own work.
  const tree: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      process: '3+2',
      features: ['a'],
      groups: [
        { id: 'pockets', name: 'Pockets', features: ['b'], groups: [] },
        {
          id: 'tilt',
          name: 'Tilt',
          direction: side,
          features: ['c'],
          groups: [{ id: 'chamfers', name: 'Chamfers', features: ['d'], groups: [] }],
        },
      ],
    },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], groups: [] },
  ]

  it('cuts each group from its setup, its orientation, or its parent', () => {
    const cut = Object.fromEntries(placedGroups(tree).map((p) => [p.group.id, p.direction]))
    expect(cut).toEqual({ top: up, pockets: up, tilt: side, chamfers: side, bottom: down })
  })

  it('tells Toolpath one setup per frame, each with the assignments of its followers, in tree order', () => {
    expect(framesOf(tree).map((f) => [f.id, f.holdId, f.features])).toEqual([
      ['top', 'top', ['a', 'b']],
      ['tilt', 'top', ['c', 'd']],
      ['bottom', 'bottom', []],
    ])
    expect(statementOf(tree)?.setups.map((s) => s.orientations[0]!.direction)).toEqual([
      up,
      side,
      down,
    ])
  })

  it('reads a tilt inside a 3 axis setup as following it', () => {
    const flat = tree.map(({ process: _p, ...setup }) => setup)
    expect(findPlaced(flat, 'tilt')?.direction).toEqual(up)
    expect(framesOf(flat).map((f) => f.id)).toEqual(['top', 'bottom'])
  })

  it('groups Toolpath’s setups into holds by the frames they are cut from', () => {
    const planned = [
      { idx: 0, direction: up },
      { idx: 1, direction: side },
      { idx: 2, direction: down },
      { idx: 3, direction: { x: -1, y: 0, z: 0 } },
      { idx: 4, direction: null },
    ]
    // A setup Toolpath added past the frames, or one with no direction, is a hold of its own.
    expect(holdsFor(tree, planned)).toEqual([
      { key: 'top', name: 'Top', setupIdxs: [0, 1] },
      { key: 'bottom', name: 'Bottom', setupIdxs: [2] },
      { key: 'setup:3', name: 'Setup 4', setupIdxs: [3] },
      { key: 'setup:4', name: 'Setup 5', setupIdxs: [4] },
    ])
  })

  it('adds groups six deep at most, named past the highest anywhere', () => {
    const added = addGroup(tree, { parentId: 'pockets', id: 'new' })
    expect(findPlaced(added, 'new')).toMatchObject({
      depth: 2,
      direction: up,
      group: { name: 'Group 1' },
    })
    let deep = tree
    let parent = 'bottom'
    for (let depth = 1; depth <= 7; depth += 1) {
      deep = addGroup(deep, { parentId: parent, id: `d${depth}` })
      parent = findPlaced(deep, `d${depth}`) ? `d${depth}` : parent
    }
    expect(findPlaced(deep, 'd7')).toBeUndefined()
    expect(findPlaced(deep, 'd6')?.depth).toBe(6)
  })

  it('removes a group with everything in it, at any depth', () => {
    expect(framesOf(removeGroup(tree, 'tilt')).map((f) => f.id)).toEqual(['top', 'bottom'])
  })

  it('keeps a setup indexed while it holds orientations, and each tilt one frame', () => {
    expect(setSetupProcess(tree, 'top', undefined)).toEqual({
      refused: { kind: 'hasOrientations' },
    })
    expect(setOrientation(tree, 'pockets', down)).toEqual({
      refused: { kind: 'directionTaken', group: { id: 'bottom', name: 'Bottom' } },
    })
    const tilted = setOrientation(tree, 'pockets', { x: 0, y: 1, z: 0 })
    expect(Array.isArray(tilted) && framesOf(tilted).map((f) => f.id)).toEqual([
      'top',
      'pockets',
      'tilt',
      'bottom',
    ])
  })

  it('assigns into a group, taking the feature from where it was, or lets it go there', () => {
    const moved = assignInto(tree, { groupId: 'pockets', tag: 'a' })
    expect('setups' in moved && findPlaced(moved.setups, 'top')?.group.features).toEqual([])
    expect('setups' in moved && findPlaced(moved.setups, 'pockets')?.group.features).toEqual([
      'b',
      'a',
    ])
    expect(assignInto(tree, { groupId: 'pockets', tag: 'b' })).toMatchObject({ unassigned: true })
  })

  it('indexes about one axis while every tilt lies in one plane through Setup Z', () => {
    expect(indexedFor(up, [side, { x: -1, y: 0, z: 0 }])).toBe('3+1')
    expect(indexedFor(up, [side, { x: 0, y: 1, z: 0 }])).toBe('3+2')
    expect(indexedFor(up, [down])).toBe('3+1')
  })
})

describe('moving groups', () => {
  const two: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      features: ['a'],
      groups: [
        { id: 'pockets', name: 'Pockets', features: ['b'], groups: [] },
        { id: 'holes', name: 'Holes', features: [], groups: [] },
      ],
    },
    { id: 'side', name: 'Side', direction: side, features: ['s'], groups: [] },
  ]
  const moved = (result: ReturnType<typeof moveGroup>) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused.kind)
    }
    return result
  }

  it('reorders in place without changing anything (FLD22)', () => {
    const next = moved(moveGroup(two, { id: 'holes', to: { parentId: 'top', index: 0 } }))
    expect(findPlaced(next, 'top')?.group.groups.map((f) => f.id)).toEqual(['holes', 'pockets'])
  })

  it('makes a setup dropped into another way a tilt, and its new setup 3+1 (FLD26)', () => {
    const next = moved(moveGroup(two, { id: 'side', to: { parentId: 'top', index: 2 } }))
    expect(next.map((s) => [s.id, s.process])).toEqual([['top', '3+1']])
    expect(findPlaced(next, 'side')).toMatchObject({ orientation: true, direction: side })
    expect(framesOf(next).map((f) => [f.id, f.features])).toEqual([
      ['top', ['a', 'b']],
      ['side', ['s']],
    ])
  })

  it('grows 3+1 to 3+2 when a tilt needs a second axis (FLD27)', () => {
    const three = [
      ...two,
      { id: 'back', name: 'Back', direction: { x: 0, y: 1, z: 0 }, features: [], groups: [] },
    ]
    const once = moved(moveGroup(three, { id: 'side', to: { parentId: 'top', index: 2 } }))
    const twice = moved(moveGroup(once, { id: 'back', to: { parentId: 'top', index: 3 } }))
    expect(twice[0]!.process).toBe('3+2')
  })

  it('makes a tilt dropped at the top a setup facing it (FLD24)', () => {
    const tilted = moved(moveGroup(two, { id: 'side', to: { parentId: 'top', index: 2 } }))
    const back = moved(moveGroup(tilted, { id: 'side', to: { parentId: null, index: 1 } }))
    expect(back.map((s) => [s.id, s.direction])).toEqual([
      ['top', up],
      ['side', side],
    ])
  })

  it('refuses a follower at the top, a group into itself, and a direction twice', () => {
    expect(moveGroup(two, { id: 'pockets', to: { parentId: null, index: 0 } })).toMatchObject({
      refused: { kind: 'directionIsSetup', setup: { id: 'top', name: 'Top' } },
    })
    expect(moveGroup(two, { id: 'top', to: { parentId: 'pockets', index: 0 } })).toMatchObject({
      refused: { kind: 'intoItself' },
    })
    expect(moveGroup(two, { id: 'pockets', to: { parentId: 'side', index: 0 } })).toMatchObject({
      refused: { kind: 'directionTaken', group: { id: 'top', name: 'Top' } },
    })
  })

  it('assigns a row where it is dropped, only in a group facing its way', () => {
    expect(moveFeature(two, { tag: 'a', direction: up, groupId: 'holes' })).toSatisfy(
      (next: ReturnType<typeof moveFeature>) =>
        Array.isArray(next) && findPlaced(next, 'holes')?.group.features.includes('a') === true,
    )
    expect(moveFeature(two, { tag: 'a', direction: up, groupId: 'side' })).toEqual({
      refused: { kind: 'otherWay' },
    })
  })
})

describe('dropping into a group', () => {
  const two: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], groups: [] },
    { id: 'side', name: 'Side', direction: side, features: ['s'], groups: [] },
  ]
  const edited = (result: Edited) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused.kind)
    }
    return result
  }

  it('makes a group from another way a tilt inside it, and indexes its setup (FLD26)', () => {
    const next = edited(moveGroup(two, { id: 'side', to: { parentId: 'top', index: 0 } }))
    expect(next.map((s) => [s.id, s.name, s.direction, s.process, s.features])).toEqual([
      ['top', 'Top', up, '3+1', ['a']],
    ])
    expect(next[0]!.groups).toEqual([
      { id: 'side', name: 'Side', direction: side, features: ['s'], groups: [] },
    ])
    expect(framesOf(next).map((f) => [f.direction, f.features])).toEqual([
      [up, ['a']],
      [side, ['s']],
    ])
  })

  it('puts a group from the same way inside it, leaving its id, name and features', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        groups: [
          { id: 'x', name: 'X', features: ['a'], groups: [] },
          { id: 'y', name: 'Y', features: ['b'], groups: [] },
          { id: 'z', name: 'Z', features: [], groups: [] },
        ],
      },
    ]
    const next = edited(moveGroup(tree, { id: 'y', to: { parentId: 'x', index: 0 } }))
    expect(next[0]!.process).toBeUndefined()
    expect(next[0]!.groups.map((f) => f.id)).toEqual(['x', 'z'])
    expect(findPlaced(next, 'x')?.group).toEqual({
      id: 'x',
      name: 'X',
      features: ['a'],
      groups: [{ id: 'y', name: 'Y', features: ['b'], groups: [] }],
    })
  })

  it('splits a group holding work when a group is added to it', () => {
    const next = addGroup(two, { parentId: 'top', id: 'new', workId: 'work' })
    expect(next[0]!.features).toEqual([])
    expect(next[0]!.groups.map((f) => [f.id, f.name, f.features])).toEqual([
      ['work', 'Top', ['a']],
      ['new', 'Group 1', []],
    ])
  })

  it('assigns from a direction into the first group cut from it that holds none', () => {
    const split = addGroup(two, { parentId: 'top', id: 'new', workId: 'work' })
    const assigned = assignFrom(split, { direction: up, tag: 'b', newId: 'id' })
    expect('setups' in assigned && findPlaced(assigned.setups, 'work')?.group.features).toEqual([
      'a',
      'b',
    ])
  })

  it('drops a row on a group holding groups into its own features', () => {
    const split = addGroup(two, { parentId: 'top', id: 'new', workId: 'work' })
    const dropped = edited(moveFeature(split, { tag: 'c', direction: up, groupId: 'top' }))
    expect(dropped[0]!.features).toEqual(['c'])
    expect(dropped[0]!.groups).toEqual(split[0]!.groups)
  })

  it('names the group an assignment from a direction goes in, as assignFrom puts it there', () => {
    const split = addGroup(two, { parentId: 'top', id: 'new', workId: 'work' })
    expect(assignTargetOf(split, up)).toBe('work')
    // Reordered, the first group cut from its way is where assignments go.
    expect(assignTargetOf(moveWithin(split, 'new', -1), up)).toBe('new')
    expect(assignTargetOf(two, up)).toBe('top')
    // A tilt is a frame of its own: an assignment from its way goes in it, not its setup's groups.
    const tilted = setOrientation(
      [{ ...two[0]!, process: '3+1', groups: split[0]!.groups }],
      'new',
      side,
    )
    expect(Array.isArray(tilted) && assignTargetOf(tilted, side)).toBe('new')
    expect(Array.isArray(tilted) && assignTargetOf(tilted, up)).toBe('work')
    // No group faces it: an assignment adds one.
    expect(assignTargetOf(split, { x: 0, y: 1, z: 0 })).toBeNull()
    const assigned = assignFrom(split, { direction: up, tag: 'z', newId: 'id' })
    expect('setups' in assigned && assigned.setupId).toBe(assignTargetOf(split, up))
  })

  describe('a frame holding only tilts', () => {
    // A 3+2 setup from above whose groups are all orientations, cut from other ways.
    const tilts: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        process: '3+2',
        features: [],
        groups: [
          { id: 't1', name: 'Tilt 1', direction: side, features: [], groups: [] },
          { id: 't2', name: 'Tilt 2', direction: { x: 0, y: 1, z: 0 }, features: [], groups: [] },
        ],
      },
    ]

    it('names the frame, and an assignment goes in its own features', () => {
      expect(assignTargetOf(tilts, up)).toBe('top')
      const assigned = assignFrom(tilts, { direction: up, tag: 'b', newId: 'f' })
      if (!('setups' in assigned)) {
        throw new Error(assigned.refused.kind)
      }
      expect(assigned).toMatchObject({ setupId: 'top', added: false, unassigned: false })
      expect(assigned.setups[0]!.features).toEqual(['b'])
      expect(assigned.setups[0]!.groups).toEqual(tilts[0]!.groups)
      expect(parseDraftSetups(assigned.setups)).toEqual(assigned.setups)
      expect(framesOf(assigned.setups)[0]).toMatchObject({ id: 'top', features: ['b'] })
      const again = assignFrom(assigned.setups, { direction: up, tag: 'c', newId: 'g' })
      expect('setups' in again && again.setups[0]!.features).toEqual(['b', 'c'])
    })

    it('drops a row on the frame into its own features, and a tilt’s way into the tilt', () => {
      const dropped = moveFeature(tilts, { tag: 'c', direction: up, groupId: 'top' })
      if (!Array.isArray(dropped)) {
        throw new Error(dropped.refused.kind)
      }
      expect(dropped[0]!.features).toEqual(['c'])
      expect(dropped[0]!.groups).toEqual(tilts[0]!.groups)
      const tilted = moveFeature(tilts, { tag: 'd', direction: side, groupId: 'top' })
      expect(Array.isArray(tilted) && findPlaced(tilted, 't1')?.group.features).toEqual(['d'])
    })
  })

  it('finds an assignment in any case, as the assignment spells it', () => {
    const assigned: Array<DraftSetup> = [
      { id: 'top', name: 'Top', direction: up, features: ['H2'], groups: [] },
    ]
    expect(assignmentOf(assigned, 'h2')).toEqual({ groupId: 'top', tag: 'H2' })
    expect(assignmentOf(assigned, 'H3')).toBeNull()
  })
})

describe('no group holds a single group', () => {
  const two: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], groups: [] },
    { id: 'side', name: 'Side', direction: side, features: ['s'], groups: [] },
  ]
  const edited = (result: Edited) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused.kind)
    }
    return result
  }
  // Top and Side side by side in a 3+1 setup, Side a tilt of it.
  const paired: Array<DraftSetup> = [
    {
      id: 'p',
      name: 'Group 1',
      direction: up,
      process: '3+1',
      features: [],
      groups: [
        { id: 'top', name: 'Top', features: ['a'], groups: [] },
        { id: 'side', name: 'Side', direction: side, features: ['s'], groups: [] },
      ],
    },
  ]

  it('lets a group taken out of a pair come up into the pair’s place, as it was', () => {
    const next = edited(moveGroup(paired, { id: 'side', to: { parentId: null, index: 1 } }))
    // Top is a setup again, not indexed — there is no tilt left in it to turn to.
    expect(next.map((s) => [s.id, s.name, s.direction, s.process, s.features])).toEqual([
      ['top', 'Top', up, undefined, ['a']],
      ['side', 'Side', side, undefined, ['s']],
    ])
    expect(next[0]!.groups).toEqual([])
  })

  it('makes a lone tilt left at the top a setup facing it', () => {
    const next = removeGroup(paired, 'top')
    expect(next.map((s) => [s.id, s.direction, s.process, s.features])).toEqual([
      ['side', side, undefined, ['s']],
    ])
  })

  // A setup holding a group of two, and a group beside the group.
  const grouped: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      features: [],
      groups: [
        {
          id: 'p',
          name: 'Group',
          features: [],
          groups: [
            { id: 'x', name: 'X', features: ['a'], groups: [] },
            { id: 'y', name: 'Y', features: ['b'], groups: [] },
          ],
        },
        { id: 'z', name: 'Z', features: ['c'], groups: [] },
      ],
    },
  ]

  it('lifts the one group left in a group into the group’s place', () => {
    const next = removeGroup(grouped, 'y')
    expect(next[0]!.groups.map((f) => [f.id, f.name, f.features])).toEqual([
      ['x', 'X', ['a']],
      ['z', 'Z', ['c']],
    ])
  })

  it('takes out every group picked together, the group with one in it included', () => {
    // X first, then its group: X going leaves the group lone, but the group is going too.
    const next = removeGroups(grouped, ['x', 'p'])
    expect(findPlaced(next, 'y')).toBeUndefined()
    // That leaves Top holding just Z, which comes up into it: the setup, cut the same way.
    expect(next.map((s) => [s.id, s.direction, s.features])).toEqual([['z', up, ['c']]])
  })

  it('leaves a group holding two groups, or work of its own, as it is', () => {
    expect(liftLoneGroup(paired, 'p')).toEqual(paired)
    expect(liftLoneGroup(two, 'top')).toEqual(two)
  })

  it('leaves a saved group holding just one alone when something else is edited', () => {
    const saved: Array<DraftSetup> = [
      {
        id: 's',
        name: 'Saved',
        direction: up,
        process: '3+1',
        features: [],
        groups: [{ id: 'f', name: 'F', features: ['a'], groups: [] }],
      },
      ...two.slice(1),
    ]
    const next = removeGroup(saved, 'side')
    expect(next.map((s) => [s.id, s.name, s.process])).toEqual([['s', 'Saved', '3+1']])
  })

  it('splits an empty group in two when a group is added to it, never holding just the one', () => {
    const empty: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        groups: [
          { id: 'x', name: 'X', features: ['a'], groups: [] },
          { id: 'y', name: 'Y', features: [], groups: [] },
        ],
      },
    ]
    const next = addGroup(empty, { parentId: 'y', id: 'new', workId: 'kept' })
    expect(findPlaced(next, 'y')?.group.groups.map((f) => [f.id, f.name])).toEqual([
      ['kept', 'Y'],
      ['new', 'Group 1'],
    ])
  })
})

describe('no group holds a single group: how what comes up is cut', () => {
  it('makes a lone tilt come up to the top a setup indexed to reach the tilts inside it', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        process: '3+1',
        features: [],
        groups: [
          {
            id: 'side',
            name: 'Side',
            direction: side,
            features: [],
            groups: [
              // A tilt inside Side, turned from it about one axis: one tilt is always 3+1.
              { id: 't', name: 'T', direction: up, features: ['b'], groups: [] },
              { id: 'f', name: 'F', features: ['c'], groups: [] },
            ],
          },
          { id: 'other', name: 'Other', features: ['d'], groups: [] },
        ],
      },
    ]
    const next = removeGroup(tree, 'other')
    expect(next.map((s) => [s.id, s.direction, s.process])).toEqual([['side', side, '3+1']])
  })

  it('keeps a tilt come up inside a setup as it was: a tilt is its own frame', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        groups: [
          {
            id: 'p',
            name: 'Group',
            features: [],
            groups: [
              { id: 'x', name: 'X', direction: side, features: ['a'], groups: [] },
              { id: 'y', name: 'Y', features: ['b'], groups: [] },
            ],
          },
          { id: 'z', name: 'Z', features: ['c'], groups: [] },
        ],
      },
    ]
    const next = removeGroup(tree, 'y')
    expect(findPlaced(next, 'x')?.group).toEqual({
      id: 'x',
      name: 'X',
      direction: side,
      features: ['a'],
      groups: [],
    })
  })
})

describe('assigning features', () => {
  const setups: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], groups: [] },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], groups: [] },
  ]

  it('assigns a feature from its direction’s setup, and lets it go on a second click', () => {
    const assigned = assignFrom(setups, { direction: { ...down }, tag: 'b', newId: 'new' })
    expect(assigned).toMatchObject({ setupId: 'bottom', added: false, unassigned: false })
    expect('setups' in assigned && assigned.setups[1]!.features).toEqual(['b'])

    const released = assignFrom(setups, { direction: up, tag: 'a', newId: 'new' })
    expect(released).toMatchObject({ setupId: 'top', unassigned: true })
  })

  it('adds a setup for a direction no setup faces, holding the feature', () => {
    const assigned = assignFrom(setups, { direction: side, tag: 'c', newId: 'new' })
    expect(assigned).toMatchObject({ setupId: 'new', added: true })
    expect('setups' in assigned && assigned.setups.at(-1)).toMatchObject({
      id: 'new',
      direction: side,
      features: ['c'],
    })
  })

  it('assigns a profile into any setup, leaving Toolpath to refuse it', () => {
    expect(assignFrom(setups, { direction: down, tag: 'profile', newId: 'new' })).toMatchObject({
      setupId: 'bottom',
    })
  })

  it('gives a feature assigned in more than one group the first of them in tree order', () => {
    const twice: Array<DraftSetup> = [
      {
        id: 's1',
        name: 'Group 1',
        direction: up,
        features: [],
        groups: [
          { id: 'nested', name: 'Group 2', features: ['t'], groups: [] },
          { id: 'other', name: 'Group 3', features: ['u'], groups: [] },
        ],
      },
      { id: 's2', name: 'Group 4', direction: down, features: ['t'], groups: [] },
    ]
    expect(assignedGroupByTag(twice).get('t')).toBe('nested')
  })

  it('finds and lets go an assignment whatever case its tag is spelled in', () => {
    // Toolpath and the analysis spell a tag differently: 'f' assigned is Toolpath's 'F'.
    const lower: Array<DraftSetup> = [
      { id: 'top', name: 'Top', direction: up, features: ['f'], groups: [] },
    ]
    expect(assignedIn(lower, 'F')).toBe('top')
    expect(assignedGroupByTag(lower).get('f')).toBe('top')
    expect(unassignFeature(lower, 'top', 'F')[0]!.features).toEqual([])
    expect(assignInto(lower, { groupId: 'top', tag: 'F' })).toMatchObject({ unassigned: true })
  })

  it('unassigns from a named setup only', () => {
    expect(unassignFeature(setups, 'top', 'a')[0]!.features).toEqual([])
    expect(unassignFeature(setups, 'bottom', 'a')[0]!.features).toEqual(['a'])
  })
})

describe('moveWithin', () => {
  const child = (id: string) => ({ id, name: id, features: [], groups: [] })
  const setups = [
    {
      id: 's',
      name: 'S',
      direction: up,
      features: [],
      groups: [child('a'), child('b'), child('c')],
    },
    { id: 't', name: 'T', direction: down, features: [], groups: [] },
  ]

  it('moves a group among the groups beside it, clamped to the ends', () => {
    const order = (next: ReturnType<typeof moveWithin>) => next[0]!.groups.map((f) => f.id)
    expect(order(moveWithin(setups, 'c', -1))).toEqual(['a', 'c', 'b'])
    expect(order(moveWithin(setups, 'a', -1))).toEqual(['a', 'b', 'c'])
    expect(order(moveWithin(setups, 'a', 5))).toEqual(['b', 'c', 'a'])
  })

  it('moves a setup among the setups', () => {
    expect(moveWithin(setups, 't', -1).map((s) => s.id)).toEqual(['t', 's'])
  })
})

describe('currentFor', () => {
  it('keeps a list stamped with what holds now, or not stamped, and lets the rest go', () => {
    expect(currentFor([1, 2], 'k1', 'k1')).toEqual([1, 2])
    expect(currentFor([1, 2], null, 'k1')).toEqual([1, 2])
    expect(currentFor([1, 2], 'k1', 'k2')).toEqual([])
    expect(currentFor([1, 2], 'k1', null)).toEqual([])
    expect(currentFor(undefined, undefined, 'k1')).toEqual([])
  })
})

/** The setups an assignment made, where it was not refused. */
const assignedSetups = (result: ReturnType<typeof assignInto>): Array<DraftSetup> => {
  if ('refused' in result) {
    throw new Error(result.refused.kind)
  }
  return result.setups
}

describe('restoreFeature', () => {
  const saved: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a', 'p', 'b'], groups: [] },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], groups: [] },
  ]

  it('puts an assignment back at its place, and takes it out of where it went since', () => {
    const moved = assignedSetups(
      assignInto(unassignFeature(saved, 'top', 'p'), { groupId: 'bottom', tag: 'p' }),
    )
    const back = restoreFeature(moved, saved, 'p')
    expect(back[0]?.features).toEqual(['a', 'p', 'b'])
    expect(back[1]?.features).toEqual([])
  })

  it('takes out an assignment saved nowhere', () => {
    const assigned = assignedSetups(assignInto(saved, { groupId: 'top', tag: 't' }))
    expect(restoreFeature(assigned, saved, 't')[0]?.features).toEqual(['a', 'p', 'b'])
  })

  it('leaves every other edit, and passes over a group gone since', () => {
    const renamed = renameGroup(
      removeGroup(assignedSetups(assignInto(saved, { groupId: 'bottom', tag: 'q' })), 'top'),
      'bottom',
      'Under',
    )
    expect(restoreFeature(renamed, saved, 'p')).toEqual(renamed)
  })

  it('takes an assignment out of a group made since the save', () => {
    const more = [
      ...saved,
      { id: 'x', name: 'Side', direction: side, features: [], groups: [] },
    ] as Array<DraftSetup>
    const moved = assignedSetups(assignInto(more, { groupId: 'x', tag: 'p' }))
    expect(moved[0]?.features).toEqual(['a', 'b'])
    expect(moved[2]?.features).toEqual(['p'])
    const back = restoreFeature(moved, saved, 'p')
    expect(back[0]?.features).toEqual(['a', 'p', 'b'])
    expect(back[2]?.features).toEqual([])
  })
})

describe('the faces done', () => {
  it('adds faces once each, sorted, numbered by the kernel; another kernel’s are let go first', () => {
    expect(withDone({ done: [5, 3], doneKernel: 'k1' }, [3, 1], 'k1')).toEqual({
      done: [1, 3, 5],
      doneKernel: 'k1',
    })
    expect(withDone({ done: [5], doneKernel: 'k0' }, [1], 'k1')).toEqual({
      done: [1],
      doneKernel: 'k1',
    })
  })

  it('takes faces out, letting the kernel go with the last of them', () => {
    expect(withoutDone({ done: [3, 5], doneKernel: 'k1' }, [3], 'k1')).toEqual({
      done: [5],
      doneKernel: 'k1',
    })
    expect(withoutDone({ done: [3], doneKernel: 'k1' }, [3], 'k1')).toEqual({
      done: [],
      doneKernel: null,
    })
  })

  it('puts faces back as saved, every other as the plan has it, on one kernel', () => {
    const saved = { done: [3, 8], doneKernel: 'k1' }
    expect(doneAsSaved({ done: [5, 8], doneKernel: 'k1' }, saved, [3, 5], 'k1')).toEqual({
      done: [3, 8],
      doneKernel: 'k1',
    })
    // Numbered by another kernel, the plan's faces are let go as any change lets them go.
    expect(doneAsSaved({ done: [5], doneKernel: 'k0' }, saved, [3], 'k1')).toEqual({
      done: [3],
      doneKernel: 'k1',
    })
  })
})

describe('groupsFromPlan', () => {
  let count = 0
  const newId = () => `id-${(count += 1)}`
  const orientations = (...directions: Array<typeof up>) => ({
    orientations: directions.map((direction) => ({ direction })),
  })

  it('states a group facing each setup, in order, named as New group names them, with no assignments', () => {
    count = 0
    expect(groupsFromPlan([orientations(up), orientations(side)], newId)).toEqual([
      { id: 'id-1', name: 'Group 1', direction: up, features: [], groups: [] },
      { id: 'id-2', name: 'Group 2', direction: side, features: [], groups: [] },
    ])
  })

  it('holds a setup turned to further directions, each a tilt group inside it', () => {
    count = 0
    const tilt = { x: 0, y: 1, z: 0 }
    const [frame] = groupsFromPlan([orientations(up, side, tilt)], newId)
    expect(frame).toMatchObject({ name: 'Group 1', direction: up, process: '3+2' })
    expect(frame!.groups).toEqual([
      { id: 'id-2', name: 'Group 2', direction: side, features: [], groups: [] },
      { id: 'id-3', name: 'Group 3', direction: tilt, features: [], groups: [] },
    ])
    expect(
      framesOf(groupsFromPlan([orientations(up, side, tilt)], newId)).map((f) => f.direction),
    ).toEqual([up, side, tilt])
  })

  it('puts a following group beside a lone tilt, so no group holds a single group', () => {
    count = 0
    const [frame] = groupsFromPlan([orientations(up, side)], newId)
    expect(frame).toMatchObject({ process: '3+1' })
    expect(frame!.groups).toEqual([
      { id: 'id-2', name: 'Group 2', features: [], groups: [] },
      { id: 'id-3', name: 'Group 3', direction: side, features: [], groups: [] },
    ])
  })

  it('passes over a direction faced already, a setup with none, and anything past MAX_SETUPS', () => {
    count = 0
    expect(
      groupsFromPlan(
        [orientations(up), orientations(up), orientations(), orientations(side, up)],
        newId,
      ).map((setup) => [setup.direction, setup.groups.length]),
    ).toEqual([
      [up, 0],
      [side, 0],
    ])
    const many = Array.from({ length: 70 }, (_, i) => orientations({ x: 1, y: i, z: 0 }))
    expect(groupsFromPlan(many, newId)).toHaveLength(64)
  })
})

describe('planFromResults', () => {
  let count = 0
  const newId = () => `id-${(count += 1)}`
  const tilt = { x: 0, y: 1, z: 0 }
  const facing = (direction: typeof up, ...tags: Array<string>) => ({
    direction,
    features: tags.map((tag) => ({ tag })),
  })

  it('assigns each setup’s features in the group facing it, a row no orientation lists with the first', () => {
    count = 0
    const stated = planFromResults(
      [
        {
          orientations: [facing(up, 'a', 'b')],
          rows: [{ tag: 'a' }, { tag: 'b' }, { tag: '2e' }, { tag: '1f', mark: 'notMachined' }],
        },
        { orientations: [facing(side, 'c')], rows: [{ tag: 'c' }] },
      ],
      newId,
    )
    expect(stated).toEqual([
      { id: 'id-1', name: 'Group 1', direction: up, features: ['a', 'b', '2e'], groups: [] },
      { id: 'id-2', name: 'Group 2', direction: side, features: ['c'], groups: [] },
    ])
    expect(parseDraftSetups(stated)).toEqual(stated)
  })

  it('puts a turned setup’s own features in a follower group beside its tilt groups', () => {
    count = 0
    const [frame] = planFromResults(
      [{ orientations: [facing(up, 'a'), facing(side, 'b'), facing(tilt, 'c')] }],
      newId,
    )
    expect(frame).toMatchObject({ direction: up, process: '3+2', features: [] })
    expect(frame!.groups).toEqual([
      { id: 'id-2', name: 'Group 2', features: ['a'], groups: [] },
      { id: 'id-3', name: 'Group 3', direction: side, features: ['b'], groups: [] },
      { id: 'id-4', name: 'Group 4', direction: tilt, features: ['c'], groups: [] },
    ])
    expect(parseDraftSetups([frame!])).toEqual([frame])
    // Nothing of its own: no follower group beside two tilts.
    count = 0
    const [bare] = planFromResults(
      [{ orientations: [facing(up), facing(side, 'b'), facing(tilt)] }],
      newId,
    )
    expect(bare!.groups.map((group) => group.features)).toEqual([['b'], []])
  })

  it('assigns a feature two orientations list once, in the first, and never one nothing machines', () => {
    count = 0
    const stated = planFromResults(
      [
        {
          orientations: [facing(up, 'a', '1f'), facing(side, 'a', 'b')],
          rows: [{ tag: '1f', mark: 'notMachined' }],
        },
        { orientations: [facing(tilt, 'b', 'a')] },
      ],
      newId,
    )
    expect(stated[0]!.groups.map((group) => group.features)).toEqual([['a'], ['b']])
    expect(stated[1]).toMatchObject({ direction: tilt, features: [] })
    expect(parseDraftSetups(stated)).toEqual(stated)
  })

  it('assigns trimmed features where they were planned, as any other', () => {
    // As `resultsView` lays them out: c2 listed by an orientation, e2 by a row alone, f2 from
    // the side.
    const listed = [{ tag: 'a' }, { tag: 'c2', trimmed: true }]
    const rows = [{ tag: 'a' }, { tag: 'c2', trimmed: true }, { tag: 'e2', trimmed: true }]
    const fromSide = [{ tag: 'f2', trimmed: true }]
    count = 0
    const stated = planFromResults(
      [
        { orientations: [{ direction: up, features: listed }], rows },
        { orientations: [{ direction: side, features: fromSide }] },
      ],
      newId,
    )
    expect(stated.map((setup) => setup.features)).toEqual([['a', 'c2', 'e2'], ['f2']])
    expect(parseDraftSetups(stated)).toEqual(stated)
  })

  it('states the same groups as groupsFromPlan, assignments apart', () => {
    const planned = [{ orientations: [facing(up, 'a'), facing(side, 'b')] }]
    count = 0
    const groups = groupsFromPlan(planned, newId)
    count = 0
    const withAssignments = planFromResults(planned, newId)
    const bare = (setups: typeof withAssignments) =>
      JSON.parse(JSON.stringify(setups, (key, value: unknown) => (key === 'features' ? [] : value)))
    expect(bare(withAssignments)).toEqual(bare(groups))
  })
})
