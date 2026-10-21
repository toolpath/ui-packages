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
} from '../src/draft-action'
import { ignoreEdit, takeBackIgnore } from '../src/ignore'
import { chooseReading, folderClick, pinEdit, unignorePinned, withPin } from '../src/pin'
import {
  addFolder,
  currentFor,
  findPlaced,
  foldersFromPlan,
  MAX_DEPTH,
  MAX_SETUPS,
  moveFeature,
  moveFolder,
  moveWithin,
  pinnedIn,
  planFromResults,
  removeFolder,
  removeFolders,
  setToolOrientation,
  unpinFeature,
  type Constraints,
  type DraftSetup,
  sameDirection,
  type PlannedSetup,
  type PlanRules,
} from '../src/plan-draft'
import type { PlanDirection } from '../src/engine-plan'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }
const side = { x: 1, y: 0, z: 0 }

// Top holds two folders: Pockets (pins 'p') and Holes (pins 'h'). Bottom pins 'q'.
const setups: Array<DraftSetup> = [
  {
    id: 'top',
    name: 'Top',
    direction: up,
    features: [],
    folders: [
      { id: 'pockets', name: 'Pockets', features: ['p'], folders: [] },
      { id: 'holes', name: 'Holes', features: ['h'], folders: [] },
    ],
  },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['q'], folders: [] },
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
  unignored: [],
  unpinned: [],
  added: false,
  letGo: false,
  home: null,
}

const made = <T extends Constraints>(result: DraftResult<T>): T => {
  if ('refused' in result) {
    throw new Error(`refused: ${result.refused}`)
  }
  return result.draft
}

/** Setup S with folders nested to the deepest a folder may sit; the last is `f${MAX_DEPTH}`. */
const deepest = (): Array<DraftSetup> => {
  let deep: Array<DraftSetup> = [{ id: 's', name: 'S', direction: up, features: [], folders: [] }]
  let parent = 's'
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    deep = addFolder(deep, parent, `f${depth}`, `w${depth}`)
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
  const folder = 'folder' in target ? target.folder : 'top'
  const feature = 'feature' in target ? target : { feature: 'x', direction: up }
  const facing = (direction: PlanDirection) =>
    from.setups.find((setup) => sameDirection(setup.direction, direction))?.id ?? 'top'
  switch (kind) {
    case 'addFolder':
      return [{ kind, parentId: folder, id: 'new', workId: 'work' }]
    case 'renameFolder':
      return [{ kind, id: folder, name: 'Renamed' }]
    case 'remove':
      return [{ kind, folders: 'part' in target ? from.setups.map((setup) => setup.id) : [folder] }]
    case 'moveFolder':
      return [
        { kind, id: folder, to: { parentId: null, index: from.setups.length - 1 }, newId: 'new' },
        ...from.setups
          .flatMap((setup) => [setup, ...setup.folders])
          .map(
            (each): DraftAction => ({
              kind,
              id: folder,
              to: { parentId: each.id, index: 0 },
              newId: 'new',
            }),
          ),
      ]
    case 'moveWithin':
      return [
        { kind, id: folder, by: 1 },
        { kind, id: folder, by: -1 },
      ]
    case 'addSetup':
      return [{ kind, direction: { x: 0, y: 1, z: 0 }, id: 'new' }]
    case 'setProcess':
      return [{ kind, setupId: folder, process: '3+1' }]
    case 'setToolOrientation':
      return [
        { kind, folderId: folder, direction: side },
        { kind, folderId: folder, direction: null },
      ]
    case 'pinInto':
      return [
        {
          kind,
          tag: feature.feature,
          direction: feature.direction,
          folderId: facing(feature.direction),
          newId: 'new',
        },
      ]
    case 'pinFrom':
      return [{ kind, tag: feature.feature, direction: feature.direction, newId: 'new' }]
    case 'moveFeature':
      return [
        {
          kind,
          tag: feature.feature,
          direction: feature.direction,
          folderId: 'holes',
          newId: 'new',
        },
      ]
    case 'unpin':
      return [{ kind, tag: feature.feature }]
    case 'ignore':
    case 'unignore':
      return [{ kind, regions: 'faces' in target ? target.faces : [] }]
    // Offered by the page after a click, or where Toolpath's plan is there to start from.
    case 'choosePinReading':
    case 'chooseIgnoreReading':
    case 'fromPlan':
      return []
  }
}

