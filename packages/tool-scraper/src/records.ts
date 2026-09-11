/**
 * The interchange contract: what an adapter hands the core, and the canonical
 * names it hands it in.
 *
 * Before this seam existed, the mapper read `row['AP1MAX_mm']`, `row['D3_mm']`,
 * `row['Re_mm']` and `row['Z']` — Kennametal's own attribute codes, in the
 * module that also held the reduced-shank rule and the bare-tool length
 * convention. A second vendor had two options and both were bad: relabel its
 * columns into Kennametal's on the way into the CSV, which puts a lie in the
 * file whose whole job is to record what the vendor published; or fork the
 * mapper, which copies the domain into every adapter to drift independently.
 *
 * So the mapper stopped reading vendor column names. **An adapter owns CSV →
 * record; a record is where this package hands off.** The CSV keeps the
 * vendor's own column labels, because it is the receipt — see `conventions`.
 *
 * ## The canonical names are ISO 13399
 *
 * `DC`, `OAL`, `LCF`, `RE`, `NOF`, `SIG`, `TP` are codes from **ISO 13399**,
 * *Cutting tool data representation and exchange* — the machine-tool
 * industry's own interchange dictionary. CAM vendors implement subsets of it;
 * Autodesk Fusion implements one, which is why these names also appear in
 * Fusion's tool JSON. This package uses the standard directly, so nothing here
 * depends on any CAM vendor's choices, and the places where a CAM vendor
 * departed from the standard are recorded as departures rather than adopted
 * silently: see {@link GEOMETRY_FIELDS}, where three of the ten names are
 * Autodesk's own and say so.
 *
 * The standard is paid and split across parts, so the working reference is a
 * manufacturer's published table — Sandvik Coromant's and Dormer Pramet's are
 * both complete.
 *
 * **A canonical name says nothing about units.** An adapter declares
 * `DC: 'D1'` and the core appends `_mm`/`_in` from the family's declared unit;
 * that rule lives in `conventions.UNIT_SUFFIX`, in one place, because choosing
 * the suffix inside an adapter is exactly the mistake `unit` exists to prevent.
 *
 * ## What is deliberately *not* here
 *
 * `LB` and `assemblyGaugeLength` are not canonical inputs — they are `OAL`
 * under another name on a bare tool, ISO code or not, and a field that is
 * always a copy is not a second measurement. An adapter that could supply them
 * separately could supply a tool that claims a holder it does not have.
 */

import {
  GEOMETRY_FIELDS as DICTIONARY,
  type ThreadMethod,
  type UnitSystem,
} from '@toolpath/tool-support'

import { dimensionalColumn } from './conventions.js'
import { ScraperConfigError } from './errors.js'
import { recordGuid, type BrandName } from './identity.js'
import type { FactSource } from './provenance.js'

/**
 * One canonical geometry name: what it measures, and whose name it is.
 *
 * **Declared here rather than re-exported from `@toolpath/tool-support`**, even
 * though the dictionary's entries are the shared ones. The shared
 * `GeometryField` carries a required `unit` and is `readonly` throughout, and
 * this type has been published since 1.0: adopting it outright would stop a
 * consumer that builds one of these — `{ definition, iso }` — from compiling,
 * for no gain the values below do not already give. The entries *satisfy* the
 * shared shape, so a field renamed upstream is still a compile error here.
 */
export interface GeometryField {
  /**
   * What the field measures, phrased so it can be quoted back at whoever
   * mapped a column to the wrong one.
   */
  definition: string
  /**
   * The ISO 13399 code for this measurement, or `null` where the standard's
   * counterpart has not been pinned against the dictionary. Equal to the
   * canonical name itself on every field that *is* the standard's code.
   */
  iso: string | null
}

/**
 * How a tap makes its thread.
 *
 * `@toolpath/tool-support`'s, re-exported under the name this package reads it
 * by — the move `conventions.ts` makes for `UnitSystem` and `provenance.ts` for
 * `PROVENANCE`. A scrape originates the fact and the domain owns the
 * vocabulary, and two declarations of the same two strings is the drift that
 * rule exists to prevent.
 */
export type { ThreadMethod } from '@toolpath/tool-support'

