import { createContext, useContext } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons.js'

/** One action a toolbar button can read and invoke. */
export interface ViewerToolbarControl {
  /** Whether a toggle-style control is currently active. */
  pressed?: boolean
  /** Invoked when the control is clicked. */
  onClick: () => void
}

/**
 * The state and actions that toolbar controls read from their enclosing
 * {@link ViewerToolbarProvider}.
 *
 * Controls are optional so an application can expose only the buttons it
 * renders. Rendering a button without its matching control is an error.
 */
export interface ViewerToolbarControls {
  stock?: ViewerToolbarControl
  axes?: ViewerToolbarControl
  grid?: ViewerToolbarControl
  banana?: ViewerToolbarControl
  directions?: ViewerToolbarControl
  hover?: ViewerToolbarControl
  focus?: ViewerToolbarControl
  wireframe?: ViewerToolbarControl
  section?: ViewerToolbarControl
  measure?: ViewerToolbarControl
  fit?: ViewerToolbarControl
  reset?: ViewerToolbarControl
  top?: ViewerToolbarControl
}

const ViewerToolbarContext = createContext<ViewerToolbarControls | null>(null)

/** Supplies viewer state and callbacks to a toolbar and its compound controls. */
export const ViewerToolbarProvider = ({
  controls,
  children,
}: PropsWithChildren<{ controls: ViewerToolbarControls }>) => (
  <ViewerToolbarContext.Provider value={controls}>{children}</ViewerToolbarContext.Provider>
)

/**
 * Read the state and callbacks configured for the enclosing viewer toolbar.
 *
 * Use this to build a toolbar control with an application's own component kit.
 */
export const useViewerToolbar = (): ViewerToolbarControls => {
  const controls = useContext(ViewerToolbarContext)
  if (!controls) throw new Error('useViewerToolbar must be used inside <ViewerToolbarProvider>')
  return controls
}

interface ToolbarButtonProps {
  action: keyof ViewerToolbarControls
  icon: ToolbarIconName
  label: (pressed: boolean) => string
  toggle?: boolean
}

const buttonName = (action: keyof ViewerToolbarControls): string =>
  `${action.slice(0, 1).toUpperCase()}${action.slice(1)}Button`

const ToolbarButton = ({ action, icon, label, toggle = true }: ToolbarButtonProps) => {
  const control = useViewerToolbar()[action]
  if (!control) {
    throw new Error(`<ViewerToolbar.${buttonName(action)}> requires a '${action}' toolbar control`)
  }

  const pressed = control.pressed ?? false
  return (
    <button
      className="viewer-toolbar-button"
      data-viewer-toolbar-action={action}
      type="button"
      aria-label={label(pressed)}
      aria-pressed={toggle ? pressed : undefined}
      onClick={control.onClick}
    >
      <ToolbarIcon name={icon} />
      <span className="viewer-toolbar-tooltip" data-viewer-toolbar-tooltip="true" role="tooltip">
        {label(pressed)}
      </span>
    </button>
  )
}

const StockButton = () => (
  <ToolbarButton
    action="stock"
    icon="stock"
    label={(pressed) => (pressed ? 'Hide stock' : 'Show stock')}
  />
)
const AxesButton = () => (
  <ToolbarButton
    action="axes"
    icon="axes"
    label={(pressed) => (pressed ? 'Hide axis' : 'Show axis')}
  />
)
const GridButton = () => (
  <ToolbarButton
    action="grid"
    icon="grid"
    label={(pressed) => (pressed ? 'Hide grid' : 'Show grid')}
  />
)
const BananaButton = () => (
  <ToolbarButton
    action="banana"
    icon="banana"
    label={(pressed) => (pressed ? 'Banana for scale (on)' : 'Banana for scale')}
  />
)
const DirectionsButton = () => (
  <ToolbarButton
    action="directions"
    icon="directions"
    label={() => 'Highlight faces by direction'}
  />
)
const HoverButton = () => (
  <ToolbarButton
    action="hover"
    icon="hover"
    label={(pressed) => (pressed ? 'Disable feature hover' : 'Enable feature hover')}
  />
)
const FocusButton = () => (
  <ToolbarButton
    action="focus"
    icon="focus"
    label={(pressed) => (pressed ? 'Show full part' : 'Focus selection')}
  />
)
const WireframeButton = () => (
  <ToolbarButton action="wireframe" icon="wireframe" label={() => 'Wireframe'} />
)
const SectionButton = () => (
  <ToolbarButton
    action="section"
    icon="section"
    label={(pressed) => (pressed ? 'Exit section' : 'Section')}
  />
)
const MeasureButton = () => (
  <ToolbarButton
    action="measure"
    icon="measure"
    label={(pressed) => (pressed ? 'Exit measure' : 'Measure')}
  />
)
const FitButton = () => <ToolbarButton action="fit" icon="fit" label={() => 'Fit'} toggle={false} />
const ResetButton = () => (
  <ToolbarButton action="reset" icon="reset" label={() => 'Reset'} toggle={false} />
)
const TopButton = () => (
  <ToolbarButton action="top" icon="top" label={() => 'Top view'} toggle={false} />
)

