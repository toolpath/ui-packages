import { afterEach, describe, expect, it, vi } from 'vitest'
import { createToolpathClient } from '../src/client.js'
import { FetchError, RequiredError, ResponseError, type JobDetail } from '../src/generated/index.js'
import { JobFailedError, waitForJob } from '../src/wait-for-job.js'

const job = (status: string, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    partUuid: 'part-1',
    holderUuid: null,
    fileUuid: null,
    jobUuid: 'job-1',
    productType: 'analyze-part',
    status,
    progress: null,
    retriesRemaining: null,
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

/** An event-stream response held open, to which the test sends text and which it can close. */
const liveStream = () => {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let markCancelled = (): void => undefined
  const cancelled = new Promise<void>((resolve) => {
    markCancelled = resolve
  })
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start: (opened) => {
        controller = opened
      },
      cancel: () => markCancelled(),
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
  return {
    response,
    cancelled,
    send: (text: string) => controller?.enqueue(encoder.encode(text)),
    close: () => controller?.close(),
  }
}

/** A `getJob` answer. */
const jobResponse = (status: string, extra?: Record<string, unknown>): Response =>
  new Response(job(status, extra), { headers: { 'Content-Type': 'application/json' } })

const fakeTime = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
}

describe('waitForJob with jitter', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('waits exactly the delay, without drawing a random number, when jitter is unset', async () => {
    fakeTime()
    const random = vi.spyOn(Math, 'random')
    const { client, fetch } = clientAnswering(
      streamResponse([]).response,
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [1_000] } })
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(random).not.toHaveBeenCalled()
  })

  it.each([
    [0, 800],
    [0.5, 1_000],
    [0.75, 1_100],
  ])(
    'with a random draw of %f, waits %i ms of a 1 s delay at a jitter of 0.2',
    async (draw, ms) => {
      fakeTime()
      vi.spyOn(Math, 'random').mockReturnValue(draw)
      const { client, fetch } = clientAnswering(
        streamResponse([]).response,
        streamResponse([jobEvent('succeeded')]).response,
      )

      const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [1_000], jitter: 0.2 } })
      await vi.advanceTimersByTimeAsync(ms - 1)
      expect(fetch).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
      expect(fetch).toHaveBeenCalledTimes(2)
    },
  )

  it.each([
    [0, 2_000],
    [0.5, 2_500],
    [0.99, 2_990],
  ])(
    'only lengthens a Retry-After: with a random draw of %f, waits %i ms of a 2 s one at a jitter of 0.5',
    async (draw, ms) => {
      fakeTime()
      vi.spyOn(Math, 'random').mockReturnValue(draw)
      const { client, fetch } = clientAnswering(
        problem(429, { 'Retry-After': '2' }),
        streamResponse([jobEvent('succeeded')]).response,
      )

      const waiting = waitForJob(client, 'job-1', { reconnect: { delaysMs: [0], jitter: 0.5 } })
      await vi.advanceTimersByTimeAsync(ms - 1)
      expect(fetch).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)

      await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
      expect(fetch).toHaveBeenCalledTimes(2)
    },
  )
})

