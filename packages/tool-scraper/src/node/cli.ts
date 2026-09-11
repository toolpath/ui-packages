/**
 * The console entry point. Argv handling only — no scraping logic lives here.
 *
 * ```
 * toolpath-scrape kennametal      family page -> CSV
 * toolpath-scrape regofix         ProductFinder index -> toolholding CSV
 * toolpath-scrape destinytool     Firestore products -> End Mill CSV
 * toolpath-scrape harvey          one product page -> CSV
 * toolpath-scrape maritool        leaf categories -> toolholding CSV
 * toolpath-scrape emuge           one catalog category -> CSV
 * toolpath-scrape thread-pitch    add the derived Thread Pitch column
 * toolpath-scrape cad             add the vendor CAD model column
 * toolpath-scrape materials       add the ISO workpiece-group column
 * toolpath-scrape mirror-cad      download the vendor STEP models
 * toolpath-scrape coverage        report which rows publish a CAD model
 * toolpath-scrape profiles        measure the mirrored models into profiles
 * ```
 *
 * **One binary with subcommands.** Seven names in `node_modules/.bin` for one
 * package is not the idiom.
 *
 * **Every command prints the resolved scrape root before it does anything.**
 * The default is derived from this package's own location, which is right in a
 * working tree and meaningless in `node_modules`, so where a scrape lands is a
 * thing to state rather than to assume.
 *
 * The convert commands are not here. This package acquires; a Fusion library
 * or an assembly catalog is a different product, and none of it is in this
 * tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { ScraperConfigError, VendorResponseError } from '../errors.js'
import { familyBrand } from '../family.js'
import type { HolderRecord } from '../holding.js'
import {
  ALL_FAMILIES,
  COLLET_FAMILIES,
  FAMILIES,
  HOLDER_FAMILIES,
  familyConfig,
} from '../families/index.js'
import { createFetcher, type Fetcher } from '../fetch.js'
import { buildProfiles, type MeasuredHolder, type ProfilesDocument } from '../profiles.js'
import { AEM_BRANDS, type AemBrandName, type BrandName } from '../identity.js'
import { boundFamily, toHolding } from '../registry.js'
import { pause, REQUEST_DELAY_MS, type ScrapeResult } from '../scrape.js'
import { cadCoverage, mirrorFamilySteps, type CadCoverage } from './cad-mirror.js'
import { parseCsv, toCsv } from './csv.js'
import {
  API_KEY_ENV,
  API_URL_ENV,
  createHolderApi,
  describeApi,
  measureFamily,
  type HolderApi,
} from './holder-import.js'
import { describeRoot, familyCsv, profilesDir, profilesJson, stepDir } from './paths.js'
import * as receipts from './receipts.js'
import { scrapeFamily } from '../vendors/kennametal/scrape.js'
import { annotateCadUrls } from '../vendors/kennametal/cad.js'
import {
  COLLET_CATEGORIES,
  COLLET_CATEGORY,
  HOLDER_CATEGORIES,
  HOLDER_CATEGORY,
  describeFamily,
  discoverFamilies,
} from '../vendors/kennametal/catalog.js'
import { addMaterialGroups, groupsByMaterial } from '../vendors/kennametal/materials.js'
import { addThreadPitch } from '../vendors/kennametal/thread-column.js'
import { scrapeEndMills, DOCUMENTS_URL } from '../vendors/destinytool/scrape.js'
import { PRODUCT_PAGES } from '../families/harvey.js'
import { CATEGORY_ROOTS, discoverProducts } from '../vendors/harvey/catalog.js'
import { scrapeProduct } from '../vendors/harvey/scrape.js'
import { SEARCH_URL, scrapeCollets, scrapeHolders } from '../vendors/regofix/scrape.js'
import { LEAVES as MARITOOL_LEAVES } from '../families/maritool.js'
import {
  CATEGORY_ROOTS as MARITOOL_ROOTS,
  describe as describeCategory,
  discoverCategories,
  leavesOf,
} from '../vendors/maritool/catalog.js'
import { scrapeHolders as scrapeMaritoolHolders } from '../vendors/maritool/scrape.js'
import { SCRAPE_TARGETS as EMUGE_TARGETS } from '../families/emuge.js'
import { scrapeCategory } from '../vendors/emuge/scrape.js'

/**
 * The PG series a BT 30 holder can take. PG 32 and PG 48 collets exist and no
 * BT 30 holder in this catalog accepts one, so scraping them would add parts
 * that fit nothing.
 */
