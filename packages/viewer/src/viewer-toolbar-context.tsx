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
  /** Shown but unavailable: greyed, and a click does nothing. */
  disabled?: boolean
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
  /**
   * The assembly drawn round the part: see `subject` on `<PartCollection>`. Pressed while shown.
   * `assemblyControl` gives it only where there is an assembly to show.
   */
  assembly?: ViewerToolbarControl
  axes?: ViewerToolbarControl
  grid?: ViewerToolbarControl
  banana?: ViewerToolbarControl
  /** Tools drawn on the part: see `<ToolMarks>`. */
  tools?: ViewerToolbarControl
  directions?: ViewerToolbarControl
  dfm?: ViewerToolbarControl
  /** The DFM rules' sharp corners, drawn on the part: see `sharpCorners` on `<PartMesh>`. */
  sharpCorners?: ViewerToolbarControl
  /** Threads drawn on their holes and studs: see `threads` on `<PartMesh>`. */
  threads?: ViewerToolbarControl
  hover?: ViewerToolbarControl
  focus?: ViewerToolbarControl
  wireframe?: ViewerToolbarControl
  /**
   * The part pulled apart (see `<ExplodedPart>`), or a collection's items pulled apart from one
   * another (see `explode` on `<PartCollection>`). Pressed while apart.
   */
  explode?: ViewerToolbarControl
  section?: ViewerToolbarControl
  measure?: ViewerToolbarControl
  fit?: ViewerToolbarControl
  reset?: ViewerToolbarControl
  top?: ViewerToolbarControl
}

/**
 * The `assembly` control for a `<PartCollection>` of `parts` worked on as its `subject` says,
 * pressed while `shown`. Given only where there is an assembly round the subject to show and hide:
 * a `subject`, and at least one part that is not it. Otherwise undefined, so the button is left
 * off the bar: with no subject every part is a subject and `assembly.visible` hides nothing, and a
 * subject with no other part has nothing round it. Pure.
 */
export const assemblyControl = (
  parts: ReadonlyArray<{ id: string }>,
  subject: string | null | undefined,
  { shown, onToggle }: { shown: boolean; onToggle: () => void },
): ViewerToolbarControl | undefined =>
  subject != null && parts.some(({ id }) => id !== subject)
    ? { pressed: shown, onClick: onToggle }
    : undefined

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
