/**
 * What a family declares, and what it looks like once the registry has bound it.
 *
 * `families/` is the config table: what to fetch, how its columns are
 * labelled, and the per-family constants no vendor table states. This module
 * is the *shape* of one, kept apart from the tables themselves so that
 * `families/` stays data and `registry` stays the only module that knows both
 * halves.
 *
 * ## Facts are the only place a constant is authored
 *
 * A constant is authored as a {@link Fact} and nowhere else:
 * {@link FamilyDefinition} declares `facts` and no constant keys, so setting
 * one directly does not compile. The projection still happens —
 * {@link BoundFamily} carries the values under their own names, and a mapper
 * says `family.pointAngle` and never learns about provenance — but there is
 * only ever one authored copy to drift from.
 */

import type { UnitSystem } from './conventions.js'
import { ScraperConfigError } from './errors.js'
import type { BrandName } from './identity.js'
import type { HoldingMapper, ToolholdingKind } from './holding.js'
import type { Fact } from './provenance.js'
import type { ColumnMap, ThreadMethod, ToolKind, ToolRecord } from './records.js'
import type { MapperOptions, ScrapedRow } from './scrape.js'

/**
 * The per-family constants a fact can carry, and their types.
 *
 * Twelve keys, which is the whole vocabulary the catalog uses. Naming them rather
 * than accepting any string is what lets a mapper read `family.coolantThrough`
 * as a `boolean` instead of casting an `unknown` out of a bag — and what makes
 * a fact whose value is the wrong type a compile error where the family is
 * written.
 */
export interface FamilyFacts {
  /** Which unit system this family's dimensional columns are published in. */
  unit?: UnitSystem
  /** Cutting-material code — `carbide`, `hss`, `diamond`. */
  bmc?: string
  /**
   * The end profile, as the vendor names it — `Ball`, `Square`,
   * `Corner Radius`.
   *
   * A per-family constant here rather than a per-row derivation because some
   * vendors state it once for a whole product line and never in the variant
   * table: Harvey Tool's 52 product pages each publish one profile in the page
   * title and no profile column, where Destiny Tool publishes an `endStyle`
   * per row and needs none of this. It is what tells a mapper that a family
   * with no corner-radius column has `RE = DC / 2` rather than `RE = 0`.
   */
  profile?: string
  coolantThrough?: boolean
  /**
   * How a tap makes its thread — `cutting` or `forming`.
   *
   * A fact and not a column because neither vendor publishes it per part: it is
   * Kennametal's `newTapType` facet, which the variant table does not carry,
   * and EMUGE's category, which partitions its taps into two. Every declaration
   * in `families/` cites the index it was read off, and each is one value for a
   * whole family — checked against the vendor rather than assumed, which is why
   * they are `vendor-stated`.
   *
   * Every `kind: 'tap'` family must state it: `tapRecord` reads it through
   * {@link fact}, and `records.toolRecord` refuses a tap record without one.
   */
  threadMethod?: ThreadMethod
  flutes?: number
  /** Degrees included. */
  pointAngle?: number
  nonFerrous?: boolean
  /** The holder or collet product style, as the vendor names it. */
  style?: string
  /** `BT30`, `CAT40` — the spindle interface. */
  taper?: string
  /** How the holder grips: `collet`, `hydraulic`, `shrink`. */
  clamping?: string
  /** `taper` or `face` — whether the flange face seats as well as the cone. */
  contact?: string
}

/** A family's facts, each carrying the type its projected value will have. */
export type FactSet = {
  [K in keyof FamilyFacts]?: Fact<NonNullable<FamilyFacts[K]>>
}

/** One CSV row -> one record. An adapter supplies these, keyed by tool kind. */
export type RecordMapper = (
  row: ScrapedRow,
  family: BoundFamily,
  columns: ColumnMap,
  options?: MapperOptions,
) => ToolRecord

/** A vendor adapter's mappers, by the kind of tool they build. */
export type RecordMappers = Partial<Record<ToolKind, RecordMapper>>

/** What every family declares, cutting tool or toolholding alike. */
interface CommonDefinition {
  /**
   * How many rows a human counted in this CSV at scrape time.
   *
   * The one key here that no code needs. It is an independent restatement,
   * which is the whole value: every other count is computed from the same file
   * it is checking, so a scrape that silently lost rows agrees with itself. It
   * is per family and not a total, because a total hides the case it exists to
   * catch — one family gaining a row while another loses one sums to no change.
   */
  readonly rows: number
  /** Defaults to `kennametal` when a family does not name one. */
  readonly brand?: BrandName
  readonly facts?: FactSet
}

/**
 * A cutting-tool family: something with a column map and a record mapper.
 *
 * `columns` holds the vendor's own column labels keyed by canonical ISO 13399
 * name, *without* a unit suffix — `registry` runs each through
 * `records.checkColumnMap`, so a typo fails when the registry binds, naming
 * the family.
 */
