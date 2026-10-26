import { EXPLODE_TINTS, type ExplodeTint } from './explode-paint.js'
import { DEFAULT_THEME, type ViewerTheme } from './theme.js'

/**
 * The explode look without a theme: the part's edges and the viewer's selection colors, as
 * on `<PartMesh>`, with a pale ghost of the source and a pale source highlight.
 */
const EXPLODE_DEFAULTS = {
  ghost: 0xb5c7dc,
  ghostEmissive: 0x000000,
  source: 0xffda83,
} as const

/** The edge opacity outline fades were tuned at; a theme's own scales them. */
const TUNED_EDGE_OPACITY = 0.9

/**
 * Rendering colors only; piece colors remain application-owned. `highlight` and `hover` follow
 * the layout's tint unless the theme sets them.
 */
export const resolveExplodeTheme = (theme?: Partial<ViewerTheme>, tint: ExplodeTint = 'warm') => ({
  ghost: theme?.part ?? EXPLODE_DEFAULTS.ghost,
  ghostEdge: theme?.edge ?? DEFAULT_THEME.edge,
  ghostEmissive: theme?.partEmissive ?? EXPLODE_DEFAULTS.ghostEmissive,
  emissive: theme?.partEmissive ?? DEFAULT_THEME.partEmissive,
  edge: theme?.edge ?? DEFAULT_THEME.edge,
  edgeOpacity: theme?.edgeOpacity ?? DEFAULT_THEME.edgeOpacity,
  selected: theme?.highlight ?? EXPLODE_TINTS[tint].highlight,
  hovered: theme?.hover ?? EXPLODE_TINTS[tint].hover,
  // The selected piece's source surfaces are what was picked, apart from its selection tint.
  source: theme?.picked ?? EXPLODE_DEFAULTS.source,
})

export type ExplodeTheme = ReturnType<typeof resolveExplodeTheme>
export const DEFAULT_EXPLODE_THEME = resolveExplodeTheme()

/** Outline opacities are tuned at one edge opacity and scale with a theme's own. */
export const edgeOpacityScale = (theme: ExplodeTheme): number =>
  theme.edgeOpacity / TUNED_EDGE_OPACITY
