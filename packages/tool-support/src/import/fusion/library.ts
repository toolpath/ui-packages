/**
 * Records from a Fusion tool library (`{ data: [...] }`, as Autodesk's vendor
 * libraries and a `.tools` export's `tools.json` hold it).
 *
 * The geometry is read the way tp-kernel 0.32's own importer reads it (tp-rs
 * `crates/tools/src/{f360,convert}.rs` and `tool.rs`), so a record says what
 * the kernel planned with: the same kinds from the same `type` strings, the
 * same flute lengths, tip diameters and thread forms, and the same non-cutting
 * stack above the flutes, whose length with theirs is the stickout. The tool's
 * `shaft` is that stack carried on to `OAL`, the whole tool above its flutes.
 * The ISO codes stop here; nothing past this module sees them.
 *
 * The kernel's proportion checks (`validate.rs`) are not repeated: an entry the
 * kernel refuses for its proportions may still read here.
 *
 * An entry's holder states no clamping, and Fusion has no field for one. What
 * the entry does state is that the holder was published with this tool, so the
 * holder is known to take that shank and nothing more: it reads as a generic
 * `bore` of the tool's shank, both marked derived, and refuses every other
 * shank until a library states how it clamps.
 *
 * What the entry does not state of its shaft is marked `assumed`, each of the
 * stack's two readings apart: `provenance.shank` where it states no `SFDM`
 * (the kernel fills at the cut), so its holder states no clamping, and
 * `provenance.overallLength` where it states no `OAL` (the stack ends at `LB`).
 *
 * Library data is wild. Nothing here throws on it: an entry this package does
 * not model — a holder, a probe, a turning tool, an unknown type — or one
 * missing the geometry its kind needs reads as `null`.
 */

import { coneHeight, coneRemainder, cylinder, radians } from '../../cones.js'
import { clampedShank } from '../../holding.js'
import type { ToolKind } from '../../kinds.js'
import type { Catalog, Cone, Holder, InsertTool, RotatingToolAssembly, Tool } from '../../model.js'
import { optional } from '../../optional.js'
import { sliceAt, stackHeight } from '../../stack.js'
import { MM_PER_INCH, type UnitSystem } from '../../units.js'

type Json = Readonly<Record<string, unknown>>

/** The unit system each of Fusion's unit spellings names. */
const UNIT_SYSTEM: ReadonlyMap<unknown, UnitSystem> = new Map([
  ['millimeters', 'millimeters'],
  ['mm', 'millimeters'],
  ['inches', 'inches'],
  ['in', 'inches'],
])

const UNIT_SCALE: ReadonlyMap<unknown, number> = new Map(
  [...UNIT_SYSTEM].map(([unit, system]) => [unit, system === 'inches' ? MM_PER_INCH : 1]),
)

/** The included angle of the ISO and unified thread forms, degrees. */
const ISO_THREAD_PROFILE_DEG = 60
/** The included angle of the Whitworth form (BSW, BSF, BSP), degrees. */
const WHITWORTH_THREAD_PROFILE_DEG = 55
/** The half angle of a tapered pipe thread's 1:16 cone, degrees: atan(1/32), as the kernel states it. */
const PIPE_THREAD_TAPER_DEG = 1.7899106082460694

const record = (value: unknown): Json | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : undefined

/** An object's own field, never one it inherits. */
const own = (value: Json | undefined, key: string): unknown =>
  value !== undefined && Object.hasOwn(value, key) ? value[key] : undefined

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

/** A JSON number, finite. */
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/** What Rust's `str::parse::<f64>` reads. */
const RUST_FLOAT = /^[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf|infinity|nan)$/i

/** A number as Rust parses one from a string; `undefined` where it is not one, or not finite. */
const parsed = (value: string): number | undefined =>
  RUST_FLOAT.test(value) ? finite(Number(value)) : undefined

/** The fields the kernel also reads from a numeric string (`flex_f64`); every other is a JSON number. */
const FLEXIBLE = new Set(['LCF', 'shoulder-length'])
/** The widths the kernel reads as unset when stated as zero (`unset_if_zero`). */
const UNSET_IF_ZERO = new Set(['SFDM', 'shoulder-diameter'])

const positive = (value: number | undefined): number | undefined =>
  value !== undefined && value > 0 ? value : undefined