describe('waitForJob with stableMs', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('goes on to the next delay after a stream that sent the job but dropped before stableMs', async () => {
    fakeTime()
    const { client, fetch } = clientAnswering(
      streamResponse([]).response,
      streamResponse([jobEvent('running')]).response,
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [100, 1_000], stableMs: 30_000 },
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(fetch).toHaveBeenCalledTimes(2)
    // The second stream sent the job, but at once: the next wait is the second delay.
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('starts the delays over after a stream that stayed open stableMs', async () => {
    fakeTime()
    const stable = liveStream()
    const { client, fetch } = clientAnswering(
      streamResponse([]).response,
      stable.response,
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [100, 1_000], stableMs: 30_000 },
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(30_000)
    stable.close()
    await vi.advanceTimersByTimeAsync(100)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})

describe('waitForJob with quietMs', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('closes a stream that sends nothing for quietMs and opens another', async () => {
    fakeTime()
    const quiet = liveStream()
    const { client, fetch } = clientAnswering(
      quiet.response,
      streamResponse([jobEvent('succeeded')]).response,
    )
    quiet.send(jobEvent('running'))

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [1_000], quietMs: 45_000 },
    })
    await vi.advanceTimersByTimeAsync(44_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await quiet.cancelled
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps a stream open while its keep-alives arrive', async () => {
    fakeTime()
    const stream = liveStream()
    const { client, fetch } = clientAnswering(stream.response)
    stream.send(jobEvent('running'))

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [0], quietMs: 45_000 },
    })
    for (let beat = 0; beat < 8; beat += 1) {
      await vi.advanceTimersByTimeAsync(15_000)
      stream.send(': keepalive\n\n')
    }
    stream.send(jobEvent('succeeded'))

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('waitForJob with lookOnLoss', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const lostThenLook = (...looks: Array<Response | Error>) =>
    clientAnswering(streamResponse([jobEvent('running', { progress: 10 })]).response, ...looks)

  it('resolves with a succeeded job the look finds, after onUpdate, without another stream', async () => {
    const { client, fetch } = lostThenLook(jobResponse('succeeded', { reportId: 'report-1' }))
    const updates: Array<string> = []

    const finished = await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [60_000], lookOnLoss: true },
      onUpdate: ({ status }) => updates.push(status),
    })

    expect(finished).toMatchObject({ status: 'succeeded', reportId: 'report-1' })
    expect(updates).toEqual(['running', 'succeeded'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[0]).toBe('https://api.example.test/v1/jobs/job-1')
  })

  it('rejects with a failed job the look finds, after onUpdate', async () => {
    const { client, fetch } = lostThenLook(
      jobResponse('failed', { error: 'kernel_error: no body' }),
    )
    const updates: Array<string> = []

    const failure = await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [60_000], lookOnLoss: true },
      onUpdate: ({ status }) => updates.push(status),
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(JobFailedError)
    expect(failure).toMatchObject({ message: 'kernel_error: no body' })
    expect(updates).toEqual(['running', 'failed'])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([404, 410, 401])('rejects with a %i the look answers, its body read', async (status) => {
    const { client, fetch } = lostThenLook(problem(status))

    const failure = await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [60_000], lookOnLoss: true },
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ResponseError)
    const { response } = failure as ResponseError
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ status })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['a 503', problem(503)],
    ['a failed connection', new TypeError('fetch failed')],
  ])('goes on to the next stream after the delay when the look meets %s', async (_name, look) => {
    fakeTime()
    const { client, fetch } = lostThenLook(look, streamResponse([jobEvent('succeeded')]).response)

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [1_000], lookOnLoss: true },
    })
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('tells onUpdate of a job not yet final only when it changed, and opens the next stream', async () => {
    const { client, fetch } = clientAnswering(
      streamResponse([jobEvent('running', { progress: 10 })]).response,
      jobResponse('running', { progress: 10 }),
      streamResponse([]).response,
      jobResponse('running', { progress: 50 }),
      streamResponse([jobEvent('succeeded')]).response,
    )
    const progress: Array<number | null> = []

    const finished = await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [0], lookOnLoss: true },
      onUpdate: (update) => progress.push(update.progress),
    })

    expect(finished.status).toBe('succeeded')
    expect(progress).toEqual([10, 50, null])
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('does not look after a stream that could not be opened', async () => {
    const { client, fetch } = clientAnswering(
      problem(503),
      streamResponse([jobEvent('succeeded')]).response,
    )

    await waitForJob(client, 'job-1', { reconnect: { delaysMs: [0], lookOnLoss: true } })

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/v1/jobs/job-1/events',
      'https://api.example.test/v1/jobs/job-1/events',
    ])
  })
})

describe('waitForJob with a client function', () => {
  it('asks it for the client before every stream and every look', async () => {
    const { client: first, fetch: firstFetch } = clientAnswering(
      streamResponse([jobEvent('running')]).response,
    )
    const { client: second, fetch: secondFetch } = clientAnswering(
      jobResponse('running'),
      streamResponse([jobEvent('succeeded')]).response,
    )
    const clients = [first, second, second]
    const choose = vi.fn(async () => clients.shift() ?? second)

    await expect(
      waitForJob(choose, 'job-1', { reconnect: { delaysMs: [0], lookOnLoss: true } }),
    ).resolves.toMatchObject({ status: 'succeeded' })
    expect(choose).toHaveBeenCalledTimes(3)
    expect(firstFetch).toHaveBeenCalledTimes(1)
    expect(secondFetch).toHaveBeenCalledTimes(2)
  })

  it('asks it once without reconnect', async () => {
    const { client } = clientAnswering(streamResponse([jobEvent('succeeded')]).response)
    const choose = vi.fn(() => client)

    await expect(waitForJob(choose, 'job-1')).resolves.toMatchObject({ status: 'succeeded' })
    expect(choose).toHaveBeenCalledTimes(1)
  })

  it('still rejects a refused key at once, rather than asking it again', async () => {
    const { client, fetch } = clientAnswering(problem(401))
    const choose = vi.fn(() => client)

    const failure = await waitForJob(choose, 'job-1', { reconnect: true }).catch(
      (error: unknown) => error,
    )

    expect((failure as ResponseError).response.status).toBe(401)
    expect(choose).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ends the wait with an error it throws', async () => {
    const mistake = new Error('No key left')

    await expect(
      waitForJob(
        () => {
          throw mistake
        },
        'job-1',
        { reconnect: true },
      ),
    ).rejects.toBe(mistake)
  })
})

