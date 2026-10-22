import { describe, expect, it } from 'vitest'
import { unpinFeature, type DraftSetup } from '../src/plan-draft'
import type { CoverageKind } from '../src/coverage'
import type { PlanSetupView } from '../src/plan-view'
import {
  chooseReading,
  folderClick,
  pinEdit,
  stateOf,
  takeBack,
  type PlanReading,
  replacedBy,
  unignorePinned,
  withPin,
  type PinContext,
} from '../src/pin'

const up = { x: 0, y: 0, z: 1 }
const down = { x: 0, y: 0, z: -1 }

// 'p' is pinned in Top; 'q' in Bottom, a folder of its own.
const setups: Array<DraftSetup> = [
  { id: 'top', name: 'Top', direction: up, features: ['p'], folders: [] },
  { id: 'bottom', name: 'Bottom', direction: down, features: ['q'], folders: [] },
]

describe('replacedBy', () => {
  // 'p' (Top) and 'q' (Bottom) are pinned; 'x' reads p's faces and more from another way; 'w' shares
  // only one of q's faces.
  const regions: Record<string, Array<number>> = {
    p: [1, 2],
    q: [3, 4],
    x: [1, 2, 5],
    w: [4, 6],
  }
  const regionsOf = (tag: string) => regions[tag] ?? []

  it('names the pins whose every face the new pin covers, wherever they are', () => {
    expect(replacedBy(setups, 'x', regionsOf)).toEqual([{ setupId: 'top', tag: 'p' }])
  })

  it('keeps a pin it only overlaps, and never names the feature itself', () => {
    expect(replacedBy(setups, 'w', regionsOf)).toEqual([])
    expect(replacedBy(setups, 'p', regionsOf)).toEqual([])
  })
})

describe('pinEdit', () => {
  const side = { x: 1, y: 0, z: 0 }
  const top = (features: Array<string> = []): DraftSetup => ({
    id: 'top',
    name: 'Top',
    direction: up,
    features,
    folders: [],
  })
  const regions: Record<string, Array<number>> = { a: [1, 2], b: [1, 2, 3], c: [3, 4] }
  const context: PinContext = { regionsOf: (tag) => regions[tag] ?? [], kernel: 'k1' }

  it('pins into the folder facing its way, its ignored faces no longer ignored', () => {
    const result = pinEdit(
      { setups: [top()], done: [1, 7], doneKernel: 'k1' },
      'a',
      { direction: up, newId: 'n' },
      context,
    )
    expect(result).toEqual({
      intent: { setups: [top(['a'])], done: [7], doneKernel: 'k1' },
      setupId: 'top',
      added: false,
      unpinned: false,
      replaced: [],
      unignored: [1],
    })
  })

  it('adds a folder for a direction none faces', () => {
    const result = pinEdit(
      { setups: [top()], done: [], doneKernel: null },
      'a',
      { direction: side, newId: 'n' },
      context,
    )
    expect(result).toEqual({
      intent: {
        setups: [
          top(),
          { id: 'n', name: 'Folder 1', direction: side, features: ['a'], folders: [] },
        ],
        done: [],
        doneKernel: null,
      },
      setupId: 'n',
      added: true,
      unpinned: false,
      replaced: [],
      unignored: [],
    })
  })

  it('replaces the pins it covers, keeps one it only overlaps, and unpins a pin pinned again', () => {
    const plan = { setups: [top(['a', 'c'])], done: [], doneKernel: null }
    const result = pinEdit(plan, 'b', { folderId: 'top' }, context)
    expect(result).toEqual({
      intent: { setups: [top(['c', 'b'])], done: [], doneKernel: null },
      setupId: 'top',
      added: false,
      unpinned: false,
      replaced: ['a'],
      unignored: [],
    })
    const again = pinEdit(plan, 'a', { folderId: 'top' }, context)
    expect(again).toEqual({
      intent: { setups: [top(['c'])], done: [], doneKernel: null },
      setupId: 'top',
      added: false,
      unpinned: true,
      replaced: [],
      unignored: [],
    })
  })
})

