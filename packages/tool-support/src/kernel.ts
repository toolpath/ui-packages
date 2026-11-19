/**
 * Records from the kernel's own description of a tool it planned with.
 *
 * The package does not depend on tp-kernel: {@link KernelToolSummary} mirrors
 * its `ToolSummary` (0.33.0), and {@link KernelToolRecord} its `ToolRecord`,
 * structurally, so a kernel value is accepted as is.
 *
 * The kernel's `ToolHeadTag` has no `SpotDrill`: a spot drill is a `DrillBit`
 * with `is_spot_drill` on the kernel's `Tool`, which its `ToolSummary` does not
 * carry yet. The record keeps it as a kind of its own, `SpotDrill`, and reads
 * {@link KernelToolSummary.isSpotDrill} where a summary supplies it.
 */

import { cylinder } from './cones.js'
import { isInsertKind, type KernelToolKind } from './kinds.js'
import type { Cone, InsertTool, RotatingToolAssembly, Tool } from './model.js'
import { optional } from './optional.js'
import { stackHeight, undercutReach } from './stack.js'

/** tp-kernel's `ToolSummary`. Lengths mm, angles degrees. */
export interface KernelToolSummary {
  readonly name: string
  /** The kernel's content key; meaningful only within one plan. */
  readonly key: string
  readonly kind: KernelToolKind
  /** The swept (cutting) diameter: for a face mill, what its inserts sweep. */
  readonly diameter: number
  readonly fluteLength: number
  /** How far the tool reaches below its holder. */
  readonly stickout: number
  readonly fluteCount: number
  readonly cornerRadius?: number
  readonly roundingRadius?: number
  readonly tipAngleDeg?: number
  readonly threadPitch?: number
  readonly threadHandedness?: 'Right' | 'Left'
  readonly threadProfileDeg?: number
  readonly threadTaperDeg?: number
  readonly undercutReach?: number
  /**
   * A `DrillBit` that only spots and chamfers, never drilling to depth. The
   * shape the kernel is asked to supply: its summary does not carry it yet, so
   * a kernel-made spot drill reads as a `DrillBit` until it does.
   */
  readonly isSpotDrill?: boolean
}

const HANDEDNESS = { Right: 'right', Left: 'left' } as const

const threadOf = (summary: KernelToolSummary): Tool['thread'] | undefined => {
  if (summary.threadPitch === undefined || !(summary.threadPitch > 0)) {
    return undefined
  }
  return {
    pitch: summary.threadPitch,
    ...optional(
      'handedness',
      summary.threadHandedness === undefined ? undefined : HANDEDNESS[summary.threadHandedness],
    ),
    ...optional('profileDeg', summary.threadProfileDeg),
    ...optional('taperDeg', summary.threadTaperDeg),
  }
}

/**
 * What stands out above the flutes: the summary states one diameter, so the
 * record carries it as the shank, from the flutes to the stickout. None where
 * the flutes reach the stickout.
 */
const shaftOf = (summary: KernelToolSummary): Array<Cone> | undefined => {
  const height = summary.stickout - summary.fluteLength
  return height > 0 ? [cylinder(summary.diameter, height)] : undefined
}

/** Both of the shaft's readings, which the kernel does not state. */
const ASSUMED_SHAFT = { shank: 'assumed', overallLength: 'assumed' } as const

/** What the kernel states of a solid tool beyond its kind, diameter, lengths, flutes and shaft. */
type SolidFacts = Partial<
  Pick<
    Tool,
    | 'cornerRadius'
    | 'roundingRadius'
    | 'tipAngleDeg'
    | 'tipDiameter'
    | 'taperAngleDeg'
    | 'undercutReach'
    | 'thread'
  >
>

/** What every kernel-made tool states, whichever of the kernel's descriptions it is read from. */
interface KernelCutter {
  readonly kind: KernelToolKind
  readonly name: string
  /** The swept (cutting) diameter: for a face mill, what its inserts sweep. */
  readonly diameter: number
  readonly fluteLength: number
  /** Zero is not stated. */
  readonly fluteCount: number
  /** From the flutes up; empty where the flutes reach the holder. */
  readonly shaft: ReadonlyArray<Cone>
}

