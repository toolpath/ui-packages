import { webOnly } from '../render/web-only.js'
import type { viewerToolGroups as webToolGroups } from '../viewer-tools.js'

export type {
  ViewerTool,
  ViewerToolGroup,
  ViewerToolGroupId,
  ViewerToolGroupOptions,
} from '../viewer-tools.js'

/**
 * Web-only: each group and tool carries the web toolbar's SVG icon. An app
 * draws its own controls from `useViewerToolbar`, as it does for the toolbar.
 */
export const viewerToolGroups: typeof webToolGroups = () => webOnly('viewerToolGroups')