const BT30_COLLET_SIZES = ['6', '10', '15', '25'] as const

/**
 * Brand -> the step that fills `conventions.CAD_COLUMN` for it, where the
 * vendor needs a second request to say where its model is.
 *
 * **Two brands are in here and three are deliberately not.** `annotateCadUrls`
 * is Kennametal's CDS Visual lookup, not a vendor-neutral one: it queries
 * product-config.net and rewrites the column on every row. Run against a
 * REGO-FIX holder it would post that vendor's SKUs to Kennametal and blank the
 * STEP URLs the REGO-FIX scrape had already filled in.
 *
 * A brand that is absent is **not** a brand this command refuses. REGO-FIX and
 * MariTool write the column during the scrape itself, so for them there is
 * nothing to annotate and the honest answer is to say so and report what the
 * CSV already carries — see {@link cad}. It exited 2 until 2026-09-02, which
 * made `cad <every holder family>` impossible to run over a catalog holding
 * more than one vendor's.
 *
 * A table here rather than a check against `AEM_BRANDS`, because being on
 * Kennametal's AEM platform and having a CAD lookup are two different facts
 * that happen to coincide across two brands.
 */
const CAD_ANNOTATORS: Partial<Record<BrandName, typeof annotateCadUrls>> = {
  kennametal: annotateCadUrls,
  widia: annotateCadUrls,
}

const USAGE = `usage: toolpath-scrape <command> [args]

  kennametal [--brand kennametal|widia] FAMILY_CODE OUTPUT_CSV [Name=Value ...]
      One AEM family page -> a CSV. Trailing Name=Value args are appended to
      every row as constant columns, for facts the vendor table does not state
      (e.g. "Thread System=metric").

  kennametal --collets
  kennametal --holders
      Walks a category tree and prints every family it links to today — code,
      slug, the branch it sits in, and the configured CSV that claims the code
      or "(not configured)". For noticing a family Kennametal has added, split
      or retired; a scrape needs none of it. \`--collets\` is the three ER
      collet lines, seven nodes. \`--holders\` is the six spindle interfaces —
      BT, BTKV, CV, CVKV, HSK and PSC — which is 336 nodes and some minutes.

  regofix holders OUT.csv
  regofix collets "<PRODUCT GROUP>" OUT.csv
      The REGO-FIX ProductFinder index. \`holders\` takes every powRgrip BT/PG
      holder whose taper is BT 30 or BT+ 30, with geometry from each part's
      DIN 4000 document. \`collets\` takes one product group, restricted to PG
      sizes ${BT30_COLLET_SIZES.join(', ')} — the group is the vendor's own
      \`product_group_name\`, e.g. "Standard", "Coolant flush",
      "Tapping collet TAP".

  destinytool OUTPUT_CSV
      Pages the whole Destiny Tool \`products\` Firestore collection and writes
      every End Mill row.

  harvey FAMILY.csv [more.csv ...]
      One Harvey Tool product page -> a CSV. The page to fetch and the unit
      system come from the family's own config, so neither is typed again.
      One HTML row is up to nine orderable parts; expect more rows out than
      the vendor's table appears to have.

  harvey --catalog
      Walks the four Harvey category trees and prints every product page it
      finds, one per line. For noticing a page Harvey has added — a scrape
      needs none of it.

  maritool FAMILY.csv [more.csv ...]
      One MariTool taper -> a CSV. The leaf categories to page through come
      from the family's own config, so none of them is typed again. One
      request per listing page, then one per part for its Product
      Specifications table.

  maritool --catalog
      Walks the five MariTool taper trees and prints every category it finds,
      one per line, with its product count. For rechecking the leaf cPaths in
      \`families/maritool.ts\` — a scrape needs none of it.

  emuge FAMILY.csv [more.csv ...]
      One EMUGE-FRANKEN catalog category -> a CSV. The category, the facet
      narrowing it and the unit system all come from the family's own config,
      so none of them is typed again. One request per page of grouped
      products, one per group for its orderable parts, and one per 30 parts
      for the fields only a per-part record carries.

  thread-pitch TAP.csv [more.csv ...]
      Adds a Thread Pitch column derived from D1-TDZ, in place. Safe to re-run.

  cad HOLDERS.csv [more.csv ...]
      Adds the vendor CAD model URL column, in place. One request per row
      against product-config.net; safe to re-run.

  materials FAMILY.csv [more.csv ...]
      Adds the ISO workpiece-group column, in place. One request per material
      group (32) per family; safe to re-run.

  mirror-cad HOLDERS.csv [more.csv ...]
      Downloads each row's STEP model into <root>/<brand>/step. Run \`cad\`
      first — a CSV with no CAD column yields nothing and says so.

  profiles HOLDERS.csv [more.csv ...]
      Measures each mirrored STEP model through the Toolpath Engine API and
      writes the gage-line profile document — one per family under
      <root>/<brand>/profiles, plus the merged <root>/profiles.json.
      Needs ${API_KEY_ENV} set, and ${API_URL_ENV} until the holder routes
      reach production. Run \`mirror-cad\` first: a holder with no mirrored
      model is reported and skipped, not measured.

  coverage [HOLDERS.csv ...]
      Reports how many rows of each holder family publish a STEP model and a
      DXF. Reads the scraped CSVs and makes no requests at all. With no
      arguments it reports every holder family, and says which ones have not
      been scraped on this machine rather than failing on them.

An output path is used verbatim; scraped CSVs belong under the scrape root,
in <brand>/csv/. The in-place commands take a bare CSV name and resolve it
through the family's own brand.`

