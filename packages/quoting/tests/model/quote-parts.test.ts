import { describe, expect, it } from 'vitest'
import {
  documentName,
  documentParts,
  isSinglePart,
  partsByAssembly,
  quotedParts,
} from '../../src/model/quote-parts'

const part = ({ noQuote = false, estimated = false } = {}) => ({
  noQuote,
  state: {
    kind: 'priced' as const,
    review: estimated ? ('approved' as const) : ('new' as const),
    edited: false,
  },
})

describe('which parts are on the quote', () => {
  it('leaves out the parts set to No quote', () => {
    const on = part()
    expect(quotedParts([on, part({ noQuote: true })])).toEqual([on])
  })
})

describe('what the quote page prices, and names as left out', () => {
  /** A part alone: an assembly of it, ×1. */
  const named = (name: string, options: Parameters<typeof part>[0] = {}) => ({
    ...part(options),
    name,
    assemblyId: name,
    assemblyName: `${name}.step`,
    count: 1,
  })

  it('has nothing in it, and nothing waiting, with no parts', () => {
    expect(documentParts([])).toEqual({ inQuote: [], waiting: [] })
  })

  it('prices only the parts moved into Quote, naming the rest in their order', () => {
    const quoted = named('Bracket', { estimated: true })
    expect(
      documentParts([named('Housing'), quoted, named('Cover'), named('Pin', { estimated: true })]),
    ).toEqual({
      inQuote: [quoted, named('Pin', { estimated: true })],
      waiting: ['Housing', 'Cover'],
    })
  })

  it('leaves a part in Plan, or with a plan changed since it was priced, waiting', () => {
    const plan = { ...named('Planning'), state: { kind: 'planning' as const } }
    const edited = {
      ...named('Edited'),
      state: { kind: 'priced' as const, review: 'approved' as const, edited: true },
    }
    expect(documentParts([plan, edited])).toEqual({ inQuote: [], waiting: ['Planning', 'Edited'] })
  })

  it('neither prices nor waits on a part set to No quote, as the server’s exports do', () => {
    // Signed off before it was left off: still not the quote's.
    expect(
      documentParts([
        named('Off', { noQuote: true }),
        named('Off too', { noQuote: true, estimated: true }),
      ]),
    ).toEqual({ inQuote: [], waiting: [] })
  })

  describe('by assembly', () => {
    /** A part of the fixture, counted `count` in it. */
    const of = (name: string, count: number, options: Parameters<typeof part>[0] = {}) => ({
      ...named(name, options),
      assemblyId: 'fixture',
      assemblyName: 'Fixture',
      count,
    })

    it('neither prices nor waits on a part counted 0, signed off or not', () => {
      const bracket = of('Bracket', 1, { estimated: true })
      expect(documentParts([bracket, of('Washer', 0)])).toEqual({
        inQuote: [bracket],
        waiting: [],
      })
    })

    it('holds a whole assembly back while any part of it made is unsigned, naming it', () => {
      const solo = named('Solo', { estimated: true })
      expect(documentParts([of('Bracket', 1, { estimated: true }), solo, of('Bolt', 4)])).toEqual({
        inQuote: [solo],
        waiting: ['Fixture'],
      })
    })

    it('offers an assembly whole once every part of it made is signed off', () => {
      const bracket = of('Bracket', 1, { estimated: true })
      const bolt = of('Bolt', 4, { estimated: true })
      expect(documentParts([bracket, named('Solo'), bolt])).toEqual({
        inQuote: [bracket, bolt],
        waiting: ['Solo'],
      })
    })

    it('names an assembly waiting by its part where that part ×1 is all of it made', () => {
      expect(documentParts([of('Bracket', 1), of('Washer', 0)]).waiting).toEqual(['Bracket'])
      expect(documentParts([of('Bolt', 4)]).waiting).toEqual(['Fixture'])
    })
  })
})

describe('assemblies as the documents read them', () => {
  it('groups parts by assembly, each where its first part is listed', () => {
    const rows = [
      { id: 'a', assemblyId: 'x' },
      { id: 'b', assemblyId: 'y' },
      { id: 'c', assemblyId: 'x' },
    ]
    expect(partsByAssembly(rows)).toEqual([[rows[0], rows[2]], [rows[1]]])
  })

  it('reads one part ×1 as that part, and anything more as the assembly', () => {
    expect(isSinglePart([{ count: 1 }])).toBe(true)
    expect(isSinglePart([{ count: 2 }])).toBe(false)
    expect(isSinglePart([{ count: 1 }, { count: 1 }])).toBe(false)
    expect(documentName([{ name: 'Bracket', assemblyName: 'Fixture', count: 1 }])).toBe('Bracket')
    expect(
      documentName([
        { name: 'Bracket', assemblyName: 'Fixture', count: 1 },
        { name: 'Bolt', assemblyName: 'Fixture', count: 4 },
      ]),
    ).toBe('Fixture')
  })
})
