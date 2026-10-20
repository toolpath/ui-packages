import { describe, expect, it } from 'vitest'
import { documentParts, quotedParts, unsignedParts } from '../../src/model/quote-parts'

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

  it('warns about unsigned parts on the quote, not ones left off it', () => {
    const unsigned = part()
    expect(unsignedParts([unsigned, part({ estimated: true }), part({ noQuote: true })])).toEqual([
      unsigned,
    ])
  })
})

describe('what the quote page prices, and names as left out', () => {
  const named = (name: string, options: Parameters<typeof part>[0] = {}) => ({
    ...part(options),
    name,
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
})
