import type { ToolpathClient } from './client.js'
import {
  FetchError,
  JobDetailFromJSON,
  JobDetailStatusEnum,
  ResponseError,
  type JobDetail,
} from './generated/index.js'

export interface WaitForJobReconnect {
  /**
   * How long to wait before each new stream, in milliseconds; the last repeats. A stream that sent
   * the job starts them over. 1, 2, 4 and 8 seconds by default.
   */
  delaysMs?: ReadonlyArray<number>
  /**
   * Gives up once reconnecting has failed for this long, in milliseconds, counted from when the
   * last stream that sent the job ended, or from the start. One last stream is opened at that
   * time; the wait then rejects with the error that ended it. A quiet job on an open stream never
   * counts against it. A 429 or 503 whose `Retry-After` falls past that time rejects at once,
   * without the last stream. Unset, it waits until the job is final or `signal` aborts.
   */
  giveUpAfterMs?: number
}

export interface WaitForJobOptions {
  /** Called with the job each time the stream sends it: once on connecting, then on every change. */
  onUpdate?: (job: JobDetail) => void
  /**
   * Stops waiting. The request, or the stream it opened, is closed and `waitForJob` rejects with the
   * signal's reason, whether or not the response has arrived.
   */
  signal?: AbortSignal
  /**
   * Opens the stream again, rather than rejecting, when it ends before the job is final, when the
   * connection fails, and on a 429 — after its `Retry-After` — or a 5xx response. Every other
   * error response rejects as without it: a refused key (401, 403) or a job the key cannot reach
   * (404, 410) will not change by asking again, and neither will a URL `fetch` cannot parse. `true`
   * uses the default delays.
   */
  reconnect?: boolean | WaitForJobReconnect
}

/** The waits before each new stream when `reconnect` names none, in milliseconds. */
const RECONNECT_DELAYS_MS: ReadonlyArray<number> = [1_000, 2_000, 4_000, 8_000]

/** The longest `setTimeout` waits; past it, a timer fires at once. About 24.8 days. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

/**
 * The errors that ended a stream before the job was final: it closed early, or its connection
 * dropped while it was read. Marked rather than wrapped, so a wait without `reconnect` rejects with
 * the very errors it always has.
 */
const streamLossErrors = new WeakSet<object>()

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
      const { done, value } = await reader.read().catch((error: unknown) => {
        if (typeof error === 'object' && error !== null) {
          streamLossErrors.add(error)
        }
        throw error
      })
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
 *
 * With `reconnect` it opens the stream again itself instead, until the job is final, an error
 * response says asking again will not help, reconnecting has failed for `giveUpAfterMs`, or
 * `signal` aborts. A job the server can no longer find answers the new stream with a 404 or 410,
 * which ends the wait.
 */
export const waitForJob = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  { onUpdate, signal, reconnect }: WaitForJobOptions = {},
): Promise<JobDetail> => {
  if (!reconnect) {
    return streamJob(client, jobId, onUpdate, signal)
  }
  const policy = reconnect === true ? {} : reconnect
  let attempts = 0
  // When the connection was last known good: the start, or the end of a stream that sent the job.
  let lastGoodAt = performance.now()
  for (;;) {
    let sent = false
    // An error the caller's `onUpdate` threw is theirs: it ends the wait rather than a stream.
    let callerError: { error: unknown } | null = null
    try {
      return await streamJob(
        client,
        jobId,
        (job) => {
          sent = true
          try {
            onUpdate?.(job)
          } catch (error) {
            callerError = { error }
            throw error
          }
        },
        signal,
      )
    } catch (error) {
      signal?.throwIfAborted()
      if (callerError) {
        throw error
      }
      if (sent) {
        attempts = 0
        lastGoodAt = performance.now()
      }
      const wait = reconnectDelay(error, attempts, performance.now() - lastGoodAt, policy)
      if (wait === undefined) {
        throw error
      }
      attempts += 1
      await sleep(wait, signal)
    }
  }
}

/**
 * How long to wait before opening the stream again after `error`, in milliseconds, or `undefined`
 * to give up. `attempts` streams have failed since the last that sent the job, which ended
 * `sinceGoodMs` ago.
 */
const reconnectDelay = (
  error: unknown,
  attempts: number,
  sinceGoodMs: number,
  { delaysMs = RECONNECT_DELAYS_MS, giveUpAfterMs }: WaitForJobReconnect,
): number | undefined => {
  if (!reopens(error)) {
    return undefined
  }
  const retryAfter = retryAfterMs(error)
  const wait =
    retryAfter ?? delaysMs[Math.min(attempts, delaysMs.length - 1)] ?? RECONNECT_DELAYS_MS[0]!
  if (giveUpAfterMs === undefined) {
    return wait
  }
  const left = giveUpAfterMs - sinceGoodMs
  // A server's `Retry-After` past the deadline is respected by not asking again at all.
  if (left <= 0 || (retryAfter !== undefined && retryAfter > left)) {
    return undefined
  }
  return Math.min(wait, left)
}

/**
 * Whether a stream that ended in `error` is worth opening again: a 429 or 5xx, a connection that
 * failed to open, or a stream that ended or dropped early. Anything else — a failed job, an event
 * that was not one, a caller's mistake — would end the next stream the same way.
 */
const reopens = (error: unknown): boolean => {
  if (error instanceof ResponseError) {
    return error.response.status === 429 || error.response.status >= 500
  }
  if (error instanceof FetchError) {
    return !refusedUrl(error)
  }
  return typeof error === 'object' && error !== null && streamLossErrors.has(error)
}

/**
 * Whether `fetch` could not parse the request's URL — a `baseUrl` without its scheme, say — which
 * no new try will change. Node marks it with a code, on the error or on the one it wraps; a browser
 * resolves such a `baseUrl` against the page instead, and the 404 that comes back ends the wait.
 * Other rejections are left to retry: a runtime words a dropped connection and a request it would
 * not send alike, as a `TypeError`.
 */
const refusedUrl = ({ cause }: FetchError): boolean => {
  const wrapped: unknown = cause.cause
  return [cause, wrapped].some(
    (error) =>
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === 'ERR_INVALID_URL',
  )
}

/** A 429's or 503's `Retry-After`, in milliseconds: delay-seconds or an HTTP date. */
const retryAfterMs = (error: unknown): number | undefined => {
  const header = error instanceof ResponseError ? error.response.headers.get('Retry-After') : null
  if (!header) {
    return undefined
  }
  const seconds = Number(header)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000)
  }
  const at = Date.parse(header)
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now())
}

/**
 * Resolves after `ms`, at most {@link MAX_TIMEOUT_MS}, or rejects with `signal`'s reason as soon as
 * it aborts.
 */
const sleep = (ms: number, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const stop = (): void => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(
      () => {
        signal?.removeEventListener('abort', stop)
        resolve()
      },
      Math.min(ms, MAX_TIMEOUT_MS),
    )
    signal?.addEventListener('abort', stop, { once: true })
  })

/** One stream of the job's events, read until the job is final or the stream ends. */
const streamJob = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  onUpdate: ((job: JobDetail) => void) | undefined,
  signal: AbortSignal | undefined,
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
  const ended = new Error(`The event stream for job ${jobId} ended before the job finished`)
  streamLossErrors.add(ended)
  throw ended
}
