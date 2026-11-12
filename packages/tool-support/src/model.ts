/**
 * The tool record every Toolpath app and package shares, stated once as Zod
 * schemas: each type is the schema's own (`z.infer`), and the field docs are
 * its `.describe()`s, so a service that publishes the record and an app that
 * reads it cannot disagree about it.
 *
 * Only the fields something reads are here, under names rather than ISO 13399
 * codes: a CAM library's codes stay in its reader (`import/fusion`). Every length
 * is in millimetres and every angle in degrees, whatever unit the source used.
 */

import { z } from 'zod'

import { TOOL_KINDS } from './kinds.js'
import { PROVENANCE } from './provenance.js'
import { UNIT_SYSTEMS } from './units.js'

/**
 * One layer of a stacked revolved outline: a frustum along the tool axis. A
 * stack lists its nose (tip side) layer first, each layer sitting on top of
 * the one before it.
 */
export const ConeSchema = z.object({
  thickness: z.number().describe('Layer height in mm.'),
  bottomDiameter: z.number().describe('Diameter at the lower end in mm.'),
  topDiameter: z.number().describe('Diameter at the upper end in mm.'),
})
export type Cone = z.infer<typeof ConeSchema>

/** Who makes something and how they list it, spread into each record that has a maker. */
const catalog = {
  guid: z
    .string()
    .optional()
    .describe(
      'The record’s stable identifier, where the catalog keeps one; a CAM export needs it.',
    ),
  vendor: z.string().optional().describe('The manufacturer, where the source states one.'),
  productId: z
    .string()
    .optional()
    .describe('The manufacturer’s part number, where the source states one.'),
  orderNumber: z
    .string()
    .optional()
    .describe('The manufacturer’s order number, where it differs from its part number.'),
  productLine: z
    .string()
    .optional()
    .describe('The manufacturer’s product line or series, where the source states one.'),
  productLink: z.string().optional().describe('Where the manufacturer lists it.'),
  description: z
    .string()
    .optional()
    .describe('The catalog’s own description, where the source states one.'),
  unitSystem: z
    .enum(UNIT_SYSTEMS)
    .optional()
    .describe(
      'The system the manufacturer published it in: decides how a number is rounded and shown, ' +
        'never the unit it is stored in, which is always mm.',
    ),
}
export const CatalogSchema = z.object(catalog)
export type Catalog = z.infer<typeof CatalogSchema>

const kind = z
  .enum(TOOL_KINDS)
  .describe('What the tool is, as tp-kernel names its head kinds (`ToolHeadTag`).')
const name = z.string().describe('What the tool is called.')
const shaft = z
  .array(ConeSchema)
  .optional()
  .describe(
    'The body above the flutes to the end of the tool, tip end first, as the kernel stacks it; ' +
      'absent is not stated. Its top layer is the shank a holder clamps.',
  )

/**
 * Where each stated value came from, keyed by the record's own field names. A
 * key with no entry is nobody having said, not a claim of `vendor-stated`.
 *
 * On a tool, `shank` and `overallLength` are the only keys that are not
 * fields: the shaft's top diameter and the flutes with the shaft's height, the
 * two readings of the stack. `assumed` on either is a reader's guess there.
 */
const provenance = z
  .record(z.string(), z.enum(PROVENANCE))
  .optional()
  .describe('Where each value came from, keyed by field name; an absent key is nobody having said.')

/** The ISO 513 workpiece groups: steel, stainless, cast iron, non-ferrous, superalloys, hardened. */
export const ISO_MATERIAL_GROUPS = ['P', 'M', 'K', 'N', 'S', 'H'] as const
export type IsoMaterialGroup = (typeof ISO_MATERIAL_GROUPS)[number]

/** A shank's form (ISO 1835): plain, with a Weldon flat, or with a Whistle Notch. */
export const SHANK_FORMS = ['plain', 'weldon', 'whistle-notch'] as const
export type ShankForm = (typeof SHANK_FORMS)[number]

/** What a catalog says of any cutting tool beyond its geometry. */
const cutter = {
  hand: z
    .enum(['right', 'left'])
    .optional()
    .describe(
      'The hand of cut, the way the flutes turn; absent is nobody having said. A tap’s thread ' +
        'hand is `thread.handedness`, which the kernel reads.',
    ),
  coolantThrough: z.boolean().optional().describe('Whether coolant runs through the tool.'),
  substrate: z
    .string()
    .optional()
    .describe('The cutting material, in the manufacturer’s own word: `carbide`, `hss`.'),
  materialGroups: z
    .array(z.enum(ISO_MATERIAL_GROUPS))
    .optional()
    .describe('The ISO 513 workpiece groups the manufacturer says it cuts.'),
  provenance,
}

