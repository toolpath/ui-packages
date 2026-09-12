/**
 * Writing a Mastercam tool library.
 *
 * The format is a SQLite database — Mastercam's own 79-table schema, pinned in
 * `mastercam/digest.json` by `pnpm mastercam:adopt` and carried into this
 * package by `schema.generated.ts`. What comes back is the bytes of a
 * `.TOOLDB`, not a file: where they go is the caller's.
 *
 * ```ts
 * const { document, notes } = mastercamLibrary({
 *   holders: [{ guid: holderGuid, holder, label: 'CAT40 ER16' }],
 *   tools: [{ tool, assembly: { holderGuid, stickout: 30 } }],
 * })
 * writeFileSync('shop.TOOLDB', document)
 * ```
 *
 * Nothing here mints a guid for a tool or a holder. `catalog.ts` says why: an
 * identifier invented at export time makes every re-export look to the CAM
 * system like a new tool.
 */

export { mastercamLibrary, type LibraryRequest } from './library.js'

export { mastercamHolder, type CatalogHolder, type HolderResult } from './holder.js'

export {
  mastercamTool,
  type MastercamCuttingData,
  type MastercamToolRequest,
  type ToolResult,
} from './tool.js'

export { rowSet, type RowSet } from './rows.js'

export { guidBytes, guidText, isGuid, EMPTY_GUID } from './guid.js'

export {
  MC_HOLEMAKING,
  MC_RADIUS_TYPE,
  MC_SUBTYPE,
  MC_TOOL_TYPE,
  MC_TOOL_TYPE_COERCED,
} from './schema.js'
