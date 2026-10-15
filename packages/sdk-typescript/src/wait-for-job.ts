import type { ToolpathClient } from './client.js'
import {
  JobDetailFromJSON,
  JobDetailStatusEnum,
  ResponseError,
  type JobDetail,
} from './generated/index.js'

export interface WaitForJobOptions {
  /** Called with the job each time the stream sends it: once on connecting, then on every change. */
  onUpdate?: (job: JobDetail) => void
  /**
   * Stops waiting. The request, or the stream it opened, is closed and `waitForJob` rejects with the
   * signal's reason, whether or not the response has arrived.
   */
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
  let afterCr = false
  let event = ''
  let data: Array<string> = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      // A line ends at CRLF, LF, or CR. A CR that ended the last chunk ended its line there, so an
      // LF that starts this one is the rest of that CRLF rather than another, empty line.
      const chunk: string = afterCr && value.startsWith('\n') ? value.slice(1) : value
      if (chunk === '') {
        continue
      }
      afterCr = chunk.endsWith('\r')
      const lines = (pending + chunk).split(/\r\n|\n|\r/)
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
 * The same error over a copy of its response whose body has been read in full. An unread body holds
 * its connection open until it is garbage-collected, so a caller retrying on a 404 or 410 would
 * otherwise collect connections; the copy keeps the problem details readable.
 */
const withBufferedBody = async (error: ResponseError): Promise<ResponseError> => {
  const { response } = error
  const body = await response.arrayBuffer().catch(() => new ArrayBuffer(0))
  const buffered = new Response(body.byteLength > 0 ? body : null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
  return new ResponseError(buffered, error.message)
}

/**
 * Wait for a job on the Engine API's job event stream (`GET /v1/jobs/{id}/events`) rather than by
 * calling `getJob` in a loop. Resolves with the job once it succeeds, and rejects with a
 * {@link JobFailedError} once it fails. Every job reaches one of the two — the Engine API fails a
 * job whose worker stops — and the stream ends right after it, so the one stream is all there is to
 * read.
 *
 * It rejects if the stream ends before either. That is a lost connection, or the server closing the
 * stream because the job expired or was deleted while it waited, or because it could not read the
 * job. Opening it once more is safe — a new stream starts with the job as it is now — and
 * `client.jobs.getJob()` says which it was. An error response rejects with the generated client's
 * `ResponseError`: an unknown job, an expired one, a refused key. Its body has been read and is
 * kept on `error.response`, so the problem `code` is still readable there.
 */
export const waitForJob = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  { onUpdate, signal }: WaitForJobOptions = {},
): Promise<JobDetail> => {
  signal?.throwIfAborted()
  try {
    const response = await client.jobs.streamJobEventsRaw({ id: jobId }, { signal })
    const body = response.raw.body
    if (!body) {
      throw new Error(`The event stream for job ${jobId} has no body`)
    }

    for await (const job of readJobEvents(body, signal)) {
      onUpdate?.(job)
      signal?.throwIfAborted()
      if (job.status === JobDetailStatusEnum.Succeeded) {
        return job
      }
      if (job.status === JobDetailStatusEnum.Failed) {
        throw new JobFailedError(job)
      }
    }
  } catch (error) {
    // An abort surfaces as the error of whatever it interrupted — the generated client wraps a
    // request aborted before its response in a `FetchError` — so the signal's reason replaces it.
    signal?.throwIfAborted()
    if (error instanceof ResponseError) {
      throw await withBufferedBody(error)
    }
    throw error
  }
  signal?.throwIfAborted()
  throw new Error(`The event stream for job ${jobId} ended before the job finished`)
}
