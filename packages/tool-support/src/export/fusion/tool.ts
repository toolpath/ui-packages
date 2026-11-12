/**
 * One catalog tool, with or without what holds it, as a Fusion library record.
 *
 * ## The type is a table, at the edge
 *
 * Every kind has a Fusion type (`catalog.ts`'s `CAM_TYPES`), and measured
 * against Autodesk's schema every one of them is a valid Fusion type, so no
 * kind is rounded to the nearest wrong one.
 *
 * ## What Fusion cannot be told
 *
 * A catalog says more than a tool library can hold, and each loss is reported
 * rather than swallowed. Fusion's material vocabulary is five words and has no
 * word for the PCD the scraper reads off Kennametal's diamond families, so that
 * becomes `unspecified` and says so. `GRADE` looks like somewhere to put a
 * vendor's carbide grade and is not — the schema calls it a legacy property
 * that *"doesn't do anything anymore"* and admits two values, neither of them a
 * grade — so it is never written. Provenance, ISO workpiece groups, coating and
 * product line have no counterpart at all.
 */

import type { CuttingTool, RotatingToolAssembly } from '../../model.js'
import type { UnitSystem } from '../../units.js'
import { camIdentity, camType, isoGeometry } from '../catalog.js'
import type { ExportNote } from '../report.js'
import { fusionHolder, type FusionHolder, type FusionSegment } from './holder.js'
import {
  fusionGeometry,
  type FillMode,
  type FusionValue,
  type GeometryRequest,
} from './geometry.js'
import { FUSION_MATERIALS, fusionType } from './schema.js'
import { fusionPresets, type CatalogPreset, type FusionPreset } from './preset.js'

/** Fusion's post-processor block. Seven keys are required; `comment` is not. */
export interface FusionPostProcess {
  readonly 'break-control': boolean
  readonly comment: string
  readonly 'diameter-offset': number
  readonly 'length-offset': number
  readonly live: boolean
  readonly 'manual-tool-change': boolean
  readonly number: number
  readonly turret: number
}

export interface FusionTool {
  readonly type: string
  readonly unit: UnitSystem
  readonly guid: string
  readonly BMC: string
  readonly geometry: Readonly<Record<string, FusionValue>>
  /** The tool above its flutes, below the holder: see `fusionGeometry`'s shaft writer. */
  readonly shaft: { readonly segments: readonly FusionSegment[] }
  readonly 'post-process': FusionPostProcess
  readonly 'start-values': { readonly presets: readonly FusionPreset[] }
  readonly description?: string
  readonly vendor?: string
  readonly 'product-id'?: string
  readonly 'product-link'?: string
  readonly 'tapered-type'?: string
  readonly holder?: FusionHolder
}

/**
 * What a tool, its holder and how far it stands out arrive as.
 *
 * `assembly` carries the stickout and the holder together so a caller that
 * already has a `RotatingToolAssembly` does not take it apart. Fusion requires
 * a guid on an embedded holder as much as on a tool, and this package mints
 * none.
 */
export interface ToolRequest {
  readonly tool: CuttingTool
  /** The holder and the stickout, where the tool is set up in one. */
  readonly assembly?: Pick<RotatingToolAssembly, 'stickout' | 'holder' | 'number'>
  /**
   * The tool's cutting-data presets, stated in the tool's own unit system.
   *
   * Optional, and an empty list is legal — Fusion requires the `start-values`
   * key and not a preset in it. A tool an application has no feeds and speeds
   * for still exports, rather than being left out of the library.
   *
   * **Not converted.** See `preset.ts`: which unit each field uses differs per
   * field, and this package has no units model for feeds and speeds.
   */
  readonly presets?: readonly CatalogPreset[]
  readonly fill?: FillMode
  readonly clamping?: GeometryRequest['clamping']
  readonly policy?: GeometryRequest['policy']
}

export interface ToolResult {
  /** `null` where the tool could not be written. `notes` says why. */
  readonly tool: FusionTool | null
  readonly notes: readonly ExportNote[]
}

/**
 * Fusion's post-processor defaults.
 *
 * Every one is a shop's setting rather than a fact about the tool, and a
 * catalog holds none of them. A tool number of zero is "unassigned", which is
 * what a tool straight out of a vendor catalog is.
 */
const postProcess = (number = 0): FusionPostProcess => ({
  'break-control': false,
  comment: '',
  'diameter-offset': number,
  'length-offset': number,
  live: true,
  'manual-tool-change': false,
  number,
  turret: 0,
})