/** The kinds of cutting tool this package maps. */
export type ToolKind = 'drill' | 'tap' | 'endmill'

/**
 * ISO 513's main workpiece-material groups, in the order every vendor's
 * material groups must agree on — **core, not a Kennametal fact**, the same
 * distinction that puts thread-designation parsing in `thread.ts`: this is a
 * standard, not a table. A vendor whose own column publishes groups in a
 * different order — Destiny Tool's `isoMaterialGroups` does, e.g.
 * `['M', 'P', 'S']` — must reorder onto this sequence rather than passing its
 * raw order through, because a consumer that renders a facet from one array
 * and a tool's own list from another has no way to notice the two disagree.
 */
export const ISO_MATERIAL_GROUPS = ['P', 'M', 'K', 'N', 'S', 'H', 'C'] as const

/**
 * The material-groups label for **we do not know what this tool is for**.
 *
 * Not an ISO 513 group and deliberately not one of {@link ISO_MATERIAL_GROUPS}:
 * it is a statement about this package's evidence, not about the tool. It sits
 * in {@link ToolRecord.materialGroupsSource} rather than in the group list,
 * because a consumer filtering a catalog down to "cuts steel" must not have to
 * know that one of the letters is not a letter.
 *
 * **Why a label and not a bare `null`.** The absence was expressible before —
 * `materialGroups === null` — and an absence is the one thing a reader has to
 * interpret. Every Harvey part is here, and so is every Kennametal family whose
 * material sweep has not been run: two different reasons for the same honest
 * answer, and neither is "rated for nothing". A named value says that out loud
 * in a UI, a log line and a filter, which `null` never does.
 */
export const UNSPECIFIED = 'unspecified'

/**
 * How a record's material groups were arrived at.
 *
 * A fact's own three sources plus {@link UNSPECIFIED}, which provenance has no
 * word for because a `Fact` only exists once somebody has stated something. A
 * record exists either way, so it needs the fourth.
 *
 * Only `vendor-stated`, `derived` and `unspecified` occur today; `assumed` is
 * reachable the moment a family fact supplies the groups, and is kept in the
 * type so that the vocabularies cannot drift apart.
 */
export type MaterialGroupsSource = FactSource | typeof UNSPECIFIED

/**
 * Canonical geometry fields an adapter may supply, and what each means.
 *
 * Keyed by name so the load-time check can quote a definition back at whoever
 * mapped a column to the wrong one, and each entry carries its ISO 13399 code
 * so the vocabulary's source is readable from the code rather than from a plan
 * document.
 *
 * ## What each entry says, and what this table says
 *
 * The definitions and ISO codes are `@toolpath/tool-support`'s — that is the
 * dictionary, and it is shared because a code has to mean one thing in every
 * package that reads one. **This is not that dictionary.** It is the narrower
 * question only a scraper asks: which of those names an *adapter may map a
 * vendor column to*.
 *
 * The two are not the same list and must not become one. The dictionary knows
 * `LBH` and `LD`, which are derived from a tool and a holder downstream and
 * which no vendor publishes; an adapter permitted to map a column to `LBH`
 * could supply a tool that claims a stickout nobody set. It also knows `LSCN`,
 * ISO's clamping-length minimum, which is a real vendor column the day a vendor
 * prints one — and which is deliberately absent below until that day, because
 * the load-time check's job is to refuse a name no scrape can fill.
 *
 * So each entry is an explicit pick out of the shared table rather than a
 * spread of it: a name dropped from the dictionary is a compile error here, and
 * a name added to the dictionary does not silently become mappable.
 *
 * **Seven of the ten are the standard's codes with the standard's meanings.**
 * The three that are not are Autodesk's, and each has an ISO counterpart
 * Autodesk did not use:
 *
 * - `SFDM` is Autodesk's "Shaft Diameter"; ISO's shank diameter is `DMM`.
 * - `shoulder-length` and `shoulder-diameter` are Autodesk's hyphenated
 *   lowercase keys. ISO's nearest are `LS` and `DN`, and they are recorded as
 *   unpinned rather than mapped, because "nearest" is not "the same" and the
 *   standing rule here is to leave a code unlabelled rather than guess at what
 *   it measures.
 *
 * They are kept under Autodesk's names anyway: renaming them would buy
 * correctness in a document nothing reads yet and cost the one property that
 * makes a canonical name useful, which is that a downstream consumer
 * recognises it.
 */
