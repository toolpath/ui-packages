/**
 * A measured holder envelope, on the gage line, as the drawing wants it.
 *
 * `holding.ts` mints a holder from what the vendor *publishes*. This is the
 * other half: what the holder's own CAD model *measures*, reduced to the
 * silhouette a 2D elevation draws and cross-checked against the published gage
 * length. The measuring is the Toolpath Engine API's — `node/holder-import.ts`
 * makes the calls — and everything here is pure, so the 0/1/2/N cases are
 * testable against literals rather than against a stack that has to be running.
 *
 * ## What replaced 1,800 lines of Python and a GUI
 *
 * The reference implementation sampled each STEP solid from inside a live
 * Fusion 360 process over an MCP bridge, then did its own z-binned envelope,
 * outward-only Douglas–Peucker, undercut fill and 7:24 taper solve. The API
 * returns all of it — the layer stack, the gauge length, the size class and the
 * taper family — so what is left here is a change of datum and a cross-check.
 *
 * The two agree. Four holders re-measured through the API against the profiles
 * Fusion produced for the same STEP files, at the same 0.05 mm tolerance:
 * `BT30ER16060M` 60 vs 60.000003 (2.8 nm), `BT30HC14100M` 100.355 vs
 * 100.354999, `BT30HPVTT038295` 75 vs 75.000000, `BTKV30ER16100M` 89.4 vs
 * 89.400000, with the total envelope height matching to three decimals on all
 * four. The API decimates finer — about twice the layers at the same tolerance
 * — which costs a drawing segments and changes no dimension.
 *
 * ## Its own document, keyed by guid
 *
 * A profile is ~110 points that only an assembly drawing needs, and a catalog
 * is loaded by every page. So this is a second document that ships beside the
 * records and is read lazily, rather than a field on {@link HolderRecord}.
 * Keyed by guid because that is the one identifier that survives a re-scrape.
 *
 * **Collets get no profile.** They publish no CAD model and are not drawn: a
 * collet sits inside the nut, which the holder's own envelope already includes.
 */

import type { ProfileDatum, ProfilePoint } from '@toolpath/tool-support'

import { ScraperConfigError, VendorResponseError } from './errors.js'
import type { HolderRecord } from './holding.js'
import type { BrandName } from './identity.js'

/** Bumped when {@link ProfilesDocument}'s shape changes in a way a consumer must handle. */
export const PROFILES_VERSION = 1

/**
 * How far a measured gage length may sit from the vendor's published one before
 * the profile is called incomplete, in millimetres.
 *
 * **Both bounds come from the data rather than from feel.** The largest
 * *explained* deviation across the 53-holder Kennametal corpus is 0.355 mm —
 * the nose lip on `BT30HC14100M`, real material past the face the vendor
 * measures `L1` to, reproduced by the API to 1.5 nm. The smallest *real*
 * shortfall is 10.6 mm — the collet nut the five BTKV30 STEP models omit, whose
 * bodies stop at the threaded nose. That is a 30x gap, and this sits 2.8x above
 * the first and 10.6x below the second. A family that lands in between is a
 * finding to investigate, not a number to widen.
 */
export const GAUGE_TOLERANCE_MM = 1.0

/** Which interface a {@link MeasuredHolder.sizeClass} belongs to. */
export type TaperFamily = 'iso7x24' | 'hsk'

/** Every {@link TaperFamily}, for a message that can list what it knows. */
export const TAPER_FAMILIES: readonly TaperFamily[] = ['iso7x24', 'hsk']

