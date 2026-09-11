/**
 * Which ISO workpiece materials a tool is indexed for, from the search facet.
 *
 * The variant table this package scrapes carries no material column: it states
 * geometry and the carbide *grade* (KCU20, KCPM15), and a grade is what the
 * tool is made of, not what it is meant to cut. The applicability lives in two
 * other places on the same pages, and this module reads the machine-readable
 * one.
 *
 * **The source is the `workpieceMaterialDetail` search facet**, the panel of
 * P/M/K/N/S/H/C checkboxes on a category listing. It is a Solr facet over the
 * same index the variants endpoint queries, so appending it to that endpoint's
 * `query` parameter filters the family's table down to the variants indexed
 * for one group — no second endpoint, no second parser. Sweeping the 32 groups
 * and collecting which variants come back gives every tool its own list.
 *
 * **It is enforced, which is what makes an empty answer meaningful.** An
 * unknown group value returns zero rows rather than being ignored, so "this
 * family matched nothing under N1" is a statement about the vendor's index and
 * not about a typo. (An unknown *facet name* is ignored, which is why the name
 * here is a constant and not a caller's argument.) Verified JG 2026-08-05.
 *
 * **What this is not.** The family pages also publish an Application Data
 * table: per ISO subgroup, with ap/ae limits, a cutting-speed range and feed
 * per tooth by diameter. That is the engineering data and it is richer, and on
 * two of the six endmill families it *disagrees* with this facet — MaxiMet's
 * table lists N5 (plastics) where the facet stops at N4, and both GOmill
 * families' facets claim all 28 groups including H3/H4 where the metric
 * family's own table stops at H2. The facet is the marketing-side index and is
 * the broader of the two. It is what this module scrapes because it is
 * per-variant and structured; the application table is a separate scrape that
 * has not been written. Don't read a group here as a vendor speed-and-feed
 * recommendation.
 *
 * Taps carry no material indexing at all — all three tap families return zero
 * rows for all 32 groups. That is a vendor gap, not a scrape failure, and it
 * is pinned in the tests so that a vendor who starts publishing them fails a
 * test rather than going unnoticed.
 */

import type { Fetcher } from '../../fetch.js'
import type { AemBrandName } from '../../identity.js'
import { ISO_MATERIAL_GROUPS } from '../../records.js'
import { REQUEST_DELAY_MS, pause, type ScrapeResult, type ScrapedRow } from '../../scrape.js'
import { ACTIVE_ONLY, fetchVariants, parseVariantTable } from './scrape.js'

/**
 * The facet this module queries. A constant rather than a parameter because a
 * misspelled facet *name* is silently ignored by the endpoint and would report
 * every group as matching every tool.
 */
export const FACET = 'workpieceMaterialDetail'

/**
 * The column {@link addMaterialGroups} writes, holding one row's groups
 * space-separated in {@link MATERIAL_GROUPS} order.
 */
export const MATERIALS_COLUMN = 'Material Groups'

/**
 * The vendor's ISO 513 workpiece groups, in the order the facet panel lists
 * them — letter by machining class, then subgroup by increasing difficulty.
 * Read off the facet panel of a Kennametal category listing (JG 2026-08-05);
 * the titles and hardness bands that go with each code are a *display* concern
 * and belong with whatever displays them, not here.
 *
 * This list is the sweep vocabulary, so a group the vendor adds later is
 * invisible until it is added here. That is the safe direction to fail: a
 * missing group under-reports a tool rather than inventing an application for
 * it.
 */
export const MATERIAL_GROUPS = [
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'M1',
  'M2',
  'M3',
  'K1',
  'K2',
  'K3',
  'N1',
  'N2',
  'N3',
  'N4',
  'N5',
  'N6',
  'N7',
  'S1',
  'S2',
  'S3',
  'S4',
  'H1',
  'H2',
  'H3',
  'H4',
  'C1',
  'C2',
  'C3',
  'C4',
] as const

/**
 * ISO 513's main groups — the letters, in the vendor's own panel order, which
 * happens to be the standard's own order too. Re-exported from
 * `records.ISO_MATERIAL_GROUPS` rather than redefined here — see that
 * constant's docstring for why the ordering is a domain fact and not a
 * Kennametal one.
 */
export const ISO_CLASSES = ISO_MATERIAL_GROUPS

/**
 * The Material Numbers in one family that are indexed for one group.
 *
 * The only network call here. An empty set is the ordinary answer for a group
 * the family isn't rated for.
 */
