/**
 * The normalized part — the only thing the renderer consumes.
 *
 * `engine/` produces this; nothing under `model/` or `render/` sees a
 * `PartResponse`. The renderer therefore survives an API change, and the
 * viewer can be driven from a local file with no API at all, which is also how
 * it gets tested.
 *
 * The mesh is **millimetres** and **Z-up** — not the glTF-conventional Y-up.
 * Machining and candidate directions are unit vectors, and are not always
 * axis-aligned: real reports carry tilted 5-axis setups alongside the six
 * axis-aligned ones.
 */

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Opaque per-feature identity — 16 hex characters (64 bits).
 *
 * Never substitute an array position for this. The `features` array is not
 * sorted by anything, and a position-derived identity institutionalizes that
 * mistake.
 */
export type FeatureTag = string

/**
 * Feature types the Engine is known to report. The set is **open** — the
 * kernel adds more — so this stays a widened union rather than a closed enum
 * that breaks on the next kernel release.
 */
export type KnownFeatureType =
  | 'blind_hole'
  | 'boss'
  | 'chamfer'
  | 'circular_wall'
  | 'contour_surface'
  | 'face'
  | 'filleted_blind_hole'
  | 'filleted_boss'
  | 'filleted_open_pocket'
  | 'filleted_pocket'
  | 'inner_fillet'
  | 'open_pocket'
  | 'outer_fillet'
  | 'pocket'
  | 'profile'
  | 'sink'
  | 'slanted_face'
  | 'through_hole'
  | 'through_pocket'
  | 'undercut_dovetail'
  | 'undercut_filleted_tslot'
  | 'undercut_tslot'
  | 'wall'

export type FeatureType = KnownFeatureType | (string & Record<never, never>)

/**
 * The analytic surface classification of a region. The kernel classifies more
 * than the two seen most often, so the union stays open.
 */
export type KnownShapeKind = 'Cylinder' | 'Plane'

export type ShapeKind = KnownShapeKind | (string & Record<never, never>)

/** A half-open triangle range: `[start, end)`. */
export interface TriangleRange {
  readonly start: number
  readonly end: number
}

/**
 * The `feature ↔ region ↔ triangle` mapping, as a pure projection of the report.
 *
 * The asymmetry it encodes is the single most important fact about selection:
 *
 * ```text
 * feature → regions     always well-defined     (regionIdxs, given)
 * region  → feature     genuinely one-to-many   (no rule fixes this)
 * ```
 *
 * A region is owned by five to eight features *even on a cube* — measured, not
 * estimated — because the same physical face is a `face` under one machining
 * direction and a `wall` under others, and every direction's `profile` overlaps
 * the surfaces it traces. Nothing here tries to reduce that to one; ranking a
 * viewport click depends on viewer state (active direction, camera) and lives
 * in `render/selection.ts`.
 *
 * The interface exists so a future change in how the Engine expresses the
 * mapping — a per-triangle array, a vertex attribute — is absorbed in one file.
 */
export interface RegionIndex {
  readonly regionCount: number
  /**
   * Triangle index → region idx, `O(log R)`.
   *
   * `null` means the report is malformed or the mesh and report are mismatched,
   * **not** a state the UI needs to render gracefully: regions are guaranteed
   * to tile the mesh completely, and `buildRegionIndex` rejects a table that
   * does not. Treat a `null` here as a bug worth logging.
   */
  regionForTriangle(triangle: number): number | null
  /** Every feature owning a region, in report order. Measured at 5–8 entries. */
  featuresForRegion(region: number): readonly FeatureTag[]
  /** A feature's regions, for highlight, framing, and isolation. */
  regionsForFeature(tag: FeatureTag): readonly number[]
  /** `null` for an unknown region idx. */
  rangeForRegion(region: number): TriangleRange | null
}

export interface PartModelRegion {
  /**
   * Opaque, report-local identity of the B-rep face this region came from before
   * analysis split it. Equal values are one visual surface; it is not an index
   * or a kernel surface identifier.
   */
  readonly splitOrigin: number
  /**
   * Post-split region identity. Feature ownership, picking, and triangle
   * ranges deliberately continue to use this rather than `splitOrigin`.
   */
  readonly idx: number
  readonly shapeKind: ShapeKind
  /**
   * **Analytic** area, not faceted. Use it to sort, filter, and display — never
   * to validate geometry: a computed-vs-reported area check fails by around a
   * percent on perfectly correct data and reads as a triangle-ordering bug.
   */
  readonly area: number
  readonly triangles: TriangleRange
}

export interface PartModelFeature {
  /** Opaque identity. Never an array position. */
  readonly tag: FeatureTag
  readonly featureType: FeatureType
  /** A unit vector, not necessarily axis-aligned. */
  readonly machiningDirection: Vec3
  /**
   * The feature's own axis, where it has one — a bore's centreline, a wall's
   * normal — and `null` on anything without a natural axis.
   *
   * Kept because it is how somebody names an orientation without knowing its
   * numbers: "hold it square to that hole" is a sentence a machinist says, and
   * this is the vector behind it.
   */
  readonly axis: Vec3 | null
  readonly regionIdxs: readonly number[]
}

export interface PartMeshRefs {
  readonly pointCount: number
  readonly triangleCount: number
  /**
   * Presigned and short-lived. Fetch promptly; refetch the report rather than
   * persisting the URL.
   */
  readonly glbUrl: string | null
  readonly stlUrl: string | null
  readonly thumbnailUrl: string | null
}

export interface PartModel {
  readonly partId: string
  readonly kernelVersion: string
  readonly features: readonly PartModelFeature[]
  readonly regions: readonly PartModelRegion[]
  readonly candidateDirections: readonly Vec3[]
  readonly mesh: PartMeshRefs
  readonly regionIndex: RegionIndex
  /** Non-fatal problems found while normalizing. */
  readonly warnings: readonly string[]
}
