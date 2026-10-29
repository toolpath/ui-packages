import { describe, expect, it } from 'vitest'
import type { ExplodeGroup } from '../src/model/explode.js'
import {
  hoveredPieces,
  paintKey,
  piecesFor,
  selectionKey,
  settleClick,
  type PieceClick,
} from '../src/model/explode-selection.js'

const piece = (id: string, featureTags: Array<string>): ExplodeGroup => ({
  id,
  regionIdxs: [0],
  offset: { x: 0, y: 0, z: 0 },
  color: 0,
  featureTags,
})

// One piece per face: feature `f` has two faces, and `g` shares the second.
const groups = [piece('face-1', ['f']), piece('face-2', ['f', 'g']), piece('face-3', ['h'])]

/** The pieces a selection lights, after the selections the application has passed in turn. */
const lit = (click: PieceClick | null, selections: Array<Array<string>>) => {
  let settled = click
  for (const selection of selections) {
    settled = settleClick(settled, selection.join('\n'))
  }
  return piecesFor(groups, selections.at(-1), settled?.id ?? null)
}

describe('piecesFor', () => {
  it('lights every piece standing for a feature, matched without regard to case', () => {
    expect(piecesFor(groups, ['F'], null)).toEqual(['face-1', 'face-2'])
    expect(piecesFor(groups, [], 'face-1')).toBeNull()
    expect(piecesFor(groups, undefined, null)).toBeNull()
  })

  it('keeps a feature’s selection to the clicked piece, only when it is one of them', () => {
    expect(piecesFor(groups, ['f'], 'face-2')).toBe('face-2')
    expect(piecesFor(groups, ['h'], 'face-2')).toEqual(['face-3'])
  })

  it('keeps every piece of the other selected features when a click adds to the selection', () => {
    // `h` was selected, and a click on `face-1` added `f`: the other `f` piece stays dark.
    expect(piecesFor(groups, ['h', 'f'], 'face-1')).toEqual(['face-1', 'face-3'])
    // `face-2` also stands for `g`, which the click on `face-1` does not, so it stays lit for `g`.
    expect(piecesFor(groups, ['g', 'F'], 'face-1')).toEqual(['face-1', 'face-2'])
    // A click on `face-2` stands for both `f` and `g`, so it keeps both to itself.
    expect(piecesFor(groups, ['f', 'g', 'h'], 'face-2')).toEqual(['face-2', 'face-3'])
  })
})

describe('selectionKey and paintKey', () => {
  it('key a fresh array by its contents', () => {
    expect(selectionKey(['f', 'g'])).toBe(selectionKey(['f', 'g']))
    expect(selectionKey(['f', 'g'])).not.toBe(selectionKey(['g', 'f']))
    expect(selectionKey(undefined)).toBe('')
    expect(selectionKey([])).toBe('')
  })

  it('tell paint entries apart by target, color and weight', () => {
    const layer = [{ tag: 'f', color: 0xff0000 }]
    expect(paintKey(layer)).toBe(paintKey([{ tag: 'f', color: 0xff0000 }]))
    expect(paintKey(layer)).not.toBe(paintKey([{ tag: 'f', color: 0xff0000, weight: 1 }]))
    expect(paintKey(layer)).not.toBe(paintKey([{ tag: 'f', color: 0x00ff00 }]))
    expect(paintKey([{ region: 2, color: 1 }])).not.toBe(paintKey([{ region: 3, color: 1 }]))
    expect(paintKey(undefined)).toBe(paintKey([]))
  })
})

describe('hoveredPieces', () => {
  const base = { hovered: undefined, hover: true, pointed: null, hoveredFeatures: undefined }

  it('takes the application’s own hovered pieces over everything else', () => {
    const own = { ...base, pointed: 'face-1', hoveredFeatures: ['h'] }
    expect(hoveredPieces(groups, { ...own, hovered: 'face-3' })).toBe('face-3')
    expect(hoveredPieces(groups, { ...own, hovered: null })).toBeNull()
  })

  it('lights the piece under the pointer while hover is on', () => {
    expect(hoveredPieces(groups, { ...base, pointed: 'face-2', hoveredFeatures: ['h'] })).toBe(
      'face-2',
    )
  })

  it('falls back to the hovered features, every piece of them', () => {
    const listed = { ...base, hoveredFeatures: ['f'] }
    expect(hoveredPieces(groups, listed)).toEqual(['face-1', 'face-2'])
    expect(hoveredPieces(groups, { ...listed, hover: false, pointed: 'face-3' })).toEqual([
      'face-1',
      'face-2',
    ])
    expect(hoveredPieces(groups, base)).toBeNull()
  })
})

describe('settleClick', () => {
  it('keeps the selection the click produced to the clicked piece', () => {
    const click = { id: 'face-1', before: '', after: null }
    // Before the application answers, and once it has.
    expect(lit(click, [[]])).toBeNull()
    expect(lit(click, [['f']])).toBe('face-1')
    expect(lit(click, [['f'], ['f']])).toBe('face-1')
  })

  it('lets go once the selection moves on, so a list row lights every piece', () => {
    const click = { id: 'face-1', before: '', after: null }
    // Cleared by a click on nothing, then `f` chosen from a list.
    expect(lit(click, [['f'], [], ['f']])).toEqual(['face-1', 'face-2'])
    // Another feature chosen, then `f` again.
    expect(lit(click, [['f'], ['h'], ['f']])).toEqual(['face-1', 'face-2'])
  })

  it('holds a selection that arrived before the click did', () => {
    // The application answered first: the selection already differs from the one clicked on.
    const click = { id: 'face-2', before: '', after: null }
    const settled = settleClick(click, 'f')
    expect(settled).toEqual({ id: 'face-2', before: '', after: 'f' })
    expect(settleClick(settled, 'f')).toBe(settled)
    expect(settleClick(settled, '')).toBeNull()
  })

  it('holds a click that left the selection unchanged until the selection changes twice', () => {
    const click = { id: 'face-2', before: 'f', after: null }
    expect(settleClick(click, 'f')).toBe(click)
    expect(lit(click, [['f'], ['g'], ['f']])).toEqual(['face-1', 'face-2'])
  })

  it('stays dropped', () => {
    expect(settleClick(null, 'f')).toBeNull()
  })
})
