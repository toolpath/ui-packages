---
'@toolpath/ui': minor
'@toolpath/viewer': minor
---

`ToolDock` is a toolbar for more tools than fit on a bar, in one of two layouts: `spread`, with
the pinned tools on the bar and every tool under All tools; or `grouped`, with the pinned tools
beside a menu for each group. A tool can be pinned from All tools or its menu, and both layouts
share the pins. `defaultLayout` picks the layout an app opens
in, and `ToolDock.LayoutToggle` lets people switch. Every menu and panel opens 4px above the
bar, and `ToolDock.useBarPopout` puts an app's own popup there too. The dock and its menus are dark
in either theme, and `ToolDock.Tooltip` gives an app's own control the dock's tooltip.
`viewerToolGroups` in `@toolpath/viewer` gives the viewer's toolbar controls in groups, with
labels, notes and icons, ready for the dock. `Toggle` takes an `aria-label`.