export async function materialsInGroup(
  fetcher: Fetcher,
  code: string,
  group: string,
  brand: AemBrandName = 'kennametal',
): Promise<Set<string>> {
  const html = await fetchVariants(fetcher, code, brand, `${ACTIVE_ONLY}:${FACET}:${group}`)
  const { rows } = parseVariantTable(html)
  return new Set(rows.map((row) => row[1]?.[0] ?? ''))
}

/** Options for a material sweep. */
export interface SweepOptions {
  brand?: AemBrandName
  groups?: readonly string[]
  delayMs?: number
}

/**
 * Sweep every group and invert the result: material number -> its groups.
 *
 * Values keep {@link MATERIAL_GROUPS} order rather than being sorted, so the
 * written column reads P before M before K the way the vendor's own panel
 * does, and so re-running produces a byte-identical result.
 *
 * **Per material number, not per family**, even though all eleven families
 * scraped so far answer uniformly — every group either matched every variant
 * or none of them. A single family-wide list would be a claim this sweep
 * cannot actually support, and it would go from true to false silently the
 * first time a vendor splits a family by size.
 */
export async function groupsByMaterial(
  fetcher: Fetcher,
  code: string,
  options: SweepOptions = {},
): Promise<Map<string, string[]>> {
  const { brand = 'kennametal', groups = MATERIAL_GROUPS, delayMs = REQUEST_DELAY_MS } = options

  const found = new Map<string, string[]>()
  for (const [index, group] of groups.entries()) {
    if (index) await pause(delayMs)
    for (const material of await materialsInGroup(fetcher, code, group, brand)) {
      const existing = found.get(material)
      if (existing) existing.push(group)
      else found.set(material, [group])
    }
  }
  return found
}

/** What {@link addMaterialGroups} answers with. */
export interface MaterialSweep {
  scrape: ScrapeResult
  /**
   * How many rows got at least one group — deliberately not the row count, so
   * a sweep that found nothing reads as `0 of 259` at the call site rather
   * than as success. Zero is nonetheless a legitimate result for a tap family;
   * the caller reports the number and does not judge it.
   */
  matched: number
}

/**
 * Add (or refresh) the material-groups column on a family scrape.
 *
 * Safe to re-run, like {@link addThreadPitch} and the CAD annotation: an
 * existing column is rebuilt rather than duplicated.
 */
export function addMaterialGroups(
  scrape: ScrapeResult,
  found: Map<string, string[]>,
): MaterialSweep {
  if (scrape.rows.length === 0) return { scrape, matched: 0 }

  const header = scrape.header.includes(MATERIALS_COLUMN)
    ? [...scrape.header]
    : [...scrape.header, MATERIALS_COLUMN]

  let matched = 0
  const rows: ScrapedRow[] = scrape.rows.map((row) => {
    const groups = found.get(row['Material Number'] ?? '') ?? []
    if (groups.length > 0) matched += 1
    return { ...row, [MATERIALS_COLUMN]: groups.join(' ') }
  })

  return { scrape: { ...scrape, header, rows }, matched }
}

/**
 * The column back into a list.
 *
 * Unknown codes are dropped rather than passed through: this column is
 * generated, so anything not in {@link MATERIAL_GROUPS} came from a hand-edit,
 * and a made-up group would reach a catalog's filter panel as a value no
 * control could ever offer.
 */
export function parseMaterialGroups(cell: string | undefined): string[] {
  if (!cell) return []
  const present = new Set(cell.split(/\s+/).filter(Boolean))
  return MATERIAL_GROUPS.filter((group) => present.has(group))
}

/**
 * The column collapsed to ISO 513 main groups — `P`, `M`, `K`, …
 *
 * **The subgroup is scraped and then deliberately dropped here.** The facet
 * publishes 32 subgroups and the CSV keeps all of them, because the CSV is the
 * record of what the vendor said; but P0 through P6 is a hardness band within
 * steel, and the question a catalog answers is "does this end mill cut steel".
 * Keeping the band would mean labelling 28 codes whose distinctions (`S3`
 * nickel alloys versus `S4` titanium) matter enormously to a cut and not at
 * all to picking a tool off a shelf.
 *
 * Collapsing here rather than at the scrape is what keeps that reversible:
 * re-deriving subgroups is an edit here, not a re-scrape.
 */
export function materialClasses(cell: string | undefined): string[] {
  const present = new Set(parseMaterialGroups(cell).map((g) => g[0]))
  return ISO_CLASSES.filter((iso) => present.has(iso))
}
