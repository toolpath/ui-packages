import type {
  CreatePartResponse,
  JobDetail,
  JobSummary,
  KeyValidationResponse,
  PartResponse,
  ProblemDetails,
} from '@toolpath/api'
import type { EngineContractId } from '../contracts.js'

/**
 * A public SDK model as it travels on the wire. The SDK deserializes timestamps
 * into `Date`; on the wire, and so in every fixture and scenario payload, they
 * are ISO 8601 strings.
 */
export type Wire<T> = T extends Date
  ? string
  : T extends ReadonlyArray<infer Item>
    ? Array<Wire<Item>>
    : T extends object
      ? { [Key in keyof T]: Wire<T[Key]> }
      : T

export type Direction = Wire<PartResponse>['candidateDirections'][number]

/**
 * A solid body of an uploaded file, which `api-1.32.0` lists on a job that
 * failed because the file holds several (`multiple_bodies:`) or the chosen
 * `bodyIndex` is past the last (`body_not_found:`).
 */
export interface FileBodyFixture {
  index: number
  name?: string
  faceCount: number
  boundingBox: { lower: Direction; upper: Direction }
}

/**
 * A job as `GET /v1/jobs/{id}` returns it: the SDK's public `JobDetail` model
 * in wire form. `api-1.32.0` also requires `fileUuid` (null for part jobs) and
 * may list `bodies`; the builders and scenarios add them only for that contract.
 */
export type JobFixture = Wire<JobDetail> & {
  fileUuid?: string | null
  bodies?: Array<FileBodyFixture>
}

/** A job list entry: the SDK's `JobSummary` in wire form. */
export type JobSummaryFixture = Wire<JobSummary> & { fileUuid?: string | null }

/**
 * A report: the Engine calls an immutable part result `PartResponse` (identified
 * by `reportId`), so a report fixture is that public model in wire form.
 * `api-1.32.0` adds the optional `fileId` and `bodyIndex`.
 */
export type ReportFixture = Wire<PartResponse> & { fileId?: string; bodyIndex?: number }

/** A problem response body: the SDK's public `ProblemDetails`. */
export type ProblemFixture = Wire<ProblemDetails>

export type JobStatus = JobFixture['status']

/**
 * A part as a scenario holds it: the identity and storage location
 * `POST /v1/parts` returns (the SDK's `CreatePartResponse`, without the
 * short-lived upload URL, which the scenario signs per request), plus whether
 * its CAD source has been uploaded.
 */
export type PartFixture = Omit<Wire<CreatePartResponse>, 'uploadUrl'> & {
  filename: string
  uploaded: boolean
  /** Directions added to the part by earlier analyses; part results report them. */
  addedDirections: Array<Direction>
  /** `api-1.32.0`: the body of a multi-body file this part is, when it was uploaded with one. */
  bodyIndex?: number
}

export type ProductAccess = 'write' | 'read' | 'none'

/** A test API key and its per-product grants. The key text is a placeholder, never a real credential. */
export interface ApiKeyFixture {
  key: string
  /** How request records name the caller; the key itself is never recorded. */
  label: string
  status: Exclude<Wire<KeyValidationResponse>['status'], 'invalid'>
  access: { core: ProductAccess; dfm: ProductAccess; quoting: ProductAccess }
}

interface FixtureContext {
  /** The contract the payload must satisfy. Default `api-1.29.1`. */
  contract?: EngineContractId
  /** Distinguishes default identifiers when several fixtures of one kind are needed. Default 0. */
  index?: number
}

export type PartFixtureOverrides = Partial<PartFixture> & Pick<FixtureContext, 'index'>
export type JobFixtureOverrides = Partial<JobFixture> & FixtureContext
export type ReportFixtureOverrides = Partial<ReportFixture> & FixtureContext
export type ProblemFixtureOverrides = Partial<ProblemFixture> & { status?: number }
export type ApiKeyFixtureOverrides = Partial<ApiKeyFixture>