export const GEOMETRY_FIELDS = {
  DC: DICTIONARY.DC,
  SFDM: DICTIONARY.SFDM,
  OAL: DICTIONARY.OAL,
  LCF: DICTIONARY.LCF,
  RE: DICTIONARY.RE,
  TP: DICTIONARY.TP,
  NOF: DICTIONARY.NOF,
  SIG: DICTIONARY.SIG,
  'shoulder-length': DICTIONARY['shoulder-length'],
  'shoulder-diameter': DICTIONARY['shoulder-diameter'],
} as const satisfies Record<string, GeometryField>

/**
 * The canonical names an adapter may map, as a type.
 *
 * Derived from {@link GEOMETRY_FIELDS}, so a column map naming `LFC` is a
 * compile error rather than a key that sits there doing nothing while the
 * geometry it was meant to fill is silently absent from every tool.
 */
export type GeometryName = keyof typeof GEOMETRY_FIELDS

/**
 * The canonical names that are **not** ISO 13399's own codes, derived rather
 * than listed so the two cannot disagree.
 *
 * Asserted by the tests as exactly these three, which is what makes adding a
 * fourth a deliberate act: a canonical name that is one CAM vendor's invention
 * is a departure from the standard, and this package's claim to be using the
 * standard is only as good as the departures being counted.
 */
export const NON_ISO_NAMES: readonly GeometryName[] = (
  Object.entries(GEOMETRY_FIELDS) as [GeometryName, GeometryField][]
)
  .filter(([name, field]) => field.iso !== name)
  .map(([name]) => name)

/**
 * What each tool kind must map before a single row is read.
 *
 * The point of stating it per kind rather than per family: core can refuse
 * "endmill family X maps no LCF" at config load, naming the family, instead of
 * failing on a missing key from inside a mapper on row 1 of a scrape that
 * already ran. A field's *absence* from this list is a claim too — `RE` is
 * optional because a square-end family publishes no corner-radius column and 0
 * is the right answer, not a missing one.
 */
export const REQUIRED_GEOMETRY: Record<ToolKind, readonly GeometryName[]> = {
  drill: ['DC', 'SFDM', 'OAL', 'LCF'],
  tap: ['SFDM', 'OAL', 'LCF'],
  endmill: ['DC', 'SFDM', 'OAL', 'LCF'],
}

/**
 * Fields that carry a unit and therefore get a `_mm`/`_in` suffix appended to
 * the vendor's column label. The rest are counts, angles and flags, published
 * in one column whatever the family's unit system.
 *
 * `TP` is here and it is the interesting one: a thread pitch is a length, and
 * on an inch tap it is `1/TPI` **inches** while on a metric tap it is
 * millimetres. It is nonetheless read from a single column, because the
 * scraper derives it in the family's native unit already — so it is listed as
 * dimensional for documentation and excluded from suffixing by
 * {@link DIMENSIONAL_COLUMNS}.
 */
export const DIMENSIONAL: ReadonlySet<GeometryName> = new Set<GeometryName>([
  'DC',
  'SFDM',
  'OAL',
  'LCF',
  'RE',
  'TP',
  'shoulder-length',
  'shoulder-diameter',
])

/**
 * The subset of {@link DIMENSIONAL} whose CSV column is a unit *pair*.
 *
 * `TP` is dimensional but not paired: the Kennametal thread-pitch step derives
 * one `Thread Pitch` column already in the tap's native system, so appending a
 * suffix would look for a column that was never scraped.
 */
export const DIMENSIONAL_COLUMNS: ReadonlySet<GeometryName> = new Set(
  [...DIMENSIONAL].filter((name) => name !== 'TP'),
)

