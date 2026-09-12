/**
 * Writing an Autodesk Fusion tool library.
 *
 * The format is one JSON document — `{ version, data }` — holding tools with
 * their holders embedded, and standalone holders beside them. What each type
 * requires is Autodesk's published schema, reduced into `schema.ts` and held
 * against the original by `pnpm fusion:check-upstream` and
 * `tests/export-fusion-schema.test.ts`.
 *
 * ```ts
 * const { document, notes } = fusionLibrary({ tools: [{ tool, assembly }] })
 * writeFileSync('shop.tools', fusionLibraryJson(document))
 * ```
 *
 * Nothing here writes a file, and nothing mints a guid — Fusion requires one on
 * every entry, and one invented at export time would make each re-export look
 * to Fusion like a new tool.
 */

export {
  fusionLibrary,
  fusionLibraryJson,
  sanitizeName,
  type FusionLibrary,
  type LibraryRequest,
} from './library.js'

export {
  fusionTool,
  type FusionPostProcess,
  type FusionTool,
  type ToolRequest,
  type ToolResult,
} from './tool.js'

export {
  fusionHolder,
  type CatalogHolder,
  type FusionHolder,
  type FusionSegment,
  type HolderResult,
} from './holder.js'

export {
  fusionPresets,
  type CatalogPreset,
  type FusionPreset,
  type PresetResult,
  type PresetValue,
} from './preset.js'

export {
  FILL_CONSTANTS,
  exported,
  fusionGeometry,
  type FillMode,
  type FusionValue,
  type GeometryRequest,
  type GeometryResult,
} from './geometry.js'

export {
  ALL_MATERIALS,
  FUSION_GEOMETRY_KINDS,
  FUSION_PRESET_KINDS,
  FUSION_PRESET_MATERIAL_REQUIRED,
  isPresetFloat,
  type FusionPresetConditional,
  type FusionPresetKind,
  type FusionPresetMaterial,
  FUSION_GUID_PATTERN,
  FUSION_LIBRARY_VERSION,
  FUSION_MATERIALS,
  FUSION_SEGMENT_KEYS,
  FUSION_TYPES,
  FUSION_TYPE_NAMES,
  FUSION_UNITS,
  fusionType,
  fusionValueKind,
  type FusionType,
  type FusionTypeRules,
  type FusionValueKind,
} from './schema.js'
