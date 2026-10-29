import { afterEach, describe, expect, it, vi } from 'vitest'
import { createToolpathClient } from '../src/client.js'
import { FetchError, RequiredError, ResponseError, type JobDetail } from '../src/generated/index.js'
import { JobFailedError, waitForJob } from '../src/wait-for-job.js'

const job = (status: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    partUuid: 'part-1',
    holderUuid: null,
    jobUuid: 'job-1',
    productType: 'analyze-part',
    status,
    progress: null,
    error: null,
    reportId: null,
    importId: null,
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
    durationMs: 0,
    ...extra,
  })

const jobEvent = (status: string, extra?: Record<string, unknown>): string =>
  `event: job\ndata: ${job(status, extra)}\n\n`

interface StreamResponse {
  response: Response
  /** Resolves once the client cancels the body, i.e. closes the connection. */
  cancelled: Promise<void>
}

/** An event-stream response that sends `chunks` and then closes, or stays open when `open`. */
const streamResponse = (chunks: Array<string>, { open = false } = {}): StreamResponse => {
  const encoder = new TextEncoder()
  let markCancelled = (): void => undefined
  const cancelled = new Promise<void>((resolve) => {
    markCancelled = resolve
  })
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      if (!open) {
        controller.close()
      }
    },
    cancel: () => markCancelled(),
  })
  return {
    response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    cancelled,
  }
}

const clientWith = (...responses: Array<Response>) => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const response of responses) {
    fetch.mockResolvedValueOnce(response)
  }
  const client = createToolpathClient({
    apiKey: 'tp_test',
    baseUrl: 'https://api.example.test',
    fetch,
  })
  return { client, fetch }
}

