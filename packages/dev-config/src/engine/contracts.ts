import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { toolchain, type EngineContractPin } from '../policy/toolchain.js'

/**
 * The immutable public Engine contracts this release tests against. The bytes
 * live in `contracts/engine/<id>/openapi.json`; their SHA-256 and the SDK
 * artifact built from each are pinned in the toolchain manifest.
 */
export type EngineContractId = 'api-1.29.1' | 'api-1.32.0'

export const ENGINE_CONTRACT_IDS: ReadonlyArray<EngineContractId> = ['api-1.29.1', 'api-1.32.0']

export const DEFAULT_ENGINE_CONTRACT: EngineContractId = 'api-1.29.1'

export const isEngineContractId = (value: unknown): value is EngineContractId =>
  typeof value === 'string' && (ENGINE_CONTRACT_IDS as ReadonlyArray<string>).includes(value)

export const contractPin = (id: EngineContractId): EngineContractPin => {
  const pin = toolchain.engine.contracts[id]
  if (!pin) {
    throw new Error(`The toolchain manifest has no pin for ${id}.`)
  }
  return pin
}

/** Where a contract snapshot is installed, relative to this module in `src/` and `dist/` alike. */
export const contractFile = (id: EngineContractId): URL =>
  new URL(`../../contracts/engine/${id}/openapi.json`, import.meta.url)

export const contractProvenanceFile = (id: EngineContractId): URL =>
  new URL(`../../contracts/engine/${id}/provenance.json`, import.meta.url)

export const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex')

export interface LoadedContract {
  id: EngineContractId
  pin: EngineContractPin
  /** The parsed OpenAPI document. */
  document: OpenApiDocument
}

export interface OpenApiOperation {
  operationId?: string
  parameters?: Array<OpenApiParameter>
  requestBody?: { required?: boolean; content?: Record<string, { schema?: unknown }> }
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>
  security?: Array<Record<string, Array<string>>>
  'x-toolpath-product'?: string
  'x-toolpath-experimental'?: boolean
}

export interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required?: boolean
  schema?: unknown
}

export interface OpenApiDocument {
  openapi: string
  info: { version: string }
  security?: Array<Record<string, Array<string>>>
  paths: Record<string, Record<string, OpenApiOperation | undefined>>
  components: { schemas: Record<string, unknown> }
}

const loaded = new Map<EngineContractId, LoadedContract>()

/**
 * Reads a pinned contract snapshot and verifies its bytes against the recorded
 * SHA-256. A snapshot that does not match is not a supported contract.
 */
export const loadContract = (id: EngineContractId): LoadedContract => {
  const cached = loaded.get(id)
  if (cached) {
    return cached
  }
  const pin = contractPin(id)
  const bytes = readFileSync(contractFile(id))
  const digest = sha256(bytes)
  if (digest !== pin.sha256) {
    throw new Error(
      `The ${id} contract snapshot has SHA-256 ${digest}, but this release pins ${pin.sha256}. ` +
        'The installed package is damaged or was modified; reinstall @toolpath/dev-config.',
    )
  }
  const document = JSON.parse(bytes.toString('utf8')) as OpenApiDocument
  if (document.info.version !== pin.apiVersion) {
    throw new Error(
      `The ${id} snapshot declares API ${document.info.version}, not ${pin.apiVersion}.`,
    )
  }
  const contract = { id, pin, document }
  loaded.set(id, contract)
  return contract
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: Array<string>
}

const parseVersion = (version: string): ParsedVersion | undefined => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    version.trim(),
  )
  if (!match) {
    return undefined
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  }
}

const compareIdentifiers = (a: string, b: string): number => {
  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)
  if (aNumeric && bNumeric) {
    return Number(a) - Number(b)
  }
  if (aNumeric) {
    return -1
  }
  if (bNumeric) {
    return 1
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/** Semantic-version precedence: a prerelease sorts before its release. */
export const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) {
    throw new Error(`Not a semantic version: ${left ? b : a}`)
  }
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) {
      return left[key] - right[key]
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length
  }
  for (
    let index = 0;
    index < Math.max(left.prerelease.length, right.prerelease.length);
    index += 1
  ) {
    const x = left.prerelease[index]
    const y = right.prerelease[index]
    if (x === undefined) {
      return -1
    }
    if (y === undefined) {
      return 1
    }
    const order = compareIdentifiers(x, y)
    if (order !== 0) {
      return order
    }
  }
  return 0
}

/**
 * Whether `version` satisfies a range of space-separated `>=`/`<`/`>`/`<=`/`=`
 * comparators, with npm's prerelease rule: a prerelease version only matches
 * when one of the comparators names a prerelease of the same `major.minor.patch`.
 */
export const satisfiesRange = (version: string, range: string): boolean => {
  const parsed = parseVersion(version)
  if (!parsed) {
    return false
  }
  const comparators = range.trim().split(/\s+/)
  let prereleaseAllowed = parsed.prerelease.length === 0
  for (const comparator of comparators) {
    const match = /^(>=|<=|>|<|=)?(.+)$/.exec(comparator)
    const operator = match?.[1] ?? '='
    const bound = match?.[2]
    const boundVersion = bound === undefined ? undefined : parseVersion(bound)
    if (!bound || !boundVersion) {
      return false
    }
    if (
      boundVersion.prerelease.length > 0 &&
      boundVersion.major === parsed.major &&
      boundVersion.minor === parsed.minor &&
      boundVersion.patch === parsed.patch
    ) {
      prereleaseAllowed = true
    }
    const order = compareVersions(version, bound)
    const ok =
      operator === '>='
        ? order >= 0
        : operator === '<='
          ? order <= 0
          : operator === '>'
            ? order > 0
            : operator === '<'
              ? order < 0
              : order === 0
    if (!ok) {
      return false
    }
  }
  return prereleaseAllowed
}

/**
 * The contract an `@toolpath/api` version targets: its exact tested artifact,
 * or a version on the same supported line. Undefined for an unsupported SDK.
 */
export const contractForSdkVersion = (version: string): EngineContractId | undefined => {
  for (const id of ENGINE_CONTRACT_IDS) {
    if (contractPin(id).sdk === version) {
      return id
    }
  }
  return ENGINE_CONTRACT_IDS.find((id) => satisfiesRange(version, contractPin(id).sdkRange))
}

/** Whether `version` is exactly one of the SDK artifacts this release tested. */
export const isTestedSdkVersion = (version: string): boolean =>
  ENGINE_CONTRACT_IDS.some((id) => contractPin(id).sdk === version)
