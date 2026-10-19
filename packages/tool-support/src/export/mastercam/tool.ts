/**
 * A catalog tool as Mastercam's eight rows.
 *
 * One tool is a `TlAssemblyItem` (what it is called, who made it), a `TlTool`
 * (its number and the legacy record), a `TlToolMill` (the geometry), one
 * subtype row, and a small stack of operation defaults. They share the tool's
 * guid as their key, which is what makes a re-export update a tool rather than
 * add one.
 *
 * ## Everything here is inches
 *
 * The format has no metric mode. The reference library holds 1.5 mm end mills
 * as `0.059055118110235505` and sets `IsMetric` to 0 on all 176 of its items,
 * so a metric tool is converted on the way in and the flag says nothing about
 * it. This domain is millimetres throughout, so every length crosses exactly
 * once, here.
 *
 * ## The one conversion that is not a length
 *
 * `TP` is the hazard `geometry.ts` records and does not resolve: on a metric
 * tap it is a pitch in millimetres, and on an inch tap it is conventionally
 * *threads per inch*, which is a reciprocal. Converting the second as a length
 * gives a number that looks like a pitch and is wrong by a factor of its own
 * value. {@link threadPitch} reads the tool's own unit system to decide which
 * it has, which is the first place in this tree that hazard actually bites.
 */

import { convertLength } from '../../units.js'
import type { ExportNote } from '../report.js'
import type { CatalogTool } from '../catalog.js'
import { derivedGuid, guidBytes, namedGuid, EMPTY_GUID } from './guid.js'
import { legacyToolRecord } from './legacy.js'
import type { RowSet } from './rows.js'
import {
  MASTERCAM_DEFAULT_GRADE,
  MASTERCAM_MATERIALS,
  MC_HOLEMAKING,
  MC_NO_TAPER,
  MC_RADIUS_CLASS,
  MC_RADIUS_TYPE,
  MC_SUBTYPE,
  MC_TOOL_TYPE,
  MC_TOOL_TYPE_COERCED,
} from './schema.js'

/** What Mastercam stores of a tool's cutting data, and nothing else. */
export interface MastercamCuttingData {
  /** Revolutions per minute. */
  readonly spindleSpeed?: number
  /** Length per minute, in the tool's own unit system. */
  readonly feedRate?: number
  readonly plungeRate?: number
  readonly retractRate?: number
}

/**
 * One tool set up in one holder.
 *
 * A tool can have several. Mastercam's schema keeps `TlAssembly` apart from
 * `TlTool` so that one tool row can be the `MainTool` of more than one
 * assembly, and `TlAssemblyComponent`'s key — `(TlAssemblyID, TlAssemblyItemID)`
 * — only makes sense if an item appears in several.
 */
export interface MastercamSetup {
  readonly holderGuid: string
  /** Tool tip to holder nose, in millimetres. `null` is nobody having decided. */
  readonly stickout: number | null
  /**
   * The carousel position for *this* set-up.
   *
   * A tool number belongs to the set-up rather than to the tool: the reference
   * library holds one ball nose twice, numbered 9 in the crib and 107 in the
   * machine. Falls back to the tool's own number where a caller states none.
   */
  readonly number?: number
  /**
   * The assembly's own identifier, where a shop tracks one.
   *
   * Derived from the tool and the holder when absent, which is stable across
   * re-exports — the rule `catalog.ts` keeps. Two set-ups of one tool in one
   * holder at different stickouts need one stated, because the derivation
   * cannot tell them apart.
   */
  readonly guid?: string
}

export interface MastercamToolRequest {
  readonly tool: CatalogTool
  /** Every holder this tool is set up in. */
  readonly assemblies?: readonly MastercamSetup[]
  readonly cuttingData?: MastercamCuttingData
}

export interface ToolResult {
  /** `null` where the tool could not be written. `notes` says why. */
  readonly written: { readonly guid: string; readonly overallLength: number } | null
  readonly notes: readonly ExportNote[]
}

/**
 * The point angle given to a drill whose vendor published none.
 *
 * A drill with no point angle is drawn flat-bottomed, which is a different
 * tool. 118° is the classic general-purpose grind and the reference library
 * uses it, so it is the least surprising thing to supply — and it is supplied
 * loudly, as a `filled` note, because it is this package's number and not the
 * vendor's.
 */
const ASSUMED_POINT_ANGLE = 118

/** The lead chamfer the reference writes on every reamer. */
const REAMER_LEAD_ANGLE = 45