describe('withPin', () => {
  it('ends a pin made by a drop as pinEdit does: covered pins replaced, its faces un-ignored', () => {
    const plan = {
      setups: [{ id: 'top', name: 'Top', direction: up, features: ['a'], folders: [] }],
      done: [1, 7],
      doneKernel: 'k1',
    }
    const dropped = [{ ...plan.setups[0]!, features: ['a', 'b'] }]
    const context: PinContext = {
      regionsOf: (tag) => ({ a: [1, 2], b: [1, 2, 3] })[tag] ?? [],
      kernel: 'k1',
    }
    expect(withPin(plan, 'b', dropped, context)).toEqual({
      intent: {
        setups: [{ ...plan.setups[0]!, features: ['b'] }],
        done: [7],
        doneKernel: 'k1',
      },
      replaced: ['a'],
      unignored: [1],
    })
  })
})

describe('unignorePinned', () => {
  const context: PinContext = {
    regionsOf: (tag) => ({ a: [1, 2], b: [2, 3] })[tag] ?? [],
    kernel: 'k1',
  }

  it('lets go every ignored face of the features pinned, and names them', () => {
    const plan = { setups, done: [2, 3, 9], doneKernel: 'k1' }
    expect(unignorePinned(plan, ['a', 'b'], context)).toEqual({
      intent: { setups, done: [9], doneKernel: 'k1' },
      unignored: [2, 3],
    })
  })

  it('leaves the plan as it is where none of their faces is ignored', () => {
    const plan = { setups, done: [9], doneKernel: 'k1' }
    expect(unignorePinned(plan, ['a'], context)).toEqual({ intent: plan, unignored: [] })
  })
})