/**
 * The record of a kernel-made tool: a face mill an insert tool, its swept
 * diameter the body's and no lead angle stated, so its `cuttingDiameter` is the
 * kernel's; every other kind a solid tool with `solid`'s facts. A flute count of
 * zero is left out. A shaft is carried with its `shank` and `overallLength`
 * both `assumed`: the kernel's stops at the holder (or is a guess), so neither
 * the clamped shank nor the end of the tool is stated; no shaft, no provenance.
 */
const cutterOf = (
  cutter: KernelCutter,
  solid: SolidFacts = {},
  insert: InsertTool['insert'] = {},
): Tool | InsertTool => {
  const fluteCount = cutter.fluteCount > 0 ? cutter.fluteCount : undefined
  const shaft = cutter.shaft.length > 0 ? cutter.shaft.map((layer) => ({ ...layer })) : undefined
  const provenance = shaft === undefined ? undefined : ASSUMED_SHAFT
  if (isInsertKind(cutter.kind)) {
    return {
      type: 'insert',
      kind: cutter.kind,
      name: cutter.name,
      body: {
        diameter: cutter.diameter,
        fluteLength: cutter.fluteLength,
        ...optional('pockets', fluteCount),
      },
      ...optional('shaft', shaft),
      ...optional('provenance', provenance),
      insert,
    }
  }
  return {
    type: 'solid',
    kind: cutter.kind,
    name: cutter.name,
    diameter: cutter.diameter,
    fluteLength: cutter.fluteLength,
    ...optional('fluteCount', fluteCount),
    ...optional('shaft', shaft),
    ...optional('provenance', provenance),
    ...solid,
  }
}

/**
 * The record of a tool the kernel planned with.
 *
 * The kernel states only the diameter a face mill's inserts sweep, and no lead
 * angle, so its record carries that as the body's diameter with no lead angle
 * stated: its `cuttingDiameter` is the kernel's diameter, and the nominal
 * diameter at the insert seats is not known. The kernel's flute count of zero
 * means it was not stated, and is left out. The summary states one diameter,
 * which the record carries as the shank too: a shaft of that diameter from the
 * flutes to the stickout. The kernel states its cutting diameter and its
 * stickout, not a shank or the end of the tool, so that shaft's `shank` and
 * `overallLength` are both `assumed`: nothing holds it by that shank, and no
 * exporter writes either. A `DrillBit` whose summary states `isSpotDrill` is a
 * `SpotDrill`; tp-kernel's summary does not state it yet, so until it does a
 * kernel-made spot drill reads as a `DrillBit`.
 */
export const toolFromSummary = (summary: KernelToolSummary): Tool | InsertTool =>
  cutterOf(
    {
      kind:
        summary.kind === 'DrillBit' && summary.isSpotDrill === true ? 'SpotDrill' : summary.kind,
      name: summary.name,
      diameter: summary.diameter,
      fluteLength: summary.fluteLength,
      fluteCount: summary.fluteCount,
      shaft: shaftOf(summary) ?? [],
    },
    {
      ...optional('cornerRadius', summary.cornerRadius),
      ...optional('roundingRadius', summary.roundingRadius),
      ...optional('tipAngleDeg', summary.tipAngleDeg),
      ...optional('undercutReach', summary.undercutReach),
      ...optional('thread', threadOf(summary)),
    },
  )

/** The assembly a kernel summary describes: the tool at its stickout, holder and collet unknown. */
export const assemblyFromSummary = (summary: KernelToolSummary): RotatingToolAssembly => ({
  tool: toolFromSummary(summary),
  holder: null,
  collet: null,
  stickout: summary.stickout,
})

/*
 * tp-kernel's `ToolRecord` and `ToolHead` (tp-kernel 0.36.0, experimental; tp-rs #2695),
 * mirrored structurally: what the kernel's `Tool.record()` gives of any tool, its feeds and speeds
 * aside. A record's shape belongs to its kernel release, so it is for mapping to a
 * {@link RotatingToolAssembly} in memory, never for storing: the assembly is what is kept. Its
 * layers are this package's {@link Cone}, which the kernel's `Cone` is field for field.
 */

