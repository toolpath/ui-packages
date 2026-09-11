/**
 * The polite GET every transport here was copying.
 *
 * Three vendors, three unrelated transports — an AEM variant-table GET, a
 * Firestore REST walk, an Elasticsearch proxy POST — and all three arrived at
 * the same four lines: build a request, set a browser `User-Agent`, send it
 * with a timeout, decode. Four copies of four lines is not expensive; four
 * copies of the *decisions* in them is, because the decisions are the part
 * that has to be consistent. A vendor whose transport needs something else — a
 * session, a retry policy, a browser — keeps it in its own module rather than
 * widening this one.
 *
 * **The `User-Agent` is not evasion.** These are unauthenticated, publicly
 * served endpoints; a default agent gets a 403 from ordinary CDN rules on two
 * of the three hosts, and the request is otherwise exactly what a browser on
 * the vendor's own page makes.
 *
 * ## Why this is an interface and not four exported functions
 *
 * A Node backend embedding this has its own opinions about retries,
 * connection pools, proxies and rate limits, and patching a module global is
 * not how it expresses them.
 *
 * So every scrape takes a {@link Fetcher}. The default is the four lines
 * below; a caller that wants otherwise passes its own, and a test passes a
 * stub with no network behind it. `tests/setup.ts` additionally replaces the
 * global `fetch` with one that throws, so a test that forgets to pass a stub
 * fails loudly instead of quietly paging a vendor's whole catalog.
 */

/** What every request from the default fetcher identifies as. */
export const USER_AGENT = 'Mozilla/5.0'

/**
 * Milliseconds. Long, because a vendor's variant table for a 259-row family is
 * a slow render on their side and a timeout would read as a scrape failure.
 */
export const DEFAULT_TIMEOUT_MS = 60_000

/**
 * The transport a scrape reads through.
 *
 * Four methods because the four vendors between them need exactly four
 * behaviours, and the differences are deliberate — see {@link createFetcher}.
 */
export interface Fetcher {
  /** One GET, verbatim. For anything that is not text — a STEP model. */
  bytes(url: string): Promise<Uint8Array>
  /** One GET, decoded as UTF-8, replacing undecodable bytes. */
  text(url: string): Promise<string>
  /** One GET, parsed as JSON. */
  json<T = unknown>(url: string): Promise<T>
  /** One POST of a JSON body, parsed as JSON. */
  postJson<T = unknown>(url: string, payload: unknown): Promise<T>
}

/** Options the default fetcher accepts. */
export interface FetcherOptions {
  /** Milliseconds before a request is abandoned. */
  timeoutMs?: number
  /** What to identify as. */
  userAgent?: string
  /**
   * The underlying `fetch`. Injectable so a consumer can supply an
   * instrumented or proxied one without reimplementing the decoding rules
   * below, which are the part that has to stay consistent.
   */
  fetch?: typeof globalThis.fetch
}

/**
 * A response that is not a 2xx, named so the URL is in the message.
 *
 * Carries the status because one caller needs to tell 404 from everything
 * else: REGO-FIX publishes no DIN 4000 document for two of its BT+ 30 holders,
 * and "the vendor has none" is a real state a scrape skips past, where any
 * other status is a failed request that has to stop the run.
 */
export class HttpError extends Error {
  readonly status: number
  readonly url: string

  constructor(url: string, status: number) {
    super(`${url}: the vendor answered ${status}`)
    this.status = status
    this.url = url
    Object.setPrototypeOf(this, HttpError.prototype)
    this.name = 'HttpError'
  }
}

/**
 * The HTTP status behind an error, or null when it carries none.
 *
 * Duck-typed rather than an `instanceof HttpError` check, so a consumer that
 * supplies its own {@link Fetcher} — with its own error type carrying its own
 * `status` — still gets the 404 handling the vendor adapters depend on.
 */
export function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

function checkOk(url: string, response: Response): void {
  if (!response.ok) throw new HttpError(url, response.status)
}

/**
 * The default transport: one request, a browser `User-Agent`, and a timeout.
 *
 * The two decoders differ on purpose. `text` replaces an undecodable byte,
 * because these are vendor HTML and XML documents that occasionally carry a
 * stray byte in a description, and refusing the whole 257-row table over one
 * of them would lose the 256 good rows to no purpose. `json` is strict,
 * because a JSON document with an undecodable byte in it is a broken response
 * and replacing the byte would hand the parser a document the server never
 * sent.
 */
export function createFetcher(options: FetcherOptions = {}): Fetcher {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = USER_AGENT,
    fetch: send = globalThis.fetch,
  } = options

  async function request(url: string, init?: RequestInit): Promise<Response> {
    const response = await send(url, {
      ...init,
      headers: { 'User-Agent': userAgent, ...init?.headers },
      signal: AbortSignal.timeout(timeoutMs),
    })
    checkOk(url, response)
    return response
  }

  return {
    async bytes(url) {
      return new Uint8Array(await (await request(url)).arrayBuffer())
    },

    async text(url) {
      const buffer = await (await request(url)).arrayBuffer()
      return new TextDecoder('utf-8').decode(buffer)
    },

    async json<T>(url: string) {
      const buffer = await (await request(url)).arrayBuffer()
      const body = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      return JSON.parse(body) as T
    },

    async postJson<T>(url: string, payload: unknown) {
      const response = await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer())
      return JSON.parse(body) as T
    },
  }
}
