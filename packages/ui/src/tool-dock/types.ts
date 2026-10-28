import type { ReactNode } from 'react'

/**
 * How the dock lays its tools out. Both put the pinned tools on the bar.
 * `spread` puts every tool under All tools; `grouped` puts each group in a menu.
 */
export type ToolDockLayout = 'spread' | 'grouped'

export interface DockTool {
  id: string
  label: string
  /** What the tool does, in a line, under its label. */
  note?: string
  icon: ReactNode
  /** Whether the tool is on. Leave it out for an action, such as a camera move. */
  on?: boolean
  /**
   * Why the tool cannot work yet, shown in place of its note. A gated tool is
   * dimmed, has no on or off, and its click still calls `onClick`, so the app
   * can open whatever unlocks it.
   */
  gate?: string | null
  onClick: () => void
}

export interface DockGroup {
  id: string
  label: string
  /** The heading above the group's tools; the label when left out. */
  title?: string
  /** Beside the label on the group's menu. */
  icon?: ReactNode
  tools: ReadonlyArray<DockTool>
}
