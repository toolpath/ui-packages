import { describe, expect, it } from 'vitest'
import {
  addLibrary,
  cribUntouched,
  explicitLibraryIds,
  fillsDefaultFamilies,
  implicitLibraryIds,
  keptEntries,
  MAX_CRIB_LIBRARIES,
  normalizeCrib,
  offeredLibraries,
  plansDefaultLast,
  removeLibrary,
  startingLibrary,
  suitsMaterial,
  swapLibraries,
  type ToolCrib,
  type ToolCribEntry,
} from '../../src/inputs/tool-crib'

describe('suitsMaterial', () => {
  it('suits a part in one of the families a library is meant for', () => {
    expect(suitsMaterial(['P', 'M'], 'M')).toBe(true)
    expect(suitsMaterial(['P', 'M'], 'N')).toBe(false)
  })

  it('suits every part when a library is meant for no family in particular', () => {
    expect(suitsMaterial([], 'N')).toBe(true)
  })

  it('offers every library to a part with no material', () => {
    expect(suitsMaterial(['P'], null)).toBe(true)
  })
})

describe('implicitLibraryIds', () => {
  it('names the implicit libraries in the crib, in its order', () => {
    expect(
      implicitLibraryIds([
        { kind: 'implicit', id: 'b' },
        { kind: 'implicit', id: 'a' },
      ]),
    ).toEqual(['b', 'a'])
  })
})

describe('startingLibrary', () => {
  const library = (id: string, materialFamilies: Array<string>, isFallback = false) => ({
    id,
    materialFamilies,
    isFallback,
  })
  const DEFAULT = library('default', [], true)
  const STEEL = library('steel', ['P', 'M'])
  const ALUMINIUM = library('aluminium', ['N'])

  it('starts on the first library meant for the part’s family in particular', () => {
    expect(startingLibrary([DEFAULT, ALUMINIUM, STEEL], 'M')?.id).toBe('steel')
  })

  it('falls back to the fallback library when none names the family', () => {
    expect(startingLibrary([ALUMINIUM, DEFAULT, STEEL], 'K')?.id).toBe('default')
  })

  it('takes the first that suits when the fallback does not', () => {
    const steelDefault = library('default', ['P'], true)
    expect(startingLibrary([steelDefault, library('any', [])], 'N')?.id).toBe('any')
  })

  it('still picks the fallback when nothing suits, since a part needs tools', () => {
    const steelDefault = library('default', ['P'], true)
    expect(startingLibrary([steelDefault, ALUMINIUM], 'M')?.id).toBe('default')
  })

  it('starts a part with no material on the fallback', () => {
    expect(startingLibrary([STEEL, DEFAULT], null)?.id).toBe('default')
  })
})

describe('offeredLibraries', () => {
  const library = (id: string, materialFamilies: Array<string>) => ({
    id,
    isFallback: false,
    materialFamilies,
  })
  const steel = library('steel', ['P'])
  const all = library('all', [])
  const aluminium = library('aluminium', ['N'])
  const ids = (offered: ReadonlyArray<{ id: string }>) => offered.map((each) => each.id)

  it('offers every library not in the crib, those suiting the material first', () => {
    expect(ids(offeredLibraries([steel, all, aluminium], [], 'N'))).toEqual([
      'all',
      'aluminium',
      'steel',
    ])
    expect(ids(offeredLibraries([steel, all, aluminium], ['all'], 'N'))).toEqual([
      'aluminium',
      'steel',
    ])
  })

  it('keeps their order when the part has no material', () => {
    expect(ids(offeredLibraries([steel, all, aluminium], [], null))).toEqual([
      'steel',
      'all',
      'aluminium',
    ])
  })
})

describe('cribUntouched', () => {
  const libraries = [
    { id: 'default', isFallback: true, materialFamilies: [] },
    { id: 'steel', isFallback: false, materialFamilies: ['P'] },
  ]

  it('takes an empty crib, or just the library the material starts on, as nobody’s choice', () => {
    expect(cribUntouched([], libraries, 'P')).toBe(true)
    expect(cribUntouched([{ kind: 'implicit', id: 'steel' }], libraries, 'P')).toBe(true)
  })

  it('takes any other crib as somebody’s choice', () => {
    expect(cribUntouched([{ kind: 'implicit', id: 'default' }], libraries, 'P')).toBe(false)
    expect(
      cribUntouched(
        [
          { kind: 'implicit', id: 'steel' },
          { kind: 'implicit', id: 'default' },
        ],
        libraries,
        'P',
      ),
    ).toBe(false)
  })
})