/** An entry's geometry, read in millimetres. */
interface Geometry {
  /** A length field scaled to mm; `undefined` where it is absent or not finite once scaled. */
  readonly length: (code: string) => number | undefined
  /** An angle or count field, as stated. */
  readonly value: (code: string) => number | undefined
  /** A word field, as stated. */
  readonly word: (code: string) => string | undefined
}

const geometryOf = (geometry: Json, scale: number): Geometry => {
  const value = (code: string): number | undefined => {
    const raw = own(geometry, code)
    return FLEXIBLE.has(code) && typeof raw === 'string' ? parsed(raw) : finite(raw)
  }
  return {
    value,
    word: (code) => text(own(geometry, code)),
    length: (code) => {
      const stated = value(code)
      if (stated === undefined || (stated === 0 && UNSET_IF_ZERO.has(code))) {
        return undefined
      }
      return finite(stated * scale)
    },
  }
}

/** A description's words, lowercased: its runs of letters and digits. */
const wordsOf = (description: string): Array<string> =>
  description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')

/** A description's words with any size run into their front dropped: "1/8-27NPT" says "npt". */
const threadWordsOf = (description: string): Array<string> =>
  wordsOf(description).map((word) => word.replace(/^\d+/, ''))

/** A description's words as printed between spaces, lowercased, a trailing comma dropped. */
const spacedWordsOf = (description: string): Array<string> =>
  description
    .split(/\s+/)
    .map((word) => word.replace(/,+$/, '').toLowerCase())
    .filter((word) => word !== '')

/**
 * Whether a tap's description says it forms its thread, by whole words as the
 * kernel reads it: "forming", "form tap" or "roll tap", or a word ending in
 * "formtap" or "rolltap". Neither a "High Performance" nor a "Platform" tap
 * says "form".
 */
const isFormingTap = (description: string): boolean => {
  const words = wordsOf(description)
  const follows = (first: string): boolean =>
    words.some((word, index) => word === first && (words[index + 1]?.startsWith('tap') ?? false))
  return (
    words.some(
      (word) => word === 'forming' || word.endsWith('formtap') || word.endsWith('rolltap'),
    ) ||
    follows('form') ||
    follows('roll')
  )
}

/** The Whitworth form, where a description names Whitworth or a British designation. */
const namesWhitworthThread = (description: string): boolean =>
  threadWordsOf(description).some((word) =>
    ['whitworth', 'bsw', 'bsf', 'bsp', 'bspp', 'bspt'].includes(word),
  )

/** A tapered pipe thread's taper where a description names NPT, NPTF, ANPT or BSPT; straight otherwise. */
const threadTaperDeg = (description: string): number =>
  threadWordsOf(description).some((word) => ['npt', 'nptf', 'anpt', 'bspt'].includes(word))
    ? PIPE_THREAD_TAPER_DEG
    : 0

/**
 * The flat a coned tool's description states, in the library's unit: the
 * number in "X 0.0400 TIP DIA" or "X 0.0300 FLAT", with or without a fraction
 * after it ("X 0.0150 (1/64) TIP DIA"). A size of zero states a point.
 */
const statedFlat = (description: string): number | undefined => {
  const words = spacedWordsOf(description)
  for (let index = 0; index + 1 < words.length; index++) {
    const size = parsed(words[index + 1] as string)
    if (words[index] !== 'x' || size === undefined || !(size > 0)) {
      continue
    }
    let rest = words.slice(index + 2, index + 5)
    const fraction = rest[0]
    if (fraction !== undefined && fraction.startsWith('(') && fraction.endsWith(')')) {
      rest = rest.slice(1)
    }
    if (rest[0] === 'flat' || (rest[0] === 'tip' && rest[1] === 'dia')) {
      return size
    }
  }
  return undefined
}

/** Whether a coned tool's description names its tip a flat after its angle ("X 45 DEG PER SIDE FLAT"). */
const namesAFlatAfterItsAngle = (description: string): boolean => {
  const words = spacedWordsOf(description)
  return words.some(
    (word, index) =>
      RUST_FLOAT.test(word) &&
      words[index + 1] === 'deg' &&
      words[index + 2] === 'per' &&
      words[index + 3] === 'side' &&
      words[index + 4] === 'flat',
  )
}

