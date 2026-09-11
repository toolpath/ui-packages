/**
 * Provenance as a gate rather than a convention.
 *
 * The rule — *when a vendor label is unclear, ask; record the answer and its
 * date* — was kept in prose for the source package's whole life, and prose is
 * unenforceable against a stranger adding a family next month. These are what
 * turn it into something that fails.
 *
 * ## Two gates now, and both are tested
 *
 * Most of what `checkFact` refused in Python is a compile error here, because
 * `Fact` is a union discriminated on `source`. Those cases are kept as
 * `@ts-expect-error` assertions: a type-level guarantee that nothing asserts
 * is one somebody can widen away without a test going red.
 *
 * The runtime gate is still tested on its own, with casts standing in for the
 * untyped data a config could arrive as — and for the two things a type cannot
 * say: that a string is non-empty, and that it is shaped `YYYY-MM-DD`.
 */

import { describe, expect, it } from 'vitest'

import { ScraperConfigError } from '../src/errors.js'
import { SOURCES, assumptions, checkFact, type Fact, type FactBearing } from '../src/provenance.js'

/** A fact that skipped the compiler, as untyped config data would. */
const untyped = (fact: unknown): Fact => fact as Fact

describe('what a fact must carry, at compile time', () => {
  it('refuses a vendor-stated fact with no citation', () => {
    // Without one it is an assumption wearing the word "vendor" — the exact
    // move this rule exists to prevent, and the one that reads as
    // authoritative to the next person.
    // @ts-expect-error a vendor-stated fact needs a `cite`
    const bad: Fact = { value: 'BT30', source: 'vendor-stated' }
    expect(bad).toBeDefined()

    const good: Fact = {
      value: 'BT30',
      source: 'vendor-stated',
      cite: 'the family page says so',
    }
    expect(() => checkFact('x.csv', 'taper', good)).not.toThrow()
  })

  it('refuses a derived fact with no note', () => {
    // @ts-expect-error a derived fact needs a `note`
    const bad: Fact = { value: 142, source: 'derived' }
    expect(bad).toBeDefined()

    const good: Fact = {
      value: 142,
      source: 'derived',
      note: 'least squares on L5 over 49 rows',
    }
    expect(() => checkFact('x.csv', 'point_angle', good)).not.toThrow()
  })

  it('refuses an assumed fact missing a note, a date or initials', () => {
    // All three, because the only thing standing behind an assumption is a
    // person on a day. A row in the assumptions document with no name is a
    // guess nobody can be asked about.
    // @ts-expect-error an assumed fact needs `note`, `checked` and `by`
    const noNote: Fact = { value: 2, source: 'assumed' }
    // @ts-expect-error an assumed fact needs `checked` and `by`
    const noDate: Fact = { value: 2, source: 'assumed', note: 'no column' }
    // @ts-expect-error an assumed fact needs `by`
    const noInitials: Fact = {
      value: 2,
      source: 'assumed',
      note: 'no column',
      checked: '2026-08-08',
    }
    expect([noNote, noDate, noInitials]).toHaveLength(3)

    const good: Fact = {
      value: 2,
      source: 'assumed',
      note: 'no column',
      checked: '2026-08-08',
      by: 'JG',
    }
    expect(() => checkFact('x.csv', 'flutes', good)).not.toThrow()
  })

  it('refuses an unknown source', () => {
    // @ts-expect-error 'probably' is not one of the three sources
    const bad: Fact = { value: 2, source: 'probably' }
    expect(bad).toBeDefined()
  })

  it('refuses a mutation, because a fact records what somebody established', () => {
    // Code that mutated one would be rewriting the evidence rather than the
    // value. Python froze the dataclass; here every field is `readonly`.
    const fact: Fact = {
      value: 'BT30',
      source: 'vendor-stated',
      cite: 'the family page says so',
    }
    // @ts-expect-error `value` is readonly
    expect(() => (fact.value = 'BT40')).toBeTypeOf('function')
  })
})

