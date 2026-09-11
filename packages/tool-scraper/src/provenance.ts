/**
 * Where a per-family fact came from, as data rather than as a comment.
 *
 * The rule this enforces: **when a vendor label is unclear, ask** — record the
 * answer and its date, and never guess and flag it afterwards. It was kept
 * scrupulously in the source package, and kept in prose: `JG 2026-08-06`,
 * breadcrumb citations, the three paragraphs deriving the KenDrill point angle
 * by least squares. All of it invisible to code, and therefore unenforceable
 * against a stranger who adds a family next month.
 *
 * A {@link Fact} is the index into that prose. It carries the value the
 * pipeline uses plus **how it was arrived at**, which turns the cultural rule
 * into a gate: an assumed fact with no note, date and initials does not
 * compile, and a vendor-stated one with no citation does not either. An
 * assumptions document is generated from the same data, so every guess is on
 * one page instead of scattered across 700 lines of config comments.
 *
 * ## The three sources, and why the distinction is not cosmetic
 *
 * - **`vendor-stated`** — the vendor published it. Needs a `cite`: which
 *   column, breadcrumb, tagline or facet said so, specific enough to re-check
 *   with one request. `contact: 'face'` cites *"Shank - SK BT Taper Face
 *   Contact"*.
 * - **`derived`** — this repo's arithmetic over vendor inputs. Needs a `note`
 *   saying what was computed from what. The KenDrill 142° point angle is the
 *   worked example: no page states it, but `L5 = D1 / (2·tan(SIG/2))` over 49
 *   rows does. A derived fact is checkable.
 * - **`assumed`** — nobody said it and nothing proves it. Needs a note, a date
 *   and initials, because the only thing standing behind it is a person on a
 *   day. These are what an assumptions document exists to list: every place
 *   the catalog would be wrong if the guess were wrong.
 *
 * The prose does not go away. A fact's note is a sentence; the KenDrill
 * derivation stays in `families/kennametal.ts` and the runbook where it has
 * room.
 *
 * ## What the types do, and what {@link checkFact} still has to
 *
 * A union discriminated on `source` rather than one shape with five optional
 * fields, so "an assumed fact needs `by`" is a compile error at the point
 * somebody writes the family.
 *
 * The gate stays, because a type cannot say a string is non-empty or that it
 * is shaped `YYYY-MM-DD` — and `cite: ''` would otherwise satisfy the
 * compiler while citing nothing.
 */

import { PROVENANCE, type Provenance } from '@toolpath/tool-support'

import { ScraperConfigError } from './errors.js'
import { compare } from './order.js'

/** What a per-family constant can be. */
export type FactValue = string | number | boolean

/**
 * How a fact was arrived at. Closed, and ordered from strongest to weakest.
 *
 * An assumptions document sorts by it, so a reader meets the checkable facts
 * before the guesses and finishes on the ones only a person stands behind —
 * `derived` first, then `assumed`. (`vendor-stated` leads the order but is
 * filtered out of that document entirely; see {@link assumptions}.)
 *
 * **`@toolpath/tool-support`'s `PROVENANCE`**, re-exported under this package's
 * own name. The order is load-bearing here and is the shared list's, so the
 * ordering that document is read in cannot drift from the vocabulary a drawing
 * marks a derived dimension by. Three identical declarations of these three
 * strings stood before it — this one, the drawing's `Provenance`, and the
 * application's.
 */
export const SOURCES = PROVENANCE

export type FactSource = Provenance

/**
 * One per-family constant, with its provenance.
 *
 * `value` is what the pipeline uses — the registry projects it onto the family
 * config under the fact's own name, so readers say `cfg.pointAngle` and never
 * learn about provenance. That projection is what keeps this from being a
 * second source of truth: the fact is the only authored copy, and a family
 * that also set the plain key is refused.
 */
