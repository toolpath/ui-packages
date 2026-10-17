import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  UpdatePartFeatureDetailsEnum,
  createToolpathClient,
  type PartFeatureEntry,
  type JobDetail,
  type PartResponse,
  uploadToPresignedUrl,
  waitForJob,
} from '@toolpath/api'

interface AnalyzePartOptions {
  apiKey: string
  apiUrl?: string
  fetch?: typeof globalThis.fetch
  onStatus?: (message: string) => void
}

type ReportWithDatasheets = Omit<PartResponse, 'features'> & {
  features: Array<
    PartResponse['features'][number] & {
      datasheet: PartFeatureEntry['datasheet'] | null
    }
  >
}

const statusMessage = (job: JobDetail): string => {
  if (job.status === 'running') return 'Analyzing geometry…'
  if (job.status === 'succeeded') return 'Analysis complete.'
  if (job.status === 'failed') return 'Analysis failed.'
  return 'Analysis is queued…'
}

const getWholePartReport = async (
  api: ReturnType<typeof createToolpathClient>,
  report: PartResponse,
): Promise<ReportWithDatasheets> => {
  const featureIds = [...new Set(report.features.map((feature) => feature.featureId))]
  const datasheetsByTag = new Map<string, PartFeatureEntry['datasheet']>()

  for (let index = 0; index < featureIds.length; index += 50) {
    const response = await api.features.getPartFeatures({
      id: report.partId,
      ids: featureIds.slice(index, index + 50).join(','),
    })
    for (const entry of response.datasheets) {
      if (entry.datasheet) datasheetsByTag.set(entry.featureTag, entry.datasheet)
    }
  }

  return {
    ...report,
    features: report.features.map((feature) => ({
      ...feature,
      datasheet: datasheetsByTag.get(feature.featureTag) ?? null,
    })),
  }
}

/** Creates, uploads, analyzes, waits for, and enriches a part report. */
export const analyzePart = async (
  filePath: string,
  {
    apiKey,
    apiUrl = 'https://api.toolpath.com',
    fetch,
    onStatus = console.error,
  }: AnalyzePartOptions,
): Promise<ReportWithDatasheets> => {
  const api = createToolpathClient({ apiKey, baseUrl: apiUrl, fetch })
  const created = await api.parts.createPart({ filename: basename(filePath) })

  await uploadToPresignedUrl(created.uploadUrl, await readFile(filePath), { fetch })

  const analysis = await api.parts.updatePart({
    id: created.partId,
    featureDetails: UpdatePartFeatureDetailsEnum.True,
    idempotencyKey: randomUUID(),
  })
  onStatus(`Analysis started as job ${analysis.jobId}`)

  // Follows the job's event stream until the job is final; rejects with JobFailedError if it fails.
  await waitForJob(api, analysis.jobId, { onUpdate: (job) => onStatus(statusMessage(job)) })
  const report = await api.parts.getPart({ id: created.partId, jobId: analysis.jobId })
  return getWholePartReport(api, report)
}

const run = async (): Promise<void> => {
  const filePath = process.argv[2]
  const apiKey = process.env.TOOLPATH_API_KEY
  if (!filePath || !apiKey) {
    throw new Error('Usage: TOOLPATH_API_KEY=... pnpm analyze -- /absolute/path/to/part.step')
  }

  const report = await analyzePart(resolve(filePath), {
    apiKey,
    apiUrl: process.env.TOOLPATH_API_URL,
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
}
