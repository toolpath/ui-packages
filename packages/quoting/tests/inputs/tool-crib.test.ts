import { describe, expect, it } from 'vitest'
import {
  addLibrary,
  cribUntouched,
  implicitLibraryIds,
  offeredLibraries,
  removeLibrary,
  startingLibrary,
  suitsMaterial,
  swapLibraries,
  type ToolCrib,
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
  const library = (id: string, materialFamilies: Array<string>, isDefault = false) => ({
    id,
    materialFamilies,
    isDefault,
  })
  const DEFAULT = library('default', [], true)
  const STEEL = library('steel', ['P', 'M'])
  const ALUMINIUM = library('aluminium', ['N'])

  it('starts on the first library meant for the part’s family in particular', () => {
    expect(startingLibrary([DEFAULT, ALUMINIUM, STEEL], 'M')?.id).toBe('steel')
  })

  it('falls back to the default when none names the family', () => {
    expect(startingLibrary([ALUMINIUM, DEFAULT, STEEL], 'K')?.id).toBe('default')
  })

  it('takes the first that suits when the default does not', () => {
    const steelDefault = library('default', ['P'], true)
    expect(startingLibrary([steelDefault, library('any', [])], 'N')?.id).toBe('any')
  })

  it('still picks the default when nothing suits, since a part needs tools', () => {
    const steelDefault = library('default', ['P'], true)
    expect(startingLibrary([steelDefault, ALUMINIUM], 'M')?.id).toBe('default')
  })

  it('starts a part with no material on the default', () => {
    expect(startingLibrary([STEEL, DEFAULT], null)?.id).toBe('default')
  })
})

describe('offeredLibraries', () => {
  const library = (id: string, materialFamilies: Array<string>) => ({
    id,
    isDefault: false,
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
    { id: 'default', isDefault: true, materialFamilies: [] },
    { id: 'steel', isDefault: false, materialFamilies: ['P'] },
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