/** Everything the CLI prints, injectable so a test is not stdout. */
export interface Console_ {
  log: (message: string) => void
  error: (message: string) => void
}

const STDOUT: Console_ = {
  log: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
}

/** Read one family's CSV off disk as a scrape result. */
function readCsv(name: string, source: string): ScrapeResult {
  const path = familyCsv(name)
  const { header, rows } = parseCsv(readFileSync(path, 'utf8'))
  return { header, rows, source, familyCode: null }
}

/** Write a scrape to `path`. */
function writeCsv(path: string, scrape: ScrapeResult): void {
  writeFileSync(path, toCsv(scrape.header, scrape.rows))
}

/**
 * Report a scrape and record its receipt.
 *
 * One function because the two belong together: a scrape that reported a count
 * and wrote no receipt would be exactly the state this package is trying to
 * stop existing — data with nothing saying where it came from.
 */
function wrote(out: string, brand: BrandName, scrape: ScrapeResult, io: Console_): void {
  writeCsv(out, scrape)
  const receipt = receipts.write(out, {
    brand,
    source: scrape.source,
    rows: scrape.rows.length,
    familyCode: scrape.familyCode,
  })

  io.log(`wrote ${scrape.rows.length} rows to ${out}`)
  io.log(`  receipt: ${basename(receipt)}`)

  const name = basename(out)
  // Through the merged table rather than three chained lookups, so a name two
  // tables both claim is refused where it is built instead of resolving here
  // to whichever happened to be checked first.
  const declared = ALL_FAMILIES[name]?.rows
  const written = receipts.read(out)
  if (declared !== undefined && written !== null) {
    receipts.checkRows(name, declared, written)
  }
}

/**
 * Argv as family CSV names, refusing anything unknown by name.
 *
 * A path's directory is ignored: the family's own brand decides where its CSV
 * lives, and honouring a typed directory would let one vendor's receipt be
 * written into another's.
 */
function namesIn(argv: string[], known: Record<string, unknown>, what: string): string[] {
  const names = argv.map((a) => basename(a))
  const unknown = names.filter((n) => !Object.hasOwn(known, n))
  if (unknown.length > 0) {
    throw new ScraperConfigError(
      unknown.join(', '),
      `unknown ${what} CSV (known: ${Object.keys(known).sort().join(', ')})`,
    )
  }
  return names
}

