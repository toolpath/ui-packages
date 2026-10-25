import { readFileSync } from 'node:fs'

/**
 * The one committed source of every exact tool version this release manages.
 * The source-only CI action bootstraps read the same JSON file directly.
 */
export interface EngineContractPin {
  channel: 'stable' | 'staging'
  apiVersion: string
  sha256: string
  sdk: string
  sdkRange: string
}

export interface Toolchain {
  schemaVersion: 1
  policyVersion: number
  runtime: { node: string; nodeRange: string; pnpm: string; npm: string }
  ci: {
    runner: string
    timeouts: { quality: number; browser: number; integration: number }
    artifactRetentionDays: number
  }
  core: { eslint: string; typescript: Array<string>; defaultTypescript: string }
  bundled: Record<string, string>
  profiles: Record<string, Record<string, string | Array<string>>>
  react: { compilerRuntime: string; minimumVersions: Array<string>; defaultMinimumVersion: string }
  tested: Record<string, string>
  engine: {
    contracts: Record<string, EngineContractPin>
    defaultContract: string
    origins: { production: string; staging: string }
  }
}

export const toolchain: Toolchain = JSON.parse(
  readFileSync(new URL('./toolchain.json', import.meta.url), 'utf8'),
) as Toolchain
