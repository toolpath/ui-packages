import * as stableSdk from '@toolpath/api'
import * as stagingSdk from '@toolpath/api-staging'
import { setupServer } from 'msw/node'
import { findInstalledPackage } from '../../../src/config/packages.js'
import {
  TEST_API_KEY,
  createEngineFetch,
  createEngineScenario,
  type EngineContractId,
  type EngineScenario,
  type EngineScenarioOptions,
} from '../../../src/engine/testing/index.js'
import { createEngineHandlers } from '../../../src/engine/testing/msw.js'
import { startEngineTestServer } from '../../../src/engine/testing/node.js'

export type Sdk = typeof stableSdk | typeof stagingSdk

export interface SdkUnderTest {
  name: string
  sdk: Sdk
  version: string
  contract: EngineContractId
  /** The server this channel's tests address, passed explicitly: an SDK package selects no server. */
  baseUrl: string
}

const versionOf = (alias: string): string => {
  const installed = findInstalledPackage(process.cwd(), alias)
  if (!installed) {
    throw new Error(`${alias} is not installed; run pnpm install in packages/dev-config`)
  }
  return installed.version
}

export const SDKS: ReadonlyArray<SdkUnderTest> = [
  {
    name: 'stable @toolpath/api',
    sdk: stableSdk,
    version: versionOf('@toolpath/api'),
    contract: 'api-1.29.1',
    baseUrl: 'https://api.toolpath.com',
  },
  {
    name: 'staging @toolpath/api',
    sdk: stagingSdk,
    version: versionOf('@toolpath/api-staging'),
    contract: 'api-1.32.0',
    baseUrl: 'https://api.staging.toolpath.com',
  },
]

export type TransportName = 'fetch' | 'node' | 'msw'

export const TRANSPORTS: ReadonlyArray<TransportName> = ['fetch', 'node', 'msw']

export interface Session {
  scenario: EngineScenario
  /** The base URL the SDK client was given. */
  baseUrl: string
  /** The fetch the client and the upload helper use. */
  fetch: typeof globalThis.fetch
  client: ReturnType<Sdk['createToolpathClient']>
  stop: () => Promise<void>
}

/** A scenario for one SDK artifact behind one transport, with an SDK client pointed at it. */
export const open = async (
  under: SdkUnderTest,
  transport: TransportName,
  options: EngineScenarioOptions = {},
  apiKey: string = TEST_API_KEY,
): Promise<Session> => {
  const scenario = createEngineScenario({
    contract: under.contract,
    sdkVersion: under.version,
    baseUrl: under.baseUrl,
    ...options,
  })
  let baseUrl = scenario.baseUrl
  let fetch: typeof globalThis.fetch
  let stop = (): Promise<void> => Promise.resolve()
  switch (transport) {
    case 'fetch':
      fetch = createEngineFetch(scenario)
      break
    case 'node': {
      const server = await startEngineTestServer(scenario)
      baseUrl = server.url
      fetch = globalThis.fetch
      stop = server.close
      break
    }
    case 'msw': {
      const server = setupServer(...createEngineHandlers(scenario))
      server.listen({ onUnhandledRequest: 'error' })
      // MSW patches the global fetch, so the client must look it up on every call.
      fetch = (input, init) => globalThis.fetch(input, init)
      stop = () => {
        server.close()
        return Promise.resolve()
      }
      break
    }
  }
  const client = under.sdk.createToolpathClient({ apiKey, baseUrl, fetch })
  return {
    scenario,
    baseUrl,
    fetch,
    client,
    stop: async () => {
      scenario.close()
      await stop()
    },
  }
}

/** The rejection of a promise that must reject. */
export const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the promise to reject')
}

/** The HTTP status, headers and parsed body of an SDK `ResponseError`. */
export const problemOf = async (
  error: unknown,
): Promise<{ status: number; body: unknown; headers: Headers }> => {
  if (
    !(error instanceof Error) ||
    !('response' in error) ||
    !(error.response instanceof Response)
  ) {
    throw new Error(`Expected an SDK ResponseError, got ${String(error)}`)
  }
  const body: unknown = await error.response.json()
  return { status: error.response.status, body, headers: error.response.headers }
}

/** `value`, or a thrown error naming what was missing. */
export const defined = <T>(value: T | undefined | null, what: string): T => {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${what}`)
  }
  return value
}

/** Reads a stream until `count` complete server-sent events have arrived. */
export const readEvents = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
): Promise<string> => {
  const decoder = new TextDecoder()
  let text = ''
  while (text.split('\n\n').length - 1 < count) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    text += decoder.decode(value, { stream: true })
  }
  return text
}

export const CAD_BYTES = new TextEncoder().encode(
  'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n',
)
