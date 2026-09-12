/**
 * What Autodesk's tool-library schema demands of each type this package can
 * write.
 *
 * ## This is a copy, and something watches it
 *
 * The rules live in a 2.6 MB JSON Schema Autodesk publishes and moves without
 * announcement — it changed between February and September 2026. The exporter
 * needs them at runtime, so they are here; the whole document is too large to
 * vendor, so `fusion/digest.json` holds a mechanically derived reduction of
 * it, `pnpm fusion:check-upstream` asks Autodesk weekly whether the original
 * has moved, and `tests/export-fusion-schema.test.ts` asserts that everything
 * below still resolves to exactly what the digest says.
 *
 * So the table is stated in the compressed form a reader can actually check —
 * a shared core, and the delta per type — rather than as twenty-five
 * expansions of the same twelve strings. **The compression is safe precisely
 * because it is measured**: if factoring out `SPINNING` ever loses a field for
 * one type, the resolved value stops matching the digest and the test says so.
 *
 * ## Required, allowed, and the difference between them
 *
 * `required` is what the schema refuses a record for omitting. `allowed` is
 * what it permits, and the exporter reads it as *what to bother writing*: a
 * corner radius means nothing on a drill, and Fusion does not list `RE` among
 * a drill's geometry, so a scraped `RE` of 0 is dropped there rather than
 * written into a field the format does not have.
 *
 * Allowed includes required, which is entailment and not a convenience: a
 * schema demanding a key permits it. Autodesk leans on that — `circle segment
 * lens` requires `RE` in a branch that declares no properties at all.
 *
 * Nothing here is closed (`additionalProperties` is unset on every geometry
 * object among these types), so an unlisted key would be *tolerated*. It is
 * still not written: a key Fusion does not model is a key Fusion will not show
 * anyone.
 */

/**
 * The library document's own version number.
 *
 * The schema's floor is 11 and states *"use the minimum specified by the
 * schema if unsure"*; 33 is what Fusion itself writes into a library it
 * exports today, which is the stronger signal about what it expects to read.
 * The test holds it at or above the digest's floor.
 */
export const FUSION_LIBRARY_VERSION = 33

/** `millimeters | inches` — the same two words `UnitSystem` uses, which is why no map. */
export const FUSION_UNITS = ['inches', 'millimeters'] as const

/**
 * Fusion's body-material vocabulary, entire.
 *
 * Five words. A catalog says more than five things — Kennametal publishes PCD
 * families whose substrate is `diamond` — and the exporter coerces what it
 * cannot say to `unspecified` and reports having done it, rather than picking
 * the nearest carbide.
 */
export const FUSION_MATERIALS = ['carbide', 'ceramics', 'hss', 'ti coated', 'unspecified'] as const

/** The three keys a shaft or holder segment carries, and no others. */
export const FUSION_SEGMENT_KEYS = ['height', 'lower-diameter', 'upper-diameter'] as const

/**
 * The shape a guid must take, from the schema's own `pattern`.
 *
 * Braces optional and `<…>` admitted, both of which are Autodesk's; the second
 * is reserved for its internal presets and nothing here writes one.
 */
export const FUSION_GUID_PATTERN =
  /(^(\{{0,1}([0-9a-fA-F]){8}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){4}-([0-9a-fA-F]){12}\}{0,1})$)|(<.*>)/

/** What every cutting tool's record must carry. */
const TOOL_RECORD_REQUIRED = [
  'BMC',
  'geometry',
  'guid',
  'post-process',
  'start-values',
  'type',
  'unit',
] as const

/** What a standalone holder's record must carry — a different schema entirely. */
const HOLDER_RECORD_REQUIRED = ['gaugeLength', 'guid', 'type', 'unit'] as const

/**
 * The geometry every spinning tool states, whatever it is.
 *
 * `LB` and `assemblyGaugeLength` are in here, which is the fact that shapes
 * the whole exporter: **Fusion will not accept a cutting tool that does not
 * say how far it stands out of its holder.** `LB` is `GEOMETRY_FIELDS.LBH`
 * and `Assembly.stickout` under Autodesk's name for it, and
 * `assemblyGaugeLength` is that plus the holder's gauge length. A bare tool
 * with no assembly has neither until something supplies them.
 */
const SPINNING = ['CSP', 'DC', 'LB', 'LCF', 'NOF', 'OAL', 'assemblyGaugeLength'] as const

/** A shank and a shoulder, as every tool with a plain body states them. */
const SHANK = ['HAND', 'SFDM', 'shoulder-diameter', 'shoulder-length'] as const

/** A hole-maker states its shoulder length and not its shoulder diameter. */
const BORE = ['HAND', 'SFDM', 'shoulder-length'] as const

/** Permitted on a milling tool, required by none: the second cutting diameter. */
const DCX = ['DCX'] as const

/** Permitted on a hole-maker whether or not the vendor states one. */
const BORE_EXTRA = ['DCX', 'shoulder-diameter'] as const

/** Every circle-segment shape permits the whole radius vocabulary. */
const SEGMENT_RADII = ['SFDM', 'axial-distance', 'lower-radius', 'profile-radius', 'upper-radius']

