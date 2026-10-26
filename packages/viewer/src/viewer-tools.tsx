import type { ReactNode } from 'react'
import { ToolbarIcon, type ToolbarIconName } from './toolbar-icons.js'
import type { ViewerToolbarControls } from './viewer-toolbar.js'

type ViewerAction = keyof ViewerToolbarControls

/**
 * One toolbar control, described for a toolbar that groups, explains and pins
 * its tools, such as `@toolpath/ui`'s `ToolDock`.
 */
export interface ViewerTool {
  id: ViewerAction
  label: string
  /** What the tool does, in a line. */
  note: string
  icon: ReactNode
  /** Whether the tool is on; `undefined` for an action, such as a camera move. */
  on?: boolean
  /** Why the tool cannot work yet, or `null` once it can. */
  gate: string | null
  onClick: () => void
}

export type ViewerToolGroupId = 'scene' | 'dfm' | 'tools' | 'view'

export interface ViewerToolGroup {
  id: ViewerToolGroupId
  label: string
  /** The group's heading, above its tools. */
  title: string
  icon: ReactNode
  tools: Array<ViewerTool>
}

export interface ViewerToolGroupOptions {
  /** A line of your own for a tool, in place of the standard one. */
  notes?: Partial<Record<ViewerAction, string>>
  /** Why a tool cannot work yet; leave a tool out, or give `null`, once it can. */
  gates?: Partial<Record<ViewerAction, string | null>>
}

interface ToolEntry {
  action: ViewerAction
  label: string
  note: string
  /** An action does something once, so it has no on or off. */
  isAction?: boolean
}

interface GroupEntry {
  id: ViewerToolGroupId
  label: string
  title: string
  icon: ToolbarIconName
  tools: ReadonlyArray<ToolEntry>
}

const GROUPS: ReadonlyArray<GroupEntry> = [
  {
    id: 'scene',
    label: 'Scene',
    title: 'Show around the part',
    icon: 'stock',
    tools: [
      { action: 'stock', label: 'Stock', note: 'The smallest stock the part fits in' },
      { action: 'axes', label: 'Axes', note: "X, Y and Z through the part's middle" },
      { action: 'grid', label: 'Grid', note: 'A grid under the part, for scale' },
      { action: 'banana', label: 'Banana', note: 'A banana beside the part, for scale' },
      {
        action: 'tools',
        label: 'Widest tool',
        note: 'The widest tool the chosen feature takes',
      },
    ],
  },
  {
    id: 'dfm',
    label: 'DFM',
    title: 'Show on the part',
    icon: 'dfm',
    tools: [
      {
        action: 'directions',
        label: 'Cut directions',
        note: 'Color each face by the direction it is cut from',
      },
      { action: 'dfm', label: 'DFM flags', note: 'Mark the features the rules flag' },
      {
        action: 'sharpCorners',
        label: 'Sharp corners',
        note: 'Mark the sharp inside corners the rules flag',
      },
      { action: 'threads', label: 'Threads', note: 'Draw the threads in the tapped holes' },
      { action: 'hover', label: 'Hover details', note: 'Name the feature under the pointer' },
      {
        action: 'focus',
        label: 'Focus',
        note: 'Fade the rest of the part around the chosen feature',
      },
      { action: 'wireframe', label: 'Wireframe', note: 'Draw the part as the edges of its faces' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    title: 'Work on the part',
    icon: 'measure',
    tools: [
      { action: 'section', label: 'Section', note: 'Cut the part open on a plane' },
      { action: 'measure', label: 'Measure', note: 'Measure between faces, edges and points' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    title: 'Move the camera',
    icon: 'fit',
    tools: [
      { action: 'fit', label: 'Fit', note: 'Fit the whole part in the window', isAction: true },
      {
        action: 'reset',
        label: 'Reset view',
        note: 'Back to the view the part opened in',
        isAction: true,
      },
      { action: 'top', label: 'Top view', note: 'Look straight down on the part', isAction: true },
    ],
  },
]

/**
 * The toolbar's controls in four groups — what is shown around the part, the
 * DFM layers, the tools, the camera — each with its label, a line on what it
 * does, and its icon. A control the app did not supply is left out, and so is
 * a group left with none.
 *
 * It holds nothing: the `controls` are the ones handed to
 * `ViewerToolbarProvider`, so a tool here does what its button would.
 */
export const viewerToolGroups = (
  controls: ViewerToolbarControls,
  { notes = {}, gates = {} }: ViewerToolGroupOptions = {},
): Array<ViewerToolGroup> =>
  GROUPS.map(({ id, label, title, icon, tools }) => ({
    id,
    label,
    title,
    icon: <ToolbarIcon name={icon} />,
    tools: tools.flatMap(({ action, label: toolLabel, note, isAction = false }) => {
      const control = controls[action]
      if (!control) {
        return []
      }
      return [
        {
          id: action,
          label: toolLabel,
          note: notes[action] ?? note,
          icon: <ToolbarIcon name={action} />,
          on: isAction ? undefined : (control.pressed ?? false),
          gate: gates[action] ?? null,
          onClick: control.onClick,
        },
      ]
    }),
  })).filter((group) => group.tools.length > 0)