describe('crib edits', () => {
  const crib: ToolCrib = [
    { kind: 'implicit', id: 'a' },
    { kind: 'implicit', id: 'b' },
    { kind: 'implicit', id: 'c' },
  ]

  it('adds a library last, and only once', () => {
    expect(implicitLibraryIds(addLibrary(crib, 'd'))).toEqual(['a', 'b', 'c', 'd'])
    expect(addLibrary(crib, 'b')).toBe(crib)
  })

  it('removes a library, the last one too', () => {
    expect(implicitLibraryIds(removeLibrary(crib, 'b'))).toEqual(['a', 'c'])
    expect(removeLibrary([{ kind: 'implicit', id: 'a' }], 'a')).toEqual([])
  })

  it('swaps two libraries and leaves the rest in place', () => {
    expect(implicitLibraryIds(swapLibraries(crib, 'c', 'b'))).toEqual(['a', 'c', 'b'])
  })
})

describe('explicit libraries in a crib', () => {
  const implicit = (id: string) => ({ kind: 'implicit' as const, id })
  const explicit = (id: string) => ({ kind: 'explicit' as const, id })

  it('puts every explicit library first, each group in the order given', () => {
    expect(normalizeCrib([implicit('a'), explicit('x'), implicit('b'), explicit('y')])).toEqual([
      explicit('x'),
      explicit('y'),
      implicit('a'),
      implicit('b'),
    ])
  })

  it('never cuts a crib longer than sixteen, a legacy one kept as long, explicit ones first', () => {
    const many = Array.from({ length: 20 }, (_, index) => implicit(`i${index}`))
    const crib = normalizeCrib([...many, explicit('x')])
    expect(crib).toHaveLength(21)
    expect(crib[0]).toEqual(explicit('x'))
    expect(crib.at(-1)).toEqual(implicit('i19'))
  })

  it('keeps nothing but the kind and id', () => {
    expect(normalizeCrib([{ ...explicit('x'), name: 'n' } as ToolCribEntry])).toEqual([
      explicit('x'),
    ])
  })

  it('names each kind’s ids', () => {
    const crib = [explicit('x'), implicit('a')]
    expect(explicitLibraryIds(crib)).toEqual(['x'])
    expect(implicitLibraryIds(crib)).toEqual(['a'])
  })

  it('adds a library last of its kind: an explicit one ahead of every implicit one', () => {
    const crib = [explicit('x'), implicit('a')]
    expect(addLibrary(crib, 'y', 'explicit')).toEqual([explicit('x'), explicit('y'), implicit('a')])
    expect(addLibrary(crib, 'b')).toEqual([explicit('x'), implicit('a'), implicit('b')])
    expect(addLibrary(crib, 'x', 'explicit')).toBe(crib)
  })

  it('adds nothing to a full crib', () => {
    const full = Array.from({ length: MAX_CRIB_LIBRARIES }, (_, index) => implicit(`i${index}`))
    expect(addLibrary(full, 'x', 'explicit')).toBe(full)
    expect(addLibrary(full, 'more')).toBe(full)
  })

  it('swaps within a kind, never across', () => {
    const crib = [explicit('x'), explicit('y'), implicit('a'), implicit('b')]
    expect(swapLibraries(crib, 'x', 'y')).toEqual([
      explicit('y'),
      explicit('x'),
      implicit('a'),
      implicit('b'),
    ])
    expect(swapLibraries(crib, 'b', 'a')).toEqual([
      explicit('x'),
      explicit('y'),
      implicit('b'),
      implicit('a'),
    ])
    expect(swapLibraries(crib, 'y', 'a')).toBe(crib)
  })
})

