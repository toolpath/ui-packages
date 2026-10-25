import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ConfigError } from '../errors.js'
import { toolchain } from '../policy/toolchain.js'
import { readManifest } from './resolve.js'

export type PackageManagerName = 'npm' | 'pnpm'

export interface PackageManager {
  name: PackageManagerName
  /** The declared `packageManager` version, when the root manifest has one. */
  version?: string
  lockfile: string
}

const LOCKFILES: Record<PackageManagerName, Array<string>> = {
  npm: ['package-lock.json', 'npm-shrinkwrap.json'],
  pnpm: ['pnpm-lock.yaml'],
}

/**
 * The repository's package manager from its `packageManager` field and lockfile.
 * Conflicting metadata is an invalid state: it fails with the exact choice to
 * make rather than guessing or deleting a lockfile.
 */
export const detectPackageManager = (
  root: string,
  explicit?: PackageManagerName,
): PackageManager | undefined => {
  const manifest = readManifest(root)
  const present = (Object.keys(LOCKFILES) as Array<PackageManagerName>).filter((name) =>
    LOCKFILES[name].some((file) => existsSync(join(root, file))),
  )
  const unsupported = ['yarn.lock', 'bun.lockb', 'bun.lock'].filter((file) =>
    existsSync(join(root, file)),
  )
  if (unsupported.length > 0) {
    throw new ConfigError(
      `${unsupported.join(', ')} found. @toolpath/dev-config supports npm and pnpm.`,
    )
  }
  const declaredMatch = /^(npm|pnpm|yarn|bun)@(\S+)$/.exec(manifest?.packageManager ?? '')
  const declared = declaredMatch?.[1]
  if (declared === 'yarn' || declared === 'bun') {
    throw new ConfigError(
      `packageManager is ${manifest?.packageManager ?? ''}. @toolpath/dev-config supports npm and pnpm.`,
    )
  }
  const lockfileFor = (name: PackageManagerName): string =>
    LOCKFILES[name].find((file) => existsSync(join(root, file))) ?? LOCKFILES[name][0] ?? ''

  if (explicit) {
    if (declared && declared !== explicit) {
      throw new ConfigError(
        `--package-manager ${explicit} contradicts packageManager "${manifest?.packageManager ?? ''}" in package.json. Change one of them.`,
      )
    }
    return {
      name: explicit,
      ...(declaredMatch?.[2] ? { version: declaredMatch[2] } : {}),
      lockfile: lockfileFor(explicit),
    }
  }
  if (declared === 'npm' || declared === 'pnpm') {
    const other = present.find((name) => name !== declared)
    if (other) {
      throw new ConfigError(
        `package.json declares ${declared}, but ${lockfileFor(other)} is also present. Remove the lockfile that does not belong, ` +
          'or pass --package-manager npm|pnpm to state which one owns this repository.',
      )
    }
    return {
      name: declared,
      ...(declaredMatch?.[2] ? { version: declaredMatch[2] } : {}),
      lockfile: lockfileFor(declared),
    }
  }
  if (present.length > 1) {
    throw new ConfigError(
      'Both package-lock.json and pnpm-lock.yaml are present and package.json declares no packageManager. ' +
        'Pass --package-manager npm|pnpm to state which one owns this repository; no lockfile is deleted.',
    )
  }
  const [only] = present
  return only ? { name: only, lockfile: lockfileFor(only) } : undefined
}

/** The exact `packageManager` value a new consumer gets. */
export const testedPackageManager = (name: PackageManagerName): string =>
  name === 'pnpm' ? `pnpm@${toolchain.runtime.pnpm}` : `npm@${toolchain.runtime.npm}`

export interface InstalledPackage {
  name: string
  version: string
  /** The package's real directory. */
  directory: string
  manifest: Record<string, unknown>
}

/**
 * The package `name` as Node would resolve it from `directory`: the nearest
 * `node_modules/<name>` upward. Reads the manifest directly, so packages whose
 * `exports` hide `package.json` are still found.
 */
export const findInstalledPackage = (
  directory: string,
  name: string,
): InstalledPackage | undefined => {
  let current = directory
  for (;;) {
    const candidate = join(current, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) {
      const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as Record<string, unknown>
      return {
        name,
        version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
        directory: realpathSync(dirname(candidate)),
        manifest,
      }
    }
    const parent = dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }
}

/** The absolute path of a package's named binary (or its only one). */
export const packageBin = (installed: InstalledPackage, bin?: string): string => {
  const field = installed.manifest.bin
  const relativePath =
    typeof field === 'string'
      ? field
      : typeof field === 'object' && field !== null
        ? (field as Record<string, string>)[bin ?? installed.name]
        : undefined
  if (!relativePath) {
    throw new ConfigError(
      `${installed.name}@${installed.version} has no "${bin ?? installed.name}" executable.`,
    )
  }
  return join(installed.directory, relativePath)
}
