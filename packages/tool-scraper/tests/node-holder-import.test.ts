/**
 * The five-call holder import, driven with no stack behind it.
 *
 * `holder-import.ts` is the one place this package *sends* something rather
 * than reading it — a vendor's STEP binary, to Toolpath object storage — so
 * what is worth pinning is the sequence, the key handling and the split between
 * a run that has to stop and a holder that can be dropped.
 *
 * The stub is a `fetch`, not a `Fetcher`. That is the seam this module chose
 * deliberately: a bearer token, a raw-bytes PUT to a presigned URL and a PATCH
 * with an idempotency header are three shapes `fetch.Fetcher` does not have,
 * and widening a public interface every consumer may have implemented, to serve
 * one maintainer's command, is a break bought for nothing.
 */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { IncompletePartError, VendorResponseError } from '../src/errors.js'
import { holderRecord, type HolderRecord } from '../src/holding.js'
import {
  API_KEY_ENV,
  API_URL_ENV,
  DEFAULT_API_URL,
  DEFAULT_IMPORT_OPTIONS,
  apiUrl,
  createHolderApi,
  describeApi,
  idempotencyKey,
  retryAfterMs,
  RATE_LIMIT_BACKOFF_MS,
  measureFamily,
  measureHolder,
  parseHolderResponse,
  readMirroredStep,
} from '../src/node/holder-import.js'

/** A minimal `HolderResponse`: two cones, a taper, and a kernel to pin it to. */
const RESPONSE = {
  kernelVersion: '0.7.2',
  options: { tolerance: 0.05, fillBays: false, flipped: false },
  layers: [
    { thickness: 10, bottomDiameter: 20, topDiameter: 20 },
    { thickness: 5, bottomDiameter: 20, topDiameter: 30 },
  ],
  gaugeLength: 10,
  sizeClass: 30,
  taperFamily: 'iso7x24',
}

const PART = { brand: 'kennametal', catalogNumber: 'BT30ER16060M' } as const

/** One call the stub saw, reduced to what a sequence assertion reads. */
interface Seen {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

/**
 * A `fetch` that answers the five calls in order and records every one.
 *
 * `job` is how many polls it takes before the job settles, so the wait loop is
 * exercised rather than short-circuited by an immediate success.
 */
function api(
  over: {
    job?: string[]
    holder?: unknown
    status?: number
    pollTimeoutMs?: number
    /** Answer this many calls with 429 before answering normally. */
    rateLimited?: number
    /** The `Retry-After` those 429s carry, in seconds. Absent sends no header. */
    retryAfter?: string
    rateLimitAttempts?: number
  } = {},
) {
  const seen: Seen[] = []
  const statuses = [...(over.job ?? ['succeeded'])]
  let limited = over.rateLimited ?? 0

  const send = (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    seen.push({ method: init.method ?? 'GET', url, headers, body: init.body })

    if (limited > 0) {
      limited -= 1
      return Promise.resolve({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'retry-after' ? (over.retryAfter ?? null) : null),
        },
        json: () => Promise.resolve({}),
      } as unknown as Response)
    }

    const answer = (body: unknown): Response =>
      ({
        ok: over.status === undefined || over.status < 400,
        status: over.status ?? 200,
        json: () => Promise.resolve(body),
      }) as unknown as Response

    if (init.method === 'POST') {
      return Promise.resolve(
        answer({ holderId: 'h-1', uploadUrl: 'https://storage.invalid/put?sig=x' }),
      )
    }
    if (init.method === 'PUT') return Promise.resolve(answer({}))
    if (init.method === 'PATCH') return Promise.resolve(answer({ jobId: 'j-1', status: 'queued' }))
    if (url.includes('/v1/jobs/')) {
      const status = statuses.length > 1 ? statuses.shift()! : statuses[0]!
      return Promise.resolve(
        answer({ status, error: status === 'failed' ? 'no solid found' : null }),
      )
    }
    return Promise.resolve(answer(over.holder ?? RESPONSE))
  }

  return {
    seen,
    client: createHolderApi({
      baseUrl: 'https://api.invalid',
      apiKey: 'tp_test',
      fetch: send as unknown as typeof globalThis.fetch,
      pollIntervalMs: 0,
      ...(over.pollTimeoutMs === undefined ? {} : { pollTimeoutMs: over.pollTimeoutMs }),
      ...(over.rateLimitAttempts === undefined
        ? {}
        : { rateLimitAttempts: over.rateLimitAttempts }),
    }),
  }
}