/**
 * What geometry a **record** of each kind carries, as against what a family
 * must map.
 *
 * {@link REQUIRED_GEOMETRY} is about columns: it refuses a family whose config
 * maps no `LCF`. This is about the record that comes out the other end, and the
 * two genuinely differ — a Kennametal drill's `NOF` and `SIG` come from facts
 * and not from any column, so they can never appear in a column map and are
 * always on the record.
 *
 * **`sometimes` is the point of the table.** An absent key was the one thing in
 * a record a reader had to interpret: `geometry.NOF === undefined` means "Harvey
 * publishes no flute count for this family" on an end mill and "not part of the
 * contract" on a drill, and nothing said which. That is exactly the ambiguity
 * {@link UNSPECIFIED} exists to remove from {@link ToolRecord.materialGroups},
 * and the record shipped both encodings at once. Now the absence is declared:
 * a key in `sometimes` may be missing and its absence is the vendor's silence;
 * a key in neither list is not part of that kind's record at all.
 *
 * Every `sometimes` entry today is one vendor publishing nothing where another
 * publishes a number. `sometimes` permits the key, it does not forbid it — the
 * vendors that state these keep filling them.
 *
 * - the **end mill's `NOF`**, for Harvey's two deburring families — they
 *   publish right- and left-hand tooth counts and no flute count, so there is
 *   nothing to read and 0 is not a substitute;
 * - the **tap's `NOF`**, for EMUGE-FRANKEN, which states no flute count
 *   anywhere a scrape can reach — not on the grouped product, the variant
 *   listing, the per-part detail record or any facet — while its own tap
 *   families run 2, 3 and 4 flutes across their size range, so no per-family
 *   constant could be true of every row. Kennametal's taps publish a `Z`
 *   column and keep filling it;
 * - the **drill's `SIG`**, for the one EMUGE-FRANKEN drill whose point-angle
 *   cell is empty. This one is a hole in a column the vendor otherwise fills,
 *   not a column it never had, and it is the reason the key had to move: the
 *   EMUGE drill family reads `SIG` from a column rather than from a fact, so
 *   a single blank cell refused the row, and `registry.toRecords` maps a
 *   family's rows together — 2,669 drills were lost to the 2,670th. Every
 *   Kennametal drill supplies `SIG` from a fact and none can be absent.
 *
 * A point angle is not a field to guess at. It sets the drill tip's length, so
 * a CAM system that assumed 140 deg for a part ground at 118 would cut a hole
 * to the wrong depth — an absence a consumer must check for is recoverable and
 * a plausible wrong number is not.
 */
export const RECORD_GEOMETRY: Record<
  ToolKind,
  { readonly always: readonly GeometryName[]; readonly sometimes: readonly GeometryName[] }
> = {
  drill: {
    always: ['DC', 'SFDM', 'OAL', 'LCF', 'NOF'],
    sometimes: ['SIG'],
  },
  tap: {
    always: ['DC', 'TP', 'SFDM', 'OAL', 'LCF'],
    sometimes: ['NOF'],
  },
  endmill: {
    always: ['DC', 'RE', 'SFDM', 'OAL', 'LCF', 'shoulder-length', 'shoulder-diameter'],
    sometimes: ['NOF'],
  },
}

/**
 * Refuse a record whose geometry does not match its kind's declared shape.
 *
 * Two failures, and the second is the one worth having: a key the kind does not
 * declare at all means a mapper is writing a measurement into a record nothing
 * downstream expects to find there, which is invisible until a consumer does
 * not read it.
 */
function checkGeometry(kind: ToolKind, what: string, geometry: object): void {
  const { always, sometimes } = RECORD_GEOMETRY[kind]
  const present = new Set(Object.keys(geometry))

  const missing = always.filter((name) => !present.has(name))
  if (missing.length > 0) {
    throw new ScraperConfigError(
      what,
      `a ${kind} record carries ${missing.join(', ')} and this one does not — ` +
        `a field a kind always has is not a field a mapper may skip`,
    )
  }

  const declared = new Set<string>([...always, ...sometimes])
  const extra = [...present].filter((name) => !declared.has(name)).sort()
  if (extra.length > 0) {
    throw new ScraperConfigError(
      what,
      `a ${kind} record does not carry ${extra.join(', ')} — ` +
        `add it to RECORD_GEOMETRY before a mapper writes one`,
    )
  }
}