export interface FamilyDefinition extends CommonDefinition {
  /**
   * The vendor-local half of the family id, kebab-cased.
   *
   * What lets a REGO-FIX family be called whatever REGO-FIX calls it without
   * checking Kennametal's list first — see {@link familyId}.
   */
  readonly id: string
  readonly kind: ToolKind
  /**
   * The vendor's own code for the family, where the scrape target is a family
   * page. Absent where it is a set of index filters instead.
   */
  readonly familyCode?: string
  readonly columns: Readonly<Record<string, string>>
}

/** A holder or collet family: no column map, no record mapper, no kind. */
export interface ToolholdingDefinition extends CommonDefinition {
  /** What a human calls this family. Holders and collets have no `id`. */
  readonly catalogName: string
  /**
   * The vendor's own code for the family, where the scrape target is a family
   * page — {@link FamilyDefinition.familyCode}'s counterpart.
   *
   * Absent where the vendor has no such page: REGO-FIX and MariTool families
   * are a set of index filters and name none. It was absent on Kennametal's
   * toolholding too until 2026-09-08, because those families were scraped by
   * hand from a code read off the page at the time — which made a re-scrape a
   * trip back to the browser. Recording it is what makes one re-runnable, and
   * it is what `kennametal --collets` reconciles its walk against.
   */
  readonly familyCode?: string
}

/** A cutting-tool family after {@link FamilyDefinition} has been validated. */
export type BoundFamily = Omit<FamilyDefinition, 'columns'> &
  FamilyFacts & {
    /** The validated map. Only `checkColumnMap` can produce one. */
    readonly columns: ColumnMap
    /** The adapter that turns this family's rows into records. */
    readonly records: RecordMapper
  }

/**
 * A toolholding family after its facts have been checked and projected.
 *
 * `kind` is projected by the registry from **which table declared the family**,
 * rather than being a key on {@link ToolholdingDefinition}: the table is the
 * fact, and a `kind` beside it would be a second copy free to disagree with it.
 * `records` is the mapper that brand binds for that kind, and it is optional
 * because a vendor's holders may be scraped long before anybody has read its
 * columns — see `holding.HoldingMappers`.
 */
export type BoundToolholding = ToolholdingDefinition &
  FamilyFacts & {
    readonly kind: ToolholdingKind
    /** The adapter that turns this family's rows into records, where there is one. */
    readonly records?: HoldingMapper
  }

/**
 * A family's id: `<brand>:<vendor-local id>`.
 *
 * Bare filename stems were the id in the source package until 2026-08-08 —
 * `godrill_3xd_metric` — and they are a route parameter and a join key
 * downstream. With one vendor there was no collision to fix; with four there
 * is a latent one the moment two ship a family called `endmills_metric`, and
 * it would land as a route that resolves to whichever library was read last.
 *
 * The **colon** is deliberate: it is a legal `pchar` in a URL path segment
 * (RFC 3986), so `/family/kennametal:godrill-3xd-metric` needs no encoding and
 * stays one route parameter.
 */
export function familyId(cfg: FamilyDefinition | BoundFamily): string {
  return `${cfg.brand ?? 'kennametal'}:${cfg.id}`
}

/**
 * A per-family constant a mapper cannot proceed without.
 *
 * The projection is what makes this readable — a mapper says `family.unit` and
 * never learns about provenance — but a projected key is still optional on the
 * type, because {@link FamilyFacts} is one vocabulary shared by four vendors
 * and a tap states no `unit`. So the check is per read, and it belongs here
 * rather than in one adapter: it lived in `vendors/kennametal/records.ts` until
 * 2026-08-29, which is why the other two adapters each invented their own
 * weaker answer instead — `family.unit!`, `family.bmc ?? ''`,
 * `family.coolantThrough ?? false`, a hardcoded `'inches'`.
 *
 * **Every one of those defaults is a claim the family never made.** A missing
 * `coolantThrough` becoming `false` ships a through-coolant drill with its
 * coolant presets dropped; a missing `bmc` becoming `''` ships a tool with no
 * cutting material at all. Refusing names the family and the key, at the one
 * place that can fix it — the config table.
 *
 * Same move `scrape.pause` and `conventions.CAD_COLUMN` already made, and for
 * the same reason: a core concern does not live in one manufacturer's folder.
 */
export function fact<T>(family: BoundFamily, key: string, value: T | undefined): T {
  if (value === undefined) {
    throw new ScraperConfigError(family.id, `a ${family.kind} family must state ${key} as a fact`)
  }
  return value
}

/** The brand that published a family, defaulting as the catalog does. */
export function familyBrand(cfg: CommonDefinition | BoundFamily | BoundToolholding): BrandName {
  return cfg.brand ?? 'kennametal'
}
