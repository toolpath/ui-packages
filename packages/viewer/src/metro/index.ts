/**
 * The Metro settings a React Native app needs for `@toolpath/viewer`.
 *
 * Built as CommonJS for `metro.config.js`. It imports nothing, and reads only
 * the parts of Metro's config and resolution context it changes, so it takes
 * any Metro config and returns the same type.
 */

/** Metro's `CustomResolver`, as far as this reads it. */
type ResolveRequest = (
  context: ResolutionContext,
  moduleName: string,
  platform: string | null,
) => unknown

/** Metro's resolution context, as far as this reads it. */
interface ResolutionContext {
  /** Metro's own resolver, inside a custom one. */
  readonly resolveRequest: ResolveRequest
  readonly isESMImport?: boolean
  readonly unstable_enablePackageExports?: boolean
}

/** Metro's config, as far as this reads it. */
interface MetroConfig {
  resolver?: {
    assetExts?: ReadonlyArray<string>
    resolveRequest?: ResolveRequest | null
  }
}

/**
 * The app's Metro config, with what `@toolpath/viewer` needs:
 *
 * - `glb` among the asset extensions, for `@toolpath/viewer/banana`'s model;
 * - one three.js. React Three Fiber's native build `require`s `three`, which
 *   resolves to `three.cjs`, while ESM imports get `three.module.js`; with two
 *   copies, `instanceof` checks between them fail, and from three 0.186
 *   `three.cjs` calls `process.emitWarning`, which React Native does not have.
 *   So `three` resolves through Metro as an ESM import would, to three's
 *   `import` export, with package exports on for that one request.
 *
 * An existing `resolveRequest` still resolves every request, `three` included;
 * this only changes the context it gets for `three`.
 *
 * @example
 * const { getDefaultConfig } = require('expo/metro-config')
 * const { withToolpathViewer } = require('@toolpath/viewer/metro')
 *
 * module.exports = withToolpathViewer(getDefaultConfig(__dirname))
 */
export const withToolpathViewer = <Config extends MetroConfig>(config: Config): Config => {
  const assetExts = config.resolver?.assetExts ?? []
  const previous = config.resolver?.resolveRequest
  const resolveRequest: ResolveRequest = (context, moduleName, platform) => {
    const resolve = previous ?? context.resolveRequest
    if (moduleName !== 'three') return resolve(context, moduleName, platform)
    return resolve(
      { ...context, isESMImport: true, unstable_enablePackageExports: true },
      moduleName,
      platform,
    )
  }
  return {
    ...config,
    resolver: {
      ...config.resolver,
      assetExts: assetExts.includes('glb') ? assetExts : [...assetExts, 'glb'],
      resolveRequest,
    },
  }
}
