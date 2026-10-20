import type { MeasureToolProps } from './measure-tool.js'

export type { MeasureLabelKind, MeasureToolProps } from './measure-tool.js'

/** The class every measurement label carries, kept so styling code shares one name. */
export const MEASURE_LABEL_CLASS = 'toolpath-measure-label'

/**
 * Web-only: the measure tool's labels and keyboard modes are DOM. Rendering it
 * on React Native says so rather than drawing nothing.
 */
export const MeasureTool = (_props: MeasureToolProps): never => {
  throw new Error('@toolpath/viewer: MeasureTool is not available on React Native.')
}
