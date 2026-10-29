import { PartReportFormatError, UnsupportedKernelVersionError } from '../model/errors.js'
import { buildRegionIndex } from '../model/region-index.js'
import type {
  FeatureTag,
  PartModel,
  PartModelFeature,
  PartModelRegion,
  Vec3,
} from '../model/types.js'
import { withoutFeatures } from '../model/without-features.js'
import {
  isFiniteNumber,
  isNonNegativeInteger,
  isNullableString,
  isRecord,
  isString,
} from './guards.js'

/**
 * The first kernel to publish `regions[]` and `featureTag`, and therefore the
 * first that can drive feature selection at all.
 */
export const MIN_KERNEL_VERSION = '0.3.0'

export interface NormalizePartReportOptions {
  /**
   * Features to leave out of the model, by tag, as {@link withoutFeatures} does: for the ones whose
   * geometry the Engine says is invalid, `@toolpath/dfm`'s `invalidFeatureTags`. The report is
   * validated whole either way.
   */
  readonly withoutFeatures?: readonly FeatureTag[]
}

/**
 * Validates a part report and projects it into the `PartModel` the renderer
 * consumes.
 *
 * Takes `unknown` on purpose: a report read from a file gets exactly the same
 * treatment as one off the wire, which is what makes the viewer drivable — and
 * testable — with no API at all. `openapi/openapi.json` is the contract this
 * validates against; the checks are structural so that a response which does
 * not match cannot reach the renderer regardless of how it was typed upstream.
 *
 * Throws `UnsupportedKernelVersionError` for a pre-`0.3.0` report, and
 * `PartReportFormatError` (carrying every problem found, not just the first)
 * for anything else.
 */
export function normalizePartReport(
  report: unknown,
  options: NormalizePartReportOptions = {},
): PartModel {
  if (!isRecord(report)) {
    throw new PartReportFormatError(['report is not an object'])
  }

  const kernelVersion = report['kernelVersion']
  if (!isString(kernelVersion)) {
    throw new PartReportFormatError(['kernelVersion is missing or not a string'])
  }
  assertSupportedKernelVersion(kernelVersion)

  const issues: string[] = []
  const warnings: string[] = []

  const partId = requireString(report['partId'], 'partId', issues)
  const meshPointCount = requireCount(report['meshPointCount'], 'meshPointCount', issues)
  const meshTriangleCount = requireCount(report['meshTriangleCount'], 'meshTriangleCount', issues)

  const regions = readRegions(report['regions'], issues)
  const features = readFeatures(report['features'], issues, warnings)
  const candidateDirections = readDirections(report['candidateDirections'], issues)

  for (const [key, value] of [
    ['meshGlbUrl', report['meshGlbUrl']],
    ['meshStlUrl', report['meshStlUrl']],
    ['thumbnailUrl', report['thumbnailUrl']],
  ] as const) {
    if (value !== undefined && !isNullableString(value)) {
      issues.push(`${key} is neither a string nor null`)
    }
  }

  if (
    issues.length > 0 ||
    partId === null ||
    meshPointCount === null ||
    meshTriangleCount === null
  ) {
    throw new PartReportFormatError(issues)
  }

  // `buildRegionIndex` enforces the tiling invariant and throws with its own
  // issue list — the one validation that must happen before any picking.
  const regionIndex = buildRegionIndex({
    regions,
    features,
    triangleCount: meshTriangleCount,
  })

  const model: PartModel = {
    partId,
    kernelVersion,
    features,
    regions,
    candidateDirections,
    mesh: {
      pointCount: meshPointCount,
      triangleCount: meshTriangleCount,
      glbUrl: readNullableString(report['meshGlbUrl']),
      stlUrl: readNullableString(report['meshStlUrl']),
      thumbnailUrl: readNullableString(report['thumbnailUrl']),
    },
    regionIndex,
    warnings,
  }
  return options.withoutFeatures ? withoutFeatures(model, options.withoutFeatures) : model
}

/**
 * Rejects reports from a kernel older than `0.3.0`.
 *
 * `0.2.0` reports parse *almost* correctly — same envelope, same mesh — but
 * carry `featureIndex` instead of `featureTag` and no `regions[]` at all, so
 * every selection path would silently do nothing. Failing here, with the
 * version named, is the whole point.
 */
export function assertSupportedKernelVersion(kernelVersion: string): void {
  const parsed = parseVersion(kernelVersion)
  if (parsed === null) {
    throw new PartReportFormatError([
      `kernelVersion "${kernelVersion}" is not a recognizable version`,
    ])
  }

  const minimum = parseVersion(MIN_KERNEL_VERSION)
  if (minimum === null || compareVersions(parsed, minimum) < 0) {
    throw new UnsupportedKernelVersionError(kernelVersion, MIN_KERNEL_VERSION)
  }
}

