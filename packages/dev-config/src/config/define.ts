import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConfigError } from '../errors.js'
import type { DevConfig, DevConfigInput } from './types.js'
import { validateConfigShape } from './validate.js'

const DEFINED = Symbol.for('@toolpath/dev-config/defined')

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

/**
 * Declares a repository's projects and validates them strictly. Paths resolve
 * from the configuration module's own directory, which `root: import.meta.url`
 * identifies, never from the invoking process's working directory.
 */
export const defineConfig = (input: DevConfigInput): DevConfig => {
  const issues = validateConfigShape(input)
  if (issues.length > 0) {
    throw new ConfigError('dev.config.mjs is invalid:', issues)
  }
  const file = fileURLToPath(input.root)
  const config = { ...structuredClone(input), file, directory: dirname(file) }
  Object.defineProperty(config, DEFINED, { value: true })
  return deepFreeze(config)
}

/** Whether a value came from `defineConfig` (and so was validated). */
export const isDefinedConfig = (value: unknown): value is DevConfig =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<symbol, unknown>)[DEFINED] === true
