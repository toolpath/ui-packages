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
   * the job starts them over, or, with `stableMs`, one that stayed open that long. 1, 2, 4 and 8
   * seconds by default.
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
  /**
   * How much each wait varies, as a fraction from 0 to 1, so that streams lost together — many
   * waits on one server, say — do not all open again together. A delay is multiplied by a random
   * factor from `1 - jitter` to `1 + jitter`; a `Retry-After` wait by one from 1 to `1 + jitter`,
   * so it is spread too but never shorter than the server asked. 0, an exact wait, by default.
   * Any other value, or one that is not finite, rejects with a `RangeError` before anything is
   * requested.
   */
  jitter?: number
  /**
   * How long a stream must stay open, in milliseconds, for its end to start the delays over. A
   * stream that opens and drops at once then backs off all the same, even though it sent the job.
   * Unset, any stream that sent the job starts them over. `giveUpAfterMs` still counts from the
   * last stream that sent the job.
   */
  stableMs?: number
  /**
   * Treats an open stream that has sent nothing for this long, in milliseconds — no event and no
   * keep-alive comment — as lost: it is closed and opened again, as when its connection drops. The
   * Engine API sends a keep-alive every 15 seconds, so 45 seconds lets two go missing. Counted from
   * when the response arrives, not while the request waits for it. Unset, a stream is read for as
   * long as its connection lasts.
   */
  quietMs?: number
  /**
   * Reads the job once with `getJob` when a stream ends or is lost before the job is final, before
   * waiting to open the next. A final job settles the wait as if the stream had sent it, after
   * `onUpdate`; a job not yet final goes to `onUpdate` if it changed. An error response rejects as
   * it would on opening the stream — a refused key (401, 403), a job the key cannot reach (404,
   * 410), or any other 4xx but a 429 — while a 429, a 5xx or a failed connection leaves the delays
   * to go on. A 429's or 503's `Retry-After` longer than the next delay is waited instead, spread
   * by `jitter` as any `Retry-After` is. Off by default.
   */
  lookOnLoss?: boolean
}

/**
 * The client {@link waitForJob} reads the job with, or a function that gives it one. The function
 * is called before each stream is opened and before each `lookOnLoss` read, so a long wait can
 * change the key it uses. An error it throws, or a promise it returns that rejects, ends the wait
 * at once and is not retried. `signal` is not passed to it: an abort while it is pending takes
 * effect once it settles.
 */
export type WaitForJobClient =
  | Pick<ToolpathClient, 'jobs'>
  | (() => Pick<ToolpathClient, 'jobs'> | Promise<Pick<ToolpathClient, 'jobs'>>)

