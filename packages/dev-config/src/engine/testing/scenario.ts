import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_ENGINE_CONTRACT,
  ENGINE_CONTRACT_IDS,
  contractForSdkVersion,
  isEngineContractId,
  loadContract,
  sha256,
  type EngineContractId,
  type LoadedContract,
  type OpenApiOperation,
  type OpenApiParameter,
} from '../contracts.js'
import { ARTIFACTS, ARTIFACT_NAMES, artifactBytes, isArtifactName } from './artifacts.js'
import { EngineScenarioError } from './errors.js'
import {
  DEFAULT_ENGINE_BASE_URL,
  DEFAULT_STORAGE_ORIGIN,
  TEST_UPLOAD_BUCKET,
  createApiKeyFixture,
  createProblemFixture,
  createReportFixture,
} from './fixtures.js'
import {
  DEFAULT_SCENARIO_INSTANT,
  DEFAULT_SCENARIO_SEED,
  deterministicUuid,
  signStoragePath,
} from './ids.js'
import { matchRoute, routesFor, type Route } from './routes.js'
import { openJobEventStream, type JobEventStream } from './sse.js'
import { validatorFor, type ContractValidator } from './validator.js'
import type {
  ApiKeyFixture,
  Direction,
  FileBodyFixture,
  JobFixture,
  JobStatus,
  JobSummaryFixture,
  PartFixture,
  ProblemFixture,
  ProblemFixtureOverrides,
  ReportFixture,
  ReportFixtureOverrides,
} from './wire.js'

/** Presigned URLs, upload and artifact alike, last fifteen minutes, as the contract documents for artifacts. */
export const PRESIGNED_URL_LIFETIME_SECONDS = 15 * 60

/** Pseudo-operations for the storage host, which the Engine contract does not describe. */
export const STORAGE_OPERATIONS = ['presignedUpload', 'artifactDownload'] as const
export type StorageOperation = (typeof STORAGE_OPERATIONS)[number]

export type JobTransition =
  | 'running'
  | 'succeeded'
  | 'failed'
  | { status: 'running'; progress?: number | null }
  | { status: 'succeeded'; report?: Omit<ReportFixtureOverrides, 'contract' | 'index'> }
  | { status: 'failed'; error?: string; bodies?: Array<FileBodyFixture> }

/**
 * A one-shot failure for the next call of one operation: a documented error
 * response, a transport failure with no response, or (for client robustness
 * tests) a success status whose body is not valid JSON.
 */
export type EngineFailure =
  | { status: number; problem?: Omit<ProblemFixtureOverrides, 'status'> }
  | { network: true }
  | { malformedBody: true }

export interface EngineScenarioState {
  apiKeys?: Array<ApiKeyFixture>
  parts?: Array<PartFixture>
  jobs?: Array<JobFixture>
  reports?: Array<ReportFixture>
}

export interface EngineScenarioOptions {
  /** One of the immutable supported contracts. Default `api-1.29.1`. */
  contract?: EngineContractId
  /** Seeds every identifier and signature. Default `toolpath-dev-config`. */
  seed?: string
  /** The scenario's clock. Default: always `2026-01-01T00:00:00.000Z`. */
  now?: () => Date
  /**
   * Milliseconds each request waits before it is handled: one value for every
   * operation, or per operation ID. Default 0 (no timer at all). Delays use
   * `setTimeout`, so fake timers control them.
   */
  latency?: number | Partial<Record<string, number>>
  /** Resources the test owns from the start; validated against the contract. */
  state?: EngineScenarioState
  /**
   * The Engine API base URL the fetch and MSW adapters serve. Default the SDK's
   * own default, `https://api.toolpath.com`. A staging test passes the staging
   * URL here and to the SDK client: installing a staging SDK selects no server.
   */
  baseUrl?: string
  /** The synthetic host presigned upload and artifact URLs point at. Default `https://storage.engine.test`. */
  storageOrigin?: string
  /**
   * The `@toolpath/api` version under test. Default: the version installed
   * where the tests run, when one is. A version whose contract is not the
   * selected one fails scenario creation.
   */
  sdkVersion?: string
}

export interface EngineRequestRecord {
  readonly sequence: number
  readonly target: 'api' | 'storage'
  /** The contract operation, `presignedUpload`, `artifactDownload`, or `unmatched`. */
  readonly operationId: string
  readonly method: string
  readonly origin: string
  readonly path: string
  /** Query parameters, with signatures and tokens redacted. */
  readonly query: Readonly<Record<string, string>>
  /** The parsed JSON body of an API request; an upload records only its size. */
  readonly body?: unknown
  /** Request headers (lowercase), with credentials and cookies redacted. */
  readonly headers: Readonly<Record<string, string>>
  /** The caller: an API key's label, `unknown` for a key the scenario does not hold, or `none`. */
  readonly caller: string
  readonly idempotencyKey?: string
}

export interface EngineScenario {
  readonly contract: EngineContractId
  readonly baseUrl: string
  readonly storageOrigin: string
  /** Every request in arrival order, sanitized. */
  readonly requests: ReadonlyArray<EngineRequestRecord>
  /** Test-kit diagnostics: unmatched requests, unsimulated operations, keys sent to the upload host. */
  readonly violations: ReadonlyArray<string>
  readonly closed: boolean
  /** Moves a job explicitly; nothing advances a job on its own. Returns the job as the API now serves it. */
  readonly advanceJob: (jobId: string, transition: JobTransition) => JobFixture
  /** Makes the next call of `operationId` fail once. */
  readonly failNext: (operationId: string, failure: EngineFailure) => void
  readonly part: (partId: string) => PartFixture | undefined
  readonly job: (jobId: string) => JobFixture | undefined
  readonly report: (reportId: string) => ReportFixture | undefined
  /** Ends a job's open event streams normally (all streams when no job is named). */
  readonly endJobStreams: (jobId?: string) => void
  /** Breaks a job's open event streams mid-response (all streams when no job is named). */
  readonly interruptJobStreams: (jobId?: string) => void
  /** Restores the initial seed, clock-derived state and resources; clears failures and records; releases streams. */
  readonly reset: () => void
  /** Releases every stream; further requests are violations. Safe to call more than once. */
  readonly close: () => void
}