describe('applyDraftAction', () => {
  it('makes the same edit as the function it names, and keeps the rest of the draft', () => {
    const added = apply({ kind: 'addFolder', parentId: 'top', id: 'new', workId: 'w' })
    expect(added).toEqual({
      draft: { ...draft, setups: addFolder(setups, 'top', 'new', 'w') },
      folderId: 'new',
      facts: NO_FACTS,
    })
    expect(made(added).inputs).toBe('kept')
    expect(made(apply({ kind: 'moveWithin', id: 'holes', by: -1 })).setups).toEqual(
      moveWithin(setups, 'holes', -1),
    )
  })

  it('answers a refusal of the function it names as it is', () => {
    const to = { parentId: null, index: 0 }
    expect(apply({ kind: 'moveFolder', id: 'holes', to, newId: 'n' })).toEqual(
      moveFolder(setups, 'holes', to, 'n'),
    )
    expect(apply({ kind: 'moveFolder', id: 'holes', to, newId: 'n' })).toEqual({
      refused: 'It is cut from Top’s direction, a setup already.',
    })
  })

  it('refuses where the function it names would quietly change nothing', () => {
    expect(apply({ kind: 'addFolder', parentId: 'gone', id: 'n', workId: 'w' })).toEqual({
      refused: 'That folder is gone.',
    })
    expect(apply({ kind: 'addSetup', direction: up, id: 'n' })).toEqual({
      refused: 'Top is cut from that direction already.',
    })
    expect(apply({ kind: 'renameFolder', id: 'gone', name: 'X' })).toEqual({
      refused: 'That folder is gone.',
    })
    expect(apply({ kind: 'setProcess', setupId: 'holes', process: '3+1' })).toEqual({
      refused: 'Only a setup has a hold.',
    })
    expect(apply({ kind: 'moveWithin', id: 'holes', by: 0.5 })).toEqual({
      refused: 'A folder moves a whole number of places.',
    })
  })

  it('refuses an id the draft holds already, so no two folders share one', () => {
    const taken = { refused: 'That id is taken: each folder needs an id of its own.' }
    expect(apply({ kind: 'addFolder', parentId: 'top', id: 'holes', workId: 'w' })).toEqual(taken)
    expect(apply({ kind: 'addFolder', parentId: 'top', id: 'n', workId: 'n' })).toEqual(taken)
    expect(apply({ kind: 'addSetup', direction: side, id: 'bottom' })).toEqual(taken)
    expect(apply({ kind: 'pinFrom', tag: 's', direction: side, newId: 'top' })).toEqual(taken)
    const into = {
      kind: 'pinInto',
      tag: 'x',
      direction: up,
      folderId: 'top',
      newId: 'holes',
    } as const
    expect(apply(into)).toEqual(taken)
  })

  it('pins into a parent twice, unpinned between, without two folders sharing an id', () => {
    const into = { kind: 'pinInto', tag: 'x', direction: up, folderId: 'top' } as const
    const once = made(apply({ ...into, newId: 'a' }))
    const unpinned = made(apply({ kind: 'unpin', tag: 'x' }, once))
    expect(apply({ ...into, newId: 'a' }, unpinned)).toHaveProperty('refused')
    expect(
      made(apply({ ...into, newId: 'b' }, unpinned)).setups[0]?.folders.map((f) => f.id),
    ).toEqual(['pockets', 'holes', 'a', 'b'])
  })

  it('refuses a folder past the deepest a folder may sit', () => {
    const at = { ...draft, setups: deepest() }
    expect(
      apply({ kind: 'addFolder', parentId: `f${MAX_DEPTH}`, id: 'n', workId: 'w' }, at),
    ).toEqual({
      refused: `Folders sit at most ${MAX_DEPTH} below their setup.`,
    })
  })

  it('refuses a setup past the most a plan holds', () => {
    const full: Array<DraftSetup> = Array.from({ length: MAX_SETUPS }, (_, i) => ({
      id: `s${i}`,
      name: `S${i}`,
      direction: { x: i + 1, y: 0, z: 0 },
      features: [],
      folders: [],
    }))
    expect(apply({ kind: 'addSetup', direction: up, id: 'n' }, { ...draft, setups: full })).toEqual(
      {
        refused: `A plan holds at most ${MAX_SETUPS} setups.`,
      },
    )
  })

  it('holds a setup 3+1 and back, and tilts a folder in it and back', () => {
    const indexed = made(apply({ kind: 'setProcess', setupId: 'top', process: '3+1' }))
    expect(indexed.setups[0]?.process).toBe('3+1')
    const tilted = made(
      apply({ kind: 'setToolOrientation', folderId: 'holes', direction: side }, indexed),
    )
    expect(tilted.setups).toEqual(setToolOrientation(indexed.setups, 'holes', side))
    expect(apply({ kind: 'setProcess', setupId: 'top', process: null }, tilted)).toEqual({
      refused: 'Move or delete its tool orientations first.',
    })
    const straight = made(
      apply({ kind: 'setToolOrientation', folderId: 'holes', direction: null }, tilted),
    )
    expect(
      made(apply({ kind: 'setProcess', setupId: 'top', process: null }, straight)).setups,
    ).toEqual(setups)
  })

  it('removes folders and pinned features together, as Delete does, passing over what is gone', () => {
    const result = made(
      apply({
        kind: 'remove',
        folders: ['pockets', 'gone'],
        features: [{ tag: 'q', setupId: 'bottom' }],
      }),
    )
    expect(result.setups).toEqual(removeFolders(unpinFeature(setups, 'bottom', 'q'), ['pockets']))
    expect(made(apply({ kind: 'remove', folders: ['top', 'bottom'] })).setups).toEqual([])
  })

  it('pins as the demo pins: covered pins let go, faces un-ignored, the folder to show named', () => {
    const ignored = { ...draft, done: [5], doneKernel: 'k1' }
    const result = apply(
      { kind: 'pinInto', tag: 'x', direction: up, folderId: 'holes', newId: 'n' },
      ignored,
    )
    const expected = pinEdit(ignored, 'x', { folderId: 'holes' }, rules)
    if ('refused' in expected) {
      throw new Error('expected a pin')
    }
    expect(result).toEqual({
      draft: { ...ignored, ...expected.intent },
      facts: { ...NO_FACTS, replaced: ['p'], unignored: [5], home: 'holes' },
    })
    expect(made(result).done).toEqual([])
    expect(expected.replaced).toEqual(['p'])
    expect(expected.unignored).toEqual([5])
  })

  it('refuses a pin into a folder cut from another direction', () => {
    expect(
      apply({ kind: 'pinInto', tag: 's', direction: side, folderId: 'holes', newId: 'n' }),
    ).toEqual({ refused: 'Rows stay in folders cut from their own direction.' })
  })

  it('pins from a direction no folder faces into a new setup', () => {
    const result = apply({ kind: 'pinFrom', tag: 's', direction: side, newId: 'n' })
    expect(result).toMatchObject({ facts: { home: 'n', added: true } })
    expect(made(result).setups.at(-1)).toMatchObject({ id: 'n', direction: side, features: ['s'] })
  })

  it('drops a row as the tree does: moved, then pinned as any pin is', () => {
    const moved = moveFeature(setups, 'x', up, 'holes', 'n')
    if (!Array.isArray(moved)) {
      throw new Error('expected a move')
    }
    const result = apply({
      kind: 'moveFeature',
      tag: 'x',
      direction: up,
      folderId: 'holes',
      newId: 'n',
    })
    expect(made(result)).toEqual({ ...draft, ...withPin(draft, 'x', moved, rules).intent })
    expect(result).toMatchObject({ folderId: 'holes' })
  })

  it('pins a row dropped where it is pinned already as the tree does: faces un-ignored', () => {
    const covering = { ...draft, done: [1], doneKernel: 'k1' }
    const result = apply(
      { kind: 'moveFeature', tag: 'p', direction: up, folderId: 'pockets', newId: 'n' },
      covering,
    )
    expect(made(result)).toEqual({ ...covering, ...withPin(covering, 'p', setups, rules).intent })
    expect(result).toMatchObject({ folderId: 'pockets', facts: { unignored: [1] } })
  })

  it('unpins wherever the feature is pinned, and changes nothing for one pinned nowhere', () => {
    expect(made(apply({ kind: 'unpin', tag: 'q' })).setups).toEqual(
      unpinFeature(setups, 'bottom', 'q'),
    )
    expect(apply({ kind: 'unpin', tag: 'nowhere' })).toEqual({ draft, facts: NO_FACTS })
  })

  it('ignores faces as Ignore does, letting go of the pins they cover, and un-ignores them', () => {
    const result = apply({ kind: 'ignore', regions: [3] })
    const ignored = made(result)
    expect(ignored).toEqual({ ...draft, ...ignoreEdit(draft, [3], rules).intent })
    expect(result).toMatchObject({ facts: { unpinned: [{ tag: 'h', setupId: 'holes' }] } })
    expect(ignored.done).toEqual([3])
    expect(ignored.doneKernel).toBe('k1')
    const back = made(apply({ kind: 'unignore', regions: [3] }, ignored))
    expect(back.done).toEqual([])
  })

  it('refuses what is not an action instead of throwing', () => {
    const not = { refused: 'That is not a plan action.' }
    expect(apply({ kind: 'teleport' } as unknown as DraftAction)).toEqual(not)
    expect(apply(null as unknown as DraftAction)).toEqual(not)
    expect(apply({ kind: 'ignore' } as unknown as DraftAction)).toEqual(not)
    expect(apply({ kind: 'remove' } as unknown as DraftAction)).toEqual(not)
  })
})