/** A segment stack (`shaft` or `holder`), nose first as Fusion stores it; `undefined` if malformed. */
const segmentsOf = (value: unknown, scale: number): Array<Cone> | undefined => {
  const segments = own(record(value), 'segments')
  if (segments === undefined || segments === null) {
    return []
  }
  if (!Array.isArray(segments)) {
    return undefined
  }
  const layers: Array<Cone> = []
  for (const item of segments as Array<unknown>) {
    const segment = record(item)
    const scaled = (...keys: Array<string>): number | undefined => {
      const key = keys.find((name) => own(segment, name) !== undefined)
      const stated = key === undefined ? undefined : finite(own(segment, key))
      return stated === undefined ? undefined : finite(stated * scale)
    }
    const height = scaled('height')
    const lower = scaled('lower-diameter', 'lower_diameter', 'lowerDiameter')
    const upper = scaled('upper-diameter', 'upper_diameter', 'upperDiameter')
    if (height === undefined || lower === undefined || upper === undefined) {
      return undefined
    }
    if (height < 0 || lower < 0 || upper < 0) {
      return undefined
    }
    // A segment of no height is a step between its neighbors, not a layer.
    if (height > 0) {
      layers.push({ thickness: height, bottomDiameter: lower, topDiameter: upper })
    }
  }
  return layers
}

/** What a kind reads off the geometry: everything on a `Tool` that the type decides. */
type Head = Pick<
  Tool,
  | 'kind'
  | 'diameter'
  | 'fluteLength'
  | 'cornerRadius'
  | 'roundingRadius'
  | 'tipAngleDeg'
  | 'tipDiameter'
  | 'thread'
  | 'taperAngleDeg'
  | 'tipLength'
>

interface HeadInput {
  readonly g: Geometry
  readonly scale: number
  /** `DC`, required positive. */
  readonly dc: number
  /** `LCF` where it is positive. */
  readonly lcf: number | undefined
  /** The entry's description, `''` where it states none. */
  readonly description: string
}

const plain = (kind: ToolKind, { dc, lcf }: HeadInput): Head | null =>
  lcf === undefined ? null : { kind, diameter: dc, fluteLength: lcf }

/**
 * A cone-tipped head (chamfer mill, countersink) of diameter `DC`, its flutes
 * `LCF` up the cone from the tip diameter. A tip stated as zero under a
 * pointed cone taller than `LCF` gives way, as the kernel settles it, to a
 * flat the description states whose cone `LCF` fits; one it names but the
 * geometry does not size is no tool.
 */
const coned = (kind: ToolKind, input: HeadInput, fullDeg: number | undefined): Head | null => {
  const { g, scale, dc, lcf, description } = input
  if (fullDeg === undefined || !(fullDeg > 0 && fullDeg < 180) || lcf === undefined) {
    return null
  }
  const tip = g.length('tip-diameter') ?? 0
  if (tip < 0 || tip >= dc) {
    return null
  }
  const head = { kind, diameter: dc, tipAngleDeg: fullDeg }
  // LCF fits a cone within one digit in the third decimal of an inch.
  const rounding = 0.001 * MM_PER_INCH
  if (tip !== 0 || coneHeight(dc, 0, fullDeg) <= lcf + rounding) {
    return { ...head, fluteLength: lcf, tipDiameter: tip }
  }
  const stated = statedFlat(description)
  const flat = stated === undefined ? undefined : stated * scale
  if (flat !== undefined && flat < dc) {
    const settled = coneHeight(dc, flat, fullDeg)
    if (Math.abs(settled - lcf) <= rounding) {
      return { ...head, fluteLength: settled, tipDiameter: flat }
    }
  }
  if (flat !== undefined || namesAFlatAfterItsAngle(description)) {
    return null
  }
  return { ...head, fluteLength: lcf, tipDiameter: tip }
}

const drill =
  (kind: 'DrillBit' | 'SpotDrill') =>
  (input: HeadInput): Head | null => {
    const sig = input.g.value('SIG')
    const head = plain(kind, input)
    if (head === null || sig === undefined || !(sig > 0 && sig <= 180)) {
      return null
    }
    return { ...head, tipAngleDeg: sig }
  }

/** A thread form the kernel cuts: an included angle strictly inside (0°, 180°). */
const isProfile = (deg: number): boolean => deg > 0 && deg < 180

