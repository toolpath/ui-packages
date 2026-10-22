import { describe, expect, it } from 'vitest'
import {
  addFolder,
  addSetup,
  findPlaced,
  foldersFromPlan,
  framesOf,
  planFromResults,
  holdsFor,
  indexedFor,
  type Edited,
  moveFeature,
  moveFolder,
  pinInto,
  pinHomes,
  pinnedIn,
  placedFolders,
  setSetupProcess,
  setToolOrientation,
  nextFolderName,
  moveSetup,
  moveWithin,
  parseDraftSetups,
  pinFrom,
  pinOf,
  pinTargetOf,
  removeFolder,
  renameFolder,
  statementOf,
  unpinFeature,
  restoreFeature,
  currentFor,
  type DraftSetup,
  liftLoneFolder,
  removeFolders,
  ignoredAsSaved,
  withIgnored,
  withoutIgnored,
} from '../src/plan-draft'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

describe('the statement', () => {
  const setups: Array<DraftSetup> = [
    { id: 'a', name: 'A', direction: up, features: [], folders: [] },
    { id: 'b', name: 'B', direction: down, features: [], folders: [] },
    { id: 'c', name: 'C', direction: side, features: [], folders: [] },
  ]

  it('states every frame in order with its pins, whatever the folders are named', () => {
    const pinned = setups.map((s) =>
      s.id === 'b' ? { ...s, name: 'Top', features: ['p', 'p'] } : s,
    )
    expect(statementOf(pinned)).toEqual({
      setups: [
        { orientations: [{ direction: up, features: [] }] },
        { orientations: [{ direction: down, features: ['p'] }] },
        { orientations: [{ direction: side, features: [] }] },
      ],
    })
  })

  it('states a frame with nothing pinned: a folder is a setup Toolpath is held to', () => {
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
    { id: 'id-1', name: 'Folder 1', direction: up, features: [], folders: [] },
    { id: 'id-2', name: 'Folder 2', direction: down, features: [], folders: [] },
  ]

  it('adds a setup for a direction no setup faces, and only for one', () => {
    expect(addSetup(setups, side, 'new').map((s) => s.id)).toEqual(['id-1', 'id-2', 'new'])
    expect(addSetup(setups, { ...up }, 'new')).toEqual(setups)
  })

  it('removes, moves within the ends, and renames', () => {
    expect(removeFolder(setups, 'id-1').map((s) => s.id)).toEqual(['id-2'])
    expect(moveSetup(setups, 'id-2', -1).map((s) => s.id)).toEqual(['id-2', 'id-1'])
    expect(moveSetup(setups, 'id-2', 5).map((s) => s.id)).toEqual(['id-1', 'id-2'])
    expect(renameFolder(setups, 'id-1', '  Top  ')[0]!.name).toBe('Top')
    expect(renameFolder(setups, 'id-1', '   ')[0]!.name).toBe('Folder 1')
  })

  it('names a new folder one past the highest, never twice (FLD1)', () => {
    const one = removeFolder(setups, 'id-1')
    expect(addSetup(one, side, 'new').at(-1)?.name).toBe('Folder 3')
    expect(nextFolderName([{ name: 'Top' }])).toBe('Folder 1')
  })
})

describe('parseDraftSetups', () => {
  const valid = { id: 'a', name: 'Top', direction: up, features: ['1f', '1f'], folders: [] }

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

  it('says what is wrong with one that is not', () => {
    expect(parseDraftSetups('nope')).toBe('The plan has no list of setups.')
    expect(parseDraftSetups([{ ...valid, direction: { x: 0 } }])).toMatch(/direction/)
    expect(parseDraftSetups([{ ...valid, features: ['XYZ'] }])).toMatch(/feature tags/)
    expect(parseDraftSetups([valid, { ...valid, id: 'b', features: [] }])).toMatch(/only once/)
    expect(parseDraftSetups([valid, { ...valid, id: 'b', direction: down }])).toMatch(/one folder/)
  })

  it('refuses a folder holding features and folders both', () => {
    const child = { id: 'c', name: 'Work', features: ['2a'], folders: [] }
    expect(parseDraftSetups([{ ...valid, folders: [child] }])).toBe(
      'A folder holds features or folders, never both.',
    )
    expect(parseDraftSetups([{ ...valid, features: [], folders: [child] }])).toMatchObject([
      { features: [], folders: [{ id: 'c', features: ['2a'] }] },
    ])
  })

  it('reads folders inside setups, and a draft stored before they nested', () => {
    const nested = parseDraftSetups([
      {
        ...valid,
        process: '3+2',
        features: [],
        folders: [{ id: 'c', name: 'Tilt', direction: side, features: ['2a'], folders: [] }],
      },
    ])
    expect(nested).toMatchObject([{ process: '3+2', folders: [{ id: 'c', direction: side }] }])
    expect(parseDraftSetups([{ ...valid, folders: undefined }])).toMatchObject([{ folders: [] }])
  })

  it('refuses a folder deeper than six, and a tilt another frame is cut from', () => {
    const deep = (depth: number): Record<string, unknown> => ({
      id: `f${depth}`,
      name: 'F',
      features: [],
      folders: depth < 7 ? [deep(depth + 1)] : [],
    })
    expect(parseDraftSetups([{ ...valid, features: [], folders: [deep(1)] }])).toMatch(/six|6/)
    expect(
      parseDraftSetups([
        {
          ...valid,
          process: '3+2',
          features: [],
          folders: [{ id: 'c', name: 'T', direction: down, features: [], folders: [] }],
        },
        { id: 'b', name: 'B', direction: down, features: [], folders: [] },
      ]),
    ).toMatch(/only once/)
  })
})

describe('the folder tree', () => {
  // A 3+2 setup from above, with a tilt to the side and a grouping of its own work.
  const tree: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      process: '3+2',
      features: ['a'],
      folders: [
        { id: 'pockets', name: 'Pockets', features: ['b'], folders: [] },
        {
          id: 'tilt',
          name: 'Tilt',
          direction: side,
          features: ['c'],
          folders: [{ id: 'chamfers', name: 'Chamfers', features: ['d'], folders: [] }],
        },
      ],
    },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], folders: [] },
  ]

  it('cuts each folder from its setup, its tool orientation, or its parent', () => {
    const cut = Object.fromEntries(placedFolders(tree).map((p) => [p.folder.id, p.direction]))
    expect(cut).toEqual({ top: up, pockets: up, tilt: side, chamfers: side, bottom: down })
  })

  it('tells Toolpath one setup per frame, each with the pins of its followers, in tree order', () => {
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

  it('adds folders six deep at most, named past the highest anywhere', () => {
    const added = addFolder(tree, 'pockets', 'new')
    expect(findPlaced(added, 'new')).toMatchObject({
      depth: 2,
      direction: up,
      folder: { name: 'Folder 1' },
    })
    let deep = tree
    let parent = 'bottom'
    for (let depth = 1; depth <= 7; depth += 1) {
      deep = addFolder(deep, parent, `d${depth}`)
      parent = findPlaced(deep, `d${depth}`) ? `d${depth}` : parent
    }
    expect(findPlaced(deep, 'd7')).toBeUndefined()
    expect(findPlaced(deep, 'd6')?.depth).toBe(6)
  })

  it('removes a folder with everything in it, at any depth', () => {
    expect(framesOf(removeFolder(tree, 'tilt')).map((f) => f.id)).toEqual(['top', 'bottom'])
  })

  it('keeps a setup indexed while it holds tool orientations, and each tilt one frame', () => {
    expect(setSetupProcess(tree, 'top', undefined)).toEqual({
      refused: 'Move or delete its tool orientations first.',
    })
    expect(setToolOrientation(tree, 'pockets', down)).toEqual({
      refused: 'Bottom is cut from that direction already.',
    })
    const tilted = setToolOrientation(tree, 'pockets', { x: 0, y: 1, z: 0 })
    expect(Array.isArray(tilted) && framesOf(tilted).map((f) => f.id)).toEqual([
      'top',
      'pockets',
      'tilt',
      'bottom',
    ])
  })

  it('pins into a folder, taking the feature from where it was, or lets it go there', () => {
    const moved = pinInto(tree, 'pockets', 'a')
    expect('setups' in moved && findPlaced(moved.setups, 'top')?.folder.features).toEqual([])
    expect('setups' in moved && findPlaced(moved.setups, 'pockets')?.folder.features).toEqual([
      'b',
      'a',
    ])
    expect(pinInto(tree, 'pockets', 'b')).toMatchObject({ unpinned: true })
  })

  it('indexes about one axis while every tilt lies in one plane through Setup Z', () => {
    expect(indexedFor(up, [side, { x: -1, y: 0, z: 0 }])).toBe('3+1')
    expect(indexedFor(up, [side, { x: 0, y: 1, z: 0 }])).toBe('3+2')
    expect(indexedFor(up, [down])).toBe('3+1')
  })
})