const inches = (millimetres: number): number => convertLength(millimetres, 'millimeters', 'inches')

/**
 * A tap's pitch in inches, and the threads-per-inch the legacy record wants.
 *
 * `null` where the tool states no `TP` at all.
 */
const threadPitch = (tool: CatalogTool): { pitch: number; perInch: number } | null => {
  const stated = tool.geometry['TP']
  if (stated === undefined || !(stated > 0)) return null
  // An inch tap's TP is already threads per inch. A metric tap's is a pitch in
  // millimetres, which converts as the length it is.
  if (tool.unit === 'inches') return { pitch: 1 / stated, perInch: stated }
  const pitch = inches(stated)
  return { pitch, perInch: 1 / pitch }
}

/** The operation-parameter rows a tool's defaults live in. */
const writeOpParams = (
  rows: RowSet,
  guid: string,
  data: MastercamCuttingData,
  unit: CatalogTool['unit'],
  holemaking: boolean,
): Uint8Array => {
  const id = derivedGuid(guid, 'op-params')
  const coolant = derivedGuid(guid, 'coolant')
  rows.addOnce('TlCoolant', guid, {
    ID: coolant,
    OldStyle: 0,
    Flood: 0,
    FloodPos: 0,
    Mist: 0,
    MistPos: 0,
    Tool: 0,
    ToolPos: 0,
    ...Object.fromEntries(
      Array.from({ length: 7 }, (_, at) => [
        [`Custom${at + 1}`, 0],
        [`Custom${at + 1}Pos`, 0],
      ]).flat(),
    ),
  })
  // Feed rates are lengths per minute, so they cross units the way a length
  // does. Spindle speed does not.
  const rate = (value: number | undefined): number =>
    value === undefined ? 0 : unit === 'inches' ? value : inches(value)
  rows.addOnce('TlOpParams', guid, {
    ID: id,
    MaterialSFMAdjust: 1,
    MaterialFPTAdjust: 1,
    FeedRate: rate(data.feedRate),
    RetractRate: rate(data.retractRate),
    SpindleSpeed: Math.round(data.spindleSpeed ?? 0),
    PlungeRate: rate(data.plungeRate),
    TlCoolantID: coolant,
    IsMetric: 0,
  })
  if (holemaking) {
    rows.addOnce('TlHolemakingOpParams', guid, {
      ID: id,
      CannedCycleType: 0,
      Peck1: 0,
      Peck2: 0,
      PeckClear: 0,
      ChipBreak: 0,
      Dwell: 0,
    })
  } else {
    rows.addOnce('TlMillingOpParams', guid, {
      ID: id,
      IsRough: 1,
      IsFinish: 1,
      StepoverRoughXY: 0,
      StepoverRoughZ: 0,
      StepoverFinishXY: 0,
      StepoverFinishZ: 0,
    })
  }
  return id
}

/**
 * The tool type and its radius columns, reconciled.
 *
 * `MCToolType` and `TlToolEndmill.TlRadiusType` are not independent. Across the
 * reference library the pairing is fixed and exceptionless — flat with none,
 * ball with full, bull with corner, corner-rounder with rounder — and no row
 * pairs a flat end mill with a radius of any kind. Deriving the type from the
 * catalog's `form` and the radius from its `RE` separately produces
 * combinations Mastercam never writes, and one of them is what a real catalog
 * actually hits: a flat end mill carrying a corner radius, which is a bull nose
 * somebody named loosely.
 *
 * These decisions stack with the form coercion above it: a face mill reaches
 * `Endmill1 Flat` by its silhouette and a stated corner radius then moves it on
 * to `Endmill3 Bull`, which is two notes describing one journey. Neither names
 * the catalog's own word for the tool, because by this point it may already
 * have been traded away.
 *
 * **Geometry wins over the name.** A stated corner radius promotes a flat end
 * mill to a bull nose; a type that cannot hold a radius drops it rather than
 * writing one beside a `TlRadiusType` of none; and a type whose radius is its
 * defining feature, given none, falls back to what can actually be drawn — a
 * bull nose to a flat end mill, and a corner rounder to nothing at all, because
 * a corner rounder is its radius and there is no cylinder to draw instead.
 */
