/**
 * Reading an Autodesk Fusion tool library — the inverse of
 * `@toolpath/tool-support/export/fusion`.
 *
 * Each tool entry becomes a `Tool` with every length in millimetres, ready for
 * `fitTools`, beside the guid and `data[]` index that lead back to the original
 * JSON. Holders are skipped. See `tool.ts` for what is converted, what is
 * supplied, and the quirks of Fusion's own JSON.
 *
 * ```ts
 * const { tools, notes } = fromFusionLibrary(JSON.parse(library.toJson()))
 * const fits = fitTools(tools.map((entry) => entry.tool), demands)
 * ```
 *
 * Nothing here reads a file.
 */

export { fromFusionLibrary, type FusionLibraryEntry, type FusionLibraryImport } from './library.js'

export { fromFusionTool, type FusionImport, type ImportNote } from './tool.js'