/** A ball nose endmill. */
export interface KernelToolHeadBallEndmill {
  readonly kind: 'BallEndmill'
  readonly fluteLength: number
  readonly diameter: number
}

/** An endmill ground to a cone, for chamfering. */
export interface KernelToolHeadChamferEndmill {
  readonly kind: 'ChamferEndmill'
  readonly fluteLength: number
  /** Where the cone grows to and the head turns cylindrical. */
  readonly diameter: number
  /** The cone's small end, at the tip: 0 for a sharp point. */
  readonly bottomDiameter: number
  /** The angle of the chamfer it machines: half the cone's included angle. */
  readonly chamferDeg: number
}

/** A mill that grinds a round onto an outside edge. */
export interface KernelToolHeadCornerRoundingMill {
  readonly kind: 'CornerRoundingMill'
  readonly roundingRadius: number
  readonly fluteLength: number
  /** Its diameter at the tip, below the round. */
  readonly bottomDiameter: number
}

/** A countersink. */
export interface KernelToolHeadCountersink {
  readonly kind: 'Countersink'
  readonly fluteLength: number
  readonly diameter: number
  /** The cone's small end, at the tip: 0 for a sharp point. */
  readonly bottomDiameter: number
  /** The cone's included angle. */
  readonly fullConeDeg: number
}

/** A tap's thread, cutting or forming. */
interface KernelTapThread {
  readonly fluteLength: number
  readonly diameter: number
  readonly threadPitch: number
  readonly partialThreads: number
  readonly handedness: 'Right' | 'Left'
  /** The included angle between the thread's flanks. */
  readonly threadProfileDeg: number
  /** The half angle between its pitch cone and its axis: 0 for a straight tap. */
  readonly threadTaperDeg: number
}

/** A tap that cuts thread. */
export interface KernelToolHeadCuttingTap extends KernelTapThread {
  readonly kind: 'CuttingTap'
}

/** A tap that forms thread by displacing material. */
export interface KernelToolHeadFormingTap extends KernelTapThread {
  readonly kind: 'FormingTap'
}

/** A cutter whose flared disc undercuts a dovetail. */
export interface KernelToolHeadDovetailCutter {
  readonly kind: 'DovetailCutter'
  readonly fluteLength: number
  /** The disc's diameter at the tip, its widest. */
  readonly bottomDiameter: number
  /** The disc's diameter at the top of its flutes. */
  readonly topDiameter: number
  readonly cornerRadius: number
}

/** A twist drill, or a spot drill. */
export interface KernelToolHeadDrillBit {
  readonly kind: 'DrillBit'
  readonly fluteLength: number
  readonly diameter: number
  /** Its point's included angle: 180 for a flat bottom. */
  readonly fullConeDeg: number
  readonly isSpotDrill: boolean
}

/** An insert face mill. */
export interface KernelToolHeadFaceEndmill {
  readonly kind: 'FaceEndmill'
  readonly fluteLength: number
  /** The diameter its inserts sweep. */
  readonly diameter: number
  readonly canSideMill: boolean
}

/** A square-cornered endmill. */
export interface KernelToolHeadFlatEndmill {
  readonly kind: 'FlatEndmill'
  readonly fluteLength: number
  readonly diameter: number
}

/** A cutter whose disc on a neck undercuts a slot. */
export interface KernelToolHeadKeyseatCutter {
  readonly kind: 'KeyseatCutter'
  readonly fluteLength: number
  readonly diameter: number
  readonly cornerRadius: number
}

/** A bullnose endmill. */
export interface KernelToolHeadRadiusEndmill {
  readonly kind: 'RadiusEndmill'
  readonly fluteLength: number
  /** The flat of its end: its diameter less two corner radii. */
  readonly bottomDiameter: number
  readonly cornerRadius: number
}

/** The shape a thread mill's tooth comes to. */
export type KernelThreadTip =
  | { readonly kind: 'Point' }
  | { readonly kind: 'Flat'; readonly width: number }
  | { readonly kind: 'Round'; readonly radius: number }