describe('waitForJob', () => {
  it('streams the job until it succeeds and resolves with it', async () => {
    const { response } = streamResponse([
      jobEvent('queued'),
      ': keepalive\n\n',
      jobEvent('running', { progress: 40, retriesRemaining: 2 }),
      jobEvent('succeeded', { progress: 100, reportId: 'report-1' }),
    ])
    const { client, fetch } = clientWith(response)
    const updates: Array<JobDetail> = []

    const finished = await waitForJob(client, 'job-1', {
      onUpdate: (update) => updates.push(update),
    })

    expect(finished).toMatchObject({ jobUuid: 'job-1', status: 'succeeded', reportId: 'report-1' })
    expect(finished.createdAt).toEqual(new Date('2026-10-09T12:00:00.000Z'))
    expect(updates.map(({ status, progress }) => [status, progress])).toEqual([
      ['queued', null],
      ['running', 40],
      ['succeeded', 100],
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('https://api.example.test/v1/jobs/job-1/events')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tp_test' })
  })

  it('reads events however the bytes are split, across CRLF line endings', async () => {
    const wire = `: keepalive\r\n\r\nevent: other\r\ndata: {}\r\n\r\n${jobEvent('running').replaceAll('\n', '\r\n')}${jobEvent('succeeded')}`
    // One byte at a time splits every CRLF, every field name, and the JSON itself.
    const { response } = streamResponse([...wire])
    const { client } = clientWith(response)
    const statuses: Array<string> = []

    await waitForJob(client, 'job-1', { onUpdate: ({ status }) => statuses.push(status) })

    expect(statuses).toEqual(['running', 'succeeded'])
  })

  it('dispatches an event ended by a bare CR without waiting for the next chunk', async () => {
    // Left open: the event must be handled from this chunk alone.
    const stream = streamResponse([jobEvent('succeeded').replaceAll('\n', '\r')], { open: true })
    const { client } = clientWith(stream.response)

    await expect(waitForJob(client, 'job-1')).resolves.toMatchObject({ status: 'succeeded' })
  })

  it('rejects with the failed job', async () => {
    const { response } = streamResponse([
      jobEvent('running'),
      jobEvent('failed', { error: 'kernel_error: no solid body', retriesRemaining: 0 }),
    ])
    const { client, fetch } = clientWith(response)

    const failure = await waitForJob(client, 'job-1').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(JobFailedError)
    expect(failure).toMatchObject({
      message: 'kernel_error: no solid body',
      job: { jobUuid: 'job-1', status: 'failed' },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('closes the stream once the job is final, without waiting for the server to', async () => {
    const stream = streamResponse([jobEvent('succeeded')], { open: true })
    const { client } = clientWith(stream.response)

    await expect(waitForJob(client, 'job-1')).resolves.toMatchObject({ status: 'succeeded' })
    await stream.cancelled
  })

  it('rejects, without opening another, when the stream ends before the job is final', async () => {
    const { client, fetch } = clientWith(
      streamResponse([jobEvent('running', { progress: 10 })]).response,
    )
    const progress: Array<number | null> = []

    await expect(
      waitForJob(client, 'job-1', { onUpdate: (update) => progress.push(update.progress) }),
    ).rejects.toThrow('The event stream for job job-1 ended before the job finished')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(progress).toEqual([10])
  })

  it('rejects with the response error, its body read and still readable, when the stream cannot be opened', async () => {
    const notFound = new Response(JSON.stringify({ code: 'job_not_found', status: 404 }), {
      status: 404,
      headers: { 'Content-Type': 'application/problem+json' },
    })
    const { client } = clientWith(notFound)

    const failure = await waitForJob(client, 'job-1').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ResponseError)
    const { response } = failure as ResponseError
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    // The server's body was drained, so its connection is free; the problem is on the copy.
    expect(notFound.bodyUsed).toBe(true)
    await expect(response.json()).resolves.toEqual({ code: 'job_not_found', status: 404 })
  })

  it('stops waiting when its signal is aborted', async () => {
    const stream = streamResponse([jobEvent('running')], { open: true })
    const { client } = clientWith(stream.response)
    const controller = new AbortController()
    const reason = new Error('Stopped waiting')

    // Aborts once the first event has been handled, while the next read is waiting on the server.
    const waiting = waitForJob(client, 'job-1', {
      signal: controller.signal,
      onUpdate: () => queueMicrotask(() => controller.abort(reason)),
    })

    await expect(waiting).rejects.toBe(reason)
    await stream.cancelled
  })

  it("rejects with the signal's reason when aborted before the response arrives", async () => {
    const controller = new AbortController()
    const reason = new Error('Stopped waiting')
    // As `fetch` does, the pending request rejects with the abort's reason, which the generated
    // client would otherwise wrap in a `FetchError`.
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
          controller.abort(reason)
        }),
    )
    const client = createToolpathClient({
      apiKey: 'tp_test',
      baseUrl: 'https://api.example.test',
      fetch,
    })

    await expect(waitForJob(client, 'job-1', { signal: controller.signal })).rejects.toBe(reason)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

/** A client whose `fetch` answers each request with the next of `results`, rejecting for an error. */
const clientAnswering = (...results: Array<Response | Error>) => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const result of results) {
    if (result instanceof Error) {
      fetch.mockRejectedValueOnce(result)
    } else {
      fetch.mockResolvedValueOnce(result)
    }
  }
  const client = createToolpathClient({
    apiKey: 'tp_test',
    baseUrl: 'https://api.example.test',
    fetch,
  })
  return { client, fetch }
}

const problem = (status: number, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })

describe('waitForJob with reconnect', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the stream again when it ends early, sending every update, until the job is final', async () => {
    const { client, fetch } = clientAnswering(
      streamResponse([jobEvent('running', { progress: 10 })]).response,
      streamResponse([jobEvent('running', { progress: 60 }), jobEvent('succeeded')]).response,
    )
    const progress: Array<number | null> = []

    const finished = await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [0] },
      onUpdate: (update) => progress.push(update.progress),
    })

    expect(finished.status).toBe('succeeded')
    expect(progress).toEqual([10, 60, null])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('opens it again when the connection fails, and on a 5xx', async () => {
    const { client, fetch } = clientAnswering(
      new TypeError('fetch failed'),
      problem(503),
      streamResponse([jobEvent('succeeded')]).response,
    )

    await expect(
      waitForJob(client, 'job-1', { reconnect: { delaysMs: [0] } }),
    ).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each([401, 403, 404, 410])(
    'rejects a %i at once, since asking again will not change it',
    async (status) => {
      const { client, fetch } = clientAnswering(problem(status))

      const failure = await waitForJob(client, 'job-1', { reconnect: true }).catch(
        (error: unknown) => error,
      )

      expect(failure).toBeInstanceOf(ResponseError)
      expect((failure as ResponseError).response.status).toBe(status)
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )

  it("waits for a 429's Retry-After before opening the stream again", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    const { client, fetch } = clientAnswering(
      problem(429, { 'Retry-After': '2' }),
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [0] } })
    await vi.advanceTimersByTimeAsync(1_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reads a Retry-After given as an HTTP date', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'))
    const { client, fetch } = clientAnswering(
      problem(503, { 'Retry-After': 'Tue, 27 Oct 2026 12:00:03 GMT' }),
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [0] } })
    await vi.advanceTimersByTimeAsync(2_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('waits as long as a timer can for a Retry-After past that, rather than asking again at once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    const { client, fetch } = clientAnswering(
      problem(429, { 'Retry-After': String(30 * 24 * 60 * 60) }),
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', { reconnect: true })
    // `setTimeout` fires at once for a delay past 2^31-1 ms, about 24.8 days.
    await vi.advanceTimersByTimeAsync(2 ** 31 - 2)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('starts the delays over after a stream that sent the job', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    const { client, fetch } = clientAnswering(
      streamResponse([]).response,
      streamResponse([jobEvent('running')]).response,
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [100, 1_000] } })
    await vi.advanceTimersByTimeAsync(100)
    expect(fetch).toHaveBeenCalledTimes(2)
    // The second stream sent the job, so the next wait is the first delay again, not the second.
    await vi.advanceTimersByTimeAsync(100)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('gives up once giveUpAfterMs would pass without word of the job', async () => {
    const { client, fetch } = clientAnswering(streamResponse([]).response)

    await expect(
      waitForJob(client, 'job-1', { reconnect: { delaysMs: [10], giveUpAfterMs: 0 } }),
    ).rejects.toThrow('The event stream for job job-1 ended before the job finished')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('gives up at once when a Retry-After falls past giveUpAfterMs, without a last stream', async () => {
    const { client, fetch } = clientAnswering(problem(429, { 'Retry-After': '120' }))

    const failure = await waitForJob(client, 'job-1', {
      reconnect: { giveUpAfterMs: 60_000 },
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ResponseError)
    expect((failure as ResponseError).response.status).toBe(429)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not count a quiet job on an open stream against giveUpAfterMs', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    const encoder = new TextEncoder()
    let drop = (): void => undefined
    const quiet = new Response(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          controller.enqueue(encoder.encode(jobEvent('queued')))
          drop = () => controller.close()
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
    const { client, fetch } = clientAnswering(
      quiet,
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [1_000], giveUpAfterMs: 60_000 },
    })
    // Twenty quiet minutes on a healthy stream, then it drops.
    await vi.advanceTimersByTimeAsync(20 * 60_000)
    drop()
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('opens one last stream at the deadline before giving up', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    const { client, fetch } = clientAnswering(
      ...Array.from({ length: 5 }, () => streamResponse([]).response),
    )

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [2_000], giveUpAfterMs: 5_000 },
    }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(5_000)

    // At 0, 2 and 4 seconds, and the last at the deadline, 5.
    expect(await waiting).toMatchObject({
      message: 'The event stream for job job-1 ended before the job finished',
    })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('opens the stream again when its connection drops while it is read', async () => {
    const encoder = new TextEncoder()
    const dropped = new Response(
      new ReadableStream<Uint8Array>({
        start: (controller) => {
          controller.enqueue(encoder.encode(jobEvent('running')))
          controller.error(new TypeError('terminated'))
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
    const { client, fetch } = clientAnswering(
      dropped,
      streamResponse([jobEvent('succeeded')]).response,
    )

    await expect(
      waitForJob(client, 'job-1', { reconnect: { delaysMs: [0] } }),
    ).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("rejects a caller's mistake at once rather than waiting on it", async () => {
    const { client, fetch } = clientAnswering()

    await expect(
      waitForJob(client, undefined as unknown as string, { reconnect: true }),
    ).rejects.toBeInstanceOf(RequiredError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a baseUrl fetch cannot parse at once, rather than retrying it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((url, init) => globalThis.fetch(url, init))
    // No scheme, so Node's `fetch` refuses it before any connection.
    const client = createToolpathClient({ apiKey: 'tp_test', baseUrl: 'api.example.test', fetch })

    await expect(waitForJob(client, 'job-1', { reconnect: true })).rejects.toBeInstanceOf(
      FetchError,
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ends the wait with an error onUpdate throws, rather than opening another stream', async () => {
    const { client, fetch } = clientAnswering(streamResponse([jobEvent('running')]).response)
    const mistake = new Error('The caller could not handle the update')

    await expect(
      waitForJob(client, 'job-1', {
        reconnect: { delaysMs: [0] },
        onUpdate: () => {
          throw mistake
        },
      }),
    ).rejects.toBe(mistake)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops waiting between streams when its signal is aborted', async () => {
    const { client, fetch } = clientAnswering(streamResponse([]).response)
    const controller = new AbortController()
    const reason = new Error('Stopped waiting')

    const waiting = waitForJob(client, 'job-1', {
      signal: controller.signal,
      reconnect: { delaysMs: [60_000] },
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    controller.abort(reason)

    await expect(waiting).rejects.toBe(reason)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
