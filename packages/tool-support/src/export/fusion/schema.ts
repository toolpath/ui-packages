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
 * The five cutting-data preset shapes, and which of them a type takes.
 *
 * **The shapes are not variations on one another.** A milling preset requires
 * seventeen fields; a tap's requires six and models nine in total. A drill
 * states a feed per revolution and no cutting feedrate at all, while a spot
 * drill — which routes through the same code in most applications — additionally
 * requires five feedrates the drill does not model. Writing one preset shape for
 * every tool therefore produces records that are silently short of what Fusion
 * demands, which is what {@link fusionType}'s `presetRequired` exists to catch.
 *
 * `extra` is what the shape models beyond what it requires. `stock-materials`
 * and `strategies` are in every one of them and this package writes neither —
 * they are a preset's applicability rules, not its numbers.
 */
const PRESET_SHAPES = {
  milling: {
    required: [
      'f_n',
      'guid',
      'material',
      'n',
      'n_ramp',
      'name',
      'ramp-angle',
      'tool-coolant',
      'use-stepdown',
      'use-stepover',
      'v_c',
      'v_f',
      'v_f_leadIn',
      'v_f_leadOut',
      'v_f_plunge',
      'v_f_ramp',
      'v_f_transition',
    ],
    extra: ['expressions', 'f_z', 'stepdown', 'stepover', 'stock-materials', 'strategies'],
    conditionals: [{ field: 'use-stepover', equals: true, requires: ['stepover'] }],
  },
  boring: {
    required: [
      'f_n',
      'guid',
      'material',
      'n',
      'name',
      'tool-coolant',
      'v_c',
      'v_f',
      'v_f_leadIn',
      'v_f_leadOut',
      'v_f_plunge',
      'v_f_ramp',
      'v_f_transition',
    ],
    extra: ['expressions', 'f_z', 'stock-materials', 'strategies'],
    conditionals: [],
  },
  drilling: {
    required: ['guid', 'material', 'n', 'name', 'tool-coolant', 'use-feed-per-revolution', 'v_c'],
    extra: [
      'expressions',
      'f_n',
      'f_n_retract',
      'stock-materials',
      'strategies',
      'v_f_plunge',
      'v_f_retract',
    ],
    conditionals: [
      { field: 'use-feed-per-revolution', equals: true, requires: ['f_n', 'f_n_retract'] },
    ],
  },
  spotting: {
    required: [
      'guid',
      'material',
      'n',
      'name',
      'tool-coolant',
      'use-feed-per-revolution',
      'v_c',
      'v_f',
      'v_f_leadIn',
      'v_f_leadOut',
      'v_f_ramp',
      'v_f_transition',
    ],
    extra: [
      'expressions',
      'f_n',
      'f_n_retract',
      'f_z',
      'stock-materials',
      'strategies',
      'v_f_plunge',
      'v_f_retract',
    ],
    conditionals: [
      { field: 'use-feed-per-revolution', equals: true, requires: ['f_n', 'f_n_retract'] },
    ],
  },
  // A tap is fed by its own pitch, so there is no feedrate to state: the six
  // required fields are its speed, its coolant and its identity, and it models
  // nothing else at all.
  tapping: {
    required: ['guid', 'material', 'n', 'name', 'tool-coolant', 'v_c'],
    extra: ['expressions', 'stock-materials', 'strategies'],
    conditionals: [],
  },
} as const satisfies Record<
  string,
  {
    required: readonly string[]
    extra: readonly string[]
    conditionals: readonly FusionPresetConditional[]
  }
>

type PresetShape = keyof typeof PRESET_SHAPES

/**
 * Per type: what geometry it requires beyond {@link SPINNING}, what it permits
 * beyond that, which preset shape it takes, and — for the one type that has one
 * — what it requires at the record level beyond {@link TOOL_RECORD_REQUIRED}.
 *
 * `holder` is stated whole, having no geometry and no presets at all.
 */
