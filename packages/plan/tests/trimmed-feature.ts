import type { TrimmedFeature } from '../src/engine-plan'

/** A trimmed feature for a test: a pocket cut from above, with no faces and no origin, but as `overrides` says. */
export const trimmedFeature = (overrides: Partial<TrimmedFeature> = {}): TrimmedFeature => ({
  featureTag: 't',
  featureType: 'pocket',
  machiningDirection: { x: 0, y: 0, z: 1 },
  regionIdxs: [],
  fromFeatureTag: null,
  ...overrides,
})
