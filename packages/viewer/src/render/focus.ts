import type { FeatureTag, PartModel } from '../model/types.js'

/** The transparency used for geometry outside a focused feature by default. */
export const DEFAULT_FOCUS_OPACITY = 0.15

/** Enables selection-driven X-ray rendering on a part. */
export interface FocusOptions {
  /** Opacity for regions outside the current selection, from 0 through 1. */
  readonly opacity?: number
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
  return `${options === undefined ? 'off' : `on:${options.opacity ?? ''}`}|${selection.join(' ')}`
}

/** The union of regions owned by the selected features. */
export function focusedRegions(
  model: PartModel,
  selection: readonly FeatureTag[],
): ReadonlySet<number> {
  const regions = new Set<number>()
  for (const tag of selection) {
    for (const region of model.regionIndex.regionsForFeature(tag)) regions.add(region)
  }
  return regions
}