describe('waitForJob watching from a server', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('combines jitter, stableMs, quietMs, lookOnLoss and a client function', async () => {
    fakeTime()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const quiet = liveStream()
    quiet.send(jobEvent('running', { progress: 10 }))
    const { client, fetch } = clientAnswering(
      quiet.response,
      jobResponse('running', { progress: 20 }),
      streamResponse([jobEvent('running', { progress: 30 })]).response,
      problem(503),
      problem(503),
      streamResponse([jobEvent('succeeded')]).response,
    )
    const choose = vi.fn(() => client)
    const progress: Array<number | null> = []

    const waiting = waitForJob(choose, 'job-1', {
      onUpdate: (update) => progress.push(update.progress),
      reconnect: {
        delaysMs: [1_000, 5_000],
        jitter: 0.2,
        stableMs: 30_000,
        quietMs: 45_000,
        lookOnLoss: true,
      },
    })
    // Quiet for 45 s, though open past stableMs: it is lost, looked at, and the delays start over.
    await vi.advanceTimersByTimeAsync(45_000)
    await quiet.cancelled
    expect(fetch).toHaveBeenCalledTimes(2)
    // 1 s less a fifth, then a stream that drops at once, looked at with a 503: not stable, so
    // the next wait is the second delay, 5 s less a fifth.
    await vi.advanceTimersByTimeAsync(800)
    expect(fetch).toHaveBeenCalledTimes(4)
    // A 503 opening the stream, with no look, and the same wait again.
    await vi.advanceTimersByTimeAsync(4_000)
    expect(fetch).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(3_999)
    expect(fetch).toHaveBeenCalledTimes(5)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(progress).toEqual([10, 20, 30, null])
    expect(fetch).toHaveBeenCalledTimes(6)
    expect(choose).toHaveBeenCalledTimes(6)
  })
})

describe('waitForJob with onStream', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports a lost stream before the look, and the look before the next stream', async () => {
    const events: Array<string> = []
    const fetch = vi.fn<typeof globalThis.fetch>()
    const answers = [
      streamResponse([jobEvent('running')]).response,
      jobResponse('running', { progress: 50 }),
      streamResponse([jobEvent('succeeded')]).response,
    ]
    fetch.mockImplementation(async (url) => {
      events.push(`fetch ${String(url).replace('https://api.example.test', '')}`)
      return answers.shift()!
    })
    const client = createToolpathClient({
      apiKey: 'tp_test',
      baseUrl: 'https://api.example.test',
      fetch,
    })

    await waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [0], lookOnLoss: true },
      onStream: (state) => events.push(state),
      onUpdate: ({ status, progress }) => events.push(`${status} ${progress}`),
    })

    expect(events).toEqual([
      'fetch /v1/jobs/job-1/events',
      'open',
      'running null',
      'lost',
      'fetch /v1/jobs/job-1',
      'running 50',
      'fetch /v1/jobs/job-1/events',
      'open',
      'succeeded null',
    ])
  })

  it('reports a stream that went quiet as lost, before the wait to open the next', async () => {
    fakeTime()
    const quiet = liveStream()
    quiet.send(jobEvent('running'))
    const { client, fetch } = clientAnswering(
      quiet.response,
      streamResponse([jobEvent('succeeded')]).response,
    )
    const states: Array<string> = []

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [1_000], quietMs: 45_000 },
      onStream: (state) => states.push(state),
    })
    await vi.advanceTimersByTimeAsync(44_999)
    expect(states).toEqual(['open'])
    await vi.advanceTimersByTimeAsync(1)
    expect(states).toEqual(['open', 'lost'])
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(states).toEqual(['open', 'lost', 'open'])
  })

  it('is not called for a stream that could not be opened, nor when the wait settles', async () => {
    const { client } = clientAnswering(
      new TypeError('fetch failed'),
      problem(503),
      streamResponse([jobEvent('failed')]).response,
    )
    const states: Array<string> = []

    await expect(
      waitForJob(client, 'job-1', {
        reconnect: { delaysMs: [0] },
        onStream: (state) => states.push(state),
      }),
    ).rejects.toBeInstanceOf(JobFailedError)
    expect(states).toEqual(['open'])
  })

  it('is not called with lost when its signal aborts the stream', async () => {
    const stream = streamResponse([jobEvent('running')], { open: true })
    const { client } = clientAnswering(stream.response)
    const controller = new AbortController()
    const states: Array<string> = []

    const waiting = waitForJob(client, 'job-1', {
      signal: controller.signal,
      reconnect: true,
      onStream: (state) => states.push(state),
      onUpdate: () => queueMicrotask(() => controller.abort(new Error('Stopped waiting'))),
    })

    await expect(waiting).rejects.toThrow('Stopped waiting')
    expect(states).toEqual(['open'])
  })

  it('reports only open without reconnect, since a lost stream settles the wait', async () => {
    const { client } = clientAnswering(streamResponse([jobEvent('running')]).response)
    const states: Array<string> = []

    await expect(
      waitForJob(client, 'job-1', { onStream: (state) => states.push(state) }),
    ).rejects.toThrow('ended before the job finished')
    expect(states).toEqual(['open'])
  })

  it('ends the wait with an error it throws, closing the stream, rather than opening another', async () => {
    const stream = streamResponse([jobEvent('running')], { open: true })
    const { client, fetch } = clientAnswering(stream.response)
    const mistake = new Error('The caller could not handle the stream')

    await expect(
      waitForJob(client, 'job-1', {
        reconnect: { delaysMs: [0] },
        onStream: () => {
          throw mistake
        },
      }),
    ).rejects.toBe(mistake)
    expect(fetch).toHaveBeenCalledTimes(1)
    await stream.cancelled
  })
})