/** Run one command. Exported so the tests drive it without a subprocess. */
export async function run(
  argv: string[],
  io: Console_ = STDOUT,
  fetcher: Fetcher = createFetcher(),
  api?: HolderApi,
): Promise<number> {
  // Somebody reading the usage text is the person most likely to be about to
  // point a scrape at the wrong place, so help gets the root too.
  io.log(describeRoot())

  const [command, ...rest] = argv
  if (command === undefined || command === '-h' || command === '--help') {
    io.log(USAGE)
    return 0
  }

  switch (command) {
    case 'kennametal':
      return kennametal(rest, io, fetcher)
    case 'regofix':
      return regofix(rest, io, fetcher)
    case 'destinytool':
      return destinytool(rest, io, fetcher)
    case 'harvey':
      return harvey(rest, io, fetcher)
    case 'maritool':
      return maritool(rest, io, fetcher)
    case 'emuge':
      return emuge(rest, io, fetcher)
    case 'thread-pitch':
      return threadPitch(rest, io)
    case 'cad':
      return cad(rest, io, fetcher)
    case 'materials':
      return materials(rest, io, fetcher)
    case 'mirror-cad':
      return mirrorCad(rest, io, fetcher)
    case 'coverage':
      return coverage(rest, io)
    case 'profiles':
      return profiles(rest, io, api)
    default:
      io.error(`unknown command ${JSON.stringify(command)}\n\n${USAGE}`)
      return 2
  }
}

/**
 * The configured CSV that claims each `familyCode`, for the walk to reconcile
 * against.
 *
 * Toolholding only. A cutting-tool family states a code too, but the walks this
 * serves cover the collet and holder categories, and reporting a drill family's
 * code against either listing would be an answer to a question nobody asked.
 */
function claimedCodes(): Map<string, string> {
  const claimed = new Map<string, string>()
  for (const [name, cfg] of Object.entries({ ...HOLDER_FAMILIES, ...COLLET_FAMILIES })) {
    if (cfg.familyCode !== undefined) claimed.set(cfg.familyCode, name)
  }
  return claimed
}

/**
 * The two category trees `kennametal` can walk, each pairing its roots with the
 * category path the listing component hangs off.
 *
 * A pair rather than two arguments a caller assembles, because they are one
 * fact — `catalog.ts` records that the path scopes nothing, which is exactly
 * what makes a mismatched pair silent rather than an error.
 */
const COLLET_TREE = { roots: COLLET_CATEGORIES, category: COLLET_CATEGORY } as const
const HOLDER_TREE = { roots: HOLDER_CATEGORIES, category: HOLDER_CATEGORY } as const

/**
 * One category tree, printed family by family against the configured codes.
 *
 * Indented by depth, because the holder tree is four levels where the collet
 * one is two: a flat listing of 537 families under six interfaces is a wall,
 * and the branch a family sits in is the fact a reader is after — it is what
 * `HolderRecord.taper` comes from.
 */
async function walkCategories(
  tree: { roots: readonly { name: string; query: string }[]; category: string },
  io: Console_,
  fetcher: Fetcher,
  brand: AemBrandName,
): Promise<number> {
  const claimed = claimedCodes()
  const found = await discoverFamilies(fetcher, tree.roots, {
    warn: io.error,
    brand,
    category: tree.category,
  })

  let families = 0
  let missing = 0
  for (const category of found) {
    const indent = '  '.repeat(category.path.length - 1)
    io.log(
      `${indent}${category.name}: ${category.total} parts, ${category.families.length} families`,
    )
    for (const family of category.families) {
      const where = claimed.get(family.code) ?? null
      if (where === null) missing += 1
      families += 1
      io.log(`${indent}  ${describeFamily(category, family, where)}`)
    }
  }

  io.log(
    `${families} families under ${tree.roots.length} category trees, ${missing} not configured`,
  )
  return 0
}