const resolveRadius = (
  mcToolType: number,
  cuttingDiameter: number,
  stated: number,
):
  | {
      readonly kind: 'written'
      readonly mcToolType: number
      readonly radiusType: number
      readonly cornerRadius: number
      readonly note: { readonly kind: ExportNote['kind']; readonly message: string } | null
    }
  | { readonly kind: 'skipped'; readonly message: string } => {
  if (mcToolType === MC_TOOL_TYPE['ball end mill']) {
    // A ball nose's corner radius is half its diameter by definition, so it is
    // derived and not taken: a catalog that states no `RE` still gets the
    // radius its own type promises, rather than a full radius of zero.
    return {
      kind: 'written',
      mcToolType,
      radiusType: MC_RADIUS_TYPE.full,
      cornerRadius: stated > 0 ? stated : cuttingDiameter / 2,
      note: null,
    }
  }
  if (mcToolType === MC_TOOL_TYPE['radius mill']) {
    if (!(stated > 0)) {
      return {
        kind: 'skipped',
        message:
          'a corner rounder is its radius and the catalog states none, so there is no solid ' +
          'to draw',
      }
    }
    return {
      kind: 'written',
      mcToolType,
      radiusType: MC_RADIUS_TYPE.rounder,
      cornerRadius: stated,
      note: null,
    }
  }
  if (mcToolType === MC_TOOL_TYPE['bull nose end mill']) {
    if (!(stated > 0)) {
      return {
        kind: 'written',
        mcToolType: MC_TOOL_TYPE['flat end mill'],
        radiusType: MC_RADIUS_TYPE.none,
        cornerRadius: 0,
        note: {
          kind: 'coerced',
          message:
            'no corner radius is stated, so this is written as the flat end mill its numbers ' +
            'describe',
        },
      }
    }
    return {
      kind: 'written',
      mcToolType,
      radiusType: MC_RADIUS_TYPE.corner,
      cornerRadius: stated,
      note: null,
    }
  }
  if (mcToolType === MC_TOOL_TYPE['flat end mill'] && stated > 0) {
    return {
      kind: 'written',
      mcToolType: MC_TOOL_TYPE['bull nose end mill'],
      radiusType: MC_RADIUS_TYPE.corner,
      cornerRadius: stated,
      note: {
        kind: 'coerced',
        message:
          'a stated corner radius makes this a bull nose — Mastercam pairs no flat end ' +
          'mill with a radius',
      },
    }
  }
  return {
    kind: 'written',
    mcToolType,
    radiusType: MC_RADIUS_TYPE.none,
    cornerRadius: 0,
    note:
      stated > 0
        ? {
            kind: 'dropped',
            message: 'this tool type carries no corner radius, so the stated one is not written',
          }
        : null,
  }
}

/**
 * Write one tool, or say why it could not be written.
 *
 * A tool is skipped rather than approximated when Mastercam's legacy vocabulary
 * has no code that draws its shape, or when the catalog states no diameter or
 * no overall length — a tool without either is not a solid.
 */