/** A mill that cuts thread by orbiting. */
export interface KernelToolHeadThreadMill {
  readonly kind: 'ThreadMill'
  readonly fluteLength: number
  readonly diameter: number
  /** The bottom of the pitches it cuts: its one pitch for a mill of several teeth. */
  readonly threadPitchMinimum: number
  readonly threadPitchMaximum: number
  readonly threadTip: KernelThreadTip
  readonly threadProfileDeg: number
  readonly threadTaperDeg: number
  /** 1 for a single-point mill. */
  readonly numberOfTeeth: number
}

/** tp-kernel's `ToolHead`: a tool's cutting head, one member per `ToolHeadTag`. */
export type KernelToolHead =
  | KernelToolHeadBallEndmill
  | KernelToolHeadChamferEndmill
  | KernelToolHeadCountersink
  | KernelToolHeadCornerRoundingMill
  | KernelToolHeadThreadMill
  | KernelToolHeadDrillBit
  | KernelToolHeadDovetailCutter
  | KernelToolHeadFlatEndmill
  | KernelToolHeadFaceEndmill
  | KernelToolHeadRadiusEndmill
  | KernelToolHeadFormingTap
  | KernelToolHeadCuttingTap
  | KernelToolHeadKeyseatCutter

/** tp-kernel's `ToolRecord`: one milling tool as plain values. Lengths mm, angles degrees. */
export interface KernelToolRecord {
  readonly name: string
  readonly head: KernelToolHead
  /** The body between the flutes and the holder's nose, the layer on the flutes first. */
  readonly shaft: ReadonlyArray<Cone>
  /** Its holder's outline, nose first, up to the spindle face; null where not known. */
  readonly holder: { readonly layers: ReadonlyArray<Cone> } | null
  /** Zero is not stated. */
  readonly fluteCount: number
}

/** A tap's thread, as the record states it. */
const tapThread = (head: KernelTapThread): NonNullable<Tool['thread']> => ({
  pitch: head.threadPitch,
  partialThreads: head.partialThreads,
  handedness: HANDEDNESS[head.handedness],
  profileDeg: head.threadProfileDeg,
  taperDeg: head.threadTaperDeg,
})

/** A thread mill's tooth tip: the same shape, its form lower-cased. */
const tipOf = (tip: KernelThreadTip): NonNullable<NonNullable<Tool['thread']>['tip']> => {
  switch (tip.kind) {
    case 'Point':
      return { form: 'point' }
    case 'Flat':
      return { form: 'flat', width: tip.width }
    case 'Round':
      return { form: 'round', radius: tip.radius }
  }
}

/** Degrees of an angle given in radians. */
const degrees = (radians: number): number => (radians * 180) / Math.PI

/** What a head states, as the record's kind, swept diameter and solid (or insert) facts. */
type HeadFacts = {
  kind: KernelToolKind
  diameter: number
  solid?: SolidFacts
  insert?: InsertTool['insert']
}

/**
 * Each head's dimensions as the record states them (tp-rs #2695's mapping). Three are worked
 * back: a radius endmill's and a corner rounding mill's diameter from their bottom diameter
 * and radius, and a dovetail's taper from its two diameters over its flutes. A chamfer mill's
 * half angle is stated as its included `tipAngleDeg`. A ball states its
 * corner radius, half its diameter, which the head leaves implied. A keyseat's and a dovetail's
 * `undercutReach` is read against the record's `shaft`, which already stops at the holder's nose,
 * as the Fusion reader reads it against its shaft cut at the stickout ({@link undercutReach}).
 */
