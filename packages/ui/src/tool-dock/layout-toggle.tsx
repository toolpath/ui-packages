import type { FC, ReactElement } from 'react'
import { cn } from '../common'
import { Toggle } from '../toggle'
import { FOCUS } from './styles'
import { useToolDock } from './tool-dock-context'
import type { ToolDockLayout } from './types'

/**
 * Spread or Grouped, for a settings menu inside the dock. It changes the
 * dock it sits in, so it must be rendered among the dock's children. Its
 * track is a shade darker than the dock's menus, as the DFM card's mode
 * switch is: the kit's own dark track is the menus' color, and the toggle
 * reads as plain text.
 */
export const LayoutToggle: FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'sm' }): ReactElement => {
  const { layout, setLayout } = useToolDock()
  return (
    <Toggle
      aria-label="Toolbar layout"
      value={layout}
      onValueChange={(next) => setLayout(next as ToolDockLayout)}
      size={size}
      // `dark:`, as the kit's own track color is a `dark:` one. The dock's
      // focus ring, in place of the kit's blue one.
      className={cn('dark:bg-zinc-950', FOCUS)}
    >
      <Toggle.Item value="spread">Spread</Toggle.Item>
      <Toggle.Item value="grouped">Grouped</Toggle.Item>
    </Toggle>
  )
}