/**
 * One orderable cutting tool, in canonical fields, ready for the core.
 *
 * `readonly` throughout because it is an interchange value: an adapter builds
 * it and hands it over, and a mapper that mutated one would be reaching back
 * across the seam this type exists to draw.
 *
 * `geometry` holds {@link GEOMETRY_FIELDS} names in `unit`.
 *
 * ## The workpiece-material groups have three states, not two
 *
 * They were `string[]` until this contract, and an empty array carried two
 * incompatible claims at once. Kennametal's 129 taps are empty because the
 * vendor's own index rates them for nothing; every Harvey part was empty
 * because Harvey publishes no index a scrape can reach, and a Kennametal family
 * whose material sweep was never run was empty for a third reason. A consumer
 * reading the first as "not rated for steel" is right and reading the second
 * the same way is wrong, and nothing in the record told the two apart.
 *
 * So:
 *
 * - **`null`, labelled {@link UNSPECIFIED}** — we do not know what this tool is
 *   for. Not indexed, not published, or not swept. Says nothing about what it
 *   cuts, and is not a claim that it cuts nothing.
 * - **`[]`** — the vendor's index exists and rates this part for nothing.
 * - **non-empty** — rated, in {@link ISO_MATERIAL_GROUPS} order.
 *
 * {@link ToolRecord.materialGroupsSource} is never absent: it is `unspecified`
 * in the first case and, in the other two, how the answer was arrived at in the
 * same vocabulary a family fact uses — `vendor-stated` where the vendor's own
 * index said so, `derived` where this package computed it. A consumer that will
 * not act on a guess filters on it, and one that will not show an unknown as an
 * empty facet filters on it too.
 */
