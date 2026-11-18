import type { FeatureTag, PartModel } from '../model/types.js'

/** The transparency used for geometry outside a focused feature by default. */
export const DEFAULT_FOCUS_OPACITY = 0.15

/** Enables selection-driven X-ray rendering on a part. */
export interface FocusOptions {
  /** Opacity for regions outside the current selection, from 0 through 1. */
  readonly opacity?: number
  /**
   * The regions kept solid, in place of the selection's: faces an application isolates that are
   * not a selected feature's (and so not painted in the selection colour). Empty keeps every
   * region solid, as an empty selection does.
   */
  readonly regions?: readonly number[]
}

/** Clamps an application-supplied X-ray opacity to the range a material accepts. */
export function focusOpacity(options: FocusOptions | undefined): number {
  return Math.min(Math.max(options?.opacity ?? DEFAULT_FOCUS_OPACITY, 0), 1)
}

/** A stable effect key that distinguishes disabled focus from its default mode. */
export function focusStateKey(
  options: FocusOptions | undefined,
  selection: readonly FeatureTag[],
): string {
  return `${options === undefined ? 'off' : `on:${options.opacity ?? ''}`}|${options?.regions ? `regions:${options.regions.join(' ')}` : selection.join(' ')}`
}

/** The regions kept solid: the focus's own `regions` where given, else those the selected features own. */
export function focusedRegions(
  model: PartModel,
  selection: readonly FeatureTag[],
  focus?: FocusOptions,
): ReadonlySet<number> {
  if (focus?.regions) return new Set(focus.regions)
  const regions = new Set<number>()
  for (const tag of selection) {
    for (const region of model.regionIndex.regionsForFeature(tag)) regions.add(region)
  }
  return regions
}
