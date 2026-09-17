import type { ReactNode } from 'react'

const paths = {
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  top: 'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10',
  stock: 'M3 6l9-4 9 4v12l-9 4-9-4zM3 6l9 4 9-4M12 10v12M7 8v8l5 2 5-2V8',
  axes: 'M5 19V3m0 16h16M5 19l10-10M2 6l3-3 3 3m10 10 3 3-3 3M11 9h4v4',
  grid: 'M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8M12 13v8M7.5 5.5v8M16.5 5.5v8',
  directions: 'M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4',
  wireframe: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M4 17l8-4 8 4M12 3v10',
  section: 'M3 17L17 3l4 4L7 21zM4 6l2-2m3 3 2-2m2 6 2-2m2 6 2-2',
  measure: 'M3 16L16 3l5 5L8 21zM8 11l3 3m1-7 3 3m-11 5 3 3',
} as const

interface ButtonProps {
  icon: keyof typeof paths
  label: string
  pressed?: boolean
  onClick: () => void
}

const ToolbarButton = ({ icon, label, pressed, onClick }: ButtonProps) => (
  <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[icon]} />
    </svg>
    <span className="toolbar-tooltip" role="tooltip">
      {label}
    </span>
  </button>
)

interface ViewerToolbarProps {
  stock: boolean
  axes: boolean
  grid: boolean
  directions: boolean
  wireframe: boolean
  sectioning: boolean
  measuring: boolean
  onFit: () => void
  onReset: () => void
  onTop: () => void
  onStock: () => void
  onAxes: () => void
  onGrid: () => void
  onDirections: () => void
  onWireframe: () => void
  onSection: () => void
  onMeasure: () => void
  children?: ReactNode
}

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
      <span className="toolbar-divider" />
      <ToolbarButton
        icon="directions"
        label="Highlight faces by direction"
        pressed={props.directions}
        onClick={props.onDirections}
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