export interface ToolRecord {
  /**
   * The brand key the record was minted under — `identity.BRANDS`'s own key,
   * not the display name.
   *
   * Here because {@link ToolRecord.guid} is the join key for every downstream
   * consumer and it is minted in this brand's namespace: without the key on
   * the record, the guid is underivable from the record and `vendor` is a
   * display string nothing can look a namespace up by.
   */
  readonly brand: BrandName
  /** What this brand's records call the vendor — `identity.BRANDS[brand].vendor`. */
  readonly vendor: string
  /**
   * `identity.recordGuid(brand, materialNumber)`, minted by {@link toolRecord}
   * rather than by an adapter: one mint path is what makes a guid collision
   * across brands structurally impossible instead of merely unlikely.
   */
  readonly guid: string
  readonly materialNumber: string
  readonly catalogNumber: string
  /**
   * The vendor's own free text about this part, verbatim — `''` where the
   * vendor publishes none.
   *
   * **Never a copy of another field on this record.** It was
   * `row['ISO Catalog Number']` on every Kennametal drill and end mill until
   * 2026-08-29, which put the catalog number in two fields and told a consumer
   * nothing it did not already have: a search index built on it matched a part
   * number and no words. Kennametal publishes no description column, so the
   * honest answer is the empty string — the same rule {@link ToolRecord.coating}
   * already states for a table that publishes no coating.
   *
   * **It may be per product line rather than per part.** Harvey states one
   * title for a whole page and no per-part text, so every record of a Harvey
   * family carries that family's title. That is what the vendor published; a
   * consumer that needs a per-part string has `catalogNumber`.
   */
  readonly description: string
  /**
   * The vendor's own name for the product line this part belongs to —
   * `FRANKEN TOP-Cut`, `MultiDRILL`, `KenCut™ FF`, `Viper` — or `null` where
   * the vendor names none.
   *
   * **Null is the vendor's silence, not an empty name**, the same three-state
   * reasoning {@link ToolRecord.materialGroups} makes with {@link UNSPECIFIED}
   * and for the same reason: a consumer faceting a catalog by product line has
   * to be able to tell "EMUGE calls this Alu-Cut" from "nobody has decided what
   * Harvey's line is called", and `''` collapses the two.
   *
   * **Verbatim, and never inferred** — the {@link ToolRecord.coating} rule.
   * EMUGE's own index says `FRANKEN Expert` for the eight end mills its
   * marketing calls "Cut & Form", and Destiny Tool ships `viper-mini` and
   * `python` beside `Viper` and `Raptor`; case-folding either here would be
   * this package authoring a vendor's catalog. The one thing an adapter may do
   * is map a vendor's *code* onto that same vendor's *own* published name for
   * it — see `vendors/emuge/records.ts`'s `PRODUCT_LINES`, where both sides of
   * every entry are EMUGE's and the article page each name came from is cited.
   *
   * **Where it comes from is a fact about the vendor's data, not a convention.**
   * Three sources are in use and each is the only one its vendor offers: a
   * scraped column read per part (EMUGE, Destiny Tool), a page title fetched
   * per family (Kennametal, WIDIA), and nothing at all (Harvey Tool, whose
   * product-line title is already this record's `description` — a second copy
   * of one string is the thing that field's own docstring refuses).
   *
   * **Never a copy of another field on this record**, for the reason
   * {@link ToolRecord.description} states it.
   */
  readonly productLine: string | null
  readonly kind: ToolKind
  readonly unit: UnitSystem
  readonly substrate: string
  /**
   * The vendor's own coating string, `''` where the table publishes none.
   *
   * Raw, and never inferred from: `AlTiN COATED`, `TiN` and a Destiny Tool
   * coating id are three vendors' vocabularies, and mapping them onto a shared
   * one here would be this package inventing a standard rather than recording
   * what was published.
   */
  readonly coating: string
  /**
   * The canonical geometry, in {@link ToolRecord.unit}.
   *
   * Numbers only. It was `number | boolean` until 2026-08-29 and no adapter has
   * ever put a boolean in one — {@link GEOMETRY_FIELDS} defines no boolean
   * field — so the width bought nothing and cost every consumer a narrowing
   * before it could do arithmetic on `geometry.DC`.
   *
   * **Which keys are present is stated per kind, not left to the mapper**: see
   * {@link RECORD_GEOMETRY}. An absent key is a claim, and it is the vendor's
   * silence rather than a gap — the same distinction
   * {@link ToolRecord.materialGroups} draws with {@link UNSPECIFIED}.
   */
  readonly geometry: Readonly<Partial<Record<GeometryName, number>>>
  readonly coolantThrough: boolean
  /** ISO 513 main groups in {@link ISO_MATERIAL_GROUPS} order — see above. */
  readonly materialGroups: readonly string[] | null
  /** How the groups were arrived at. {@link UNSPECIFIED} exactly when they are null. */
  readonly materialGroupsSource: MaterialGroupsSource
  /**
   * Drills only, and deliberately `null` elsewhere rather than `false`: it
   * drops the two ferrous presets downstream, and a default would ship them on
   * a PCD tool.
   */
  readonly nonFerrous: boolean | null
  /**
   * Taps only, and `null` on every other kind because the question does not
   * apply — the shape {@link ToolRecord.nonFerrous} already keeps for drills.
   *
   * **Not a default, and not derivable from anything else on the record.** A
   * former and a cut tap of the same size share their `DC`, `TP`, `SFDM`,
   * `OAL` and `LCF`; what separates them is that one displaces material and the
   * other removes it, which changes the hole a shop drills first and the feed
   * it runs. Guessing `cutting` because most of a catalog is would ship a
   * former with a cut tap's drill size.
   *
   * It is a per-family fact rather than a column, and each of the five
   * declarations cites the vendor's own index — see `families/kennametal.ts`
   * and `families/emuge.ts`. The invariant below is what stops a sixth tap
   * family arriving without one.
   */
  readonly threadMethod: ThreadMethod | null
}

/**
 * Build a {@link ToolRecord}: mint its guid, default the fields that have a
 * meaningful absence, and refuse the one state that cannot be true.
 *
 * An interface cannot carry a default, and requiring every adapter to write
 * `materialGroups: null` would put the decision back in the three places least
 * able to notice it was wrong. They stay **required on the type** so a
 * consumer reading a record never handles `undefined` — only the construction
 * is optional. The default is `null`/{@link UNSPECIFIED} and not `[]`, because
 * an adapter that says nothing about workpiece materials has produced no
 * evidence, which is the one thing the three-state rule exists to distinguish.
 *
 * `guid` is not an input at all. Every adapter minting it would be three
 * copies of `recordGuid(brand, materialNumber)` to drift, on the value that is
 * the join key for every downstream consumer.
 *
 * The geometry is checked against {@link RECORD_GEOMETRY} before anything is
 * built, so a kind's shape is one table rather than a convention three mappers
 * each keep separately. That is the same move the material-groups invariant
 * below makes: the factory is where a record's shape can be refused once.
 *
 * The result is frozen, geometry and material groups included: a record is an
 * interchange value, and a mapper that mutated one would be reaching back
 * across the seam this type exists to draw.
 */