/**
 * A tap, its hand from its type: forming where its description says so, as
 * Fusion has no type for one; its form the stated profile angle, else the
 * Whitworth or ISO form its description names; its taper the pipe taper a
 * description names, else straight. Its lead, where the entry states one, is
 * `partialThreadCount`: Toolpath's key rather than Fusion's, which the kernel
 * reads too.
 */
const tap = (input: HeadInput, handedness: 'right' | 'left'): Head | null => {
  const pitch = positive(input.g.length('TP'))
  const head = plain(isFormingTap(input.description) ? 'FormingTap' : 'CuttingTap', input)
  const profileDeg =
    input.g.value('thread-profile-angle') ??
    (namesWhitworthThread(input.description)
      ? WHITWORTH_THREAD_PROFILE_DEG
      : ISO_THREAD_PROFILE_DEG)
  if (head === null || pitch === undefined || !isProfile(profileDeg)) {
    return null
  }
  const lead = input.g.value('partialThreadCount')
  return {
    ...head,
    thread: {
      pitch,
      handedness,
      profileDeg,
      taperDeg: threadTaperDeg(input.description),
      ...optional('partialThreads', lead !== undefined && lead >= 0 ? lead : undefined),
    },
  }
}

type ThreadTip = NonNullable<NonNullable<Tool['thread']>['tip']>

/** A thread mill's tooth tip, where the entry states its form and, for a flat or a round, its size. */
const threadTipOf = (g: Geometry): ThreadTip | undefined => {
  const form = g.word('thread-tip-type')
  const width = positive(g.length('thread-tip-width'))
  const radius = positive(g.length('thread-tip-radius'))
  if (form === 'point') {
    return { form }
  }
  if (form === 'flat' && width !== undefined) {
    return { form, width }
  }
  if (form === 'round' && radius !== undefined) {
    return { form, radius }
  }
  return undefined
}

/**
 * A thread mill. A multi-tooth mill (`NT` > 1) is ground to its own pitch and
 * must state `TP`; a single-point mill cuts the top of its range, `TPX`, else
 * its `TP`, and a range with no top is no tool. Its tooth count, the bottom of
 * a single-point mill's range (`TPN`) and its tip are read where stated.
 */
const threadMill = (input: HeadInput): Head | null => {
  const { g } = input
  const head = plain('ThreadMill', input)
  const stated = g.value('NT')
  const teeth = stated ?? 1
  if (head === null || !Number.isInteger(teeth) || teeth < 1) {
    return null
  }
  const tp = g.length('TP')
  const top = g.length('TPX') ?? tp
  if (top === undefined && g.length('TPN') !== undefined) {
    return null
  }
  const pitch = teeth > 1 ? tp : top
  const profileDeg = g.value('thread-profile-angle') ?? ISO_THREAD_PROFILE_DEG
  if (pitch === undefined || !(pitch > 0) || !isProfile(profileDeg)) {
    return null
  }
  return {
    ...head,
    thread: {
      pitch,
      profileDeg,
      taperDeg: threadTaperDeg(input.description),
      ...optional('teeth', stated),
      ...optional('pitchMin', teeth > 1 ? undefined : positive(g.length('TPN'))),
      ...optional('tip', threadTipOf(g)),
    },
  }
}

