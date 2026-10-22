import type { MeasureToolProps } from './measure-tool.js'

export type { MeasureLabelKind, MeasureToolProps } from './measure-tool.js'

/**
 * Web-only: the measure tool's labels and keyboard modes are DOM. Rendering it
 * on React Native says so rather than drawing nothing.
 */
export const MeasureTool = (_props: MeasureToolProps): never => {
  throw new Error('@toolpath/viewer: MeasureTool is not available on React Native.')
}