describe('what the runtime gate still has to catch', () => {
  it('refuses an empty citation, which satisfies the compiler', () => {
    expect(() =>
      checkFact(
        'x.csv',
        'taper',
        untyped({
          value: 'BT30',
          source: 'vendor-stated',
          cite: '',
        }),
      ),
    ).toThrow(/needs a `cite`/)
  })

  it('refuses an empty note', () => {
    expect(() =>
      checkFact(
        'x.csv',
        'point_angle',
        untyped({
          value: 142,
          source: 'derived',
          note: '',
        }),
      ),
    ).toThrow(/needs a `note`/)
  })

  it('refuses a date that is not a date', () => {
    // `checked: 'soon'` would satisfy a truthiness check and tell a reader
    // nothing.
    expect(() =>
      checkFact(
        'x.csv',
        'flutes',
        untyped({
          value: 2,
          source: 'assumed',
          note: 'n',
          checked: 'soon',
          by: 'JG',
        }),
      ),
    ).toThrow(/YYYY-MM-DD/)
  })

  it('refuses missing initials', () => {
    expect(() =>
      checkFact(
        'x.csv',
        'flutes',
        untyped({
          value: 2,
          source: 'assumed',
          note: 'n',
          checked: '2026-08-08',
          by: '',
        }),
      ),
    ).toThrow(/needs `by`/)
  })

  it('refuses a source that is not one of the three', () => {
    expect(() => checkFact('x.csv', 'flutes', untyped({ value: 2, source: 'probably' }))).toThrow(
      /not one of/,
    )
  })

  it('names the family and the key', () => {
    // Not the type. A gate that says "a fact needs a `by`" over a catalog of
    // forty families is a gate somebody has to bisect.
    expect(() =>
      checkFact('godrill_3xd_metric.csv', 'flutes', untyped({ value: 2, source: 'assumed' })),
    ).toThrow(/godrill_3xd_metric\.csv: flutes/)
    expect(() =>
      checkFact('godrill_3xd_metric.csv', 'flutes', untyped({ value: 2, source: 'assumed' })),
    ).toThrow(ScraperConfigError)
  })
})

describe('the flattening the document is built from', () => {
  it('leaves a cited fact out, because it is a different kind of claim', () => {
    // The document's purpose is the list of things that would be wrong if
    // somebody guessed wrong. A citation has its own re-check path — one
    // `curl` — and listing it would bury the guesses among a hundred things
    // that are true.
    const tables: Record<string, Record<string, FactBearing>> = {
      families: {
        'x.csv': {
          facts: {
            taper: {
              value: 'BT30',
              source: 'vendor-stated',
              cite: 'the family page',
            },
            flutes: {
              value: 2,
              source: 'assumed',
              note: 'no column',
              checked: '2026-08-08',
              by: 'JG',
            },
          },
        },
      },
    }

    const rows = assumptions(tables)

    expect(rows.map((r) => r.key)).toEqual(['flutes'])
    expect(rows[0]?.table).toBe('families')
    expect(rows[0]?.family).toBe('x.csv')
    expect(rows[0]?.by).toBe('JG')
  })

  it('orders the sources weakest last, so the guesses lead', () => {
    // `assumptions()` sorts by the index in `SOURCES`, so the ordering of that
    // tuple is what puts the guesses first. A reorder would silently bury them.
    expect(SOURCES).toEqual(['vendor-stated', 'derived', 'assumed'])

    const tables: Record<string, Record<string, FactBearing>> = {
      families: {
        'b.csv': {
          facts: {
            flutes: {
              value: 2,
              source: 'assumed',
              note: 'n',
              checked: '2026-08-08',
              by: 'JG',
            },
          },
        },
        'a.csv': {
          facts: { point_angle: { value: 142, source: 'derived', note: 'n' } },
        },
      },
    }

    expect(assumptions(tables).map((r) => r.source)).toEqual(['derived', 'assumed'])
  })

  it('leaves `checked` and `by` null on a derived fact', () => {
    // Null rather than absent or empty: a derived fact has no person-on-a-day
    // behind it, and an empty string would render as a blank cell that reads
    // like somebody forgot.
    const rows = assumptions({
      families: {
        'a.csv': {
          facts: { point_angle: { value: 142, source: 'derived', note: 'n' } },
        },
      },
    })

    expect(rows[0]?.checked).toBeNull()
    expect(rows[0]?.by).toBeNull()
  })

  it('contributes nothing for a family with no facts, rather than throwing', () => {
    // Holder families state their discriminants; a cutting-tool family whose
    // every constant is a scraped column states none, and that is a family
    // with nothing to assume rather than a family that forgot.
    expect(assumptions({ families: { 'x.csv': {} } })).toEqual([])
  })

  it('is deterministic', () => {
    // Whatever reads it is a diffable document, so property iteration order
    // must not reach the output.
    const tables: Record<string, Record<string, FactBearing>> = {
      families: {
        'x.csv': {
          facts: {
            flutes: {
              value: 2,
              source: 'assumed',
              note: 'n',
              checked: '2026-08-08',
              by: 'JG',
            },
            bmc: {
              value: 'carbide',
              source: 'assumed',
              note: 'n',
              checked: '2026-08-08',
              by: 'JG',
            },
          },
        },
      },
    }

    expect(assumptions(tables)).toEqual(assumptions(tables))
    expect(assumptions(tables).map((r) => r.key)).toEqual(['bmc', 'flutes'])
  })
})