describe('folderClick and chooseReading', () => {
  const regions: Record<string, Array<number>> = { p: [1, 2], q: [3, 4], r: [1] }
  const context: PinContext = { regionsOf: (tag) => regions[tag] ?? [], kernel: 'k1' }
  const saved: Parameters<typeof folderClick>[0] = { setups, done: [], doneKernel: null }
  const top = { id: 'top', name: 'Top' }
  const click = (plan: typeof saved, tag: string, inFolder = false) =>
    folderClick(plan, { tag, label: tag.toUpperCase(), direction: up, inFolder }, top, context)

  it('pins what is not in the folder, and unpins what is', () => {
    const { intent, note } = click(saved, 'r')
    expect(note).toBe('R pinned to Top.')
    expect(intent.setups[0]?.features).toEqual(['p', 'r'])
    expect(click(intent, 'r', true)).toEqual({ intent: saved, note: 'R taken out of Top.' })
  })

  it('chooses on a line: a pin swaps; a feature taken out stays out, one other pinned instead', () => {
    const top = { id: 'top', direction: up }
    // q, pinned in Bottom as saved, is clicked here: pinned in Top.
    const { intent } = click(saved, 'q')
    const pinned = { tag: 'q', target: 'pin' as const }
    expect(chooseReading(intent, saved, pinned, 'q', ['q', 'r'], top, context)).toEqual({
      intent,
      chosen: ['q'],
    })
    // Another chosen in its place: q goes as a click takes it out — unpinned, in no folder.
    const swapped = chooseReading(intent, saved, pinned, 'r', ['q', 'r'], top, context)
    expect(swapped.intent.setups.map((each) => each.features)).toEqual([['p', 'r'], []])
    expect(swapped.chosen).toEqual(['r'])

    const line = { tag: 'p', target: 'takeOut' as const }
    const read = ['p', 'r', 'q']
    const out = click(saved, 'p', true).intent
    const besides = chooseReading(out, saved, line, 'r', read, top, context)
    expect(besides.intent.setups.map((each) => each.features)).toEqual([['r'], ['q']])
    expect(besides.chosen).toEqual(['r', 'p'])
    // Choosing another lets the one before go; so does taking it out. Neither goes back where it was.
    const other = chooseReading(besides.intent, saved, line, 'q', read, top, context)
    expect(other.intent.setups.map((each) => each.features)).toEqual([['q'], []])
    const none = chooseReading(other.intent, saved, line, 'p', read, top, context)
    expect(none.intent.setups.map((each) => each.features)).toEqual([[], []])
    expect(none.chosen).toEqual(['p'])
  })

  it('keeps a pin in the folder as saved when another is chosen instead of taking out', () => {
    const top = { id: 'top', direction: up }
    // p and q are pinned in Top as saved.
    const both = {
      setups: [
        { ...setups[0]!, features: ['p', 'q'] },
        { ...setups[1]!, features: [] },
      ],
      done: [],
      doneKernel: null,
    }
    const line = { tag: 'p', target: 'takeOut' as const }
    const read = ['p', 'r', 'q']
    const out = click(both, 'p', true).intent
    const kept = (features: Array<string>) => ({
      setups: [
        { ...setups[0]!, features },
        { ...setups[1]!, features: [] },
      ],
      done: [],
      doneKernel: null,
    })
    expect(chooseReading(out, both, line, 'r', read, top, context)).toEqual({
      intent: kept(['q', 'r']),
      chosen: ['r', 'p'],
    })
    // Chosen itself, the saved pin stays pinned: not pinned again, which would take it out.
    expect(chooseReading(out, both, line, 'q', read, top, context)).toEqual({
      intent: kept(['q']),
      chosen: ['q', 'p'],
    })
  })

  it('keeps a saved pin taken out out, though a feature chosen over it is let go again', () => {
    const top = { id: 'top', direction: up }
    const regions: Record<string, Array<number>> = { floor: [1], pocket: [1, 2], other: [1, 3] }
    const covering = { ...context, regionsOf: (tag: string) => regions[tag] ?? [] }
    const floor = {
      setups: [
        { ...setups[0]!, features: ['floor'] },
        { ...setups[1]!, features: [] },
      ],
      done: [],
      doneKernel: null,
    }
    const line = { tag: 'floor', target: 'takeOut' as const }
    const read = ['floor', 'pocket', 'other']
    const out = folderClick(
      floor,
      { tag: 'floor', label: 'Floor', direction: up, inFolder: true },
      { id: 'top', name: 'Top' },
      covering,
    ).intent
    // Pocket covers floor, so pinning it replaces floor; letting it go would put floor back.
    const pocket = chooseReading(out, floor, line, 'pocket', read, top, covering)
    expect(pocket.intent.setups.map((each) => each.features)).toEqual([['pocket'], []])
    expect(chooseReading(pocket.intent, floor, line, 'floor', read, top, covering)).toEqual({
      intent: {
        setups: [
          { ...setups[0]!, features: [] },
          { ...setups[1]!, features: [] },
        ],
        done: [],
        doneKernel: null,
      },
      chosen: ['floor'],
    })
  })

  it('says a pin’s faces are no longer ignored, and puts them back where another is chosen', () => {
    const ignoring = { ...saved, done: [1, 2], doneKernel: 'k1' }
    const { intent, note } = click(ignoring, 'r')
    expect(note).toBe('R pinned to Top. Region 1 no longer ignored.')
    expect(intent.done).toEqual([2])
    // q is chosen in r's place: r's face is ignored again as saved, and q's faces are not ignored.
    const here = { id: 'top', direction: up }
    const swapped = chooseReading(
      intent,
      ignoring,
      { tag: 'r', target: 'pin' },
      'q',
      ['r', 'q'],
      here,
      context,
    )
    expect(swapped.intent.done).toEqual([1, 2])
    expect(swapped.intent.setups[0]?.features).toEqual(['p', 'q'])
  })

  it('changes nothing when a pin’s line chooses the pin itself', () => {
    const plan = click(saved, 'r').intent
    const here = { id: 'top', direction: up }
    expect(
      chooseReading(plan, saved, { tag: 'r', target: 'pin' }, 'r', ['r', 'p'], here, context),
    ).toEqual({ intent: plan, chosen: ['r'] })
  })
})