describe('moving folders', () => {
  const two: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      features: ['a'],
      folders: [
        { id: 'pockets', name: 'Pockets', features: ['b'], folders: [] },
        { id: 'holes', name: 'Holes', features: [], folders: [] },
      ],
    },
    { id: 'side', name: 'Side', direction: side, features: ['s'], folders: [] },
  ]
  const moved = (result: ReturnType<typeof moveFolder>) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused)
    }
    return result
  }

  it('reorders in place without changing anything (FLD22)', () => {
    const next = moved(moveFolder(two, 'holes', { parentId: 'top', index: 0 }))
    expect(findPlaced(next, 'top')?.folder.folders.map((f) => f.id)).toEqual(['holes', 'pockets'])
  })

  it('makes a setup dropped into another way a tilt, and its new setup 3+1 (FLD26)', () => {
    const next = moved(moveFolder(two, 'side', { parentId: 'top', index: 2 }))
    expect(next.map((s) => [s.id, s.process])).toEqual([['top', '3+1']])
    expect(findPlaced(next, 'side')).toMatchObject({ toolOrientation: true, direction: side })
    expect(framesOf(next).map((f) => [f.id, f.features])).toEqual([
      ['top', ['a', 'b']],
      ['side', ['s']],
    ])
  })

  it('grows 3+1 to 3+2 when a tilt needs a second axis (FLD27)', () => {
    const three = [
      ...two,
      { id: 'back', name: 'Back', direction: { x: 0, y: 1, z: 0 }, features: [], folders: [] },
    ]
    const once = moved(moveFolder(three, 'side', { parentId: 'top', index: 2 }))
    const twice = moved(moveFolder(once, 'back', { parentId: 'top', index: 3 }))
    expect(twice[0]!.process).toBe('3+2')
  })

  it('makes a tilt dropped at the top a setup facing it (FLD24)', () => {
    const tilted = moved(moveFolder(two, 'side', { parentId: 'top', index: 2 }))
    const back = moved(moveFolder(tilted, 'side', { parentId: null, index: 1 }))
    expect(back.map((s) => [s.id, s.direction])).toEqual([
      ['top', up],
      ['side', side],
    ])
  })

  it('refuses a follower at the top, a folder into itself, and a direction twice', () => {
    expect(moveFolder(two, 'pockets', { parentId: null, index: 0 })).toMatchObject({
      refused: expect.stringMatching(/Top/),
    })
    expect(moveFolder(two, 'top', { parentId: 'pockets', index: 0 })).toMatchObject({
      refused: expect.stringMatching(/itself/),
    })
    expect(moveFolder(two, 'pockets', { parentId: 'side', index: 0 })).toMatchObject({
      refused: 'Top is cut from that direction already.',
    })
  })

  it('pins a row where it is dropped, only in a folder facing its way', () => {
    expect(moveFeature(two, 'a', up, 'holes')).toSatisfy(
      (next: ReturnType<typeof moveFeature>) =>
        Array.isArray(next) && findPlaced(next, 'holes')?.folder.features.includes('a') === true,
    )
    expect(moveFeature(two, 'a', up, 'side')).toEqual({
      refused: 'Rows stay in folders cut from their own direction.',
    })
  })
})

