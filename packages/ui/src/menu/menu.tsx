import React from 'react'
import { Menu as BaseMenu, ContextMenu, MenuRoot } from '@base-ui/react'
import { MenuProvider } from './menu-context'

export type MenuProps =
  | (MenuRoot.Props & { context?: false })
  | (ContextMenu.Root.Props & { context: true })

export const Menu = ({ context = false, ...props }: MenuProps) => (
  <MenuProvider context={context}>
    {!context && <BaseMenu.Root {...(props as MenuRoot.Props)} />}
    {context && <ContextMenu.Root {...(props as ContextMenu.Root.Props)} />}
  </MenuProvider>
)
