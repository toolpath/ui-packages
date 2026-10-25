import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findInstalledPackage, type InstalledPackage } from '../config/packages.js'
import { ConfigError, MissingPeerError } from '../errors.js'
import { preferredVersion } from '../policy/toolchain.js'

/**
 * Optional build tools are loaded from the consumer project that declares them,
 * so the adapter runs the exact copy the project's own build uses. A missing
 * package fails with the profile and the install command; there is no weaker
 * fallback.
 */

const versionsFor = (names: ReadonlyArray<string>): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, preferredVersion(name) ?? '']))

const packageName = (specifier: string): string =>
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : (specifier.split('/')[0] ?? specifier)

/** The absolute entry `specifier` resolves to from `directory`, or a MissingPeerError. */
export const resolvePeer = (directory: string, specifier: string, profile: string): string => {
  const require = createRequire(join(directory, 'package.json'))
  try {
    return require.resolve(specifier)
  } catch {
    const name = packageName(specifier)
    throw new MissingPeerError(profile, [name], versionsFor([name]))
  }
}

/** The `import` entry a package's `exports` declares for its root, when it declares one. */
const importEntry = (exports: unknown): string | undefined => {
  const root =
    typeof exports === 'object' && exports !== null && '.' in exports
      ? (exports as Record<string, unknown>)['.']
      : exports
  if (typeof root === 'string') {
    return root
  }
  if (typeof root !== 'object' || root === null) {
    return undefined
  }
  const conditions = root as Record<string, unknown>
  const target = conditions.import ?? conditions.default
  if (typeof target === 'string') {
    return target
  }
  if (
    typeof target === 'object' &&
    target !== null &&
    typeof (target as { default?: unknown }).default === 'string'
  ) {
    return (target as { default: string }).default
  }
  return undefined
}

/**
 * Imports an optional peer as the project resolves it. For a package root the
 * package's own ESM entry is used, as an ESM consumer would load it, so a dual
 * package is not entered through its CommonJS build.
 */
export const importPeer = async <T>(
  directory: string,
  specifier: string,
  profile: string,
): Promise<T> => {
  let resolved = resolvePeer(directory, specifier, profile)
  if (specifier === packageName(specifier)) {
    const installed = findInstalledPackage(directory, specifier)
    const entry = installed ? importEntry(installed.manifest.exports) : undefined
    if (installed && entry) {
      resolved = join(installed.directory, entry)
    }
  }
  return (await import(pathToFileURL(resolved).href)) as T
}

/** The installed copy of a package, failing with the profile's install command when absent. */
export const requireInstalled = (
  directory: string,
  name: string,
  profile: string,
): InstalledPackage => {
  const installed = findInstalledPackage(directory, name)
  if (!installed) {
    throw new MissingPeerError(profile, [name], versionsFor([name]))
  }
  return installed
}

/** Fails when the installed major version is not the one an adapter is written for. */
export const assertMajor = (
  installed: InstalledPackage,
  major: number,
  adapter: string,
  hint: string,
): void => {
  const actual = Number.parseInt(installed.version.split('.')[0] ?? '', 10)
  if (actual !== major) {
    throw new ConfigError(
      `React adapter '${adapter}' needs ${installed.name} ${String(major)}.x, but ${installed.version} is installed. ${hint}`,
    )
  }
}