/*
  Each action makes the edit Toolpath's quoting app makes for the same click, with the same result.
  The app's own code for each (`src/plan/part-plan.tsx`, `use-pin-features.ts`,
  `use-ignore-changes.ts`) is copied here as `app…`, and the action is held to it.
*/
describe('the app’s clicks, as actions', () => {
  const placedDirection = (plan: Constraints, folderId: string) =>
    findPlaced(plan.setups, folderId)!.direction

  /** The app's `pin` (`pinFromList`): `pinEdit`, a refusal leaving the plan as it was. */
  const appPin = (plan: Constraints, tag: string, at: Parameters<typeof pinEdit>[2]) => {
    const now = pinEdit(plan, tag, at, rules)
    return 'refused' in now ? plan : now.intent
  }

  /** The app's click on the part in an open folder (`usePinFeatures.click`). */
  const appFolderClick = (plan: Constraints, tag: string, folderId: string) => {
    const placed = findPlaced(plan.setups, folderId)!
    const inFolder = pinnedIn(plan.setups, tag) === folderId
    return folderClick(
      plan,
      { tag, label: 'L', direction: placed.direction, inFolder },
      placed.folder,
      rules,
    ).intent
  }

  it('pins in an open folder, and takes out what is pinned there, as a click does', () => {
    const ignored = { ...draft, done: [5], doneKernel: 'k1' }
    for (const [tag, folderId] of [
      ['x', 'holes'],
      ['h', 'holes'],
      ['p', 'pockets'],
    ] as const) {
      const action = {
        kind: 'pinInto',
        tag,
        direction: up,
        folderId,
        newId: 'n',
      } as const
      expect(made(apply(action, ignored))).toEqual({
        ...ignored,
        ...appFolderClick(ignored, tag, folderId),
      })
    }
    expect(
      apply({ kind: 'pinInto', tag: 'h', direction: up, folderId: 'holes', newId: 'n' }),
    ).toMatchObject({ facts: { letGo: true, home: 'holes' } })
  })

  it('takes a pin out of a folder that faces another way since, as the Feature section does', () => {
    const turned = made(apply({ kind: 'setProcess', setupId: 'top', process: '3+1' }))
    const tilted = made(
      apply({ kind: 'setToolOrientation', folderId: 'holes', direction: side }, turned),
    )
    const result = apply(
      { kind: 'pinInto', tag: 'h', direction: up, folderId: 'holes', newId: 'n' },
      tilted,
    )
    expect(made(result)).toEqual({ ...tilted, ...appPin(tilted, 'h', { folderId: 'holes' }) })
    expect(pinnedIn(made(result).setups, 'h')).toBeNull()
  })

  it('pins from a direction, or lets go of a pin made that way, as the Feature section does', () => {
    const ignored = { ...draft, done: [6], doneKernel: 'k1' }
    for (const [tag, direction] of [
      ['q', down],
      ['s', side],
      ['x', up],
    ] as const) {
      const at = { direction, newId: 'n' }
      expect(made(apply({ kind: 'pinFrom', tag, ...at }, ignored))).toEqual({
        ...ignored,
        ...appPin(ignored, tag, at),
      })
    }
    expect(apply({ kind: 'pinFrom', tag: 'q', direction: down, newId: 'n' })).toMatchObject({
      facts: { letGo: true, added: false, home: 'bottom' },
    })
    expect(
      apply({ kind: 'pinFrom', tag: 's', direction: side, newId: 'n' }, ignored),
    ).toMatchObject({ facts: { added: true, letGo: false, unignored: [6], home: 'n' } })
  })

  /** The app's pick among a pin click's readings (`usePinFeatures.choose`, its `retarget`). */
  const appChoosePin = (
    plan: Constraints,
    saved: Constraints,
    tag: string,
    target: 'pin' | 'takeOut',
    reading: string,
    readings: Array<string>,
    folderId: string,
  ) => {
    const placed = findPlaced(plan.setups, folderId)!
    const pinned = pinnedIn(plan.setups, tag) === folderId
    const made =
      pinned === (target === 'takeOut')
        ? folderClick(
            plan,
            { tag, label: 'L', direction: placed.direction, inFolder: pinned },
            placed.folder,
            rules,
          ).intent
        : plan
    return chooseReading(
      made,
      saved,
      { tag, target },
      reading,
      readings,
      { id: folderId, direction: placedDirection(plan, folderId) },
      rules,
    ).intent
  }

  it('means another reading of a pin click, its click standing or undone', () => {
    const clicked = made(
      apply({ kind: 'pinInto', tag: 'x', direction: up, folderId: 'holes', newId: 'n' }),
    )
    const pick = {
      kind: 'choosePinReading',
      tag: 'x',
      target: 'pin',
      reading: 'p',
      readings: ['x', 'p'],
      folderId: 'holes',
    } as const
    for (const plan of [clicked, draft]) {
      expect(made(apply(pick, plan))).toEqual({
        ...plan,
        ...appChoosePin(plan, draft, 'x', 'pin', 'p', ['x', 'p'], 'holes'),
      })
    }
  })

  it('changes nothing where the folder of a pin click is gone, as the app does', () => {
    const pick = {
      kind: 'choosePinReading',
      tag: 'x',
      target: 'pin',
      reading: 'p',
      readings: ['x', 'p'],
      folderId: 'gone',
    } as const
    expect(apply(pick)).toEqual({ draft, facts: NO_FACTS })
  })

  it('means another reading of a click that took a feature out', () => {
    const out = made(
      apply({ kind: 'pinInto', tag: 'h', direction: up, folderId: 'holes', newId: 'n' }),
    )
    for (const reading of ['x', 'h']) {
      const pick = {
        kind: 'choosePinReading',
        tag: 'h',
        target: 'takeOut',
        reading,
        readings: ['h', 'x'],
        folderId: 'holes',
      } as const
      for (const plan of [out, draft]) {
        expect(made(apply(pick, plan))).toEqual({
          ...plan,
          ...appChoosePin(plan, draft, 'h', 'takeOut', reading, ['h', 'x'], 'holes'),
        })
      }
    }
  })

  /** The app's pick among an Ignore click's readings (`useIgnoreChanges.choose`). */
  const appChooseIgnore = (
    plan: Constraints,
    saved: Constraints,
    tag: string,
    click: { tag: string | null; regions: Array<number> },
  ) => {
    const stands = (each: Constraints) => {
      const ignored = new Set(currentFor(each.done, each.doneKernel, rules.kernel))
      return click.regions.every((region) => ignored.has(region))
    }
    if (tag === click.tag && stands(plan)) {
      return plan
    }
    const back = stands(plan) ? takeBackIgnore(plan, saved, click.regions, rules) : plan
    return ignoreEdit(back, rules.regionsOf(tag), rules).intent
  }

  it('means another reading of an Ignore click, its click standing or undone', () => {
    const click = { tag: 'x', regions: [1, 2, 5] }
    const clicked = made(apply({ kind: 'ignore', regions: click.regions }))
    // An ignore stamped with no kernel counts as the part's own.
    const unstamped = { ...clicked, doneKernel: null }
    const savedIgnoring = { ...draft, done: [1], doneKernel: 'k1' }
    for (const tag of ['p', 'x']) {
      for (const plan of [clicked, unstamped, draft]) {
        for (const saved of [draft, savedIgnoring]) {
          const result = apply({ kind: 'chooseIgnoreReading', tag, click }, plan, saved)
          expect(made(result)).toEqual({ ...plan, ...appChooseIgnore(plan, saved, tag, click) })
        }
      }
    }
    // The faces it gives back go unsaid, as the app says only what it ignored.
    expect(made(apply({ kind: 'chooseIgnoreReading', tag: 'p', click }, clicked)).done).toEqual([
      1, 2,
    ])
    expect(apply({ kind: 'chooseIgnoreReading', tag: 'p', click }, clicked)).toMatchObject({
      facts: { unignored: [] },
    })
    expect(made(apply({ kind: 'chooseIgnoreReading', tag: 'x', click }, clicked))).toBe(clicked)
    expect(apply({ kind: 'chooseIgnoreReading', tag: 'p', click }, draft)).toMatchObject({
      facts: { unpinned: [{ tag: 'p', setupId: 'pockets' }] },
    })
  })

  it('needs the plan as applied for a pick among readings', () => {
    const pick = {
      kind: 'chooseIgnoreReading',
      tag: 'p',
      click: { tag: null, regions: [1] },
    } as const
    expect(applyDraftAction(draft, pick, rules)).toEqual({
      refused: 'This needs the plan as applied.',
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

  it('starts from Toolpath’s plan as Auto folders and Auto plan do', () => {
    const empty = { ...draft, setups: [], done: [1, 4, 9], doneKernel: 'k1' }
    const folders = apply({ kind: 'fromPlan', planned, pins: false, idSeed: 'a' }, empty)
    expect(made(folders)).toEqual({ ...empty, setups: foldersFromPlan(planned, ids('a')) })
    const pinned = apply({ kind: 'fromPlan', planned, pins: true, idSeed: 'a' }, empty)
    const stated = planFromResults(planned, ids('a'))
    expect(made(pinned)).toEqual({
      ...empty,
      ...unignorePinned({ ...empty, setups: stated }, ['p', 'q'], rules).intent,
    })
    expect(pinned).toMatchObject({ facts: { unignored: [1, 4] } })
  })

  it('starts from Toolpath’s plan only on a plan with no folders', () => {
    expect(apply({ kind: 'fromPlan', planned, pins: true, idSeed: 'a' })).toEqual({
      refused: 'Start from Toolpath’s plan while the plan holds no folders.',
    })
  })

  it('removes as the tree’s Remove, Remove all, ✕ on pins and Delete do', () => {
    expect(made(apply({ kind: 'remove', folders: ['holes'] })).setups).toEqual(
      removeFolder(setups, 'holes'),
    )
    expect(made(apply({ kind: 'remove', folders: ['top', 'bottom'] })).setups).toEqual([])
    // A folder's ✕ on its pins (`takeOutFrom`): each unpinned from that folder.
    const two = made(
      apply({ kind: 'pinInto', tag: 's', direction: up, folderId: 'holes', newId: 'n' }),
    )
    const out = ['h', 's'].map((tag) => ({ tag, setupId: 'holes' }))
    expect(made(apply({ kind: 'remove', folders: [], features: out }, two)).setups).toEqual(
      ['h', 's'].reduce((all, tag) => unpinFeature(all, 'holes', tag), [...two.setups]),
    )
    // A feature pinned in two folders is taken out of the one named, and stays in the other.
    const twice = {
      ...draft,
      setups: setups.map((setup) =>
        setup.id === 'bottom' ? { ...setup, features: ['q', 'h'] } : setup,
      ),
    }
    const fromBottom = made(
      apply({ kind: 'remove', folders: [], features: [{ tag: 'h', setupId: 'bottom' }] }, twice),
    )
    expect(fromBottom.setups).toEqual(unpinFeature(twice.setups, 'bottom', 'h'))
    expect(pinnedIn(fromBottom.setups, 'h')).toBe('holes')
  })

  it('names the folder to open only where the app opens one', () => {
    const opens = [
      { kind: 'addFolder', parentId: 'holes', id: 'n', workId: 'w' },
      { kind: 'addSetup', direction: side, id: 'n' },
      { kind: 'moveFolder', id: 'holes', to: { parentId: 'pockets', index: 0 }, newId: 'n' },
    ] as const
    expect(opens.map((action) => apply(action))).toMatchObject([
      { folderId: 'n' },
      { folderId: 'n' },
      { folderId: 'holes' },
    ])
    const staysOpen: Array<DraftAction> = [
      { kind: 'renameFolder', id: 'holes', name: 'Bores' },
      { kind: 'moveWithin', id: 'holes', by: -1 },
      { kind: 'setProcess', setupId: 'top', process: '3+1' },
      { kind: 'pinInto', tag: 'x', direction: up, folderId: 'holes', newId: 'n' },
      { kind: 'pinFrom', tag: 's', direction: side, newId: 'n' },
      {
        kind: 'choosePinReading',
        tag: 'h',
        target: 'takeOut',
        reading: 'x',
        readings: ['h', 'x'],
        folderId: 'holes',
      },
    ]
    for (const action of staysOpen) {
      const result = apply(action)
      expect(made(result)).toBeDefined()
      expect(result).not.toHaveProperty('folderId')
    }
  })
})

describe('actionsFor', () => {
  it('offers a setup its hold, and no tool orientation while it is 3 axis', () => {
    expect(actionsFor(draft, { folder: 'top' }, rules)).toEqual([
      'addFolder',
      'renameFolder',
      'remove',
      'moveFolder',
      'moveWithin',
      'setProcess',
    ])
  })

  it('offers a folder in an indexed setup a tool orientation', () => {
    const indexed = {
      ...draft,
      setups: setups.map((s) => (s.id === 'top' ? { ...s, process: '3+1' as const } : s)),
    }
    expect(actionsFor(draft, { folder: 'holes' }, rules)).not.toContain('setToolOrientation')
    expect(actionsFor(indexed, { folder: 'holes' }, rules)).toContain('setToolOrientation')
  })

  it('offers nothing for a folder that is gone', () => {
    expect(actionsFor(draft, { folder: 'gone' }, rules)).toEqual([])
  })

  it('offers no new folder at the deepest a folder may sit', () => {
    const at = { ...draft, setups: deepest() }
    expect(actionsFor(at, { folder: `f${MAX_DEPTH}` }, rules)).not.toContain('addFolder')
  })

  it('offers a lone setup no move', () => {
    const lone: DraftSetup = { id: 's', name: 'S', direction: up, features: [], folders: [] }
    expect(actionsFor({ ...draft, setups: [lone] }, { folder: 's' }, rules)).toEqual([
      'addFolder',
      'renameFolder',
      'remove',
      'setProcess',
    ])
  })

  it('offers a feature what fits its pin: elsewhere its way, from its way, or let go', () => {
    expect(actionsFor(draft, { feature: 'p', direction: up }, rules)).toEqual([
      'pinInto',
      'moveFeature',
      'unpin',
    ])
    expect(actionsFor(draft, { feature: 's', direction: side }, rules)).toEqual(['pinFrom'])
    expect(actionsFor(draft, { feature: 'x', direction: up }, rules)).toEqual([
      'pinInto',
      'pinFrom',
      'moveFeature',
    ])
  })

  it('offers no row drop where every drop lands it back where it is', () => {
    // Up is faced only by Top, a parent whose first folder cut that way is Pockets: p's own.
    const one: Array<DraftSetup> = [
      {
        id: 'top',
        name: 'Top',
        direction: up,
        features: [],
        folders: [
          { id: 'pockets', name: 'Pockets', features: ['p'], folders: [] },
          { id: 'other', name: 'Other', features: [], folders: [] },
        ],
      },
    ]
    const pinnedFirst = { ...draft, setups: one }
    expect(actionsFor(pinnedFirst, { feature: 'p', direction: up }, rules)).toEqual([
      'pinInto',
      'moveFeature',
      'unpin',
    ])
    const onlyParent = { ...draft, setups: [{ ...one[0]!, folders: [one[0]!.folders[0]!] }] }
    expect(actionsFor(onlyParent, { feature: 'p', direction: up }, rules)).toEqual([
      'pinInto',
      'unpin',
    ])
  })

  it('offers faces ignore or un-ignore, as they stand', () => {
    const ignored = { ...draft, done: [3], doneKernel: 'k1' }
    expect(actionsFor(draft, { faces: [3] }, rules)).toEqual(['ignore'])
    expect(actionsFor(ignored, { faces: [3] }, rules)).toEqual(['unignore'])
    expect(actionsFor(ignored, { faces: [3, 4] }, rules)).toEqual(['ignore', 'unignore'])
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
      [draft, { folder: 'top' }],
      [draft, { folder: 'holes' }],
      [indexed, { folder: 'holes' }],
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
      'choosePinReading',
      'chooseIgnoreReading',
      'fromPlan',
    ])
  })
})
