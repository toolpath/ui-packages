import { EngineScenarioError } from './errors.js'
import { scenarioInternals, type EngineScenario, type ScenarioResponse } from './scenario.js'

/** A dispatcher response as a Fetch API `Response`. */
export const toFetchResponse = (
  response: Extract<ScenarioResponse, { kind: 'response' }>,
): Response =>
  new Response(response.body ?? null, { status: response.status, headers: response.headers })

/** The API base path a scenario serves under its origin (`''` for the origin root). */
export const apiPathPrefix = (scenario: EngineScenario): string =>
  new URL(scenario.baseUrl).pathname.replace(/\/+$/, '')

/**
 * A `fetch` that serves a scenario in memory: pass it to `createToolpathClient`
 * (and to `uploadToPresignedUrl`) to run the real SDK with no network. It is
 * strict: a request for any other host is a violation, never a real request.
 */
export const createEngineFetch = (scenario: EngineScenario): typeof globalThis.fetch => {
  const { dispatch, violation } = scenarioInternals(scenario)
  const api = new URL(scenario.baseUrl)
  const prefix = apiPathPrefix(scenario)
  const engineFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const isApi =
      url.origin === api.origin &&
      (prefix === '' || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
    const isStorage = url.origin === scenario.storageOrigin
    if (!isApi && !isStorage) {
      violation(
        `${request.method} ${url.origin}${url.pathname} is addressed to neither this scenario's Engine API (${scenario.baseUrl}) ` +
          `nor its storage host (${scenario.storageOrigin}). The scenario's fetch never falls back to the network.`,
      )
    }
    if (request.signal.aborted) {
      throw request.signal.reason as Error
    }
    const body = request.body ? new Uint8Array(await request.arrayBuffer()) : undefined
    const response = await dispatch(
      { method: request.method, url, headers: request.headers, body, signal: request.signal },
      {
        target: isApi ? 'api' : 'storage',
        pathPrefix: isApi ? prefix : '',
        storageBase: scenario.storageOrigin,
      },
    )
    if (response.kind === 'network-failure') {
      throw new TypeError('fetch failed', {
        cause: new EngineScenarioError(
          `The test failed ${response.operationId} with a network error`,
        ),
      })
    }
    return toFetchResponse(response)
  }
  return engineFetch
}
