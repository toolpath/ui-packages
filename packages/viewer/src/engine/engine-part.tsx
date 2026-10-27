import { useEffect } from 'react'
import type { FeatureTag, PartModel } from '../model/types.js'
import { withoutFeatures } from '../model/without-features.js'
import { PartMesh, type PartMeshProps } from '../part-mesh.js'
import { type EngineGeometryResource, engineGeometryCache } from './geometry-cache.js'
import { normalizePartReport } from './normalize.js'

// Initial Suspense retries discard useMemo results. Weak ownership preserves the
// normalized model for the same report without retaining discarded reports.
const models = new WeakMap<object, PartModel>()

const modelForReport = (report: unknown): PartModel => {
  if (typeof report !== 'object' || report === null) {
    return normalizePartReport(report)
  }
  const existing = models.get(report)
  if (existing) {
    return existing
  }
  const model = normalizePartReport(report)
  models.set(report, model)
  return model
}

// The last model each report's was cut down to, by the tags left out: a list made again each
// render, holding the same tags, keeps the model and so the part.
const cutDown = new WeakMap<PartModel, { key: string; model: PartModel }>()

const modelWithout = (model: PartModel, tags: readonly FeatureTag[] | undefined): PartModel => {
  if (!tags || tags.length === 0) return model
  const key = [...new Set(tags.map((tag) => tag.toLowerCase()))].sort().join(',')
  const held = cutDown.get(model)
  if (held?.key === key) return held.model
  const cut = withoutFeatures(model, tags)
  cutDown.set(model, { key, model: cut })
  return cut
}

export interface EnginePartProps extends Omit<PartMeshProps, 'model' | 'geometry'> {
  /**
   * A Toolpath Engine part report, exactly as the API returned it.
   *
   * Typed `unknown` because it is validated rather than trusted: a report read
   * from a file is treated the same as one off the wire. A malformed one throws
   * `PartReportFormatError`, and one from a pre-0.3.0 kernel throws
   * `UnsupportedKernelVersionError` — both worth catching in an error boundary,
   * since neither is a state the viewport can render.
   */
  report: unknown
  /**
   * Features to leave out of the part, by tag, as `withoutFeatures` does: for the ones whose
   * geometry the Engine says is invalid, `@toolpath/dfm`'s `invalidFeatureTags`. Read by its tags,
   * so a new list holding the same ones changes nothing; a change rebuilds the part's paint against
   * the mesh already loaded.
   */
  withoutFeatures?: readonly FeatureTag[]
}

/**
 * Renders a Toolpath Engine report, fetching the mesh it describes.
 *
 * Suspends while the mesh loads and throws its failure, so a caller wraps it in
 * `<Suspense>` and an error boundary rather than threading loading state
 * through props.
 */
export const EnginePart = ({ report, withoutFeatures: leftOut, ...props }: EnginePartProps) => {
  const reported = modelForReport(report)
  const model = modelWithout(reported, leftOut)
  const resource = useGeometryResource(reported)

  useEffect(() => {
    engineGeometryCache.retain(resource)
    return () => engineGeometryCache.release(resource)
  }, [resource])

  return <PartMesh model={model} geometry={resource.geometry!} {...props} />
}

function useGeometryResource(part: Parameters<typeof engineGeometryCache.get>[0]) {
  const resource: EngineGeometryResource = engineGeometryCache.get(part)
  if (resource.status === 'pending') throw resource.promise
  if (resource.status === 'rejected') throw resource.error
  return resource
}