/** A visual separator between toolbar control groups. */
const Divider = () => <span className="viewer-toolbar-divider" data-viewer-toolbar-divider="true" />

export interface ViewerToolbarControlsProps extends PropsWithChildren {
  /** Added to the standard toolbar control group. */
  className?: string
}

/** Groups controls into the standard styled toolbar surface. */
const Controls = ({ children, className }: ViewerToolbarControlsProps) => (
  <div
    className={['viewer-toolbar', className].filter(Boolean).join(' ')}
    data-viewer-toolbar-controls="true"
    role="group"
    aria-label="Viewer controls"
  >
    {children}
  </div>
)

const DefaultControls = () => {
  const controls = useViewerToolbar()
  const display = [
    controls.stock ? <StockButton key="stock" /> : null,
    controls.axes ? <AxesButton key="axes" /> : null,
    controls.grid ? <GridButton key="grid" /> : null,
    controls.banana ? <BananaButton key="banana" /> : null,
  ].filter(Boolean)
  const analysis = [
    controls.directions ? <DirectionsButton key="directions" /> : null,
    controls.hover ? <HoverButton key="hover" /> : null,
    controls.focus ? <FocusButton key="focus" /> : null,
    controls.wireframe ? <WireframeButton key="wireframe" /> : null,
    controls.section ? <SectionButton key="section" /> : null,
    controls.measure ? <MeasureButton key="measure" /> : null,
  ].filter(Boolean)
  const camera = [
    controls.fit ? <FitButton key="fit" /> : null,
    controls.reset ? <ResetButton key="reset" /> : null,
    controls.top ? <TopButton key="top" /> : null,
  ].filter(Boolean)

  return (
    <Controls>
      {display}
      {display.length && analysis.length ? <Divider /> : null}
      {analysis}
      {(display.length || analysis.length) && camera.length ? <Divider /> : null}
      {camera}
    </Controls>
  )
}

export interface ViewerToolbarProps {
  /** Added to the outer toolbar stack, beside `viewer-toolbar-stack`. */
  className?: string
  /**
   * Toolbar contents. Omit this for the standard control order, or compose
   * `ViewerToolbar.Controls` with the individual button components.
   */
  children?: ReactNode
}

/**
 * A viewer-scoped toolbar. It reads state and callbacks from
 * {@link ViewerToolbarProvider}; it never owns application behavior itself.
 */
const ViewerToolbarRoot = ({ className, children }: ViewerToolbarProps) => {
  useViewerToolbar()
  return (
    <div
      className={['viewer-toolbar-stack', className].filter(Boolean).join(' ')}
      data-viewer-toolbar="true"
    >
      {children ?? <DefaultControls />}
    </div>
  )
}

export const ViewerToolbar = Object.assign(ViewerToolbarRoot, {
  Controls,
  Divider,
  StockButton,
  AxesButton,
  GridButton,
  BananaButton,
  DirectionsButton,
  HoverButton,
  FocusButton,
  WireframeButton,
  SectionButton,
  MeasureButton,
  FitButton,
  ResetButton,
  TopButton,
})
