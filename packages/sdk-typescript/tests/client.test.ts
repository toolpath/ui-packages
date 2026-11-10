import { describe, expect, it, vi } from 'vitest'

import { createToolpathClient } from '../src/client.js'
import * as generated from '../src/generated/index.js'

describe('createToolpathClient', () => {
  it('has every generated API', () => {
    const client = createToolpathClient({ apiKey: 'tp_test' })
    const apis = Object.entries(generated).filter(
      (entry): entry is [string, typeof generated.BaseAPI] =>
        entry[0].endsWith('Api') && typeof entry[1] === 'function',
    )
    expect(apis.length).toBeGreaterThan(0)
    for (const [name, api] of apis) {
      expect(
        Object.values(client).some((value) => value instanceof api),
        `${name} is on the client`,
      ).toBe(true)
    }
  })

  it('reads a file with the key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      Response.json({
        fileId: 'file-1',
        filename: 'bracket.step',
        createdAt: '2026-11-06T12:00:00.000Z',
        bodies: [],
        shapes: [],
        hasMesh: false,
        inspectJobId: null,
      }),
    )
    const client = createToolpathClient({
      apiKey: 'tp_test',
      baseUrl: 'https://api.example.test',
      fetch,
    })
    const file = await client.files.getFile({ id: 'file-1' })
    expect(file.fileId).toBe('file-1')
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.example.test/v1/files/file-1')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tp_test')
  })
})