const TYPES = {
  'ball end mill': { required: SHANK, also: DCX, preset: 'milling' },
  'bull nose end mill': { required: [...SHANK, 'RE'], also: DCX, preset: 'milling' },
  'flat end mill': { required: SHANK, also: DCX, preset: 'milling' },
  'face mill': {
    required: [...SHANK, 'DCX', 'RE', 'TA', 'upper-radius'],
    also: [],
    preset: 'milling',
  },
  // The one type with a record-level field of its own: which of the three
  // tapered profiles this is. Geometry alone cannot say — a tapered bull nose
  // and a tapered ball nose share every dimension.
  'tapered mill': {
    required: [...SHANK, 'RE', 'TA'],
    also: DCX,
    record: ['tapered-type'],
    preset: 'milling',
  },
  'radius mill': { required: [...SHANK, 'RE', 'tip-length'], also: DCX, preset: 'milling' },
  'chamfer mill': { required: [...SHANK, 'TA', 'tip-diameter'], also: DCX, preset: 'milling' },
  'dovetail mill': { required: [...SHANK, 'RE', 'TA'], also: DCX, preset: 'milling' },
  'lollipop mill': { required: SHANK, also: DCX, preset: 'milling' },
  'slot mill': { required: [...SHANK, 'RE'], also: DCX, preset: 'milling' },
  'thread mill': {
    required: [...SHANK, 'NT', 'thread-profile-angle', 'thread-tip-type'],
    also: ['DCX', 'TP', 'TPN', 'TPX', 'thread-tip-radius', 'thread-tip-width'],
    preset: 'milling',
  },
  'circle segment barrel': {
    required: ['HAND', 'SFDM', 'axial-distance', 'lower-radius', 'profile-radius', 'upper-radius'],
    also: [],
    preset: 'milling',
  },
  'circle segment lens': {
    required: ['HAND', 'RE', 'lower-radius'],
    also: SEGMENT_RADII,
    preset: 'milling',
  },
  'circle segment oval': {
    required: ['HAND', 'lower-radius', 'profile-radius'],
    also: SEGMENT_RADII,
    preset: 'milling',
  },
  'circle segment taper': {
    required: ['HAND', 'TA', 'lower-radius', 'profile-radius', 'tip-diameter', 'upper-radius'],
    also: SEGMENT_RADII,
    preset: 'milling',
  },
  'boring bar': { required: BORE, also: BORE_EXTRA, preset: 'boring' },
  'counter bore': { required: BORE, also: BORE_EXTRA, preset: 'boring' },
  drill: { required: [...BORE, 'SIG'], also: BORE_EXTRA, preset: 'drilling' },
  'center drill': {
    required: [...BORE, 'SIG', 'TA', 'tip-diameter', 'tip-length'],
    also: BORE_EXTRA,
    preset: 'spotting',
  },
  'spot drill': {
    required: [...BORE, 'SIG', 'tip-diameter'],
    also: BORE_EXTRA,
    preset: 'spotting',
  },
  reamer: { required: BORE, also: BORE_EXTRA, preset: 'drilling' },
  'counter sink': {
    required: [...BORE, 'SIG', 'tip-diameter'],
    also: BORE_EXTRA,
    preset: 'spotting',
  },
  // A tap is driven by a square and states no hand in its geometry — the hand
  // is in the type name itself.
  'tap left hand': {
    required: ['SFDM', 'TP', 'shoulder-length'],
    also: BORE_EXTRA,
    preset: 'tapping',
  },
  'tap right hand': {
    required: ['SFDM', 'TP', 'shoulder-length'],
    also: BORE_EXTRA,
    preset: 'tapping',
  },
} as const satisfies Record<
  string,
  {
    required: readonly string[]
    also: readonly string[]
    preset: PresetShape
    record?: readonly string[]
  }
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

/**
 * What kind of quantity each geometry key states.
 *
 * **The schema cannot supply this.** It declares `NOF` a `number` exactly as it
 * declares `DC` one, so it tells a flute count from a length not at all. The
 * distinction matters twice over: a length converts between unit systems and a
 * count and an angle do not, and a length must be *serialized* with a decimal
 * point, because Fusion's parser crashes on an integer literal where it expects
 * a dimension — a library carrying `LB: 25` instead of `LB: 25.0` failed to
 * load every time until the zero was put back.
 *
 * So the finer kind is this package's, and the test holds each one against the
 * coarser JSON type the schema *does* declare: a key that turns from a boolean
 * into a string upstream is caught rather than serialized wrong.
 */
export type FusionValueKind = 'length' | 'angle' | 'count' | 'boolean' | 'enum'

export const FUSION_GEOMETRY_KINDS: Readonly<Record<string, FusionValueKind>> = {
  CSP: 'boolean',
  DC: 'length',
  DCX: 'length',
  HAND: 'boolean',
  LB: 'length',
  LCF: 'length',
  NOF: 'count',
  NT: 'count',
  OAL: 'length',
  RE: 'length',
  SFDM: 'length',
  SIG: 'angle',
  TA: 'angle',
  TP: 'length',
  TPN: 'length',
  TPX: 'length',
  assemblyGaugeLength: 'length',
  'axial-distance': 'length',
  'lower-radius': 'length',
  'profile-radius': 'length',
  'shoulder-diameter': 'length',
  'shoulder-length': 'length',
  'thread-profile-angle': 'angle',
  'thread-tip-radius': 'length',
  'thread-tip-type': 'enum',
  'thread-tip-width': 'length',
  'tip-diameter': 'length',
  'tip-length': 'length',
  'tip-offset': 'length',
  'upper-radius': 'length',
}

