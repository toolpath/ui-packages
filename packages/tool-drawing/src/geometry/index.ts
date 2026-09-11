/**
 * The drawing's geometry, and nothing that needs a browser.
 *
 * This subpath is deliberately free of React and of the DOM so a server can
 * import it — the same reason `@toolpath/part-contracts` is split. A barrel
 * export would drag the renderer into anything that only wanted an outline.
 */

export type { Outline, OutlinePart, OutlinePoint, OutlineSegment } from '../model/outline.js'
export { assemblyOutline } from '../model/outline.js'
export type {
  Provenance,
  ViewerAssembly,
  ViewerHolder,
  ViewerHolderProfile,
  ViewerTool,
} from '../model/types.js'
export { isHolderProfile } from '../model/types.js'
