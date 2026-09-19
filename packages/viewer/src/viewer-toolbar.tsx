import type { ReactNode } from 'react'
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons.js'

interface ToolbarButtonProps {
  icon: ToolbarIconName
  label: string
  pressed?: boolean
  onClick: () => void
}

const ToolbarButton = ({ icon, label, pressed, onClick }: ToolbarButtonProps) => (
  <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick}>
    <ToolbarIcon name={icon} />
    <span className="toolbar-tooltip" role="tooltip">
      {label}
    </span>
  </button>
)

export interface BananaButtonProps {
  /** Whether the banana for scale is currently shown. */
  shown: boolean
  onClick: () => void
}

/** The viewer toolbar control for showing a banana beside a 3D part. */
export const BananaButton = ({ shown, onClick }: BananaButtonProps) => (
  <ToolbarButton
    icon="banana"
    label={shown ? 'Banana for scale (on)' : 'Banana for scale'}
    pressed={shown}
    onClick={onClick}
  />
)

export interface ViewerToolbarProps {
  stock: boolean
  axes: boolean
  grid: boolean
  banana?: boolean
  directions: boolean
  hover: boolean
  focus: boolean
  wireframe: boolean
  sectioning: boolean
  measuring: boolean
  onFit: () => void
  onReset: () => void
  onTop: () => void
  onStock: () => void
  onAxes: () => void
  onGrid: () => void
  onBanana?: () => void
  onDirections: () => void
  onHover: () => void
  onFocus: () => void
  onWireframe: () => void
  onSection: () => void
  onMeasure: () => void
  children?: ReactNode
}

/** The standard toolbar for the viewer's camera, display, and analysis controls. */
export const ViewerToolbar = (props: ViewerToolbarProps) => (
  <div className="viewer-toolbar-stack">
    {props.children}
    <div className="viewer-toolbar" role="group" aria-label="Viewer controls">
      <ToolbarButton
        icon="stock"
        label={props.stock ? 'Hide stock' : 'Show stock'}
        pressed={props.stock}
        onClick={props.onStock}
      />
      <ToolbarButton
        icon="axes"
        label={props.axes ? 'Hide axis' : 'Show axis'}
        pressed={props.axes}
        onClick={props.onAxes}
      />
      <ToolbarButton
        icon="grid"
        label={props.grid ? 'Hide grid' : 'Show grid'}
        pressed={props.grid}
        onClick={props.onGrid}
      />
      {props.onBanana ? (
        <BananaButton shown={props.banana ?? false} onClick={props.onBanana} />
      ) : null}
      <span className="toolbar-divider" />
      <ToolbarButton
        icon="directions"
        label="Highlight faces by direction"
        pressed={props.directions}
        onClick={props.onDirections}
      />
      <ToolbarButton
        icon="hover"
        label={props.hover ? 'Disable feature hover' : 'Enable feature hover'}
        pressed={props.hover}
        onClick={props.onHover}
      />
      <ToolbarButton
        icon="focus"
        label={props.focus ? 'Show full part' : 'Focus selection'}
        pressed={props.focus}
        onClick={props.onFocus}
      />
      <ToolbarButton
        icon="wireframe"
        label="Wireframe"
        pressed={props.wireframe}
        onClick={props.onWireframe}
      />
      <ToolbarButton
        icon="section"
        label={props.sectioning ? 'Exit section' : 'Section'}
        pressed={props.sectioning}
        onClick={props.onSection}
      />
      <ToolbarButton
        icon="measure"
        label={props.measuring ? 'Exit measure' : 'Measure'}
        pressed={props.measuring}
        onClick={props.onMeasure}
      />
      <span className="toolbar-divider" />
      <ToolbarButton icon="fit" label="Fit" onClick={props.onFit} />
      <ToolbarButton icon="reset" label="Reset" onClick={props.onReset} />
      <ToolbarButton icon="top" label="Top view" onClick={props.onTop} />
    </div>
  </div>
)
