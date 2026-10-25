import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// A path, not a `URL` object: browser-like test environments (jsdom) replace the
// global `URL`, and Node's fs rejects their instances.
export const toolchain: Toolchain = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'toolchain.json'), 'utf8'),
) as Toolchain

/** The exact version (or tested versions) of a managed package, if the release manages it. */
const managedVersions = (name: string): Array<string> => {
  if (name === 'eslint') {
    return [toolchain.core.eslint]
  }
  if (name === 'typescript') {
    return [...toolchain.core.typescript]
  }
  const bundled = toolchain.bundled[name]
  if (bundled !== undefined) {
    return [bundled]
  }
  const found = new Set<string>()
  for (const profile of Object.values(toolchain.profiles)) {
    const version = profile[name]
    if (version !== undefined) {
      for (const entry of [version].flat()) {
        found.add(entry)
      }
    }
  }
  return [...found]
}

/** The first tested version of a managed package; what `init` installs. */
export const preferredVersion = (name: string): string | undefined => {
  if (name === 'typescript') {
    return toolchain.core.defaultTypescript
  }
  return managedVersions(name)[0]
}