/**
 * The 7:24 designations this package can read a size out of.
 *
 * A table rather than "letters then digits", for the reason
 * `conventions.IDENTITY_DEVIATIONS` is one: an unknown prefix must be a line
 * somebody added on evidence, not a regex that quietly accepted it. These are
 * the three the scraped catalog states — REGO-FIX declares `BT30` throughout,
 * MariTool states `BT30`, `BT40`, `CAT40` and `CAT50` per part, and Kennametal
 * states `BT30`, `BT40`, `BT50`, `CV40` and `CV50` — and a vendor publishing
 * `SK` or `ISO` adds its own entry here.
 *
 * **`CV` and `CAT` are the same 7:24 cone under two vendors' names**, and both
 * are here rather than one being rewritten to the other. Kennametal catalogues
 * and numbers a `CV40ZTTHT050275`; MariTool catalogues a CAT40.
 * `HolderRecord.taper` is the interface *as the vendor designates it*, so
 * normalising one to the other would put a word in a vendor's mouth to save a
 * line in this array. What the two must agree on is what this function returns
 * — size 40, `iso7x24` — and they do.
 *
 * **`BTKV` is deliberately absent.** `families/kennametal.ts` records why: a
 * BTKV30 is the same JIS B 6339 cone as a BT30 and differs by seating on the
 * flange face as well, which is `HolderRecord.contact`, so those families
 * declare `BT30` and the distinction stays on the axis that carries it. `CVKV`
 * is absent for the same reason and declares `CV40` / `CV50`.
 *
 * **`PSC` is absent because it is not a 7:24 cone at all.** ISO 26623 is a
 * polygon, so it has no place in {@link TaperFamily}'s two values and no size
 * this can read. A PSC family scrapes and records like any other; it is
 * {@link checkProfile} that cannot check one, and the throw below says so with
 * the fix in it rather than skipping the check quietly.
 */
export const TAPER_PREFIXES: readonly string[] = ['BT', 'CAT', 'CV']

/** `HSK63A` -> 63, `HSK100A` -> 100. The form letter is optional; the size is not. */
const HSK_DESIGNATION = /^HSK(\d+)[A-Z]?$/

/** A cone of the measured stack, in millimetres, as the API returns one. */
export interface HolderLayer {
  /** Layer height. */
  readonly thickness: number
  /** Diameter at the end nearer the nose. */
  readonly bottomDiameter: number
  /** Diameter at the end nearer the spindle. */
  readonly topDiameter: number
}

/** The import options a measurement was produced with, echoed by the API. */
export interface ImportOptions {
  /** Simplification tolerance, in mm of radius. */
  readonly tolerance: number
  /** Whether enclosed bays — a V-flange groove, a thread relief — were raised to their brims. */
  readonly fillBays: boolean
  /** Whether the holder was turned end for end after the automatic orientation. */
  readonly flipped: boolean
}

/**
 * One holder as the API measured it, plus the two things the API cannot know.
 *
 * `brand` and `catalogNumber` are the caller's: the API is handed a STEP file
 * and hands back geometry, and which part that file is came from the filename
 * `node/cad-mirror.ts` wrote it under.
 */
export interface MeasuredHolder {
  readonly brand: BrandName
  readonly catalogNumber: string
  /** The envelope as a stack of cones, **nose first**. Always complete, taper included. */
  readonly layers: readonly HolderLayer[]
  /**
   * Millimetres from the bottom of the stack to the gauge plane, or null.
   *
   * **Null is not zero.** A straight shank or a Capto carries no cone to place
   * a gauge plane on, and a profile measured off one has no gage-line datum to
   * be stated in.
   */
  readonly gaugeLength: number | null
  /** 30/40/50 for a 7:24, 25–160 for an HSK, or null where no taper was found. */
  readonly sizeClass: number | null
  readonly taperFamily: TaperFamily | null
  /** What pins the numbers to a run. */
  readonly kernelVersion: string
  readonly options: ImportOptions
}

/**
 * One vertex of a silhouette: `[z, r]`, both in millimetres.
 *
 * `@toolpath/tool-support`'s, re-exported under this package's own name.
 */
export type { ProfilePoint } from '@toolpath/tool-support'

/**
 * What `z = 0` means on a profile.
 *
 * `gage-line` is the datum everything downstream assumes — the plane the
 * spindle measures stickout from, with `z` increasing toward the cutting end,
 * so the taper is negative and the nose positive. `nose` is the fallback where
 * the API found no gauge plane to solve, and it is stated rather than silently
 * referenced to an arbitrary end.
 *
 * **Per profile rather than per document**, which is where the reference
 * implementation put it. One `datum` over a batch is only true while every
 * holder in it has a taper, and the first Capto or straight-shank holder makes
 * the document's own header wrong about some of its entries.
 *
 * `@toolpath/tool-support`'s, re-exported under this package's own name. It was
 * declared here, in the drawing package, and in the application between them —
 * three copies of two strings, one of which decides whether a consumer may
 * print a gauge length at all.
 */