export const ToolSchema = z
  .object({
    type: z.literal('solid').describe('A solid tool: one ground body, flutes and shank.'),
    kind,
    name,
    ...catalog,
    ...cutter,
    diameter: z
      .number()
      .describe(
        'The cutting head’s largest diameter, mm. For a chamfer mill or countersink, the top of ' +
          'its cone, which the flutes may stop short of.',
      ),
    fluteLength: z.number().describe('Axial length that cuts, from the tip, mm.'),
    drillDepth: z
      .number()
      .optional()
      .describe(
        'A drill’s deepest hole, mm (Kennametal’s `L4 max`): short of its flutes, which need ' +
          'room to clear chips.',
      ),
    fluteCount: z.number().int().optional().describe('How many flutes it has.'),
    shaft,
    shankForm: z
      .enum(SHANK_FORMS)
      .optional()
      .describe(
        'The shank’s form (ISO 1835): plain, a Weldon flat or a Whistle Notch; absent is nobody ' +
          'having said.',
      ),
    shankClampMin: z
      .number()
      .optional()
      .describe('The least of the shank the manufacturer wants clamped, mm (ISO 13399 `LSCN`).'),
    cornerRadius: z
      .number()
      .optional()
      .describe('The round on a bull nose’s corner, or half a ball’s diameter, mm.'),
    roundingRadius: z.number().optional().describe('The round a corner rounding mill cuts, mm.'),
    tipAngleDeg: z
      .number()
      .optional()
      .describe('Included point angle of a drill, countersink or chamfer mill, degrees.'),
    tipDiameter: z
      .number()
      .optional()
      .describe(
        'The small end of a chamfer mill’s, countersink’s or spot drill’s cone, mm: 0 for a ' +
          'sharp point.',
      ),
    undercutReach: z
      .number()
      .optional()
      .describe('How far a keyseat or dovetail cutter’s disc overhangs its neck, mm.'),
    taperAngleDeg: z
      .number()
      .optional()
      .describe(
        'Angle of a flank to the tool axis, degrees (Fusion’s `TA`): a dovetail’s lean, a ' +
          'tapered mill’s taper, a centre drill’s countersink half angle.',
      ),
    tipLength: z
      .number()
      .optional()
      .describe(
        'Length of the tip below the cutting edge, mm (Fusion’s `tip-length`): a corner ' +
          'rounding mill’s pilot below its round, a centre drill’s pilot.',
      ),
    thread: z
      .object({
        pitch: z
          .number()
          .describe(
            'Axial distance between threads, mm: for a single-point thread mill, the top of its ' +
              'range.',
          ),
        pitchMin: z
          .number()
          .optional()
          .describe(
            'The bottom of a single-point thread mill’s pitch range, mm (Fusion’s `TPN`); absent ' +
              'for a mill of several teeth.',
          ),
        teeth: z
          .number()
          .int()
          .optional()
          .describe('How many teeth a thread mill has (Fusion’s `NT`): 1 for a single-point mill.'),
        tip: z
          .discriminatedUnion('form', [
            z.object({ form: z.literal('point') }),
            z.object({ form: z.literal('flat'), width: z.number().describe('Its width, mm.') }),
            z.object({ form: z.literal('round'), radius: z.number().describe('Its radius, mm.') }),
          ])
          .optional()
          .describe(
            'A thread mill’s tooth tip (Fusion’s `thread-tip-type`), which decides the root of ' +
              'the thread it cuts.',
          ),
        partialThreads: z
          .number()
          .optional()
          .describe(
            'Threads ground away at a tap’s nose, its lead: how far past the thread’s end it ' +
              'must run.',
          ),
        handedness: z
          .enum(['right', 'left'])
          .optional()
          .describe('The hand a tap cuts, which the kernel reads; a thread mill has none.'),
        profileDeg: z
          .number()
          .optional()
          .describe('Included angle between the thread’s flanks, degrees.'),
        taperDeg: z
          .number()
          .optional()
          .describe(
            'Half angle of the thread’s pitch cone to the axis, degrees: 0 for a straight thread.',
          ),
      })
      .optional()
      .describe('The thread a tap or thread mill cuts.'),
  })
  .describe('A solid cutting tool: one ground body, flutes and the `shaft` above them.')
/** A solid cutting tool: one ground body, flutes and the `shaft` above them. */
export type Tool = z.infer<typeof ToolSchema>

