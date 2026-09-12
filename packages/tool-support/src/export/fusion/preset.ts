/**
 * Cutting-data presets — the feeds and speeds a tool arrives at a CAM system
 * already knowing.
 *
 * ## Carried, not computed
 *
 * What a tool's feeds and speeds *should be* is a machining model: a chip load
 * per material, a surface speed, a depth of cut, and a shop's own opinion about
 * all three. This package has none of that and is not acquiring it — the
 * decision belongs where the material is known, which is the application. So a
 * preset arrives from the caller and this module's whole job is to check it
 * against the type it is going on and report what it finds.
 *
 * ## Five shapes, not one
 *
 * The thing that makes the check worth having: **Autodesk states a preset's
 * shape per tool type, and the shapes are not variations on one another.** A
 * milling preset requires seventeen fields. A tap's requires six and models
 * nine in total — it has no feedrate at all, because a tap is fed by its own
 * pitch. A drill states a feed per revolution and no cutting feedrate; a spot
 * drill, which most applications generate through the same code path as a
 * drill, additionally requires five feedrates a drill does not model.
 *
 * An application that writes one preset shape onto every tool therefore ships
 * records that are silently short of what Fusion demands, and nothing says so
 * until the library will not load. {@link fusionPresets} is what says so.
 *
 * ## Units are the caller's
 *
 * A preset's numbers are stated in the tool's own unit system, and which unit
 * each field uses differs per field: `v_c` is metres or feet per minute, `v_f`
 * is millimetres or inches per minute, `f_z` is a length per tooth. **Nothing
 * here converts them.** This package has no units model for feeds and speeds,
 * and converting a field whose unit had been guessed would be a wrong number
 * that looks right — the failure the whole tree is organised against.
 *
 * So the contract is that presets arrive in the same unit system as the tool
 * they go on. It is the one place in this exporter where a caller can be wrong
 * and nothing will notice, which is why it is said here, on the type, and in
 * the README rather than left implied.
 */

import type { ExportNote } from '../report.js'
import {
  ALL_MATERIALS,
  FUSION_PRESET_MATERIAL_REQUIRED,
  type FusionPresetMaterial,
  type FusionTypeRules,
} from './schema.js'

/** A value as it appears in a preset. */
export type PresetValue = number | boolean | string | FusionPresetMaterial

/**
 * A preset as a caller holds one.
 *
 * Open on purpose: the field roster is Autodesk's and differs per tool type, so
 * naming them here would be a third copy of a table that already exists twice —
 * in `schema.ts` and in the digest it is checked against. What is named is what
 * every shape requires whatever the type.
 */
export interface CatalogPreset {
  /**
   * The preset's own identifier.
   *
   * Required, and the exporter mints none — the rule {@link CatalogTool.guid}
   * keeps and for the same reason. Autodesk's schema requires it while also
   * documenting that an omitted one is auto-populated on import; requiring it
   * is the reading that keeps a re-export stable, because an auto-populated
   * guid is a new one every time.
   */
  readonly guid: string
  readonly name: string
  /** The material band. Defaulted to {@link ALL_MATERIALS} when absent. */
  readonly material?: FusionPresetMaterial
  readonly [field: string]: PresetValue | undefined
}

/** A preset as Fusion holds one. */
export type FusionPreset = Readonly<Record<string, PresetValue>>

export interface PresetResult {
  readonly presets: readonly FusionPreset[]
  readonly notes: readonly ExportNote[]
}

/**
 * Fields every shape models and this package does not write.
 *
 * `stock-materials` and `strategies` narrow *when* a preset applies — to a
 * named stock, or to particular toolpath strategies — which is a shop's
 * decision about its own library rather than anything a catalog states. A
 * caller that has them may pass them; they are simply never invented.
 */
const APPLICABILITY = ['stock-materials', 'strategies'] as const

/**
 * Check a caller's presets against the type they are going on, and report
 * everything that does not fit.
 *
 * Three outcomes, and the middle one is the point:
 *
 *   * a field the type does not model is **dropped** with a note — legal, since
 *     a preset item is open, but Fusion will not show it, so silently keeping
 *     it would be a number nobody ever sees;
 *   * a preset short of a field the type requires is **skipped** with a note
 *     naming every missing field;
 *   * everything else is written.
 *
 * **A bad preset never sinks the tool.** It is dropped and the tool exports with
 * whatever presets are valid, including none: `presets: []` is legal, and a tool
 * with no feeds is still a usable tool where a tool that vanished is not.
 */
export const fusionPresets = (
  subject: string,
  form: string,
  rules: FusionTypeRules,
  presets: readonly CatalogPreset[],
): PresetResult => {
  const notes: ExportNote[] = []
  const written: FusionPreset[] = []
  const allowed = new Set<string>([...rules.presetAllowed, ...APPLICABILITY])

  for (const preset of presets) {
    const field = (name: string): string => `start-values.presets[${preset.name}].${name}`
    const out: Record<string, PresetValue> = {}

    for (const [name, value] of Object.entries(preset)) {
      if (value === undefined) continue
      if (allowed.has(name)) {
        out[name] = value
      } else {
        notes.push({
          subject,
          kind: 'dropped',
          field: field(name),
          message: `a ${form}'s preset does not model ${name}, so Fusion would never show it`,
        })
      }
    }

    // The material band says which stock a preset is for. Absent is not a
    // narrower band, it is no restriction at all — a convention, so it is
    // supplied rather than reported missing.
    if (out.material === undefined) {
      out.material = ALL_MATERIALS
    } else {
      const stated = out.material as unknown as Record<string, unknown>
      const short = FUSION_PRESET_MATERIAL_REQUIRED.filter((key) => stated[key] === undefined)
      if (short.length > 0) {
        out.material = { ...ALL_MATERIALS, ...(stated as Partial<FusionPresetMaterial>) }
        notes.push({
          subject,
          kind: 'filled',
          field: field('material'),
          message: `the material band states no ${short.join(', ')}; the all-materials band does`,
        })
      }
    }

    const missing = rules.presetRequired.filter((name) => out[name] === undefined)

    // Autodesk's own `if`/`then`: a switch that, once set, demands fields of its
    // own. Per type, because the same switch asks for different things in
    // different places — `use-feed-per-revolution` wants a retract feed on a
    // drill and lead-in and lead-out feeds on a turning tool.
    for (const rule of rules.presetConditionals) {
      if (out[rule.field] !== rule.equals) continue
      for (const name of rule.requires) {
        if (out[name] === undefined && !missing.includes(name)) missing.push(name)
      }
    }

    if (missing.length > 0) {
      notes.push({
        subject,
        kind: 'skipped',
        field: field('*'),
        message:
          `Fusion requires ${[...missing].sort().join(', ')} on a ${form}'s preset and this ` +
          `one states none — the preset is left out and the tool keeps the rest`,
      })
      continue
    }

    written.push(out)
  }

  return { presets: written, notes }
}
