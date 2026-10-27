import { directionIndexOf } from '../model/directions.js'
import type { FeatureTag } from '../model/types.js'
import type { PartObject } from './part.js'
import { type ViewerTheme, directionColor } from './theme.js'

/** What painting needs of a part: its model, and its paint. `createPart` provides it. */
export type PaintTarget = Pick<PartObject, 'model' | 'clearPaint' | 'paintRegion' | 'paintFeature'>

/**
 * A feature the consumer wants coloured, for a reason the viewer does not need
 * to know — a difficulty band, a setup, a material.
 *
 * A colour rather than a concept: the viewer paints it and stays out of what it
 * means. `weight` is how strongly it covers the surface beneath, 0 to 1;
 * omitted, it takes a wash that stays under the selection and candidate layers.
 */
export interface FeatureHighlight {
  readonly tag: FeatureTag
  readonly color: number
  readonly weight?: number
}

/**
 * A colour on one face, named directly rather than through a feature.
 *
 * Features are the usual way to say what a colour means, but a face is a thing
 * in its own right: a consumer proposing work face by face, or showing which
 * part of a feature it is talking about, has no feature tag for "these four
 * faces and not the fifth". So regions can be painted too, over the feature
 * layer and under selection.
 */
export interface RegionHighlight {
  readonly region: number
  readonly color: number
  readonly weight?: number
}

/**
 * How strongly a consumer's own layer paints.
 *
 * Below a candidate and well below a selection: a wash the whole part can wear
 * at once — every feature banded by how hard it is to cut — has to stay legible
 * underneath the two layers that answer "what did I just click".
 */
export const HIGHLIGHT_WEIGHT = 0.7

/** How strongly a candidate paints, relative to a pick. */
export const CANDIDATE_WEIGHT = 0.4

/** Hover, just under a selection: a question, not a decision. */
export const HOVER_WEIGHT = 0.85

export interface HighlightLayers {
  /** The consumer's own colouring, painted under everything else. */
  readonly highlights?: readonly FeatureHighlight[]
  /** Colours on named faces, over the feature highlights. */
  readonly regionHighlights?: readonly RegionHighlight[]
  /**
   * Every feature a click could have meant, each faintly in its own direction's
   * colour. Distinct from `selection` on purpose: a ranked guess that quietly
   * discarded its alternatives is the main way this interaction goes wrong.
   */
  readonly candidates?: readonly FeatureTag[]
  /** The features being read. */
  readonly selection?: readonly FeatureTag[]
  /**
   * The faces a click just picked, painted over the reading they resolved to.
   *
   * Above the selection rather than below it, which is where the feature picker
   * puts them — because the picker paints nothing for a guessed reading, so its
   * picked faces are never covered. Here the guess *is* painted, so held faces
   * under it would vanish and a modifier-click would look like it did nothing.
   */
  readonly pickedRegions?: readonly number[]
  /** Features shown as hovered from outside the viewport — a list row. */
  readonly hoveredFeatures?: readonly FeatureTag[]
  /** The face under the pointer. */
  readonly hoverRegion?: number | null
}

/**
 * The faces the selection already owns.
 *
 * Hover does not repaint them: pointing at something and having it answer in
 * the same colour it had before the click reads as the click not having landed.
 * Everywhere else the pointer still wins — it is only the face it just selected
 * that it leaves alone.
 */
function selectedRegions(part: PaintTarget, layers: HighlightLayers): Set<number> {
  const regions = new Set<number>()
  for (const tag of layers.selection ?? []) {
    for (const region of part.model.regionIndex.regionsForFeature(tag)) regions.add(region)
  }
  return regions
}

/**
 * Paints the layer stack onto a part.
 *
 * **A face can only be one colour.** The part is one mesh and each region
 * carries a single texel, so every question the part answers has to be answered
 * by one mark. Layers are therefore painted weakest first and each one
 * overwrites what is under it outright — nothing blends.
 *
 * The order is the argument. Layers 1–2 are the consumer's standing opinion;
 * 3–4 are this moment; 5–6 are the pointer. A question asked with the mouse
 * always beats a decision already made, because the decision is still there
 * when the pointer moves away.
 */
export function applyHighlightLayers(
  part: PaintTarget,
  layers: HighlightLayers,
  theme: ViewerTheme,
): void {
  part.clearPaint()

  for (const highlight of layers.highlights ?? []) {
    part.paintFeature(highlight.tag, highlight.color, highlight.weight ?? HIGHLIGHT_WEIGHT)
  }

  for (const highlight of layers.regionHighlights ?? []) {
    part.paintRegion(highlight.region, highlight.color, highlight.weight ?? HIGHLIGHT_WEIGHT)
  }

  for (const tag of layers.candidates ?? []) {
    const feature = part.model.features.find((candidate) => candidate.tag === tag)
    const index = feature ? directionIndexOf(part.model, feature.machiningDirection) : -1

    part.paintFeature(tag, index === -1 ? theme.hover : directionColor(index), CANDIDATE_WEIGHT)
  }

  for (const tag of layers.selection ?? []) {
    part.paintFeature(tag, theme.highlight, 1)
  }

  for (const region of layers.pickedRegions ?? []) {
    part.paintRegion(region, theme.picked, 1)
  }

  for (const tag of layers.hoveredFeatures ?? []) {
    part.paintFeature(tag, theme.hover, HOVER_WEIGHT)
  }

  if (layers.hoverRegion != null && !selectedRegions(part, layers).has(layers.hoverRegion)) {
    part.paintRegion(layers.hoverRegion, theme.hover, HOVER_WEIGHT)
  }
}