export const InsertToolSchema = z
  .object({
    type: z.literal('insert').describe('A tool that cuts with indexable inserts on a body.'),
    kind,
    name,
    ...catalog,
    ...cutter,
    body: z
      .object({
        diameter: z
          .number()
          .describe(
            'Nominal diameter, mm (Fusion’s `DC`): where the inserts seat, before any growth over ' +
              'the lead angle. The diameter it cuts at is `cuttingDiameter` (`DCX`); a tool the ' +
              'kernel made states the diameter it sweeps here and no lead angle, so ' +
              '`cuttingDiameter` is that figure.',
          ),
        fluteLength: z.number().describe('Axial length that cuts, from the tip, mm.'),
        pockets: z.number().int().optional().describe('How many insert pockets it has.'),
      })
      .describe('The body the inserts sit on.'),
    shaft,
    insert: z
      .object({
        cornerRadius: z.number().optional().describe('The insert’s corner radius, mm.'),
        leadAngleDeg: z
          .number()
          .optional()
          .describe(
            'Angle of the cutting edge to the feed direction, degrees: 90 for a square shoulder.',
          ),
        upperRadius: z
          .number()
          .optional()
          .describe(
            'The round at the top of the insert’s cutting edge, mm (Fusion’s `upper-radius`).',
          ),
        designation: z
          .string()
          .optional()
          .describe('The insert’s ISO designation, as the catalog states it.'),
        canSideMill: z
          .boolean()
          .optional()
          .describe(
            'Whether the inserts reach down the periphery to cut a wall; absent is nobody having ' +
              'said.',
          ),
      })
      .describe('The inserts, as far as the source states them.'),
  })
  .describe('A tool that cuts with indexable inserts on a body, its arbor the `shaft` above it.')
/** A tool that cuts with indexable inserts on a body, its arbor the `shaft` above it. */
export type InsertTool = z.infer<typeof InsertToolSchema>

export const CuttingToolSchema = z
  .discriminatedUnion('type', [ToolSchema, InsertToolSchema])
  .describe(
    'The cutting tool, solid or insert, told apart by `type`; either states what stands above ' +
      'its flutes as one cone stack, `shaft`.',
  )
/**
 * A cutting tool, solid or insert, told apart by `type`; either states what
 * stands above its flutes as one cone stack, `shaft`, which `stack.ts` reads.
 */
export type CuttingTool = z.infer<typeof CuttingToolSchema>

/**
 * How a holder grips: through a collet, or in a bore of its own. Each bore
 * grips its own shank forms: a side lock needs a Weldon flat or a Whistle
 * Notch, a milling chuck or a hydraulic chuck takes a plain or a Weldon shank,
 * and a shrink fit a plain one. `bore` is the generic, where the source does not
 * say which, and grips any. Through a reduction sleeve the sleeve's rule holds,
 * not the holder's: any form but a Whistle Notch.
 */
export const CLAMPINGS = [
  'bore',
  'collet',
  'shrink-fit',
  'hydraulic',
  'side-lock',
  'milling-chuck',
] as const
export type Clamping = (typeof CLAMPINGS)[number]

export const HolderSchema = z
  .object({
    name: z.string().optional().describe('What the holder is called.'),
    ...catalog,
    layers: z.array(ConeSchema).describe('The holder’s outline, nose (tool side) layer first.'),
    gaugeLength: z
      .number()
      .nullable()
      .describe('Spindle gauge line to the holder nose, mm; null where it is not known.'),
    clamping: z
      .enum(CLAMPINGS)
      .optional()
      .describe('How it grips the tool; absent is nobody having said, and takes no tool.'),
    colletSeries: z
      .string()
      .optional()
      .describe('For a collet holder, the collet series it takes, such as `ER16`.'),
    boreDiameter: z
      .number()
      .optional()
      .describe(
        'For a holder that grips in its own bore, the one shank diameter it takes, mm: not an ' +
          'upper bound. A sleeve this wide takes the shanks its clamp range covers.',
      ),
    boreDepth: z
      .number()
      .optional()
      .describe('How deep a shank can go into the bore, mm: a tool sits no deeper.'),
    clampLength: z
      .number()
      .optional()
      .describe(
        'Axial length of shank the holder itself grips, mm (the vendor’s `L9`); a collet ' +
          'holder’s grip is its collet’s.',
      ),
    taper: z
      .string()
      .optional()
      .describe(
        'The spindle interface, such as `BT30`: a holder fits only the machine that takes it.',
      ),
    colletProtrusion: z
      .number()
      .optional()
      .describe('How far the seated collet stands proud of the nose face, mm.'),
    faceContact: z
      .boolean()
      .optional()
      .describe('Whether it seats on the spindle face as well as the taper.'),
    coolantThrough: z.boolean().optional().describe('Whether coolant runs through it to the tool.'),
    provenance,
  })
  .describe('A tool holder as a revolved outline.')
