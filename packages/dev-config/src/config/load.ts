import { existsSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ConfigError } from '../errors.js'
import { isDefinedConfig } from './define.js'
import type { DevConfig } from './types.js'

export const CONFIG_FILE = 'dev.config.mjs'

/** The configuration file: an explicit `--config` path, or the nearest `dev.config.mjs` upward. */
export const findConfigFile = (start: string, explicit?: string): string => {
  if (explicit !== undefined) {
    const file = resolve(start, explicit)
    if (!existsSync(file)) {
      throw new ConfigError(`--config ${explicit}: ${file} does not exist`)
    }
    return realpathSync(file)
  }
  let directory = resolve(start)
  for (;;) {
    const candidate = join(directory, CONFIG_FILE)
    if (existsSync(candidate)) {
      return realpathSync(candidate)
    }
    const parent = dirname(directory)
    if (parent === directory) {
      throw new ConfigError(
        `No ${CONFIG_FILE} found in ${resolve(start)} or any parent directory. Run \`toolpath-dev init\` or pass --config <path>.`,
      )
    }
    directory = parent
  }
}

/**
 * Imports a configuration module and checks that it is the module it says it is:
 * its `root: import.meta.url` must name the file that was loaded.
 */
export const loadConfig = async (file: string): Promise<DevConfig> => {
  let module: { default?: unknown }
  try {
    module = (await import(pathToFileURL(file).href)) as { default?: unknown }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error
    }
    throw new ConfigError(`Could not load ${file}: ${(error as Error).message}`)
  }
  const config = module.default
  if (!isDefinedConfig(config)) {
    throw new ConfigError(
      `${file} must \`export default defineConfig({...})\` from @toolpath/dev-config.`,
    )
  }
  const declared = existsSync(config.file) ? realpathSync(config.file) : config.file
  if (declared !== realpathSync(file)) {
    throw new ConfigError(
      `${file} declares root ${config.root}, which is a different module. Set root: import.meta.url in the configuration file itself.`,
    )
  }
  return config
}