export const mastercamTool = (request: MastercamToolRequest, rows: RowSet): ToolResult => {
  const { tool } = request
  const notes: ExportNote[] = []
  const subject = tool.guid
  const note = (kind: ExportNote['kind'], field: string, message: string): void => {
    notes.push({ subject, kind, field, message })
  }

  const confirmed = (MC_TOOL_TYPE as Partial<Record<string, number>>)[tool.form]
  const coerced = MC_TOOL_TYPE_COERCED[tool.form as keyof typeof MC_TOOL_TYPE_COERCED]
  const formType = confirmed ?? coerced?.to
  if (formType === undefined) {
    notes.push({
      subject,
      kind: 'skipped',
      message:
        `Mastercam's legacy tool types have no code that draws a ${tool.form}, and ` +
        `writing it as a cylinder would put the wrong solid in a simulation`,
    })
    return { written: null, notes }
  }
  if (coerced !== undefined) {
    note('coerced', 'MCToolType', coerced.because)
  }

  const { DC, OAL, LCF, SFDM, NOF, RE, SIG } = tool.geometry
  const shoulderLength = tool.geometry['shoulder-length']
  const shoulderDiameter = tool.geometry['shoulder-diameter']
  if (DC === undefined || OAL === undefined) {
    notes.push({
      subject,
      kind: 'skipped',
      message: `the catalog states no ${DC === undefined ? 'cutting diameter' : 'overall length'}`,
    })
    return { written: null, notes }
  }

  // Read from the form's own type. The only promotion below is flat to bull
  // nose, which stays in the endmill family and on the milling side, so
  // neither of these moves with it.
  const subtype = MC_SUBTYPE[formType]
  const holemaking = MC_HOLEMAKING.has(formType)
  const thread = threadPitch(tool)
  const radius = resolveRadius(formType, DC, subtype === 'endmill' ? (RE ?? 0) : 0)
  if (radius.kind === 'skipped') {
    notes.push({ subject, kind: 'skipped', message: radius.message })
    return { written: null, notes }
  }
  const { mcToolType, radiusType, cornerRadius } = radius
  if (radius.note !== null) note(radius.note.kind, 'MCToolType', radius.note.message)

  // Every decision that can refuse the tool is made before a single row is
  // written: a refusal after the item row would leave an assembly item with no
  // tool under it, which is worse than the tool being absent.
  const id = guidBytes(tool.guid)
  // `TlTool.ToolNumber`, the offsets and the legacy record can each hold one
  // number, so a tool set up in two carousel positions states the first here
  // and the rest on their own `TlAssembly` rows.
  const numbers = (request.assemblies ?? []).map((setup) => setup.number ?? tool.number ?? 0)
  const number = numbers[0] ?? tool.number ?? 0
  if (numbers.some((each) => each !== number)) {
    note(
      'dropped',
      'TlTool.ToolNumber',
      `the tool is set up at more than one carousel position and this row states ${number}; ` +
        `each assembly carries its own`,
    )
  }

  const materials = MASTERCAM_MATERIALS()
  let material: Uint8Array = EMPTY_GUID
  const substrate = tool.substrate?.toLowerCase()
  if (substrate !== undefined) {
    if (substrate.includes('carbide')) material = guidBytes(materials.carbide)
    else if (substrate.includes('hss') || substrate.includes('high speed')) {
      material = guidBytes(materials.hss)
    } else {
      material = guidBytes(materials.carbide)
      note(
        'coerced',
        'TlToolMaterialID',
        `Mastercam knows only carbide and HSS, so ${tool.substrate} is written as carbide`,
      )
    }
  }

  const manufacturer = tool.vendor === undefined ? EMPTY_GUID : namedGuid(tool.vendor)
  rows.addOnce('TlAssemblyItem', tool.guid, {
    ID: id,
    CatalogID: tool.catalogNumber ?? '',
    GeometryFile: '',
    IsMetric: 0,
    Location: '',
    TlToolMaterialID: material,
    TlToolTypeID: EMPTY_GUID,
    TlManufacturerID: manufacturer,
    Name: tool.label ?? tool.catalogNumber ?? tool.guid,
    Description: tool.description ?? '',
    Quantity: 0,
    ThruCoolant: tool.coolantThrough === true ? 1 : 0,
    IsCatalogItem: 0,
    GaugeLength: 0,
    GaugeDiameter: 0,
    TlGraphicsFileCollectionID: derivedGuid(tool.guid, 'graphics'),
    ModelFileID: EMPTY_GUID,
    MachineSideConnectionID: derivedGuid(tool.guid, 'connection'),
    WorkpieceSideConnectionMapID: derivedGuid(tool.guid, 'connection-map'),
    MachineSideProjectionAdjustment: 0,
    IsProjectionAdjustmentEditable: 0,
  })
  // A connection needs a locator, and a locator is an identity transform: this
  // exporter writes tools coaxial with their holders, which is every milling
  // assembly.
  const locator = derivedGuid(tool.guid, 'locator')
  rows.addOnce('TlLocator', tool.guid, {
    ID: locator,
    IsMetric: 0,
    r00: 1,
    r01: 0,
    r02: 0,
    r10: 0,
    r11: 1,
    r12: 0,
    r20: 0,
    r21: 0,
    r22: 1,
    t0: 0,
    t1: 0,
    t2: 0,
  })
  rows.addOnce('TlConnection', tool.guid, {
    ID: derivedGuid(tool.guid, 'connection'),
    Type: '',
    Size: '',
    LocatorID: locator,
    IsRound: 0,
    Thickness: 0,
    Width: 0,
    Name: '',
  })

  // A tapered cutter carries its included angle here; everything else carries
  // 180, which is what the reference writes for "not tapered".
  const tapered = mcToolType === MC_TOOL_TYPE['chamfer mill'] || mcToolType === 21
  const taperAngle = tapered ? (SIG ?? MC_NO_TAPER) : MC_NO_TAPER
  if (tapered && SIG === undefined) {
    note('dropped', 'TaperAngle', 'the catalog states no included angle, so the taper is not drawn')
  }

  let pointAngle = SIG ?? 0
  if (subtype === 'drill' && SIG === undefined) {
    pointAngle = ASSUMED_POINT_ANGLE
    note(
      'filled',
      'TipAngle',
      `the catalog states no point angle, so ${ASSUMED_POINT_ANGLE}° was supplied by this package`,
    )
  }

  rows.addOnce('TlTool', tool.guid, {
    ID: id,
    OpToolInfo: legacyToolRecord({
      toolNumber: number,
      mcToolType,
      radiusClass: MC_RADIUS_CLASS[radiusType] ?? 0,
      diameter: inches(DC),
      cornerRadius: inches(cornerRadius),
      threadsPerInch: thread?.perInch ?? 0,
      taperAngle,
      diameterOffset: number,
      lengthOffset: number,
      feedRate: 0,
      plungeRate: 0,
      retractRate: 0,
      spindleSpeed: Math.round(request.cuttingData?.spindleSpeed ?? 0),
      fluteCount: NOF ?? 0,
      name: tool.label ?? tool.catalogNumber ?? tool.guid,
    }),
    ToolNumber: number,
    ToolStation: 0,
    IsCustom: 0,
    CustomDisplayType: 0,
    TlAccessoryCollectionID: derivedGuid(tool.guid, 'accessories'),
  })

  const shank = SFDM ?? DC
  rows.addOnce('TlToolMill', tool.guid, {
    ID: id,
    MCToolType: mcToolType,
    DiameterOffsetNum: number,
    LengthOffsetNum: number,
    OverallLength: inches(OAL),
    ShoulderLength: inches(shoulderLength ?? LCF ?? OAL),
    CuttingDepth: inches(LCF ?? 0),
    OverallDiameter: inches(DC),
    ArborDiameter: inches(shank),
    ShoulderDiameter: inches(shoulderDiameter ?? DC),
    // No taper on the shank, so no taper length — and `TlShankType` tracks
    // exactly that in the reference, never the presence of a neck.
    TlShankType: 0,
    TaperLength: 0,
    NeckDiameter: inches(shoulderDiameter ?? DC),
    FluteCount: NOF ?? 0,
    TlSpindleDir: 0,
    // This domain carries no helix angle, and the reference pairs a zero angle
    // with a zero type on every tool that has none.
    TlHelixType: 0,
    HelixAngle: 0,
    RequiredPilotDiameter: 0,
    IsVariablePitch: 0,
    IsScalable: 0,
    MfgToolCode: tool.catalogNumber ?? '',
    Chuck: '',
    ToolFileName: '',
    TlGradeID: guidBytes(MASTERCAM_DEFAULT_GRADE()),
    TlOpParamsID: writeOpParams(rows, tool.guid, request.cuttingData ?? {}, tool.unit, holemaking),
    IsAcceleratedFinishing: 0,
  })

  switch (subtype) {
    case 'endmill':
      rows.addOnce('TlToolEndmill', tool.guid, {
        ID: id,
        TipDiameter: 0,
        TaperAngle: taperAngle,
        TlRadiusType: radiusType,
        CornerRadius: inches(cornerRadius),
        ChamferLength: 0,
      })
      break
    case 'drill':
      rows.addOnce('TlToolDrill', tool.guid, {
        ID: id,
        TipAngle: pointAngle,
        ShoulderAngle: 0,
        CornerRadius: 0,
      })
      break
    case 'reamer':
      rows.addOnce('TlToolReamer', tool.guid, {
        ID: id,
        TipAngle: REAMER_LEAD_ANGLE,
        ChamferLength: 0,
      })
      break
    case 'threading':
      if (thread === null) {
        note('dropped', 'ThreadPitch', 'the catalog states no thread pitch')
      }
      rows.addOnce('TlToolThreading', tool.guid, {
        ID: id,
        TipDiameter: 0,
        TipAngle: 0,
        TlRadiusType: 0,
        CornerRadius: 0,
        ThreadPitch: thread?.pitch ?? 0,
        TlThreadShape: 0,
        RootDiameter: 0,
        // The reference writes a zero thread angle and a single start on every
        // tap it holds, rather than the 60° a UN thread actually has.
        ThreadAngle: 0,
        NStarts: 1,
      })
      break
    default:
      break
  }

  if (tool.vendor !== undefined) {
    rows.addOnce('TlManufacturer', tool.vendor, {
      ID: manufacturer,
      Name: tool.vendor,
      Description: tool.productLink ?? '',
    })
  }

  return { written: { guid: tool.guid, overallLength: inches(OAL) }, notes }
}
