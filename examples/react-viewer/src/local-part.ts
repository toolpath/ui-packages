import { normalizePartReport, smoothRegionNormals } from '@toolpath/viewer'
import { parsePartGeometry } from '@toolpath/viewer/engine'
import { type FeatureSheet, featureSheet } from '@toolpath/dfm/model'
import type { ExampleModel } from './models'

let opened = 0

/**
 * A real Engine part from files on disk: a report `.json` and the `.glb` or
 * `.stl` mesh from the same analysis, picked together — and, for its sharp
 * corners, the features' datasheets: one or more `.json` files as
 * `GET /v1/parts/{id}/features` answers, `{ datasheets: [{ featureTag, datasheet }] }`.
 * Also accepts cad-viewer's offline `{ filename, report, datasheets }` snapshot,
 * whose datasheets are keyed by feature tag, with its matching mesh.
 *
 * Read the way an application reads one — the report normalized, the mesh
 * checked against it, region normals smoothed, each datasheet through the DFM
 * rules' `featureSheet` — so what the page shows is what an application shows.
 * A feature is flagged with a sharp corner exactly where the rules say so.
 * Nothing is uploaded and nothing is kept: a reload forgets the files.
 */
export async function partFromFiles(files: readonly File[]): Promise<ExampleModel> {
  const documents = await Promise.all(
    files
      .filter((file) => file.name.toLowerCase().endsWith('.json'))
      .map(async (file) => ({ file, json: JSON.parse(await file.text()) as unknown })),
  )
  const report = documents.find(({ json }) => !isDatasheets(json))
  const mesh = files.find((file) => /\.(glb|stl)$/i.test(file.name))
  if (!report || !mesh) {
    throw new Error('Pick the report .json and its mesh .glb or .stl together.')
  }

  const snapshot = isRecord(report.json) && isRecord(report.json.report) ? report.json : null
  const model = normalizePartReport(snapshot ? snapshot.report : report.json)
  const format = mesh.name.toLowerCase().endsWith('.stl') ? 'stl' : 'glb'
  const geometry = await parsePartGeometry(await mesh.arrayBuffer(), model.mesh, format)
  smoothRegionNormals(geometry, model.regions)

  const datasheets = [
    ...(snapshot && isRecord(snapshot.datasheets)
      ? Object.entries(snapshot.datasheets).map(([featureTag, datasheet]) => ({
          featureTag,
          datasheet,
        }))
      : []),
    ...documents.flatMap(({ json }) => (isDatasheets(json) ? json.datasheets : [])),
  ]
  const sheets: Record<string, FeatureSheet> = {}
  for (const entry of datasheets) {
    const { featureTag, datasheet } = (entry ?? {}) as { featureTag?: unknown; datasheet?: unknown }
    if (typeof featureTag === 'string') sheets[featureTag.toLowerCase()] = featureSheet(datasheet)
  }
  const sharpCorners = Object.entries(sheets).flatMap(([tag, sheet]) =>
    sheet.sharpCorners ? [tag] : [],
  )

  opened += 1
  const read =
    datasheets.length > 0
      ? `${datasheets.length} datasheets, ${sharpCorners.length} with a sharp corner`
      : 'no datasheets, so no sharp corners'
  return {
    id: `opened-${opened}`,
    name:
      typeof snapshot?.filename === 'string'
        ? snapshot.filename.replace(/\.(step|stp)$/i, '')
        : `Part ${model.partId.slice(0, 8)}`,
    hint: `${model.features.length} features, ${model.mesh.triangleCount.toLocaleString()} triangles in ${model.regions.length} regions, kernel ${model.kernelVersion}; ${read}. Opened from ${files.map((file) => file.name).join(', ')}.`,
    model,
    geometry,
    sharpCorners,
    sheets,
  }
}

/** A features response: what carries the datasheets, rather than the report. */
const isDatasheets = (json: unknown): json is { datasheets: unknown[] } =>
  typeof json === 'object' &&
  json !== null &&
  Array.isArray((json as { datasheets?: unknown }).datasheets)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