/** How an adapter hands one request to the dispatcher. */
interface ScenarioRequest {
  method: string
  url: URL
  headers: Headers
  body: Uint8Array<ArrayBuffer> | undefined
  signal: AbortSignal | undefined
}

interface ScenarioDispatchContext {
  target: 'api' | 'storage'
  /** Path prefix to strip before routing: the API base path, or the adapter's storage mount. */
  pathPrefix: string
  /** Base URL signed upload and artifact URLs are built on, so they reach this adapter. */
  storageBase: string
}

export type ScenarioResponse =
  | {
      kind: 'response'
      status: number
      headers: Record<string, string>
      body: Uint8Array<ArrayBuffer> | ReadableStream<Uint8Array<ArrayBuffer>> | undefined
    }
  | { kind: 'network-failure'; operationId: string }

export interface ScenarioInternals {
  dispatch: (
    request: ScenarioRequest,
    context: ScenarioDispatchContext,
  ) => Promise<ScenarioResponse>
  violation: (message: string) => never
}

const internals = new WeakMap<EngineScenario, ScenarioInternals>()

/** The dispatcher behind a scenario, for the fetch, Node and MSW adapters. */
export const scenarioInternals = (scenario: EngineScenario): ScenarioInternals => {
  const found = internals.get(scenario)
  if (!found) {
    throw new EngineScenarioError('This value was not created by createEngineScenario.')
  }
  return found
}

type Reply =
  | { status: number; json: unknown }
  | { status: number; problem: ProblemFixture }
  | { status: number; bytes: Uint8Array<ArrayBuffer>; contentType: string }
  | { status: number; stream: JobEventStream }

interface OperationContext {
  request: ScenarioRequest
  route: Route
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  storageBase: string
}

type ProductName = 'core' | 'dfm' | 'quoting'

const REDACTED = '[redacted]'
const SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
])
const SECRET_QUERY =
  /^(signature|x-amz-signature|x-amz-credential|x-amz-security-token|token|access_token|api_key|key)$/i

const TERMINAL: ReadonlyArray<JobStatus> = ['succeeded', 'failed']
const NEXT_STATUS: Readonly<Record<JobStatus, ReadonlyArray<JobStatus>>> = {
  queued: ['running', 'failed'],
  running: ['running', 'succeeded', 'failed'],
  succeeded: [],
  failed: [],
}

const TITLES: Readonly<Record<string, string>> = {
  invalid_api_key: 'Invalid API key',
  product_mismatch: 'API key has no access to this product',
  read_only_key: 'API key may only read',
}

const installedSdkVersion = (): string | undefined => {
  let directory = process.cwd()
  for (;;) {
    const manifest = join(directory, 'node_modules', '@toolpath', 'api', 'package.json')
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }
      return typeof parsed.version === 'string' ? parsed.version : undefined
    }
    const parent = dirname(directory)
    if (parent === directory) {
      return undefined
    }
    directory = parent
  }
}

const sleep = (milliseconds: number, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)
      return
    }
    const abort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason as Error)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolvePromise()
    }, milliseconds)
    signal?.addEventListener('abort', abort, { once: true })
  })

const coerce = (schema: unknown, raw: string): unknown => {
  const type =
    schema !== null && typeof schema === 'object' ? (schema as { type?: unknown }).type : undefined
  if (type === 'integer' || type === 'number') {
    return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw
  }
  if (type === 'boolean') {
    return raw === 'true' ? true : raw === 'false' ? false : raw
  }
  return raw
}

