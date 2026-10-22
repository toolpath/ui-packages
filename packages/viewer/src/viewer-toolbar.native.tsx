import type { ViewerToolbar as WebToolbar } from './viewer-toolbar.js'

export type { ViewerToolbarControlsProps, ViewerToolbarProps } from './viewer-toolbar.js'
export {
  ViewerToolbarProvider,
  useViewerToolbar,
  type ViewerToolbarControl,
  type ViewerToolbarControls,
} from './viewer-toolbar-context.js'

const unavailable = (name: string) => (): never => {
  throw new Error(`@toolpath/viewer: ${name} is not available on React Native.`)
}

/**
 * Every member of the web toolbar, stubbed. Checked against the web's own, so a
 * new web button without a stub here fails to type-check.
 */
const members = {
  Controls: unavailable('ViewerToolbar.Controls'),
  Divider: unavailable('ViewerToolbar.Divider'),
  StockButton: unavailable('ViewerToolbar.StockButton'),
  AxesButton: unavailable('ViewerToolbar.AxesButton'),
  GridButton: unavailable('ViewerToolbar.GridButton'),
  BananaButton: unavailable('ViewerToolbar.BananaButton'),
  ToolsButton: unavailable('ViewerToolbar.ToolsButton'),
  DirectionsButton: unavailable('ViewerToolbar.DirectionsButton'),
  DfmButton: unavailable('ViewerToolbar.DfmButton'),
  SharpCornersButton: unavailable('ViewerToolbar.SharpCornersButton'),
  ThreadsButton: unavailable('ViewerToolbar.ThreadsButton'),
  HoverButton: unavailable('ViewerToolbar.HoverButton'),
  FocusButton: unavailable('ViewerToolbar.FocusButton'),
  WireframeButton: unavailable('ViewerToolbar.WireframeButton'),
  SectionButton: unavailable('ViewerToolbar.SectionButton'),
  MeasureButton: unavailable('ViewerToolbar.MeasureButton'),
  FitButton: unavailable('ViewerToolbar.FitButton'),
  ResetButton: unavailable('ViewerToolbar.ResetButton'),
  TopButton: unavailable('ViewerToolbar.TopButton'),
} satisfies Record<keyof typeof WebToolbar, unknown>

/**
 * Web-only: the toolbar is DOM buttons and CSS. Its context is not — an app
 * draws its own controls from `useViewerToolbar` — so that is exported as on
 * the web, and the toolbar and every one of its parts throw.
 */
export const ViewerToolbar = Object.assign(unavailable('ViewerToolbar'), members)