describe('no folder holds features and folders both', () => {
  const two: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], folders: [] },
    { id: 'side', name: 'Side', direction: side, features: ['s'], folders: [] },
  ]
  const edited = (result: Edited) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused)
    }
    return result
  }

  it('keeps both folders when one is dropped on another, under a new multi-axis parent', () => {
    const next = edited(moveFolder(two, 'side', { parentId: 'top', index: 0 }, 'p'))
    expect(next.map((s) => [s.id, s.name, s.direction, s.process, s.features])).toEqual([
      ['p', 'Folder 1', up, '3+1', []],
    ])
    expect(next[0]!.folders.map((f) => [f.id, f.direction, f.features])).toEqual([
      ['top', undefined, ['a']],
      ['side', side, ['s']],
    ])
    // Toolpath is told the same two directions, each with its pins.
    expect(framesOf(next).map((f) => [f.direction, f.features])).toEqual([
      [up, ['a']],
      [side, ['s']],
    ])
  })

  it('groups two folders cut from the same way under a parent that is not indexed', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        folders: [
          { id: 'x', name: 'X', features: ['a'], folders: [] },
          { id: 'y', name: 'Y', features: ['b'], folders: [] },
        ],
      },
    ]
    const next = edited(moveFolder(tree, 'y', { parentId: 'x', index: 0 }, 'p'))
    expect(next[0]!.process).toBeUndefined()
    expect(findPlaced(next, 'p')?.folder.folders.map((f) => f.id)).toEqual(['x', 'y'])
  })

  it('splits a folder holding work when a folder is added to it', () => {
    const next = addFolder(two, 'top', 'new', 'work')
    expect(next[0]!.features).toEqual([])
    expect(next[0]!.folders.map((f) => [f.id, f.name, f.features])).toEqual([
      ['work', 'Top', ['a']],
      ['new', 'Folder 1', []],
    ])
  })

  it('pins, and drops rows, into the first folder cut from the direction that holds none', () => {
    const split = addFolder(two, 'top', 'new', 'work')
    const pinned = pinFrom(split, up, 'b', 'id')
    expect('setups' in pinned && findPlaced(pinned.setups, 'work')?.folder.features).toEqual([
      'a',
      'b',
    ])
    const dropped = edited(moveFeature(split, 'c', up, 'top'))
    expect(findPlaced(dropped, 'work')?.folder.features).toEqual(['a', 'c'])
  })

  it('names the folder a pin from a direction goes in, as pinFrom puts it there', () => {
    const split = addFolder(two, 'top', 'new', 'work')
    expect(pinTargetOf(split, up)).toBe('work')
    // Reordered, the first folder cut from its way is where pins go.
    expect(pinTargetOf(moveWithin(split, 'new', -1), up)).toBe('new')
    expect(pinTargetOf(two, up)).toBe('top')
    // A tilt is a frame of its own: a pin from its way goes in it, not its setup's folders.
    const tilted = setToolOrientation(
      [{ ...two[0]!, process: '3+1', folders: split[0]!.folders }],
      'new',
      side,
    )
    expect(Array.isArray(tilted) && pinTargetOf(tilted, side)).toBe('new')
    expect(Array.isArray(tilted) && pinTargetOf(tilted, up)).toBe('work')
    // No folder faces it: a pin adds one.
    expect(pinTargetOf(split, { x: 0, y: 1, z: 0 })).toBeNull()
    const pinned = pinFrom(split, up, 'z', 'id')
    expect('setups' in pinned && pinned.setupId).toBe(pinTargetOf(split, up))
  })

  describe('a frame holding only tilts', () => {
    // A 3+2 setup from above whose folders are all tool orientations, cut from other ways.
    const tilts: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        process: '3+2',
        features: [],
        folders: [
          { id: 't1', name: 'Tilt 1', direction: side, features: [], folders: [] },
          { id: 't2', name: 'Tilt 2', direction: { x: 0, y: 1, z: 0 }, features: [], folders: [] },
        ],
      },
    ]

    it('names the frame, and a pin goes in a folder added in it, following it', () => {
      expect(pinTargetOf(tilts, up)).toBe('top')
      const pinned = pinFrom(tilts, up, 'b', 'f')
      if (!('setups' in pinned)) {
        throw new Error(pinned.refused)
      }
      expect(pinned).toMatchObject({ setupId: 'f', added: false, unpinned: false })
      const top = pinned.setups[0]!
      expect(top.features).toEqual([])
      expect(top.folders.at(-1)).toEqual({
        id: 'f',
        name: 'Folder 1',
        features: ['b'],
        folders: [],
      })
      expect(parseDraftSetups(pinned.setups)).toEqual(pinned.setups)
      expect(framesOf(pinned.setups)[0]).toMatchObject({ id: 'top', features: ['b'] })
      // The next pin from that way goes in the folder now cut from it.
      expect(pinTargetOf(pinned.setups, up)).toBe('f')
      const again = pinFrom(pinned.setups, up, 'c', 'g')
      expect('setups' in again && findPlaced(again.setups, 'f')?.folder.features).toEqual([
        'b',
        'c',
      ])
    })

    it('makes the same folder for a row dropped on the frame', () => {
      const dropped = moveFeature(tilts, 'c', up, 'top', 'g')
      if (!Array.isArray(dropped)) {
        throw new Error(dropped.refused)
      }
      expect(dropped[0]!.features).toEqual([])
      expect(findPlaced(dropped, 'g')?.folder).toEqual({
        id: 'g',
        name: 'Folder 1',
        features: ['c'],
        folders: [],
      })
      // A tilt's own way still goes in the tilt.
      const tilted = moveFeature(tilts, 'd', side, 'top', 'h')
      expect(Array.isArray(tilted) && findPlaced(tilted, 't1')?.folder.features).toEqual(['d'])
    })
  })

  it('finds a pin in any case, as the pin spells it', () => {
    const pinned: Array<DraftSetup> = [
      { id: 'top', name: 'Top', direction: up, features: ['H2'], folders: [] },
    ]
    expect(pinOf(pinned, 'h2')).toEqual({ folderId: 'top', tag: 'H2' })
    expect(pinOf(pinned, 'H3')).toBeNull()
  })
})

