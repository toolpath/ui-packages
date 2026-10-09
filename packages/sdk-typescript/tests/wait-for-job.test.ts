import { describe, expect, it, vi } from 'vitest'
import { createToolpathClient } from '../src/client.js'
import { ResponseError, type JobDetail } from '../src/generated/index.js'
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

  it('rejects with the failed job, without reconnecting', async () => {
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

  it('reopens a stream the server closed before the job finished', async () => {
    const { client, fetch } = clientWith(
      streamResponse([jobEvent('running', { progress: 10 })]).response,
      streamResponse([jobEvent('running', { progress: 90 }), jobEvent('succeeded')]).response,
    )
    const progress: Array<number | null> = []

    await waitForJob(client, 'job-1', { onUpdate: (update) => progress.push(update.progress) })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([10, 90, null])
  })

  it('rejects rather than reconnecting when a stream closes without sending the job', async () => {
    const { client, fetch } = clientWith(streamResponse([': keepalive\n\n']).response)

    await expect(waitForJob(client, 'job-1')).rejects.toThrow(
      'The event stream for job job-1 closed without sending the job',
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects with the response error when the stream cannot be opened', async () => {
    const { client } = clientWith(
      new Response(JSON.stringify({ code: 'job_not_found', status: 404 }), {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )

    const failure = await waitForJob(client, 'job-1').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ResponseError)
    expect((failure as ResponseError).response.status).toBe(404)
  })

  it('stops waiting when its signal is aborted', async () => {
    const stream = streamResponse([jobEvent('running')], { open: true })
    const { client } = clientWith(stream.response)
    const controller = new AbortController()

    // Aborts once the first event has been handled, while the next read is waiting on the server.
    const waiting = waitForJob(client, 'job-1', {
      signal: controller.signal,
      onUpdate: () => queueMicrotask(() => controller.abort(new Error('Stopped waiting'))),
    })

    await expect(waiting).rejects.toThrow('Stopped waiting')
    await stream.cancelled
  })
})
