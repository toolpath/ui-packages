import type { ToolpathClient } from './client.js'
import { JobDetailFromJSON, JobDetailStatusEnum, type JobDetail } from './generated/index.js'

export interface WaitForJobOptions {
  /** Called with the job each time the stream sends it: once on connecting, then on every change. */
  onUpdate?: (job: JobDetail) => void
  /** Stops waiting. The open stream is closed and `waitForJob` rejects with the signal's reason. */
  signal?: AbortSignal
}

/** Thrown by {@link waitForJob} when the job fails. `failed` is final: the job will not run again. */
export class JobFailedError extends Error {
  override name = 'JobFailedError'
  readonly job: JobDetail

  constructor(job: JobDetail) {
    super(job.error ?? `Job ${job.jobUuid} failed`)
    this.job = job
  }
}

/**
 * The `job` events of a server-sent event stream, parsed as the bytes arrive. Comment lines — the
 * server's keep-alives — and events of any other name are skipped. Leaving the loop early closes
 * the stream, and so does `signal`, which ends the events as if the server had closed it.
 */
async function* readJobEvents(
  body: NonNullable<Response['body']>,
  signal: AbortSignal | undefined,
): AsyncGenerator<JobDetail> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  // Not every `fetch` errors a body it has already returned when its signal aborts, so the reader
  // is cancelled here as well; that ends a pending read rather than leaving it to the next event.
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  let pending = ''
  let event = ''
  let data: Array<string> = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      // A line ends at CRLF, LF, or CR. A CR that ends the chunk may be half of a CRLF, so it waits
      // in `pending` for the next one.
      const lines = (pending + value).split(/\r\n|\n|\r(?!$)/)
      pending = lines.pop() ?? ''
      for (const line of lines) {
        if (line === '') {
          if (event === 'job' && data.length > 0) {
            yield JobDetailFromJSON(JSON.parse(data.join('\n')))
          }
          event = ''
          data = []
        } else if (!line.startsWith(':')) {
          const colon = line.indexOf(':')
          const field = colon === -1 ? line : line.slice(0, colon)
          const fieldValue = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
          if (field === 'event') {
            event = fieldValue
          } else if (field === 'data') {
            data.push(fieldValue)
          }
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
  }
}

/**
 * Wait for a job on the Engine API's job event stream (`GET /v1/jobs/{id}/events`) rather than by
 * calling `getJob` in a loop. Resolves with the job once it succeeds, and rejects with a
 * {@link JobFailedError} once it fails; both are final. The server ends every stream after five
 * minutes, so a stream that closes before either is opened again, starting from the job as it is
 * now. An error response — an unknown job, an expired one, a refused key — rejects with the
 * generated client's `ResponseError`.
 */
export const waitForJob = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  { onUpdate, signal }: WaitForJobOptions = {},
): Promise<JobDetail> => {
  for (;;) {
    signal?.throwIfAborted()
    const response = await client.jobs.streamJobEventsRaw({ id: jobId }, { signal })
    const body = response.raw.body
    if (!body) {
      throw new Error(`The event stream for job ${jobId} has no body`)
    }

    let received = false
    for await (const job of readJobEvents(body, signal)) {
      received = true
      onUpdate?.(job)
      signal?.throwIfAborted()
      if (job.status === JobDetailStatusEnum.Succeeded) {
        return job
      }
      if (job.status === JobDetailStatusEnum.Failed) {
        throw new JobFailedError(job)
      }
    }
    signal?.throwIfAborted()
    // The server sends the job the moment a stream opens, so one that closed without it is not the
    // five-minute limit. Reopening it would only repeat whatever closed it.
    if (!received) {
      throw new Error(`The event stream for job ${jobId} closed without sending the job`)
    }
  }
}
