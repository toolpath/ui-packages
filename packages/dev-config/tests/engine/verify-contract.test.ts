import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTarget } from '../../src/cli/commands/engine.js'
import { contractFile } from '../../src/engine/contracts.js'
import { ContractFetchError, verifyEngineContract } from '../../src/engine/verify.js'
import { UsageError } from '../../src/errors.js'
import { toolchain } from '../../src/policy/toolchain.js'

const STABLE = new Uint8Array(readFileSync(contractFile('api-1.29.1')))
const STAGING = new Uint8Array(readFileSync(contractFile('api-1.32.0')))
const stablePin = toolchain.engine.contracts['api-1.29.1']
const packageRoot = fileURLToPath(new URL('../..', import.meta.url))

const serving = (bytes: Uint8Array<ArrayBuffer>, status = 200): typeof globalThis.fetch => {
  const fakeFetch = (input: RequestInfo | URL): Promise<Response> => {
    expect(input instanceof Request ? input.url : input.toString()).toMatch(/\/v1\/openapi\.json$/)
    return Promise.resolve(
      new Response(bytes, { status, headers: { 'content-type': 'application/json' } }),
    )
  }
  return fakeFetch
}

const stableSdk = {
  version: '0.9.0',
  openApiSha256: stablePin?.sha256 ?? '',
  openApiVersion: '1.29.1',
}

describe('verifyEngineContract', () => {
  it('agrees when the target, snapshot and SDK name the same contract', async () => {
    const result = await verifyEngineContract({
      targetUrl: 'https://api.toolpath.com',
      contract: 'api-1.29.1',
      sdk: stableSdk,
      fetch: serving(STABLE),
    })
    expect(result.mismatches).toEqual([])
    expect(result.target).toMatchObject({
      url: 'https://api.toolpath.com/v1/openapi.json',
      apiVersion: '1.29.1',
    })
    expect(result.sdk?.contract).toBe('api-1.29.1')
  })

  it('names the pinned contract a target serves when it is not the chosen one', async () => {
    const result = await verifyEngineContract({
      targetUrl: 'https://api.staging.toolpath.com',
      contract: 'api-1.29.1',
      sdk: stableSdk,
      fetch: serving(STAGING),
    })
    expect(result.mismatches[0]).toMatch(
      /serves API 1\.32\.0 .* It matches the pinned api-1\.32\.0 snapshot instead/,
    )
    expect(result.mismatches[1]).toMatch(/was not generated from the contract the target serves/)
  })

  it('reports an SDK generated from another contract, and an unsupported SDK line', async () => {
    const result = await verifyEngineContract({
      targetUrl: 'https://api.toolpath.com',
      contract: 'api-1.29.1',
      sdk: { version: '0.4.1', openApiSha256: 'f'.repeat(64), openApiVersion: '1.10.0' },
      fetch: serving(STABLE),
    })
    expect(result.mismatches).toHaveLength(3)
    expect(result.mismatches[2]).toBe(
      '@toolpath/api 0.4.1 is not an SDK line this release supports.',
    )
  })

  it('fails to read a target that does not serve its contract', async () => {
    await expect(
      verifyEngineContract({
        targetUrl: 'https://api.toolpath.com',
        contract: 'api-1.29.1',
        fetch: serving(STABLE, 503),
      }),
    ).rejects.toThrow(ContractFetchError)
    const unreachable = (): Promise<Response> => Promise.reject(new TypeError('fetch failed'))
    await expect(
      verifyEngineContract({
        targetUrl: 'https://api.toolpath.com',
        contract: 'api-1.29.1',
        fetch: unreachable,
      }),
    ).rejects.toThrow(
      /Could not read https:\/\/api\.toolpath\.com\/v1\/openapi\.json: fetch failed/,
    )
  })
})

describe('resolveTarget', () => {
  it('maps the named environments and accepts https or a loopback test server', () => {
    expect(resolveTarget(undefined)).toBe('https://api.toolpath.com')
    expect(resolveTarget('staging')).toBe('https://api.staging.toolpath.com')
    expect(resolveTarget('https://engine.example.test/v1/openapi.json')).toBe(
      'https://engine.example.test',
    )
    expect(resolveTarget('http://127.0.0.1:4010')).toBe('http://127.0.0.1:4010')
    expect(() => resolveTarget('http://engine.example.test')).toThrow(UsageError)
    expect(() => resolveTarget('not a url')).toThrow(/use production, staging, or an https URL/)
  })
})

describe('toolpath-dev engine verify-contract', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise<void>((resolvePromise) => {
      if (server) {
        server.close(() => {
          resolvePromise()
        })
      } else {
        resolvePromise()
      }
    })
    server = undefined
  })

  const serve = async (bytes: Uint8Array): Promise<string> => {
    server = createServer((_, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(bytes)
    })
    await new Promise<void>((resolvePromise) => {
      server?.listen(0, '127.0.0.1', () => {
        resolvePromise()
      })
    })
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  const cli = (args: Array<string>): Promise<{ code: number | null; output: string }> =>
    new Promise((resolvePromise, reject) => {
      const child = spawn(process.execPath, ['dist/cli/main.js', ...args], { cwd: packageRoot })
      let output = ''
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        resolvePromise({ code, output })
      })
    })

  it('exits 0 when everything agrees and 1 when the target serves another contract', async () => {
    const stable = await serve(STABLE)
    const agreed = await cli([
      'engine',
      'verify-contract',
      '--target',
      stable,
      '--contract',
      'api-1.29.1',
    ])
    expect(agreed.output).toContain('the target, snapshot and SDK agree')
    expect(agreed.code).toBe(0)
    server?.close()

    const staging = await serve(STAGING)
    const disagreed = await cli([
      'engine',
      'verify-contract',
      '--target',
      staging,
      '--contract',
      'api-1.29.1',
    ])
    expect(disagreed.output).toContain('It matches the pinned api-1.32.0 snapshot instead')
    expect(disagreed.code).toBe(1)
  })

  it('exits 2 for an invalid contract choice', async () => {
    const result = await cli([
      'engine',
      'verify-contract',
      '--target',
      'http://127.0.0.1:9',
      '--contract',
      'api-0.0.0',
    ])
    expect(result.code).toBe(2)
    expect(result.output).toContain('supported contracts are api-1.29.1, api-1.32.0')
  })
})