const headFacts = (head: KernelToolHead, shaft: ReadonlyArray<Cone>): HeadFacts => {
  switch (head.kind) {
    case 'FlatEndmill':
      return { kind: head.kind, diameter: head.diameter }
    case 'BallEndmill':
      return {
        kind: head.kind,
        diameter: head.diameter,
        solid: { cornerRadius: head.diameter / 2 },
      }
    case 'RadiusEndmill':
      return {
        kind: head.kind,
        diameter: head.bottomDiameter + 2 * head.cornerRadius,
        solid: { cornerRadius: head.cornerRadius },
      }
    case 'FaceEndmill':
      return { kind: head.kind, diameter: head.diameter, insert: { canSideMill: head.canSideMill } }
    case 'ChamferEndmill':
      return {
        kind: head.kind,
        diameter: head.diameter,
        // The record states the half angle; a chamfer mill keeps its included angle, as every
        // reader and exporter here reads it.
        solid: { tipDiameter: head.bottomDiameter, tipAngleDeg: 2 * head.chamferDeg },
      }
    case 'Countersink':
      return {
        kind: head.kind,
        diameter: head.diameter,
        solid: { tipDiameter: head.bottomDiameter, tipAngleDeg: head.fullConeDeg },
      }
    case 'DrillBit':
      return {
        kind: head.isSpotDrill ? 'SpotDrill' : head.kind,
        diameter: head.diameter,
        solid: { tipAngleDeg: head.fullConeDeg },
      }
    case 'CornerRoundingMill':
      return {
        kind: head.kind,
        diameter: head.bottomDiameter + 2 * head.roundingRadius,
        solid: { roundingRadius: head.roundingRadius },
      }
    case 'KeyseatCutter':
      return {
        kind: head.kind,
        diameter: head.diameter,
        solid: {
          cornerRadius: head.cornerRadius,
          undercutReach: undercutReach(head.diameter, shaft),
        },
      }
    case 'DovetailCutter': {
      // Its diameter is the larger of tip and top, as the Fusion import reads one; over no
      // flutes the lean is not defined, and is left out.
      const diameter = Math.max(head.bottomDiameter, head.topDiameter)
      return {
        kind: head.kind,
        diameter,
        solid: {
          cornerRadius: head.cornerRadius,
          undercutReach: undercutReach(diameter, shaft),
          ...optional(
            'taperAngleDeg',
            head.fluteLength > 0
              ? degrees(
                  Math.atan((head.bottomDiameter - head.topDiameter) / (2 * head.fluteLength)),
                )
              : undefined,
          ),
        },
      }
    }
    case 'CuttingTap':
    case 'FormingTap':
      return { kind: head.kind, diameter: head.diameter, solid: { thread: tapThread(head) } }
    case 'ThreadMill':
      return {
        kind: head.kind,
        diameter: head.diameter,
        solid: {
          thread: {
            pitch: head.threadPitchMaximum,
            // A mill of several teeth is ground to one pitch and states no range.
            ...optional('pitchMin', head.numberOfTeeth === 1 ? head.threadPitchMinimum : undefined),
            teeth: head.numberOfTeeth,
            tip: tipOf(head.threadTip),
            profileDeg: head.threadProfileDeg,
            taperDeg: head.threadTaperDeg,
          },
        },
      }
    default: {
      // Exhaustive over this package's mirror (`KernelToolHead`) only. That the mirror matches the
      // kernel's own `ToolHead` is checked where the kernel's types are, in engine-worker.
      const unmapped: never = head
      return unmapped
    }
  }
}

/**
 * The assembly a kernel tool record describes (tp-rs #2695's record → assembly mapping): the
 * tool with the record's shaft, at a stickout of its flutes and that shaft, which stops at the
 * holder's nose. The shaft's \`shank\` and \`overallLength\` are \`assumed\`, as
 * {@link toolFromSummary} marks them: neither the clamped shank nor the end of the tool is
 * stated, and both stay the reader's policy. No collet and no extension: an extension is part
 * of the record's shaft. A holder not known is null; a stated one is its outline alone, its
 * gauge length not known. A record's holder of no layers means nothing holds the tool, and is
 * kept so; the way back must never make one of a model holder that merely states no shape.
 */
export const assemblyFromRecord = (record: KernelToolRecord): RotatingToolAssembly => {
  const { kind, diameter, solid, insert } = headFacts(record.head, record.shaft)
  return {
    tool: cutterOf(
      {
        kind,
        name: record.name,
        diameter,
        fluteLength: record.head.fluteLength,
        fluteCount: record.fluteCount,
        shaft: record.shaft,
      },
      solid,
      insert,
    ),
    holder:
      record.holder === null
        ? null
        : { layers: record.holder.layers.map((layer) => ({ ...layer })), gaugeLength: null },
    collet: null,
    stickout: record.head.fluteLength + stackHeight(record.shaft),
  }
}
