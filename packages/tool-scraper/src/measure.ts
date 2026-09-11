/**
 * Reading a machinist's number, and the one constant between the two systems.
 *
 * Three vendors publish dimensions the way a printed catalog does — `.250`,
 * `3/4`, `1-1/2` — and until this module each adapter had its own reader for
 * that grammar. They disagreed on real inputs: REGO-FIX's `parseSize` handled
 * no mixed number at all, so `1-1/2` reached `Number()` as `NaN` and was
 * refused; Destiny Tool's `parseFractionInches` branched on a `.` first, so
 * `1.5-1/2` was refused there and read as 2 by Harvey's. And they disagreed on
 * *how* they refused — two threw `RangeError`, one answered `null`.
 *
 * That is the same shape `fetch.createFetcher` and `scrape.pause` were pulled
 * out for, and the same argument: four copies of four lines is not expensive,
 * four copies of the **decisions** in them is, because the decisions are the
 * part that has to be consistent. A dimension string is the last thing in this
 * package that should mean two things.
 *
 * ## The reader answers `null`; the caller decides what that costs
 *
 * {@link fractionValue} is the primitive, and it never throws: whether an
 * unreadable cell is a skipped row, a warning or a refusal is a vendor's call,
 * and every adapter here already makes it differently for good reasons. Harvey
 * skips a `-` cell because the column does not apply to that row; REGO-FIX
 * refuses, because a collet with no size is not a part. Pushing that decision
 * into the reader would take it away from the module that knows.
 *
 * ## The two decisions about a *read* cell live here too
 *
 * {@link fractionValue} answers what a token says. {@link asLength} and
 * {@link asCount} answer what that costs, and they are core for the same reason
 * the grammar is: a cell stating `mm` in a family published in inches is
 * converted-and-warned, and a cell stating an angle in a length column is
 * refused, and those two calls have to be the same call whoever is being
 * scraped. They were a verbatim copy in `vendors/harvey/value.ts` and
 * `vendors/emuge/value.ts` — down to the wording of both warnings — which is
 * two operators reading the same sentence out of two files that were free to
 * drift apart.
 *
 * A vendor's own reader still owns the **grammar**, because that genuinely
 * differs: Harvey writes a mixed number `1-1/2` and annotates it `(1/8)`, EMUGE
 * writes `1 1/2` and admits no hyphen at all. What it hands here is
 * {@link Measured}, which is the part they have in common.
 *
 * **`MM_PER_INCH` and `convertLength` are `@toolpath/tool-support`'s**, and are
 * re-exported here under the names this package has always published.
 *
 * They were declared and exported twice inside this package alone —
 * `vendors/harvey/value.ts` and `vendors/regofix/scrape.ts` — so
 * `@toolpath/tool-scraper/vendors/harvey` and `.../vendors/regofix` each
 * published their own copy of 25.4. `tests/vendor-boundary.test.ts` refuses that
 * by name and moving the constant up here fixed it *within* this package, while
 * a third copy went on standing in the application downstream. The domain
 * package is where a constant every consumer shares can only be declared once,
 * and `@toolpath/tool-support`'s own boundary test now holds the whole tree to
 * one `25.4`.
 */

import { convertLength, MM_PER_INCH, type UnitSystem } from '@toolpath/tool-support'

import { consoleWarn, type Warn } from './scrape.js'

export { convertLength, MM_PER_INCH }

/**
 * A decimal, a simple fraction or a mixed number — and nothing else.
 *
 * Deliberately strict, because it is used without a pre-guard. The whole-number
 * part of a mixed number is `\d+` rather than a decimal so that a **range** like
 * `.035-.040` — which Destiny Tool really does publish, in description text —
 * cannot parse as `0.035 + 0.040`. A range is not a measurement, and reading one
 * as a sum is the kind of quiet wrong number this package exists to avoid.
 */
const NUMERIC = /^(?:(\d+)-)?(\d*\.?\d+)(?:\/(\d*\.?\d+))?$/

/**
 * `.250` -> 0.25, `3/4` -> 0.75, `1-1/2` -> 1.5, `2` -> 2.
 *
 * Null where the token is not one of those four shapes — including a division
 * by zero, which arrives finite-looking as `Infinity` and would otherwise
 * travel into a row as a dimension.
 *
 * Unit-free on purpose: what system the number is in is the caller's, from the
 * family's declared `unit` or from a unit the cell states outright. A reader
 * that guessed would be the mistake `conventions.UNIT_SUFFIX` exists to prevent.
 */
export function fractionValue(token: string): number | null {
  const parsed = NUMERIC.exec(token.trim())
  if (parsed === null) return null

  const [, whole, numerator, denominator] = parsed
  const part =
    denominator === undefined ? Number(numerator) : Number(numerator) / Number(denominator)
  const value = (whole === undefined ? 0 : Number(whole)) + part
  return Number.isFinite(value) ? value : null
}

/**
 * What a value states about itself: a length system, or degrees.
 *
 * Degrees are inside this union rather than beside it because a cell states one
 * thing about itself — "this is an angle" competes with "this is millimetres"
 * and is never both. `vendors/harvey/value.ts` carries the same fact as a
 * separate `degrees` boolean, which is that vendor's published shape and stays.
 */
export type StatedUnit = UnitSystem | 'degrees'

/**
 * One cell as a vendor's own reader left it.
 *
 * The part every vendor's reader has in common, and all {@link asLength} and
 * {@link asCount} need. A reader is free to answer more — Harvey's also carries
 * the parenthesised annotation, the `(1.5x)` ratio and the non-numeric code —
 * and anything with these two fields is accepted here.
 */
export interface Measured {
  /** The number the cell states, in {@link Measured.stated}. Null where none. */
  readonly value: number | null
  /** The unit the cell names outright. Null where it names none. */
  readonly stated: StatedUnit | null
}

/**
 * A read cell as a length in `unit`, or null where it publishes none.
 *
 * A cell that states its own unit and disagrees with the family's is
 * **converted and warned about** rather than refused: the value is right, the
 * column's suffix is right, and the parts this happens on are real tools
 * somebody can order. Refusing would drop them; trusting the column's unit
 * would publish a 3-inch shank.
 *
 * An angle reaching a dimensional column is **refused**, because that is a
 * header that has moved rather than a value that is odd.
 *
 * `display` is passed beside `parsed` only so the warnings can quote the cell
 * the vendor really wrote, which is the part an operator needs to go look at.
 */
export function asLength(
  parsed: Measured,
  display: string,
  unit: UnitSystem,
  what: string,
  warn: Warn = consoleWarn,
): number | null {
  const { value, stated } = parsed
  if (value === null) return null

  if (stated === 'degrees') {
    warn(
      `  WARNING: ${what}: ${JSON.stringify(display)} is an angle in a column ` +
        `read as a length — skipped`,
    )
    return null
  }

  if (stated !== null && stated !== unit) {
    warn(
      `  WARNING: ${what}: ${JSON.stringify(display)} states ${stated} in a ` +
        `family published in ${unit} — converted`,
    )
    return convertLength(value, stated, unit)
  }

  return value
}

/**
 * A read cell as a whole count — a flute or tooth number. Null where there is
 * none, and null for a fraction, which is a column that has moved rather than a
 * tool with two and a half flutes.
 */
export function asCount(parsed: Measured): number | null {
  const { value } = parsed
  if (value === null || !Number.isInteger(value)) return null
  return value
}