describe('no folder holds a single folder', () => {
  const two: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], folders: [] },
    { id: 'side', name: 'Side', direction: side, features: ['s'], folders: [] },
  ]
  const edited = (result: Edited) => {
    if (!Array.isArray(result)) {
      throw new Error(result.refused)
    }
    return result
  }
  // Side dropped on Top: both in a new 3+1 setup, Side a tilt of it.
  const paired = edited(moveFolder(two, 'side', { parentId: 'top', index: 0 }, 'p'))

  it('lets a folder taken out of a pair come up into the pair’s place, as it was', () => {
    const next = edited(moveFolder(paired, 'side', { parentId: null, index: 1 }))
    // Top is a setup again, not indexed — there is no tilt left in it to turn to.
    expect(next.map((s) => [s.id, s.name, s.direction, s.process, s.features])).toEqual([
      ['top', 'Top', up, undefined, ['a']],
      ['side', 'Side', side, undefined, ['s']],
    ])
    expect(next[0]!.folders).toEqual([])
  })

  it('makes a lone tilt left at the top a setup facing it', () => {
    const next = removeFolder(paired, 'top')
    expect(next.map((s) => [s.id, s.direction, s.process, s.features])).toEqual([
      ['side', side, undefined, ['s']],
    ])
  })

  // A setup holding a group of two, and a folder beside the group.
  const grouped: Array<DraftSetup> = [
    {
      id: 'top',
      name: 'Top',
      direction: up,
      features: [],
      folders: [
        {
          id: 'p',
          name: 'Group',
          features: [],
          folders: [
            { id: 'x', name: 'X', features: ['a'], folders: [] },
            { id: 'y', name: 'Y', features: ['b'], folders: [] },
          ],
        },
        { id: 'z', name: 'Z', features: ['c'], folders: [] },
      ],
    },
  ]

  it('lifts the one folder left in a group into the group’s place', () => {
    const next = removeFolder(grouped, 'y')
    expect(next[0]!.folders.map((f) => [f.id, f.name, f.features])).toEqual([
      ['x', 'X', ['a']],
      ['z', 'Z', ['c']],
    ])
  })

  it('takes out every folder picked together, the group with one in it included', () => {
    // X first, then its group: X going leaves the group lone, but the group is going too.
    const next = removeFolders(grouped, ['x', 'p'])
    expect(findPlaced(next, 'y')).toBeUndefined()
    // That leaves Top holding just Z, which comes up into it: the setup, cut the same way.
    expect(next.map((s) => [s.id, s.direction, s.features])).toEqual([['z', up, ['c']]])
  })

  it('leaves a folder holding two folders, or work of its own, as it is', () => {
    expect(liftLoneFolder(paired, 'p')).toEqual(paired)
    expect(liftLoneFolder(two, 'top')).toEqual(two)
  })

  it('leaves a saved folder holding just one alone when something else is edited', () => {
    const saved: Array<DraftSetup> = [
      {
        id: 's',
        name: 'Saved',
        direction: up,
        process: '3+1',
        features: [],
        folders: [{ id: 'f', name: 'F', features: ['a'], folders: [] }],
      },
      ...two.slice(1),
    ]
    const next = removeFolder(saved, 'side')
    expect(next.map((s) => [s.id, s.name, s.process])).toEqual([['s', 'Saved', '3+1']])
  })

  it('pairs a folder dropped into an empty one with it, so the empty one keeps its name', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 's',
        name: 'S',
        direction: up,
        features: [],
        folders: [
          { id: 'w', name: 'W', features: ['a'], folders: [] },
          { id: 'e', name: 'E', features: [], folders: [] },
          { id: 'm', name: 'M', features: ['b'], folders: [] },
        ],
      },
    ]
    const next = edited(moveFolder(tree, 'm', { parentId: 'e', index: 0 }, 'pair'))
    expect(next[0]!.folders.map((f) => f.id)).toEqual(['w', 'pair'])
    expect(findPlaced(next, 'pair')?.folder.folders.map((f) => [f.id, f.name])).toEqual([
      ['e', 'E'],
      ['m', 'M'],
    ])
  })

  it('splits an empty folder in two when a folder is added to it, never holding just the one', () => {
    const empty: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        folders: [
          { id: 'x', name: 'X', features: ['a'], folders: [] },
          { id: 'y', name: 'Y', features: [], folders: [] },
        ],
      },
    ]
    const next = addFolder(empty, 'y', 'new', 'kept')
    expect(findPlaced(next, 'y')?.folder.folders.map((f) => [f.id, f.name])).toEqual([
      ['kept', 'Y'],
      ['new', 'Folder 1'],
    ])
  })
})

