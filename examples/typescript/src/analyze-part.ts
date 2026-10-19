import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createParser } from 'eventsource-parser'
import {
  UpdatePartOperationFeatureDetailsEnum,
  createToolpathClient,
  type PartFeatureEntry,
  type JobDetail,
  type PartResponse,
  JobDetailFromJSON,
  instanceOfJobDetail,
  uploadToPresignedUrl,
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
  return 'Analysis is queued…'
}

/**
 * Wait for the terminal job event instead of polling jobs or the report endpoint.
 * The generated `streamJobEvents()` convenience method waits for the response body to finish, so
 * use its raw variant with `eventsource-parser` to consume the response incrementally.
 */
const waitForJob = async (
  api: ReturnType<typeof createToolpathClient>,
  jobId: string,
  onStatus: (message: string) => void,
): Promise<JobDetail> => {
  const response = await api.jobs.streamJobEventsRaw({ id: jobId })
  if (!response.raw.body) throw new Error('The Toolpath Engine returned an empty event stream.')

  let terminalJob: JobDetail | undefined

  const parser = createParser({
    onEvent: (event) => {
      if (event.event !== 'job' || terminalJob) return

      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch (error) {
        throw new Error('The Toolpath Engine returned invalid job event data.', { cause: error })
      }
      if (!payload || typeof payload !== 'object' || !instanceOfJobDetail(payload)) {
        throw new Error('The Toolpath Engine returned an invalid job event.')
      }
      const job = JobDetailFromJSON(payload)
      onStatus(statusMessage(job))
      if (job.status === 'failed' || job.status === 'succeeded') terminalJob = job
    },
    onError: (error) => {
      throw new Error(`The Toolpath Engine returned an invalid SSE event: ${error.message}`, {
        cause: error,
      })
    },
  })

  const textStream = response.raw.body.pipeThrough(new TextDecoderStream())
  try {
    for await (const chunk of textStream) {
      parser.feed(chunk)
      if (terminalJob) break
    }
  } finally {
    await textStream.cancel()
  }

  if (!terminalJob)
    throw new Error('The Toolpath Engine closed the event stream before analysis completed.')
  return terminalJob
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
    featureDetails: UpdatePartOperationFeatureDetailsEnum.True,
    idempotencyKey: randomUUID(),
  })
  onStatus(`Analysis started as job ${analysis.jobId}`)

  const job = await waitForJob(api, analysis.jobId, onStatus)
  if (job.status === 'failed') {
    throw new Error(job.error ?? 'The Toolpath Engine could not analyze this part.')
  }
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