export type { ProfileDatum } from '@toolpath/tool-support'

/** One holder's measured silhouette, and how far it agrees with the vendor. */
export interface HolderProfile {
  readonly catalogNumber: string
  readonly datum: ProfileDatum
  /** The silhouette, `z` ascending. Two points share a `z` where the solid steps. */
  readonly points: readonly ProfilePoint[]
  /** Where the API put the gauge plane, in mm from the nose, or null. */
  readonly gaugeLengthSolved: number | null
  /** The vendor's own `L1`, in mm — `HolderRecord.gaugeLengthMm`. */
  readonly gaugeLengthPublished: number
  readonly sizeClass: number | null
  readonly taperFamily: TaperFamily | null
  /** Whether the two gage lengths agree to within {@link GAUGE_TOLERANCE_MM}. */
  readonly complete: boolean
  /**
   * How far the model falls short of the published gage length, when it does.
   *
   * Present only on an incomplete profile, and only the amount. *Why* a
   * vendor's model stops early is a fact about that family and belongs in the
   * family's own notes rather than repeated on five records as a string a UI
   * would be tempted to print verbatim.
   */
  readonly shortfallMm?: number
}

/** Every measured holder of a run, keyed by the guid its record was minted under. */
export interface ProfilesDocument {
  readonly profilesVersion: number
  /**
   * Always millimetres.
   *
   * The API measures in mm whatever the family's unit is, and nothing here
   * converts: a shape measures what it measures, and an inch holder's profile
   * is the same solid as a metric one's. `HolderRecord.gaugeLength` is what
   * carries the vendor's own unit, for display.
   */
  readonly unit: 'millimeters'
  readonly kernelVersion: string
  readonly options: ImportOptions
  readonly holderCount: number
  readonly holders: Readonly<Record<string, HolderProfile>>
}

/**
 * A taper designation as a size and an interface — `BT30` -> 30 / iso7x24.
 *
 * The other half of {@link checkProfile}'s agreement gate: the API measures a
 * `sizeClass` and a `taperFamily` off the solid and cannot tell BT40 from CAT40
 * from ISO40, so what it *can* be held to is the size and the family, and the
 * vendor's own designation is where those come from.
 *
 * **Throws on a designation it does not know**, rather than returning null and
 * letting the check be skipped. A prefix nobody has written down is this
 * package's vocabulary being short, which is a `ScraperConfigError` — and
 * silently not checking a family is how a mirrored STEP file goes unnoticed.
 */
export function taperDesignation(taper: string): { sizeClass: number; family: TaperFamily } {
  const hsk = HSK_DESIGNATION.exec(taper)
  if (hsk !== null) return { sizeClass: Number(hsk[1]), family: 'hsk' }

  for (const prefix of TAPER_PREFIXES) {
    if (!taper.startsWith(prefix)) continue
    const size = taper.slice(prefix.length)
    if (/^\d+$/.test(size)) return { sizeClass: Number(size), family: 'iso7x24' }
  }

  throw new ScraperConfigError(
    taper,
    `is not a taper designation this package can read a size out of ` +
      `(7:24 prefixes: ${TAPER_PREFIXES.join(', ')}; HSK as HSK<size><form>) — ` +
      `add the prefix to TAPER_PREFIXES once it is clear what interface it names`,
  )
}

/**
 * The measured stack as a silhouette on the gage line.
 *
 * `layers` is nose-first and datumed on nothing; a drawing wants `z` ascending
 * from the spindle end with the gage line at zero. The conversion is one line
 * of arithmetic and one decision:
 *
 * ```
 * zFromNose = 0, then the running sum of thickness
 * z         = gaugeLength - zFromNose      // nose positive, spindle end negative
 * r         = diameter / 2
 * ```
 *
 * On `BT30ER16060M` that puts the nose at `z = +60` and the top of the taper at
 * `60 - 108.4 = -48.4`, which is exactly the range Fusion measured, with the
 * ER16 nut at `r = 16.0` — the scraped `lockNutDiameter` of 32 — at both ends.
 *
 * **The decision is the step faces.** Consecutive layers usually meet at one
 * diameter, and two of `BT30ER16060M`'s 112 do not: the solid jumps vertically
 * there. Emitting one point per boundary would draw those two jumps as slopes
 * across the neighbouring layers and quietly shave material off the envelope,
 * so a boundary whose diameters disagree gets **two points at the same `z`**.
 * That is why {@link checkProfile} requires `z` to be non-decreasing rather
 * than strictly increasing.
 *
 * With `gaugeLength` null there is no gauge plane to datum on and the nose is
 * used instead, which is what {@link HolderProfile.datum} states. An empty
 * stack yields no points rather than throwing — {@link checkProfile} is where a
 * profile too short to draw is refused, and it says so with the part's name.
 */