describe('no folder holds a single folder: how what comes up is cut', () => {
  it('makes a lone tilt come up to the top a setup indexed to reach the tilts inside it', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        process: '3+1',
        features: [],
        folders: [
          {
            id: 'side',
            name: 'Side',
            direction: side,
            features: [],
            folders: [
              // A tilt inside Side, turned from it about one axis: one tilt is always 3+1.
              { id: 't', name: 'T', direction: up, features: ['b'], folders: [] },
              { id: 'f', name: 'F', features: ['c'], folders: [] },
            ],
          },
          { id: 'other', name: 'Other', features: ['d'], folders: [] },
        ],
      },
    ]
    const next = removeFolder(tree, 'other')
    expect(next.map((s) => [s.id, s.direction, s.process])).toEqual([['side', side, '3+1']])
  })

  it('keeps a tilt come up inside a setup as it was: a tilt is its own frame', () => {
    const tree: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        folders: [
          {
            id: 'p',
            name: 'Group',
            features: [],
            folders: [
              { id: 'x', name: 'X', direction: side, features: ['a'], folders: [] },
              { id: 'y', name: 'Y', features: ['b'], folders: [] },
            ],
          },
          { id: 'z', name: 'Z', features: ['c'], folders: [] },
        ],
      },
    ]
    const next = removeFolder(tree, 'y')
    expect(findPlaced(next, 'x')?.folder).toEqual({
      id: 'x',
      name: 'X',
      direction: side,
      features: ['a'],
      folders: [],
    })
  })
})

