import * as stableSdk from '@toolpath/api'
import * as stagingSdk from '@toolpath/api-staging'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ENGINE_CONTRACT_IDS,
  compareVersions,
  contractFile,
  contractForSdkVersion,
  contractProvenanceFile,
  isTestedSdkVersion,
  loadContract,
  satisfiesRange,
  sha256,
} from '../../src/engine/contracts.js'
import * as testing from '../../src/engine/testing/index.js'
import {
  TEST_API_KEY,
  createEngineFetch,
  createEngineScenario,
  createJobFixture,
  createPartFixture,
  createProblemFixture,
  createReportFixture,
} from '../../src/engine/testing/index.js'
import { DEFAULT_SCENARIO_SEED, deterministicUuid } from '../../src/engine/testing/ids.js'
import { toolchain } from '../../src/policy/toolchain.js'
import { CAD_BYTES, SDKS, defined, rejection } from './test-utils/harness.js'

const stable = defined(SDKS[0], 'the stable SDK')
const staging = defined(SDKS[1], 'the staging SDK')

afterEach(() => {
  vi.useRealTimers()
})

describe('pinned contracts', () => {
  it('match the SHA-256 and API version the toolchain manifest records', () => {
    expect(Object.keys(toolchain.engine.contracts)).toEqual([...ENGINE_CONTRACT_IDS])
    for (const id of ENGINE_CONTRACT_IDS) {
      const pin = defined(toolchain.engine.contracts[id], `a pin for ${id}`)
      expect(sha256(readFileSync(contractFile(id)))).toBe(pin.sha256)
      expect(loadContract(id).document.info.version).toBe(pin.apiVersion)
      const provenance: unknown = JSON.parse(readFileSync(contractProvenanceFile(id), 'utf8'))
      expect(provenance).toMatchObject({
        id,
        sha256: pin.sha256,
        apiVersion: pin.apiVersion,
        sdk: { version: pin.sdk },
      })
    }
  })

  it('agree with the metadata each SDK artifact was built from', () => {
    for (const under of SDKS) {
      expect(contractForSdkVersion(under.version)).toBe(under.contract)
      expect(isTestedSdkVersion(under.version)).toBe(true)
    }
  })

  it('map SDK versions with prerelease-aware ranges', () => {
    expect(contractForSdkVersion('0.9.4')).toBe('api-1.29.1')
    expect(contractForSdkVersion('0.10.0-staging.20990101000000.gabcdef0')).toBe('api-1.32.0')
    expect(contractForSdkVersion('0.9.1-beta.1')).toBeUndefined()
    expect(contractForSdkVersion('0.11.0-staging.1')).toBeUndefined()
    expect(contractForSdkVersion('0.8.1')).toBeUndefined()
    expect(isTestedSdkVersion('0.9.4')).toBe(false)
    expect(compareVersions('0.10.0-0', '0.10.0-staging.1')).toBeLessThan(0)
    expect(satisfiesRange('0.10.0-staging.1', '>=0.10.0-0 <0.11.0-0')).toBe(true)
  })
})