export function layersToProfile(
  layers: readonly HolderLayer[],
  gaugeLength: number | null,
): ProfilePoint[] {
  const first = layers[0]
  if (first === undefined) return []

  let z = gaugeLength ?? 0
  const points: ProfilePoint[] = [[z, first.bottomDiameter / 2]]

  for (const layer of layers) {
    const bottom = layer.bottomDiameter / 2
    // Exact, not toleranced: the stack is one solid's decimation, so a
    // boundary either repeats a diameter bit for bit or is a real step face.
    if (bottom !== points[points.length - 1]![1]) points.push([z, bottom])
    z -= layer.thickness
    points.push([z, layer.topDiameter / 2])
  }

  return points.reverse()
}

/**
 * Boundary validation for a measurement, the role `holding.ts`'s gates play for
 * a scraped row.
 *
 * These come from a third-party CAD model rather than a vendor table, so the
 * failures worth catching are the ones that **render as a plausible picture**:
 * a silhouette that runs backwards, a negative radius, a datum outside the
 * part, or a model that is not the holder the row says it is.
 *
 * `declaredTaper` is {@link HolderRecord.taper}. The reference implementation
 * gated on `sizeClass == 30` instead, which was correct when the catalog was
 * BT30 throughout and is not now — MariTool ships CAT40, CAT50, BT40 and nine
 * HSK sizes. Agreement with what the vendor declares catches the same thing
 * and travels: a CAT40 row whose model measures as an HSK is a mirrored file or
 * a mis-scraped row. Geometry cannot tell BT40 from CAT40, so only the size and
 * the family are checked.
 */
export function checkProfile(profile: HolderProfile, declaredTaper: string): void {
  const what = profile.catalogNumber
  const { points } = profile

  if (points.length < 2) {
    throw new VendorResponseError(what, 'a profile needs at least two points')
  }

  let previous = -Infinity
  for (const [z, r] of points) {
    if (z < previous) throw new VendorResponseError(what, `profile z is not ascending at ${z}`)
    if (r < 0) throw new VendorResponseError(what, `negative radius ${r} at z ${z}`)
    previous = z
  }

  const low = points[0]![0]
  const high = points[points.length - 1]![0]
  if (profile.datum === 'gage-line' && !(low < 0 && 0 < high)) {
    throw new VendorResponseError(
      what,
      `the gage line at z=0 is outside the profile (${low} .. ${high}) — ` +
        `the datum was not applied`,
    )
  }

  const declared = taperDesignation(declaredTaper)
  if (profile.sizeClass !== declared.sizeClass || profile.taperFamily !== declared.family) {
    throw new VendorResponseError(
      what,
      `the row declares ${declaredTaper} (size ${declared.sizeClass}, ${declared.family}) ` +
        `and its model measures size ${profile.sizeClass} / ${profile.taperFamily} — ` +
        `the wrong STEP file was mirrored, or the row's taper is wrong`,
    )
  }
}

/** `brand` and a catalog number as one map key. */
function partKey(brand: BrandName, catalogNumber: string): string {
  return `${brand} ${catalogNumber}`
}

/**
 * Measured holders plus the records they belong to -> the profiles document.
 *
 * **The join is `(brand, catalogNumber)`, and both halves matter.** The catalog
 * number is what a mirrored STEP file is named for, so it is what a measurement
 * carries back; `HolderRecord.catalogNumber` is that same cell, because every
 * mapper reads it from `conventions.catalogColumn(brand)` — Kennametal's
 * `ISO Catalog Number`, MariTool's `Material Number`, which is why the two
 * identity fields are not interchangeable here. The brand is in the key because
 * `node/paths.ts#stepDir` is per vendor: two vendors' catalog numbers live in
 * two directories and have never had to be distinct from each other.
 *
 * **A measured holder matching no record raises.** It means a family was
 * measured and then renamed or dropped, and silently omitting it looks exactly
 * like a holder the vendor publishes no model for — the one thing this document
 * must not be ambiguous about.
 *
 * **Every measurement must agree on the kernel and the options.** A document
 * states one of each, and a batch that spanned a kernel upgrade or two
 * `fillBays` settings would state one and contain both.
 */
