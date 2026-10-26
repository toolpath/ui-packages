import { DEFAULT_THEME, type ViewerTheme } from './theme.js'

/** The explode look without a theme. Not DEFAULT_THEME's values; a theme replaces each one. */
const EXPLODE_DEFAULTS = {
  ghost: 0xb5c7dc,
  ghostEdge: 0xa5b7d1,
  ghostEmissive: 0x000000,
  edge: 0x182535,
  edgeOpacity: 0.9,
  selected: 0xffffff,
  hovered: 0xffffff,
  source: 0xffda83,
} as const

/** Rendering colors only; piece colors remain application-owned. */
export const resolveExplodeTheme = (theme?: Partial<ViewerTheme>) => ({
  ghost: theme?.part ?? EXPLODE_DEFAULTS.ghost,
  ghostEdge: theme?.edge ?? EXPLODE_DEFAULTS.ghostEdge,
  ghostEmissive: theme?.partEmissive ?? EXPLODE_DEFAULTS.ghostEmissive,
  emissive: theme?.partEmissive ?? DEFAULT_THEME.partEmissive,
  edge: theme?.edge ?? EXPLODE_DEFAULTS.edge,
  edgeOpacity: theme?.edgeOpacity ?? EXPLODE_DEFAULTS.edgeOpacity,
  selected: theme?.highlight ?? EXPLODE_DEFAULTS.selected,
  hovered: theme?.hover ?? EXPLODE_DEFAULTS.hovered,
  // The selected piece's source surfaces are what was picked, apart from its selection tint.
  source: theme?.picked ?? EXPLODE_DEFAULTS.source,
})

export type ExplodeTheme = ReturnType<typeof resolveExplodeTheme>
export const DEFAULT_EXPLODE_THEME = resolveExplodeTheme()

/** Outline opacities are tuned at the default edge opacity and scale with a theme's own. */
export const edgeOpacityScale = (theme: ExplodeTheme): number =>
  theme.edgeOpacity / EXPLODE_DEFAULTS.edgeOpacity