export type Fact<T extends FactValue = FactValue> =
  | {
      readonly value: T
      readonly source: 'vendor-stated'
      /** What the vendor said, and where. */
      readonly cite: string
    }
  | {
      readonly value: T
      readonly source: 'derived'
      /** What was worked out, from what. */
      readonly note: string
    }
  | {
      readonly value: T
      readonly source: 'assumed'
      /** What was guessed, and why. */
      readonly note: string
      /** When a person last checked it, `YYYY-MM-DD`. */
      readonly checked: string
      /**
       * Who. Required for the same reason the date is: an assumption is only
       * as good as someone being willing to be named beside it.
       */
      readonly by: string
    }

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** What a note has to say, per source kind. */
const WANTED: Record<'derived' | 'assumed', string> = {
  derived: 'computed from what',
  assumed: 'guessed, and why',
}

/**
 * Refuse a fact that does not carry what its source kind requires.
 *
 * Called for every fact of every family when the registry binds, so the
 * failure names the family and the key rather than surfacing as a thin
 * assumptions-document row nobody reads.
 */
export function checkFact(family: string, key: string, fact: Fact): void {
  const where = `${family}: ${key}`

  if (!SOURCES.includes(fact.source)) {
    throw new ScraperConfigError(
      where,
      `source ${JSON.stringify(fact.source)} is not one of ${SOURCES.join(', ')}`,
    )
  }

  if (fact.source === 'vendor-stated') {
    if (!fact.cite) {
      throw new ScraperConfigError(
        where,
        'a vendor-stated fact needs a `cite` — which column, breadcrumb, ' +
          'tagline or facet says so',
      )
    }
    return
  }

  if (!fact.note) {
    throw new ScraperConfigError(
      where,
      `a ${fact.source} fact needs a \`note\` saying what was ${WANTED[fact.source]}`,
    )
  }

  if (fact.source === 'assumed') {
    // The whole weight of an assumption is a person on a day. Without both, an
    // assumptions document lists a guess nobody can be asked about.
    if (!fact.checked || !DATE.test(fact.checked)) {
      throw new ScraperConfigError(
        where,
        `an assumed fact needs \`checked\` as YYYY-MM-DD, not ${JSON.stringify(fact.checked)}`,
      )
    }
    if (!fact.by) {
      throw new ScraperConfigError(where, 'an assumed fact needs `by`')
    }
  }
}

/** One row of an assumptions document. */
export interface Assumption {
  table: string
  family: string
  key: string
  value: FactValue
  source: FactSource
  note: string
  checked: string | null
  by: string | null
}

/** A config table's shape, as far as provenance is concerned. */
export interface FactBearing {
  facts?: Record<string, Fact>
}

/**
 * Every non-vendor-stated fact in the catalog, flattened and sorted.
 *
 * `vendor-stated` facts are excluded because the document's purpose is the
 * list of things that would be wrong if somebody guessed wrong — a citation is
 * a different kind of claim and has its own re-check path (one `curl`).
 *
 * Sorted by source then family then key — so the derived facts lead, the
 * assumed ones close the list, and the output is byte-stable for whatever
 * gate reads it.
 */
export function assumptions(tables: Record<string, Record<string, FactBearing>>): Assumption[] {
  const rows: Assumption[] = []

  for (const [table, families] of Object.entries(tables)) {
    for (const [family, cfg] of Object.entries(families)) {
      // Unsorted: the sort below orders the whole list by source, family and
      // key, which subsumes any order the facts arrive in.
      for (const [key, fact] of Object.entries(cfg.facts ?? {})) {
        if (fact.source === 'vendor-stated') continue
        rows.push({
          table,
          family,
          key,
          value: fact.value,
          source: fact.source,
          note: fact.note,
          checked: fact.source === 'assumed' ? fact.checked : null,
          by: fact.source === 'assumed' ? fact.by : null,
        })
      }
    }
  }

  return rows.sort(
    (a, b) =>
      SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) ||
      compare(a.family, b.family) ||
      compare(a.key, b.key),
  )
}
