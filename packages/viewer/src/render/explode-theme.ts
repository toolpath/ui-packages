import { DEFAULT_THEME, type ViewerTheme } from './theme.js'

/** Rendering colors only; piece colors remain application-owned. */
export const resolveExplodeTheme = (theme?: Partial<ViewerTheme>) => ({
  ghost: theme?.part ?? 0xb5c7dc,
  ghostEdge: theme?.edge ?? 0xa5b7d1,
  ghostEmissive: theme?.partEmissive ?? 0x000000,
  emissive: theme?.partEmissive ?? DEFAULT_THEME.partEmissive,
  edge: theme?.edge ?? 0x182535,
  edgeOpacity: theme?.edgeOpacity ?? 0.9,
  selected: theme?.highlight ?? 0xffffff,
  hovered: theme?.hover ?? 0xffffff,
  source: theme?.highlight ?? 0xffda83,
})

export type ExplodeTheme = ReturnType<typeof resolveExplodeTheme>
export const DEFAULT_EXPLODE_THEME = resolveExplodeTheme()