async function kennametal(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  const args = [...argv]
  let brand: string = 'kennametal'

  const flag = args.indexOf('--brand')
  if (flag !== -1) {
    const value = args[flag + 1]
    if (value === undefined) {
      io.error(`--brand needs a value\n\n${USAGE}`)
      return 2
    }
    brand = value
    args.splice(flag, 2)
  }
  // Against the AEM brands rather than every brand: `scrapeFamily` reads
  // `Brand.node`, and a brand without one built a URL with `undefined` in the
  // path and died on the 404 instead of on this line.
  if (!AEM_BRANDS.includes(brand as AemBrandName)) {
    io.error(`unknown brand: ${brand} (known: ${[...AEM_BRANDS].sort().join(', ')})`)
    return 2
  }
  const tree = args[0] === '--collets' ? COLLET_TREE : args[0] === '--holders' ? HOLDER_TREE : null
  if (tree !== null) {
    return walkCategories(tree, io, fetcher, brand as AemBrandName)
  }

  if (args.length < 2) {
    io.error(USAGE)
    return 2
  }

  const [code, out] = args as [string, string, ...string[]]
  // Refused rather than dropped: a quoting slip like `"Thread System" metric`
  // used to scrape, write the CSV and exit 0 with the column missing, and the
  // failure surfaced later in `addThreadPitch` against a file no longer being
  // written.
  const constants = args.slice(2)
  const malformed = constants.find((a) => a.indexOf('=') < 1)
  if (malformed !== undefined) {
    io.error(`constant column ${JSON.stringify(malformed)} is not Name=Value\n\n${USAGE}`)
    return 2
  }
  const tags = constants.map((a) => {
    const at = a.indexOf('=')
    return [a.slice(0, at), a.slice(at + 1)] as const
  })

  // The family page carries the product line, which the variants table does
  // not state anywhere. One extra request per family — see
  // `vendors/kennametal/family.ts`.
  const scrape = await scrapeFamily(fetcher, code, brand as AemBrandName, tags, {
    familyTitle: true,
  })
  wrote(out, brand as BrandName, scrape, io)
  return 0
}

async function regofix(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  const [what, ...rest] = argv

  if (what === 'holders') {
    if (rest.length !== 1) {
      io.error(USAGE)
      return 2
    }
    const scrape = await scrapeHolders(fetcher, 'BT/PG', 'BT', {
      warn: io.error,
    })
    wrote(rest[0]!, 'regofix', { ...scrape, source: SEARCH_URL }, io)
    return 0
  }

  if (what === 'collets') {
    if (rest.length !== 2) {
      io.error(USAGE)
      return 2
    }
    const [group, out] = rest as [string, string]
    const scrape = await scrapeCollets(fetcher, group, BT30_COLLET_SIZES, {
      warn: io.error,
    })
    wrote(out, 'regofix', { ...scrape, source: SEARCH_URL }, io)
    return 0
  }

  io.error(`unknown subcommand ${JSON.stringify(what)}\n\n${USAGE}`)
  return 2
}

async function destinytool(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv.length !== 1) {
    io.error(USAGE)
    return 2
  }
  const scrape = await scrapeEndMills(fetcher)
  wrote(argv[0]!, 'destinytool', { ...scrape, source: DOCUMENTS_URL }, io)
  return 0
}

/**
 * One or more Harvey families, or the catalog walk.
 *
 * Paced between pages by the package's shared politeness delay, which the
 * per-page scrape does not do for itself: one family is one request, and a
 * caller scraping one has nothing to wait for.
 */
