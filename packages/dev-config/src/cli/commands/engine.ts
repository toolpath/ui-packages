import { dirname } from 'node:path'
import { findConfigFile, loadConfig } from '../../config/load.js'
import { findInstalledPackage } from '../../config/packages.js'
import { CheckFailure, ConfigError, PrerequisiteError, UsageError } from '../../errors.js'
import {
  ENGINE_CONTRACT_IDS,
  contractForSdkVersion,
  isEngineContractId,
  type EngineContractId,
} from '../../engine/contracts.js'
import {
  ContractFetchError,
  verifyEngineContract,
  type SdkContractMetadata,
} from '../../engine/verify.js'
import { toolchain } from '../../policy/toolchain.js'
import type { Output } from '../output.js'

export interface VerifyContractFlags {
  config?: string
  target?: string
  contract?: string
}

/** `production`, `staging`, or an explicit URL: https, or http only for a loopback test server. */
export const resolveTarget = (target: string | undefined): string => {
  if (target === undefined || target === 'production') {
    return toolchain.engine.origins.production
  }
  if (target === 'staging') {
    return toolchain.engine.origins.staging
  }
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new UsageError(`--target ${target}: use production, staging, or an https URL.`)
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new UsageError(`--target ${target}: an Engine target is reached over https.`)
  }
  return url.origin
}

const sdkMetadata = (directory: string): SdkContractMetadata | undefined => {
  const installed = findInstalledPackage(directory, '@toolpath/api')
  if (!installed) {
    return undefined
  }
  const recorded = installed.manifest.toolpath
  const fields =
    typeof recorded === 'object' && recorded !== null ? (recorded as Record<string, unknown>) : {}
  return {
    version: installed.version,
    ...(typeof fields.openApiSha256 === 'string' ? { openApiSha256: fields.openApiSha256 } : {}),
    ...(typeof fields.openApiVersion === 'string' ? { openApiVersion: fields.openApiVersion } : {}),
  }
}

/**
 * `engine verify-contract`: an explicit, network-enabled comparison of a
 * target's public contract, the installed SDK's recorded contract, and the
 * selected snapshot. Read-only; never part of `check` or `ci`.
 */
export const verifyContract = async (flags: VerifyContractFlags, output: Output): Promise<void> => {
  let directory = process.cwd()
  let configured: string | undefined
  try {
    const config = await loadConfig(findConfigFile(process.cwd(), flags.config))
    directory = dirname(config.file)
    configured = config.engine?.contract
  } catch (error) {
    if (
      flags.config !== undefined ||
      !(error instanceof ConfigError) ||
      !/No dev\.config\.mjs found/.test(error.message)
    ) {
      throw error
    }
  }
  const sdk = sdkMetadata(directory)
  const chosen =
    flags.contract ?? configured ?? (sdk ? contractForSdkVersion(sdk.version) : undefined)
  if (chosen === undefined) {
    throw new UsageError(
      `Choose the snapshot to compare with --contract (${ENGINE_CONTRACT_IDS.join(' or ')}), set engine.contract in dev.config.mjs, or install @toolpath/api.`,
    )
  }
  if (!isEngineContractId(chosen)) {
    throw new UsageError(
      `--contract ${chosen}: supported contracts are ${ENGINE_CONTRACT_IDS.join(', ')}.`,
    )
  }
  const contract: EngineContractId = chosen
  const targetUrl = resolveTarget(flags.target)
  let result
  try {
    result = await verifyEngineContract({ targetUrl, contract, ...(sdk ? { sdk } : {}) })
  } catch (error) {
    if (error instanceof ContractFetchError) {
      throw new PrerequisiteError(`engine verify-contract: ${error.message}`)
    }
    throw error
  }
  output.record('verifyContract', result)
  output.line(
    `target    ${result.target.url}: API ${result.target.apiVersion}, sha256 ${result.target.sha256}`,
  )
  output.line(
    `snapshot  ${result.snapshot.id}: API ${result.snapshot.apiVersion}, sha256 ${result.snapshot.sha256}`,
  )
  output.line(
    result.sdk
      ? `sdk       @toolpath/api ${result.sdk.version}: API ${result.sdk.openApiVersion ?? 'unrecorded'}, sha256 ${result.sdk.openApiSha256 ?? 'unrecorded'}`
      : 'sdk       @toolpath/api is not installed here; only the target and snapshot were compared',
  )
  if (result.mismatches.length > 0) {
    for (const mismatch of result.mismatches) {
      output.failure(`  - ${mismatch}`)
    }
    throw new CheckFailure(
      'engine verify-contract: the target, snapshot and SDK disagree. Nothing was changed; choose the matching SDK release and contract deliberately.',
    )
  }
  output.line('engine verify-contract: the target, snapshot and SDK agree')
}
