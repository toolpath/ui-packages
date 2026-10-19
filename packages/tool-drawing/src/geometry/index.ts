/**
 * The drawing's geometry, and nothing that needs a browser.
 *
 * This subpath is deliberately free of React and of the DOM so a server can
 * import it — the same reason `@toolpath/part-contracts` is split. A barrel
 * export would drag the renderer into anything that only wanted an outline.
 */

export type { Outline, OutlinePart, OutlinePoint, OutlineSegment } from '../model/outline.js'
export { assemblyOutline } from '../model/outline.js'
/**
 * The zoom is geometry: which extent a sheet is framed to, worked out from the
 * outline and the assembly alone. A server rendering a thumbnail asks for it
 * without pulling in the renderer.
 */
export type { Zoom } from '../model/zoom.js'
export { HOLDER_HEADROOM, extentFor } from '../model/zoom.js'
export type {
  Provenance,
  ViewerAssembly,
  ViewerHolder,
  ViewerHolderProfile,
  ViewerTool,
} from '../model/types.js'
export { isHolderProfile } from '../model/types.js'