describe('pinning features', () => {
  const setups: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a'], folders: [] },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], folders: [] },
  ]

  it('pins a feature from its direction’s setup, and lets it go on a second click', () => {
    const pinned = pinFrom(setups, { ...down }, 'b', 'new')
    expect(pinned).toMatchObject({ setupId: 'bottom', added: false, unpinned: false })
    expect('setups' in pinned && pinned.setups[1]!.features).toEqual(['b'])

    const released = pinFrom(setups, up, 'a', 'new')
    expect(released).toMatchObject({ setupId: 'top', unpinned: true })
  })

  it('adds a setup for a direction no setup faces, holding the feature', () => {
    const pinned = pinFrom(setups, side, 'c', 'new')
    expect(pinned).toMatchObject({ setupId: 'new', added: true })
    expect('setups' in pinned && pinned.setups.at(-1)).toMatchObject({
      id: 'new',
      direction: side,
      features: ['c'],
    })
  })

  it('pins a profile into any setup, leaving Toolpath to refuse it', () => {
    expect(pinFrom(setups, down, 'profile', 'new')).toMatchObject({ setupId: 'bottom' })
  })

  it('gives a feature pinned in more than one folder the first of them in tree order', () => {
    const twice: Array<DraftSetup> = [
      {
        id: 's1',
        name: 'Folder 1',
        direction: up,
        features: [],
        folders: [
          { id: 'nested', name: 'Folder 2', features: ['t'], folders: [] },
          { id: 'other', name: 'Folder 3', features: ['u'], folders: [] },
        ],
      },
      { id: 's2', name: 'Folder 4', direction: down, features: ['t'], folders: [] },
    ]
    expect(pinHomes(twice).get('t')).toBe('nested')
  })

  it('finds and lets go a pin whatever case its tag is spelled in', () => {
    // Toolpath and the analysis spell a tag differently: 'f' pinned is Toolpath's 'F'.
    const lower: Array<DraftSetup> = [
      { id: 'top', name: 'Top', direction: up, features: ['f'], folders: [] },
    ]
    expect(pinnedIn(lower, 'F')).toBe('top')
    expect(pinHomes(lower).get('f')).toBe('top')
    expect(unpinFeature(lower, 'top', 'F')[0]!.features).toEqual([])
    expect(pinInto(lower, 'top', 'F')).toMatchObject({ unpinned: true })
  })

  it('unpins from a named setup only', () => {
    expect(unpinFeature(setups, 'top', 'a')[0]!.features).toEqual([])
    expect(unpinFeature(setups, 'bottom', 'a')[0]!.features).toEqual(['a'])
  })
})

