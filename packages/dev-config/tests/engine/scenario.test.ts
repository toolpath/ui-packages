import { afterEach, describe, expect, it } from 'vitest'
import {
  createApiKeyFixture,
  formatJobEvent,
  PRESIGNED_URL_LIFETIME_SECONDS,
} from '../../src/engine/testing/index.js'
import type { EngineScenarioOptions } from '../../src/engine/testing/index.js'
import {
  CAD_BYTES,
  SDKS,
  TRANSPORTS,
  defined,
  open,
  problemOf,
  readEvents,
  rejection,
  type Session,
} from './test-utils/harness.js'

const MATRIX = SDKS.flatMap((sdk) => TRANSPORTS.map((transport) => ({ sdk, transport })))

let session: Session | undefined

afterEach(async () => {
  await session?.stop()
  session = undefined
})

describe.each(MATRIX)('$sdk.name over $transport', ({ sdk, transport }) => {
  const start = async (options?: EngineScenarioOptions): Promise<Session> => {
    session = await open(sdk, transport, options)
    return session
  }

  /** Creates and uploads a part, then queues its analysis. */
  const uploadAndAnalyze = async (current: Session): Promise<{ partId: string; jobId: string }> => {
    const created = await current.client.parts.createPart({ filename: 'bracket.step' })
    await sdk.sdk.uploadToPresignedUrl(created.uploadUrl, CAD_BYTES, { fetch: current.fetch })
    const queued = await current.client.parts.updatePart({ id: created.partId })
    return { partId: created.partId, jobId: queued.jobId }
  }

  it('runs the upload, analysis, and result journey with distinct part, job, and report identities', async () => {
    const current = await start()
    const created = await current.client.parts.createPart({ filename: 'bracket.step' })
    expect(new URL(created.uploadUrl).searchParams.get('signature')).toMatch(/^[0-9a-f]{32}$/)

    await expect(current.client.parts.updatePart({ id: created.partId })).rejects.toMatchObject({
      response: { status: 409 },
    })

    await sdk.sdk.uploadToPresignedUrl(created.uploadUrl, CAD_BYTES, { fetch: current.fetch })
    const queued = await current.client.parts.updatePart({ id: created.partId })
    expect(queued).toMatchObject({ partId: created.partId, status: 'queued' })
    expect(queued.jobId).not.toBe(created.partId)
    await expect(current.client.parts.getPart({ id: created.partId })).rejects.toMatchObject({
      response: { status: 404 },
    })

    current.scenario.advanceJob(queued.jobId, { status: 'running', progress: 40 })
    await expect(current.client.jobs.getJob({ id: queued.jobId })).resolves.toMatchObject({
      status: 'running',
      progress: 40,
      reportId: null,
    })

    const finished = current.scenario.advanceJob(queued.jobId, 'succeeded')
    const job = await current.client.jobs.getJob({ id: queued.jobId })
    expect(job.status).toBe('succeeded')
    expect(job.createdAt).toBeInstanceOf(Date)
    expect(job.reportId).toBe(finished.reportId)

    const result = await current.client.parts.getPart({ id: created.partId })
    expect(new Set([result.partId, result.jobId, result.reportId]).size).toBe(3)
    expect(result).toMatchObject({
      partId: created.partId,
      jobId: queued.jobId,
      reportId: job.reportId,
    })
    expect(result.units).toEqual({ length: 'mm', angle: 'deg' })

    const glb = await current.fetch(defined(result.meshGlbUrl, 'a GLB URL'))
    expect(glb.status).toBe(200)
    expect(new TextDecoder().decode((await glb.arrayBuffer()).slice(0, 4))).toBe('glTF')
    const thumbnail = await current.client.parts.getPartThumbnail({ id: created.partId })
    expect(thumbnail.type).toBe('image/png')

    const upload = current.scenario.requests.find(
      (request) => request.operationId === 'presignedUpload',
    )
    expect(upload).toMatchObject({
      target: 'storage',
      method: 'PUT',
      caller: 'none',
      body: { bytes: CAD_BYTES.length },
    })
    expect(upload?.headers).not.toHaveProperty('authorization')
    expect(upload?.query.signature).toBe('[redacted]')
    const analyze = current.scenario.requests.find(
      (request) => request.operationId === 'updatePart',
    )
    expect(analyze).toMatchObject({
      target: 'api',
      caller: 'test-key',
      headers: { authorization: '[redacted]' },
    })
    expect(current.scenario.requests.map((request) => request.sequence)).toEqual(
      current.scenario.requests.map((_, index) => index + 1),
    )
    expect(current.scenario.violations).toEqual([])
  })

  it('reports pending, running, completed, and failed jobs and filters the job list', async () => {
    const current = await start()
    const first = await uploadAndAnalyze(current)
    const second = await uploadAndAnalyze(current)
    const third = await uploadAndAnalyze(current)
    current.scenario.advanceJob(second.jobId, 'running')
    current.scenario.advanceJob(third.jobId, 'running')
    current.scenario.advanceJob(third.jobId, {
      status: 'failed',
      error: 'analysis_failed: no solid body',
    })

    await expect(current.client.jobs.getJob({ id: first.jobId })).resolves.toMatchObject({
      status: 'queued',
      progress: null,
    })
    await expect(current.client.jobs.getJob({ id: third.jobId })).resolves.toMatchObject({
      status: 'failed',
      error: 'analysis_failed: no solid body',
      reportId: null,
    })
    const all = await current.client.jobs.listJobs({})
    expect(all.total).toBe(3)
    expect(all.items.map((item) => item.jobUuid)).toEqual([third.jobId, second.jobId, first.jobId])
    const failed = await current.client.jobs.listJobs({ status: 'failed' })
    expect(failed.items.map((item) => item.jobUuid)).toEqual([third.jobId])
    const forPart = await current.client.jobs.listJobs({ partId: second.partId })
    expect(forPart.items.map((item) => item.status)).toEqual(['running'])
  })

  it('refuses invalid and revoked credentials, missing product grants, and writes with a read-only key', async () => {
    const readOnly = createApiKeyFixture({
      key: 'tp_test_read_only',
      label: 'read-only',
      access: { core: 'read', dfm: 'read', quoting: 'none' },
    })
    const coreOnly = createApiKeyFixture({
      key: 'tp_test_core_only',
      label: 'core-only',
      access: { core: 'write', dfm: 'none', quoting: 'none' },
    })
    const revoked = createApiKeyFixture({
      key: 'tp_test_revoked',
      label: 'revoked',
      status: 'revoked',
    })
    const current = await start({
      state: { apiKeys: [createApiKeyFixture(), readOnly, coreOnly, revoked] },
    })
    const { partId, jobId } = await uploadAndAnalyze(current)
    current.scenario.advanceJob(jobId, 'running')
    current.scenario.advanceJob(jobId, 'succeeded')

    const clientFor = (apiKey: string): Session['client'] =>
      sdk.sdk.createToolpathClient({ apiKey, baseUrl: current.baseUrl, fetch: current.fetch })

    const unknown = await problemOf(
      await rejection(clientFor('tp_test_unknown').jobs.getJob({ id: jobId })),
    )
    expect(unknown).toMatchObject({ status: 401, body: { code: 'invalid_api_key', status: 401 } })
    const revokedKey = await problemOf(
      await rejection(clientFor(revoked.key).jobs.getJob({ id: jobId })),
    )
    expect(revokedKey.body).toMatchObject({
      code: 'invalid_api_key',
      detail: 'The API key is revoked',
    })

    const noGrant = await problemOf(
      await rejection(clientFor(coreOnly.key).parts.getPart({ id: partId })),
    )
    expect(noGrant).toMatchObject({ status: 403, body: { code: 'product_mismatch' } })
    await expect(clientFor(coreOnly.key).jobs.getJob({ id: jobId })).resolves.toMatchObject({
      status: 'succeeded',
    })

    const write = await problemOf(await rejection(clientFor(readOnly.key).parts.createPart({})))
    expect(write).toMatchObject({ status: 403, body: { code: 'read_only_key' } })
    await expect(clientFor(readOnly.key).parts.getPart({ id: partId })).resolves.toMatchObject({
      partId,
    })

    await expect(clientFor(revoked.key).keys.validateKey()).rejects.toMatchObject({
      response: { status: 401 },
    })
    await expect(current.client.keys.validateKey()).resolves.toEqual({
      valid: true,
      status: 'active',
    })
    expect(
      current.scenario.requests.filter((request) => request.caller === 'unknown'),
    ).toHaveLength(1)
  })

  it('injects documented error responses and network failures once each', async () => {
    const current = await start()
    const { jobId } = await uploadAndAnalyze(current)

    current.scenario.failNext('getJob', { status: 503 })
    const unavailable = await problemOf(await rejection(current.client.jobs.getJob({ id: jobId })))
    expect(unavailable).toMatchObject({ status: 503, body: { code: 'service_unavailable' } })
    await expect(current.client.jobs.getJob({ id: jobId })).resolves.toMatchObject({
      jobUuid: jobId,
    })

    current.scenario.failNext('getJob', {
      status: 500,
      problem: { code: 'worker_crashed', detail: 'The worker stopped' },
    })
    const crashed = await problemOf(await rejection(current.client.jobs.getJob({ id: jobId })))
    expect(crashed.body).toMatchObject({
      code: 'worker_crashed',
      detail: 'The worker stopped',
      status: 500,
    })

    current.scenario.failNext('getJob', { network: true })
    const network = await rejection(current.client.jobs.getJob({ id: jobId }))
    expect(network).toMatchObject({ name: 'FetchError' })
    await expect(current.client.jobs.getJob({ id: jobId })).resolves.toMatchObject({
      jobUuid: jobId,
    })
  })

  it('serves the only documented rate limit, without inventing retry metadata', async () => {
    const current = await start()
    current.scenario.failNext('createDemoSession', { status: 429 })
    const limited = await problemOf(
      await rejection(current.client.demo.createDemoSession({ body: {} })),
    )
    expect(limited).toMatchObject({ status: 429, body: { code: 'rate_limited' } })
    // Neither pinned contract documents Retry-After or rate-limit headers, so none are invented.
    expect(limited.headers.get('retry-after')).toBeNull()
    expect(() => {
      current.scenario.failNext('createPart', { status: 429 })
    }).toThrow(/createPart documents no 429 error/)
  })

  it('expires artifact URLs on the scenario clock and serves a fresh one from the owning endpoint', async () => {
    let clock = new Date('2026-03-01T12:00:00.000Z')
    const current = await start({ now: () => clock })
    const { partId, jobId } = await uploadAndAnalyze(current)
    current.scenario.advanceJob(jobId, 'running')
    current.scenario.advanceJob(jobId, 'succeeded')
    const first = await current.client.parts.getPart({ id: partId })

    clock = new Date(clock.getTime() + (PRESIGNED_URL_LIFETIME_SECONDS + 60) * 1000)
    const expired = await current.fetch(defined(first.thumbnailUrl, 'a thumbnail URL'))
    expect(expired.status).toBe(403)
    expect(await expired.text()).toContain('Request has expired')

    const refreshed = await current.client.parts.getPart({ id: partId })
    expect(refreshed.thumbnailUrl).not.toBe(first.thumbnailUrl)
    const image = await current.fetch(defined(refreshed.thumbnailUrl, 'a thumbnail URL'))
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
  })

  it('streams job events with exact framing, then completes', async () => {
    const current = await start()
    const { jobId } = await uploadAndAnalyze(current)
    const response = await current.client.jobs.streamJobEventsRaw({ id: jobId })
    expect(response.raw.headers.get('content-type')).toBe('text/event-stream')
    const reader = defined(response.raw.body, 'an event stream body').getReader()
    expect(await readEvents(reader, 1)).toBe(
      formatJobEvent(defined(current.scenario.job(jobId), 'the job')),
    )

    const running = current.scenario.advanceJob(jobId, { status: 'running', progress: 10 })
    const succeeded = current.scenario.advanceJob(jobId, 'succeeded')
    expect(await readEvents(reader, 2)).toBe(formatJobEvent(running) + formatJobEvent(succeeded))

    current.scenario.endJobStreams(jobId)
    await expect(reader.read()).resolves.toMatchObject({ done: true })
  })

  it('breaks an interrupted event stream, and a client reconnecting receives the latest snapshot', async () => {
    const current = await start()
    const { jobId } = await uploadAndAnalyze(current)
    const response = await current.client.jobs.streamJobEventsRaw({ id: jobId })
    const reader = defined(response.raw.body, 'an event stream body').getReader()
    await readEvents(reader, 1)
    current.scenario.interruptJobStreams(jobId)
    await expect(reader.read()).rejects.toThrow()

    const latest = current.scenario.advanceJob(jobId, { status: 'running', progress: 55 })
    const again = await current.client.jobs.streamJobEventsRaw({ id: jobId })
    const next = defined(again.raw.body, 'an event stream body').getReader()
    expect(await readEvents(next, 1)).toBe(formatJobEvent(latest))
    // MSW does not pass a client-side cancel through to the mocked body, so the server ends it.
    current.scenario.endJobStreams(jobId)
    await expect(next.read()).resolves.toMatchObject({ done: true })
  })

  it('stops an event stream the client aborts and releases its subscription', async () => {
    const current = await start()
    const { jobId } = await uploadAndAnalyze(current)
    const controller = new AbortController()
    const response = await current.client.jobs.streamJobEventsRaw(
      { id: jobId },
      { signal: controller.signal },
    )
    const reader = defined(response.raw.body, 'an event stream body').getReader()
    await readEvents(reader, 1)
    controller.abort()
    await expect(reader.read()).rejects.toThrow()
    expect(() => current.scenario.advanceJob(jobId, 'running')).not.toThrow()
  })

  it('fails an aborted request without changing state', async () => {
    const current = await start()
    const controller = new AbortController()
    controller.abort()
    const error = await rejection(
      current.client.parts.createPart({}, { signal: controller.signal }),
    )
    expect(error).toMatchObject({ name: 'FetchError' })
    expect(
      current.scenario.requests.filter((request) => request.operationId === 'createPart'),
    ).toHaveLength(0)
  })

  it('rejects unknown identifiers, invalid transitions, and malformed payloads', async () => {
    const current = await start()
    await expect(
      current.client.jobs.getJob({ id: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toMatchObject({
      response: { status: 404 },
    })
    const { jobId, partId } = await uploadAndAnalyze(current)
    expect(() => current.scenario.advanceJob(jobId, 'succeeded')).toThrow(
      /queued; it can move to running or failed/,
    )
    current.scenario.advanceJob(jobId, 'running')
    current.scenario.advanceJob(jobId, 'failed')
    expect(() => current.scenario.advanceJob(jobId, 'running')).toThrow(/already failed/)
    expect(() => current.scenario.advanceJob('no-such-job', 'running')).toThrow(
      /no job no-such-job/,
    )

    const malformed = await current.fetch(`${current.baseUrl}/v1/parts/${partId}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer tp_test_0000000000000000000000000000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ directions: [{ x: 1, y: 0 }] }),
    })
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({ code: 'invalid_request' })

    current.scenario.failNext('getJob', { malformedBody: true })
    await expect(current.client.jobs.getJob({ id: jobId })).rejects.toThrow(SyntaxError)
  })

  it('fails an operation the scenario does not simulate instead of answering it', async () => {
    const current = await start()
    const { partId } = await uploadAndAnalyze(current)
    await expect(current.client.plans.createPlan({ id: partId })).rejects.toThrow()
    expect(current.scenario.violations).toHaveLength(1)
    expect(current.scenario.violations[0]).toMatch(/createPlan .* does not simulate it/)
  })

  it('refuses an upload that carries the Engine API key to the storage host', async () => {
    const current = await start()
    const created = await current.client.parts.createPart({})
    const response = await current.fetch(created.uploadUrl, {
      method: 'PUT',
      headers: { authorization: 'Bearer tp_test_0000000000000000000000000000' },
      body: CAD_BYTES,
    })
    expect(response.status).toBe(400)
    expect(current.scenario.violations).toHaveLength(1)
    expect(current.scenario.violations[0]).toMatch(/must not carry the Engine API key/)
    expect(current.scenario.part(created.partId)?.uploaded).toBe(false)
  })

  it('resets to its initial state and refuses requests once closed', async () => {
    const current = await start()
    const first = await uploadAndAnalyze(current)
    current.scenario.failNext('getJob', { status: 503 })
    current.scenario.reset()
    expect(current.scenario.requests).toEqual([])
    expect(current.scenario.part(first.partId)).toBeUndefined()
    const again = await uploadAndAnalyze(current)
    expect(again).toEqual(first)
    await expect(current.client.jobs.getJob({ id: again.jobId })).resolves.toMatchObject({
      status: 'queued',
    })

    current.scenario.close()
    current.scenario.close()
    await expect(current.client.jobs.getJob({ id: again.jobId })).rejects.toThrow()
    expect(current.scenario.violations.at(-1)).toMatch(/after the scenario was closed/)
  })
})