const storageXml = (code: string, message: string): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${code}</Code><Message>${message}</Message></Error>\n`,
  )

const encoder = new TextEncoder()

/**
 * A deterministic, strictly validated simulation of the Engine API surface an
 * upload-and-analyze integration uses, plus the presigned storage host. Every
 * adapter (injected fetch, Node HTTP, MSW) dispatches to this one scenario.
 */
export const createEngineScenario = (options: EngineScenarioOptions = {}): EngineScenario => {
  const contractId = options.contract ?? DEFAULT_ENGINE_CONTRACT
  if (!isEngineContractId(contractId)) {
    throw new EngineScenarioError(
      `"${String(contractId)}" is not a supported Engine contract. Supported: ${ENGINE_CONTRACT_IDS.join(', ')}.`,
    )
  }
  let contract: LoadedContract
  try {
    contract = loadContract(contractId)
  } catch (error) {
    throw new EngineScenarioError(
      `${(error as Error).message} Supported contracts: ${ENGINE_CONTRACT_IDS.join(', ')}.`,
    )
  }
  const sdkVersion = options.sdkVersion ?? installedSdkVersion()
  if (sdkVersion !== undefined) {
    const sdkContract = contractForSdkVersion(sdkVersion)
    if (sdkContract === undefined) {
      throw new EngineScenarioError(
        `@toolpath/api ${sdkVersion} is not a supported SDK line. Supported: ${ENGINE_CONTRACT_IDS.map((id) => `${loadContract(id).pin.sdk} (${id})`).join(', ')}.`,
      )
    }
    if (sdkContract !== contractId) {
      throw new EngineScenarioError(
        `@toolpath/api ${sdkVersion} is built from ${sdkContract}, but this scenario serves ${contractId}. ` +
          `Pass contract: '${sdkContract}' (and the matching base URL), or the sdkVersion of the artifact under test.`,
      )
    }
  }

  const validator: ContractValidator = validatorFor(contract)
  const routes = routesFor(contract)
  const staging = contractId === 'api-1.32.0'
  const seed = options.seed ?? DEFAULT_SCENARIO_SEED
  const fixedInstant = new Date(DEFAULT_SCENARIO_INSTANT)
  const now = options.now ?? ((): Date => new Date(fixedInstant))
  const baseUrl = (options.baseUrl ?? DEFAULT_ENGINE_BASE_URL).replace(/\/+$/, '')
  const storageOrigin = new URL(options.storageOrigin ?? DEFAULT_STORAGE_ORIGIN).origin

  const keys = new Map<string, ApiKeyFixture>()
  const parts = new Map<string, PartFixture>()
  const jobs = new Map<string, JobFixture>()
  const reports = new Map<string, ReportFixture>()
  const idempotency = new Map<string, { operationId: string; partId: string; reply: Reply }>()
  const counters = new Map<string, number>()
  const failures = new Map<string, Array<EngineFailure>>()
  const streams = new Set<JobEventStream>()
  let records: Array<EngineRequestRecord> = []
  let violations: Array<string> = []
  let sequence = 0
  let closed = false

  const iso = (): string => now().toISOString()
  const nextId = (kind: string): string => {
    const ordinal = counters.get(kind) ?? 0
    counters.set(kind, ordinal + 1)
    return deterministicUuid(seed, `scenario-${kind}`, ordinal)
  }

  const violation = (message: string): never => {
    violations.push(message)
    throw new EngineScenarioError(message)
  }

  // ---- initial state -------------------------------------------------------------------------

  const initial: Required<EngineScenarioState> = structuredClone({
    apiKeys: options.state?.apiKeys ?? [createApiKeyFixture()],
    parts: options.state?.parts ?? [],
    jobs: options.state?.jobs ?? [],
    reports: options.state?.reports ?? [],
  })

  const validateState = (state: Required<EngineScenarioState>): void => {
    const issues: Array<string> = []
    const seenKeys = new Set<string>()
    for (const key of state.apiKeys) {
      if (seenKeys.has(key.key)) {
        issues.push(`apiKeys: "${key.label}" repeats a key`)
      }
      seenKeys.add(key.key)
      if (key.key === '' || key.label === '') {
        issues.push('apiKeys: a key and its label must be nonempty')
      }
    }
    const partIds = new Set<string>()
    for (const part of state.parts) {
      const errors = [
        ...validator.schema('state:uuid', { type: 'string', format: 'uuid' }, part.partId),
        ...validator.schema(
          'state:filename',
          { type: 'string', minLength: 1, maxLength: 255 },
          part.filename,
        ),
        ...part.addedDirections.flatMap((direction) => validator.component('Vec3', direction)),
      ]
      for (const error of errors) {
        issues.push(`parts[${part.partId}]: ${error}`)
      }
      if (partIds.has(part.partId)) {
        issues.push(`parts: ${part.partId} appears twice`)
      }
      if (part.bodyIndex !== undefined && !staging) {
        issues.push(
          `parts[${part.partId}]: bodyIndex is an api-1.32.0 capability; ${contractId} does not define it`,
        )
      }
      partIds.add(part.partId)
    }
    const jobIds = new Set<string>()
    for (const job of state.jobs) {
      for (const error of validator.component('JobDetail', job)) {
        issues.push(`jobs[${job.jobUuid}]: ${error}`)
      }
      if (job.partUuid !== null && !partIds.has(job.partUuid)) {
        issues.push(`jobs[${job.jobUuid}]: partUuid ${job.partUuid} is not a part in this state`)
      }
      if (
        job.status === 'succeeded' &&
        job.productType === 'analyze-part' &&
        job.reportId === null
      ) {
        issues.push(`jobs[${job.jobUuid}]: a succeeded analysis names the report it produced`)
      }
      if (job.status !== 'succeeded' && job.reportId !== null) {
        issues.push(`jobs[${job.jobUuid}]: only a succeeded job has a reportId`)
      }
      if (jobIds.has(job.jobUuid)) {
        issues.push(`jobs: ${job.jobUuid} appears twice`)
      }
      jobIds.add(job.jobUuid)
    }
    for (const report of state.reports) {
      for (const error of validator.component('PartResponse', report)) {
        issues.push(`reports[${report.reportId}]: ${error}`)
      }
      if (!partIds.has(report.partId)) {
        issues.push(
          `reports[${report.reportId}]: partId ${report.partId} is not a part in this state`,
        )
      }
      const job = state.jobs.find((candidate) => candidate.jobUuid === report.jobId)
      if (!job) {
        issues.push(`reports[${report.reportId}]: jobId ${report.jobId} is not a job in this state`)
      } else if (job.reportId !== report.reportId || job.partUuid !== report.partId) {
        issues.push(
          `reports[${report.reportId}]: job ${job.jobUuid} names report ${String(job.reportId)} of part ${String(job.partUuid)}`,
        )
      }
    }
    for (const job of state.jobs) {
      if (
        job.reportId !== null &&
        !state.reports.some((report) => report.reportId === job.reportId)
      ) {
        issues.push(`jobs[${job.jobUuid}]: reportId ${job.reportId} is not a report in this state`)
      }
    }
    if (issues.length > 0) {
      throw new EngineScenarioError(
        `The scenario's initial state does not satisfy ${contractId}:\n  - ${issues.join('\n  - ')}`,
      )
    }
  }
  validateState(initial)

  const load = (): void => {
    keys.clear()
    parts.clear()
    jobs.clear()
    reports.clear()
    const state = structuredClone(initial)
    for (const key of state.apiKeys) {
      keys.set(key.key, key)
    }
    for (const part of state.parts) {
      parts.set(part.partId, part)
    }
    for (const job of state.jobs) {
      jobs.set(job.jobUuid, job)
    }
    for (const report of state.reports) {
      reports.set(report.reportId, report)
    }
  }
  load()

  const releaseStreams = (jobId: string | undefined, how: 'end' | 'interrupt'): void => {
    for (const stream of [...streams]) {
      if (jobId === undefined || stream.jobId === jobId) {
        stream[how]()
      }
    }
  }

  // ---- presigned storage -----------------------------------------------------------------------

  const signedUrl = (storageBase: string, path: string): string => {
    const expires = Math.floor(now().getTime() / 1000) + PRESIGNED_URL_LIFETIME_SECONDS
    const url = new URL(`${storageBase}${path}`)
    url.searchParams.set('expires', String(expires))
    url.searchParams.set('signature', signStoragePath(seed, path, expires))
    return url.href
  }

  const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/')

  const uploadUrlFor = (part: PartFixture, storageBase: string): string =>
    signedUrl(storageBase, `/${part.sourceBucket}/${encodeKey(part.sourceS3Key)}`)

  const servedReport = (report: ReportFixture, storageBase: string): ReportFixture => {
    const served = structuredClone(report)
    for (const name of ARTIFACT_NAMES) {
      const field = ARTIFACTS[name].field
      if (served[field] !== null) {
        served[field] = signedUrl(storageBase, `/artifacts/${report.reportId}/${name}`)
      }
    }
    return served
  }

  /** Whether a signed storage URL is genuine and unexpired, by this scenario's clock. */
  const checkSignature = (
    path: string,
    query: URLSearchParams,
  ): 'valid' | 'expired' | 'invalid' => {
    const expires = Number(query.get('expires'))
    const signature = query.get('signature')
    if (!Number.isInteger(expires) || signature !== signStoragePath(seed, path, expires)) {
      return 'invalid'
    }
    return expires * 1000 < now().getTime() ? 'expired' : 'valid'
  }

  const storageResponse = (
    status: number,
    bytes: Uint8Array<ArrayBuffer> | undefined,
    contentType: string,
    extra: Record<string, string> = {},
  ): ScenarioResponse => ({
    kind: 'response',
    status,
    headers: { ...(bytes ? { 'content-type': contentType } : {}), ...extra },
    body: bytes,
  })

  const handleStorage = (
    request: ScenarioRequest,
    path: string,
    operationId: StorageOperation,
  ): ScenarioResponse => {
    const failure = failures.get(operationId)?.shift()
    if (failure) {
      if ('network' in failure) {
        return { kind: 'network-failure', operationId }
      }
      if ('status' in failure) {
        return storageResponse(
          failure.status,
          storageXml('InjectedFailure', `The test failed this ${operationId}`),
          'application/xml',
        )
      }
    }
    const query = request.url.searchParams
    const signature = checkSignature(path, query)
    if (operationId === 'presignedUpload') {
      const segments = path.split('/').slice(1)
      const bucket = segments[0] ?? ''
      const key = segments.slice(1).map(decodeURIComponent).join('/')
      const part = [...parts.values()].find(
        (candidate) => candidate.sourceBucket === bucket && candidate.sourceS3Key === key,
      )
      if (request.headers.has('authorization')) {
        violations.push(
          `An Authorization header was sent to the upload host for ${bucket}/${key}; presigned uploads must not carry the Engine API key.`,
        )
        return storageResponse(
          400,
          storageXml('InvalidArgument', 'Only one auth mechanism allowed'),
          'application/xml',
        )
      }
      if (!part || signature === 'invalid') {
        return storageResponse(
          403,
          storageXml('SignatureDoesNotMatch', 'The request signature does not match'),
          'application/xml',
        )
      }
      if (signature === 'expired') {
        return storageResponse(
          403,
          storageXml('AccessDenied', 'Request has expired'),
          'application/xml',
        )
      }
      if (!request.body || request.body.length === 0) {
        return storageResponse(
          400,
          storageXml('MissingContent', 'The upload has no content'),
          'application/xml',
        )
      }
      part.uploaded = true
      return storageResponse(200, undefined, '', { etag: `"${sha256(request.body).slice(0, 32)}"` })
    }
    const [, , reportId = '', name = ''] = path.split('/')
    const report = reports.get(reportId)
    if (!report || !isArtifactName(name) || report[ARTIFACTS[name].field] === null) {
      return storageResponse(
        404,
        storageXml('NoSuchKey', 'The specified key does not exist'),
        'application/xml',
      )
    }
    if (signature === 'invalid') {
      return storageResponse(
        403,
        storageXml('SignatureDoesNotMatch', 'The request signature does not match'),
        'application/xml',
      )
    }
    if (signature === 'expired') {
      return storageResponse(
        403,
        storageXml('AccessDenied', 'Request has expired'),
        'application/xml',
      )
    }
    return storageResponse(200, artifactBytes(name), ARTIFACTS[name].contentType)
  }

  // ---- Engine operations -----------------------------------------------------------------------

  const problem = (status: number, code: string, detail: string): Reply => ({
    status,
    problem: createProblemFixture({
      status,
      code,
      detail,
      ...(TITLES[code] ? { title: TITLES[code] } : {}),
    }),
  })

  const notFound = (what: string): Reply => problem(404, 'not_found', `${what} was not found`)

  const jobSummary = (job: JobFixture): JobSummaryFixture => ({
    partUuid: job.partUuid,
    holderUuid: job.holderUuid,
    ...(staging ? { fileUuid: job.fileUuid ?? null } : {}),
    jobUuid: job.jobUuid,
    productType: job.productType,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
  })

  /** Jobs newest first: by creation time, then by the order the scenario learned of them. */
  const jobsNewestFirst = (): Array<JobFixture> =>
    [...jobs.values()]
      .map((job, order) => ({ job, order }))
      .sort(
        (a, b) => Date.parse(b.job.createdAt) - Date.parse(a.job.createdAt) || b.order - a.order,
      )
      .map(({ job }) => job)

  const reportFor = (partId: string, jobId: string | null): ReportFixture | undefined => {
    if (jobId !== null) {
      const job = jobs.get(jobId)
      return job?.partUuid === partId && job.reportId !== null
        ? reports.get(job.reportId)
        : undefined
    }
    const latest = jobsNewestFirst().find(
      (job) => job.partUuid === partId && job.status === 'succeeded' && job.reportId !== null,
    )
    return latest?.reportId ? reports.get(latest.reportId) : undefined
  }

  const notify = (job: JobFixture): void => {
    for (const stream of streams) {
      if (stream.jobId === job.jobUuid) {
        stream.send(structuredClone(job))
      }
    }
  }

  const HANDLERS: Readonly<Record<string, (context: OperationContext) => Reply>> = {
    validateKey: ({ request }) => {
      const fixture = keyFor(request.headers)
      if (!fixture || fixture.status !== 'active') {
        return { status: 401, json: { valid: false, status: fixture?.status ?? 'invalid' } }
      }
      return { status: 200, json: { valid: true, status: 'active' } }
    },
    createPart: ({ query, storageBase }) => {
      const filename = query.get('filename') ?? 'part.step'
      const bodyIndex = query.get('bodyIndex')
      const partId = nextId('part')
      const part: PartFixture = {
        partId,
        filename,
        sourceBucket: TEST_UPLOAD_BUCKET,
        sourceS3Key: `uploads/${partId}/${filename}`,
        uploaded: false,
        addedDirections: [],
        ...(bodyIndex === null ? {} : { bodyIndex: Number(bodyIndex) }),
      }
      parts.set(partId, part)
      return {
        status: 201,
        json: {
          partId,
          uploadUrl: uploadUrlFor(part, storageBase),
          sourceBucket: part.sourceBucket,
          sourceS3Key: part.sourceS3Key,
        },
      }
    },
    updatePart: ({ params, body, request }) => {
      const partId = params.id ?? ''
      const idempotencyKey = request.headers.get('idempotency-key')
      if (idempotencyKey !== null) {
        const previous = idempotency.get(idempotencyKey)
        if (previous) {
          return previous.operationId === 'updatePart' && previous.partId === partId
            ? previous.reply
            : problem(
                409,
                'idempotency_conflict',
                'This Idempotency-Key was already used for a different operation',
              )
        }
      }
      const part = parts.get(partId)
      if (!part) {
        return notFound(`Part ${partId}`)
      }
      if (!part.uploaded) {
        return problem(
          409,
          'source_not_uploaded',
          "Upload the part's CAD source to its uploadUrl before analyzing it",
        )
      }
      const requested = (body as { directions?: Array<Direction> } | undefined)?.directions ?? []
      const added = [...part.addedDirections]
      for (const direction of requested) {
        if (
          !added.some(
            (existing) =>
              existing.x === direction.x &&
              existing.y === direction.y &&
              existing.z === direction.z,
          )
        ) {
          added.push(direction)
        }
      }
      if (added.length > 12) {
        return problem(400, 'invalid_request', 'A part takes at most 12 added directions in all')
      }
      part.addedDirections = added
      const createdAt = iso()
      const job: JobFixture = {
        partUuid: partId,
        holderUuid: null,
        ...(staging ? { fileUuid: null } : {}),
        jobUuid: nextId('job'),
        productType: 'analyze-part',
        status: 'queued',
        progress: null,
        error: null,
        reportId: null,
        importId: null,
        createdAt,
        updatedAt: createdAt,
        durationMs: 0,
      }
      jobs.set(job.jobUuid, job)
      const reply: Reply = { status: 202, json: { jobId: job.jobUuid, partId, status: 'queued' } }
      if (idempotencyKey !== null) {
        idempotency.set(idempotencyKey, { operationId: 'updatePart', partId, reply })
      }
      return reply
    },
    getJob: ({ params }) => {
      const job = jobs.get(params.id ?? '')
      return job ? { status: 200, json: structuredClone(job) } : notFound(`Job ${params.id ?? ''}`)
    },
    listJobs: ({ query }) => {
      const page = Number(query.get('page') ?? '1')
      const pageSize = Math.min(100, Number(query.get('pageSize') ?? '20'))
      const partId = query.get('partId')
      const holderId = query.get('holderId')
      const status = query.get('status')
      const matching = jobsNewestFirst().filter(
        (job) =>
          (partId === null || job.partUuid === partId) &&
          (holderId === null || job.holderUuid === holderId) &&
          (status === null || job.status === status),
      )
      return {
        status: 200,
        json: {
          items: matching.slice((page - 1) * pageSize, page * pageSize).map(jobSummary),
          page,
          pageSize,
          total: matching.length,
        },
      }
    },
    streamJobEvents: ({ params, request }) => {
      const job = jobs.get(params.id ?? '')
      if (!job) {
        return notFound(`Job ${params.id ?? ''}`)
      }
      const stream = openJobEventStream(
        job.jobUuid,
        () => {
          streams.delete(stream)
        },
        request.signal,
      )
      streams.add(stream)
      stream.send(structuredClone(job))
      return { status: 200, stream }
    },
    getPart: ({ params, query, storageBase }) => {
      const partId = params.id ?? ''
      if (!parts.has(partId)) {
        return notFound(`Part ${partId}`)
      }
      const report = reportFor(partId, query.get('jobId'))
      return report
        ? { status: 200, json: servedReport(report, storageBase) }
        : notFound(`A result for part ${partId}`)
    },
    getPartThumbnail: ({ params, query }) => {
      const partId = params.id ?? ''
      if (!parts.has(partId)) {
        return notFound(`Part ${partId}`)
      }
      const report = reportFor(partId, query.get('jobId'))
      if (report?.thumbnailUrl == null) {
        return notFound(`A thumbnail for part ${partId}`)
      }
      return { status: 200, bytes: artifactBytes('thumbnail.png'), contentType: 'image/png' }
    },
  }

  const keyFor = (headers: Headers): ApiKeyFixture | undefined => {
    const match = /^Bearer\s+(.+)$/i.exec(headers.get('authorization') ?? '')
    return match?.[1] === undefined ? undefined : keys.get(match[1].trim())
  }

  const callerOf = (headers: Headers): string => {
    if (!headers.has('authorization')) {
      return 'none'
    }
    return keyFor(headers)?.label ?? 'unknown'
  }

  /** The 401/403 a key earns for an operation, or nothing when it may proceed. */
  const authorize = (
    operation: OpenApiOperation,
    method: string,
    headers: Headers,
  ): Reply | undefined => {
    const security = operation.security ?? contract.document.security ?? []
    if (security.length === 0 || operation.operationId === 'validateKey') {
      return undefined
    }
    const fixture = keyFor(headers)
    if (!fixture) {
      return problem(
        401,
        'invalid_api_key',
        headers.has('authorization') ? 'The API key is not recognized' : 'No API key was supplied',
      )
    }
    if (fixture.status !== 'active') {
      return problem(401, 'invalid_api_key', `The API key is ${fixture.status}`)
    }
    const product = operation['x-toolpath-product'] as ProductName | undefined
    if (product === undefined) {
      return undefined
    }
    const access = fixture.access[product]
    if (access === 'none') {
      return problem(403, 'product_mismatch', `This API key has no ${product} access`)
    }
    if (method !== 'GET' && access === 'read') {
      return problem(403, 'read_only_key', `This API key may only read ${product}`)
    }
    return undefined
  }

  /** Request problems against the operation's declared parameters and body. */
  const requestIssues = (
    route: Route,
    params: Record<string, string>,
    query: URLSearchParams,
    headers: Headers,
    body: Uint8Array<ArrayBuffer> | undefined,
  ): { issues: Array<string>; parsed: unknown } => {
    const issues: Array<string> = []
    const declared = route.operation.parameters ?? []
    const check = (parameter: OpenApiParameter, raw: string | null): void => {
      if (raw === null) {
        if (parameter.required === true) {
          issues.push(`${parameter.in} parameter ${parameter.name} is required`)
        }
        return
      }
      for (const error of validator.schema(
        `parameter:${route.operationId}:${parameter.in}:${parameter.name}`,
        parameter.schema ?? {},
        coerce(parameter.schema, raw),
      )) {
        issues.push(`${parameter.in} parameter ${parameter.name}${error.replace(/^\(root\)/, '')}`)
      }
    }
    for (const parameter of declared) {
      if (parameter.in === 'path') {
        check(parameter, params[parameter.name] ?? null)
      } else if (parameter.in === 'query') {
        check(parameter, query.get(parameter.name))
      } else if (parameter.in === 'header') {
        check(parameter, headers.get(parameter.name))
      }
    }
    for (const name of new Set(query.keys())) {
      if (!declared.some((parameter) => parameter.in === 'query' && parameter.name === name)) {
        issues.push(`${name} is not a query parameter of ${route.operationId} in ${contractId}`)
      }
    }
    let parsed: unknown
    const media = route.operation.requestBody?.content?.['application/json']
    if (body && body.length > 0) {
      if (!media) {
        issues.push(`${route.operationId} takes no request body`)
      } else {
        try {
          parsed = JSON.parse(new TextDecoder().decode(body))
        } catch {
          issues.push('the request body is not valid JSON')
          return { issues, parsed }
        }
        for (const error of validator.schema(
          `body:${route.operationId}`,
          media.schema ?? {},
          parsed,
        )) {
          issues.push(`body${error.replace(/^\(root\)/, '')}`)
        }
      }
    } else if (route.operation.requestBody?.required === true) {
      issues.push(`${route.operationId} requires a request body`)
    }
    return { issues, parsed }
  }

  const failureReply = (route: Route, failure: EngineFailure): Reply | 'network' | 'malformed' => {
    if ('network' in failure) {
      return 'network'
    }
    if ('malformedBody' in failure) {
      return 'malformed'
    }
    return {
      status: failure.status,
      problem: createProblemFixture({
        ...failure.problem,
        status: failure.status,
        detail: failure.problem?.detail ?? `The test failed this ${route.operationId}`,
      }),
    }
  }

  /** Turns a reply into an HTTP response after validating it against the contract. */
  const finish = (route: Route, reply: Reply): ScenarioResponse => {
    const label = `${route.operationId} ${reply.status}`
    if ('stream' in reply) {
      const errors = validator.response(
        route.operation,
        reply.status,
        'text/event-stream',
        undefined,
      )
      if (errors.length > 0) {
        violation(`The scenario built an invalid ${label} response: ${errors.join('; ')}`)
      }
      return {
        kind: 'response',
        status: reply.status,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        body: reply.stream.body,
      }
    }
    if ('bytes' in reply) {
      const errors = validator.response(route.operation, reply.status, reply.contentType, undefined)
      if (errors.length > 0) {
        violation(`The scenario built an invalid ${label} response: ${errors.join('; ')}`)
      }
      return {
        kind: 'response',
        status: reply.status,
        headers: { 'content-type': reply.contentType },
        body: reply.bytes,
      }
    }
    const isProblem = 'problem' in reply
    const contentType = isProblem ? 'application/problem+json' : 'application/json'
    const payload = isProblem ? reply.problem : reply.json
    const errors = validator.response(route.operation, reply.status, contentType, payload)
    if (errors.length > 0) {
      violation(
        `The scenario built an invalid ${label} response for ${contractId}: ${errors.join('; ')}`,
      )
    }
    return {
      kind: 'response',
      status: reply.status,
      headers: { 'content-type': contentType },
      body: encoder.encode(JSON.stringify(payload)),
    }
  }

  const record = (
    request: ScenarioRequest,
    target: 'api' | 'storage',
    operationId: string,
    path: string,
  ): void => {
    const headers: Record<string, string> = {}
    request.headers.forEach((value, name) => {
      headers[name] = SECRET_HEADERS.has(name) ? REDACTED : value
    })
    const query: Record<string, string> = {}
    request.url.searchParams.forEach((value, name) => {
      query[name] = SECRET_QUERY.test(name) ? REDACTED : value
    })
    let body: unknown
    if (request.body && request.body.length > 0) {
      if (target === 'api' && /json/.test(request.headers.get('content-type') ?? '')) {
        try {
          body = JSON.parse(new TextDecoder().decode(request.body))
        } catch {
          body = { bytes: request.body.length, json: false }
        }
      } else {
        body = { bytes: request.body.length }
      }
    }
    const idempotencyKey = request.headers.get('idempotency-key')
    records.push(
      Object.freeze({
        sequence,
        target,
        operationId,
        method: request.method,
        origin: request.url.origin,
        path,
        query: Object.freeze(query),
        ...(body === undefined ? {} : { body }),
        headers: Object.freeze(headers),
        caller: callerOf(request.headers),
        ...(idempotencyKey === null ? {} : { idempotencyKey }),
      }),
    )
  }

  const latencyFor = (operationId: string): number => {
    const latency = options.latency ?? 0
    return typeof latency === 'number' ? latency : (latency[operationId] ?? 0)
  }

  const dispatch = async (
    request: ScenarioRequest,
    context: ScenarioDispatchContext,
  ): Promise<ScenarioResponse> => {
    sequence += 1
    const method = request.method.toUpperCase()
    const fullPath = request.url.pathname
    const path = fullPath.startsWith(context.pathPrefix)
      ? fullPath.slice(context.pathPrefix.length) || '/'
      : fullPath
    if (closed) {
      record(request, context.target, 'unmatched', path)
      return violation(
        `${method} ${request.url.origin}${fullPath} arrived after the scenario was closed`,
      )
    }
    if (context.target === 'storage') {
      const operationId: StorageOperation | undefined =
        method === 'PUT' && !path.startsWith('/artifacts/')
          ? 'presignedUpload'
          : method === 'GET' && path.startsWith('/artifacts/')
            ? 'artifactDownload'
            : undefined
      record(request, 'storage', operationId ?? 'unmatched', path)
      if (!operationId) {
        return violation(
          `${method} ${request.url.origin}${fullPath} is not an upload or artifact request the storage host serves`,
        )
      }
      if (latencyFor(operationId) > 0) {
        await sleep(latencyFor(operationId), request.signal)
      }
      if (request.signal?.aborted) {
        throw request.signal.reason as Error
      }
      return handleStorage(request, path, operationId)
    }

    const match = matchRoute(routes, method, path)
    if (!match.route) {
      record(request, 'api', 'unmatched', path)
      return violation(
        match.reason === 'no-method'
          ? `${method} ${path} is not an operation in ${contractId}; that path accepts ${match.allowed.join(', ')}`
          : `No operation in ${contractId} matches ${method} ${path}`,
      )
    }
    const { route, params } = match
    record(request, 'api', route.operationId, path)
    if (latencyFor(route.operationId) > 0) {
      await sleep(latencyFor(route.operationId), request.signal)
    }
    if (request.signal?.aborted) {
      throw request.signal.reason as Error
    }
    const failure = failures.get(route.operationId)?.shift()
    if (failure) {
      const reply = failureReply(route, failure)
      if (reply === 'network') {
        return { kind: 'network-failure', operationId: route.operationId }
      }
      if (reply === 'malformed') {
        const status =
          Object.keys(route.operation.responses ?? {}).find((code) => code.startsWith('2')) ?? '200'
        return {
          kind: 'response',
          status: Number(status),
          headers: { 'content-type': 'application/json' },
          body: encoder.encode('{"truncated":'),
        }
      }
      return finish(route, reply)
    }
    const handler = HANDLERS[route.operationId]
    if (!handler) {
      return violation(
        `${route.operationId} (${route.method} ${route.template}) is in ${contractId}, but the scenario does not simulate it. ` +
          'Serve it with your own handler outside the strict Engine transport, or extend the scenario upstream.',
      )
    }
    const refused = authorize(route.operation, method, request.headers)
    if (refused) {
      return finish(route, refused)
    }
    const query = request.url.searchParams
    const { issues, parsed } = requestIssues(route, params, query, request.headers, request.body)
    if (issues.length > 0) {
      return finish(route, problem(400, 'invalid_request', issues.join('; ')))
    }
    const reply = handler({
      request,
      route,
      params,
      query,
      body: parsed,
      storageBase: context.storageBase,
    })
    return finish(route, reply)
  }

  // ---- controls -----------------------------------------------------------------------------

  const advanceJob = (jobId: string, transition: JobTransition): JobFixture => {
    const job = jobs.get(jobId)
    if (!job) {
      throw new EngineScenarioError(`advanceJob: no job ${jobId} in this scenario`)
    }
    const next = typeof transition === 'string' ? { status: transition } : transition
    const allowed = NEXT_STATUS[job.status]
    if (!allowed.includes(next.status)) {
      throw new EngineScenarioError(
        TERMINAL.includes(job.status)
          ? `advanceJob: job ${jobId} already ${job.status}; a terminal job does not change`
          : `advanceJob: job ${jobId} is ${job.status}; it can move to ${allowed.join(' or ')}, not ${next.status}`,
      )
    }
    const updated: JobFixture = structuredClone(job)
    updated.status = next.status
    updated.updatedAt = iso()
    updated.durationMs = Math.max(0, Date.parse(updated.updatedAt) - Date.parse(updated.createdAt))
    if (next.status === 'running') {
      if ('progress' in next) {
        updated.progress = next.progress
      }
    } else if (next.status === 'succeeded') {
      updated.progress = 100
      if (updated.productType === 'analyze-part' && updated.partUuid !== null) {
        const part = parts.get(updated.partUuid)
        const overrides = 'report' in next ? (next.report ?? {}) : {}
        const report = createReportFixture({
          contract: contractId,
          reportId: nextId('report'),
          partId: updated.partUuid,
          jobId: updated.jobUuid,
          addedDirections: part?.addedDirections ?? [],
          ...(part?.bodyIndex === undefined ? {} : { bodyIndex: part.bodyIndex }),
          ...overrides,
        })
        if (report.partId !== updated.partUuid || report.jobId !== updated.jobUuid) {
          throw new EngineScenarioError(
            'advanceJob: a report override cannot change its partId or jobId',
          )
        }
        const errors = validator.component('PartResponse', report)
        if (errors.length > 0) {
          throw new EngineScenarioError(
            `advanceJob: the report for job ${jobId} does not satisfy ${contractId}: ${errors.join('; ')}`,
          )
        }
        reports.set(report.reportId, report)
        updated.reportId = report.reportId
      }
    } else {
      updated.error = 'error' in next ? next.error : 'analysis_failed: the test failed this job'
      if ('bodies' in next) {
        if (!staging) {
          throw new EngineScenarioError(
            `advanceJob: job bodies are an api-1.32.0 capability; ${contractId} does not define them`,
          )
        }
        updated.bodies = next.bodies
      }
    }
    const errors = validator.component('JobDetail', updated)
    if (errors.length > 0) {
      throw new EngineScenarioError(
        `advanceJob: job ${jobId} would not satisfy ${contractId}: ${errors.join('; ')}`,
      )
    }
    jobs.set(jobId, updated)
    notify(updated)
    return structuredClone(updated)
  }

  const failNext = (operationId: string, failure: EngineFailure): void => {
    if ((STORAGE_OPERATIONS as ReadonlyArray<string>).includes(operationId)) {
      if ('malformedBody' in failure) {
        throw new EngineScenarioError(`failNext: ${operationId} has no JSON body to malform`)
      }
      if ('status' in failure && (failure.status < 400 || failure.status > 599)) {
        throw new EngineScenarioError(`failNext: ${failure.status} is not an error status`)
      }
    } else {
      const route = routes.find((candidate) => candidate.operationId === operationId)
      if (!route) {
        throw new EngineScenarioError(
          `failNext: "${operationId}" is not an operation in ${contractId} (or one of ${STORAGE_OPERATIONS.join(', ')}).`,
        )
      }
      if ('status' in failure) {
        const declared = route.operation.responses?.[String(failure.status)]
        if (!declared || failure.status < 400) {
          throw new EngineScenarioError(
            `failNext: ${operationId} documents no ${failure.status} error in ${contractId}. Documented: ${Object.keys(
              route.operation.responses ?? {},
            )
              .filter((code) => Number(code) >= 400)
              .join(', ')}.`,
          )
        }
        if (!declared.content?.['application/problem+json']) {
          throw new EngineScenarioError(
            `failNext: ${operationId} ${failure.status} is not a problem response in ${contractId}`,
          )
        }
      }
    }
    const queue = failures.get(operationId) ?? []
    queue.push(structuredClone(failure))
    failures.set(operationId, queue)
  }

  const reset = (): void => {
    releaseStreams(undefined, 'end')
    load()
    counters.clear()
    failures.clear()
    idempotency.clear()
    records = []
    violations = []
    sequence = 0
  }

  const close = (): void => {
    releaseStreams(undefined, 'end')
    closed = true
  }

  const scenario: EngineScenario = {
    contract: contractId,
    baseUrl,
    storageOrigin,
    get requests() {
      return [...records]
    },
    get violations() {
      return [...violations]
    },
    get closed() {
      return closed
    },
    advanceJob,
    failNext,
    part: (partId) => {
      const part = parts.get(partId)
      return part ? structuredClone(part) : undefined
    },
    job: (jobId) => {
      const job = jobs.get(jobId)
      return job ? structuredClone(job) : undefined
    },
    report: (reportId) => {
      const report = reports.get(reportId)
      return report ? structuredClone(report) : undefined
    },
    endJobStreams: (jobId) => {
      releaseStreams(jobId, 'end')
    },
    interruptJobStreams: (jobId) => {
      releaseStreams(jobId, 'interrupt')
    },
    reset,
    close,
  }
  internals.set(scenario, { dispatch, violation })
  return scenario
}
