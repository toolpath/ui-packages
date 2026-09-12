/**
 * The half of a tool an exporter needs and the domain deliberately does not
 * carry: identity and commerce.
 *
 * `tool.ts` is explicit about why {@link Tool} stops where it does — a guid, a
 * brand, a catalog number and a product link are not arithmetic, and nothing
 * that draws a tool, fits it to a feature or works out its stickout reads one.
 * It is equally explicit that a catalog's record **extends** the domain shape
 * rather than being projected onto it, so that a record simply *is* a `Tool`
 * with no adapter in between.
 *
 * An exporter is the consumer that needs the other half. A Fusion tool library
 * will not load a tool without a guid, and a library with no vendor or catalog
 * number in it is a library a machinist cannot buy from. So the fields are
 * named here, under `export/`, rather than pushed up into the domain root
 * where `tool.ts` has already argued they do not belong.
 *
 * ## Every name is `@toolpath/tool-scraper`'s
 *
 * `guid`, `vendor`, `description`, `catalogNumber`, `unit`, `substrate`,
 * `coolantThrough` are `ToolRecord`'s own field names, spelled identically, so
 * **a scraper record satisfies this structurally with no adapter** — the claim
 * `contracts.test.ts` already pins for `Tool`, extended to the whole export
 * input. Renaming even one of them here would put a translation table between
 * the scraper and the exporter, and a translation table is where a
 * `materialNumber` becomes a `catalogNumber` in one direction and nobody
 * notices.
 *
 * Two things a `ToolRecord` does not carry and a caller must add: `form`,
 * because a record carries the coarse `kind` and the finer name is derived
 * where a dataset is built (see `forms.ts`), and `productLink`, which the tool
 * half of the scraper does not scrape.
 */

import type { Tool } from '../tool.js'
import type { UnitSystem } from '../units.js'

/**
 * A tool as a catalog holds it: the domain shape, plus who made it and what
 * it is called.
 *
 * Only `guid` and `unit` are required beyond {@link Tool}. Everything else is
 * a vendor's to state or not, and absent is nobody having said rather than an
 * empty string — the rule `ToolRecord.productLine` already keeps, for the same
 * reason: a consumer has to be able to tell "Harvey publishes no coating" from
 * "nobody looked".
 */
export interface CatalogTool extends Tool {
  /**
   * The tool's stable identifier, in RFC 4122 form.
   *
   * **Required, and the exporter mints none.** A Fusion library entry without
   * one is rejected outright, and a guid invented at export time would make
   * every re-export look to the CAM system like a new tool — so a catalog
   * re-exported monthly would accumulate twelve copies of itself rather than
   * updating one. `@toolpath/tool-scraper` already mints a stable v5 guid per
   * brand that survives a re-scrape, which is the value that belongs here.
   *
   * Minting one here is also not available: a name-based UUID is SHA-1, which
   * is `node:crypto`, which this package may not import.
   */
  readonly guid: string
  /**
   * Which measuring system the vendor published this family in.
   *
   * Not the unit its numbers are stored in — every length in this domain is
   * millimetres, whatever the sheet said. This decides the unit the *exported*
   * document states them in, which is a fact about the tool that a CAM system
   * shows the machinist.
   */
  readonly unit: UnitSystem
  /** The vendor's own free text about the part. */
  readonly description?: string
  readonly vendor?: string
  /** The number a machinist orders by. */
  readonly catalogNumber?: string
  readonly productLink?: string
  /**
   * The cutting material, in the vendor's own word — `carbide`, `hss`,
   * `diamond`.
   *
   * Raw and unmapped, because a target format's material vocabulary is that
   * format's business: Fusion knows five materials and has no word for PCD, so
   * the mapping and its loss belong in the exporter where the loss can be
   * reported, not here where it would be silent.
   */
  readonly substrate?: string
  /** Whether the tool has through-coolant. */
  readonly coolantThrough?: boolean
  /**
   * Which way the flutes turn. Absent is nobody having said.
   *
   * Optional rather than defaulted, so that an exporter writing a format that
   * demands it reports having supplied the answer instead of presenting a
   * guess as the vendor's.
   */
  readonly hand?: 'right' | 'left'
  /** The tool's number in a shop's carousel, where the shop has assigned one. */
  readonly number?: number
}
