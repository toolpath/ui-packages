import { describe, expect, it, vi } from 'vitest'
import { withToolpathViewer } from '../src/metro/index.js'

/** Metro's resolution context, as far as the helper reads it. */
interface Context {
  resolveRequest: (context: Context, moduleName: string, platform: string | null) => unknown
  isESMImport?: boolean
  unstable_enablePackageExports?: boolean
}

/** Metro's default resolver, as a custom resolver's context hands it over: it records what it was asked. */
const createContext = () => {
  const resolveRequest = vi.fn((context: Context, moduleName: string) => ({
    type: 'sourceFile' as const,
    filePath: `${moduleName}${context.isESMImport ? ' (import)' : ''}`,
  }))
  return { resolveRequest, isESMImport: false, unstable_enablePackageExports: false }
}

const configWith = (resolver: {
  assetExts?: ReadonlyArray<string>
  resolveRequest?: Context['resolveRequest']
}) => ({ projectRoot: '/app', resolver })

/** The resolver the helper leaves in the config. */
const resolverOf = (config: ReturnType<typeof configWith>): Context['resolveRequest'] => {
  const resolveRequest = config.resolver.resolveRequest
  if (!resolveRequest) throw new Error('no resolveRequest')
  return resolveRequest
}

describe('withToolpathViewer', () => {
  it('adds glb to the asset extensions once', () => {
    const config = withToolpathViewer(configWith({ assetExts: ['png', 'jpg'] }))
    expect(config.resolver.assetExts).toEqual(['png', 'jpg', 'glb'])
    expect(withToolpathViewer(config).resolver.assetExts).toEqual(['png', 'jpg', 'glb'])
    expect(withToolpathViewer(configWith({ assetExts: ['glb'] })).resolver.assetExts).toEqual([
      'glb',
    ])
  })

  it('keeps the rest of the config', () => {
    const config = withToolpathViewer(configWith({ assetExts: [] }))
    expect(config.projectRoot).toBe('/app')
  })

  it('resolves three with the import condition, through Metro', () => {
    const resolveRequest = resolverOf(withToolpathViewer(configWith({})))
    const context = createContext()

    expect(resolveRequest(context, 'three', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: 'three (import)',
    })
    expect(context.resolveRequest).toHaveBeenCalledWith(
      expect.objectContaining({ isESMImport: true, unstable_enablePackageExports: true }),
      'three',
      'ios',
    )
  })

  it('passes every other module through as it was asked for', () => {
    const resolveRequest = resolverOf(withToolpathViewer(configWith({})))
    const context = createContext()

    resolveRequest(context, 'three/addons/loaders/GLTFLoader.js', 'android')
    resolveRequest(context, 'react-native', 'android')

    expect(context.resolveRequest.mock.calls.map(([asked, name]) => [asked, name])).toEqual([
      [context, 'three/addons/loaders/GLTFLoader.js'],
      [context, 'react-native'],
    ])
  })

  it("chains the app's own resolveRequest, three included", () => {
    const own = vi.fn((context: Context, moduleName: string, platform: string | null) =>
      moduleName === 'custom'
        ? { type: 'empty' as const }
        : context.resolveRequest(context, moduleName, platform),
    )
    const resolveRequest = resolverOf(withToolpathViewer(configWith({ resolveRequest: own })))
    const context = createContext()

    expect(resolveRequest(context, 'custom', 'ios')).toEqual({ type: 'empty' })
    expect(resolveRequest(context, 'three', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: 'three (import)',
    })
    expect(own).toHaveBeenCalledTimes(2)
    expect(own.mock.calls[1]?.[0]).toMatchObject({ isESMImport: true })
  })
})