async function harvey(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv[0] === '--catalog') {
    const found = await discoverProducts(fetcher, CATEGORY_ROOTS, { warn: io.error })
    for (const path of found) io.log(path)
    io.log(`${found.length} product pages under ${CATEGORY_ROOTS.length} category trees`)
    return 0
  }

  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }

  const names = namesIn(argv, PRODUCT_PAGES, 'Harvey family')
  for (const [index, name] of names.entries()) {
    if (index > 0) await pause(REQUEST_DELAY_MS)
    const cfg = boundFamily(name)
    // Never undefined: `namesIn` refused anything `PRODUCT_PAGES` does not key,
    // and `tests/harvey-families.test.ts` holds the two tables to the same keys.
    const page = PRODUCT_PAGES[name]!
    if (cfg.unit === undefined) {
      throw new ScraperConfigError(name, 'declares no unit — every Harvey family publishes one')
    }
    const scrape = await scrapeProduct(fetcher, page, { unit: cfg.unit, warn: io.error })
    const out = familyCsv(name)
    // This command resolves its own output path rather than taking one, so the
    // brand's directory may not exist yet — unlike `kennametal`, where the path
    // is typed and its directory is the caller's to have made.
    mkdirSync(dirname(out), { recursive: true })
    wrote(out, 'harvey', scrape, io)
  }
  return 0
}

/**
 * One or more MariTool families, or the catalog walk.
 *
 * The scrape paces itself between every request it makes, so unlike `harvey`
 * there is nothing to pace between families here.
 */
async function maritool(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv[0] === '--catalog') {
    const found = await discoverCategories(fetcher, MARITOOL_ROOTS, { warn: io.error })
    for (const category of found) io.log(describeCategory(category))
    const leaves = leavesOf(found)
    io.log(
      `${found.length} categories under ${MARITOOL_ROOTS.length} taper trees, ` +
        `${leaves.length} of them leaves, ` +
        `${leaves.reduce((sum, leaf) => sum + leaf.products, 0)} products`,
    )
    return 0
  }

  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }

  for (const name of namesIn(argv, MARITOOL_LEAVES, 'MariTool family')) {
    // Never undefined: `namesIn` refused anything `MARITOOL_LEAVES` does not
    // key, and `tests/maritool.test.ts` holds the two tables to the same keys.
    const leaves = MARITOOL_LEAVES[name as keyof typeof MARITOOL_LEAVES]
    const scrape = await scrapeMaritoolHolders(fetcher, leaves, { warn: io.error })
    const out = familyCsv(name)
    // This command resolves its own output path rather than taking one, so the
    // brand's directory may not exist yet.
    mkdirSync(dirname(out), { recursive: true })
    wrote(out, 'maritool', scrape, io)
  }
  return 0
}

/**
 * One or more EMUGE-FRANKEN families.
 *
 * The scrape paces itself between every request it makes, so — as with
 * `maritool` and unlike `harvey` — there is nothing to pace between families
 * here.
 */
async function emuge(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }

  for (const name of namesIn(argv, EMUGE_TARGETS, 'EMUGE-FRANKEN family')) {
    const cfg = boundFamily(name)
    // Never undefined: `namesIn` refused anything `EMUGE_TARGETS` does not key,
    // and `tests/emuge-families.test.ts` holds the two tables to the same keys.
    const target = EMUGE_TARGETS[name as keyof typeof EMUGE_TARGETS]
    if (cfg.unit === undefined) {
      throw new ScraperConfigError(
        name,
        'declares no unit — every EMUGE-FRANKEN family publishes one',
      )
    }
    const scrape = await scrapeCategory(fetcher, target, { unit: cfg.unit, warn: io.error })
    const out = familyCsv(name)
    // This command resolves its own output path rather than taking one, so the
    // brand's directory may not exist yet.
    mkdirSync(dirname(out), { recursive: true })
    wrote(out, 'emuge', scrape, io)
  }
  return 0
}

function threadPitch(argv: string[], io: Console_): number {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }
  for (const name of namesIn(argv, FAMILIES, 'family')) {
    const path = familyCsv(name)
    const updated = addThreadPitch(readCsv(name, path))
    writeCsv(path, updated)
    io.log(`${name}: ${updated.rows.length} rows updated`)
  }
  return 0
}

/**
 * Fill the CAD model column, for the vendors that need a second request to.
 *
 * Vendor-dispatched through {@link CAD_ANNOTATORS} rather than gated on
 * `AEM_BRANDS`. A brand with no annotator is a **no-op with a message**, not a
 * refusal: its scrape already wrote the column, so there is nothing this
 * command could add, and exiting 2 on it meant `cad` could not be run across a
 * catalog holding more than one vendor's holders. `mirror-cad` reads the column
 * and is neutral; this writes it and is not.
 */
