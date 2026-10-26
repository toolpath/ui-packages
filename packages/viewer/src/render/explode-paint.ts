import { Color } from 'three'
import type { ExplodeGroup, ExplodeRegionColors } from '../model/explode.js'
import type { PartModel } from '../model/types.js'
import { applyHighlightLayers, type HighlightLayers } from './paint.js'
import { DEFAULT_THEME } from './theme.js'

/** The layers `<ExplodedPart>` paints: an application's own, as `<PartMesh>` takes them. */
export type ExplodePaintLayers = Pick<HighlightLayers, 'highlights' | 'regionHighlights'>

const WHITE = new Color(0xffffff)

/**
 * Each piece's painted surfaces, colored as `<PartMesh>` colors them: feature highlights, then
 * region highlights over them, each covering the white part by its weight. `regionColors` the
 * application set itself win over the paint. Pieces with nothing painted are left out.
 */
export const explodeRegionColors = (
  model: PartModel,
  groups: ReadonlyArray<ExplodeGroup>,
  layers: ExplodePaintLayers,
  regionColors?: ExplodeRegionColors,
): ExplodeRegionColors | undefined => {
  if (!layers.highlights?.length && !layers.regionHighlights?.length) {
    return regionColors
  }
  const painted = new Map<number, number>()
  const color = new Color()
  // The same layering `<PartMesh>` paints with, recorded rather than drawn.
  const paintRegion = (region: number, hex: number, weight: number) => {
    // Stored as `<PartMesh>` stores it: an 8-bit coverage.
    const coverage = Math.round(Math.max(0, Math.min(1, weight)) * 255) / 255
    painted.set(region, color.copy(WHITE).lerp(new Color(hex), coverage).getHex())
  }
  applyHighlightLayers(
    {
      model,
      clearPaint: () => painted.clear(),
      paintRegion,
      paintFeature: (tag, hex, weight) => {
        for (const region of model.regionIndex.regionsForFeature(tag)) {
          paintRegion(region, hex, weight)
        }
      },
    },
    layers,
    DEFAULT_THEME,
  )
  const colors = new Map<string, ReadonlyMap<number, number>>()
  for (const group of groups) {
    const own = regionColors?.get(group.id)
    const regions = new Map<number, number>()
    for (const region of group.regionIdxs) {
      const hex = own?.get(region) ?? painted.get(region)
      if (hex !== undefined) {
        regions.set(region, hex)
      }
    }
    if (regions.size > 0) {
      colors.set(group.id, regions)
    }
  }
  return colors
}

/** Selection and hover tints: the viewer's warm pair, and a cool pair for warm pieces. */
export const EXPLODE_TINTS = {
  warm: { highlight: DEFAULT_THEME.highlight, hover: DEFAULT_THEME.hover },
  cool: { highlight: 0x2563eb, hover: 0x0ea5e9 },
} as const

export type ExplodeTint = keyof typeof EXPLODE_TINTS

/** How much less distinct the warm tint must be before the cool one is used instead. */
const COOL_WHEN = 2

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

/** OKLab: distances in it track how different two colors look. */
const oklab = (hex: number): [number, number, number] => {
  const r = linear(((hex >> 16) & 255) / 255)
  const g = linear(((hex >> 8) & 255) / 255)
  const b = linear((hex & 255) / 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const distance = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * The tint selection and hover move pieces toward. A tint moves a piece only as far as its
 * color differs from the piece's, so warm pieces — rule paint in red, orange and yellow — take
 * the cool tint; anything else keeps the viewer's warm selection colors. Chosen once for the
 * whole layout, so a view selects in one color.
 */
export const explodeTint = (
  groups: ReadonlyArray<ExplodeGroup>,
  colors?: ReadonlyMap<string, number>,
  regionColors?: ExplodeRegionColors,
): ExplodeTint => {
  const warm = oklab(EXPLODE_TINTS.warm.highlight)
  const cool = oklab(EXPLODE_TINTS.cool.highlight)
  const seen = new Map<number, [number, number, number]>()
  let fromWarm = 0
  let fromCool = 0
  for (const group of groups) {
    const base = colors?.get(group.id) ?? group.color
    const regions = regionColors?.get(group.id)
    for (const region of new Set(group.regionIdxs)) {
      const hex = regions?.get(region) ?? base
      let shown = seen.get(hex)
      if (!shown) {
        shown = oklab(hex)
        seen.set(hex, shown)
      }
      fromWarm += distance(shown, warm)
      fromCool += distance(shown, cool)
    }
  }
  return fromCool >= fromWarm * COOL_WHEN && fromCool > 0 ? 'cool' : 'warm'
}