describe('scenario creation', () => {
  it('rejects an unsupported contract with the supported list', () => {
    const unsupported: string = 'api-1.0.0'
    expect(() =>
      createEngineScenario({ contract: unsupported } as testing.EngineScenarioOptions),
    ).toThrow(/Supported: api-1.29.1, api-1.32.0/)
  })

  it('rejects an SDK artifact built from a different contract', () => {
    expect(() =>
      createEngineScenario({ contract: 'api-1.29.1', sdkVersion: staging.version }),
    ).toThrow(/built from api-1.32.0, but this scenario serves api-1.29.1/)
    expect(() => createEngineScenario({ sdkVersion: '0.4.1' })).toThrow(/not a supported SDK line/)
  })

  it('validates the initial state against the contract and its identities', () => {
    const part = createPartFixture({ uploaded: true })
    const report = createReportFixture()
    expect(() => createEngineScenario({ state: { jobs: [createJobFixture()] } })).toThrow(
      /partUuid .* is not a part in this state/,
    )
    expect(() =>
      createEngineScenario({
        state: { parts: [part], jobs: [createJobFixture({ status: 'succeeded', reportId: null })] },
      }),
    ).toThrow(/a succeeded analysis names the report it produced/)
    expect(() =>
      createEngineScenario({
        state: {
          parts: [part],
          jobs: [createJobFixture({ status: 'succeeded' })],
          reports: [{ ...report, jobId: report.reportId }],
        },
      }),
    ).toThrow(/jobId .* is not a job in this state/)
    expect(() =>
      createEngineScenario({
        state: { parts: [part], jobs: [createJobFixture({ progress: 140 })] },
      }),
    ).toThrow(/progress must be <= 100/)
    expect(() =>
      createEngineScenario({ state: { parts: [{ ...part, partId: 'part-1' }] } }),
    ).toThrow(/must match format "uuid"/)
  })

  it('serves test-owned results and their artifacts', async () => {
    const part = createPartFixture({ uploaded: true })
    const job = createJobFixture({
      status: 'succeeded',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:05.000Z',
    })
    const report = createReportFixture({ meshStlUrl: null })
    const scenario = createEngineScenario({
      sdkVersion: stable.version,
      state: { parts: [part], jobs: [job], reports: [report] },
    })
    const client = stable.sdk.createToolpathClient({
      apiKey: TEST_API_KEY,
      fetch: createEngineFetch(scenario),
    })
    const served = await client.parts.getPart({ id: part.partId })
    expect(served).toMatchObject({
      reportId: report.reportId,
      jobId: job.jobUuid,
      meshStlUrl: null,
    })
    expect(served.thumbnailUrl).toMatch(/^https:\/\/storage\.engine\.test\/artifacts\//)
    await expect(client.jobs.getJob({ id: job.jobUuid })).resolves.toMatchObject({
      durationMs: 5000,
    })
  })
})

describe('determinism and isolation', () => {
  const journey = async (scenario: testing.EngineScenario): Promise<Array<string>> => {
    const fetch = createEngineFetch(scenario)
    const client = stable.sdk.createToolpathClient({ apiKey: TEST_API_KEY, fetch })
    const created = await client.parts.createPart({})
    await stable.sdk.uploadToPresignedUrl(created.uploadUrl, CAD_BYTES, { fetch })
    const { jobId } = await client.parts.updatePart({ id: created.partId })
    scenario.advanceJob(jobId, 'running')
    const { reportId } = scenario.advanceJob(jobId, 'succeeded')
    return [created.partId, jobId, defined(reportId, 'a report'), created.uploadUrl]
  }

  it('issues the same identifiers, timestamps and signatures for the same seed', async () => {
    const first = await journey(createEngineScenario({ sdkVersion: stable.version }))
    const second = await journey(createEngineScenario({ sdkVersion: stable.version }))
    const reseeded = await journey(
      createEngineScenario({ sdkVersion: stable.version, seed: 'another-seed' }),
    )
    expect(second).toEqual(first)
    expect(reseeded[0]).not.toBe(first[0])
    expect(
      createEngineScenario({ sdkVersion: stable.version }).job(defined(first[1], 'a job')),
    ).toBeUndefined()
  })

  it('keeps scenarios independent', async () => {
    const a = createEngineScenario({ sdkVersion: stable.version })
    const b = createEngineScenario({ sdkVersion: stable.version })
    const [, jobId] = await journey(a)
    expect(b.job(defined(jobId, 'a job'))).toBeUndefined()
    expect(b.requests).toEqual([])
  })
})

describe('the injected fetch', () => {
  it('never falls back to the network for another host', async () => {
    const scenario = createEngineScenario({ sdkVersion: stable.version })
    const fetch = createEngineFetch(scenario)
    const spy = vi.spyOn(globalThis, 'fetch')
    await expect(fetch('https://example.com/v1/parts')).rejects.toThrow(
      /never falls back to the network/,
    )
    expect(spy).not.toHaveBeenCalled()
    expect(scenario.violations).toHaveLength(1)
  })

  it('treats stable and staging base URLs as separate inputs', async () => {
    const scenario = createEngineScenario({
      contract: 'api-1.32.0',
      sdkVersion: staging.version,
      baseUrl: staging.baseUrl,
    })
    const fetch = createEngineFetch(scenario)
    // The staging SDK's default base URL is still production: installing it selects no server.
    const defaulted = stagingSdk.createToolpathClient({ apiKey: TEST_API_KEY, fetch })
    await expect(defaulted.parts.createPart({})).rejects.toMatchObject({ name: 'FetchError' })
    expect(scenario.violations[0]).toMatch(
      /https:\/\/api\.toolpath\.com\/v1\/parts is addressed to neither/,
    )
    const explicit = stagingSdk.createToolpathClient({
      apiKey: TEST_API_KEY,
      baseUrl: staging.baseUrl,
      fetch,
    })
    await expect(explicit.parts.createPart({})).resolves.toHaveProperty('partId')
  })

  it('delays only by explicit request, under fake time, and an abort mid-delay changes nothing', async () => {
    vi.useFakeTimers()
    const scenario = createEngineScenario({
      sdkVersion: stable.version,
      latency: { createPart: 250 },
    })
    const client = stable.sdk.createToolpathClient({
      apiKey: TEST_API_KEY,
      fetch: createEngineFetch(scenario),
    })
    let settled = false
    const pending = client.parts.createPart({}).finally(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(249)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const first = await pending
    expect(first.partId).toBe(deterministicUuid(DEFAULT_SCENARIO_SEED, 'scenario-part', 0))

    const controller = new AbortController()
    const aborted = rejection(client.parts.createPart({}, { signal: controller.signal }))
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await expect(aborted).resolves.toMatchObject({
      name: 'FetchError',
      cause: { name: 'AbortError' },
    })

    // The aborted request never reached the handler, so the next part takes the identifier it would have had.
    const next = client.parts.createPart({})
    await vi.advanceTimersByTimeAsync(250)
    await expect(next).resolves.toMatchObject({
      partId: deterministicUuid(DEFAULT_SCENARIO_SEED, 'scenario-part', 1),
    })
  })

  it('rejects a query parameter the selected contract does not define', async () => {
    const scenario = createEngineScenario({ sdkVersion: stable.version })
    const fetch = createEngineFetch(scenario)
    const response = await fetch('https://api.toolpath.com/v1/parts?bodyIndex=1', {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      detail: 'bodyIndex is not a query parameter of createPart in api-1.29.1',
    })
  })
})

describe('staging-only capabilities', () => {
  it('lists the bodies of a multi-body file and makes a part of the chosen body', async () => {
    const scenario = createEngineScenario({
      contract: 'api-1.32.0',
      sdkVersion: staging.version,
      baseUrl: staging.baseUrl,
    })
    const fetch = createEngineFetch(scenario)
    const client = stagingSdk.createToolpathClient({
      apiKey: TEST_API_KEY,
      baseUrl: staging.baseUrl,
      fetch,
    })
    const created = await client.parts.createPart({ filename: 'assembly.step' })
    await stagingSdk.uploadToPresignedUrl(created.uploadUrl, CAD_BYTES, { fetch })
    const { jobId } = await client.parts.updatePart({ id: created.partId })
    const box = { lower: { x: 0, y: 0, z: 0 }, upper: { x: 10, y: 10, z: 10 } }
    scenario.advanceJob(jobId, {
      status: 'failed',
      error: 'multiple_bodies: the file holds 2 solid bodies',
      bodies: [
        { index: 0, name: 'Body1', faceCount: 6, boundingBox: box },
        { index: 1, faceCount: 12, boundingBox: box },
      ],
    })
    const failed = await client.jobs.getJob({ id: jobId })
    expect(failed).toMatchObject({ fileUuid: null, status: 'failed' })
    expect(failed.bodies?.map((body) => body.index)).toEqual([0, 1])

    const chosen = await client.parts.createPart({ filename: 'assembly.step', bodyIndex: 1 })
    await stagingSdk.uploadToPresignedUrl(chosen.uploadUrl, CAD_BYTES, { fetch })
    const analysis = await client.parts.updatePart({ id: chosen.partId })
    scenario.advanceJob(analysis.jobId, 'running')
    scenario.advanceJob(analysis.jobId, 'succeeded')
    await expect(client.parts.getPart({ id: chosen.partId })).resolves.toMatchObject({
      bodyIndex: 1,
    })
    await expect(client.jobs.listJobs({})).resolves.toMatchObject({
      items: [{ fileUuid: null }, { fileUuid: null }],
    })
  })

  it('are refused for the stable contract', async () => {
    const scenario = createEngineScenario({ sdkVersion: stable.version })
    const client = stableSdk.createToolpathClient({
      apiKey: TEST_API_KEY,
      fetch: createEngineFetch(scenario),
    })
    const created = await client.parts.createPart({})
    await stableSdk.uploadToPresignedUrl(created.uploadUrl, CAD_BYTES, {
      fetch: createEngineFetch(scenario),
    })
    const { jobId } = await client.parts.updatePart({ id: created.partId })
    expect(() =>
      scenario.advanceJob(jobId, {
        status: 'failed',
        bodies: [
          {
            index: 0,
            faceCount: 1,
            boundingBox: { lower: { x: 0, y: 0, z: 0 }, upper: { x: 1, y: 1, z: 1 } },
          },
        ],
      }),
    ).toThrow(/api-1.32.0 capability/)
    expect(() => createJobFixture({ fileUuid: null })).toThrow(/api-1.32.0 fields/)
    expect(() => createReportFixture({ bodyIndex: 0 })).toThrow(/api-1.32.0 fields/)
    expect(createJobFixture({ contract: 'api-1.32.0' })).toHaveProperty('fileUuid', null)
  })
})

describe('fixtures', () => {
  it('are wire values the real SDK deserializes', () => {
    const job = createJobFixture({ status: 'succeeded' })
    expect(typeof job.createdAt).toBe('string')
    expect(stableSdk.JobDetailFromJSON(job).createdAt).toBeInstanceOf(Date)
    expect(stableSdk.PartResponseFromJSON(createReportFixture()).units.length).toBe('mm')
    expect(
      stagingSdk.JobDetailFromJSON(createJobFixture({ contract: 'api-1.32.0' })).fileUuid,
    ).toBeNull()
    expect(createProblemFixture({ status: 403, code: 'read_only_key' })).toEqual({
      type: 'https://api.toolpath.com/problems/read-only-key',
      title: 'Forbidden',
      status: 403,
      code: 'read_only_key',
    })
  })

  it('pair default identifiers by index and keep part, job, and report identity distinct', () => {
    const job = createJobFixture({ index: 2, status: 'succeeded' })
    const report = createReportFixture({ index: 2 })
    expect(job.partUuid).toBe(createPartFixture({ index: 2 }).partId)
    expect(job.reportId).toBe(report.reportId)
    expect(report.jobId).toBe(job.jobUuid)
    expect(new Set([job.partUuid, job.jobUuid, report.reportId]).size).toBe(3)
    expect(createPartFixture({ index: 1 }).partId).not.toBe(createPartFixture().partId)
  })
})

describe('the public test kit', () => {
  it('exposes no event-stream parser, reconnect helper, or API client', () => {
    const names = Object.keys(testing)
    expect(names.filter((name) => /parse|reconnect|eventsource|client|retry/i.test(name))).toEqual(
      [],
    )
  })
})