describe('a parent made on a drop', () => {
  it('is named past every folder, the one moved included', () => {
    const numbered: Array<DraftSetup> = [
      { id: 'a', name: 'Folder 1', direction: up, features: ['a'], folders: [] },
      { id: 'b', name: 'Folder 2', direction: side, features: ['b'], folders: [] },
    ]
    const next = moveFolder(numbered, 'b', { parentId: 'a', index: 0 }, 'p')
    expect(Array.isArray(next) && next[0]!.name).toBe('Folder 3')
  })
})

describe('moveWithin', () => {
  const child = (id: string) => ({ id, name: id, features: [], folders: [] })
  const setups = [
    {
      id: 's',
      name: 'S',
      direction: up,
      features: [],
      folders: [child('a'), child('b'), child('c')],
    },
    { id: 't', name: 'T', direction: down, features: [], folders: [] },
  ]

  it('moves a folder among the folders beside it, clamped to the ends', () => {
    const order = (next: ReturnType<typeof moveWithin>) => next[0]!.folders.map((f) => f.id)
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

/** The setups a pin made, where it was not refused. */
const pinnedSetups = (result: ReturnType<typeof pinInto>): Array<DraftSetup> => {
  if ('refused' in result) {
    throw new Error(result.refused)
  }
  return result.setups
}

describe('restoreFeature', () => {
  const saved: Array<DraftSetup> = [
    { id: 'top', name: 'Top', direction: up, features: ['a', 'p', 'b'], folders: [] },
    { id: 'bottom', name: 'Bottom', direction: down, features: [], folders: [] },
  ]

  it('puts a pin back at its place, and takes it out of where it went since', () => {
    const moved = pinnedSetups(pinInto(unpinFeature(saved, 'top', 'p'), 'bottom', 'p'))
    const back = restoreFeature(moved, saved, 'p')
    expect(back[0]?.features).toEqual(['a', 'p', 'b'])
    expect(back[1]?.features).toEqual([])
  })

  it('takes out a pin saved nowhere', () => {
    const pinned = pinnedSetups(pinInto(saved, 'top', 't'))
    expect(restoreFeature(pinned, saved, 't')[0]?.features).toEqual(['a', 'p', 'b'])
  })

  it('leaves every other edit, and passes over a folder gone since', () => {
    const renamed = renameFolder(
      removeFolder(pinnedSetups(pinInto(saved, 'bottom', 'q')), 'top'),
      'bottom',
      'Under',
    )
    expect(restoreFeature(renamed, saved, 'p')).toEqual(renamed)
  })

  it('takes a pin out of a folder made since the save', () => {
    const more = [
      ...saved,
      { id: 'x', name: 'Side', direction: side, features: [], folders: [] },
    ] as Array<DraftSetup>
    const moved = pinnedSetups(pinInto(more, 'x', 'p'))
    expect(moved[0]?.features).toEqual(['a', 'b'])
    expect(moved[2]?.features).toEqual(['p'])
    const back = restoreFeature(moved, saved, 'p')
    expect(back[0]?.features).toEqual(['a', 'p', 'b'])
    expect(back[2]?.features).toEqual([])
  })
})

describe('the faces ignored', () => {
  it('adds faces once each, sorted, numbered by the kernel; another kernel’s are let go first', () => {
    expect(withIgnored({ done: [5, 3], doneKernel: 'k1' }, [3, 1], 'k1')).toEqual({
      done: [1, 3, 5],
      doneKernel: 'k1',
    })
    expect(withIgnored({ done: [5], doneKernel: 'k0' }, [1], 'k1')).toEqual({
      done: [1],
      doneKernel: 'k1',
    })
  })

  it('takes faces out, letting the kernel go with the last of them', () => {
    expect(withoutIgnored({ done: [3, 5], doneKernel: 'k1' }, [3], 'k1')).toEqual({
      done: [5],
      doneKernel: 'k1',
    })
    expect(withoutIgnored({ done: [3], doneKernel: 'k1' }, [3], 'k1')).toEqual({
      done: [],
      doneKernel: null,
    })
  })

  it('puts faces back as saved, every other as the plan has it, on one kernel', () => {
    const saved = { done: [3, 8], doneKernel: 'k1' }
    expect(ignoredAsSaved({ done: [5, 8], doneKernel: 'k1' }, saved, [3, 5], 'k1')).toEqual({
      done: [3, 8],
      doneKernel: 'k1',
    })
    // Numbered by another kernel, the plan's faces are let go as any change lets them go.
    expect(ignoredAsSaved({ done: [5], doneKernel: 'k0' }, saved, [3], 'k1')).toEqual({
      done: [3],
      doneKernel: 'k1',
    })
  })
})

describe('foldersFromPlan', () => {
  let count = 0
  const newId = () => `id-${(count += 1)}`
  const orientations = (...directions: Array<typeof up>) => ({
    orientations: directions.map((direction) => ({ direction })),
  })

  it('states a folder facing each setup, in order, named as New folder names them, with no pins', () => {
    count = 0
    expect(foldersFromPlan([orientations(up), orientations(side)], newId)).toEqual([
      { id: 'id-1', name: 'Folder 1', direction: up, features: [], folders: [] },
      { id: 'id-2', name: 'Folder 2', direction: side, features: [], folders: [] },
    ])
  })

  it('holds a setup turned to further directions, each a tilt folder inside it', () => {
    count = 0
    const tilt = { x: 0, y: 1, z: 0 }
    const [frame] = foldersFromPlan([orientations(up, side, tilt)], newId)
    expect(frame).toMatchObject({ name: 'Folder 1', direction: up, process: '3+2' })
    expect(frame!.folders).toEqual([
      { id: 'id-2', name: 'Folder 2', direction: side, features: [], folders: [] },
      { id: 'id-3', name: 'Folder 3', direction: tilt, features: [], folders: [] },
    ])
    expect(
      framesOf(foldersFromPlan([orientations(up, side, tilt)], newId)).map((f) => f.direction),
    ).toEqual([up, side, tilt])
  })

  it('puts a following folder beside a lone tilt, so no folder holds a single folder', () => {
    count = 0
    const [frame] = foldersFromPlan([orientations(up, side)], newId)
    expect(frame).toMatchObject({ process: '3+1' })
    expect(frame!.folders).toEqual([
      { id: 'id-2', name: 'Folder 2', features: [], folders: [] },
      { id: 'id-3', name: 'Folder 3', direction: side, features: [], folders: [] },
    ])
  })

  it('passes over a direction faced already, a setup with none, and anything past MAX_SETUPS', () => {
    count = 0
    expect(
      foldersFromPlan(
        [orientations(up), orientations(up), orientations(), orientations(side, up)],
        newId,
      ).map((setup) => [setup.direction, setup.folders.length]),
    ).toEqual([
      [up, 0],
      [side, 0],
    ])
    const many = Array.from({ length: 70 }, (_, i) => orientations({ x: 1, y: i, z: 0 }))
    expect(foldersFromPlan(many, newId)).toHaveLength(64)
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

  it('pins each setup’s features in the folder facing it, a row no orientation lists with the first', () => {
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
      { id: 'id-1', name: 'Folder 1', direction: up, features: ['a', 'b', '2e'], folders: [] },
      { id: 'id-2', name: 'Folder 2', direction: side, features: ['c'], folders: [] },
    ])
    expect(parseDraftSetups(stated)).toEqual(stated)
  })

  it('puts a turned setup’s own features in a follower folder beside its tilt folders', () => {
    count = 0
    const [frame] = planFromResults(
      [{ orientations: [facing(up, 'a'), facing(side, 'b'), facing(tilt, 'c')] }],
      newId,
    )
    expect(frame).toMatchObject({ direction: up, process: '3+2', features: [] })
    expect(frame!.folders).toEqual([
      { id: 'id-2', name: 'Folder 2', features: ['a'], folders: [] },
      { id: 'id-3', name: 'Folder 3', direction: side, features: ['b'], folders: [] },
      { id: 'id-4', name: 'Folder 4', direction: tilt, features: ['c'], folders: [] },
    ])
    expect(parseDraftSetups([frame!])).toEqual([frame])
    // Nothing of its own: no follower folder beside two tilts.
    count = 0
    const [bare] = planFromResults(
      [{ orientations: [facing(up), facing(side, 'b'), facing(tilt)] }],
      newId,
    )
    expect(bare!.folders.map((folder) => folder.features)).toEqual([['b'], []])
  })

  it('pins a feature two orientations list once, in the first, and never one nothing machines', () => {
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
    expect(stated[0]!.folders.map((folder) => folder.features)).toEqual([['a'], ['b']])
    expect(stated[1]).toMatchObject({ direction: tilt, features: [] })
    expect(parseDraftSetups(stated)).toEqual(stated)
  })

  it('states the same folders as foldersFromPlan, pins apart', () => {
    const planned = [{ orientations: [facing(up, 'a'), facing(side, 'b')] }]
    count = 0
    const folders = foldersFromPlan(planned, newId)
    count = 0
    const withPins = planFromResults(planned, newId)
    const bare = (setups: typeof withPins) =>
      JSON.parse(JSON.stringify(setups, (key, value: unknown) => (key === 'features' ? [] : value)))
    expect(bare(withPins)).toEqual(bare(folders))
  })
})