export interface WaitForJobOptions {
  /** Called with the job each time the stream sends it: once on connecting, then on every change. */
  onUpdate?: (job: JobDetail) => void
  /**
   * Called with `'open'` each time a stream's response arrives, and, with `reconnect`, with
   * `'lost'` when an open stream ends, drops or goes quiet before the job is final: before the
   * `lookOnLoss` read and before the wait to open the next. So between a `'lost'` and the next
   * `'open'` no stream is listening. It is not called for a stream that could not be opened, nor
   * when the wait settles or `signal` aborts; without `reconnect` a lost stream settles it.
   */
  onStream?: (state: 'open' | 'lost') => void
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
 * the stream, and so does `signal`, which ends the events as if the server had closed it. With
 * `quietMs`, a stream that sends nothing for that long is closed and throws, as a lost one does.
 */
async function* readJobEvents(
  body: NonNullable<Response['body']>,
  signal: AbortSignal | undefined,
  quietMs?: number,
): AsyncGenerator<JobDetail> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  // Not every `fetch` errors a body it has already returned when its signal aborts, so the reader
  // is cancelled here as well; that ends a pending read rather than leaving it to the next event.
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  let quiet = false
  let quietTimer: ReturnType<typeof setTimeout> | undefined
  // Anything read, a keep-alive as much as an event, shows the connection is up.
  const heard = (): void => {
    if (quietMs === undefined) {
      return
    }
    clearTimeout(quietTimer)
    quietTimer = setTimeout(
      () => {
        quiet = true
        cancel()
      },
      Math.min(quietMs, MAX_TIMEOUT_MS),
    )
  }
  heard()
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
      if (quiet) {
        const lost = new Error(`The event stream sent nothing for ${quietMs} ms`)
        streamLossErrors.add(lost)
        throw lost
      }
      if (done) {
        return
      }
      heard()
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
    clearTimeout(quietTimer)
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
 *
 * `client` may be a function that gives the client for each request, so a long wait can change
 * its key. A refused key (401, 403) still ends the wait rather than asking the function for
 * another: the caller decides whether to wait again with a different key. An error from the
 * function itself ends the wait too, and a function still pending sees an abort only once it
 * settles.
 */
export const waitForJob = async (
  client: WaitForJobClient,
  jobId: string,
  { onUpdate, onStream, signal, reconnect }: WaitForJobOptions = {},
): Promise<JobDetail> => {
  if (!reconnect) {
    return streamJob(
      typeof client === 'function' ? await client() : client,
      jobId,
      onUpdate,
      signal,
      { onOpen: () => onStream?.('open') },
    )
  }
  const policy = reconnect === true ? {} : reconnect
  const { stableMs, quietMs, lookOnLoss, jitter = 0 } = policy
  if (!(Number.isFinite(jitter) && jitter >= 0 && jitter <= 1)) {
    throw new RangeError(`reconnect.jitter must be from 0 to 1, not ${jitter}`)
  }
  let attempts = 0
  // When the connection was last known good: the start, or the end of a stream that sent the job.
  let lastGoodAt = performance.now()
  // The job as `onUpdate` was last told it, so a look tells it only of a change.
  let latest: JobDetail | undefined
  for (;;) {
    let sent = false
    let openedAt: number | undefined
    // An error the caller's `onUpdate` or `onStream` threw is theirs: it ends the wait rather than
    // a stream.
    let callerError: { error: unknown } | null = null
    const current = typeof client === 'function' ? await client() : client
    try {
      return await streamJob(
        current,
        jobId,
        (job) => {
          sent = true
          latest = job
          try {
            onUpdate?.(job)
          } catch (error) {
            callerError = { error }
            throw error
          }
        },
        signal,
        {
          quietMs,
          onOpen: () => {
            openedAt = performance.now()
            try {
              onStream?.('open')
            } catch (error) {
              callerError = { error }
              throw error
            }
          },
        },
      )
    } catch (error) {
      signal?.throwIfAborted()
      if (callerError) {
        throw error
      }
      if (sent) {
        lastGoodAt = performance.now()
      }
      const stable =
        stableMs === undefined
          ? sent
          : openedAt !== undefined && performance.now() - openedAt >= stableMs
      if (stable) {
        attempts = 0
      }
      const lost = lostStream(error)
      if (lost) {
        onStream?.('lost')
      }
      // The look's error, a 429 or 5xx, whose `Retry-After` may ask for longer than the delay.
      let lookError: unknown
      if (lookOnLoss && lost) {
        const look = await lookAt(
          typeof client === 'function' ? await client() : client,
          jobId,
          signal,
        )
        signal?.throwIfAborted()
        const job = 'job' in look ? look.job : undefined
        lookError = 'error' in look ? look.error : undefined
        if (job && JSON.stringify(job) !== JSON.stringify(latest)) {
          latest = job
          onUpdate?.(job)
          signal?.throwIfAborted()
        }
        if (job?.status === JobDetailStatusEnum.Succeeded) {
          return job
        }
        if (job?.status === JobDetailStatusEnum.Failed) {
          throw new JobFailedError(job)
        }
      }
      const wait = reconnectDelay(
        error,
        attempts,
        performance.now() - lastGoodAt,
        policy,
        retryAfterMs(lookError),
      )
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
 * `sinceGoodMs` ago. `lookRetryAfterMs` is the `Retry-After` a `lookOnLoss` read was answered
 * with, waited instead where it is the longer.
 */
const reconnectDelay = (
  error: unknown,
  attempts: number,
  sinceGoodMs: number,
  { delaysMs = RECONNECT_DELAYS_MS, giveUpAfterMs, jitter = 0 }: WaitForJobReconnect,
  lookRetryAfterMs?: number,
): number | undefined => {
  if (!reopens(error)) {
    return undefined
  }
  const scheduled =
    retryAfterMs(error) ??
    delaysMs[Math.min(attempts, delaysMs.length - 1)] ??
    RECONNECT_DELAYS_MS[0]!
  const retryAfter =
    lookRetryAfterMs !== undefined && lookRetryAfterMs > scheduled
      ? lookRetryAfterMs
      : retryAfterMs(error)
  const delay = retryAfter ?? scheduled
  // A `Retry-After` is only ever lengthened: the server asked for at least that long.
  const spread = (): number =>
    retryAfter === undefined ? 1 - jitter + 2 * jitter * Math.random() : 1 + jitter * Math.random()
  const wait = jitter > 0 ? delay * spread() : delay
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
  return lostStream(error)
}

/** Whether `error` ended a stream that had opened: it closed early, dropped, or went quiet. */
const lostStream = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && streamLossErrors.has(error)

/**
 * The job as `getJob` reads it now, or the error where the read failed in a way the next stream
 * may not: a 429, a 5xx or a failed connection. Any other error rejects, as it would on opening the
 * stream.
 */
const lookAt = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  signal: AbortSignal | undefined,
): Promise<{ job: JobDetail } | { error: unknown }> => {
  signal?.throwIfAborted()
  try {
    return { job: await client.jobs.getJob({ id: jobId }, { signal }) }
  } catch (error) {
    signal?.throwIfAborted()
    if (reopens(error)) {
      return { error: error instanceof ResponseError ? await withBufferedBody(error) : error }
    }
    throw error instanceof ResponseError ? await withBufferedBody(error) : error
  }
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

/**
 * One stream of the job's events, read until the job is final or the stream ends. `onOpen` is
 * called once its response has arrived, and `quietMs` closes it once it has sent nothing for that
 * long.
 */
const streamJob = async (
  client: Pick<ToolpathClient, 'jobs'>,
  jobId: string,
  onUpdate: ((job: JobDetail) => void) | undefined,
  signal: AbortSignal | undefined,
  { quietMs, onOpen }: { quietMs?: number; onOpen?: () => void } = {},
): Promise<JobDetail> => {
  signal?.throwIfAborted()
  try {
    const response = await client.jobs.streamJobEventsRaw({ id: jobId }, { signal })
    const body = response.raw.body
    if (!body) {
      throw new Error(`The event stream for job ${jobId} has no body`)
    }
    try {
      onOpen?.()
    } catch (error) {
      // Not yet handed to the reader, so nothing else would close it.
      await body.cancel().catch(() => undefined)
      throw error
    }

    for await (const job of readJobEvents(body, signal, quietMs)) {
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