describe('where the API is', () => {
  const saved = { url: process.env[API_URL_ENV], key: process.env[API_KEY_ENV] }

  beforeEach(() => {
    delete process.env[API_URL_ENV]
    delete process.env[API_KEY_ENV]
  })
  afterEach(() => {
    if (saved.url === undefined) delete process.env[API_URL_ENV]
    else process.env[API_URL_ENV] = saved.url
    if (saved.key === undefined) delete process.env[API_KEY_ENV]
    else process.env[API_KEY_ENV] = saved.key
  })

  it('defaults to production and says so', () => {
    expect(apiUrl()).toBe(DEFAULT_API_URL)
    expect(describeApi()).toBe(`holder API: ${DEFAULT_API_URL} (${API_URL_ENV} default)`)
  })

  it('says when the environment moved it, which is the case that matters', () => {
    // Production is still Engine API v1.1.0 and carries none of these routes,
    // so a development run is the normal one and it must be visible.
    process.env[API_URL_ENV] = 'http://localhost:4000/'
    expect(apiUrl()).toBe('http://localhost:4000')
    expect(describeApi()).toBe(`holder API: http://localhost:4000 (${API_URL_ENV} set)`)
  })

  it('refuses at construction when no key is set, not at the first request', () => {
    // A batch that authenticated per holder would fail on holder one after
    // mirroring the whole family, and say 401 instead of naming the variable.
    expect(() => createHolderApi({ baseUrl: 'https://api.invalid' })).toThrow(API_KEY_ENV)
  })
})