/** Fusion `type` → how its solid head is read. Face mills are inserts and read apart. */
const SOLID_HEADS: ReadonlyMap<string, (input: HeadInput) => Head | null> = new Map([
  ['flat end mill', (input) => plain('FlatEndmill', input)],
  [
    // The corner is half the diameter; `RE` is not read.
    'ball end mill',
    (input) => {
      const head = plain('BallEndmill', input)
      return head === null ? null : { ...head, cornerRadius: head.diameter / 2 }
    },
  ],
  [
    // A zero corner radius is a flat endmill.
    'bull nose end mill',
    (input) => {
      const radius = positive(input.g.length('RE'))
      const head = plain(radius === undefined ? 'FlatEndmill' : 'RadiusEndmill', input)
      return head === null ? null : { ...head, ...optional('cornerRadius', radius) }
    },
  ],
  [
    // `TA` is the cone's half angle.
    'chamfer mill',
    (input) => {
      const half = input.g.value('TA')
      return coned('ChamferEndmill', input, half === undefined ? undefined : 2 * half)
    },
  ],
  // `SIG` is the cone's included angle, as on a drill.
  ['counter sink', (input) => coned('Countersink', input, input.g.value('SIG'))],
  ['drill', drill('DrillBit')],
  // A drill to the kernel, flagged `is_spot_drill`; a kind of its own to the record.
  ['spot drill', drill('SpotDrill')],
  [
    // `DC` is the diameter below the round; the flutes reach `RE` beyond it on each side.
    'radius mill',
    ({ g, dc, lcf }) => {
      const radius = positive(g.length('RE'))
      if (radius === undefined) {
        return null
      }
      return {
        kind: 'CornerRoundingMill',
        diameter: dc + 2 * radius,
        fluteLength: lcf ?? (g.length('tip-length') ?? 0) + radius,
        roundingRadius: radius,
        ...optional('tipLength', g.length('tip-length')),
      }
    },
  ],
  ['tap right hand', (input) => tap(input, 'right')],
  ['tap left hand', (input) => tap(input, 'left')],
  [
    // The disc's corner `RE`, which the kernel rounds its disc by and its summary does not
    // report: a stated round, read as stated.
    'slot mill',
    (input) => {
      const head = plain('KeyseatCutter', input)
      return head === null ? null : { ...head, ...optional('cornerRadius', input.g.length('RE')) }
    },
  ],
  [
    // The disc's flank leans by `TA` from `DC` at its tip; a dovetail must state its lean.
    'dovetail mill',
    (input) => {
      const lean = input.g.value('TA')
      const head = plain('DovetailCutter', input)
      if (head === null || lean === undefined) {
        return null
      }
      const top = input.dc - 2 * head.fluteLength * Math.tan(radians(lean))
      return {
        ...head,
        diameter: Math.max(input.dc, top),
        taperAngleDeg: lean,
        ...optional('cornerRadius', input.g.length('RE')),
      }
    },
  ],
  ['thread mill', threadMill],
])

/**
 * How near `SFDM` a stated `shoulder-diameter` is the shank, mm: a micron. An
 * inch shoulder of 0.37499 against a 0.375 shank is plain shank, as a
 * conversion's or a vendor's rounding leaves it, not a neck a fraction of a
 * micron narrower.
 */
const SHANK_SNAP = 1e-3

/** The tool above its flutes, tip first, and how far it stands out of the holder. */
interface Shaft {
  readonly layers: Array<Cone>
  readonly stickout: number
}

/**
 * What stands above the flutes, tip first, as the kernel stacks it: the rest
 * of a cone the flutes stop short on, as far as `LB`; the length a shoulder
 * adds above that, at its diameter, else the shank's; any explicit shaft
 * segments; then shank (`SFDM`, else `DC`) for whatever of `LB` is left. That
 * stack with the flutes is the kernel's stickout. The shank then runs on to
 * `OAL` where it is stated, so the stack is the whole tool.
 *
 * A shoulder stated by its length alone is shank: usable reach, as plain as
 * the shank above it. One stated within {@link SHANK_SNAP} of `SFDM` is
 * written at `SFDM`. An `OAL` stated below `LB` reads as `LB`.
 */
const shaftOf = (head: Head, segments: ReadonlyArray<Cone>, g: Geometry, dc: number): Shaft => {
  const layers: Array<Cone> = []
  const lb = g.length('LB') ?? 0
  const shank = g.length('SFDM') ?? dc
  let covered = head.fluteLength

  const { diameter, fluteLength, tipDiameter, tipAngleDeg } = head
  const remainder =
    tipDiameter === undefined || tipAngleDeg === undefined
      ? undefined
      : coneRemainder({ diameter, fluteLength, tipDiameter, tipAngleDeg }, lb)
  if (remainder !== undefined) {
    layers.push(remainder)
    covered += remainder.thickness
  }

  const shoulder = (g.length('shoulder-length') ?? 0) - covered
  if (shoulder > 0) {
    const stated = g.length('shoulder-diameter')
    const snapped = stated === undefined || Math.abs(stated - shank) < SHANK_SNAP ? shank : stated
    layers.push(cylinder(snapped, shoulder))
    covered += shoulder
  }

  // One at a time: a spread of an unbounded array overflows the call stack.
  for (const segment of segments) {
    layers.push(segment)
    covered += segment.thickness
  }

  const stickout = Math.max(covered, lb)
  const rest = Math.max(lb, g.length('OAL') ?? 0) - covered
  if (rest > 0) {
    layers.push(cylinder(shank, rest))
  }
  return { layers, stickout }
}

