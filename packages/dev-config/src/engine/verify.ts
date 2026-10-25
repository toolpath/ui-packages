import {
  ENGINE_CONTRACT_IDS,
  contractForSdkVersion,
  contractPin,
  sha256,
  type EngineContractId,
} from './contracts.js'

/** The public metadata an `@toolpath/api` artifact records about the contract it was generated from. */
export interface SdkContractMetadata {
  version: string
  openApiSha256?: string
  openApiVersion?: string
}

export interface ContractVerification {
  target: { url: string; apiVersion: string; sha256: string }
  snapshot: { id: EngineContractId; apiVersion: string; sha256: string }
  sdk?: SdkContractMetadata & { contract: EngineContractId | undefined }
  /** Every disagreement between the target, the snapshot, and the SDK. Empty when they agree. */
  mismatches: Array<string>
}

export interface VerifyContractOptions {
  /** The Engine API origin (or base URL) whose `/v1/openapi.json` is read. */
  targetUrl: string
  contract: EngineContractId
  sdk?: SdkContractMetadata
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

export class ContractFetchError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'ContractFetchError'
  }
}

/**
 * Reads a target's public contract (no credentials are sent) and compares it
 * with a pinned snapshot and an installed SDK's recorded contract. It reports;
 * it never switches environments, changes pins, or regenerates anything.
 */
export const verifyEngineContract = async ({
  targetUrl,
  contract,
  sdk,
  fetch = globalThis.fetch,
  timeoutMs = 15_000,
}: VerifyContractOptions): Promise<ContractVerification> => {
  const url = new URL('/v1/openapi.json', targetUrl).href
  let bytes: Uint8Array
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      throw new ContractFetchError(`${url} answered HTTP ${response.status}`)
    }
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    if (error instanceof ContractFetchError) {
      throw error
    }
    throw new ContractFetchError(`Could not read ${url}: ${(error as Error).message}`, {
      cause: error,
    })
  }
  let parsed: { info?: { version?: unknown } }
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as { info?: { version?: unknown } }
  } catch {
    throw new ContractFetchError(`${url} did not return a JSON OpenAPI document`)
  }
  const apiVersion = typeof parsed.info?.version === 'string' ? parsed.info.version : 'unknown'
  const pin = contractPin(contract)
  const served = { url, apiVersion, sha256: sha256(bytes) }
  const snapshot = { id: contract, apiVersion: pin.apiVersion, sha256: pin.sha256 }
  const mismatches: Array<string> = []
  if (served.sha256 !== snapshot.sha256) {
    const known = ENGINE_CONTRACT_IDS.find((id) => contractPin(id).sha256 === served.sha256)
    mismatches.push(
      `The target serves API ${served.apiVersion} (${served.sha256.slice(0, 12)}…), not the ${contract} snapshot (${pin.apiVersion}, ${pin.sha256.slice(0, 12)}…).` +
        (known
          ? ` It matches the pinned ${known} snapshot instead.`
          : ' It matches no contract this release pins.'),
    )
  }
  let sdkResult: ContractVerification['sdk']
  if (sdk) {
    sdkResult = { ...sdk, contract: contractForSdkVersion(sdk.version) }
    if (sdk.openApiSha256 !== undefined && sdk.openApiSha256 !== snapshot.sha256) {
      mismatches.push(
        `@toolpath/api ${sdk.version} was generated from API ${sdk.openApiVersion ?? 'unknown'} (${sdk.openApiSha256.slice(0, 12)}…), not the ${contract} snapshot.`,
      )
    }
    if (sdk.openApiSha256 !== undefined && sdk.openApiSha256 !== served.sha256) {
      mismatches.push(
        `@toolpath/api ${sdk.version} was not generated from the contract the target serves.`,
      )
    }
    if (sdkResult.contract === undefined) {
      mismatches.push(`@toolpath/api ${sdk.version} is not an SDK line this release supports.`)
    }
  }
  return { target: served, snapshot, ...(sdkResult ? { sdk: sdkResult } : {}), mismatches }
}