describe('measuring one holder', () => {
  it('makes the five calls in order and never puts the key on the upload', async () => {
    const { seen, client } = api()
    const result = await measureHolder(client, PART, new Uint8Array([1, 2, 3]))

    expect(seen.map((s) => `${s.method} ${new URL(s.url).pathname}`)).toEqual([
      'POST /v1/holders',
      'PUT /put',
      'PATCH /v1/holders/h-1',
      'GET /v1/jobs/j-1',
      'GET /v1/holders/h-1',
    ])
    // The presigned URL carries its own authentication; sending a bearer token
    // to a storage host is a token given to a third party for nothing.
    expect(seen[1]!.headers).not.toHaveProperty('Authorization')
    expect(seen[0]!.headers.Authorization).toBe('Bearer tp_test')
    expect(result.brand).toBe('kennametal')
    expect(result.gaugeLength).toBe(10)
  })

  it('imports with the drawing options, not the API defaults', () => {
    // `fillBays` defaults to true at the API and is wrong for a drawing: the
    // V-flange groove and the thread relief are what a machinist looks for.
    expect(DEFAULT_IMPORT_OPTIONS).toEqual({ tolerance: 0.05, fillBays: false, flipped: false })
  })

  it('sends the options it was given on the queue call', async () => {
    const { seen, client } = api()
    await measureHolder(client, PART, new Uint8Array(), DEFAULT_IMPORT_OPTIONS)
    expect(seen[2]!.url).toContain('tolerance=0.05')
    expect(seen[2]!.url).toContain('fillBays=false')
    expect(seen[2]!.url).toContain('flipped=false')
  })

  it('keys the queue call on the holder the API just created, not on the part', async () => {
    // The API binds a key to the holder it first saw and answers 409 when a
    // later request reuses it for a different one. `measureHolder` creates a
    // fresh holder every call, so a key derived from the catalog number is the
    // same string naming a new holder on every run — which made the second
    // measurement of any family fail on its first part, permanently.
    const { seen, client } = api()
    await measureHolder(client, PART, new Uint8Array())

    expect(seen[2]!.headers['Idempotency-Key']).toBe(idempotencyKey('h-1', DEFAULT_IMPORT_OPTIONS))
    expect(seen[2]!.headers['Idempotency-Key']).not.toContain('BT30ER16060M')
  })

  it('keeps the options in the key, because two tolerances are two measurements', async () => {
    expect(idempotencyKey('h-1', DEFAULT_IMPORT_OPTIONS)).not.toBe(
      idempotencyKey('h-1', { ...DEFAULT_IMPORT_OPTIONS, fillBays: true }),
    )
  })

  it('gives two runs of one part two keys, which is what 409ed before', () => {
    // One catalog number measured twice is two holders at the API, because
    // every run creates one. Keying on the holder is what makes the second run
    // a different key; keying on the part made it the same key for a holder the
    // API had never seen, which it refuses.
    expect(idempotencyKey('h-1', DEFAULT_IMPORT_OPTIONS)).not.toBe(
      idempotencyKey('h-2', DEFAULT_IMPORT_OPTIONS),
    )
  })

  it('names the mirrored file the way the mirror wrote it', async () => {
    // REGO-FIX's catalog number carries a slash, and two answers to "what is
    // this part's file called" is one too many.
    const { seen, client } = api()
    await measureHolder(
      client,
      { brand: 'regofix', catalogNumber: 'BT 30 / PG 25 x 075' },
      new Uint8Array(),
    )
    expect(seen[0]!.url).toContain(encodeURIComponent('BT 30 - PG 25 x 075.stp'))
  })

  it('waits for a job that is still running', async () => {
    const { seen, client } = api({ job: ['queued', 'running', 'succeeded'] })
    await measureHolder(client, PART, new Uint8Array())
    expect(seen.filter((s) => s.url.includes('/v1/jobs/'))).toHaveLength(3)
  })

  it('treats a failed import as one holder, not one run', async () => {
    // `IncompletePartError` is the only failure a family survives, and losing a
    // 431-holder batch to one unreadable STEP file is not a trade worth making.
    const { client } = api({ job: ['failed'] })
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(IncompletePartError)
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(/no solid found/)
  })

  it('stops the run on a non-2xx, naming the status and not the body', async () => {
    // An error body from an authenticated endpoint is the one place a token
    // could be echoed back.
    const { client } = api({ status: 401 })
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(VendorResponseError)
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(
      'POST /v1/holders: the holder API answered 401',
    )
  })

  it('waits out a rate limit instead of ending the run on it', async () => {
    // A 429 is the API scheduling this client, not refusing it. Treating one as
    // fatal killed a 217-holder batch partway through on 2026-09-02.
    const { seen, client } = api({ rateLimited: 2, retryAfter: '0.001' })
    const result = await measureHolder(client, PART, new Uint8Array())

    expect(result.gaugeLength).toBe(10)
    // The two refusals, then the five calls that make a measurement.
    expect(seen).toHaveLength(7)
  })

  it('gives up on a rate limit that never lifts, rather than retrying forever', async () => {
    const { client } = api({ rateLimited: 99, retryAfter: '0.001', rateLimitAttempts: 2 })
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(
      'POST /v1/holders: the holder API answered 429',
    )
  })

  it('prefers the API’s own Retry-After, and falls back where it cannot read one', () => {
    const withHeader = {
      headers: { get: () => '30' },
    } as unknown as Response
    const without = { headers: { get: () => null } } as unknown as Response
    const dated = {
      headers: { get: () => 'Wed, 02 Sep 2026 12:00:00 GMT' },
    } as unknown as Response

    expect(retryAfterMs(withHeader, 1)).toBe(30_000)
    // An HTTP-date is a legal `Retry-After` this cannot read as a delay, and a
    // NaN wait would be an immediate retry into the same closed window.
    expect(retryAfterMs(dated, 1)).toBe(RATE_LIMIT_BACKOFF_MS)
    expect(retryAfterMs(without, 1)).toBe(RATE_LIMIT_BACKOFF_MS)
    expect(retryAfterMs(without, 3)).toBe(RATE_LIMIT_BACKOFF_MS * 3)
  })

  it('abandons a job that never settles rather than polling forever', async () => {
    // A batch that hung on holder one is a stack that is not working, not a
    // holder that is not measurable, so this stops the run.
    const { client } = api({ job: ['running'], pollTimeoutMs: 0 })
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(VendorResponseError)
    await expect(measureHolder(client, PART, new Uint8Array())).rejects.toThrow(/still running/)
  })
})