/**
 * How far a disc overhangs what stands directly above it, as the kernel
 * measures it: against the stack below the holder, the `shaft` cut at the
 * stickout, since that is all the kernel stacks.
 */
const undercutReach = (diameter: number, shaft: ReadonlyArray<Cone>): number => {
  const first = shaft.find((layer) => layer.thickness > 0)
  const lip = first === undefined ? diameter : Math.max(first.bottomDiameter, first.topDiameter)
  return Math.max((diameter - lip) / 2, 0)
}

/**
 * What the entry says of the tool beyond its geometry: its hand (`HAND`, true
 * for right), through-coolant (`CSP`) and cutting material (`BMC`, where it
 * names one).
 */
const factsOf = (
  entry: Json,
  geometry: Json,
): Pick<Tool, 'hand' | 'coolantThrough' | 'substrate'> => {
  const hand = own(geometry, 'HAND')
  const coolant = own(geometry, 'CSP')
  const material = text(own(entry, 'BMC'))
  return {
    ...optional(
      'hand',
      typeof hand === 'boolean' ? (hand ? ('right' as const) : ('left' as const)) : undefined,
    ),
    ...optional('coolantThrough', typeof coolant === 'boolean' ? coolant : undefined),
    ...optional('substrate', material === 'unspecified' ? undefined : material),
  }
}

/** Who makes it and how it is listed, and the unit system it was published in. */
const catalogOf = (entry: Json, unit: unknown): Catalog => ({
  ...optional('guid', text(own(entry, 'guid'))),
  ...optional('productLink', text(own(entry, 'product-link'))),
  ...optional('unitSystem', UNIT_SYSTEM.get(unit)),
  ...optional('vendor', text(own(entry, 'vendor'))),
  ...optional('productId', text(own(entry, 'product-id'))),
  ...optional('description', text(own(entry, 'description'))),
})

/**
 * The entry's holder, nose first in its own unit. It takes the shank of the tool
 * it was published with ({@link clampedShank}), a `bore` of that diameter, and
 * no other; with no shank stated, or one assumed, it states no clamping, and
 * takes no tool.
 */
const holderOf = (value: unknown, toolUnit: unknown, tool: Tool | InsertTool): Holder | null => {
  const holder = record(value)
  if (holder === undefined) {
    return null
  }
  // A holder carries its own unit, falling back to the tool's where it states none.
  const unit = own(holder, 'unit')
  const scale = UNIT_SCALE.get(unit ?? toolUnit)
  const layers = scale === undefined ? undefined : segmentsOf(holder, scale)
  if (scale === undefined || layers === undefined || layers.length === 0) {
    return null
  }
  const stated = finite(own(holder, 'gaugeLength') ?? own(holder, 'gauge-length'))
  const gaugeLength = positive(stated === undefined ? undefined : finite(stated * scale))
  const shank = clampedShank({ tool })
  return {
    ...optional('name', text(own(holder, 'description')) ?? text(own(holder, 'product-id'))),
    ...catalogOf(holder, unit ?? toolUnit),
    layers,
    gaugeLength: gaugeLength ?? null,
    ...(shank === null
      ? {}
      : {
          clamping: 'bore' as const,
          boreDiameter: shank.diameter,
          provenance: { clamping: 'derived' as const, boreDiameter: 'derived' as const },
        }),
  }
}

