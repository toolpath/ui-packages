import { createContext, useContext } from 'react'
import type { PropsWithChildren } from 'react'

/*
 * The toolbar's state and actions, apart from the toolbar's DOM buttons: an
 * application that draws its own controls — with its own component kit, or on
 * a platform with no DOM — reads them through `useViewerToolbar`.
 */

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
  /** Tools drawn on the part: see `<ToolMarks>`. */
  tools?: ViewerToolbarControl
  directions?: ViewerToolbarControl
  dfm?: ViewerToolbarControl
  /** The DFM rules' sharp corners, drawn on the part: see `sharpCorners` on `<PartMesh>`. */
  sharpCorners?: ViewerToolbarControl
  /** Threads drawn in their holes: see `threads` on `<PartMesh>`. */
  threads?: ViewerToolbarControl
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