export function toolRecord(
  fields: Omit<
    ToolRecord,
    | 'guid'
    | 'materialGroups'
    | 'materialGroupsSource'
    | 'nonFerrous'
    | 'productLine'
    | 'threadMethod'
  > &
    Partial<
      Pick<
        ToolRecord,
        'materialGroups' | 'materialGroupsSource' | 'nonFerrous' | 'productLine' | 'threadMethod'
      >
    >,
): ToolRecord {
  const groups = fields.materialGroups ?? null
  const source = fields.materialGroupsSource ?? UNSPECIFIED
  // An adapter that has nothing to say about the product line says nothing;
  // `''` would be a name and there is no nameless line. Optional here and
  // required on the type for the reason stated above — a consumer reading a
  // record never handles `undefined`.
  const line = fields.productLine ?? null

  if (line === '') {
    throw new ScraperConfigError(
      fields.materialNumber,
      `productLine is the empty string — a vendor that names no product line ` +
        `is null, which is the state a consumer can tell from a name`,
    )
  }

  // The invariant is what keeps the three states three: groups labelled
  // `unspecified` are groups nobody stated, and an attributed source with no
  // groups attributes nothing. Either would land as a record whose material
  // index reads as the opposite of what the adapter meant.
  if ((groups === null) !== (source === UNSPECIFIED)) {
    throw new ScraperConfigError(
      fields.materialNumber,
      `materialGroups is ${groups === null ? 'null' : JSON.stringify([...groups])} ` +
        `and materialGroupsSource is ${JSON.stringify(source)} — ` +
        `groups are ${JSON.stringify(UNSPECIFIED)} exactly when there are none`,
    )
  }

  // A tap says how it makes its thread and nothing else does. Both halves are
  // load-bearing: a tap record with no method is a family that never declared
  // the fact, and a method on a drill is a mapper that copied a line from the
  // tap one. Neither can be recovered downstream from what is left on the
  // record, because the geometry of a former and a cut tap is the same
  // geometry.
  const method = fields.threadMethod ?? null

  if ((fields.kind === 'tap') !== (method !== null)) {
    throw new ScraperConfigError(
      fields.materialNumber,
      `a ${fields.kind} record states threadMethod ${JSON.stringify(method)} — ` +
        `a tap says how it makes its thread and no other kind does`,
    )
  }

  checkGeometry(fields.kind, fields.materialNumber, fields.geometry)

  return Object.freeze({
    ...fields,
    threadMethod: method,
    guid: recordGuid(fields.brand, fields.materialNumber),
    geometry: Object.freeze({ ...fields.geometry }),
    materialGroups: groups === null ? null : Object.freeze([...groups]),
    materialGroupsSource: source,
    nonFerrous: fields.nonFerrous ?? null,
    productLine: line,
  })
}

/**
 * A family's canonical-field → CSV-column-label mapping, validated.
 *
 * Built once when the registry binds. `labels` are the vendor's own column
 * labels **without** a unit suffix — `'D1'`, not `'D1_mm'` — because which
 * suffix to read is the core's business, derived from the family's unit
 * system. A vendor that wrote `'D1_mm'` here would be hardcoding the answer to
 * the question `unit` exists to ask.
 *
 * A class rather than a plain object so that {@link checkColumnMap} is the
 * only way to get one: a caller cannot accidentally use an unvalidated map.
 */
export class ColumnMap {
  readonly kind: ToolKind
  readonly labels: Readonly<Partial<Record<GeometryName, string>>>

  /** @internal Use {@link checkColumnMap}. */
  constructor(kind: ToolKind, labels: Readonly<Partial<Record<GeometryName, string>>>) {
    this.kind = kind
    this.labels = { ...labels }
  }

  /** The CSV column to read for `canonical`, or null when unmapped. */
  column(canonical: GeometryName, unit: UnitSystem): string | null {
    const label = this.labels[canonical]
    if (label === undefined) return null
    if (!DIMENSIONAL_COLUMNS.has(canonical)) return label
    return dimensionalColumn(label, unit)
  }