async function cad(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }
  for (const name of namesIn(argv, HOLDER_FAMILIES, 'holder')) {
    const brand = familyBrand(familyConfig(name))
    const path = familyCsv(name)

    const annotate = CAD_ANNOTATORS[brand]
    if (annotate === undefined) {
      const found = coverageOf(name)
      io.log(
        `${name}: nothing to annotate — ${brand} publishes its CAD URLs with ` +
          `the scrape` +
          (found === null
            ? ' (not scraped on this machine)'
            : ` (${found.step} of ${found.rows} rows carry one)`),
      )
      continue
    }

    const { scrape, found } = await annotate(fetcher, readCsv(name, path))
    writeCsv(path, scrape)
    io.log(`${name}: ${found} CAD models`)
  }
  return 0
}

async function materials(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }
  // The family code and brand come from config, so a re-run needs neither
  // typed again.
  for (const name of namesIn(argv, FAMILIES, 'family')) {
    const cfg = boundFamily(name)
    if (cfg.familyCode === undefined) {
      throw new ScraperConfigError(
        name,
        'has no familyCode — the material sweep re-queries the family page ' +
          'and cannot without one',
      )
    }
    const path = familyCsv(name)
    const found = await groupsByMaterial(fetcher, cfg.familyCode, {
      brand: (cfg.brand ?? 'kennametal') as AemBrandName,
    })
    const { scrape, matched } = addMaterialGroups(readCsv(name, path), found)
    writeCsv(path, scrape)
    io.log(`${name}: ${matched} rows with a material group`)
  }
  return 0
}

async function mirrorCad(argv: string[], io: Console_, fetcher: Fetcher): Promise<number> {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }
  for (const name of namesIn(argv, HOLDER_FAMILIES, 'holder')) {
    const path = familyCsv(name)
    const brand = familyBrand(familyConfig(name))
    const written = await mirrorFamilySteps(
      fetcher,
      readCsv(name, path).rows,
      brand,
      stepDir(brand),
      undefined,
      io.error,
    )
    const total = written.reduce((sum, f) => sum + f.bytes, 0)
    io.log(`${name}: ${written.length} STEP files, ${Math.floor(total / 1024)} KB`)
  }
  return 0
}

/** One family's CAD coverage, or null where it has not been scraped here. */
function coverageOf(name: string): CadCoverage | null {
  const path = familyCsv(name)
  if (!existsSync(path)) return null
  return cadCoverage(parseCsv(readFileSync(path, 'utf8')).rows)
}

/**
 * How much of the holder catalog publishes a model, before anything downloads
 * one.
 *
 * **The one command here that makes no requests and writes no files.** It is
 * the number that bounds anything built on measured geometry, and it is worth
 * having before the mirror runs rather than after: MariTool is 527 of the 601
 * holder rows and publishes a STEP for about two thirds of them.
 *
 * A family that has not been scraped on this machine is **reported, not
 * refused**, even when it was asked for by name. The whole command is a report,
 * and one absent CSV must not stop it printing the rest — which is exactly the
 * shape the `cad` step had wrong.
 */
function coverage(argv: string[], io: Console_): number {
  const names =
    argv.length === 0
      ? Object.keys(HOLDER_FAMILIES).sort()
      : namesIn(argv, HOLDER_FAMILIES, 'holder')

  const total: CadCoverage = { rows: 0, step: 0, unspecified: 0, dxf: 0 }
  let counted = 0

  for (const name of names) {
    const found = coverageOf(name)
    if (found === null) {
      io.log(`${name}: not scraped on this machine`)
      continue
    }
    counted += 1
    total.rows += found.rows
    total.step += found.step
    total.unspecified += found.unspecified
    total.dxf += found.dxf
    io.log(`${name}: ${describeCoverage(found)}`)
  }

  if (counted > 1) io.log(`${counted} families: ${describeCoverage(total)}`)
  return 0
}