describe('how a crib is planned and kept', () => {
  const implicit = (id: string) => ({ kind: 'implicit' as const, id })
  const explicit = (id: string) => ({ kind: 'explicit' as const, id })

  it('fills default families only in a crib of implicit libraries alone', () => {
    expect(fillsDefaultFamilies([implicit('a'), implicit('b')])).toBe(true)
    expect(fillsDefaultFamilies([])).toBe(true)
    expect(fillsDefaultFamilies([explicit('x'), implicit('a')])).toBe(false)
  })

  it('plans the fallback library last only behind explicit libraries', () => {
    expect(plansDefaultLast([explicit('x')], 'default')).toBe(true)
    expect(plansDefaultLast([explicit('x'), implicit('a')], 'default')).toBe(true)
    expect(plansDefaultLast([implicit('a')], 'default')).toBe(false)
    expect(plansDefaultLast([], 'default')).toBe(false)
  })

  it('does not plan the fallback library last where the crib names it, or there is none', () => {
    expect(plansDefaultLast([explicit('x'), implicit('default')], 'default')).toBe(false)
    expect(plansDefaultLast([explicit('x')], null)).toBe(false)
    expect(plansDefaultLast([explicit('x')], undefined)).toBe(false)
    // An explicit entry of the same id is another library.
    expect(plansDefaultLast([explicit('default')], 'default')).toBe(true)
  })

  it('plans the fallback library last only within the sixteen', () => {
    const almost = [
      explicit('x'),
      ...Array.from({ length: MAX_CRIB_LIBRARIES - 2 }, (_, index) => implicit(`i${index}`)),
    ]
    expect(almost).toHaveLength(MAX_CRIB_LIBRARIES - 1)
    expect(plansDefaultLast(almost, 'default')).toBe(true)
    expect(plansDefaultLast([...almost, implicit('last')], 'default')).toBe(false)
  })

  it('keeps a changed crib’s live entries in order, dropping a saved one no longer live', () => {
    const live = new Set(['x', 'a'])
    const crib = [explicit('x'), explicit('gone'), implicit('a'), implicit('also-gone')]
    expect(keptEntries(crib, ({ id }) => live.has(id), crib)).toEqual({
      kept: [explicit('x'), implicit('a')],
      refused: false,
    })
  })

  it('refuses a changed crib naming a library neither live nor saved', () => {
    const live = new Set(['x'])
    const saved = [explicit('x'), explicit('gone')]
    expect(
      keptEntries(
        [explicit('x'), explicit('gone'), implicit('new')],
        ({ id }) => live.has(id),
        saved,
      ),
    ).toEqual({ kept: [explicit('x')], refused: true })
  })

  it('reads a saved entry by its kind and id together', () => {
    // The saved crib names an implicit library of that id, not an explicit one.
    expect(keptEntries([explicit('a')], () => false, [implicit('a')]).refused).toBe(true)
  })
})

describe('the fallback library, by either name', () => {
  // Meant for steel alone: a part in aluminium starts on the fallback, whichever it is.
  const steel = { id: 'steel', materialFamilies: ['P'] }
  const any = { id: 'any', materialFamilies: [] as Array<string> }

  it('reads the deprecated isDefault as before', () => {
    const libraries = [
      { ...any, isDefault: false },
      { ...steel, isDefault: false },
      { id: 'old', materialFamilies: [], isDefault: true },
    ]
    expect(startingLibrary(libraries, 'N')?.id).toBe('old')
    expect(cribUntouched([{ kind: 'implicit', id: 'old' }], libraries, 'N')).toBe(true)
  })

  it('reads isFallback', () => {
    const libraries = [
      { ...any, isFallback: false },
      { ...steel, isFallback: false },
      { id: 'new', materialFamilies: [], isFallback: true },
    ]
    expect(startingLibrary(libraries, 'N')?.id).toBe('new')
    expect(cribUntouched([{ kind: 'implicit', id: 'new' }], libraries, 'N')).toBe(true)
  })

  it('takes isFallback over isDefault where a library has both', () => {
    const libraries = [
      { ...any, isFallback: false, isDefault: true },
      { id: 'new', materialFamilies: [], isFallback: true, isDefault: false },
    ]
    expect(startingLibrary(libraries, 'N')?.id).toBe('new')
  })

  it('reads a library with neither, as a caller without types may send, as no fallback', () => {
    type Library = Parameters<typeof startingLibrary>[0][number]
    const libraries = [any, { id: 'other', materialFamilies: [] }] as unknown as Array<Library>
    // No fallback: the first that suits.
    expect(startingLibrary(libraries, 'N')?.id).toBe('any')
  })
})
