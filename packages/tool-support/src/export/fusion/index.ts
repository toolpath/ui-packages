/**
 * Writing an Autodesk Fusion tool library.
 *
 * The format is one JSON document — `{ version, data }` — holding tools with
 * their holders embedded, and standalone holders beside them. What each type
 * requires is Autodesk's published schema, reduced into `schema.ts` and held
 * against the original by `pnpm fusion:check-upstream` and
 * `tests/export-fusion-schema.test.ts`.
 */

export {
  FUSION_GUID_PATTERN,
  FUSION_LIBRARY_VERSION,
  FUSION_MATERIALS,
  FUSION_SEGMENT_KEYS,
  FUSION_TYPES,
  FUSION_TYPE_NAMES,
  FUSION_UNITS,
  fusionType,
  type FusionType,
  type FusionTypeRules,
} from './schema.js'