describe('reading the response', () => {
  it('carries only what a profile needs', () => {
    const holder = parseHolderResponse({ ...RESPONSE, faceCount: 60, meshGlbUrl: 'x' }, PART)
    expect(Object.keys(holder).sort()).toEqual([
      'brand',
      'catalogNumber',
      'gaugeLength',
      'kernelVersion',
      'layers',
      'options',
      'sizeClass',
      'taperFamily',
    ])
  })

  it('keeps a null gauge length null, because null is not zero', () => {
    // A straight shank or a Capto carries no cone to place a gauge plane on.
    const holder = parseHolderResponse({ ...RESPONSE, gaugeLength: null, sizeClass: null }, PART)
    expect(holder.gaugeLength).toBeNull()
    expect(holder.sizeClass).toBeNull()
  })

  it('names the field that moved rather than failing three transforms later', () => {
    expect(() => parseHolderResponse({ ...RESPONSE, layers: undefined }, PART)).toThrow(
      /carries no layers/,
    )
    expect(() => parseHolderResponse({ ...RESPONSE, kernelVersion: 7 }, PART)).toThrow(
      /kernelVersion is number/,
    )
    expect(() =>
      parseHolderResponse({ ...RESPONSE, layers: [{ thickness: 1, bottomDiameter: 2 }] }, PART),
    ).toThrow(/layer 0: the holder API response carries no topDiameter/)
  })

  it('refuses a taper family this package has no word for', () => {
    expect(() => parseHolderResponse({ ...RESPONSE, taperFamily: 'capto' }, PART)).toThrow(
      /known: iso7x24, hsk/,
    )
  })
})

describe('measuring a family', () => {
  function holder(catalogNumber: string, materialNumber: string): HolderRecord {
    return holderRecord({
      brand: 'kennametal',
      materialNumber,
      catalogNumber,
      description: '',
      unit: 'millimeters',
      taper: 'BT30',
      contact: 'taper',
      clamping: 'collet',
      style: 'er-collet-chuck',
      colletSeries: 'ER16',
      gaugeLength: 10,
      bore: null,
      usableLength: null,
      clampingLength: null,
      adjustmentRange: null,
      bodyDiameter: null,
      lockNutDiameter: null,
      cadModelUrl: null,
      cadModelSource: 'vendor-stated',
      cadDxfUrl: null,
      unpublished: [],
    })
  }

  it('counts an unmirrored holder rather than failing on it', async () => {
    // MariTool publishes no STEP model for about a third of its parts and none
    // at all for its CAT50 line, so an absent file is the ordinary case.
    const steps = mkdtempSync(join(tmpdir(), 'steps-'))
    writeFileSync(join(steps, 'A.stp'), 'ISO-10303-21;')
    const { client } = api()

    const run = await measureFamily(
      client,
      [holder('A', '1'), holder('B', '2')],
      steps,
      undefined,
      0,
      () => {},
    )

    expect(run.measured.map((m) => m.catalogNumber)).toEqual(['A'])
    expect(run.unmirrored).toEqual(['B'])
    expect(run.failed).toEqual([])
  })

  it('drops a holder the kernel refused and keeps going', async () => {
    const steps = mkdtempSync(join(tmpdir(), 'steps-'))
    writeFileSync(join(steps, 'A.stp'), 'ISO-10303-21;')
    const { client } = api({ job: ['failed'] })
    const warnings: string[] = []

    const run = await measureFamily(client, [holder('A', '1')], steps, undefined, 0, (m) =>
      warnings.push(m),
    )

    expect(run.measured).toEqual([])
    expect(run.failed).toEqual(['A'])
    expect(warnings.join('\n')).toMatch(/no profile written for it/)
  })

  it('reads back exactly what the mirror wrote, slash and all', () => {
    const steps = mkdtempSync(join(tmpdir(), 'steps-'))
    writeFileSync(join(steps, 'BT 30 - PG 25 x 075.stp'), 'ISO-10303-21;')
    expect(readMirroredStep(steps, 'BT 30 / PG 25 x 075')).not.toBeNull()
    expect(readMirroredStep(steps, 'absent')).toBeNull()
  })
})
