import type { MeasureToolProps } from '../measure-tool.js'
import { webOnly } from '../render/web-only.js'

export type { MeasureToolProps } from '../measure-tool.js'

/**
 * Web-only: the measure tool's labels, hover caption, pointer and keys are
 * DOM. Rendering it on React Native says so rather than drawing nothing.
 */
export const MeasureTool = (_props: MeasureToolProps): never => webOnly('MeasureTool')
