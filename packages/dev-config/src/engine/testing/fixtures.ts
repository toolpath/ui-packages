import { DEFAULT_ENGINE_CONTRACT } from '../contracts.js'
import { EngineScenarioError } from './errors.js'
import { DEFAULT_SCENARIO_INSTANT, DEFAULT_SCENARIO_SEED, deterministicUuid } from './ids.js'
import type {
  ApiKeyFixture,
  ApiKeyFixtureOverrides,
  JobFixture,
  JobFixtureOverrides,
  PartFixture,
  PartFixtureOverrides,
  ProblemFixture,
  ProblemFixtureOverrides,
  ReportFixture,
  ReportFixtureOverrides,
} from './wire.js'

/** The SDK's default server. A scenario serves it unless a test names another base URL. */
export const DEFAULT_ENGINE_BASE_URL = 'https://api.toolpath.com'

/** A synthetic host for presigned uploads and artifacts; `.test` never resolves on a real network. */
export const DEFAULT_STORAGE_ORIGIN = 'https://storage.engine.test'

/** A placeholder key with write access to every product. Never a real credential. */
export const TEST_API_KEY = 'tp_test_0000000000000000000000000000'

export const TEST_UPLOAD_BUCKET = 'toolpath-test-uploads'

const PROBLEM_DEFAULTS: Readonly<Record<number, { code: string; title: string }>> = {
  400: { code: 'invalid_request', title: 'Invalid request' },
  401: { code: 'invalid_api_key', title: 'Invalid API key' },
  402: { code: 'quota_exceeded', title: 'Usage quota exceeded' },
  403: { code: 'product_mismatch', title: 'Forbidden' },
  404: { code: 'not_found', title: 'Not found' },
  409: { code: 'conflict', title: 'Conflict' },
  410: { code: 'gone', title: 'No longer available' },
  429: { code: 'rate_limited', title: 'Too many requests' },
  500: { code: 'internal_error', title: 'Internal server error' },
  503: { code: 'service_unavailable', title: 'Service unavailable' },
}

/** The problem type URI for a code, following the contract's documented `…/problems/invalid-api-key` form. */
export const problemType = (code: string): string =>
  `https://api.toolpath.com/problems/${code.replaceAll('_', '-')}`

/**
 * A problem body. `invalid_api_key`, `product_mismatch` and `read_only_key` are
 * the codes the contracts name; the other defaults are placeholders a test can
 * override with the code its application handles.
 */
export const createProblemFixture = (overrides: ProblemFixtureOverrides = {}): ProblemFixture => {
  const status = overrides.status ?? 400
  const defaults = PROBLEM_DEFAULTS[status] ?? { code: 'error', title: 'Error' }
  const code = overrides.code ?? defaults.code
  return {
    type: overrides.type ?? problemType(code),
    title: overrides.title ?? defaults.title,
    status,
    code,
    ...(overrides.detail === undefined ? {} : { detail: overrides.detail }),
    ...(overrides.instance === undefined ? {} : { instance: overrides.instance }),
  }
}

export const createApiKeyFixture = (overrides: ApiKeyFixtureOverrides = {}): ApiKeyFixture => ({
  key: overrides.key ?? TEST_API_KEY,
  label: overrides.label ?? 'test-key',
  status: overrides.status ?? 'active',
  access: overrides.access ?? { core: 'write', dfm: 'write', quoting: 'write' },
})

/** A part a scenario starts with. Default identifiers come from `index` (default 0). */
export const createPartFixture = ({
  index = 0,
  ...overrides
}: PartFixtureOverrides = {}): PartFixture => {
  const partId = overrides.partId ?? deterministicUuid(DEFAULT_SCENARIO_SEED, 'fixture-part', index)
  const filename = overrides.filename ?? 'part.step'
  return {
    partId,
    filename,
    sourceBucket: overrides.sourceBucket ?? TEST_UPLOAD_BUCKET,
    sourceS3Key: overrides.sourceS3Key ?? `uploads/${partId}/${filename}`,
    uploaded: overrides.uploaded ?? false,
    addedDirections: overrides.addedDirections ?? [],
  }
}

/**
 * A part result. A non-null artifact URL marks that artifact as present; a
 * scenario serves its own freshly signed URL in its place.
 */
