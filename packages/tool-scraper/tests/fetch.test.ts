/**
 * The shared transport: what every vendor request carries, and how each of the
 * four bodies is decoded.
 *
 * The decoding asymmetry is the part worth testing. `text` replaces an
 * undecodable byte and `json` refuses one, and both choices are deliberate —
 * losing 256 good rows of a vendor table to one stray byte in a description is
 * worse than the byte, and handing a JSON parser a document the server never
 * sent is worse than failing.
 */

import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_TIMEOUT_MS, USER_AGENT, createFetcher } from '../src/fetch.js'

/** A `fetch` that records what it was asked and answers with `body`. */
function stub(body: string | Uint8Array, init: ResponseInit = {}) {
  const calls: [string, RequestInit | undefined][] = []
  const send = vi.fn(async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push([String(url), opts])
    return new Response(body, init)
  })
  return { send: send as unknown as typeof globalThis.fetch, calls }
}

describe('every request', () => {
  it('identifies as a browser', async () => {
    // Not evasion: these are unauthenticated, publicly served endpoints, and a
    // default agent gets a 403 from ordinary CDN rules on two of three hosts.
    const { send, calls } = stub('ok')
    await createFetcher({ fetch: send }).text('https://example.test/x')

    const headers = calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toBe(USER_AGENT)
  })

  it('carries a timeout', async () => {
    const { send, calls } = stub('ok')
    await createFetcher({ fetch: send }).text('https://example.test/x')

    expect(calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('takes a caller’s own user agent and timeout', async () => {
    // A backend embedding this has its own opinions; the point of the options
    // is that expressing them does not mean reimplementing the decoding rules.
    const { send, calls } = stub('ok')
    await createFetcher({ fetch: send, userAgent: 'toolpath/1' }).text('https://example.test/x')

    const headers = calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['User-Agent']).toBe('toolpath/1')
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000)
  })

  it('names the URL when the vendor does not answer 2xx', async () => {
    const { send } = stub('nope', { status: 503 })

    await expect(createFetcher({ fetch: send }).text('https://example.test/x')).rejects.toThrow(
      /example\.test\/x: the vendor answered 503/,
    )
  })
})

describe('decoding', () => {
  it('replaces an undecodable byte in text rather than losing the table', async () => {
    // These are vendor HTML and XML documents that occasionally carry a stray
    // byte in a description, and refusing the whole 257-row table over one of
    // them would lose the 256 good rows to no purpose.
    const { send } = stub(new Uint8Array([0x41, 0xff, 0x42]))

    expect(await createFetcher({ fetch: send }).text('https://example.test/x')).toBe('A�B')
  })

  it('refuses an undecodable byte in JSON', async () => {
    // A JSON document with one in it is a broken response, and replacing the
    // byte would hand the parser a document the server never sent.
    const { send } = stub(new Uint8Array([0x7b, 0xff, 0x7d]))

    await expect(createFetcher({ fetch: send }).json('https://example.test/x')).rejects.toThrow()
  })

  it('parses JSON on a GET', async () => {
    const { send } = stub(JSON.stringify({ rows: [1, 2] }))

    expect(await createFetcher({ fetch: send }).json('https://example.test/x')).toEqual({
      rows: [1, 2],
    })
  })

  it('returns bytes verbatim', async () => {
    // For anything that is not text — a STEP model.
    const { send } = stub(new Uint8Array([1, 2, 3]))

    expect(await createFetcher({ fetch: send }).bytes('https://example.test/x')).toEqual(
      new Uint8Array([1, 2, 3]),
    )
  })
})

describe('posting a JSON body', () => {
  it('sends the payload and the content type', async () => {
    const { send, calls } = stub(JSON.stringify({ hits: [] }))

    const result = await createFetcher({ fetch: send }).postJson(
      'https://example.test/elastic/post',
      { query: 'x' },
    )

    const init = calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init?.body).toBe('{"query":"x"}')
    expect(result).toEqual({ hits: [] })
  })
})

describe('the no-network guard', () => {
  it('refuses a request that reaches the real global fetch', async () => {
    // `tests/setup.ts` replaces it for every test in this suite. Without the
    // guard, a test that forgets its stub pages a vendor's catalog and passes.
    await expect(createFetcher().text('https://www.kennametal.com/x')).rejects.toThrow(
      /a test tried to reach/,
    )
  })
})
