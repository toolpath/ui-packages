import { useEffect } from 'react'
import type { PartModel } from '../model/types.js'
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
}

/**
 * Renders a Toolpath Engine report, fetching the mesh it describes.
 *
 * Suspends while the mesh loads and throws its failure, so a caller wraps it in
 * `<Suspense>` and an error boundary rather than threading loading state
 * through props.
 */
export const EnginePart = ({ report, ...props }: EnginePartProps) => {
  const model = modelForReport(report)
  const resource = useGeometryResource(model)

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
