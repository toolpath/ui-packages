import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { scenarioInternals, type EngineScenario } from './scenario.js'

/** Where the server mounts the scenario's storage host, so signed URLs reach it over real HTTP. */
export const STORAGE_MOUNT = '/__storage'

export interface EngineTestServer {
  /** The Engine API base URL to give `createToolpathClient`: `http://127.0.0.1:<port>`. */
  readonly url: string
  /** Stops listening and drops open connections, event streams included. Safe to call more than once. */
  readonly close: () => Promise<void>
}

export interface EngineTestServerOptions {
  /** The loopback address to bind. Default `127.0.0.1`. */
  host?: string
}

const toHeaders = (request: IncomingMessage): Headers => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue
    }
    for (const entry of [value].flat()) {
      headers.append(name, entry)
    }
  }
  return headers
}

const readBody = async (request: IncomingMessage): Promise<Uint8Array<ArrayBuffer> | undefined> => {
  const chunks: Array<Buffer> = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) {
    return undefined
  }
  const joined = Buffer.concat(chunks)
  return new Uint8Array(
    joined.buffer.slice(joined.byteOffset, joined.byteOffset + joined.byteLength),
  )
}

/**
 * Serves a scenario over real HTTP on an ephemeral loopback port, for tests
 * that need the network boundary: real sockets, headers and streaming. It uses
 * the same dispatcher as the injected fetch, so state and errors are identical.
 * A request the scenario rejects (see `scenario.violations`) or a simulated
 * network failure closes the connection without a response.
 */
export const startEngineTestServer = async (
  scenario: EngineScenario,
  { host = '127.0.0.1' }: EngineTestServerOptions = {},
): Promise<EngineTestServer> => {
  const { dispatch } = scenarioInternals(scenario)
  let base = ''

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const abort = new AbortController()
    response.on('close', () => {
      if (!response.writableFinished) {
        abort.abort(new DOMException('The client closed the connection', 'AbortError'))
      }
    })
    try {
      const body = await readBody(request)
      const url = new URL(request.url ?? '/', base)
      const storage = url.pathname === STORAGE_MOUNT || url.pathname.startsWith(`${STORAGE_MOUNT}/`)
      const result = await dispatch(
        {
          method: request.method ?? 'GET',
          url,
          headers: toHeaders(request),
          body,
          signal: abort.signal,
        },
        {
          target: storage ? 'storage' : 'api',
          pathPrefix: storage ? STORAGE_MOUNT : '',
          storageBase: `${base}${STORAGE_MOUNT}`,
        },
      )
      if (result.kind === 'network-failure') {
        request.socket.destroy()
        return
      }
      response.writeHead(result.status, result.headers)
      if (result.body instanceof ReadableStream) {
        response.flushHeaders()
        const reader = result.body.getReader()
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            response.write(value)
          }
          response.end()
        } catch {
          // An interrupted or aborted stream: drop the connection as a broken one does.
          response.destroy()
        }
        return
      }
      response.end(result.body)
    } catch {
      // A scenario violation (recorded on the scenario) or an aborted request has no contract response.
      response.destroy()
    }
  }

  const server = createServer((request, response) => {
    void handle(request, response)
  })
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, host, () => {
      server.off('error', reject)
      resolvePromise()
    })
  })
  const address = server.address() as AddressInfo
  base = `http://${host}:${address.port}`

  let closing: Promise<void> | undefined
  return {
    url: base,
    close: () => {
      closing ??= new Promise<void>((resolvePromise, reject) => {
        server.closeAllConnections()
        server.close((error) => {
          if (error) {
            reject(error)
          } else {
            resolvePromise()
          }
        })
      })
      return closing
    },
  }
}