/** A tool holder as a revolved outline. */
export type Holder = z.infer<typeof HolderSchema>

/**
 * What a collet is: a plain one, one sealed for coolant through the tool, a
 * tap collet, or a reduction sleeve for a holder's bore.
 */
export const COLLET_KINDS = ['standard', 'coolant-through', 'tap', 'sleeve'] as const
export type ColletKind = (typeof COLLET_KINDS)[number]

export const ColletSchema = z
  .object({
    series: z.string().describe('The collet series, such as `ER32`; a sleeve’s own series name.'),
    ...catalog,
    kind: z
      .enum(COLLET_KINDS)
      .optional()
      .describe('What the collet is; absent is nobody having said.'),
    clampMin: z.number().describe('Smallest shank it clamps, mm.'),
    clampMax: z.number().describe('Largest shank it clamps, mm.'),
    clampLength: z
      .number()
      .optional()
      .describe(
        'Axial length of shank it grips, mm; absent where unpublished, which leaves no honest ' +
          'maximum stickout.',
      ),
    squareSize: z
      .number()
      .optional()
      .describe(
        'The square drive a tap collet grips, across flats, mm: such a collet takes only a tap.',
      ),
    outerDiameter: z
      .number()
      .optional()
      .describe('The bore it sits in, mm; a sleeve states one, and fits a holder bored to it.'),
    provenance,
  })
  .describe('A collet: what clamps a shank in a collet chuck, or a sleeve in a bore.')
/** A collet: what clamps a shank in a collet chuck, or a sleeve in a bore. */
export type Collet = z.infer<typeof ColletSchema>

export const ExtensionSchema = z
  .object({
    name: z.string().optional().describe('What the extension is called.'),
    ...catalog,
    systemSize: z
      .string()
      .describe('The modular coupling a cutting head screws in by, such as `DL10`.'),
    shankForm: z
      .enum(SHANK_FORMS)
      .optional()
      .describe(
        'The shank’s form (ISO 1835): plain, a Weldon flat or a Whistle Notch; absent is nobody ' +
          'having said.',
      ),
    layers: z
      .array(ConeSchema)
      .describe(
        'Its outline over its whole length, head end (tool side) first: a vendor’s reduced neck ' +
          '(L2/D2) is the first layer, the shank the rest, the top layer’s top diameter the ' +
          'shank a collet or bore clamps. Empty states no shape.',
      ),
    provenance,
  })
  .describe('A modular extension a cutting head screws onto; what the holder clamps.')
/** A modular extension a cutting head screws onto; what the holder clamps. */
export type Extension = z.infer<typeof ExtensionSchema>

export const RotatingToolAssemblySchema = z
  .object({
    tool: CuttingToolSchema,
    holder: HolderSchema.nullable().describe('What holds the tool; null where it is not known.'),
    collet: ColletSchema.nullable().describe(
      'The collet clamping the tool; null where there is none or it is not known.',
    ),
    stickout: z.number().describe('Tool tip to the holder face, mm.'),
    extension: ExtensionSchema.optional().describe(
      'The extension the head is screwed onto, where there is one; absent is none or not known.',
    ),
    extensionProtrusion: z
      .number()
      .optional()
      .describe(
        'The extension’s head face to the holder face, mm, where an extension is present: the ' +
          'head stands out of the extension by `stickout − extensionProtrusion`. Greater than ' +
          'zero and less than `stickout`; a value outside that states no place and is not ' +
          'swept or drawn.',
      ),
    number: z.number().int().optional().describe('The shop’s tool (T) number, where it is stated.'),
  })
  .describe(
    'A tool as it is put in the spindle: the tool, what holds it, and how far it stands out.',
  )
/** A tool as it is put in the spindle: the tool, what holds it, and how far it stands out. */
export type RotatingToolAssembly = z.infer<typeof RotatingToolAssemblySchema>

export const ToolLibrarySchema = z
  .object({
    tools: z.array(CuttingToolSchema).describe('The cutting tools.'),
    holders: z.array(HolderSchema).describe('The holders.'),
    collets: z.array(ColletSchema).describe('The collets and sleeves.'),
    extensions: z
      .array(ExtensionSchema)
      .optional()
      .describe(
        'The modular extensions; optional, so a library from before they were carried still ' +
          'parses, and absent is none.',
      ),
  })
  .describe(
    'A catalog’s contents: its tools, holders, collets and extensions. Which of a plan’s ' +
      'libraries one is is the serving API’s to say.',
  )
/** A catalog's contents: its tools, holders, collets and extensions. */
export type ToolLibrary = z.infer<typeof ToolLibrarySchema>