describe('takeBack', () => {
  const regions: Record<string, Array<number>> = { p: [1, 2], x: [1, 2, 5], q: [3, 4] }
  const context = { regionsOf: (tag: string) => regions[tag] ?? [], kernel: 'k1' }
  const saved = { setups, done: [5, 7], doneKernel: 'k1' }

  it('puts back a pin and the pins it replaced; other edits, and ignored faces, stand', () => {
    const pinned = pinEdit(saved, 'x', { folderId: 'bottom' }, context)
    if ('refused' in pinned) {
      throw new Error(pinned.refused)
    }
    // x replaced p in Top; then q was taken out too, and a face ignored.
    expect(pinned.replaced).toEqual(['p'])
    const later = {
      setups: unpinFeature(pinned.intent.setups, 'bottom', 'q'),
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

  it('puts back the pins a pin moved from another folder replaced', () => {
    // x, pinned in Bottom as saved, is moved to Top, where it replaces p.
    const moved = pinEdit(
      { ...saved, setups: [setups[0]!, { ...setups[1]!, features: ['x'] }] },
      'x',
      { folderId: 'top' },
      context,
    )
    if ('refused' in moved) {
      throw new Error(moved.refused)
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

  it('puts back only a feature taken out, not the pins its faces cover', () => {
    // x covers p's faces; both are pinned as saved, and both have since been let go.
    const both: Array<DraftSetup> = [
      { ...setups[0]!, features: ['p'] },
      { ...setups[1]!, features: ['x'] },
    ]
    const asSaved = { setups: both, done: [], doneKernel: null }
    const plan = { ...asSaved, setups: unpinFeature(unpinFeature(both, 'top', 'p'), 'bottom', 'x') }
    expect(takeBack(plan, asSaved, 'x', context).setups.map((each) => each.features)).toEqual([
      [],
      ['x'],
    ])
  })
})

describe('stateOf', () => {
  const names: Record<string, string> = {
    f1: 'Folder 1',
    f2: 'Folder 2',
    f3: 'Folder 3',
    f4: 'Folder 4',
  }
  const view = (id: string, tags: Array<string> = []): PlanSetupView =>
    ({
      id,
      name: names[id],
      orientations: [{ features: tags.map((tag) => ({ tag, label: tag.toUpperCase() })) }],
    }) as unknown as PlanSetupView
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
    folders: Array<PlanSetupView>,
    kinds: Record<number, CoverageKind> = {},
  ): PlanReading => ({ folders, kindOf: (region) => kinds[region] ?? 'open' })
  const state = (tag: string, plan: PlanReading) => stateOf(tag, plan, 'f1', regionsOf).text

  it('reads a feature’s state in the glossary’s words, from the open folder', () => {
    expect(state('c', reading([view('f1')]))).toBe('Open')
    expect(state('c', reading([view('f1')], { 3: 'ignored' }))).toBe('Ignored')
    expect(state('c', reading([view('f1', ['c'])], { 3: 'pinned' }))).toBe('Pinned')
    expect(state('c', reading([view('f1'), view('f2', ['c'])], { 3: 'pinned' }))).toBe(
      'Pinned in Folder 2',
    )
  })

  it('reads a feature inside another as part of it, and names the first of several folders', () => {
    const one = reading([view('f1'), view('f3', ['pocket'])], { 5: 'pinned' })
    expect(state('floor', one)).toBe('Part of POCKET in Folder 3')
    const two = reading([view('f1'), view('f2', ['pocket']), view('f3', ['pocket'])], {
      5: 'pinned',
    })
    expect(state('floor', two)).toBe('Part of POCKET in Folder 2 +1')
    const three = reading(
      [view('f1'), view('f2', ['pocket']), view('f3', ['pocket']), view('f4', ['pocket'])],
      { 5: 'pinned' },
    )
    expect(state('floor', three)).toBe('Part of POCKET in Folder 2 +2')
  })

  it('names no folder for faces only shared with a row there, where they are open', () => {
    // w, in Folder 2, shares only face 2 of a's.
    const plan = reading([view('f1'), view('f2', ['w'])], { 1: 'open', 2: 'open' })
    expect(stateOf('a', plan, 'f1', regionsOf)).toEqual({ text: 'Open', folders: [] })
  })
})