const MATERIALS: ReadonlySet<string> = new Set(FUSION_MATERIALS)

/** A hair, for comparing a corner radius against half a diameter. */
const EPSILON = 1e-6

/**
 * Which of the two tapered profiles this is, from the corner radius Fusion
 * requires on the same tool.
 *
 * A reading of a stated dimension rather than a guess: a tapered mill whose
 * corner radius is half its cutting diameter is ball-ended by construction, and
 * anything less is a bull nose — of which a zero radius, a flat-ended taper, is
 * the ordinary case. Fusion has only the two words.
 */
const taperedType = (tool: CuttingTool): string | null => {
  const { RE, DC } = isoGeometry(tool)
  if (RE === undefined || DC === undefined) return null
  return RE >= DC / 2 - EPSILON ? 'tapered_ball' : 'tapered_bull_nose'
}

export const fusionTool = (request: ToolRequest): ToolResult => {
  const { tool, assembly, fill = 'derived' } = request
  const identity = camIdentity(tool)
  const notes: ExportNote[] = []
  const note = (kind: ExportNote['kind'], message: string, field?: string): void => {
    notes.push({
      subject: identity?.guid ?? tool.name,
      kind,
      message,
      ...(field === undefined ? {} : { field }),
    })
  }
  if (identity === null) {
    note('skipped', 'the tool states no valid guid, and Fusion requires one', 'guid')
    return { tool: null, notes }
  }

  const type = camType(tool)
  const rules = fusionType(type)
  if (rules === null) {
    note('skipped', `${JSON.stringify(type)} is not a tool type Fusion has`, 'type')
    return { tool: null, notes }
  }

  let holder: FusionHolder | undefined
  let holderGauge: number | null = null
  if (assembly !== undefined && assembly.holder !== null) {
    const written = fusionHolder(assembly.holder)
    notes.push(...written.notes)
    if (written.holder !== null) {
      holder = written.holder
      holderGauge = written.gaugeLength
    }
  }

  const geometry = fusionGeometry({
    tool,
    identity,
    rules,
    stickout: assembly?.stickout ?? null,
    holderGauge,
    fill,
    ...(request.clamping === undefined ? {} : { clamping: request.clamping }),
    ...(request.policy === undefined ? {} : { policy: request.policy }),
  })
  notes.push(...geometry.notes)

  if (geometry.missing.length > 0) {
    note(
      'skipped',
      `Fusion requires ${geometry.missing.join(', ')} for a ${type} and none is stated`,
    )
    return { tool: null, notes }
  }

  let material = 'unspecified'
  if (tool.substrate !== undefined && tool.substrate !== '') {
    if (MATERIALS.has(tool.substrate)) {
      material = tool.substrate
    } else {
      note(
        'coerced',
        `the vendor states a ${JSON.stringify(tool.substrate)} substrate and Fusion knows ` +
          `only ${[...FUSION_MATERIALS].join(', ')}`,
        'BMC',
      )
    }
  }

  let tapered: string | undefined
  if (rules.recordRequired.includes('tapered-type')) {
    const chosen = taperedType(tool)
    if (chosen === null) {
      note('skipped', 'a tapered mill states no corner radius, so its profile is undecidable')
      return { tool: null, notes }
    }
    tapered = chosen
    note('filled', 'read from the corner radius against the cutting diameter', 'tapered-type')
  }

  // The catalog's own words, else the tool's name where it has one.
  const description = tool.description ?? (tool.name === '' ? undefined : tool.name)

  const presets = fusionPresets(identity.guid, type, rules, request.presets ?? [])
  notes.push(...presets.notes)

  return {
    tool: {
      type,
      unit: identity.unit,
      guid: identity.guid,
      BMC: material,
      geometry: geometry.geometry,
      shaft: { segments: geometry.segments },
      'post-process': postProcess(assembly?.number),
      'start-values': { presets: presets.presets },
      ...(description === undefined ? {} : { description }),
      ...(tool.vendor === undefined ? {} : { vendor: tool.vendor }),
      ...(tool.productId === undefined ? {} : { 'product-id': tool.productId }),
      ...(tool.productLink === undefined ? {} : { 'product-link': tool.productLink }),
      ...(tapered === undefined ? {} : { 'tapered-type': tapered }),
      ...(holder === undefined ? {} : { holder }),
    },
    notes,
  }
}
