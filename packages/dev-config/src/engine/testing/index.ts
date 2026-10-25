/**
 * Deterministic Engine API test fixtures and scenarios for the real public
 * `@toolpath/api` SDK. Ordinary tests use `createEngineFetch`; the Node HTTP
 * server and MSW handlers (`/engine/testing/node`, `/engine/testing/msw`) serve
 * the same scenario. Nothing here is an API client: the SDK owns requests,
 * authentication, uploads and event-stream handling.
 */
export {
  DEFAULT_ENGINE_CONTRACT,
  ENGINE_CONTRACT_IDS,
  contractForSdkVersion,
  isTestedSdkVersion,
  type EngineContractId,
} from '../contracts.js'
export { EngineScenarioError } from './errors.js'
export { createEngineFetch } from './fetch.js'
export {
  DEFAULT_ENGINE_BASE_URL,
  DEFAULT_STORAGE_ORIGIN,
  TEST_API_KEY,
  TEST_UPLOAD_BUCKET,
  createApiKeyFixture,
  createJobFixture,
  createPartFixture,
  createProblemFixture,
  createReportFixture,
  problemType,
} from './fixtures.js'
export { DEFAULT_SCENARIO_INSTANT, DEFAULT_SCENARIO_SEED } from './ids.js'
export {
  PRESIGNED_URL_LIFETIME_SECONDS,
  STORAGE_OPERATIONS,
  createEngineScenario,
  type EngineFailure,
  type EngineRequestRecord,
  type EngineScenario,
  type EngineScenarioOptions,
  type EngineScenarioState,
  type JobTransition,
  type StorageOperation,
} from './scenario.js'
export { formatJobEvent } from './sse.js'
export type {
  ApiKeyFixture,
  ApiKeyFixtureOverrides,
  Direction,
  FileBodyFixture,
  JobFixture,
  JobFixtureOverrides,
  JobStatus,
  JobSummaryFixture,
  PartFixture,
  PartFixtureOverrides,
  ProblemFixture,
  ProblemFixtureOverrides,
  ProductAccess,
  ReportFixture,
  ReportFixtureOverrides,
  Wire,
} from './wire.js'
