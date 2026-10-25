import { toolchain } from '../../policy/toolchain.js'
import { noDirectEngineHttp } from './no-direct-engine-http.js'

/**
 * Optional Engine boundary rules. `createEslintConfig` applies them when
 * `dev.config.mjs` selects the `engine` profile; this entry exposes the plugin
 * and its documented detection boundary for direct use.
 */
export const rules = {
  'no-direct-engine-http': noDirectEngineHttp,
}

export const plugin = {
  meta: { name: '@toolpath/dev-config/engine/eslint', namespace: 'toolpath-engine' },
  rules,
}

/** Public Engine origins the rule recognizes when a configuration names none. */
export const DEFAULT_ENGINE_ORIGINS: ReadonlyArray<string> = [
  toolchain.engine.origins.production,
  toolchain.engine.origins.staging,
]

/** Private SDK paths: everything but the package root, which is its only public entry. */
export const SDK_PRIVATE_IMPORT_PATTERNS: ReadonlyArray<string> = ['@toolpath/api/*']

export default plugin