export function buildProfiles(
  measured: readonly MeasuredHolder[],
  holders: readonly HolderRecord[],
): ProfilesDocument {
  const head = measured[0]
  if (head === undefined) {
    throw new ScraperConfigError(
      'profiles',
      'no measured holders — a profiles document covering nothing is not a ' +
        'result, and writing one would look exactly like a run that worked',
    )
  }

  const byPart = new Map<string, HolderRecord>()
  for (const holder of holders) {
    const key = partKey(holder.brand, holder.catalogNumber)
    const clash = byPart.get(key)
    if (clash !== undefined) {
      throw new VendorResponseError(
        holder.catalogNumber,
        `${holder.brand} publishes it twice (${clash.materialNumber} and ` +
          `${holder.materialNumber}) — the catalog number is what a mirrored ` +
          `STEP file is named for, so it cannot identify two holders`,
      )
    }
    byPart.set(key, holder)
  }

  const entries = new Map<string, HolderProfile>()
  const inOrder = [...measured].sort((a, b) => a.catalogNumber.localeCompare(b.catalogNumber))

  for (const record of inOrder) {
    const holder = byPart.get(partKey(record.brand, record.catalogNumber))
    if (holder === undefined) {
      throw new VendorResponseError(
        record.catalogNumber,
        `was measured and matches no scraped ${record.brand} holder`,
      )
    }
    checkRun(head, record)

    const solved = record.gaugeLength
    const published = holder.gaugeLengthMm
    const shortfall = solved === null ? null : published - solved
    const complete = shortfall !== null && Math.abs(shortfall) <= GAUGE_TOLERANCE_MM

    const profile: HolderProfile = {
      catalogNumber: record.catalogNumber,
      datum: solved === null ? 'nose' : 'gage-line',
      points: layersToProfile(record.layers, solved),
      gaugeLengthSolved: solved,
      gaugeLengthPublished: published,
      sizeClass: record.sizeClass,
      taperFamily: record.taperFamily,
      complete,
      ...(complete || shortfall === null ? {} : { shortfallMm: round(shortfall, 4) }),
    }

    checkProfile(profile, holder.taper)

    // `index.ts` promises one guid space across holders and tools, and this
    // document is keyed by it: two profiles under one guid would be one
    // silently overwriting the other rather than the collision being refused.
    const taken = entries.get(holder.guid)
    if (taken !== undefined) {
      throw new VendorResponseError(
        holder.guid,
        `is the guid of both ${taken.catalogNumber} and ${record.catalogNumber} — ` +
          `two holders cannot share one identity`,
      )
    }
    entries.set(holder.guid, profile)
  }

  return {
    profilesVersion: PROFILES_VERSION,
    unit: 'millimeters',
    kernelVersion: head.kernelVersion,
    options: head.options,
    holderCount: entries.size,
    holders: Object.fromEntries(entries),
  }
}

/** Every measurement in one document came out of one run of one kernel. */
function checkRun(head: MeasuredHolder, record: MeasuredHolder): void {
  if (record.kernelVersion !== head.kernelVersion) {
    throw new VendorResponseError(
      record.catalogNumber,
      `was measured by kernel ${record.kernelVersion} and ${head.catalogNumber} ` +
        `by ${head.kernelVersion} — one document states one kernel version`,
    )
  }
  for (const key of ['tolerance', 'fillBays', 'flipped'] as const) {
    if (record.options[key] !== head.options[key]) {
      throw new VendorResponseError(
        record.catalogNumber,
        `was imported with ${key}=${record.options[key]} and ${head.catalogNumber} ` +
          `with ${key}=${head.options[key]} — one document states one set of options`,
      )
    }
  }
}

/** Decimal places, so a shortfall is a number and not a float artefact. */
function round(value: number, places: number): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}