  /** Every canonical name this family maps, in declaration order. */
  mapped(): GeometryName[] {
    return Object.keys(this.labels) as GeometryName[]
  }
}

/** A family config, as far as this module is concerned. */
export interface ColumnBearing {
  unit?: UnitSystem
  columns: ColumnMap
}

/**
 * The unit systems a family's rows can be in.
 *
 * Usually one, declared. **A tap family declares none**, and that asymmetry is
 * real rather than an omission: a tap's system comes from its own
 * `Thread System` column, so one family can hold metric and inch taps and both
 * column sets must exist. Anything checking a family's columns has to check
 * both for those.
 */
export function familyUnits(cfg: { unit?: UnitSystem }): UnitSystem[] {
  return cfg.unit === undefined ? ['millimeters', 'inches'] : [cfg.unit]
}

/**
 * Every mapped column is really in the CSV — before a single row is read.
 *
 * {@link checkColumnMap} sees only the map, so it cannot catch a family that
 * maps `LCF: 'AP1MAX'` against a table publishing `AP1MAX_in` alone while
 * tagged metric. That resolves to a column which is not there, and the per-row
 * failure names one row out of ninety-three instead of naming the family and
 * the field.
 *
 * It is separate from binding because binding deliberately does no I/O — an
 * installed package with no scraped data must still import.
 */
export function checkColumnsExist(
  family: string,
  cfg: ColumnBearing,
  header: Iterable<string>,
): void {
  const present = new Set(header)
  const missing: string[] = []

  for (const unit of familyUnits(cfg)) {
    for (const canonical of cfg.columns.mapped()) {
      // Never null: `mapped()` yields only the names that carry a label, which
      // is the one case `column()` has nothing to return.
      const column = cfg.columns.column(canonical, unit)!
      if (!present.has(column)) {
        missing.push(`${canonical} -> ${column}`)
      }
    }
  }

  if (missing.length > 0) {
    throw new ScraperConfigError(
      family,
      `mapped column(s) absent from the CSV: ${[...new Set(missing)].sort().join(', ')}`,
    )
  }
}

/**
 * Validate a family's column map, or refuse it by name.
 *
 * Three failures, and each is one that used to surface far from its cause:
 *
 * 1. **An unknown canonical field.** A typo like `LFC` would otherwise sit in
 *    the map doing nothing, and the geometry it was meant to fill would
 *    silently be absent from every tool in the family. {@link GeometryName}
 *    catches this at compile time for a map written in TypeScript; the check
 *    stays for one that arrives as data.
 * 2. **A missing required field.** A missing-key fault from inside a mapper
 *    names the *column*, which is the one piece of information the person who
 *    wrote the map already had.
 * 3. **An unknown kind**, which would otherwise skip the required-field check
 *    entirely by looking up an empty set.
 *
 * Returns the validated map so a caller cannot accidentally use the raw object.
 */
export function checkColumnMap(
  family: string,
  kind: string,
  labels: Readonly<Record<string, string>>,
): ColumnMap {
  if (!Object.hasOwn(REQUIRED_GEOMETRY, kind)) {
    throw new ScraperConfigError(
      family,
      `unknown tool kind ${JSON.stringify(kind)} ` +
        `(known: ${Object.keys(REQUIRED_GEOMETRY).sort().join(', ')})`,
    )
  }

  const unknown = Object.keys(labels)
    .filter((name) => !Object.hasOwn(GEOMETRY_FIELDS, name))
    .sort()
  if (unknown.length > 0) {
    throw new ScraperConfigError(
      family,
      `maps ${unknown.join(', ')} which are not canonical geometry fields ` +
        `(known: ${Object.keys(GEOMETRY_FIELDS).sort().join(', ')})`,
    )
  }

  const missing = REQUIRED_GEOMETRY[kind as ToolKind]
    .filter((name) => !Object.hasOwn(labels, name))
    .sort()
  if (missing.length > 0) {
    const described = missing
      .map((name) => `${name} (${GEOMETRY_FIELDS[name].definition})`)
      .join(', ')
    throw new ScraperConfigError(family, `a ${kind} family must map ${described}`)
  }

  return new ColumnMap(kind as ToolKind, labels as Partial<Record<GeometryName, string>>)
}
