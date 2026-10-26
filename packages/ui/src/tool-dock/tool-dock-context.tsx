import { createContext, useContext, type RefObject } from 'react'
import type { ToolDockLayout } from './types'

interface ToolDockContextValue {
  layout: ToolDockLayout
  setLayout: (layout: ToolDockLayout) => void
  /** The bar itself, which the popups from it keep their distance from (`bar-popout.ts`). */
  bar: RefObject<HTMLDivElement | null>
}

export const ToolDockContext = createContext<ToolDockContextValue | null>(null)

/** The dock's layout, its setter and its bar, for a control inside the dock, such as a settings menu. */
export const useToolDock = (): ToolDockContextValue => {
  const context = useContext(ToolDockContext)
  if (!context) {
    throw new Error('ToolDock.useToolDock and ToolDock.useBarPopout must be used inside <ToolDock>')
  }
  return context
}