/** One coverage line: the counts, and the STEP share a mirror would get. */
function describeCoverage(found: CadCoverage): string {
  // Guarded rather than assumed: an empty CSV is a scrape that produced a header
  // and no parts, and a NaN percentage would read as a parsing fault here
  // instead of as the empty file it is.
  const share = found.rows === 0 ? '—' : `${Math.round((100 * found.step) / found.rows)}%`
  // Named on the line rather than folded into the STEP count, because the two
  // read identically as a number and mean opposite things: `0 STEP` says the
  // vendor publishes none, and this says nobody has asked yet. A Kennametal
  // family scraped but never `cad`-annotated is the whole row count, and it is
  // the prompt to run that pass rather than a finding about the catalog.
  const unasked = found.unspecified > 0 ? `, ${found.unspecified} not looked up` : ''
  return `${found.rows} rows, ${found.step} STEP (${share})${unasked}, ${found.dxf} DXF`
}

/**
 * Measure one holder family's mirrored models into a profiles document.
 *
 * **The one command that sends data to Toolpath rather than reading from a
 * vendor.** The API takes a direct upload of the STEP file — it does not fetch
 * the vendor's URL itself — so every measurement puts a vendor's binary in
 * Toolpath object storage, which is why the API base URL is printed beside the
 * scrape root before anything is uploaded.
 *
 * Per family *and* merged, because the two answer different questions: a family
 * document is what a re-measure of that family replaces, and the merged one is
 * what a consumer loads. Both are built by `profiles.buildProfiles`, so a guid
 * that appeared twice would be refused rather than silently overwritten.
 */
async function profiles(argv: string[], io: Console_, api?: HolderApi): Promise<number> {
  if (argv.length === 0) {
    io.error(USAGE)
    return 2
  }

  const names = namesIn(argv, HOLDER_FAMILIES, 'holder')
  io.log(describeApi())
  const client = api ?? createHolderApi()

  const everyMeasurement: MeasuredHolder[] = []
  const everyHolder: HolderRecord[] = []

  for (const name of names) {
    const path = familyCsv(name)
    const brand = familyBrand(familyConfig(name))
    // Holders only: a collet publishes no CAD model and is not drawn, because
    // it sits inside the nut the holder's own profile already includes.
    const holders = toHolding(name, readCsv(name, path), { warn: io.error }) as HolderRecord[]

    const run = await measureFamily(client, holders, stepDir(brand), undefined, undefined, io.error)
    if (run.unmirrored.length > 0) {
      io.log(`${name}: ${run.unmirrored.length} holders publish no mirrored model`)
    }
    if (run.failed.length > 0) {
      io.log(`${name}: ${run.failed.length} imports the kernel refused`)
    }
    if (run.measured.length === 0) {
      io.log(`${name}: nothing measured — run mirror-cad first`)
      continue
    }

    const document = buildProfiles(run.measured, holders)
    writeJson(join(profilesDir(brand), `${basename(name, '.csv')}.json`), document)
    io.log(`${name}: ${describeProfiles(document)}`)

    everyMeasurement.push(...run.measured)
    everyHolder.push(...holders)
  }

  if (everyMeasurement.length === 0) return 0

  const merged = buildProfiles(everyMeasurement, everyHolder)
  writeJson(profilesJson(), merged)
  io.log(`${profilesJson()}: ${describeProfiles(merged)}`)
  return 0
}

/** One profiles line: how many holders, and how many agree with the vendor's L1. */
function describeProfiles(document: ProfilesDocument): string {
  const complete = Object.values(document.holders).filter((p) => p.complete).length
  return (
    `${document.holderCount} profiles, ${complete} complete ` +
    `(kernel ${document.kernelVersion}, tolerance ${document.options.tolerance}, ` +
    `fillBays ${document.options.fillBays})`
  )
}

/** A derived document onto disk, its directory created and a trailing newline on it. */
function writeJson(path: string, document: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(document, null, 1)}\n`)
}

/** The process entry point: run, and turn a refusal into an exit code. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    return await run(argv)
  } catch (error) {
    if (error instanceof ScraperConfigError || error instanceof VendorResponseError) {
      STDOUT.error(error.message)
      return 2
    }
    throw error
  }
}