export const createReportFixture = ({
  index = 0,
  contract = DEFAULT_ENGINE_CONTRACT,
  ...overrides
}: ReportFixtureOverrides = {}): ReportFixture => {
  if (
    contract !== 'api-1.32.0' &&
    (overrides.fileId !== undefined || overrides.bodyIndex !== undefined)
  ) {
    throw new EngineScenarioError(
      `fileId and bodyIndex are api-1.32.0 fields; ${contract} does not define them`,
    )
  }
  const reportId =
    overrides.reportId ?? deterministicUuid(DEFAULT_SCENARIO_SEED, 'fixture-report', index)
  const placeholder = (name: string): string =>
    `${DEFAULT_STORAGE_ORIGIN}/fixture/${reportId}/${name}`
  return {
    partId: overrides.partId ?? createPartFixture({ index }).partId,
    reportId,
    jobId: overrides.jobId ?? deterministicUuid(DEFAULT_SCENARIO_SEED, 'fixture-job', index),
    kernelVersion: overrides.kernelVersion ?? 'test-kernel',
    units: overrides.units ?? { length: 'mm', angle: 'deg' },
    regions: overrides.regions ?? [],
    features: overrides.features ?? [],
    candidateDirections: overrides.candidateDirections ?? [{ x: 0, y: 0, z: 1 }],
    discoveredDirections: overrides.discoveredDirections ?? [
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 },
    ],
    addedDirections: overrides.addedDirections ?? [],
    directionZBounds: overrides.directionZBounds ?? null,
    turnability: overrides.turnability ?? null,
    turning: overrides.turning ?? null,
    meshPointCount: overrides.meshPointCount ?? 0,
    meshTriangleCount: overrides.meshTriangleCount ?? 0,
    thumbnailUrl:
      overrides.thumbnailUrl === undefined ? placeholder('thumbnail.png') : overrides.thumbnailUrl,
    meshStlUrl: overrides.meshStlUrl === undefined ? placeholder('mesh.stl') : overrides.meshStlUrl,
    meshGlbUrl: overrides.meshGlbUrl === undefined ? placeholder('mesh.glb') : overrides.meshGlbUrl,
    ...(overrides.fileId === undefined ? {} : { fileId: overrides.fileId }),
    ...(overrides.bodyIndex === undefined ? {} : { bodyIndex: overrides.bodyIndex }),
  }
}

/**
 * A job. Defaults describe a queued analysis of the default part; a succeeded
 * job defaults to the matching report, a failed one to a synthetic error.
 */
export const createJobFixture = ({
  index = 0,
  contract = DEFAULT_ENGINE_CONTRACT,
  ...overrides
}: JobFixtureOverrides = {}): JobFixture => {
  const status = overrides.status ?? 'queued'
  const createdAt = overrides.createdAt ?? DEFAULT_SCENARIO_INSTANT
  const updatedAt = overrides.updatedAt ?? createdAt
  const job: JobFixture = {
    partUuid:
      overrides.partUuid === undefined ? createPartFixture({ index }).partId : overrides.partUuid,
    holderUuid: overrides.holderUuid ?? null,
    jobUuid: overrides.jobUuid ?? deterministicUuid(DEFAULT_SCENARIO_SEED, 'fixture-job', index),
    productType: overrides.productType ?? 'analyze-part',
    status,
    progress:
      overrides.progress === undefined ? (status === 'succeeded' ? 100 : null) : overrides.progress,
    error:
      overrides.error === undefined
        ? status === 'failed'
          ? 'synthetic_failure: the test failed this job'
          : null
        : overrides.error,
    reportId:
      overrides.reportId === undefined
        ? status === 'succeeded'
          ? deterministicUuid(DEFAULT_SCENARIO_SEED, 'fixture-report', index)
          : null
        : overrides.reportId,
    importId: overrides.importId ?? null,
    createdAt,
    updatedAt,
    durationMs: overrides.durationMs ?? Math.max(0, Date.parse(updatedAt) - Date.parse(createdAt)),
  }
  if (contract === 'api-1.32.0') {
    job.fileUuid = overrides.fileUuid ?? null
    if (overrides.bodies !== undefined) {
      job.bodies = overrides.bodies
    }
  } else if (overrides.fileUuid !== undefined || overrides.bodies !== undefined) {
    throw new EngineScenarioError(
      `fileUuid and bodies are api-1.32.0 fields; ${contract} does not define them`,
    )
  }
  return job
}