const readEntry = (entry: unknown): RotatingToolAssembly | null => {
  const tool = record(entry)
  const type = own(tool, 'type')
  const geometry = record(own(tool, 'geometry'))
  const scale = UNIT_SCALE.get(own(tool, 'unit'))
  if (
    tool === undefined ||
    geometry === undefined ||
    scale === undefined ||
    typeof type !== 'string'
  ) {
    return null
  }
  const g = geometryOf(geometry, scale)
  const dc = positive(g.length('DC'))
  if (dc === undefined) {
    return null
  }
  const description = text(own(tool, 'description'))
  const input: HeadInput = {
    g,
    scale,
    dc,
    lcf: positive(g.length('LCF')),
    description: description ?? '',
  }

  const insert = type === 'face mill'
  const head = insert ? plain('FaceEndmill', input) : (SOLID_HEADS.get(type)?.(input) ?? null)
  if (head === null || !(head.diameter > 0) || !(head.fluteLength > 0)) {
    return null
  }
  const segments = segmentsOf(own(tool, 'shaft'), scale)
  if (segments === undefined) {
    return null
  }
  const { layers: shaft, stickout } = shaftOf(head, segments, g, dc)
  if (!Number.isFinite(stickout) || !Number.isFinite(stackHeight(shaft))) {
    return null
  }
  // Nobody stated the shank where the entry states no SFDM (zero reads as none), nor the end
  // of the tool where it states no OAL.
  const assumed = {
    ...optional('shank', g.length('SFDM') === undefined ? ('assumed' as const) : undefined),
    ...optional(
      'overallLength',
      positive(g.length('OAL')) === undefined ? ('assumed' as const) : undefined,
    ),
  }
  const provenance = shaft.length > 0 && Object.keys(assumed).length > 0 ? assumed : undefined

  const name = description ?? text(own(tool, 'product-id')) ?? ''
  const nof = g.value('NOF')
  const fluteCount = nof !== undefined && Number.isInteger(nof) && nof > 0 ? nof : undefined
  const catalog = { ...catalogOf(tool, own(tool, 'unit')), ...factsOf(tool, geometry) }

  let cutter: Tool | InsertTool
  if (insert) {
    const taper = g.value('TA')
    cutter = {
      type: 'insert',
      kind: head.kind,
      name,
      ...catalog,
      body: {
        diameter: head.diameter,
        fluteLength: head.fluteLength,
        ...optional('pockets', fluteCount),
      },
      ...optional('shaft', shaft.length > 0 ? shaft : undefined),
      ...optional('provenance', provenance),
      insert: {
        ...optional('cornerRadius', positive(g.length('RE'))),
        ...optional('upperRadius', g.length('upper-radius')),
        // The kernel reads `TA` as the complement of the lead angle.
        ...optional('leadAngleDeg', taper === undefined ? undefined : 90 - taper),
      },
    }
  } else {
    const undercuts = head.kind === 'KeyseatCutter' || head.kind === 'DovetailCutter'
    // A tap's hand is its type's (`tap left hand`), which the kernel reads as the
    // thread's; a `HAND` that disagrees gives way to it, so the two agree.
    const handedness = head.thread?.handedness
    cutter = {
      type: 'solid',
      name,
      ...catalog,
      ...(handedness === undefined || catalog.hand === undefined ? {} : { hand: handedness }),
      ...head,
      ...optional('fluteCount', fluteCount),
      ...optional('shaft', shaft.length > 0 ? shaft : undefined),
      ...optional('provenance', provenance),
      // Read past the head, so the kernel's shaft is not grown by a cone it does not stack.
      ...optional('tipDiameter', head.kind === 'SpotDrill' ? g.length('tip-diameter') : undefined),
      ...optional(
        'undercutReach',
        undercuts
          ? undercutReach(head.diameter, sliceAt(shaft, stickout - head.fluteLength))
          : undefined,
      ),
    }
  }

  const number = finite(own(record(own(tool, 'post-process')), 'number'))
  return {
    tool: cutter,
    holder: holderOf(own(tool, 'holder'), own(tool, 'unit'), cutter),
    collet: null,
    stickout,
    ...optional(
      'number',
      number !== undefined && Number.isSafeInteger(number) && number > 0 ? number : undefined,
    ),
  }
}

/**
 * The assembly one library entry describes, or `null` where it is not a tool
 * this package models or lacks the geometry its kind needs.
 *
 * `stickout` is the kernel's: the flutes and the non-cutting stack it builds
 * above them, which reaches `LB` where the entry states one. The tool's `shaft`
 * is that stack carried on to `OAL`. Never throws.
 */
export const readFusionEntry = (entry: unknown): RotatingToolAssembly | null => {
  try {
    return readEntry(entry)
  } catch {
    // Parsed JSON cannot get here; an object whose getters throw can.
    return null
  }
}

/**
 * One result per `data[]` entry, index-aligned, so a kernel tool imported from
 * entry `i` pairs with result `i`; a hole in the array reads as `null`.
 * Anything without a `data` array reads as no entries. Never throws.
 */
export const readFusionLibrary = (json: unknown): Array<RotatingToolAssembly | null> => {
  try {
    const data = own(record(json), 'data')
    return Array.isArray(data)
      ? Array.from(data as Array<unknown>, (entry) => readFusionEntry(entry))
      : []
  } catch {
    return []
  }
}