/**
 * Per type: what geometry it requires beyond {@link SPINNING}, what it permits
 * beyond that, and — for the one type that has one — what it requires at the
 * record level beyond {@link TOOL_RECORD_REQUIRED}.
 *
 * `holder` is stated whole, having no geometry at all.
 */
const TYPES = {
  'ball end mill': { required: SHANK, also: DCX },
  'bull nose end mill': { required: [...SHANK, 'RE'], also: DCX },
  'flat end mill': { required: SHANK, also: DCX },
  'face mill': { required: [...SHANK, 'DCX', 'RE', 'TA', 'upper-radius'], also: [] },
  // The one type with a record-level field of its own: which of the three
  // tapered profiles this is. Geometry alone cannot say — a tapered bull nose
  // and a tapered ball nose share every dimension.
  'tapered mill': { required: [...SHANK, 'RE', 'TA'], also: DCX, record: ['tapered-type'] },
  'radius mill': { required: [...SHANK, 'RE', 'tip-length'], also: DCX },
  'chamfer mill': { required: [...SHANK, 'TA', 'tip-diameter'], also: DCX },
  'dovetail mill': { required: [...SHANK, 'RE', 'TA'], also: DCX },
  'lollipop mill': { required: SHANK, also: DCX },
  'slot mill': { required: [...SHANK, 'RE'], also: DCX },
  'thread mill': {
    required: [...SHANK, 'NT', 'thread-profile-angle', 'thread-tip-type'],
    also: ['DCX', 'TP', 'TPN', 'TPX', 'thread-tip-radius', 'thread-tip-width'],
  },
  'circle segment barrel': {
    required: ['HAND', 'SFDM', 'axial-distance', 'lower-radius', 'profile-radius', 'upper-radius'],
    also: [],
  },
  'circle segment lens': { required: ['HAND', 'RE', 'lower-radius'], also: SEGMENT_RADII },
  'circle segment oval': {
    required: ['HAND', 'lower-radius', 'profile-radius'],
    also: SEGMENT_RADII,
  },
  'circle segment taper': {
    required: ['HAND', 'TA', 'lower-radius', 'profile-radius', 'tip-diameter', 'upper-radius'],
    also: SEGMENT_RADII,
  },
  'boring bar': { required: BORE, also: BORE_EXTRA },
  'counter bore': { required: BORE, also: BORE_EXTRA },
  drill: { required: [...BORE, 'SIG'], also: BORE_EXTRA },
  'center drill': {
    required: [...BORE, 'SIG', 'TA', 'tip-diameter', 'tip-length'],
    also: BORE_EXTRA,
  },
  'spot drill': { required: [...BORE, 'SIG', 'tip-diameter'], also: BORE_EXTRA },
  reamer: { required: BORE, also: BORE_EXTRA },
  'counter sink': { required: [...BORE, 'SIG', 'tip-diameter'], also: BORE_EXTRA },
  // A tap is driven by a square and states no hand in its geometry — the hand
  // is in the type name itself.
  'tap left hand': { required: ['SFDM', 'TP', 'shoulder-length'], also: BORE_EXTRA },
  'tap right hand': { required: ['SFDM', 'TP', 'shoulder-length'], also: BORE_EXTRA },
} as const satisfies Record<
  string,
  { required: readonly string[]; also: readonly string[]; record?: readonly string[] }
>

/**
 * The types this package can write — `forms.ts`'s vocabulary, plus the holder.
 *
 * A union of literals rather than `string`, so a caller naming a type this
 * package cannot write is a compile error where they wrote it.
 */
export type FusionType = keyof typeof TYPES | 'holder'

const names: FusionType[] = [...(Object.keys(TYPES) as (keyof typeof TYPES)[]), 'holder']

export const FUSION_TYPE_NAMES: readonly FusionType[] = names.sort()

/** What the schema says about one type, resolved. */
export interface FusionTypeRules {
  readonly recordRequired: readonly string[]
  readonly geometryRequired: readonly string[]
  /** Includes everything required. What the exporter is willing to write. */
  readonly geometryAllowed: readonly string[]
}

const sorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort()

const rules = Object.fromEntries([
  ...Object.entries(TYPES).map(([name, entry]) => {
    const geometryRequired = sorted([...SPINNING, ...entry.required])
    const record = 'record' in entry ? entry.record : []
    return [
      name,
      {
        recordRequired: sorted([...TOOL_RECORD_REQUIRED, ...record]),
        geometryRequired,
        geometryAllowed: sorted([...geometryRequired, ...entry.also]),
      },
    ]
  }),
  [
    'holder',
    { recordRequired: [...HOLDER_RECORD_REQUIRED], geometryRequired: [], geometryAllowed: [] },
  ],
]) as Record<FusionType, FusionTypeRules>

/**
 * Every type this package writes, and what the schema demands of it.
 *
 * Resolved from the compressed table above, and asserted against
 * `fusion/digest.json` — so reading this is reading Autodesk's own rules, not
 * somebody's recollection of them.
 */
export const FUSION_TYPES: Readonly<Record<FusionType, FusionTypeRules>> = rules

/** The rules for a type, or `null` where this package cannot write it. */
export const fusionType = (type: string): FusionTypeRules | null =>
  Object.hasOwn(rules, type) ? rules[type as FusionType] : null