function readRegions(value: unknown, issues: string[]): PartModelRegion[] {
  if (!Array.isArray(value)) {
    issues.push('regions is missing or not an array — a 0.3.0 report always has one')
    return []
  }

  const regions: PartModelRegion[] = []
  for (const [i, raw] of value.entries()) {
    if (!isRecord(raw)) {
      issues.push(`regions[${i}] is not an object`)
      continue
    }
    const idx = raw['idx']
    const splitOrigin = raw['splitOrigin']
    const start = raw['triangleStart']
    const end = raw['triangleEnd']
    const area = raw['area']
    const shapeKind = raw['shapeKind']
    if (
      !isNonNegativeInteger(idx) ||
      !isNonNegativeInteger(splitOrigin) ||
      !isNonNegativeInteger(start) ||
      !isNonNegativeInteger(end) ||
      !isFiniteNumber(area) ||
      !isString(shapeKind)
    ) {
      issues.push(`regions[${i}] does not match the Region schema`)
      continue
    }
    regions.push({ idx, splitOrigin, shapeKind, area, triangles: { start, end } })
  }
  return regions
}

function readFeatures(value: unknown, issues: string[], warnings: string[]): PartModelFeature[] {
  if (!Array.isArray(value)) {
    issues.push('features is missing or not an array')
    return []
  }

  const features: PartModelFeature[] = []
  for (const [i, raw] of value.entries()) {
    if (!isRecord(raw)) {
      issues.push(`features[${i}] is not an object`)
      continue
    }
    const tag = raw['featureTag']
    const featureType = raw['featureType']
    const regionIdxs = raw['regionIdxs']
    const machiningDirection = readVec3(raw['machiningDirection'])
    if (!isString(tag)) {
      // A 0.2.0 report reaching this point would be the giveaway, but the
      // version gate has already rejected it, so this really is malformed.
      issues.push(`features[${i}] has no featureTag`)
      continue
    }
    if (!isString(featureType)) {
      issues.push(`feature ${tag} has no featureType`)
      continue
    }
    if (machiningDirection === null) {
      issues.push(`feature ${tag} has no machiningDirection`)
      continue
    }
    if (!isRegionIdxArray(regionIdxs)) {
      issues.push(`feature ${tag} has an invalid regionIdxs`)
      continue
    }

    features.push({
      tag,
      featureType,
      machiningDirection,
      // Absent and null are both normal — plenty of features have no natural
      // axis. A value that is present but unreadable is a data problem worth
      // saying out loud, and not one worth failing a load over: nothing is
      // rendered from the axis.
      axis: readAxis(raw['axis'], tag, warnings),
      regionIdxs,
    })
  }
  return features
}

function readDirections(value: unknown, issues: string[]): Vec3[] {
  if (!Array.isArray(value)) {
    issues.push('candidateDirections is missing or not an array')
    return []
  }

  const directions: Vec3[] = []
  for (const [i, raw] of value.entries()) {
    const vec = readVec3(raw)
    if (vec === null) {
      issues.push(`candidateDirections[${i}] is not a vector`)
      continue
    }
    directions.push(vec)
  }
  return directions
}

function readAxis(value: unknown, tag: string, warnings: string[]): Vec3 | null {
  if (value === null || value === undefined) return null
  const axis = readVec3(value)
  if (axis === null) {
    warnings.push(`feature ${tag} has an axis this package cannot read; dropped`)
  }
  return axis
}

function isRegionIdxArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNonNegativeInteger)
}

function requireString(value: unknown, field: string, issues: string[]): string | null {
  if (isString(value)) return value
  issues.push(`${field} is missing or not a string`)
  return null
}

function requireCount(value: unknown, field: string, issues: string[]): number | null {
  if (isNonNegativeInteger(value)) return value
  issues.push(`${field} is missing or not a non-negative integer`)
  return null
}

function readVec3(value: unknown): Vec3 | null {
  if (!isRecord(value)) return null
  const { x, y, z } = value
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null
  return { x, y, z }
}

function readNullableString(value: unknown): string | null {
  return isString(value) ? value : null
}

type ParsedVersion = readonly [number, number, number]

function parseVersion(value: string): ParsedVersion | null {
  const core = value.trim().split(/[-+]/, 1)[0] ?? ''
  const parts = core.split('.')
  if (parts.length < 2 || parts.length > 3) return null

  const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : NaN))
  if (numbers.some(Number.isNaN)) return null

  return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0]
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  for (let i = 0; i < 3; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
