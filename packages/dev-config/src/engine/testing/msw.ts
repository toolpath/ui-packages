import { HttpResponse, http, type RequestHandler } from 'msw'
import { EngineScenarioError } from './errors.js'
import { apiPathPrefix, toFetchResponse } from './fetch.js'
import { scenarioInternals, type EngineScenario } from './scenario.js'

/**
 * MSW handlers for a scenario's Engine API and storage host, backed by the
 * same dispatcher as the injected fetch. Use them with `setupServer` from
 * `msw/node` (including Vitest's jsdom environment) and
 * `onUnhandledRequest: 'error'`, so a request for any other host fails too.
 * A request the scenario rejects (see `scenario.violations`) or a simulated
 * network failure is answered with a network error.
 */
export const createEngineHandlers = (scenario: EngineScenario): Array<RequestHandler> => {
  const { dispatch } = scenarioInternals(scenario)
  const api = new URL(scenario.baseUrl)
  const prefix = apiPathPrefix(scenario)

  const handle = async (request: Request, target: 'api' | 'storage'): Promise<Response> => {
    const url = new URL(request.url)
    const body = request.body ? new Uint8Array(await request.arrayBuffer()) : undefined
    try {
      const result = await dispatch(
        { method: request.method, url, headers: request.headers, body, signal: request.signal },
        { target, pathPrefix: target === 'api' ? prefix : '', storageBase: scenario.storageOrigin },
      )
      return result.kind === 'network-failure' ? HttpResponse.error() : toFetchResponse(result)
    } catch (error) {
      if (error instanceof EngineScenarioError) {
        return HttpResponse.error()
      }
      throw error
    }
  }

  return [
    http.all(`${api.origin}${prefix}/*`, ({ request }) => handle(request, 'api')),
    http.all(`${scenario.storageOrigin}/*`, ({ request }) => handle(request, 'storage')),
  ]
}