describe('waitForJob after a look', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stops waiting when its signal aborts after the look has its answer', async () => {
    const controller = new AbortController()
    const reason = new Error('Stopped waiting')
    const look = jobResponse('succeeded')
    const read = look.json.bind(look)
    // Aborts once the look's body has been read, before `getJob` hands back the job.
    look.json = async () => {
      const body: unknown = await read()
      controller.abort(reason)
      return body
    }
    const { client } = clientAnswering(streamResponse([jobEvent('running')]).response, look)
    const statuses: Array<string> = []

    await expect(
      waitForJob(client, 'job-1', {
        signal: controller.signal,
        reconnect: { delaysMs: [0], lookOnLoss: true },
        onUpdate: ({ status }) => statuses.push(status),
      }),
    ).rejects.toBe(reason)
    expect(statuses).toEqual(['running'])
  })

  it.each([
    ['5', 5_000],
    ['1', 2_000],
  ])(
    "waits a look's Retry-After of %s s where it is longer than the delay: %i ms",
    async (retryAfter, ms) => {
      fakeTime()
      const { client, fetch } = clientAnswering(
        streamResponse([jobEvent('running')]).response,
        problem(503, { 'Retry-After': retryAfter }),
        streamResponse([jobEvent('succeeded')]).response,
      )

      const waiting = waitForJob(client, 'job-1', {
        reconnect: { delaysMs: [2_000], lookOnLoss: true },
      })
      await vi.advanceTimersByTimeAsync(ms - 1)
      expect(fetch).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)

      await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
      expect(fetch).toHaveBeenCalledTimes(3)
    },
  )

  it("only lengthens a look's Retry-After with jitter", async () => {
    fakeTime()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { client, fetch } = clientAnswering(
      streamResponse([jobEvent('running')]).response,
      problem(429, { 'Retry-After': '5' }),
      streamResponse([jobEvent('succeeded')]).response,
    )

    const waiting = waitForJob(client, 'job-1', {
      reconnect: { delaysMs: [1_000], jitter: 0.2, lookOnLoss: true },
    })
    await vi.advanceTimersByTimeAsync(5_499)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)

    await expect(waiting).resolves.toMatchObject({ status: 'succeeded' })
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})

describe('waitForJob jitter validation', () => {
  it.each([-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a jitter of %f with a RangeError before any request',
    async (jitter) => {
      const { client, fetch } = clientAnswering()

      await expect(waitForJob(client, 'job-1', { reconnect: { jitter } })).rejects.toBeInstanceOf(
        RangeError,
      )
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each([0, 1])('accepts a jitter of %i', async (jitter) => {
    const { client } = clientAnswering(streamResponse([jobEvent('succeeded')]).response)

    await expect(waitForJob(client, 'job-1', { reconnect: { jitter } })).resolves.toMatchObject({
      status: 'succeeded',
    })
  })
})