/** What kind of value this geometry key states, or `null` where it is unknown. */
export const fusionValueKind = (key: string): FusionValueKind | null =>
  Object.hasOwn(FUSION_GEOMETRY_KINDS, key) ? (FUSION_GEOMETRY_KINDS[key] ?? null) : null

/**
 * What kind of value each cutting-data preset field states.
 *
 * A second table beside {@link FUSION_GEOMETRY_KINDS} rather than an extension
 * of it, because the vocabularies do not overlap: a preset states speeds and
 * feeds, a geometry block states dimensions, and `n` means a spindle speed here
 * and nothing at all there.
 *
 * `n` and `n_ramp` are marked `speed` rather than `count`: they are revolutions
 * per minute, which is a rate and routinely fractional once it is solved from a
 * surface speed, and calling them counts would round them in the serializer.
 */
export type FusionPresetKind = FusionValueKind | 'speed' | 'feed'

export const FUSION_PRESET_KINDS: Readonly<Record<string, FusionPresetKind>> = {
  'ramp-angle': 'angle',
  'tool-coolant': 'enum',
  'use-feed-per-revolution': 'boolean',
  'use-stepdown': 'boolean',
  'use-stepover': 'boolean',
  f_n: 'feed',
  f_n_leadIn: 'feed',
  f_n_leadOut: 'feed',
  f_n_retract: 'feed',
  f_z: 'feed',
  n: 'speed',
  n_ramp: 'speed',
  stepdown: 'length',
  stepover: 'length',
  v_c: 'speed',
  v_f: 'feed',
  v_f_leadIn: 'feed',
  v_f_leadOut: 'feed',
  v_f_link: 'feed',
  v_f_measure: 'feed',
  v_f_plunge: 'feed',
  v_f_ramp: 'feed',
  v_f_retract: 'feed',
  v_f_transition: 'feed',
}

/**
 * Whether a number under this preset field is written with a decimal point.
 *
 * Everything dimensional is; a flag and an enum are not numbers at all. See
 * `library.ts` for why the rule exists and what the evidence for it actually
 * is.
 */
export const isPresetFloat = (field: string): boolean => {
  const kind = FUSION_PRESET_KINDS[field]
  return kind === 'length' || kind === 'angle' || kind === 'speed' || kind === 'feed'
}

/** The material band a preset applies to. Every preset carries one. */
export interface FusionPresetMaterial {
  readonly category: string
  readonly query: string
  readonly 'use-hardness': boolean
  readonly 'minimum-hardness'?: number
  readonly 'maximum-hardness'?: number
}

/**
 * The all-materials band.
 *
 * A convention rather than a measurement — it says the preset is not restricted
 * — so the exporter supplies it where a caller states none, on the same line
 * {@link FILL_CONSTANTS} draws for geometry.
 */
export const ALL_MATERIALS: FusionPresetMaterial = {
  category: 'all',
  query: '',
  'use-hardness': false,
}

/** What `material` must carry. */
export const FUSION_PRESET_MATERIAL_REQUIRED = ['category', 'query', 'use-hardness'] as const

/**
 * One of Autodesk's `if`/`then` rules on a preset: a switch that, when set,
 * demands fields of its own.
 */
export interface FusionPresetConditional {
  readonly field: string
  readonly equals: boolean
  readonly requires: readonly string[]
}

/** What the schema says about one type, resolved. */
export interface FusionTypeRules {
  readonly recordRequired: readonly string[]
  readonly geometryRequired: readonly string[]
  /** Includes everything required. What the exporter is willing to write. */
  readonly geometryAllowed: readonly string[]
  /** What a cutting-data preset on this type must carry. Empty for a holder. */
  readonly presetRequired: readonly string[]
  /** Includes everything required. Anything else is dropped with a note. */
  readonly presetAllowed: readonly string[]
  readonly presetConditionals: readonly FusionPresetConditional[]
}

const sorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort()

const rules = Object.fromEntries([
  ...Object.entries(TYPES).map(([name, entry]) => {
    const geometryRequired = sorted([...SPINNING, ...entry.required])
    const record = 'record' in entry ? entry.record : []
    const shape = PRESET_SHAPES[entry.preset]
    return [
      name,
      {
        recordRequired: sorted([...TOOL_RECORD_REQUIRED, ...record]),
        geometryRequired,
        geometryAllowed: sorted([...geometryRequired, ...entry.also]),
        presetRequired: sorted(shape.required),
        presetAllowed: sorted([...shape.required, ...shape.extra]),
        presetConditionals: shape.conditionals,
      },
    ]
  }),
  [
    'holder',
    {
      recordRequired: [...HOLDER_RECORD_REQUIRED],
      geometryRequired: [],
      geometryAllowed: [],
      presetRequired: [],
      presetAllowed: [],
      presetConditionals: [],
    },
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
